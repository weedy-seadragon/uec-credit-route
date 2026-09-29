# UEC 単位取得ルートナビ

電気通信大学 情報理工学域の学生向けに、「あと何を取れば卒業できるか」を一目で示す**非公式**の静的Webサイトです。
入学年度・コース・類・プログラム・取得済みの科目を入力すると、卒業要件の充足状況と、残りの必修・区分ごとの不足が分かります。

**公開サイト: https://weedy-seadragon.github.io/uec-credit-route/**
**初めて見る人・引き継ぐ人は、まず [引き継ぎ資料（docs/HANDOVER.md）](docs/HANDOVER.md) から。**

> 本サイトは非公式です。履修の最終確認は必ず学修要覧と教務課で行ってください。

## できること

- **要件の充足判定**：必修・選択・自由科目の区分別の不足、共通単位への算入、その他の認定単位を表示
- **審査の判定**：2年次終了時審査・卒業研究着手審査・卒業審査に対して、足りない条件を一覧表示
- **履修状態の記録**：未履修・修得・修得見込・不合格を科目ごとに記録し、見込みを含めた進み具合を確認
- **学期別の修得推奨**：学年・学期を選ぶと、その学期に取りたい必修・再履修・選択科目を推奨順に表示
- **時間割プレビュー**：修得見込の科目を前学期・後学期の週間時間割に並べて、曜日時限の重なりを確認（履修登録・卒業判定には影響しません）
- **クラス別の開講情報**：クラスごとに教員や時限が違う科目は、プロフィールのクラス情報から曜日時限とシラバスリンクを絞り込み
- **科目一覧・詳細**：科目の要件上の位置づけ、開講情報、シラバスへのリンクを確認
- **データの持ち運び**：入力内容をJSONでダウンロード・読み込み・リセット。データは**ブラウザの中だけ**に保存され、サーバーには送られません

## 対応範囲

- **入学年度**：2021〜2026年度（2021・2022年度は15課程、2023年度以降は16課程）
- **課程**：昼間コースの Ⅰ類・Ⅱ類・Ⅲ類の各プログラムと、夜間主課程
- 卒業要件の数値・科目表は、入学年度の学修要覧原本と照合しています。曜日時限・担当教員・シラバスURLは、原則として2026年度の公式シラバスに基づきます
- **対象外**：履修上限（CAP制）のチェック、履修登録の代行、学務情報システムへの自動ログイン、シラバス本文の転載

## 使い方（開発）

Webアプリ本体・設定・静的データは `app/` にまとまっています。

```text
cd app
npm install
npm run dev        # 開発サーバー
npm test           # テスト
npm run lint       # 静的解析
npm run build      # 型チェック＋本番ビルド
cd ..
python scripts/validate_data.py   # app/data/ の整合性チェック
```

技術構成は TypeScript + React + Vite（GitHub Pages 向けに HashRouter）、テストは Vitest、データ更新スクリプトは Python です。
`main` ブランチへの push で GitHub Actions が自動的に公開サイトを更新します。通常の開発は `dev` ブランチで行います。

## ディレクトリ構成

```text
app/       Webアプリ本体（src/ ソース、data/ 要件・科目データ、public/ 静的ファイル）
scripts/   データ生成・取得・検証用のPythonスクリプト
docs/      仕様書・現状・作業の経緯
```

詳しくは [docs/STRUCTURE.md](docs/STRUCTURE.md) を参照してください。

## ドキュメント

- [docs/SPEC.md](docs/SPEC.md)：機能とデータモデルの仕様
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)：現在の実装状況と確認候補
- [docs/PROGRESS_LOG.md](docs/PROGRESS_LOG.md)：いつ・なぜ・どう直したかの時系列の記録
- [docs/HANDOVER.md](docs/HANDOVER.md)：前提知識のない人向けの引き継ぎ資料
- [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)：公開前の主要導線チェック
- [AGENTS.md](AGENTS.md)・[CODEX.md](CODEX.md)：AIコーディングエージェント向けの作業規則と入口
- [NOTICE.md](NOTICE.md)：著作権・利用上の注意

## 出典

- 学修要覧（電気通信大学 教務課）: https://kyoumu.office.uec.ac.jp/youran/youran.html
- シラバス: https://kyoumu.office.uec.ac.jp/syllabus/
