// recommend.ts の単体テスト。docs/SPEC.md §8 のスコア付けルールをそれぞれ検証する。
import { describe, expect, it } from 'vitest'
import { evaluateRequirements } from './requirements'
import type { RequirementSet, SubjectStatus } from './requirements'
import { recommend } from './recommend'
import type { RecommendInput, SubjectInfo } from './recommend'

/** records を `new Map(...)` で書くのは冗長なので、オブジェクトリテラルから組み立てる */
function records(entries: Record<string, SubjectStatus> = {}): ReadonlyMap<string, SubjectStatus> {
  return new Map(Object.entries(entries))
}

/** SubjectInfo の配列を、code をキーにした Map に変換する */
function subjectsMap(list: SubjectInfo[]): ReadonlyMap<string, SubjectInfo> {
  return new Map(list.map((s) => [s.code, s]))
}

/** requirements.ts 側の単位数マップ（credits だけ見る）は SubjectInfo からそのまま作れる */
function creditsOf(subjects: ReadonlyMap<string, SubjectInfo>): ReadonlyMap<string, number> {
  return new Map([...subjects.values()].map((s) => [s.code, s.credits]))
}

/** テスト用の最小限の要件セット・評価結果・SubjectInfo一式をまとめて作るヘルパー */
function setup(requirementSet: RequirementSet, subjects: SubjectInfo[], userRecords: Record<string, SubjectStatus> = {}) {
  const subjectsByCode = subjectsMap(subjects)
  const evaluation = evaluateRequirements(requirementSet, records(userRecords), creditsOf(subjectsByCode))
  return { requirementSet, evaluation, subjects: subjectsByCode }
}

// w1（必修未修得）は候補の中でも一番大きい重みなので、他の要因より必ず上に来ることを確認する
describe('必修未修得の科目は選択科目より優先される', () => {
  const requirementSet: RequirementSet = {
    totalCredits: 6,
    commonCredits: 0,
    groups: [
      { id: 'req', name: '必修サンプル', required: 2, kind: 'required', subjects: ['R1'] },
      { id: 'sel', name: '選択サンプル', required: 4, kind: 'elective', subjects: ['S1', 'S2'] },
    ],
  }
  const subjects: SubjectInfo[] = [
    { code: 'R1', credits: 2 },
    { code: 'S1', credits: 2 },
    { code: 'S2', credits: 2 },
  ]

  it('必修未修得（R1）が選択科目より上位に来る', () => {
    // 何も履修していない状態で推奨すると、必修のR1が選択のS1より高スコア・先頭に来るはず
    const { requirementSet: rs, evaluation, subjects: subj } = setup(requirementSet, subjects)
    const input: RecommendInput = { requirementSet: rs, evaluation, records: records(), subjects: subj, currentGrade: 2, termFilter: 'all' }
    const result = recommend(input)
    const r1 = result.find((r) => r.code === 'R1')!
    const s1 = result.find((r) => r.code === 'S1')!
    expect(r1.reason).toBe('required-not-passed')
    expect(r1.score).toBeGreaterThan(s1.score)
    expect(result[0].code).toBe('R1')
  })
})

// §8ステップ1「修得済みは候補から外す。不合格は再履修候補として残す」を確認する
describe('修得済み・不合格の扱い', () => {
  const requirementSet: RequirementSet = {
    totalCredits: 2, commonCredits: 0,
    groups: [{ id: 'req', name: '必修サンプル', required: 2, kind: 'required', subjects: ['R1', 'R2'] }],
  }
  const subjects: SubjectInfo[] = [{ code: 'R1', credits: 1 }, { code: 'R2', credits: 1 }]

  it('修得済み（passed）は候補から除外される', () => {
    const { requirementSet: rs, evaluation, subjects: subj } = setup(requirementSet, subjects, { R1: 'passed' })
    const result = recommend({ requirementSet: rs, evaluation, records: records({ R1: 'passed' }), subjects: subj, currentGrade: 1, termFilter: 'all' })
    expect(result.map((r) => r.code)).not.toContain('R1')
  })

  it('不合格（failed）は再履修候補として残る', () => {
    const { requirementSet: rs, evaluation, subjects: subj } = setup(requirementSet, subjects, { R1: 'failed' })
    const result = recommend({ requirementSet: rs, evaluation, records: records({ R1: 'failed' }), subjects: subj, currentGrade: 1, termFilter: 'all' })
    expect(result.map((r) => r.code)).toContain('R1')
  })
})

