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
 * - 「Iエリア」：Ⅱ類の2年前期エリアのうち、I1〜I6のどれか（Mエリアの逆）
 * - 「二類学籍番号偶数/奇数」：Ⅱ類の学籍番号の偶奇。1年次クラスの番号と学籍番号の偶奇は
 *   一致する（1年次クラスが偶数なら学籍番号も偶数、奇数なら奇数）ため、yearOneClassから導出する
 *   （開発者指摘、2026-09-06）
 * - 「全クラス」：クラス分けに関係なく全員が対象
 * - それ以外（プログラム名）：2年後期以降、プログラムが決まった学生向け
 * - 「再履全員/再履生」：この科目を再履修中（＝committedの状態が'failed'）の学生向けの特別セクション。
 *   isRetakingがtrueのときだけ一致し、その代わり他の（通常セクション向けの）表記とは一致しなくなる
 *   （再履修中の学生は、その科目については通常セクションではなく再履セクションに出る前提。
 *   開発者提案、2026-09-06。呼び出し側（MainPage.tsxのdayPeriodTag）でcommitted.get(code)==='failed'
 *   のときisRetaking=trueを渡す）
 *
 * なお「留学生」もclass_assignment_filled.csvに実在するが、プロフィールにその情報を持たせるか
 * どうかは別途判断が必要なため未対応（常にfalseを返し、該当セクションはresolveSlotsForProfileで
 * 曜日時限なし扱いになる。2026-09-06の点検で発見。CLAUDE.md参照）
 */
export function classIdMatchesProfile(
  classId: string,
  profile: ClassProfile,
  cluster: 'I' | 'II' | 'III' | null,
  isRetaking = false,
): boolean {
  if (classId === '再履全員' || classId === '再履生') return isRetaking
  // 再履修中の科目は、再履セクション以外（通常のクラス・プログラム向けセクション）は
  // 対象外にする（同じ科目で通常セクションと再履セクションの両方が一致してしまうと、
  // 曜日時限が食い違って一意に決まらなくなるため）
  if (isRetaking) return false

  if (profile.programName && classId === profile.programName) return true
  if (classId === '全クラス') return true

  const yearOneMatch = classId.match(/^クラス(\d+)$/)
  if (yearOneMatch) return profile.yearOneClass === Number(yearOneMatch[1])

  if (classId === '二類学籍番号偶数' || classId === '二類学籍番号奇数') {
    if (cluster !== 'II' || profile.yearOneClass == null) return false
    const isEven = profile.yearOneClass % 2 === 0
    return classId === '二類学籍番号偶数' ? isEven : !isEven
  }

  const abcMatch = classId.match(/^([ABC])クラス$/)
  if (abcMatch) return cluster === 'I' && profile.classIABC === abcMatch[1]

  const iAreaMatch = classId.match(/^I([1-6])クラス$/)
  if (iAreaMatch) return cluster === 'II' && profile.classIIArea === `I${iAreaMatch[1]}`

  if (classId === 'Iエリア') {
    return cluster === 'II' && profile.classIIArea != null && profile.classIIArea !== 'M'
  }

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

/** 曜日時限の集合を比較用の文字列にする（順序に依存しないよう並べ替えてから結合） */
function slotsKey(slots: readonly { day: string; period: number }[]): string {
  return slots
    .map((s) => `${s.day}${s.period}`)
    .sort()
    .join(',')
}

/**
 * 複数セクションがある科目について、プロフィールから受講セクションが一意に決まれば、
 * そのセクションの曜日時限を返す。0件で一致しない場合はundefined
 * （誤った時限を適当に選んで返すことはしない。CLAUDE.mdのフォールバック方針参照）。
 *
 * 複数のセクションが一致することもある（例：第二外国語で、同じクラス向けの科目が
 * 教員違いで複数開講されているケース）。その場合でも、一致した全セクションの曜日時限が
 * 完全に同じであれば、担当教員までは分からなくても曜日時限自体は一意に決まるので、
 * その曜日時限を返す（2026-09-06の点検で発見。CLAUDE.md参照）。曜日時限が食い違う場合のみ
 * 本当に決められないのでundefinedにする。
 *
 * isRetaking（デフォルトfalse）をtrueにすると、「再履全員/再履生」向けセクションだけを対象にする
 * （通常セクションは無視する）。呼び出し側で、その科目の履修状態が'failed'（不合格・再履修中）の
 * ときにtrueを渡す想定（開発者提案、2026-09-06）
 *
 * 「全クラス」は、他のクラス/エリア/プログラム向けの表記が同じ科目に混在している場合は
 * 「まだ修得していない学生向けの補講枠」のような意味で使われていることがある（例：生涯スポーツ
 * 演習Ａ/Ｂ）。この場合「全クラス」を無条件一致にすると、本来の（クラスに応じた）セクションと
 * 重複してしまい曜日時限が決められなくなるため、まず「全クラス」を除いた表記だけで一致を探し、
 * 1件でも見つかればそちらを優先する。「全クラス」しか無い科目（語学演習など）では今まで通り
 * 「全クラス」も候補にする（2026-09-06、開発者の指摘で発見）。
 */
export function resolveSlotsForProfile(
  code: string,
  offerings: readonly OfferingLike[],
  assignments: readonly ClassAssignmentEntry[],
  profile: ClassProfile,
  cluster: 'I' | 'II' | 'III' | null,
  isRetaking = false,
): { day: string; period: number }[] | undefined {
  function offeringMatches(o: OfferingLike, allowCatchAll: boolean): boolean {
    return o.slots.some((slot) => {
      const entry = assignments.find(
        (a) => a.code === code && a.term === o.term && a.day === slot.day && a.period === String(slot.period),
      )
      return (
        entry?.classIds.some((id) => {
          if (id === '全クラス' && !allowCatchAll) return false
          return classIdMatchesProfile(id, profile, cluster, isRetaking)
        }) ?? false
      )
    })
  }

  const specificMatches = offerings.filter((o) => offeringMatches(o, false))
  const matchedOfferings = specificMatches.length > 0 ? specificMatches : offerings.filter((o) => offeringMatches(o, true))

  if (matchedOfferings.length === 0) return undefined
  const firstKey = slotsKey(matchedOfferings[0].slots)
  if (matchedOfferings.every((o) => slotsKey(o.slots) === firstKey)) return matchedOfferings[0].slots
  return undefined
}
