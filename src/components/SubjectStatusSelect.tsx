// 科目1件ぶんの履修状態を選ぶ<select>。メイン画面のどの一覧（取得単位・不可の単位・
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
    <select
      aria-label={`${code}の履修状態`}
      value={value ?? 'none'}
      onChange={(e) => {
        const v = e.target.value
        onChange(code, v === 'none' ? undefined : (v as SubjectStatus))
      }}
    >
      <option value="none">未履修</option>
      <option value="taking">履修中</option>
      <option value="passed">修得</option>
      <option value="failed">不合格</option>
    </select>
  )
}
