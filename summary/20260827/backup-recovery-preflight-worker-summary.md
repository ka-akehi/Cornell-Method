---
summary_type: task-summary
created_at: 2026-08-27 JST
task_kind: worker-task
task_status: done
---

## Objective

バックアップ API エラーから Desktop の安全な事前復旧試行へ接続する、有限回・型付きの Tauri command/bridge 境界を実装した。

## Changes Made

- `src-tauri/src/main.rs`
  - `attempt_desktop_backup_recovery` command を登録。
- `src-tauri/src/lifecycle.rs`
  - data-operation lock と既存 quiesce/restart 境界を使う orchestration を追加。
  - DB 不可用時は recovery-only state を更新し、既存 `tauri://localhost/index.html` recovery UI へ遷移。
  - 保存先/configuration の未復旧時は DB recovery に送らず、通常 sidecar の再起動を最大一度試行。
- `src-tauri/src/runtime.rs`
  - version 1 の request/response、allow-listed error、sidecar probe、response validation を追加。
  - recovery snapshot を runtime 中に安全に更新できる state 境界を追加。
- `src-tauri/sidecar/launcher.cjs`
  - canonical storage の再解決、SQLite read/integrity/schema inspection、managed backup directory の再検査を追加。
  - initialized missing/corrupt DB は recovery-required、storage-only failure は not-recovered として返す。
  - restore、empty DB 作成、削除、上書きは行わない。
- `src/shared/desktop/desktop-settings-bridge.ts`
  - 既知3理由だけを受け付ける typed request と、ready/recovery-required/not-recovered/unsupported-web の result normalization を追加。
- `test/desktop/desktop-backup-recovery.test.js`
  - 正常 DB、欠落/破損 DB、保存先復旧不能、unknown、Web bridge 非対応、command 登録/restore 分離を検証。

## Verification

- `node --test test/desktop/desktop-backup-recovery.test.js`：5/5 PASS
- `node --test test/desktop/desktop-startup-recovery.test.js test/desktop/desktop-recovery-ui.test.js test/desktop/desktop-data-backup-boundary.test.js test/desktop/desktop-data-backup-restore.test.js test/desktop/desktop-data-backup-pending.test.js`：既存回帰 PASS（41/41）
- `node --test test/desktop/desktop-lifecycle.test.js`：9 PASS、7 SKIP（loopback listener 制約）
- `npm run lint`：0 errors、既存 warning 8件
- `node --check src-tauri/sidecar/launcher.cjs`：PASS
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：PASS
- `git diff --check`：PASS
- `cargo check --manifest-path src-tauri/Cargo.toml`：未完了。`index.crates.io` の DNS 解決不可で `tauri` 取得前に停止。
- packaged macOS 実機検証：未実施。

## Changed-files provenance

`codex-queue/bin/worker-record-change.sh` に次の6ファイルを記録済み。

- `src-tauri/src/main.rs`
- `src-tauri/src/lifecycle.rs`
- `src-tauri/src/runtime.rs`
- `src-tauri/sidecar/launcher.cjs`
- `src/shared/desktop/desktop-settings-bridge.ts`
- `test/desktop/desktop-backup-recovery.test.js`

## Notes

作業前から存在した `src/shared/http/api-error.ts`、`test/backup/backup-route-desktop-directory.test.js`、既存 summary 群は変更せず保持した。

## Next Read

- `src-tauri/src/lifecycle.rs` の `run_desktop_backup_recovery_command`
- `src-tauri/sidecar/launcher.cjs` の `attemptBackupRecovery`
- `src/shared/desktop/desktop-settings-bridge.ts` の `requestDesktopBackupRecovery`
- `test/desktop/desktop-backup-recovery.test.js`
