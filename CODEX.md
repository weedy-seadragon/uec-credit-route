# Codex 作業引き継ぎメモ

Codexがこのリポジトリで作業を始めるときの短い入口です。詳細な仕様は`docs/SPEC.md`、作業規則と現時点の制約は`AGENTS.md`、過去の判断の理由は`docs/PROGRESS_LOG.md`を参照してください。このファイルはそれらを置き換えません。

## 現在の状態（2026-09-08時点のデータ）

- 2025年度入学生向けの要件は、昼間コースのⅠ類・Ⅱ類・Ⅲ類の各5プログラムと夜間主課程、計16課程に対応している。
- 科目マスタは1,391科目あり、うち1,113科目には2026年度シラバス由来の開講情報（曜日時限・担当教員・リンク等）がある。
- クラス別の開講情報は`data/timetable/class_assignment_filled.csv`から`class_assignment.json`へ変換済みで、CSVの`class_id`未記入行は0件である。ただし、機械システムプログラムの一部を含むマシンデザインBの細かな振り分けは未確定で、該当学生には曜日時限を出さない安全側の扱いにしている。
- 標準年次・学期は全課程を点検し、信頼できる機械抽出で判明した修正を反映済み。類専門科目の候補85件はPDF画像での目視確認待ちであり、`docs/PENDING_YEAR_SEMESTER_CHECKS.md`に一覧がある。
- `src/domain/`には卒業要件・推奨・審査・先修科目・クラス別開講情報・JSON取り込みの純粋ロジックと単体テストがある。UIはプロフィール、メイン、科目一覧・詳細、固定ルート、Aboutまで実装済みである。

## 最初に確認するもの

1. `AGENTS.md`：作業規則。特に日本語コメント、データの扱い、ブランチ運用を守る。
2. `docs/SPEC.md`：機能やデータモデルの正しい仕様を確認する。
3. `docs/PROGRESS_LOG.md`：既存の判断や同種バグの修正経緯を`rg`で検索する。
4. `docs/PENDING_YEAR_SEMESTER_CHECKS.md`：標準年次・学期を変更する前に、保留候補か確認する。

## データを変更するとき

科目名や単位数をコードへ直接書かず、`data/`を唯一のデータ源にする。学修要覧の数値は推測で変更しない。

データ生成パイプラインは次の順序で実行する。`gen_data.py`は`offerings`と`prerequisitesText`を消すため、単独で実行して終わりにしない。

1. `python scripts/gen_data.py`
2. `python scripts/fetch_syllabus.py`（大学サイトへアクセスするため、完走に10〜15分かかる）
3. `python scripts/build_class_assignment.py`
4. `python scripts/build_class_assignment_json.py`
5. `python scripts/validate_data.py`

学修要覧PDFは現在`PDF/yoran_2025.pdf`にあり、Git管理しない。読み方は`docs/PDF_READING_NOTES.md`を参照する。

## 作業後の確認と記録

- TypeScript/Reactの変更後：`npm test`、`npm run lint`、`npm run build`
- `data/`の変更後：上記に加えて`python scripts/validate_data.py`
- 一つのフェーズを終えたら、日本語の1行コミットを`dev`ブランチへ作る。`main`へのマージは公開操作なので、開発者の確認なしに行わない。
- 仕様・設計・未解決事項が変わったときは、この「現在の状態」と該当する詳細文書も一緒に更新する。作業の経緯は`docs/PROGRESS_LOG.md`へ追記する。

## 直近の記録

- 2026-09-08：このファイルを追加。実在するPDF名、クラス割り当ての変換済み状態、実装済み画面の状況に合わせて、README・構成説明・時間割データ説明を更新した。
