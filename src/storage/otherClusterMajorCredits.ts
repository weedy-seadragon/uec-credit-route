// 他類専門科目を、学務の個別認定によって専門科目として算入できる単位数・科目数の保存を担当する。
// 科目そのものの履修記録とは別に、認定された範囲だけを類専門（選択）の計算へ加える。
import { loadFromStorage, saveToStorage } from './localStorage'

const STORAGE_KEY = 'otherClusterMajorCredits'
const SUBJECT_COUNT_STORAGE_KEY = 'otherClusterMajorSubjectCount'

/** 保存済みの他類専門科目認定単位を読み込む。未設定・不正値は0単位として安全に扱う。 */
export function loadOtherClusterMajorCredits(): number {
  // localStorageは利用者が直接書き換えられるため、画面で選べる0〜8単位だけを返す。
  const value = loadFromStorage<number>(STORAGE_KEY)
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 8 ? value : 0
}

/** 他類専門科目認定の単位数を保存する。 */
export function saveOtherClusterMajorCredits(value: number): void {
  // 呼び出し元以外から渡されても上限外の値を保存しないようにする。
  saveToStorage(STORAGE_KEY, Number.isInteger(value) && value >= 0 && value <= 8 ? value : 0)
}

/** 保存済みの他類専門科目認定の科目数を読み込む。 */
export function loadOtherClusterMajorSubjectCount(): number {
  // 単位数とは別に、登録科目数へ足す件数を0〜4科目の範囲で保存する。
  const value = loadFromStorage<number>(SUBJECT_COUNT_STORAGE_KEY)
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4 ? value : 0
}

/** 他類専門科目認定の科目数を保存する。 */
export function saveOtherClusterMajorSubjectCount(value: number): void {
  // 不正な値は0科目に戻して保存し、画面の表示とずれないようにする。
  saveToStorage(SUBJECT_COUNT_STORAGE_KEY, Number.isInteger(value) && value >= 0 && value <= 4 ? value : 0)
}
