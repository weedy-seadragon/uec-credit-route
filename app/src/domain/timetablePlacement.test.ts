// timetablePlacement.ts の、修得見込科目を学年・学期へ振り分ける処理のテスト。
import { describe, expect, it } from 'vitest'
import {
  autoTimetablePlacement,
  coursesForPreviewPeriod,
  findScheduleConflictsByPlacement,
  lastPreviewYear,
  placementHalves,
  previewPeriodsFrom,
  resolveTimetablePlacement,
  timetablePlacementChoices,
  timetablePlacementKey,
} from './timetablePlacement'
import type { PreviewPeriod, TimetablePlacementInput } from './timetablePlacement'

/** テスト用の科目を、必要な項目だけ指定して作る。 */
function course(overrides: Partial<TimetablePlacementInput> = {}): TimetablePlacementInput {
  return { standardYear: 1, termType: '前学期', offeredTerms: ['前学期'], options: [{ term: '前学期' }], ...overrides }
}

const NOW_2_LATE: PreviewPeriod = { year: 2, half: '後学期' }

// プレビューで選べる時期（タブ）の並びを検証する。
describe('previewPeriodsFrom', () => {
  // 2年後学期なら、終わった2年前学期は出さず、4年後学期まで順に並ぶ。
  it('現在の学期から4年後学期までを並べる', () => {
    expect(previewPeriodsFrom(NOW_2_LATE).map(timetablePlacementKey)).toEqual([
      '2:後学期', '3:前学期', '3:後学期', '4:前学期', '4:後学期',
    ])
  })

  // 5年目に回る科目がある場合は、指定した学年まで広げる。
  it('最終学年を広げられる', () => {
    expect(previewPeriodsFrom({ year: 4, half: '後学期' }, 5).map(timetablePlacementKey)).toEqual(['4:後学期', '5:前学期', '5:後学期'])
  })
})

// 科目を置ける学期の判定を検証する。
describe('placementHalves', () => {
  // 通年科目は学期を決めず、両学期に出す。
  it('通年科目はnull', () => {
    expect(placementHalves(course({ note: '通年' }))).toBeNull()
  })

  // 夏タームは前学期に含める。
  it('タームは学期にまとめる', () => {
    expect(placementHalves(course({ options: [{ term: '夏ﾀｰﾑ' }] }))).toEqual(['前学期'])
  })

  // 選んだセクションがあれば、他の学期の候補があってもその学期だけになる。
  it('選んだセクションの学期を優先する', () => {
    const both = course({ options: [{ term: '前学期', timetableCode: 'A' }, { term: '後学期', timetableCode: 'B' }] })
    expect(placementHalves(both, 'B')).toEqual(['後学期'])
  })

  // シラバスの開講情報が無ければ、学修要覧の学期に置く。
  it('開講情報が無ければ学修要覧の学期', () => {
    expect(placementHalves(course({ termType: '後学期', offeredTerms: [], options: [] }))).toEqual(['後学期'])
  })
})

// 自動で決まる置き場所を検証する。
describe('autoTimetablePlacement', () => {
  // 標準年次がこれから来る科目は、標準年次・学修要覧の学期に置く。
  it('将来の科目は標準年次の学期', () => {
    expect(autoTimetablePlacement(course({ standardYear: 3 }), NOW_2_LATE)).toEqual({ year: 3, half: '前学期' })
  })

  // 1年前学期の科目を2年後学期から取るなら、次に前学期が来る3年前学期になる。
  it('過ぎた前学期の科目は次の前学期', () => {
    expect(autoTimetablePlacement(course(), NOW_2_LATE)).toEqual({ year: 3, half: '前学期' })
  })

  // 後学期にも再履修枠がある科目は、今の後学期で取れる。
  it('今の学期に開講があれば今の学期', () => {
    const withRetake = course({ options: [{ term: '前学期' }, { term: '後学期' }] })
    expect(autoTimetablePlacement(withRetake, NOW_2_LATE)).toEqual({ year: 2, half: '後学期' })
  })

  // 同じ学年の後学期の科目は、今がその後学期ならそのまま。
  it('今の学期の科目はそのまま', () => {
    const late = course({ standardYear: 2, termType: '後学期', offeredTerms: ['後学期'], options: [{ term: '後学期' }] })
    expect(autoTimetablePlacement(late, NOW_2_LATE)).toEqual({ year: 2, half: '後学期' })
  })

  // 標準年次が無い科目は、現在の学年として扱う。
  it('標準年次が無ければ現在の学年', () => {
    expect(autoTimetablePlacement(course({ standardYear: null, termType: '後学期', options: [{ term: '後学期' }] }), NOW_2_LATE)).toEqual({ year: 2, half: '後学期' })
  })

  // 標準年次を過ぎた通年科目は、現在の学年に置く。
  it('過ぎた通年科目は現在の学年', () => {
    expect(autoTimetablePlacement(course({ note: '通年' }), NOW_2_LATE)).toEqual({ year: 2, half: null })
  })

  // 4年後学期に前学期の科目を取り残すと、5年前学期に回る。
  it('4年後学期からは5年目へ回る', () => {
    expect(autoTimetablePlacement(course(), { year: 4, half: '後学期' })).toEqual({ year: 5, half: '前学期' })
  })
})

