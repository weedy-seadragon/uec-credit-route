// classAssignment.ts の単体テスト。class_assignment.json の表記パターンごとに、
// プロフィールとの一致判定・セクション解決が正しく動くことを確認する。
import { describe, expect, it } from 'vitest'
import { classIdMatchesProfile, resolveSlotsForProfile } from './classAssignment'
import type { ClassAssignmentEntry, ClassProfile } from './classAssignment'

describe('classIdMatchesProfile（class_id表記ごとの一致判定）', () => {
  it('「クラスN」は1年次クラス（全類共通）と一致するかどうかで判定する', () => {
    const profile: ClassProfile = { yearOneClass: 3 }
    expect(classIdMatchesProfile('クラス3', profile, 'I')).toBe(true)
    expect(classIdMatchesProfile('クラス4', profile, 'I')).toBe(false)
  })

  it('「Xクラス」（A/B/C）はⅠ類のときだけ、classIABCと一致するかで判定する', () => {
    const profile: ClassProfile = { classIABC: 'B' }
    expect(classIdMatchesProfile('Bクラス', profile, 'I')).toBe(true)
    expect(classIdMatchesProfile('Aクラス', profile, 'I')).toBe(false)
    // 類が違えば、たまたま値が同じでも一致とはしない（Ⅰ類専用の表記のため）
    expect(classIdMatchesProfile('Bクラス', profile, 'II')).toBe(false)
  })

  it('「INクラス」はⅡ類のときだけ、classIIAreaと一致するかで判定する', () => {
    const profile: ClassProfile = { classIIArea: 'I5' }
    expect(classIdMatchesProfile('I5クラス', profile, 'II')).toBe(true)
    expect(classIdMatchesProfile('I3クラス', profile, 'II')).toBe(false)
    expect(classIdMatchesProfile('I5クラス', profile, 'III')).toBe(false)
  })

  it('「Mエリア」はⅡ類ならclassIIArea、Ⅲ類ならclassIIIYear2Areaと、参照するフィールドが変わる', () => {
    const profileII: ClassProfile = { classIIArea: 'M' }
    expect(classIdMatchesProfile('Mエリア', profileII, 'II')).toBe(true)

    const profileIII: ClassProfile = { classIIIYear2Area: 'M' }
    expect(classIdMatchesProfile('Mエリア', profileIII, 'III')).toBe(true)

    // Ⅱ類のclassIIAreaがMでも、Ⅲ類の学生としては一致しない（別フィールドを見ているため）
    expect(classIdMatchesProfile('Mエリア', profileII, 'III')).toBe(false)
  })

  it('「Mエリア(Nクラス)」はⅢ類で、エリアがMかつ2年前期クラスがNのときだけ一致する', () => {
    const profile: ClassProfile = { classIIIYear2Area: 'M', classIIIYear2Class: '2' }
    expect(classIdMatchesProfile('Mエリア(2クラス)', profile, 'III')).toBe(true)
    expect(classIdMatchesProfile('Mエリア(3クラス)', profile, 'III')).toBe(false)
    // エリアがSなら、クラス番号が同じでも一致しない
    expect(classIdMatchesProfile('Mエリア(2クラス)', { ...profile, classIIIYear2Area: 'S' }, 'III')).toBe(false)
  })

  it('プログラム名は、2年後期以降にプログラムが決まっていればどの類でも一致する', () => {
    const profile: ClassProfile = { programName: 'メディア情報学プログラム' }
    expect(classIdMatchesProfile('メディア情報学プログラム', profile, 'I')).toBe(true)
    expect(classIdMatchesProfile('経営・社会情報学プログラム', profile, 'I')).toBe(false)
  })

  it('「全クラス」はクラス分けに関係なく誰でも一致する', () => {
    expect(classIdMatchesProfile('全クラス', {}, 'I')).toBe(true)
    expect(classIdMatchesProfile('全クラス', { classIIArea: 'M' }, 'II')).toBe(true)
  })

  it('「Iエリア」はⅡ類のときだけ、classIIAreaがMエリア以外（I1〜I6のどれか）で一致する', () => {
    expect(classIdMatchesProfile('Iエリア', { classIIArea: 'I3' }, 'II')).toBe(true)
    expect(classIdMatchesProfile('Iエリア', { classIIArea: 'M' }, 'II')).toBe(false)
    expect(classIdMatchesProfile('Iエリア', {}, 'II')).toBe(false)
    expect(classIdMatchesProfile('Iエリア', { classIIArea: 'I3' }, 'III')).toBe(false)
  })

  it('「二類学籍番号偶数/奇数」はⅡ類のときだけ、1年次クラス番号の偶奇と一致するかで判定する（1年次クラスの偶奇＝学籍番号の偶奇）', () => {
    expect(classIdMatchesProfile('二類学籍番号偶数', { yearOneClass: 6 }, 'II')).toBe(true)
    expect(classIdMatchesProfile('二類学籍番号奇数', { yearOneClass: 6 }, 'II')).toBe(false)
    expect(classIdMatchesProfile('二類学籍番号奇数', { yearOneClass: 7 }, 'II')).toBe(true)
    expect(classIdMatchesProfile('二類学籍番号偶数', { yearOneClass: 7 }, 'II')).toBe(false)
    // Ⅱ類以外・未入力では判定できないのでfalse
    expect(classIdMatchesProfile('二類学籍番号偶数', { yearOneClass: 6 }, 'III')).toBe(false)
    expect(classIdMatchesProfile('二類学籍番号偶数', {}, 'II')).toBe(false)
  })

  it('未知の表記・未入力のプロフィールに対しては一致させない（誤判定より非表示を優先）', () => {
    expect(classIdMatchesProfile('謎のクラス', {}, 'I')).toBe(false)
    expect(classIdMatchesProfile('クラス3', {}, 'I')).toBe(false)
    // まだプロフィールに項目がない表記（留学生)も未知表記と同様false
    expect(classIdMatchesProfile('留学生', {}, 'I')).toBe(false)
  })

  it('「再履全員/再履生」はisRetakingがtrueのときだけ一致し、通常は一致しない', () => {
    expect(classIdMatchesProfile('再履生', {}, 'I')).toBe(false)
    expect(classIdMatchesProfile('再履生', {}, 'I', false)).toBe(false)
    expect(classIdMatchesProfile('再履生', {}, 'I', true)).toBe(true)
    expect(classIdMatchesProfile('再履全員', {}, 'II', true)).toBe(true)
  })

  it('isRetakingがtrueのときは、再履セクション以外（通常のクラス・プログラム向け）とは一致しない', () => {
    const profile: ClassProfile = { yearOneClass: 3, programName: 'メディア情報学プログラム' }
    expect(classIdMatchesProfile('クラス3', profile, 'I', true)).toBe(false)
    expect(classIdMatchesProfile('全クラス', profile, 'I', true)).toBe(false)
    expect(classIdMatchesProfile('メディア情報学プログラム', profile, 'I', true)).toBe(false)
    // isRetakingがfalseなら、これらは今まで通り一致する
    expect(classIdMatchesProfile('クラス3', profile, 'I', false)).toBe(true)
  })
})

