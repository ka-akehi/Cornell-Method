---
summary_type: task-summary
created_at: 2026-08-28 JST
task_kind: worker-task
task_status: done
---

## Objective

single-instance focus endpoint の `Unavailable` 診断に、失敗段階、sanitized `io::ErrorKind`、raw OS error の数値または `unset` を追加した。path、HOME、ユーザー名、owner 内容、ノート、SQLite、credential は診断へ含めていない。

## Changed files

- `src-tauri/src/instance.rs`

`FocusSocketStatus::Unavailable` に `SanitizedIoError` を保持させ、socket connect failure と metadata lookup failure を別段階で記録するようにした。startup error は固定文言にその detail のみを付加し、元の `io::Error` 表示（path を含み得る）を出力しない。

`Missing`、`Stale`、`Active`、`Unknown`、`PermissionDenied` の既存分類は維持した。stale socket の削除、regular/non-socket object の置換拒否、active endpoint の非置換、lock、retry、listener の挙動は変更していない。`Unavailable` は引き続き bind を拒否して fail-closed である。

## Verification

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- `git diff --check`: PASS
- `cargo test --manifest-path src-tauri/Cargo.toml instance::tests`: 実行したが、Tauri の既存 build script が生成物ツリー走査中に `Not a directory (os error 20)` で停止し、Rust test 実行前に終了した。今回のテスト assertion の実行結果は未取得。
- 追加 unit test は connect / metadata の stage、kind、raw code / unset、path-free、fail-closed を確認する。既存の clean missing、stale、active、regular/non-socket、permission のテストは変更していない。
- 変更後の `git status --short` を確認し、既存の未コミット変更は保持した。
- `codex-queue/bin/worker-record-change.sh src-tauri/src/instance.rs` で変更ファイルを記録した。

## Scope boundary

`main.rs`、Web Inspector、same-origin、capability、proxy、sidecar、API、DB、MVP contract、既存 artifact は変更していない。diagnostic `.app` は未更新である。

## Next Read

次の rebuild task は、まず `summary/20260828/worker-single-instance-error-observability-20260828-summary.md` と `src-tauri/src/instance.rs:111-175,467-553,1111-1160` を確認し、exact source から diagnostic `.app` を再生成する。再生成後は artifact identity と、sanitized startup error に `stage=... kind=... raw_os_error=...` が含まれることだけを確認する。
