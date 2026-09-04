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

### 次回以降にやること

1. **`scripts/gen_data.py` の動作確認**：Pythonが使える環境で実行し、`data/`の内容と一致するか確認（上記参照）
2. フェーズ3の続き：Ⅱ類5プログラム・Ⅲ類5プログラム・夜間主課程のデータ化（`tanni_extract_final.pdf` に全部揃っている）。新しいプログラムを追加したら `src/data/requirementSets.ts` にもimportを足す必要がある
3. **シラバスから曜日時限を取得する（`scripts/fetch_syllabus.py`、後回し中）**：開発者の指示で保留。調査済みの内容は以下の通り
   - シラバスWeb公開システムの2025年度・情報理工学域は `https://kyoumu.office.uec.ac.jp/syllabus/2025/GakkiIchiran_31_0.html`（夜間主は `..._32_0.html`）。1ページに全科目の表（No./学期/開講/曜日・時限/時間割コード（8桁）/科目名/担当教員）が載っている。曜日時限はこの一覧表の時点で分かる（例:「月1」「月1, 月2」）
   - ただしこの一覧表には**科目コード（`COM405a`のような形式）が無い**。科目名と8桁の時間割コードだけなので、我々のデータ（`data/subjects/youran-2025.json`）と確実に突き合わせるには、行ごとのリンク先の**個別シラバスページ**（`https://kyoumu.office.uec.ac.jp/syllabus/2025/31/31_{時間割コード}.html`）を開いて、そこに書かれている科目コードで照合する必要がある（個別ページには科目コード・曜日時限どちらも載っている）
   - 一覧表の行数は情報理工学域全体で1157件（今データ化済みの557科目より多く、他学年・重複セクション・未データ化の類の科目なども含む）。CLAUDE.md本文のルール通り1秒以上間隔を空けると、全部の個別ページを回るのに20〜30分程度かかる見込み
   - 提案していた進め方：Ⅰ類昼間5プログラム分（557科目）にまず絞って取得。`scripts/fetch_syllabus.py`（Python版、正式）を書きつつ、この環境にはPythonが無いのでNode版で実際にバックグラウンド取得・データ反映まで行う（`gen_data.py`のときと同じやり方）。開発者の了承待ち
4. 今回スコープ外にした主な項目：F-2c（友人アプリ取り込み）・F-2d（成績表貼り付け）、審査（2年次終了時審査等）の合否表示、同時限警告（シラバスデータ未収集のため）、F-5（科目一覧・詳細）、F-6（プログラム比較）、F-9のOGP/SEO/sitemap（SPEC上もフェーズ4の予定）
