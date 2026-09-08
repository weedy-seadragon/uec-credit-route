// 科目一覧・検索ページ（"/courses"）。F-5に対応。
// 学修要覧に載っている科目を、キーワード・学年学期・曜日・プログラムで絞り込んで探せるようにする。
// プログラムを選ぶと、そのプログラムの卒業要件の「単位の種類」（必修・選択必修・選択・自由科目…）
// ごとに見出しを立てて科目を並べる（2026-09-08、開発者の指示でデザインを一新）。
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { CourseListSection } from '../data/requirementSets'
import { getCourseListSections, getSubjectsByCode, programOptions } from '../data/requirementSets'

const DAYS = ['月', '火', '水', '木', '金', '土', '日'] as const
const YEARS = ['1', '2', '3', '4'] as const

// 一度に描画する科目数の上限（絞り込み前・プログラム未選択時に全1000件超を描画すると重いため）
const MAX_ROWS = 300

// kindから見出しに添える読みやすい呼び方（groupのlabelが無いときのフォールバック用）
const KIND_LABEL: Record<string, string> = {
  required: '必修',
  elective: '選択',
  'elective-required': '選択必修',
  free: '自由科目',
  international: '国際科目',
}

function yearTermLabel(standardYear: number | null, termType: string | null): string {
  if (!standardYear) return '-'
  return `${standardYear}年${termType ?? ''}`
}

