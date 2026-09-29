// 類・プログラム別の固定ページ（"/route/:year/:cls/:prog"）。F-9に対応。
// 検索流入や外部アプリからのリンク先になる、ログイン不要の要件表ページ。フェーズ4で実装する。
import { useParams } from 'react-router-dom'
import PagePlaceholder from '../components/PagePlaceholder'

export default function RoutePage() {
  const { year, cls, prog } = useParams<{ year: string; cls: string; prog: string }>()
  return <PagePlaceholder title="要件表" note={`準備中（${year}年入学 / ${cls}類 / ${prog}）`} />
}
