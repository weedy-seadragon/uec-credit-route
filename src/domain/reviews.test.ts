// reviews.ts の単体テスト。allOf/anyOf・各条件タイプ・審査どうしの参照(review)を検証する。
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { evaluateRequirements } from './requirements'
import type { RequirementGroup, RequirementSet, ReviewDef, SubjectStatus } from './requirements'
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
    expect(evaluateReviews([review], evaluate({ S1: 'passed', S2: 'passed' }), records(), subjectCredits).at(0)?.satisfied).toBe(true)
    expect(evaluateReviews([review], evaluate({ S1: 'passed' }), records(), subjectCredits).at(0)?.satisfied).toBe(false)
  })

  it('allPassed：指定グループを（必修として）すべて修得しているかで判定する', () => {
    const review: ReviewDef = { id: 'r', name: 'テスト審査', allOf: [{ type: 'allPassed', groupId: 'g1' }] }
    expect(evaluateReviews([review], evaluate({ R1: 'passed' }), records(), subjectCredits).at(0)?.satisfied).toBe(true)
    expect(evaluateReviews([review], evaluate({}), records(), subjectCredits).at(0)?.satisfied).toBe(false)
  })

  it('subjects：グループに属さない個別の科目番号をすべて修得しているかで判定する', () => {
    const review: ReviewDef = { id: 'r', name: 'テスト審査', allOf: [{ type: 'subjects', codes: ['R1', 'R2'] }] }
    const passedRecords = records({ R1: 'passed', R2: 'passed' })
    expect(evaluateReviews([review], evaluate({ R1: 'passed', R2: 'passed' }), passedRecords, subjectCredits).at(0)?.satisfied).toBe(true)
    expect(evaluateReviews([review], evaluate({ R1: 'passed' }), records({ R1: 'passed' }), subjectCredits).at(0)?.satisfied).toBe(false)
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
    const result = evaluateReviews([review], evaluate({ R1: 'passed', R2: 'passed', S1: 'passed', S2: 'passed', S3: 'passed' }), records(), subjectCredits)
    expect(result.at(0)?.satisfied).toBe(true)
  })

  it('allGroups：すべての判定境界グループが満たされているかで判定する（卒業審査想定）', () => {
    const review: ReviewDef = { id: 'r', name: '卒業審査', allOf: [{ type: 'allGroups' }] }
    const allPassed = evaluate({ R1: 'passed', R2: 'passed', S1: 'passed', S2: 'passed' })
    expect(evaluateReviews([review], allPassed, records(), subjectCredits).at(0)?.satisfied).toBe(true)
    const partial = evaluate({ R1: 'passed' })
    expect(evaluateReviews([review], partial, records(), subjectCredits).at(0)?.satisfied).toBe(false)
  })

  it('subjectsCountMin：指定科目のうち修得済みがmin科目以上かで判定する（単位数ではなく科目数）', () => {
    // S1〜S4はそれぞれ2単位だが、ここでは単位数を無視して「何科目受かったか」だけを見る
    const review: ReviewDef = { id: 'r', name: 'テスト審査', allOf: [{ type: 'subjectsCountMin', codes: ['S1', 'S2', 'S3', 'S4'], min: 3 }] }
    const threePassed = records({ S1: 'passed', S2: 'passed', S3: 'passed' })
    expect(evaluateReviews([review], evaluate({ S1: 'passed', S2: 'passed', S3: 'passed' }), threePassed, subjectCredits).at(0)?.satisfied).toBe(true)
    const twoPassed = records({ S1: 'passed', S2: 'passed' })
    expect(evaluateReviews([review], evaluate({ S1: 'passed', S2: 'passed' }), twoPassed, subjectCredits).at(0)?.satisfied).toBe(false)
  })

  it('subjectsCreditMin：複数グループにまたがる科目の単位数を合算してmin以上かで判定する', () => {
    // R1（g1所属）とS1（g3所属）という別グループの科目をまたいで合算する
    const review: ReviewDef = { id: 'r', name: 'テスト審査', allOf: [{ type: 'subjectsCreditMin', codes: ['R1', 'S1', 'S2'], min: 4 }] }
    // R1(2)+S1(2)=4単位でちょうど満たす
    const r1AndS1 = records({ R1: 'passed', S1: 'passed' })
    expect(evaluateReviews([review], evaluate({ R1: 'passed', S1: 'passed' }), r1AndS1, subjectCredits).at(0)?.satisfied).toBe(true)
    // R1(2)だけでは4単位に届かない
    const r1Only = records({ R1: 'passed' })
    expect(evaluateReviews([review], evaluate({ R1: 'passed' }), r1Only, subjectCredits).at(0)?.satisfied).toBe(false)
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
    const result = evaluateReviews([review], evaluate({ S1: 'passed', S2: 'passed', S3: 'passed', S4: 'passed' }), records(), subjectCredits)
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
    const result = evaluateReviews([review], evaluate({ R1: 'passed' }), records(), subjectCredits)
    expect(result.at(0)?.satisfied).toBe(false)
    expect(result.at(0)?.unsatisfied).toEqual([{ type: 'allPassed', groupId: 'g2' }])
  })
})

