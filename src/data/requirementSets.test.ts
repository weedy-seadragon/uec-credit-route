// 年度別に要件・科目マスタを切り替える入口を検証するテスト。
import { describe, expect, it } from 'vitest'
import { findSubjectUsages, getRequirementSet, getSubjectCredits, getSubjectsByCode } from './requirementSets'

describe('年度別の要件・科目マスタ選択', () => {
  it('2026年度の情報数理工学には再編後のMTHb01cを返す', () => {
    // 同じコードでも2025年度と2026年度で科目名が異なるため、年度ごとのマスタが必要になる。
    const subject2025 = getSubjectsByCode(2025).get('MTHb01c')
    const subject2026 = getSubjectsByCode(2026).get('MTHb01c')

    expect(subject2025?.name).toBe('ハイパフォーマンスコンピューティング基礎論')
    expect(subject2026?.name).toBe('シミュレーション理工学基礎論')
  })

  it('2026年度の要件セットは追加された海外研修を共通単位対象に含める', () => {
    // 2026年度の昼間共通要件を選んだときだけ、INT006z・INT007zが直接共通単位になる。
    const requirementSet = getRequirementSet(2026, 'day', 'I', 'media')

    expect(requirementSet?.alwaysCommonSubjects).toContain('INT006z')
    expect(requirementSet?.alwaysCommonSubjects).toContain('INT007z')
    expect(getSubjectCredits(2026).get('INT007z')).toBe(2)
  })

  it('2026年度の科目利用箇所は同じ年度のプログラムだけを返す', () => {
    // 新設のサイエンス工房は2025年度要件に混ぜず、2026年度のⅢ類要件だけから探す。
    const usages = findSubjectUsages(2026, 'GSE101m')

    expect(usages.length).toBeGreaterThan(0)
    expect(findSubjectUsages(2025, 'GSE101m')).toEqual([])
  })
})
