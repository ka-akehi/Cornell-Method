---
summary_type: task-summary
created_at: 2026-07-26 JST
task_kind: worker-task
task_status: done
---

## Objective

既存の Local SQLite MVP を保持したまま、Vercel Preview / Production で Supabase Postgres runtime を選択できる Prisma adapter、URL 解決、Prisma CLI、Vercel build の境界を実装した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Prisma runtime、URL validation、CLI / migration config、Vercel build、依存関係、回帰テスト |
| 対象ファイル / ディレクトリ | `config/project-env.*`、`prisma.config.ts`、`prisma/schema.postgres.prisma`、`prisma/migrations-postgres/`、`src/server/infrastructure/prisma.ts`、`scripts/prisma-*.js`、`package*.json`、関連 test、README 環境変数説明 |
| 対象外 | Postgres baseline の適用、`dev.db` 行データ import、Supabase / Vercel project、backup provider、認証、UI、Canvas 契約の変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| prior summary | `summary/20260726/1213-vercel-supabase-implementation-contract-20260726-summary.md` | SQLite 保持、runtime pooler / CLI direct URL、schema / import / backup 分離契約 |
| prior summary | `summary/20260726/1219-define-vercel-supabase-publication-contract-20260726-a2c14206-summary.md` | Preview / Production、build、未決事項、後続 task の境界 |
| handoff | `HANDOFF_2026-07-26.md` | 現行 MVP の SQLite runtime、backup、未実装の公開移行 |
| source | `prisma/schema.prisma`、`prisma/migrations/` | SQLite provider と既存 migration を変更しないこと |
| source | `src/server/infrastructure/prisma.ts`、`config/project-env.js` | 既存 adapter、singleton、file URL fallback |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `config/project-env.js` / `.d.ts` | SQLite / PostgreSQL URL validation、Vercel hosted 判定、runtime provider 判定、`DIRECT_URL` を使う Prisma CLI URL 解決を追加。Hosted の URL 未設定または `file:` は fail closed。 | Local fallback と Preview / Production の Postgres runtime を明確に分離するため |
| `prisma.config.ts` | `PRISMA_PROVIDER=sqlite|postgresql` で schema と migration directory を選択し、Postgres CLI は `DIRECT_URL` を参照。 | SQLite migration を Postgres に誤適用しないため |
| `prisma/schema.postgres.prisma` | 現行 5 model を mirror する Postgres provider schema と分離 output を追加。既存 `prisma/schema.prisma` は未変更。 | T2 が Postgres baseline を作れる境界を用意するため |
| `prisma/migrations-postgres/.gitkeep` | Postgres migration path を予約。baseline SQL は追加していない。 | SQLite migration directory と混在させないため |
| `src/server/infrastructure/prisma.ts` | `PrismaPg` + Postgres generated client と `PrismaBetterSqlite3` + 既存 client を URL で切替。module-level singleton / `globalThis` 再利用を維持し、request-level `new` / `$disconnect()` は追加していない。 | warm invocation 間で Prisma instance を再利用するため |
| `scripts/prisma-generate.js` / `scripts/prisma-run-postgres.js` | build は runtime URL を先に解決し、SQLite / Postgres client generate のみ実行。Postgres CLI command は config wrapper 経由で direct URL を要求。 | build に migration / import / backup を混入させず、Vercel の missing URL を早期検出するため |
| `package.json` / `package-lock.json` | Prisma 7.8.0 と整合する `@prisma/adapter-pg@7.8.0` と `pg` 系 lock entry を追加。build は `prisma:generate && next build --webpack`。migration / backup は build script に含めていない。 | Postgres runtime dependency と Vercel build 境界を固定するため |
| `test/config/project-env.test.js` | PostgreSQL URL、pooler query 保持、provider 選択、Preview / Production fail closed、DIRECT_URL、generation-only の SQLite client を検証。 | URL / runtime / CLI の回帰を防ぐため |
| `README.md` | Local SQLite、Hosted Postgres `DATABASE_URL`、CLI 専用 `DIRECT_URL`、Local-only backup の環境変数説明を最小更新。 | 現行 Local backup 契約と公開 runtime の役割を混同しないため |
| `.gitignore` / `eslint.config.mjs` | generated Postgres client を成果物として追跡せず、lint 対象から除外。 | client は build / generate 時に作成するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | `prisma/schema.prisma` と既存 `prisma/migrations/` は SQLite のまま保持した。Postgres は別 schema、別 generated output、別 migration path を選ぶ。 | `npx prisma validate` と diff |
| F-002 | fact | Local は明示された `file:` URL または既存の `file:./dev.db` fallback、Local / non-Vercel の PostgreSQL URL は Postgres runtime として解決できる。 | resolver test |
| F-003 | fact | `VERCEL_ENV=preview|production`、または hosted 相当の Vercel 環境で `DATABASE_URL` がない場合は SQLite fallback へ落ちずエラーになる。`file:` URL も拒否する。エラーに URL 値を含めない。 | resolver test、hosted generate 実行 |
| F-004 | fact | Postgres runtime は `DATABASE_URL` の pooler query を保持し、`PrismaPg({ connectionString })` に渡す。Prisma CLI / migration は `DIRECT_URL` を使い、migration command で未設定なら停止する。 | source inspection、resolver test |
| F-005 | fact | build script は `npm run prisma:generate && next build --webpack` のみで、`migrate`、import、backup を呼ばない。SQLite client generate は offline の client生成だけであり、hosted runtime fallback ではない。 | package script、hosted fake URL generate |
| F-006 | fact | `npm run prisma:generate` は Local と hosted fake Postgres URL の双方で SQLite / Postgres client を生成できた。Hosted の URL 未設定では generate 前に fail closed した。 | command verification |
| U-001 | unknown | 現環境の `node_modules` に新規 `@prisma/adapter-pg` が存在しないため、clean dependency install 後の Next build は未確認。registry access が復旧した環境で `npm ci` 後に再実行する必要がある。 | `npm run build` の `Can't resolve '@prisma/adapter-pg'` |
| U-002 | unknown | 実 Supabase transaction pooler への connect / transaction、`pgbouncer=true` 相当の prepared statement 挙動、direct connection の migration 到達性は未確認。 | Supabase project / secret / network を作成していないため |
| U-003 | unknown | Postgres baseline、migration deploy、`dev.db` import、行数 / FK / Canvas JSON reconciliation は T2 以降の未実施範囲。 | 本 task の対象外 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `node --test` | PASS | 利用可能な 6 test files、72 tests |
| `npm run lint` | PASS | ESLint |
| `npx prisma validate --config prisma.config.ts` | PASS | SQLite schema |
| `PRISMA_PROVIDER=postgresql npx prisma validate --config prisma.config.ts` | PASS | Postgres schema |
| `npm run prisma:generate` | PASS | SQLite / Postgres generated client |
| hosted fake Postgres `npm run prisma:generate` | PASS | 実 DB 接続なし。両 client generate のみ |
| hosted missing `DATABASE_URL` | PASS | generate 前に fail closed |
| Postgres migration missing `DIRECT_URL` | PASS | migration deploy 前に fail closed |
| `package-lock.json` parse / `git diff --check` | PASS | lockfile JSON と whitespace を確認 |
| `npm run build` | BLOCKED | generate は PASS。現環境の未インストール `@prisma/adapter-pg` を Next webpack が解決できず停止 |
| dependency install / lock-only refresh | BLOCKED | shell の registry access が `ENOTFOUND registry.npmjs.org`、offline lock-only は未 cache の既存 package で `ENOTCACHED` |
| Supabase real DB connect / transaction | NOT RUN | project、secret、network 前提がないため |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | `npm ci` 後の clean Next build と Postgres adapter の実 runtime import | registry access を復旧し、lockfile から install した環境で `npm ci && npm run build` |
| U-002 | Supabase transaction pooler の connect / transaction / prepared statement 挙動 | 非本番 Supabase project の秘密 URL を実行環境だけへ設定し、短い smoke test を実施 |
| U-003 | Postgres schema baseline と既存 SQLite data import | 次の T2 で `prisma/migrations-postgres` と one-off import を別 task として実装・検証 |
| U-004 | Vercel Preview / Production env 分離と実デプロイ QA | Vercel project の environment variables を設定した Preview deployment で、認証 task 完了後に確認 |

## Next Read

後続 T2 は次の最小ファイルから読む。

- `summary/20260726/t1-postgres-runtime-boundary-20260726-summary.md`
- `prisma/schema.postgres.prisma`
- `prisma.config.ts`
- `config/project-env.js`
- `summary/20260726/1213-vercel-supabase-implementation-contract-20260726-summary.md`（baseline / import 契約を確認する場合）
