// programSuffix.ts の「同じ類だけを他プログラム科目とする」判定を検証する。
import { describe, expect, it } from 'vitest'
import { isSameClusterOtherProgramSubject } from './programSuffix'

describe('isSameClusterOtherProgramSubject', () => {
  it('同じⅠ類で自分と異なる末尾記号なら他プログラム科目として扱う', () => {
    // Ⅰ類コンピュータサイエンス(d)から見たaは、同じ類の別プログラムなので折りたたみ対象になる。
    expect(isSameClusterOtherProgramSubject('COM502a', 'd', 'I')).toBe(true)
  })

  it('他類の末尾記号は他プログラム科目として扱わない', () => {
    // Ⅱ類情報通信工学(g)の科目は、Ⅰ類の選択科目ではなく原則自由科目として扱う。
    expect(isSameClusterOtherProgramSubject('PHY302g', 'd', 'I')).toBe(false)
  })

  it('自分のプログラムと全類共通科目は他プログラム科目として扱わない', () => {
    // dは自分自身、zは全類共通なので、どちらも他プログラム用の入れ子に入れない。
    expect(isSameClusterOtherProgramSubject('COM502d', 'd', 'I')).toBe(false)
    expect(isSameClusterOtherProgramSubject('PHY202z', 'd', 'I')).toBe(false)
  })
})
