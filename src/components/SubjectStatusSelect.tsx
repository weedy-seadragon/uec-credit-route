// 科目1件ぶんの履修状態を選ぶラジオボタン。メイン画面のどの一覧（取得単位・不合格の科目・
// 残りの必修・区分別の進捗）でも同じ見た目・同じ動きになるよう、共通の部品にしてある。
import type { SubjectStatus } from '../domain/requirements'

interface SubjectStatusSelectProps {
  code: string
  /** undefined は「未履修」を表す（requirements.ts の SubjectStatus と同じ考え方） */
  value: SubjectStatus | undefined
  onChange: (code: string, status: SubjectStatus | undefined) => void
}

export default function SubjectStatusSelect({ code, value, onChange }: SubjectStatusSelectProps) {
  return (
    // fieldset/legendは、関連するラジオボタンのまとまりを支援技術にも伝えるHTMLの組み合わせ。
    // legendは見た目には隠し、各科目の行が縦に長くなりすぎないようにする。
    <fieldset className="subject-status" aria-label={`${code}の履修状態`}>
      <legend className="visually-hidden">{code}の履修状態</legend>
      {/* 3つの固定候補を横並びのラベルとして表示する。nameが同じradioだけが排他的に選ばれる。 */}
      {([
        ['none', '未履修'],
        ['passed', '修得'],
        ['failed', '不合格'],
      ] as const).map(([status, label]) => (
        <label key={status} className={`status-option status-${status}`}>
          <input
            type="radio"
            name={`subject-status-${code}`}
            checked={(value ?? 'none') === status}
            onChange={() => {
              // 未履修だけは履修記録を持たないundefinedへ戻し、他の2つはSubjectStatusとして渡す。
              onChange(code, status === 'none' ? undefined : status)
            }}
          />
          {label}
        </label>
      ))}
    </fieldset>
  )
}
