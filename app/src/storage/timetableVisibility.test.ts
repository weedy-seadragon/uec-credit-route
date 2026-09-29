// 表示の好みだけを、履修記録とは別の localStorage キーで安全に保存することを確かめる。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadHiddenTimetableCourses, saveHiddenTimetableCourses } from './timetableVisibility'

// テストで差し替えた window を後続のテストへ残さない。
afterEach(() => {
  vi.unstubAllGlobals()
})

// 年度共通の復元と、ストレージ故障時の扱いを検証する。
describe('時間割の非表示設定', () => {
  // キーを年度で分けないため、保存した設定を共通キーから復元できる。
  it('非表示科目を年度共通のキーへ保存する', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    } })
    saveHiddenTimetableCourses(new Set(['A']))
    expect(values.get('uec-credit-route:timetableHiddenCourses')).toBe('["A"]')
    expect([...loadHiddenTimetableCourses()]).toEqual(['A'])
  })

  // localStorage へアクセスできなくても、表示は初期値から続けられる。
  it('読み書きの例外を画面へ伝播させない', () => {
    vi.stubGlobal('window', { localStorage: {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    } })
    expect([...loadHiddenTimetableCourses()]).toEqual([])
    expect(() => saveHiddenTimetableCourses(new Set(['A']))).not.toThrow()
  })
})
