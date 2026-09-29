// 時間割プレビューで選んだ開講セクションを、履修記録と分けて保存する。
import { loadFromStorage, saveToStorage } from './localStorage'

/** 年度共通のプレビュー表示設定キー。 */
const STORAGE_KEY = 'timetableOfferingSelection'

/** セクション選択を読み、文字列どうしの対応だけを受け入れる。 */
export function loadTimetableOfferingSelection(): Readonly<Record<string, string>> {
  const value = loadFromStorage<unknown>(STORAGE_KEY)
  // 壊れた保存値で画面を壊さないよう、科目番号と時間割コードが文字列の項目だけを採用する。
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([courseCode, timetableCode]) =>
    courseCode.length > 0 && typeof timetableCode === 'string' && timetableCode.length > 0,
  ))
}

/** 選んだ時間割コードの対応をJSONバックアップとは別に保存する。 */
export function saveTimetableOfferingSelection(selections: Readonly<Record<string, string>>): void {
  // 共通のlocalStorageラッパーが書き込み失敗を捕捉する。
  saveToStorage(STORAGE_KEY, selections)
}
