// 審査（2年次終了時審査・卒業研究着手審査・卒業審査など）の合否判定。
// requirements.ts と同じく、React にも DOM にも依存しない純粋な関数だけで構成する。
// データの形（ReviewDef等）は requirements.ts 側に定義してある。
//
// 判定の考え方（docs/SPEC.md F-3「審査」参照）：
// 審査ごとに条件（allOf=すべて満たす／anyOf=どれか1つ満たす）の木があり、
// 葉の条件（groupMin・allPassed・subjects・totalCredits・commonCredits・allGroups・review）を
// evaluateRequirements() の結果（EvaluationResult）と履修記録から判定する。

import type { EvaluationResult, GroupResult, ReviewCondition, ReviewDef, ReviewNode, SubjectStatus } from './requirements'

/** 審査1件ぶんの判定結果 */
export interface ReviewStatus {
  id: string
  name: string
  when?: string
  satisfied: boolean
  /** 修得予定の科目もすべて修得できたと仮定した場合の合否 */
  projectedSatisfied: boolean
  /**
   * 不合格のとき、原因になっている条件の一覧（表示用に生データのまま返す。
   * 科目名・区分名への変換はUI側の役目）。合格していれば空配列
   */
  unsatisfied: ReviewCondition[]
  /**
   * 審査全体が「どれか1つを満たせばよい」（anyOf）形で、どの枝も満たしていないときだけ、
   * 枝ごとの不足条件を並べたもの（例: 2年次終了時審査の「通常の条件」と「特例（合計60単位）」）。
   * unsatisfiedは一番惜しい枝だけなので、両方の選択肢を見せたい表示ではこちらを使う。
   * 合格している・anyOf形でない審査では空配列
   */
  unsatisfiedAlternatives: ReviewCondition[][]
  /**
   * 合格（または修得見込で合格）でも、それが特例の枝（注記が「特例」で始まる条件。例: 合計60単位以上）
   * だけによるもので、修得見込をすべて修得しても通常の条件を満たさないときtrue。
   * 特例は認められない場合もあるため、画面で注意書きを出すのに使う。通常の条件を満たせる見込みならfalse
   */
  reliesOnExceptionalRule: boolean
  /** reliesOnExceptionalRuleがtrueのとき、頼っている特例の条件（表示用）。それ以外は空配列 */
  exceptionalConditions: ReviewCondition[]
  onFail?: { blockedSubjects?: string[]; note?: string }
  /** 合否に関わらず常に表示する注記（ReviewDef.caveatをそのまま渡すだけ） */
  caveat?: string
}

/** evaluation.groups の木を再帰的にたどって、指定idの判定結果を探す（無ければundefined） */
export function findGroupResult(groups: readonly GroupResult[], id: string): GroupResult | undefined {
  for (const g of groups) {
    if (g.id === id) return g
    const found = findGroupResult(g.children, id)
    if (found) return found
  }
  return undefined
}

/** 判定境界（kindを持つ）グループがすべて木全体で満たされているか（卒業審査のallGroups用） */
function allBoundaryGroupsSatisfied(groups: readonly GroupResult[], projected: boolean): boolean {
  return groups.every(
    (g) => (g.kind === undefined || (projected ? g.projected.satisfied : g.satisfied)) && allBoundaryGroupsSatisfied(g.children, projected),
  )
}

interface Context {
  evaluation: EvaluationResult
  records: ReadonlyMap<string, SubjectStatus>
  subjectCredits: ReadonlyMap<string, number>
  reviews: readonly ReviewDef[]
  /** review条件（他の審査への参照）が循環しないよう、評価中の審査idを覚えておく */
  visiting: Set<string>
  /** 一度判定した審査は使い回す */
  cache: Map<string, boolean>
  /** trueなら、taking（修得予定）を修得済みとして見込み判定する */
  projected: boolean
}

/** 現在の修得だけで見るか、修得予定も含めるかに応じて科目の達成状態を判定する。 */
function isSubjectPassed(code: string, ctx: Context): boolean {
  const status = ctx.records.get(code)
  return status === 'passed' || (ctx.projected && status === 'taking')
}

