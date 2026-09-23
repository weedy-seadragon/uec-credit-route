// ユーザーデータ（本サイト形式JSON, docs/SPEC.md §7.4）の読み込み・検証。
//
// requirements.ts・recommend.ts と同じく、UIにもDOMにも依存しない純粋な関数だけで構成する。
// ファイルの選択やlocalStorageへの保存はUI側（ページ）の仕事。ここでは
// 「読み込んだJSONの中身が正しい形かを確認し、既存の記録とどう合体させるか」だけを扱う。
//
// 友人アプリの取り込み共通形式（§7.5）は、まだ友人アプリ側の出力形式が確定していないため
// 対応していない（フェーズ4以降）。

import type { SubjectStatus } from './requirements'

/** §7.4 の1レコード分。code があれば十分だが、書き出したファイルには参考情報も含める */
export interface ExportedRecord {
  code: string
  name?: string
  status: SubjectStatus
  year?: number
  term?: string
}

export interface ExportedProfile {
  entryYear: number
  course: string
  cluster: string | null
  program: string | null
  grade: number
}

/** §7.4 で書き出す・読み込むファイル全体の形 */
export interface ExportedData {
  schemaVersion: number
  exportedAt: string
  profile?: ExportedProfile
  records: ExportedRecord[]
  planned: string[]
  /** その他単位認定（TOEIC等、特定の科目に紐付かない共通単位）の単位数。schemaVersion 2で追加 */
  otherCommonCredits?: number
  /** その他単位認定を、何科目分として数えるか。schemaVersion 3で追加 */
  otherCommonSubjectCount?: number
  /** 不合格から修得予定へ変更した再履修予定科目。schemaVersion 4で追加 */
  retakingPlanCodes?: string[]
  /** 他類専門科目を専門科目として認定された単位数。schemaVersion 5で追加 */
  otherClusterMajorCredits?: number
  /** 他類専門科目を専門科目として認定された科目数。schemaVersion 5で追加 */
  otherClusterMajorSubjectCount?: number
}

export interface ImportResult {
  profile?: ExportedProfile
  records: ExportedRecord[]
  planned: string[]
  /** ファイルに記載が無かった場合（schemaVersion 1のファイルなど）は undefined */
  otherCommonCredits?: number
  /** ファイルに記載が無かった場合は undefined */
  otherCommonSubjectCount?: number
  /** ファイルに記載が無かった場合は undefined */
  retakingPlanCodes?: string[]
  /** ファイルに記載が無かった場合は undefined */
  otherClusterMajorCredits?: number
  /** ファイルに記載が無かった場合は undefined */
  otherClusterMajorSubjectCount?: number
  /**
   * 値がおかしかったため読み込まなかった項目の件数（科目番号・状態が不正な記録、範囲外の単位数など）。
   * これらは「ファイルに書かれていなかった」のと同じ扱い（未登録のまま）にする。
   */
  ignoredCount: number
}

/** 読み込める履修状態。これ以外の値は未登録（未履修）と同じ扱いにする */
const VALID_STATUSES: readonly SubjectStatus[] = ['passed', 'taking', 'failed']

/**
 * 値が min〜max の整数ならその値、そうでなければ undefined を返す。
 * 画面のプルダウンで選べる範囲外の数値（負の数・小数・文字列など）で集計が壊れないようにする。
 */
function integerInRange(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : undefined
}

/** 記録1件が「文字列の科目番号」と「正しい履修状態」を持っているか */
function isValidRecord(value: unknown): value is ExportedRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as { code?: unknown; status?: unknown }
  return typeof record.code === 'string'
    && record.code.trim() !== ''
    && VALID_STATUSES.includes(record.status as SubjectStatus)
}

/** 今書き出すファイルにセットするバージョン番号 */
export const CURRENT_SCHEMA_VERSION = 5

/**
 * 読み込める schemaVersion の一覧。新しいフィールドを追加しただけで読み込み方が変わらない
 * バージョン（1→2でotherCommonCreditsを追加）は、古い番号もそのまま読めるようにしておく
 * （無ければ省略されているだけとみなす）。将来、読み方自体が変わるバージョンを追加したら
 * ここに番号を足し、必要な変換処理も書く
 */
const SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3, 4, 5]

