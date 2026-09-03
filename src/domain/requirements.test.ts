// requirements.ts の単体テスト。
//
// Vitest は `describe`（テストのグループ分け）・`it`（1件のテスト）・`expect`（検証）を
// 明示的にインポートして使う（Jestと似た書き方だが、Vitestではグローバルに生えていない）。
//
// 前半は「required や overflowToCommon の値を自由に決められる」小さな仮想データで
// アルゴリズムの各ルールをピンポイントに検証し、後半では実際の data/ 以下のJSONを
// 読み込んで、Ⅰ類メディア情報学の要件データがそのまま評価関数に通ることを確認する。

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  evaluateRequirements,
  type GroupResult,
  type RequirementGroup,
  type RequirementSet,
  type SubjectStatus,
} from './requirements'

/** テスト用に「グループ1つだけの要件セット」を作る小さなヘルパー */
function singleGroupRequirementSet(group: RequirementGroup, commonCredits = 0): RequirementSet {
  return {
    totalCredits: group.required,
    commonCredits,
    groups: [group],
  }
}

/** records を `new Map(...)` で書くのは冗長なので、オブジェクトリテラルから組み立てる */
function records(entries: Record<string, SubjectStatus>): ReadonlyMap<string, SubjectStatus> {
  return new Map(Object.entries(entries))
}

describe('必修グループ（kind: required）', () => {
  const group: RequirementGroup = {
    id: 'req',
    name: '必修サンプル',
    required: 5,
    kind: 'required',
    subjects: ['A1', 'A2'],
  }
  const credits = new Map([
    ['A1', 2],
    ['A2', 3],
  ])

  it('全科目を修得していれば満たされる', () => {
    const result = evaluateRequirements(singleGroupRequirementSet(group), records({ A1: 'passed', A2: 'passed' }), credits)
    expect(result.groups[0].contribution).toBe(5)
    expect(result.groups[0].shortfall).toBe(0)
    expect(result.groups[0].satisfied).toBe(true)
  })

  it('一部だけ修得している場合は不足単位が正しく出る', () => {
    const result = evaluateRequirements(singleGroupRequirementSet(group), records({ A1: 'passed' }), credits)
    expect(result.groups[0].contribution).toBe(2)
    expect(result.groups[0].shortfall).toBe(3)
    expect(result.groups[0].satisfied).toBe(false)
  })
})

describe('選択グループ（kind: elective）と共通単位への繰り入れ', () => {
  const group: RequirementGroup = {
    id: 'career',
    name: 'キャリア単位サンプル',
    required: 4,
    kind: 'elective',
    subjects: ['C1', 'C2', 'C3'],
  }
  const credits = new Map([
    ['C1', 2],
    ['C2', 2],
    ['C3', 2],
  ])

  it('required ちょうどなら過不足なく満たされる', () => {
    const result = evaluateRequirements(singleGroupRequirementSet(group), records({ C1: 'passed', C2: 'passed' }), credits)
    expect(result.groups[0].contribution).toBe(4)
    expect(result.groups[0].overflowToCommon).toBe(0)
  })

  it('required を超えた分は共通単位に繰り入れられる（overflowToCommon省略時のデフォルト）', () => {
    const requirementSet = singleGroupRequirementSet(group, /* commonCredits */ 10)
    const result = evaluateRequirements(
      requirementSet,
      records({ C1: 'passed', C2: 'passed', C3: 'passed' }),
      credits,
    )
    expect(result.groups[0].contribution).toBe(4) // グループ自体の算入は required で頭打ち
    expect(result.groups[0].overflowToCommon).toBe(2) // 超過ぶんの2単位
    expect(result.commonCredits.contribution).toBe(2)
  })

  it('overflowToCommon: false のグループは超過しても共通単位に回らない（人文・社会科学科目相当）', () => {
    const noOverflowGroup: RequirementGroup = { ...group, overflowToCommon: false }
    const requirementSet = singleGroupRequirementSet(noOverflowGroup, 10)
    const result = evaluateRequirements(
      requirementSet,
      records({ C1: 'passed', C2: 'passed', C3: 'passed' }),
      credits,
    )
    expect(result.groups[0].contribution).toBe(4)
    expect(result.groups[0].overflowToCommon).toBe(0)
    expect(result.commonCredits.contribution).toBe(0)
  })
})

