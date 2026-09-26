// 時間割プレビューが、曜日時限を断定できる科目だけを配置することを確かめる。
import { describe, expect, it } from 'vitest'
import { buildTimetablePreview, buildVisibleTimetablePreview, maxConcurrentOfferingCount, offeringTermsOverlap, splitUnplacedTimetableCourses, timetableCategoryForCourse, timetableLegendForSlots } from './timetablePreview'

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
  // 時限の無い科目をオンデマンド・集中講義・未確定へ分類して混同しない。
  it('オンデマンドと集中講義を専用一覧へ分け、研究系科目は未確定に残す', () => {
    const result = buildTimetablePreview([
      { code: 'A', name: '通常科目', termType: '前学期', offeredTerms: ['前学期'], offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }] },
      { code: 'B', name: '集中科目', note: '夏期集中', termType: '前学期', offeredTerms: ['前学期'], offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }] },
      { code: 'C', name: '集中科目2', note: '冬期集中', termType: '前学期', offeredTerms: ['前学期'], offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }] },
      { code: 'D', name: 'その他集中', note: '隔年集中開講', termType: '前学期', offeredTerms: ['前学期'], offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }] },
      { code: 'E', name: '輪講A', termType: '前学期', offeredTerms: ['前学期'], offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }] },
    ], '前学期')
    expect(result.onDemand).toEqual([{ code: 'A', name: '通常科目' }])
    expect(result.intensive).toEqual([
      { code: 'B', name: '集中科目', kind: 'summer-intensive' },
      { code: 'C', name: '集中科目2', kind: 'winter-intensive' },
      { code: 'D', name: 'その他集中', kind: 'intensive' },
    ])
    expect(result.unplaced).toEqual([{ code: 'E', name: '輪講A', reason: 'lab' }])
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
    expect(result.unplaced.map(({ code, name, reason }) => ({ code, name, reason }))).toEqual([
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

  // 通年注記のある時限未確定科目は両学期に表示し、注記の無い前学期科目は後学期に出さない。
  it('通年注記を両学期に含め、欄外理由をそろえる', () => {
    const courses = [
      { code: 'A', name: '情報工学工房A', termType: '前学期', offeredTerms: ['前学期'], note: '通年１〜４年次開講',
        offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }] },
      { code: 'B', name: '輪講A', termType: '前学期', offeredTerms: ['前学期'],
        offerings: [{ slots: [] }], options: [] },
    ]
    expect(buildTimetablePreview(courses, '前学期').unplaced).toEqual([
      { code: 'A', name: '情報工学工房A', reason: 'instructor-dependent' },
      { code: 'B', name: '輪講A', reason: 'lab' },
    ])
    expect(buildTimetablePreview(courses, '後学期').unplaced).toEqual([
      { code: 'A', name: '情報工学工房A', reason: 'instructor-dependent' },
    ])
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
    expect(result.unplaced.map(({ code, name, reason }) => ({ code, name, reason }))).toEqual([{ code: 'A', name: '実験', reason: 'ambiguous-term' }])
  })

  // 低学年科目の候補が同時限なら配置し、保存済み選択があればその候補を使う。
  it('低学年の候補が同じ曜日時限なら自動配置し、保存値を優先する', () => {
    const course = {
      code: 'A', name: '低学年科目', termType: '前学期', offeredTerms: ['春ﾀｰﾑ', '夏ﾀｰﾑ'], chooseAmongSections: true,
      options: [
        { term: '春ﾀｰﾑ', timetableCode: 'A-spring', teacher: '教員甲', slots: [{ day: '月', period: 1 }] },
        { term: '夏ﾀｰﾑ', timetableCode: 'A-summer', teacher: '教員乙', slots: [{ day: '月', period: 1 }] },
      ],
    }
    const automatic = buildTimetablePreview([course], '前学期')
    expect(automatic.slots.map((slot) => slot.offeringTerm)).toEqual(['春ﾀｰﾑ'])
    expect(automatic.unplaced).toEqual([])

    const saved = buildTimetablePreview([course], '前学期', { A: 'A-summer' })
    expect(saved.slots.map((slot) => slot.offeringTerm)).toEqual(['夏ﾀｰﾑ'])
    expect(saved.unplaced).toEqual([])
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

// 未配置の理由から、候補選択が必要な科目と時限自体が未確定の科目を分ける。
describe('splitUnplacedTimetableCourses（欄外科目の分類）', () => {
  it('英語演習は候補選択へ、輪講と情報工学工房は時限未確定へ分ける', () => {
    const result = buildTimetablePreview([
      { code: 'ENG', name: '英語演習', termType: '前学期', offeredTerms: ['前学期'], options: [
        { term: '前学期', slots: [{ day: '月', period: 1 }] },
        { term: '前学期', slots: [{ day: '火', period: 1 }] },
      ] },
      { code: 'LOW', name: '低学年科目', termType: '前学期', offeredTerms: ['前学期'], chooseAmongSections: true, options: [
        { term: '前学期', slots: [{ day: '水', period: 1 }] },
        { term: '前学期', slots: [{ day: '木', period: 1 }] },
      ] },
      { code: 'LAB', name: '輪講A', termType: '前学期', offeredTerms: ['前学期'], offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }] },
      { code: 'WORK', name: '情報工学工房A', termType: '前学期', offeredTerms: ['前学期'], offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }] },
      { code: 'MISSING', name: '開講情報なし', termType: '前学期', offeredTerms: [], options: [] },
    ], '前学期')
    const groups = splitUnplacedTimetableCourses(result.unplaced)
    expect(groups.selectable.map((course) => [course.code, course.reason])).toEqual([
      ['ENG', 'ambiguous-slot'],
      ['LOW', 'lower-year-selection'],
    ])
    expect(groups.timeless.map((course) => [course.code, course.reason])).toEqual([
      ['LAB', 'lab'],
      ['WORK', 'instructor-dependent'],
      ['MISSING', 'no-offering'],
    ])
  })

  // no-classでも候補が0件なら、選べない枠ではなく時限未確定へ移す。
  it('選択候補が0件のno-class科目を時限未確定へ分ける', () => {
    const unplaced = buildTimetablePreview([{
      code: 'NO-OPTIONS', name: '候補なし', termType: '前学期', offeredTerms: ['前学期'], options: [],
    }], '前学期').unplaced
    const groups = splitUnplacedTimetableCourses(unplaced)
    expect(groups.selectable).toEqual([])
    expect(groups.timeless).toEqual([{ code: 'NO-OPTIONS', name: '候補なし', reason: 'no-class' }])
  })
})