describe('evaluateReviews（審査どうしの参照）', () => {
  it('review条件は、参照先の審査の合否をそのまま使う', () => {
    const y2: ReviewDef = { id: 'y2', name: '2年次終了時審査', allOf: [{ type: 'allPassed', groupId: 'g1' }] }
    const thesis: ReviewDef = { id: 'thesis', name: '卒業研究着手審査', allOf: [{ type: 'review', id: 'y2' }, { type: 'allPassed', groupId: 'g2' }] }

    const bothPassed = evaluate({ R1: 'passed', R2: 'passed' })
    const results1 = evaluateReviews([y2, thesis], bothPassed, records(), subjectCredits)
    expect(results1.map((r) => r.satisfied)).toEqual([true, true])

    // 2年次審査(g1)は合格しているが、g2が未修得なので卒研着手は不合格
    const onlyG1 = evaluate({ R1: 'passed' })
    const results2 = evaluateReviews([y2, thesis], onlyG1, records(), subjectCredits)
    expect(results2.map((r) => r.satisfied)).toEqual([true, false])
  })

  it('onFailの情報はそのまま結果に含める', () => {
    const review: ReviewDef = {
      id: 'r',
      name: 'テスト審査',
      allOf: [{ type: 'allPassed', groupId: 'g1' }],
      onFail: { blockedSubjects: ['S1'], note: '不合格時はS1を履修できない' },
    }
    const result = evaluateReviews([review], evaluate({}), records(), subjectCredits)
    expect(result.at(0)?.onFail).toEqual({ blockedSubjects: ['S1'], note: '不合格時はS1を履修できない' })
  })

  it('caveatの情報は合否に関わらずそのまま結果に含める', () => {
    const review: ReviewDef = {
      id: 'r',
      name: 'テスト審査',
      allOf: [{ type: 'allPassed', groupId: 'g1' }],
      caveat: 'この審査基準を満たした上、会議の了承を必要とする',
    }
    const passed = evaluateReviews([review], evaluate({ R1: 'passed' }), records(), subjectCredits)
    expect(passed.at(0)?.caveat).toBe('この審査基準を満たした上、会議の了承を必要とする')
    const failed = evaluateReviews([review], evaluate({}), records(), subjectCredits)
    expect(failed.at(0)?.caveat).toBe('この審査基準を満たした上、会議の了承を必要とする')
  })
})

// ---------------------------------------------------------------------------
// 実データでの統合テスト（requirements.test.ts と同じ考え方。ここではreviewsだけ見る）
// ---------------------------------------------------------------------------

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
function loadJson(relativePathFromProjectRoot: string): unknown {
  return JSON.parse(readFileSync(path.join(projectRoot, relativePathFromProjectRoot), 'utf-8'))
}

