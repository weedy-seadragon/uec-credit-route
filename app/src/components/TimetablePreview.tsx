// 修得見込の科目を開講期ごとに並べる週間時間割。表示設定だけを保存し、履修記録は変更しない。
import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { buildTimetablePreview, buildVisibleTimetablePreview, defaultRetakeOptionForTerm, maxConcurrentOfferingCount, previewSemesterOf, splitUnplacedTimetableCourses, TIMETABLE_UNPLACED_REASON_LABELS, timetableCategoryColorsForCourses, timetableLegendForSlots } from '../domain/timetablePreview'
import type { TimetablePreviewCourse, TimetablePreviewOption, TimetablePreviewSlot } from '../domain/timetablePreview'
import { loadHiddenTimetableCourses, saveHiddenTimetableCourses } from '../storage/timetableVisibility'
import { loadTimetableOfferingSelection, saveTimetableOfferingSelection } from '../storage/timetableOfferingSelection'
import { lastPreviewYear, placementIncludesPeriod, previewPeriodsFrom, resolveTimetablePlacement, timetablePlacementChoices, timetablePlacementKey } from '../domain/timetablePlacement'
import type { PreviewPeriod, TimetablePlacement } from '../domain/timetablePlacement'
import { loadTimetablePlacementOverrides, saveTimetablePlacementOverrides } from '../storage/timetablePlacementOverrides'

/** グリッドに表示する平日。土曜などの授業は表の下にまとめる。 */
const DAYS: readonly string[] = ['月', '火', '水', '木', '金']
const INTENSIVE_LABELS = {
  'summer-intensive': '夏期集中',
  'winter-intensive': '冬期集中',
  intensive: '集中講義',
} as const

/** 時期（学年・学期、通年なら学年だけ）を「3年前学期」「2年通年」の形で表示する。 */
function placementLabel(placement: TimetablePlacement): string {
  return `${placement.year}年${placement.half ?? '通年'}`
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
      aria-label={`${slot.name}${slot.topic ? `（${slot.topic}）` : ''}${slot.condition ? `（${slot.condition}）` : ''}`}
      to={`/courses/${encodeURIComponent(slot.code)}?year=${entryYear}`}
    >
      {category?.isRequired && <span className="timetable-required-badge" aria-hidden="true">必修</span>}
      <span><span lang={englishName ? 'en' : undefined}>{englishName ? hyphenateEnglishName(slot.name) : slot.name}</span>{slot.topic && `（${slot.topic}）`}{slot.condition && `（${slot.condition}）`}{slot.offeringTerm !== '前学期' && slot.offeringTerm !== '後学期' && `（${slot.offeringTerm}）`}</span>
    </Link>
  )
}

