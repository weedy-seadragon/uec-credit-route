// 科目コード末尾のプログラム記号を使い、「同じ類の他プログラム科目」だけを判別する純粋関数。
// 他類の専門科目は原則として自由科目なので、表示上も同じ「他プログラム専門科目」には混ぜない。

/** 類ごとに割り当てられている教育プログラムの末尾記号。 */
const PROGRAM_SUFFIXES_BY_CLUSTER = {
  I: new Set(['a', 'b', 'c', 'd', 'e']),
  II: new Set(['f', 'g', 'h', 'i', 'j']),
  III: new Set(['k', 'm', 'n', 'p', 'r']),
} as const

/**
 * 科目コードが、自分と同じ類に属する「他プログラム」の専門科目かを返す。
 *
 * 他類の科目までこの入れ子に分類すると、自由科目を専門科目として数えるように見えてしまう。
 * そのため、末尾記号が自分と異なるだけでなく、同じ類の記号表に入っていることも確認する。
 */
export function isSameClusterOtherProgramSubject(
  code: string,
  ownSuffix: string | undefined,
  cluster: 'I' | 'II' | 'III' | null,
): boolean {
  // プログラム未選択・夜間主は比較の基準になる記号が無いため、他プログラム科目として扱わない。
  if (!ownSuffix || !cluster) return false
  const lastChar = code.slice(-1)
  // 自分の記号を除いた、同じ類の記号だけを「他プログラム」として認める。
  return lastChar !== ownSuffix && PROGRAM_SUFFIXES_BY_CLUSTER[cluster].has(lastChar as never)
}
