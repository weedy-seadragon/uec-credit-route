// シラバスの曜日時限と注記から、時限なし科目の表示区分を判定する。

/** 曜日時限の有無だけを参照するための開講セクション。 */
export interface OfferingWithSlots {
  slots: readonly unknown[]
}

/** 曜日時限の無い科目を、プレビューに使う表示区分へ分類する。 */
export function classifyTimelessCourse(
  name: string,
  note: string | undefined,
  offerings: readonly OfferingWithSlots[] | undefined,
): 'on-demand' | 'summer-intensive' | 'winter-intensive' | 'intensive' | null {
  // 開講情報が無い科目や時限のある科目は、時限なしの分類に含めない。
  if (!offerings || offerings.length === 0 || !offerings.every((offering) => offering.slots.length === 0)) return null
  // 輪講・卒業研究・情報工学工房は、時限が空でも実施形態が別に決まる。
  if (['輪講', '卒業研究', '情報工学工房'].some((prefix) => name.startsWith(prefix))) return null
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
