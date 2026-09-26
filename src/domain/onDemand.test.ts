// オンデマンド判定が、曜日時限と実施形態の注記を共通の基準で扱うことを確認する。
import { describe, expect, it } from 'vitest'
import { isOnDemandCourse } from './onDemand'

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
