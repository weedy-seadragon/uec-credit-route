// 修得見込の科目を開講期ごとに並べる週間時間割。表示設定だけを保存し、履修記録は変更しない。
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buildTimetablePreview, buildVisibleTimetablePreview, defaultRetakeOptionForTerm, maxConcurrentOfferingCount, previewSemesterOf, splitUnplacedTimetableCourses, timetableCategoryColorsForCourses, timetableLegendForSlots } from '../domain/timetablePreview'
import type { TimetablePreviewCourse, TimetablePreviewOption, TimetablePreviewSlot, UnplacedTimetableCourse } from '../domain/timetablePreview'
import { TIMELESS_COURSE_LABELS } from '../domain/onDemand'
import { loadHiddenTimetableCourses, saveHiddenTimetableCourses } from '../storage/timetableVisibility'
import { loadTimetableOfferingSelection, saveTimetableOfferingSelection } from '../storage/timetableOfferingSelection'

/** グリッドに表示する平日。土曜などの授業は表の下にまとめる。 */
const DAYS: readonly string[] = ['月', '火', '水', '木', '金']
const BASE_TERMS = ['前学期', '後学期'] as const
const INTENSIVE_LABELS = {
  'summer-intensive': '夏期集中',
  'winter-intensive': '冬期集中',
  intensive: '集中講義',
} as const

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
  'lower-year-selection': '受講する授業を選んでください',
  'no-slot': '曜日時限の記載なし',
  'instructor-dependent': TIMELESS_COURSE_LABELS['instructor-dependent'],
  lab: TIMELESS_COURSE_LABELS.lab,
  'ambiguous-term': '開講タームが複数候補',
  'ambiguous-slot': '曜日時限が複数候補',
}

/** 科目名が英字・数字・記号だけなら、英語用の改行規則を使う。 */
function isEnglishCourseName(name: string): boolean {
  // 英字を含み、日本語を含まない科目名だけ英語の改行規則を使う。
  return /[A-Za-z]/.test(name) && /^[\p{Script=Latin}\p{Number}\p{Punctuation}\p{Symbol}\s]+$/u.test(name)
}