// isOfferedIn（学期・学年による絞り込み）が候補の一覧に正しく反映されることを確認する
describe('学期フィルタでの絞り込み', () => {
  const requirementSet: RequirementSet = {
    totalCredits: 6, commonCredits: 0,
    groups: [{ id: 'sel', name: '選択サンプル', required: 6, kind: 'elective', subjects: ['SPRING1', 'AUTUMN1', 'YEAR2_1'] }],
  }
  const subjects: SubjectInfo[] = [
    { code: 'SPRING1', credits: 2, termType: '前学期', standardYear: 1 },
    { code: 'AUTUMN1', credits: 2, termType: '後学期', standardYear: 1 },
    { code: 'YEAR2_1', credits: 2, termType: '前学期', standardYear: 2 },
  ]

  it('前学期フィルタでは前学期科目だけが候補になる（1年生視点）', () => {
    const { requirementSet: rs, evaluation, subjects: subj } = setup(requirementSet, subjects)
    const result = recommend({ requirementSet: rs, evaluation, records: records(), subjects: subj, currentGrade: 1, termFilter: { year: 1, half: '前学期' } })
    const codes = result.map((r) => r.code)
    expect(codes).toContain('SPRING1')
    expect(codes).not.toContain('AUTUMN1') // 学期が違う
    expect(codes).not.toContain('YEAR2_1') // まだ2年次に達していない
  })

  it('全学年フィルタでは絞り込まれない', () => {
    // termFilterが'all'のときは、学期や学年に関係なく3科目とも候補に出るはず
    const { requirementSet: rs, evaluation, subjects: subj } = setup(requirementSet, subjects)
    const result = recommend({ requirementSet: rs, evaluation, records: records(), subjects: subj, currentGrade: 1, termFilter: 'all' })
    expect(result.map((r) => r.code).sort()).toEqual(['AUTUMN1', 'SPRING1', 'YEAR2_1'])
  })

  it('termType が無い科目（通年など）はどの学期フィルタでも候補に出る', () => {
    // 後学期フィルタでも、termTypeを指定していないYR1は除外されないはず
    const yearRoundSet: RequirementSet = {
      totalCredits: 2, commonCredits: 0,
      groups: [{ id: 'sel', name: '通年科目サンプル', required: 2, kind: 'elective', subjects: ['YR1'] }],
    }
    const yearRoundSubjects: SubjectInfo[] = [{ code: 'YR1', credits: 2, standardYear: 1 }]
    const { requirementSet: rs, evaluation, subjects: subj } = setup(yearRoundSet, yearRoundSubjects)
    const result = recommend({ requirementSet: rs, evaluation, records: records(), subjects: subj, currentGrade: 1, termFilter: { year: 1, half: '後学期' } })
    expect(result.map((r) => r.code)).toContain('YR1')
  })
})

// w3（不足比率が高いほど加点）とw7（区分が既に満たされていると大きく減点）の
// 両方が効いて、優先すべき科目が上位・不要な科目が下位に来ることを確認する
describe('区分の不足比率（w3）と充足済み区分の減点（w7）', () => {
  const requirementSet: RequirementSet = {
    totalCredits: 10, commonCredits: 0,
    groups: [
      { id: 'big-shortfall', name: '大きく不足', required: 10, kind: 'elective', subjects: ['BIG1'] },
      { id: 'already-full', name: '充足済み', required: 2, kind: 'elective', subjects: ['FULL1', 'FULL2'] },
    ],
  }
  const subjects: SubjectInfo[] = [
    { code: 'BIG1', credits: 2 },
    { code: 'FULL1', credits: 2 },
    { code: 'FULL2', credits: 2 },
  ]

  it('不足比率が大きい区分の科目ほどスコアが高く、充足済み区分の科目はスコアが下がる', () => {
    // FULL1 を修得済みにして already-full 区分を満たしておく
    const { requirementSet: rs, evaluation, subjects: subj } = setup(requirementSet, subjects, { FULL1: 'passed' })
    const result = recommend({ requirementSet: rs, evaluation, records: records({ FULL1: 'passed' }), subjects: subj, currentGrade: 1, termFilter: 'all' })
    const big1 = result.find((r) => r.code === 'BIG1')!
    const full2 = result.find((r) => r.code === 'FULL2')!
    expect(big1.reason).toBe('shortfall-group')
    expect(big1.score).toBeGreaterThan(full2.score)
    expect(full2.score).toBeLessThan(0) // 充足済み区分なので減点が効いてマイナスになる
  })
})

