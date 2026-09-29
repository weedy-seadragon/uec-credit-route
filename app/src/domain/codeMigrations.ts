// 保存済みの科目コードを、新しい科目コードへ移す純粋な変換処理。

export interface CodeMigrationResult<T> {
  value: T
  movedCodes: readonly string[]
  blockedCodes: readonly string[]
}

/** 移し先の記録がすでにあるときは旧コードを残し、それ以外だけ状態を移す。 */
export function migrateCodeMap<T>(
  source: ReadonlyMap<string, T>,
  migrations: Readonly<Record<string, string>>,
): CodeMigrationResult<Map<string, T>> {
  const value = new Map(source)
  const movedCodes: string[] = []
  const blockedCodes: string[] = []
  // 対応表の各旧番号について、既存の新番号を上書きしない。
  for (const [oldCode, newCode] of Object.entries(migrations)) {
    if (!value.has(oldCode)) continue
    if (value.has(newCode)) {
      blockedCodes.push(oldCode)
      continue
    }
    value.set(newCode, value.get(oldCode)!)
    value.delete(oldCode)
    movedCodes.push(oldCode)
  }
  return { value, movedCodes, blockedCodes }
}

/** 科目コードの集合を移し先と重複させずに引き継ぐ。 */
export function migrateCodeSet(
  source: ReadonlySet<string>,
  migrations: Readonly<Record<string, string>>,
  occupiedCodes: ReadonlySet<string> = new Set(),
): CodeMigrationResult<Set<string>> {
  const value = new Set(source)
  const movedCodes: string[] = []
  const blockedCodes: string[] = []
  // 保存済みの履修記録に新番号がある場合、その旧番号の付随設定も旧側へ残す。
  for (const [oldCode, newCode] of Object.entries(migrations)) {
    if (!value.has(oldCode)) continue
    if (occupiedCodes.has(newCode) || value.has(newCode)) {
      blockedCodes.push(oldCode)
      continue
    }
    value.delete(oldCode)
    value.add(newCode)
    movedCodes.push(oldCode)
  }
  return { value, movedCodes, blockedCodes }
}

/** 科目コードをキーに持つ設定を移す。移し先の既存設定を優先する。 */
export function migrateCodeRecord(
  source: Readonly<Record<string, string>>,
  migrations: Readonly<Record<string, string>>,
  occupiedCodes: ReadonlySet<string> = new Set(),
): CodeMigrationResult<Record<string, string>> {
  const value = { ...source }
  const movedCodes: string[] = []
  const blockedCodes: string[] = []
  // 設定値はそのまま保ち、キーだけを新しい科目番号へ変える。
  for (const [oldCode, newCode] of Object.entries(migrations)) {
    if (!(oldCode in value)) continue
    if (occupiedCodes.has(newCode) || newCode in value) {
      blockedCodes.push(oldCode)
      continue
    }
    value[newCode] = value[oldCode]
    delete value[oldCode]
    movedCodes.push(oldCode)
  }
  return { value, movedCodes, blockedCodes }
}
