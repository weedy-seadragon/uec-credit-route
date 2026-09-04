# UEC 単位取得ルートナビ

電気通信大学 情報理工学域の学生向けに、「あと何を取れば卒業できるか」を一目で示す非公式サイト。

- 仕様書: [docs/SPEC.md](docs/SPEC.md)
- ディレクトリ構成の説明: [docs/STRUCTURE.md](docs/STRUCTURE.md)
- Claude Code 向けの作業ルール（進捗ログ含む）: [CLAUDE.md](CLAUDE.md)

## 状態

- [x] 仕様書 v0.1
- [x] Ⅰ類5プログラム（2025年度入学）の要件データ
- [x] 充足判定ロジック（フェーズ1）
- [x] 最小UI：プロフィール設定・メイン画面・JSON入出力（フェーズ2）
- [ ] GitHub Pages公開（ワークフローは用意済み。リポジトリ設定でSourceをGitHub Actionsにする作業待ち）
- [ ] Ⅱ類・Ⅲ類・夜間主のデータ（フェーズ3、継続中）

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
