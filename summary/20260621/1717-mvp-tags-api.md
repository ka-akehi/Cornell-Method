# Task Summary: mvp-tags-api

## Objective

`doc/MVP_API_DESIGN.md` に合わせて、MVP の `GET /api/tags` を実装し、MVP 外のタグ作成 API を削除する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | タグ候補一覧 API |
| 対象ファイル / ディレクトリ | `src/app/api/tags/route.ts` |
| 対象外 | notes API、backup API、review-tasks / undo / export API、UI、Prisma schema / migration、依存追加 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| Handoff | `summary/20260621/1705-mvp-notes-api.md` | notes API は MVP 化済み、tags は対象外として残っていたこと |
| Design | `doc/MVP_API_DESIGN.md` | `GET /api/tags` response と MVP 外タグ API |
| Code | `src/lib/validation.ts` | API error helper と共通エラー形式 |
| Code | `src/app/api/tags/route.ts` | 既存 `GET` と MVP 外 `POST` の残存 |
| Code | `prisma/schema.prisma` | `Tag` model の `id`, `name`, `color`, `createdAt` |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/api/tags/route.ts` | `GET` の `findMany` を `orderBy: { name: "asc" }` と `select: { id, name, color }` に変更 | MVP response `[{ id, name, color }]` に合わせるため |
| `src/app/api/tags/route.ts` | `POST /api/tags` と `tagSchema` import を削除 | MVP ではタグ作成 API を提供しないため |
| `src/app/api/tags/route.ts` | 予期しない例外時に `createServerError` / `apiErrorStatus` を使う処理を追加 | エラー形式を `src/lib/validation.ts` の helper に統一するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | `GET /api/tags` は `GET` のみになり、`POST` export は削除済み | `src/app/api/tags/route.ts` |
| F-002 | fact | `npx tsc --noEmit --pretty false` は対象外 API の既存型エラーで失敗する | `backups/retry`, `notes/export`, `review-tasks`, `undo` のエラー |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `git status --short` before | success | 既存の未コミット変更多数あり。対象外変更は触っていない |
| `npx eslint src/app/api/tags/route.ts` | success | 対象ファイルは lint clean |
| `npx tsc --noEmit --pretty false` | failed | 対象外の `backups/retry`, `notes/export`, `review-tasks`, `undo` 由来。`tags/route.ts` 由来の型エラーなし |
| `git status --short` after | success | `src/app/api/tags/route.ts` とこの summary が追加変更 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | API route の実 runtime 動作 | Prisma 7 SQLite client の adapter 設定または依存追加方針決定後の API 手動確認 |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `src/app/api/tags/route.ts`
- `src/app/api/backups/retry/route.ts`
- `src/app/api/notes/export/route.ts`
- `src/app/api/review-tasks/route.ts`
- `src/app/api/undo/route.ts`
