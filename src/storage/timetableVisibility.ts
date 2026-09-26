// 時間割プレビューで非表示にした科目番号だけを、入学年度ごとにブラウザへ保存する。
import { loadFromStorage, saveToStorage } from './localStorage'

/** 入学年度ごとに表示設定を分離するための保存キー。 */
function storageKey(entryYear: number): string {
  // 同じ科目番号を別年度で使っていても、表示の好みが混ざらないようにする。
  return `timetableHiddenCourses:${entryYear}`
}

/** 保存済みの非表示科目を読み、壊れた値なら空集合へ戻す。 */
export function loadHiddenTimetableCourses(entryYear: number): ReadonlySet<string> {
  const value = loadFromStorage<unknown>(storageKey(entryYear))
  // localStorage は利用者が書き換えられるため、文字列の配列だけを採用する。
  if (!Array.isArray(value)) return new Set()
  return new Set(value.filter((code): code is string => typeof code === 'string'))
}

/** 非表示科目の集合を、JSONへ含めず localStorage だけへ保存する。 */
export function saveHiddenTimetableCourses(entryYear: number, codes: ReadonlySet<string>): void {
  // 既存の共通ラッパーが JSON 化と try/catch をまとめて担当する。
  saveToStorage(storageKey(entryYear), [...codes])
}
