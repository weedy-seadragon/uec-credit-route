# CLAUDE.md — このリポジトリで作業するときのルール

## プロジェクト概要

電気通信大学（UEC）情報理工学域の学生向けに、「学年・類・プログラム・取得済み科目」を入力すると
卒業要件の充足状況と、残りの必修・区分別の不足が一目で分かる静的Webサイトを作る。
**仕様はすべて `docs/SPEC.md` に書いてある。迷ったらまず SPEC.md を読むこと。**

## 開発者について

- 開発者は大学2年生で、開発経験はほとんどない。C++ は書けるが TypeScript/React は初めて
- したがって、生成するコードには**日本語のコメント**で「このファイルは何をするか」「この関数は何をするか」を書く
- TypeScript や React で初めて出てくる構文・概念は、コード中のコメントか作業後の説明で一言補足する
- 一度に大量のファイルを生成しない。`docs/SPEC.md` §11 のフェーズ単位で進め、各フェーズの終わりに何を作ったか要約する

## 技術構成（docs/SPEC.md §9）

- TypeScript + React + Vite。ルーティングは React Router の HashRouter（GitHub Pages 対応）
- 状態は React state + localStorage。サーバー・DB・認証は使わない
- テストは Vitest。`src/domain/` のロジックには必ず単体テストを付ける
- データ更新スクリプトは Python（`scripts/`）
- ホスティングは GitHub Pages（GitHub Actions で自動デプロイ）

## コード構成のルール

- `src/domain/` は**純粋なロジックのみ**。React にも DOM にも依存させない（後で C++ 版と突き合わせられるように）
  - `requirements.ts` … 要件充足の判定（SPEC §5 F-3, §7.2「充足計算の順序」）
  - `recommend.ts` … 残り・推奨の算出（SPEC §8）
  - `importers.ts` … JSON 取り込み（SPEC §7.4, §7.5）
- `data/` の JSON が唯一のデータソース。コード中に科目名や単位数をハードコードしない
- `data/` を変更したら `python scripts/validate_data.py` が通ることを確認する
- 科目の主キーは**末尾記号を含むフルコード**（例 `COM405a`）。以前は末尾記号を除いて名寄せしていたが、類専門科目の選択科目のようにプログラムごとに独自採番されている科目では、末尾を除くと番号が一致しても別科目になるケースがあると判明したため撤回した（2026-09-04）。`COM405a`/`COM405e`のように複数プログラムで本当に共有されている科目は、単純に別エントリとして重複して持つ

## データについて（docs/SPEC.md §3, §7）

- `data/requirements/2025-day-common.json` … 総合文化・実践教育科目の要件（昼間コース共通）
- `data/requirements/2025-day-I-media.json` … Ⅰ類メディア情報学プログラムの専門科目要件と審査条件。`extends` で common を参照
- `data/subjects/youran-2025.json` … 学修要覧2025 付録C から起こした科目マスタ（曜日時限・シラバスURLは未収録。シラバスから取る）
- これらは学修要覧2025の原本と突き合わせて検証済み。**数値を勝手に変えない**。疑問があれば開発者に確認する
- 他のプログラム・他年度の要件ファイルは、同じ形式で後から追加する

## やらないこと（docs/SPEC.md §1.4）

- 学務情報システムへの自動ログインやスクレイピング
- CAP制（履修上限）のチェック
- 時間割グリッド表示（友人の時間割アプリが担当）
- シラバス本文の転載（メタデータとリンクのみ）

## 作業の進め方

- フェーズが終わるごとに `git commit`。コミットメッセージは日本語で「何をしたか」を1行
- 仕様と違うことをする必要が出たら、勝手に変えずに理由を説明して開発者に確認する
- 外部サイト（`kyoumu.office.uec.ac.jp`）へアクセスするスクリプトは、1秒以上の間隔を空け、User-Agent に連絡先を入れる

## 進捗ログ（申し送り）

### これまでにやったこと

