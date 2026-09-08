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
    case 'allGroups':
      return allBoundaryGroupsSatisfied(ctx.evaluation.groups, ctx.projected)
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
    return {
      id: review.id,
      name: review.name,
      when: review.when,
      satisfied,
      projectedSatisfied,
      unsatisfied: satisfied ? [] : nodes.flatMap((n) => collectUnsatisfied(n, ctx)),
      onFail: review.onFail,
      caveat: review.caveat,
    }
  })
}
