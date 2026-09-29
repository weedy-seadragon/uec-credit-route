// prerequisites.ts の単体テスト。自由記述テキストからの科目コード抽出が、
// 「完全一致するトークンだけ拾う・曖昧なら諦める」という方針通りに動くかを確認する。
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildNameToCodes, derivePrerequisites } from './prerequisites'

// テスト用の小さな科目一覧（実データの「力学演習」のように、同名の科目が複数プログラムに
// またがっているケースを再現する）
const subjects = [
  { code: 'MTH101z', name: '微分積分学第一' },
  { code: 'MTH201z', name: '微分積分学第二' },
  { code: 'COM201z', name: '基礎プログラミングおよび演習' },
  { code: 'PHY205k', name: '力学演習' },
  { code: 'PHY205m', name: '力学演習' },
  { code: 'MTH301f', name: '確率統計' },
  { code: 'MTH303k', name: '確率統計' },
  { code: 'MTH404t', name: '確率統計' },
]
const nameToCodes = buildNameToCodes(subjects)

describe('derivePrerequisites（完全一致するトークンだけを先修科目として拾う）', () => {
  it('カンマ区切りで並んだ複数の科目名を、それぞれ完全一致で拾う', () => {
    expect(derivePrerequisites('微分積分学第一、微分積分学第二', 'PHY301z', nameToCodes)).toEqual(
      expect.arrayContaining(['MTH101z', 'MTH201z']),
    )
  })

  it('曖昧な言い回し（部分一致にしかならない文章）は何も拾わない', () => {
    // 「微分積分学」は実在せず「微分積分学第一/第二」しか無いので、部分一致では拾わない
    expect(derivePrerequisites('微分積分学や線形代数学などの数学科目', 'PHY301z', nameToCodes)).toEqual([])
  })

  it('「特になし」「None」のような否定的な記述も、実在する科目名と一致しないので自然に空配列になる', () => {
    expect(derivePrerequisites('特になし', 'PHY301z', nameToCodes)).toEqual([])
    expect(derivePrerequisites('特にありません。', 'PHY301z', nameToCodes)).toEqual([])
    expect(derivePrerequisites('None', 'PHY301z', nameToCodes)).toEqual([])
  })

  it('テキストが無ければ空配列', () => {
    expect(derivePrerequisites(undefined, 'PHY301z', nameToCodes)).toEqual([])
  })

  it('同名科目が複数プログラムにまたがる場合、対象科目と同じ末尾記号（プログラム）のものを選ぶ', () => {
    // PHY301k（Ⅲ類機械システム想定）から見た「力学演習」はPHY205kを指すはず
    expect(derivePrerequisites('力学演習', 'PHY301k', nameToCodes)).toEqual(['PHY205k'])
    expect(derivePrerequisites('力学演習', 'PHY301m', nameToCodes)).toEqual(['PHY205m'])
  })

  it('自分のプログラムに無い名前は、夜間主（末尾s/t）以外なら共通科目（末尾z）にフォールバックする', () => {
    // 'a'はどの候補（f/k/t）とも一致しないので、共通科目扱いのMTH301fやMTH303k/MTH404tは選べない
    // （3候補ともプログラム固有で共通科目='z'が無いため、曖昧として諦める）
    expect(derivePrerequisites('確率統計', 'PHY301a', nameToCodes)).toEqual([])
    // 基礎プログラミングおよび演習はCOM201zの1件しか無いので、これは一意に決まる
    expect(derivePrerequisites('基礎プログラミングおよび演習', 'COM501a', nameToCodes)).toEqual(['COM201z'])
  })

  it('夜間主（末尾t）から見た場合は、対象と同じ末尾記号の候補を優先する', () => {
    expect(derivePrerequisites('確率統計', 'ELE501t', nameToCodes)).toEqual(['MTH404t'])
  })

  it('自分自身の科目名が紛れ込んでいても除外する', () => {
    expect(derivePrerequisites('微分積分学第一', 'MTH101z', nameToCodes)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 実データでの確認（requirements.test.ts・reviews.test.ts と同じ考え方）
// ---------------------------------------------------------------------------
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
function loadJson(relativePathFromProjectRoot: string): unknown {
  return JSON.parse(readFileSync(path.join(projectRoot, relativePathFromProjectRoot), 'utf-8'))
}

describe('実データでの動作確認（誤検出が無くエラーなく動くことの確認）', () => {
  const subjectsMaster = loadJson('data/subjects/youran-2025.json') as {
    subjects: { code: string; name: string; prerequisitesText?: string }[]
  }
  const realNameToCodes = buildNameToCodes(subjectsMaster.subjects)

  it('全科目ぶん実行してもエラーにならず、抽出したコードは必ず科目マスタに実在する', () => {
    const knownCodes = new Set(subjectsMaster.subjects.map((s) => s.code))
    for (const s of subjectsMaster.subjects) {
      const codes = derivePrerequisites(s.prerequisitesText, s.code, realNameToCodes)
      for (const c of codes) expect(knownCodes.has(c)).toBe(true)
    }
  })

  it('確率統計（MTH301f）は、prerequisitesTextが「微分積分学」（部分一致にしかならない）なので先修科目を拾わない', () => {
    const mth301f = subjectsMaster.subjects.find((s) => s.code === 'MTH301f')
    expect(mth301f?.prerequisitesText).toBe('微分積分学')
    expect(derivePrerequisites(mth301f?.prerequisitesText, 'MTH301f', realNameToCodes)).toEqual([])
  })

  it('力学演習（PHY205p、物理工学プログラム）は「物理学概論第一」を完全一致で先修科目として拾える', () => {
    const phy205p = subjectsMaster.subjects.find((s) => s.code === 'PHY205p')
    expect(phy205p?.prerequisitesText).toBe('物理学概論第一')
    const result = derivePrerequisites(phy205p?.prerequisitesText, 'PHY205p', realNameToCodes)
    expect(result.length).toBe(1)
    expect(result[0]).toMatch(/^PHY102/)
  })
})
