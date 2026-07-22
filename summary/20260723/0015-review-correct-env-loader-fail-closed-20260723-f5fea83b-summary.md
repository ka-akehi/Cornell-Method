---
summary_type: task-summary
created_at: 2026-07-23 00:15 JST
task_kind: worker-task
task_status: done
---

## Objective

Project `.env` が存在するのに読み込めない場合、別の default DB へ黙って fallback しない。

## Scope

- `config/project-env.js`
- `test/config/project-env.test.js`

## Inputs Read

- `config/project-env.js`
- dotenv 17.4.2 error return behavior

## Changes Made

- `dotenv.config()` の `error` を検査し、shell URL がなければ cause 付きで throw。
- shell URL がある場合の precedence を維持。
- missing `.env` と unreadable `.env` を別のテストケースに分離。

## Findings

- fact: `.env` が directory の場合は EISDIR を cause に持つエラーになる。
- fact: shell URL 指定済みなら unreadable `.env` でも shell 値を使う。

## Verification

- focused Node tests: PASS
- `npm run lint`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `git diff --check`: PASS

## Remaining Unknowns

- none

## Next Read

- `config/project-env.js`
- `test/config/project-env.test.js`
