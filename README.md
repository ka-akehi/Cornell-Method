# Cornell Method Notebook MVP

ローカル個人利用向けの Cornell Method Notebook アプリです。Next.js App Router、React、Prisma、SQLite を使い、学習ノートの作成、検索、閲覧、編集、復習、バックアップまでの MVP フローをローカル環境で動かせるようにしています。

MVP の主な機能:

- ノート作成
- 一覧検索
- 詳細閲覧 / 編集 / 復習モード
- Markdown preview
- タグ登録とタグ検索
- SQLite DB バックアップ

Local は認証を無効化して従来どおり利用できます。Vercel Preview / Production
では、アプリ側の単一ユーザー Basic Auth が page と全 API を保護します。ユーザー管理や
外部 API 連携はありません。

## セットアップ

前提:

- Node.js
- npm

依存関係をインストールします。

```bash
npm install
```

Local では `DATABASE_URL` を Prisma CLI と Next runtime に明示した SQLite URL として共有します。shell で指定した値は `.env` より優先され、未指定時は `file:./dev.db` を使います。`npm run backup:copy` も Local SQLite 専用です。空文字・空白のみ・非 `file:` URL・パスが空の `file:` URL は、別 DB へ fallback せずエラー終了します。`.env` が存在するのに読み込めない場合も fallback せずエラー終了します。custom path を使う場合も、同じプロジェクトルート基準の SQLite URL を設定してください。`file:./relative.db`、`file:/absolute/path.db`、`file:///absolute/path.db` の relative / absolute URL を使用でき、query (`?`)・fragment (`#`) と `file://host/path` の authority は非対応として明示的に拒否します。パス中の `%20` などの percent encoding は decode せず、`encoded%20name.db` という実ファイル名として扱います。

Vercel Preview / Production では `DATABASE_URL` に PostgreSQL runtime URL（Supabase transaction pooler）を必須とし、SQLite fallback は行いません。PostgreSQL の Prisma CLI / migration には `DIRECT_URL` の direct connection URL を使い、runtime が `DIRECT_URL` を参照することはありません。実際の公開環境の URL は環境変数へ設定し、リポジトリへ記載しないでください。

Basic Auth の設定:

```env
# Local は未設定または false で無効。Local で確認するときだけ true にする。
BASIC_AUTH_ENABLED="false"
BASIC_AUTH_USER=""
BASIC_AUTH_PASSWORD=""
```

Local で `BASIC_AUTH_ENABLED=true` にする場合は user / password も設定します。Preview /
Production は `BASIC_AUTH_ENABLED` 未設定でも有効扱いになり、`BASIC_AUTH_USER` または
`BASIC_AUTH_PASSWORD` の欠落、空値、無効な設定、または hosted 環境での
`BASIC_AUTH_ENABLED=false` は fail closed になります。これらの値は Vercel の Preview /
Production 環境変数またはローカルの未追跡 `.env` にだけ設定し、実値をリポジトリへ書かないでください。

Basic Auth は HTTPS 前提です。認証情報は cookie、localStorage、DB、URL query、client-side
code には保存しません。Vercel Deployment Protection は Preview への補助的な保護であり、
アプリ API の認証証跡や Production API の代替ではありません。

```env
DATABASE_URL="file:./prisma/dev.db"
```

Prisma Client を生成し、SQLite DB を作成します。

```bash
npm run prisma:generate
npm run prisma:migrate
```

MVP では seed は不要です。`package.json` に seed script はなく、初期データは `/notes/new` の UI または `POST /api/notes` から作成します。

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
| `npm run postgres:baseline:check` | Postgres MVP baseline SQL と schema の静的境界を確認 |
| `npm run postgres:import` | 明示 source SQLite から空の許可済み検証 target へ import（`--dry-run` 対応） |
| `npm run postgres:reconcile` | 明示 source と許可済み Postgres target を read-only 照合 |
| `npm run postgres:export` | `DIRECT_URL` から明示 output へ logical export を作成する operator CLI |
| `npm run postgres:restore` | 明示 input を isolated target へ single-transaction restore し、T2 reconcile を実行 |
| `npm run postgres:retention:dry-run` | 明示 export directory の日次 7 / 週次 4 retention 候補を表示（削除なし） |
| `npm run postgres:retention:prune` | dry-run 相当の plan を再検査して、確認済み候補だけを削除 |
| `npm run backup:copy` | プロジェクトルートの `.env`（shell の `DATABASE_URL` があればそちらを優先）と同じ SQLite DB を `backup/` 配下へコピー |
| `npm run diagrams:build` | Mermaid 図を `.mmd` に抽出し、SVG を生成 |

