import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// GitHub ActionsなどUTCで動く環境でも、利用者に表示する更新日は日本時間でそろえる。
const buildDateInJapan = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())

// サイトのバージョン表記はここ1箇所だけを書き換えれば、トップ画面の見出し・タブのタイトル・
// SNS共有カードの3箇所すべてに反映される（以前はindex.htmlとTopPage.tsxに別々に書いていて、
// index.html側の更新を忘れて古いバージョンのまま放置されていたことがあった。2026-09-17）。
const SITE_VERSION = '1.1.5'

// index.htmlの中の %SITE_VERSION% という文字列を、上のSITE_VERSIONへ置き換えるだけの
// 小さなプラグイン。defineはJS/TSXの中でしか使えない（index.htmlはJSとして処理されない）ため、
// index.html側だけはこの仕組みで別途埋め込む。
function siteVersionHtmlPlugin(): Plugin {
  return {
    name: 'site-version-html',
    transformIndexHtml(html) {
      return html.replaceAll('%SITE_VERSION%', SITE_VERSION)
    },
  }
}

// GitHub Pagesは https://<ユーザー名>.github.io/<リポジトリ名>/ という
// サブパスで公開される。base をリポジトリ名に合わせておかないと、
// JS/CSSファイルへのリンクがルート直下（/assets/...）を指してしまい404になる。
// HashRouter（src/App.tsx）を使っているので、base 配下のどのパスでも
// "#/main" のようなハッシュ部分だけでルーティングでき、GitHub Pages側の
// 404対応（存在しないパスへの直接アクセス）を気にする必要がない。
// https://vite.dev/config/
export default defineConfig({
  base: '/uec-credit-route/',
  plugins: [react(), siteVersionHtmlPlugin()],
  // ビルド時点の日付を文字列としてコードに埋め込む（トップページの「最終更新日」表示に使う）。
  // define に書いた値は、ビルド時にコード中の同名の識別子（__BUILD_DATE__）へそのまま置き換えられる。
  // GitHub Actionsはmainへのpushのたびにビルドし直すので、これがそのままサイトの最終更新日になる
  define: {
    __BUILD_DATE__: JSON.stringify(buildDateInJapan),
    __SITE_VERSION__: JSON.stringify(SITE_VERSION),
  },
})
