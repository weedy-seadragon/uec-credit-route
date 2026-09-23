import { describe, expect, it } from 'vitest'
import { parseAgentStatus, searchSubjects, summarizeRequirementStatus } from './agentTools'
import type { EvaluationResult, GroupResult } from './requirements'

// テスト用に、判定結果1グループぶんを必要な値だけ指定して作る（残りは0や空で埋める）
function group(overrides: Partial<GroupResult> & { id: string }): GroupResult {
  return {
    name: overrides.id,
    required: 0,
    contribution: 0,
    shortfall: 0,
    satisfied: true,
    projected: { contribution: 0, shortfall: 0, satisfied: true },
    earnedPassed: 0,
    earnedTaking: 0,
    overflow: 0,
    projectedOverflow: 0,
    overflowToCommon: 0,
    projectedOverflowToCommon: 0,
    children: [],
    ...overrides,
  }
}

// 判定結果を、エージェントに渡すJSONの形へまとめる処理の検証
describe('summarizeRequirementStatus', () => {
  it('判定境界のグループだけを拾い、超過分も含めた実際の単位数を返す', () => {
    // 必要10単位に対し確定12単位（超過2）、見込み込み14単位（超過4）の選択区分。
    // 内訳用の下位グループ（kind無し）は親にまとめて数えるので出てこないはず。
    const elective = group({
      id: 'elective',
      label: '選択科目',
      kind: 'elective',
      required: 10,
      contribution: 10,
      overflow: 2,
      projected: { contribution: 10, shortfall: 0, satisfied: true },
      projectedOverflow: 4,
      children: [group({ id: 'breakdown', required: 4, contribution: 4 })],
    })
    const evaluation: EvaluationResult = {
      groups: [group({ id: 'root', children: [elective] })],
      commonCredits: { required: 8, contribution: 6, shortfall: 2, satisfied: false, projected: { contribution: 8, shortfall: 0, satisfied: true } },
      totalCredits: { required: 124, contribution: 80, shortfall: 44, satisfied: false, projected: { contribution: 90, shortfall: 34, satisfied: false } },
    }
    const result = summarizeRequirementStatus(evaluation, [])
    expect(result.groups).toEqual([
      { id: 'elective', name: '選択科目', kind: 'elective', required: 10, earned: 12, projected: 14, shortfall: 0, projectedShortfall: 0 },
    ])
    expect(result.commonCredits).toEqual({ required: 8, earned: 6, projected: 8 })
    expect(result.totalCredits).toEqual({ required: 124, earned: 80, projected: 90 })
  })

  it('審査の判定は、合否と見込みの合否だけを返す', () => {
    // 不足条件の生データ（unsatisfied）はエージェントには不要なので含めない。
    const evaluation: EvaluationResult = {
      groups: [],
      commonCredits: { required: 0, contribution: 0, shortfall: 0, satisfied: true, projected: { contribution: 0, shortfall: 0, satisfied: true } },
      totalCredits: { required: 0, contribution: 0, shortfall: 0, satisfied: true, projected: { contribution: 0, shortfall: 0, satisfied: true } },
    }
    const result = summarizeRequirementStatus(evaluation, [
      { id: 'y2end', name: '2年次終了時審査', when: '2年次終了時', satisfied: false, projectedSatisfied: true, unsatisfied: [] },
    ])
    expect(result.reviews).toEqual([{ id: 'y2end', name: '2年次終了時審査', when: '2年次終了時', satisfied: false, projectedSatisfied: true }])
  })
})

// 科目検索の一致判定と件数制限の検証
describe('searchSubjects', () => {
  const subjects = [
    { code: 'COM405a', name: 'ヒューマンインタフェース', credits: 2 },
    { code: 'MAT101z', name: '微分積分学第一', credits: 2 },
    { code: 'MAT102z', name: '微分積分学第二', credits: 2 },
  ]

  it('全角英数字・大文字小文字・空白の違いを無視して科目番号で探せる', () => {
    // 「ｃｏｍ ４０５」は正規化すると「com405」になり、COM405a に一致する。
    expect(searchSubjects(subjects, 'ｃｏｍ ４０５', 20).map((s) => s.code)).toEqual(['COM405a'])
  })

  it('科目名の一部で探せ、件数は limit で打ち切られる', () => {
    // 「微分積分」は2科目に一致するが、limit=1 なので最初の1件だけ返る。
    expect(searchSubjects(subjects, '微分積分', 20)).toHaveLength(2)
    expect(searchSubjects(subjects, '微分積分', 1).map((s) => s.code)).toEqual(['MAT101z'])
  })

  it('空の検索語では何も返さない', () => {
    // 全科目を返すとエージェントへの返答が大きくなりすぎるため。
    expect(searchSubjects(subjects, '  ', 20)).toEqual([])
  })
})

// エージェントが指定した履修状態の文字列を、サイト内部の状態へ変換する処理の検証
describe('parseAgentStatus', () => {
  it('passed・taking・failed はそのまま、none は未履修（undefined）になる', () => {
    // none は「記録を消す」ことを表すため、内部では状態無し（undefined）として扱う。
    expect(parseAgentStatus('passed')).toEqual({ ok: true, status: 'passed' })
    expect(parseAgentStatus('taking')).toEqual({ ok: true, status: 'taking' })
    expect(parseAgentStatus('failed')).toEqual({ ok: true, status: 'failed' })
    expect(parseAgentStatus('none')).toEqual({ ok: true, status: undefined })
  })

  it('それ以外の値は受け付けない', () => {
    // 日本語表記や大文字、文字列以外は打ち間違いとしてエラーにする（勝手に解釈しない）。
    expect(parseAgentStatus('修得')).toEqual({ ok: false })
    expect(parseAgentStatus('PASSED')).toEqual({ ok: false })
    expect(parseAgentStatus(undefined)).toEqual({ ok: false })
  })
})
