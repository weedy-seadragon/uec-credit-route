// 「その他単位認定」（TOEIC等、特定の科目を介さずに共通単位として認定される単位数）の
// localStorage保存・読み込み。0は「未履修」（まだ認定を受けていない）を表す。
import { loadFromStorage, saveToStorage } from './localStorage'

const STORAGE_KEY = 'otherCommonCredits'

export function loadOtherCommonCredits(): number {
  return loadFromStorage<number>(STORAGE_KEY) ?? 0
}

export function saveOtherCommonCredits(value: number): void {
  saveToStorage(STORAGE_KEY, value)
}
