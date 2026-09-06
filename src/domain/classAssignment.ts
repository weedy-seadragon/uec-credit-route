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
 * - 「クラスN」・「A1-N」・「A2-N」：1年次クラス（全類共通、N=1〜12）。「A1-N」「A2-N」は
 *   scripts/build_class_assignment.pyがclass_schedule.csvと自動突き合わせできたときに
 *   生成する「{pdf名}-{class_id}」形式で、意味は「クラスN」と同じ
 * - 「Ⅲ-N」：Ⅲ類の2年前期クラス（N=1〜4）。「クラスN」（1年次クラス）とは別表記
 *   （2026-09-06、複素関数論で発覚：Ⅲ類側の「Mエリア(Nクラス)」だと思われていた表記が、
 *   実際はエリアに関係ない「Ⅲ類の2年前期クラスN」という意味だった）
 * - 「Xクラス」（X=A/B/C）：Ⅰ類の1年後期〜2年後期クラス
 * - 「INクラス」（N=1〜6）：Ⅱ類の2年前期クラス
 * - 「Mエリア」：Ⅱ類の2年前期エリア、またはⅢ類の2年後期エリア（類で意味が変わる）
 * - 「Mエリア(Nクラス)」：Ⅲ類の2年後期エリアMのうち、2年前期クラスNに対応する学生向け
 * - 「Iエリア」：Ⅱ類の2年前期エリアのうち、I1〜I6のどれか（Mエリアの逆）
 * - 「二類学籍番号偶数/奇数」：Ⅱ類の学籍番号の偶奇。1年次クラスの番号と学籍番号の偶奇は
 *   一致する（1年次クラスが偶数なら学籍番号も偶数、奇数なら奇数）ため、yearOneClassから導出する
 *   （開発者指摘、2026-09-06）
 * - 「一類/二類/三類」：プログラムや1年次クラスに関係なく、その類（Ⅰ/Ⅱ/Ⅲ類）の学生全員が対象
 *   （例:ENG301z/401z「Academic English for the 2nd Year」で時限ごとに受講する類が決まっている。
 *   開発者提案、2026-09-06）
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

  // 「プログラムA＆プログラムBの学籍番号偶数/奇数」：複数プログラム共通の科目が、
  // さらに学籍番号の偶奇でも分かれる場合の表記（scripts/build_class_assignment_json.pyの
  // expand_parity_programs()が、開発者の「プログラムA、プログラムBの学籍番号偶数」という
  // 書き方をここに変換してから渡してくる。読点は他の表記で「複数候補の一覧」の区切りに
  // 使っているため、混同しないよう「＆」にしてある。2026-09-07、ELE402g等のデータで発覚）
  const parityProgramsMatch = classId.match(/^(.+)の学籍番号(偶数|奇数)$/)
  if (parityProgramsMatch && parityProgramsMatch[1].includes('＆')) {
    const programs = parityProgramsMatch[1].split('＆')
    if (!profile.programName || !programs.includes(profile.programName)) return false
    if (profile.yearOneClass == null) return false
    const isEven = profile.yearOneClass % 2 === 0
    return parityProgramsMatch[2] === '偶数' ? isEven : !isEven
  }

  // 「一類」「二類」「三類」：プログラムや1年次クラスに関係なく、その類の学生全員が対象
  // （例:ENG301z/401z「Academic English for the 2nd Year」で、時限ごとに受講する類が
  // 決まっている。2026-09-06、開発者提案）
  if (classId === '一類') return cluster === 'I'
  if (classId === '二類') return cluster === 'II'
  if (classId === '三類') return cluster === 'III'

  const yearOneMatch = classId.match(/^クラス(\d+)$/)
  if (yearOneMatch) return profile.yearOneClass === Number(yearOneMatch[1])

  // 「Ⅲ-N」：Ⅲ類の2年前期クラス（N=1〜4）。「クラスN」（1年次クラス）と紛らわしいので
  // 別表記にした（2026-09-06、複素関数論で発覚：Ⅲ類側の「Mエリア(Nクラス)」だと
  // 思われていた表記が、実際はエリアに関係ない「Ⅲ類の2年前期クラスN」という意味だった。
  // 開発者提案で「クラスN」を類によって意味が変わる形にするより明示的な表記にした）
  const clusterIIIMatch = classId.match(/^Ⅲ-(\d+)$/)
  if (clusterIIIMatch) return cluster === 'III' && profile.classIIIYear2Class === clusterIIIMatch[1]

  // 「A1-7」「A2-3」のような表記：scripts/build_class_assignment.pyがclass_schedule.csv
  // （時間割PDFの書き起こし）と自動突き合わせできたときに生成する「{pdf名}-{class_id}」形式。
  // A1（1年前期）・A2（1年後期）はどちらも1年次クラス1〜12と同じ番号なので、「クラスN」と
  // 同じ扱いにする（2026-09-06、基礎科学実験A1/B1の時限が出ない不具合の根本原因として発覚：
  // 自動突き合わせでこの形式が入っていたが、ここでずっと未対応のままだった）
  const a1a2Match = classId.match(/^A[12]-(\d+)$/)
  if (a1a2Match) return profile.yearOneClass === Number(a1a2Match[1])

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
 * 1件でも見つかればそちらを優先する（2026-09-06、開発者の指摘で発見）。
 *
 * 「全クラス」しか無い科目（英語演習・独語演習などの演習系科目）は、そもそも学生が複数の
 * セクションから自由に選んで受講してよいもの。この場合は一意に決める必要が無いので、
 * 曜日時限が食い違っていてもundefinedにはせず、候補をすべて列挙して返す
 * （2026-09-06、開発者の指摘）。
 *
 * クラス指定・プログラム名など「全クラス」以外の表記（＝specific match）で一致した場合、
 * 一致した曜日時限が食い違うと、一致に使ったclassIdが全部同じかどうかで扱いを変える：
 * - classIdが違う（例:別々の理由でたまたま両方一致した）→ 本当に決められないので、
 *   適当に選ぶより非表示を優先し、従来通りundefinedのまま
 * - classIdが同じ（例:「デザイン思考・データサイエンスプログラム」がTechnical Englishで
 *   木1と木3の2枠に分かれているような、同じ対象者向けに複数の枠が用意されている実際のケース）
 *   → 対象者側は「時間割を見て自分の枠を確認する」しかないので、決め打ちせず全部列挙する
 *   （2026-09-06、開発者の指摘。当初は一律undefinedにしていたが例外が見つかった）
 */
