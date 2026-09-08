// data/ 以下の静的JSON（卒業要件・科目マスタ）をアプリから使えるように読み込むところ。
//
// 「今どの入学年度・類・プログラムのデータが揃っているか」を知っているのはこのファイルだけにする。
// 他のコード（画面など）はここでエクスポートしている関数・一覧だけを見ればよく、
// JSONファイルが具体的に何個あってどこにあるかを気にしなくてよい。
//
// 新しいプログラムのデータを追加したら、下の import 文と `programDocs` に1行足すだけでよい
// （フェーズ3でⅡ類・Ⅲ類・夜間主を追加するときはここを増やす）。
//
// `import 名前 from '...json'` は、Viteがビルド時にJSONファイルの中身をそのまま
// JavaScriptのオブジェクトとして読み込んでくれる機能（tsconfig.app.json の
// resolveJsonModule で型チェックも通るようにしている）。

import type { GroupKind, RequirementGroup, RequirementSet, ReviewDef } from '../domain/requirements'
import common from '../../data/requirements/2025-day-common.json'
import media from '../../data/requirements/2025-day-I-media.json'
import management from '../../data/requirements/2025-day-I-management.json'
import mathinfo from '../../data/requirements/2025-day-I-mathinfo.json'
import cs from '../../data/requirements/2025-day-I-cs.json'
import designds from '../../data/requirements/2025-day-I-designds.json'
import security from '../../data/requirements/2025-day-II-security.json'
import netinfo from '../../data/requirements/2025-day-II-netinfo.json'
import electroinfo from '../../data/requirements/2025-day-II-electroinfo.json'
import control from '../../data/requirements/2025-day-II-control.json'
import robotics from '../../data/requirements/2025-day-II-robotics.json'
import mecha from '../../data/requirements/2025-day-III-mecha.json'
import electro from '../../data/requirements/2025-day-III-electro.json'
import optical from '../../data/requirements/2025-day-III-optical.json'
import physics from '../../data/requirements/2025-day-III-physics.json'
import chembio from '../../data/requirements/2025-day-III-chembio.json'
import evening from '../../data/requirements/2025-evening.json'
import common2026 from '../../data/requirements/2026-day-common.json'
import media2026 from '../../data/requirements/2026-day-I-media.json'
import management2026 from '../../data/requirements/2026-day-I-management.json'
import mathinfo2026 from '../../data/requirements/2026-day-I-mathinfo.json'
import cs2026 from '../../data/requirements/2026-day-I-cs.json'
import designds2026 from '../../data/requirements/2026-day-I-designds.json'
import security2026 from '../../data/requirements/2026-day-II-security.json'
import netinfo2026 from '../../data/requirements/2026-day-II-netinfo.json'
import electroinfo2026 from '../../data/requirements/2026-day-II-electroinfo.json'
import control2026 from '../../data/requirements/2026-day-II-control.json'
import robotics2026 from '../../data/requirements/2026-day-II-robotics.json'
import mecha2026 from '../../data/requirements/2026-day-III-mecha.json'
import electro2026 from '../../data/requirements/2026-day-III-electro.json'
import optical2026 from '../../data/requirements/2026-day-III-optical.json'
import physics2026 from '../../data/requirements/2026-day-III-physics.json'
import chembio2026 from '../../data/requirements/2026-day-III-chembio.json'
import evening2026 from '../../data/requirements/2026-evening.json'
import subjectsMaster2025 from '../../data/subjects/youran-2025.json'
import subjectsMaster2026 from '../../data/subjects/youran-2026.json'
import classAssignmentData from '../../data/timetable/class_assignment.json'
import type { ClassAssignmentEntry } from '../domain/classAssignment'

/** プロフィール設定画面（F-1）の選択肢1つぶん */
export interface ProgramOption {
  entryYear: number
  course: 'day' | 'evening'
  cluster: 'I' | 'II' | 'III' | null
  program: string
  programName: string
}

/**
 * data/requirements/2025-day-I-*.json や 2025-evening.json のようなプログラム別ファイルの形。
 * 夜間主コース（course: 'evening'）は類の区分が無いので cluster: null、
 * かつ common ファイルをextendsせず groups がそれ自体で完結している（day-common.jsonとは
 * 科目区分・科目コード体系が違うため）。getRequirementSet() 側でこの違いを吸収する。
 */
