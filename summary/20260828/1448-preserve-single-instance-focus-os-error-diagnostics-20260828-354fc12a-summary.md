---
summary_type: task-summary
created_at: 2026-08-28 14:48 JST
task_kind: worker-task
task_status: done
---

## Objective

`preserve-single-instance-focus-os-error-diagnostics-20260828-354fc12a.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/preserve-single-instance-focus-os-error-diagnostics-20260828-354fc12a.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/preserve-single-instance-focus-os-error-diagnostics-20260828-354fc12a.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/src/instance.rs` | Worker が意図的変更として記録 | `preserve-single-instance-focus-os-error-diagnostics-20260828-354fc12a.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/preserve-single-instance-focus-os-error-diagnostics-20260828-354fc12a.task.md` |
| F-002 | fact | Worker が意図的変更として provenance manifest に成果物を記録した。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

実装完了しました。

- `src-tauri/src/instance.rs` の `Unavailable` に以下を保持：
  - 失敗段階
  - sanitized `ErrorKind`
  - raw OS error または `unset`
- 診断メッセージに path・HOME・ユーザー情報・実データを含めないテストを追加
- 既存の分類、stale/active endpoint 保護、lock/retry、fail-closed 挙動は維持
- Web Inspector、API、DB、capability、artifact は未変更
- 変更記録済み：`worker-record-change.sh`

検証：

- `cargo fmt --check`: PASS
- `git diff --check`: PASS
- Rust test：既存 build script の `Not a directory (os error 20)` によりテスト実行前に停止

完了 summary：[worker-single-instance-error-observability-20260828-summary.md](</Users/kazuya/Desktop/自己学習/Cornell-Method/summary/20260828/worker-single-instance-error-observability-20260828-summary.md>)

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260828/1448-preserve-single-instance-focus-os-error-diagnostics-20260828-354fc12a-summary.md` |
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

- `summary/20260828/1448-preserve-single-instance-focus-os-error-diagnostics-20260828-354fc12a-summary.md`
- `src-tauri/src/instance.rs`