Postgres の baseline / import / reconcile は、Vercel build、Next runtime、SQLite backup とは分離した operator-only workflow です。実行前に `npm run prisma:migrate:postgres` で direct connection に baseline を適用し、source は `--source` または `SOURCE_SQLITE_PATH` で必ず明示してください。import target には `DIRECT_URL`、`POSTGRES_TARGET_PROJECT`、`POSTGRES_TARGET_ENVIRONMENT`、`POSTGRES_TARGET_ALLOWLIST`（`project:environment` の完全一致）が必要で、runtime の `DATABASE_URL`、transaction pooler、Production label、既存行の無条件上書きは拒否します。

まず source の freeze / inventory だけを確認する例:

```bash
SOURCE_SQLITE_PATH=/absolute/path/to/frozen.db \
npm run postgres:import -- --dry-run
```

検証 target への実 import / 照合は、URL の実値を shell または secret manager から渡して実行します。以下は値を含まない形の例です。

```bash
DIRECT_URL="$POSTGRES_DIRECT_URL" \
POSTGRES_TARGET_PROJECT=verification-project \
POSTGRES_TARGET_ENVIRONMENT=verification \
POSTGRES_TARGET_ALLOWLIST=verification-project:verification \
SOURCE_SQLITE_PATH=/absolute/path/to/frozen.db \
npm run postgres:import

DIRECT_URL="$POSTGRES_DIRECT_URL" \
POSTGRES_TARGET_PROJECT=verification-project \
POSTGRES_TARGET_ENVIRONMENT=verification \
POSTGRES_TARGET_ALLOWLIST=verification-project:verification \
SOURCE_SQLITE_PATH=/absolute/path/to/frozen.db \
npm run postgres:reconcile
```

失敗時は transaction を完了扱いにせず、source の本文・タイトル・タグ名・Cue text・Canvas text はログへ出しません。詳細な option は各 script の `--help` を確認してください。

### Postgres logical export / restore / retention（operator only）

Postgres の export / restore は、Next.js の route、ブラウザ、Vercel request、Vercel build、`src/server/backup` の Local provider から呼び出しません。operator または CI の Node CLI が direct connection の `DIRECT_URL` と、operator が管理する外部 storage path だけを使います。`DATABASE_URL`、runtime pooler、Production の暗黙 target、repository root、`backup/`、`.next/`、Vercel filesystem は使用しません。

Local SQLite backup との境界は変わりません。`/backup`、`POST /api/backups`、`npm run backup:copy` は SQLite ファイルを `backup/` にコピーし、最新 3 世代を保持する現行 MVP の契約です。Postgres の logical export はこの世代管理や Local API へ混ぜません。

前提として、operator 環境に PostgreSQL client tools（`pg_dump`、custom dump の restore には `pg_restore`、plain SQL の restore には `psql`）を用意し、URL は secret manager または shell の環境変数から渡します。URL、password、token、ノート本文を command output、ログ、README、summary へ展開しないでください。

#### Export

output path と format は必須です。出力先の親 directory は operator が事前に作成した、repository 外の管理対象 storage にしてください。`--format custom` は `.dump`、`--format plain` は `.sql` を使います。

```bash
DIRECT_URL="$POSTGRES_DIRECT_URL" \
npm run postgres:export -- \
  --format custom \
  --output /secure/postgres-exports/postgres-export-2026-07-26T12-00-00Z.dump \
  --allow-unencrypted-staging
```

これは `pg_dump` による暗号化前の staging export です。script は `encrypted: false` と `productionBackupComplete: false` を返します。圧縮方式、暗号化、off-site copy、access control、削除保護は operator / storage provider の責務であり、この repository は storage provider を実装しません。暗号化と off-site copy が完了するまで Production backup 完了として扱わないでください。既存 file の上書きには追加で `--overwrite` が必要です。実行前の command 構成だけを確認する場合は同じ引数に `--dry-run` を付けます。

#### Restore

