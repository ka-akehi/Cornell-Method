---
summary_type: task-summary
created_at: 2026-07-23 00:50 JST
task_kind: worker-task
task_status: done
---

## Objective

Backup provider の `DATABASE_URL` 解決だけを、prune / collision のテストと分離した専用テストで固定する。

## Scope

- `test/backup/database-url-resolution.test.js`

## Inputs Read

- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/config/project-env.test.js`

## Changes Made

- invalid URL 5 ケースが fallback せずエラーになるテストを追加。
- relative / absolute URL と query suffix の path 解決を検証。
- `DATABASE_URL` 未指定時だけ `dev.db` default になることを検証。

## Findings

- fact: provider は empty・whitespace・non-file・path-empty URL を拒否する。
- fact: valid URL は project root 基準の期待 path へ解決される。

## Verification

- config + provider focused Node tests: PASS (25/25)
- `npm run lint`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `git diff --check`: PASS

## Remaining Unknowns

- none

## Next Read

- `test/backup/database-url-resolution.test.js`
- `config/project-env.js`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
