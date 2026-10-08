// 時間割プレビューの「受ける時期」の上書きを、履修記録とは別のキーで安全に保存することを確かめる。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTimetablePlacementOverrides, saveTimetablePlacementOverrides } from './timetablePlacementOverrides'

// テストで差し替えた window を後続のテストへ残さない。
afterEach(() => {
  vi.unstubAllGlobals()
})

// 保存・復元と、壊れた値・ストレージ故障時の扱いを検証する。
describe('時間割の受ける時期の上書き', () => {
  // 保存した上書きを、年度共通のキーから同じ形で復元できる。
  it('科目番号ごとの時期を保存・復元する', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    } })
    saveTimetablePlacementOverrides({ A: '3:前学期' })
    expect(values.get('uec-credit-route:timetablePlacementOverrides')).toBe('{"A":"3:前学期"}')
    expect(loadTimetablePlacementOverrides()).toEqual({ A: '3:前学期' })
  })

  // 文字列でない値や配列は、利用者が書き換えた壊れた値として読み飛ばす。
  it('壊れた値を無視する', () => {
    const values = new Map<string, string>([['uec-credit-route:timetablePlacementOverrides', '{"A":3,"B":"4:後学期","C":""}']])
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: () => {} } })
    expect(loadTimetablePlacementOverrides()).toEqual({ B: '4:後学期' })
  })

  // localStorage へアクセスできなくても、自動の時期で表示を続けられる。
  it('読み書きの例外を画面へ伝播させない', () => {
    vi.stubGlobal('window', { localStorage: {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    } })
    expect(loadTimetablePlacementOverrides()).toEqual({})
    expect(() => saveTimetablePlacementOverrides({ A: '3:前学期' })).not.toThrow()
  })
})
