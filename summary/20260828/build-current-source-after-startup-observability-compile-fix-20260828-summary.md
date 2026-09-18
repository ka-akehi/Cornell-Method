---
summary_type: task-summary
created_at: 2026-08-28 JST
task_kind: worker-task
task_status: done
---

## Objective

現行 source の bridge / proxy hardening / redirect hardening / remote capability / startup diagnostics・cleanup / lifecycle compile fix を含む arm64 macOS `.app` を、Manager の runtime seed を再利用して新規 target に packaging する。DMG も試行する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | 現行 Next production build、Tauri macOS arm64 app/DMG packaging、runtime seed 再利用と静的検証 |
| 対象ファイル / ディレクトリ | 新規 `/private/tmp/cornell-method-tauri-target-current-source-after-startup-observability-compile-fix-20260828`、現行 source/config、指定 seed |
| 対象外 | GUI、loopback 実 runtime、browser/API read-back、インストール・置換、既存 artifact の更新、source 修正、commit |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 引き継ぎ | `HANDOFF_2026-08-22.md` | 現行 capability、startup observability、既存 artifact、未検証境界 |
| 実装 summary | `summary/20260828/worker-startup-sidecar-observability-cleanup-20260828-summary.md` | stage 別 diagnostics と child/process group cleanup |
| compile fix summary | `summary/20260828/0748-fix-sidecar-startup-error-conversion-20260828-9c54be5d-summary.md` | `SidecarStartupError` の String error boundary |
| 直近 build summary | `summary/20260828/build-current-source-after-startup-observability-20260828-summary.md` | E0277 による packaging 未生成の状態 |
| Manager build summary | `summary/20260826/1221-build-packaged-settings-modal-ui-20260826-5d43fff6-summary.md` | bundle ID、arm64、seed 利用方針と従来の build blocker |
| source/config | `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/permissions/app-commands.toml` | app/DMG target、resource mapping、capability / permission |
| runtime seed | `/private/tmp/cornell-method-tauri-target-settings-modal-ui-manager-20260826/release/runtime/{node,node_modules,package.json}` | seed checksum、arm64 runtime、production dependencies |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `/private/tmp/cornell-method-tauri-target-current-source-after-startup-observability-compile-fix-20260828` | 新規 build target、app、ログ、検証 intermediate を生成 | 指定された fresh packaging target |
| `.desktop-runtime`, `.next`, `src/generated`, `node_modules/.prisma/client` | build 用 staging 後、作業前 snapshot へ復元 | 作業ツリーの中間物を残さないため |
| `src-tauri/Cargo.toml` | Tauri CLI の一時 `features = []` 差分を作業前状態へ復元 | tracked config を変更したままにしないため |
| `summary/20260828/build-current-source-after-startup-observability-compile-fix-20260828-summary.md` | 本 summary を追加 | 成果物・検証・未検証範囲の記録 |

## Result

