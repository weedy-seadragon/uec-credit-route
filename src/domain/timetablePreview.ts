// 修得見込の科目を、選択した開講期の週間時間割と時限未確定の一覧に分ける純粋ロジック。
// 複数の開講候補があるときは、すべて同じ曜日時限に決まる場合だけグリッドに置く。

import type { ScheduleOption, ScheduleSlot } from './scheduleConflicts'
import { offeringTermsOverlap, periodsOf } from './offeringTerms'
export { offeringTermsOverlap } from './offeringTerms'
import { classifyTimelessCourse } from './onDemand'
import type { TimelessCourseKind } from './onDemand'
import type { OfferingWithSlots } from './onDemand'

/** 必修色とは別に、選択区分へ固定で割り当てる配色の数。 */
export const TIMETABLE_CATEGORY_COLOR_COUNT = 13

/** プロフィールと再履修状態で開講候補を絞った、プレビュー用の1科目。 */
export interface TimetablePreviewCourse {
  code: string
  name: string
  /** メイン画面と共通の学年・学期表記。表示切替欄だけで使う。 */
  yearTermLabel?: string
  /** MainPageの卒業要件判定から受け取る科目区分。プレビューでは再分類しない。 */
  category?: TimetablePreviewCategory
  termType: string | null
  offeredTerms: readonly string[]
  options: readonly TimetablePreviewOption[]
  note?: string
  offerings?: readonly OfferingWithSlots[]
  /** クラス判定できない科目の選択肢を作るため、全セクションを保持する。 */
  sections?: readonly TimetablePreviewOption[]
  /** 低学年科目の複数候補を、時限が同じでも明示選択にする。 */
  chooseAmongSections?: boolean
}

/** 科目カードと凡例で共用する、卒業要件上の区分。 */
export interface TimetablePreviewCategory {
  key: string
  label: string
  isRequired: boolean
  /** プロフィールの要件データでの登場順。修得見込の有無にかかわらず色番号を固定する。 */
  orderIndex: number
}

/** 表示する科目区分と、プロフィールの要件順で割り当てた色番号。 */
export interface TimetableLegendCategory extends TimetablePreviewCategory {
  colorIndex?: number
}

/** MainPageが持つ境界グループから、時間割用の色区分を作るための最小構造。 */
export interface TimetableRequirementGroup {
  id: string
  name: string
  label?: string
  kind: string
  required?: number
  countAsCommon?: boolean
  subjects: readonly string[]
}

/** 必修を優先し、それ以外は最初に属する要件区分へ結び付ける。 */
export function timetableCategoryForCourse(
  code: string,
  requiredCodes: ReadonlySet<string>,
  groups: readonly TimetableRequirementGroup[],
  commonCodes: ReadonlySet<string> = new Set(),
): TimetablePreviewCategory {
  // 必修判定はMainPageから渡されたrequiredCodesを唯一の基準にする。
  if (requiredCodes.has(code)) return { key: 'required', label: '必修', isRequired: true, orderIndex: -1 }
  const colorGroups = groups.filter((group) =>
    (group.kind === 'elective' || group.kind === 'elective-required')
    && (group.required === undefined || group.required > 0),
  )
  const orderIndexById = new Map<string, number>()
  // 選択区分は全要件から番号を決め、今選択されている科目に左右されないようにする。
  for (const group of colorGroups) {
    if (!orderIndexById.has(group.id)) orderIndexById.set(group.id, orderIndexById.size)
  }
  const group = colorGroups.find((candidate) => candidate.subjects.includes(code))
  // 選択区分に属さず、要件データで共通単位として指定された科目は共通単位色にする。
  if (!group && commonCodes.has(code)) return { key: 'common', label: '共通単位', isRequired: false, orderIndex: orderIndexById.size }
  // どの選択区分にも属さない科目は、共通単位またはその他へ分類する。
  if (!group) return { key: 'other', label: 'その他', isRequired: false, orderIndex: orderIndexById.size + 1 }
  return {
    key: group.id,
    label: group.label ?? group.name,
    isRequired: false,
    orderIndex: orderIndexById.get(group.id) ?? orderIndexById.size,
  }
}

/** プレビューで選択可能なセクション。 */
export interface TimetablePreviewOption extends ScheduleOption {
  timetableCode?: string
  teacher?: string
  /** 学域特別講義の候補テーマ。 */
  topic?: string
  /** 再履修専用セクションなら、選択肢で優先枠として注記する。 */
  retake?: boolean
}

