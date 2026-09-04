// 卒業要件の「充足判定」ロジック。
//
// このファイルはUI（React）にもDOMにも依存しない「純粋な関数」だけで構成する。
// 入力（要件セット・履修状況・科目の単位数）から出力（各区分の充足状況）を計算するだけで、
// 画面の表示や localStorage の読み書きは一切行わない。
// こうしておくと、Reactを介さずに単体テストできるし、将来C++版と結果を突き合わせるのも簡単になる。
//
// 計算の考え方は docs/SPEC.md §7.2「充足計算の順序」を参照。

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
//
// TypeScriptの `interface` はC++でいう構造体（struct）に近い。「このオブジェクトは
// こういうプロパティを持つ」という形（shape）だけを定義し、メソッドは持たない。
// `?:` が付いたプロパティは省略可能（optional）という意味。

/**
 * 科目1つぶんの履修状態。
 * 「未履修」はこの型の値としては存在せず、後述の `records`（Map）にその科目の
 * キーが無いことで表現する（＝わざわざ 'not-taken' を持たせない）。
 */
export type SubjectStatus = 'passed' | 'taking' | 'failed'

/**
 * 卒業要件のグループ1つぶんの種別。
 * - required        : 必修。リストされた科目を全部修得して初めて満たされる
 * - elective        : 選択。required単位以上を、リストの中から自由に選んで修得する
 * - elective-required: 選択必修。必修に準じる区分で、required単位以上の修得が必要。
 *                      超過分は共通単位ではなく、同じ親の中の別グループ（多くは選択科目）に
 *                      加算される（学修要覧2.5.1・付録C）。加算先は `overflowTarget` で指定する
 * - free            : 自由科目。修得しても卒業要件には数えない（大学院連携科目など）
 * - international    : 国際科目。単位の扱いは年度ごとの科目一覧表による（現時点では free と同様に卒業要件へは算入しない）
 *
 * `'a' | 'b' | 'c'` のように文字列リテラルを `|`（ユニオン型）でつなぐと、
 * 「このいずれかの文字列」という型になる。C++のenum classに近い使い方。
 */
export type GroupKind = 'required' | 'elective' | 'elective-required' | 'free' | 'international'

/**
 * 卒業要件の1グループ分の定義（入力側の型）。
 * data/requirements/*.json の `groups` 配列の要素にそのまま対応する。
 *
 * グループは木構造になっていて、`children` を持つグループ（例:「理数基礎科目」）は
 * 中身をさらに「必修」「選択」のようなグループに分けている。
 * `children` を持たないグループが末端（葉）で、`subjects` に実際の科目番号が並ぶ。
 */
export interface RequirementGroup {
  id: string
  name: string
  label?: string
  /** このグループを満たすのに必要な単位数 */
  required: number
  /**
   * 判定の種別。省略した場合の扱いは evaluateGroup 内のコメントを参照
   * （子を持たないグループでは 'elective' として扱う）。
   */
  kind?: GroupKind
  /** このグループに直接属する科目番号（末尾記号を含むフルコード。例: COM405a）の一覧 */
  subjects?: string[]
  /** 下位グループ（無ければ末端グループ） */
  children?: RequirementGroup[]
  /**
   * required を超えて修得した単位を共通単位に繰り入れてよいか。
   * 省略時は true（繰り入れる）として扱う。人文・社会科学科目のように
   * 繰り入れを禁止したいグループだけ明示的に false を指定する。
   */
  overflowToCommon?: boolean
  /**
   * 'common' を指定すると、required との比較をせずに修得単位をそのまま
   * 共通単位として数える（例: 理数基礎科目の選択科目）。
   */
  countAs?: 'common'
  /**
   * false を指定すると、このグループの単位は卒業要件の合計単位数に一切算入しない
   * （自由科目＝大学院連携科目など）。省略時は true（算入する）。
   */
  countsTowardGraduation?: boolean
  /**
   * kind: 'elective-required' のグループでだけ使う。required を超えた分の単位を、
   * 同じ親グループの中にある別のグループ（このIDを持つもの）の充足に加算する。
   * 例:「類共通基礎科目」の下にある「選択必修」の超過分を、きょうだいの「選択」に加算する。
   */
  overflowTarget?: string
}

