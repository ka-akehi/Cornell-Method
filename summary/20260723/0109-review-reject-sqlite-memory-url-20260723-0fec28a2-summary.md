---
summary_type: task-summary
created_at: 2026-07-23 01:09 JST
task_kind: worker-task
task_status: done
---

## Objective

`file::memory:` によって Next runtime と backup provider が別の SQLite 実体を参照する経路を閉じる。

## Scope

- `config/project-env.js`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/config/project-env.test.js`
- `test/backup/database-url-resolution.test.js`

## Inputs Read

- `summary/20260723/0105-review-correct-sqlite-file-url-parity-20260723-3aa6eba3-summary.md`
- `config/project-env.js`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`

## Changes Made

- shared DATABASE_URL validator で SQLite path が厳密に `:memory:` の場合を拒否する。
- backup provider も `file::memory:` を `BackupError` として拒否する。
- `.env`、shell、backup path resolver の focused regression tests に `file::memory:` を追加する。

## Findings

- Prisma SQLite adapter は `file::memory:` をインメモリ DB として開く一方、従来 provider は `<projectRoot>/:memory:` という通常ファイルとして解釈していた。
- 明示拒否により、揮発性 runtime DB を誤って利用し、無関係なファイルを backup 対象にする経路を閉じた。
- backup prune / filename collision のロジックは変更していない。

## Verification

- focused DATABASE_URL tests: PASS (38/38)
- `npm run lint`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `npx prisma validate`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS

## Remaining Unknowns

- なし。

## Next Read

- `summary/20260723/0109-review-reject-sqlite-memory-url-20260723-0fec28a2-summary.md`
- `config/project-env.js`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/backup/database-url-resolution.test.js`
