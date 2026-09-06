// 科目一覧・検索ページ（"/courses"）。F-5に対応。
// 学修要覧に載っている全科目（プログラムを問わず）を、キーワード・学期・曜日で
// 絞り込んで探せるようにする。一覧の各行から科目詳細（CourseDetailPage）に飛べる。
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSubjectsByCode } from '../data/requirementSets'

const DAYS = ['月', '火', '水', '木', '金', '土', '日'] as const

// 一度に描画する行数の上限。科目マスタは1000件を超えるので、絞り込み前に
// 全部レンダリングすると重くなる（＆どのみち探しづらい）ため、上限を超えたら
// 「絞り込んでください」という案内だけ出す
const MAX_ROWS = 200

// 標準履修年次・学期を「2年前期」のような1つの文字列にする
function yearTermLabel(standardYear: number | null, termType: string | null): string {
  if (!standardYear) return '-'
  return `${standardYear}年${termType ?? ''}`
}

export default function CoursesPage() {
  const [keyword, setKeyword] = useState('')
  const [termFilter, setTermFilter] = useState('')
  const [dayFilter, setDayFilter] = useState('')

  // useMemo(() => ..., []) は依存配列が空なので、初回描画時に1回だけ計算する。
  // 科目マスタ（1000件超）を検索のたびに毎回Mapから作り直さずに済む
  const allSubjects = useMemo(() => [...getSubjectsByCode().values()], [])

  const filtered = useMemo(() => {
    const kw = keyword.trim()
    return allSubjects
      .filter((s) => {
        if (kw && !s.name.includes(kw) && !s.code.toUpperCase().includes(kw.toUpperCase())) return false
        if (termFilter && s.termType !== termFilter) return false
        if (dayFilter) {
          const hasDay = s.offerings?.some((o) => o.slots.some((slot) => slot.day === dayFilter))
          if (!hasDay) return false
        }
        return true
      })
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [allSubjects, keyword, termFilter, dayFilter])

  const hasFilter = keyword.trim() !== '' || termFilter !== '' || dayFilter !== ''
  const visible = filtered.slice(0, MAX_ROWS)

  return (
    <main>
      <h1>科目一覧</h1>
      <p>
        学修要覧に載っている科目を、キーワード・学期・曜日で絞り込んで探せます。
        科目名をクリックすると詳細（開講情報・要件上の位置づけ）を表示します。
      </p>

      <div>
        <label htmlFor="courses-keyword">キーワード（科目名・科目番号）</label>
        <input
          id="courses-keyword"
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="例: 複素関数論、COM301"
        />
      </div>

      <div>
        <label htmlFor="courses-term">学期</label>
        <select id="courses-term" value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
          <option value="">指定なし</option>
          <option value="前学期">前学期</option>
          <option value="後学期">後学期</option>
        </select>

        <label htmlFor="courses-day">曜日</label>
        <select id="courses-day" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
          <option value="">指定なし</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}曜
            </option>
          ))}
        </select>
      </div>

      <p>
        {filtered.length}件見つかりました
        {!hasFilter && filtered.length > MAX_ROWS && '（先頭200件のみ表示。絞り込むと探しやすくなります）'}
      </p>

      <table>
        <thead>
          <tr>
            <th>科目番号</th>
            <th>科目名</th>
            <th>単位数</th>
            <th>標準履修年次</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((s) => (
            <tr key={s.code}>
              <td>{s.code}</td>
              <td>
                <Link to={`/courses/${s.code}`}>{s.name}</Link>
              </td>
              <td>{s.credits}</td>
              <td>{yearTermLabel(s.standardYear, s.termType)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
