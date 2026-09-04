// ユーザーのプロフィール（入学年度・類・プログラムなど）の型と、localStorageへの保存・読み込み。
// 具体的な保存の仕方（JSON化・例外処理）は ./localStorage.ts に任せ、ここでは
// 「プロフィールとして何を保存するか」だけを決める。
import { loadFromStorage, saveToStorage } from './localStorage'

export interface Profile {
  entryYear: number
  course: 'day' | 'evening'
  /** 夜間主コース（evening）には類が無いので null */
  cluster: 'I' | 'II' | 'III' | null
  /** 教育プログラム。未定なら null（docs/SPEC.md F-1） */
  program: string | null
  /** 現在の学年（1〜4） */
  grade: number
  /** 推薦入学（入学時からプログラム確定済み）かどうか */
  recommended: boolean
}

const STORAGE_KEY = 'profile'

/** 保存済みのプロフィールを読み込む。一度も保存していなければ undefined */
export function loadProfile(): Profile | undefined {
  return loadFromStorage<Profile>(STORAGE_KEY)
}

/** プロフィールをまるごと上書き保存する */
export function saveProfile(profile: Profile): void {
  saveToStorage(STORAGE_KEY, profile)
}
