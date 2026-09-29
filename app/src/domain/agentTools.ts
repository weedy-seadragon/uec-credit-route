// AIエージェント向けツール（WebMCP）が返す内容を組み立てる純粋関数。
//
// requirements.ts などと同じく、React にも DOM にも依存しない。ブラウザの WebMCP API への登録は
// src/webmcp.ts、画面の状態との結び付けは MainPage.tsx が担当し、ここでは
// 「判定結果をエージェントに渡しやすいJSONの形にする」「エージェントからの入力を検証する」だけを扱う。

import type { EvaluationResult, GroupResult, SubjectStatus } from './requirements'
import type { ReviewStatus } from './reviews'
import { maxConcurrentOfferingCount, splitUnplacedTimetableCourses, TIMETABLE_UNPLACED_REASON_LABELS } from './timetablePreview'
import type { TimetablePreviewOption, TimetablePreviewResult } from './timetablePreview'
import { TIMELESS_COURSE_LABELS } from './onDemand'

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

/** エージェントに返す、時間割の1コマぶんの科目 */
export interface AgentTimetableSlot {
  day: string
  period: number
  code: string
  name: string
  /** 卒業要件上の区分名（例:「必修」「類専門（選択）」） */
  category: string | null
  required: boolean
  /** 春・夏・秋・冬タームなど、学期の一部だけで開講される場合のターム名 */
  partialTerm: string | null
  /** 学域特別講義のテーマ */
  topic: string | null
}

/** エージェントに返す、時間割プレビュー1学期ぶんの内容 */
export interface AgentTimetablePreview {
  term: string
  slots: AgentTimetableSlot[]
  /** 同じ曜日時限に、開講期間の重なる科目が2つ以上ある枠 */
  conflicts: { day: string; period: number; codes: string[] }[]
  onDemand: { code: string; name: string; topic: string | null }[]
  intensive: { code: string; name: string; kind: string; topic: string | null }[]
  /** 曜日時限の候補が複数あり、利用者が画面のドロップダウンで選ぶ必要がある科目 */
  needsSelection: { code: string; name: string; reason: string; options: { timetableCode: string | null; term: string; schedule: string; teacher: string | null; topic: string | null; retake: boolean }[] }[]
  /** 曜日時限そのものが決まっていない科目（輪講・卒業研究・集中の未記載など） */
  undecided: { code: string; name: string; reason: string }[]
}

/** 曜日の並び順（月→日）。一覧を読みやすい順に並べるために使う */
const DAY_ORDER = ['月', '火', '水', '木', '金', '土', '日']

/** 曜日時限の一覧を「月2・木2」のような文字列にする。時限が無ければ「時限なし」 */
function scheduleText(option: TimetablePreviewOption): string {
  return option.slots.length > 0 ? option.slots.map((slot) => `${slot.day}${slot.period}`).join('・') : '時限なし'
}

/**
 * 時間割プレビューの計算結果（buildVisibleTimetablePreview の戻り値）を、エージェントに渡しやすいJSONにする。
 * 画面と同じく、非表示にした科目は含めず、選んだ授業は表の側に入っている前提。
 */
export function summarizeTimetablePreview(result: TimetablePreviewResult, term: string): AgentTimetablePreview {
  // 表のコマを、曜日→時限の順に並べて返す
  const slots = [...result.slots]
    .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.period - b.period)
    .map((slot) => ({
      day: slot.day,
      period: slot.period,
      code: slot.code,
      name: slot.name,
      category: slot.category?.label ?? null,
      required: slot.category?.isRequired ?? false,
      // 前学期・後学期そのものなら添えない（タームのときだけ意味がある）
      partialTerm: slot.offeringTerm === '前学期' || slot.offeringTerm === '後学期' ? null : slot.offeringTerm,
      topic: slot.topic ?? null,
    }))
  // 同じ曜日時限の科目をまとめ、期間が重なる科目が2つ以上ある枠だけを重複として返す（画面の「同時限に2科目」と同じ判定）
  const cells = new Map<string, typeof result.slots>()
  for (const slot of result.slots) {
    const key = `${slot.day}:${slot.period}`
    cells.set(key, [...(cells.get(key) ?? []), slot])
  }
  const conflicts = [...cells.values()]
    .filter((cellSlots) => maxConcurrentOfferingCount(cellSlots.map((slot) => slot.offeringTerm)) > 1)
    .map((cellSlots) => ({ day: cellSlots[0].day, period: cellSlots[0].period, codes: cellSlots.map((slot) => slot.code) }))
    .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.period - b.period)
  // 欄外の科目を、画面と同じ基準で「候補から選ぶ」と「時限が決まっていない」に分ける
  const { selectable, timeless } = splitUnplacedTimetableCourses(result.unplaced)
  return {
    term,
    slots,
    conflicts,
    onDemand: result.onDemand.map((course) => ({ code: course.code, name: course.name, topic: course.topic ?? null })),
    intensive: result.intensive.map((course) => ({ code: course.code, name: course.name, kind: TIMELESS_COURSE_LABELS[course.kind], topic: course.topic ?? null })),
    needsSelection: selectable.map((course) => ({
      code: course.code,
      name: course.name,
      reason: TIMETABLE_UNPLACED_REASON_LABELS[course.reason],
      options: (course.options ?? []).map((option) => ({
        timetableCode: option.timetableCode ?? null,
        term: option.term,
        schedule: scheduleText(option),
        teacher: option.teacher ?? null,
        topic: option.topic ?? null,
        retake: option.retake ?? false,
      })),
    })),
    undecided: timeless.map((course) => ({ code: course.code, name: course.name, reason: TIMETABLE_UNPLACED_REASON_LABELS[course.reason] })),
  }
}