describe('実データ（Ⅰ類メディア情報学プログラム）でのreviews評価', () => {
  const common = loadJson('data/requirements/2025-day-common.json') as {
    groups: RequirementGroup[]
    commonCreditSources?: { alwaysCommon?: string[] }
  }
  const media = loadJson('data/requirements/2025-day-I-media.json') as {
    totalCredits: number
    commonCredits: number
    groups: RequirementGroup[]
    reviews: ReviewDef[]
  }
  const subjectsMaster = loadJson('data/subjects/youran-2025.json') as { subjects: { code: string; credits: number }[] }
  const subjectCredits = new Map(subjectsMaster.subjects.map((s) => [s.code, s.credits]))
  const mediaRequirementSet: RequirementSet = {
    totalCredits: media.totalCredits,
    commonCredits: media.commonCredits,
    groups: [...common.groups, ...media.groups],
    alwaysCommonSubjects: common.commonCreditSources?.alwaysCommon ?? [],
  }

  it('何も履修していない状態では、3つの審査すべてが不合格（エラー無く実データが評価できることの確認も兼ねる）', () => {
    const evaluation = evaluateRequirements(mediaRequirementSet, records({}), subjectCredits)
    const result = evaluateReviews(media.reviews, evaluation, records({}), subjectCredits)
    expect(result.map((r) => r.id)).toEqual(['y2-end', 'thesis-start', 'graduation'])
    expect(result.every((r) => !r.satisfied)).toBe(true)
    // 各審査、不合格の原因が最低1つは説明できる状態になっている
    expect(result.every((r) => r.unsatisfied.length > 0)).toBe(true)
  })

  it('2年次終了時審査の条件をすべて修得すると、その審査だけ合格になる（卒研着手はまだ不合格）', () => {
    const y2Review = media.reviews.find((r) => r.id === 'y2-end')
    expect(y2Review).toBeDefined()
    // y2-endのallOf[0]（allOfの中のallOf）に出てくる科目コードを全部拾って合格にする
    const codes = collectAllReferencedCodes(y2Review, [common.groups, media.groups])
    const allPassedRecords = records(Object.fromEntries([...codes].map((c) => [c, 'passed' as SubjectStatus])))
    const evaluation = evaluateRequirements(mediaRequirementSet, allPassedRecords, subjectCredits)
    const result = evaluateReviews(media.reviews, evaluation, allPassedRecords, subjectCredits)
    const byId = Object.fromEntries(result.map((r) => [r.id, r]))
    expect(byId['y2-end'].satisfied).toBe(true)
    expect(byId['thesis-start'].satisfied).toBe(false)
  })
})

