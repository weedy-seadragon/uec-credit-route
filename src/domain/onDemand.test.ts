// オンデマンド判定が、曜日時限と実施形態の注記を共通の基準で扱うことを確認する。
import { describe, expect, it } from 'vitest'
import { classifyTimelessCourse, isOnDemandCourse, TIMELESS_COURSE_LABELS } from './onDemand'

// 時限が空の通常科目と、同じ状態でも対象外となる科目を検証する。
describe('isOnDemandCourse', () => {
  // 全セクションの時限が空の通常科目だけ、オンデマンドと判定できる。
  it('全セクションの時限が空ならオンデマンドとする', () => {
    expect(isOnDemandCourse('通常科目', undefined, [{ slots: [] }, { slots: [] }])).toBe(true)
    expect(isOnDemandCourse('通常科目', undefined, [{ slots: [] }, { slots: [{ day: '月', period: 1 }] }])).toBe(false)
    expect(isOnDemandCourse('通常科目', undefined, [])).toBe(false)
  })

  // 集中講義や実施形態が個別に決まる科目は、時限が空でも誤分類しない。
  it('集中講義・輪講・卒業研究・情報工学工房を除く', () => {
    expect(isOnDemandCourse('通常科目', '夏期集中', [{ slots: [] }])).toBe(false)
    expect(isOnDemandCourse('通常科目', '冬期集中', [{ slots: [] }])).toBe(false)
    expect(isOnDemandCourse('輪講A', undefined, [{ slots: [] }])).toBe(false)
    expect(isOnDemandCourse('卒業研究A', undefined, [{ slots: [] }])).toBe(false)
    expect(isOnDemandCourse('情報工学工房A', undefined, [{ slots: [] }])).toBe(false)
  })
})

// 時限の無い科目を、オンデマンドと集中講義の種類へ共通分類する。
describe('classifyTimelessCourse', () => {
  // noteの夏期・冬期表記を残し、その他の集中表記も独立した区分にする。
  it('夏期・冬期・その他の集中講義を区別する', () => {
    expect(classifyTimelessCourse('通常科目', '夏期集中講義', [{ slots: [] }])).toBe('summer-intensive')
    expect(classifyTimelessCourse('通常科目', '冬期集中', [{ slots: [] }])).toBe('winter-intensive')
    expect(classifyTimelessCourse('通常科目', '隔年集中開講', [{ slots: [] }])).toBe('intensive')
  })

  // 同じ空時限でも、通常科目だけをオンデマンドに分類し、個別実施科目は対象外にする。
  it('オンデマンド・研究系科目・未確定の条件を混同しない', () => {
    expect(classifyTimelessCourse('通常科目', undefined, [{ slots: [] }])).toBe('on-demand')
    expect(classifyTimelessCourse('輪講A', '夏期集中', [{ slots: [] }])).toBe('lab')
    expect(classifyTimelessCourse('卒業研究A', undefined, [{ slots: [] }])).toBe('lab')
    expect(classifyTimelessCourse('情報工学工房A', undefined, [{ slots: [] }])).toBe('instructor-dependent')
    expect(classifyTimelessCourse('通常科目', '夏期集中', [{ slots: [{ day: '月', period: 1 }] }])).toBe(null)
  })

  // 研究室単位・担当教員依存の共通区分を、時限の有無にかかわらず理由へ使う。
  it('研究室と担当教員の区分を共有文言へ対応付ける', () => {
    expect(classifyTimelessCourse('輪講A', undefined, [{ slots: [{ day: '月', period: 1 }] }])).toBe('lab')
    expect(classifyTimelessCourse('情報工学工房A', undefined, [{ slots: [{ day: '月', period: 1 }] }])).toBe('instructor-dependent')
    expect(TIMELESS_COURSE_LABELS.lab).toBe('研究室ごとに実施形態が異なります')
    expect(TIMELESS_COURSE_LABELS['instructor-dependent']).toBe('担当教員により開講時限が異なります')
  })
})
