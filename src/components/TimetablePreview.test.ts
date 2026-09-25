// 時間割の表が平日だけを示し、表外の授業も見失わないことを確認する。
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import TimetablePreview from './TimetablePreview'
import type { TimetablePreviewCourse } from '../domain/timetablePreview'

/** 修得見込の科目を渡し、時間割プレビューのHTMLを取得する。 */
function renderPreview(courses: readonly TimetablePreviewCourse[]): string {
  // 科目詳細へのリンクはルーターの中で描画する。
  return renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(TimetablePreview, { courses, entryYear: 2025, hasPendingChanges: false }),
  ))
}

// 平日の行数、表外の科目、英語名の改行候補を検証する。
describe('TimetablePreview の表と表外一覧', () => {
  // 平日に7限があれば、授業のない6限も含めて連続した行を出す。
  it('平日の7限に合わせて6・7限を表示し、土曜の列を作らない', () => {
    const html = renderPreview([{ code: 'A', name: '夜の授業', termType: '前学期', offeredTerms: ['前学期'], options: [
      { term: '前学期', slots: [{ day: '金', period: 7 }] },
    ] }])
    expect(html).toContain('<th scope="row">6限</th>')
    expect(html).toContain('<th scope="row">7限</th>')
    expect(html).not.toContain('<th scope="col">土</th>')
  })

  // 土曜の6・7限だけなら平日の行は増やさず、科目は1件の一覧に残す。
  it('土曜だけの科目を曜日時限とリンク付きで表の下へ示す', () => {
    const html = renderPreview([{ code: 'SAT101', name: '土曜の授業', termType: '前学期', offeredTerms: ['前学期'], options: [
      { term: '前学期', slots: [{ day: '土', period: 6 }, { day: '土', period: 7 }] },
    ] }])
    expect(html).toContain('<th scope="row">5限</th>')
    expect(html).not.toContain('<th scope="row">6限</th>')
    expect(html).not.toContain('<th scope="row">7限</th>')
    expect(html).toContain('土曜などの授業（1科目）')
    expect(html).toContain('土6限、土7限')
    expect(html).toContain('href="/courses/SAT101?year=2025"')
  })

  // 英語名だけに言語を付け、ハイフン付き改行を使える状態にする。
  it('英語の科目名だけに英語の言語指定を付ける', () => {
    const names = [
      'Academic English for the Second YearⅡ',
      'Technical English – Intermediate English for Science',
      '計算機通論',
    ]
    const courses = names.map((name, index) => ({
      code: `A${index}`, name, termType: '前学期', offeredTerms: ['前学期'],
      options: [{ term: '前学期', slots: [{ day: '月', period: index + 1 }] }],
    }))
    const html = renderPreview(courses)
    expect(html).toContain('<span lang="en">Aca\u00ADdemic')
    expect(html).toContain('Tec\u00ADhni\u00ADcal Eng\u00ADlish – Int\u00ADerm\u00ADedi\u00ADate')
    expect(html).not.toContain('<span lang="en">計算機通論</span>')
    expect(html).toContain('aria-label="Academic English for the Second YearⅡ（A0）"')
    expect(html).toContain('href="/courses/A0?year=2025"')
    expect(courses.map((course) => course.name)).toEqual(names)
  })
})
