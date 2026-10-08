// academicTerm.ts の、日付から学期を判定する処理のテスト。
import { describe, expect, it } from 'vitest'
import { currentSemesterOf } from './academicTerm'

// 月の境目で前学期・後学期が正しく切り替わるかを検証する。
describe('currentSemesterOf', () => {
  // 4月1日は前学期の始まりなので前学期になる。
  it('4月は前学期', () => {
    expect(currentSemesterOf(new Date(2026, 3, 1))).toBe('前学期')
  })

  // 9月末までは前学期として扱う。
  it('9月は前学期', () => {
    expect(currentSemesterOf(new Date(2026, 8, 30))).toBe('前学期')
  })

  // 10月からは後学期に切り替わる。
  it('10月は後学期', () => {
    expect(currentSemesterOf(new Date(2026, 9, 1))).toBe('後学期')
  })

  // 1〜3月は年をまたいだ後学期の続きなので後学期になる。
  it('3月は後学期', () => {
    expect(currentSemesterOf(new Date(2027, 2, 31))).toBe('後学期')
  })
})
