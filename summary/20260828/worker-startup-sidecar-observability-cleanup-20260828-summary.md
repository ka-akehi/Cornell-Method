---
summary_type: task-summary
created_at: 2026-08-28 JST
task_kind: worker-task
task_status: done
---

## Objective

Window 表示前の sidecar startup failure を段階別に sanitized 記録し、spawn 済みの child / process group を失敗時に cleanup する。

## Changes

- `src-tauri/src/main.rs`
  - `start_sidecar` の sanitized stage code を diagnostics に記録するよう変更。
- `src-tauri/src/runtime.rs`
  - `sidecar-spawn-failed`、`sidecar-ready-handshake-failed`、`sidecar-ready-url-invalid`、`sidecar-health-check-failed`、`sidecar-startup-cleanup-failed` を追加。
  - ready URL は loopback `/notes` のみを許可し、credentials、query、fragment を拒否。
  - spawn 後の handshake / URL / health failure を共通 cleanup 経路へ集約。
  - disposable child/process group cleanup と stage mapping、入力非露出の focused unit test を追加。
- `src-tauri/src/diagnostics.rs`
  - 新しい error code を既存 allowlist に追加。diagnostic record は既存どおり固定 message と redacted stack を使用。

## Security and scope

stderr 全文、filesystem path、command line、URL nonce、HTTP body、credential、ノート内容は diagnostics に記録しない。window restoration、same-origin bridge、API、capability、DB schema、config、lockfile、artifact、DB は変更していない。既存の別タスク未コミット変更は保持した。

## Verification

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- `node --test test/desktop/desktop-tauri-capability.test.js test/desktop/desktop-api-bridge-contract.test.js`: PASS (8/8)
- `git diff --check`: PASS
- `cargo test --manifest-path src-tauri/Cargo.toml runtime::tests --lib`: crate に library target がなく実行不能。
- `cargo test --manifest-path src-tauri/Cargo.toml --bin cornell-method-notebook`: Tauri build script が既存の `.desktop-runtime/node_modules` 不在で停止。Rust focused tests は未実行。
- app / DMG build、GUI、permissive macOS host、external loopback runtime は未実施。

## Next Read

Fresh app build 後、permissive macOS host で direct launch を実施し、失敗時に上記 stage code が生成され、sidecar / process group が残らないことを確認する。GUI saved-window-state の検証・変更は別 task とする。

## Worker provenance

- `src-tauri/src/main.rs`
- `src-tauri/src/runtime.rs`
- `src-tauri/src/diagnostics.rs`
