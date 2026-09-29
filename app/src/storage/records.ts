// ユーザーの履修記録（科目ごとの状態）のlocalStorage保存・読み込み。
//
// requirements.ts の SubjectStatus 型（'passed' | 'taking' | 'failed'）をそのまま使う。
// 「未履修」はこの型の値を持たない（＝Mapにそのキーが無い）ことで表す。
import type { SubjectStatus } from '../domain/requirements'
import { loadFromStorage, saveToStorage } from './localStorage'

const STORAGE_KEY = 'records'

/**
 * 保存済みの履修記録を読み込む。localStorageにはJSONのオブジェクト（{code: status, ...}）として
 * 保存されているので、requirements.tsの関数がそのまま使えるように Map に変換する。
 */
export function loadRecords(): ReadonlyMap<string, SubjectStatus> {
  const obj = loadFromStorage<Record<string, SubjectStatus>>(STORAGE_KEY)
  return new Map(Object.entries(obj ?? {}))
}

/** 履修記録をまるごと上書き保存する。Mapのままではlocalstorage.tsがJSON化できないので、先に普通のオブジェクトに戻す */
export function saveRecords(records: ReadonlyMap<string, SubjectStatus>): void {
  saveToStorage(STORAGE_KEY, Object.fromEntries(records))
}
