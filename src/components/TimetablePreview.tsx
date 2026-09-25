// 修得見込の科目を開講期ごとに並べる週間時間割。表示だけを担当し、記録の保存はしない。
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buildTimetablePreview, maxConcurrentOfferingCount, previewSemesterOf } from '../domain/timetablePreview'
import type { TimetablePreviewCourse, TimetablePreviewSlot, UnplacedTimetableCourse } from '../domain/timetablePreview'

/** グリッドに表示する平日。土曜などの授業は表の下にまとめる。 */
const DAYS: readonly string[] = ['月', '火', '水', '木', '金']
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

/** 科目名が英字・数字・記号だけなら、英語用の改行規則を使う。 */
function isEnglishCourseName(name: string): boolean {
  // 英字を含み、日本語を含まない科目名だけ英語の改行規則を使う。
  return /[A-Za-z]/.test(name) && /^[\p{Script=Latin}\p{Number}\p{Punctuation}\p{Symbol}\s]+$/u.test(name)
}

/** 自動ハイフンが使えない環境でも自然な位置で切れるようにする英単語の区切り。 */
const ENGLISH_WORD_BREAKS: Readonly<Record<string, readonly number[]>> = {
  academic: [3, 6],
  intermediate: [2, 5, 7, 9],
  technical: [4, 6],
}

/** 長い英単語へ、改行したときだけ見えるソフトハイフンを挿入する。 */
function hyphenateEnglishName(name: string): string {
  // よく使う語は音節で区切り、その他の長い語は短いまとまりに分ける。
  return name.replace(/[A-Za-z]{7,}/g, (word) => {
    const breaks = ENGLISH_WORD_BREAKS[word.toLowerCase()]
      ?? Array.from({ length: Math.floor((word.length - 3) / 3) }, (_, index) => (index + 1) * 3)
    let start = 0
    const parts: string[] = []
    // 各区切りで元の大文字・小文字を保ったまま単語を分ける。
    for (const point of breaks) {
      parts.push(word.slice(start, point))
      start = point
    }
    parts.push(word.slice(start))
    return parts.join('\u00AD')
  })
}

/** 1コマに入る科目名と科目詳細へのリンク。 */
function CourseInSlot({ slot, entryYear }: { slot: TimetablePreviewSlot; entryYear: number }) {
  // 英語名だけに言語属性と改行候補を付け、日本語名には手を加えない。
  const englishName = isEnglishCourseName(slot.name)
  return (
    <Link className="timetable-course" aria-label={`${slot.name}（${slot.code}）`} to={`/courses/${encodeURIComponent(slot.code)}?year=${entryYear}`}>
      <span><span lang={englishName ? 'en' : undefined}>{englishName ? hyphenateEnglishName(slot.name) : slot.name}</span>{slot.offeringTerm !== '前学期' && slot.offeringTerm !== '後学期' && `（${slot.offeringTerm}）`}</span>
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
  // 平日の科目をコマごとに、土曜などの科目を科目番号ごとにまとめる。
  const slotsByCell = new Map<string, TimetablePreviewSlot[]>()
  const otherDaySlotsByCourse = new Map<string, TimetablePreviewSlot[]>()
  let lastPeriod = 5
  for (const slot of result.slots) {
    // 平日は最大時限を更新し、同じコマの科目を両方残す。
    if (DAYS.includes(slot.day)) {
      lastPeriod = Math.max(lastPeriod, slot.period)
      const key = `${slot.day}:${slot.period}`
      slotsByCell.set(key, [...(slotsByCell.get(key) ?? []), slot])
    } else {
      // 表にない曜日のコマも科目単位で保持し、画面から消さない。
      otherDaySlotsByCourse.set(slot.code, [...(otherDaySlotsByCourse.get(slot.code) ?? []), slot])
    }
  }
  // 7限の授業だけがあっても、6限を飛ばさず1限から順に表示する。
  const periods = Array.from({ length: lastPeriod }, (_, index) => index + 1)

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
                {periods.map((period) => (
                  <tr key={period}>
                    <th scope="row">{period}限</th>
                    {DAYS.map((day) => {
                      // 同じコマでも春と夏など別期間なら重複扱いにしない。
                      const cellSlots = slotsByCell.get(`${day}:${period}`) ?? []
                      const concurrentCount = maxConcurrentOfferingCount(cellSlots.map((slot) => slot.offeringTerm))
                      return (
                        <td key={day} className={concurrentCount > 1 ? 'timetable-cell-conflict' : undefined}>
                          {concurrentCount > 1 && <span className="timetable-conflict-label">同時限に{concurrentCount}科目</span>}
                          {cellSlots.map((slot) => <CourseInSlot key={slot.code} slot={slot} entryYear={entryYear} />)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {otherDaySlotsByCourse.size > 0 && (
            <div className="timetable-other-days">
              <h3>土曜などの授業（{otherDaySlotsByCourse.size}科目）</h3>
              <ul>
                {/* 表にない曜日の複数コマを、科目ごとに1行へまとめる。 */}
                {[...otherDaySlotsByCourse].map(([code, slots]) => (
                  <li key={code}>
                    <Link to={`/courses/${encodeURIComponent(code)}?year=${entryYear}`}>
                      {slots[0].name}{slots[0].offeringTerm !== '前学期' && slots[0].offeringTerm !== '後学期' && `（${slots[0].offeringTerm}）`}
                    </Link>
                    {' '}（{code}）：{slots.map((slot) => `${slot.day}${slot.period}限`).join('、')}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
