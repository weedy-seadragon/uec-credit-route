import { defineConfig } from 'vitest/config'
import { programIndexPlugin } from './programIndexPlugin.ts'

// domain/ のロジックはDOMに依存しないので、テスト環境は node のままでよい
export default defineConfig({
  // アプリと同じく virtual:program-index（プログラム一覧）を使えるようにする
  plugins: [programIndexPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
