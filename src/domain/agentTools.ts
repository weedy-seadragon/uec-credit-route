// AIエージェント向けツール（WebMCP）が返す内容を組み立てる純粋関数。
//
// requirements.ts などと同じく、React にも DOM にも依存しない。ブラウザの WebMCP API への登録は
// src/webmcp.ts、画面の状態との結び付けは MainPage.tsx が担当し、ここでは
// 「判定結果をエージェントに渡しやすいJSONの形にする」「エージェントからの入力を検証する」だけを扱う。

import type { EvaluationResult, GroupResult, SubjectStatus } from './requirements'
import type { ReviewStatus } from './reviews'

/** エージェントに返す、要件区分1つぶんの修得状況 */
export interface AgentGroupStatus {
  id: string
  name: string
  kind: string
  required: number
  /** 修得済みの単位数（必要単位で頭打ちにしない実際の値） */
  earned: number
  /** 修得見込もすべて修得できた場合の単位数（必要単位で頭打ちにしない） */
  projected: number
  /** 確定分での不足単位数 */
  shortfall: number
  /** 修得見込を含めた不足単位数 */
  projectedShortfall: number
}

/** エージェントに返す、卒業要件全体の修得状況 */
export interface AgentRequirementStatus {
  groups: AgentGroupStatus[]
  commonCredits: { required: number; earned: number; projected: number }
  totalCredits: { required: number; earned: number; projected: number }
  reviews: { id: string; name: string; when?: string; satisfied: boolean; projectedSatisfied: boolean }[]
}

/**
 * 判定境界（kindが付いている）グループだけを、画面の「修得した単位」「選択科目」と同じ数え方で並べる。
 * 「上級科目」の中の「A類」のような内訳用の下位グループは、親の区分にまとめて数えるため出さない。
 */
export function summarizeRequirementStatus(evaluation: EvaluationResult, reviews: readonly ReviewStatus[]): AgentRequirementStatus {
  const groups: AgentGroupStatus[] = []
  // 別表2の並び順のまま木をたどり、判定境界のグループだけを拾う。
  function walk(results: readonly GroupResult[]) {
    for (const g of results) {
      if (g.kind !== undefined) {
        groups.push({
          id: g.id,
          name: g.label ?? g.name,
          kind: g.kind,
          required: g.required,
          earned: g.contribution + g.overflow,
          projected: g.projected.contribution + g.projectedOverflow,
          shortfall: g.shortfall,
          projectedShortfall: g.projected.shortfall,
        })
      }
      walk(g.children)
    }
  }
  walk(evaluation.groups)
  return {
    groups,
    commonCredits: {
      required: evaluation.commonCredits.required,
      earned: evaluation.commonCredits.contribution,
      projected: evaluation.commonCredits.projected.contribution,
    },
    totalCredits: {
      required: evaluation.totalCredits.required,
      earned: evaluation.totalCredits.contribution,
      projected: evaluation.totalCredits.projected.contribution,
    },
    reviews: reviews.map((r) => ({
      id: r.id, name: r.name, when: r.when, satisfied: r.satisfied, projectedSatisfied: r.projectedSatisfied,
    })),
  }
}

/** 科目検索で比べるのに必要な科目情報 */
export interface SearchableSubject {
  code: string
  name: string
  credits: number
}

/**
 * 科目名または科目番号に query を含む科目を、最大 limit 件返す。
 * 全角・半角の英数字（「Ａ」と「A」など）の違いと大文字・小文字の違いは無視して比べる。
 */
export function searchSubjects<T extends SearchableSubject>(subjects: Iterable<T>, query: string, limit: number): T[] {
  const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, '')
  const q = normalize(query)
  // 空の検索語で全科目を返すと、エージェントへの返答が大きくなりすぎるため何も返さない。
  if (q === '') return []
  const hits: T[] = []
  for (const s of subjects) {
    if (normalize(s.name).includes(q) || normalize(s.code).includes(q)) {
      hits.push(s)
      if (hits.length >= limit) break
    }
  }
  return hits
}

/** エージェントが指定できる履修状態。"none" は「未履修（記録なし）」を表す */
export const AGENT_STATUS_VALUES = ['passed', 'taking', 'failed', 'none'] as const
export type AgentStatusValue = (typeof AGENT_STATUS_VALUES)[number]

/**
 * エージェントから受け取った状態の文字列を、サイト内部の履修状態に変換する。
 * 変換できない値なら ok: false を返す（ツール側でエラーとしてエージェントに伝える）。
 */
export function parseAgentStatus(value: unknown): { ok: true; status: SubjectStatus | undefined } | { ok: false } {
  if (value === 'none') return { ok: true, status: undefined }
  if (value === 'passed' || value === 'taking' || value === 'failed') return { ok: true, status: value }
  return { ok: false }
}
