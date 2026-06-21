# Task Summary: mvp-prisma-schema

## Objective

`doc/MVP_DATA_DESIGN.md` に合わせて Prisma schema を MVP 構成へ戻し、Prisma 7 最新で generate / migrate できる状態にする。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | MVP DB schema / Prisma migration / npm dependency security check |
| 対象ファイル / ディレクトリ | `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/`, `package.json`, `package-lock.json`, `.gitignore` |
| 対象外 | 旧 schema 参照が残る API / UI の書き換え、lint 既存エラーの修正 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| Handoff | `HANDOFF_2026-06-15.md` | MVP 実装再開方針、DB/API 優先 |
| Task list | `doc/MVP_IMPLEMENTATION_TASKS.md` | `mvp-prisma-schema` の目的、対象、完了条件 |
| Design | `doc/MVP_DATA_DESIGN.md` | MVP 採用モデルと Phase 2 送りモデル |
| Code | `src/lib/prisma.ts` | Prisma Client 利用形 |
| Repo | `.gitignore` | SQLite DB が未 ignore であること |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `prisma/schema.prisma` | `Notebook`, `Cue`, `Tag`, `NotebookTag` の MVP schema へ変更 | MVP 外モデルを削り、最小 DB 構成にするため |
| `prisma.config.ts` | Prisma 7 用 datasource config を追加 | Prisma 7 では datasource URL を config 側で管理するため |
| `prisma/migrations/20260621073258_init/migration.sql` | 初期 migration を作成 | SQLite / Prisma migration 前提を満たすため |
| `prisma/migrations/migration_lock.toml` | migration lock を追加 | Prisma migration 管理に必要なため |
| `package.json` | Prisma / Next / 関連ライブラリを最新化し、npm `overrides` を追加 | 最新利用方針と audit リスク低減のため |
| `package-lock.json` | lockfile を更新 | 再現可能な依存解決にするため |
| `.gitignore` | `*.db`, `*.sqlite`, `*.sqlite3` を追加 | ローカル SQLite DB を Git 管理しないため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | `npm audit signatures` は成功し、672 packages の registry signatures と 161 packages の attestations を確認した | コマンド結果 |
| F-002 | fact | high / critical audit は解消済み | `npm audit` 結果 |
| F-003 | fact | 残 audit は moderate 3 件で、`next` の nested `postcss` と nested `brace-expansion` が対象 | `npm audit --json` 結果 |
| F-004 | fact | Prisma 7 最新の `@hono/node-server` advisory は override で解消した | lockfile と audit 結果 |
| F-005 | fact | 既存 API / UI は削除した Phase 2 モデルをまだ参照している | `rg` 結果 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npm audit signatures` | success | install scripts は無効化した状態で実施 |
| `npx prisma validate` | success | sandbox 外 cache 更新が必要だったため権限付きで実行 |
| `npx prisma format` | success | schema 整形済み |
| `npm run prisma:generate` | success | Prisma Client v7.8.0 generated |
| `npx prisma migrate dev --name init` | success | `dev.db` は生成されたが `.gitignore` 対象 |
| `npm run lint` | failed | 既存 app code の `any`, Link lint, hook lint が原因 |
| `npm run build` | stopped | Next build が数分出力なしのため手動中断 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | Next 最新が内部固定している `postcss@8.4.31` を安全に置き換えるべきか | Next 側の patched release または互換性確認済み override |
| U-002 | nested `brace-expansion` を strict override で潰すべきか | lint/build 互換性確認 |
| U-003 | 旧 API / UI を MVP schema に合わせた後の build 可否 | `mvp-validation-schemas`, `mvp-notes-api` 以降の実装と再検証 |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `doc/MVP_IMPLEMENTATION_TASKS.md`
- `doc/MVP_API_DESIGN.md`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
