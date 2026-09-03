// まだ中身を作っていないページ用の共通プレースホルダー。
// 各ページのファイルがこれを表示している間は「準備中」ということ。
// 実装する段になったら、そのページのファイルから直接JSXを書くように置き換える。

interface PagePlaceholderProps {
  title: string
  note: string
}

export default function PagePlaceholder({ title, note }: PagePlaceholderProps) {
  return (
    <main>
      <h1>{title}</h1>
      <p>{note}</p>
    </main>
  )
}
