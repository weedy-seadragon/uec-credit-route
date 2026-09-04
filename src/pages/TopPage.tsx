// トップページ（"/"）。説明・免責・「はじめる」ボタンを置く（docs/SPEC.md §6, §9 F-9）。
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { loadProfile } from '../storage/profile'

export default function TopPage() {
  // 既にプロフィール設定済みなら、トップに戻ってきたときに「続ける」で直接メイン画面に行けるようにする
  const [profile] = useState(() => loadProfile())

  return (
    <main>
      <h1>電通大 単位取得ルートナビ</h1>
      <p>
        電気通信大学 情報理工学域の学生向けに、「学年・類・プログラム・取得済み科目」を入力するだけで、
        卒業要件の充足状況と、残りの必修・区分別の不足が一目で分かるサイトです。
      </p>

      <ul>
        <li>入学年度・類・プログラムを選ぶと、あなたに適用される卒業要件が自動で決まります</li>
        <li>取得済み科目をチェックすると、区分ごとの充足率がすぐに更新されます</li>
        <li>あと何単位・どの科目が足りないかを、必修から順に並べて表示します</li>
        <li>入力した内容はブラウザ内にのみ保存され、外部には送信されません</li>
      </ul>

      <p>
        {profile ? (
          <>
            <Link to="/main">続ける</Link>（前回の設定を引き継ぎます）／<Link to="/setup">設定を変更</Link>
          </>
        ) : (
          <Link to="/setup">はじめる</Link>
        )}
      </p>

      <p>
        本サイトは非公式です。学修要覧・シラバスをもとに作成していますが、最終的な卒業要件の確認は
        必ず学修要覧および教務課で行ってください。
      </p>
    </main>
  )
}