// prerequisites・slots はシラバスデータが無ければ省略できる設計（recommend.ts冒頭コメント参照）。
// ここではあえてデータを与えて、w5（先修科目クリア）・w6（時限重複）が正しく働くことを確認する
describe('先修科目・曜日時限（シラバスデータがある場合）', () => {
  const requirementSet: RequirementSet = {
    totalCredits: 4, commonCredits: 0,
    groups: [{ id: 'sel', name: '選択サンプル', required: 4, kind: 'elective', subjects: ['ADV1', 'CLASH1'] }],
  }

  it('先修科目を修得済みだとスコアが少し上がる', () => {
    // BASIC1を修得済みにする前後で、ADV1のスコアを比較する
    const subjects: SubjectInfo[] = [{ code: 'ADV1', credits: 2, prerequisites: ['BASIC1'] }]
    const { requirementSet: rs, evaluation, subjects: subj } = setup(requirementSet, [...subjects, { code: 'BASIC1', credits: 2 }])

    const withoutPrereq = recommend({ requirementSet: rs, evaluation, records: records(), subjects: subj, currentGrade: 1, termFilter: 'all' })
    const withPrereq = recommend({ requirementSet: rs, evaluation, records: records({ BASIC1: 'passed' }), subjects: subj, currentGrade: 1, termFilter: 'all' })

    const scoreWithout = withoutPrereq.find((r) => r.code === 'ADV1')!.score
    const scoreWith = withPrereq.find((r) => r.code === 'ADV1')!.score
    expect(scoreWith).toBeGreaterThan(scoreWithout)
  })

  it('履修中・履修予定の科目と曜日時限が重なると減点され clash が true になる', () => {
    // busySlotsを渡す・渡さないの2パターンで、CLASH1の判定とスコアを比較する
    const subjects: SubjectInfo[] = [{ code: 'CLASH1', credits: 2, slots: [{ day: '月', period: 1 }] }]
    const { requirementSet: rs, evaluation, subjects: subj } = setup(requirementSet, subjects)

    const noClash = recommend({ requirementSet: rs, evaluation, records: records(), subjects: subj, currentGrade: 1, termFilter: 'all' })
    const withClash = recommend({
      requirementSet: rs, evaluation, records: records(), subjects: subj, currentGrade: 1, termFilter: 'all',
      busySlots: [{ day: '月', period: 1 }],
    })

    expect(noClash.find((r) => r.code === 'CLASH1')!.clash).toBe(false)
    const clashResult = withClash.find((r) => r.code === 'CLASH1')!
    expect(clashResult.clash).toBe(true)
    expect(clashResult.score).toBeLessThan(noClash.find((r) => r.code === 'CLASH1')!.score)
  })
})

// w4（標準年次より遅れているほど加点）と、スコア同点時のソート順（年次が古い順）を確認する
describe('標準履修年次より遅れている科目の注記とソート順', () => {
  const requirementSet: RequirementSet = {
    totalCredits: 4, commonCredits: 0,
    groups: [{ id: 'req', name: '必修サンプル', required: 4, kind: 'required', subjects: ['OLD1', 'OLD2'] }],
  }
  const subjects: SubjectInfo[] = [
    { code: 'OLD1', credits: 2, standardYear: 1 },
    { code: 'OLD2', credits: 2, standardYear: 2 },
  ]

  it('3年生から見て1年次科目には「1年次科目」の注記が付く', () => {
    // OLD1のstandardYearは1なので、3年生（currentGrade=3）から見ると「1年次科目」の注記が付くはず
    const { requirementSet: rs, evaluation, subjects: subj } = setup(requirementSet, subjects)
    const result = recommend({ requirementSet: rs, evaluation, records: records(), subjects: subj, currentGrade: 3, termFilter: 'all' })
    expect(result.find((r) => r.code === 'OLD1')!.laterThanStandardYearNote).toBe('1年次科目')
  })

  it('同点なら標準履修年次が古い（小さい）ものが先に来る', () => {
    // OLD1(1年次)・OLD2(2年次)はどちらも必修未修得でスコアが同じになるはずなので、
    // 標準年次が古いOLD1が先に来るはず
    const { requirementSet: rs, evaluation, subjects: subj } = setup(requirementSet, subjects)
    const result = recommend({ requirementSet: rs, evaluation, records: records(), subjects: subj, currentGrade: 3, termFilter: 'all' })
    expect(result[0].code).toBe('OLD1')
    expect(result[1].code).toBe('OLD2')
  })
})
