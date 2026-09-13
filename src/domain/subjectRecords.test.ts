// subjectRecords.ts の単体テスト。同名で複数の科目番号を持つ科目を1件として扱えるか確認する。
import { describe, expect, it } from 'vitest'
import type { SubjectStatus } from './requirements'
import { normalizeDuplicateSubjectRecords, preferredSubjectCode, setSubjectStatusWithoutDuplicates } from './subjectRecords'

describe('同名科目の履修記録の正規化', () => {
  const subjects = new Map([
    ['COM501d', { name: 'オペレーティングシステム論' }],
    ['COM502a', { name: 'オペレーティングシステム論' }],
    ['ELE501g', { name: 'オペレーティングシステム論' }],
    ['COM503d', { name: '別の科目' }],
  ])
  const isOwnProgramSubject = (code: string) => code.endsWith('d')
  const isSameClassProgramSubject = (firstCode: string, secondCode: string) => /[ad]$/.test(firstCode) && /[ad]$/.test(secondCode)

  it('同名の他プログラム科目を修得にしても、自分のプログラムの科目番号へ記録する', () => {
    // CSの必修COM501dを既に修得した後でCOM502aを選んでも、2科目分の履修記録を残さない。
    const result = setSubjectStatusWithoutDuplicates(
      new Map<string, SubjectStatus>([['COM501d', 'passed']]),
      'COM502a',
      'passed',
      subjects,
      isOwnProgramSubject,
      isSameClassProgramSubject,
    )

    expect(result).toEqual(new Map([['COM501d', 'passed']]))
  })

  it('既に保存された同名の重複記録は自分のプログラムの状態を優先して1件にする', () => {
    // 古い保存データに必修と他プログラム選択の両方があっても、修得単位を二重に数えない。
    const result = normalizeDuplicateSubjectRecords(
      new Map<string, SubjectStatus>([['COM501d', 'passed'], ['COM502a', 'taking'], ['COM503d', 'failed']]),
      subjects,
      isOwnProgramSubject,
      isSameClassProgramSubject,
    )

    expect(result).toEqual(new Map([['COM501d', 'passed'], ['COM503d', 'failed']]))
  })

  it('優先する自プログラムの科目番号を同名科目から選ぶ', () => {
    // 他プログラム側のプルダウンを操作しても、CSのCOM501dを一貫して画面・集計に使う。
    expect(preferredSubjectCode('COM502a', subjects, isOwnProgramSubject, isSameClassProgramSubject)).toBe('COM501d')
  })

  it('別の類にある同名科目は別科目として保存したままにする', () => {
    // 科目名だけで全学の科目を名寄せすると別授業まで消してしまうため、Ⅰ類以外のgは統合しない。
    const result = normalizeDuplicateSubjectRecords(
      new Map<string, SubjectStatus>([['COM501d', 'passed'], ['ELE501g', 'passed']]),
      subjects,
      isOwnProgramSubject,
      isSameClassProgramSubject,
    )

    expect(result).toEqual(new Map([['COM501d', 'passed'], ['ELE501g', 'passed']]))
  })
})
