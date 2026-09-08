// 修得予定のうち「不合格から再履修する予定」の科目コードを、履修記録とは別に保存する。
// SubjectStatusだけでは「通常の修得予定」と「再履修予定」を区別できないため、この補助情報を持つ。
import { loadFromStorage, saveToStorage } from './localStorage'

const STORAGE_KEY = 'retakingPlanCodes'

/** 保存済みの再履修予定科目を読み込む。壊れた値は無視して、安全に空集合として扱う。 */
export function loadRetakingPlanCodes(): ReadonlySet<string> {
  const value = loadFromStorage<unknown>(STORAGE_KEY)
  // 配列以外の古い値・壊れた値では、再履修予定を復元できないため空集合を返す。
  if (!Array.isArray(value)) return new Set()
  // 科目コードとして使える文字列だけを残し、重複はSetで取り除く。
  return new Set(value.filter((code): code is string => typeof code === 'string'))
}

/** 再履修予定科目をlocalStorageへ配列として保存する。SetはJSON化できないため変換する。 */
export function saveRetakingPlanCodes(codes: ReadonlySet<string>): void {
  saveToStorage(STORAGE_KEY, [...codes])
}
