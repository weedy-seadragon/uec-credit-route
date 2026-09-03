// 科目詳細ページ（"/courses/:id"）。F-5に対応。フェーズ3以降で実装する。
//
// `useParams` はReact Routerの「フック」の1つ。URLの `:id` のような部分（パラメータ）を
// 読み取るための関数で、コンポーネントの中で呼び出すと現在のURLに応じた値が返ってくる。
// 例えば "/courses/COM405" というURLで表示されたときは `id` が "COM405" になる。
// 今はまだ「そのIDを受け取れている」ことを表示するだけの仮実装。
import { useParams } from 'react-router-dom'
import PagePlaceholder from '../components/PagePlaceholder'

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <PagePlaceholder title="科目詳細" note={`準備中（科目番号: ${id}）`} />
}
