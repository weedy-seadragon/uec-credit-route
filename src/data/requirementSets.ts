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
import control from '../../data/requirements/2025-day-II-control.json'
import robotics from '../../data/requirements/2025-day-II-robotics.json'
import mecha from '../../data/requirements/2025-day-III-mecha.json'
import electro from '../../data/requirements/2025-day-III-electro.json'
import optical from '../../data/requirements/2025-day-III-optical.json'
import physics from '../../data/requirements/2025-day-III-physics.json'
import chembio from '../../data/requirements/2025-day-III-chembio.json'
import evening from '../../data/requirements/2025-evening.json'
import subjectsMaster from '../../data/subjects/youran-2025.json'

/** プロフィール設定画面（F-1）の選択肢1つぶん */
export interface ProgramOption {
  entryYear: number
  course: 'day' | 'evening'
  cluster: 'I' | 'II' | 'III' | null
  program: string
  programName: string
}

/**
 * data/requirements/2025-day-I-*.json や 2025-evening.json のようなプログラム別ファイルの形。
 * 夜間主コース（course: 'evening'）は類の区分が無いので cluster: null、
 * かつ common ファイルをextendsせず groups がそれ自体で完結している（day-common.jsonとは
 * 科目区分・科目コード体系が違うため）。getRequirementSet() 側でこの違いを吸収する。
 */
interface ProgramDoc {
  entryYear: number
  course: 'day' | 'evening'
  cluster: 'I' | 'II' | 'III' | null
  program: string
  programName: string
  /** 科目番号末尾記号（例: "a"）。他プログラムの専門科目の判定に使う（domain/requirements.tsのRequirementSet参照） */
  programSuffix: string
  totalCredits: number
  commonCredits: number
  groups: RequirementGroup[]
  /**
   * 共通ファイル（2025-day-common.json）側のグループを、このプログラムだけ一部上書きしたいときに使う。
   * キーは上書きしたいグループのid（例: "datasci-ex"）、値はそのグループにマージするフィールド。
   * 例: Ⅱ類計測・制御システム/先端ロボティクス・Ⅲ類は「データサイエンス演習」が必修ではなく
   * 選択（required: 0）になる（学修要覧2025 §2.5.1・別表2の注記）。夜間主（course: 'evening'）には適用されない。
   */
  commonOverrides?: Record<string, Partial<RequirementGroup>>
}

/**
 * 共通ファイルのグループ木を再帰的に複製しながら、overrides に指定されたidのグループだけ
 * フィールドをマージする。overridesが空ならそのまま（参照コピーで十分）返す。
 */
function applyCommonOverrides(groups: readonly RequirementGroup[], overrides: Record<string, Partial<RequirementGroup>> | undefined): RequirementGroup[] {
  if (!overrides || Object.keys(overrides).length === 0) return [...groups]
  return groups.map((g) => {
    const override = overrides[g.id]
    const children = g.children ? applyCommonOverrides(g.children, overrides) : undefined
    return { ...g, ...(children ? { children } : {}), ...override }
  })
}

// JSONを`import`すると型は自動推論されるが、要件セットの木構造（children等）まではTypeScriptには
// 分からないので、ここで RequirementGroup[] であることを明示しておく（as で型を指定し直している）。
const commonDoc = common as { groups: RequirementGroup[]; commonCreditSources?: { alwaysCommon?: string[] } }
const programDocs: ProgramDoc[] = [media, management, mathinfo, cs, designds, security, netinfo, electroinfo, control, robotics, mecha, electro, optical, physics, chembio, evening] as ProgramDoc[]

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
export function getRequirementSet(entryYear: number, course: string, cluster: string | null, program: string): RequirementSet | undefined {
  // 4つの条件すべてに一致するプログラムファイルを探す
  const doc = programDocs.find(
    (p) => p.entryYear === entryYear && p.course === course && p.cluster === cluster && p.program === program,
  )
  if (!doc) return undefined // まだデータが無い組み合わせ

  // 夜間主（course: 'evening'）は2025-day-common.jsonをextendsしない自己完結ファイルなので、
  // doc.groups だけをそのまま使う。昼間コースは共通ファイルのgroups（総合文化・実践教育。
  // プログラム固有のcommonOverridesがあれば適用）とプログラム別ファイルのgroups（専門科目）を
  // 1つの配列にまとめて、evaluateRequirements() にそのまま渡せる形にする
  const groups =
    doc.course === 'evening'
      ? [...doc.groups]
      : [...applyCommonOverrides(commonDoc.groups, doc.commonOverrides), ...doc.groups]

  return {
    totalCredits: doc.totalCredits,
    commonCredits: doc.commonCredits,
    groups,
    alwaysCommonSubjects: doc.course === 'evening' ? [] : (commonDoc.commonCreditSources?.alwaysCommon ?? []),
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
