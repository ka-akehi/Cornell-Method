---
summary_type: task-summary
created_at: 2026-07-23 01:53 JST
task_kind: worker-task
task_status: done
---

## Objective

final hard link成功をbackupのcommit pointとし、publish後のpending cleanup errorで完成済みbackupを失敗扱いにしない。

## Scope

- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/backup/filename-collision.test.js`
- publish成功前のerror boundaryと他backup findingsは対象外

## Inputs Read

- `summary/20260723/0145-review-correct-backup-collision-publication-races-20260723-b161b27c-summary.md`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/backup/filename-collision.test.js`

## Changes Made

- final `linkSync` 成功後のpending file unlinkとpending directory rmdirを個別のbest-effort cleanupにする。
- cleanup errorが起きても通常pruneを続行し、完成final pathを成功として返す。
- pending unlink / rmdir の `EACCES` 注入testsを追加し、final内容、最大3世代、残骸のlist非対象を検証する。
- hard link成功前のcopy / publish、stat、generation pruneのerror boundaryは変更しない。

## Findings

- pending unlinkまたはrmdirが失敗しても、完成済みfinal backupは成功として返る。
- cleanup残骸はtimestamp `.db` generationではなく、list / pruneの保持数に含まれない。
- 公開generationは通常どおり最大3件へ収束する。

## Verification

- `node --test test/backup/filename-collision.test.js`: PASS (10/10)
- `npm run lint`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS

## Remaining Unknowns

- なし。複数processの長時間stress testはfocused regression scope外。

## Next Read

- `summary/20260723/0153-review-correct-backup-post-publish-cleanup-20260723-e8ddb91f-summary.md`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/backup/filename-collision.test.js`
