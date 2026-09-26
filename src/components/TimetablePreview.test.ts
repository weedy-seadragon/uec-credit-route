// 時間割の表が平日だけを示し、表外の授業も見失わないことを確認する。
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TimetablePreview from './TimetablePreview'
import type { TimetablePreviewCourse } from '../domain/timetablePreview'

/** 修得見込の科目を渡し、時間割プレビューのHTMLを取得する。 */
function renderPreview(courses: readonly TimetablePreviewCourse[]): string {
  // 科目詳細へのリンクはルーターの中で描画する。
  return renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(TimetablePreview, { courses, entryYear: 2025, hasPendingChanges: false }),
  ))
}

// テスト中に差し替えたブラウザ保存領域を後続のテストへ残さない。
afterEach(() => {
  vi.unstubAllGlobals()
})

// 平日の行数、表外の科目、英語名の改行候補を検証する。
describe('TimetablePreview の表と表外一覧', () => {
  // 非表示設定の復元後は、片方のカードと重複ラベルだけが表から消える。
  it('同じ時限の片方を非表示にすると重複ラベルを出さない', () => {
    const courses = ['A', 'B'].map((code) => ({
      code, name: `講義${code}`, termType: '前学期', offeredTerms: ['前学期'],
      options: [{ term: '前学期', slots: [{ day: '金', period: 3 }] }],
    }))
    expect(renderPreview(courses)).toContain('同時限に2科目')
    vi.stubGlobal('window', { localStorage: {
      getItem: () => JSON.stringify(['B']),
    } })
    const html = renderPreview(courses)
    expect(html).not.toContain('同時限に2科目')
    expect(html).toContain('aria-label="講義A"')
    expect(html).not.toContain('aria-label="講義B"')
    expect(html).toContain('時間割に表示する科目を選ぶ（2科目）')
  })

  // 表に置く科目も欄外の科目も、折りたたみで表示を切り替えられる。
  it('選択学期の表・オンデマンド・未確定・土曜科目を切り替え欄へ並べる', () => {
    const html = renderPreview([
      { code: 'A', name: '平日科目', termType: '前学期', offeredTerms: ['前学期'], options: [{ term: '前学期', slots: [{ day: '月', period: 1 }] }] },
      { code: 'B', name: '土曜科目', termType: '前学期', offeredTerms: ['前学期'], options: [{ term: '前学期', slots: [{ day: '土', period: 2 }] }] },
      { code: 'C', name: 'オンデマンド科目', termType: '前学期', offeredTerms: ['前学期'], offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }] },
      { code: 'D', name: '未確定科目', termType: '前学期', offeredTerms: ['前学期'], options: [] },
    ])
    expect(html).toContain('時間割に表示する科目を選ぶ（4科目）')
    expect((html.match(/name="timetable-visible-[A-D]"/g) ?? [])).toHaveLength(8)
    expect((html.match(/checked=""/g) ?? [])).toHaveLength(4)
  })

  // 表示切替欄ではMainPageから受け取った学年学期表記だけを科目名に添える。
  it('受講する学年学期を科目名の横に表示する', () => {
    const html = renderPreview([
      { code: 'A', name: '年次あり', yearTermLabel: '3年次前学期', termType: '前学期', offeredTerms: ['前学期'], options: [] },
      { code: 'B', name: '年次なし', yearTermLabel: '', termType: '前学期', offeredTerms: ['前学期'], options: [] },
    ])
    expect(html).toContain('年次あり</a><span style="margin-left:0.4em">（3年次前学期）</span></legend>')
    expect(html).toContain('<a href="/courses/B?year=2025" data-discover="true">年次なし</a></legend>')
  })

  // 時限を持たない通常科目は、未確定一覧ではなく専用のリンク一覧へ出す。
  it('オンデマンド科目を表の下の別枠に表示する', () => {
    const html = renderPreview([{ code: 'OND101', name: 'オンラインの授業', termType: '前学期', offeredTerms: ['前学期'], offerings: [{ slots: [] }], options: [{ term: '前学期', slots: [] }] }])
    expect(html).toContain('オンデマンド（1科目）')
    expect(html).toContain('href="/courses/OND101?year=2025"')
    expect(html).not.toContain('曜日時限を確定できない科目（1科目）')
  })

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
    expect(html).not.toContain('（SAT101）')
  })

  // 曜日時限を決められない科目も、理由と詳細リンクを保ちつつ番号は表示しない。
  it('未確定の科目を科目名と理由だけで示す', () => {
    const html = renderPreview([{ code: 'UNP101', name: '時限未定の授業', termType: '前学期', offeredTerms: ['前学期'], options: [] }])
    expect(html).toContain('曜日時限を確定できない科目（1科目）')
    expect(html).toContain('href="/courses/UNP101?year=2025"')
    expect(html).not.toContain('（UNP101）')
  })

  // 長い英単語だけに改行用ハイフンを付け、短い英単語と日本語名は変えない。
  it('英語名の長さだけで改行候補を作り、元の科目名は保つ', () => {
    const names = [
      'Academic English for the Second YearⅡ',
      'Technical English – Intermediate English for Science',
      'Basic Course',
      'Abcdefghij',
      '計算機通論',
    ]
    const courses = names.map((name, index) => ({
      code: `A${index}`, name, termType: '前学期', offeredTerms: ['前学期'],
      options: [{ term: '前学期', slots: [{ day: '月', period: index + 1 }] }],
    }))
    const html = renderPreview(courses)
    expect(html).toContain('<span lang="en">Aca\u00ADdemic')
    expect(html).toContain('Tec\u00ADhni\u00ADcal Eng\u00ADlish – Int\u00ADerm\u00ADedi\u00ADate')
    expect(html).toContain('<span lang="en">Basic Course</span>')
    expect(html).toContain('<span lang="en">Abc\u00ADdef\u00ADghij</span>')
    expect(html).toContain('<span><span>計算機通論</span></span>')
    expect(html).toContain('aria-label="Academic English for the Second YearⅡ"')
    expect(html).toContain('href="/courses/A0?year=2025"')
    expect(html).not.toContain('<small>')
    expect(html).not.toContain('（A0）')
    expect(courses.map((course) => course.name)).toEqual(names)
  })
})
