// 複数セクション（クラス）がある科目について、プロフィールのクラス情報から
// 「この学生が受けるのはこのセクション」を一意に決めるための純粋関数。
// requirements.ts・recommend.ts と同じく、React にも DOM にも依存しない。
//
// 元データは data/timetable/class_assignment.json（scripts/build_class_assignment_json.py が
// data/timetable/class_assignment_filled.csv から作る）。開発者が時間割PDFを見ながら、
// 「この曜日時限のこのセクションは、このクラス/プログラム向け」を手作業で埋めたもの。
// 詳しくは data/timetable/README.md を参照。

/** プロフィールのうち、クラス判定に使う項目だけ（src/storage/profile.ts の Profile の一部） */
export interface ClassProfile {
  yearOneClass?: number
  classIABC?: 'A' | 'B' | 'C' | null
  classIIArea?: 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6' | 'M' | null
  classIIIYear2Class?: '1' | '2' | '3' | '4' | null
  classIIIYear2Area?: 'M' | 'S' | null
  /** 2年後期以降に決まる教育プログラム名（学修要覧の表記そのもの。例:「メディア情報学プログラム」）。
   *  プログラムがまだ決まっていない（1年生など）場合は null/undefined */
  programName?: string | null
}

/** data/timetable/class_assignment.json の1行ぶん */
export interface ClassAssignmentEntry {
  code: string
  term: string
  day: string
  period: string
  classIds: string[]
}

/** offerings側の型（requirementSets.ts の SubjectOffering と構造的に合っていればよい） */
interface OfferingLike {
  term: string
  slots: { day: string; period: number }[]
}

/**
 * class_assignment.json の class_id 表記（例:「クラス3」「Aクラス」「I5クラス」「Mエリア」
 * 「Mエリア(2クラス)」「メディア情報学プログラム」）が、このプロフィールに当てはまるかどうかを判定する。
 *
 * 表記の意味はCLAUDE.mdの進捗ログ・data/timetable/README.mdの対応表を参照：
 * - 「クラスN」：1年次クラス（全類共通、N=1〜12）
 * - 「Xクラス」（X=A/B/C）：Ⅰ類の1年後期〜2年後期クラス
 * - 「INクラス」（N=1〜6）：Ⅱ類の2年前期クラス
 * - 「Mエリア」：Ⅱ類の2年前期エリア、またはⅢ類の2年後期エリア（類で意味が変わる）
 * - 「Mエリア(Nクラス)」：Ⅲ類の2年後期エリアMのうち、2年前期クラスNに対応する学生向け
 * - それ以外（プログラム名）：2年後期以降、プログラムが決まった学生向け
 */
export function classIdMatchesProfile(classId: string, profile: ClassProfile, cluster: 'I' | 'II' | 'III' | null): boolean {
  if (profile.programName && classId === profile.programName) return true

  const yearOneMatch = classId.match(/^クラス(\d+)$/)
  if (yearOneMatch) return profile.yearOneClass === Number(yearOneMatch[1])

  const abcMatch = classId.match(/^([ABC])クラス$/)
  if (abcMatch) return cluster === 'I' && profile.classIABC === abcMatch[1]

  const iAreaMatch = classId.match(/^I([1-6])クラス$/)
  if (iAreaMatch) return cluster === 'II' && profile.classIIArea === `I${iAreaMatch[1]}`

  const mAreaSubMatch = classId.match(/^Mエリア\((\d+)クラス\)$/)
  if (mAreaSubMatch) {
    return cluster === 'III' && profile.classIIIYear2Area === 'M' && profile.classIIIYear2Class === mAreaSubMatch[1]
  }

  if (classId === 'Mエリア') {
    if (cluster === 'II') return profile.classIIArea === 'M'
    if (cluster === 'III') return profile.classIIIYear2Area === 'M'
    return false
  }

  return false
}

/**
 * 複数セクションがある科目について、プロフィールから受講セクションが一意に決まれば、
 * そのセクションの曜日時限を返す。0件・複数件で一意に決まらない場合はundefined
 * （誤った時限を適当に選んで返すことはしない。CLAUDE.mdのフォールバック方針参照）。
 */
export function resolveSlotsForProfile(
  code: string,
  offerings: readonly OfferingLike[],
  assignments: readonly ClassAssignmentEntry[],
  profile: ClassProfile,
  cluster: 'I' | 'II' | 'III' | null,
): { day: string; period: number }[] | undefined {
  const matchedOfferings = offerings.filter((o) =>
    o.slots.some((slot) => {
      const entry = assignments.find(
        (a) => a.code === code && a.term === o.term && a.day === slot.day && a.period === String(slot.period),
      )
      return entry?.classIds.some((id) => classIdMatchesProfile(id, profile, cluster)) ?? false
    }),
  )
  if (matchedOfferings.length !== 1) return undefined
  return matchedOfferings[0].slots
}