/** グリッド上の1科目1コマ。複数コマの科目はコマごとに別要素を持つ。 */
export interface TimetablePreviewSlot extends ScheduleSlot {
  code: string
  name: string
  category?: TimetablePreviewCategory
  /** プロフィールの全選択区分から割り当てる色番号。 */
  categoryColorIndex?: number
  /** 前学期・後学期以外の開講期なら、科目名に添えて表示する。 */
  offeringTerm: string
  topic?: string
}

/** 選択した開講期の科目だが、曜日時限を断定できないもの。 */
export interface UnplacedTimetableCourse {
  code: string
  name: string
  reason: 'no-offering' | 'no-class' | 'lower-year-selection' | 'no-slot' | 'instructor-dependent' | 'lab' | 'ambiguous-term' | 'ambiguous-slot'
  /** 候補が複数ある理由の場合に、欄外の選択UIへ渡すセクション。 */
  options?: readonly TimetablePreviewOption[]
  topic?: string
}

/** 欄外科目を、利用者が候補を選ぶものと曜日時限自体が未確定のものに分ける。 */
export function splitUnplacedTimetableCourses(courses: readonly UnplacedTimetableCourse[]): {
  selectable: UnplacedTimetableCourse[]
  timeless: UnplacedTimetableCourse[]
} {
  const selectableReasons = new Set<UnplacedTimetableCourse['reason']>(['no-class', 'lower-year-selection', 'ambiguous-term', 'ambiguous-slot'])
  // 選択向けの理由があり、実際の候補も1件以上ある科目だけを候補選択枠へ振り分ける。
  const selectable = courses.filter((course) => selectableReasons.has(course.reason) && (course.options?.length ?? 0) > 0)
  // 候補が無い科目を含め、それ以外は選択UIのない時限未確定枠へ振り分ける。
  const timeless = courses.filter((course) => !selectableReasons.has(course.reason) || (course.options?.length ?? 0) === 0)
  return { selectable, timeless }
}

/** 時間割グリッドと、その下に表示する未確定科目。 */
export interface TimetablePreviewResult {
  slots: TimetablePreviewSlot[]
  unplaced: UnplacedTimetableCourse[]
  onDemand: { code: string; name: string; topic?: string }[]
  intensive: { code: string; name: string; kind: Extract<TimelessCourseKind, 'summer-intensive' | 'winter-intensive' | 'intensive'>; topic?: string }[]
}

/** 履修予定に登場する区分へ、要件データ全体を基準に色番号を割り当てる。 */
export function timetableCategoryColorsForCourses(courses: readonly TimetablePreviewCourse[]): TimetableLegendCategory[] {
  const categories = new Map<string, TimetablePreviewCategory>()
  // 同じ区分に属する科目が複数学期にあっても、色番号は一度だけ割り当てる。
  for (const course of courses) {
    if (course.category && !categories.has(course.category.key)) categories.set(course.category.key, course.category)
  }
  // その区分の科目が履修予定に無くても、プロフィールの要件順を色番号に使う。
  const ordered = [...categories.values()].sort((first, second) => {
    if (first.isRequired !== second.isRequired) return first.isRequired ? -1 : 1
    return first.orderIndex - second.orderIndex
  })
  // 必修以外は13色を使い、14番目以降の区分だけ先頭から色を循環する。
  return ordered.map((category) => category.isRequired
    ? category
    : { ...category, colorIndex: category.orderIndex % TIMETABLE_CATEGORY_COLOR_COUNT })
}

/** 表示学期のコマに出ている区分だけを、全科目で決めた色番号の凡例にする。 */
export function timetableLegendForSlots(
  slots: readonly TimetablePreviewSlot[],
  allCategoryColors: readonly TimetableLegendCategory[],
): TimetableLegendCategory[] {
  const categories = new Map<string, TimetablePreviewCategory>()
  // 同じ区分のカードが複数あっても、凡例には一度だけ追加する。
  for (const slot of slots) {
    if (slot.category && !categories.has(slot.category.key)) categories.set(slot.category.key, slot.category)
  }
  const colorsByKey = new Map(allCategoryColors.map((category) => [category.key, category]))
  // 必修を先頭に置き、残りは全体の要件データ順を保って凡例へ出す。
  return [...categories.values()].sort((first, second) => {
    if (first.isRequired !== second.isRequired) return first.isRequired ? -1 : 1
    return first.orderIndex - second.orderIndex
  }).map((category) => colorsByKey.get(category.key) ?? category)
}

