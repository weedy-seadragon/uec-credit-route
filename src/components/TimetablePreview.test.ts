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

// 平日の行数と、土曜などグリッド外の科目一覧を検証する。
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
})
