// 年度別に要件・科目マスタを切り替える入口を検証するテスト。
import { describe, expect, it } from 'vitest'
import { evaluateRequirements, type GroupResult } from '../domain/requirements'
import { entryYearLabel, findSubjectUsages, findSubjectUsagesForProfile, getRequirementSet, getRequirementSetWithoutProgram, getSubjectCredits, getSubjectsByCode } from './requirementSets'

/** 判定結果のグループ木から、指定IDのグループを再帰的に探す。 */
function findGroupById(groups: readonly GroupResult[], id: string): GroupResult | undefined {
  // 現在の階層を順に調べ、子グループも同じ関数で探索する。
  for (const group of groups) {
    if (group.id === id) return group
    const child = findGroupById(group.children, id)
    if (child) return child
  }
  return undefined
}

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

  it('プロフィールのプログラムを選ぶと、その課程内の利用箇所だけを返す', () => {
    // 科目詳細で別プログラムの要件まで混ぜず、選択中の情報通信工学だけを表示する。
    const usages = findSubjectUsagesForProfile(2025, 'day', 'II', 'netinfo', 'ENG101z')

    expect(usages.length).toBeGreaterThan(0)
    expect(usages.every((usage) => usage.programName === '情報通信工学プログラム')).toBe(true)
  })

  it('プログラム未選択では選んだ類の共通要件だけを返す', () => {
    // 配属前は各プログラム固有の区分を出さず、Ⅰ類として共通する要件だけを位置づけにする。
    const usages = findSubjectUsagesForProfile(2025, 'day', 'I', null, 'ENG101z')

    expect(usages.length).toBeGreaterThan(0)
    expect(usages.every((usage) => usage.programName === 'Ⅰ類（プログラム未選択）')).toBe(true)
  })

  it('プログラム未選択でも類共通までの要件と2年次終了時審査を返す', () => {
    // 配属前は類専門科目を混ぜず、理数基礎・類共通基礎と2年次終了時審査だけを確認できる。
    const requirementSet = getRequirementSetWithoutProgram(2025, 'I')
    expect(requirementSet?.groups.at(-1)?.children?.map((group) => group.id)).toEqual(['math-basic', 'cluster-basic'])
    expect(requirementSet?.reviews?.map((review) => review.id)).toEqual(['y2-end'])
  })

  it('2023年度は年度別データを参照し、2024年度には無い「データサイエンス演習」を必修に含む', () => {
    // 2026-09-14訂正：2023年度は独立必修科目「データサイエンス演習」（COM502e）がある分だけ
    // 2024年度より必修が1単位多い（必修20・選択16）。画像で確認済み（docs/YOURAN_2023_COMPARISON.md）。
    const designds2023 = getRequirementSet(2023, 'day', 'I', 'designds')
    const major2023 = designds2023?.groups.find((g) => g.id === 'specialized')?.children?.find((g) => g.id === 'major')

    expect(entryYearLabel(2023)).toBe('2023年度')
    expect(major2023?.children?.find((g) => g.id === 'major-req')?.required).toBe(20)
    expect(major2023?.children?.find((g) => g.id === 'major-sel')?.required).toBe(16)
    expect(getSubjectsByCode(2023).get('COM502e')?.name).toBe('データサイエンス演習')
    expect(getSubjectsByCode(2023).get('COM603a')).toEqual(getSubjectsByCode(2024).get('COM603a'))
  })

  it('2023年度のⅠ類は情報工学工房が分割されておらず、メディア情報学は経営・社会情報学の番号を参照する', () => {
    // 2026-09-14訂正：情報工学工房B・C（COM002x/COM003x）とGLTPラボワーク（LAB501x）は2024年度新設。
    // メディア情報学の現代代数学・数理解析学は自分専用の番号を持たず、経営・社会情報学の番号（MTHb02b/03b）を使う。
    const media2023 = getRequirementSet(2023, 'day', 'I', 'media')
    const free2023 = media2023?.groups.find((g) => g.id === 'specialized')?.children
      ?.find((g) => g.id === 'major')?.children?.find((g) => g.id === 'major-free')

    expect(getSubjectsByCode(2023).get('COM001a')?.name).toBe('情報工学工房')
    expect(free2023?.subjects).not.toContain('COM002a')
    expect(free2023?.subjects).not.toContain('LAB501a')
    expect(free2023?.subjects).toContain('MTHb02b')
    expect(getSubjectsByCode(2023).get('MTHb02a')).toBeUndefined()

    const media2024 = getRequirementSet(2024, 'day', 'I', 'media')
    const free2024 = media2024?.groups.find((g) => g.id === 'specialized')?.children
      ?.find((g) => g.id === 'major')?.children?.find((g) => g.id === 'major-free')
    expect(getSubjectsByCode(2024).get('COM001a')?.name).toBe('情報工学工房A')
    expect(free2024?.subjects).toContain('COM002a')
    expect(free2024?.subjects).toContain('MTHb02a')
  })

  it('2022年度は旧カリキュラムのⅠ類単位配分を参照し、後設プログラムを表示しない', () => {
    // 2022年度は理数基礎20単位・専門78単位であり、デザイン思考・データサイエンスはまだ存在しない。
    const media2022 = getRequirementSet(2022, 'day', 'I', 'media')
    const specialized = media2022?.groups.find((group) => group.id === 'specialized')

    expect(entryYearLabel(2022)).toBe('2022年度')
    expect(specialized?.children?.find((group) => group.id === 'math-basic')?.required).toBe(20)
    expect(specialized?.required).toBe(78)
    expect(getRequirementSet(2022, 'day', 'I', 'designds')).toBeUndefined()
  })

  it('2021年度はデータサイエンス区分なしの初年次導入8単位を参照する', () => {
    // 2021年度の実践教育は初年次導入8・倫理キャリア4・技術英語4単位の構成である。
    const media2021 = getRequirementSet(2021, 'day', 'I', 'media')
    const practical = media2021?.groups.find((group) => group.id === 'practical')

    expect(entryYearLabel(2021)).toBe('2021年度以前')
    expect(practical?.required).toBe(16)
    expect(practical?.children?.find((group) => group.id === 'intro')?.required).toBe(8)
    expect(practical?.children?.find((group) => group.id === 'datasci')).toBeUndefined()
    expect(getSubjectsByCode(2021).get('UEC101z')?.credits).toBe(2)
  })

  it('2024年度は2025年度と別の要件・科目マスタを参照する（学修要覧2024との差分を反映済み）', () => {
    // デザイン思考・データサイエンスプログラムは2024→2025で必修/選択の配分と科目名が変わっている。
    const media2024 = getSubjectsByCode(2024).get('COM603a')
    const media2025 = getSubjectsByCode(2025).get('COM603a')
    expect(media2024?.name).toBe('進化計算論')
    expect(media2025?.name).toBe('エージェント論')

    const designds2024 = getRequirementSet(2024, 'day', 'I', 'designds')
    const major2024 = designds2024?.groups.find((g) => g.id === 'specialized')?.children?.find((g) => g.id === 'major')
    expect(major2024?.children?.find((g) => g.id === 'major-req')?.required).toBe(19)
    expect(major2024?.children?.find((g) => g.id === 'major-req')?.subjects).toEqual(expect.arrayContaining(['INS601e', 'INS701e']))

    const designds2025 = getRequirementSet(2025, 'day', 'I', 'designds')
    const major2025 = designds2025?.groups.find((g) => g.id === 'specialized')?.children?.find((g) => g.id === 'major')
    expect(major2025?.children?.find((g) => g.id === 'major-req')?.required).toBe(15)
  })

  it('自プログラムの同名科目がある他プログラム科目は選択肢から除く', () => {
    // CS必修のCOM501dと同じ授業であるCOM502aを、類専門（選択）からも選べる状態にしない。
    const requirementSet = getRequirementSet(2025, 'day', 'I', 'cs')
    const major = requirementSet?.groups.find((group) => group.id === 'specialized')?.children?.find((group) => group.id === 'major')
    const required = major?.children?.find((group) => group.id === 'major-req')
    const elective = major?.children?.find((group) => group.id === 'major-sel')

    expect(required?.subjects).toContain('COM501d')
    expect(elective?.subjects).not.toContain('COM502a')
  })

  it('デザイン思考・データサイエンスプログラムはインターンシップが必修', () => {
    // 学修要覧の注記により、この課程だけキャリア単位の一部（CAR503z）が必修になる。
    function findRequirementGroupById(groups: readonly import('../domain/requirements').RequirementGroup[], id: string): import('../domain/requirements').RequirementGroup | undefined {
      for (const group of groups) {
        if (group.id === id) return group
        const child = group.children ? findRequirementGroupById(group.children, id) : undefined
        if (child) return child
      }
      return undefined
    }

    const requirementSet = getRequirementSet(2025, 'day', 'I', 'designds')
    const career = findRequirementGroupById(requirementSet?.groups ?? [], 'career')

    expect(career?.children?.find((group) => group.id === 'career-req')?.subjects).toEqual(['CAR503z'])
    expect(career?.kind).toBeUndefined()

    const otherSet = getRequirementSet(2025, 'day', 'I', 'media')
    const other = findRequirementGroupById(otherSet?.groups ?? [], 'career')
    expect(other?.subjects).toContain('CAR503z')
    expect(other?.children).toBeUndefined()
  })

  it('デザイン思考・データサイエンスのインターンシップ未修得では必修キャリア単位が不足する', () => {
    const requirementSet = getRequirementSet(2025, 'day', 'I', 'designds')
    expect(requirementSet).toBeDefined()
    const result = evaluateRequirements(requirementSet!, new Map(), getSubjectCredits(2025))

    expect(findGroupById(result.groups, 'career-req')?.shortfall).toBe(2)
    expect(findGroupById(result.groups, 'career')?.shortfall).toBe(4)
  })

  it('CSの同名OS科目を両方修得としても、必修の2単位だけを算入する', () => {
    // COM501d（CS必修）とCOM502a（他プログラム番号）を同時に渡しても、要件計算で4単位にしない。
    const requirementSet = getRequirementSet(2025, 'day', 'I', 'cs')
    expect(requirementSet).toBeDefined()
    const result = evaluateRequirements(
      requirementSet!,
      new Map([['COM501d', 'passed' as const], ['COM502a', 'passed' as const]]),
      getSubjectCredits(2025),
    )

    expect(findGroupById(result.groups, 'major-req')?.contribution).toBe(2)
    expect(findGroupById(result.groups, 'major-sel')?.contribution).toBe(0)
  })
})
