---
summary_type: task-summary
created_at: 2026-07-23 01:05 JST
task_kind: worker-task
task_status: done
---

## Objective

Prisma CLI、Next runtime、backup provider が SQLite `file:` URL を同じ実ファイルとして解釈する契約へ揃える。

## Scope

- `config/project-env.js`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/config/project-env.test.js`
- `test/backup/database-url-resolution.test.js`
- `README.md`

## Inputs Read

- `config/project-env.js`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/config/project-env.test.js`
- `test/backup/database-url-resolution.test.js`

## Changes Made

- query / fragment 付き `file:` URL を shared validator と backup provider の双方で拒否する。
- non-empty authority を持つ `file://host/path` を双方で拒否する。
- percent-encoded path を decode せず、runtime URL と backup path で同じ文字列のファイル名として扱う。
- relative / absolute URL と拒否ケースの focused regression tests、README の運用説明を更新する。

## Findings

- query / fragment / authority の解釈差を拒否契約にすることで、runtime と backup が別 DB を参照する経路を閉じた。
- `%20` などは URL decode せず、SQLite adapter と同じ raw path spelling を provider が利用する。
- 後続レビューで `file::memory:` の解釈差を検出したため、同じ finding の追加 Worker task で拒否テストを補う。

## Verification

- focused DATABASE_URL tests: PASS (35/35、後続レビュー前の時点)
- `npm run lint`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `npx prisma validate`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS

## Remaining Unknowns

- `file::memory:` の拒否は `review-reject-sqlite-memory-url-20260723-0fec28a2` で補完する。

## Next Read

- `summary/20260723/0105-review-correct-sqlite-file-url-parity-20260723-3aa6eba3-summary.md`
- `config/project-env.js`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/backup/database-url-resolution.test.js`
