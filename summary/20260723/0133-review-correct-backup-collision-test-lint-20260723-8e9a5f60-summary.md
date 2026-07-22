---
summary_type: task-summary
created_at: 2026-07-23 01:33 JST
task_kind: worker-task
task_status: done
---

## Objective

filename collision focused test を repository lint 契約へ適合させ、Worker報告と実検証を一致させる。

## Scope

- `test/backup/filename-collision.test.js`
- provider実装、test assertions、依存関係は対象外

## Inputs Read

- `test/backup/filename-collision.test.js`
- 既存の plain Node focused tests

## Changes Made

- CommonJS provider を plain Node test から直接読む理由を明記し、`@typescript-eslint/no-require-imports` だけを file-level で限定 disable する。

## Findings

- Manager 再検証で新規 test の `require()` 6件が lint error になることを検出した。
- 限定 disable 後は test 4/4、lint、型検査が成功した。
- provider実装とassertionsは変更していない。

## Verification

- `node --test test/backup/filename-collision.test.js`: PASS (4/4)
- `npm run lint`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `git diff --check`: PASS

## Remaining Unknowns

- collision / publication concurrency の残存 finding は後続 task で補正する。

## Next Read

- `summary/20260723/0133-review-correct-backup-collision-test-lint-20260723-8e9a5f60-summary.md`
- `test/backup/filename-collision.test.js`