interface ProgramDoc {
  entryYear: number
  course: 'day' | 'evening'
  cluster: 'I' | 'II' | 'III' | null
  program: string
  programName: string
  /** 科目番号末尾記号（例: "a"）。他プログラムの専門科目の判定に使う（domain/requirements.tsのRequirementSet参照） */
  programSuffix: string
  totalCredits: number
  commonCredits: number
  groups: RequirementGroup[]
  /**
   * 共通ファイル（2025-day-common.json）側のグループを、このプログラムだけ一部上書きしたいときに使う。
   * キーは上書きしたいグループのid（例: "datasci-ex"）、値はそのグループにマージするフィールド。
   * 例: Ⅱ類計測・制御システム/先端ロボティクス・Ⅲ類は「データサイエンス演習」が必修ではなく
   * 選択（required: 0）になる（学修要覧2025 §2.5.1・別表2の注記）。夜間主（course: 'evening'）には適用されない。
   */
  commonOverrides?: Record<string, Partial<RequirementGroup>>
  /** 審査（2年次終了時審査など）の定義。今のところⅠ類5プログラムのJSONにしか無い */
  reviews?: ReviewDef[]
}

/**
 * 共通ファイルのグループ木を再帰的に複製しながら、overrides に指定されたidのグループだけ
 * フィールドをマージする。overridesが空ならそのまま（参照コピーで十分）返す。
 */
function applyCommonOverrides(groups: readonly RequirementGroup[], overrides: Record<string, Partial<RequirementGroup>> | undefined): RequirementGroup[] {
  if (!overrides || Object.keys(overrides).length === 0) return [...groups]
  return groups.map((g) => {
    const override = overrides[g.id]
    const children = g.children ? applyCommonOverrides(g.children, overrides) : undefined
    return { ...g, ...(children ? { children } : {}), ...override }
  })
}

// JSONを`import`すると型は自動推論されるが、要件セットの木構造（children等）まではTypeScriptには
// 分からないので、ここで RequirementGroup[] であることを明示しておく（as で型を指定し直している）。
type CommonDoc = { groups: RequirementGroup[]; commonCreditSources?: { alwaysCommon?: string[] } }

// 昼間コース共通要件は入学年度ごとに内容が異なる可能性があるため、年度をキーにして持つ。
const commonDocsByYear: ReadonlyMap<number, CommonDoc> = new Map([
  [2025, common as CommonDoc],
  [2026, common2026 as CommonDoc],
])

// 要件JSONは年度別に読み込み、プロフィールのentryYearで正しい1件を選ぶ。
const programDocs: ProgramDoc[] = [
  media, management, mathinfo, cs, designds, security, netinfo, electroinfo, control, robotics, mecha, electro, optical, physics, chembio, evening,
  media2026, management2026, mathinfo2026, cs2026, designds2026, security2026, netinfo2026, electroinfo2026, control2026, robotics2026,
  mecha2026, electro2026, optical2026, physics2026, chembio2026, evening2026,
] as ProgramDoc[]

// 科目番号は年度をまたぐと別の科目を指すことがあるため、科目マスタも年度別に切り替える。
const subjectMastersByYear = new Map([
  [2025, subjectsMaster2025],
  [2026, subjectsMaster2026],
])

/** プロフィール設定画面のプルダウンに出す、今データが揃っている選択肢の一覧 */
export const programOptions: ProgramOption[] = programDocs.map((p) => ({
  entryYear: p.entryYear,
  course: p.course,
  cluster: p.cluster,
  program: p.program,
  programName: p.programName,
}))

/**
 * 指定した「入学年度・コース・類・プログラム」に対応する要件セットを返す。
 * 共通ファイル（総合文化・実践教育科目）とプログラム別ファイル（専門科目）を
 * ここで合体させる（`extends` の解決）。データが無ければ undefined を返す。
 */
