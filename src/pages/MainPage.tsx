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
// - 履修中というステータス自体が無い（未履修/修得/不合格の3択）ため、busySlots（同時限警告）は
//   常に空のまま。先修科目（prerequisites）は2026-09-06にprerequisites.ts経由で配線した
import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { GroupKind, RequirementGroup, SubjectStatus } from '../domain/requirements'
import { evaluateRequirements } from '../domain/requirements'
import type { GroupResult } from '../domain/requirements'
import type { SubjectInfo, TermFilter } from '../domain/recommend'
import { recommend } from '../domain/recommend'
import { buildNameToCodes, derivePrerequisites } from '../domain/prerequisites'
import type { ExportedData } from '../domain/importers'
import { CURRENT_SCHEMA_VERSION, mergeRecords, parseOwnFormat } from '../domain/importers'
import { getClassAssignments, getProgramName, getRequirementSet, getSubjectCredits, getSubjectsByCode, getTransferBucketSubjects } from '../data/requirementSets'
import type { TransferBucketItem } from '../data/requirementSets'
import { resolveOfferingsForProfile, resolveSlotsForProfile } from '../domain/classAssignment'
import { evaluateReviews, findGroupResult } from '../domain/reviews'
import type { ReviewCondition } from '../domain/requirements'
import type { Profile } from '../storage/profile'
import { loadProfile } from '../storage/profile'
import { loadRecords, saveRecords } from '../storage/records'
import { loadOtherCommonCredits, saveOtherCommonCredits } from '../storage/otherCommonCredits'
import SubjectStatusSelect from '../components/SubjectStatusSelect'

/** プロフィールのうち、要件セットを引くのに必要な項目が揃っている状態（夜間主はcluster: null） */
interface LoadedProfile extends Omit<Profile, 'program'> {
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
  /** required を超えて修得した単位数（確定分）。区分の「上限なしの実際の取得単位」を表示するのに使う */
  overflow: number
  /** overflowのうち、実際に共通単位へ繰り入れられる分（overflowToCommon: falseの区分は0になる） */
  overflowToCommon: number
  /** trueなら、required と比較せず修得分をそのまま共通単位にする区分（理数基礎科目の選択科目など） */
  countAsCommon: boolean
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
          required: eg.required, contribution: eg.contribution, overflow: eg.overflow,
          overflowToCommon: eg.overflowToCommon, countAsCommon: rg.countAs === 'common',
          shortfall: eg.shortfall, satisfied: eg.satisfied,
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

/**
 * items を、判定境界グループごとに振り分ける。区分が見つからないものは「その他」に入る。
 * 表示順は items が出てきた順（記録した順）ではなく、orderedGroups の並び――つまり
 * 学修要覧の卒業所要単位表に書かれている順番（別表2の左から）に揃える。中身が無い区分は出さない。
 */
function groupByCategory<T>(
  items: readonly T[],
  codeOf: (item: T) => string,
  codeToGroup: ReadonlyMap<string, BoundaryGroup>,
  orderedGroups: readonly BoundaryGroup[],
): { label: string; group: BoundaryGroup | null; items: T[] }[] {
  const byGroupId = new Map<string, T[]>()
  const others: T[] = []
  // 1件ずつ、対応表から区分を引いて、区分IDごとのバケツに積んでいく（この時点では順番は気にしない）
  for (const item of items) {
    const group = codeToGroup.get(codeOf(item))
    if (!group) {
      others.push(item) // 区分が見つからない（通常は起きないはずの）ものは「その他」に逃がす
      continue
    }
    const bucket = byGroupId.get(group.id)
    if (bucket) bucket.push(item)
    else byGroupId.set(group.id, [item])
  }
  // 最後に、学修要覧の並び順（orderedGroups）に沿って結果を組み立て直す
  const result: { label: string; group: BoundaryGroup | null; items: T[] }[] = []
  for (const group of orderedGroups) {
    const bucket = byGroupId.get(group.id)
    if (bucket) result.push({ label: group.label ?? group.name, group, items: bucket })
  }
  if (others.length > 0) result.push({ label: 'その他', group: null, items: others })
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
    // 折りたたみ自体の▼と中の科目の・が並ぶと紛らわしいので、この<li>自体には・を付けない
    <li style={{ listStyleType: 'none' }}>
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

  // プロフィールが無いと要件セットを引けないので、案内だけ出して終わる。
  // 昼間コースは類が必須（docs/SPEC.md F-1）だが、夜間主コースは類の区分が無いのでcluster: nullのままでよい
  if (!profile || (profile.course === 'day' && !profile.cluster)) {
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
  const classAssignments = useMemo(() => getClassAssignments(), [])
  // プログラムが決まっていれば（2年後期以降）、その名前をクラス判定にも使う
  const programName = getProgramName(profile.program)
  // dayPeriodTag・nameLinkの両方で使う、クラス判定用プロフィール（resolveSlotsForProfile等の引数）
  const classProfile = {
    yearOneClass: profile.yearOneClass,
    classIABC: profile.classIABC,
    classIIArea: profile.classIIArea,
    classIIIYear2Class: profile.classIIIYear2Class,
    classIIIYear2Area: profile.classIIIYear2Area,
    programName,
  }
  // recommend.ts が要求する SubjectInfo 型（必要な項目だけ）に、科目マスタの情報を詰め替える。
  // prerequisites（先修科目）は、シラバスの自由記述テキスト（prerequisitesText）から
  // prerequisites.ts が安全に（完全一致するものだけ）抜き出したコード配列を使う
  const recommendSubjects = useMemo<ReadonlyMap<string, SubjectInfo>>(() => {
    const nameToCodes = buildNameToCodes([...subjectsByCode.values()])
    const map = new Map<string, SubjectInfo>()
    for (const s of subjectsByCode.values()) {
      map.set(s.code, {
        code: s.code,
        credits: s.credits,
        standardYear: s.standardYear,
        termType: s.termType,
        prerequisites: derivePrerequisites(s.prerequisitesText, s.code, nameToCodes),
      })
    }
    return map
  }, [subjectsByCode])

  // committed = 実際に判定に使われている確定済みの記録。draft = プルダウンで編集中の内容。
  // 「更新」ボタンを押すまでは、上の集計（取得単位・残りの必修など）は committed のまま変わらない
  // （docs/SPEC.md F-4「更新ボタン」参照）。
  const [committed, setCommitted] = useState<ReadonlyMap<string, SubjectStatus>>(() => loadRecords())
  const [draft, setDraft] = useState<ReadonlyMap<string, SubjectStatus>>(committed)
  // その他単位認定（TOEIC等、科目を介さず共通単位として認定される単位数。0〜8単位、未履修=0）。
  // 科目の記録と同じくdraft/committedに分け、「更新」ボタンを押すまでは反映しない
  const [otherCommonCommitted, setOtherCommonCommitted] = useState<number>(() => loadOtherCommonCredits())
  const [otherCommonDraft, setOtherCommonDraft] = useState<number>(otherCommonCommitted)
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
          このプロフィール（{profile.entryYear}年度 / {profile.course}
          {profile.cluster ? ` / ${profile.cluster}類` : ''} / {profile.program}）の要件データはまだありません。
        </p>
      </main>
    )
  }

