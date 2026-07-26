---
summary_type: task-summary
created_at: 2026-07-26 JST
task_kind: worker-task
task_status: done
---

## Objective

既存の SQLite MVP を変更せず、Postgres MVP baseline、明示 source の read-only freeze、空の許可済み target への one-off import、件数 / ID / FK / scalar / Canvas JSON / `searchText` の reconciliation workflow を実装した。

## Scope

Postgres baseline migration、operator-only import / reconcile scripts、fixture / dry-run / static validation、必要な package script / README / test のみを対象にした。実 Supabase / Vercel / Production DB、認証、backup provider、UI、Canvas editor、Phase 2 model は対象外とした。

## Inputs Read

- `summary/20260726/t1-postgres-runtime-boundary-20260726-summary.md`
- `summary/20260726/1250-implement-postgres-runtime-prisma-boundary-20260726-7294af5a-summary.md`
- `summary/20260726/1213-vercel-supabase-implementation-contract-20260726-summary.md`
- `HANDOFF_2026-07-26.md`
- `AGENTS.md`
- `prisma/schema.prisma`、`prisma/schema.postgres.prisma`、既存 SQLite migrations
- `prisma.config.ts`、`config/project-env.js`、`package.json`、既存 scripts / tests
- CanvasDocumentV1 types / validation / search contract

## Changes Made

| Path | Change |
|---|---|
| `prisma/migrations-postgres/20260726000000_postgres_baseline/migration.sql` | 5 model の hand-reviewed Postgres baseline。snake_case、PK、unique/index、cascade FK、nullable、`TIMESTAMP(3)`、Canvas JSON / `search_text` の text 保存を定義。SQLite SQL の流用なし。 |
| `prisma/migrations-postgres/migration_lock.toml` | Postgres migration path の provider を固定。 |
| `scripts/postgres-migration-common.js` | source snapshot / SHA-256 / schema・migration inventory、read-only SQLite reader、UTC 日時正規化、target direct URL / safety guard、FK 順 import、ID・FK・null・scalar・Canvas reconciliation の共通実装。 |
| `scripts/postgres-import.js` | `--source` または `SOURCE_SQLITE_PATH` を必須にした dry-run / import CLI。target は `DIRECT_URL`、明示 project/environment/allowlist、baseline 済みかつ 5 table が空の場合のみ。transaction 内で commit 前 reconciliation を実行。 |
| `scripts/postgres-reconcile.js` | target を変更せず source / target を照合する CLI。 |
| `scripts/postgres-baseline-check.js` | Postgres schema / baseline SQL が SQLite 専用 SQL、旧 `overview`、Phase 2 table を含まないことを静的確認。 |
| `test/postgres/data-migration-contract.test.js` | baseline 境界、明示 source dry-run、本文非出力、Canvas JSON / geometry / `searchText` mismatch 検出を fixture で検証。 |
| `package.json` / `package-lock.json` | `postgres:baseline:check`、`postgres:import`、`postgres:reconcile` script と operator 用 `pg` dependency を追加。build / runtime / backup には混入させていない。 |
| `README.md` | operator-only workflow、source 明示、`DIRECT_URL` / target allowlist、dry-run / import / reconcile の値を含まない実行例を追記。 |

既存の `prisma/schema.prisma`、`prisma/migrations/`、root `dev.db`、既存の T1 未コミット変更は変更していない。Phase 2 の draft / review / soft-delete / Undo / NoteCard / CueCard / backup log は追加していない。

## Findings

- source path に暗黙の `DATABASE_URL` や README の path を使わず、`--source` / `SOURCE_SQLITE_PATH` を要求する。`realpath`、regular file、非空、WAL/SHM sidecar 不在を確認する。
- source は `better-sqlite3` read-only または `sqlite3 -readonly` で開き、更新・削除・vacuum は行わない。読み取り前後、transaction 開始前、commit 直前に SHA-256 を再確認する。
- source の Prisma migration state、必要 column、integrity、FK orphan、duplicate、required null、date range、body mode、Canvas page / element count / hash metadata を収集する。個人ノート本文、タイトル、タグ名、Cue text、Canvas text は report に出さない。
- target は `DIRECT_URL` のみを使う。`DATABASE_URL` と同一値、`pgbouncer=true`、port `6543`、Production label、暗黙 default を拒否する。project / environment と `POSTGRES_TARGET_ALLOWLIST=project:environment` の完全一致を要求する。
- target は Postgres baseline migration 済み、Phase 2 table 不在、5 application table が空であることを確認する。既存行があれば無条件上書きせず停止する。
- import 順序は Notebook → Tag → NotebookCanvas → Cue → NotebookTag。`document_json` と `search_text` は parse 後に再描画 / 再生成せず、保存値をそのまま parameter insert する。
- import は `SERIALIZABLE` transaction、UTC session、table lock で実施し、件数 / ID set / parent ID set / FK orphan / duplicate / unexpected null / 全 scalar / UTC millisecond / Canvas page・element の geometry、points、style、text、textStyle、raw JSON hash / deep equality、`searchText` を commit 前に照合する。
- import / reconcile は Vercel request、Next runtime pooler、build、SQLite backup から独立した Node operator script として分離した。

