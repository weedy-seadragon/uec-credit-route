import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pagesは https://<ユーザー名>.github.io/<リポジトリ名>/ という
// サブパスで公開される。base をリポジトリ名に合わせておかないと、
// JS/CSSファイルへのリンクがルート直下（/assets/...）を指してしまい404になる。
// HashRouter（src/App.tsx）を使っているので、base 配下のどのパスでも
// "#/main" のようなハッシュ部分だけでルーティングでき、GitHub Pages側の
// 404対応（存在しないパスへの直接アクセス）を気にする必要がない。
// https://vite.dev/config/
export default defineConfig({
  base: '/uec-credit-route/',
  plugins: [react()],
})
