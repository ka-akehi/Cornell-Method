# Task Summary

## Objective

`arch-api-shared-http-errors` として、既存 MVP の API error shape `{ code, message, errors? }` を維持したまま、HTTP error DTO / response helper / fetch error decode の最小境界を `src/shared/http` に作成した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | API error response boundary |
| 対象ファイル / ディレクトリ | `src/shared/http/**`, `src/lib/validation.ts`, notes API route, 最小限の tags/backups API import, `note-editor.tsx` type import |
| 対象外 | Phase 2 機能追加、Prisma schema、DB migration、UI 挙動変更、OpenAPI / 生成 client |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-06.md` | 最新引き継ぎとアーキテクチャ移行方針 |
| summary | `summary/20260706/2326-arch-plan-create-migration-plan-d6e1fc99-summary.md` | 後続 task の起点 |
| design | `doc/technical/ARCHITECTURE_MIGRATION_PLAN.md` | `arch-api-shared-http-errors` の目的、完了条件、検証方針 |
| code | `src/lib/validation.ts` | schema と HTTP error concern の混在状況 |
| code | `src/app/api/notes/route.ts`, `src/app/api/notes/[id]/route.ts`, `src/app/api/notes/[id]/review/route.ts` | notes API の代表 error response |
| code | `src/app/api/tags/route.ts`, `src/app/api/backups/route.ts` | 旧 validation HTTP helper import の最小波及確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/shared/http/api-error.ts` | API error DTO、field error 型、status map、body 作成 helper、Zod error 変換を追加 | `{ code, message, errors? }` の正本を HTTP 境界へ移すため |
| `src/shared/http/route-response.ts` | `NextResponse.json(body, { status })` を返す `apiErrorResponse` を追加 | Route Handler の重複を減らすため |
| `src/shared/http/fetch-json.ts` | API error body の type guard と decode helper を追加 | client-side remote 導入前の最小準備 |
| `src/shared/http/index.ts` | shared http exports を集約 | import 経路を安定させるため |
| `src/lib/validation.ts` | HTTP error DTO / helper を削除し、schema と inferred input type に限定 | validation concern と HTTP response concern を分離するため |
| `src/app/api/notes/route.ts` | validation / server error response を shared helper 利用へ変更 | notes API 代表箇所へ導入するため |
| `src/app/api/notes/[id]/route.ts` | validation / not_found / server_error response を shared helper 利用へ変更 | notes API 代表箇所へ導入するため |
| `src/app/api/notes/[id]/review/route.ts` | validation / not_found / server_error response を shared helper 利用へ変更 | notes API 代表箇所へ導入するため |
| `src/app/api/tags/route.ts`, `src/app/api/backups/route.ts` | 旧 `validation.ts` HTTP helper import を shared helper へ最小差し替え | `validation.ts` から HTTP helper を切り出したため |
| `src/app/notes/_components/note-editor.tsx` | `ApiErrorBody` / `ApiFieldError` の type import を `shared/http` へ変更 | UI fetch 実装は変えず、型 import だけ整合させるため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 既存 error shape `{ code, message, errors? }` と status map は維持した。 | `src/shared/http/api-error.ts` |
| F-002 | fact | notes API の representative validation / not_found / server_error response は shared helper 経由になった。 | notes route 3 ファイル |
| F-003 | fact | `validation.ts` は schema と inferred input type のみを export する状態になった。 | `src/lib/validation.ts` |
| U-001 | unknown | 実 HTTP 経由の validation / not_found response は sandbox の listen 制限により未確認。 | `npm run dev -- --hostname 127.0.0.1 --port 3001` が `EPERM` |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `git status --short` before | 完了 | 既存の未コミット変更が多数ある状態を確認 |
| `npm run lint` | PASS | eslint 成功 |
| `npm run build` | PASS | Next.js build / TypeScript 成功 |
| manual API validation / not_found | 未実行 | localhost listen が `EPERM: operation not permitted 127.0.0.1:3001` で失敗 |
| `git status --short` after | 完了 | 本 task の変更と既存変更が混在していることを確認 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 実サーバー経由での notes API validation / not_found response body | localhost 起動可能な環境で `GET /api/notes?from=bad` と `GET /api/notes/__missing__` を確認 |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `summary/20260707/0000-arch-api-shared-http-errors-summary.md`
- `src/shared/http/api-error.ts`
- `src/shared/http/route-response.ts`
- `src/shared/http/fetch-json.ts`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
- `src/app/api/notes/[id]/review/route.ts`