describe('自由科目（countsTowardGraduation: false）', () => {
  const group: RequirementGroup = {
    id: 'free',
    name: '自由科目サンプル',
    required: 0,
    kind: 'free',
    countsTowardGraduation: false,
    subjects: ['F1'],
  }
  const credits = new Map([['F1', 2]])

  it('修得しても卒業要件の合計にも共通単位にも算入されない', () => {
    const requirementSet: RequirementSet = { totalCredits: 0, commonCredits: 10, groups: [group] }
    const result = evaluateRequirements(requirementSet, records({ F1: 'passed' }), credits)
    expect(result.groups[0].earnedPassed).toBe(2) // 修得したこと自体は記録される
    expect(result.groups[0].contribution).toBe(0)
    expect(result.groups[0].overflowToCommon).toBe(0)
    expect(result.totalCredits.contribution).toBe(0)
  })
})

describe('countAs: "common" のグループ（理数基礎科目の選択科目相当）', () => {
  const group: RequirementGroup = {
    id: 'math-basic-sel',
    name: '理数基礎（選択）サンプル',
    required: 0,
    kind: 'elective',
    countAs: 'common',
    subjects: ['M1', 'M2'],
  }
  const credits = new Map([
    ['M1', 1],
    ['M2', 1],
  ])

  it('required と比較せず、修得した分がそのまま共通単位になる', () => {
    const requirementSet = singleGroupRequirementSet({ ...group, required: 0 }, 10)
    const result = evaluateRequirements(requirementSet, records({ M1: 'passed', M2: 'passed' }), credits)
    expect(result.groups[0].contribution).toBe(0) // このグループ自体の算入は0（requiredが0なので）
    expect(result.groups[0].overflowToCommon).toBe(2)
    expect(result.commonCredits.contribution).toBe(2)
  })
})

describe('ネストしたグループ（「上級科目」のような、複数カテゴリから合計n単位のケース）', () => {
  // 上級科目のように、親グループが判定境界（kind: elective, required: 4）を持ち、
  // 子グループ（A類・B類など）はそれぞれ required: 0 の内訳表示専用というケース。
  // 親と子の両方で超過単位を共通単位に回してしまう「二重計上」が起きないことを確認する。
  const advanced: RequirementGroup = {
    id: 'advanced',
    name: '上級科目サンプル',
    required: 4,
    kind: 'elective',
    subjects: [],
    children: [
      { id: 'adv-A', name: 'A類サンプル', required: 0, subjects: ['ADV-A1', 'ADV-A2'] },
      { id: 'adv-B', name: 'B類サンプル', required: 0, subjects: ['ADV-B1'] },
    ],
  }
  const credits = new Map([
    ['ADV-A1', 2],
    ['ADV-A2', 2],
    ['ADV-B1', 2],
  ])

  it('required ちょうど（4単位）なら、共通単位への繰り入れは発生しない', () => {
    const requirementSet = singleGroupRequirementSet(advanced, 10)
    const result = evaluateRequirements(
      requirementSet,
      records({ 'ADV-A1': 'passed', 'ADV-A2': 'passed' }),
      credits,
    )
    expect(result.groups[0].contribution).toBe(4)
    expect(result.groups[0].overflowToCommon).toBe(0)
    expect(result.commonCredits.contribution).toBe(0)
  })

  it('複数カテゴリにまたがって required を超えても、超過は1回しか共通単位に回らない', () => {
    // A類2単位 + A類2単位 + B類2単位 = 合計6単位。requiredは4なので超過は2単位のはず。
    // ここで「親の超過2単位」と「子(A類・B類)それぞれの全額」を両方共通単位に回すと
    // 二重計上（本来2単位のはずが6単位以上になる）のバグになる。
    const requirementSet = singleGroupRequirementSet(advanced, 10)
    const result = evaluateRequirements(
      requirementSet,
      records({ 'ADV-A1': 'passed', 'ADV-A2': 'passed', 'ADV-B1': 'passed' }),
      credits,
    )
    expect(result.groups[0].earnedPassed).toBe(6)
    expect(result.groups[0].contribution).toBe(4)
    expect(result.groups[0].overflowToCommon).toBe(2) // 二重計上なら4以上になってしまう
    expect(result.commonCredits.contribution).toBe(2)

    // 内訳（A類・B類）は表示用にそれぞれの修得単位を持つが、算入単位は0のまま
    const [advA, advB] = result.groups[0].children
    expect(advA.earnedPassed).toBe(4)
    expect(advA.contribution).toBe(0)
    expect(advB.earnedPassed).toBe(2)
    expect(advB.contribution).toBe(0)
  })
})

