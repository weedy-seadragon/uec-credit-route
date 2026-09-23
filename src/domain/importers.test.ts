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

  it('schemaVersion 5で他類専門科目の認定単位数・科目数を読み込める', () => {
    // 他類専門科目の認定は、共通単位認定と同じく単位数と科目数を独立して保存する。
    const json = {
      schemaVersion: 5,
      exportedAt: '2026-09-08',
      records: [],
      otherClusterMajorCredits: 6,
      otherClusterMajorSubjectCount: 3,
    }
    const result = parseOwnFormat(json)
    expect(result.otherClusterMajorCredits).toBe(6)
    expect(result.otherClusterMajorSubjectCount).toBe(3)
  })

  it('otherCommonCreditsが無い古い形式（schemaVersion 1）でもundefinedとして読み込める', () => {
    const json = { schemaVersion: 1, exportedAt: '2026-09-04', records: [] }
    const result = parseOwnFormat(json)
    expect(result.otherCommonCredits).toBeUndefined()
  })
})

// 手で編集されたり壊れたりしたファイルでも、おかしな値だけを未登録扱いにして集計を壊さないことを確認する
describe('parseOwnFormat の値の検証', () => {
  it('状態や科目番号がおかしい記録は読み込まず、正しい記録だけを残す', () => {
    // 状態の打ち間違い・科目番号が数値や空文字・記録自体がnull、はどれも「書かれていない」扱い。
    const json = {
      schemaVersion: 5,
      exportedAt: '2026-09-24',
      records: [
        { code: 'COM401a', status: 'passed' },
        { code: 'COM402a', status: 'done' },
        { code: 123, status: 'passed' },
        { code: '', status: 'taking' },
        null,
        { code: 'COM405a', status: 'taking' },
      ],
    }
    const result = parseOwnFormat(json)
    expect(result.records).toEqual([
      { code: 'COM401a', status: 'passed' },
      { code: 'COM405a', status: 'taking' },
    ])
    expect(result.ignoredCount).toBe(4)
  })

  it('範囲外・整数でない単位数と科目数は、ファイルに書かれていないのと同じ扱い（undefined）にする', () => {
    // 画面のプルダウンで選べない値（負の数・小数・文字列・上限超え）は、今の値を変えないようにする。
    const json = {
      schemaVersion: 5,
      exportedAt: '2026-09-24',
      records: [],
      otherCommonCredits: -2,
      otherCommonSubjectCount: 1.5,
      otherClusterMajorCredits: '4',
      otherClusterMajorSubjectCount: 5,
    }
    const result = parseOwnFormat(json)
    expect(result.otherCommonCredits).toBeUndefined()
    expect(result.otherCommonSubjectCount).toBeUndefined()
    expect(result.otherClusterMajorCredits).toBeUndefined()
    expect(result.otherClusterMajorSubjectCount).toBeUndefined()
    expect(result.ignoredCount).toBe(4)
  })

  it('正しい値だけのファイルでは、読み飛ばした件数は0になる', () => {
    // 範囲の上限ちょうど（単位数8・科目数4）も正しい値として読み込む。
    const json = {
      schemaVersion: 5,
      exportedAt: '2026-09-24',
      records: [{ code: 'COM401a', status: 'failed' }],
      otherCommonCredits: 8,
      otherClusterMajorSubjectCount: 4,
    }
    const result = parseOwnFormat(json)
    expect(result.otherCommonCredits).toBe(8)
    expect(result.otherClusterMajorSubjectCount).toBe(4)
    expect(result.ignoredCount).toBe(0)
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