/** 7文字以上の英単語へ、長さだけで改行用のソフトハイフンを挿入する。 */
function hyphenateEnglishName(name: string): string {
  // 単語ごとの知識は持たず、最後に3文字以上残る範囲で3文字間隔に区切る。
  return name.replace(/[A-Za-z]{7,}/g, (word) => {
    const breaks = Array.from({ length: Math.floor((word.length - 3) / 3) }, (_, index) => (index + 1) * 3)
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
  const category = slot.category
  return (
    <Link
      className={`timetable-course${category?.isRequired ? ' timetable-course--required' : ''}`}
      data-category-color={slot.categoryColorIndex}
      aria-label={slot.name}
      to={`/courses/${encodeURIComponent(slot.code)}?year=${entryYear}`}
    >
      {category?.isRequired && <span className="timetable-required-badge" aria-hidden="true">必修</span>}
      <span><span lang={englishName ? 'en' : undefined}>{englishName ? hyphenateEnglishName(slot.name) : slot.name}</span>{slot.offeringTerm !== '前学期' && slot.offeringTerm !== '後学期' && `（${slot.offeringTerm}）`}</span>
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
  const [hiddenCodes, setHiddenCodes] = useState<ReadonlySet<string>>(() => loadHiddenTimetableCourses())
  const [selectedTimetableCodes, setSelectedTimetableCodes] = useState<Readonly<Record<string, string>>>(() => loadTimetableOfferingSelection())
  const allCoursesResult = buildTimetablePreview(courses, term, selectedTimetableCodes)
  const result = buildVisibleTimetablePreview(courses, term, hiddenCodes, selectedTimetableCodes)
  const { selectable: selectableCourses, timeless: timelessCourses } = splitUnplacedTimetableCourses(result.unplaced)
  const allCategoryColors = timetableCategoryColorsForCourses(courses)
  const categoryLegend = timetableLegendForSlots(result.slots.filter((slot) => DAYS.includes(slot.day)), allCategoryColors)
  const colorIndexByCategory = new Map<string, number>()
  // 必修以外は、現在の表に表示されるカテゴリ色をカードへ引き継ぐ。
  for (const category of allCategoryColors) {
    if (category.colorIndex !== undefined) colorIndexByCategory.set(category.key, category.colorIndex)
  }
  const terms = availableTerms(courses)
  // 選択した開講期の科目を、非表示中のものも含めて設定欄へ残す。
  const termCourseCodes = new Set([
    ...allCoursesResult.slots.map((slot) => slot.code),
    ...allCoursesResult.onDemand.map((course) => course.code),
    ...allCoursesResult.intensive.map((course) => course.code),
    ...allCoursesResult.unplaced.map((course) => course.code),
  ])
  const termCourses = courses.filter((course) => termCourseCodes.has(course.code))

  /** 表示設定をすぐ画面へ反映し、履修記録とは別に保存する。 */
  function changeVisibility(code: string, visible: boolean): void {
    const next = new Set(hiddenCodes)
    // 表示を選んだときは非表示集合から外し、非表示を選んだときは加える。
    if (visible) next.delete(code)
    else next.add(code)
    setHiddenCodes(next)
    saveHiddenTimetableCourses(next)
  }
  /** セクションの選択をすぐ反映し、プレビュー専用の設定として保存する。 */
  function changeTimetableOffering(code: string, timetableCode: string): void {
    const next = { ...selectedTimetableCodes }
    // 空欄は選択解除として保存対象から外し、選択コードは科目番号に対応付ける。
    if (timetableCode) next[code] = timetableCode
    else delete next[code]
    setSelectedTimetableCodes(next)
    saveTimetableOfferingSelection(next)
  }
  // 平日の科目をコマごとに、土曜などの科目を科目番号ごとにまとめる。
  const slotsByCell = new Map<string, TimetablePreviewSlot[]>()
  const otherDaySlotsByCourse = new Map<string, TimetablePreviewSlot[]>()
  let lastPeriod = 5
  for (const slot of result.slots) {
    // 平日は最大時限を更新し、同じコマの科目を両方残す。
    if (DAYS.includes(slot.day)) {
      lastPeriod = Math.max(lastPeriod, slot.period)
      const key = `${slot.day}:${slot.period}`
      const colorIndex = slot.category ? colorIndexByCategory.get(slot.category.key) : undefined
      const displaySlot = colorIndex === undefined ? slot : { ...slot, categoryColorIndex: colorIndex }
      slotsByCell.set(key, [...(slotsByCell.get(key) ?? []), displaySlot])
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
      {categoryLegend.length > 0 && (
        <div className="timetable-legend" aria-label="時間割カードの色分け">
          <span className="timetable-legend-title">科目区分</span>
          <ul>
            {categoryLegend.map((category) => {
              // 表示色は科目カードと同じCSS変数・色番号を使う。
              return (
                <li key={category.key}>
                  <span
                    className={`timetable-legend-swatch${category.isRequired ? ' timetable-course--required' : ''}`}
                    data-category-color={category.colorIndex}
                    aria-hidden="true"
                  />
                  {category.label}
                </li>
              )
            })}
          </ul>
        </div>
      )}
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
                    {' '}：{slots.map((slot) => `${slot.day}${slot.period}限`).join('、')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.onDemand.length > 0 && (
            <div className="timetable-on-demand">
              <h3>オンデマンド（{result.onDemand.length}科目）</h3>
              <ul>
                {/* 曜日時限のセルを作らず、科目詳細へのリンクを一覧に残す。 */}
                {result.onDemand.map((course) => (
                  <li key={course.code}>
                    <Link to={`/courses/${encodeURIComponent(course.code)}?year=${entryYear}`}>{course.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.intensive.length > 0 && (
            <div className="timetable-intensive">
              <h3>集中講義（{result.intensive.length}科目）</h3>
              <ul>
                {/* 集中講義は時限セルを作らず、注記から分かる区分を添えて一覧に残す。 */}
                {result.intensive.map((course) => (
                  <li key={course.code}>
                    <Link to={`/courses/${encodeURIComponent(course.code)}?year=${entryYear}`}>{course.name}</Link>
                    {' '}（{INTENSIVE_LABELS[course.kind]}）
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.slots.length === 0 && result.unplaced.length === 0 && result.onDemand.length === 0 && result.intensive.length === 0 && (
            <p className="section-guidance">この開講期に表示中の修得見込科目はありません。</p>
          )}
          {selectableCourses.length > 0 && (
            <div className="timetable-unplaced">
              <h3>曜日時限を選んでください（{selectableCourses.length}科目）</h3>
              <p className="section-guidance">候補からセクションを選ぶと、曜日時限が時間割へ反映されます。</p>
              <ul>
                {selectableCourses.map((course) => (
                  <li key={course.code}>
                    <Link to={`/courses/${encodeURIComponent(course.code)}?year=${entryYear}`}>{course.name}</Link>
                    {' '}：{REASON_LABELS[course.reason]}
                    {course.options && course.options.length > 0 && (
                      <label className="timetable-section-choice">
                        {' '}セクション
                        <select
                          aria-label={`${course.name}のセクション`}
                          value={course.options.some((option) => option.timetableCode === selectedTimetableCodes[course.code]) ? selectedTimetableCodes[course.code] : ''}
                          onChange={(event) => changeTimetableOffering(course.code, event.target.value)}
                        >
                          <option value="">選択してください</option>
                          {course.options.map((option) => (
                            <option key={option.timetableCode ?? `${option.term}:${option.slots.map((slot) => `${slot.day}${slot.period}`).join('-')}`} value={option.timetableCode ?? ''} disabled={!option.timetableCode}>
                              {[...new Set(option.slots.map((slot) => `${slot.day}${slot.period}限`))].join('・') || '曜日時限の記載なし'}
                              {option.term !== '前学期' && option.term !== '後学期' && `（${option.term}）`}
                              {option.retake && '（再履修向け）'}
                              {' / '}{option.teacher || '担当教員記載なし'}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {timelessCourses.length > 0 && (
            <div className="timetable-unplaced">
              <h3>曜日時限が決まっていない科目（{timelessCourses.length}科目）</h3>
              <ul>
                {/* 曜日時限の候補自体がない科目は理由だけを示し、セクション選択を出さない。 */}
                {timelessCourses.map((course) => (
                  <li key={course.code}>
                    <Link to={`/courses/${encodeURIComponent(course.code)}?year=${entryYear}`}>{course.name}</Link>
                    {' '}：{REASON_LABELS[course.reason]}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {termCourses.length > 0 && (
            <details className="nested-subject-group timetable-visibility">
              <summary>時間割に表示する科目を選ぶ（{termCourses.length}科目）</summary>
              <ul>
                {/* 非表示にした科目もここには残し、いつでも表示へ戻せるようにする。 */}
                {termCourses.map((course) => {
                  // 自動配置された再履修枠も、この一覧から別セクションへ変更できるよう候補を用意する。
                  const sectionByCode = new Map<string, TimetablePreviewOption>()
                  for (const section of [...course.options, ...(course.sections ?? [])]) {
                    if (previewSemesterOf(section.term) !== term) continue
                    const sectionKey = section.timetableCode ?? `${section.term}:${section.slots.map((slot) => `${slot.day}${slot.period}`).join('-')}`
                    if (!sectionByCode.has(sectionKey)) sectionByCode.set(sectionKey, section)
                  }
                  const sectionChoices = [...sectionByCode.values()]
                  const savedCode = selectedTimetableCodes[course.code]
                  const hasSavedChoice = sectionChoices.some((section) => section.timetableCode === savedCode)
                  const defaultRetake = defaultRetakeOptionForTerm(course, term)
                  const sectionValue = hasSavedChoice ? savedCode ?? '' : defaultRetake?.timetableCode ?? ''
                  const canChangeSection = sectionChoices.length > 1 && (hasSavedChoice || Boolean(defaultRetake))
                  return (
                    <li key={course.code}>
                      <fieldset>
                        <legend>
                          <Link to={`/courses/${encodeURIComponent(course.code)}?year=${entryYear}`}>{course.name}</Link>
                          {/* 表示用の学年学期はMainPageから受け取り、空文字なら表示しない。 */}
                          {course.yearTermLabel && <span style={{ marginLeft: '0.4em' }}>（{course.yearTermLabel}）</span>}
                        </legend>
                        <label>
                          <input type="radio" name={`timetable-visible-${course.code}`} checked={!hiddenCodes.has(course.code)} onChange={() => changeVisibility(course.code, true)} />
                          表示
                        </label>
                        <label>
                          <input type="radio" name={`timetable-visible-${course.code}`} checked={hiddenCodes.has(course.code)} onChange={() => changeVisibility(course.code, false)} />
                          非表示
                        </label>
                        {canChangeSection && (
                          <label className="timetable-section-choice">
                            {' '}セクション
                            <select aria-label={`${course.name}のセクション`} value={sectionValue} onChange={(event) => changeTimetableOffering(course.code, event.target.value)}>
                              <option value="">選択してください</option>
                              {sectionChoices.map((option) => (
                                <option key={option.timetableCode ?? `${option.term}:${option.slots.map((slot) => `${slot.day}${slot.period}`).join('-')}`} value={option.timetableCode ?? ''} disabled={!option.timetableCode}>
                                  {[...new Set(option.slots.map((slot) => `${slot.day}${slot.period}限`))].join('・') || '曜日時限の記載なし'}
                                  {option.term !== '前学期' && option.term !== '後学期' && `（${option.term}）`}
                                  {option.retake && '（再履修向け）'}
                                  {' / '}{option.teacher || '担当教員記載なし'}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {selectedTimetableCodes[course.code] && (
                          <button type="button" onClick={() => changeTimetableOffering(course.code, '')}>
                            セクション選択を解除
                          </button>
                        )}
                      </fieldset>
                    </li>
                  )
                })}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  )
}
