// 表示の好みだけを、履修記録とは別の localStorage キーで安全に保存することを確かめる。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadHiddenTimetableCourses, saveHiddenTimetableCourses } from './timetableVisibility'

// テストで差し替えた window を後続のテストへ残さない。
afterEach(() => {
  vi.unstubAllGlobals()
})

// 年度ごとの復元と、ストレージ故障時の扱いを検証する。
describe('時間割の非表示設定', () => {
  // 同じブラウザでも年度ごとに別の設定を復元できる。
  it('入学年度ごとに非表示科目を保存する', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    } })
    saveHiddenTimetableCourses(2025, new Set(['A']))
    expect([...loadHiddenTimetableCourses(2025)]).toEqual(['A'])
    expect([...loadHiddenTimetableCourses(2026)]).toEqual([])
  })

  // localStorage へアクセスできなくても、表示は初期値から続けられる。
  it('読み書きの例外を画面へ伝播させない', () => {
    vi.stubGlobal('window', { localStorage: {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    } })
    expect([...loadHiddenTimetableCourses(2025)]).toEqual([])
    expect(() => saveHiddenTimetableCourses(2025, new Set(['A']))).not.toThrow()
  })
})