// メイン画面から渡された要件区分をカードの色と凡例に使うことを確かめる。
describe('時間割カードの科目区分', () => {
  it('必修は必修表示を優先し、選択科目は所属区分と要件データ順を持つ', () => {
    const groups = [
      { id: 'required-group', name: '必修区分', kind: 'required', subjects: ['REQ'] },
      { id: 'humanities', name: '人文・社会', label: '人文・社会', kind: 'elective', subjects: ['REQ', 'HUM'] },
      { id: 'advanced', name: '上級科目', kind: 'elective', subjects: ['ADV'] },
    ]
    expect(timetableCategoryForCourse('REQ', new Set(['REQ']), groups)).toEqual({
      key: 'required', label: '必修', isRequired: true, orderIndex: -1,
    })
    expect(timetableCategoryForCourse('HUM', new Set(), groups)).toEqual({
      key: 'humanities', label: '人文・社会', isRequired: false, orderIndex: 0,
    })
    expect(timetableCategoryForCourse('ADV', new Set(), groups).orderIndex).toBe(1)
  })

  it('凡例には指定した学期のコマに現れる区分だけを一度ずつ並べる', () => {
    const courses = [
      { code: 'REQ', name: '必修科目', category: { key: 'required', label: '必修', isRequired: true, orderIndex: -1 }, termType: '前学期', offeredTerms: ['前学期'], options: [{ term: '前学期', slots: [{ day: '月', period: 1 }] }] },
      { code: 'HUM', name: '人文科目', category: { key: 'humanities', label: '人文・社会', isRequired: false, orderIndex: 0 }, termType: '前学期', offeredTerms: ['前学期'], options: [{ term: '前学期', slots: [{ day: '火', period: 2 }] }] },
      { code: 'ADV', name: '後期科目', category: { key: 'advanced', label: '上級科目', isRequired: false, orderIndex: 1 }, termType: '後学期', offeredTerms: ['後学期'], options: [{ term: '後学期', slots: [{ day: '水', period: 3 }] }] },
    ]
    const frontSlots = buildTimetablePreview(courses, '前学期').slots
    expect(timetableLegendForSlots(frontSlots)).toEqual([
      { key: 'required', label: '必修', isRequired: true, orderIndex: -1 },
      { key: 'humanities', label: '人文・社会', isRequired: false, orderIndex: 0, colorIndex: 0 },
    ])
  })

  // 全体で9番目の区分も、同じ画面に並ぶ最初の区分とは別の色を使う。
  it('要件データ全体で8番目以降の区分も表示中の区分ごとに色を割り当てる', () => {
    const groups = Array.from({ length: 9 }, (_, index) => ({
      id: `group-${index}`, name: `区分${index}`, kind: 'elective', subjects: [`COURSE-${index}`],
    }))
    const slots = [0, 8].map((index) => ({
      code: `COURSE-${index}`,
      name: `科目${index}`,
      day: '月',
      period: index + 1,
      offeringTerm: '前学期',
      category: timetableCategoryForCourse(`COURSE-${index}`, new Set(), groups),
    }))
    expect(timetableLegendForSlots(slots).map(({ key, colorIndex }) => [key, colorIndex])).toEqual([
      ['group-0', 0],
      ['group-8', 1],
    ])
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

  // 選択した曖昧なセクションだけが表へ入り、ほかの科目との重複も判定できる。
  it('選んだ候補を配置し、同時限の重複判定へ含める', () => {
    const courses = [
      { code: 'A', name: '候補科目', termType: '前学期', offeredTerms: ['前学期'], options: [
        { term: '前学期', timetableCode: 'A-1', teacher: '教員甲', slots: [{ day: '月', period: 1 }] },
        { term: '前学期', timetableCode: 'A-2', teacher: '教員乙', slots: [{ day: '火', period: 1 }] },
      ] },
      { code: 'B', name: '別科目', termType: '前学期', offeredTerms: ['前学期'], options: [
        { term: '前学期', timetableCode: 'B-1', slots: [{ day: '月', period: 1 }] },
      ] },
    ]
    const result = buildTimetablePreview(courses, '前学期', { A: 'A-1' })
    expect(result.slots.map((slot) => slot.code)).toEqual(['A', 'B'])
    expect(result.unplaced).toEqual([])
    expect(maxConcurrentOfferingCount(result.slots.filter((slot) => slot.day === '月').map((slot) => slot.offeringTerm))).toBe(2)
  })

  // 現行候補にない保存済みコードは選択済みと扱わず、科目を欄外に残す。
  it('不正または古いセクションコードは未選択として扱う', () => {
    const result = buildTimetablePreview([{
      code: 'A', name: '候補科目', termType: '前学期', offeredTerms: ['前学期'], options: [
        { term: '前学期', timetableCode: 'A-current', slots: [{ day: '月', period: 1 }] },
        { term: '前学期', timetableCode: 'A-other', slots: [{ day: '火', period: 1 }] },
      ],
    }], '前学期', { A: 'removed-section' })
    expect(result.slots).toEqual([])
    expect(result.unplaced[0].reason).toBe('ambiguous-slot')
  })

  // クラスが決まらない科目は、選択学期の全セクションから選べる。
  it('no-class の科目は全セクションから選ぶ', () => {
    const result = buildTimetablePreview([{
      code: 'A', name: 'クラス未確定', termType: '前学期', offeredTerms: ['前学期'], options: [], sections: [
        { term: '前学期', timetableCode: 'A-1', teacher: '教員甲', slots: [{ day: '水', period: 2 }] },
        { term: '後学期', timetableCode: 'A-2', teacher: '教員乙', slots: [{ day: '木', period: 2 }] },
      ],
    }], '前学期', { A: 'A-1' })
    expect(result.slots.map((slot) => [slot.day, slot.period])).toEqual([['水', 2]])
    expect(result.unplaced).toEqual([])
  })

  // 再履修専用の時限を解決できなくても、全セクションから選べる状態にする。
  it('再履修で専用枠が無い科目も全セクションから選べる', () => {
    const course = {
      code: 'A', name: '再履修科目', termType: '前学期', offeredTerms: ['前学期'], options: [], sections: [
        { term: '前学期', timetableCode: 'A-regular-1', teacher: '教員甲', slots: [{ day: '水', period: 2 }] },
        { term: '前学期', timetableCode: 'A-regular-2', teacher: '教員乙', slots: [{ day: '木', period: 2 }] },
      ],
    }
    const unselected = buildTimetablePreview([course], '前学期')
    expect(unselected.slots).toEqual([])
    expect(unselected.unplaced[0].reason).toBe('no-class')
    expect(splitUnplacedTimetableCourses(unselected.unplaced).selectable).toEqual(unselected.unplaced)

    const result = buildTimetablePreview([course], '前学期', { A: 'A-regular-2' })
    expect(result.slots.map((slot) => [slot.day, slot.period])).toEqual([['木', 2]])
    expect(result.unplaced).toEqual([])
  })

  // 再履修専用枠が1件だけなら初期配置し、利用者が保存した選択はそちらを優先する。
  it('再履修専用枠が1つなら初期配置し、別の枠も選び直せる', () => {
    const course = {
      code: 'A', name: '再履修科目', termType: '前学期', offeredTerms: ['前学期'], chooseAmongSections: true,
      options: [
        { term: '前学期', timetableCode: 'A-regular', slots: [{ day: '月', period: 1 }] },
        { term: '前学期', timetableCode: 'A-retake', slots: [{ day: '火', period: 2 }], retake: true },
      ],
      sections: [
        { term: '前学期', timetableCode: 'A-regular', slots: [{ day: '月', period: 1 }] },
        { term: '前学期', timetableCode: 'A-retake', slots: [{ day: '火', period: 2 }], retake: true },
      ],
    }
    const defaulted = buildTimetablePreview([course], '前学期')
    expect(defaulted.slots.map(({ day, period }) => [day, period])).toEqual([['火', 2]])
    expect(defaulted.unplaced).toEqual([])

    const changed = buildTimetablePreview([course], '前学期', { A: 'A-regular' })
    expect(changed.slots.map(({ day, period }) => [day, period])).toEqual([['月', 1]])
    expect(changed.unplaced).toEqual([])
  })

  // 再履修専用枠を一意に決められない場合は、自動選択せず選ぶまで欄外に残す。
  it('再履修専用枠が複数あるときは未選択のままにする', () => {
    const result = buildTimetablePreview([{
      code: 'A', name: '再履修科目', termType: '前学期', offeredTerms: ['前学期'],
      options: [
        { term: '前学期', timetableCode: 'A-retake-1', slots: [{ day: '火', period: 2 }], retake: true },
        { term: '前学期', timetableCode: 'A-retake-2', slots: [{ day: '水', period: 3 }], retake: true },
      ],
      sections: [
        { term: '前学期', timetableCode: 'A-retake-1', slots: [{ day: '火', period: 2 }], retake: true },
        { term: '前学期', timetableCode: 'A-retake-2', slots: [{ day: '水', period: 3 }], retake: true },
      ],
    }], '前学期')
    expect(result.slots).toEqual([])
    expect(result.unplaced[0].reason).toBe('ambiguous-slot')
    expect(splitUnplacedTimetableCourses(result.unplaced).selectable).toEqual(result.unplaced)
  })

  // 低学年科目の時限が異なる場合だけ候補選択に残し、専用理由で説明する。
  it('時限の異なる低学年科目は候補選択枠に残す', () => {
    const course = {
      code: 'A', name: '低学年の授業', termType: '前学期', offeredTerms: ['前学期'], chooseAmongSections: true,
      options: [
        { term: '前学期', timetableCode: 'A-1', slots: [{ day: '月', period: 1 }] },
        { term: '前学期', timetableCode: 'A-2', slots: [{ day: '火', period: 1 }] },
      ],
    }
    const unselected = buildTimetablePreview([course], '前学期')
    expect(unselected.unplaced[0]).toMatchObject({ reason: 'lower-year-selection', options: course.options })
    expect(splitUnplacedTimetableCourses(unselected.unplaced).selectable).toEqual(unselected.unplaced)
    const selected = buildTimetablePreview([course], '前学期', { A: 'A-2' })
    expect(selected.slots.map((slot) => slot.code)).toEqual(['A'])
    expect(selected.unplaced).toEqual([])
  })

  // 別枠の集中講義も表示切替の対象となり、非表示時は結果一覧から外れる。
  it('集中講義を非表示にすると集中講義一覧から外す', () => {
    const courses = [{
      code: 'A', name: '集中科目', note: '夏期集中', termType: '前学期', offeredTerms: ['前学期'],
      offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }],
    }]
    expect(buildVisibleTimetablePreview(courses, '前学期', new Set()).intensive).toHaveLength(1)
    expect(buildVisibleTimetablePreview(courses, '前学期', new Set(['A'])).intensive).toEqual([])
  })

  // 同じ科目番号で保存する非表示設定は、通年科目の前後学期どちらにも反映される。
  it('通年科目を非表示にすると前後学期の欄外から外す', () => {
    const courses = [{
      code: 'A', name: '情報工学工房A', termType: '前学期', offeredTerms: ['前学期'], note: '通年',
      offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }],
    }]
    const hidden = new Set(['A'])
    expect(buildVisibleTimetablePreview(courses, '前学期', hidden).unplaced).toEqual([])
    expect(buildVisibleTimetablePreview(courses, '後学期', hidden).unplaced).toEqual([])
  })
})
