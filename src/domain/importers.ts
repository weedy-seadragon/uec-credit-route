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
}

export interface ImportResult {
  profile?: ExportedProfile
  records: ExportedRecord[]
  planned: string[]
}

/** 現時点で読み込める schemaVersion。将来バージョンが上がったら、ここに変換処理を足す */
const SUPPORTED_SCHEMA_VERSION = 1

/**
 * 本サイト形式のJSON（§7.4）を読み込む。JSON.parse した結果（型不明の値）を受け取り、
 * 形が正しいことを確認してから、扱いやすい形（ImportResult）にして返す。
 * 形式が正しくない場合は Error を投げる（呼び出し側でメッセージを表示する）。
 */
export function parseOwnFormat(json: unknown): ImportResult {
  if (typeof json !== 'object' || json === null) {
    throw new Error('JSONの形式が正しくありません')
  }
  const data = json as Partial<ExportedData>
  if (data.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(`対応していないファイル形式です（schemaVersion: ${String(data.schemaVersion)}）`)
  }
  if (!Array.isArray(data.records)) {
    throw new Error('records が見つかりません')
  }
  return {
    profile: data.profile,
    records: data.records,
    planned: Array.isArray(data.planned) ? data.planned : [],
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
  const merged = new Map(existing)
  let added = 0
  let updated = 0
  for (const record of incoming) {
    if (merged.has(record.code)) {
      updated++
    } else {
      added++
    }
    merged.set(record.code, record.status)
  }
  return { merged, added, updated }
}