  // 転類・転プログラムした学生向けの「その他の科目」一覧（2026-09-07追加）。
  // 元の類・プログラムでは必修だったが今の要件には出てこない科目で、修得すれば共通単位になる。
  // 対象が無ければ空配列（getTransferBucketSubjects側でもチェックしているが、profileの
  // 入力が揃っていない場合はここで先に弾く）
  const clusterTransferBucket: TransferBucketItem[] =
    profile.transferredCluster && profile.previousCluster
      ? getTransferBucketSubjects(profile.entryYear, profile.previousCluster, null, 1, requirementSet)
      : []
  const programTransferBucket: TransferBucketItem[] =
    profile.transferredProgram && profile.previousProgramCluster
      ? getTransferBucketSubjects(profile.entryYear, profile.previousProgramCluster, profile.previousProgram ?? null, 2, requirementSet)
      : []
  // 「修得」にした分の単位を、その他単位認定と同じように共通単位の計算に足し込む
  // （これらの科目はrequirementSet.groupsのどこにも属さないので、放っておくとevaluateRequirements
  // からは見えない。commonCreditsの上限で頭打ちになる既存の仕組みをそのまま使うため、
  // otherCommonCreditsの引数にまとめて渡す）
  const transferBucketCreditsSum = [...clusterTransferBucket, ...programTransferBucket]
    .filter((item) => committed.get(item.code) === 'passed')
    .reduce((sum, item) => sum + item.credits, 0)
  const commonCreditsWithTransferBucket = otherCommonCommitted + transferBucketCreditsSum

  // 充足状況の本体計算はrequirements.tsに丸ごと任せる。ここから先はその結果を並べるだけ
  const evaluation = evaluateRequirements(requirementSet, committed, subjectCredits, commonCreditsWithTransferBucket)
  const boundaryGroups = collectBoundaryGroups(requirementSet.groups, evaluation.groups)
  // 審査（2年次終了時審査など）。reviewsデータが無いプログラムでは空配列になる（現在は全16課程にreviewsがある）。
  // reviewsを一度ローカル変数に受けておく（入れ子関数の中ではrequirementSetの絞り込みが効かないため）
  const reviews = requirementSet.reviews
  const reviewStatuses = reviews ? evaluateReviews(reviews, evaluation, committed, subjectCredits) : []
  const requiredCodes = new Set(boundaryGroups.filter((g) => g.kind === 'required').flatMap((g) => g.subjects))
  // 「取得単位」「残りの必修」を区分ごとに見出しを分けて表示するための対応表
  const categoryLookup = buildCategoryLookup(boundaryGroups)

  // 「共通単位」セクション用の内訳：
  // ①あぶれ分＝他の区分の必要単位を超えて共通単位に繰り入れられた分（countAsCommonの区分は除く）
  // ②取得した単位＝そもそも共通単位としてしか数えない科目（countAsCommonの区分の修得済み科目＋alwaysCommonSubjects）
  const overflowToCommonGroups = boundaryGroups.filter((g) => !g.countAsCommon && g.overflowToCommon > 0)
  const commonOnlyGroups = boundaryGroups.filter((g) => g.countAsCommon)
  const commonOnlySubjects = commonOnlyGroups.flatMap((g) => g.subjects.filter((code) => committed.get(code) === 'passed'))
  const alwaysCommonPassed = (requirementSet.alwaysCommonSubjects ?? []).filter((code) => committed.get(code) === 'passed')
  const directCommonSubjects = [...commonOnlySubjects, ...alwaysCommonPassed]
  // 見出しの「n/N単位」は、必要単位で頭打ちにせず実際に発生している共通単位候補の合計を出す
  // （取得単位のカテゴリ見出しと同じ考え方。上限は下の一覧の外の「合計」側で別途わかる）
  const commonOverflowTotal = overflowToCommonGroups.reduce((sum, g) => sum + g.overflowToCommon, 0)
  const commonDirectTotal = directCommonSubjects.reduce((sum, code) => sum + (subjectsByCode.get(code)?.credits ?? 0), 0)
  const commonEarnedTotal = commonOverflowTotal + commonDirectTotal + commonCreditsWithTransferBucket
  // 「選択科目」の共通単位の入れ子に出す、まだ修得していない常時共通単位科目
  // （理数基礎（選択）などcountAsCommonの区分の残り科目＋選択第二外国語などalwaysCommonSubjectsの残り）。
  // required=0の区分やalwaysCommonSubjectsはGroupProgressの対象外（required>0で絞っている）なので、
  // ここで拾わないとどこにも選択状態を変えるプルダウンが出ない
  // 不合格の科目は「不可の単位」に既に出るので、ここでは重複して出さない（committed.get(code) == nullで判定）
  const commonOnlyRemaining = [
    ...commonOnlyGroups.flatMap((g) => g.subjects.filter((code) => committed.get(code) == null)),
    ...(requirementSet.alwaysCommonSubjects ?? []).filter((code) => committed.get(code) == null),
  ]

