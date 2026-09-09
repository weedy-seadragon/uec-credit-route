# Codex 作業引き継ぎメモ

Codexが作業を始めるときの短い入口です。このファイルは仕様や作業規則を置き換えません。

## 最初に読む順番

1. `AGENTS.md`：作業規則、データの扱い、ブランチ運用
2. `docs/PROJECT_STATUS.md`：現在の実装状況と確認候補
3. `docs/SPEC.md`：機能・データモデルの仕様
4. `docs/PROGRESS_LOG.md`：過去の判断や不具合修正の経緯。調査時は`rg`で検索する

## データを変更するとき

- `data/`のJSONを唯一のデータ源とし、科目名・単位数をコードに直接書かない
- 卒業要件の数値は、学修要覧原本を確認せず推測で変更しない
- 曜日時限・担当教員・シラバスURLは、原則として**2026年度の公式シラバス**を参照する。`youran-2025.json`の年は、入学年度のカリキュラム版を表す
- `scripts/fetch_syllabus.py`は、科目マスタと完全一致する科目名だけを取得対象にする。シラバスにあるのにサイトへ出ない科目は、まず科目マスタへの登録有無を確認する

データ生成は以下の順に実行する。`gen_data.py`は`offerings`と`prerequisitesText`を再生成前の状態へ戻すため、単独で終えない。

```text
python scripts/gen_data.py
python scripts/fetch_syllabus.py
python scripts/build_class_assignment.py
python scripts/build_class_assignment_json.py
python scripts/validate_data.py
```

## 作業後の確認と記録

- TypeScript/Reactの変更後：`npm test`、`npm run lint`、`npm run build`
- `data/`の変更後：上記に加えて`python scripts/validate_data.py`
- 通常の開発は`dev`で進め、コミット・プッシュしてよい
- `main`へのマージは公開操作なので、必ず開発者の明示的な依頼後に行う
- 現在の状態が変わったら`docs/PROJECT_STATUS.md`、経緯は`docs/PROGRESS_LOG.md`を更新する
