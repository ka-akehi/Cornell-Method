---
summary_type: task-summary
created_at: 2026-08-24 JST
task_kind: worker-task
task_status: done
---

## Objective

staged migration の failure、再起動 interruption、switch 後の曖昧な state を、次回 startup でも recovery task が判定できる typed checkpoint として保持する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Desktop Alpha update state / staged migration startup handoff |
| 対象ファイル / ディレクトリ | `src-tauri/src/update_state.rs`、`src-tauri/src/update_migration.rs`、`src-tauri/src/runtime.rs`、Desktop update tests |
| 対象外 | rollback、backup restore、bundle switch、health check、旧 bundle cleanup、UI、provider / migration 本体 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 引き継ぎ | `HANDOFF_2026-08-22.md` | Desktop Alpha update の既存未完了範囲と検証制約 |
| 前回 summary | `summary/20260824/0843-implement-staged-update-migration-20260824-5f2d7c91-2c42719d-summary.md` | staged migration の既存 handoff と契約 |
| 前回 summary | `summary/20260824/0856-fix-desktop-staged-migration-readback-column-preservation-20260824-9f3a1c2e-e1c8-summary.md` | read-back 境界と未検証範囲 |
| 正本契約 | `doc/implementation/MVP_CONTRACT.md` | 現行 MVP / Desktop Alpha の変更境界 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/src/update_state.rs` | ApplyPreparation interruption / staged failure を `Rollback` checkpoint に保存。NoPending / switched は `RestartHealthCheck` を保持。recovery state の path validation を遅延し、load 時 recovery を atomic に永続化。 | candidate / failure を失わず、自動 migration の再実行と Available / initial への誤消費を防ぐため |
| `src-tauri/src/update_migration.rs` | runtime の typed failure outcome を `record_staged_migration_failure` へ渡し、state write 成功後も startup を success 扱いしない。 | runner / source / reopen / switch failure code を recovery state に残すため |
| `src-tauri/src/runtime.rs` | staged-migrate の failure message code を `StagedMigrationOutcome::Failed` として handoff。 | launcher が返した failure code を state 層へ伝搬するため |
| `test/desktop/desktop-update-state.test.js` | Rollback / RestartHealthCheck / failure outcome の static contract を追加。 | public snapshot allowlist と自動経路の境界を固定するため |
| `test/desktop/desktop-update-migration.test.js` | typed recovery / restart-health state が staged migration を再実行しない fixture を追加。 | no-op / recovery checkpoint の data-plane 境界を固定するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | `Rollback` は verified candidate と failure を保持し、`has_pending_apply_preparation()` は false になる。 | Rust state transition / unit test |
| F-002 | fact | NoPending と switched は `Checking + RestartHealthCheck` を保持する。 | Rust state transition / unit test |
| F-003 | fact | missing / symlink staging artifact でも recovery state の load は初期化されない。 | disposable Rust fixtures |
| U-001 | unknown | Rust unit / build の実行結果は offline dependency 不足のため未確認。 | `base64 0.22.1` が offline cache にない |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `node --test test/desktop/desktop-update-*.test.js` | PASS 48/48 | disposable SQLite fixture を含む |
| `node --check` | PASS | 対象 Desktop tests / storage / launcher |
| focused `npx eslint` | PASS | 変更対象 JS |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |  |
| `git diff --check` | PASS |  |
| `cargo test --manifest-path src-tauri/Cargo.toml --offline` | NOT RUN | offline cache に `base64 0.22.1` がないため依存解決前に停止 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | Rust unit test / build、packaged runtime、実 restart health / rollback は未検証。 | `base64` を含む Cargo cache、またはネットワーク利用可能な Rust 実行環境と disposable packaged fixture |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `src-tauri/src/update_state.rs`
- `src-tauri/src/update_migration.rs`
- `src-tauri/src/runtime.rs`
- `test/desktop/desktop-update-state.test.js`
- `test/desktop/desktop-update-migration.test.js`
