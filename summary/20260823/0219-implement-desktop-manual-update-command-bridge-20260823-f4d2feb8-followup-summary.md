---
summary_type: task-summary
created_at: 2026-08-23 02:19 JST
task_kind: worker-task
task_status: done
---

## Objective

`@tauri-apps/api@2.5.0` を採用し、引数なし `manual_update_check` Tauri command、sanitized response/state DTO、frontend bridge を既存 update orchestrator 上に実装する。

## Scope

Desktop Alpha の manual update check command/bridge と、その DTO・mapping・focused contract tests。既存 provider、selection、state、startup、Settings menu、package download/apply は対象外。

## Inputs Read

- `HANDOFF_2026-08-22.md`
- `summary/20260823/0142-specify-desktop-manual-update-check-contract.md`
- `summary/20260823/0155-implement-desktop-manual-update-command-bridge-20260823-f4d2feb8-summary.md`
- `src-tauri/src/main.rs`、`update_check.rs`、`update_state.rs`、`update_target.rs`
- `src/shared/desktop/desktop-settings-bridge.ts` と既存 desktop tests

## Changes Made

| パス | 変更内容 |
|---|---|
| `package.json` | root runtime dependency `@tauri-apps/api` を `=2.5.0` で追加 |
| `package-lock.json` | root dependency と `node_modules/@tauri-apps/api` の 2.5.0 entry だけを追加。npm の無関係な metadata 差分は除外 |
| `src-tauri/src/main.rs` | `#[tauri::command] async fn manual_update_check(AppHandle)`、worker 内 `spawn_blocking`、managed `UpdateStateStore` 利用、handler 一回登録を追加 |
| `src-tauri/src/update_check.rs` | manual outcome、sanitized command/state error、response mapping、target/error/response の pure unit tests を追加 |
| `src-tauri/src/update_state.rs` | persistence `UpdateState` と分離した `UpdateStateSnapshot` / nested DTO conversion と allowlist test を追加 |
| `src/shared/desktop/desktop-settings-bridge.ts` | `requestManualUpdateCheck()`、固定 command 名、Tauri capability fallback、duplicate in-flight coalescing、unknown rejection sanitization、runtime response validation を追加。既存 Settings event API は維持 |
| `test/desktop/desktop-update-check.test.js` | command registration、依存 exact version、DTO/error allowlist の static contract を追加 |
| `test/desktop/desktop-update-startup-check.test.js` | manual handler の存在を許容し、startup worker が automatic のままであることを検証 |
| `test/desktop/desktop-update-target.test.js` | combined target import に合わせた既存 static assertion のみ調整 |
| `test/desktop/desktop-settings-bridge.test.js` | unsupported-web、引数なし invoke、duplicate coalescing、settled 後 clear、unknown rejection sanitization を追加 |

## Contract

- command は JSON 引数を持たず、`AppHandle` から managed `UpdateStateStore` を取得する。
- target context、blocking reqwest transport、timestamp、`run_update_check(CheckTrigger::Manual, ...)` はすべて `spawn_blocking` worker 内で実行する。
- response outcome は `no-update`、`available`、`failed`、`suppressed`、`already-checking`。`AlreadyChecking` は provider を呼ばず `state.status: checking` を返す。
- UI snapshot は `snapshotVersion: 1`、status/timestamps、pending update の version/channel/architecture/artifact/verificationState/discoveredAt、failure の code/retryAt のみ。persistence schemaVersion、notification、URL、size/hash/signature、response/body/headers/token は含めない。
- command error は tagged `command-error` / `state-error` で、target 3種、`provider-internal`、`update-command-worker-failed`、`update-state` の固定 code のみを返す。
- bridge は Tauri capability がなければ `unsupported-web`、unknown invoke rejection/response は `command-unavailable` に正規化する。同一 WebView の duplicate call は module-level Promise を共有し、settled 後に clear する。
- Settings menu/event、primary WebView、sidecar lifecycle、download/install/signature/apply は変更していない。

## Findings

- `@tauri-apps/api@2.5.1` の代わりに、ユーザー承認済みの exact `=2.5.0` を採用した。
- 既存の blocking provider/state/orchestrator を command worker へ再実装せず、managed state と `run_update_check` を共有できた。
- repository-wide lint/build は既存 runtime fixture / React ref lint のため未通過だが、今回の追加対象に限定した lint と Rust/desktop tests は通過した。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | PASS | |
| `CARGO_TARGET_DIR=/tmp/cornell-method-manual-update-cargo-target cargo test --manifest-path src-tauri/Cargo.toml` | PASS | 68 passed。既存の未使用 `fetch_manifest_from_github` warning のみ |
| `node --test test/desktop/*.test.js` | PASS | 44 tests、43 pass、1 skip。skip は disposable loopback listener 制約 |
| focused `node --check` | PASS | modified/new Node tests |
| focused `npx eslint ...` | PASS | command/bridge/tests に追加 lint error なし |
| `npm run lint` | 未通過 | 既存 Canvas/ref・backup effect 等で 36 errors / 8 warnings。対象外の既存コードは変更していない |
| `npm run build` | 未通過 | webpack compile は成功。既存 `src-tauri/target/debug/runtime/next.config.ts` の `NextConfig` 型解決で停止 |
| `npx tsc --noEmit --pretty false` | 未通過 | 上記 runtime fixture の NextConfig / missing type errors。今回の bridge 起因のエラーはなし |
| `git diff --check` | PASS | |
| GitHub live connection | 未実行 | fake transport / pure mapping のみ使用 |

## Remaining Unknowns

- packaged macOS WebView での実 invoke、`__TAURI_INTERNALS__` capability、UI の response 待ち表示は未確認。
- `npm run lint` / `npm run build` の既存 failure は別 task で扱う。

## Next Read

- `summary/20260823/0219-implement-desktop-manual-update-command-bridge-20260823-f4d2feb8-followup-summary.md`
- `src-tauri/src/main.rs`
- `src-tauri/src/update_check.rs`
- `src-tauri/src/update_state.rs`
- `src/shared/desktop/desktop-settings-bridge.ts`
- `test/desktop/desktop-update-check.test.js`
- `test/desktop/desktop-settings-bridge.test.js`