restore は Production には実装していません。target environment が `prod` / `production` の場合は拒否し、isolated な別 project / DB を第一候補にします。restore target は dump の schema を含むため、T2 import の「baseline 適用済みで空」の target ではなく、current MVP / Phase 2 table と `_prisma_migrations` がまだ存在しない空の database を用意してください。既存 application schema がある場合は停止し、無条件 overwrite、`--clean`、`--create` は行いません。

次の二重確認、direct URL、project / environment と完全一致する allowlist、明示 source をすべて指定します。source は restore 前に freeze された SQLite snapshot で、restore 完了後に同じ snapshot を T2 reconcile へ渡します。

```bash
DIRECT_URL="$POSTGRES_RESTORE_DIRECT_URL" \
SOURCE_SQLITE_PATH=/absolute/path/to/frozen.db \
npm run postgres:restore -- \
  --format custom \
  --input /secure/postgres-exports/postgres-export-2026-07-26T12-00-00Z.dump \
  --target-project verification-project \
  --target-environment verification \
  --allow-target verification-project:verification \
  --confirm-isolated-target \
  --confirm-empty-target
```

restore は `pg_restore` または `psql` の single transaction で実行し、失敗時は成功扱いにしません。成功後は T2 の `postgres:reconcile` と同じ比較を自動実行し、row count、ID set、parent ID / foreign key orphan、scalar / UTC 日時、Canvas `document_json` の hash・deep equality・page geometry・element geometry / points / style / text、`search_text` を確認します。不一致なら exit code 1 で復旧検証未完了とします。command 構成だけの確認は `--dry-run` で行えますが、実 restore の完了判定にはなりません。

restore 後、reconcile が PASS でも、isolated app instance を target DB に接続して synthetic data の CRUD smoke を行ってください。作成 → 一覧 / 詳細取得 → title / Summary / Canvas text の更新 → 再読込・検索確認 → 削除 → 一覧から消えること、の順で確認し、fixture は最後に削除します。実データや個人ノート本文を smoke のログへ書かないでください。Production cutover 前は、少なくとも baseline import target と logical export restore target を分けてこの手順を完了させます。

#### Retention

retention は storage provider や scheduler ではなく、明示された operator-managed directory の filename を読む dry-run / safe prune です。標準 filename は `postgres-export-YYYY-MM-DDTHH-mm-ssZ.sql` または `.dump` で、UTC の filename 日付を基準に最新の異なる 7 日から日次 7 世代、残りから最新の異なる ISO 週 4 世代を保持します。

```bash
POSTGRES_EXPORT_DIR=/secure/postgres-exports \
npm run postgres:retention:dry-run

POSTGRES_EXPORT_DIR=/secure/postgres-exports \
npm run postgres:retention:prune
```

dry-run は削除候補の path をすべて表示します。prune は `--apply --confirm-prune` を要求し、plan 後に file の inode・size・更新時刻を再確認して変化があれば全体を中止します。repository、Vercel filesystem、SQLite `backup/` のファイルは Postgres Production backup として扱わず、暗号化済み off-site copy の保持・削除は operator / storage provider 側で別途管理してください。

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

実操作デモ: [一覧 → 詳細 → 編集 → 保存 → 閲覧 / 再読込（WebM）](doc/assets/demos/mvp-note-flow.webm)（1280 × 900）。

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

`npm run backup:copy` は開始時にプロジェクト直下の `.env` を読み込みます。shell の `DATABASE_URL` は上書きされず、空・空白・非 `file:` URL・空 path の URL、query / fragment 付き URL、authority 付き `file://` URL や、custom path の DB が存在しない場合は fallback の `dev.db` をコピーせずエラーになります。runtime と同じく、percent-encoded path は decode せず URL の文字列どおりの実ファイル名を対象にします。

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
- ユーザー管理、共有、外部同期（Hosted の単一ユーザー Basic Auth は公開境界として別途提供）

ビルドは network restricted 環境でも通るよう、Google Fonts 取得を使わず system font stack を使用します。Next.js 16 の Turbopack build は一部 sandbox で port bind 制限に当たるため、`npm run build` は `next build --webpack` を使います。

2026-06-21 時点で `npm audit --audit-level=moderate` は moderate 3 件を報告します。対象は `brace-expansion` と Next.js 経由の `postcss` です。依存更新は MVP final verification では実施していません。

このアプリは Local では個人利用向けに認証を無効化できます。Vercel Preview /
Production へ配置する場合は、上記の app-level Basic Auth と HTTPS を必ず設定してください。
