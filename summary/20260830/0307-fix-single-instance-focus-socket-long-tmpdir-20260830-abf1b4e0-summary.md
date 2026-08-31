---
summary_type: task-summary
created_at: 2026-08-30 03:07 JST
task_kind: worker-task
task_status: done
---

## Objective

`fix-single-instance-focus-socket-long-tmpdir-20260830-abf1b4e0.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/fix-single-instance-focus-socket-long-tmpdir-20260830-abf1b4e0.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/fix-single-instance-focus-socket-long-tmpdir-20260830-abf1b4e0.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/src/instance.rs` | Worker が意図的変更として記録 | `fix-single-instance-focus-socket-long-tmpdir-20260830-abf1b4e0.task.md` の実行結果 |
| `test/desktop/desktop-lifecycle.test.js` | Worker が意図的変更として記録 | `fix-single-instance-focus-socket-long-tmpdir-20260830-abf1b4e0.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/fix-single-instance-focus-socket-long-tmpdir-20260830-abf1b4e0.task.md` |
| F-002 | fact | Worker が意図的変更として provenance manifest に成果物を記録した。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

実装完了です。

変更内容:

- 通常時の socket path は既存形式を維持。
- 104 bytes 以上になる場合は `/tmp/cmn-<euid>/cmn-<identity-hash>/.instance.sock` へ deterministic fallback。
- application id と settings path の identity hash は維持。
- fallback root と identity directory を `700` に設定。
- 長い TMPDIR・長い storage path・bind・path stability の Rust テストを追加。
- desktop startup contract test を更新。
- provenance を記録済み。

検証:

- `cargo fmt --check` PASS
- `git diff --check` PASS
- desktop tests PASS（11件）、loopback依存7件は環境制約でSKIP
- startup recovery tests PASS（11件）
- Rust targeted test は Tauri build script の既存環境エラー `Not a directory (os error 20)` により未実行

既存の未コミット変更は保持しています。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260830/0307-fix-single-instance-focus-socket-long-tmpdir-20260830-abf1b4e0-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| changed-files provenance | 完了 | explicit worker provenance manifest |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260830/0307-fix-single-instance-focus-socket-long-tmpdir-20260830-abf1b4e0-summary.md`
- `src-tauri/src/instance.rs`
- `test/desktop/desktop-lifecycle.test.js`
