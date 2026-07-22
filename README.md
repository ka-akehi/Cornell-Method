# Cornell Method Notebook MVP

ローカル個人利用向けの Cornell Method Notebook アプリです。Next.js App Router、React、Prisma、SQLite を使い、学習ノートの作成、検索、閲覧、編集、復習、バックアップまでの MVP フローをローカル環境で動かせるようにしています。

MVP の主な機能:

- ノート作成
- 一覧検索
- 詳細閲覧 / 編集 / 復習モード
- Markdown preview
- タグ登録とタグ検索
- SQLite DB バックアップ

認証、ユーザー管理、外部 API 連携はありません。

## セットアップ

前提:

- Node.js
- npm

依存関係をインストールします。

```bash
npm install
```

Prisma Client を生成し、SQLite DB を作成します。

```bash
npm run prisma:generate
npm run prisma:migrate
```

MVP では seed は不要です。`package.json` に seed script はなく、初期データは `/notes/new` の UI または `POST /api/notes` から作成します。

`DATABASE_URL` は未指定の場合、`prisma.config.ts` の設定により `file:./dev.db` を使います。明示したい場合は、プロジェクトルートに `.env` を作り、次のように指定してください。

```env
DATABASE_URL="file:./dev.db"
```

開発サーバーを起動します。

```bash
npm run dev
```

ブラウザで次を開きます。

```text
http://localhost:3000/notes
```

## 主な npm Scripts

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | Next.js 開発サーバーを起動 |
| `npm run build` | 本番ビルドを webpack で実行 |
| `npm run lint` | ESLint を実行 |
| `npm run prisma:generate` | Prisma Client を生成 |
| `npm run prisma:migrate` | Prisma migration を適用し SQLite DB を作成 / 更新 |
| `npm run backup:copy` | SQLite DB ファイルを `backup/` 配下へコピー |
| `npm run diagrams:build` | Mermaid 図を `.mmd` に抽出し、SVG を生成 |

## 主要画面

| パス | 画面 |
| --- | --- |
| `/notes` | ノート一覧。フリーワード、日付、タグ、復習対象で検索 |
| `/notes/new` | ノート作成 |
| `/notes/[id]` | ノート詳細。閲覧、編集、復習モードを切り替え |
| `/backup` | SQLite DB バックアップの作成と一覧確認 |

## MVP 受け入れ材料

