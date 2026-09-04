// 「次に取るべき科目」の推奨順位付けロジック。
//
// requirements.ts と同じく、UI（React）にもDOMにも依存しない純粋な関数だけで構成する。
// 計算の考え方は docs/SPEC.md §8「推奨ロジック仕様」を参照。
//
// 注意：シラバスから取る予定の「先修科目」「曜日時限」（`docs/SPEC.md` §7.1 の `offerings`）は
// まだデータが無い（フェーズ3で scripts/fetch_syllabus.py を作ってから埋まる）。
// このファイルはそのデータが無くても動くように、無ければ「先修条件なし」「時限の重複なし」として
// 扱う。データが揃った後もこのファイルの呼び出し方は変えなくてよいように設計してある。

import type { GroupKind, RequirementGroup, RequirementSet, SubjectStatus } from './requirements'
import type { EvaluationResult, GroupResult } from './requirements'

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** 曜日時限（先修科目・重複チェック用。シラバスデータが無ければ省略してよい） */
export interface TimeSlot {
  day: string
  period: number
}

/**
 * recommend.ts が科目について知る必要がある情報。
 * data/subjects/*.json のうち、推奨計算に使う項目だけを抜き出した形（型としては
 * 元のオブジェクトがこれより多くのプロパティを持っていても構わない。TypeScriptの構造的型付けにより、
 * 「最低限これだけ持っていればよい」という指定になる）。
 */
export interface SubjectInfo {
  code: string
  credits: number
  /** 標準履修年次（1〜4）。無ければ年次を問わない科目として扱う */
  standardYear?: number | null
  /** 開講期。'前学期' でも '後学期' でもない（＝通年や不定期開講の）科目は termType を省略する */
  termType?: '前学期' | '後学期' | null
  /** 履修できる学年。省略時は standardYear 以上のすべての学年 */
  allowedYears?: number[]
  /** 先修科目の科目コード一覧。シラバスデータが無ければ省略してよい（＝先修条件なし扱い） */
  prerequisites?: string[]
  /** 曜日時限。シラバスデータが無ければ省略してよい（＝重複チェックをしない） */
  slots?: TimeSlot[]
}

/** 表示フィルタ（画面右上のドロップダウン）。学期を選ぶか、全学年か */
export type TermFilter = 'all' | { year: number; half: '前学期' | '後学期' }

export interface RecommendInput {
  requirementSet: RequirementSet
  /** 事前に evaluateRequirements() で計算しておいた充足状況（区分ごとの不足単位を使う） */
  evaluation: EvaluationResult
  records: ReadonlyMap<string, SubjectStatus>
  subjects: ReadonlyMap<string, SubjectInfo>
  /** ユーザーの現在の学年（1〜4） */
  currentGrade: number
  termFilter: TermFilter
  /** 履修中・履修予定の科目の曜日時限（重複警告の判定に使う。シラバスデータが無ければ省略可） */
  busySlots?: readonly TimeSlot[]
}

export interface RecommendedSubject {
  code: string
  /** §8 のスコア（降順に並べるための値。表示する必要はない） */
  score: number
  /** スコアに最も貢献した要因（デバッグ・将来のツールチップ用。F-4画面の理由ラベルとは別物） */
  reason: RecommendReason
  /** 標準履修年次より後の学年で履修する場合の注記（例:「2年前期科目」）。該当しなければ undefined */
  laterThanStandardYearNote?: string
  /** 履修中・履修予定の科目と曜日時限が重なっている場合 true */
  clash: boolean
}

export type RecommendReason =
  | 'required-not-passed'
  | 'shortfall-group'
  | 'behind-standard-year'
  | 'prerequisites-met'
  | 'none'

// ---------------------------------------------------------------------------
// スコアの重み（docs/SPEC.md §8 の初期値）
// ---------------------------------------------------------------------------
const W1_REQUIRED_NOT_PASSED = 100
const W2_SHORTFALL_GROUP = 50
const W3_SHORTFALL_RATIO = 30
const W4_BEHIND_STANDARD_YEAR = 20
const W5_PREREQUISITES_MET = 10
const W6_SLOT_CLASH = 40
const W7_GROUP_ALREADY_FULL = 100

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