/**
 * ある「入学年度 × 類 × プログラム」に適用される、卒業要件の一式（評価関数への入力）。
 *
 * data/requirements/ 以下は共通ファイル（2025-day-common.json）とプログラム別ファイル
 * （2025-day-I-media.json など）に分かれているが、この型は2つを合体させたあとの形。
 * ファイルの合体（`extends` の解決）自体は importers.ts 側の仕事とする（フェーズ2以降）。
 */
export interface RequirementSet {
  /** 卒業に必要な合計単位数（例: Ⅰ類は128） */
  totalCredits: number
  /** 共通単位として必要な単位数（例: Ⅰ類メディアは8） */
  commonCredits: number
  /** 別表2の並び順のままのグループ一覧 */
  groups: RequirementGroup[]
  /**
   * 超過単位の計算を経由せず、修得すればそのまま共通単位になる科目番号の一覧。
   * 例: 言語文化応用科目Ⅱ、第二外国語の応用科目（学修要覧2.5.1）。
   * data/requirements/2025-day-common.json の commonCreditSources.alwaysCommon に対応する。
   *
   * 学外英語能力試験（TOEIC等）による認定単位はここでは扱わない。科目番号を持たない
   * 別入力になるため、対応は将来のフェーズで検討する。
   */
  alwaysCommonSubjects?: string[]
}

/**
 * 「必要単位／算入単位／不足単位／充足したか」をひとまとめにした集計結果。
 * グループ単位（GroupResult）でも、共通単位・合計単位（EvaluationResult）でも同じ形を使う。
 */
export interface CreditSummary {
  /** 必要単位数 */
  required: number
  /** 修得済み（確定）の単位のうち、この集計に算入される単位数 */
  contribution: number
  /** 不足単位数（確定分）。0未満にはならない */
  shortfall: number
  /** 確定分だけで required を満たしているか */
  satisfied: boolean
  /**
   * 履修中（見込み）の科目もすべて合格したと仮定した場合の値。
   * F-3「履修中は見込みとして別色表示する」に対応する。
   */
  projected: {
    contribution: number
    shortfall: number
    satisfied: boolean
  }
}

/** 1グループぶんの充足判定結果 */
export interface GroupResult extends CreditSummary {
  id: string
  name: string
  label?: string
  /**
   * 実際に判定境界として採用された種別。
   * 「上級科目」の中の「A類」のように、内訳を表示するためだけの下位グループでは
   * undefined になる（判定は親グループ側でまとめて行うため）。
   */
  kind?: GroupKind
  /** 修得済み単位の合計（このグループとその配下すべて） */
  earnedPassed: number
  /** 履修中（見込み）単位の合計（このグループとその配下すべて） */
  earnedTaking: number
  /** required を超えて修得した単位数（確定分）。行き先（共通単位／きょうだいグループ）を問わない生の超過分 */
  overflow: number
  /** 履修中を含めた場合の見込み超過単位数 */
  projectedOverflow: number
  /** 共通単位に繰り入れられる超過単位数（確定分） */
  overflowToCommon: number
  /** 履修中を含めた場合に共通単位へ繰り入れられる見込み単位数 */
  projectedOverflowToCommon: number
  /** 下位グループの判定結果（無ければ空配列） */
  children: GroupResult[]
}