// 利用者が選べる時期と、上書きの適用を検証する。
describe('timetablePlacementChoices / resolveTimetablePlacement', () => {
  // 前学期だけの科目は、現在以降の前学期だけを選べる。
  it('開講学期だけを選べる', () => {
    expect(timetablePlacementChoices(course(), NOW_2_LATE).map(timetablePlacementKey)).toEqual(['3:前学期', '4:前学期'])
  })

  // 通年科目は学年だけを選ぶ。
  it('通年科目は学年だけ', () => {
    expect(timetablePlacementChoices(course({ note: '通年' }), NOW_2_LATE).map(timetablePlacementKey)).toEqual(['2:通年', '3:通年', '4:通年'])
  })

  // 選べる時期の上書きは、そのまま採用される（再履修を1年遅らせる場合など）。
  it('有効な上書きを使う', () => {
    expect(resolveTimetablePlacement(course(), NOW_2_LATE, '4:前学期')).toEqual({ year: 4, half: '前学期' })
  })

  // 開講しない学期や過ぎた学期の上書きは無視し、自動の時期に戻す。
  it('無効な上書きは自動に戻す', () => {
    expect(resolveTimetablePlacement(course(), NOW_2_LATE, '3:後学期')).toEqual({ year: 3, half: '前学期' })
    expect(resolveTimetablePlacement(course(), NOW_2_LATE, '1:前学期')).toEqual({ year: 3, half: '前学期' })
  })
})

// 表示中の時期に出す科目の絞り込みを検証する。
describe('coursesForPreviewPeriod', () => {
  // 3年前学期の画面には、3年前学期に置かれた科目と3年の通年科目だけが出る。
  it('学年・学期で絞り込む', () => {
    const courses = [
      { code: 'A', ...course({ standardYear: 3 }) },
      { code: 'B', ...course({ standardYear: 3, note: '通年' }) },
      { code: 'C', ...course({ standardYear: 4 }) },
    ]
    expect(coursesForPreviewPeriod(courses, { year: 3, half: '前学期' }, NOW_2_LATE, {}, {}).map((c) => c.code)).toEqual(['A', 'B'])
  })

  // 上書きした科目は、上書き先の時期だけに出る。
  it('上書きを反映する', () => {
    const courses = [{ code: 'A', ...course({ standardYear: 3 }) }]
    expect(coursesForPreviewPeriod(courses, { year: 3, half: '前学期' }, NOW_2_LATE, { A: '4:前学期' }, {})).toEqual([])
    expect(coursesForPreviewPeriod(courses, { year: 4, half: '前学期' }, NOW_2_LATE, { A: '4:前学期' }, {})).toHaveLength(1)
  })
})

// タブを出す最終学年を検証する。
describe('lastPreviewYear', () => {
  // 4年までに収まれば4、5年目の科目があれば5。
  it('最低4年、必要なら延ばす', () => {
    expect(lastPreviewYear([{ year: 2, half: '前学期' }])).toBe(4)
    expect(lastPreviewYear([{ year: 5, half: '前学期' }])).toBe(5)
  })
})

// 学年ごとに分けた重複判定を検証する。
describe('findScheduleConflictsByPlacement', () => {
  const monday1 = [{ term: '前学期', slots: [{ day: '月', period: 1 }] }]

  // 同じ学年・学期で同じコマなら重複になる。
  it('同じ学年なら重複', () => {
    const conflicts = findScheduleConflictsByPlacement(
      [{ code: 'A', options: monday1 }, { code: 'B', options: monday1 }],
      () => ({ year: 2, half: '前学期' }),
    )
    expect(conflicts).toEqual([{ firstCode: 'A', secondCode: 'B' }])
  })

  // 受ける学年が違えば、同じ曜日時限でも重複にしない。
  it('学年が違えば重複しない', () => {
    const conflicts = findScheduleConflictsByPlacement(
      [{ code: 'A', options: monday1 }, { code: 'B', options: monday1 }],
      (code) => ({ year: code === 'A' ? 1 : 3, half: '前学期' }),
    )
    expect(conflicts).toEqual([])
  })

  // 置き場所の学期に無いセクションは比べない（後学期の再履修枠を選んだ科目など）。
  it('置き場所の学期のセクションだけ比べる', () => {
    const both = [...monday1, { term: '後学期', slots: [{ day: '火', period: 2 }] }]
    const conflicts = findScheduleConflictsByPlacement(
      [{ code: 'A', options: monday1 }, { code: 'B', options: both }],
      (code) => ({ year: 2, half: code === 'A' ? '前学期' : '後学期' }),
    )
    expect(conflicts).toEqual([])
  })
})
