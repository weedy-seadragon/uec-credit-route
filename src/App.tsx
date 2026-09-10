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
import { lazy, Suspense } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'

// lazyは、画面のファイルを最初から全て読み込まず、その画面へ移動するときにだけ取得するReactの仕組み。
// 科目データを使う重い画面を後回しにして、トップページの最初の表示を軽くする。
const AboutPage = lazy(() => import('./pages/AboutPage'))
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'))
const CoursesPage = lazy(() => import('./pages/CoursesPage'))
const MainPage = lazy(() => import('./pages/MainPage'))
const RoutePage = lazy(() => import('./pages/RoutePage'))
const SetupPage = lazy(() => import('./pages/SetupPage'))
const TopPage = lazy(() => import('./pages/TopPage'))

/** 画面のファイルを読み込んでいる短い間だけ表示する案内。 */
function PageLoading() {
  return <main className="page-loading">画面を読み込んでいます…</main>
}

// ヘッダーに常に出す主要画面への入口。配列にまとめると、表示順とリンク先を一か所で管理できる。
const navigationItems = [
  { to: '/', label: 'トップ' },
  { to: '/setup', label: 'プロフィール設定' },
  { to: '/main', label: 'メイン画面' },
  { to: '/courses', label: '科目一覧' },
  { to: '/about', label: 'このサイトについて' },
]

function App() {
  return (
    <HashRouter>
      {/* NavLinkは現在開いている画面を判別できるリンク。選択中のタブだけ見た目を変えるために使う。 */}
      <nav className="site-navigation" aria-label="サイト内ナビゲーション">
        {navigationItems.map(({ to, label }) => (
          // 各リンクは帯の中で独立したタブとして扱い、スマホでも押しやすい大きさにする。
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `site-navigation-link${isActive ? ' site-navigation-link-current' : ''}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {/* Suspenseはlazyで読み込み中の画面に代わって、利用者へ短い案内を表示する。 */}
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<TopPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/main" element={<MainPage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:id" element={<CourseDetailPage />} />
          <Route path="/route/:year/:cls/:prog" element={<RoutePage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}

export default App
