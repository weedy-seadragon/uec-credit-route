// reviews.ts の単体テスト。allOf/anyOf・各条件タイプ・審査どうしの参照(review)を検証する。
import { describe, expect, it } from 'vitest'
import { evaluateRequirements } from './requirements'
import type { RequirementSet, ReviewDef, SubjectStatus } from './requirements'
import { evaluateReviews } from './reviews'

/** テスト用の要件セット。必修グループ2つ（G1, G2）と選択グループ1つ（G3）を持つ */
const requirementSet: RequirementSet = {
  totalCredits: 10,
  commonCredits: 2,
  groups: [
    { id: 'g1', name: 'G1（必修2単位）', required: 2, kind: 'required', subjects: ['R1'] },
    { id: 'g2', name: 'G2（必修2単位）', required: 2, kind: 'required', subjects: ['R2'] },
    { id: 'g3', name: 'G3（選択4単位）', required: 4, kind: 'elective', subjects: ['S1', 'S2', 'S3', 'S4'] },
  ],
}
const subjectCredits = new Map([
  ['R1', 2], ['R2', 2], ['S1', 2], ['S2', 2], ['S3', 2], ['S4', 2],
])

function records(entries: Record<string, SubjectStatus> = {}): ReadonlyMap<string, SubjectStatus> {
  return new Map(Object.entries(entries))
}

function evaluate(entries: Record<string, SubjectStatus> = {}) {
  return evaluateRequirements(requirementSet, records(entries), subjectCredits)
}

describe('evaluateReviews（葉の条件タイプごとの判定）', () => {
  it('groupMin：指定グループの修得単位数がmin以上かで判定する', () => {
    const review: ReviewDef = { id: 'r', name: 'テスト審査', allOf: [{ type: 'groupMin', groupId: 'g3', min: 4 }] }
    expect(evaluateReviews([review], evaluate({ S1: 'passed', S2: 'passed' }), records()).at(0)?.satisfied).toBe(true)
    expect(evaluateReviews([review], evaluate({ S1: 'passed' }), records()).at(0)?.satisfied).toBe(false)
  })

  it('allPassed：指定グループを（必修として）すべて修得しているかで判定する', () => {
    const review: ReviewDef = { id: 'r', name: 'テスト審査', allOf: [{ type: 'allPassed', groupId: 'g1' }] }
    expect(evaluateReviews([review], evaluate({ R1: 'passed' }), records()).at(0)?.satisfied).toBe(true)
    expect(evaluateReviews([review], evaluate({}), records()).at(0)?.satisfied).toBe(false)
  })

  it('subjects：グループに属さない個別の科目番号をすべて修得しているかで判定する', () => {
    const review: ReviewDef = { id: 'r', name: 'テスト審査', allOf: [{ type: 'subjects', codes: ['R1', 'R2'] }] }
    const passedRecords = records({ R1: 'passed', R2: 'passed' })
    expect(evaluateReviews([review], evaluate({ R1: 'passed', R2: 'passed' }), passedRecords).at(0)?.satisfied).toBe(true)
    expect(evaluateReviews([review], evaluate({ R1: 'passed' }), records({ R1: 'passed' })).at(0)?.satisfied).toBe(false)
  })

  it('totalCredits・commonCredits：全体の合計/共通単位がmin以上かで判定する', () => {
    const review: ReviewDef = {
      id: 'r',
      name: 'テスト審査',
      allOf: [
        { type: 'totalCredits', min: 6 },
        { type: 'commonCredits', min: 2 },
      ],
    }
    // R1・R2（必修4単位）に加えS1〜S4のうち超過分2単位が共通単位に回る想定
    const result = evaluateReviews([review], evaluate({ R1: 'passed', R2: 'passed', S1: 'passed', S2: 'passed', S3: 'passed' }), records())
    expect(result.at(0)?.satisfied).toBe(true)
  })

  it('allGroups：すべての判定境界グループが満たされているかで判定する（卒業審査想定）', () => {
    const review: ReviewDef = { id: 'r', name: '卒業審査', allOf: [{ type: 'allGroups' }] }
    const allPassed = evaluate({ R1: 'passed', R2: 'passed', S1: 'passed', S2: 'passed' })
    expect(evaluateReviews([review], allPassed, records()).at(0)?.satisfied).toBe(true)
    const partial = evaluate({ R1: 'passed' })
    expect(evaluateReviews([review], partial, records()).at(0)?.satisfied).toBe(false)
  })
})

