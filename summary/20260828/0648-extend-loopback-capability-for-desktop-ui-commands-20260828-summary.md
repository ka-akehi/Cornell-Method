---
summary_type: task-summary
created_at: 2026-08-28 06:48 JST
task_kind: worker-task
task_status: done
---

## Objective

external loopback WebView が現行の Settings / Data and Backup UI で使う既存 Tauri command を、remote capability から最小権限で invoke できるようにした。保留中復元状態とアプリ管理バックアップ一覧の読み込み command を含め、local capability と既存の native/browser security boundary は維持した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Tauri capability / app command ACL / contract test |
| 対象ファイル / ディレクトリ | `src-tauri/capabilities/default.json`、`src-tauri/permissions/app-commands.toml`、`test/desktop/desktop-tauri-capability.test.js` |
| 対象外 | UI、API、proxy、native request hardening、browser fallback、依存関係、DB、app/DMG build |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| capability | `src-tauri/capabilities/default.json` | local / remote capability、URL、window、既存 permission |
| ACL | `src-tauri/permissions/app-commands.toml` | local command 全量と既存 API bridge permission |
| bridge / UI | `src/shared/desktop/desktop-settings-bridge.ts`、`src/shared/desktop/desktop-api-bridge.ts`、`src/app/_components/settings/settings-modal.tsx`、`src/modules/backup/ui/components/backup-page.tsx` | command 定義・invoke 経路・Settings / backup 使用箇所 |
| native registration | `src-tauri/src/main.rs` | registered app command 一覧 |
| existing contract | `test/desktop/desktop-api-bridge-contract.test.js` | browser fallback、proxy-facing transport、Origin / Referer hardening |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/capabilities/default.json` | remote capability に update、data-backup/recovery、diagnostics、API bridge の4 permission を明示。`local:false`、`windows:["primary"]`、`http://127.0.0.1::port/*` は維持。 | 外部 loopback WebView に必要な command だけを公開するため |
| `src-tauri/permissions/app-commands.toml` | remote 用に固定 allowlist を追加。`read_desktop_managed_backup_catalog` と `read_desktop_pending_restore_status` を含む14 commandを許可し、`apply_verified_update` は local のみに残した。 | 全登録 local command の再利用を避け、機能領域ごとの最小権限を保つため |
| `test/desktop/desktop-tauri-capability.test.js` | remote permission の exact allowlist、UI bridge の invoke command、screenshot 2 command、wildcard / plugin / 未登録 command / `apply_verified_update` の不許可、URL・window・local/remote 分離・`withGlobalTauri:false` を検証。 | capability contract の回帰防止 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | remote allowlist は update 3、data-backup/recovery 8、diagnostics 2、API bridge 1 の計14 commandで、全て `main.rs` の登録 command かつ bridge invoke 定義に対応する。 | source照合と contract test |
| F-002 | fact | `read_desktop_managed_backup_catalog` と `read_desktop_pending_restore_status` は remote capability から利用可能になった。 | capability / TOML / focused test |
| F-003 | fact | `apply_verified_update`、wildcard、任意 plugin permission、任意 host / origin、別 window は remote に追加していない。 | exact contract assertions |
| F-004 | fact | `src/proxy.ts`、`desktop-api-bridge.ts` の fallback、native Origin / Referer hardening は変更していない。既存 API bridge contract test も通過した。 | 作業前後 status と diff、3/3 test |
| U-001 | unknown | external loopback WebView の実機 invoke / packaged GUI 動作は未確認。 | task 指示により app / DMG build・起動を未実施 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| JSON parse | PASS | `default.json`、`tauri.conf.json` |
| TOML parse | PASS | Rust `toml::from_str` で `app-commands.toml` を解析 |
| capability contract | PASS | 5/5 |
| desktop API bridge contract | PASS | 3/3 |
| `node --check` | PASS | 対象2 test file |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | |
| `git diff --check` | PASS | 未追跡の今回対象2ファイルも no-index check 済み |
| Worker provenance | PASS | `worker-record-change.sh` に3変更ファイルを記録 |
| app / DMG build・起動 | 未実施 | task の対象外 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | fresh packaged app の Tauri ACL 実ロードと external WebView の全 command invoke | packaging 後の permissive macOS host における Settings / Data and Backup QA |

## Next Read

次に読むべき最小ファイル:

- `src-tauri/capabilities/default.json`
- `src-tauri/permissions/app-commands.toml`
- `test/desktop/desktop-tauri-capability.test.js`
- `test/desktop/desktop-api-bridge-contract.test.js`
