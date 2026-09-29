# 年度更新・保守運用ガイド

このファイルは、次年度以降にこのサイトを安全に保守するための実務手順をまとめたものです。
日々の小さな表示修正よりも、**学修要覧・シラバスの年度更新**をするときに読む入口として使います。

詳細な仕様は `docs/SPEC.md`、過去に行った判断は `docs/PROGRESS_LOG.md`、PDFの読み方は
`docs/PDF_READING_NOTES.md` を参照してください。

## 現在の年度対応方針

- **2021〜2026年度入学生**は、それぞれ入学年度の専用データを持つ。
  `app/data/requirements/<年度>-*.json` と `app/data/subjects/youran-<年度>.json` を使う
  （2021・2022年度は15課程、2023年度以降は16課程）。
- 卒業要件・審査条件・科目表（どの科目がその年度の区分に入るか）は、**入学年度の学修要覧原本**に従う。
- 曜日時限・担当教員・シラバスURL・科目名・単位数などの科目自体の属性は、入学年度ではなく、
  原則として**2026年度の公式シラバス**を基準にする（同じ科目番号のまま名前だけ変わった科目は、
  古い年度でも現行の科目名で表示する）。
- 2020年度以前・2027年度以降のデータはまだ無い。追加するときは、下の「年度データを追加する手順」に従う。

## 年度更新の目安

- 新年度の学修要覧公開後: 前年度版と比較し、卒業要件・審査・科目表の差分を確定する。
- 新年度のシラバス公開後: 曜日時限・担当者・シラバスリンクを取得し、複数クラスの割り当てを確認する。
- 公開前: データ検証、テスト、ビルド、主要プロフィールでの画面確認を行う。
- 公開後: リリースノートへ影響範囲を記録し、報告された不具合を `docs/PROGRESS_LOG.md` に残す。

## 年度データを追加する手順

以下は、たとえば2027年度入学生向けのデータを追加する場合の流れです。数値や科目を推測で変えず、
必ず公式の学修要覧原本で確認します。

1. 新年度の学修要覧PDFを `PDF/` に置く。PDFは著作物なのでGitにはコミットしない。
2. 前年度の要覧と比較する。特に次を確認する。
   - 別表2: 卒業所要単位、共通単位・専門科目の必要単位
   - 別表3〜4: 2年次終了時・卒業研究着手・卒業などの審査条件
   - 付録C: 新設・廃止・番号変更・名称変更・単位数・標準年次・学期
   - 昼間15プログラムだけでなく、夜間主コースも確認する
3. `app/data/requirements/<年度>-*.json` を前年度版からコピーして年度、`extends`、要件差分を更新する。
4. `app/data/subjects/youran-<年度>.json` を作り、付録Cの差分を反映する。
   - 同じ番号でも年度で別科目になる場合があるため、科目番号を末尾記号まで含めて扱う。
   - 科目名・単位数をTypeScriptへ直接書かない。必ずJSONを更新する。
5. `app/src/data/requirementSets.ts` の自動読み込み対象に新年度のJSONが含まれることを確認する。
6. 年度差分の根拠を `docs/YOURAN_<旧年度>_<新年度>_COMPARISON.md` として残す。
7. 年度切替が正しいことを `app/src/data/requirementSets.test.ts` に追加してテストする。

## シラバス・曜日時限を更新する手順

科目データを更新した後に、公式シラバスの開講情報を更新します。

1. `scripts/fetch_syllabus.py` で新年度のシラバス情報を取得する。
   - 大学サイトへのアクセスは1秒以上あけ、設定済みのUser-Agentを変更しない。
   - 全件取得には10〜15分程度かかる。途中で出力が少なくてもすぐ中断しない。
2. 複数クラスで曜日時限が異なる科目は、`app/data/timetable/class_assignment_filled.csv` の
   `class_id` を見直す。
3. CSVを変更したら、`scripts/build_class_assignment_json.py` で
   `app/data/timetable/class_assignment.json` を再生成する。
4. 実際のプロフィールをいくつか選び、曜日時限・シラバスリンクが期待どおり1件に絞れるか確認する。

注意: `scripts/fetch_syllabus.py` は科目マスタと名前が完全一致する科目だけ取得する。
シラバスにある科目がサイトに出ないときは、最初に `app/data/subjects/youran-<年度>.json` への登録を確認する。

## データ生成をやり直す場合

`scripts/gen_data.py` は科目マスタと要件JSONを再構築するが、`offerings` と
`prerequisitesText` を消す可能性がある。単独実行で終えず、次の順で最後まで行う。

```text
python scripts/gen_data.py
python scripts/fetch_syllabus.py
python scripts/build_class_assignment.py
python scripts/build_class_assignment_json.py
python scripts/build_2024_data.py   # 2025年度が土台
python scripts/build_2026_data.py   # 2025年度が土台
python scripts/build_2023_data.py   # 2024年度が土台
python scripts/build_2022_data.py   # 2024年度が土台
python scripts/build_2021_data.py   # 2022年度が土台
python scripts/backfill_missing_offerings.py
python scripts/sync_term_types.py
python scripts/validate_data.py
```

`backfill_missing_offerings.py`は開講情報が空のまま残った科目を、シラバス個別ページの科目番号欄で
確認できたものだけ補う。`sync_term_types.py`は学修要覧とシラバスで学期が食い違う科目を、シラバス側へ合わせる。

生成前に、変更済みのCSVやJSONをコミットしておくと、差分を安全に確認できる。

## 公開前チェックリスト

画面操作を含む詳細な確認手順は、`RELEASE_CHECKLIST.md`を使用する。

- [ ] `python scripts/validate_data.py` が通る
- [ ] `app/`で`npm test`が通る
- [ ] `app/`で`npm run lint`が通る
- [ ] `app/`で`npm run build`が通る
- [ ] 昼間コースのⅠ類・Ⅱ類・Ⅲ類、夜間主コースでプロフィール設定からメイン画面を表示できる
- [ ] 新年度と過去の入学年度（2021年度〜）で、要件・科目一覧・科目詳細の年度が混ざらない
- [ ] 複数クラス科目で、プロフィールに応じた曜日時限とシラバスリンクになる
- [ ] トップのバージョン表記・リリースノートに、計算や科目データへ影響する変更を記載する
- [ ] 正式版の更新なら、リリース日プレートも更新する（バージョンは`app/vite.config.ts`の`SITE_VERSION`）

## Gitと公開の運用

- 通常の修正は `dev` ブランチで行い、コミット・pushする。
- `main` への反映はGitHub Pagesの公開更新を起こすため、公開してよいと確認できたときだけ行う。
  `main` へは直接pushせず、`dev` からのプルリクエスト経由で反映する。
- コミットメッセージは日本語で、何を更新したかを短く書く。
- 重大な不具合を直した場合は、原因・対象・確認方法を `docs/PROGRESS_LOG.md` に残す。

## 判断に迷ったとき

- **要件の数値**: 学修要覧原本を優先する。根拠が不明なら変更しない。
- **科目の存在**: 学修要覧付録Cと公式シラバスの両方を確認する。片方にしかない場合は、
  新設・年度限定・開講なしの可能性を考える。
- **曜日時限が空**: 推測で埋めない。クラス情報・シラバス・時間割PDFを確認する。
- **年度ごとの差分**: 要件の数値や科目表は、前年度と「同一だろう」と推測せず、必ず入学年度の
  学修要覧原本と照合する（過去に、同一と思い込んだ結果の誤りが複数見つかっている）。
  照合した記録は`docs/YOURAN_*_COMPARISON.md`に残す。