- Target: `/private/tmp/cornell-method-tauri-target-current-source-after-startup-observability-compile-fix-20260828`
- App: `/private/tmp/cornell-method-tauri-target-current-source-after-startup-observability-compile-fix-20260828/release/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- App size: `982M`（生成時刻 `2026-08-28 08:29:56 +0900`）
- Main executable: Mach-O arm64、`com.cornellmethod.notebook`、ad-hoc (`Signature=adhoc`)
- Main executable SHA-256: `4113e36008e37f32c90c79db966cb93e9f1e8b31b474b7b1d1f443313dbbf6c6`
- BUILD_ID: `cZbD3ISDyjv-IhavTZK45`
- DMG: Tauri `app,dmg` は app bundling 後に `bundle_dmg.sh` の host error で status 1。別名での再試行も `hdiutil: create failed - 装置が構成されていません`。DMG は存在せず、SHA-256 / `hdiutil verify` は未取得。

## Runtime and source verification

- `runtime/node` は seed と一致し、Node `v24.14.0` / arm64。
- `runtime/node_modules` は 36,740 files。seed の 36,739 files に、root build から補填した arm64 `better-sqlite3/build/Release/better_sqlite3.node` を含む。
- Prisma schema engine は arm64。packaged runtime から `better-sqlite3` を require して disposable SQLite insert/read-back、`@prisma/client` load、Next `16.2.9` load が PASS。
- Packaged `.next/server/app`: 110 files、`.next/server/chunks`: 13 files、`/api/desktop/health` route は存在。packaged BUILD_ID と health route は現行 root build output と一致。
- Compiled binary に `request_desktop_state_changing_api`、remote feature-scoped permission 名、`sidecar-spawn-failed`、`sidecar-ready-handshake-failed`、`sidecar-ready-url-invalid`、`sidecar-health-check-failed`、`sidecar-startup-cleanup-failed` が存在。Origin / Referer validation と validated runtime-origin error marker も存在。
- generated app manifest は `src-tauri/permissions/app-commands.toml` を参照。契約テストで local / remote capability、remote URL、command allowlist を確認。
- final `codesign --verify --deep --strict`: PASS。

## Verification

- `npm run build`: PASS。BUILD_ID `cZbD3ISDyjv-IhavTZK45`、server/app 110、server/chunks 13、health route あり。
- `node --test test/desktop/desktop-tauri-capability.test.js test/desktop/desktop-api-bridge-contract.test.js`: 8/8 PASS。
- `npm run test:desktop:node-runtime`: 12/12 PASS。
- `npm run test:desktop:lifecycle`: 9 PASS / 7 SKIP。SKIP は runner が disposable loopback listener を許可しないため。
- `CARGO_TARGET_DIR=$TARGET/rust-test cargo test --offline --manifest-path src-tauri/Cargo.toml --bin cornell-method-notebook runtime::tests`: 13/13 PASS。
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS。
- `git diff --check`: PASS。
- release compile / app-only re-bundle log に E0277 は 0 件。app-only re-bundle status 0。
- `npm run lint`: FAIL（既知の Canvas/ref・effect 系 36 errors / 8 warnings）。今回の packaging source change による修正は行っていない。

## Safety and restoration

- seed `/private/tmp/cornell-method-tauri-target-settings-modal-ui-manager-20260826/release/runtime` は変更していない。seed `node` / `package.json` の作業後 checksum は作業前と一致。
- `.desktop-runtime`、root `.next`、`src/generated`、root generated Prisma client は作業前 snapshot と一致するよう復元済み。build staging は新規 target 配下へ退避。
- `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`prisma/schema.prisma` は作業前 checksum と一致。Tauri CLI が一時追加した `features = []` は復元済み。
- 作業前後の tracked status は、既存の `HANDOFF_2026-08-22.md`、capability / diagnostics / lifecycle / main / runtime、backup / notes remote の未コミット変更を保持し、package/config/schema/Cargo の新規差分はない。既存 `Notebook.app` alias は変更していない。
- 永続的な tracked source change は行っていないため、`worker-record-change.sh` に新規 source provenance は記録していない。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | compile fix 後の release compile は成功し、E0277 は再発しなかった。 | `tauri-build.log`、app-only re-bundle status 0 |
| F-002 | fact | arm64 `.app` は生成され、runtime resource と ad-hoc codesign の検証に成功した。 | artifact checks、`codesign --verify --deep --strict` |
| F-003 | fact | DMG は current host の `hdiutil create` 制約で生成できなかった。 | `dmg-manual.log`: `装置が構成されていません` |
| F-004 | fact | seed は変更されず、作業用中間物と tracked config は作業前 snapshot と一致した。 | snapshot `diff -qr`、checksum |
| U-001 | unknown | permissive macOS host での GUI / loopback / normal lifecycle 実操作は未確認。 | current runner の制約 |

## Unverified boundary

GUI 起動、external loopback WebView の実 invoke、sidecar listen、browser/API read-back、DB read-back を伴う mutation、正常終了時 process timing、DMG mount/read-back は未検証。これは current runner の loopback / macOS disk-image 制約によるもので、今回の direct packaged runtime smoke の PASS とは区別する。

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | GUI 起動、loopback bind、external WebView native invoke、正常終了 cleanup | loopback / GUI を許可する macOS host での実機 QA |
| U-002 | DMG mount、read-back、checksum、`hdiutil verify` | `hdiutil create` が動作する host と生成 DMG |
| U-003 | browser/API mutation と DB read-back | packaged app の sidecar ready 後の別 QA |

## Next Read

- `summary/20260828/0748-fix-sidecar-startup-error-conversion-20260828-9c54be5d-summary.md`
- `summary/20260828/worker-startup-sidecar-observability-cleanup-20260828-summary.md`
- `HANDOFF_2026-08-22.md`
