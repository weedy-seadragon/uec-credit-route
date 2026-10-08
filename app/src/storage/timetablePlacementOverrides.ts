// 時間割プレビューで利用者が選んだ「この科目を受ける時期（学年・学期）」を、履修記録と分けて保存する。
// 値は科目番号→「3:前学期」「2:通年」の形の文字列。自動で決まる時期を使う科目は保存しない。
import { loadFromStorage, saveToStorage } from './localStorage'

/** 年度共通のプレビュー表示設定キー。 */
const STORAGE_KEY = 'timetablePlacementOverrides'

/** 保存済みの時期の上書きを読み、科目番号と文字列の組だけを受け入れる。 */
export function loadTimetablePlacementOverrides(): Readonly<Record<string, string>> {
  const value = loadFromStorage<unknown>(STORAGE_KEY)
  // 壊れた保存値で画面を壊さないよう、オブジェクト以外は空として扱う。
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  // 中身の形がおかしい項目（空文字・文字列以外）は読み飛ばす。
  return Object.fromEntries(Object.entries(value).filter(([courseCode, placementKey]) =>
    courseCode.length > 0 && typeof placementKey === 'string' && placementKey.length > 0,
  ))
}

/** 時期の上書きを JSON バックアップとは別に保存する。 */
export function saveTimetablePlacementOverrides(overrides: Readonly<Record<string, string>>): void {
  // 共通のlocalStorageラッパーが書き込み失敗を捕捉する。
  saveToStorage(STORAGE_KEY, overrides)
}
