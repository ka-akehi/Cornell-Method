---
summary_type: task-summary
created_at: 2026-08-30 18:50 JST
task_kind: worker-task
task_status: done
---

## Objective

保存先・外部復元元 chooser の failure boundary を、既存の sanitized local diagnostics retention/export 経路へ privacy-safe metadata として接続した。

## Changes

- `src-tauri/src/runtime.rs`
  - native dialog failure を内部 typed metadata にした。
  - phase は `command`、`dialog-process`、`response-parse`、`path-validation`、`selection-store`。
  - process status は `success`、`non-zero`、`unavailable` のみ保持。
  - spawn failure、non-zero process、stdout size、UTF-8/shape、AppleScript `error` を typed failure として分類。
  - success / cancel、selected response、path validation、selection store の既存 DTO と ordering は維持。
- `src-tauri/src/diagnostics.rs`
  - JSONL record に optional `dialogKind`、`failurePhase`、`exitStatusCategory` を追加。
  - file-dialog component、dialog kind、phase、exit category、既存 safe error-code の allowlist と旧 record 互換を維持。
  - raw stdout / stderr / path / filename / selection ID / DB / backup 内容は記録しない。
- `src-tauri/src/main.rs`
  - spawn-blocking worker failure を `command` phase として diagnostics に記録。
- `test/desktop/desktop-data-backup-boundary.test.js`
  - typed native dialog error と invoke rejection の bounded classification を検証。
- `test/desktop/desktop-diagnostics.test.js`
  - metadata fields、phase、exit category、既存 retention 経路、privacy boundary の static contract を追加。

## Verification

- Node focused tests: 14/14 PASS
- Rust runtime dialog tests: 5/5 PASS、runtime focused suite: 22/22 PASS
- Rust diagnostics metadata tests: 2/2 PASS、diagnostics focused subset: 8/8 PASS
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- targeted ESLint: PASS
- `git diff --check`: PASS

既存の diagnostics 容量系テスト 2 件は大量 fixture のため今回の focused run では skip した。既存 Rust warning（private interface / dead code）は残るが今回の変更による failure ではない。

## Privacy and observation boundary

native typed failure が得られた場合は metadata を local diagnostics へ記録できる。renderer の invoke rejection、timeout、invalid response は native diagnostics に到達しないため、bridge は既存どおり `command-unavailable` に bounded normalize する。native typed error と rejection は bridge の返却結果では区別できるが、rejection の内部原因は未観測である。

実 native dialog / AppleScript / packaged runtime は実行していないため、今回の実装・テストだけではユーザー環境の根本原因を確定していない。

## Changed files

- `src-tauri/src/runtime.rs`
- `src-tauri/src/diagnostics.rs`
- `src-tauri/src/main.rs`
- `test/desktop/desktop-data-backup-boundary.test.js`
- `test/desktop/desktop-diagnostics.test.js`

## Next Read

- `src-tauri/src/runtime.rs` の `DesktopFileDialogFailure` と native response parser
- `src-tauri/src/diagnostics.rs` の `LocalLogRecord` metadata allowlist と retention/export
- `test/desktop/desktop-data-backup-boundary.test.js`
- `test/desktop/desktop-diagnostics.test.js`
