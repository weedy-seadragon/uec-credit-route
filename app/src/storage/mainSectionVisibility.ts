// メイン画面の大見出しごとの開閉状態を、履修記録とは別に保存する。
import { loadFromStorage, saveToStorage } from './localStorage'

/** 年度に依存しない、メイン画面の開いた区切り一覧の保存キー。 */
const STORAGE_KEY = 'mainOpenSections'
/** 保存値が無い、または壊れているときに開いておくメイン画面の区切り。 */
export const DEFAULT_OPEN_MAIN_SECTION_IDS: readonly string[] = [
  'earned-credits',
  'planned-credits',
  'timetable-preview',
  'failed-subjects',
  'remaining-required',
  'other-transfer-credits',
  'elective-subjects',
  'reviews',
  'term-recommendations',
]

/** 保存値を読み、壊れている場合はすべて開いた初期状態にする。 */
export function loadOpenMainSections(): ReadonlySet<string> {
  const value = loadFromStorage<unknown>(STORAGE_KEY)
  // 保存値が無いか配列でなければ、全区切りを開いた初期状態へ戻す。
  if (!Array.isArray(value)) return new Set(DEFAULT_OPEN_MAIN_SECTION_IDS)
  // 配列に不正値が混ざる場合も、全区切りを開いて画面が空になるのを避ける。
  if (value.some((sectionId) => typeof sectionId !== 'string')) return new Set(DEFAULT_OPEN_MAIN_SECTION_IDS)
  // localStorageは利用者が書き換えられるため、文字列IDだけを復元する。
  return new Set(value)
}

/** 区切りの開閉状態を、JSONバックアップに含めず保存する。 */
export function saveOpenMainSections(sectionIds: ReadonlySet<string>): void {
  // 既存の保存ラッパーがJSON化と例外処理を担当する。
  saveToStorage(STORAGE_KEY, [...sectionIds])
}

/** 目次やURLで指定された区切りを開いた状態にする。 */
export function openMainSectionForNavigation(sectionIds: ReadonlySet<string>, sectionId: string): ReadonlySet<string> {
  // 同じ区切りを再指定したときは集合を作り直さず、既存状態を返す。
  if (sectionIds.has(sectionId)) return sectionIds
  return new Set([...sectionIds, sectionId])
}
