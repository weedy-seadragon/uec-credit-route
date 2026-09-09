// データの出典・更新日・問い合わせ先ページ（"/about"）。
export default function AboutPage() {
  return (
    <main>
      <h1>このサイトについて</h1>

      <section>
        <h2>作成者</h2>
        <p>あず（電気通信大学 2年）</p>
      </section>

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
    </main>
  )
}
