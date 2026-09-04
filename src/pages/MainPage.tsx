// メイン画面（"/main"）。F-3（充足チェック）・F-4（残りの提示）に対応。
//
// このアプリの中心になる画面。プロフィール（/setupで設定済み）と履修記録（このページで編集）から、
// 「あと何が足りないか」を計算して表示する。計算そのものは src/domain/ の純粋関数
// （evaluateRequirements・recommend）に任せ、このファイルは「その結果をどう並べて表示するか」だけを担当する。
//
// 簡略化している点（将来のフェーズで拡張する）：
// - 科目ごとの状態変更は、要覧のスケッチにある「履修予定チェック」ではなく、
//   すべての一覧で共通の「未履修/履修中/修得/不合格」プルダウン1つに統一している
//   （取得単位への追加も、この操作を通じて行う。ファイルからの読み込み等はフェーズ2-5で対応）
// - 先修科目・曜日時限のデータがまだ無いので、同時限警告は出ない（recommend.ts参照）
// - 審査（2年次終了時審査など）の合否表示はまだ実装していない
import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { GroupKind, RequirementGroup, SubjectStatus } from '../domain/requirements'
import { evaluateRequirements } from '../domain/requirements'
import type { GroupResult } from '../domain/requirements'
import type { SubjectInfo, TermFilter } from '../domain/recommend'
import { recommend } from '../domain/recommend'
import type { ExportedData } from '../domain/importers'
import { mergeRecords, parseOwnFormat } from '../domain/importers'
import { getRequirementSet, getSubjectCredits, getSubjectsByCode } from '../data/requirementSets'
import type { Profile } from '../storage/profile'
import { loadProfile } from '../storage/profile'
import { loadRecords, saveRecords } from '../storage/records'
import SubjectStatusSelect from '../components/SubjectStatusSelect'

/** プロフィールのうち、要件セットを引くのに必要な項目が揃っている状態 */
interface LoadedProfile extends Omit<Profile, 'cluster' | 'program'> {
  cluster: 'I' | 'II' | 'III'
  program: string
}

/** 表示フィルタ（画面右上）の選択肢。値はそのままrecommend.tsのTermFilterに変換できる形にしておく */
const TERM_OPTIONS: { key: string; label: string; filter: TermFilter }[] = [
  { key: 'all', label: '全学年', filter: 'all' },
  ...([1, 2, 3, 4] as const).flatMap((year) =>
    (['前学期', '後学期'] as const).map((half) => ({
      key: `${year}-${half}`,
      label: `${year}年${half === '前学期' ? '前期' : '後期'}`,
      filter: { year, half } as TermFilter,
    })),
  ),
]

/**
 * 科目コードが「自分のプログラムではなく、他プログラムの専門科目」かどうかを判定する。
 * 学修要覧 付録C 注1「他プログラムの専門科目も選択として履修できる」に対応する表示のために使う。
 * 末尾が英字a〜（プログラムごとの記号）で、かつ自分のプログラムの記号と違う場合だけ該当とする。
 * 末尾が"z"（共通科目扱い）や、programSuffixが無い（末尾記号を持たないプログラム）場合は該当しない。
 */
function isOtherProgramSubject(code: string, ownSuffix: string | undefined): boolean {
  if (!ownSuffix) return false
  const lastChar = code.slice(-1)
  return /^[a-y]$/.test(lastChar) && lastChar !== ownSuffix
}

/** 判定境界になっているグループ（＝required/contribution/shortfallを持つグループ）だけを木から集める */
interface BoundaryGroup {
  id: string
  name: string
  label?: string
  kind: GroupKind
  required: number
  contribution: number
  shortfall: number
  satisfied: boolean
  subjects: string[]
}

/**
 * 判定境界グループの「持ち科目」を集める。
 *
 * 「上級科目」のように、判定境界（kindを持つ）自身は subjects が空で、実際の科目は
 * 判定境界でない子（A類・B類…）の中にある、というケースがある。その場合も
 * ちゃんと科目を拾えるように、子を再帰的にたどって集める。ただし、子自身が
 * 別の判定境界（kindを持つ）なら、そちらは別エントリとして数えるのでここには含めない。
 */
