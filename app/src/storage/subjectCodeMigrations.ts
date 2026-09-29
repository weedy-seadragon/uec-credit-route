// 起動時に科目コードをキーとして保存されたブラウザデータを移し替える。
import codeMigrations from '../../data/subjects/code-migrations.json'
import { migrateCodeMap, migrateCodeRecord, migrateCodeSet } from '../domain/codeMigrations'
import { loadFromStorage, saveToStorage } from './localStorage'

export const SUBJECT_CODE_MIGRATIONS = codeMigrations as Readonly<Record<string, string>>
const MIGRATIONS = SUBJECT_CODE_MIGRATIONS
let migrationNotice: string | null = null
let migrationRan = false

/** 各保存領域を一度だけ移行し、メイン画面で知らせる文面を用意する。 */
export function migrateStoredSubjectCodes(): void {
  if (migrationRan) return
  migrationRan = true

  const records = loadFromStorage<Record<string, 'passed' | 'taking' | 'failed'>>('records') ?? {}
  const recordResult = migrateCodeMap(new Map(Object.entries(records)), MIGRATIONS)
  const allowed = Object.fromEntries(Object.entries(MIGRATIONS).filter(([oldCode]) => !recordResult.blockedCodes.includes(oldCode)))

  if (recordResult.movedCodes.length > 0) {
    saveToStorage('records', Object.fromEntries(recordResult.value))
  }
  const retakeValue = loadFromStorage<unknown>('retakingPlanCodes')
  if (Array.isArray(retakeValue)) {
    const retakeResult = migrateCodeSet(new Set(retakeValue.filter((code): code is string => typeof code === 'string')), allowed)
    if (retakeResult.movedCodes.length > 0) saveToStorage('retakingPlanCodes', [...retakeResult.value])
  }
  const hiddenValue = loadFromStorage<unknown>('timetableHiddenCourses')
  if (Array.isArray(hiddenValue)) {
    const hiddenResult = migrateCodeSet(new Set(hiddenValue.filter((code): code is string => typeof code === 'string')), allowed)
    if (hiddenResult.movedCodes.length > 0) saveToStorage('timetableHiddenCourses', [...hiddenResult.value])
  }
  const selectionValue = loadFromStorage<unknown>('timetableOfferingSelection')
  if (selectionValue && typeof selectionValue === 'object' && !Array.isArray(selectionValue)) {
    const selectionResult = migrateCodeRecord(
      Object.fromEntries(Object.entries(selectionValue).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
      allowed,
    )
    if (selectionResult.movedCodes.length > 0) saveToStorage('timetableOfferingSelection', selectionResult.value)
  }

  if (recordResult.movedCodes.length > 0 || recordResult.blockedCodes.length > 0) {
    const messages = []
    if (recordResult.movedCodes.length > 0) {
      messages.push(`学域特別講義の登録を新しい区分（A＝1単位、B＝2単位）に移しました（${recordResult.movedCodes.length}件）`)
    }
    if (recordResult.blockedCodes.length > 0) {
      messages.push('学域特別講義の登録を確認してください（旧区分のまま残っている科目があります）')
    }
    migrationNotice = messages.join(' ')
  }
}

/** 起動時に作った案内文を、一度だけ画面へ渡す。 */
export function consumeSubjectCodeMigrationNotice(): string | null {
  const notice = migrationNotice
  migrationNotice = null
  return notice
}
