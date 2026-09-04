// データの全消去ページ（"/data"）。F-8に対応。
//
// ダウンロード・読み込みは、より使う場面が近いメイン画面（/main）の
// 表示フィルタ・更新ボタンの並びに移動した。ここでは「全消去」だけを扱う。
import { useState } from 'react'
import { removeFromStorage } from '../storage/localStorage'

export default function DataPage() {
  const [message, setMessage] = useState<string | null>(null)

  function handleReset() {
    if (!window.confirm('取得・不可の記録をすべて消去します。よろしいですか？（プロフィールは残ります）')) return // キャンセルなら何もしない
    removeFromStorage('records')
    setMessage('取得・不可の記録を消去しました。')
  }

  return (
    <main>
      <h1>データの全消去</h1>
      {message && <p role="status">{message}</p>}

      <section>
        <h2>データを全消去</h2>
        <p>取得・不可の記録をすべて消します。プロフィールは残ります。</p>
        <p>ダウンロード・読み込みはメイン画面の上部（表示・更新の隣）から行えます。</p>
        <button type="button" onClick={handleReset}>
          全消去
        </button>
      </section>
    </main>
  )
}