interface GroupMembership {
  kind: GroupKind | undefined
  required: number
  shortfall: number
  satisfied: boolean
}

/**
 * 科目コード → その科目が属するグループ（判定境界になっているものだけ）の一覧、という対応表を作る。
 * 1つの科目が複数のグループに載っていることもある（例: 上級科目の国際科目扱いの科目）ので、
 * 配列で持つ。
 */
function buildMembership(
  requirementGroups: readonly RequirementGroup[],
  evaluationGroups: readonly GroupResult[],
): Map<string, GroupMembership[]> {
  const membership = new Map<string, GroupMembership[]>()

  // 1つの科目コードに対して、所属グループの情報を配列へ追記していく
  function add(code: string, info: GroupMembership) {
    const list = membership.get(code)
    if (list) list.push(info)
    else membership.set(code, [info])
  }

  // requirements.ts の evaluateGroup と同じ形で木をたどり、判定境界になっているグループ
  // （evalGroup.kind が付いているもの）だけ、そこに載っている科目をmembershipに登録する
  function walk(reqGroups: readonly RequirementGroup[], evalGroups: readonly GroupResult[]) {
    for (let i = 0; i < reqGroups.length; i++) {
      const reqGroup = reqGroups[i]
      const evalGroup = evalGroups[i]
      if (evalGroup.kind !== undefined) {
        const info: GroupMembership = {
          kind: evalGroup.kind,
          required: evalGroup.required,
          shortfall: evalGroup.shortfall,
          satisfied: evalGroup.satisfied,
        }
        for (const code of reqGroup.subjects ?? []) add(code, info)
      }
      if (reqGroup.children) walk(reqGroup.children, evalGroup.children) // 判定境界でなくても、子はさらにたどる
    }
  }

  walk(requirementGroups, evaluationGroups)
  return membership
}

/** 科目が指定した学期フィルタで「開講され、履修できる」かどうか */
function isOfferedIn(subject: SubjectInfo, termFilter: TermFilter, currentGrade: number): boolean {
  if (termFilter === 'all') return true // 「全学年」表示のときは絞り込まない

  // termType が無い科目（通年・不定期開講など）は、どの学期フィルタでも履修候補に出す
  if (subject.termType != null && subject.termType !== termFilter.half) return false

  // 履修できる学年（allowedYears。無ければ標準履修年次のみ）のどれかが、
  // フィルタで選ばれた学年以下（＝もう到達している）でなければ候補にしない
  const allowedYears = subject.allowedYears ?? (subject.standardYear != null ? [subject.standardYear] : undefined)
  if (allowedYears && !allowedYears.some((y) => y <= termFilter.year)) return false
  if (subject.standardYear != null && subject.standardYear > termFilter.year) return false

  void currentGrade // 学年そのものはフィルタの year を使うので、ここでは判定に使わない
  return true
}

/** 履修中・履修予定の科目（busySlots）と、この科目の曜日時限が1つでも重なっていれば true */
function hasSlotClash(subject: SubjectInfo, busySlots: readonly TimeSlot[]): boolean {
  if (!subject.slots || subject.slots.length === 0) return false // 時限データが無ければ判定しようがない
  return subject.slots.some((slot) => busySlots.some((busy) => busy.day === slot.day && busy.period === slot.period))
}

/** 先修科目（prerequisites）が指定されていれば、そのすべてを修得済み（passed）かどうかを返す */
function prerequisitesMet(subject: SubjectInfo, records: ReadonlyMap<string, SubjectStatus>): boolean {
  if (!subject.prerequisites || subject.prerequisites.length === 0) return true // 先修条件が無ければ常にOK
  return subject.prerequisites.every((code) => records.get(code) === 'passed')
}

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

