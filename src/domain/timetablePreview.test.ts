// 時間割プレビューが、曜日時限を断定できる科目だけを配置することを確かめる。
import { describe, expect, it } from 'vitest'
import { buildTimetablePreview, buildVisibleTimetablePreview, maxConcurrentOfferingCount, offeringTermsOverlap } from './timetablePreview'

// 学期全体と個別タームの授業が、同じ週に行われるかを検証する。
describe('開講期間の重複判定', () => {
  // 春と夏は交代で開講し、前学期の授業は春の授業と並行する。
  it('春と夏は重複せず、前学期と春は重複する', () => {
    expect(offeringTermsOverlap('春ﾀｰﾑ', '夏ﾀｰﾑ')).toBe(false)
    expect(offeringTermsOverlap('前学期', '春ﾀｰﾑ')).toBe(true)
    expect(offeringTermsOverlap('後学期', '秋ﾀｰﾑ')).toBe(true)
    expect(offeringTermsOverlap('秋ﾀｰﾑ', '冬ﾀｰﾑ')).toBe(false)
  })

  // 春と夏の実験を同じコマに置いても同時に受講するのは1科目だけ。
  it('同じコマに並ぶ科目の同時開講数を数える', () => {
    expect(maxConcurrentOfferingCount(['春ﾀｰﾑ', '夏ﾀｰﾑ'])).toBe(1)
    expect(maxConcurrentOfferingCount(['前学期', '春ﾀｰﾑ'])).toBe(2)
    expect(maxConcurrentOfferingCount(['前学期', '春ﾀｰﾑ', '夏ﾀｰﾑ'])).toBe(2)
  })
})

// 学期の選別、クラス候補の確定、欄外表示の理由をまとめて検証する。
describe('buildTimetablePreview（修得見込の時間割）', () => {
  // 全セクションの時限が空の通常科目だけ、未確定の理由から分けて示す。
  it('オンデマンド科目を専用一覧に分け、集中講義は未確定に残す', () => {
    const result = buildTimetablePreview([
      { code: 'A', name: '通常科目', termType: '前学期', offeredTerms: ['前学期'], offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }] },
      { code: 'B', name: '集中科目', note: '夏期集中', termType: '前学期', offeredTerms: ['前学期'], offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }] },
    ], '前学期')
    expect(result.onDemand).toEqual([{ code: 'A', name: '通常科目' }])
    expect(result.unplaced).toEqual([{ code: 'B', name: '集中科目', reason: 'no-slot' }])
    expect(result.slots).toEqual([])
  })

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

  // 春の物理実験と夏の化学実験は同じ金3限でも別期間に受講する。
  it('春と夏の基礎科学実験を同じコマに置いても重複としない', () => {
    const result = buildTimetablePreview([
      { code: 'PHY101z', name: '基礎科学実験A1', termType: '前学期', offeredTerms: ['春ﾀｰﾑ'], options: [
        { term: '春ﾀｰﾑ', slots: [{ day: '金', period: 3 }] },
      ] },
      { code: 'CHM101z', name: '基礎科学実験B1', termType: '前学期', offeredTerms: ['夏ﾀｰﾑ'], options: [
        { term: '夏ﾀｰﾑ', slots: [{ day: '金', period: 3 }] },
      ] },
    ], '前学期')
    expect(result.slots.map((slot) => slot.code)).toEqual(['PHY101z', 'CHM101z'])
    expect(maxConcurrentOfferingCount(result.slots.map((slot) => slot.offeringTerm))).toBe(1)
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

// 非表示設定がグリッドと同時限の重複判定へ反映されることを検証する。
describe('buildVisibleTimetablePreview（表示する科目の選別）', () => {
  // 同時限の片方を隠すと、残る科目だけになり重複数が1へ減る。
  it('片方を非表示にすると同時限の重複が消える', () => {
    const courses = ['A', 'B'].map((code) => ({
      code, name: code, termType: '前学期', offeredTerms: ['前学期'],
      options: [{ term: '前学期', slots: [{ day: '金', period: 3 }] }],
    }))
    const all = buildVisibleTimetablePreview(courses, '前学期', new Set())
    const visible = buildVisibleTimetablePreview(courses, '前学期', new Set(['B']))
    expect(maxConcurrentOfferingCount(all.slots.map((slot) => slot.offeringTerm))).toBe(2)
    expect(visible.slots.map((slot) => slot.code)).toEqual(['A'])
    expect(maxConcurrentOfferingCount(visible.slots.map((slot) => slot.offeringTerm))).toBe(1)
  })
})