/** 春・夏タームは前学期、秋・冬タームは後学期として扱う。 */
const SEMESTER_BY_TERM: Readonly<Record<string, string>> = {
  '春ﾀｰﾑ': '前学期',
  '夏ﾀｰﾑ': '前学期',
  '秋ﾀｰﾑ': '後学期',
  '冬ﾀｰﾑ': '後学期',
}

/** 同じ曜日時限に置かれる科目のうち、同時期に開講する最大数を返す。 */
export function maxConcurrentOfferingCount(terms: readonly string[]): number {
  const periods = new Set(terms.flatMap((term) => periodsOf(term)))
  let maximum = 0
  // 各タームに重なる科目数を数え、春と夏など別期間の科目を合算しない。
  for (const period of periods) {
    const count = terms.filter((term) => offeringTermsOverlap(term, period)).length
    maximum = Math.max(maximum, count)
  }
  return maximum
}

/** シラバスの開講期を、プレビューの表示学期へ対応付ける。 */
export function previewSemesterOf(term: string): string {
  // 前学期・後学期や未知の開講期は、名前をそのまま使う。
  return SEMESTER_BY_TERM[term] ?? term
}

/** 時限の並び順や重複に左右されず、候補どうしのコマを比較するためのキー。 */
function slotKey(slots: readonly ScheduleSlot[]): string {
  // 同じコマが二度記録されても、1つのコマとして比較する。
  return [...new Set(slots.map((slot) => `${slot.day}:${slot.period}`))].sort().join('|')
}

