# Task Summary: mvp-validation-schemas

## Objective

API と UI で共有できる MVP 用入力 validation と API error helper を整備する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | MVP validation / API error body helper |
| 対象ファイル | `src/lib/validation.ts` |
| 対象外 | 既存 API / UI の旧 Phase 2 schema 参照修正、Prisma schema / migration 変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| Handoff | `summary/20260621/1636-mvp-prisma-schema.md` | Prisma schema は MVP 化済み、旧 API/UI は未修正 |
| Task list | `doc/MVP_IMPLEMENTATION_TASKS.md` | `mvp-validation-schemas` の目的と完了条件 |
| API design | `doc/MVP_API_DESIGN.md` | MVP request/query/error 仕様 |
| Code | `src/lib/validation.ts` | 旧 `draft` / `cueCard` / `noteCard` 前提の validation |
| Code | `prisma/schema.prisma` | MVP モデル: `Notebook`, `Cue`, `Tag`, `NotebookTag` |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/lib/validation.ts` | `notebookInputSchema`, `cueSchema`, `tagSchema`, `notesQuerySchema`, `reviewUpdateSchema` を MVP API 仕様へ更新 | 後続 `mvp-notes-api` が MVP request/query を parse できるようにするため |
| `src/lib/validation.ts` | `draftSchema`, `cueCardSchema`, `noteCardSchema`, wrapper 付き旧 `notebookInputSchema` を公開 API から削除 | Phase 2 モデルを MVP validation から外すため |
| `src/lib/validation.ts` | `zodErrorToFieldErrors`, `createApiError`, `createInvalidBodyError`, `createInvalidQueryError`, `createNotFoundError`, `createServerError`, `apiErrorStatus` を追加 | API error response を `{ code, message, errors? }` に統一しやすくするため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 既存タグ正規表現は文字クラスが壊れていた | TypeScript `TS1508` と旧 regex 内容 |
| F-002 | fact | MVP API examples は `読書` など漢字タグを使う | `doc/MVP_API_DESIGN.md` |
| F-003 | decision | タグ正規表現は元仕様のひらがな/カタカナ/英数字/記号に加えて `Script=Han` を許可した | MVP examples を valid にするため。emoji や空白は引き続き不可 |
| F-004 | fact | 旧 API は `parsed.notebook`, `draft`, `cueCard`, `noteCard`, `notebookDraftState` などを参照している | `npx tsc --noEmit --pretty false` 結果 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npx eslint src/lib/validation.ts` | success | 変更ファイル単体は lint clean |
| `npm run lint` | failed | 対象外の旧 API/UI lint error が残存。`src/lib/validation.ts` の lint error はなし |
| `npx tsc --noEmit --pretty false` | failed | 対象外の旧 API/Phase 2 model 参照と Next route 型が主因。validation の regex error は修正済み |
| `npm run build` | stopped | `Creating an optimized production build ...` から 90 秒以上追加出力なしのため中断 |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `doc/MVP_API_DESIGN.md`
- `src/lib/validation.ts`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
- `src/app/api/tags/route.ts`
