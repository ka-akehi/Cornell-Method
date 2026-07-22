---
summary_type: task-summary
created_at: 2026-07-23 01:30 JST
task_kind: worker-task
task_status: done
---

## Objective

同一 millisecond の backup 作成でも既存 snapshot を上書きせず、各成功呼び出しが一意な generation を作る。

## Scope

- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/backup/filename-collision.test.js`
- backup prune ownership、source path protection、DATABASE_URL 解釈は対象外

## Inputs Read

- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `doc/implementation/MVP_CONTRACT.md`
- `doc/testing/TEST_SCENARIOS.md`

## Changes Made

- `YYYY-MM-DDTHH-mm-ss.SSS.db` を生成し、衝突時は `-1`、`-2` の suffix を試す。
- `COPYFILE_EXCL` を使い、`EEXIST` の場合だけ次の suffix へ進む。
- legacy 秒精度 filename と millisecond / suffix filename を同じ list / sort / prune 契約で扱う。
- concurrent prune の `ENOENT` だけを無視し、その他の unlink error は伝播する。
- fixed time の連続作成、exclusive flag、内容保持、legacy互換、error boundary の focused tests を追加する。

## Findings

- 同一 millisecond の連続作成で base と suffix filename が別々に作成され、先の内容は上書きされない。
- `EEXIST` 以外の copy error と `ENOENT` 以外の unlink error は隠さない。
- 実際の別 process 同時実行は再現していないが、filesystem の atomic exclusive create 境界を focused test で確認した。
- ownership protection と source path / DATABASE_URL のロジックは変更していない。

## Verification

- `node --test test/backup/filename-collision.test.js`: PASS (4/4)
- `npm run lint`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS

## Remaining Unknowns

- 別 process の実時間同時実行は、必要になった場合のみ disposable temp root の process-level test で追加確認する。

## Next Read

- `summary/20260723/0130-review-fix-backup-filename-collision-main-20260723-9223b393-summary.md`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `test/backup/filename-collision.test.js`
