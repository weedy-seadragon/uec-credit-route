// シラバスの曜日時限と注記から、実施形態の表示区分を判定する。

/** 曜日時限の有無だけを参照するための開講セクション。 */
export interface OfferingWithSlots {
  slots: readonly unknown[]
}

/** 時限なし科目と、実施形態を一律の時限で示せない科目の共通区分。 */
export type TimelessCourseKind = 'lab' | 'instructor-dependent' | 'on-demand' | 'summer-intensive' | 'winter-intensive' | 'intensive'

/** 各画面が共通の区分から表示文言を引けるようにする。 */
export const TIMELESS_COURSE_LABELS: Readonly<Record<TimelessCourseKind, string>> = {
  lab: '研究室ごとに実施形態が異なります',
  'instructor-dependent': '担当教員により開講時限が異なります',
  'on-demand': 'オンデマンド',
  'summer-intensive': '夏期集中',
  'winter-intensive': '冬期集中',
  intensive: '集中講義',
}

/** 時限なし・研究室単位・担当教員依存の科目を、画面共通の表示区分へ分類する。 */
export function classifyTimelessCourse(
  name: string,
  note: string | undefined,
  offerings: readonly OfferingWithSlots[] | undefined,
): TimelessCourseKind | null {
  // 開講情報が無い科目は、科目名だけから実施区分を断定しない。
  if (!offerings || offerings.length === 0) return null
  // 研究室ごと・担当教員ごとに実施が異なる科目は、曜日時限があっても共通区分を使う。
  if (['輪講', '卒業研究'].some((prefix) => name.startsWith(prefix))) return 'lab'
  if (name.startsWith('情報工学工房')) return 'instructor-dependent'
  // 一般科目の時限なし区分は、全セクションに時限が無い場合だけ判定する。
  if (!offerings.every((offering) => offering.slots.length === 0)) return null
  // noteの表現に応じて夏期・冬期を区別し、それ以外の集中表記も集中講義とする。
  if (note?.includes('夏期集中')) return 'summer-intensive'
  if (note?.includes('冬期集中')) return 'winter-intensive'
  if (note?.includes('集中')) return 'intensive'
  // 全セクションの時限が無く、集中講義などでもない通常科目はオンデマンドとする。
  return 'on-demand'
}

/** 表示側が既存のオンデマンド表記を維持できるよう、共通分類を使って判定する。 */
export function isOnDemandCourse(
  name: string,
  note: string | undefined,
  offerings: readonly OfferingWithSlots[] | undefined,
): boolean {
  // 時限なし科目の分類結果がオンデマンドなら、オンデマンドと案内する。
  return classifyTimelessCourse(name, note, offerings) === 'on-demand'
}