export default function CoursesPage() {
  const [searchParams] = useSearchParams()
  // 詳細ページから戻った場合はURLのyearを使い、古いURLには従来どおり2025年度を使う。
  const initialYear = searchParams.get('year') === '2026' ? 2026 : 2025
  const [keyword, setKeyword] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [termFilter, setTermFilter] = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [catalogYear, setCatalogYear] = useState(initialYear)
  const [programValue, setProgramValue] = useState('')

  // 表示する科目名・単位数・開講情報は、選択中の年度の科目マスタから取得する。
  const subjectsByCode = useMemo(() => getSubjectsByCode(catalogYear), [catalogYear])

  const selectedProgram = useMemo(
    () => programOptions.find((p) => p.entryYear === catalogYear && p.program === programValue),
    [catalogYear, programValue],
  )

  // プログラム未選択時は共通ファイル（総合文化・実践教育科目）だけの区分になる
  // （getCourseListSectionsの仕様上、entryYear/course/clusterはprogramがnullのときは使われない）
  const sections = useMemo<CourseListSection[]>(() => {
    if (!selectedProgram) return getCourseListSections(catalogYear, 'day', null, null)
    return getCourseListSections(selectedProgram.entryYear, selectedProgram.course, selectedProgram.cluster, selectedProgram.program)
  }, [catalogYear, selectedProgram])

  const kw = keyword.trim()

  // プログラム名でグルーピングした<select>の選択肢（類ごと→夜間主の順）
  const groupedProgramOptions = useMemo(() => {
    const clusters: { label: string; options: typeof programOptions }[] = [
      { label: 'Ⅰ類', options: [] },
      { label: 'Ⅱ類', options: [] },
      { label: 'Ⅲ類', options: [] },
      { label: '夜間主', options: [] },
    ]
    for (const p of programOptions.filter((option) => option.entryYear === catalogYear)) {
      const bucket = p.cluster === 'I' ? clusters[0] : p.cluster === 'II' ? clusters[1] : p.cluster === 'III' ? clusters[2] : clusters[3]
      bucket.options.push(p)
    }
    return clusters.filter((c) => c.options.length > 0)
  }, [catalogYear])

  // 年度を切り替えたときは、前年度のプログラムIDを残さず未選択へ戻す。
  function handleCatalogYearChange(year: number) {
    setCatalogYear(year)
    setProgramValue('')
  }

  // フィルタ適用後の区分一覧と、MAX_ROWSで打ち切ったかどうかを1回の計算でまとめて出す
  // （レンダー中に外側の変数を書き換えるのはReactの作法に反するため、reduceで完結させる）
  const { visibleSections, shown, truncated } = useMemo(() => {
    const filteredSections = sections
      .map((section) => ({
        ...section,
        codes: section.codes.filter((code) => {
          const s = subjectsByCode.get(code)
          if (!s) return false
          if (kw && !s.name.includes(kw) && !s.code.toUpperCase().includes(kw.toUpperCase())) return false
          if (yearFilter && String(s.standardYear ?? '') !== yearFilter) return false
          if (termFilter && s.termType !== termFilter) return false
          if (dayFilter) {
            const hasDay = s.offerings?.some((o) => o.slots.some((slot) => slot.day === dayFilter))
            if (!hasDay) return false
          }
          return true
        }),
      }))
      .filter((section) => section.codes.length > 0)

    return filteredSections.reduce(
      (acc, section) => {
        if (acc.shown >= MAX_ROWS) return { ...acc, truncated: true }
        const remaining = MAX_ROWS - acc.shown
        const limited = section.codes.slice(0, remaining)
        if (limited.length === 0) return acc
        return {
          visibleSections: [...acc.visibleSections, { ...section, codes: limited }],
          shown: acc.shown + limited.length,
          truncated: acc.truncated || limited.length < section.codes.length,
        }
      },
      { visibleSections: [] as CourseListSection[], shown: 0, truncated: false },
    )
  }, [sections, subjectsByCode, kw, yearFilter, termFilter, dayFilter])

  return (
    <main>
      <h1>科目一覧</h1>
      <p>
        学修要覧に載っている科目を、キーワード・学年学期・曜日・プログラムで絞り込んで探せます。
        科目名をクリックすると詳細（開講情報・要件上の位置づけ）を表示します。
      </p>

      <div className="course-filter-row">
        <label htmlFor="courses-entry-year">入学年度</label>
        <select
          id="courses-entry-year"
          value={catalogYear}
          onChange={(e) => handleCatalogYearChange(Number(e.target.value))}
        >
          {[...new Set(programOptions.map((p) => p.entryYear))].map((year) => (
            <option key={year} value={year}>
              {year}年度
            </option>
          ))}
        </select>
      </div>

      <div className="course-filter-row">
        <label htmlFor="courses-program">プログラム</label>
        <select id="courses-program" value={programValue} onChange={(e) => setProgramValue(e.target.value)}>
          <option value="">未選択（総合文化・実践教育科目のみ）</option>
          {groupedProgramOptions.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((p) => (
                <option key={`${p.entryYear}-${p.program}`} value={p.program}>
                  {p.programName}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="course-program-note">
          ※プログラムを選択しないと、理数基礎・類共通基礎・類専門科目は表示されません
        </span>
      </div>

      <div className="course-filter-row">
        <label htmlFor="courses-keyword">キーワード（科目名・科目番号）</label>
        <input
          id="courses-keyword"
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="例: 複素関数論、COM301"
        />
      </div>

      <div className="course-filter-row">
        <label htmlFor="courses-year">学年</label>
        <select id="courses-year" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="">指定なし</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>

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
        {shown}件表示{truncated && '（他にも該当あり。絞り込むとすべて表示されます）'}
      </p>

      {visibleSections.map((section, i) => (
        // 同じ見出し文字列が別プログラムの別区分で再度出てくることがあるため、
        // keyには見出し名だけでなく出現順のインデックスも混ぜる
        <section key={`${section.heading}-${i}`}>
          <h2>
            {section.heading}
            {section.kind && !section.heading.includes(KIND_LABEL[section.kind]) && (
              <span style={{ color: '#777', fontWeight: 'normal', fontSize: '0.8em' }}> （{KIND_LABEL[section.kind]}）</span>
            )}
          </h2>
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
              {section.codes.map((code) => {
                const s = subjectsByCode.get(code)
                if (!s) return null
                return (
                  <tr key={code}>
                    <td>{code}</td>
                    <td>
                      <Link to={`/courses/${code}?year=${catalogYear}`}>{s.name}</Link>
                    </td>
                    <td>{s.credits}</td>
                    <td>{yearTermLabel(s.standardYear, s.termType)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  )
}
