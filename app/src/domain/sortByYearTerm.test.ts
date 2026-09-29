// メイン画面と時間割設定欄で共用する学年・学期順の並び替えを検証する。
import { describe, expect, it } from 'vitest'
import { sortByYearTerm } from './sortByYearTerm'

// 学年・学期を先に揃え、同じ区分では曜日時限、年次不明は最後にする。
describe('sortByYearTerm（学年・学期順の並べ替え）', () => {
  it('学年学期・曜日時限の順に並べ、標準年次のない科目を最後にする', () => {
    const items = [
      { code: 'later', label: '1年前期の遅いコマ' },
      { code: 'unknown', label: '年次なし' },
      { code: 'second', label: '1年後期' },
      { code: 'earlier', label: '1年前期の早いコマ' },
    ]
    const yearByCode: Record<string, number | null> = { later: 1, unknown: null, second: 1, earlier: 1 }
    const termByCode: Record<string, string | null> = { later: '前学期', unknown: null, second: '後学期', earlier: '前学期' }
    const slotByCode: Record<string, number> = { later: 203, unknown: Number.POSITIVE_INFINITY, second: 101, earlier: 102 }

    const sorted = sortByYearTerm(
      items,
      (item) => item.code,
      (code) => yearByCode[code],
      (code) => termByCode[code],
      (code) => slotByCode[code],
    )
    expect(sorted.map((item) => item.code)).toEqual(['earlier', 'later', 'second', 'unknown'])
  })
})
