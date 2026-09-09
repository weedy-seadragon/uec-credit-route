// トップページ（"/"）。説明・免責・「はじめる」ボタンを置く（docs/SPEC.md §6, §9 F-9）。
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { loadProfile } from '../storage/profile'

/**
 * 過去の更新履歴を開いて読み進めたとき、画面上部から閉じられる入れ子。
 * 見出しが画面外にある間だけボタンを出し、普段は通常のsummaryだけを使う。
 */
function ReleaseNoteHistory({ children }: { children: ReactNode }) {
  // detailsとsummaryの画面上での位置を読むため、DOM要素をrefで保持する。
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [isStickyCloseVisible, setIsStickyCloseVisible] = useState(false)

  useEffect(() => {
    // スクロール・画面サイズ・開閉に応じて、過去ログを閉じる追従操作が必要かを更新する。
    const updateVisibility = () => {
      const details = detailsRef.current
      const summary = details?.querySelector('summary')
      if (!details || !summary || !details.open) {
        setIsStickyCloseVisible(false)
        return
      }
      const summaryRect = summary.getBoundingClientRect()
      const detailsRect = details.getBoundingClientRect()
      setIsStickyCloseVisible(summaryRect.bottom < 0 && detailsRect.bottom > 0)
    }
    const details = detailsRef.current
    window.addEventListener('scroll', updateVisibility, { passive: true })
    window.addEventListener('resize', updateVisibility)
    details?.addEventListener('toggle', updateVisibility)
    updateVisibility()
    // ページ移動後も古い監視が残らないよう、部品を外すときに解除する。
    return () => {
      window.removeEventListener('scroll', updateVisibility)
      window.removeEventListener('resize', updateVisibility)
      details?.removeEventListener('toggle', updateVisibility)
    }
  }, [])

  return (
    <details ref={detailsRef} className="release-note-history">
      <summary>過去のアップデート(β版)を見る（9件）</summary>
      {children}
      {isStickyCloseVisible && (
        <button
          type="button"
          className="sticky-group-close"
          onClick={() => {
            // 閉じた後は見出しへ戻し、利用者がどの履歴を閉じたか見失わないようにする。
            const details = detailsRef.current
            const summary = details?.querySelector('summary')
            if (!details || !summary) return
            details.open = false
            summary.scrollIntoView({ block: 'start', behavior: 'smooth' })
          }}
        >
          過去のアップデート(β版)を閉じる ↑
        </button>
      )}
    </details>
  )
}

