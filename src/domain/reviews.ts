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
  /**
   * 不合格のとき、原因になっている条件の一覧（表示用に生データのまま返す。
   * 科目名・区分名への変換はUI側の役目）。合格していれば空配列
   */
  unsatisfied: ReviewCondition[]
  onFail?: { blockedSubjects?: string[]; note?: string }
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
function allBoundaryGroupsSatisfied(groups: readonly GroupResult[]): boolean {
  return groups.every((g) => (g.kind === undefined || g.satisfied) && allBoundaryGroupsSatisfied(g.children))
}

interface Context {
  evaluation: EvaluationResult
  records: ReadonlyMap<string, SubjectStatus>
  reviews: readonly ReviewDef[]
  /** review条件（他の審査への参照）が循環しないよう、評価中の審査idを覚えておく */
  visiting: Set<string>
  /** 一度判定した審査は使い回す */
  cache: Map<string, boolean>
}

function isConditionSatisfied(cond: ReviewCondition, ctx: Context): boolean {
  switch (cond.type) {
    case 'groupMin':
      return (findGroupResult(ctx.evaluation.groups, cond.groupId)?.contribution ?? 0) >= cond.min
    case 'allPassed':
      return findGroupResult(ctx.evaluation.groups, cond.groupId)?.satisfied ?? false
    case 'subjects':
      return cond.codes.every((code) => ctx.records.get(code) === 'passed')
    case 'totalCredits':
      return ctx.evaluation.totalCredits.contribution >= cond.min
    case 'commonCredits':
      return ctx.evaluation.commonCredits.contribution >= cond.min
    case 'allGroups':
      return allBoundaryGroupsSatisfied(ctx.evaluation.groups)
    case 'review':
      return evaluateReviewSatisfied(cond.id, ctx)
  }
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
): ReviewStatus[] {
  const ctx: Context = { evaluation, records, reviews, visiting: new Set(), cache: new Map() }
  return reviews.map((review) => {
    const nodes = reviewNodes(review)
    const satisfied = nodes.every((n) => isNodeSatisfied(n, ctx))
    ctx.cache.set(review.id, satisfied)
    return {
      id: review.id,
      name: review.name,
      when: review.when,
      satisfied,
      unsatisfied: satisfied ? [] : nodes.flatMap((n) => collectUnsatisfied(n, ctx)),
      onFail: review.onFail,
    }
  })
}
