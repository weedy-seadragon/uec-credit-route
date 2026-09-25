// 時間割プレビューが、曜日時限を断定できる科目だけを配置することを確かめる。
import { describe, expect, it } from 'vitest'
import { buildTimetablePreview } from './timetablePreview'

describe('buildTimetablePreview（修得見込の時間割）', () => {
  // 複数コマの授業は両方のコマへ表示し、別の開講期の授業は混ぜない。
  it('選択した開講期の複数コマだけを配置する', () => {
    const result = buildTimetablePreview([
      { code: 'A', name: '実験', termType: '前学期', offeredTerms: ['前学期'], options: [
        { term: '前学期', slots: [{ day: '月', period: 1 }, { day: '月', period: 2 }] },
      ] },
      { code: 'B', name: '後期科目', termType: '後学期', offeredTerms: ['後学期'], options: [
        { term: '後学期', slots: [{ day: '月', period: 1 }] },
      ] },
    ], '前学期')
    expect(result.slots).toEqual([
      { code: 'A', name: '実験', day: '月', period: 1 },
      { code: 'A', name: '実験', day: '月', period: 2 },
    ])
    expect(result.unplaced).toEqual([])
  })

  // 同時限の別セクションは、候補の並び順が違っても1科目として扱う。
  it('同じ時限の複数クラス候補を一度だけ配置する', () => {
    const result = buildTimetablePreview([{ code: 'A', name: '英語', termType: null, offeredTerms: ['前学期'], options: [
      { term: '前学期', slots: [{ day: '火', period: 2 }, { day: '木', period: 2 }] },
      { term: '前学期', slots: [{ day: '木', period: 2 }, { day: '火', period: 2 }] },
    ] }], '前学期')
    expect(result.slots).toHaveLength(2)
    expect(result.unplaced).toEqual([])
  })

  // クラス候補が分かれるか時限が欠ける場合は、グリッドへ誤配置しない。
  it('時限を決められない科目を欄外へ分ける', () => {
    const result = buildTimetablePreview([
      { code: 'A', name: '英語', termType: null, offeredTerms: ['前学期'], options: [
        { term: '前学期', slots: [{ day: '月', period: 1 }] },
        { term: '前学期', slots: [{ day: '火', period: 1 }] },
      ] },
      { code: 'B', name: 'クラス不明', termType: '前学期', offeredTerms: ['前学期'], options: [] },
      { code: 'C', name: '時限なし', termType: '前学期', offeredTerms: ['前学期'], options: [
        { term: '前学期', slots: [] },
      ] },
    ], '前学期')
    expect(result.slots).toEqual([])
    expect(result.unplaced.map((course) => course.code)).toEqual(['A', 'B', 'C'])
  })

  // シラバスがない科目は、分かっている学期を使って未確定として残す。
  it('開講情報がない科目は学修要覧の学期で絞る', () => {
    const courses = [
      { code: 'A', name: '前期', termType: '前学期', offeredTerms: [], options: [] },
      { code: 'B', name: '学期不明', termType: null, offeredTerms: [], options: [] },
    ]
    expect(buildTimetablePreview(courses, '後学期').unplaced.map((course) => course.code)).toEqual(['B'])
  })

  // 同時限を取る2科目は両方出し、表示側で重複を見えるようにする。
  it('重複した科目をどちらも配置する', () => {
    const result = buildTimetablePreview(['A', 'B'].map((code) => ({
      code, name: code, termType: '前学期', offeredTerms: ['前学期'],
      options: [{ term: '前学期', slots: [{ day: '金', period: 3 }] }],
    })), '前学期')
    expect(result.slots.map((slot) => slot.code)).toEqual(['A', 'B'])
  })
})