/** 曜日・時限が確定した科目を表に置き、未確定の科目を表の下へ示す。 */
export default function TimetablePreview({ courses, entryYear, currentPeriod, hasPendingChanges, sectionOpen, onSectionToggle }: {
  courses: readonly TimetablePreviewCourse[]
  entryYear: number
  /** プロフィールの学年と、日付から判定した現在の学期。最初に表示する時期になる。 */
  currentPeriod: PreviewPeriod
  hasPendingChanges: boolean
  sectionOpen: boolean
  onSectionToggle: (event: MouseEvent<HTMLElement>) => void
}) {
  const [periodKey, setPeriodKey] = useState(() => timetablePlacementKey(currentPeriod))
  const [hiddenCodes, setHiddenCodes] = useState<ReadonlySet<string>>(() => loadHiddenTimetableCourses())
  const [selectedTimetableCodes, setSelectedTimetableCodes] = useState<Readonly<Record<string, string>>>(() => loadTimetableOfferingSelection())
  const [placementOverrides, setPlacementOverrides] = useState<Readonly<Record<string, string>>>(() => loadTimetablePlacementOverrides())
  // 科目ごとに受ける時期（学年・学期）を決める。利用者が選んだ時期があればそれを優先する。
  const placementByCode = new Map(courses.map((course) => [
    course.code,
    resolveTimetablePlacement(course, currentPeriod, placementOverrides[course.code], selectedTimetableCodes[course.code]),
  ]))
  // 選べる時期は現在の学期から4年後学期まで（5年目に回る科目があればそこまで）。
  const previewPeriods = previewPeriodsFrom(currentPeriod, lastPreviewYear([...placementByCode.values()]))
  const selectedPeriod = previewPeriods.find((candidate) => timetablePlacementKey(candidate) === periodKey) ?? previewPeriods[0]
  const term = selectedPeriod.half
  /** 指定した時期に置かれる科目を返す。時期の選択肢に添える科目数にも使う。 */
  function coursesInPeriod(target: PreviewPeriod): TimetablePreviewCourse[] {
    // 置き場所はcoursesから作っているので必ず見つかるが、型の都合でundefinedも確認する。
    return courses.filter((course) => {
      const placement = placementByCode.get(course.code)
      return placement !== undefined && placementIncludesPeriod(placement, target)
    })
  }
  const periodCourses = coursesInPeriod(selectedPeriod)
  const allCoursesResult = buildTimetablePreview(periodCourses, term, selectedTimetableCodes)
  const result = buildVisibleTimetablePreview(periodCourses, term, hiddenCodes, selectedTimetableCodes)
  const { selectable: selectableCourses, timeless: timelessCourses } = splitUnplacedTimetableCourses(result.unplaced)
  const allCategoryColors = timetableCategoryColorsForCourses(courses)
  const categoryLegend = timetableLegendForSlots(result.slots.filter((slot) => DAYS.includes(slot.day)), allCategoryColors)
  const colorIndexByCategory = new Map<string, number>()
  // 必修以外は、現在の表に表示されるカテゴリ色をカードへ引き継ぐ。
  for (const category of allCategoryColors) {
    if (category.colorIndex !== undefined) colorIndexByCategory.set(category.key, category.colorIndex)
  }
  // 選択した開講期の科目を、非表示中のものも含めて設定欄へ残す。
  const termCourseCodes = new Set([
    ...allCoursesResult.slots.map((slot) => slot.code),
    ...allCoursesResult.onDemand.map((course) => course.code),
    ...allCoursesResult.intensive.map((course) => course.code),
    ...allCoursesResult.unplaced.map((course) => course.code),
    ...periodCourses.filter((course) => course.sections?.some((section) => section.topic && previewSemesterOf(section.term) === term)).map((course) => course.code),
  ])
  const termCourses = periodCourses.filter((course) => termCourseCodes.has(course.code))

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
  /** 科目を受ける時期の選択をすぐ反映し、プレビュー専用の設定として保存する。 */
  function changePlacement(code: string, placementKey: string): void {
    const next = { ...placementOverrides }
    // 空欄（自動）は保存対象から外し、自動で決まる時期に戻す。
    if (placementKey) next[code] = placementKey
    else delete next[code]
    setPlacementOverrides(next)
    saveTimetablePlacementOverrides(next)
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
    <details id="timetable-preview" className="requirement-section timetable-preview-section main-collapsible-section" open={sectionOpen}>
      <summary onClick={onSectionToggle}><h2>時間割プレビュー</h2></summary>
      <p className="section-guidance">
        「修得見込」の科目を表示します。科目の変更はすぐに反映されます。
        {hasPendingChanges && ' 未更新の変更を保存するには「単位取得状況を更新」を押してください。'}
      </p>
      <label className="timetable-term-label" htmlFor="timetable-preview-term">
        時期
        <select id="timetable-preview-term" value={timetablePlacementKey(selectedPeriod)} onChange={(event) => setPeriodKey(event.target.value)}>
          {/* 現在の学期に印を付け、各時期に置かれた科目数を添える。 */}
          {previewPeriods.map((option) => {
            const key = timetablePlacementKey(option)
            return (
              <option key={key} value={key}>
                {placementLabel(option)}{key === timetablePlacementKey(currentPeriod) && '（現在）'}（{coursesInPeriod(option).length}科目）
              </option>
            )
          })}
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
          <div className="timetable-scroll" role="region" aria-label={`${placementLabel(selectedPeriod)}の時間割`} tabIndex={0}>
            <table className="timetable-grid">
              <caption>{placementLabel(selectedPeriod)}の週間時間割</caption>
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
                      {slots[0].name}{slots[0].topic && `（${slots[0].topic}）`}{slots[0].offeringTerm !== '前学期' && slots[0].offeringTerm !== '後学期' && `（${slots[0].offeringTerm}）`}
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
                    <Link to={`/courses/${encodeURIComponent(course.code)}?year=${entryYear}`}>{course.name}{course.topic && `（${course.topic}）`}</Link>
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
                    <Link to={`/courses/${encodeURIComponent(course.code)}?year=${entryYear}`}>{course.name}{course.topic && `（${course.topic}）`}</Link>
                    {' '}（{INTENSIVE_LABELS[course.kind]}）
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.slots.length === 0 && result.unplaced.length === 0 && result.onDemand.length === 0 && result.intensive.length === 0 && (
            <p className="section-guidance">この時期に表示中の修得見込科目はありません。</p>
          )}
          {selectableCourses.length > 0 && (
            <div className="timetable-unplaced">
              <h3>曜日時限を選んでください（{selectableCourses.length}科目）</h3>
              <p className="section-guidance">候補からセクションを選ぶと、曜日時限が時間割へ反映されます。</p>
              <ul>
                {selectableCourses.map((course) => (
                  <li key={course.code}>
                    <Link to={`/courses/${encodeURIComponent(course.code)}?year=${entryYear}`}>{course.name}{course.topic && `（${course.topic}）`}</Link>
                    {' '}：{TIMETABLE_UNPLACED_REASON_LABELS[course.reason]}
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
                              {timetableOptionLabel(option)}
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
                    <Link to={`/courses/${encodeURIComponent(course.code)}?year=${entryYear}`}>{course.name}{course.topic && `（${course.topic}）`}</Link>
                    {' '}：{TIMETABLE_UNPLACED_REASON_LABELS[course.reason]}
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
                    if (!section.topic && previewSemesterOf(section.term) !== term) continue
                    const sectionKey = section.timetableCode ?? `${section.term}:${section.slots.map((slot) => `${slot.day}${slot.period}`).join('-')}`
                    if (!sectionByCode.has(sectionKey)) sectionByCode.set(sectionKey, section)
                  }
                  const sectionChoices = [...sectionByCode.values()]
                  const savedCode = selectedTimetableCodes[course.code]
                  const hasSavedChoice = sectionChoices.some((section) => section.timetableCode === savedCode)
                  const defaultRetake = defaultRetakeOptionForTerm(course, term)
                  const sectionValue = hasSavedChoice ? savedCode ?? '' : defaultRetake?.timetableCode ?? ''
                  const canChangeSection = sectionChoices.length > 1 && (hasSavedChoice || Boolean(defaultRetake))
                  // 上書きが無いときに自動で決まる時期と、それ以外に選べる時期（自動と同じ時期は「自動」の行と重複するので除く）。
                  const autoPlacement = resolveTimetablePlacement(course, currentPeriod, undefined, savedCode)
                  const otherPlacementChoices = timetablePlacementChoices(course, currentPeriod, savedCode)
                    .filter((choice) => timetablePlacementKey(choice) !== timetablePlacementKey(autoPlacement))
                  const savedPlacement = placementOverrides[course.code]
                  // 保存値が自動と同じ時期・選べない時期なら、「自動」の行を選択中として表示する。
                  const placementValue = otherPlacementChoices.some((choice) => timetablePlacementKey(choice) === savedPlacement) ? savedPlacement : ''
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
                        {/* 自動以外の時期を選べる科目だけ、受ける時期の選択欄を出す（自動の時期を初期値として示す）。 */}
                        {otherPlacementChoices.length > 0 && (
                          <label className="timetable-section-choice">
                            {' '}受ける時期
                            <select aria-label={`${course.name}を受ける時期`} value={placementValue} onChange={(event) => changePlacement(course.code, event.target.value)}>
                              <option value="">{placementLabel(autoPlacement)}（自動）</option>
                              {otherPlacementChoices.map((choice) => (
                                <option key={timetablePlacementKey(choice)} value={timetablePlacementKey(choice)}>{placementLabel(choice)}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        {canChangeSection && (
                          <label className="timetable-section-choice">
                            {' '}セクション
                            <select aria-label={`${course.name}のセクション`} value={sectionValue} onChange={(event) => changeTimetableOffering(course.code, event.target.value)}>
                              <option value="">選択してください</option>
                              {sectionChoices.map((option) => (
                                <option key={option.timetableCode ?? `${option.term}:${option.slots.map((slot) => `${slot.day}${slot.period}`).join('-')}`} value={option.timetableCode ?? ''} disabled={!option.timetableCode}>
                                  {timetableOptionLabel(option)}
                                  {(option.topic || (option.term !== '前学期' && option.term !== '後学期')) && `（${option.term}）`}
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
    </details>
  )
}

/** テーマの候補には、授業名と選択時に確認できる曜日時限または実施形態を付ける。 */
function timetableOptionLabel(option: TimetablePreviewOption): string {
  const slots = [...new Set(option.slots.map((slot) => `${slot.day}${slot.period}限`))].join('・')
  if (option.topic) {
    // 開講期が異なるテーマでも、内容と実施形態を同時に見分けられるようにする。
    if (slots) return `${option.topic}（${slots}）`
    return option.topic.includes('集中') ? option.topic : `${option.topic}（時限なし）`
  }
  // 学籍番号は保存せず、公式時間割に書かれた条件を候補の直後へ表示する。
  const slotLabel = slots || '曜日時限の記載なし'
  return option.condition ? `${slotLabel}（${option.condition}）` : slotLabel
}
