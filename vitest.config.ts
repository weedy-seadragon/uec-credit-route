import { defineConfig } from 'vitest/config'

// domain/ のロジックはDOMに依存しないので、テスト環境は node のままでよい
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