  // 表示フィルタ（学期）に応じて、履修できる科目だけをスコア順に並べたものを取得する
  const termFilter = TERM_OPTIONS.find((t) => t.key === termKey)?.filter ?? 'all'
  const recommended = recommend({
    requirementSet, evaluation, records: committed, subjects: recommendSubjects,
    currentGrade: profile.grade, termFilter,
  })

  // 表示フィルタ（学期）で、この科目を「残りの必修」「選択科目」の一覧に出すかどうか判定する
  // （2026-09-08、開発者の指摘で追加。従来は「残りの必修」だけrecommend()のisOfferedInで
  // 絞られていて「選択科目」は絞られていなかった）。あくまで一覧に出す行を絞るだけで、
  // 必要単位・取得単位などの集計（evaluationの結果）には触れない
  function isVisibleForTermFilter(code: string): boolean {
    if (termFilter === 'all') return true
    const subject = subjectsByCode.get(code)
    if (!subject || subject.termType == null) return true // 通年・不定期開講科目は常に表示
    return subject.termType === termFilter.half && (subject.standardYear == null || subject.standardYear <= termFilter.year)
  }

  // 「残りの必修」に出すのは、必修グループに属していて、まだ修得していない（かつ不合格でもない）ものだけ。
  // 不合格の科目は「不可の単位」に既に出るので、ここでは重複して出さない
  // （2026-09-08、開発者の指摘：不可の単位に移動するのでそちらで分かる）
  const remainingRequired = recommended.filter(
    (r) => requiredCodes.has(r.code) && committed.get(r.code) == null && isVisibleForTermFilter(r.code),
  )

