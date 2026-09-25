// AIエージェント（WebMCP）向けのツールを、メイン画面が開いている間だけブラウザに登録する部品。
//
// 画面には何も表示しない（null を返す）。MainPage は要件データが無いと途中で return するため、
// フック（useEffect など）を MainPage 本体に置けない。そこで「要件データがあるときだけ描画される
// 子コンポーネント」にして、登録・後片付け・最新の処理への差し替えをここにまとめている。
// WebMCP に対応していないブラウザでは registerAgentTools が何もしないので、普通の利用者には影響しない。

import { useEffect, useRef } from 'react'
import { registerAgentTools } from '../webmcp'
import type { AgentTool } from '../webmcp'

/**
 * AIエージェント（WebMCP）から呼ばれる各ツールの実際の処理。
 * 画面の最新の状態（履修記録・判定結果）を使うため、MainPage の描画のたびに作り直して props で渡す。
 */
export type AgentHandlers = Record<'getProfile' | 'getRequirementStatus' | 'getTermRecommendations' | 'searchSubjects' | 'setSubjectStatus', (input: Record<string, unknown>) => unknown>

/**
 * エージェントに公開するツールの一覧（名前・説明・入力の形）を作る。
 * call は「今の画面の処理（AgentHandlers）」を呼び出す関数で、ツールの登録自体は1回だけで済むようにしている。
 */
function buildAgentToolDefinitions(call: <K extends keyof AgentHandlers>(key: K, input: Record<string, unknown>) => unknown): AgentTool[] {
  return [
    {
      name: 'get_profile',
      description: '電気通信大学 情報理工学域の利用者のプロフィール（入学年度・コース・類・プログラム・学年）を返す。卒業要件は入学年度の学修要覧で決まる。夜間主コースは類・プログラムの区分が無いため cluster と program が null、昼間コースでプログラム未定の場合は program が null になる。',
      inputSchema: { type: 'object', properties: {} },
      readOnly: true,
      execute: (input) => call('getProfile', input),
    },
    {
      name: 'get_requirement_status',
      description:
        '卒業要件の区分ごとの修得状況を返す。kind は区分の種類（required=必修, elective=選択, elective-required=選択必修, free=自由, international=留学生向け）。earned は確定した修得単位、projected は修得見込の科目もすべて修得できた場合の単位、shortfall/projectedShortfall は不足単位。reviews は2年次終了時・卒業研究着手・卒業の各審査の判定。画面に未確定の変更がある場合 hasPendingChanges が true になる（判定は確定済みの記録だけで計算している）。',
      inputSchema: { type: 'object', properties: {} },
      readOnly: true,
      execute: (input) => call('getRequirementStatus', input),
    },
    {
      name: 'get_term_recommendations',
      description:
        '指定した学年・学期に履修できる、修得を推奨する科目を返す。その学期の科目に加え、指定した学年より前に標準開講された未修得の科目も含む。確定済みの履修記録だけで計算し、画面の未確定の変更は反映しない。required は未修得の必修、requiredRetake/electiveRetake は再履修が必要な不合格科目、electiveGroups は単位が不足している選択区分ごとの候補、commonCredits は共通単位の不足を埋める候補。各科目の status は現在の履修状態（passed=修得, taking=修得見込, failed=不合格, none=未履修）。',
      inputSchema: {
        type: 'object',
        properties: {
          year: { type: 'integer', minimum: 1, maximum: 4, description: '学年（1〜4）' },
          term: { type: 'string', enum: ['前学期', '後学期'], description: '学期' },
        },
        required: ['year', 'term'],
      },
      readOnly: true,
      execute: (input) => call('getTermRecommendations', input),
    },
    {
      name: 'search_subjects',
      description: '科目名または科目番号の一部で、この利用者の入学年度の科目を最大20件検索する（全角・半角、大文字・小文字、空白の違いは無視。空の検索語では何も返さない）。同じ授業が複数のプログラムに別の科目番号で載っていることがあり（例: ヒューマンインタフェース）、その場合は同名の科目が複数件返る。科目番号（例 COM405a）は set_subject_status で使う。',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: '科目名または科目番号の一部' } },
        required: ['query'],
      },
      readOnly: true,
      execute: (input) => call('searchSubjects', input),
    },
    {
      name: 'set_subject_status',
      description:
        '科目の履修状態を変更する（passed=修得, taking=修得見込, failed=不合格, none=未履修に戻す）。同名の科目が複数の番号で検索された場合はどれを指定してもよく、同一科目として1件だけ記録される（利用者のプログラムの科目番号があればその番号に記録する）。変更は画面上の未確定の変更として入るだけで、利用者が画面の「更新する」ボタンを押すまで保存されず、他のツールの結果（修得状況・推奨科目）にも反映されない。変更後は、利用者に内容を確認して「更新する」を押すよう伝えること。',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: '科目番号（search_subjects で調べた値。例 COM405a）' },
          status: { type: 'string', enum: ['passed', 'taking', 'failed', 'none'] },
        },
        required: ['code', 'status'],
      },
      readOnly: false,
      execute: (input) => call('setSubjectStatus', input),
    },
  ]
}

/**
 * handlers（その時点の画面の状態を使った処理）を受け取り、ツールを登録する。
 * 登録は画面を開いたときの1回だけで、handlers が変わったら ref の中身だけを差し替える。
 */
export default function AgentToolsBridge({ handlers }: { handlers: AgentHandlers }) {
  // useRef は描画をまたいで値を保持する箱（書き換えても再描画は起きない）。
  const handlersRef = useRef(handlers)

  // 毎回の描画の後に、最新の処理へ差し替える（依存配列を省略した useEffect は毎回実行される）。
  useEffect(() => {
    handlersRef.current = handlers
  })

  // 画面を開いたときに登録し、閉じたとき（別ページへ移動など）に登録を取り消す。
  useEffect(() => {
    // ツールが呼ばれた時点の最新の処理を ref から取り出して実行する。
    const call = <K extends keyof AgentHandlers>(key: K, input: Record<string, unknown>) => handlersRef.current[key](input)
    return registerAgentTools(buildAgentToolDefinitions(call))
  }, [])

  return null
}
