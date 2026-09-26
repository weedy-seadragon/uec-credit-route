// localStorage内の履修記録と時間割設定を、画面のstate初期化前に移すことを確かめる。
import { describe, expect, it, vi } from 'vitest'
import { consumeSubjectCodeMigrationNotice, migrateStoredSubjectCodes } from './subjectCodeMigrations'

// 一度の起動移行で、履修記録と科目番号キーのブラウザ設定が一緒に引き継がれる。
describe('保存済み学域特別講義コードの移行', () => {
  // 記録・再履修予定・非表示設定・選択セクションを移し、利用者へ件数を知らせる。
  it('科目番号をキーにしたlocalStorageの各値を移行する', () => {
    const stored = new Map<string, string>([
      ['uec-credit-route:records', JSON.stringify({ UEC002z: 'passed' })],
      ['uec-credit-route:retakingPlanCodes', JSON.stringify(['UEC003z'])],
      ['uec-credit-route:timetableHiddenCourses', JSON.stringify(['UEC002z'])],
      ['uec-credit-route:timetableOfferingSelection', JSON.stringify({ UEC003z: '2026-OS' })],
    ])
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => stored.set(key, value),
      },
    })

    migrateStoredSubjectCodes()

    expect(JSON.parse(stored.get('uec-credit-route:records')!)).toEqual({ UEC001z: 'passed' })
    expect(JSON.parse(stored.get('uec-credit-route:retakingPlanCodes')!)).toEqual(['UEC004z'])
    expect(JSON.parse(stored.get('uec-credit-route:timetableHiddenCourses')!)).toEqual(['UEC001z'])
    expect(JSON.parse(stored.get('uec-credit-route:timetableOfferingSelection')!)).toEqual({ UEC004z: '2026-OS' })
    expect(consumeSubjectCodeMigrationNotice()).toBe('学域特別講義の登録を新しい区分（A＝1単位、B＝2単位）に移しました（1件）')
    expect(consumeSubjectCodeMigrationNotice()).toBeNull()
    vi.unstubAllGlobals()
  })
})
