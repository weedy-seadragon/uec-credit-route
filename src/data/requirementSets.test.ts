// 年度別に要件・科目マスタを切り替える入口を検証するテスト。
import { describe, expect, it } from 'vitest'
import { entryYearLabel, findSubjectUsages, getRequirementSet, getRequirementSetWithoutProgram, getSubjectCredits, getSubjectsByCode } from './requirementSets'

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

  it('科目利用箇所にはメイン画面の案内先を決める区分種類を含める', () => {
    // 必修科目の利用箇所にはrequiredを残し、科目詳細から「残りの必修」へ戻れるようにする。
    const usages = findSubjectUsages(2025, 'ENG101z')

    expect(usages.some((usage) => usage.kind === 'required')).toBe(true)
  })

  it('プログラム未選択でも類共通までの要件と2年次終了時審査を返す', () => {
    // 配属前は類専門科目を混ぜず、理数基礎・類共通基礎と2年次終了時審査だけを確認できる。
    const requirementSet = getRequirementSetWithoutProgram(2025, 'I')
    expect(requirementSet?.groups.at(-1)?.children?.map((group) => group.id)).toEqual(['math-basic', 'cluster-basic'])
    expect(requirementSet?.reviews?.map((review) => review.id)).toEqual(['y2-end'])
  })

  it('2024年度以前は2025年度と同じ要件・科目マスタを参照する', () => {
    // 旧年度用のJSONを重複保持せず、画面上だけ「2024年以前」とまとめる仕様を検証する。
    const set2024 = getRequirementSet(2024, 'day', 'I', 'media')
    const set2025 = getRequirementSet(2025, 'day', 'I', 'media')

    expect(entryYearLabel(2024)).toBe('2024年以前')
    expect(getSubjectsByCode(2024).get('MTHb01c')).toEqual(getSubjectsByCode(2025).get('MTHb01c'))
    expect(set2024?.totalCredits).toBe(set2025?.totalCredits)
  })
})