export function getRequirementSet(entryYear: number, course: string, cluster: string | null, program: string): RequirementSet | undefined {
  // 4つの条件すべてに一致するプログラムファイルを探す
  const doc = programDocs.find(
    (p) => p.entryYear === entryYear && p.course === course && p.cluster === cluster && p.program === program,
  )
  if (!doc) return undefined // まだデータが無い組み合わせ

  // 夜間主（course: 'evening'）は昼間共通要件をextendsしない自己完結ファイルなので、
  // doc.groups だけをそのまま使う。昼間コースは共通ファイルのgroups（総合文化・実践教育。
  // プログラム固有のcommonOverridesがあれば適用）とプログラム別ファイルのgroups（専門科目）を
  // 1つの配列にまとめて、evaluateRequirements() にそのまま渡せる形にする
  const commonDoc = commonDocsByYear.get(entryYear)
  let groups: RequirementGroup[]
  // 夜間主は自己完結、昼間は同年度の共通要件と専門要件を結合する。
  if (doc.course === 'evening') {
    groups = [...doc.groups]
  } else {
    // 昼間共通要件がない年度は、専門要件だけを返して誤った年度の共通要件と混ぜない。
    if (!commonDoc) return undefined
    groups = [...applyCommonOverrides(commonDoc.groups, doc.commonOverrides), ...doc.groups]
  }

  return {
    totalCredits: doc.totalCredits,
    commonCredits: doc.commonCredits,
    groups,
    alwaysCommonSubjects: doc.course === 'evening' ? [] : (commonDoc?.commonCreditSources?.alwaysCommon ?? []),
    programSuffix: doc.programSuffix,
    reviews: doc.reviews,
  }
}

/** プログラム配属前に、総合文化・実践教育と類共通の専門基礎だけを返す。 */
export function getRequirementSetWithoutProgram(entryYear: number, cluster: 'I' | 'II' | 'III'): RequirementSet | undefined {
  const commonDoc = commonDocsByYear.get(entryYear)
  const representative = programDocs.find((p) => p.entryYear === entryYear && p.course === 'day' && p.cluster === cluster)
  if (!commonDoc || !representative) return undefined
  const specialized = representative.groups.find((group) => group.id === 'specialized')
  const sharedChildren = specialized?.children?.filter((group) => group.id === 'math-basic' || group.id === 'cluster-basic') ?? []
  const sharedSpecialized: RequirementGroup = {
    ...(specialized ?? { id: 'specialized', name: '専門科目', required: 0 }),
    required: sharedChildren.reduce((sum, group) => sum + group.required, 0),
    children: sharedChildren,
  }
  return {
    totalCredits: representative.totalCredits,
    commonCredits: representative.commonCredits,
    groups: [...commonDoc.groups, sharedSpecialized],
    alwaysCommonSubjects: commonDoc.commonCreditSources?.alwaysCommon ?? [],
    reviews: representative.reviews?.filter((review) => review.id === 'y2-end'),
  }
}

/** 入学年度に対応する科目マスタを返す。未対応年度ならundefinedを返す。 */
function getSubjectMaster(entryYear: number): typeof subjectsMaster2025 | undefined {
  return subjectMastersByYear.get(entryYear) as typeof subjectsMaster2025 | undefined
}

/** 科目番号（フルコード）→単位数 のマップ。evaluateRequirements() にそのまま渡せる */
export function getSubjectCredits(entryYear: number): ReadonlyMap<string, number> {
  const subjectMaster = getSubjectMaster(entryYear)
  return new Map(subjectMaster?.subjects.map((s) => [s.code, s.credits]) ?? [])
}

/** シラバスWeb公開システムから取得した、1つの開講セクション（クラス）の情報（docs/SPEC.md §7.1） */
export interface SubjectOffering {
  timetableCode: string
  faculty: string
  term: string
  slots: { day: string; period: number }[]
  instructors: string[]
  syllabusUrl: string
  updatedAt: string
}

export interface SubjectMasterEntry {
  code: string
  name: string
  credits: number
  standardYear: number | null
  standardSemester: number | null
  termType: '前学期' | '後学期' | null
  forInternational: boolean
  eveningAllowed: boolean
  graduateLinked: boolean
  /** シラバスから取得できた科目だけ持つ（scripts/fetch_syllabus.py参照）。同じ科目に複数セクション
   *  （クラス）があることがあり、その場合は曜日時限がセクションごとに違うことがある */
  offerings?: SubjectOffering[]
  /** シラバスの「前もって履修しておくべき科目」欄の自由記述テキストをそのまま持つ（「なし」は省略）。
   *  自由記述なので科目コードの配列には変換していない（誤検出のリスクが高いため） */
  prerequisitesText?: string
  /** 学修要覧の補足（「集中講義」「偶数年度開講」など）。自由記述 */
  note?: string
}

