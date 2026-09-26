// 開講期名から、2科目が同じ期間に授業を行うかを判定する純粋ロジック。

/** 学期全体の表記を、含まれる各タームへ対応付ける。 */
const PERIODS_BY_TERM: Readonly<Record<string, readonly string[]>> = {
  '前学期': ['春ﾀｰﾑ', '夏ﾀｰﾑ'],
  '後学期': ['秋ﾀｰﾑ', '冬ﾀｰﾑ'],
}

/** 開講期を、実際に授業が行われるタームの一覧にする。 */
export function periodsOf(term: string): readonly string[] {
  // 個別タームや未知の開講期は、その名前の期間だけに属する。
  return PERIODS_BY_TERM[term] ?? [term]
}

/** 同じ曜日時限の2科目について、開講する期間が重なるか判定する。 */
export function offeringTermsOverlap(first: string, second: string): boolean {
  // 前学期と春は重なるが、春と夏は別の期間なので重ならない。
  return periodsOf(first).some((period) => periodsOf(second).includes(period))
}
