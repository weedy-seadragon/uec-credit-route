# ディレクトリ構成

このリポジトリの全体像。仕様そのものは [SPEC.md](SPEC.md)、作業ルールは
[CLAUDE.md](../CLAUDE.md)（進捗ログ含む）を参照。ここでは「何がどこにあるか」だけをまとめる。

```
uec-credit-route/
├─ CLAUDE.md                    Claude Code向けの作業ルール＋進捗ログ
├─ README.md                    プロジェクトの概要（人間向けの入口）
├─ docs/
│  ├─ SPEC.md                   仕様書（本体）。機能・データモデル・画面構成など全部
│  └─ STRUCTURE.md              このファイル
├─ data/                        卒業要件・科目マスタの静的JSON（アプリが読み込む唯一のデータ源）
│  ├─ requirements/
│  │  ├─ 2025-day-common.json       総合文化・実践教育科目の要件（昼間コース全プログラム共通）
│  │  ├─ 2025-day-I-media.json      Ⅰ類メディア情報学プログラムの専門科目要件・審査条件
│  │  ├─ 2025-day-I-management.json Ⅰ類経営・社会情報学プログラム
│  │  ├─ 2025-day-I-mathinfo.json   Ⅰ類情報数理工学プログラム
│  │  ├─ 2025-day-I-cs.json         Ⅰ類コンピュータサイエンスプログラム
│  │  └─ 2025-day-I-designds.json   Ⅰ類デザイン思考・データサイエンスプログラム
│  └─ subjects/
│     └─ youran-2025.json           科目マスタ（学修要覧2025 付録Cから転記）
├─ scripts/                     データ更新スクリプト（Python）
│  ├─ gen_data.py                   要覧から転記した表データ → data/ 以下のJSONを生成
│  └─ validate_data.py              data/ が別表2・3・4と矛盾していないか検査
├─ src/                         アプリ本体（TypeScript + React + Vite）
│  ├─ domain/                       画面に依存しない純粋なロジック（後述）
│  ├─ data/                         data/ 以下のJSONを読み込む層（後述）
│  ├─ storage/                      localStorageへの保存・読み込み（後述）
│  ├─ pages/                        画面ごとのコンポーネント（後述）
│  ├─ components/                   複数の画面で使う小さな部品
│  ├─ App.tsx                       ルーティング定義（どのURLでどの画面を出すか）
│  ├─ main.tsx                      アプリの起動点（Reactをブラウザに描画する）
│  └─ index.css                     全体に効く最小限のスタイル
├─ public/                      そのままコピーされる静的ファイル（favicon等）
├─ .github/workflows/deploy.yml GitHub Pagesへの自動デプロイ設定
├─ index.html                   アプリのHTMLの土台（Viteのエントリーポイント）
├─ vite.config.ts               Viteの設定（GitHub Pages用のbaseパスなど）
├─ vitest.config.ts             Vitest（テスト実行ツール）の設定
├─ tsconfig.*.json              TypeScriptの設定（後述）
├─ .oxlintrc.json               oxlint（コード検査ツール）の設定
├─ package.json                 依存パッケージとnpmスクリプトの定義
└─ tanni_extract_final.pdf      学修要覧2025のPDF（ローカル参照用。著作物のためgit管理しない）
```

## `data/` — 唯一のデータ源

`src/` のコードは科目名・単位数を直接書かず、必ずこの下のJSONを参照する（CLAUDE.md参照）。
`requirements/` は「入学年度 × コース × 類 × プログラム」の組み合わせごとに1ファイル。
`2025-day-common.json`（総合文化・実践教育科目、全プログラム共通）と、プログラム別ファイル
（専門科目・審査条件）を組み合わせて1つの要件セットになる（`src/data/requirementSets.ts` が合体させる）。

`subjects/youran-2025.json` は科目番号（末尾記号を含むフルコード。例 `COM405a`）を主キーにした科目マスタ。
1科目1エントリで、名寄せはしない（詳しくはCLAUDE.mdの進捗ログ参照）。

## `src/domain/` — 画面に依存しない純粋なロジック

React にも DOM にも依存しない、入力を渡すと出力が返ってくるだけの関数群。単体テスト
（同じディレクトリの `*.test.ts`）が必ず付いている。

| ファイル | 役割 |
|---|---|
| `requirements.ts` | 卒業要件の充足判定。「必修・選択・選択必修・自由・国際」の各区分を判定し、共通単位への繰り入れも計算する |
| `recommend.ts` | 「次に取るべき科目」のスコア付け・並び替え（学期フィルタ・必修未修得・不足区分などを考慮） |
| `importers.ts` | 本サイト形式JSON（書き出し・読み込み用）の検証と、既存の履修記録へのマージ |

## `src/data/` — 静的データの読み込み層

`requirementSets.ts` が `data/` 以下のJSONを`import`し、「今どの入学年度・類・プログラムの
データがあるか」の一覧（`programOptions`）と、指定した組み合わせに対応する要件セットを返す
関数（`getRequirementSet`）を提供する。新しいプログラムのデータを追加したら、このファイルに
import文を1行足す。

## `src/storage/` — ブラウザへの保存

localStorageへの保存はすべてここを通す。

| ファイル | 役割 |
|---|---|
| `localStorage.ts` | JSON化・例外処理をまとめた薄いラッパー（他の2ファイルの土台） |
| `profile.ts` | プロフィール（入学年度・類・プログラム・学年など）の型と保存 |
| `records.ts` | 履修記録（科目ごとの状態）の保存 |

## `src/pages/` — 画面

`App.tsx` のルーティングに対応する。`MainPage.tsx`・`SetupPage.tsx`・`DataPage.tsx` は実装済み、
それ以外（`CoursesPage.tsx`・`CourseDetailPage.tsx`・`ComparePage.tsx`・`RoutePage.tsx`・
`AboutPage.tsx`・`TopPage.tsx`）はまだ `PagePlaceholder` を表示するだけの空箱（今後のフェーズで実装）。

## `tsconfig.*.json` が複数ある理由

TypeScriptの設定を「本番のアプリコード」「テストコード」「Vite自体の設定ファイル」で分けている
（実行環境が違うため。詳しくは各ファイルの中身とCLAUDE.mdの進捗ログを参照）。

| ファイル | 対象 |
|---|---|
| `tsconfig.json` | 上の3つをまとめる入口（実体はほぼ空） |
| `tsconfig.app.json` | `src/` 本体（`*.test.ts` を除く）＋ `data/` のJSON |
| `tsconfig.node.json` | `vite.config.ts` |
| `tsconfig.vitest.json` | `src/**/*.test.ts` と `vitest.config.ts`（`node:fs` などを使えるようにしている） |

## よく使うコマンド

```
npm run dev       開発サーバーを起動
npm run build     型チェック＋本番ビルド
npm test          テスト実行（vitest run）
npm run lint      コード検査（oxlint）
python scripts/validate_data.py   data/ の整合性チェック
```