/** 科目番号（フルコード）→科目マスタの情報 のマップ。科目一覧・詳細（F-5）や推奨計算に使う */
export function getSubjectsByCode(entryYear: number): ReadonlyMap<string, SubjectMasterEntry> {
  const subjectMaster = getSubjectMaster(entryYear)
  return new Map((subjectMaster?.subjects as SubjectMasterEntry[] | undefined)?.map((s) => [s.code, s]) ?? [])
}

/**
 * 複数セクションがある科目の「このクラスはこの曜日時限」対応表（data/timetable/README.md参照）。
 * 開発者が時間割PDFを見ながら手作業で埋めた分だけ入っている（全科目分ではない）。
 * 曜日時限の解決は src/domain/classAssignment.ts の resolveSlotsForProfile に渡して使う
 */
export function getClassAssignments(): ClassAssignmentEntry[] {
  return classAssignmentData as ClassAssignmentEntry[]
}

/** プログラムID（例:"media"）から、学修要覧の表記そのままのプログラム名（例:「メディア情報学プログラム」）を引く */
export function getProgramName(entryYear: number, program: string | null): string | null {
  return programOptions.find((p) => p.entryYear === entryYear && p.program === program)?.programName ?? null
}

/** 科目一覧の詳細ページ（F-5）で「どのプログラムのどの区分に位置づけられているか」を示すための1件ぶん */
export interface SubjectUsage {
  programName: string
  /** 区分の親子関係を「>」でつないだもの（例:「類専門科目 > 必修」） */
  groupPath: string
}

// RequirementGroup の木を根からたどり、指定した科目番号が subjects に直接含まれるグループを探す。
// 見つかった経路（親グループ名の連なり）をそのまま結果に積んでいく再帰関数
function collectGroupPaths(groups: readonly RequirementGroup[], code: string, ancestors: string[], out: string[]): void {
  for (const g of groups) {
    const label = g.label ?? g.name
    const path = [...ancestors, label]
    if (g.subjects?.includes(code)) {
      out.push(path.join(' > '))
    }
    if (g.children) {
      collectGroupPaths(g.children, code, path, out)
    }
  }
}

/**
 * 指定した科目番号(フルコード)が、どのプログラムのどの区分で採用されているかを全プログラム分探す。
 * 科目一覧の詳細ページで「要件上の位置づけ」を示すために使う。同じプログラムに複数箇所（他プログラムの
 * 選択科目としての展開分と本来の区分、など）見つかることもあるので、区分ごとに別の行として返す
 */
export function findSubjectUsages(entryYear: number, code: string): SubjectUsage[] {
  const usages: SubjectUsage[] = []
  // 同じコードが別年度に別の科目を指すため、表示中の年度のプログラムだけを調べる。
  for (const p of programOptions.filter((option) => option.entryYear === entryYear)) {
    const set = getRequirementSet(p.entryYear, p.course, p.cluster, p.program)
    if (!set) continue
    const paths: string[] = []
    collectGroupPaths(set.groups, code, [], paths)
    for (const path of paths) {
      usages.push({ programName: p.programName, groupPath: path })
    }
  }
  return usages
}

/** 科目一覧ページ（F-5）で「単位の種類」ごとに見出しを立てて科目を並べるための1区分ぶん */
export interface CourseListSection {
  /** 見出し（そのグループのlabel、無ければname。例:「類専門（選択）」） */
  heading: string
  kind?: GroupKind
  codes: string[]
}

// groups木を根から再帰的にたどり、subjectsを直接持つグループ（＝末端の区分）をそのまま
// 1セクションとして集める。同じ科目が複数セクションに重複して現れることもある
// （他プログラムの専門科目としての展開など）が、ここでは弾かず呼び出し側に委ねる
function collectCourseListSections(groups: readonly RequirementGroup[], out: CourseListSection[]): void {
  for (const g of groups) {
    if (g.subjects && g.subjects.length > 0) {
      out.push({ heading: g.label ?? g.name, kind: g.kind, codes: g.subjects })
    }
    if (g.children) collectCourseListSections(g.children, out)
  }
}

/**
 * 科目一覧ページ用に、「単位の種類（必修・選択必修・選択…）」ごとの区分＋科目コード一覧を返す。
 * プログラムを指定しない場合は、共通ファイル（総合文化・実践教育科目）の区分だけを返す
 * （理数基礎・類共通基礎・類専門はプログラムが決まらないと存在しない区分のため）。
 * プログラムを指定した場合は、そのプログラムの要件セット全体（共通ファイル込み）から集める。
 * 共通ファイルのプログラム別上書き（commonOverrides）はプログラム未指定時には反映できない
 * （どの類・プログラムか分からないため）。
 */
