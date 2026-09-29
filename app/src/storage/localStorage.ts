// ブラウザの localStorage を安全に読み書きするための薄いラッパー。
//
// なぜ薄いラッパーを挟むか：
// - プライベートブラウジングやストレージ容量オーバーだと localStorage への
//   アクセス自体が例外を投げることがある。呼び出すたびに try/catch を書くのは
//   面倒なので、ここに1回だけ書いておく
// - 保存する値はJSONの文字列だが、呼び出し側では「型が付いたデータ」として
//   扱いたい。JSON.parse / JSON.stringify の変換もここに閉じ込める
//
// このファイルはプロフィールや履修状況の「保存の仕方」だけを知っていて、
// 「何を保存するか」（具体的なデータの形）は知らない。具体的な形は、
// このあとのフェーズで各ページ側が決める。

/**
 * 他のアプリと衝突しないよう、キーの先頭に付ける名前空間。
 * 例: 'profile' というキーで保存すると、実際には 'uec-credit-route:profile' として保存される。
 */
const STORAGE_PREFIX = 'uec-credit-route:'

/**
 * 指定したキーの値を読み込む。
 *
 * `<T>` はTypeScriptの「ジェネリクス」で、C++のテンプレート引数に近いもの。
 * `loadFromStorage<Profile>('profile')` のように呼び出し側が型を指定すると、
 * 戻り値が `Profile | undefined` として扱われる（実際に正しい形かはTypeScriptには
 * わからないので、あくまで「呼び出し側がそう約束する」という程度の安全性）。
 *
 * 値が無い場合・JSONとして壊れている場合は undefined を返す。
 * 呼び出し側でこれを見て、デフォルト値を使うかどうかを決める。
 */
export function loadFromStorage<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key)
    if (raw === null) return undefined
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

/**
 * 指定したキーに値を保存する。
 * 保存に失敗しても（容量オーバーなど）例外は投げず、静かに諦める。
 * 「保存できないこと」自体はエラーだが、アプリの他の機能まで止める必要はないため。
 */
export function saveToStorage<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    // 保存できなくても致命的ではないので何もしない
  }
}

/** 指定したキーの値を削除する（F-8「データを全消去」などで使う想定） */
export function removeFromStorage(key: string): void {
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + key)
  } catch {
    // 削除できなくても致命的ではないので何もしない
  }
}
