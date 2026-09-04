// データの保存・読み込み・全消去ページ（"/data"）。F-2b・F-8に対応。
//
// 友人アプリからの取り込み（F-2c、§7.5形式）と成績表テキスト貼り付け（F-2d）は
// 優先度Should/Couldのため、このフェーズでは対応しない（本サイト形式のJSONのみ扱う）。
import { useState } from 'react'
import type { ChangeEvent } from 'react'
import type { ExportedData } from '../domain/importers'
import { mergeRecords, parseOwnFormat } from '../domain/importers'
import { getSubjectsByCode } from '../data/requirementSets'
import { loadProfile } from '../storage/profile'
import { loadRecords, saveRecords } from '../storage/records'
import { removeFromStorage } from '../storage/localStorage'

export default function DataPage() {
  const [message, setMessage] = useState<string | null>(null)

  function handleDownload() {
    const profile = loadProfile()
    const records = loadRecords()
    const subjectsByCode = getSubjectsByCode()

    const data: ExportedData = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      profile: profile ?? undefined,
      records: [...records.entries()].map(([code, status]) => ({
        code,
        name: subjectsByCode.get(code)?.name,
        status,
      })),
      planned: [],
    }

    // ブラウザにファイルをダウンロードさせる標準的な方法：
    // 1. Blob（バイナリ/テキストデータのかたまり）を作る
    // 2. そのBlobを指すURL（一時的なもの。このタブでしか使えない）を作る
    // 3. 見えない<a>タグをその場で作ってクリックしたことにする（download属性でファイル名を指定）
    // 4. 使い終わったURLは解放する（メモリリーク防止）
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const fileNameParts = [
      'uec-credits',
      String(profile?.entryYear ?? 'unknown'),
      profile?.cluster ?? '',
      profile?.program ?? '',
      new Date().toISOString().slice(0, 10).replaceAll('-', ''),
    ].filter(Boolean)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileNameParts.join('_')}.json`
    a.click()
    URL.revokeObjectURL(url)

    setMessage('ダウンロードしました。')
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 同じファイルを続けて選んでも change イベントが発火するようにリセットする
    if (!file) return

    try {
      const text = await file.text()
      const json: unknown = JSON.parse(text)
      const imported = parseOwnFormat(json)

      const existing = loadRecords()
      const { merged, added, updated } = mergeRecords(existing, imported.records)
      saveRecords(merged)

      setMessage(`${added}件追加、${updated}件更新しました。`)
    } catch (err) {
      setMessage(`読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function handleReset() {
    if (!window.confirm('取得・不可の記録をすべて消去します。よろしいですか？（プロフィールは残ります）')) return
    removeFromStorage('records')
    setMessage('取得・不可の記録を消去しました。')
  }

  return (
    <main>
      <h1>データの保存・読み込み</h1>
      {message && <p role="status">{message}</p>}

      <section>
        <h2>ダウンロード</h2>
        <p>現在のプロフィールと履修記録を、本サイト形式のJSONファイルとして保存します。別端末で「読み込み」すれば復元できます。</p>
        <button type="button" onClick={handleDownload}>
          ダウンロード
        </button>
      </section>

      <section>
        <h2>読み込み</h2>
        <p>
          本サイト形式のJSONファイルを読み込み、既存の記録に追記します（上書きはしません。同じ科目があればファイル側の状態で更新します）。
        </p>
        <input type="file" accept="application/json" onChange={handleFileChange} />
      </section>

      <section>
        <h2>データを全消去</h2>
        <p>取得・不可の記録をすべて消します。プロフィールは残ります。</p>
        <button type="button" onClick={handleReset}>
          全消去
        </button>
      </section>
    </main>
  )
}