/**
 * 本サイト形式のJSON（§7.4）を読み込む。JSON.parse した結果（型不明の値）を受け取り、
 * 形が正しいことを確認してから、扱いやすい形（ImportResult）にして返す。
 * 形式が正しくない場合は Error を投げる（呼び出し側でメッセージを表示する）。
 */
export function parseOwnFormat(json: unknown): ImportResult {
  // そもそもオブジェクト（{...}の形）でなければ、この時点で読み込みをあきらめる
  if (typeof json !== 'object' || json === null) {
    throw new Error('JSONの形式が正しくありません')
  }
  const data = json as Partial<ExportedData>
  // バージョンが対応外なら、中身を信用せずに止める（将来ここに変換処理を足す）
  if (typeof data.schemaVersion !== 'number' || !SUPPORTED_SCHEMA_VERSIONS.includes(data.schemaVersion)) {
    throw new Error(`対応していないファイル形式です（schemaVersion: ${String(data.schemaVersion)}）`)
  }
  // records は必須項目。無ければ壊れたファイルとみなす
  if (!Array.isArray(data.records)) {
    throw new Error('records が見つかりません')
  }
  // 値がおかしい項目は1件ずつ数えながら読み飛ばし、ファイル全体は読み込みを続ける
  // （1件のミスでバックアップ全体を読み込めなくなるのを避ける。2026-09-24）。
  let ignoredCount = 0
  // 記録は、科目番号が文字列で状態が修得・修得見込・不合格のどれかのものだけを採用する。
  // それ以外（状態が "done" や数値、科目番号が空など）は、未登録（未履修）のままにする。
  const records = data.records.filter((record) => {
    const valid = isValidRecord(record)
    if (!valid) ignoredCount++
    return valid
  })
  // 再履修予定は文字列の配列だけを採用し、壊れた要素は読み込み対象から外す。
  const retakingPlanCodes = Array.isArray(data.retakingPlanCodes)
    ? data.retakingPlanCodes.filter((code): code is string => typeof code === 'string')
    : undefined
  // 単位数・科目数は、画面のプルダウンで選べる範囲の整数だけを採用する。範囲外の値は
  // 「ファイルに書かれていなかった」のと同じ扱いにし、今の値を変えない。
  function readInteger(value: unknown, max: number): number | undefined {
    if (value === undefined) return undefined
    const parsed = integerInRange(value, 0, max)
    if (parsed === undefined) ignoredCount++
    return parsed
  }
  const otherCommonCredits = readInteger(data.otherCommonCredits, 8)
  const otherCommonSubjectCount = readInteger(data.otherCommonSubjectCount, 8)
  const otherClusterMajorCredits = readInteger(data.otherClusterMajorCredits, 8)
  const otherClusterMajorSubjectCount = readInteger(data.otherClusterMajorSubjectCount, 4)
  // ここまで来れば形は正しいので、そのまま呼び出し側が使いやすい形にして返す
  return {
    profile: data.profile,
    records,
    planned: Array.isArray(data.planned) ? data.planned.filter((code): code is string => typeof code === 'string') : [],
    otherCommonCredits,
    otherCommonSubjectCount,
    retakingPlanCodes,
    otherClusterMajorCredits,
    otherClusterMajorSubjectCount,
    ignoredCount,
  }
}

/**
 * 読み込んだ記録を、既存の記録にマージする。
 *
 * ルール（docs/SPEC.md F-2「＋ファイルから追加」）：
 * - 上書きはしない：既存の記録はそのまま残す
 * - 同じ科目が両方にある場合は、ファイル側の状態（取得／不可など）で更新する
 * - ファイルにしか無い科目は新規追加する
 */
export function mergeRecords(
  existing: ReadonlyMap<string, SubjectStatus>,
  incoming: readonly ExportedRecord[],
): { merged: Map<string, SubjectStatus>; added: number; updated: number } {
  const merged = new Map(existing) // 既存のMapを直接書き換えず、コピーの上に足していく
  let added = 0
  let updated = 0
  // ファイルに書かれている記録を1件ずつ、既存の記録に上書き・追加していく
  for (const record of incoming) {
    if (merged.has(record.code)) {
      updated++ // 既にある科目 → 件数としては「更新」
    } else {
      added++ // 無い科目 → 「追加」
    }
    merged.set(record.code, record.status) // どちらの場合もファイル側の状態で（上書き）セットする
  }
  return { merged, added, updated }
}
