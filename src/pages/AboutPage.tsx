// データの出典・更新日・問い合わせ先ページ（"/about"）。
import { useRef, useState } from 'react'

// 不具合を再現するために必要な情報を、報告者が埋めるだけで送れる形にまとめる。
const ISSUE_REPORT_TEMPLATE = `【不具合報告】
プロフィール：入学年度 / コース / 類 / プログラム / 学年
画面・URL：
科目名・科目番号：
行った操作：
期待する表示：
実際の表示：
スクリーンショット（あれば）：`

/** 不具合報告をコピーしやすくする、問い合わせ前の補助部品。 */
function IssueReportTemplate() {
  // コピーに失敗した場合でも、テキスト欄を手動で選択してコピーできるよう参照を持つ。
  const templateRef = useRef<HTMLTextAreaElement>(null)
  const [copyMessage, setCopyMessage] = useState('')

  async function handleCopy(): Promise<void> {
    try {
      // 標準のクリップボード機能が使える環境では、テキスト欄を操作せずそのままコピーする。
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ISSUE_REPORT_TEMPLATE)
        setCopyMessage('コピーしました。内容を埋めてお送りください。')
        return
      }
    } catch {
      // 権限が拒否された場合も、下の従来方式でコピーできる可能性があるため続ける。
    }

    // 古いブラウザなどでは、欄を選択してから従来方式でコピーを試す。
    templateRef.current?.select()
    const copied = document.execCommand('copy')
    setCopyMessage(copied ? 'コピーしました。内容を埋めてお送りください。' : 'コピーできませんでした。欄を選択してコピーしてください。')
  }

  return (
    <section className="issue-report-template" aria-labelledby="issue-report-template-heading">
      <h3 id="issue-report-template-heading">不具合報告テンプレート</h3>
      <p>不具合のときは、分かる範囲で以下を埋めてお送りください。</p>
      <textarea ref={templateRef} readOnly value={ISSUE_REPORT_TEMPLATE} aria-label="不具合報告テンプレート" />
      <p>
        <button type="button" onClick={handleCopy}>テンプレートをコピー</button>
        {copyMessage && <span className="issue-report-copy-message" role="status">{copyMessage}</span>}
      </p>
    </section>
  )
}

export default function AboutPage() {
  return (
    <main className="about-page">
      <h1>このサイトについて</h1>

      {/* 非公式サイトとして、何の公式資料をどの年度基準で反映しているかを問い合わせ先の前で明示する。 */}
      <section className="about-data-status">
        <h2>最終データ更新</h2>
        <dl>
          <div>
            <dt>卒業要件データ</dt>
            <dd>2026年度要覧確認済み</dd>
          </div>
          <div>
            <dt>開講情報</dt>
            <dd>2026年度シラバス基準</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2>不具合・要望など</h2>
        <IssueReportTemplate />
        <p>こちらのアカウントまでご連絡お願いいたします</p>
        <ul>
          <li>
            Twitter：
            <a href="https://x.com/weed_cdragon" target="_blank" rel="noopener noreferrer">
              https://x.com/weed_cdragon
            </a>
          </li>
          <li>
            マシュマロ：
            <a
              href="https://marshmallow-qa.com/cp5av4v3tjwji1i?t=ucI2T6&utm_medium=url_text&utm_source=promotion"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://marshmallow-qa.com/cp5av4v3tjwji1i
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2>このサイトを作成した目的</h2>
        <ul>
          <li>学修要覧が分厚すぎて読むのに抵抗がある</li>
          <li>結局何の科目取れば卒業できるのかわからない</li>
          <li>2年時審査とか卒研着手とか大丈夫か不安</li>
        </ul>
        <p>
          こんな気持ちの人たちの助けになれればという思いで作成いたしました。
          大変と言われる事が多い電気通信大学の大学生活の中、少しでも学生の負担が減らせたらいいなと思っています。
        </p>
      </section>

      {/* サイトの目的を読んだ後に、制作担当を簡潔に確認できる順番で置く。 */}
      <section>
        <h2>サイト制作</h2>
        <p className="creator-credit"><span>あず</span><span>（電気通信大学 学部2年）</span></p>
      </section>

      {/* 制作担当の情報と分けて、アイコンイラストの担当者を後から記載できるようにする。 */}
      <section>
        <h2>アイコンのイラスト制作</h2>
        <p className="creator-credit"><span>マシーン・ヨーテボリ</span><span>（明治大学 学部2年）</span></p>
      </section>

      {/* β版の動作確認や改善提案に協力した人の名前を、後から追記できるようにする。 */}
      <section>
        <h2>βテスト協力者一覧（50音順、敬称略）</h2>
        <ul className="beta-testers">
          <li><span>かわせみ</span><span>（電気通信大学 学部2年）</span></li>
          <li><span>グオポン</span><span>（電気通信大学 学部2年）</span></li>
          <li><span>こうちゃ</span><span>（電気通信大学 学部2年）</span></li>
          <li><span>サンバ</span><span>（電気通信大学 学部2年）</span></li>
          <li><span>柴犬被り</span><span>（電気通信大学 学部2年）</span></li>
          <li><span>トラマト</span><span>（電気通信大学 学部2年）</span></li>
          <li><span>のみのみあのみ</span><span>（電気通信大学 学部2年）</span></li>
          <li><span>匿名（1名）</span><span>（電気通信大学 学部2年）</span></li>
        </ul>
        <p>本当にありがとうございました！</p>
      </section>
    </main>
  )
}
