// 修得見込の科目を、選択した開講期の週間時間割と時限未確定の一覧に分ける純粋ロジック。
// 複数の開講候補があるときは、すべて同じ曜日時限に決まる場合だけグリッドに置く。

import type { ScheduleOption, ScheduleSlot } from './scheduleConflicts'
import { classifyTimelessCourse } from './onDemand'
import type { OfferingWithSlots } from './onDemand'

/** プロフィールと再履修状態で開講候補を絞った、プレビュー用の1科目。 */
export interface TimetablePreviewCourse {
  code: string
  name: string
  /** メイン画面と共通の学年・学期表記。表示切替欄だけで使う。 */
  yearTermLabel?: string
  termType: string | null
  offeredTerms: readonly string[]
  options: readonly ScheduleOption[]
  note?: string
  offerings?: readonly OfferingWithSlots[]
}

/** グリッド上の1科目1コマ。複数コマの科目はコマごとに別要素を持つ。 */
export interface TimetablePreviewSlot extends ScheduleSlot {
  code: string
  name: string
  /** 前学期・後学期以外の開講期なら、科目名に添えて表示する。 */
  offeringTerm: string
}

/** 選択した開講期の科目だが、曜日時限を断定できないもの。 */
export interface UnplacedTimetableCourse {
  code: string
  name: string
  reason: 'no-offering' | 'no-class' | 'no-slot' | 'instructor-varies' | 'ambiguous-term' | 'ambiguous-slot'
}

/** 時間割グリッドと、その下に表示する未確定科目。 */
export interface TimetablePreviewResult {
  slots: TimetablePreviewSlot[]
  unplaced: UnplacedTimetableCourse[]
  onDemand: { code: string; name: string }[]
  intensive: { code: string; name: string; kind: 'summer-intensive' | 'winter-intensive' | 'intensive' }[]
}

/** 春・夏タームは前学期、秋・冬タームは後学期として扱う。 */
const SEMESTER_BY_TERM: Readonly<Record<string, string>> = {
  '春ﾀｰﾑ': '前学期',
  '夏ﾀｰﾑ': '前学期',
  '秋ﾀｰﾑ': '後学期',
  '冬ﾀｰﾑ': '後学期',
}

/** 学期全体の授業は、その中の両タームで開講するものとして期間を表す。 */
const PERIODS_BY_TERM: Readonly<Record<string, readonly string[]>> = {
  '前学期': ['春ﾀｰﾑ', '夏ﾀｰﾑ'],
  '後学期': ['秋ﾀｰﾑ', '冬ﾀｰﾑ'],
}

/** 開講期を、実際に授業が行われるタームの一覧にする。 */
function periodsOf(term: string): readonly string[] {
  // 個別タームや未知の開講期は、その名前の期間だけに属する。
  return PERIODS_BY_TERM[term] ?? [term]
}

/** 同じ曜日時限の2科目について、開講する期間が重なるか判定する。 */
export function offeringTermsOverlap(first: string, second: string): boolean {
  // 前学期と春は重なるが、春と夏は別の期間なので重ならない。
  return periodsOf(first).some((period) => periodsOf(second).includes(period))
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

    // 曜日時限のない科目を、オンデマンド・集中講義・その他に共通基準で分類する。
    const timelessKind = classifyTimelessCourse(course.name, course.note, course.offerings)
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
    // シラバスの開講情報自体が無い科目は、科目表の学期に基づく欄外表示にする。
    if (course.offeredTerms.length === 0) {
      unplaced.push({ code: course.code, name: course.name, reason: 'no-offering' })
      continue
    }
    // 通年注記があり時限候補を示せない科目は、両学期に残して担当教員への確認を促す。
    if (isYearRound && (options.length === 0 || options.every((option) => option.slots.length === 0))) {
      unplaced.push({ code: course.code, name: course.name, reason: 'instructor-varies' })
      continue
    }
    // 受講クラスを絞れず、その学期の開講候補を得られない場合は配置しない。
    if (options.length === 0) {
      unplaced.push({ code: course.code, name: course.name, reason: 'no-class' })
      continue
    }
    // 集中講義など、シラバスに曜日時限が無い科目は配置しない。
    if (options.some((option) => option.slots.length === 0)) {
      unplaced.push({ code: course.code, name: course.name, reason: 'no-slot' })
      continue
    }
    // 春・夏など別タームの候補が残る場合は、同じ曜日時限でも期間を断定しない。
    if (new Set(options.map((option) => option.term)).size > 1) {
      unplaced.push({ code: course.code, name: course.name, reason: 'ambiguous-term' })
      continue
    }
    // 同じターム内でもクラスごとに曜日時限が異なれば、両方を仮置きしない。
    if (options.some((option) => slotKey(option.slots) !== slotKey(options[0].slots))) {
      unplaced.push({ code: course.code, name: course.name, reason: 'ambiguous-slot' })
      continue
    }

    // 同じ時限に複数のセクションがあっても、科目は各コマに一度だけ配置する。
    const seen = new Set<string>()
    for (const slot of options[0].slots) {
      const key = `${slot.day}:${slot.period}`
      // 同じ科目の同じコマが重複登録されていても、カードは一枚だけにする。
      if (seen.has(key)) continue
      seen.add(key)
      slots.push({ ...slot, code: course.code, name: course.name, offeringTerm: options[0].term })
    }
  }

  return { slots, unplaced, onDemand, intensive }
}

/** 非表示にした科目を除いて、時間割と重複判定に使う結果を作る。 */
export function buildVisibleTimetablePreview(
  courses: readonly TimetablePreviewCourse[],
  term: string,
  hiddenCodes: ReadonlySet<string>,
): TimetablePreviewResult {
  // 科目単位で取り除いてからグリッドを作るため、重複判定にも混ざらない。
  return buildTimetablePreview(courses.filter((course) => !hiddenCodes.has(course.code)), term)
}
