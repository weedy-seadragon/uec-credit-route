# UEC 単位取得ルートナビ

電気通信大学 情報理工学域の学生向けに、「あと何を取れば卒業できるか」を一目で示す非公式サイト。

- 仕様書: [docs/SPEC.md](docs/SPEC.md)
- Claude Code 向けの作業ルール: [CLAUDE.md](CLAUDE.md)

## 状態

- [x] 仕様書 v0.1
- [x] Ⅰ類メディア情報学プログラム（2025年度入学）の要件データ
- [ ] 充足判定ロジック（フェーズ1）
- [ ] メイン画面（フェーズ2）
- [ ] 他プログラム・夜間主のデータ（フェーズ3）

## ディレクトリ

```
CLAUDE.md                     Claude Code が守るルール
docs/SPEC.md                  仕様書
data/requirements/            要件セット（入学年度 × コース × 類 × プログラム）
data/subjects/                科目マスタ（学修要覧由来）
scripts/gen_data.py           要覧の転記データから data/ を生成
scripts/validate_data.py      data/ が別表2・3・4と矛盾しないか検査
```

## データの検証

```
python scripts/validate_data.py
```

## 出典

- 学修要覧（電気通信大学 教務課）: https://kyoumu.office.uec.ac.jp/youran/youran.html
- シラバス: https://kyoumu.office.uec.ac.jp/syllabus/

本サイトは非公式です。履修の最終確認は必ず学修要覧と教務課で行ってください。
