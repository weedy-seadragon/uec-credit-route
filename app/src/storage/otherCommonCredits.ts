// 「その他単位認定」（TOEIC等、特定の科目を介さずに共通単位として認定される単位数・科目数）の
// localStorage保存・読み込み。0は「未登録」（まだ認定を受けていない）を表す。
import { loadFromStorage, saveToStorage } from './localStorage'

const STORAGE_KEY = 'otherCommonCredits'
const SUBJECT_COUNT_STORAGE_KEY = 'otherCommonSubjectCount'

export function loadOtherCommonCredits(): number {
  return loadFromStorage<number>(STORAGE_KEY) ?? 0
}

export function saveOtherCommonCredits(value: number): void {
  saveToStorage(STORAGE_KEY, value)
}

// 科目に紐付かない認定分も、登録科目数に加えるための件数を別に保存する。
export function loadOtherCommonSubjectCount(): number {
  return loadFromStorage<number>(SUBJECT_COUNT_STORAGE_KEY) ?? 0
}

// 単位数とは独立して、その他単位認定の科目数を保存する。
export function saveOtherCommonSubjectCount(value: number): void {
  saveToStorage(SUBJECT_COUNT_STORAGE_KEY, value)
}