function flattenLeafSubjects(rg: RequirementGroup): string[] {
  const own = rg.subjects ?? []
  const fromChildren = (rg.children ?? []).filter((c) => c.kind === undefined).flatMap(flattenLeafSubjects)
  return [...own, ...fromChildren]
}

/**
 * 科目コードの並びを、科目名が同じもの同士でまとめて1つにする（「幾何学概論」がMTH501a/b/c/dの
 * ように、実質同じ科目が複数プログラムの科目コードとして重複して並ぶケースがあるため）。
 * 同じ名前が複数あるときは、自分のプログラムの科目（isOtherProgramがfalseのもの）を優先して残す。
 * 出てくる順番は、その名前が最初に出てきた位置のまま変えない。
 */
function dedupeByName(codes: readonly string[], nameOf: (code: string) => string, isOtherProgram: (code: string) => boolean): string[] {
  const chosenByName = new Map<string, string>()
  for (const code of codes) {
    const name = nameOf(code)
    const chosen = chosenByName.get(name)
    // まだ無ければそのまま採用。既にあるが、それが他プログラムの科目で今回が自分のプログラムの科目なら差し替える
    if (!chosen || (isOtherProgram(chosen) && !isOtherProgram(code))) chosenByName.set(name, code)
  }
  return [...chosenByName.values()]
}

function collectBoundaryGroups(reqGroups: readonly RequirementGroup[], evalGroups: readonly GroupResult[]): BoundaryGroup[] {
  const out: BoundaryGroup[] = []
  // requirements.ts が組み立てた木を、要件定義（reqGroups）と判定結果（evalGroups）を
  // 同じ位置（同じ添字）で見比べながらたどる。判定境界（kindが付いている）ノードだけ拾う
  function walk(rgs: readonly RequirementGroup[], egs: readonly GroupResult[]) {
    for (let i = 0; i < rgs.length; i++) {
      const rg = rgs[i]
      const eg = egs[i]
      if (eg.kind !== undefined) {
        out.push({
          id: rg.id, name: rg.name, label: rg.label, kind: eg.kind,
          required: eg.required, contribution: eg.contribution, shortfall: eg.shortfall, satisfied: eg.satisfied,
          subjects: flattenLeafSubjects(rg),
        })
      }
      if (rg.children) walk(rg.children, eg.children) // 判定境界でなくても、子はさらにたどる
    }
  }
  walk(reqGroups, evalGroups)
  return out
}

/** 科目コード → その科目が属する判定境界グループ、の対応表を作る（表示のグルーピング用） */
function buildCategoryLookup(groups: readonly BoundaryGroup[]): Map<string, BoundaryGroup> {
  const lookup = new Map<string, BoundaryGroup>()
  for (const group of groups) {
    for (const code of group.subjects) {
      if (!lookup.has(code)) lookup.set(code, group) // 複数の区分に載っていたら、先に見つかった方を優先する
    }
  }
  return lookup
}

/** items を、対応表（codeToGroup）で引ける区分ごとに振り分ける。区分が見つからないものは「その他」に入る */
function groupByCategory<T>(
  items: readonly T[],
  codeOf: (item: T) => string,
  codeToGroup: ReadonlyMap<string, BoundaryGroup>,
): { label: string; items: T[] }[] {
  const byGroupId = new Map<string, { label: string; items: T[] }>()
  const others: T[] = []
  // 1件ずつ、対応表から区分を引いて、区分IDごとのバケツに積んでいく
  for (const item of items) {
    const group = codeToGroup.get(codeOf(item))
    if (!group) {
      others.push(item) // 区分が見つからない（通常は起きないはずの）ものは「その他」に逃がす
      continue
    }
    const bucket = byGroupId.get(group.id)
    if (bucket) bucket.items.push(item)
    else byGroupId.set(group.id, { label: group.label ?? group.name, items: [item] })
  }
  const result = [...byGroupId.values()]
  if (others.length > 0) result.push({ label: 'その他', items: others })
  return result
}