受け入れ証跡の正本は [受け入れ証跡マトリクス](doc/testing/TEST_SCENARIOS.md#受け入れ証跡マトリクス) です。各記録に route、画面状態、viewport または API / CLI / 静的照合、確認日、fixture の扱い、判定、参照 summary / 根拠を記録しています。

2026-07-05 時点の MVP 主要 UI フローは Playwright Chromium で検証済みです。操作デモ相当の確認結果は `summary/20260705/mvp-ui-flow-reverification-report.md` を参照してください。ただし、この route-level flow の PASS は NTE-020 の edit レイアウト全 viewport 確認や NTE-030 の mobile runtime 確認まで意味しません。

画面例:

| 画面 | スクリーンショット |
| --- | --- |
| `/notes`: ノート一覧、検索、日付 / タグフィルタ、範囲 validation | [1440px](doc/assets/screenshots/runtime-notes-list-1440.png) |
| `/notes/new`: 新規作成、既存タグ候補選択、自由入力タグ追加 | [375px](doc/assets/screenshots/nte020-policy-c-new-375.png) / [768px](doc/assets/screenshots/nte020-policy-c-new-768.png) / [1280px](doc/assets/screenshots/nte020-policy-c-new-1280.png) / [1440px](doc/assets/screenshots/nte020-policy-c-new-1440.png) |
| `/notes/[id]`: 閲覧、編集保存、復習モード、削除 | [閲覧 1440px](doc/assets/screenshots/runtime-note-detail-view-1440.png) / [編集保存 1440px（主要 UI flow）](doc/assets/screenshots/runtime-note-detail-edit-1440.png) / [復習 1440px](doc/assets/screenshots/runtime-note-detail-review-1440.png) |
| `/backup`: バックアップ一覧表示、バックアップ作成 | [1440px](doc/assets/screenshots/runtime-backup-1440.png) |

### NTE-030 runtime screenshot の確認内容

1440px の実画面では、閲覧／復習がタイトル・学習日／学習元／タグのメタ情報 → Cornell（Cue／本文）→ Summary の基本構造を共有し、復習時に本文領域だけをマスクして表示 / 再マスクできることを確認しています。375 / 768px の閲覧 / 復習 runtime は未確認です。復習時 Summary の初期非表示はコード上の実装状態と、runtime 未確認の事実を分けて扱っています。詳細は証跡マトリクスの `NTE030-MOBILE-375-768` を参照してください。

### QA 証跡の確認済み範囲と未確認範囲

- 確認済み: 2026-07-05 の主要 UI flow、Notes CRUD / validation / review / search、Markdown sanitize / checkbox、`npm run backup:copy`。NTE-020 の `/notes/new` は 375 / 768 / 1280 / 1440px、NTE-030 の `/notes/[id]` 閲覧 / 復習は 1440px を確認済みです。
- 未確認: NTE-020 の `/notes/[id]` edit runtime（2026-07-05 の編集保存フローと、NTE-020 Policy C の edit レイアウト QA は別の確認単位です）、NTE-020 の 375px 長い Markdown / 長いタグ / 長い field error、NTE-030 の 375 / 768px 閲覧 / 復習 runtime。
- MVP 契約との差分: 静的照合で、新規 `nextReviewDate = noteDate + 7日` 初期値が未達です。これは runtime 未実施とは別に `FAIL（静的照合）` として記録しています。復習時 Summary の初期非表示は現行コードへ反映済みですが、対象 viewport の runtime 確認は未実施です。
- Phase 2: autosave、Undo / soft delete、専用復習タスク、NoteCard / D&D、PDF export、タグ管理 UI などは MVP の PASS に含めず、`TEST_SCENARIOS.md` の Phase 2 節で管理します。

### NTE-020 方針Cの実画面確認（新規作成画面）

以下は、NTE-020 方針Cの新規ノート作成画面を実画面で確認したスクリーンショットです。新規作成画面の確認結果であり、`/notes/[id]` の編集画面の確認結果は含みません。

| Viewport | 確認内容 | スクリーンショット |
| --- | --- | --- |
| 375px | Cornell部分のみ横スクロールを許容。 | ![NTE-020 方針C 新規作成 375px](doc/assets/screenshots/nte020-policy-c-new-375.png) |
| 768px | タブレット幅での新規作成画面。 | ![NTE-020 方針C 新規作成 768px](doc/assets/screenshots/nte020-policy-c-new-768.png) |
| 1280px | Cue / Note 約30% / 70%、本文入力とPreviewの横並び。 | ![NTE-020 方針C 新規作成 1280px](doc/assets/screenshots/nte020-policy-c-new-1280.png) |
| 1440px | Cue / Note 約30% / 70%、本文入力とPreviewの横並び。 | ![NTE-020 方針C 新規作成 1440px](doc/assets/screenshots/nte020-policy-c-new-1440.png) |

スクリーンショットを再取得する場合は、開発サーバーを起動してから主要画面を開き、画像を `doc/assets/screenshots/` 配下へ保存してください。

```bash
npm run dev -- -H 127.0.0.1 -p 3000
```

撮影対象:

- `http://127.0.0.1:3000/notes`
- `http://127.0.0.1:3000/notes/new`
- `http://127.0.0.1:3000/notes/[id]`
- `http://127.0.0.1:3000/backup`

`/notes/[id]` は既存データが必要です。空 DB の場合は `/notes/new` から検証用ノートを一時作成し、撮影後に詳細画面の削除操作または `DELETE /api/notes/:id` で削除してください。

## 基本操作

1. `/notes/new` でタイトル、学習日、Cue、本文、サマリー、タグ、次回復習日を入力します。
2. 保存すると `/notes/[id]` の詳細画面へ移動します。
3. `/notes` で作成済みノートを検索します。
4. 詳細画面で閲覧、編集、復習モードを切り替えます。
5. 復習モードでは Cue を見て本文を想起し、本文表示と復習済み更新を行います。Summary の初期非表示は現行契約との差分として証跡マトリクスに記録しています。
6. `/backup` または `npm run backup:copy` で SQLite DB をバックアップします。

## ノートの削除と復元

ノートの削除は詳細画面で確認 UI を表示し、確認後に `DELETE /api/notes/:id` を実行して Notebook を物理削除します。Cue と NotebookTag の関連も cascade で削除されます。MVP では削除後の Undo / 復元を保証しません。

5 秒 Undo Snackbar、ソフトデリート、Undo buffer（`SoftDeleteBuffer`）、`/api/undo`、期限切れ後の purge は現行 MVP には含まれず、Phase 2 以降の機能です。

## データベース

MVP の DB は Prisma + SQLite です。主なモデルは次のとおりです。

- `Notebook`: ノート本体
- `Cue`: キーワード / 質問
- `Tag`: タグ
- `NotebookTag`: ノートとタグの中間テーブル

2026-07-18 の `prisma/migrations/20260718011243_remove_notebook_overview/migration.sql` 適用により、Notebook の旧 overview 列は削除済みです。現行のノート項目はタイトル、学習日、学習元、タグ、Cue、本文、Summary、次回復習日、最終復習日時です。

DB の作成と migration は次で行います。

```bash
npm run prisma:migrate
```

MVP セットアップで seed 実行は必要ありません。空の DB から開始し、検証用データは UI/API 操作で作成します。

Prisma Client の再生成は次で行います。

```bash
npm run prisma:generate
```

## バックアップ

バックアップは SQLite DB ファイルを `backup/` 配下へコピーします。

作成方法:

- 画面から作成: `/backup`
- コマンドで作成: `npm run backup:copy`

仕様:

- バックアップファイルは `backup/` 配下に `.db` として作成されます。
- 最新 3 世代を保持します。
- 4 世代目以降は古いものから削除されます。
- バックアップファイルからの自動復元は MVP 外です。

復元が必要な場合は、アプリを停止した上でバックアップされた `.db` を手動で DB ファイルの場所へ戻す運用になります。
これはバックアップファイルの手動復旧であり、ノート削除後の Undo / 個別復元機能ではありません。

## 検証

基本的な検証コマンド:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run lint
npm run build
```

主要フローの手動確認:

- `/notes/new` でノートを作成できる。
- `/notes` でタイトル、日付、タグ、復習対象による検索ができる。
- `/notes/[id]` で詳細閲覧できる。
- 詳細画面で編集して保存できる。
- 詳細画面の復習モードで本文の表示 / 非表示と復習済み更新ができる。
- `/backup` または `npm run backup:copy` でバックアップを作成できる。

## 設計書

MVP の仕様と設計は次を参照してください。

- `doc/README.md`
- `doc/requirements/MVP_SYSTEM_SPEC.md`
- `doc/workflows/MVP_WORKFLOW_DESIGN.md`
- `doc/screens/MVP_SCREEN_INVENTORY.md`
- `doc/diagrams/MVP_UML_DESIGN.md`
- `doc/technical/MVP_DESIGN_TOOLING_GUIDE.md`
- `doc/design-studio/README.md`
- `doc/api/MVP_API_DESIGN.md`
- `doc/data/MVP_DATA_DESIGN.md`
- `doc/testing/TEST_SCENARIOS.md`

## Design Studio

Google Stitch / Claude Design のように、画面案作成、比較、実装受け渡しを Codex 内で回すための repo-local plugin とテンプレートを用意しています。

初回のみ Codex CLI で marketplace と plugin を追加します。

```bash
codex plugin marketplace add /Users/kazuya/Desktop/自己学習/Cornell-Method
codex plugin add cornell-design-studio@cornell-method-local
```

運用手順とテンプレートは `doc/design-studio/README.md` を参照してください。

## 既知の注意

MVP では次の機能は対象外です。

- 自動保存 / 下書き
- Undo / ソフトデリート復元（Phase 2）
- PDF export
- 専用復習タスク画面
- D&D によるカード並び替え
- バックアップからの自動復元
- 認証、ユーザー管理、共有、外部同期

ビルドは network restricted 環境でも通るよう、Google Fonts 取得を使わず system font stack を使用します。Next.js 16 の Turbopack build は一部 sandbox で port bind 制限に当たるため、`npm run build` は `next build --webpack` を使います。

2026-06-21 時点で `npm audit --audit-level=moderate` は moderate 3 件を報告します。対象は `brace-expansion` と Next.js 経由の `postcss` です。依存更新は MVP final verification では実施していません。

このアプリはローカル個人利用前提です。認証なしで動作するため、共有環境や公開環境への配置は想定していません。

test
