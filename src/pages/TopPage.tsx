// トップページ（"/"）。説明・免責・「はじめる」ボタンを置く（docs/SPEC.md §6, §9 F-9）。
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { loadProfile } from '../storage/profile'

export default function TopPage() {
  // 既にプロフィール設定済みなら、トップに戻ってきたときに「続ける」で直接メイン画面に行けるようにする
  const [profile] = useState(() => loadProfile())

  return (
    <main>
      <h1>
        電通大 単位取得ルートナビ(ver.β2.4.1) <small>最終更新日: {__BUILD_DATE__}</small>
      </h1>
      <p>
        電気通信大学 情報理工学域の学生向けに、「学年・類・プログラム・取得済み科目」を入力するだけで、
        卒業要件の充足状況と、残りの必修・区分別の不足が一目で分かるサイトです。
      </p>

      {/* サイトでできることは、項目ごとの間隔を広げてスマホでも一つずつ読みやすくする。 */}
      <ul className="top-feature-list">
        <li>入学年度・類・プログラムを選ぶと、あなたに適用される卒業要件が自動で決まります</li>
        <li>取得済みの単位の状態を修得にし、更新を押すと区分ごとの充足率がすぐに更新されます</li>
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

      {/* 利用者が今回の見た目の変更をトップページだけで確認できるよう、最新の更新内容を載せる。 */}
      <section>
        <h2>リリースノート</h2>
        {/* β2.4.1では、単位区分の表示と時限情報を中心に、入力内容をより正確に確認できるようにした。 */}
        <p className="release-note-update">
          <span>・アップデート(ver.β2.4→β2.4.1)</span>
          <span className="release-note-date">アップデート日 2026/9/8</span>
        </p>
        <h3 className="release-note-category">機能変更・修正</h3>
        <ul className="release-note-items">
          <li>共通単位について、どの科目・区分から算入されたかを確認できるようにしました</li>
          <li>他類専門科目の専門科目認定を、単位数・科目数ごとに入力できるようにしました</li>
          <li>情報通信工学プログラムの一部選択科目で、曜日時限とシラバスリンクが表示されない問題を修正しました</li>
          <li>同じ類の他プログラム科目と、他類の専門科目の扱いを分かりやすく整理しました</li>
          <li>修得予定の時限が確実に重複する場合、更新時に注意を表示するようにしました</li>
        </ul>
        {/* β2.4では、修得予定を実績と分けて記録・見込み計算できるようにした。 */}
        <p className="release-note-update">
          <span>・アップデート(ver.β2.3→β2.4)</span>
          <span className="release-note-date">アップデート日 2026/9/8</span>
        </p>
        <h3 className="release-note-category">機能変更</h3>
        <ul className="release-note-items">
          <li>科目の状態に「修得予定」を追加しました</li>
          <li>修得予定の単位を、取得単位・残りの必修・選択科目・審査の見込み計算に反映するようにしました</li>
          <li>修得予定の科目を一覧でまとめて確認・変更できるようにしました</li>
        </ul>
        <h3 className="release-note-category">見た目の変更</h3>
        <ul className="release-note-items">
          <li>修得予定による単位の増減や達成予定を、黄色で見分けやすく表示するようにしました</li>
          <li>不合格・修得予定・残りの必修の一覧を整理しました</li>
        </ul>
        {/* β2.3では、プログラム未定のままでも共通科目と進級審査を確認できるようにした。 */}
        <p className="release-note-update">
          <span>・アップデート(ver.β2.21→β2.3)</span>
          <span className="release-note-date">アップデート日 2026/9/8</span>
        </p>
        <h3 className="release-note-category">機能変更</h3>
        <ul className="release-note-items">
          <li>プログラムが未定でも、共通科目・類共通基礎・2年次終了時審査を確認できるようになりました</li>
          <li>プログラムを選択すると表示される科目・審査を、画面上で分かりやすく案内するようにしました</li>
          <li>コースを切り替えたときに科目が表示されなくなる不具合を修正しました</li>
        </ul>
        <h3 className="release-note-category">見た目の変更</h3>
        <ul className="release-note-items">
          <li>プロフィール、科目一覧、審査詳細の表示を見やすく調整しました</li>
          <li>曜日時限の表示場所を変更しました</li>
        </ul>
        {/* β2.21は取得単位の集計に影響するため、利用者がすぐ確認できるよう最新の先頭に置く。 */}
        <p className="release-note-update">
          <span>・アップデート(ver.β2.2→β2.21)</span>
          <span className="release-note-date">アップデート日 2026/9/8</span>
        </p>
        <h3 className="release-note-category">機能変更</h3>
        <ul className="release-note-items">
          <li>緊急のバグ修正</li>
          <li>その他単位認定が取得単位に加算されないバグを修正しました</li>
        </ul>
        {/* β2.2では、年度別データ対応とプロフィール・表示まわりの改善を最新情報としてまとめる。 */}
        <p className="release-note-update">
          <span>・アップデート(β2.1→β2.2)</span>
          <span className="release-note-date">アップデート日 2026/9/8</span>
        </p>
        <h3 className="release-note-category">機能変更</h3>
        <ul className="release-note-items">
          <li>2026年度入学生向けの卒業要件・科目データに対応しました</li>
          <li>プロフィールで、学年にかかわらず進学予定のプログラムを選べるようにしました</li>
          <li>科目の曜日時限・シラバスリンクの表示を改善しました</li>
          <li>その他細かな修正を行いました</li>
        </ul>
        <h3 className="release-note-category">見た目の変更</h3>
        <ul className="release-note-items">
          <li>取得単位・審査結果・科目一覧の表示を調整しました</li>
        </ul>
        {/* 最新の更新区分は少し大きく表示し、本文との区切りをひと目で分かるようにする。 */}
        <p className="release-note-update">
          <span>・アップデート(β2→β2.1)</span>
          <span className="release-note-date">アップデート日 2026/9/8</span>
        </p>
        {/* 同じ意味の「不要な記述」の報告は一つにまとめ、今回の更新内容を読みやすく列挙する。 */}
        <h3 className="release-note-category">機能変更</h3>
        <ul className="release-note-items">
          <li>取得単位数にその他認定単位が含まれない不具合を修正しました</li>
          <li>英語科目のリンク先を調整しました</li>
          <li>卒業研究・輪講がオンデマンドと表示される問題を修正しました</li>
          <li>その他細かな修正を行いました</li>
        </ul>
        <h3 className="release-note-category">見た目の変更</h3>
        <ul className="release-note-items">
          <li>レイアウトの調整を行いました</li>
          <li>不要な記述を削除しました</li>
        </ul>
        <p className="release-note-update">
          <span>・アップデート(β→β2)</span>
          <span className="release-note-date">アップデート日 2026/9/7</span>
        </p>
        <h3 className="release-note-category">見た目の変更</h3>
        <p className="release-note-items">サイトのデザインを一新しました</p>
        {/* 初回リリース日は更新内容と混ざらないよう、独立した枠で表示する。 */}
        <p className="release-note-initial">β版リリース 2026/9/7</p>
      </section>
    </main>
  )
}
