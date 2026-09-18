---
summary_type: task-summary
created_at: 2026-08-28 JST
task_kind: worker-task
task_status: done
---

## Objective

通常版 release の Web Inspector を無効のまま維持し、Cargo diagnostic feature と明示的な runtime opt-in の両方を満たす場合だけ Tauri WKWebView の inspector を有効にできる Apple Silicon packaged app を生成した。

## Changes Made

| パス | 変更内容 |
|---|---|
| `src-tauri/Cargo.toml` | `diagnostic-web-inspector = ["tauri/devtools"]` を追加。default feature は変更していない。 |
| `src-tauri/src/main.rs` | `CORNELL_DESKTOP_DIAGNOSTIC_WEB_INSPECTOR=1` の厳密な runtime 判定と、feature-gated な `WebviewWindowBuilder::devtools(true)` を追加。 |
| `test/desktop/desktop-devtools-contract.test.js` | feature、runtime opt-in、`withGlobalTauri`、capability、navigation、same-origin 403 の静的 contract を追加。 |
| `summary/20260828/diagnostic-web-inspector-build-20260828-summary.md` | artifact identity、起動方法、検証結果、未検証範囲を記録。 |

`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`、capability、permission、proxy、API、DB schema はこの task では変更していない。開始時から存在した未コミット変更、`Notebook.app` alias、既存 artifact、DB、runtime seed は保持した。

## Enablement contract

- Release devtools support is compiled only with `--features diagnostic-web-inspector`; the feature maps only to `tauri/devtools` and is not a default feature.
- The builder calls `.devtools(true)` only inside `#[cfg(feature = "diagnostic-web-inspector")]` and only when `CORNELL_DESKTOP_DIAGNOSTIC_WEB_INSPECTOR` is exactly `1`.
- Missing, empty, `0`, `true`, or any other value does not opt in. The normal packaged release build therefore does not automatically expose Web Inspector.
- `withGlobalTauri` remains false. Existing remote loopback capability, command allowlists, navigation guard, same-origin guard, redirect policy, API transport, and DB contracts were not changed.

## Artifact identity

| 項目 | 結果 |
|---|---|
| exact app | `/private/tmp/cornell-method-tauri-target-devtools-20260828/release/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app` |
| target | `aarch64-apple-darwin` |
| `CFBundleIdentifier` | `com.cornellmethod.notebook` |
| `CFBundleExecutable` | `cornell-method-notebook` |
| executable | Mach-O 64-bit `arm64` |
| packaged `BUILD_ID` | `EDrKC5_Fdl3X2g1DpD5ud` |
| main executable SHA-256 | `88d91e7196433511f524b5cfc2d45f4f7f974e2f33c5f01c678037bde96372cc` |
| codesign | ad-hoc (`Signature=adhoc`); `codesign --verify --deep --strict` PASS |

Packaged `runtime/node`、`runtime/package.json`、`runtime/node_modules`、`runtime/sidecar/launcher.cjs`、`runtime/.next/BUILD_ID`、`runtime/prisma`、`runtime/config/project-env.js` を確認した。実行ファイルには diagnostic environment marker、state-changing API marker、remote loopback URL、allowlist marker、startup diagnostic markers が存在する。

## Launch command for Safari inspection

実データを使わない disposable directory を用意してから、exact executable を次のように起動する。

```sh
mkdir -p /private/tmp/cornell-method-tauri-target-devtools-20260828/disposable-home \
  /private/tmp/cornell-method-tauri-target-devtools-20260828/disposable-data \
  /private/tmp/cornell-method-tauri-target-devtools-20260828/disposable-tmp
env \
  HOME=/private/tmp/cornell-method-tauri-target-devtools-20260828/disposable-home \
  CORNELL_DESKTOP_HOME=/private/tmp/cornell-method-tauri-target-devtools-20260828/disposable-data \
  TMPDIR=/private/tmp/cornell-method-tauri-target-devtools-20260828/disposable-tmp \
  CORNELL_DESKTOP_DIAGNOSTIC_WEB_INSPECTOR=1 \
  /private/tmp/cornell-method-tauri-target-devtools-20260828/release/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app/Contents/MacOS/cornell-method-notebook
```

Safari の Develop メニューを有効にし、app window が表示された後に `Develop > Cornell Method Notebook` の WebView entry を選択する。Inspector では `location.origin`、`window.__TAURI_INTERNALS__`、invoke command/result、Network の request origin/status/body、console error を確認する。

## Verification

- `node --test test/desktop/desktop-devtools-contract.test.js test/desktop/desktop-tauri-capability.test.js`: 8/8 PASS。
- default Rust targeted test: diagnostic opt-in tests 2/2 PASS。
- `cargo test --offline --features diagnostic-web-inspector ... tests::diagnostic_web_inspector`: 2/2 PASS。
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS。
- `git diff --check`: PASS。
- `tauri.conf.json` と `Cargo.lock` の git diff: 無変更。
- diagnostic build: `cargo tauri build --target aarch64-apple-darwin --bundles app --ci --features diagnostic-web-inspector --config '{"build":{"beforeBuildCommand":""}}'` status 0。
- root `.desktop-runtime` は build 前の通常 directory に復元し、`Notebook.app` alias の置換は行っていない。

## Unverified boundary

Worker host では GUI 表示、Safari Develop menu への WebView 出現、Web Inspector 操作、Tauri invoke の実行結果、sidecar loopback、Network request、DB/read-back は実測していない。既存 handoff に記録された host 制約（packaged direct startup の abort と `127.0.0.1` bind `EPERM`）のため、上記 launch command と disposable directories を permissive な macOS host で実行する必要がある。ユーザー home、SQLite、backup、credential、saved state、crash report、既存 artifact は読んでいない。

## Next Read

- `summary/20260828/diagnostic-web-inspector-build-20260828-summary.md`
- `HANDOFF_2026-08-28.md`
- `doc/implementation/MVP_CONTRACT.md`
