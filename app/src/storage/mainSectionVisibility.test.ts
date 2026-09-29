// 大見出しの開閉を保存し、目次移動では閉じた区切りが開くことを検証する。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_OPEN_MAIN_SECTION_IDS, loadOpenMainSections, openMainSectionForNavigation, saveOpenMainSections } from './mainSectionVisibility'

// テスト用に差し替えたwindowを後続のテストへ残さない。
afterEach(() => {
  vi.unstubAllGlobals()
})

// 表示設定の復元と、区切り移動用の開閉状態を確認する。
describe('メイン画面の区切り表示設定', () => {
  // 初回は全区切りを開き、変更後はユーザーの表示設定だけを年度共通で保存する。
  it('初期値はすべて開いていて、変更後の区切り状態を年度共通で保存する', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    } })
    expect([...loadOpenMainSections()]).toEqual(DEFAULT_OPEN_MAIN_SECTION_IDS)
    saveOpenMainSections(new Set(['earned-credits', 'elective-subjects']))
    expect(values.get('uec-credit-route:mainOpenSections')).toBe('["earned-credits","elective-subjects"]')
    expect([...loadOpenMainSections()]).toEqual(['earned-credits', 'elective-subjects'])
  })

  // JSONとして読めても期待する配列でなければ、全区切りを開いた初期状態へ戻す。
  it('壊れた保存値は既定の開いた状態にする', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => '{"open":true}' } })
    expect([...loadOpenMainSections()]).toEqual(DEFAULT_OPEN_MAIN_SECTION_IDS)
  })

  // 目次・URLから区切りへ移動するとき、閉じた区切りを開く状態へ更新する。
  it('目次から指定された区切りを開く', () => {
    const opened = openMainSectionForNavigation(new Set(['earned-credits']), 'remaining-required')
    expect(opened.has('remaining-required')).toBe(true)
    expect(opened.has('earned-credits')).toBe(true)
  })

  // localStorageが利用できなくても、全区切りを開いた初期状態から表示を続ける。
  it('ストレージの読み書き例外を画面へ伝播させない', () => {
    vi.stubGlobal('window', { localStorage: {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    } })
    expect([...loadOpenMainSections()]).toEqual(DEFAULT_OPEN_MAIN_SECTION_IDS)
    expect(() => saveOpenMainSections(new Set(['earned-credits']))).not.toThrow()
  })
})