/**
 * 「他プログラム専門科目」「留学生のみ履修可」など、通常の科目とは別枠にまとめたい科目群を
 * 畳んでおく<li>（1件も無ければ何も出さない）。「類専門（選択）」などの区分と同じ<details>の
 * 形にして、普段は開かなくても他の科目一覧の邪魔にならないようにする。
 */
function CollapsedSubjectGroup<T>({
  title,
  items,
  codeOf,
  renderRow,
}: {
  title: string
  items: readonly T[]
  codeOf: (item: T) => string
  renderRow: (item: T) => ReactNode
}) {
  if (items.length === 0) return null
  return (
    <li>
      <details>
        <summary>
          {title}（{items.length}）
        </summary>
        <ul>
          {items.map((item) => (
            <li key={codeOf(item)}>{renderRow(item)}</li>
          ))}
        </ul>
      </details>
    </li>
  )
}

export default function MainPage() {
  // プロフィールはページを開いたときの1回だけ読めばよい（他のページで変更されたら再訪問時に読み直される）
  const [profile] = useState(() => loadProfile())

  // プロフィールが無い（または類が未設定）と要件セットを引けないので、案内だけ出して終わる
  if (!profile || !profile.cluster) {
    return (
      <main>
        <h1>メイン画面</h1>
        <p>
          まだプロフィールが設定されていません。<Link to="/setup">プロフィール設定</Link>から始めてください。
        </p>
      </main>
    )
  }
  // プログラム未定のときは、専門科目を含む判定ができない（docs/SPEC.md F-1）
  if (!profile.program) {
    return (
      <main>
        <h1>メイン画面</h1>
        <p>プログラムが未定のため、専門科目を含めた判定はまだ表示できません（プログラム比較機能は今後実装予定）。</p>
        <p>
          <Link to="/setup">プロフィール設定</Link>でプログラムを選ぶか、配属を待ってください。
        </p>
      </main>
    )
  }

  return <MainPageContent profile={{ ...profile, cluster: profile.cluster, program: profile.program }} />
}