describe('実データ（Ⅱ類情報通信工学プログラム）でのreviews評価', () => {
  const common = loadJson('data/requirements/2025-day-common.json') as { groups: RequirementGroup[] }
  const netinfo = loadJson('data/requirements/2025-day-II-netinfo.json') as {
    totalCredits: number
    commonCredits: number
    groups: RequirementGroup[]
    reviews: ReviewDef[]
  }
  const subjectsMaster = loadJson('data/subjects/youran-2025.json') as { subjects: { code: string; credits: number }[] }
  const subjectCredits = new Map(subjectsMaster.subjects.map((s) => [s.code, s.credits]))
  const netinfoSet: RequirementSet = {
    totalCredits: netinfo.totalCredits,
    commonCredits: netinfo.commonCredits,
    groups: [...common.groups, ...netinfo.groups],
  }

  // 情報通信工学プログラムのthesis-startは、subjectsCountMin（類共通基礎科目の必修10科目のうち
  // 9科目以上）とsubjectsCreditMin（必修＋選択必修のうち21単位以上）を両方使う唯一の実データなので、
  // 実際のJSONを読み込んで壊れていないことを確認する
  it('審査条件で名指しされた科目だけ修得すると、y2-endは合格・thesis-startは単位数不足以外の理由では不合格にならない', () => {
    // thesis-startには合計単位数（104単位）の条件も別にあり、名指しされた科目だけでは
    // 全然足りない（卒業所要133単位のうちのごく一部）ので、ここでは「合格になる」ではなく
    // 「subjectsCountMin/subjectsCreditMinなど新しい条件タイプのところで引っかからない」ことを確認する
    const codes = collectAllReferencedCodes(netinfo.reviews, [common.groups, netinfo.groups])
    const allPassedRecords = records(Object.fromEntries([...codes].map((c) => [c, 'passed' as SubjectStatus])))
    const evaluation = evaluateRequirements(netinfoSet, allPassedRecords, subjectCredits)
    const result = evaluateReviews(netinfo.reviews, evaluation, allPassedRecords, subjectCredits)
    const byId = Object.fromEntries(result.map((r) => [r.id, r]))
    expect(byId['y2-end'].satisfied).toBe(true)
    expect(byId['thesis-start'].satisfied).toBe(false)
    // 残っている不合格理由は「合計104単位以上」だけのはず（類共通基礎科目・類専門科目の条件は満たしている）
    expect(byId['thesis-start'].unsatisfied).toEqual([{ type: 'totalCredits', min: 104 }])
  })

  it('類共通基礎科目の必修10科目のうち2科目落として8科目になると、9科目以上条件を割り込みthesis-startは不合格になる', () => {
    const codes = collectAllReferencedCodes(netinfo.reviews, [common.groups, netinfo.groups])
    // cluster-basic-reqの必修10科目のうち、応用数学A・応用数学B（MTH302g・MTH401g）の2科目を落とす
    codes.delete('MTH302g')
    codes.delete('MTH401g')
    const records1 = records(Object.fromEntries([...codes].map((c) => [c, 'passed' as SubjectStatus])))
    const evaluation = evaluateRequirements(netinfoSet, records1, subjectCredits)
    const result = evaluateReviews(netinfo.reviews, evaluation, records1, subjectCredits)
    const byId = Object.fromEntries(result.map((r) => [r.id, r]))
    expect(byId['thesis-start'].satisfied).toBe(false)
    // 9科目以上条件（subjectsCountMin）が不合格理由として挙がっていることを確認する
    expect(byId['thesis-start'].unsatisfied.some((c) => c.type === 'subjectsCountMin')).toBe(true)
  })
})

