---
summary_type: task-summary
created_at: 2026-07-23 01:45 JST
task_kind: worker-task
task_status: done
---

## Objective

同一 timestamp の繰り返し・並行 backup で、完成した snapshot だけを一意かつ atomic に公開し、失敗実行が既存世代を余分に prune しない状態にする。

## Scope

- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/backup/filename-collision.test.js`
- prune ownership、source path protection、DATABASE_URL 解釈は対象外

## Inputs Read

- `summary/20260723/0130-review-fix-backup-filename-collision-main-20260723-9223b393-summary.md`
- `summary/20260723/0133-review-correct-backup-collision-test-lint-20260723-8e9a5f60-summary.md`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/backup/filename-collision.test.js`

## Changes Made

- 同一 timestamp の保持中 generation から最大 suffix を読み、次の suffix から exclusive publish を始める。
- source DB を管理対象外の一意な pending directory へ完全 copy し、完成後だけ hard link で final filename を atomic・exclusive に公開する。
- pending copy / publish が失敗した場合は prune を呼ばず、pending cleanup を best effort で行う。
- final publish は `EEXIST` だけ次 suffix へ retryし、その他の filesystem error は伝播する。
- `readdir` 後の `stat` で消えた entry の `ENOENT` を skipし、その他の stat error は伝播する。
- fixed millisecond 5世代、pending copy failure、stat race、publish collision/error、legacy filename の focused testsを追加する。

## Findings

- 5回連続作成でも返却pathが各回存在し、最終3世代は実際の3/4/5回目の内容になる。
- in-progress pending fileはlist/prune対象にならず、copy失敗時も既存3世代を維持する。
- filesystem hard-link publishは同一backup directory内で完成fileだけをatomicに公開する。
- 複数processの長時間stress testは未実施だが、競合注入testで境界を確認した。

## Verification

- `node --test test/backup/filename-collision.test.js`: PASS (8/8)
- focused ESLint: PASS
- `npm run lint`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS

## Remaining Unknowns

- 複数processの長時間stress testは、必要になった場合のみ disposable temp root で追加する。

## Next Read

- `summary/20260723/0145-review-correct-backup-collision-publication-races-20260723-b161b27c-summary.md`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/backup/filename-collision.test.js`
