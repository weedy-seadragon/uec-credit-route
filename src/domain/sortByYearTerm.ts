// 科目を標準年次・学期・曜日時限の順に並べる純粋関数。

/** 科目コードを基準に、年次・学期・時限の順で項目を並べ替える。 */
export function sortByYearTerm<T>(
  items: readonly T[],
  codeOf: (item: T) => string,
  standardYearOf: (code: string) => number | null,
  termTypeOf: (code: string) => string | null,
  slotRankOf?: (code: string) => number,
): T[] {
  // 前学期を後学期より先にし、未知の学期はその後ろに置く。
  const termRank = (term: string | null) => (term === '前学期' ? 0 : term === '後学期' ? 1 : 2)
  // 同じ学年学期なら曜日時限の数値順位を使い、順位が無ければ元の順を保つ。
  const compareSlot = (first: T, second: T) => {
    if (!slotRankOf) return 0
    const firstRank = slotRankOf(codeOf(first))
    const secondRank = slotRankOf(codeOf(second))
    if (firstRank === secondRank) return 0
    return firstRank < secondRank ? -1 : 1
  }
  // 入力配列を変更せず複製し、年次・学期・時限の順で並べる。
  return [...items].sort((first, second) => {
    const firstYear = standardYearOf(codeOf(first))
    const secondYear = standardYearOf(codeOf(second))
    if (firstYear === null && secondYear === null) return compareSlot(first, second)
    if (firstYear === null) return 1
    if (secondYear === null) return -1
    if (firstYear !== secondYear) return firstYear - secondYear
    const termDifference = termRank(termTypeOf(codeOf(first))) - termRank(termTypeOf(codeOf(second)))
    if (termDifference !== 0) return termDifference
    return compareSlot(first, second)
  })
}
