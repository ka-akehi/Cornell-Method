---
summary_type: task-summary
created_at: 2026-08-24 13:09 JST
task_kind: worker-task
task_status: done
---

## Objective

`fix-issue-160-preserve-explicit-apply-preparation-20260824-23775ab4.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/fix-issue-160-preserve-explicit-apply-preparation-20260824-23775ab4.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/fix-issue-160-preserve-explicit-apply-preparation-20260824-23775ab4.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/src/lifecycle.rs` | task 実行中に作成または更新 | `fix-issue-160-preserve-explicit-apply-preparation-20260824-23775ab4.task.md` の実行結果 |
| `src-tauri/src/update_apply.rs` | task 実行中に作成または更新 | `fix-issue-160-preserve-explicit-apply-preparation-20260824-23775ab4.task.md` の実行結果 |
| `src-tauri/src/update_migration.rs` | task 実行中に作成または更新 | `fix-issue-160-preserve-explicit-apply-preparation-20260824-23775ab4.task.md` の実行結果 |
| `src-tauri/src/update_state.rs` | task 実行中に作成または更新 | `fix-issue-160-preserve-explicit-apply-preparation-20260824-23775ab4.task.md` の実行結果 |
| `test/desktop/desktop-update-apply.test.js` | task 実行中に作成または更新 | `fix-issue-160-preserve-explicit-apply-preparation-20260824-23775ab4.task.md` の実行結果 |
| `test/desktop/desktop-update-migration.test.js` | task 実行中に作成または更新 | `fix-issue-160-preserve-explicit-apply-preparation-20260824-23775ab4.task.md` の実行結果 |
| `test/desktop/desktop-update-state.test.js` | task 実行中に作成または更新 | `fix-issue-160-preserve-explicit-apply-preparation-20260824-23775ab4.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/fix-issue-160-preserve-explicit-apply-preparation-20260824-23775ab4.task.md` |
| F-002 | fact | task 実行中に成果物の作成または更新があった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

実装完了しました。

変更内容：

- `ApplyPreparation` に `restartHandoff` checkpoint を追加。
- 明示 restart 後だけ `requested` を永続化。
- 起動時に migration claim を行い、実行中は `migration-started` として再実行を防止。
- handoff 前／migration 中の異常終了は `RollbackPending` へ fail-closed。
- Rust disposable state fixture、static regression test、migration fixture を追加。

検証：

- `node --test test/desktop/desktop-update-*.test.js`: 55/55 PASS
- ESLint、Node syntax check、`cargo fmt --check`、`git diff --check`: PASS
- Rust test: offline cache に `base64` がなく依存解決前に停止
- packaged macOS runtime の実 restart／migration／rollback は未検証

既存の未追跡 summary、commit、push、GitHub 操作は変更していません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260824/1309-fix-issue-160-preserve-explicit-apply-preparation-20260824-23775ab4-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260824/1309-fix-issue-160-preserve-explicit-apply-preparation-20260824-23775ab4-summary.md`
- `src-tauri/src/lifecycle.rs`
- `src-tauri/src/update_apply.rs`
- `src-tauri/src/update_migration.rs`
- `src-tauri/src/update_state.rs`
- `test/desktop/desktop-update-apply.test.js`
- `test/desktop/desktop-update-migration.test.js`
- `test/desktop/desktop-update-state.test.js`