export function resolveSlotsForProfile(
  code: string,
  offerings: readonly OfferingLike[],
  assignments: readonly ClassAssignmentEntry[],
  profile: ClassProfile,
  cluster: 'I' | 'II' | 'III' | null,
  isRetaking = false,
): { day: string; period: number }[] | undefined {
  // そのofferingに一致するclassIdのうち、実際に一致した1つを返す（無ければundefined）。
  // 「どのclassIdで一致したか」を後段で見て、同じclassId（例:同じプログラム名）が
  // 複数の時限にまたがっているのか、別々のclassIdがたまたま両方一致した本当に
  // 決められないケースなのかを区別するために使う
  function matchedClassId(o: OfferingLike, allowCatchAll: boolean): string | undefined {
    for (const slot of o.slots) {
      // 同じ(科目・学期・曜日・時限)に、クラスごとに教員が違う複数のセクションがあると
      // (例:MTH205a「離散数学」月1限のAクラス担当とBクラス担当)、class_assignment.jsonには
      // 別々のエントリとして複数件入っている。findだと最初の1件しか見ずBクラスの学生が
      // 一致しなくなるバグがあったため、該当する全エントリのclassIdsを対象にする
      // （2026-09-06、開発者が「Bクラスに設定しても表示されない」と報告して発覚）
      const entries = assignments.filter(
        (a) => a.code === code && a.term === o.term && a.day === slot.day && a.period === String(slot.period),
      )
      for (const entry of entries) {
        for (const id of entry.classIds) {
          if (id === '全クラス' && !allowCatchAll) continue
          if (classIdMatchesProfile(id, profile, cluster, isRetaking)) return id
        }
      }
    }
    return undefined
  }

  const specificWithId = offerings
    .map((o) => ({ offering: o, matchedId: matchedClassId(o, false) }))
    .filter((x): x is { offering: OfferingLike; matchedId: string } => x.matchedId !== undefined)

  if (specificWithId.length > 0) {
    const firstKey = slotsKey(specificWithId[0].offering.slots)
    if (specificWithId.every((x) => slotsKey(x.offering.slots) === firstKey)) {
      return specificWithId[0].offering.slots
    }
    // 曜日時限は食い違うが、一致したclassIdが全部同じ「プログラム名」（例:「デザイン思考・
    // データサイエンスプログラム」がTechnical Englishで木1と木3の2枠に分かれているケース）
    // なら、そのプログラムの中でさらに細かい枠（I19クラス/I20クラスなど、プロフィールでは
    // 追跡していない粒度）に分かれているということなので、決め打ちせず全部列挙する
    // （2026-09-06、開発者の指摘。「時間割を各自チェックする」前提の表示）。
    // 「クラスN」のような個別の番号が食い違う場合（本来は1人の学生に1つの時限しかない
    // はずなのに複数ある＝データの矛盾の可能性が高い）は、従来通り非表示を優先するため、
    // この特別扱いは「プログラム名」で一致したときだけに限定する
    const firstId = specificWithId[0].matchedId
    if (firstId === profile.programName && specificWithId.every((x) => x.matchedId === firstId)) {
      const seen = new Set<string>()
      return specificWithId
        .flatMap((x) => x.offering.slots)
        .filter((slot) => {
          const key = `${slot.day}${slot.period}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
    }
    return undefined
  }

  function offeringMatches(o: OfferingLike, allowCatchAll: boolean): boolean {
    return matchedClassId(o, allowCatchAll) !== undefined
  }

  const catchAllMatches = offerings.filter((o) => offeringMatches(o, true))
  if (catchAllMatches.length === 0) return undefined
  const seen = new Set<string>()
  return catchAllMatches
    .flatMap((o) => o.slots)
    .filter((slot) => {
      const key = `${slot.day}${slot.period}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
