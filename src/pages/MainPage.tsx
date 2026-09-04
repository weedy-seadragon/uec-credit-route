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
import { useMemo, useState } from 'react'
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
  // 「◯年次前学期」のような表示文字列を作る（標準年次・学期が無い科目は空文字を返す）
  function yearTermOf(code: string): string {
    const s = subjectsByCode.get(code)
    if (!s || s.standardYear === null) return ''
    return `${s.standardYear}年次${s.termType ?? ''}`
  }
  // 「2単位・1年次前学期」のような、科目名の横に添える単位数＋年次のラベルを作る
  function creditsLabel(code: string): string {
    const credits = creditsOf(code) ?? '?'
    const yearTerm = yearTermOf(code)
    return yearTerm ? `${credits}単位・${yearTerm}` : `${credits}単位`
  }
  // 他プログラムの専門科目なら、科目名の横に添える注記（該当しなければ何も出さない）
  function otherProgramTag(code: string) {
    if (!isOtherProgramSubject(code, requirementSet?.programSuffix)) return null
    return <span style={{ color: '#666', fontSize: '0.85em', marginLeft: '0.4em' }}>［他プログラム専門科目］</span>
  }

  return (
    <main>
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
        </button>
        {/* 「更新」と、その後のダウンロード等のボタン群を分けて見せるための余白。
            ボタン1個ぶんくらいの幅をあけたいだけなので、CSSクラスは作らずインラインで済ませる */}
        <span style={{ display: 'inline-block', width: '4em' }} />
        <button type="button" onClick={handleDownload}>
          単位取得状況をダウンロード
        </button>{' '}
        {/* ファイル選択ボタンは<input type="file">が標準の見た目しか持てないので、
            <label>で挟んでボタンっぽく振る舞わせている（htmlForで結びつけると、
            ラベルをクリック＝隠れたinputをクリックしたことになる） */}
        <label>
          読み込み
          <input type="file" accept="application/json" onChange={handleFileImport} style={{ display: 'none' }} />
        </label>{' '}
        <button type="button" onClick={handleReset}>
          リセット（全て未履修へ）
        </button>
        {dataMessage && <p role="status">{dataMessage}</p>}
      </div>

      <section>
        <h2>取得単位（{passedSubjects.length}）</h2>
        {passedByCategory.map(({ label, items }) => (
          <div key={label}>
            <h3>{label}</h3>
            <ul>
              {items.map(([code]) => (
                <li key={code}>
                  {nameOf(code)}（{creditsLabel(code)}）{otherProgramTag(code)}
                  <SubjectStatusSelect code={code} value={draft.get(code)} onChange={handleDraftChange} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        {passedSubjects.length === 0 && <p>（まだありません）</p>}
      </section>

      <section>
        <h2>不可の単位（{failedSubjects.length}）</h2>
        <ul>
          {failedSubjects.map(([code]) => (
            <li key={code}>
              {nameOf(code)}（{creditsLabel(code)}）{otherProgramTag(code)}
              <SubjectStatusSelect code={code} value={draft.get(code)} onChange={handleDraftChange} />
            </li>
          ))}
          {failedSubjects.length === 0 && <li>（ありません）</li>}
        </ul>
      </section>

      <section>
        <h2>残りの必修（あと {requiredShortfall(boundaryGroups)} 単位）</h2>
        {remainingRequiredByCategory.map(({ label, items }) => (
          <div key={label}>
            <h3>{label}</h3>
            <ul>
              {items.map((r) => (
                <li key={r.code}>
                  {nameOf(r.code)}（{creditsLabel(r.code)}・{committed.get(r.code) === 'failed' ? '必修・再履修' : '必修'}）{otherProgramTag(r.code)}
                  {r.laterThanStandardYearNote && <span> {r.laterThanStandardYearNote}</span>}
                  <SubjectStatusSelect code={r.code} value={draft.get(r.code)} onChange={handleDraftChange} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        {remainingRequired.length === 0 && <p>（この表示範囲では残っていません）</p>}
      </section>

      <section>
        <h2>選択科目</h2>
        <p style={{ fontSize: '0.9em', color: '#555' }}>
          ※ 他プログラムの専門科目（［他プログラム専門科目］の表示があるもの）を履修した場合も、専門科目の単位として扱われます（学修要覧より）
        </p>
        {boundaryGroups.map((g) => (
          <GroupProgress
            key={g.id}
            group={g}
            committed={committed}
            draft={draft}
            onChange={handleDraftChange}
            nameOf={nameOf}
            creditsLabel={creditsLabel}
            otherProgramTag={otherProgramTag}
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
  otherProgramTag,
}: {
  group: BoundaryGroup
  committed: ReadonlyMap<string, SubjectStatus>
  draft: ReadonlyMap<string, SubjectStatus>
  onChange: (code: string, status: SubjectStatus | undefined) => void
  nameOf: (code: string) => string
  creditsLabel: (code: string) => string
  otherProgramTag: (code: string) => ReactNode
}) {
  // 一覧に出す／消すのは committed（確定済み）で判断する。draft はプルダウンの表示値にだけ使う。
  // こうしないと、「更新」を押す前にプルダウンを触っただけで行が消えてしまい、
  // 「残りの必修」など他のセクションと表示の整合性が取れなくなる。
  const remaining = group.subjects.filter((code) => committed.get(code) !== 'passed')
  return (
    <details>
      <summary>
        {group.label ?? group.name} {group.contribution} / {group.required}
        {group.satisfied ? ' ✔' : ''}
      </summary>
      <ul>
        {remaining.map((code) => (
          <li key={code}>
            {nameOf(code)}（{creditsLabel(code)}）{otherProgramTag(code)}
            <SubjectStatusSelect code={code} value={draft.get(code)} onChange={onChange} />
          </li>
        ))}
        {remaining.length === 0 && <li>（すべて修得済みです）</li>}
      </ul>
    </details>
  )
}
