// scheduleConflicts.ts の単体テスト。修得予定の候補時限から、期間を考慮した重複を判定する。
import { describe, expect, it } from 'vitest'
import { getSubjectsByCode } from '../data/requirementSets'
import { findUnavoidableScheduleConflicts } from './scheduleConflicts'

// 選べる開講候補を含め、避けられない重複だけを警告する分類。
describe('findUnavoidableScheduleConflicts（修得予定の時限重複判定）', () => {
  // 同じ学期に同じコマしか候補がないため、別の受講方法を選べず警告する。
  it('同じ学期・同じ曜日時限しか候補がない2科目は警告する', () => {
    const result = findUnavoidableScheduleConflicts([
      { code: 'A', options: [{ term: '前学期', slots: [{ day: '月', period: 1 }] }] },
      { code: 'B', options: [{ term: '前学期', slots: [{ day: '月', period: 1 }] }] },
    ])
    expect(result).toEqual([{ firstCode: 'A', secondCode: 'B' }])
  })

  // 英語演習のように重ならない候補を1つ選べるときは、必ず重なるとは言えない。
  it('重ならない候補を1つでも選べるなら警告しない', () => {
    const result = findUnavoidableScheduleConflicts([
      { code: 'ENG', options: [{ term: '前学期', slots: [{ day: '月', period: 1 }] }, { term: '前学期', slots: [{ day: '火', period: 1 }] }] },
      { code: 'A', options: [{ term: '前学期', slots: [{ day: '月', period: 1 }] }] },
    ])
    expect(result).toEqual([])
  })

  // 前学期は春タームを含むため、両方の曜日時限が同じなら同時期の重複になる。
  it('前学期と春タームの同時限を警告する', () => {
    const result = findUnavoidableScheduleConflicts([
      { code: 'SEMESTER', options: [{ term: '前学期', slots: [{ day: '月', period: 3 }] }] },
      { code: 'SPRING', options: [{ term: '春ﾀｰﾑ', slots: [{ day: '月', period: 3 }] }] },
    ])
    expect(result).toEqual([{ firstCode: 'SEMESTER', secondCode: 'SPRING' }])
  })

  // 春と夏は別々の期間なので、同じコマでも同時に受講することはない。
  it('春タームと夏タームの同時限は警告しない', () => {
    const result = findUnavoidableScheduleConflicts([
      { code: 'SPRING', options: [{ term: '春ﾀｰﾑ', slots: [{ day: '月', period: 3 }] }] },
      { code: 'SUMMER', options: [{ term: '夏ﾀｰﾑ', slots: [{ day: '月', period: 3 }] }] },
    ])
    expect(result).toEqual([])
  })

  // 後学期は冬タームを含むため、両方の曜日時限が同じなら同時期の重複になる。
  it('後学期と冬タームの同時限を警告する', () => {
    const result = findUnavoidableScheduleConflicts([
      { code: 'SEMESTER', options: [{ term: '後学期', slots: [{ day: '木', period: 2 }] }] },
      { code: 'WINTER', options: [{ term: '冬ﾀｰﾑ', slots: [{ day: '木', period: 2 }] }] },
    ])
    expect(result).toEqual([{ firstCode: 'SEMESTER', secondCode: 'WINTER' }])
  })

  // 前学期と後学期は開講期間が分かれているため、曜日時限が同じでも警告しない。
  it('前学期と後学期の同時限は警告しない', () => {
    const result = findUnavoidableScheduleConflicts([
      { code: 'FIRST', options: [{ term: '前学期', slots: [{ day: '水', period: 3 }] }] },
      { code: 'SECOND', options: [{ term: '後学期', slots: [{ day: '水', period: 3 }] }] },
    ])
    expect(result).toEqual([])
  })

  // 実データのCOM504fは夏ターム月3・木3なので、同じコマの前学期科目と重複する。
  it('COM504fの夏タームと同時限の前学期科目を警告する', () => {
    const operatingSystems = getSubjectsByCode(2025).get('COM504f')
    const offering = operatingSystems?.offerings?.[0]
    expect(offering).toMatchObject({ term: '夏ﾀｰﾑ', slots: [{ day: '月', period: 3 }, { day: '木', period: 3 }] })
    if (!offering) throw new Error('COM504fのシラバス開講情報が見つかりません')
    const result = findUnavoidableScheduleConflicts([
      { code: 'COM504f', options: [{ term: offering.term, slots: offering.slots }] },
      { code: 'OTHER', options: [{ term: '前学期', slots: [{ day: '月', period: 3 }] }] },
    ])
    expect(result).toEqual([{ firstCode: 'COM504f', secondCode: 'OTHER' }])
  })

  // 実習の複数コマのうち、1つでも重なると同じ時間に別科目を受けられない。
  it('複数コマで実施する科目は、どれか1コマでも重なれば警告する', () => {
    const result = findUnavoidableScheduleConflicts([
      { code: 'LAB', options: [{ term: '後学期', slots: [{ day: '金', period: 1 }, { day: '金', period: 2 }] }] },
      { code: 'A', options: [{ term: '後学期', slots: [{ day: '金', period: 2 }] }] },
    ])
    expect(result).toEqual([{ firstCode: 'LAB', secondCode: 'A' }])
  })
})
