---
summary_type: task-summary
created_at: 2026-08-31 17:31 JST
task_kind: worker-task
task_status: done
---

## Objective

`fix-desktop-window-close-button-20260831-f2ef9364.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/fix-desktop-window-close-button-20260831-f2ef9364.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/fix-desktop-window-close-button-20260831-f2ef9364.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/src/lifecycle.rs` | Worker が意図的変更として記録 | `fix-desktop-window-close-button-20260831-f2ef9364.task.md` の実行結果 |
| `src/shared/desktop/desktop-close-bridge.ts` | Worker が意図的変更として記録 | `fix-desktop-window-close-button-20260831-f2ef9364.task.md` の実行結果 |
| `test/desktop/desktop-close-bridge.test.js` | Worker が意図的変更として記録 | `fix-desktop-window-close-button-20260831-f2ef9364.task.md` の実行結果 |
| `test/desktop/desktop-lifecycle.test.js` | Worker が意図的変更として記録 | `fix-desktop-window-close-button-20260831-f2ef9364.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/fix-desktop-window-close-button-20260831-f2ef9364.task.md` |
| F-002 | fact | Worker が意図的変更として provenance manifest に成果物を記録した。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

実装を完了しました。変更は次の4ファイルです。

- [lifecycle.rs](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/lifecycle.rs:990)
- [desktop-close-bridge.ts](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/shared/desktop/desktop-close-bridge.ts:161)
- [desktop-close-bridge.test.js](/Users/kazuya/Desktop/自己学習/Cornell-Method/test/desktop/desktop-close-bridge.test.js:94)
- [desktop-lifecycle.test.js](/Users/kazuya/Desktop/自己学習/Cornell-Method/test/desktop/desktop-lifecycle.test.js:660)

原因は source 上、bridge ready が未登録・拒否・欠落した場合に `request_close()` が WebView へ close event を送らず、120秒待機後に Cancel していたことです。同じ fragment の再送も navigation されない可能性がありました。runtime 実測による最終原因確定は未実施です。

修正内容:

- ready 状態に依存しない一回限りの direct dispatch fallback を追加
- bridge ready 後の pending request 再送を維持
- 同一 decision の再送でも必ず新しい fragment になる request ID を追加
- 無効な URL・fragment・decision は pending request を安全に Cancel
- duplicate request は先行 request を維持
- dirty の無確認破棄、save/discard/cancel、save failure、sidecar cleanup failure の契約は変更なし

検証結果:

- Node focused tests: 19 PASS / 7 SKIP / 0 FAIL
- TypeScript: PASS
- ESLint 対象ファイル: PASS
- `cargo fmt --check`: PASS
- `git diff --check`: PASS
- Rust unit test: Tauri custom resource build が `Not a directory (os error 20)` で停止し、テスト本体は未実行
- packaged macOS GUI runtime: Worker host 制約により未確認

`worker-record-change.sh` に4ファイルを記録済みです。既存の `HANDOFF_2026-08-28.md`、未追跡 `Notebook.app`、既存 summary は変更していません。コミットもしていません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260831/1731-fix-desktop-window-close-button-20260831-f2ef9364-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| changed-files provenance | 完了 | explicit worker provenance manifest |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |
| U-002 | task 実行中に provenance manifest 外の workspace activity を 1 件検出した。他 Worker や並行処理の可能性があるため、この task の変更とは帰属しない。 | 必要時のみ `git status --short` と各 Worker summary を照合 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260831/1731-fix-desktop-window-close-button-20260831-f2ef9364-summary.md`
- `src-tauri/src/lifecycle.rs`
- `src/shared/desktop/desktop-close-bridge.ts`
- `test/desktop/desktop-close-bridge.test.js`
- `test/desktop/desktop-lifecycle.test.js`
