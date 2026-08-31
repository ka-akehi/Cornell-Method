---
summary_type: task-summary
created_at: 2026-08-28 JST
task_kind: worker-task
task_status: done
---

## Objective

fresh arm64 packaged app の external loopback WebView と Settings / Data and Backup、ノート保存、バックアップ作成を QA し、same-origin error と Tauri command unavailable を切り分ける。コード・設定・既存データは変更しない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | packaged macOS app identity、Tauri capability/permission packaging、external loopback runtime QA |
| 対象 app | `/private/tmp/cornell-method-tauri-target-current-source-after-desktop-ui-capability-20260828/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app` |
| 対象外 | source/config/lockfile/DB/UI code の変更、既存 user data・既存 backup の読み取り、alias/既存 app/DMG の操作、外部サービス接続 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| app bundle | target `.app` | Info.plist、main executable、Resources、署名、BUILD_ID |
| capability | `src-tauri/capabilities/default.json` | local/remote capability、loopback URL pattern、permission IDs |
| permission | `src-tauri/permissions/app-commands.toml` | remote feature-scoped allowlist と local command 登録 |
| bridge/transport | `src/shared/desktop/desktop-api-bridge.ts`、`src/shared/desktop/desktop-settings-bridge.ts`、`src/modules/notes/remote/transport.ts`、`src/modules/backup/remote/index.ts` | invoke/fetch fallback と Settings/backup command 経路 |
| contract | `test/desktop/desktop-tauri-capability.test.js`、`test/desktop/desktop-api-bridge-contract.test.js` | capability、allowlist、同一 origin transport の静的契約 |
| repository context | `HANDOFF_2026-08-22.md`、関連 `summary/20260828/*` | 先行 build/QA の既知制約と再開情報 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260828/qa-current-source-after-desktop-ui-capability-runtime-20260828.md` | 本 QA の完了要約を新規作成 | task の結果を summary に残すため |

source/config/lockfile/DB、既存 summary、`HANDOFF_2026-08-22.md`、`Notebook.app` alias、既存 app/DMG は変更していない。disposable data は作成していない。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 対象 app は存在し、bundle identifier は `com.cornellmethod.notebook`、CFBundleExecutable は `cornell-method-notebook`。main は arm64、SHA-256 は指定値 `9cffabdd650fb6f451fc1b6de53ea91ae782c51329cb905dbeb588ad2a01fec3` と一致。 | `PlistBuddy`、`file`、`lipo -info`、`shasum -a 256` |
| F-002 | fact | packaged `BUILD_ID` は `6A932olg1ZMFJupJnYhOG`。codesign は `Signature=adhoc`、arm64 bundle、`codesign --verify --deep --strict` は valid on disk / designated requirement を報告。 | `Contents/Resources/runtime/.next/BUILD_ID`、`codesign` |
| F-003 | fact | loose な capability JSON/TOML は bundle `Contents` にない。一方、main executable の compiled strings に `http://127.0.0.1::port/*`、remote permission 4 IDs、および remote allowlist 14 command 名がすべて存在する。 | `find`、`strings` と source allowlist の照合 |
| F-004 | fact | focused contract tests は 8/8 PASS。capability の local/remote 分離、127.0.0.1 dynamic port、fixed allowlist、bridge invoke、Origin/Referer/native transport 契約を確認した。 | `node --test test/desktop/desktop-tauri-capability.test.js test/desktop/desktop-api-bridge-contract.test.js` |
| F-005 | fact | Computer Use の対象 app 操作は起動前に `Computer Use was not approved to use Cornell Method Notebook` で拒否された。app UI は取得していない。 | `sky.get_app_state` の exact error |
| F-006 | fact | `ps` による target/sidecar 残留確認も host policy の `operation not permitted` で実行不能だった。 | `ps -Ao ...` の exact error |
| U-001 | unknown | `/notes` 表示、sidecar loopback 接続、Settings > Data and Backup の pending restore/catalog 表示は未確認。 | GUI 起動前拒否 |
| U-002 | unknown | disposable note 保存、disposable backup destination への作成、backup/recovery modal 開閉は未確認。 | GUI 起動前拒否 |
| U-003 | unknown | app sanitized diagnostic log、sidecar 起動状態、実 loopback URL、HTTP status、Tauri invoke rejection は取得できていない。 | app runtime 未起動。既存 data/log は読んでいない |
| U-004 | unknown | `remote-loopback` capability identifier 自体は executable strings に standalone では残っていない。URL pattern と permission/command strings の compiled evidence はあるが、実 runtime ACL の関連付けは GUI/runtime 未確認。 | `strings` |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| app existence / bundle identity | PASS | `com.cornellmethod.notebook` |
| arm64 / BUILD_ID / main SHA-256 | PASS | 指定値と一致 |
| ad-hoc codesign / deep verify | PASS | valid on disk |
| packaged capability/permission static evidence | PASS（静的） | URL pattern、4 permission IDs、14 command 名。loose config はなし |
| focused contract tests | PASS | 8 tests passed、0 failed |
| `/notes` と sidecar loopback runtime | BLOCKED | host が Computer Use を未承認 |
| Settings > Data and Backup の pending restore/catalog | BLOCKED | 画面未到達 |
| disposable note save | BLOCKED | 画面未到達 |
| disposable backup create | BLOCKED | 画面未到達 |
| backup/recovery modal | BLOCKED | 画面未到達 |
| same-origin error `同一オリジンのリクエストのみ許可されます` | UNKNOWN | 再現も解消確認もできず、FAIL ではない |
| command unavailable / invoke rejection | UNKNOWN | runtime invoke 未到達。same-origin message と混同していない |
| HTTP status | UNKNOWN | runtime request 未観測 |
| sanitized diagnostic log | UNKNOWN | app 起動前拒否。空とは判定していない |
| worktree preservation | PASS | 開始時・summary 作成前の status で既存変更を保持 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | permissive な host で target app を起動した実 runtime | Computer Use 承認または listen/launch 制約の解消 |
| U-002 | external loopback WebView の実 invoke と HTTP read-back | `/notes`、Settings、backup を disposable data で GUI 実行した観測 |
| U-003 | same-origin と command unavailable の最終切り分け | runtime console/sanitized diagnostic と UI エラーの実測 |

## Next Read

次に読むべき最小ファイル:

- `summary/20260828/qa-current-source-after-desktop-ui-capability-runtime-20260828.md`