- **GitHub連携**：`git init` 済み。リモートは `https://github.com/weedy-seadragon/uec-credit-route.git`（`main`ブランチ、push済み）
- **フェーズ0**（既存）：`docs/SPEC.md`、`data/requirements/2025-day-common.json`、`data/requirements/2025-day-I-media.json`、`data/subjects/youran-2025.json`、`scripts/gen_data.py`、`scripts/validate_data.py`
- **Vite + React + TypeScript 初期化**：`npm create vite --template react-ts` の雛形からデモコンテンツを除去。`npm run build` / `npm run lint`（oxlint）/ `npx vitest run` すべて通過確認済み
- **フェーズ1**：`src/domain/requirements.ts` を実装（充足判定ロジック）。必修/選択/自由/国際の判定、選択科目の超過分を共通単位に繰り入れる処理、「上級科目」のように親グループ自体が判定境界を持つケースでの二重計上防止、履修中科目の見込み計算（`projected`）に対応。`src/domain/requirements.test.ts` に単体テスト15件（仮想データ＋実データ統合テスト）、全て通過
- **フェーズ2-1**：`react-router-dom` 導入、`HashRouter` で SPEC §6 の9ページぶんのルートを配線（中身は `PagePlaceholder` を使った準備中の空箱）。`src/storage/localStorage.ts` に薄いlocalStorageラッパー（具体的な保存データの形はまだ未定）。Playwrightで9ルートの表示とconsoleエラー無しを確認済み（Playwrightはこの検証のためだけに一時インストールしたもので、プロジェクトの依存には加えていない）
- **科目番号の主キーをフルコード方式に変更**：当初「末尾記号を除いた番号で名寄せ」する設計だったが、類専門科目の選択科目のようにプログラムごとに独自採番されている科目では、末尾を除くと番号が一致しても別科目になるケース（例：`INS502a`＝メディアリテラシー ≠ `INS502b`＝多変量解析）が見つかったため、**末尾記号を含むフルコードをそのまま主キーにする**方式に変更（開発者の承認済み）。`docs/SPEC.md` §7.1、CLAUDE.md本文の規約、`scripts/gen_data.py`・`scripts/validate_data.py`・`src/domain/requirements.ts`のコメントを更新済み
- **Ⅰ類の残り4プログラムのデータ化完了**：経営・社会情報学(b)・情報数理工学(c)・コンピュータサイエンス(d)・デザイン思考データサイエンス(e)。`data/requirements/2025-day-I-{management,mathinfo,cs,designds}.json` を追加。付録C 注1「他プログラムの科目も選択として履修できる（実験科目を除く）」は、各プログラムの類専門（選択）グループの `subjects` に、他の同じ類のプログラムの選択科目コードをデータ生成時にあらかじめ展開して反映（実験科目・自由科目・国際科目は対象外という解釈で実装。判断の詳細は `scripts/gen_data.py` の `build_program`/`cluster_i` 付近のコメント参照）
  - 生成はPythonが使える環境でないため、Node.js版のスクリプト（一時ファイル、リポジトリには含めていない）で実行し、`data/`に直接書き出した。**`scripts/gen_data.py`（正式なPython版）は同じ内容になるよう手で追記したが、この環境ではPythonが無く実行して確認できていない**。次にPythonが使える環境で `python scripts/gen_data.py && python scripts/validate_data.py` を実行し、`git diff`が出ない（＝出力が今のdata/と一致する）ことを確認してほしい
  - 検証は `scripts/validate_data.py` と同じロジックをNode.jsに移植して実行し、必修グループの単位合計・区分の子合計・審査条件の参照先などをチェック済み（OK）。加えて `npx vitest run` / `npm run build` / `npm run lint` も全て通過

### 参考PDF（開発者が用意したもの。リポジトリには含めない）

- `C:\Users\maita\Downloads\uec-credit-route\tanni_extract_final.pdf`（プロジェクト内、`.gitignore`の`*.pdf`で除外済み）：学修要覧2025の本編。第2章（科目区分・単位算出基準・審査所要単位）、別表2〜5、付録C（**全15プログラム＋夜間主課程のカリキュラム表**）を含む、事実上のフル版。Ⅱ・Ⅲ類・夜間主のデータ化にはこれを使う
- `C:\Users\maita\Downloads\youran2025-gakuiki.pdf`（プロジェクト外、`Downloads`直下）：おそらく同じ学修要覧の原本。中身は未確認

