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
import { Link } from 'react-router-dom'
import type { GroupKind, RequirementGroup, SubjectStatus } from '../domain/requirements'
import { evaluateRequirements } from '../domain/requirements'
import type { GroupResult } from '../domain/requirements'
import type { SubjectInfo, TermFilter } from '../domain/recommend'
import { recommend } from '../domain/recommend'
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
          subjects: rg.subjects ?? [],
        })
      }
      if (rg.children) walk(rg.children, eg.children) // 判定境界でなくても、子はさらにたどる
    }
  }
  walk(reqGroups, evalGroups)
  return out
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

  // 科目コードから表示用の名前・単位数を引く小さなヘルパー（見つからなければコードをそのまま出す）
  function nameOf(code: string): string {
    return subjectsByCode.get(code)?.name ?? code
  }
  function creditsOf(code: string): number | undefined {
    return subjectsByCode.get(code)?.credits
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
      </div>

      <section>
        <h2>取得単位（{passedSubjects.length}）</h2>
        <ul>
          {passedSubjects.map(([code]) => (
            <li key={code}>
              {nameOf(code)}（{creditsOf(code) ?? '?'}単位）
              <SubjectStatusSelect code={code} value={draft.get(code)} onChange={handleDraftChange} />
            </li>
          ))}
          {passedSubjects.length === 0 && <li>（まだありません）</li>}
        </ul>
      </section>

      <section>
        <h2>不可の単位（{failedSubjects.length}）</h2>
        <ul>
          {failedSubjects.map(([code]) => (
            <li key={code}>
              {nameOf(code)}
              <SubjectStatusSelect code={code} value={draft.get(code)} onChange={handleDraftChange} />
            </li>
          ))}
          {failedSubjects.length === 0 && <li>（ありません）</li>}
        </ul>
      </section>

      <section>
        <h2>残りの必修（あと {requiredShortfall(boundaryGroups)} 単位）</h2>
        <ul>
          {remainingRequired.map((r) => (
            <li key={r.code}>
              {nameOf(r.code)}（{committed.get(r.code) === 'failed' ? '必修・再履修' : '必修・未修得'}）
              {r.laterThanStandardYearNote && <span> {r.laterThanStandardYearNote}</span>}
              <SubjectStatusSelect code={r.code} value={draft.get(r.code)} onChange={handleDraftChange} />
            </li>
          ))}
          {remainingRequired.length === 0 && <li>（この表示範囲では残っていません）</li>}
        </ul>
      </section>

      <section>
        <h2>区分別の進捗</h2>
        {boundaryGroups.map((g) => (
          <GroupProgress key={g.id} group={g} committed={committed} draft={draft} onChange={handleDraftChange} nameOf={nameOf} />
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
}: {
  group: BoundaryGroup
  committed: ReadonlyMap<string, SubjectStatus>
  draft: ReadonlyMap<string, SubjectStatus>
  onChange: (code: string, status: SubjectStatus | undefined) => void
  nameOf: (code: string) => string
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
            {nameOf(code)}
            <SubjectStatusSelect code={code} value={draft.get(code)} onChange={onChange} />
          </li>
        ))}
        {remaining.length === 0 && <li>（すべて修得済みです）</li>}
      </ul>
    </details>
  )
}
