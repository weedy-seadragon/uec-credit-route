// アプリ全体のルーティング（画面遷移）を定義する。
//
// `HashRouter` はReact Routerが提供する「URLの管理役」。GitHub Pagesは
// "/main" のような任意のパスに直接アクセスされると404になってしまうため、
// 実際のURLを "https://.../#/main" のように "#" 以降に押し込める HashRouter を使う
// （docs/SPEC.md §9.1）。
//
// `<Routes>` の中に並んだ `<Route>` が「このパスならこのコンポーネントを表示する」という
// 対応表になっている。`element={<SetupPage />}` の部分は「このコンポーネントをレンダリングせよ」
// という指定で、C++でいう関数ポインタを渡すようなイメージに近い。
import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import AboutPage from './pages/AboutPage'
import ComparePage from './pages/ComparePage'
import CourseDetailPage from './pages/CourseDetailPage'
import CoursesPage from './pages/CoursesPage'
import DataPage from './pages/DataPage'
import MainPage from './pages/MainPage'
import RoutePage from './pages/RoutePage'
import SetupPage from './pages/SetupPage'
import TopPage from './pages/TopPage'

function App() {
  return (
    <HashRouter>
      {/* ナビゲーションは仮のもの。フェーズ2-4以降で見た目を整える */}
      <nav>
        <Link to="/">トップ</Link> | <Link to="/setup">プロフィール設定</Link> |{' '}
        <Link to="/main">メイン画面</Link> | <Link to="/courses">科目一覧</Link> |{' '}
        <Link to="/compare">プログラム比較</Link> | <Link to="/data">データ</Link> |{' '}
        <Link to="/about">このサイトについて</Link>
      </nav>
      <Routes>
        <Route path="/" element={<TopPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/main" element={<MainPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:id" element={<CourseDetailPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="/route/:year/:cls/:prog" element={<RoutePage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </HashRouter>
  )
}

export default App