- **フェーズ2完了（2-2〜2-6）**：
  - 2-2 `src/domain/recommend.ts`：SPEC §8の推奨スコア(w1〜w7)。先修科目・曜日時限はまだシラバスデータが無いので「無ければ条件なし」として扱う設計。単体テスト11件
  - 2-3 `src/pages/SetupPage.tsx` + `src/storage/profile.ts`：プロフィール設定画面。1年生（非推薦）はプログラムを「未定」に固定
  - 2-4 `src/pages/MainPage.tsx` + `src/storage/records.ts` + `src/components/SubjectStatusSelect.tsx`：メイン画面（合計単位・取得単位・不可の単位・残りの必修・区分別の進捗）。**簡略化**：要覧スケッチの「履修予定チェック」の代わりに、全一覧共通の状態プルダウン（未履修/履修中/修得/不合格）に統一。編集は「更新」ボタンを押すまで確定されない（draft/committed分離）。審査（2年次終了時審査等）の合否表示は未実装
  - 2-5 `src/domain/importers.ts` + `src/pages/DataPage.tsx`：本サイト形式JSON（§7.4）のダウンロード・読み込み（マージ）・全消去。友人アプリ取り込み（§7.5、F-2c）は未対応（Should優先度のため）
  - 2-6 `vite.config.ts`（base設定）+ `.github/workflows/deploy.yml`：GitHub Pages自動デプロイ。**GitHubリポジトリ設定でSettings→Pages→SourceをGitHub Actionsにする作業がまだ残っている**（このファイルだけでは有効にならない）
  - 各ページはPlaywrightで実際にdev serverを起動してブラウザ操作を確認済み（consoleエラーなし）。`src/data/requirementSets.ts` がdata/以下のJSONをアプリから読み込む層（`resolveJsonModule`をtsconfig.app.jsonに追加）
- **GitHub Pages設定を有効化・デプロイ成功を確認済み**：`https://weedy-seadragon.github.io/uec-credit-route/` で稼働中
- **メイン画面のUI改善（フェーズ3着手前の調整）**：トップページに説明文を追加、必修ラベルを「(必修・未修得)」→「(必修)」に簡略化、取得単位・残りの必修を区分ごとに見出し分け、「区分別の進捗」→「選択科目」に改称、ファイルのダウンロード・読み込みをメイン画面のツールバー（表示・更新の隣）に移動、リセットボタン（全記録を未履修に戻す）を追加、履修状態プルダウンから「履修中」を削除（未履修/修得/不合格の3択に）
- **他プログラムの専門科目の明示**：`RequirementSet`/`ProgramDoc` に `programSuffix`（自分のプログラムの科目番号末尾記号）を追加。科目コード末尾がこれと違う科目（付録C注1で選択として履修できる他プログラムの専門科目）には「［他プログラム専門科目］」と表示し、選択科目セクションにその単位が専門科目として扱われる旨の注釈を追加
- **科目一覧に標準年次・学期を表示**：`data/subjects/youran-2025.json` に既にあった `standardYear`/`termType` をMainPageの各一覧（取得単位・不可の単位・残りの必修・選択科目）に表示するようにした（データの追加取得は不要だった）
- **共通単位セクションの実装**：MainPageに「共通単位（n/N単位）」セクションを追加。「あぶれ分」（各区分のoverflow合計、デフォルト展開）と「取得した単位」（`countAs: 'common'`指定の科目、`alwaysCommon`科目）を分けて表示。`BoundaryGroup`に`overflow`/`overflowToCommon`/`countAsCommon`フィールドを追加
- **スマホ対応**：`src/index.css`にメディアクエリではなく素朴なCSS（`body`の余白、`nav a`のタップ領域拡大、`button`/`select`の`min-height`）を追加。Playwrightでスマホビューポート（375×667）でも崩れないことを確認
- **フェーズ3完了：Ⅱ類5プログラム・Ⅲ類5プログラム・夜間主課程のデータ化**（`tanni_extract_final.pdf` 付録C C.3.2/C.3.3/C.5/C.6より）
  - Ⅱ類：セキュリティ情報学(f)・情報通信工学(g)・電子情報学(h)・計測制御システム(i)・先端ロボティクス(j)。計測制御/ロボは「データサイエンス演習」が選択科目になる（day-common.jsonの元々の注記が未実装だった穴を埋め、`commonOverrides`という新しい仕組みで対応：プログラム側から共通ファイルの特定グループのフィールドを部分上書きできる。`src/data/requirementSets.ts`の`applyCommonOverrides`参照）
  - Ⅲ類：機械システム(k)・電子工学(m)・光工学(n)・物理工学(p)・化学生命工学(r)。全プログラムでデータサイエンス演習が選択科目（`commonOverrides`使用）。プログラムによって類共通基礎・類専門の選択タイル構成が違う（選択必修のみ／選択必修+選択の2段／選択必修のみで選択科目自体が別枠、など）ことが分かったので、パターンを一つに決め打ちせずPDFの罫線を都度確認しながら組んだ
  - 夜間主：`data/requirements/2025-evening.json`。**類・プログラムの区分がない単一課程**で、総合文化・実践教育・専門科目とも昼間コースとは別の科目区分・科目コード体系（総合文化/実践教育は's'、専門は't'サフィックス）のため、`2025-day-common.json`をextendsしない自己完結ファイルにした。これに伴い`ProgramDoc.cluster`の型を`null`許容に変更し、`getRequirementSet()`は`course: 'evening'`のとき共通ファイルとのマージをスキップするよう分岐。`SetupPage.tsx`/`MainPage.tsx`もcluster:nullを扱えるよう修正（夜間主コース選択時は学年だけを聞く、プログラム選択欄は出さない）
  - 各プログラムのmajor-sel（類専門・選択）には、付録C注1「同じ類の他プログラムの専門科目も選択科目として算入できる（実験科目を除く）」に対応する他プログラム分の科目コードを展開済み（Ⅱ類・Ⅲ類それぞれ別コミットで、全プログラムがそろってから相互展開する形で実施）
  - 全プログラムで、必修グループの単位合計が別表2・別表4の必修単位と一致することをNode検証スクリプトで確認済み。Playwrightで各プログラムの選択・表示・consoleエラー無しも確認
