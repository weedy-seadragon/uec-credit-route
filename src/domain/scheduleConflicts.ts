// 修得予定の科目どうしで、曜日・時限が必ず重複する組み合わせを見つける純粋ロジック。
// Reactや科目マスタには依存させず、画面側で解決した「受講候補」だけを受け取る。

/** 1コマぶんの曜日・時限。曜日と時限が同じなら同じ授業時間とみなす。 */
export interface ScheduleSlot {
  day: string
  period: number
}

/** 1つの開講セクションとして選べる、学期と曜日時限のまとまり。 */
export interface ScheduleOption {
  term: string
  slots: readonly ScheduleSlot[]
}

/** 修得予定の1科目と、その利用者が選べる開講セクションの候補。 */
export interface PlannedCourseSchedule {
  code: string
  options: readonly ScheduleOption[]
}

/** 重複が避けられないと判定された、修得予定2科目の組み合わせ。 */
export interface ScheduleConflict {
  firstCode: string
  secondCode: string
}

/** 同一学期・同一曜日・同一時限のコマが1つでもあれば、2つのセクションは両立できない。 */
function optionsOverlap(first: ScheduleOption, second: ScheduleOption): boolean {
  // 開講学期が異なれば、同じ曜日時限でも同じ週には受講しないため重複ではない。
  if (first.term !== second.term) return false
  // 片方のセクションの各コマを見て、もう片方に同じコマがあるか調べる。
  for (const firstSlot of first.slots) {
    if (second.slots.some((secondSlot) => secondSlot.day === firstSlot.day && secondSlot.period === firstSlot.period)) {
      return true
    }
  }
  return false
}

/**
 * 受講候補が複数ある科目も含め、どの候補の組み合わせを選んでも重複を避けられない科目ペアを返す。
 *
 * 例えば英語の候補が月1限と火1限で、もう一方が月1限だけなら、火1限を選べるので警告しない。
 * slotsが空のオンデマンド科目・時限不明科目は画面側で候補に入れないため、ここでは判定対象外になる。
 */
export function findUnavoidableScheduleConflicts(
  courses: readonly PlannedCourseSchedule[],
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  // 同じ科目ペアを一度ずつだけ比べるため、後ろの科目だけを走査する。
  for (let firstIndex = 0; firstIndex < courses.length; firstIndex++) {
    const first = courses[firstIndex]
    // 後ろにある各科目と、選べる全セクションの組み合わせを確認する。
    for (let secondIndex = firstIndex + 1; secondIndex < courses.length; secondIndex++) {
      const second = courses[secondIndex]
      // 候補の組み合わせの中に1つでも両立するものがあれば、利用者が選べる余地があるので警告しない。
      const hasNonOverlappingChoice = first.options.some((firstOption) =>
        second.options.some((secondOption) => !optionsOverlap(firstOption, secondOption)),
      )
      if (!hasNonOverlappingChoice) {
        conflicts.push({ firstCode: first.code, secondCode: second.code })
      }
    }
  }
  return conflicts
}
