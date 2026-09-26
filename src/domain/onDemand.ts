// シラバスの曜日時限から、オンデマンドと表示できる科目だけを判定する。

/** 曜日時限の有無だけを参照するための開講セクション。 */
export interface OfferingWithSlots {
  slots: readonly unknown[]
}

/** 時限が無い開講科目のうち、集中講義や研究室・教員ごとの科目を除く。 */
export function isOnDemandCourse(
  name: string,
  note: string | undefined,
  offerings: readonly OfferingWithSlots[] | undefined,
): boolean {
  // 開講情報が無い科目は、オンデマンドとは断定しない。
  if (!offerings || offerings.length === 0) return false
  // 輪講・卒業研究・情報工学工房は、時限が空でも実施形態が別に決まる。
  if (['輪講', '卒業研究', '情報工学工房'].some((prefix) => name.startsWith(prefix))) return false
  // 夏期・冬期を含む集中講義は、オンデマンドとして案内しない。
  if (note?.includes('集中')) return false
  // すべてのセクションに時限が無いときだけオンデマンドとする。
  return offerings.every((offering) => offering.slots.length === 0)
}