/** 選択した開講期の修得見込科目を、確定できるコマと未確定の科目に分ける。 */
export function buildTimetablePreview(
  courses: readonly TimetablePreviewCourse[],
  term: string,
  selectedTimetableCodes: Readonly<Record<string, string>> = {},
): TimetablePreviewResult {
  const slots: TimetablePreviewSlot[] = []
  const unplaced: UnplacedTimetableCourse[] = []
  const onDemand: { code: string; name: string }[] = []
  const intensive: TimetablePreviewResult['intensive'] = []

  // 実際のシラバスの開講期を優先し、情報がない科目だけ学修要覧の学期を使う。
  for (const course of courses) {
    // 例: 学修要覧では後学期でもシラバスが夏タームなら、シラバスを優先して前学期に出す。
    const isYearRound = course.note?.includes('通年') ?? false
    const belongsToTerm = isYearRound && (term === '前学期' || term === '後学期')
      ? true
      : course.offeredTerms.length > 0
        ? course.offeredTerms.some((offeringTerm) => previewSemesterOf(offeringTerm) === term)
        : course.termType === null || course.termType === term
    // 別の学期だけに開講する科目は、この学期のプレビューから外す。
    if (!belongsToTerm) continue

    const topicSections = (course.sections ?? []).filter((section) => section.topic && previewSemesterOf(section.term) === term)
    if (topicSections.length > 0) {
      // 年度ごとに異なるテーマはクラス判定で一意にせず、選んだ一覧行だけを配置する。
      const selected = findSelectedOption(topicSections, selectedTimetableCodes[course.code])
      // 保存済みテーマが別学期なら、別テーマを同じ科目の予定として自動表示しない。
      if (selectedTimetableCodes[course.code] && !selected) continue
      if (!selected && topicSections.length > 1) {
        unplaced.push({ code: course.code, name: course.name, reason: 'ambiguous-slot', options: topicSections })
        continue
      }
      const chosen = selected ?? topicSections[0]
      if (chosen.slots.length > 0) {
        appendSelectedOption(slots, course, chosen)
      } else if (chosen.topic?.includes('集中')) {
        intensive.push({ code: course.code, name: course.name, kind: classifyTopicIntensive(chosen.topic), topic: chosen.topic })
      } else {
        unplaced.push({ code: course.code, name: course.name, reason: 'no-slot', topic: chosen.topic })
      }
      continue
    }

    // 曜日時限のない科目を、オンデマンド・集中講義・その他に共通基準で分類する。
    const timelessKind = classifyTimelessCourse(course.name, course.note, course.offerings)
    if (timelessKind === 'lab' || timelessKind === 'instructor-dependent') {
      // 研究室単位・担当教員依存の科目は一律の曜日時限に置かず、その共通区分を理由にする。
      unplaced.push({ code: course.code, name: course.name, reason: timelessKind })
      continue
    }
    if (timelessKind === 'on-demand') {
      onDemand.push({ code: course.code, name: course.name })
      continue
    }
    // 集中講義は時限なし一覧へ移し、注記から夏期・冬期・その他の区分を保つ。
    if (timelessKind === 'summer-intensive' || timelessKind === 'winter-intensive' || timelessKind === 'intensive') {
      intensive.push({ code: course.code, name: course.name, kind: timelessKind })
      continue
    }

    const options = course.options.filter((option) => previewSemesterOf(option.term) === term)
    const allTermSections = (course.sections ?? []).filter((section) => previewSemesterOf(section.term) === term)
    // シラバスの開講情報自体が無い科目は、科目表の学期に基づく欄外表示にする。
    if (course.offeredTerms.length === 0) {
      unplaced.push({ code: course.code, name: course.name, reason: 'no-offering' })
      continue
    }
    // 再履修専用枠が一意なら、通常枠の候補もある科目でもその枠を初期配置する。
    const savedOption = allTermSections.find((section) => section.timetableCode === selectedTimetableCodes[course.code])
    const defaultRetake = findUniqueRetakeOption(allTermSections)
    const retakePlacement = savedOption ?? defaultRetake
    if (defaultRetake && retakePlacement && retakePlacement.slots.length > 0) {
      appendSelectedOption(slots, course, retakePlacement)
      continue
    }
    // クラス判定できず候補一覧へ回った場合も、同じ学期に時限が1種類だけなら自動配置する。
    const unresolvedSectionsShareOneSlot =
      options.length === 0 &&
      allTermSections.length > 0 &&
      allTermSections.every((section) => section.slots.length > 0) &&
      new Set(allTermSections.map((section) => section.term)).size === 1 &&
      new Set(allTermSections.map((section) => slotKey(section.slots))).size === 1
    if (unresolvedSectionsShareOneSlot) {
      appendSelectedOption(slots, course, savedOption ?? allTermSections[0])
      continue
    }
    // 低学年科目は時限が異なる候補だけを選択対象にし、同時限なら代表候補を配置する。
    if (course.chooseAmongSections && options.length > 1) {
      const selected = findSelectedOption(options, selectedTimetableCodes[course.code])
      const sameSlots = options.every((option) => option.slots.length > 0)
        && new Set(options.map((option) => slotKey(option.slots))).size === 1
      const placement = selected ?? (sameSlots ? options[0] : undefined)
      if (placement) {
        appendSelectedOption(slots, course, placement)
        continue
      }
      unplaced.push({ code: course.code, name: course.name, reason: 'lower-year-selection', options })
      continue
    }
    // 通年注記があり時限候補を示せない科目は、両学期に残して担当教員への確認を促す。
    if (isYearRound && (options.length === 0 || options.every((option) => option.slots.length === 0))) {
      unplaced.push({ code: course.code, name: course.name, reason: 'instructor-dependent' })
      continue
    }
    // 受講クラスを絞れず、その学期の開講候補を得られない場合は配置しない。
    if (options.length === 0) {
      // クラス不明なら、プロフィールで絞られていない全セクションをプレビュー候補にする。
      const selected = allTermSections.find((section) => section.timetableCode === selectedTimetableCodes[course.code])
      if (selected && selected.slots.length > 0) {
        // 保存済みのコードが現行データにあり、時限もある場合だけグリッドへ配置する。
        appendSelectedOption(slots, course, selected)
        continue
      }
      unplaced.push({
        code: course.code,
        name: course.name,
        reason: 'no-class',
        ...(allTermSections.length > 0 ? { options: allTermSections } : {}),
      })
      continue
    }
    // 集中講義など、シラバスに曜日時限が無い科目は配置しない。
    if (options.some((option) => option.slots.length === 0)) {
      unplaced.push({ code: course.code, name: course.name, reason: 'no-slot' })
      continue
    }
    // 春・夏など別タームの候補が残る場合は、同じ曜日時限でも期間を断定しない。
    if (new Set(options.map((option) => option.term)).size > 1) {
      // 候補タームを1つ選ぶまで、科目を欄外に残す。
      const selected = findSelectedOption(options, selectedTimetableCodes[course.code])
      if (selected) {
        appendSelectedOption(slots, course, selected)
        continue
      }
      unplaced.push({ code: course.code, name: course.name, reason: 'ambiguous-term', options })
      continue
    }
    // 同じターム内でもクラスごとに曜日時限が異なれば、両方を仮置きしない。
    if (options.some((option) => slotKey(option.slots) !== slotKey(options[0].slots))) {
      // 同じターム内の時限候補も、利用者が1セクションを選ぶまで欄外に残す。
      const selected = findSelectedOption(options, selectedTimetableCodes[course.code])
      if (selected) {
        appendSelectedOption(slots, course, selected)
        continue
      }
      unplaced.push({ code: course.code, name: course.name, reason: 'ambiguous-slot', options })
      continue
    }

    // 同じ時限に複数のセクションがあっても、科目は各コマに一度だけ配置する。
    const seen = new Set<string>()
    for (const slot of options[0].slots) {
      const key = `${slot.day}:${slot.period}`
      // 同じ科目の同じコマが重複登録されていても、カードは一枚だけにする。
      if (seen.has(key)) continue
      seen.add(key)
      slots.push({ ...slot, code: course.code, name: course.name, category: course.category, offeringTerm: options[0].term })
    }
  }

  return { slots, unplaced, onDemand, intensive }
}

