/// <reference types="vite/client" />

// vite.config.ts の define で埋め込んだビルド日付。
// TypeScriptにとっては「どこかで定義されているはずの変数」として扱われるので、
// この宣言（実体を持たない型だけの宣言）が無いとコンパイルエラーになる
declare const __BUILD_DATE__: string
