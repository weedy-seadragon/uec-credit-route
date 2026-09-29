# ディレクトリ構成

このリポジトリの全体像。仕様そのものは [SPEC.md](SPEC.md)、作業ルールは
[AGENTS.md](../AGENTS.md)、現状の要約は[PROJECT_STATUS.md](PROJECT_STATUS.md)、Codex向けの短い入口は [CODEX.md](../CODEX.md) を参照。ここでは「何がどこにあるか」だけをまとめる。

```
uec-credit-route/
├─ AGENTS.md / CLAUDE.md         AIエージェント向けの作業ルール
├─ CODEX.md                      Codex向けの短い作業入口・現状メモ
├─ README.md                    プロジェクトの概要（人間向けの入口）
├─ NOTICE.md                    著作権・利用上の注意
├─ docs/
│  ├─ SPEC.md                   仕様書（本体）。機能・データモデル・画面構成など全部
│  ├─ STRUCTURE.md              このファイル
│  ├─ HANDOVER.md               初めて引き継ぐ人向けの説明
│  ├─ PROJECT_STATUS.md         現在の実装状況・確認候補
│  ├─ PROGRESS_LOG.md           過去の作業経緯
│  ├─ MAINTENANCE_GUIDE.md      年度更新・保守運用の手順
│  ├─ RELEASE_CHECKLIST.md      公開前に主要な画面操作を確認する手順
│  ├─ PDF_READING_NOTES.md      学修要覧PDFの読み方（AIエージェント向け）
│  ├─ PENDING_YEAR_SEMESTER_CHECKS.md  標準年次・学期の確認監査記録
│  ├─ YOURAN_*_COMPARISON.md    学修要覧の年度間の差分・照合の記録
│  └─ YOURAN_CROSS_YEAR_AUDIT.md  年度をまたいだ要件の横断チェックの記録
├─ app/                         Webアプリ一式（npmコマンドはこのディレクトリで実行）
│  ├─ data/                         卒業要件・科目マスタの静的JSON（唯一のデータ源）
│  │  ├─ requirements/                 入学年度（2021〜2026）ごとの要件データ
│  │  │  ├─ {年度}-day-common.json       総合文化・実践教育科目の要件（昼間コース全プログラム共通）
│  │  │  ├─ {年度}-day-{I,II,III}-*.json 昼間コースの各プログラムの専門科目要件・審査条件
│  │  │  └─ {年度}-evening.json          夜間主課程の要件・審査条件
│  │  ├─ subjects/
│  │  │  ├─ youran-{年度}.json           入学年度ごとの科目マスタ（2021〜2026）
│  │  │  └─ code-migrations.json         旧科目コードから新コードへの対応表（保存記録の引き継ぎ用）
│  │  └─ timetable/                    クラス別の曜日時限を解決するCSV・JSON
│  ├─ src/                          アプリ本体（TypeScript + React + Vite）
│  │  ├─ domain/                       画面に依存しない純粋なロジック（後述）
│  │  ├─ data/                         app/data/ 以下のJSONを読み込む層（後述）
│  │  ├─ storage/                      localStorageへの保存・読み込み（後述）
│  │  ├─ pages/                        画面ごとのコンポーネント（後述）
│  │  ├─ components/                   複数の画面で使う小さな部品
│  │  ├─ App.tsx                       ルーティング定義（どのURLでどの画面を出すか）
│  │  ├─ main.tsx                      アプリの起動点（Reactをブラウザに描画する）
│  │  └─ index.css                     全体に効く最小限のスタイル
│  ├─ public/                       そのままコピーされる静的ファイル（favicon等）
│  ├─ index.html                   アプリのHTMLの土台（Viteのエントリーポイント）
│  ├─ vite.config.ts               Viteの設定（GitHub Pages用のbaseパスなど）
│  ├─ vitest.config.ts             Vitest（テスト実行ツール）の設定
│  ├─ tsconfig.*.json              TypeScriptの設定（後述）
│  ├─ .oxlintrc.json               oxlint（コード検査ツール）の設定
│  └─ package.json                 依存パッケージとnpmスクリプトの定義
├─ scripts/                     データ更新スクリプト（Python）
│  ├─ gen_data.py                   要覧から転記した表データ → 科目マスタ・2025年度の要件JSONを生成
│  ├─ fetch_syllabus.py             シラバスから開講情報を取得
│  ├─ build_class_assignment.py     クラス割り当てCSVを作成・引き継ぎ
│  ├─ build_class_assignment_json.py CSVをアプリ用JSONへ変換
│  ├─ build_20XX_data.py            他の年度（2021〜2024・2026）の要件・科目データを、土台の年度から生成
│  ├─ backfill_*.py                 開講情報・セクション表記・学域特別講義のテーマなどを補う
│  ├─ sync_term_types.py            学期の食い違いをシラバス側へ合わせる
│  ├─ special_lecture_data.py       学域特別講義A・Bの定義
│  └─ validate_data.py              app/data/ が別表2・3・4と矛盾していないか検査
├─ testcases/                   動作確認用のバックアップJSONなど
├─ .github/workflows/deploy.yml GitHub Pagesへの自動デプロイ設定
└─ PDF/                         学修要覧のPDF（ローカル参照用。著作物のためgit管理しない）
```

## `app/data/` — 唯一のデータ源

`app/src/` のコードは科目名・単位数を直接書かず、必ずこの下のJSONを参照する（作業規則は`AGENTS.md`を参照）。
`requirements/` は「入学年度 × コース × 類 × プログラム」の組み合わせごとに1ファイル。
`{年度}-day-common.json`（総合文化・実践教育科目、全プログラム共通）と、プログラム別ファイル
（専門科目・審査条件）を組み合わせて1つの要件セットになる（`app/src/data/requirementSets.ts` が合体させる）。

