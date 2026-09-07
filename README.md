# UEC 単位取得ルートナビ

電気通信大学 情報理工学域の学生向けに、「あと何を取れば卒業できるか」を一目で示す非公式サイト。

- 公開サイト: https://weedy-seadragon.github.io/uec-credit-route/
- 引き継ぎ資料（前提知識が無い人向けの入口）: [docs/HANDOVER.md](docs/HANDOVER.md)
- Codex向けの作業入口・現状メモ: [CODEX.md](CODEX.md)
- 仕様書: [docs/SPEC.md](docs/SPEC.md)
- ディレクトリ構成の説明: [docs/STRUCTURE.md](docs/STRUCTURE.md)
- Claude Code 向けの作業ルール（現在の状態の要約）: [CLAUDE.md](CLAUDE.md)
- 詳しい進捗の経緯（いつ・なぜ・どう直したか）: [docs/PROGRESS_LOG.md](docs/PROGRESS_LOG.md)

## 状態

- [x] 仕様書 v0.1
- [x] 昼間コース Ⅰ類5・Ⅱ類5・Ⅲ類5プログラム＋夜間主課程、計16課程分の要件データ
- [x] 充足判定・推奨・審査判定ロジック（`src/domain/`、単体テスト付き）
- [x] UI：プロフィール設定・メイン画面・科目一覧・JSON入出力
- [x] シラバス連携（曜日時限・担当教員・リンク。クラスごとに複数セクションがある科目もクラス情報から絞り込み）
- [x] GitHub Pages公開
- [ ] 類専門科目85件の標準年次・学期を、学修要覧PDF画像で目視照合する作業が残っている（[docs/PENDING_YEAR_SEMESTER_CHECKS.md](docs/PENDING_YEAR_SEMESTER_CHECKS.md)参照）

## 使い方（開発）

```
npm install
npm run dev        # 開発サーバー
npm test           # テスト
npm run build      # 型チェック＋本番ビルド
python scripts/validate_data.py   # data/ の整合性チェック
```

ディレクトリの詳しい説明は [docs/STRUCTURE.md](docs/STRUCTURE.md) を参照。

## 出典

- 学修要覧（電気通信大学 教務課）: https://kyoumu.office.uec.ac.jp/youran/youran.html
- シラバス: https://kyoumu.office.uec.ac.jp/syllabus/

本サイトは非公式です。履修の最終確認は必ず学修要覧と教務課で行ってください。
