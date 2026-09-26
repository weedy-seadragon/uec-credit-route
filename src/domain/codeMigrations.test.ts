// 科目コード統合時に履修記録と科目番号キーの設定を安全に引き継ぐ。
import { describe, expect, it } from 'vitest'
import codeMigrations from '../../data/subjects/code-migrations.json'
import { evaluateRequirements } from './requirements'
import type { RequirementSet, SubjectStatus } from './requirements'
import { migrateCodeMap, migrateCodeRecord, migrateCodeSet } from './codeMigrations'
import { mergeRecords, parseOwnFormat } from './importers'

const migrations = codeMigrations as Readonly<Record<string, string>>

// 対応表どおりに科目状態、再履修予定、時間割設定が移るかをまとめて確かめる。
describe('学域特別講義の科目コード移行', () => {
  // 科目状態は値を保ち、科目コードをキーにする付随設定も新コードへ移す。
  it('対応表どおりに状態と科目番号キーの設定を引き継ぐ', () => {
    const records = migrateCodeMap(new Map<string, SubjectStatus>([['UEC003z', 'passed'], ['UEC002z', 'taking']]), migrations)
    expect(records.value).toEqual(new Map([['UEC004z', 'passed'], ['UEC001z', 'taking']]))
    expect(records.movedCodes).toHaveLength(2)
    expect(migrateCodeSet(new Set(['UEC003z']), migrations).value).toEqual(new Set(['UEC004z']))
    expect(migrateCodeRecord({ UEC002z: 'timetable-1' }, migrations).value).toEqual({ UEC001z: 'timetable-1' })
  })

  // すでに移し先が記録済みなら旧番号を残し、単位の登録を減らさない。
  it('移し先が登録済みなら旧番号を移さない', () => {
    const result = migrateCodeMap(new Map<string, SubjectStatus>([
      ['UEC002z', 'passed'],
      ['UEC001z', 'taking'],
    ]), migrations)
    expect(result.value).toEqual(new Map([['UEC002z', 'passed'], ['UEC001z', 'taking']]))
    expect(result.blockedCodes).toEqual(['UEC002z'])
  })

  // 移行前後の同一単位数コードは、要件判定で合計・共通単位を同じ値にする。
  it('移行の前後で合計単位と共通単位の評価が変わらない', () => {
    const requirements: RequirementSet = {
      totalCredits: 3,
      commonCredits: 3,
      groups: [],
      alwaysCommonSubjects: ['UEC001z', 'UEC002z', 'UEC003z', 'UEC004z'],
    }
    const credits = new Map([['UEC001z', 1], ['UEC002z', 1], ['UEC003z', 2], ['UEC004z', 2]])
    const before = new Map<string, SubjectStatus>([['UEC002z', 'passed'], ['UEC003z', 'taking']])
    const after = migrateCodeMap(before, migrations).value
    const oldResult = evaluateRequirements(requirements, before, credits)
    const newResult = evaluateRequirements(requirements, after, credits)
    expect(newResult.totalCredits).toEqual(oldResult.totalCredits)
    expect(newResult.commonCredits).toEqual(oldResult.commonCredits)
  })

  // JSON取込もparseOwnFormat・mergeRecordsの後に同じ移行関数を通る。
  it('JSONから読み込んだ旧番号の記録も統合後の番号へ移る', () => {
    const imported = parseOwnFormat({
      schemaVersion: 5,
      records: [{ code: 'UEC002z', status: 'passed' }],
      retakingPlanCodes: ['UEC003z'],
    })
    const merged = mergeRecords(new Map<string, SubjectStatus>(), imported.records)
    const migrated = migrateCodeMap(merged.merged, migrations)
    const retakes = migrateCodeSet(new Set(imported.retakingPlanCodes), migrations)
    expect(migrated.value.get('UEC001z')).toBe('passed')
    expect(retakes.value).toEqual(new Set(['UEC004z']))
  })
})
