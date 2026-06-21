# Task Summary: mvp-backup-api

## Objective

`doc/MVP_API_DESIGN.md` に合わせて、MVP のバックアップ一覧・作成 API と SQLite DB バックアップスクリプトを実装する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | バックアップ API / バックアップコピー |
| 対象ファイル / ディレクトリ | `src/app/api/backups/route.ts`, `src/app/api/backups/retry/route.ts`, `scripts/backup-copy.js`, `src/lib/backup/` |
| 対象外 | notes / tags API、UI、Prisma schema / migration、依存追加 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| Design | `doc/MVP_API_DESIGN.md` | `GET /api/backups`, `POST /api/backups`, MVP 外 `/api/backups/retry` |
| Plan | `doc/MVP_IMPLEMENTATION_TASKS.md` | `mvp-backup-api` の目的と完了条件 |
| Config | `prisma.config.ts` | `DATABASE_URL ?? "file:./dev.db"` |
| Code | `src/app/api/backups/route.ts` | 既存 GET は `createdAt` なし、POST なし |
| Code | `src/app/api/backups/retry/route.ts` | MVP 外の retry API が残存 |
| Code | `scripts/backup-copy.js` | 既存コピー元が `prisma/dev.db` 固定 |
| Handoff | `summary/20260621/1717-mvp-tags-api.md` | tsc は MVP 外 API 由来の既存エラーあり |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/lib/backup/index.js` | DB パス解決、バックアップ一覧、作成、最新3世代 pruning を共通実装 | API と script で同じロジックを使うため |
| `src/lib/backup/index.d.ts` | TS route から JS helper を import するための型定義を追加 | `src/app/api/backups/route.ts` の型解決を明確にするため |
| `src/app/api/backups/route.ts` | `GET` を `{ backups: [{ file, createdAt, path }] }` に変更し、`POST` を追加 | MVP API design に合わせるため |
| `src/app/api/backups/retry/route.ts` | 削除 | MVP では `POST /api/backups` に統一するため |
| `scripts/backup-copy.js` | 共通 helper を使い、作成した `backup/<file>.db` を stdout に出す実装へ変更 | API と同じ DB パス解決・世代管理に揃えるため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | `DATABASE_URL` 未指定時のコピー元はプロジェクトルート基準の `dev.db` | `prisma.config.ts`, `src/lib/backup/index.js` |
| F-002 | fact | `backup/` には `.db` が最新3件だけ残る | `node scripts/backup-copy.js` 実行後の `find backup ...` |
| F-003 | fact | `/api/backups/retry` は実ファイルを削除済み | `test ! -e src/app/api/backups/retry/route.ts` |
| F-004 | fact | `npx next typegen` 後、削除済み retry route の stale 型エラーは解消した | `npx tsc --noEmit --pretty false` |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `git status --short` before | success | 既存の未コミット変更多数あり |
| `npx eslint src/app/api/backups/route.ts scripts/backup-copy.js` | success | 指定 lint は通過 |
| `npx eslint src/lib/backup/index.js` | success | 追加 helper も lint clean |
| `node scripts/backup-copy.js` | success | `backup/2026-06-21T08-24-38.db` などを作成 |
| `node -e "import('./src/lib/backup/index.js')..."` | success | `createdAt` 付きの最新3件一覧を確認 |
| `npx next typegen` | success | 削除済み route の `.next/types` を更新。自動変更された `tsconfig.json` の `moduleResolution` は対象外のため元に戻した |
| `npx tsc --noEmit --pretty false` | failed | MVP 外 `notes/export`, `review-tasks`, `undo` の既存型エラー。backup API 由来の型エラーなし |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | API route の実 HTTP 動作 | Next dev server 起動後の `GET /api/backups` / `POST /api/backups` 手動確認 |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `src/app/api/backups/route.ts`
- `src/lib/backup/index.js`
- `scripts/backup-copy.js`
- `src/app/api/notes/export/route.ts`
- `src/app/api/review-tasks/route.ts`
- `src/app/api/undo/route.ts`
