---
summary_type: task-summary
created_at: 2026-07-23 00:25 JST
task_kind: worker-task
task_status: done
---

## Objective

Empty・whitespace・非 `file:`・path が空の `DATABASE_URL` を全 surface で拒否し、runtime と backup の DB 選択を一致させる。

## Scope

- shared URL validation
- backup provider nullish fallback semantics
- focused config / provider tests

## Inputs Read

- `config/project-env.js`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/config/project-env.test.js`

## Changes Made

- shared resolver が valid SQLite `file:` URL だけを返すよう検証を追加。
- backup provider の fallback 判定を `||` から `??` へ変更し、空値を default 扱いしない。
- relative / absolute / query suffix / invalid values の回帰ケースを追加。

## Findings

- fact: empty・whitespace・non-fileーbare `file:` はエラーになる。
- fact: valid relative / absolute `file:` URL と query suffix は保持される。
- fact: missing 設定の場合のみ `file:./dev.db` を使う。

## Verification

- config + backup focused Node tests: PASS (31/31 at task completion)
- `npm run lint`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `git diff --check`: PASS

## Remaining Unknowns

- none

## Next Read

- `config/project-env.js`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/config/project-env.test.js`
