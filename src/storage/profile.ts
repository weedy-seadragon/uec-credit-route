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
  /**
   * 曜日時限の表示に使うクラス情報（docs/SPEC.md §7.1のoffering解決用、CLAUDE.md進捗ログ参照）。
   * 昼間コースのみ（夜間主コースは類・クラスの概念が無いのですべてundefined）。
   * 1年次クラスは学籍番号による機械的な割り当てで本人には選べないが、それでも本人に直接
   * 入力してもらう以外に決める方法が無いため、必ず聞く。2〜5番目は「未定」がデフォルトで、
   * 該当する類（cluster）のときだけ画面に表示する
   */
  /** 1年次クラス（1〜12。Ⅰ類=1〜4／Ⅱ類=5〜8／Ⅲ類=9〜12）。学籍番号の偶奇はこの数字の偶奇と同じ */
  yearOneClass?: number
  /** Ⅰ類のみ：1年後期〜2年後期のA/B/Cクラス（第二外国語など一部科目用） */
  classIABC?: 'A' | 'B' | 'C' | null
  /** Ⅱ類のみ：2年前期のクラス/エリア（I-1〜I-6クラスまたはMエリア） */
  classIIArea?: 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6' | 'M' | null
  /** Ⅲ類のみ：2年前期のクラス（1〜4クラス。1年次クラスの番号とは別の1〜4） */
  classIIIYear2Class?: '1' | '2' | '3' | '4' | null
  /** Ⅲ類のみ：2年後期のエリア（M/Sエリア） */
  classIIIYear2Area?: 'M' | 'S' | null
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
