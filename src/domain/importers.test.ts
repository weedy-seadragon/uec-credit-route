import { describe, expect, it } from 'vitest'
import { mergeRecords, parseOwnFormat } from './importers'
import type { SubjectStatus } from './requirements'

// 正しい形式は読み込めること、壊れた形式（バージョン不一致・必須項目欠落・型違い）は
// きちんとエラーを投げること（＝呼び出し側が例外メッセージを出せること）を確認する
describe('parseOwnFormat', () => {
  it('正しい形式のJSONを読み込める', () => {
    const json = {
      schemaVersion: 1,
      exportedAt: '2026-09-04T00:00:00+09:00',
      profile: { entryYear: 2025, course: 'day', cluster: 'I', program: 'media', grade: 2 },
      records: [{ code: 'COM405a', status: 'passed' }],
      planned: ['COM501a'],
    }
    const result = parseOwnFormat(json)
    expect(result.profile?.program).toBe('media')
    expect(result.records).toEqual([{ code: 'COM405a', status: 'passed' }])
    expect(result.planned).toEqual(['COM501a'])
  })

  it('planned が無くても空配列として読み込める', () => {
    // 古いバージョンのファイルなどでplannedキーが無くても、落ちずに空配列になるはず
    const json = { schemaVersion: 1, exportedAt: '2026-09-04', records: [] }
    const result = parseOwnFormat(json)
    expect(result.planned).toEqual([])
  })

  it('schemaVersion が対応外だとエラーになる', () => {
    const json = { schemaVersion: 99, records: [] }
    expect(() => parseOwnFormat(json)).toThrow(/schemaVersion/)
  })

  it('records が無いとエラーになる', () => {
    const json = { schemaVersion: 1 }
    expect(() => parseOwnFormat(json)).toThrow(/records/)
  })

  it('オブジェクトでないデータはエラーになる', () => {
    // null・文字列・数値など、そもそも{...}の形をしていない値をすべて拒否できるか
    expect(() => parseOwnFormat(null)).toThrow()
    expect(() => parseOwnFormat('not json')).toThrow()
    expect(() => parseOwnFormat(42)).toThrow()
  })

  it('schemaVersion 2でotherCommonCreditsを読み込める', () => {
    const json = { schemaVersion: 2, exportedAt: '2026-09-07', records: [], otherCommonCredits: 4 }
    const result = parseOwnFormat(json)
    expect(result.otherCommonCredits).toBe(4)
  })

  it('schemaVersion 3でその他単位認定の科目数を読み込める', () => {
    // 単位数と科目数は別に記録するため、同じJSONから両方の値を取り出せることを確認する。
    const json = {
      schemaVersion: 3,
      exportedAt: '2026-09-08',
      records: [],
      otherCommonCredits: 4,
      otherCommonSubjectCount: 2,
    }
    const result = parseOwnFormat(json)
    expect(result.otherCommonCredits).toBe(4)
    expect(result.otherCommonSubjectCount).toBe(2)
  })

  it('schemaVersion 4で再履修予定科目を読み込める', () => {
    // 不合格から修得予定へ変えた科目は、曜日時限の重複判定でも再履用の枠を使うため保存する。
    const json = { schemaVersion: 4, exportedAt: '2026-09-08', records: [], retakingPlanCodes: ['COM401f', 42] }
    const result = parseOwnFormat(json)
    expect(result.retakingPlanCodes).toEqual(['COM401f'])
  })

  it('otherCommonCreditsが無い古い形式（schemaVersion 1）でもundefinedとして読み込める', () => {
    const json = { schemaVersion: 1, exportedAt: '2026-09-04', records: [] }
    const result = parseOwnFormat(json)
    expect(result.otherCommonCredits).toBeUndefined()
  })
})

// 既存の記録とファイルから読み込んだ記録を合体させるルール
// （上書きはしない・同じ科目はファイル側で更新・新規は追加）を確認する
describe('mergeRecords', () => {
  it('新しい科目は追加され、既存の科目はファイル側の状態で更新される', () => {
    const existing = new Map<string, SubjectStatus>([
      ['A1', 'passed'],
      ['A2', 'failed'],
    ])
    const incoming = [
      { code: 'A2', status: 'passed' as SubjectStatus }, // 再履修に合格 → 更新される
      { code: 'A3', status: 'taking' as SubjectStatus }, // 新規追加
    ]
    const { merged, added, updated } = mergeRecords(existing, incoming)

    expect(merged.get('A1')).toBe('passed') // ファイルに無い既存の記録はそのまま残る
    expect(merged.get('A2')).toBe('passed') // ファイル側の状態で上書き
    expect(merged.get('A3')).toBe('taking') // 新規追加
    expect(added).toBe(1)
    expect(updated).toBe(1)
  })

  it('既存のMapを書き換えない（新しいMapを返す）', () => {
    // mergeRecords に渡した existing 自身は変化せず、別の新しいMapが返ることを確認する
    const existing = new Map<string, SubjectStatus>([['A1', 'passed']])
    const { merged } = mergeRecords(existing, [{ code: 'A2', status: 'passed' }])
    expect(existing.has('A2')).toBe(false)
    expect(merged.has('A2')).toBe(true)
  })
})
