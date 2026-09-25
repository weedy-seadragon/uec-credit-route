// 修得見込の科目を、選択した開講期の週間時間割と時限未確定の一覧に分ける純粋ロジック。
// 複数の開講候補があるときは、すべて同じ曜日時限に決まる場合だけグリッドに置く。

import type { ScheduleOption, ScheduleSlot } from './scheduleConflicts'

/** プロフィールと再履修状態で開講候補を絞った、プレビュー用の1科目。 */
export interface TimetablePreviewCourse {
  code: string
  name: string
  termType: string | null
  offeredTerms: readonly string[]
  options: readonly ScheduleOption[]
}

/** グリッド上の1科目1コマ。複数コマの科目はコマごとに別要素を持つ。 */
export interface TimetablePreviewSlot extends ScheduleSlot {
  code: string
  name: string
}

/** 選択した開講期の科目だが、曜日時限を断定できないもの。 */
export interface UnplacedTimetableCourse {
  code: string
  name: string
}

/** 時間割グリッドと、その下に表示する未確定科目。 */
export interface TimetablePreviewResult {
  slots: TimetablePreviewSlot[]
  unplaced: UnplacedTimetableCourse[]
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

  // 実際のシラバスの開講期を優先し、情報がない科目だけ学修要覧の学期を使う。
  for (const course of courses) {
    const belongsToTerm = course.offeredTerms.length > 0
      ? course.offeredTerms.includes(term)
      : course.termType === null || course.termType === term
    if (!belongsToTerm) continue

    const options = course.options.filter((option) => option.term === term)
    // クラスを絞れない、時限が空、または候補間で時限が異なる場合は誤配置を避ける。
    if (options.length === 0 || options.some((option) => option.slots.length === 0)
      || options.some((option) => slotKey(option.slots) !== slotKey(options[0].slots))) {
      unplaced.push({ code: course.code, name: course.name })
      continue
    }

    // 同じ時限に複数のセクションがあっても、科目は各コマに一度だけ配置する。
    const seen = new Set<string>()
    for (const slot of options[0].slots) {
      const key = `${slot.day}:${slot.period}`
      if (seen.has(key)) continue
      seen.add(key)
      slots.push({ ...slot, code: course.code, name: course.name })
    }
  }

  return { slots, unplaced }
}