- **`scripts/gen_data.py` / `scripts/validate_data.py` の更新（Ⅱ類・Ⅲ類・夜間主対応）**：`validate_data.py`は`PROGRAM_FILES`に16ファイル全部を追加し、`reviews`キー（Ⅰ類5プログラムにしか無い）を`.get()`で任意扱いに変更。`gen_data.py`は`add2()`という新しいヘルパーを追加し（既存の`add()`は科目番号の数字から標準学期を自動推定するが、Ⅱ類以降はPDFの週時間数表を実際に読んだ値を明示的に持たせたかったため）、Ⅱ類5・Ⅲ類5・夜間主1の科目マスタ行と要件groups木を追記した。**この環境にはPythonが無く実行して確認できていない**が、生成元のdata/*.jsonをNode.jsで機械的にPythonリテラルへ変換する方式で書いたため、手打ちのtypoリスクは低い。変換の正しさ自体は「生成したPythonリテラルをJSへ逆変換して元のJSONとbyte-for-byte一致するか」「validate_data.pyと同じチェックロジックをNode.jsに移植して16ファイル全部に通す」の2通りで検証済み（どちらもOK）。**次にPythonが使える環境で `python scripts/gen_data.py && python scripts/validate_data.py` を実行し、`git diff`が出ないことを確認してほしい**

- **シラバスから曜日時限を取得（完了、Ⅰ類昼間中心）**：`https://kyoumu.office.uec.ac.jp/syllabus/2025/GakkiIchiran_31_0.html`（情報理工学域2025年度、全1157行）を取得し、`data/subjects/youran-2025.json`の科目名と一致する行（464件）だけに絞り込んで、各行の個別シラバスページ（`.../31/31_{時間割コード}.html`）を1.2秒間隔で取得。科目番号欄（1つの講義が複数プログラムで共有される場合は空白区切りで複数コードが並ぶ。例:`"ELE301a ELE301b ELE301c ELE301d ELE301e"`）を読み取り、一致した科目コード614件分に`offerings`（`docs/SPEC.md` §7.1のスキーマ：`timetableCode`/`faculty`/`term`/`slots`/`instructors`/`syllabusUrl`/`updatedAt`）を追記した。`prerequisites`（先修科目）は今回は未取得（個別ページに項目はあるが今回はスコープ外）
  - 実行はこの環境にPythonが無いためNode.jsで実施し、`data/subjects/youran-2025.json`に直接書き出した。**`scripts/fetch_syllabus.py`（正式なPython版）は同じロジックになるよう新規作成したが、この環境ではPythonが無く実行して確認できていない**
  - **注意：`scripts/gen_data.py`は`offerings`を一切知らない**（PDFの手転記データからしか科目マスタを組み立てないため）。次に`python scripts/gen_data.py`を実行すると`data/subjects/youran-2025.json`が上書きされ、今回取得した`offerings`が消える。`gen_data.py`のあとに`fetch_syllabus.py`を実行する、という順序で運用すること（このルールをスクリプト側で強制してはいないので注意）
  - 464件の候補は「科目名が`data/subjects/youran-2025.json`に存在する行」で絞り込んだもので、全1157件は回っていない（他学域・他年度相当・まだデータ化していない科目名などは対象外）。取りこぼしがある可能性がある
  - `src/domain/recommend.ts`の`SubjectInfo.slots`/`prerequisites`は「科目1つにつき1つの時限」を想定した設計だが、今回取得した`offerings`は科目によって複数セクション（クラス）で曜日時限が違うことがある（例:語学科目で同じ科目コードに6セクション）。**`offerings`をどう`slots`に落とし込むか（先頭のセクションを使う／全セクションを比較して警告するなど）は未決定・未実装**。今回はデータ取得（`data/`への格納）までで、`recommend.ts`側への配線はまだ行っていない

- **学域特別講義（UEC001z・UEC002z）を常時共通単位に分類**：これまで`otherSubjects.special`という未使用の別枠に置いていた（`groups`のどの区分にも属さず、アプリからも一切参照されていなかった）が、開発者の指示（2026-09-05）で`commonCreditSources.alwaysCommon`に移した。理由は元々の科目データの`note`の通り「開講年度により扱いが異なり、必修/選択のどの区分にも一意に割り当てられない」ため。`data/requirements/2025-day-common.json`と`scripts/gen_data.py`を修正済み（`otherSubjects`には`japanese`のみ残した）。これで選択科目の「共通単位」の入れ子（前述）にも表示され、状態プルダウンで選択できるようになった

### 次回以降にやること

1. **`scripts/gen_data.py`／`scripts/validate_data.py`／`scripts/fetch_syllabus.py` の実行確認**：上記の通り、Pythonが使える環境でまだ試せていない。**実行する場合は`gen_data.py`→`fetch_syllabus.py`の順で**（逆だとofferingsが消える）
2. **`offerings`を`recommend.ts`に配線する設計判断**：複数セクション（クラス）を持つ科目の`slots`をどう扱うか（上記参照）。同時限警告（F-4関連）を実装するならここが前提になる
   - **UI設計について開発者と相談済み（2026-09-05、まだ実装はしていない）**：曜日時限の表示は科目名の左ではなく、未履修等の状態プルダウンの右側に置く方向。表示対象はⅠ類昼間だけでなく全プログラム分（＝上記のシラバス取得対象拡大が前提）。1科目に複数クラス（曜日時限）がある科目は、ユーザーに最初にどのクラスを履修しているか入力してもらい、その入力で曜日時限を一意に決める方式にする案（＝入力項目を増やす必要がある。具体的な入力UIの形はまだ未検討）
3. **シラバス取得の対象拡大**：今回はⅠ類昼間5プログラム中心（科目名一致による絞り込みなので他プログラムの科目も一部含まれている）。Ⅱ・Ⅲ類・夜間主の科目や、`prerequisites`（先修科目）の取得はまだ
4. 今回スコープ外にした主な項目：F-2c（友人アプリ取り込み）・F-2d（成績表貼り付け）、審査（2年次終了時審査等）の合否表示（Ⅰ類5プログラムのみ`reviews`データあり、Ⅱ・Ⅲ類・夜間主は未対応）、同時限警告（上記の設計判断待ち）、F-5（科目一覧・詳細）、F-6（プログラム比較）、F-9のOGP/SEO/sitemap（SPEC上もフェーズ4の予定）、夜間主の国際科目（付録C C.4、3・4年次のみ・上級科目扱い）の組み込み