describe('積み上げ専用の親グループ（kindを持たず、子の結果を合計するだけのグループ）', () => {
  // 健康・スポーツ科学科目（必修の健康論・実習 + 選択の生涯スポーツ演習）を模したケース
  const health: RequirementGroup = {
    id: 'health',
    name: '健康・スポーツ科学科目サンプル',
    required: 3,
    subjects: [],
    children: [
      { id: 'health-req', name: '必修', required: 2, kind: 'required', subjects: ['H1', 'H2'] },
      { id: 'health-sel', name: '生涯スポーツ演習', required: 1, kind: 'elective', subjects: ['H3', 'H4'] },
    ],
  }
  const credits = new Map([
    ['H1', 1],
    ['H2', 1],
    ['H3', 1],
    ['H4', 1],
  ])

  it('子グループの算入単位を合計した値が親の充足状況になる', () => {
    const requirementSet = singleGroupRequirementSet(health, 10)
    const result = evaluateRequirements(
      requirementSet,
      records({ H1: 'passed', H2: 'passed', H3: 'passed', H4: 'passed' }),
      credits,
    )
    // health-req: 2/2, health-sel: required1に対しH3+H4=2単位修得 → 算入1、超過1は共通単位へ
    expect(result.groups[0].contribution).toBe(3) // 2 (必修) + 1 (選択、requiredで頭打ち)
    expect(result.groups[0].satisfied).toBe(true)
    expect(result.groups[0].overflowToCommon).toBe(1)
    expect(result.commonCredits.contribution).toBe(1)
  })
})

describe('履修中（taking）科目の見込み計算', () => {
  const group: RequirementGroup = {
    id: 'req',
    name: '必修サンプル',
    required: 4,
    kind: 'required',
    subjects: ['A1', 'A2'],
  }
  const credits = new Map([
    ['A1', 2],
    ['A2', 2],
  ])

  it('確定分だけでは不足でも、履修中を含めた見込みでは満たされる', () => {
    const result = evaluateRequirements(singleGroupRequirementSet(group), records({ A1: 'passed', A2: 'taking' }), credits)
    expect(result.groups[0].satisfied).toBe(false)
    expect(result.groups[0].shortfall).toBe(2)
    expect(result.groups[0].projected.satisfied).toBe(true)
    expect(result.groups[0].projected.shortfall).toBe(0)
  })
})