## Source Freeze Observation

実移行の固定値として hardcode せず、dry-run 時点で再取得した観測値のみを記録する。

- 明示 source: repository root の `dev.db`
- bytes: `81920`
- SHA-256: `52315d828d0fb357fabe953b43c82eb51d72c9e06b436c73d224bb2597e6e8c5`
- current counts: Notebook 2、Cue 1、Tag 3、NotebookTag 3、NotebookCanvas 2
- current note date range: `2026-07-22` 〜 `2026-07-25`
- current body mode: `canvas` 2
- current Canvas metadata: schema version 1、page `1200x800` / `1920x1080`、element count 11 / 7。JSON / element は hash と field comparison の対象だが、値はこの summary に転記していない。
- source migration state は観測した 3 migration が完了状態。次回の実移行直前に必ず再取得する。

## Verification

| Command / check | Result |
|---|---|
| `node --check scripts/postgres-*.js` | PASS |
| `npm run postgres:baseline:check` | PASS |
| `node --test test/postgres/data-migration-contract.test.js` | PASS（4 tests） |
| `SOURCE_SQLITE_PATH=dev.db node scripts/postgres-import.js --dry-run` | PASS。target 接続なし、source inventory / schema / hash を出力 |
| `node --test` | 既存依存欠落で全体 FAIL。実行時点で 18 PASS / 3 FAIL。失敗は `dotenv` 欠落 2 file、`jiti` 欠落 1 file。追加 test 4 件は PASS。 |
| `git diff --check` | PASS |
| `package.json` / `package-lock.json` JSON parse | PASS |
| `npm run lint` | BLOCKED: 現環境の `node_modules/.bin/eslint` が無い（`eslint: command not found`）。 |
| `npm run prisma:generate` | BLOCKED: 現環境の `dotenv` が無く、T1 の config loader で停止。 |
| `npx prisma validate --config prisma.config.ts`（SQLite / Postgres） | 現環境の local Prisma binary が無く未確認。T1 summary に記録された schema validate PASS は保持するが、今回追加 baseline SQL の実 DB parser validation には代用しない。 |
| `npm run build` | BLOCKED: `prisma:generate` が上記 `dotenv` 欠落で先に停止。T1 では clean build が `@prisma/adapter-pg` 未導入で停止していた。解消済みとは推測しない。 |
| `npm ci` | T1 の実測どおり registry の split2 tarball integrity mismatch / registry access blocker が残る。今回も clean install・実 Postgres 接続は実行していない。 |
| 実 Supabase / Vercel / Production DB | NOT RUN。secret、URL、project、network を作成・使用していない。 |

## Remaining Unknowns

- clean `npm ci` 後の `@prisma/adapter-pg` / `pg` installation、lint、Prisma validate、Next build、runtime import。
- 実 Postgres target への baseline apply、direct connection、transaction、FK cascade、日時 parser、import / reconcile の end-to-end。
- Supabase direct URL の network / IPv6 到達性、transaction pooler との runtime prepared-statement 挙動。
- 実移行直前の source freeze hash / inventory。今回の counts と hash は dry-run 時点の observation であり、実移行の固定 baseline ではない。

## Next Read

- `summary/20260726/t2-postgres-baseline-import-reconcile-20260726-summary.md`
- `summary/20260726/t1-postgres-runtime-boundary-20260726-summary.md`
- `prisma/schema.postgres.prisma`
- `prisma/migrations-postgres/20260726000000_postgres_baseline/migration.sql`
- `scripts/postgres-migration-common.js`
- `scripts/postgres-import.js`
- `scripts/postgres-reconcile.js`
- `README.md` の Postgres operator workflow 節