describe('evaluateReviews（allOf/anyOfの組み合わせ）', () => {
  it('anyOfはどれか1つの枝を満たせば全体として合格になる', () => {
    const review: ReviewDef = {
      id: 'r',
      name: 'テスト審査',
      anyOf: [
        { allOf: [{ type: 'allPassed', groupId: 'g1' }, { type: 'allPassed', groupId: 'g2' }] },
        { type: 'totalCredits', min: 6, note: '特例' },
      ],
    }
    // 特例（合計6単位）だけを満たすケース（G3は選択なのでrequired=4で頭打ちになり、
    // 超過分4単位のうちcommonCredits上限の2単位だけが共通単位に繰り入る＝合計6単位）
    const result = evaluateReviews([review], evaluate({ S1: 'passed', S2: 'passed', S3: 'passed', S4: 'passed' }), records())
    expect(result.at(0)?.satisfied).toBe(true)
  })

  it('不合格のときは、unsatisfiedに原因になった条件が入る（anyOfは一番惜しい枝を選ぶ）', () => {
    const review: ReviewDef = {
      id: 'r',
      name: 'テスト審査',
      anyOf: [
        { allOf: [{ type: 'allPassed', groupId: 'g1' }, { type: 'allPassed', groupId: 'g2' }] },
        { type: 'totalCredits', min: 100, note: '特例' },
      ],
    }
    // g1だけ満たしている＝「g1・g2両方」の枝の方が「合計100単位」の枝より惜しいので、そちらが選ばれる
    const result = evaluateReviews([review], evaluate({ R1: 'passed' }), records())
    expect(result.at(0)?.satisfied).toBe(false)
    expect(result.at(0)?.unsatisfied).toEqual([{ type: 'allPassed', groupId: 'g2' }])
  })
})

describe('evaluateReviews（審査どうしの参照）', () => {
  it('review条件は、参照先の審査の合否をそのまま使う', () => {
    const y2: ReviewDef = { id: 'y2', name: '2年次終了時審査', allOf: [{ type: 'allPassed', groupId: 'g1' }] }
    const thesis: ReviewDef = { id: 'thesis', name: '卒業研究着手審査', allOf: [{ type: 'review', id: 'y2' }, { type: 'allPassed', groupId: 'g2' }] }

    const bothPassed = evaluate({ R1: 'passed', R2: 'passed' })
    const results1 = evaluateReviews([y2, thesis], bothPassed, records())
    expect(results1.map((r) => r.satisfied)).toEqual([true, true])

    // 2年次審査(g1)は合格しているが、g2が未修得なので卒研着手は不合格
    const onlyG1 = evaluate({ R1: 'passed' })
    const results2 = evaluateReviews([y2, thesis], onlyG1, records())
    expect(results2.map((r) => r.satisfied)).toEqual([true, false])
  })

  it('onFailの情報はそのまま結果に含める', () => {
    const review: ReviewDef = {
      id: 'r',
      name: 'テスト審査',
      allOf: [{ type: 'allPassed', groupId: 'g1' }],
      onFail: { blockedSubjects: ['S1'], note: '不合格時はS1を履修できない' },
    }
    const result = evaluateReviews([review], evaluate({}), records())
    expect(result.at(0)?.onFail).toEqual({ blockedSubjects: ['S1'], note: '不合格時はS1を履修できない' })
  })
})