`subjects/youran-{年度}.json` は科目番号（末尾記号を含むフルコード。例 `COM405a`）を主キーにした科目マスタ。
1科目1エントリで、名寄せはしない（理由は`PROGRESS_LOG.md`を参照）。

## `app/src/domain/` — 画面に依存しない純粋なロジック

React にも DOM にも依存しない、入力を渡すと出力が返ってくるだけの関数群。単体テスト
（同じディレクトリの `*.test.ts`）が必ず付いている。

| ファイル | 役割 |
|---|---|
| `requirements.ts` | 卒業要件の充足判定。「必修・選択・選択必修・自由・国際」の各区分を判定し、共通単位への繰り入れも計算する |
| `recommend.ts` | 「次に取るべき科目」のスコア付け・並び替え（学期フィルタ・必修未修得・不足区分などを考慮） |
| `importers.ts` | 本サイト形式JSON（書き出し・読み込み用）の検証と、既存の履修記録へのマージ |
| `reviews.ts` | 2年次終了時・卒業研究着手・卒業などの審査条件を判定 |
| `classAssignment.ts` | プロフィールのクラス情報から、複数セクションの曜日時限・シラバスリンクを絞り込む |
| `prerequisites.ts` | シラバスの先修科目自由記述から、安全に確定できる科目だけを抽出 |
| `timetablePreview.ts` | 時間割プレビューでの科目の配置・欄外の分類・色区分 |
| `offeringTerms.ts` | 学期とターム（春・夏・秋・冬）の期間の重なりの判定 |
| `scheduleConflicts.ts` | 「更新する」時の曜日時限の重複警告 |
| `onDemand.ts` | 時限のない科目（オンデマンド・集中講義など）の区分と表示文言 |
| `sortByYearTerm.ts` | 学年学期・曜日時限順の並べ替え |
| `codeMigrations.ts` | 旧科目コードの保存記録を新コードへ引き継ぐ |
| `subjectRecords.ts` | 同名で複数の科目番号を持つ科目の履修状態を1件にそろえ、二重登録・二重集計を防ぐ |
| `programSuffix.ts` | 科目コード末尾のプログラム記号から、同じ類の他プログラム科目だけを判別する |
| `agentTools.ts` | AIエージェント向けツール（WebMCP）が返す内容の組み立て |

## `app/src/data/` — 静的データの読み込み層

`requirementSets.ts` が `app/data/` 以下のJSONを入学年度ごとに分けて読み込み
（`loadEntryYearData`／`requireEntryYearData`）、指定した組み合わせに対応する要件セットを返す
関数（`getRequirementSet`）を提供する。データを使う画面は、描画の最初に`requireEntryYearData(入学年度)`を
呼ぶ（未読み込みなら読み込み完了までSuspenseで待つ）。全年度のプログラム一覧だけは、ビルド時に
`app/programIndexPlugin.ts`が作る`virtual:program-index`から最初から使える。

## `app/src/storage/` — ブラウザへの保存

localStorageへの保存はすべてここを通す。

| ファイル | 役割 |
|---|---|
| `localStorage.ts` | JSON化・例外処理をまとめた薄いラッパー（他の2ファイルの土台） |
| `profile.ts` | プロフィール（入学年度・類・プログラム・学年など）の型と保存 |
| `records.ts` | 履修記録（科目ごとの状態）の保存 |
| `otherCommonCredits.ts` | 科目を介さないその他単位認定の保存 |
| `otherClusterMajorCredits.ts` | 他類専門科目の個別認定の保存 |
| `retakingPlans.ts` | 再履修の予定の保存 |
| `subjectCodeMigrations.ts` | 起動時に、保存済みデータの旧科目コードを新コードへ移し替える |
| `mainSectionVisibility.ts` | メイン画面の大見出しの開閉状態の保存（履修記録・バックアップには含めない） |
| `timetableVisibility.ts`・`timetableOfferingSelection.ts` | 時間割プレビューの表示／非表示と、選んだ授業の保存（同上） |

## `app/src/pages/` — 画面

`App.tsx` のルーティングに対応する。`TopPage.tsx`・`SetupPage.tsx`・`MainPage.tsx`・`CoursesPage.tsx`・
`CourseDetailPage.tsx`・`AboutPage.tsx`は実装済み。`RoutePage.tsx`のみ、固定URLの要件表ページとして今後内容を拡張するための最小実装であり、`PagePlaceholder`を使っている。`/compare`と`/data`は削除済み。時間割プレビューは画面ではなく、`components/TimetablePreview.tsx`としてメイン画面に組み込んでいる。時間割プレビューは画面ではなく、`components/TimetablePreview.tsx`としてメイン画面に組み込んでいる。

## `tsconfig.*.json` が複数ある理由

TypeScriptの設定を「本番のアプリコード」「テストコード」「Vite自体の設定ファイル」で分けている
（実行環境が違うため。詳しくは各ファイルの中身と`PROGRESS_LOG.md`を参照）。

| ファイル | 対象 |
|---|---|
| `tsconfig.json` | 上の3つをまとめる入口（実体はほぼ空） |
| `tsconfig.app.json` | `app/src/` 本体（`*.test.ts` を除く）＋ `app/data/` のJSON |
| `tsconfig.node.json` | `app/vite.config.ts` |
| `tsconfig.vitest.json` | `app/src/**/*.test.ts` と `app/vitest.config.ts`（`node:fs` などを使えるようにしている） |

## よく使うコマンド

```
cd app
npm run dev       開発サーバーを起動
npm run build     型チェック＋本番ビルド
npm test          テスト実行（vitest run）
npm run lint      コード検査（oxlint）
cd ..
python scripts/validate_data.py   app/data/ の整合性チェック
```
