// 修得見込の科目を「何年の何学期の時間割に置くか」を決める純粋ロジック。
// 履修記録には「何年に取るか」が無いため、標準年次・開講学期・現在の学期から自動で決め、
// 利用者がプレビュー用に選んだ時期（上書き）があればそちらを優先する。
import type { SemesterHalf } from './academicTerm'
import { findUnavoidableScheduleConflicts } from './scheduleConflicts'
import type { PlannedCourseSchedule, ScheduleConflict } from './scheduleConflicts'
import { previewSemesterOf } from './timetablePreview'

/** 時間割プレビューのタブとして最低限出す最終学年。 */
export const LAST_PREVIEW_YEAR = 4

/** 学年と学期の組。時間割プレビューの1画面ぶんに当たる。 */
export interface PreviewPeriod {
  year: number
  half: SemesterHalf
}

/** 科目を置く時期。halfがnullなら通年科目で、その学年の前学期・後学期の両方に出す。 */
export interface TimetablePlacement {
  year: number
  half: SemesterHalf | null
}

/** 置き場所の判定に必要な、プレビュー用科目の最小限の情報。 */
export interface TimetablePlacementInput {
  standardYear?: number | null
  termType: string | null
  offeredTerms: readonly string[]
  /** プロフィールで絞り込んだ受講候補。空ならシラバスの全開講期を使う。 */
  options: readonly { term: string; timetableCode?: string }[]
  sections?: readonly { term: string; timetableCode?: string }[]
  note?: string
}

/** 学期の並び順。同じ学年なら前学期が先。 */
const HALVES: readonly SemesterHalf[] = ['前学期', '後学期']

/** 文字列が前学期・後学期のどちらかか判定する（TypeScriptの型の絞り込みも兼ねる）。 */
function isSemesterHalf(term: string | null | undefined): term is SemesterHalf {
  return term === '前学期' || term === '後学期'
}

/** 時期を「学年×2＋学期」の通し番号にして、前後を比べられるようにする。 */
function periodOrder(period: PreviewPeriod): number {
  return period.year * 2 + (period.half === '後学期' ? 1 : 0)
}

/** 現在の学期から指定学年の後学期まで、時間割プレビューで選べる時期を順に並べる。 */
export function previewPeriodsFrom(current: PreviewPeriod, lastYear: number = LAST_PREVIEW_YEAR): PreviewPeriod[] {
  const periods: PreviewPeriod[] = []
  // 学年ごとに前学期・後学期を並べ、現在より前の時期（もう終わった学期）は出さない。
  for (let year = current.year; year <= Math.max(lastYear, current.year); year++) {
    for (const half of HALVES) {
      const period = { year, half }
      if (periodOrder(period) >= periodOrder(current)) periods.push(period)
    }
  }
  return periods
}

/** 時期を保存・比較用の文字列にする（例: 「3:前学期」「2:通年」）。 */
export function timetablePlacementKey(placement: TimetablePlacement): string {
  return `${placement.year}:${placement.half ?? '通年'}`
}

/**
 * 科目を置ける学期の一覧を返す。nullなら通年科目（学期を選ばない）。
 * 利用者が選んだセクションがあればその学期、無ければ受講候補→シラバス→学修要覧の順に開講学期を探す。
 */
export function placementHalves(course: TimetablePlacementInput, selectedTimetableCode?: string): SemesterHalf[] | null {
  // 通年科目は前学期・後学期の両方に出すので、学期は決めない。
  if (course.note?.includes('通年')) return null
  // 選んだセクション（学域特別講義のテーマなど）があれば、その学期に置く。
  if (selectedTimetableCode) {
    const selected = [...course.options, ...(course.sections ?? [])].find((option) => option.timetableCode === selectedTimetableCode)
    const selectedHalf = selected ? previewSemesterOf(selected.term) : undefined
    if (isSemesterHalf(selectedHalf)) return [selectedHalf]
  }
  // クラスで絞れた候補があればそれを、無ければシラバスの全開講期を使う（春・夏タームは前学期に含める）。
  const terms = course.options.length > 0 ? course.options.map((option) => option.term) : course.offeredTerms
  const halves = HALVES.filter((half) => terms.some((term) => previewSemesterOf(term) === half))
  if (halves.length > 0) return halves
  // シラバスの情報が無い科目は、学修要覧の学期に置く。それも無ければどちらの学期でもよいことにする。
  return isSemesterHalf(course.termType) ? [course.termType] : [...HALVES]
}

/**
 * 科目を置く時期を自動で決める。
 * 基本は「標準年次の、開講学期」。それが現在の学期より前（取り残し・再履修）なら、
 * 現在の学期以降で最初にその科目が開講される学期へ回す。
 */
