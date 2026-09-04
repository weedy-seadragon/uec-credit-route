// ユーザーの履修記録（科目ごとの状態）のlocalStorage保存・読み込み。
//
// requirements.ts の SubjectStatus 型（'passed' | 'taking' | 'failed'）をそのまま使う。
// 「未履修」はこの型の値を持たない（＝Mapにそのキーが無い）ことで表す。
import type { SubjectStatus } from '../domain/requirements'
import { loadFromStorage, saveToStorage } from './localStorage'

const STORAGE_KEY = 'records'

export function loadRecords(): ReadonlyMap<string, SubjectStatus> {
  const obj = loadFromStorage<Record<string, SubjectStatus>>(STORAGE_KEY)
  return new Map(Object.entries(obj ?? {}))
}

export function saveRecords(records: ReadonlyMap<string, SubjectStatus>): void {
  saveToStorage(STORAGE_KEY, Object.fromEntries(records))
}