function MainPageContent({ profile }: { profile: LoadedProfile }) {
  const requirementSet = useMemo(
    () => getRequirementSet(profile.entryYear, profile.course, profile.cluster, profile.program),
    [profile],
  )
  const subjectsByCode = useMemo(() => getSubjectsByCode(), [])
  const subjectCredits = useMemo(() => getSubjectCredits(), [])
  // recommend.ts が要求する SubjectInfo 型（必要な項目だけ）に、科目マスタの情報を詰め替える
  const recommendSubjects = useMemo<ReadonlyMap<string, SubjectInfo>>(() => {
    const map = new Map<string, SubjectInfo>()
    for (const s of subjectsByCode.values()) {
      map.set(s.code, { code: s.code, credits: s.credits, standardYear: s.standardYear, termType: s.termType })
    }
    return map
  }, [subjectsByCode])

  // committed = 実際に判定に使われている確定済みの記録。draft = プルダウンで編集中の内容。
  // 「更新」ボタンを押すまでは、上の集計（取得単位・残りの必修など）は committed のまま変わらない
  // （docs/SPEC.md F-4「更新ボタン」参照）。
  const [committed, setCommitted] = useState<ReadonlyMap<string, SubjectStatus>>(() => loadRecords())
  const [draft, setDraft] = useState<ReadonlyMap<string, SubjectStatus>>(committed)
  const [termKey, setTermKey] = useState('all')
  // ダウンロード・読み込みの結果を一言表示するためのメッセージ（F-8）
  const [dataMessage, setDataMessage] = useState<string | null>(null)
  // 「単位取得状況をファイルから読み込む」ボタンから、見えない<input type="file">を操作するための参照
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Ⅱ・Ⅲ類・夜間主などまだデータが無い組み合わせの場合はここで終わる
  if (!requirementSet) {
    return (
      <main>
        <h1>メイン画面</h1>
        <p>
          このプロフィール（{profile.entryYear}年度 / {profile.course} / {profile.cluster}類 / {profile.program}）の
          要件データはまだありません。
        </p>
      </main>
    )
  }

  // 充足状況の本体計算はrequirements.tsに丸ごと任せる。ここから先はその結果を並べるだけ
  const evaluation = evaluateRequirements(requirementSet, committed, subjectCredits)
  const boundaryGroups = collectBoundaryGroups(requirementSet.groups, evaluation.groups)
  const requiredCodes = new Set(boundaryGroups.filter((g) => g.kind === 'required').flatMap((g) => g.subjects))
  // 「取得単位」「残りの必修」を区分ごとに見出しを分けて表示するための対応表
  const categoryLookup = buildCategoryLookup(boundaryGroups)

  // 表示フィルタ（学期）に応じて、履修できる科目だけをスコア順に並べたものを取得する
  const termFilter = TERM_OPTIONS.find((t) => t.key === termKey)?.filter ?? 'all'
  const recommended = recommend({
    requirementSet, evaluation, records: committed, subjects: recommendSubjects,
    currentGrade: profile.grade, termFilter,
  })
  // 「残りの必修」に出すのは、必修グループに属していて、まだ修得していないものだけ
  const remainingRequired = recommended.filter((r) => requiredCodes.has(r.code) && committed.get(r.code) !== 'passed')

  // 取得単位・不可の単位のセクションは、committed（確定済み）を状態別に振り分けるだけでよい
  const passedSubjects = [...committed.entries()].filter(([, status]) => status === 'passed')
  const failedSubjects = [...committed.entries()].filter(([, status]) => status === 'failed')
  // 「取得単位」「残りの必修」は区分ごとの見出しを付けて表示する（例:「理数基礎（必修）」「類専門（必修）」）
  const passedByCategory = groupByCategory(passedSubjects, ([code]) => code, categoryLookup)
  const remainingRequiredByCategory = groupByCategory(remainingRequired, (r) => r.code, categoryLookup)

  // プルダウンで状態を変えたとき：draftだけを更新する（committedはまだ変えない）
  function handleDraftChange(code: string, status: SubjectStatus | undefined) {
    setDraft((prev) => {
      const next = new Map(prev)
      if (status === undefined) next.delete(code) // 「未履修」に戻す＝記録を消す
      else next.set(code, status)
      return next
    })
  }

  // 「更新」ボタンを押したとき：draftの内容をcommittedへ反映し、localStorageにも保存する
  function handleUpdate() {
    setCommitted(draft)
    saveRecords(draft)
  }

  // 「ダウンロード」ボタンを押したとき：今の記録を本サイト形式JSON（§7.4）としてファイルに書き出す
  function handleDownload() {
    const data: ExportedData = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      profile,
      records: [...committed.entries()].map(([code, status]) => ({ code, name: nameOf(code), status })),
      planned: [],
    }

    // ブラウザにファイルをダウンロードさせる標準的な方法：
    // Blob（データのかたまり）を作り、それを指す一時URLを見えない<a>タグに設定してクリックする
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const fileName = `uec-credits_${profile.entryYear}_${profile.cluster}_${profile.program}_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.json`
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    setDataMessage('ダウンロードしました。')
  }

  // 「読み込み」でファイルを選んだとき：内容を検証し、今の記録にマージしてすぐ画面へ反映する
  async function handleFileImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 同じファイルを続けて選んでもchangeイベントが発火するようにリセットする
    if (!file) return

    try {
      const json: unknown = JSON.parse(await file.text())
      const imported = parseOwnFormat(json)
      const { merged, added, updated } = mergeRecords(committed, imported.records)
      setCommitted(merged)
      setDraft(merged) // 編集中の内容も、読み込んだ内容に合わせておく
      saveRecords(merged)
      setDataMessage(`${added}件追加、${updated}件更新しました。`)
    } catch (err) {
      setDataMessage(`読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 「リセット」ボタンを押したとき：確認してから、記録を全部「未履修」に戻す（プロフィールは残す）
  function handleReset() {
    if (!window.confirm('取得・不可の記録をすべて未履修に戻します。よろしいですか？（プロフィールは残ります）')) return
    const empty: ReadonlyMap<string, SubjectStatus> = new Map()
    setCommitted(empty)
    setDraft(empty)
    saveRecords(empty)
    setDataMessage('すべての記録を未履修に戻しました。')
  }

  // 科目コードから表示用の名前・単位数を引く小さなヘルパー（見つからなければコードをそのまま出す）
  function nameOf(code: string): string {
    return subjectsByCode.get(code)?.name ?? code
  }
  function creditsOf(code: string): number | undefined {
    return subjectsByCode.get(code)?.credits
  }
  // ()内に入れる単位数の表示（単位数だけにする。年次・学期は別枠のyearTermTagで出す）
  function creditsLabel(code: string): string {
    return `${creditsOf(code) ?? '?'}単位`
  }
  // 「◯年次前学期」のような表示文字列を作る（標準年次・学期が無い科目は空文字を返す）
  function yearTermOf(code: string): string {
    const s = subjectsByCode.get(code)
    if (!s || s.standardYear === null) return ''
    return `${s.standardYear}年次${s.termType ?? ''}`
  }
  // 年次・学期を、科目名の横に添える注記にする（無ければ何も出さない）。色は他の文字と揃える
  // （一覧によって出たり出なかったりすると分かりにくいので、全部の一覧で同じ形で出す）
  function yearTermTag(code: string) {
    const yearTerm = yearTermOf(code)
    if (!yearTerm) return null
    return <span style={{ marginLeft: '0.4em' }}>{yearTerm}</span>
  }
  // 他プログラムの専門科目かどうか
  function isOtherProgram(code: string): boolean {
    return isOtherProgramSubject(code, requirementSet?.programSuffix)
  }
  // 外国人留学生しか履修できない科目かどうか
  function isInternational(code: string): boolean {
    return subjectsByCode.get(code)?.forInternational ?? false
  }
  /**
   * 一覧の項目を、①通常の科目・②他プログラムの専門科目・③留学生のみ履修できる科目、の3つに分ける。
   * ②③は「留学生のみ履修可」と同じ形の折りたたみにまとめて出す（普通の科目一覧を長くしすぎないため）。
   * 両方に該当する科目は、より限定的な③（留学生のみ）の方にまとめる。
   */
  function splitSpecialSubjects<T>(
    items: readonly T[],
    codeOf: (item: T) => string,
  ): { regular: T[]; otherProgram: T[]; international: T[] } {
    const regular: T[] = []
    const otherProgram: T[] = []
    const international: T[] = []
    for (const item of items) {
      const code = codeOf(item)
      if (isInternational(code)) international.push(item)
      else if (isOtherProgram(code)) otherProgram.push(item)
      else regular.push(item)
    }
    return { regular, otherProgram, international }
  }

  return (
    // 下側に余白を持たせる：最後の区分（類専門など）の<summary>がページ最下端にくっついて
    // クリックしづらくならないようにするため
    <main style={{ paddingBottom: '6rem' }}>
      <h1>
        {profile.entryYear}入学 / {profile.cluster}類 / {profile.program} / {profile.grade}年{' '}
        <Link to="/setup">[変更]</Link>
      </h1>
      <p>
        合計 {evaluation.totalCredits.contribution} / {evaluation.totalCredits.required}
        {evaluation.totalCredits.satisfied ? ' ✔' : ''}
      </p>

      <div>
        <label htmlFor="termFilter">表示: </label>
        <select id="termFilter" value={termKey} onChange={(e) => setTermKey(e.target.value)}>
          {TERM_OPTIONS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>{' '}
        <button type="button" onClick={handleUpdate}>
          更新
        </button>{' '}
        <button type="button" onClick={handleReset}>
          リセット（全ての科目を未履修へ変更）
        </button>
        {/* 「更新」「リセット」と、その後のダウンロード等のボタン群を分けて見せるための余白。
            ボタン1個ぶんくらいの幅をあけたいだけなので、CSSクラスは作らずインラインで済ませる */}
        <span style={{ display: 'inline-block', width: '4em' }} />
        <button type="button" onClick={handleDownload}>
          単位取得状況をダウンロード
        </button>{' '}
        {/* ファイル選択は、見えない<input type="file">をrefで持っておき、
            普通の<button>のクリックでそれを間接的にクリックする形にする。
            <label>で代用する方法だと<button>と見た目をぴったり揃えられなかったため */}
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          単位取得状況をファイルから読み込む
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileImport}
          style={{ display: 'none' }}
        />
        {dataMessage && <p role="status">{dataMessage}</p>}
      </div>

      <section>
        <h2>取得単位（{passedSubjects.length}）</h2>
        {passedByCategory.map(({ label, items }) => {
          const { regular, otherProgram, international } = splitSpecialSubjects(items, ([code]) => code)
          const row = (code: string) => (
            <>
              {nameOf(code)}（{creditsLabel(code)}）{yearTermTag(code)}{' '}
              <SubjectStatusSelect code={code} value={draft.get(code)} onChange={handleDraftChange} />
            </>
          )
          return (
            <div key={label}>
              <h3>{label}</h3>
              <ul>
                {regular.map(([code]) => (
                  <li key={code}>{row(code)}</li>
                ))}
                <CollapsedSubjectGroup title="他プログラム専門科目" items={otherProgram} codeOf={([code]) => code} renderRow={([code]) => row(code)} />
                <CollapsedSubjectGroup title="留学生のみ履修可" items={international} codeOf={([code]) => code} renderRow={([code]) => row(code)} />
              </ul>
            </div>
          )
        })}
        {passedSubjects.length === 0 && (
          <ul>
            <li>（まだありません）</li>
          </ul>
        )}
      </section>

      <section>
        <h2>不可の単位（{failedSubjects.length}）</h2>
        <ul>
          {(() => {
            const { regular, otherProgram, international } = splitSpecialSubjects(failedSubjects, ([code]) => code)
            const row = (code: string) => (
              <>
                {nameOf(code)}（{creditsLabel(code)}）{yearTermTag(code)}{' '}
                <SubjectStatusSelect code={code} value={draft.get(code)} onChange={handleDraftChange} />
              </>
            )
            return (
              <>
                {regular.map(([code]) => (
                  <li key={code}>{row(code)}</li>
                ))}
                <CollapsedSubjectGroup title="他プログラム専門科目" items={otherProgram} codeOf={([code]) => code} renderRow={([code]) => row(code)} />
                <CollapsedSubjectGroup title="留学生のみ履修可" items={international} codeOf={([code]) => code} renderRow={([code]) => row(code)} />
              </>
            )
          })()}
          {failedSubjects.length === 0 && <li>（ありません）</li>}
        </ul>
      </section>

      <section>
        <h2>残りの必修（あと {requiredShortfall(boundaryGroups)} 単位）</h2>
        {remainingRequiredByCategory.map(({ label, items }) => {
          // ()内は単位数だけにする。年次・学期は他の一覧と同じ形の注記で統一する。
          // 再履修かどうかはこの後のプルダウンの選択値で分かる。他プログラム専門科目・留学生のみの
          // 科目は下の折りたたみにまとめる
          const { regular, otherProgram, international } = splitSpecialSubjects(items, (r) => r.code)
          const row = (code: string) => (
            <>
              {nameOf(code)}（{creditsLabel(code)}）{yearTermTag(code)}{' '}
              <SubjectStatusSelect code={code} value={draft.get(code)} onChange={handleDraftChange} />
            </>
          )
          return (
            <div key={label}>
              <h3>{label}</h3>
              <ul>
                {regular.map((r) => (
                  <li key={r.code}>{row(r.code)}</li>
                ))}
                <CollapsedSubjectGroup title="他プログラム専門科目" items={otherProgram} codeOf={(r) => r.code} renderRow={(r) => row(r.code)} />
                <CollapsedSubjectGroup title="留学生のみ履修可" items={international} codeOf={(r) => r.code} renderRow={(r) => row(r.code)} />
              </ul>
            </div>
          )
        })}
        {remainingRequired.length === 0 && <p>（この表示範囲では残っていません）</p>}
      </section>

      <section>
        <h2>選択科目</h2>
        <p style={{ fontSize: '0.9em', color: '#555' }}>
          ※ 他プログラムの専門科目（各区分の中の「他プログラム専門科目」にまとめているもの）を履修した場合も、専門科目の単位として扱われます（学修要覧より）
        </p>
        {/* ここに出すのは「選択」「選択必修」の区分だけ（必修は上の「残りの必修」で扱う。自由・国際は対象外）。
            必要単位が0のグループ（そのプログラムでは使わない区分）も出す意味が無いので除く。
            この条件だけで絞るので、プログラムによって実際に何が出るかは自然に変わる */}
        {boundaryGroups
          .filter((g) => (g.kind === 'elective' || g.kind === 'elective-required') && g.required > 0)
          .map((g) => (
            <GroupProgress
              key={g.id}
              group={g}
              committed={committed}
              draft={draft}
              onChange={handleDraftChange}
              nameOf={nameOf}
              creditsLabel={creditsLabel}
              yearTermTag={yearTermTag}
              isOtherProgram={isOtherProgram}
              isInternational={isInternational}
            />
          ))}
      </section>
    </main>
  )
}

/** 見出しの「あと○単位」用に、必修グループぶんの不足単位数だけを合計する */
function requiredShortfall(groups: readonly BoundaryGroup[]): number {
  return groups.filter((g) => g.kind === 'required').reduce((sum, g) => sum + g.shortfall, 0)
}

function GroupProgress({
  group,
  committed,
  draft,
  onChange,
  nameOf,
  creditsLabel,
  yearTermTag,
  isOtherProgram,
  isInternational,
}: {
  group: BoundaryGroup
  committed: ReadonlyMap<string, SubjectStatus>
  draft: ReadonlyMap<string, SubjectStatus>
  onChange: (code: string, status: SubjectStatus | undefined) => void
  nameOf: (code: string) => string
  creditsLabel: (code: string) => string
  yearTermTag: (code: string) => ReactNode
  isOtherProgram: (code: string) => boolean
  isInternational: (code: string) => boolean
}) {
  // 一覧に出す／消すのは committed（確定済み）で判断する。draft はプルダウンの表示値にだけ使う。
  // こうしないと、「更新」を押す前にプルダウンを触っただけで行が消えてしまい、
  // 「残りの必修」など他のセクションと表示の整合性が取れなくなる。
  const remainingAll = group.subjects.filter((code) => committed.get(code) !== 'passed')
  // 「幾何学概論」のように、実質同じ科目が他プログラムの科目コードとして重複して選択肢に
  // 入ってしまうことがあるので、科目名が同じものは1つにまとめる（自分のプログラムの科目が
  // あればそちらを優先し、他プログラム専門科目としては出さない）
  const remaining = dedupeByName(remainingAll, nameOf, isOtherProgram)
  // 他プログラム専門科目・留学生のみ履修できる科目は、下の折りたたみにまとめる（他の一覧と同じ扱い）。
  // 両方に該当する科目は留学生のみの方に入れる
  const international = remaining.filter((code) => isInternational(code))
  const otherProgram = remaining.filter((code) => !isInternational(code) && isOtherProgram(code))
  const regular = remaining.filter((code) => !isInternational(code) && !isOtherProgram(code))
  const row = (code: string) => (
    <>
      {nameOf(code)}（{creditsLabel(code)}）{yearTermTag(code)}{' '}
      <SubjectStatusSelect code={code} value={draft.get(code)} onChange={onChange} />
    </>
  )
  return (
    <details>
      <summary>
        {group.label ?? group.name} {group.contribution} / {group.required}
        {group.satisfied ? ' ✔' : ''}
      </summary>
      <ul>
        {regular.map((code) => (
          <li key={code}>{row(code)}</li>
        ))}
        <CollapsedSubjectGroup title="他プログラム専門科目" items={otherProgram} codeOf={(code) => code} renderRow={row} />
        <CollapsedSubjectGroup title="留学生のみ履修可" items={international} codeOf={(code) => code} renderRow={row} />
        {remaining.length === 0 && <li>（すべて修得済みです）</li>}
      </ul>
    </details>
  )
}