export function getCourseListSections(
  entryYear: number,
  course: string,
  cluster: string | null,
  program: string | null,
): CourseListSection[] {
  const out: CourseListSection[] = []
  if (!program) {
    const commonDoc = commonDocsByYear.get(entryYear)
    // 共通要件が未登録の年度は、他年度の一覧を借りず空として返す。
    if (!commonDoc) return out
    collectCourseListSections(commonDoc.groups, out)
    return out
  }
  const set = getRequirementSet(entryYear, course, cluster, program)
  if (!set) return out
  collectCourseListSections(set.groups, out)
  return out
}

// グループ木から、kind === 'required'（必修）な科目コードだけを再帰的に集める
function collectRequiredCodes(groups: readonly RequirementGroup[], out: Set<string>): void {
  for (const g of groups) {
    if (g.kind === 'required' && g.subjects) {
      for (const c of g.subjects) out.add(c)
    }
    if (g.children) collectRequiredCodes(g.children, out)
  }
}

// グループ木にある科目コードを、必修かどうかを問わず全部集める（「既にどこかにある科目」の判定用）
function collectAllCodes(groups: readonly RequirementGroup[], out: Set<string>): void {
  for (const g of groups) {
    if (g.subjects) for (const c of g.subjects) out.add(c)
    if (g.children) collectAllCodes(g.children, out)
  }
}

/** 転類・転プログラムした学生向けの「その他の科目」一覧の1件ぶん */
export interface TransferBucketItem {
  code: string
  name: string
  credits: number
}

/**
 * 転類・転プログラムした学生が、転属する前に必修として履修した科目のうち、
 * 今の類・プログラムの卒業要件には出てこないものを一覧にする（開発者判断、2026-09-07）。
 *
 * ルール：
 * - 「必修だった科目」は、元の類・プログラムの要件セットで kind:'required' の科目に限る
 * - 今の要件セットに同じ科目番号がそのまま出てくる場合は対象外（理数基礎科目のように
 *   類を問わず共通の科目はここに出す必要が無い）
 * - 今の要件セットのどこかに「同じ科目名」の科目番号がある場合も対象外
 *   （同名の科目＝実質同じ内容の科目とみなし、そちらで数えられるようにする。修得すれば
 *   共通単位になる、という開発者の説明の裏返しで、対象外にならなかった科目＝共通単位になる科目）
 * - 転類（1年次のみ経験）はyearLevel=1、転プログラム（1・2年次を経験）はyearLevel=2を渡す
 *
 * 転類の場合、まだプログラムが決まっていない時点の話なので、具体的にどのプログラムの科目番号
 * だったかは学生自身も意識していないはず。同じ類なら1年次の必修科目は名前・単位数が共通のはず
 * なので、その類の最初のプログラムを代表として使う（oldProgramにnullを渡す）
 */
export function getTransferBucketSubjects(
  entryYear: number,
  oldCluster: 'I' | 'II' | 'III',
  oldProgram: string | null,
  yearLevel: 1 | 2,
  currentSet: RequirementSet,
): TransferBucketItem[] {
  const subjectsByCode = getSubjectsByCode(entryYear)

  const oldProgramId =
    oldProgram ?? programOptions.find((p) => p.entryYear === entryYear && p.course === 'day' && p.cluster === oldCluster)?.program
  if (!oldProgramId) return []
  const oldSet = getRequirementSet(entryYear, 'day', oldCluster, oldProgramId)
  if (!oldSet) return []

  const oldRequired = new Set<string>()
  collectRequiredCodes(oldSet.groups, oldRequired)

  const currentAllCodes = new Set<string>()
  collectAllCodes(currentSet.groups, currentAllCodes)
  const currentNames = new Set(
    [...currentAllCodes].map((c) => subjectsByCode.get(c)?.name).filter((n): n is string => n !== undefined),
  )

  const seenNames = new Set<string>()
  const result: TransferBucketItem[] = []
  for (const code of [...oldRequired].sort()) {
    const s = subjectsByCode.get(code)
    if (!s || s.standardYear !== yearLevel) continue
    if (currentAllCodes.has(code)) continue
    if (currentNames.has(s.name)) continue
    if (seenNames.has(s.name)) continue
    seenNames.add(s.name)
    result.push({ code, name: s.name, credits: s.credits })
  }
  return result
}
