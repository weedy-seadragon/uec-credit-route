// scheduleConflicts.ts の単体テスト。修得予定の候補時限から、誤警告を出さずに確定した重複だけを見つける。
import { describe, expect, it } from 'vitest'
import { findUnavoidableScheduleConflicts } from './scheduleConflicts'

describe('findUnavoidableScheduleConflicts（修得予定の時限重複判定）', () => {
  it('同じ学期・同じ曜日時限しか候補がない2科目は、両立できないため警告する', () => {
    const result = findUnavoidableScheduleConflicts([
      { code: 'A', options: [{ term: '前学期', slots: [{ day: '月', period: 1 }] }] },
      { code: 'B', options: [{ term: '前学期', slots: [{ day: '月', period: 1 }] }] },
    ])
    expect(result).toEqual([{ firstCode: 'A', secondCode: 'B' }])
  })

  it('英語のように重ならない候補を1つでも選べるなら、警告しない', () => {
    const result = findUnavoidableScheduleConflicts([
      { code: 'ENG', options: [{ term: '前学期', slots: [{ day: '月', period: 1 }] }, { term: '前学期', slots: [{ day: '火', period: 1 }] }] },
      { code: 'A', options: [{ term: '前学期', slots: [{ day: '月', period: 1 }] }] },
    ])
    expect(result).toEqual([])
  })

  it('同じ曜日時限でも開講学期が異なれば同時に受講しないため、警告しない', () => {
    const result = findUnavoidableScheduleConflicts([
      { code: 'A', options: [{ term: '前学期', slots: [{ day: '水', period: 3 }] }] },
      { code: 'B', options: [{ term: '後学期', slots: [{ day: '水', period: 3 }] }] },
    ])
    expect(result).toEqual([])
  })

  it('複数コマで実施する科目は、どれか1コマでも重なれば両立不可として警告する', () => {
    const result = findUnavoidableScheduleConflicts([
      { code: 'LAB', options: [{ term: '後学期', slots: [{ day: '金', period: 1 }, { day: '金', period: 2 }] }] },
      { code: 'A', options: [{ term: '後学期', slots: [{ day: '金', period: 2 }] }] },
    ])
    expect(result).toEqual([{ firstCode: 'LAB', secondCode: 'A' }])
  })
})
