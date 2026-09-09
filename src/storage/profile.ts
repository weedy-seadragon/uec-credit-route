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

  /**
   * 転類・転プログラムに関する情報（2026-09-07、開発者判断で追加）。
   * 留学生については特に対応しない方針（プロフィール項目は追加しない）。
   *
   * 転類は1年次→2年次、転プログラムは2年次→3年次のタイミングでしか起こらないという
   * 大学の制度上の制約を前提にしている（開発者確認）。転類した学生は、1年次は今と違う類に
   * 所属していたことになる。転プログラムした学生は、2年次は今と違うプログラムに
   * 所属していたことになる。
   *
   * 現時点では、この情報を使う具体的な判定ロジック（class_assignment.json側に対応する
   * class_id表記の実例）が無いため、ここでは記録するだけにとどめ、
   * src/domain/classAssignment.ts の classIdMatchesProfile には配線していない。
   * 将来「転類生」「転プログラム生」のような専用のclass_id表記が実際に見つかったときに使う
   */
  /** 転類したかどうか */
  transferredCluster?: boolean
  /** 転類した場合の、1年次に所属していた元の類 */
  previousCluster?: 'I' | 'II' | 'III' | null
  /** 転類した場合の、元の類での1年次クラス（元の類の範囲内の番号。Ⅰ類=1〜4／Ⅱ類=5〜8／Ⅲ類=9〜12） */
  previousYearOneClass?: number | null
  /** 転プログラムしたかどうか */
  transferredProgram?: boolean
  /** 転プログラムした場合の、2年次に所属していた元の類（今と同じ類のこともある） */
  previousProgramCluster?: 'I' | 'II' | 'III' | null
  /** 転プログラムした場合の、2年次に所属していた元のプログラム */
  previousProgram?: string | null
  /** 転プログラムした場合の、元の類・プログラムでの2年前期クラス（元の類に応じた形式） */
  previousClassIABC?: 'A' | 'B' | 'C' | null
  previousClassIIArea?: 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6' | 'M' | null
  previousClassIIIYear2Class?: '1' | '2' | '3' | '4' | null
}

const STORAGE_KEY = 'profile'

/** 2024年度以前の保存済みプロフィールを、画面用の「2024年以前」へ正規化する。 */
function normalizeProfileEntryYear(profile: Profile): Profile {
  // 古いバージョンで2023などを直接保存していても、選択肢とデータ参照を一貫させる。
  return profile.entryYear <= 2024 ? { ...profile, entryYear: 2024 } : profile
}

/** 保存済みのプロフィールを読み込む。一度も保存していなければ undefined */
export function loadProfile(): Profile | undefined {
  const profile = loadFromStorage<Profile>(STORAGE_KEY)
  // 保存済みの値があるときだけ年度を正規化し、未設定時はundefinedのまま返す。
  return profile ? normalizeProfileEntryYear(profile) : undefined
}

/** プロフィールをまるごと上書き保存する */
export function saveProfile(profile: Profile): void {
  // 新しく保存する場合も同じ規則を通し、2023などの個別年度が残らないようにする。
  saveToStorage(STORAGE_KEY, normalizeProfileEntryYear(profile))
}
