// 同名で複数の科目番号を持つ科目の履修状態を、1件だけに正規化する純粋ロジック。
// 同じ類の他プログラム科目として展開された同一授業を、誤って二重に登録・集計しないために使う。

import type { SubjectStatus } from './requirements'

/** 科目マスタのうち、同名科目の判定に必要な最小限の形。 */
export interface NamedSubject {
  name: string
}

/** 同名科目が複数ある場合に、優先して残す科目番号を返す。 */
export function preferredSubjectCode(
  code: string,
  subjectsByCode: ReadonlyMap<string, NamedSubject>,
  isPreferred: (candidateCode: string) => boolean,
  areEquivalent: (firstCode: string, secondCode: string) => boolean,
): string {
  // 対象科目がマスタに無い場合は、別の科目と誤ってまとめず元の番号を使う。
  const target = subjectsByCode.get(code)
  if (!target) return code
  // 同名の中では、自分のプログラムの科目など呼び出し元が優先した番号を先に選ぶ。
  for (const [candidateCode, candidate] of subjectsByCode) {
    if (candidate.name === target.name && areEquivalent(code, candidateCode) && isPreferred(candidateCode)) return candidateCode
  }
  return code
}

/** 既存の履修記録から、同名科目の重複を除いて優先する科目番号だけを残す。 */
export function normalizeDuplicateSubjectRecords(
  records: ReadonlyMap<string, SubjectStatus>,
  subjectsByCode: ReadonlyMap<string, NamedSubject>,
  isPreferred: (candidateCode: string) => boolean,
  areEquivalent: (firstCode: string, secondCode: string) => boolean,
): ReadonlyMap<string, SubjectStatus> {
  const normalized = new Map(records)
  const processedCodes = new Set<string>()
  // 記録済み科目を起点に、同名かつ同じ類のプログラム科目だけを1組として集める。
  for (const code of records.keys()) {
    if (processedCodes.has(code)) continue
    const name = subjectsByCode.get(code)?.name
    if (!name) continue
    const codes = [...records.keys()].filter((candidateCode) =>
      subjectsByCode.get(candidateCode)?.name === name && areEquivalent(code, candidateCode),
    )
    for (const candidateCode of codes) processedCodes.add(candidateCode)
    // 同名でも別の類・別のプログラム群なら別科目として扱い、ここではまとめない。
    if (codes.length < 2) continue
    const chosenCode = codes.find(isPreferred) ?? codes[0]
    const chosenStatus = records.get(chosenCode)
    for (const code of codes) normalized.delete(code)
    if (chosenStatus) normalized.set(chosenCode, chosenStatus)
  }
  return normalized
}

/** 科目の状態を変更し、同名科目に付いていた古い状態を同時に取り除く。 */
export function setSubjectStatusWithoutDuplicates(
  records: ReadonlyMap<string, SubjectStatus>,
  code: string,
  status: SubjectStatus | undefined,
  subjectsByCode: ReadonlyMap<string, NamedSubject>,
  isPreferred: (candidateCode: string) => boolean,
  areEquivalent: (firstCode: string, secondCode: string) => boolean,
): ReadonlyMap<string, SubjectStatus> {
  const target = subjectsByCode.get(code)
  const next = new Map(records)
  const effectiveCode = preferredSubjectCode(code, subjectsByCode, isPreferred, areEquivalent)
  // 同名科目は、これから設定する1件だけを残すために先に古い記録を消す。
  if (target) {
    for (const [candidateCode, candidate] of subjectsByCode) {
      if (candidate.name === target.name && areEquivalent(code, candidateCode)) next.delete(candidateCode)
    }
  }
  // 「未履修」は記録を持たない状態なので何も追加せず、それ以外は優先先の番号へ記録する。
  if (status) next.set(effectiveCode, status)
  return next
}
