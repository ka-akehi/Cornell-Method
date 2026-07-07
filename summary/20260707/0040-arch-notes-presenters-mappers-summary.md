# Task Summary: arch-notes-presenters-mappers

## Objective

notes API Route Handler に残っていた Prisma include shape 依存の DTO mapping を `src/server/notes/presenters` へ分離し、既存 response shape、date format、sort order を維持する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | notes API response presenter |
| 対象ファイル / ディレクトリ | `src/server/notes/presenters/**`, `src/app/api/notes/route.ts`, `src/app/api/notes/[id]/route.ts`, `src/app/api/notes/[id]/review/route.ts` |
| 対象外 | Query where 条件、Prisma include、transaction、create/update/delete 挙動、API response shape、Prisma schema、UI |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| repo status | `git status --short` | 作業前から多数の未コミット変更があり、対象 route も既に変更済みであることを確認 |
| previous summary | `summary/20260707/0028-arch-notes-contracts-dto-schema-bf642110-summary.md` | notes contracts 移動後の状態を確認 |
| migration plan | `doc/technical/ARCHITECTURE_MIGRATION_PLAN.md` | notes mapper 整理 task の目的と対象外を確認 |
| route | `src/app/api/notes/route.ts` | list/detail formatting と date formatting の現状を確認 |
| route | `src/app/api/notes/[id]/route.ts` | detail formatting の現状を確認 |
| route | `src/app/api/notes/[id]/review/route.ts` | review update response formatting の現状を確認 |
| contracts | `src/modules/notes/contracts/**` | input/query/review schema の import 先を確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/server/notes/presenters/notes.mapper.ts` | `NotebookWithListRelations`, `NotebookWithDetailRelations`, `NotebookReviewUpdateRecord` と `formatNoteListItem`, `formatNoteDetail`, `formatNoteReviewUpdate` を追加 | Prisma record/include shape から API DTO への mapping を Route Handler から分離するため |
| `src/server/notes/presenters/index.ts` | presenter exports を追加 | route からの import 境界を安定させるため |
| `src/app/api/notes/route.ts` | list/detail formatting 関数と date formatting 関数を削除し、presenter 呼び出しへ変更 | Route Handler を request parse / query / response に寄せるため |
| `src/app/api/notes/[id]/route.ts` | detail formatting 関数と include payload type を削除し、presenter 呼び出しへ変更 | Prisma shape 依存の mapping を Route Handler から漏れにくくするため |
| `src/app/api/notes/[id]/review/route.ts` | review update response の date formatting を presenter 呼び出しへ変更 | review response mapping を presenter に寄せるため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-1 | fact | `cues` は Prisma include 側でも `orderBy` されているが、DTO mapping でも従来どおり `order` 昇順 sort を維持した | `formatNoteDetail` |
| F-2 | fact | `tags` は従来どおり `name.localeCompare` で sort している | `formatTags` |
| F-3 | fact | date-only は `toISOString().slice(0, 10)`、datetime は `toISOString()` を維持した | `notes.mapper.ts` |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npm run lint` | pass | ESLint 成功 |
| `npm run build` | pass | Next.js production build 成功 |
| `npm run start -- -p 3000` | fail | sandbox の listen 制限で `listen EPERM: operation not permitted 0.0.0.0:3000` |
| `npm run start -- -H 127.0.0.1 -p 3000` | fail | sandbox の listen 制限で `listen EPERM: operation not permitted 127.0.0.1:3000` |
| notes API representative check | not run | localhost 起動不可のため未実施 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-1 | 実 HTTP 経由の notes list/detail/review response 確認 | listen 可能なローカル環境で `GET /api/notes`, `GET /api/notes/:id`, `POST /api/notes/:id/review` を確認 |

## Next Read

- `src/server/notes/presenters/notes.mapper.ts`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
- `src/app/api/notes/[id]/review/route.ts`
- `summary/20260707/0040-arch-notes-presenters-mappers-summary.md`