/**
 * 「次に取るべき科目」を優先度順に並べる。
 *
 * 計算の流れ（docs/SPEC.md §8 に対応）:
 * 0. 学期フィルタに応じて候補科目を絞り込む（全学年なら絞り込まない）
 * 1. 修得済み（passed）の科目は候補から外す（不合格 failed は再履修候補として残す）
 * 2. 各候補にスコアを付ける（必修未修得・不足区分・遅れている年次・先修条件・時限重複・区分の充足済み）
 * 3. スコアの降順、同点なら標準履修年次が古い順に並べる
 */
export function recommend(input: RecommendInput): RecommendedSubject[] {
  const { requirementSet, evaluation, records, subjects, currentGrade, termFilter, busySlots = [] } = input
  const membership = buildMembership(requirementSet.groups, evaluation.groups)

  const candidates: RecommendedSubject[] = []

  // 科目マスタの全科目を1つずつ見て、候補として残すかどうか・スコアはいくつかを決める
  for (const subject of subjects.values()) {
    if (records.get(subject.code) === 'passed') continue // 修得済みはもう推奨する必要が無い
    if (!isOfferedIn(subject, termFilter, currentGrade)) continue // 表示中の学期に取れない科目は除外

    // この科目が属している判定境界グループ（複数のことがある）の情報を集める
    const memberships = membership.get(subject.code) ?? []
    const isRequiredNotPassed = memberships.some((m) => m.kind === 'required')
    const shortfallGroups = memberships.filter((m) => m.kind === 'elective' && m.shortfall > 0)
    // 複数の不足区分に属していたら、一番不足率が高いものを採用する（w3用）
    const maxShortfallRatio = shortfallGroups.reduce(
      (max, m) => Math.max(max, m.required > 0 ? m.shortfall / m.required : 0),
      0,
    )
    const isBehindStandardYear = subject.standardYear != null && subject.standardYear <= currentGrade
    const prereqOk = prerequisitesMet(subject, records)
    const clash = hasSlotClash(subject, busySlots)
    const isGroupAlreadyFull = memberships.length > 0 && memberships.every((m) => m.satisfied)

    // docs/SPEC.md §8 の重み付け加算・減算をそのまま計算する
    const score =
      (isRequiredNotPassed ? W1_REQUIRED_NOT_PASSED : 0) +
      (shortfallGroups.length > 0 ? W2_SHORTFALL_GROUP : 0) +
      W3_SHORTFALL_RATIO * maxShortfallRatio +
      (isBehindStandardYear ? W4_BEHIND_STANDARD_YEAR : 0) +
      (prereqOk ? W5_PREREQUISITES_MET : 0) -
      (clash ? W6_SLOT_CLASH : 0) -
      (isGroupAlreadyFull ? W7_GROUP_ALREADY_FULL : 0)

    // スコアに貢献した理由のうち、優先順位が一番高いものを1つだけ選ぶ
    const reason: RecommendReason = isRequiredNotPassed
      ? 'required-not-passed'
      : shortfallGroups.length > 0
        ? 'shortfall-group'
        : isBehindStandardYear
          ? 'behind-standard-year'
          : prereqOk
            ? 'prerequisites-met'
            : 'none'

    // 標準履修年次より遅れて履修する場合だけ、注記文字列を作る（例:「2年前期科目」。学期が無ければ「2年次科目」）
    const laterThanStandardYearNote =
      subject.standardYear != null && subject.standardYear < currentGrade
        ? `${subject.standardYear}年${subject.termType === '前学期' ? '前期' : subject.termType === '後学期' ? '後期' : '次'}科目`
        : undefined

    candidates.push({ code: subject.code, score, reason, laterThanStandardYearNote, clash })
  }

  // スコアの高い順。同点なら標準履修年次が古い（＝小さい）ものを先にする
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const yearA = subjects.get(a.code)?.standardYear ?? Number.POSITIVE_INFINITY
    const yearB = subjects.get(b.code)?.standardYear ?? Number.POSITIVE_INFINITY
    return yearA - yearB
  })

  return candidates
}