/** 保存値が現在の候補に存在する場合だけ、選択されたセクションを返す。 */
function findSelectedOption(options: readonly TimetablePreviewOption[], savedCode: string | undefined): TimetablePreviewOption | undefined {
  // 古い・壊れた保存値は見つからないため、未選択として扱う。
  if (!savedCode) return undefined
  return options.find((option) => option.timetableCode === savedCode)
}

/** 選択学期にある再履修専用枠が1件だけなら、初期表示用の候補を返す。 */
export function defaultRetakeOptionForTerm(course: TimetablePreviewCourse, term: string): TimetablePreviewOption | undefined {
  // 表示中の学期以外の再履修枠は、初期候補に含めない。
  const termSections = (course.sections ?? []).filter((section) => previewSemesterOf(section.term) === term)
  return findUniqueRetakeOption(termSections)
}

/** 選択学期の再履修専用セクションが1件だけなら、初期表示用の候補として返す。 */
function findUniqueRetakeOption(options: readonly TimetablePreviewOption[]): TimetablePreviewOption | undefined {
  // 専用枠が複数ある科目は、利用者が選ぶまで欄外に残す。
  const retakeOptions = options.filter((option) => option.retake)
  return retakeOptions.length === 1 ? retakeOptions[0] : undefined
}

/** 利用者が選んだセクションの全コマを時間割へ追加する。 */
function appendSelectedOption(slots: TimetablePreviewSlot[], course: TimetablePreviewCourse, option: TimetablePreviewOption): void {
  // 1つのセクションに複数コマがあれば、そのすべてを重複判定へ渡す。
  for (const slot of option.slots) {
    slots.push({ ...slot, code: course.code, name: course.name, category: course.category, offeringTerm: option.term, ...(option.topic ? { topic: option.topic } : {}) })
  }
}

/** テーマに含まれる一般的な集中表記を、集中講義一覧の区分へ対応させる。 */
function classifyTopicIntensive(topic: string): Extract<TimelessCourseKind, 'summer-intensive' | 'winter-intensive' | 'intensive'> {
  // 夏期・冬期の明記があればその区分を保ち、それ以外の集中テーマは集中講義とする。
  if (topic.includes('夏期集中')) return 'summer-intensive'
  if (topic.includes('冬期集中')) return 'winter-intensive'
  return 'intensive'
}

/** 非表示にした科目を除いて、時間割と重複判定に使う結果を作る。 */
export function buildVisibleTimetablePreview(
  courses: readonly TimetablePreviewCourse[],
  term: string,
  hiddenCodes: ReadonlySet<string>,
  selectedTimetableCodes: Readonly<Record<string, string>> = {},
): TimetablePreviewResult {
  // 科目単位で取り除いてからグリッドを作るため、重複判定にも混ざらない。
  return buildTimetablePreview(courses.filter((course) => !hiddenCodes.has(course.code)), term, selectedTimetableCodes)
}