describe('resolveSlotsForProfile（複数セクションからの解決）', () => {
  const assignments: ClassAssignmentEntry[] = [
    { code: 'MTH101z', term: '前学期', day: '水', period: '1', classIds: ['クラス2'] },
    { code: 'MTH101z', term: '前学期', day: '火', period: '3', classIds: ['クラス1', 'クラス7'] },
  ]

  it('プロフィールに合うセクションが1つだけなら、その曜日時限を返す', () => {
    const offerings = [
      { term: '前学期', slots: [{ day: '水', period: 1 }] },
      { term: '前学期', slots: [{ day: '火', period: 3 }] },
    ]
    const profile: ClassProfile = { yearOneClass: 2 }
    expect(resolveSlotsForProfile('MTH101z', offerings, assignments, profile, 'I')).toEqual([{ day: '水', period: 1 }])
  })

  it('複数クラスに開講されているセクションでも、そのうちの1つに該当すれば一致する', () => {
    const offerings = [
      { term: '前学期', slots: [{ day: '水', period: 1 }] },
      { term: '前学期', slots: [{ day: '火', period: 3 }] },
    ]
    const profile: ClassProfile = { yearOneClass: 7 }
    expect(resolveSlotsForProfile('MTH101z', offerings, assignments, profile, 'III')).toEqual([{ day: '火', period: 3 }])
  })

  it('該当するセクションが無ければundefined（class_assignment.jsonが未整備な科目・時限も含む）', () => {
    const offerings = [{ term: '前学期', slots: [{ day: '水', period: 1 }] }]
    const profile: ClassProfile = { yearOneClass: 99 }
    expect(resolveSlotsForProfile('MTH101z', offerings, assignments, profile, 'I')).toBeUndefined()
  })

  it('プロフィール未入力で複数セクションとも該当しない場合もundefined', () => {
    const offerings = [
      { term: '前学期', slots: [{ day: '水', period: 1 }] },
      { term: '前学期', slots: [{ day: '火', period: 3 }] },
    ]
    expect(resolveSlotsForProfile('MTH101z', offerings, assignments, {}, 'I')).toBeUndefined()
  })

  it('複数セクションが一致しても、曜日時限が全部同じなら（教員違いなど）その曜日時限を返す', () => {
    // 第二外国語で実際に起きているケース：同じクラス向けの科目が教員違いで複数開講され、
    // どちらも同じ曜日時限（例：月2）に配置されている
    const sameSlotAssignments: ClassAssignmentEntry[] = [
      { code: 'GER101z', term: '前学期', day: '月', period: '2', classIds: ['クラス1'] },
    ]
    const offerings = [
      { term: '前学期', slots: [{ day: '月', period: 2 }] }, // 岡野先生
      { term: '前学期', slots: [{ day: '月', period: 2 }] }, // 白木先生
    ]
    const profile: ClassProfile = { yearOneClass: 1 }
    expect(resolveSlotsForProfile('GER101z', offerings, sameSlotAssignments, profile, 'I')).toEqual([
      { day: '月', period: 2 },
    ])
  })

  it('複数セクションが一致し、曜日時限が食い違う場合はundefined', () => {
    const conflictingAssignments: ClassAssignmentEntry[] = [
      { code: 'GER101z', term: '前学期', day: '月', period: '2', classIds: ['クラス1'] },
      { code: 'GER101z', term: '前学期', day: '火', period: '3', classIds: ['クラス1'] },
    ]
    const offerings = [
      { term: '前学期', slots: [{ day: '月', period: 2 }] },
      { term: '前学期', slots: [{ day: '火', period: 3 }] },
    ]
    const profile: ClassProfile = { yearOneClass: 1 }
    expect(resolveSlotsForProfile('GER101z', offerings, conflictingAssignments, profile, 'I')).toBeUndefined()
  })

  it('isRetaking:trueなら、通常セクションではなく再履セクションの曜日時限を返す（不合格科目の再履修）', () => {
    // COM401f（アルゴリズムとデータ構造およびプログラミング演習）で実際に起きているケース：
    // 通常はIエリア向け（金1・金2）、再履修中の学生向けは別セクション（金5・金6）
    const comAssignments: ClassAssignmentEntry[] = [
      { code: 'COM401f', term: '後学期', day: '金', period: '1', classIds: ['Iエリア'] },
      { code: 'COM401f', term: '後学期', day: '金', period: '2', classIds: ['Iエリア'] },
      { code: 'COM401f', term: '後学期', day: '金', period: '5', classIds: ['再履生'] },
      { code: 'COM401f', term: '後学期', day: '金', period: '6', classIds: ['再履生'] },
    ]
    const offerings = [
      { term: '後学期', slots: [{ day: '金', period: 1 }, { day: '金', period: 2 }] },
      { term: '後学期', slots: [{ day: '金', period: 5 }, { day: '金', period: 6 }] },
    ]
    const profile: ClassProfile = { classIIArea: 'I3' }
    expect(resolveSlotsForProfile('COM401f', offerings, comAssignments, profile, 'II', false)).toEqual([
      { day: '金', period: 1 },
      { day: '金', period: 2 },
    ])
    expect(resolveSlotsForProfile('COM401f', offerings, comAssignments, profile, 'II', true)).toEqual([
      { day: '金', period: 5 },
      { day: '金', period: 6 },
    ])
  })
})
