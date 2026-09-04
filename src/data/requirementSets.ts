// data/ 以下の静的JSON（卒業要件・科目マスタ）をアプリから使えるように読み込むところ。
//
// 「今どの入学年度・類・プログラムのデータが揃っているか」を知っているのはこのファイルだけにする。
// 他のコード（画面など）はここでエクスポートしている関数・一覧だけを見ればよく、
// JSONファイルが具体的に何個あってどこにあるかを気にしなくてよい。
//
// 新しいプログラムのデータを追加したら、下の import 文と `programDocs` に1行足すだけでよい
// （フェーズ3でⅡ類・Ⅲ類・夜間主を追加するときはここを増やす）。
//
// `import 名前 from '...json'` は、Viteがビルド時にJSONファイルの中身をそのまま
// JavaScriptのオブジェクトとして読み込んでくれる機能（tsconfig.app.json の
// resolveJsonModule で型チェックも通るようにしている）。

import type { RequirementGroup, RequirementSet } from '../domain/requirements'
import common from '../../data/requirements/2025-day-common.json'
import media from '../../data/requirements/2025-day-I-media.json'
import management from '../../data/requirements/2025-day-I-management.json'
import mathinfo from '../../data/requirements/2025-day-I-mathinfo.json'
import cs from '../../data/requirements/2025-day-I-cs.json'
import designds from '../../data/requirements/2025-day-I-designds.json'
import security from '../../data/requirements/2025-day-II-security.json'
import netinfo from '../../data/requirements/2025-day-II-netinfo.json'
import electroinfo from '../../data/requirements/2025-day-II-electroinfo.json'
import subjectsMaster from '../../data/subjects/youran-2025.json'

/** プロフィール設定画面（F-1）の選択肢1つぶん */
export interface ProgramOption {
  entryYear: number
  course: 'day' | 'evening'
  cluster: 'I' | 'II' | 'III' | null
  program: string
  programName: string
}

/** data/requirements/2025-day-I-*.json のようなプログラム別ファイルの形 */
interface ProgramDoc {
  entryYear: number
  course: 'day' | 'evening'
  cluster: 'I' | 'II' | 'III'
  program: string
  programName: string
  /** 科目番号末尾記号（例: "a"）。他プログラムの専門科目の判定に使う（domain/requirements.tsのRequirementSet参照） */
  programSuffix: string
  totalCredits: number
  commonCredits: number
  groups: RequirementGroup[]
}

// JSONを`import`すると型は自動推論されるが、要件セットの木構造（children等）まではTypeScriptには
// 分からないので、ここで RequirementGroup[] であることを明示しておく（as で型を指定し直している）。
const commonDoc = common as { groups: RequirementGroup[]; commonCreditSources?: { alwaysCommon?: string[] } }
const programDocs: ProgramDoc[] = [media, management, mathinfo, cs, designds, security, netinfo, electroinfo] as ProgramDoc[]

/** プロフィール設定画面のプルダウンに出す、今データが揃っている選択肢の一覧 */
export const programOptions: ProgramOption[] = programDocs.map((p) => ({
  entryYear: p.entryYear,
  course: p.course,
  cluster: p.cluster,
  program: p.program,
  programName: p.programName,
}))

/**
 * 指定した「入学年度・コース・類・プログラム」に対応する要件セットを返す。
 * 共通ファイル（総合文化・実践教育科目）とプログラム別ファイル（専門科目）を
 * ここで合体させる（`extends` の解決）。データが無ければ undefined を返す。
 */
export function getRequirementSet(entryYear: number, course: string, cluster: string, program: string): RequirementSet | undefined {
  // 4つの条件すべてに一致するプログラムファイルを探す
  const doc = programDocs.find(
    (p) => p.entryYear === entryYear && p.course === course && p.cluster === cluster && p.program === program,
  )
  if (!doc) return undefined // まだデータが無い組み合わせ

  // 共通ファイルのgroups（総合文化・実践教育）とプログラム別ファイルのgroups（専門科目）を
  // 1つの配列にまとめて、evaluateRequirements() にそのまま渡せる形にする
  return {
    totalCredits: doc.totalCredits,
    commonCredits: doc.commonCredits,
    groups: [...commonDoc.groups, ...doc.groups],
    alwaysCommonSubjects: commonDoc.commonCreditSources?.alwaysCommon ?? [],
    programSuffix: doc.programSuffix,
  }
}

/** 科目番号（フルコード）→単位数 のマップ。evaluateRequirements() にそのまま渡せる */
export function getSubjectCredits(): ReadonlyMap<string, number> {
  return new Map(subjectsMaster.subjects.map((s) => [s.code, s.credits]))
}

interface SubjectMasterEntry {
  code: string
  name: string
  credits: number
  standardYear: number | null
  standardSemester: number | null
  termType: '前学期' | '後学期' | null
  forInternational: boolean
  eveningAllowed: boolean
  graduateLinked: boolean
}

/** 科目番号（フルコード）→科目マスタの情報 のマップ。科目一覧・詳細（F-5）や推奨計算に使う */
export function getSubjectsByCode(): ReadonlyMap<string, SubjectMasterEntry> {
  return new Map((subjectsMaster.subjects as SubjectMasterEntry[]).map((s) => [s.code, s]))
}
