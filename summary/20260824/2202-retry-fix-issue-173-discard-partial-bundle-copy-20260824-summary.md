---
summary_type: task-summary
created_at: 2026-08-24 22:02 JST
task_kind: worker-task
task_status: done
---

## Objective

Issue #173 の bundle copy failure / interruption 後に残る partial `switch_temp` を候補として再利用せず、安全な candidate source から retry できるようにする。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `coding` |
| 対象 | `src-tauri/src/update_recovery.rs`, `test/desktop/desktop-update-recovery.test.js` |
| 既存変更 | #172 の `database_switched` / restore 条件と #165 の failed marker cleanup を保持 |

## Changes Made

| パス | 変更内容 |
|---|---|
| `src-tauri/src/update_recovery.rs` | `switch_temp` は candidate source との全 tree、symlink target、regular file bytes の一致を検証済みの場合だけ再利用。検証に失敗した temp は managed parent 直下・no-follow の partial tree cleanup 後に source から再構築する。copy途中の failure でも partial tree を cleanup して error を返し、`BundleSwitching` 復旧時の temp 昇格にも同じ完全性検証を適用。recovery unit test を追加。 |
| `test/desktop/desktop-update-recovery.test.js` | Issue #173 の retry / cleanup / source rebuild 契約テストを追加。 |
| `summary/20260824/2202-retry-fix-issue-173-discard-partial-bundle-copy-20260824-summary.md` | 完了要約を記録。 |

## Verification

| コマンド | 結果 |
|---|---|
| `node --test test/desktop/desktop-update-recovery.test.js` | 12/12 PASS |
| `node --test test/desktop/desktop-update-*.test.js` | 75/75 PASS |
| `node --check test/desktop/desktop-update-recovery.test.js` | PASS |
| `npx eslint test/desktop/desktop-update-recovery.test.js` | PASS |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `git diff --check` | PASS |
| `cargo test --offline --manifest-path src-tauri/Cargo.toml update_recovery -- --nocapture` | 実行不能。compile 前に offline crates.io index で `base64` package が見つからず停止。 |

## Remaining Unknowns

- Rust recovery unit test本体は、`base64` crate が利用可能な環境での compile / execution が未確認。
- packaged macOS runtime による実際の bundle switch / interruption / recovery は未検証。

## Next Read

- `src-tauri/src/update_recovery.rs`
- `test/desktop/desktop-update-recovery.test.js`
- `summary/20260824/2145-fix-issue-172-prove-database-switch-before-restore-20260824-bffb45d4-summary.md`
