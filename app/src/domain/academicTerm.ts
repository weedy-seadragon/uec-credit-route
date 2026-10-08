// 日付から「いま何学期か」を判定する純粋ロジック。時間割プレビューの初期表示などに使う。

/** 時間割プレビューで扱う学期。春・夏タームは前学期、秋・冬タームは後学期に含める。 */
export type SemesterHalf = '前学期' | '後学期'

/**
 * 日付が前学期・後学期のどちらに属するかを返す。
 * 4〜9月を前学期、10〜翌3月を後学期とする（学期の切り替え日は年度で数日ずれるが、月単位で十分なため）。
 */
export function currentSemesterOf(date: Date): SemesterHalf {
  // getMonth()は0始まり（1月=0）なので、+1して普段の月番号にそろえる。
  const month = date.getMonth() + 1
  return month >= 4 && month <= 9 ? '前学期' : '後学期'
}
