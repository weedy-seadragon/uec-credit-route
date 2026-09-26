// 時間割プレビューで非表示にした科目番号だけを、年度共通でブラウザへ保存する。
import { loadFromStorage, saveToStorage } from './localStorage'

/** 履修記録とは独立した表示設定の保存キー。 */
const STORAGE_KEY = 'timetableHiddenCourses'

/** 保存済みの非表示科目を読み、壊れた値なら空集合へ戻す。 */
export function loadHiddenTimetableCourses(): ReadonlySet<string> {
  const value = loadFromStorage<unknown>(STORAGE_KEY)
  // localStorage は利用者が書き換えられるため、文字列の配列だけを採用する。
  if (!Array.isArray(value)) return new Set()
  return new Set(value.filter((code): code is string => typeof code === 'string'))
}

/** 非表示科目の集合を、JSONへ含めず localStorage だけへ保存する。 */
export function saveHiddenTimetableCourses(codes: ReadonlySet<string>): void {
  // 既存の共通ラッパーが JSON 化と try/catch をまとめて担当する。
  saveToStorage(STORAGE_KEY, [...codes])
}