function isConditionSatisfied(cond: ReviewCondition, ctx: Context): boolean {
  switch (cond.type) {
    case 'groupMin':
      return ((ctx.projected
        ? findGroupResult(ctx.evaluation.groups, cond.groupId)?.projected.contribution
        : findGroupResult(ctx.evaluation.groups, cond.groupId)?.contribution) ?? 0) >= cond.min
    case 'allPassed':
      return ctx.projected
        ? findGroupResult(ctx.evaluation.groups, cond.groupId)?.projected.satisfied ?? false
        : findGroupResult(ctx.evaluation.groups, cond.groupId)?.satisfied ?? false
    case 'subjects':
      return cond.codes.every((code) => isSubjectPassed(code, ctx))
    case 'totalCredits':
      return (ctx.projected ? ctx.evaluation.totalCredits.projected.contribution : ctx.evaluation.totalCredits.contribution) >= cond.min
    case 'commonCredits':
      return (ctx.projected ? ctx.evaluation.commonCredits.projected.contribution : ctx.evaluation.commonCredits.contribution) >= cond.min
    case 'allGroups': {
      // 「すべての区分」には共通単位も含める。共通単位は内部では超過分から後で計算するため
      // evaluation.groups とは別の場所（commonCredits）にあるが、学修要覧の別表2では他の区分と
      // 並ぶ区分の1つなので、ここで一緒に判定する（2026-09-24、開発者判断）
      const common = ctx.evaluation.commonCredits
      const commonSatisfied = ctx.projected ? common.projected.shortfall === 0 : common.satisfied
      return allBoundaryGroupsSatisfied(ctx.evaluation.groups, ctx.projected) && commonSatisfied
    }
    case 'review':
      return evaluateReviewSatisfied(cond.id, ctx)
    case 'subjectsCountMin':
      // 単位数ではなく「何科目修得したか」を数える（別表4の「◯科目のうち◯科目以上」用）
      return cond.codes.filter((code) => isSubjectPassed(code, ctx)).length >= cond.min
    case 'subjectsCreditMin':
      // 複数グループにまたがる科目をまとめて単位数で数える（別表4の複数区分合算の条件用）
      return sumCreditsOfPassed(cond.codes, ctx) >= cond.min
  }
}

/** 指定した科目番号のうち、修得済み（passed）のものだけ単位数を合計する */
function sumCreditsOfPassed(codes: readonly string[], ctx: Context): number {
  let total = 0
  for (const code of codes) {
    if (!isSubjectPassed(code, ctx)) continue
    const credits = ctx.subjectCredits.get(code)
    if (credits === undefined) {
      // data/ の整合性は scripts/validate_data.py で保証している前提なので、
      // ここに来るのは審査データ側の科目番号ミスとして扱う
      throw new Error(`科目マスタに存在しない科目番号です: ${code}`)
    }
    total += credits
  }
  return total
}

function isNodeSatisfied(node: ReviewNode, ctx: Context): boolean {
  if ('allOf' in node) return node.allOf.every((n) => isNodeSatisfied(n, ctx))
  if ('anyOf' in node) return node.anyOf.some((n) => isNodeSatisfied(n, ctx))
  return isConditionSatisfied(node, ctx)
}

/**
 * 不合格の原因になっている葉の条件を集める。
 * allOf は満たしていない子をすべて集める。anyOf は、どれか1つでも満たしていれば
 * （全体としては合格なので）空配列。全部不合格なら、不足の条件数が一番少ない
 * （＝一番あと少しで合格できそうな）枝を選んで返す
 */
function collectUnsatisfied(node: ReviewNode, ctx: Context): ReviewCondition[] {
  if ('allOf' in node) return node.allOf.flatMap((n) => collectUnsatisfied(n, ctx))
  if ('anyOf' in node) {
    if (node.anyOf.some((n) => isNodeSatisfied(n, ctx))) return []
    const branches = node.anyOf.map((n) => collectUnsatisfied(n, ctx))
    return branches.reduce((best, cur) => (cur.length < best.length ? cur : best))
  }
  return isConditionSatisfied(node, ctx) ? [] : [node]
}

/**
 * 審査全体が1つのanyOfだけでできている場合に、枝ごとの不足条件を集める（枝の並び順はデータのまま）。
 * 審査が不合格のときだけ呼ぶので、ここに来た時点でどの枝も満たしていない。
 * anyOf形でない審査（allOfなど）は選択肢が無いので空配列を返す
 */
function collectUnsatisfiedAlternatives(nodes: readonly ReviewNode[], ctx: Context): ReviewCondition[][] {
  // 審査のトップが「anyOf 1つだけ」でなければ、選択肢として並べる対象ではない
  if (nodes.length !== 1 || !('anyOf' in nodes[0])) return []
  return nodes[0].anyOf.map((branch) => collectUnsatisfied(branch, ctx))
}

