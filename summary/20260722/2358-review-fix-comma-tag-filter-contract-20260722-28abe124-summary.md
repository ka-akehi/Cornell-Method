---
summary_type: task-summary
created_at: 2026-07-22 23:58 JST
task_kind: worker-task
task_status: done
---

## Objective

カンマを含む有効なタグ名を壊さず、一覧検索の OR 条件と後方互換性を維持する query contract へ修正する。

## Scope

- canonical transport: repeated `tags` query parameter
- legacy transport: comma-separated `tag` query parameter
- internal `NotesQuery.tag` array and existing OR search behavior are preserved

## Inputs Read

- `src/modules/notes/contracts/tag.schema.ts`
- `src/modules/notes/contracts/query.schema.ts`
- `src/modules/notes/remote/query.ts`
- `src/app/api/notes/route.ts`
- `doc/implementation/MVP_CONTRACT.md`
- `doc/api/MVP_API_DESIGN.md`
- `doc/testing/TEST_SCENARIOS.md`

## Changes Made

- `src/modules/notes/remote/query.ts`: selected tags are sent as repeated exact `tags` values.
- `src/app/api/notes/route.ts`: all repeated `tags` values are passed to the query schema.
- `src/modules/notes/contracts/query.schema.ts`: canonical exact values and legacy CSV values are normalized, deduplicated, and merged into `NotesQuery.tag`.
- `doc/implementation/MVP_CONTRACT.md`: canonical and legacy transports are defined.
- `doc/api/MVP_API_DESIGN.md`: wire examples and compatibility behavior are documented.
- `doc/testing/TEST_SCENARIOS.md`: comma-containing, repeated, legacy, empty, and duplicate cases are added.

## Findings

- fact: `tags=alpha%2Cbeta` is treated as the exact tag `alpha,beta` and is not split.
- fact: `tags=alpha&tags=beta` remains an OR filter after normalization.
- fact: legacy `tag=alpha,beta` remains supported as two CSV tags.
- fact: empty and duplicate values are removed after trimming.

## Verification

- `npm run lint`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `npm run build`: PASS
- canonical / repeated / legacy schema behavior check: PASS
- `git diff --check` for the task files: PASS

## Remaining Unknowns

- Browser UI filtering with persisted comma-containing tag data is deferred to branch-level QA.

## Next Read

- `src/modules/notes/contracts/query.schema.ts`
- `src/modules/notes/remote/query.ts`
- `src/app/api/notes/route.ts`
- `doc/implementation/MVP_CONTRACT.md`
- `doc/api/MVP_API_DESIGN.md`
- `doc/testing/TEST_SCENARIOS.md`
