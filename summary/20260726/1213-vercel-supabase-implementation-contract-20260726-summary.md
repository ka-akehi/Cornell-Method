---
summary_type: task-summary
created_at: 2026-07-26 12:13 JST
task_kind: worker-task
task_status: done
---

## Objective

Vercel + Supabase Postgres で既存ノートを保持した CRUD 公開を行うため、現行 SQLite MVP を壊さない runtime / migration / import / backup / restore / 認証 / Preview・Production 境界の実施契約を確定する。実装・環境変更は行わず、後続 Worker が 1 目的 1 task で着手できる粒度へ分解する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Prisma / SQLite 固定箇所、Postgres 接続、migration、既存 `dev.db` 行データ移行、CanvasDocumentV1、backup / restore、Vercel 環境分離、認証境界 |
| 対象ファイル / ディレクトリ | `HANDOFF_2026-07-26.md`、指定 summary、`doc/technical/MVP_TECHNICAL_DESIGN.md`、`doc/implementation/MVP_CONTRACT.md`、`prisma/`、`config/project-env.js`、Prisma / backup 実装、API route、`package.json`、`README.md`、関連 Canvas / date helper |
| 対象外 | コード、設定、依存関係、lockfile、schema、migration、生成物、README、設計書、Supabase / Vercel / GitHub / Production DB の変更。Phase 2 の autosave、soft-delete / Undo、review task、NoteCard / D&D、PDF export も対象外 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-26.md` | 現行 MVP クローズ状態、移行手順の既存記述、未確認範囲、既存変更の扱い |
| prior summary | `summary/20260726/0009-document-vercel-supabase-migration-procedure-20260726-2df1bad7-summary.md` | 既存の移行手順 task と `Next Read` |
| contract | `doc/implementation/MVP_CONTRACT.md` | 物理削除、CanvasDocumentV1、MVP / Phase 2 境界、現行 API |
| design | `doc/technical/MVP_TECHNICAL_DESIGN.md` | 既存の Vercel / Supabase 移行順序、ロールバック、公式参照リンク |
| DB / Prisma | `prisma/schema.prisma`、`prisma.config.ts`、`prisma/migrations/*`、`config/project-env.js` | provider、model、migration lock、URL fallback / validation |
| runtime / backup | `src/server/infrastructure/prisma.ts`、`src/server/backup/**`、`scripts/backup-copy.js` | SQLite adapter、singleton、ファイルコピー provider、backup API / CLI |
| API / Canvas | `src/app/api/**`、`src/server/notes/infrastructure/**`、`src/shared/canvas/**`、`src/shared/date/**` | CRUD transaction、検索、Canvas JSON / `searchText`、日時変換 |
| build / docs | `package.json`、`package-lock.json`、`README.md`、`.env.example`、`next.config.ts`、`.gitignore` | build / Prisma scripts、依存、認証未実装、現行 SQLite 運用 |
| official docs | Supabase / Vercel / Prisma の公式 URL（後述） | pooler mode、prepared statement、env、Deployment Protection、backup、`migrate deploy` の判断根拠 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260726/1213-vercel-supabase-implementation-contract-20260726-summary.md` | 本 summary のみ新規作成 | Worker の設計確認結果、実施契約、受け入れ条件、後続 task、未決事項を固定するため |

対象コード、設定、README、設計書、migration、lockfile は変更していない。作業前から存在した `AGENTS.md`、旧 handoff の削除、新 handoff、自動 summary の未コミット変更は保持した。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | `prisma/schema.prisma` の datasource は `provider = "sqlite"`。現行 MVP model は `Notebook`、`NotebookCanvas`、`Tag`、`NotebookTag`、`Cue` の 5 model。`deletedAt` は schema に残るが MVP の soft-delete には使わない。 | `prisma/schema.prisma`、`MVP_CONTRACT.md` |
| F-002 | fact | `src/server/infrastructure/prisma.ts` は `PrismaBetterSqlite3` と `@prisma/adapter-better-sqlite3` を使い、`resolveDatabaseUrl(process.cwd())` を渡す。Next API は `src/lib/prisma.ts` 経由で同じ Prisma instance を使う。 | runtime / repository imports |
| F-003 | fact | `config/project-env.js` は `file:` URL だけを受け付け、未指定時は `file:./dev.db` へ fallback する。現環境に `.env` はなく、実行時に解決された path はリポジトリ直下の `dev.db`。`.env.example` / README の `file:./prisma/dev.db` とは一致しない。 | `resolveDatabaseUrl()` 実測、`.env.example`、README |
| F-004 | fact | リポジトリ直下の `dev.db` は 81,920 bytes、観測時 SHA-256 は `52315d828d0fb357fabe953b43c82eb51d72c9e06b436c73d224bb2597e6e8c5`。`prisma/dev.db` は 0 bytes で SQLite schema を持たない。移行 source は README から推測せず、freeze 時に明示指定する。 | read-only `ls` / `sqlite3` / `shasum` |
| F-005 | fact | 観測した source `dev.db` は Notebook 2、Cue 1、Tag 3、NotebookTag 3、NotebookCanvas 2。Notebook は active 2 / deleted 0、`body_mode=canvas` 2 件、`note_date` は 2026-07-22〜2026-07-25。 | read-only SQLite inventory |
| F-006 | fact | 観測した Canvas は schema version 1、`page` は 1920x1080 が 1 件、1200x800 が 1 件、elements は 7 / 11 件。JSON は 2 件とも valid、standalone text 2、shape text 1、保存 `searchText` は現行 `extractCanvasSearchText()` の結果と 2 件とも一致、FK orphan 0。タイトル・本文・Canvas text の値は summary に転記していない。 | SQLite JSON1 checks、`src/shared/canvas/canvas-document-search.ts` |
| F-007 | fact | 現行 migration は SQLite SQL で、`migration_lock.toml` も `provider = "sqlite"`。`20260718011243_remove_notebook_overview` など既存 migration を Postgres にそのまま `migrate deploy` できない。 | `prisma/migrations/*/migration.sql` |
| F-008 | fact | `package.json` は `build = next build --webpack`、`prisma:generate = prisma generate`、`prisma:migrate = prisma migrate dev`。`postinstall` / `vercel-build` / `migrate deploy` はなく、build が migration を実行する契約もない。 | `package.json` |
| F-009 | fact | backup は `local-sqlite-backup-provider.js` が DB file をプロジェクト内 `backup/` へコピーし、最新 3 世代を prune する方式。`/api/backups` はこの provider を直接呼び、現行 API route 群と tags / notes API に認証 gate はない。middleware / login / session 実装もない。 | backup / API route inventory、MVP contract |
| F-010 | fact | `npm run lint`、`npm run build`、`npx prisma validate`、`npx prisma migrate status` は現行 SQLite 状態で成功した。`migrate status` は 3 migrations applied / schema up to date と報告した。 | 実行結果は下記 Verification |
| F-011 | fact | Vercel の serverless filesystem は SQLite の共有永続 storage として使えない。Supabase は serverless には Supavisor transaction mode（port 6543）、migration / `pg_dump` / restore には direct connection を案内している。transaction mode は prepared statements 非対応。 | 公式資料（後述） |
| F-012 | assumption | Supabase Postgres を第一候補として採用し、Preview と Production は別 Supabase project、Local は既存 SQLite とする。これを最低限の公開境界として後続 Worker に適用する。 | 発注者の目的、Vercel / Supabase 公式資料、個人ノート保護のリスク |
| U-001 | unknown | Prisma schema / generated client / migration directory を SQLite と Postgres の両方で同一 checkout から扱う具体方式は未決定。provider は static であり、Postgres 化で現行 SQLite の `migrate dev` と adapter を無条件に維持できるとは仮定しない。 | Prisma provider と現行構成。後述の blocker |
| U-002 | unknown | `@prisma/adapter-pg` の採用 version で Supavisor transaction mode の prepared statement 無効化を `?pgbouncer=true` で行えるか、または adapter option が必要かは実接続で未確認。 | Supabase troubleshooting と実依存未導入 |
| U-003 | unknown | Supabase plan、migration runner の IPv6 到達性 / IPv4 add-on、native backup / PITR の費用・保持期間は未決定。direct URL が IPv6-only の場合、runner 側の到達性確認が必要。 | Supabase connection / backup docs、外部環境未作成 |

## Implementation Contract

### 1. Runtime / migration / import 接続の分離

公開版の環境変数は次の役割を固定する。値は Vercel / Supabase の Secret に登録し、コード、summary、ログには実値を書かない。

| 変数 | 用途 | Local | Preview | Production |
|---|---|---|---|---|
| `DATABASE_URL` | Next runtime の Prisma adapter 専用 | 明示した `file:./dev.db`。source の曖昧な fallback を避ける | Supavisor transaction pooler の Postgres URL（port 6543、TLS、prepared statements 無効化の設定を含む） | Preview と別 project の Supavisor transaction pooler URL（同じ制約） |
| `DIRECT_URL` | Prisma CLI、migration、import、logical export / restore の operator / CI 専用 | 通常の SQLite 作業では不要。Postgres migration 作業時だけ target direct URL | Preview DB の direct URL（migration runner のみ） | Production DB の direct URL（切替担当の明示操作のみ） |
| `SOURCE_SQLITE_PATH` または同等の明示引数 | one-off import の source SQLite | freeze した直下 `dev.db` を明示。`DATABASE_URL` と target URL を兼用しない | 通常未設定 | 通常未設定 |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | 個人利用の app auth | auth disabled を許可 | 必須 | 必須 |
| `BASIC_AUTH_ENABLED` | app auth の有効化 | `false` | `true` | `true` |

`DATABASE_URL` は runtime の pooler に限定し、Prisma client は module-level singleton を warm invocation 間で再利用する。request ごとに `new PrismaClient()` や `$disconnect()` を行わない。`DIRECT_URL` を runtime の query に使わず、transaction pooler へ migration を流さない。

Supabase の transaction mode には `pgbouncer=true` 相当の prepared statement 無効化が必要という公式案内がある。ただし Prisma 7 driver adapter の実装方式は Worker が実接続で検証し、URL query だけで動くと推測しない。検証に失敗した場合は adapter 側設定または Supavisor session mode / direct runner の採否を owner に戻す。

本番・Preview の未設定時に `file:./dev.db` へ fallback してはいけない。Local の SQLite fallback は現行 MVP のために残してよいが、`VERCEL=1` または `VERCEL_ENV` が `preview` / `production` の場合は required env missing を fail closed にする。

### 2. Prisma schema / migration の境界

- 現行 SQLite migration SQL は Local 用として保持し、Postgres に適用しない。
- Postgres 側は最終 MVP schema（5 model、snake_case mapping、FK cascade、Canvas の `document_json` / `search_text` を text として保持）から hand-reviewed な新規 baseline / migration history を作る。
- Postgres schema migration（テーブル・index・unique・FK）と、既存 SQLite の行データ import は別コマンド・別 review 単位にする。
- `prisma migrate dev` は disposable な開発 / migration 作成環境だけで使う。Preview / Production は承認済み SQL を `prisma migrate deploy` で direct URL に適用する。`prisma db push` を本番 migration の代わりにしない。
- Vercel build は `prisma generate` と `next build --webpack` だけに限定する。候補は `npm run prisma:generate && npm run build`。build に `migrate dev` / `migrate deploy` / import / backup を含めない。
- `prisma generate` が `prisma.config.ts` の `DIRECT_URL` を必要とする場合の secret 可視範囲は Worker が確認する。direct URL を runtime bundle や client-side env に公開しない。
- Local SQLite を壊さないため、Postgres schema/config/migration path と generated client の共存方式を先に決める。別 schema / config / migration directory / generated output を採るか、owner が Local を Postgres へ切り替える決定をしない限り、現行 `schema.prisma` と `migrations` を上書きしない。

### 3. `dev.db` の schema migration と行データ移行

推奨手順は次の順序で固定する。

1. **Source freeze**: アプリを停止し、書き込みを止める。`dev.db` の明示 path、SHA-256、migration status、5 table の件数、date range、body mode、Canvas metadata を記録する。今回の観測値（F-004〜F-006）は参考 baseline であり、実移行直前に再取得する。hash が変わったら import を開始しない。
2. **Target schema**: 空の Preview / QA Supabase project に Postgres baseline migration を direct URL で適用する。schema migration 成功後に `information_schema`、Prisma migration table、FK / unique / index を確認する。
3. **Row import**: one-off import script を operator / CI で実行し、target は空 DB か、再実行時は新しい検証 project とする。`Notebook` と `Tag` を先に importし、`Cue`、`NotebookCanvas`、`NotebookTag` を FK 順に移す。ID、nullable、UTC の日時、`bodyMode`、`body`、`summary`、`nextReviewDate`、`reviewedAt`、`createdAt`、`updatedAt`、`deletedAt` を保持する。既存 MVP では `deletedAt` は通常 null のまま扱い、soft-delete の意味を追加しない。
4. **Canvas preservation**: `document_json` を parse → 再描画して作り直さず、保存済み JSON と `search_text` を移す。`schemaVersion`、`page.width` / `page.height`、element の `id` / `type` / geometry（`x`, `y`, `width`, `height`, `rotation`, `points`, `z`）、`style`、`text`、`textStyle` を保持する。page 寸法のための新 DB column、geometry の自動 fit / clip / scale、`searchText` の別形式への再生成を追加しない。
5. **Reconciliation**: 下記受け入れ条件を全て満たすまで Production に切り替えない。source と export は read-only で保持する。
6. **Production import**: Preview / QA の照合、backup / restore drill、認証 QA の全 PASS 後に、Production project へ同じ schema migration → row import → reconciliation を実施する。Production は import 完了・接続確認後にだけ有効化する。

### 4. 移行受け入れ条件

- **件数 / FK**: `Notebook`、`Cue`、`Tag`、`NotebookTag`、`NotebookCanvas` の件数が source と target で一致する。各 table の ID set、NotebookTag / Cue / Canvas の親 ID set が一致し、orphan / duplicate / unexpected null が 0 件。
- **代表行**: 決定的に選んだ複数の Notebook（Canvas 1200x800、非既定寸法 1920x1080、Cue / Tag がある行、Summary / review date がある行）について、タイトルを含む全 scalar、tag name/color、Cue text/order、日時の UTC millisecond を一致させる。個人内容はログ・summary へ出さない。
- **Canvas JSON**: 各 Canvas の `documentJson` を `JSON.parse` した deep equality と SHA-256、`schemaVersion`、page 寸法、全 element の geometry / points / style / text / textStyle / z を比較する。`searchText` は保存値と `extractCanvasSearchText()` の結果が一致し、source と target で変化しない。
- **Canvas behavior**: 検証用 copy 上で page 寸法だけを変更して保存し、既存 element の geometry / points / style / text と `searchText` が変わらないこと、再読込で同一 JSON が得られることを確認する。これは page 外要素を削除・移動・縮小しない現行 Canvas 契約の確認である。
- **CRUD / search**: Postgres Preview で create → GET → PATCH → GET → list/search を行い、title、legacy Markdown body、Summary、Cue、Canvas text、tag、date filter が現行 API 契約どおり動く。再デプロイ後もデータが残る。
- **削除**: 確認 UI 後の `DELETE /api/notes/:id` が 204、詳細 GET が 404、一覧検索に残らない。Cue / NotebookTag / Canvas の cascade を確認する。soft-delete、Undo、復元 API、draft は追加しない。
- **認証**: 未認証の page と `GET/POST/PATCH/DELETE /api/notes`、review、tags、backup がノートデータを返さず 401 相当になる。正しい認証で既存 CRUD が通る。認証情報、ノート本文、接続 URL は build / function log に出ない。

### 5. Vercel Local / Preview / Production

| 境界 | DB | 設定 / migration | データ方針 |
|---|---|---|---|
| Local | 既存 SQLite `dev.db` | `DATABASE_URL` のみ。Local backup provider 可。通常は migration dev のみ | 現行個人ノート。今回の移行中は read-only source |
| Preview | Production と別の Supabase project（少なくとも別 DB） | `DATABASE_URL` は transaction pooler。direct URL は migration runner。build は generate + Next build のみ | synthetic / 移行コピーのみ。Production ノートを Preview に置かない |
| Production | Preview と別の Supabase project | schema migration と import を deployment 前に完了。runtime は transaction pooler。direct URL は operator / CI のみ | 凍結 source と照合済みのノートのみ |

Vercel の branch Preview が共有 QA project を使う場合も Production URL へ接続する変数を設定しない。branch-specific Preview env は必要時だけ用い、実データを含む Preview を公開しない。Vercel の env 変更は新しい deployment にだけ反映されるため、変更後に再デプロイして接続先を確認する。

### 6. Backup / export / restore

SQLite の `backup/` file copy、Vercel filesystem、repository 内 `.db` は Production backup として扱わない。現行 `local-sqlite-backup-provider.js` は Local SQLite 用に閉じ込め、Postgres 公開版では別 provider / operator workflow にする。`BackupLog`、retry、PDF など Phase 2 のモデル・機能を追加しない。

候補と推奨は次のとおり。

| 候補 | 用途 | 契約上の扱い |
|---|---|---|
| Supabase managed daily backup / PITR | provider-level disaster recovery | Plan、retention、downtime を確認して有効化。free 相当ではこれだけを前提にしない |
| Supabase CLI `db dump` または `pg_dump` | logical schema + data の off-site export | 推奨。direct URL で operator / CI から実行し、Vercel の request から実行しない |
| restore to isolated project | 復元検証 / 障害切替 | 最初から Production を上書きせず、別 project / DB に復元して reconciliation 後に接続先を切り替える |

最低限の保持案は、migration 前 export を受け入れ完了まで保持し、Production は暗号化した off-site logical export を日次 7 世代 + 週次 4 世代保持すること。Supabase plan の native backup / PITR は追加の復旧層とし、free plan を選ぶ場合でも日次 logical export と restore drill がない状態は Production blocker とする。最終 retention、保存先、費用は owner が決定する。

Production 前に少なくとも 1 回、export を新しい検証 project へ restore し、migration / row count / Canvas JSON / CRUD / search / physical delete を確認する。Supabase の native restore は project downtime、custom role password の再設定、Storage object が DB backup に含まれない点を runbook に明記する。現行 MVP は添付対象外のため Storage object の移行は行わない。

### 7. 認証 / 個人ノート保護

現行 MVP は `MVP_CONTRACT.md` のとおり認証なしで、Vercel Deployment Protection もアプリ側 middleware もない。Vercel Authentication の Standard Protection は Preview / deployment URL の保護には使えるが、Hobby では production domain が public のままになる。Production domain まで Vercel 側だけで閉じる場合は plan / add-on の確認が必要である。

Manager 推奨は、Preview に Vercel Standard Protection を適用し、Production は app-level single-user Basic Auth を page と全 `/api/*` に実装すること。`BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` は環境変数、TLS 前提、Local のみ無効化可とする。Supabase Auth / browser Data API / RLS をこの移行の必須実装へ混ぜない。Prisma server connection を browser に露出せず、Supabase Data API を使わない構成を選ぶ場合は公式 guide の案内に従い Data API の必要性を別途確認する。

Production acceptance は、未認証の一覧・詳細・検索・tags・review・backup API がノートを返さないことを実測してから成立する。Deployment Protection の設定だけを API 認証の実装証跡にしない。

## Follow-up Worker Tasks

前提として、発注者は「Supabase Postgres を採用」「既存 `dev.db` を移行」「Preview / Production を分離」「Production の app auth 方式」「backup retention」を決める。`U-001` / `U-002` の検証が終わるまで、`DATABASE_URL` だけを差し替える task は投入しない。

| ID / queue | 目的（1 task 1 outcome） | 依存 | 完了条件 |
|---|---|---|---|
| T1 / `codex-queue/tasks` | Postgres runtime / Prisma / URL 解決 / build 境界を実装する | owner の dual-provider 方針、認証方針 | `@prisma/adapter-pg` 等の依存と lockfile、Postgres runtime singleton、transaction pooler / direct CLI 分離、Vercel fail-closed、generate + build 境界、Local SQLite 非破壊を検証。prepared statement と IPv6 / direct runner を実測 |
| T2 / `codex-queue/tasks-api` | Postgres schema migration と `dev.db` one-off import / 照合を実装する | T1、freeze source、Preview QA DB | SQLite migration SQL を再利用せず Postgres baseline/history を適用。source hash、5 table 件数、ID / scalar / FK、Canvas JSON / searchText、CRUD / physical delete の acceptance を記録。失敗時は Production 切替なし |
| T3 / `codex-queue/tasks` | Postgres backup / export provider と restore runbook を実装する | T1、Supabase plan / off-site storage decision | Local file provider と Production provider を分離。direct URL logical export、retention、isolated restore drill、復元後 reconciliation、秘密情報非出力を検証。Production の `/api/backups` を provider 実装なしで有効化しない |
| A1 / `codex-queue/tasks-api`（T4 前の必須先行） | 個人ノート向け app auth gate を実装する | owner の auth choice、T1 の runtime | page と全 `/api/*` の未認証拒否、正しい認証、Local disable、401 JSON、秘密 / note log 非出力を検証。Vercel Protection 単独で済ませる場合は owner の plan 決定と API 実測を代替証跡にする |
| T4 / `codex-queue/tasks` | Preview runtime QA を実施する | T1〜T3、A1、Preview env / QA DB | Preview で build log に SQLite adapter / file fallback / migration 実行がなく、auth、CRUD、Canvas、検索、物理削除、再デプロイ永続性、backup restore 結果が全 PASS。失敗時は Production へ進めない |
| T5 / `codex-queue/tasks` | Production schema / import / cutover を実施する | T4 PASS、owner decisions、pre-migration export | Production direct migration → row import → reconciliation → runtime env → deploy の順で実施。post-deploy CRUD / Canvas / search / delete / auth smoke と rollback pointer を記録。Production secret / DB を task 外で作らない |

`A1` は要求された 5 運用 task の外に見えるが、現行 API が未認証であるため T4 / T5 の前提から省略できない。T1 に吸収する場合も、完了条件と review scope に auth を明記する。

## Blockers / Owner Decisions

| ID | 決める人 | 選択肢 | 影響 | 推奨 |
|---|---|---|---|---|
| D-001 | 発注者 | Supabase Postgres / Neon 等 / SQLite 互換 DB | adapter、migration、backup 手順が変わる | Supabase Postgres を第一候補として確定し、他候補比較を長引かせない |
| D-002 | 発注者 | `dev.db` import / 空 DB 開始 | 既存ノート保持の可否、Production cutover の有無 | 既存ノート保持のため import。source hash を freeze |
| D-003 | 発注者 | Preview / Production 別 project / 同一 project の別 schema | 誤書き込み、backup、restore の隔離強度 | 別 Supabase project。少なくとも別 DB を保証 |
| D-004 | 発注者 | Vercel paid All Deployments / app Basic Auth / Production を公開しない | 個人ノートと production domain の保護 | 無料範囲を優先し、Preview は Vercel Protection、Production は app Basic Auth |
| D-005 | 発注者 | native backup/PITR のみ / logical off-site export / 両方 | 料金、保持、復旧可能性 | logical daily export + off-site retention を必須、native は追加層 |
| D-006 | 発注者 + T1 Worker | Local SQLite を維持する dual config/client / Local も Postgres へ切替 | generated client、schema、migration path、README 手順が変わる | Local SQLite を壊さない dual strategy を先に spike。成立しなければ実装を止めて方針再確認 |
| B-001 | T1 Worker | `pgbouncer=true`、adapter option、session mode | transaction pooler の prepared statement error / connection exhaustion | transaction pooler + prepared statement 無効化を実接続で証明。失敗を隠さない |
| B-002 | T1/T2 Worker | direct IPv6 runner、IPv4 add-on、承認済み session alternative | migration / dump が実行不能 | direct connection を第一候補にし、runner の IPv6 到達性を先に確認 |
| B-003 | T1/T4 Worker | SQLite `contains` と Postgres `contains` の検索意味差 | ASCII の大小文字や日本語検索結果の差 | 代表検索 fixture で差を測り、現行 API 契約を変える場合は owner 承認を取る |

Worker は上表の未決事項を推測で埋めず、実測結果・選択肢・影響を summary に返す。特に provider を Postgres に変えた後も現行 SQLite generated client が自動で使える、transaction pooler が prepared statements を受け付ける、Vercel Standard Protection が production domain を閉じる、という前提は置かない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 完了 | `AGENTS.md` modified、旧 handoff deleted、新 handoff / 自動 summary untracked。全て保持 |
| SQLite source inventory | 完了 | root `dev.db` を read-only で確認。`prisma/dev.db` は 0 byte で source にしない |
| `npm run lint` | PASS | 現行コードの静的確認。コード変更なし |
| `npm run build` | PASS | `next build --webpack`、TypeScript、static page generation 完了。現行 route 一覧を確認 |
| `npx prisma validate` | PASS | SQLite schema valid |
| `npx prisma migrate status` | PASS | root `dev.db`、3 migrations applied、schema up to date |
| 公式資料照合 | 完了 | URL と判断根拠を下記に記録 |
| 作業後 `git status --short` | 完了 | 下記の状態。対象コード / 設定 / docs の意図しない変更なし |

## Official References

- [Supabase: Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) — serverless runtime は Supavisor transaction mode、migration / `pg_dump` / restore は direct connection を使う接続分離の根拠。
- [Supabase: Prisma](https://supabase.com/docs/guides/database/prisma) — `@prisma/adapter-pg`、serverless では transaction pooler、Prisma config は migration 用 `DIRECT_URL` を使う構成の根拠。
- [Supabase: Prisma troubleshooting](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting) / [Disabling prepared statements](https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL) — transaction mode の prepared statement 非対応と `pgbouncer=true` 検証の根拠。
- [Supabase: Database Backups](https://supabase.com/docs/guides/platform/backups) — plan 別 daily backup、free tier の logical `db dump` / off-site recommendation、restore downtime、PITR、custom role password の扱いの根拠。
- [Vercel: Is SQLite supported in Vercel?](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel) — ephemeral / non-shared filesystem のため SQLite file を永続 DB にしない根拠。
- [Vercel: Environments](https://vercel.com/docs/deployments/environments) / [Environment variables](https://vercel.com/docs/environment-variables) — Local / Preview / Production と environment-scoped secrets の根拠。
- [Vercel: Deployment Protection](https://vercel.com/docs/deployment-protection) — Hobby Standard Protection の production domain 境界、All Deployments の plan 境界の根拠。
- [Vercel: Builds](https://vercel.com/docs/builds) — build は deployment の build step であり、DB migration を build command に混ぜない境界を確認する資料。
- [Prisma: Database connections](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections) / [Prisma: `migrate deploy`](https://www.prisma.io/docs/cli/migrate/deploy) — serverless singleton / connection pool と non-development migration 適用の根拠。

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | SQLite と Postgres の schema / migration / generated client を同一 checkout で共存させる方式 | T1 の小さな spike と local SQLite + Preview Postgres の両方の build / CRUD 実測。成立しなければ owner decision D-006 |
| U-002 | Prisma 7 `@prisma/adapter-pg` + Supavisor transaction mode の prepared statement 設定 | 実際の package version と Preview DB を使った connect / transaction / concurrent request test |
| U-003 | direct URL の IPv6 到達性、Supabase plan、backup/PITR retention と費用 | migration runner の network check、発注者の plan / storage decision |
| U-004 | app Basic Auth を採るか、Production を閉じる Vercel plan を買うか | 発注者の D-004 決定と API / page unauthorized QA |
| U-005 | `dev.db` を実移行する時点の件数 / hash | source freeze 時に再取得。今回の F-004〜F-006 は途中時点の観測値 |
| U-006 | Postgres の `contains` 検索の大小文字・locale 挙動と SQLite との差 | T1/T4 の代表 fixture、契約差があれば owner approval |

## Rollback Conditions

- source hash が freeze 前後で変わった、schema migration が target で不完全、行件数 / ID / scalar / FK / Canvas JSON / `searchText` が 1 件でも不一致、認証なし API がデータを返した場合は Production 切替を中止する。
- import failure は source `dev.db` と pre-import backup を read-only で保持し、検証用 target を作り直して再実行する。source や Local MVP を編集して帳尻を合わせない。
- Production schema migration 後に旧 app へ戻すのは schema が後方互換な場合だけ。非互換なら migration SQL を手編集して戻さず、forward-fix または isolated restore 後の接続切替を行う。
- Production で書き込み障害が起きたら書き込みを止め、最後の正常 deployment を維持し、export / backup と logs を保全する。restore は isolated target で検証してから connection secret / deployment を切り替える。

## Next Read

後続 Worker はまず次を最小順で読む。

- `summary/20260726/1213-vercel-supabase-implementation-contract-20260726-summary.md`
- `HANDOFF_2026-07-26.md`
- `doc/implementation/MVP_CONTRACT.md`
- `prisma/schema.prisma`
- `prisma/migrations/migration_lock.toml`
- `src/server/infrastructure/prisma.ts`
- `config/project-env.js`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`

T2 で移行実装を開始する場合は、T1 の完了 summary と、source freeze 時に再取得した `dev.db` inventory を追加で読む。raw log、個人ノート本文、実 URL / password / token は次回入力にしない。