/** 審査のanyOfの枝が特例か。データでは特例の条件の注記を「特例。…」で始める約束になっている */
function isExceptionalBranch(node: ReviewNode): node is ReviewCondition {
  // 特例は条件1つだけの枝（合計単位数など）なので、葉の条件の注記だけを見る。
  return !('allOf' in node) && !('anyOf' in node) && (node.note?.startsWith('特例') ?? false)
}

/**
 * 審査が合格（または修得見込で合格）でも、特例の枝だけに頼っているなら、その特例の条件を返す。
 * 通常の枝を修得見込込みで満たせる場合・特例の枝が無い審査・不合格の審査では空配列。
 */
function exceptionalConditionsRelied(nodes: readonly ReviewNode[], passes: boolean, projectedCtx: Context): ReviewCondition[] {
  // 審査のトップが「anyOf 1つだけ」で、合格の見込みがあるときだけ調べる。
  if (!passes || nodes.length !== 1 || !('anyOf' in nodes[0])) return []
  const exceptional = nodes[0].anyOf.filter(isExceptionalBranch)
  const regular = nodes[0].anyOf.filter((branch) => !isExceptionalBranch(branch))
  // 特例と通常の両方の枝がある審査でなければ、注意書きの対象にしない。
  if (exceptional.length === 0 || regular.length === 0) return []
  // 修得見込をすべて修得したと仮定しても通常の枝を満たさないなら、合格は特例頼み。
  // （見込みは現在の修得済みを含むので、通常の枝を今満たしていれば見込みでも満たす）
  if (regular.some((branch) => isNodeSatisfied(branch, projectedCtx))) return []
  return exceptional
}

function evaluateReviewSatisfied(id: string, ctx: Context): boolean {
  if (ctx.cache.has(id)) return ctx.cache.get(id) as boolean
  if (ctx.visiting.has(id)) return false // 循環参照は起きない想定だが、安全側でfalseにする
  const review = ctx.reviews.find((r) => r.id === id)
  if (!review) return false
  ctx.visiting.add(id)
  const result = reviewNodes(review).every((n) => isNodeSatisfied(n, ctx))
  ctx.visiting.delete(id)
  ctx.cache.set(id, result)
  return result
}

/** ReviewDef自身もallOf/anyOfを直接持つノードとして扱う（両方無ければ無条件で合格） */
function reviewNodes(review: ReviewDef): ReviewNode[] {
  if (review.allOf) return review.allOf
  if (review.anyOf) return [{ anyOf: review.anyOf }]
  return []
}

/** すべての審査を判定する。表示順はreviewsの並び順のまま */
export function evaluateReviews(
  reviews: readonly ReviewDef[],
  evaluation: EvaluationResult,
  records: ReadonlyMap<string, SubjectStatus>,
  subjectCredits: ReadonlyMap<string, number>,
): ReviewStatus[] {
  const ctx: Context = { evaluation, records, subjectCredits, reviews, visiting: new Set(), cache: new Map(), projected: false }
  // 現在の合否と同じ条件木を、修得予定を含めた見込み用にも独立して評価する。
  // cache/visitingを共有すると片方の判定が混ざるため、見込み用には別のContextを作る。
  const projectedCtx: Context = { evaluation, records, subjectCredits, reviews, visiting: new Set(), cache: new Map(), projected: true }
  return reviews.map((review) => {
    const nodes = reviewNodes(review)
    const satisfied = nodes.every((n) => isNodeSatisfied(n, ctx))
    const projectedSatisfied = nodes.every((n) => isNodeSatisfied(n, projectedCtx))
    ctx.cache.set(review.id, satisfied)
    projectedCtx.cache.set(review.id, projectedSatisfied)
    // 合格・修得見込で合格のどちらでも、特例だけに頼っていれば注意書き用に条件を残す。
    const exceptionalConditions = exceptionalConditionsRelied(nodes, satisfied || projectedSatisfied, projectedCtx)
    return {
      id: review.id,
      name: review.name,
      when: review.when,
      satisfied,
      projectedSatisfied,
      unsatisfied: satisfied ? [] : nodes.flatMap((n) => collectUnsatisfied(n, ctx)),
      unsatisfiedAlternatives: satisfied ? [] : collectUnsatisfiedAlternatives(nodes, ctx),
      reliesOnExceptionalRule: exceptionalConditions.length > 0,
      exceptionalConditions,
      onFail: review.onFail,
      caveat: review.caveat,
    }
  })
}