/** evaluateRequirements の戻り値。卒業要件全体の充足状況 */
export interface EvaluationResult {
  /** 別表2の並び順のままのグループ判定結果 */
  groups: GroupResult[]
  /** 共通単位の充足状況 */
  commonCredits: CreditSummary
  /** 卒業に必要な合計単位数の充足状況 */
  totalCredits: CreditSummary
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/**
 * 指定した状態（passed / taking）の科目の単位数を合計する。
 *
 * `ReadonlyMap<string, T>` はJavaScript/TypeScriptの「キーと値の組」を持つコレクション。
 * C++の `std::map` に近いが、`.get(key)` で値を取り出し、キーが無ければ `undefined` が返る。
 * `Readonly` を付けているのは「この関数の中では書き換えない」という意図を型で示すため。
 */
function sumSubjectsByStatus(
  codes: readonly string[],
  status: SubjectStatus,
  records: ReadonlyMap<string, SubjectStatus>,
  subjectCredits: ReadonlyMap<string, number>,
): number {
  let total = 0
  // codes に並んでいる科目番号を1つずつ見て、状態が一致するものだけ単位数を足し込む
  for (const code of codes) {
    if (records.get(code) !== status) continue // 状態が違う（例: 探しているのはpassedなのにtaking）ので数えない
    const credits = subjectCredits.get(code)
    if (credits === undefined) {
      // data/ の整合性は scripts/validate_data.py で保証している前提なので、
      // ここに来るのは呼び出し側の科目マスタが不完全なプログラムミスとして扱う。
      throw new Error(`科目マスタに存在しない科目番号です: ${code}`)
    }
    total += credits
  }
  return total
}

/**
 * required・contribution・projectedContribution から CreditSummary を組み立てる。
 * グループ単位の集計と、共通単位・合計単位の集計の両方から呼ばれる共通処理。
 */
function summarize(required: number, contribution: number, projectedContribution: number): CreditSummary {
  return {
    required,
    contribution,
    shortfall: Math.max(0, required - contribution),
    satisfied: contribution >= required,
    projected: {
      contribution: projectedContribution,
      shortfall: Math.max(0, required - projectedContribution),
      satisfied: projectedContribution >= required,
    },
  }
}

/**
 * 判定境界となったグループ1つについて、「修得単位（earned）」から
 * 「算入単位（contribution）」と「required を超えた生の超過分（overflow）」を求める。
 * この超過分をどこに繰り入れるか（共通単位か、きょうだいグループか）は呼び出し側
 * （evaluateGroup）が kind を見て決める。
 *
 * kind ごとのルールは docs/SPEC.md §5 F-3・§7.2 の特殊ルールに対応する：
 * - 自由科目（countsTowardGraduation: false）は卒業要件にも共通単位にも数えない
 * - countAs: 'common' は required と比較せず、修得分をそのまま超過分として扱う
 * - required（必修）はグループ内の全科目の単位合計が required と一致する設計なので、
 *   理屈の上で超過は起こらない（validate_data.py が保証している）
 * - elective（選択）・elective-required（選択必修）は required まではこのグループの
 *   単位として数え、超えた分を overflow として返す
 * - free・international は required まで自分の枠には数えるが、超過分は集計しない
 *   （free はそもそも卒業要件外、international は扱いが未確定のため）
 */
function applyKindRule(kind: GroupKind, earned: number, group: RequirementGroup): { contribution: number; overflow: number } {
  // 自由科目：修得しても卒業要件にも共通単位にもカウントしない
  if (group.countsTowardGraduation === false) {
    return { contribution: 0, overflow: 0 }
  }

  // 理数基礎科目の選択科目など：required と比較せず、修得分をそのまま超過分（＝共通単位候補）にする
  if (group.countAs === 'common') {
    return { contribution: 0, overflow: earned }
  }

  // 必修：全科目の単位合計が required と一致する設計なので超過は起こらない
  if (kind === 'required') {
    return { contribution: Math.min(earned, group.required), overflow: 0 }
  }

  // 選択・選択必修・自由・国際の残り：required までを算入し、超えた分を overflow として返す
  // （ただし free・international は overflow を集計しない＝どこにも繰り入れない）
  const contribution = Math.min(earned, group.required)
  const overflow = kind === 'free' || kind === 'international' ? 0 : Math.max(0, earned - group.required)
  return { contribution, overflow }
}

/**
 * あるグループの超過分（overflow）が、共通単位に直接繰り入れられる種類かどうか。
 * - elective（選択）は overflowToCommon が false でない限り繰り入れる（従来どおり）
 * - elective-required（選択必修）は直接は繰り入れない。必ず `overflowTarget` で指定した
 *   きょうだいグループにまず加算し、そちらでも余ったらそちらの規則で共通単位に回る
 * - countAs: 'common' のグループは常に繰り入れる（overflowToCommon を明示的に false に
 *   していない限り）
 */
function overflowGoesToCommon(kind: GroupKind, group: RequirementGroup): boolean {
  if (group.overflowToCommon === false) return false // 明示的に禁止されている（人文・社会科学科目など）
  if (group.countAs === 'common') return true // 理数基礎の選択科目など、常に共通単位扱い
  return kind === 'elective' // 選択科目だけが直接共通単位に回る。選択必修はここではfalseになる
}

/**
 * グループ1つ（とその配下）を再帰的に判定する。
 *
 * ポイントは「判定境界（isBoundary）」の考え方：
 * - kind が明示されているグループ（例:「上級科目」全体で4単位、のようなグループ）は、
 *   それ自体が判定境界になる。配下の科目・グループの単位をすべて合算し、required と比較する
 * - kind が無い葉グループ（children を持たない）は、祖先がまだ判定境界を持っていない場合に限り
 *   「選択科目」として判定境界になる（デフォルトは elective 扱い）
 * - kind が無い葉グループでも、祖先がすでに判定境界を持っている場合（＝「上級科目」の中の
 *   「A類」のような内訳表示専用のグループ）は判定境界にしない。ここで境界にしてしまうと、
 *   親と子の両方で超過単位を共通単位に回してしまい、二重計上になる
 * - kind の無い親グループ（例:「健康・スポーツ科学科目」）は判定境界を持たず、
 *   子グループの結果をそのまま合計するだけの「積み上げ役」になる
 *
 * `insideBoundary` はこの「祖先がすでに判定境界を持っているか」を再帰の途中で
 * 引き継ぐためのフラグ。
 */
function evaluateGroup(
  group: RequirementGroup,
  records: ReadonlyMap<string, SubjectStatus>,
  subjectCredits: ReadonlyMap<string, number>,
  insideBoundary: boolean,
): GroupResult {
  // このグループ自身が判定境界かどうかを先に決める（考え方は上のコメント参照）
  const isLeaf = !group.children || group.children.length === 0
  const isBoundary = group.kind !== undefined || (isLeaf && !insideBoundary)

  // 子グループがあれば先に再帰的に評価しておく（無ければ空配列のまま）
  const children = (group.children ?? []).map((child) =>
    evaluateGroup(child, records, subjectCredits, insideBoundary || isBoundary),
  )

  // 修得済み（passed）・履修中（taking）の単位を、自分の科目リスト＋子グループぶんすべて合算する
  const ownSubjects = group.subjects ?? []
  const ownPassed = sumSubjectsByStatus(ownSubjects, 'passed', records, subjectCredits)
  const ownTaking = sumSubjectsByStatus(ownSubjects, 'taking', records, subjectCredits)
  const earnedPassed = ownPassed + children.reduce((sum, child) => sum + child.earnedPassed, 0)
  const earnedTaking = ownTaking + children.reduce((sum, child) => sum + child.earnedTaking, 0)

  let kind: GroupKind | undefined
  let contribution: number
  let overflow: number
  let overflowToCommon: number
  let projectedContribution: number
  let projectedOverflow: number
  let projectedOverflowToCommon: number
  let finalChildren = children

  if (isBoundary) {
    // 判定境界：kind ごとのルール（applyKindRule）を、確定分（passed）と見込み分（passed+taking）の
    // 両方に対して適用する。見込み分は「履修中の科目も全部合格したら」という仮定の値になる。
    kind = group.kind ?? 'elective'
    const confirmed = applyKindRule(kind, earnedPassed, group)
    const projected = applyKindRule(kind, earnedPassed + earnedTaking, group)
    contribution = confirmed.contribution
    overflow = confirmed.overflow
    overflowToCommon = overflowGoesToCommon(kind, group) ? confirmed.overflow : 0
    projectedContribution = projected.contribution
    projectedOverflow = projected.overflow
    projectedOverflowToCommon = overflowGoesToCommon(kind, group) ? projected.overflow : 0
  } else {
    // 積み上げ役：自分では判定せず、子グループの結果をそのまま合計するだけ
    kind = undefined
    // 選択必修→選択のような「同じ親の中でのグループ間の繰り入れ」（overflowTarget）を、
    // 子を合計する前に適用する。対象を指定していない子は何も変わらない。
    finalChildren = applyOverflowTargets(group.children ?? [], children)
    contribution = finalChildren.reduce((sum, child) => sum + child.contribution, 0)
    overflow = finalChildren.reduce((sum, child) => sum + child.overflow, 0)
    overflowToCommon = finalChildren.reduce((sum, child) => sum + child.overflowToCommon, 0)
    projectedContribution = finalChildren.reduce((sum, child) => sum + child.projected.contribution, 0)
    projectedOverflow = finalChildren.reduce((sum, child) => sum + child.projectedOverflow, 0)
    projectedOverflowToCommon = finalChildren.reduce((sum, child) => sum + child.projectedOverflowToCommon, 0)
  }

  // required・shortfall・satisfied（確定分・見込み分）をまとめて計算する
  const summary = summarize(group.required, contribution, projectedContribution)

  // このグループ自身の情報（summary）と、配下の集計値をあわせて1つの結果にする
  return {
    ...summary,
    id: group.id,
    name: group.name,
    label: group.label,
    kind,
    earnedPassed,
    earnedTaking,
    overflow,
    projectedOverflow,
    overflowToCommon,
    projectedOverflowToCommon,
    children: finalChildren,
  }
}

/**
 * `overflowTarget` を指定している子グループの超過分を、同じ親の中の対象グループへ加算する。
 *
 * 例:「類共通基礎科目」の子に「選択必修（required 4, overflowTarget: 'cluster-basic-sel'）」と
 * 「選択（required 8）」があり、選択必修を6単位修得した場合：
 * 1. 選択必修の超過2単位を「選択」の算入単位に加算する（選択の required を超えない範囲で）
 * 2. 選択がそれでも埋まりきらなければ、そのまま選択の不足として残る
 * 3. 選択の required を超えてなお余れば、選択自身の共通単位への繰入ルールに従う
 *
 * 対象グループ（overflowTarget の相手）自体の overflow・overflowToCommon が
 * 加算後の値に更新されるので、呼び出し側は返り値の配列をそのまま使えばよい。
 */
function applyOverflowTargets(reqChildren: readonly RequirementGroup[], results: readonly GroupResult[]): GroupResult[] {
  // overflowTarget を指定している子が1つも無ければ、何もせず（コピーだけして）そのまま返す
  const hasTarget = reqChildren.some((c) => c.overflowTarget)
  if (!hasTarget) return [...results]

  // グループID → 配列の添字、の対応表。overflowTarget（IDで指定される）から
  // 実際の配列要素を引けるようにする
  const byId = new Map(reqChildren.map((c, i) => [c.id, i]))
  const updated = [...results]

  // 子を1つずつ見て、overflowTarget が指定されていれば繰り入れ処理をする
  for (let i = 0; i < reqChildren.length; i++) {
    const targetId = reqChildren[i].overflowTarget
    if (!targetId) continue // このグループは繰り入れ元ではない
    const targetIndex = byId.get(targetId)
    if (targetIndex === undefined) continue // 未知のIDなら何もしない（データ側の不備）

    const source = updated[i]
    const target = updated[targetIndex]
    const targetGroup = reqChildren[targetIndex]

    // 繰り入れ先（target）の「まだ埋まっていない分」までしか移せない。
    // それでも余る分（leftover）は、targetの共通単位への繰入額に直接足す
    const confirmedTransfer = Math.min(source.overflow, Math.max(0, target.required - target.contribution))
    const confirmedLeftover = source.overflow - confirmedTransfer
    const projectedTransfer = Math.min(source.projectedOverflow, Math.max(0, target.required - target.projected.contribution))
    const projectedLeftover = source.projectedOverflow - projectedTransfer

    const newTargetContribution = target.contribution + confirmedTransfer
    const newTargetProjectedContribution = target.projected.contribution + projectedTransfer
    // target自身が共通単位への繰り入れを許可しているか（overflowToCommon: false でないか）
    const targetOverflowAllowed = overflowGoesToCommon(target.kind ?? 'elective', targetGroup)

    // target（繰り入れ先）の集計値を、移した分を反映した新しい値に置き換える
    updated[targetIndex] = {
      ...target,
      contribution: newTargetContribution,
      overflow: target.overflow + confirmedLeftover,
      overflowToCommon: target.overflowToCommon + (targetOverflowAllowed ? confirmedLeftover : 0),
      shortfall: Math.max(0, target.required - newTargetContribution),
      satisfied: newTargetContribution >= target.required,
      projected: {
        contribution: newTargetProjectedContribution,
        shortfall: Math.max(0, target.required - newTargetProjectedContribution),
        satisfied: newTargetProjectedContribution >= target.required,
      },
      projectedOverflow: target.projectedOverflow + projectedLeftover,
      projectedOverflowToCommon: target.projectedOverflowToCommon + (targetOverflowAllowed ? projectedLeftover : 0),
    }
    // 移した分だけ、超過元グループ自身の overflow（共通単位候補としての額）はゼロにする
    // （加算済みなので、これ以上どこにも回さない）
    updated[i] = { ...source, overflow: 0, projectedOverflow: 0 }
  }

  return updated
}

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

/**
 * 卒業要件セットと履修状況から、区分ごとの充足状況・共通単位・合計単位を判定する。
 *
 * 計算の流れ（docs/SPEC.md §7.2「充足計算の順序」に対応）:
 * 1. 各グループについて修得単位を集計する（必修は全科目修得、選択は required 以上）
 * 2. required を超えた分は、繰り入れが許可されているグループに限り共通単位の候補にする
 * 3. 自由科目（countsTowardGraduation: false）は合計に算入しない
 * 4. 合計単位 = 各グループの算入単位の和 ＋ min(共通単位の修得数, commonCredits)
 */
export function evaluateRequirements(
  requirementSet: RequirementSet,
  records: ReadonlyMap<string, SubjectStatus>,
  subjectCredits: ReadonlyMap<string, number>,
): EvaluationResult {
  // トップレベルのグループを1つずつ（再帰的に）判定する
  const groups = requirementSet.groups.map((group) => evaluateGroup(group, records, subjectCredits, false))

  // 各グループの overflowToCommon は、判定境界の時点ですでに配下全体の超過分を
  // 集約し終えている（積み上げ役のグループはそれをそのまま合計しているだけ）ので、
  // トップレベルのグループを合計するだけで木全体の繰入額が求まる。
  const alwaysCommonSubjects = requirementSet.alwaysCommonSubjects ?? []
  const alwaysCommonPassed = sumSubjectsByStatus(alwaysCommonSubjects, 'passed', records, subjectCredits)
  const alwaysCommonTaking = sumSubjectsByStatus(alwaysCommonSubjects, 'taking', records, subjectCredits)

  // 共通単位の修得見込み = 各グループからの繰入額の合計 + 常に共通単位になる科目の単位数
  const commonEarned = groups.reduce((sum, g) => sum + g.overflowToCommon, 0) + alwaysCommonPassed
  const commonEarnedProjected =
    groups.reduce((sum, g) => sum + g.projectedOverflowToCommon, 0) + alwaysCommonPassed + alwaysCommonTaking

  // 共通単位も required（commonCredits）で頭打ちにしてから CreditSummary にする
  const commonCredits = summarize(
    requirementSet.commonCredits,
    Math.min(commonEarned, requirementSet.commonCredits),
    Math.min(commonEarnedProjected, requirementSet.commonCredits),
  )

  // 合計単位 = 各グループの算入単位の和 + 共通単位（§7.2「充足計算の順序」4.）
  const groupsContribution = groups.reduce((sum, g) => sum + g.contribution, 0)
  const groupsContributionProjected = groups.reduce((sum, g) => sum + g.projected.contribution, 0)

  const totalCredits = summarize(
    requirementSet.totalCredits,
    groupsContribution + commonCredits.contribution,
    groupsContributionProjected + commonCredits.projected.contribution,
  )

  return { groups, commonCredits, totalCredits }
}