export default function TopPage() {
  // 既にプロフィール設定済みなら、トップに戻ってきたときに「続ける」で直接メイン画面に行けるようにする
  const [profile] = useState(() => loadProfile())

  return (
    <main>
      <h1>
        電通大 単位取得ルートナビ(ver.2.6) <small>最終更新日: {__BUILD_DATE__}</small>
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

      <section className="top-action-links" aria-labelledby="top-action-links-heading">
        <h2 id="top-action-links-heading">はじめる</h2>
        <div className="top-action-links-grid">
          <Link className="top-action-link" to="/setup">
            <span className="top-action-link-label">はじめて使う</span>
            <strong>プロフィール設定</strong>
            <small>{profile ? 'プロフィールを変更する場合もこちら' : '入学年度・類・プログラムを設定します'}</small>
          </Link>
          {profile ? (
            // 保存済みプロフィールがあれば、入力途中の履修状況をそのままメイン画面で続けられる。
            <Link className="top-action-link top-action-link--continue" to="/main">
              <span className="top-action-link-label">すでに入力済み</span>
              <strong>履修状況を続ける</strong>
              <small>前回の設定と入力内容を引き継ぎます</small>
            </Link>
          ) : (
            // 未設定ではメイン画面へ進めないため、同じ見た目の案内だけを表示して手順を伝える。
            <div className="top-action-link top-action-link--disabled" aria-disabled="true">
              <span className="top-action-link-label">すでに入力済み</span>
              <strong>履修状況を続ける</strong>
              <small>プロフィール設定後に利用できます</small>
            </div>
          )}
        </div>
      </section>

      <p className="official-disclaimer">
        本サイトは非公式です。学修要覧・シラバスをもとに作成していますが、最終的な卒業要件の確認は
        必ず学修要覧および教務課で行ってください。
      </p>

      {/* 利用者が今回の見た目の変更をトップページだけで確認できるよう、最新の更新内容を載せる。 */}
      <section className="release-notes-section">
        <h2>リリースノート</h2>
        {/* 正式版では、β版で行った判定・表示・操作性の改善をまとめて公開する。 */}
        <div className="release-note-entry">
          <p className="release-note-update">
            <span>・アップデート(ver.β2.6→Ver.1.0.0)</span>
            <span className="release-note-date">アップデート日 2026/9/9</span>
          </p>
          <h3 className="release-note-category">正式リリース</h3>
          <ul className="release-note-items">
            <li>β版での利用者フィードバックを反映し、電通大 単位取得ルートナビ Ver.1.0.0を正式リリースしました</li>
            <li>卒業要件の確認、履修状況の入力、不足科目・審査結果・学期別の履修候補の確認を一連の流れで行えるようにしました</li>
            <li>科目詳細から要件上の区分へ戻る導線と、トップ画面の目的別入口を追加しました</li>
          </ul>
        </div>
        {/* 2.6では、入力内容の確認・夜間主コース・開講情報の表示を中心に改善した。 */}
        <div className="release-note-entry">
          <p className="release-note-update">
            <span>・アップデート(ver.β2.5→2.6)</span>
            <span className="release-note-date">アップデート日 2026/9/9</span>
          </p>
          <h3 className="release-note-category">機能・判定の改善</h3>
          <ul className="release-note-items">
            <li>メイン画面の上部で、入学年度・コース・類・プログラム・学年を正式名称と項目名付きで確認できるようにしました</li>
            <li>入力内容を変更して未更新のとき、画面上部から更新できる追従表示を追加しました</li>
            <li>夜間主コースの輪講履修条件を、詳細を開かずに確認できるようにしました</li>
            <li>共通単位へ繰り入れられる余剰単位の扱いを分かりやすく説明しました</li>
          </ul>
          <h3 className="release-note-category">表示の改善</h3>
          <ul className="release-note-items">
            <li>夜間主コースの人文・社会科学科目で、2026年度開講なしの科目を一覧下部にまとめました</li>
            <li>情報工学工房をオンデマンドと表示せず、担当教員により開講時限が異なることを表示するようにしました</li>
            <li>リリースノートは最新情報を先に表示し、過去のβ版アップデートは折りたたんで確認できるようにしました</li>
          </ul>
        </div>
        {/* 最新版だけを最初から読めるようにし、それ以前の更新は必要なときだけ開けるようにする。 */}
        <ReleaseNoteHistory>
        {/* β2.5では、学期ごとの履修計画を立てやすくする修得推奨を追加した。 */}
        <div className="release-note-entry">
          <p className="release-note-update">
            <span>・アップデート(ver.β2.4.2→β2.5)</span>
            <span className="release-note-date">アップデート日 2026/9/9</span>
          </p>
          <h3 className="release-note-category">機能変更</h3>
          <ul className="release-note-items">
            <li>学年・学期を選ぶと、その学期に開講される修得推奨科目を確認できるようにしました</li>
            <li>未修得の必修科目、不足している選択区分、共通単位を分けて表示するようにしました</li>
            <li>不合格の科目は、必修の「再履修推奨」と選択科目の「再履修候補」を分けて表示するようにしました</li>
            <li>選択した学期より前に開講される未修得科目は、年次を示して科目説明ページへ案内するようにしました</li>
            <li>キャリア教育基礎・物理学演習第一・第二は、2年次以降の推奨候補に表示しないようにしました</li>
          </ul>
          <h3 className="release-note-category">表示の改善</h3>
          <ul className="release-note-items">
            <li>修得推奨の不足区分・共通単位・卒業研究着手審査の入れ子も、画面上部から閉じられるようにしました</li>
            <li>2年次終了時審査と卒業審査は、詳細を開かなくても不足条件を確認できるようにしました</li>
            <li>集中講義の曜日時限表示を簡潔にしました</li>
          </ul>
        </div>
        {/* β2.4.2では、長い選択科目を閉じる操作と初回表示の読み込み方を改善した。 */}
        <div className="release-note-entry">
          <p className="release-note-update">
            <span>・アップデート(ver.β2.4.1→β2.4.2)</span>
            <span className="release-note-date">アップデート日 2026/9/9</span>
          </p>
          <h3 className="release-note-category">機能変更</h3>
          <ul className="release-note-items">
            <li>長い選択科目の一覧で、見出しが画面外にあるときも画面上部から区分を閉じられるようにしました</li>
            <li>前学期・後学期・集中講義などの入れ子も、それぞれを閉じられるようにしました</li>
            <li>画面ごとのコードを必要なときに読み込むようにし、初回表示を軽くしました</li>
          </ul>
          <h3 className="release-note-category">見た目の変更</h3>
          <ul className="release-note-items">
            <li>長い一覧を読んでいる間の「閉じる」操作を、画面上部の見やすいバーとして表示するようにしました</li>
          </ul>
        </div>
        {/* β2.4.1では、単位区分の表示と時限情報を中心に、入力内容をより正確に確認できるようにした。 */}
        <div className="release-note-entry">
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
          <li>修得した単位・修得予定・不合格科目の表示順と色を見やすく調整しました</li>
          <li>開講情報が未登録の科目は曜日時限の注記を表示せず、日本文化Ｅは2026年度開講なしと分かるようにしました</li>
          <li>日本文化Ａ〜Ｅを、学期順ではなくＡ〜Ｅ順で表示するようにしました</li>
          </ul>
        </div>
        {/* β2.4では、修得予定を実績と分けて記録・見込み計算できるようにした。 */}
        <div className="release-note-entry">
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
        </div>
        {/* β2.3では、プログラム未定のままでも共通科目と進級審査を確認できるようにした。 */}
        <div className="release-note-entry">
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
        </div>
        {/* β2.21は取得単位の集計に影響するため、利用者がすぐ確認できるよう最新の先頭に置く。 */}
        <div className="release-note-entry">
          <p className="release-note-update">
          <span>・アップデート(ver.β2.2→β2.21)</span>
          <span className="release-note-date">アップデート日 2026/9/8</span>
        </p>
        <h3 className="release-note-category">機能変更</h3>
        <ul className="release-note-items">
          <li>緊急のバグ修正</li>
          <li>その他単位認定が取得単位に加算されないバグを修正しました</li>
          </ul>
        </div>
        {/* β2.2では、年度別データ対応とプロフィール・表示まわりの改善を最新情報としてまとめる。 */}
        <div className="release-note-entry">
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
        </div>
        {/* 最新の更新区分は少し大きく表示し、本文との区切りをひと目で分かるようにする。 */}
        <div className="release-note-entry">
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
        </div>
        <div className="release-note-entry">
          <p className="release-note-update">
          <span>・アップデート(β→β2)</span>
          <span className="release-note-date">アップデート日 2026/9/7</span>
        </p>
        <h3 className="release-note-category">見た目の変更</h3>
          <p className="release-note-items">サイトのデザインを一新しました</p>
        </div>
        </ReleaseNoteHistory>
        {/* 初回リリース日は更新内容と混ざらないよう、独立した枠で表示する。 */}
        <p className="release-note-initial">β版リリース 2026/9/7</p>
      </section>
    </main>
  )
}
