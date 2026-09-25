// 修得見込の科目を開講期ごとに並べる週間時間割。表示だけを担当し、記録の保存はしない。
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buildTimetablePreview, previewSemesterOf } from '../domain/timetablePreview'
import type { TimetablePreviewCourse, TimetablePreviewSlot, UnplacedTimetableCourse } from '../domain/timetablePreview'

/** グリッドに表示する曜日と時限。2026年度の開講情報には土曜・7限まである。 */
const DAYS = ['月', '火', '水', '木', '金', '土'] as const
const PERIODS = [1, 2, 3, 4, 5, 6, 7] as const
const BASE_TERMS = ['前学期', '後学期'] as const

/** 画面に並べる開講期を、基本の前後学期と修得見込科目の実際の開講期から作る。 */
function availableTerms(courses: readonly TimetablePreviewCourse[]): string[] {
  const terms = new Set<string>(BASE_TERMS)
  // 春・夏は前学期、秋・冬は後学期に含め、他の開講期だけ選択肢を増やす。
  for (const course of courses) {
    // 1科目に複数の開講期がある場合も、表示学期の選択肢は重複させない。
    for (const term of course.offeredTerms) terms.add(previewSemesterOf(term))
  }
  return [...BASE_TERMS, ...[...terms].filter((term) => term !== '前学期' && term !== '後学期').sort()]
}

/** 未確定科目の理由を、科目一覧の中で読める短い文言にする。 */
const REASON_LABELS: Record<UnplacedTimetableCourse['reason'], string> = {
  'no-offering': 'シラバスの開講情報なし',
  'no-class': '受講クラスを特定できません',
  'no-slot': '曜日時限の記載なし',
  'ambiguous-term': '開講タームが複数候補',
  'ambiguous-slot': '曜日時限が複数候補',
}

/** 1コマに入る科目名と科目詳細へのリンク。 */
function CourseInSlot({ slot, entryYear }: { slot: TimetablePreviewSlot; entryYear: number }) {
  return (
    <Link className="timetable-course" to={`/courses/${encodeURIComponent(slot.code)}?year=${entryYear}`}>
      <span>{slot.name}{slot.offeringTerm !== '前学期' && slot.offeringTerm !== '後学期' && `（${slot.offeringTerm}）`}</span>
      <small>{slot.code}</small>
    </Link>
  )
}

/** 曜日・時限が確定した科目を表に置き、未確定の科目を表の下へ示す。 */
export default function TimetablePreview({ courses, entryYear, hasPendingChanges }: {
  courses: readonly TimetablePreviewCourse[]
  entryYear: number
  hasPendingChanges: boolean
}) {
  const [term, setTerm] = useState('前学期')
  const result = buildTimetablePreview(courses, term)
  const terms = availableTerms(courses)
  // 同じコマの科目をまとめ、重複した場合も両方の科目名を読めるようにする。
  const slotsByCell = new Map<string, TimetablePreviewSlot[]>()
  for (const slot of result.slots) {
    // 曜日と時限を連結したキーで、同時限の科目を1つのセルに集める。
    const key = `${slot.day}:${slot.period}`
    slotsByCell.set(key, [...(slotsByCell.get(key) ?? []), slot])
  }

  return (
    <section id="timetable-preview" className="requirement-section timetable-preview-section">
      <h2>時間割プレビュー</h2>
      <p className="section-guidance">
        「修得見込」の科目を表示します。科目の変更はすぐに反映されます。
        {hasPendingChanges && ' 未更新の変更を保存するには「単位取得状況を更新」を押してください。'}
      </p>
      <label className="timetable-term-label" htmlFor="timetable-preview-term">
        開講期
        <select id="timetable-preview-term" value={term} onChange={(event) => setTerm(event.target.value)}>
          {terms.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      {courses.length === 0 ? (
        <p className="section-guidance">科目の状態を「修得見込」にすると、ここに時間割が表示されます。</p>
      ) : (
        <>
          <div className="timetable-scroll" role="region" aria-label={`${term}の時間割`} tabIndex={0}>
            <table className="timetable-grid">
              <caption>{term}の週間時間割</caption>
              <thead><tr><th scope="col">時限</th>{DAYS.map((day) => <th key={day} scope="col">{day}</th>)}</tr></thead>
              <tbody>
                {PERIODS.map((period) => (
                  <tr key={period}>
                    <th scope="row">{period}限</th>
                    {DAYS.map((day) => {
                      // 各コマの科目数から、時間帯が重複しているかを見た目にも示す。
                      const cellSlots = slotsByCell.get(`${day}:${period}`) ?? []
                      return (
                        <td key={day} className={cellSlots.length > 1 ? 'timetable-cell-conflict' : undefined}>
                          {cellSlots.length > 1 && <span className="timetable-conflict-label">同時限に{cellSlots.length}科目</span>}
                          {cellSlots.map((slot) => <CourseInSlot key={slot.code} slot={slot} entryYear={entryYear} />)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.slots.length === 0 && result.unplaced.length === 0 && (
            <p className="section-guidance">この開講期の修得見込科目はありません。</p>
          )}
          {result.unplaced.length > 0 && (
            <div className="timetable-unplaced">
              <h3>曜日時限を確定できない科目（{result.unplaced.length}科目）</h3>
              <p className="section-guidance">クラスや開講情報が未確定の科目は、誤ったコマへ置かずにここへ表示します。科目詳細と公式シラバスを確認してください。</p>
              <ul>
                {result.unplaced.map((course) => (
                  <li key={course.code}>
                    <Link to={`/courses/${encodeURIComponent(course.code)}?year=${entryYear}`}>{course.name}</Link>
                    {' '}（{course.code}）：{REASON_LABELS[course.reason]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
