// 時間割プレビューが、曜日時限を断定できる科目だけを配置することを確かめる。
import { describe, expect, it } from 'vitest'
import { buildTimetablePreview } from './timetablePreview'

// 学期の選別、クラス候補の確定、欄外表示の理由をまとめて検証する。
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
      { code: 'A', name: '実験', day: '月', period: 1, offeringTerm: '前学期' },
      { code: 'A', name: '実験', day: '月', period: 2, offeringTerm: '前学期' },
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
    expect(result.unplaced).toEqual([
      { code: 'A', name: '英語', reason: 'ambiguous-slot' },
      { code: 'B', name: 'クラス不明', reason: 'no-class' },
      { code: 'C', name: '時限なし', reason: 'no-slot' },
    ])
  })

  // シラバスがない科目は、分かっている学期を使って未確定として残す。
  it('開講情報がない科目は学修要覧の学期で絞る', () => {
    const courses = [
      { code: 'A', name: '前期', termType: '前学期', offeredTerms: [], options: [] },
      { code: 'B', name: '学期不明', termType: null, offeredTerms: [], options: [] },
    ]
    expect(buildTimetablePreview(courses, '後学期').unplaced.map((course) => course.code)).toEqual(['B'])
    expect(buildTimetablePreview(courses, '後学期').unplaced[0].reason).toBe('no-offering')
  })

  // ターム開講でも対応する前後学期へ出し、シラバスと科目表が食い違えば前者を優先する。
  it('春夏・秋冬タームを前後学期へ含め、元のターム名を保持する', () => {
    const courses = [
      { code: 'CHM101z', name: '基礎科学実験B1', termType: '前学期', offeredTerms: ['春ﾀｰﾑ'], options: [
        { term: '春ﾀｰﾑ', slots: [{ day: '月', period: 3 }] },
      ] },
      { code: 'CAR201z', name: '夏の科目', termType: '後学期', offeredTerms: ['夏ﾀｰﾑ'], options: [
        { term: '夏ﾀｰﾑ', slots: [{ day: '火', period: 2 }] },
      ] },
      { code: 'C', name: '冬の科目', termType: '後学期', offeredTerms: ['冬ﾀｰﾑ'], options: [
        { term: '冬ﾀｰﾑ', slots: [{ day: '金', period: 4 }] },
      ] },
    ]
    expect(buildTimetablePreview(courses, '前学期').slots.map((slot) => [slot.code, slot.offeringTerm]))
      .toEqual([['CHM101z', '春ﾀｰﾑ'], ['CAR201z', '夏ﾀｰﾑ']])
    expect(buildTimetablePreview(courses, '後学期').slots.map((slot) => slot.code)).toEqual(['C'])
  })

  // 春と夏の両方に候補が残るなら、同時限でも実際の開講期間は決められない。
  it('複数タームの候補が残る科目は欄外へ分ける', () => {
    const result = buildTimetablePreview([{ code: 'A', name: '実験', termType: '前学期',
      offeredTerms: ['春ﾀｰﾑ', '夏ﾀｰﾑ'], options: [
        { term: '春ﾀｰﾑ', slots: [{ day: '水', period: 1 }] },
        { term: '夏ﾀｰﾑ', slots: [{ day: '水', period: 1 }] },
      ],
    }], '前学期')
    expect(result.slots).toEqual([])
    expect(result.unplaced).toEqual([{ code: 'A', name: '実験', reason: 'ambiguous-term' }])
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