export function autoTimetablePlacement(
  course: TimetablePlacementInput,
  current: PreviewPeriod,
  selectedTimetableCode?: string,
): TimetablePlacement {
  const standardYear = typeof course.standardYear === 'number' && Number.isFinite(course.standardYear) ? course.standardYear : current.year
  const halves = placementHalves(course, selectedTimetableCode)
  // 通年科目は学年だけ決め、標準年次が過ぎていれば現在の学年に置く。
  if (halves === null) return { year: Math.max(standardYear, current.year), half: null }
  // 学修要覧の学期で開講していればそれを、していなければ（シラバスで学期が変わった科目など）最初の開講学期を使う。
  const naturalHalf = isSemesterHalf(course.termType) && halves.includes(course.termType) ? course.termType : halves[0]
  const natural = { year: standardYear, half: naturalHalf }
  // 標準の時期がまだ来ていなければ、そのまま標準の時期に置く。
  if (periodOrder(natural) >= periodOrder(current)) return natural
  // 標準の時期を過ぎていれば、現在の学期から順に見て最初に開講される学期へ置く（2学期見れば必ず見つかる）。
  const later = previewPeriodsFrom(current, current.year + 1).find((period) => halves.includes(period.half))
  return later ?? natural
}

/** 利用者がプレビュー用に選べる時期の一覧（現在の学期以降で、その科目が開講される学期だけ）。 */
export function timetablePlacementChoices(
  course: TimetablePlacementInput,
  current: PreviewPeriod,
  selectedTimetableCode?: string,
): TimetablePlacement[] {
  const auto = autoTimetablePlacement(course, current, selectedTimetableCode)
  const lastYear = Math.max(LAST_PREVIEW_YEAR, auto.year)
  const halves = placementHalves(course, selectedTimetableCode)
  // 通年科目は学年だけを選ばせる。
  if (halves === null) {
    return Array.from({ length: lastYear - current.year + 1 }, (_, index) => ({ year: current.year + index, half: null }))
  }
  // 開講されない学期を選べると時間割に出せなくなるため、開講学期だけに絞る。
  return previewPeriodsFrom(current, lastYear).filter((period) => halves.includes(period.half))
}

/** 保存された上書きが今も選べる時期ならそれを、そうでなければ自動の時期を返す。 */
export function resolveTimetablePlacement(
  course: TimetablePlacementInput,
  current: PreviewPeriod,
  overrideKey?: string,
  selectedTimetableCode?: string,
): TimetablePlacement {
  // 学年や学期が進んで過去になった上書き・開講学期が変わった上書きは無視し、自動に戻す。
  if (overrideKey) {
    const chosen = timetablePlacementChoices(course, current, selectedTimetableCode)
      .find((placement) => timetablePlacementKey(placement) === overrideKey)
    if (chosen) return chosen
  }
  return autoTimetablePlacement(course, current, selectedTimetableCode)
}

/** 科目の置き場所が、表示中の時期（学年・学期）に当たるか判定する。 */
export function placementIncludesPeriod(placement: TimetablePlacement, period: PreviewPeriod): boolean {
  // 通年科目は、その学年なら前学期・後学期のどちらにも出す。
  return placement.year === period.year && (placement.half === null || placement.half === period.half)
}

/** 表示中の時期に置かれる科目だけを返す。上書きとセクション選択は科目番号ごとの保存値を使う。 */
export function coursesForPreviewPeriod<C extends TimetablePlacementInput & { code: string }>(
  courses: readonly C[],
  period: PreviewPeriod,
  current: PreviewPeriod,
  placementOverrides: Readonly<Record<string, string>>,
  selectedTimetableCodes: Readonly<Record<string, string>>,
): C[] {
  // 科目ごとに置き場所を決め、表示中の学年・学期に当たるものだけ残す。
  return courses.filter((course) => placementIncludesPeriod(
    resolveTimetablePlacement(course, current, placementOverrides[course.code], selectedTimetableCodes[course.code]),
    period,
  ))
}

/** 時期の選択肢をどの学年まで出すか。通常は4年までで、5年目に回る科目があればそこまで広げる。 */
export function lastPreviewYear(placements: readonly TimetablePlacement[]): number {
  return Math.max(LAST_PREVIEW_YEAR, ...placements.map((placement) => placement.year))
}

/**
 * 修得見込の科目どうしの曜日時限の重複を、置き場所（学年・学期）が同じ科目の間だけで探す。
 * 1年の科目と3年の科目が同じ曜日時限でも、受ける年が違うので重複にしない。
 */
export function findScheduleConflictsByPlacement(
  courses: readonly PlannedCourseSchedule[],
  placementOf: (code: string) => TimetablePlacement | undefined,
): ScheduleConflict[] {
  const coursesByYear = new Map<string, PlannedCourseSchedule[]>()
  // 科目を学年ごとに分け、置き場所の学期で開講するセクションだけを比較対象に残す。
  for (const course of courses) {
    const placement = placementOf(course.code)
    // 置き場所が分からない科目は、他の科目と比べずに1つのまとまりへ集めておく。
    const groupKey = placement ? String(placement.year) : 'unknown'
    const options = placement?.half
      ? course.options.filter((option) => previewSemesterOf(option.term) === placement.half)
      : course.options
    // 置き場所の学期に候補が無い科目は、誤警告を避けるため比較しない。
    if (options.length === 0) continue
    coursesByYear.set(groupKey, [...(coursesByYear.get(groupKey) ?? []), { code: course.code, options }])
  }
  // 学期の違いは findUnavoidableScheduleConflicts 側の開講期の重なり判定で区別される。
  return [...coursesByYear.values()].flatMap((group) => findUnavoidableScheduleConflicts(group))
}