describe('alwaysCommonSubjects（言語文化応用科目Ⅱなど、超過計算を経ずに共通単位になる科目）', () => {
  it('修得していれば required との比較なしにそのまま共通単位に加算される', () => {
    const requirementSet: RequirementSet = {
      totalCredits: 0,
      commonCredits: 10,
      groups: [],
      alwaysCommonSubjects: ['GER102'],
    }
    const credits = new Map([['GER102', 2]])
    const result = evaluateRequirements(requirementSet, records({ GER102: 'passed' }), credits)
    expect(result.commonCredits.contribution).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// 実データでの統合テスト
// ---------------------------------------------------------------------------
//
// data/requirements/2025-day-common.json と 2025-day-I-media.json、
// data/subjects/youran-2025.json を実際に読み込み、Ⅰ類メディア情報学の
// 要件セットがそのまま evaluateRequirements に通ることを確認する。
//
// requirements.ts 自体はファイル読み込みをしない（ブラウザでも動く純粋関数のままにする）ので、
// ここではテストコードの中だけで node:fs を使ってJSONを読み込む。

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function loadJson(relativePathFromProjectRoot: string): unknown {
  const fullPath = path.join(projectRoot, relativePathFromProjectRoot)
  return JSON.parse(readFileSync(fullPath, 'utf-8'))
}

/** グループの木を id で検索する（テストの中でだけ使う小さなヘルパー） */
function findGroupById(groups: readonly GroupResult[], id: string): GroupResult | undefined {
  for (const group of groups) {
    if (group.id === id) return group
    const found = findGroupById(group.children, id)
    if (found) return found
  }
  return undefined
}

describe('実データ（Ⅰ類メディア情報学プログラム）での評価', () => {
  const common = loadJson('data/requirements/2025-day-common.json') as {
    groups: RequirementGroup[]
    commonCreditSources?: { alwaysCommon?: string[] }
  }
  const media = loadJson('data/requirements/2025-day-I-media.json') as {
    totalCredits: number
    commonCredits: number
    groups: RequirementGroup[]
  }
  const subjectsMaster = loadJson('data/subjects/youran-2025.json') as {
    subjects: { code: string; credits: number }[]
  }

  const subjectCredits = new Map(subjectsMaster.subjects.map((s) => [s.code, s.credits]))

  const requirementSet: RequirementSet = {
    totalCredits: media.totalCredits,
    commonCredits: media.commonCredits,
    groups: [...common.groups, ...media.groups],
    alwaysCommonSubjects: common.commonCreditSources?.alwaysCommon ?? [],
  }

  it('何も履修していない状態では、合計単位数が totalCredits の required と一致し未充足になる', () => {
    const result = evaluateRequirements(requirementSet, records({}), subjectCredits)
    expect(result.totalCredits.required).toBe(media.totalCredits)
    expect(result.totalCredits.contribution).toBe(0)
    expect(result.totalCredits.satisfied).toBe(false)
  })

  it('初年次導入科目をすべて修得すると、そのグループだけ満たされる', () => {
    const introDefinition = findRequirementGroupById(common.groups, 'intro')
    expect(introDefinition).toBeDefined()

    const allPassed = records(
      Object.fromEntries((introDefinition!.subjects ?? []).map((code) => [code, 'passed' as const])),
    )
    const result = evaluateRequirements(requirementSet, allPassed, subjectCredits)
    const intro = findGroupById(result.groups, 'intro')
    expect(intro).toBeDefined()
    expect(intro!.satisfied).toBe(true)
    expect(intro!.shortfall).toBe(0)
  })

  it('類専門科目の必修（major-req）を1科目だけ修得した場合、不足単位が正しく減る', () => {
    const majorReqDefinition = findRequirementGroupById(media.groups, 'major-req')
    expect(majorReqDefinition).toBeDefined()
    const firstCode = majorReqDefinition!.subjects![0]
    const firstCredits = subjectCredits.get(firstCode)!

    const result = evaluateRequirements(requirementSet, records({ [firstCode]: 'passed' }), subjectCredits)
    const majorReq = findGroupById(result.groups, 'major-req')
    expect(majorReq).toBeDefined()
    expect(majorReq!.contribution).toBe(firstCredits)
    expect(majorReq!.shortfall).toBe(majorReqDefinition!.required - firstCredits)
  })
})

/** RequirementGroup（入力側の木）から id で検索する、統合テスト用のヘルパー */
function findRequirementGroupById(groups: readonly RequirementGroup[], id: string): RequirementGroup | undefined {
  for (const group of groups) {
    if (group.id === id) return group
    if (group.children) {
      const found = findRequirementGroupById(group.children, id)
      if (found) return found
    }
  }
  return undefined
}