  // 取得単位・不可の単位のセクションは、committed（確定済み）を状態別に振り分けるだけでよい
  const passedSubjects = [...committed.entries()].filter(([, status]) => status === 'passed')
  const failedSubjects = [...committed.entries()].filter(([, status]) => status === 'failed')
  // 取得単位の見出しに出す合計単位数（科目数ではなく単位数）
  const passedCredits = passedSubjects.reduce((sum, [code]) => sum + (subjectsByCode.get(code)?.credits ?? 0), 0)
  // 「取得単位」「残りの必修」は区分ごとの見出しを付けて表示する（例:「理数基礎（必修）」「類専門（必修）」）
  const passedByCategory = groupByCategory(passedSubjects, ([code]) => code, categoryLookup, boundaryGroups)
  const remainingRequiredByCategory = groupByCategory(remainingRequired, (r) => r.code, categoryLookup, boundaryGroups)

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
    setOtherCommonCommitted(otherCommonDraft)
    saveOtherCommonCredits(otherCommonDraft)
  }

  // 「ダウンロード」ボタンを押したとき：今の記録を本サイト形式JSON（§7.4）としてファイルに書き出す
  function handleDownload() {
    const data: ExportedData = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      profile,
      records: [...committed.entries()].map(([code, status]) => ({ code, name: nameOf(code), status })),
      planned: [],
      otherCommonCredits: otherCommonCommitted,
    }

    // ブラウザにファイルをダウンロードさせる標準的な方法：
    // Blob（データのかたまり）を作り、それを指す一時URLを見えない<a>タグに設定してクリックする
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const fileName = `uec-credits_${profile.entryYear}_${profile.cluster ?? 'evening'}_${profile.program}_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.json`
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
      // その他単位認定は科目コードを持たない単一の数値なので、records のような
      // 追加・更新の概念が無い。ファイルに記載があればその値でそのまま置き換える
      // （古いschemaVersion 1のファイルなど、記載が無ければ今の値を変えない）
      if (imported.otherCommonCredits !== undefined) {
        setOtherCommonCommitted(imported.otherCommonCredits)
        setOtherCommonDraft(imported.otherCommonCredits)
        saveOtherCommonCredits(imported.otherCommonCredits)
      }
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
    setOtherCommonCommitted(0)
    setOtherCommonDraft(0)
    saveOtherCommonCredits(0)
    setDataMessage('すべての記録を未履修に戻しました。')
  }

  // 科目コードから表示用の名前・単位数を引く小さなヘルパー（見つからなければコードをそのまま出す）
  function nameOf(code: string): string {
    return subjectsByCode.get(code)?.name ?? code
  }
  // 科目名をシラバスへのリンクにする（一覧の各行で使う）。offeringsが1件も無い科目は
  // リンクにせず名前をそのまま出す。複数セクションでシラバスURLがバラバラな科目
  // （理数基礎・類共通基礎の必修科目など、クラスごとに別ページを持つもの）は、
  // dayPeriodTagと同じクラス解決ロジック（resolveOfferingsForProfile）でこのプロフィールが
  // 受講するセクションを絞り込み、一意に決まればそちらにリンクする。英語系のように
  // 教員を絞り込めない（全クラス扱いで複数候補が残る）科目は、従来通りリンクにしない
  // （2026-09-07、開発者が「理数基礎・類共通基礎の必修や回路システム学第一第二等がシラバスに
  // 飛べない」と報告して発覚）
  function nameLink(code: string): ReactNode {
    const name = nameOf(code)
    const offerings = subjectsByCode.get(code)?.offerings
    if (!offerings || offerings.length === 0) return name
    const urls = new Set(offerings.map((o) => o.syllabusUrl))
    let target = offerings
    if (urls.size !== 1) {
      const isRetaking = committed.get(code) === 'failed'
      const subjectTermType = subjectsByCode.get(code)?.termType
      const matched = resolveOfferingsForProfile(
        code,
        offerings,
        classAssignments,
        classProfile,
        profile.cluster,
        isRetaking,
        subjectTermType,
      )
      if (!matched || matched.length === 0) return name
      const matchedUrls = new Set(matched.map((o) => o.syllabusUrl))
      if (matchedUrls.size !== 1) return name
      target = matched
    }
    return (
      <a href={target[0].syllabusUrl} target="_blank" rel="noopener noreferrer">
        {name}
      </a>
    )
  }
  function creditsOf(code: string): number | undefined {
    return subjectsByCode.get(code)?.credits
  }
  // ()内に入れる単位数の表示（単位数だけにする。年次・学期は別枠のyearTermTagで出す）
  function creditsLabel(code: string): string {
    return `${creditsOf(code) ?? '?'}単位`
  }
  // 区分IDから表示用のラベルを引く（審査の不足条件の説明文で使う）
  function groupLabelOf(groupId: string): string {
    const g = findGroupResult(evaluation.groups, groupId)
    return g ? (g.label ?? g.name) : groupId
  }
  // 審査の不足条件（ReviewCondition）を、人が読める1文にする
  function describeCondition(cond: ReviewCondition): string {
    switch (cond.type) {
      case 'groupMin': {
        const g = findGroupResult(evaluation.groups, cond.groupId)
        return `${groupLabelOf(cond.groupId)} を${cond.min}単位以上（現在${g?.contribution ?? 0}単位）`
      }
      case 'allPassed':
        return `${groupLabelOf(cond.groupId)} をすべて修得`
      case 'subjects': {
        // 既に修得済みのものは省いて、まだ足りない科目だけ見せる
        const remaining = cond.codes.filter((code) => committed.get(code) !== 'passed')
        return `${remaining.map((code) => nameOf(code)).join('・')} を修得`
      }
      case 'totalCredits':
        return `合計 ${cond.min}単位以上（現在${evaluation.totalCredits.contribution}単位）`
      case 'commonCredits':
        return `共通単位 ${cond.min}単位以上（現在${evaluation.commonCredits.contribution}単位）`
      case 'allGroups':
        return 'すべての区分の必要単位を満たす'
      case 'review': {
        const target = reviews?.find((r) => r.id === cond.id)
        return `「${target?.name ?? cond.id}」に合格`
      }
      case 'subjectsCountMin': {
        const passedCount = cond.codes.filter((code) => committed.get(code) === 'passed').length
        return `${cond.codes.map((code) => nameOf(code)).join('・')} のうち${cond.min}科目以上（現在${passedCount}科目）`
      }
      case 'subjectsCreditMin': {
        const earned = cond.codes
          .filter((code) => committed.get(code) === 'passed')
          .reduce((sum, code) => sum + (subjectCredits.get(code) ?? 0), 0)
        return `${cond.codes.map((code) => nameOf(code)).join('・')} のうち${cond.min}単位以上（現在${earned}単位）`
      }
    }
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
  // 科目の開講学期（前学期/後学期）。人文・社会科学科目や上級科目のように科目数が多い区分を
  // 前学期・後学期で折りたたむために使う（無ければnull）
  function termTypeOf(code: string): string | null {
    return subjectsByCode.get(code)?.termType ?? null
  }
  // 科目の標準履修年次。選択科目一覧を学年学期順に並べ替えるために使う（無ければnull）
  function standardYearOf(code: string): number | null {
    return subjectsByCode.get(code)?.standardYear ?? null
  }
  // 「夏期集中」「冬期集中」の科目かどうか（noteフィールドから判定）。人文・社会科学科目のように
  // termTypeは前学期/後学期のまま登録されているが、実際は特定の集中期間にまとめて開講される
  // 科目（政治学Ａ等）を、前学期・後学期の折りたたみとは別の入れ子にまとめるために使う
  // （2026-09-06、開発者提案）
  function intensiveSeasonOf(code: string): '夏期' | '冬期' | null {
    const note = subjectsByCode.get(code)?.note
    if (note?.includes('夏期集中')) return '夏期'
    if (note?.includes('冬期集中')) return '冬期'
    return null
  }
  // 学期別に折りたたんだ後の行では、学期は見出し（前学期/後学期）側で分かるので、
  // 「2年次」のように年次だけを添える（yearTermTagの学期を省いた版）
  function yearOnlyTag(code: string) {
    const s = subjectsByCode.get(code)
    if (!s || s.standardYear === null) return null
    return <span style={{ marginLeft: '0.4em' }}>{s.standardYear}年次</span>
  }
  // 曜日時限（例:「木・1限」）。状態プルダウンの右に添える。
  // セクション（クラス）が1つだけの科目はそのまま表示する。複数ある科目は、
  // data/timetable/class_assignment.json（開発者が時間割PDFを見て手作業で埋めたクラス対応表）と
  // プロフィールのクラス情報を突き合わせて、一意に決まる場合だけ表示する。
  // どちらの方法でも決められない場合は、誤った時限を出すより何も出さない方を選ぶ
  // （CLAUDE.mdの進捗ログ参照）。
  // committedが'failed'（不合格）の科目は再履修中とみなし、「再履全員/再履生」向けの
  // セクションから曜日時限を出す（開発者提案、2026-09-06）
  // シラバス上に曜日時限が一切無い（＝offeringsは取れているが全セクションのslotsが空）科目は
  // 「時間割に入っていない」科目とみなす。学修要覧のnoteが「夏期集中」「冬期集中」の場合は
  // そのままその文言を表示し、それ以外の「集中」（隔年度開講の集中講義等）は何も表示しない。
  // どちらでもない（卒業研究・オンデマンド授業等）は「オンデマンド」と表示する
  // （開発者指示、2026-09-06。当初は集中講義を一律非表示にしていたが、政治学Ａ・
  // 生涯スポーツ演習Ｃ/Ｄのように「夏期集中」「冬期集中」であることが分かっている科目は
  // 「オンデマンド」ではなくその文言を出したほうが正確、という指摘を受けて追加）。
  // offeringsが1件も無い（＝シラバスで名前が一致せずデータ自体が無い）科目は、本当に
  // 時間割が無いのか単なるデータ欠落なのか区別できないため、従来通り何も表示しない
  function dayPeriodTag(code: string) {
    const subject = subjectsByCode.get(code)
    const offerings = subject?.offerings
    if (!offerings || offerings.length === 0) return null
    const note = subject?.note
    const hasAnySlots = offerings.some((o) => o.slots.length > 0)
    if (!hasAnySlots) {
      if (note?.includes('夏期集中')) return <span style={{ marginLeft: '0.4em' }}>夏期集中</span>
      if (note?.includes('冬期集中')) return <span style={{ marginLeft: '0.4em' }}>冬期集中</span>
      if (note?.includes('集中')) return null
      return <span style={{ marginLeft: '0.4em' }}>オンデマンド</span>
    }
    // 隔年度開講・開講年度により内容が変わる、といった注記は、実際に何か表示するときは
    // 併記しておく（2026-09-06。学域特別講義A/Bのような「毎年テーマは変わるが曜日時限は
    // 固定」という科目で、そのことが伝わるようにするため）
    const noteSuffix = note ? (
      <span style={{ marginLeft: '0.3em', color: '#555', fontSize: '0.9em' }}>（{note}）</span>
    ) : null
    // クォーター（春/夏/秋/冬ターム）制で、かつ1つの科目コードに単一のタームしか無い科目
    // （アカデミックスキルズ等）は、曜日時限ではなく「N年◯ターム」と表示する
    // （2026-09-06。基礎科学実験のように複数タームにまたがる科目は対象外＝下の通常処理に
    // 進み、複数セクション科目として扱われる）
    const termSet = new Set(offerings.map((o) => o.term))
    const soleTerm = termSet.size === 1 ? [...termSet][0] : undefined
    const quarterLabel = soleTerm ? QUARTER_LABELS[soleTerm] : undefined
    if (quarterLabel && subject?.standardYear != null) {
      return (
        <span style={{ marginLeft: '0.4em' }}>
          {subject.standardYear}年{quarterLabel}
          {noteSuffix}
        </span>
      )
    }
    const isRetaking = committed.get(code) === 'failed'
    const slots =
      offerings.length === 1
        ? offerings[0].slots
        : resolveSlotsForProfile(code, offerings, classAssignments, classProfile, profile.cluster, isRetaking)
    if (!slots || slots.length === 0) return null
    const text = slots.map((s) => `${s.day}・${s.period}限`).join('/')
    return (
      <span style={{ marginLeft: '0.4em' }}>
        {text}
        {noteSuffix}
      </span>
    )
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
        {profile.entryYear}入学 / {profile.cluster ? `${profile.cluster}類 / ` : ''}
        {profile.program} / {profile.grade}年 <Link to="/setup">[変更]</Link>
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
        <h2>取得単位（{passedCredits}単位）</h2>
        {(() => {
        const commonCreditsElement = (
          <div key="common-credits">
            {/* 「取得した単位」（countAsCommonの区分・alwaysCommonSubjectsの修得済み科目）は、
                それぞれ自分の区分（理数基礎（選択）など）や「選択科目」の共通単位の入れ子で
                既に一覧できるので、ここでは二重に出さない。あぶれ分（他区分の超過分）だけを出す */}
            <h3>共通単位（{commonEarnedTotal}/{requirementSet.commonCredits}単位）</h3>
            <ul>
              {overflowToCommonGroups.map((g) => (
                <li key={g.id}>
                  {g.label ?? g.name}から{g.overflowToCommon}単位
                </li>
              ))}
              {overflowToCommonGroups.length === 0 && <li>（まだありません）</li>}
            </ul>
          </div>
        )
        const hasMajorSel = passedByCategory.some(({ group }) => group?.id === 'major-sel')
        const rendered = passedByCategory.flatMap(({ label, group, items }) => {
          // 選択科目と同じく学年学期順に並べ替える。ただし第二外国語（第一・第二のペア）・
          // 生涯スポーツは元の並び順（言語ごと・科目のまとまり）を崩したくないので対象外
          const sortedItems = group && GROUPS_KEEP_ORIGINAL_ORDER.has(group.id)
            ? items
            : sortByYearTerm(items, ([code]) => code, standardYearOf, termTypeOf)
          const { regular, otherProgram, international } = splitSpecialSubjects(sortedItems, ([code]) => code)
          const row = (code: string) => (
            <>
              {nameLink(code)}（{creditsLabel(code)}）{yearTermTag(code)}
      {/* 半角スペース2個ぶん。HTMLは連続する半角スペースを1個にまとめてしまうので、
          折り返さない空白U+00A0を2つ使って確実に幅を空ける */}
      {'\u00A0\u00A0'}
              <SubjectStatusSelect code={code} value={draft.get(code)} onChange={handleDraftChange} />
              {dayPeriodTag(code)}
            </>
          )
          const categoryElement = (
            <div key={label}>
              <h3>
                {label}
                {/* 必要単位に切り詰めたcontributionではなく、超過分（overflow）を足した「実際に取得した単位数」を出す。
                    こうすると、必要単位を超えて取っている区分が「10/8単位」のように一目で分かる */}
                {group && (
                  <>
                    （{group.contribution + group.overflow}/{group.required}単位）
                  </>
                )}
              </h3>
              <ul>
                {regular.map(([code]) => (
                  <li key={code}>{row(code)}</li>
                ))}
                <CollapsedSubjectGroup title="他プログラム専門科目" items={otherProgram} codeOf={([code]) => code} renderRow={([code]) => row(code)} />
                <CollapsedSubjectGroup title="留学生のみ履修可" items={international} codeOf={([code]) => code} renderRow={([code]) => row(code)} />
              </ul>
            </div>
          )
          return group?.id === 'major-sel' ? [categoryElement, commonCreditsElement] : [categoryElement]
        })
        return hasMajorSel ? rendered : [...rendered, commonCreditsElement]
        })()}
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
            // 不合格科目の曜日時限表示。offeringsが1件だけの科目は全員同じ枠なので
            // dayPeriodTagのまま出す。複数offeringがある科目（物理学概論第一等）は、
            // 不合格になった時点で通常枠はもう案内する意味が無いので出さず、代わりに
            // 再履修向けの枠（class_id「再履生」「再履全員」等）が解決できれば、
            // その科目の真下にインデントした注記として曜日時限を出す
            // （2026-09-08、開発者の指摘：再履用の授業の有無・時限が分かりにくかった）
            const row = (code: string) => {
              const offerings = subjectsByCode.get(code)?.offerings
              const singleOffering = !offerings || offerings.length <= 1
              const retakeSlots = singleOffering
                ? undefined
                : resolveSlotsForProfile(code, offerings, classAssignments, classProfile, profile.cluster, true)
              return (
              <>
                {nameLink(code)}（{creditsLabel(code)}）{yearTermTag(code)}
      {/* 半角スペース2個ぶん。HTMLは連続する半角スペースを1個にまとめてしまうので、
          折り返さない空白U+00A0を2つ使って確実に幅を空ける */}
      {'\u00A0\u00A0'}
                <SubjectStatusSelect code={code} value={draft.get(code)} onChange={handleDraftChange} />
              {singleOffering && dayPeriodTag(code)}
              {retakeSlots && retakeSlots.length > 0 && (
                <div style={{ marginLeft: '1.5em', fontSize: '0.9em', color: '#555' }}>
                  ※ 再履用の授業があります：{retakeSlots.map((s) => `${s.day}・${s.period}限`).join('/')}
                </div>
              )}
              </>
              )
            }
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
              {nameLink(code)}（{creditsLabel(code)}）{yearTermTag(code)}
      {/* 半角スペース2個ぶん。HTMLは連続する半角スペースを1個にまとめてしまうので、
          折り返さない空白U+00A0を2つ使って確実に幅を空ける */}
      {'\u00A0\u00A0'}
              <SubjectStatusSelect code={code} value={draft.get(code)} onChange={handleDraftChange} />
              {dayPeriodTag(code)}
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
        {remainingRequired.length === 0 && (
          <ul>
            <li>（この表示範囲では残っていません）</li>
          </ul>
        )}
      </section>

      {(clusterTransferBucket.length > 0 || programTransferBucket.length > 0) && (
        <section>
          <h2>その他の科目（転類・転プログラム前に必修だった科目）</h2>
          <p style={{ fontSize: '0.9em', color: '#555' }}>
            元の類・プログラムでは必修だったものの、今の要件には出てこない科目です。修得にすると共通単位に加算されます
            （同名の科目は他の一覧の必修・選択にそのまま出てくるので、ここには出しません）。
          </p>
          {clusterTransferBucket.length > 0 && (
            <div>
              <h3>1年次科目（転類前）</h3>
              <ul>
                {clusterTransferBucket.map((item) => (
                  <li key={item.code}>
                    {item.name}（{item.credits}単位）
                    {'  '}
                    <SubjectStatusSelect code={item.code} value={draft.get(item.code)} onChange={handleDraftChange} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {programTransferBucket.length > 0 && (
            <div>
              <h3>2年次科目（転プログラム前）</h3>
              <ul>
                {programTransferBucket.map((item) => (
                  <li key={item.code}>
                    {item.name}（{item.credits}単位）
                    {'  '}
                    <SubjectStatusSelect code={item.code} value={draft.get(item.code)} onChange={handleDraftChange} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section>
        <h2>選択科目</h2>
        <p style={{ fontSize: '0.9em', color: '#555' }}>
          ※ 他プログラムの専門科目（各区分の中の「他プログラム専門科目」にまとめているもの）を履修した場合も、専門科目の単位として扱われます（学修要覧より）
        </p>
        {/* ここに出すのは「選択」「選択必修」の区分だけ（必修は上の「残りの必修」で扱う。自由・国際は対象外）。
            必要単位が0のグループ（そのプログラムでは使わない区分）も出す意味が無いので除く。
            この条件だけで絞るので、プログラムによって実際に何が出るかは自然に変わる */}
        {(() => {
          // 共通単位（選択第二外国語、物理学概論第二(一類)など、元から共通単位にしかならない科目）は、
          // required=0でGroupProgressの対象外だったり、alwaysCommonSubjectsでどの区分にも属さないため、
          // これまで選択状態を変える場所が無かった。類専門（選択）の直後に専用の入れ子を出す
          const commonCreditsElement = (
            <details key="common-credits">
              <summary>共通単位 {commonEarnedTotal}/{requirementSet.commonCredits}単位</summary>
              <ul>
                <li>
                  その他単位認定（TOEIC等、科目を介さず認定される単位）
                  {'  '}
                  <select
                    aria-label="その他単位認定の単位数"
                    value={otherCommonDraft}
                    onChange={(e) => setOtherCommonDraft(Number(e.target.value))}
                  >
                    <option value={0}>未履修</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n}単位
                      </option>
                    ))}
                  </select>
                </li>
                {commonOnlyRemaining.filter(isVisibleForTermFilter).map((code) => (
                  <li key={code}>
                    {nameLink(code)}（{creditsLabel(code)}）{yearTermTag(code)}
                    {'  '}
                    <SubjectStatusSelect code={code} value={draft.get(code)} onChange={handleDraftChange} />
              {dayPeriodTag(code)}
                  </li>
                ))}
                {commonOnlyRemaining.filter(isVisibleForTermFilter).length === 0 && <li>（この表示範囲では残っていません）</li>}
              </ul>
            </details>
          )
          const electiveGroups = boundaryGroups.filter((g) => (g.kind === 'elective' || g.kind === 'elective-required') && g.required > 0)
          const rendered = electiveGroups.flatMap((g) => {
            const groupElement = (
              <GroupProgress
                key={g.id}
                group={g}
                committed={committed}
                draft={draft}
                onChange={handleDraftChange}
                nameOf={nameOf}
                nameLink={nameLink}
                creditsLabel={creditsLabel}
                yearTermTag={yearTermTag}
                termTypeOf={termTypeOf}
                standardYearOf={standardYearOf}
                intensiveSeasonOf={intensiveSeasonOf}
                yearOnlyTag={yearOnlyTag}
                dayPeriodTag={dayPeriodTag}
                isOtherProgram={isOtherProgram}
                isInternational={isInternational}
                isVisibleForTerm={isVisibleForTermFilter}
              />
            )
            return g.id === 'major-sel' ? [groupElement, commonCreditsElement] : [groupElement]
          })
          const hasMajorSel = electiveGroups.some((g) => g.id === 'major-sel')
          return hasMajorSel ? rendered : [...rendered, commonCreditsElement]
        })()}
      </section>

      {/* 審査（2年次終了時審査など）。reviewsデータがあるプログラムだけ表示する */}
      {reviewStatuses.length > 0 && (
        <section>
          <h2>審査</h2>
          <ul>
            {reviewStatuses.map((r) => (
              <li key={r.id}>
                {r.name}
                {r.when && <span style={{ marginLeft: '0.4em', color: '#555' }}>（{r.when}）</span>}
                {r.satisfied ? ' ✔ 合格見込み' : ' ✖ 不足あり'}
                {/* 合否に関わらず常に出す注記（例:「会議の了承を必要とする」） */}
                {r.caveat && <p style={{ fontSize: '0.9em', color: '#555', margin: '0.2em 0 0' }}>※ {r.caveat}</p>}
                {!r.satisfied && (
                  <details>
                    <summary>詳細</summary>
                    <ul>
                      {r.unsatisfied.map((cond, i) => (
                        <li key={i}>{describeCondition(cond)}</li>
                      ))}
                    </ul>
                    {r.onFail?.note && <p style={{ fontSize: '0.9em', color: '#555' }}>※ {r.onFail.note}</p>}
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 上のツールバーの「更新」と同じボタン。プルダウンをたくさん触った後、
          いちいちページ上部まで戻らなくて済むように一番下にも置いておく。
          共通単位の入れ子とくっつきすぎないよう少し余白をあける */}
      <button type="button" onClick={handleUpdate} style={{ marginTop: '1em' }}>
        更新
      </button>
    </main>
  )
}

/** 見出しの「あと○単位」用に、必修グループぶんの不足単位数だけを合計する */
function requiredShortfall(groups: readonly BoundaryGroup[]): number {
  return groups.filter((g) => g.kind === 'required').reduce((sum, g) => sum + g.shortfall, 0)
}

// 科目数が多く一覧が長くなりすぎる区分は、前学期・後学期でさらに折りたたむ
// （人文・社会科学科目、上級科目。どちらもdata/requirements/2025-day-common.jsonでのid）
const GROUPS_SPLIT_BY_TERM = new Set(['hss', 'advanced'])

// offerings[].term に入っているクォーター（ターム）表記（半角カナ）を、表示用の全角表記にする
// （2026-09-06。dayPeriodTagで「N年夏ターム」のように表示するために使う）
const QUARTER_LABELS: Record<string, string> = {
  '春ﾀｰﾑ': '春ターム',
  '夏ﾀｰﾑ': '夏ターム',
  '秋ﾀｰﾑ': '秋ターム',
  '冬ﾀｰﾑ': '冬ターム',
}

// 第二外国語（第一・第二がセットの言語ペア）と生涯スポーツは、元の並び順（言語ごと・科目のまとまり）
// を崩したくないので、学年学期順への並べ替えの対象から外す
const GROUPS_KEEP_ORIGINAL_ORDER = new Set(['lang-basic-2', 'health-sel'])

/**
 * 科目コードの並びを「1年前期→1年後期→2年前期→…」の学年学期順にする。年次が無い科目は最後に回す。
 * codeOfで科目コードの取り出し方を指定できるので、コードそのものの配列でも[コード, 状態]のような
 * タプルの配列でも、どちらの並び替えにも使える
 */
function sortByYearTerm<T>(items: readonly T[], codeOf: (item: T) => string, standardYearOf: (code: string) => number | null, termTypeOf: (code: string) => string | null): T[] {
  const termRank = (t: string | null) => (t === '前学期' ? 0 : t === '後学期' ? 1 : 2)
  return [...items].sort((a, b) => {
    const yearA = standardYearOf(codeOf(a))
    const yearB = standardYearOf(codeOf(b))
    if (yearA === null && yearB === null) return 0
    if (yearA === null) return 1 // 年次不明は最後に回す
    if (yearB === null) return -1
    if (yearA !== yearB) return yearA - yearB
    return termRank(termTypeOf(codeOf(a))) - termRank(termTypeOf(codeOf(b)))
  })
}

function GroupProgress({
  group,
  committed,
  draft,
  onChange,
  nameOf,
  nameLink,
  creditsLabel,
  yearTermTag,
  termTypeOf,
  standardYearOf,
  intensiveSeasonOf,
  yearOnlyTag,
  dayPeriodTag,
  isOtherProgram,
  isInternational,
  isVisibleForTerm,
}: {
  group: BoundaryGroup
  committed: ReadonlyMap<string, SubjectStatus>
  draft: ReadonlyMap<string, SubjectStatus>
  onChange: (code: string, status: SubjectStatus | undefined) => void
  nameOf: (code: string) => string
  nameLink: (code: string) => ReactNode
  creditsLabel: (code: string) => string
  yearTermTag: (code: string) => ReactNode
  termTypeOf: (code: string) => string | null
  standardYearOf: (code: string) => number | null
  intensiveSeasonOf: (code: string) => '夏期' | '冬期' | null
  yearOnlyTag: (code: string) => ReactNode
  dayPeriodTag: (code: string) => ReactNode
  isOtherProgram: (code: string) => boolean
  isInternational: (code: string) => boolean
  /** 表示フィルタ（学期）で、この科目を一覧に出すかどうか（MainPage.tsxのisVisibleForTermFilter） */
  isVisibleForTerm: (code: string) => boolean
}) {
  // 一覧に出す／消すのは committed（確定済み）で判断する。draft はプルダウンの表示値にだけ使う。
  // こうしないと、「更新」を押す前にプルダウンを触っただけで行が消えてしまい、
  // 「残りの必修」など他のセクションと表示の整合性が取れなくなる。
  // 不合格の科目は「不可の単位」に既に出るので、ここでは重複して出さない（2026-09-08、開発者の指摘）
  const remainingAll = group.subjects.filter((code) => committed.get(code) == null && isVisibleForTerm(code))
  // 「幾何学概論」のように、実質同じ科目が他プログラムの科目コードとして重複して選択肢に
  // 入ってしまうことがあるので、科目名が同じものは1つにまとめる（自分のプログラムの科目が
  // あればそちらを優先し、他プログラム専門科目としては出さない）
  const dedupedRemaining = dedupeByName(remainingAll, nameOf, isOtherProgram)
  // 第二外国語・生涯スポーツは、第一・第二のペアや科目のまとまりを崩したくないので元の並び順のまま。
  // それ以外は「1年前期→1年後期→2年前期→…」の学年学期順に並べ替える
  // （このあとの重複除去・他プログラム専門科目/留学生のみ/前学期後学期への振り分けは全部フィルタで
  // 元の順番を保つので、ここで並べ替えておけば下流にもそのまま反映される）
  const remaining = GROUPS_KEEP_ORIGINAL_ORDER.has(group.id)
    ? dedupedRemaining
    : sortByYearTerm(dedupedRemaining, (code) => code, standardYearOf, termTypeOf)
  // 他プログラム専門科目・留学生のみ履修できる科目は、下の折りたたみにまとめる（他の一覧と同じ扱い）。
  // 両方に該当する科目は留学生のみの方に入れる
  const international = remaining.filter((code) => isInternational(code))
  const otherProgram = remaining.filter((code) => !isInternational(code) && isOtherProgram(code))
  const regular = remaining.filter((code) => !isInternational(code) && !isOtherProgram(code))
  const row = (code: string) => (
    <>
      {nameLink(code)}（{creditsLabel(code)}）{yearTermTag(code)}
      {/* 半角スペース2個ぶん。HTMLは連続する半角スペースを1個にまとめてしまうので、
          折り返さない空白U+00A0を2つ使って確実に幅を空ける */}
      {'\u00A0\u00A0'}
      <SubjectStatusSelect code={code} value={draft.get(code)} onChange={onChange} />
      {dayPeriodTag(code)}
    </>
  )
  // 前学期・後学期で折りたたんだ行では、学期は見出し側で分かるので年次だけ添える（yearOnlyTag）
  const rowShort = (code: string) => (
    <>
      {nameLink(code)}（{creditsLabel(code)}）{yearOnlyTag(code)}
      <SubjectStatusSelect code={code} value={draft.get(code)} onChange={onChange} />
      {dayPeriodTag(code)}
    </>
  )
  // 人文・社会科学科目・上級科目は科目数が多いので、通常の科目一覧の代わりに前学期・後学期の
  // 折りたたみに分ける（開講学期が前学期・後学期のどちらでもない科目は、通常通りそのまま出す）。
  // 「夏期集中」「冬期集中」の科目（政治学Ａ等）は、termTypeだけを見ると前学期・後学期の
  // どちらかに入ってしまうが、実際の開講時期が違うので前学期・後学期とは別の入れ子にまとめる
  // （2026-09-06、開発者提案）
  const splitByTerm = GROUPS_SPLIT_BY_TERM.has(group.id)
  const springRegular = splitByTerm
    ? regular.filter((code) => termTypeOf(code) === '前学期' && intensiveSeasonOf(code) === null)
    : []
  const fallRegular = splitByTerm
    ? regular.filter((code) => termTypeOf(code) === '後学期' && intensiveSeasonOf(code) === null)
    : []
  const summerIntensive = splitByTerm ? regular.filter((code) => intensiveSeasonOf(code) === '夏期') : []
  const winterIntensive = splitByTerm ? regular.filter((code) => intensiveSeasonOf(code) === '冬期') : []
  // 前学期・後学期のどちらでもない科目（国際科目など）。上級科目だけ、前学期・後学期と同じ
  // 階層の「その他」折りたたみにまとめる。それ以外（人文・社会科学科目）では、今のところ
  // 該当科目は無いはずだが、念のため通常の一覧にそのまま出して取りこぼさないようにする
  const noTermItems = splitByTerm
    ? regular.filter((code) => termTypeOf(code) !== '前学期' && termTypeOf(code) !== '後学期' && intensiveSeasonOf(code) === null)
    : []
  const noTermCollapsed = group.id === 'advanced' ? noTermItems : []
  const topLevelRegular = !splitByTerm ? regular : group.id === 'advanced' ? [] : noTermItems
  return (
    <details>
      <summary>
        {group.label ?? group.name} {group.contribution}/{group.required}単位
        {group.satisfied ? ' ✔' : ''}
      </summary>
      <ul>
        {topLevelRegular.map((code) => (
          <li key={code}>{row(code)}</li>
        ))}
        {splitByTerm && (
          <>
            <CollapsedSubjectGroup title="前学期" items={springRegular} codeOf={(code) => code} renderRow={rowShort} />
            {summerIntensive.length > 0 && (
              <CollapsedSubjectGroup title="夏期集中" items={summerIntensive} codeOf={(code) => code} renderRow={rowShort} />
            )}
            <CollapsedSubjectGroup title="後学期" items={fallRegular} codeOf={(code) => code} renderRow={rowShort} />
            {winterIntensive.length > 0 && (
              <CollapsedSubjectGroup title="冬期集中" items={winterIntensive} codeOf={(code) => code} renderRow={rowShort} />
            )}
            <CollapsedSubjectGroup title="その他" items={noTermCollapsed} codeOf={(code) => code} renderRow={row} />
          </>
        )}
        <CollapsedSubjectGroup title="他プログラム専門科目" items={otherProgram} codeOf={(code) => code} renderRow={row} />
        <CollapsedSubjectGroup title="留学生のみ履修可" items={international} codeOf={(code) => code} renderRow={row} />
        {remaining.length === 0 && <li>（この表示範囲では残っていません）</li>}
      </ul>
    </details>
  )
}
