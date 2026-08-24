---
summary_type: task-summary
created_at: 2026-08-24 JST
task_kind: worker-task
task_status: done
issue: "#175"
---

## Objective

staged DB の atomic rename 成功後、成功 return より前に live directory を fsync し、rename と checkpoint の順序を durable にする。post-rename sync failure は既存の fail-closed switch error として扱う。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Desktop staged database migration switch durability |
| 対象ファイル / ディレクトリ | `src/server/infrastructure/desktop-storage.js`、`test/desktop/desktop-update-migration.test.js` |
| 対象外 | #174 schema compatibility gate、#164 backup identity、他の update pipeline の refactor |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 引き継ぎ | `HANDOFF_2026-08-22.md` | 現在の staged migration 契約と既知の検証制約 |
| 既存 summary | `summary/20260824/2148-fix-issue-174-validate-candidate-schema-no-pending-20260824-b4d43495-summary.md` | #174 の schema compatibility gate と直前の検証結果 |
| 実装 | `src/server/infrastructure/desktop-storage.js` | `syncDirectory`、switch 前 sync、rename、既存 switch error boundary |
| テスト | `test/desktop/desktop-update-migration.test.js` | no-pending、#174、atomic switch failure、migration/read-back 回帰 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/server/infrastructure/desktop-storage.js` | `fs.renameSync(stagedDatabasePath, storagePaths.databasePath)` 成功直後に `syncDirectory(storagePaths.liveDirectory)` を追加。既存の switch `catch` 内で post-rename sync failure も `STAGED_MIGRATION_SWITCH_FAILED` に変換する。 | rename の directory-entry 永続化を success return 前に完了し、checkpoint が durable state より先へ進まないようにする。 |
| `test/desktop/desktop-update-migration.test.js` | rename 後の live directory fsync を意図的に失敗させ、rename 済みでも switch failure となる regression test を追加。backup が変更されないことも確認。 | post-rename sync の存在と fail-closed 契約を実行時に検証する。 |

既存の未コミット変更は保持した。#174 の candidate schema compatibility validation は変更していない。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | switch は rename 前に live directory を sync していたが、rename 後の sync はなかった。 | 対象実装の `switchStagedDatabase` |
| F-002 | fact | post-rename sync は既存の switch `try/catch` 内にあり、失敗時は `STAGED_MIGRATION_SWITCH_FAILED` になる。 | 実装と回帰テスト |
| U-001 | unknown | 実 macOS の crash / power-loss 後の filesystem durability は実機試験していない。 | 実行環境の制約 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `node --test test/desktop/desktop-update-migration.test.js` | PASS | 22/22（no-pending、#174、追加 post-rename failure test を含む） |
| `npx eslint src/server/infrastructure/desktop-storage.js test/desktop/desktop-update-migration.test.js` | PASS | 対象ファイルのみ |
| `node --check src/server/infrastructure/desktop-storage.js` | PASS |  |
| `node --check test/desktop/desktop-update-migration.test.js` | PASS |  |
| `git diff --check` | PASS |  |
| `git status --short` | 確認済み | 既存の未コミット変更と本 task の summary を確認。既存変更は戻していない。 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 実機の crash / power-loss による rename 永続化の観測 | macOS packaged runtime での disposable filesystem durability test |

## Next Read

- `summary/20260824/2200-fix-issue-175-post-rename-live-directory-sync-20260824-summary.md`
- `src/server/infrastructure/desktop-storage.js`
- `test/desktop/desktop-update-migration.test.js`