describe('実データ（Ⅲ類機械システムプログラム）でのreviews評価', () => {
  const common = loadJson('data/requirements/2025-day-common.json') as { groups: RequirementGroup[] }
  const mecha = loadJson('data/requirements/2025-day-III-mecha.json') as {
    totalCredits: number
    commonCredits: number
    groups: RequirementGroup[]
    reviews: ReviewDef[]
  }
  const subjectsMaster = loadJson('data/subjects/youran-2025.json') as { subjects: { code: string; credits: number }[] }
  const subjectCredits = new Map(subjectsMaster.subjects.map((s) => [s.code, s.credits]))
  const mechaSet: RequirementSet = {
    totalCredits: mecha.totalCredits,
    commonCredits: mecha.commonCredits,
    groups: [...common.groups, ...mecha.groups],
  }

  // 機械システムプログラムのthesis-startは、類共通基礎科目と類専門科目にまたがる
  // subjectsCreditMin（2年次までの必修9科目21単位のうち16単位以上）を使う実データの代表例
  it('審査条件で名指しされた科目だけ修得すると、y2-endは合格・thesis-startは単位数不足以外の理由では不合格にならない', () => {
    // netinfoのテストと同じ理由（合計104単位の条件は名指しされた科目だけでは満たせない）で、
    // ここでは「合格になる」ではなく「subjectsCreditMinのところで引っかからない」ことを確認する
    const codes = collectAllReferencedCodes(mecha.reviews, [common.groups, mecha.groups])
    const allPassedRecords = records(Object.fromEntries([...codes].map((c) => [c, 'passed' as SubjectStatus])))
    const evaluation = evaluateRequirements(mechaSet, allPassedRecords, subjectCredits)
    const result = evaluateReviews(mecha.reviews, evaluation, allPassedRecords, subjectCredits)
    const byId = Object.fromEntries(result.map((r) => [r.id, r]))
    expect(byId['y2-end'].satisfied).toBe(true)
    expect(byId['thesis-start'].satisfied).toBe(false)
    expect(byId['thesis-start'].unsatisfied).toEqual([{ type: 'totalCredits', min: 104 }])
  })

  it('cross-group条件（21単位のうち16単位以上）に絡む科目を落とすとthesis-startが不合格になる', () => {
    const codes = collectAllReferencedCodes(mecha.reviews, [common.groups, mecha.groups])
    // 基礎電気回路(ELE301k,2)・基礎電磁気学および演習(PHY302k,3)・熱力学(PHY301k,2)の
    // 計7単位を落とす（別表4の「類専門科目」条件が参照する科目とは重ならないものを選び、
    // cross-group条件（21単位中16単位以上）だけをピンポイントで割り込ませる：21-7=14<16）
    codes.delete('ELE301k')
    codes.delete('PHY302k')
    codes.delete('PHY301k')
    const rec = records(Object.fromEntries([...codes].map((c) => [c, 'passed' as SubjectStatus])))
    const evaluation = evaluateRequirements(mechaSet, rec, subjectCredits)
    const result = evaluateReviews(mecha.reviews, evaluation, rec, subjectCredits)
    const byId = Object.fromEntries(result.map((r) => [r.id, r]))
    expect(byId['thesis-start'].satisfied).toBe(false)
    // cross-group条件（subjectsCreditMin）が不合格理由として挙がっていることを確認する
    expect(byId['thesis-start'].unsatisfied.some((c) => c.type === 'subjectsCreditMin')).toBe(true)
  })
})

/**
 * 審査データ（allOf/anyOfの木）の中で参照されているすべての科目コードを集める
 * （subjects/subjectsCountMin/subjectsCreditMinのcodesと、allPassed/groupMinが参照する
 * グループの中身の科目を両方拾う）。「これを全部合格にすれば審査に通るはず」というテスト用の
 * 便利関数で、requirements.test.tsのような実データ統合テストで使う
 */
function collectAllReferencedCodes(node: unknown, groupTrees: readonly RequirementGroup[][]): Set<string> {
  const codes = new Set<string>()
  function walk(n: unknown) {
    if (!n || typeof n !== 'object') return
    const rec = n as Record<string, unknown>
    if (
      (rec.type === 'subjects' || rec.type === 'subjectsCountMin' || rec.type === 'subjectsCreditMin') &&
      Array.isArray(rec.codes)
    ) {
      for (const c of rec.codes) codes.add(c as string)
    }
    if ((rec.type === 'allPassed' || rec.type === 'groupMin') && typeof rec.groupId === 'string') {
      for (const tree of groupTrees) {
        const g = findRequirementGroupById(tree, rec.groupId)
        for (const c of g?.subjects ?? []) codes.add(c)
      }
    }
    for (const v of Object.values(rec)) {
      if (Array.isArray(v)) v.forEach(walk)
    }
  }
  if (Array.isArray(node)) node.forEach(walk)
  else walk(node)
  return codes
}

/** RequirementGroup木をidで検索する（requirements.test.tsのfindRequirementGroupByIdと同じ発想） */
function findRequirementGroupById(groups: readonly RequirementGroup[], id: string): RequirementGroup | undefined {
  for (const g of groups) {
    if (g.id === id) return g
    const found = g.children ? findRequirementGroupById(g.children, id) : undefined
    if (found) return found
  }
  return undefined
}
