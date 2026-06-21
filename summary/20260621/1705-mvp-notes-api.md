# Task Summary: mvp-notes-api

## Objective

`doc/MVP_API_DESIGN.md` に合わせて、MVP のノート API を `Notebook` / `Cue` / `Tag` / `NotebookTag` schema 前提で実装し直す。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | ノート一覧、作成、詳細、更新、削除、復習済み更新 API |
| 対象ファイル / ディレクトリ | `src/app/api/notes/route.ts`, `src/app/api/notes/[id]/route.ts`, `src/app/api/notes/[id]/review/route.ts`, `src/lib/validation.ts` |
| 対象外 | `tags`, `backups`, `review-tasks`, `undo`, `notes/export`, UI、Prisma schema / migration、依存追加 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| Handoff | `summary/20260621/1636-mvp-prisma-schema.md` | Prisma schema は MVP 化済み、旧 API/UI は未修正 |
| Handoff | `summary/20260621/1651-mvp-validation-schemas.md` | validation は MVP schema / error helper 化済み |
| Design | `doc/MVP_API_DESIGN.md` | request / response / error / query 仕様 |
| Code | `src/lib/validation.ts` | `notebookInputSchema`, `notesQuerySchema`, `reviewUpdateSchema`, API error helper |
| Code | `prisma/schema.prisma` | MVP モデルと relation |
| Code | `src/app/api/notes/route.ts`, `src/app/api/notes/[id]/route.ts` | 旧 Phase 2 参照の残存箇所 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/api/notes/route.ts` | `GET /api/notes` を MVP query schema、50件 paging、`noteDate desc / updatedAt desc`、MVP list response に変更 | API 設計に合わせるため |
| `src/app/api/notes/route.ts` | `POST /api/notes` を `Notebook` / `Cue` / `Tag` / `NotebookTag` transaction 保存に変更 | 削除済み Phase 2 モデル参照を排除するため |
| `src/app/api/notes/[id]/route.ts` | `GET`, `PATCH`, `DELETE` を MVP 詳細 response、Cue/Tag 全置換、物理削除に変更 | MVP では draft / optimistic lock / soft delete / note cards を扱わないため |
| `src/app/api/notes/[id]/review/route.ts` | `POST /api/notes/:id/review` を追加 | `reviewedAt` と `nextReviewDate` の MVP 更新 API を提供するため |
| `src/lib/validation.ts` | `cueSchema.order` を任意に変更 | request の `order` または配列順で保存する仕様に合わせるため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 対象 notes API の旧 `draftState`, `cueCards`, `noteCards`, `noteCueLink`, `softDeleteBuffer` 参照は削除済み | `npx tsc --noEmit --pretty false` の対象ファイル由来エラー消失 |
| F-002 | fact | Next 16 の route context は `params: Promise<{ id: string }>` として扱う必要がある | `.next/types/validator.ts` の型エラー |
| F-003 | fact | Prisma Client の直接起動確認は `PrismaClient` constructor が adapter または accelerateUrl を要求して失敗した | 手動 Prisma Client 確認コマンド結果 |
| F-004 | fact | 対象外の `notes/export`, `review-tasks`, `undo`, `backups/retry` には旧 schema / route 型問題が残る | `npx tsc --noEmit --pretty false` 結果 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npx eslint src/lib/validation.ts src/app/api/notes/route.ts 'src/app/api/notes/[id]/route.ts' 'src/app/api/notes/[id]/review/route.ts'` | success | 対象ファイル単体は lint clean |
| `npx tsc --noEmit --pretty false` | failed | 対象外の `backups/retry`, `notes/export`, `review-tasks`, `undo` が原因。対象 notes API の型エラーはなし |
| `npm run lint` | failed | 対象外の `notes/export`, `tags`, `layout`, UI pages/components の既存 lint error が原因 |
| `npm run build` | stopped | `Creating an optimized production build ...` から約2分半追加出力なしのため中断 |
| Prisma Client manual check | failed | `new PrismaClient()` が Prisma 7 の adapter / accelerateUrl 必須条件で初期化失敗 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | API route の実 runtime 動作 | Prisma 7 SQLite client の adapter 設定または依存追加方針決定後の API 手動確認 |
| U-002 | full build の最終結果 | 対象外旧 schema API 修正後、または build 停滞原因の切り分け後に再実行 |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `src/lib/prisma.ts`
- `package.json`
- `prisma.config.ts`
- `src/app/api/notes/export/route.ts`
- `src/app/api/review-tasks/route.ts`
- `src/app/api/undo/route.ts`
- `src/app/api/backups/retry/route.ts`
