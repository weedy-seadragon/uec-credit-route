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

### 次回以降にやること

1. **`scripts/gen_data.py` の動作確認**：Pythonが使える環境で実行し、`data/`の内容と一致するか確認（上記参照）
2. フェーズ2の残り（未着手）：2-2 `src/domain/recommend.ts`、2-3 プロフィール設定画面、2-4 メイン画面（チェックリスト・区分別進捗）、2-5 JSON入出力、2-6 GitHub Pages公開設定
3. フェーズ3の続き：Ⅱ類5プログラム・Ⅲ類5プログラム・夜間主課程のデータ化（`tanni_extract_final.pdf` に全部揃っている）
