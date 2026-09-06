---
summary_type: task-summary
created_at: 2026-09-06 JST
task_kind: worker-task
task_status: done
---

## Objective

Current checkout の managed backup catalog `recoveryOnly` 分離、managed restore、backup export Replace、Settings UI 修正を含む Apple Silicon normal release `.app` を fresh disposable target に生成し、identity と static QA 結果を固定した。

## Scope

対象は current source の normal Apple Silicon `.app` packaging、成功時の root `Notebook.app` symlink、build/identity/static verification summary である。DMG、packaged GUI runtime、sidecar runtime、native dialog、実ユーザー data は対象外とした。

## Inputs Read

- `HANDOFF_2026-08-31.md`
- `summary/20260906/0703-rebuild-current-normal-packaged-app-for-runtime-qa-20260906-d63f1940-summary.md`
- `src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`
- backup/restore/catalog focused tests and current source files

## Findings

| ID | 判定 | 内容 |
|---|---|---|
| F-001 | PASS | fresh normal `.app` build と ad-hoc deep/strict codesign verification に成功した。 |
| F-002 | PASS | artifact identity は BUILD_ID、main hash、Mach-O arm64、bundle ID/version で固定され、`Notebook.app` alias と一致した。 |
| F-003 | PASS | normal artifact に app-specific diagnostic/runtime opt-in と wildcard capability marker はない。 |
| F-004 | PASS | `recoveryOnly` は current source と packaged sidecar/storage resource に反映されている。 |
| F-005 | PASS | focused desktop contracts は 51 PASS / 0 FAIL / 0 SKIP だった。 |

## Changes Made

| パス | 変更内容 |
|---|---|
| `Notebook.app` | 成功した fresh normal artifact への symlink に更新 |
| `summary/20260906/worker-rebuild-normal-artifact-current-source-20260906-fIB1qs8-summary.md` | build / identity / boundary / verification summary を作成 |

source、設定、依存関係、lockfile、DB、MVP 契約、実ユーザー data は変更していない。DMG、GUI runtime、sidecar runtime、native dialog、実ユーザー data の読み書きは実施していない。

## Artifact Identity

- artifact: `/private/tmp/cornell-method-normal-runtime-qa-8Gdmh6/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- `BUILD_ID`: `fIB1qs8IxwiH_P23PYXae`
- main executable SHA-256: `f8d8403e4f8fbbcdc7c7224a49f48022ba845d18d104d2491f1f9b096e2cb366`
- target: `aarch64-apple-darwin`
- Mach-O architecture: `arm64`
- bundle ID / version: `com.cornellmethod.notebook` / `0.1.0`
- codesign: ad-hoc (`Signature=adhoc`); `codesign --verify --deep --strict --verbose=2`: PASS
- root alias: `Notebook.app` の `readlink` は上記 exact artifact と一致。alias 経由の BUILD_ID と main hash も一致。

## Build

- PASS: `CARGO_TARGET_DIR=/private/tmp/cornell-method-normal-runtime-qa-8Gdmh6/tauri-target cargo tauri build --target aarch64-apple-darwin --bundles app --ci --config '{"build":{"beforeBuildCommand":"true"},"bundle":{"icon":["/private/tmp/cornell-method-normal-icon-e3E6Il/icons/icon.icns"]}}'`
- `diagnostic-web-inspector` feature、`CORNELL_DESKTOP_DIAGNOSTIC_WEB_INSPECTOR`、wildcard capability、その他の診断専用 opt-in は指定していない。
- 初回 bundle は source icon の `No matching IconType` で失敗したが、alias は変更しなかった。source PNG を disposable staging にコピーして一時 ICNS を生成し、config override で再実行して成功した。source icon/config は変更していない。

## Verification

| 確認項目 | 結果 |
|---|---|
| fresh normal `.app` build | PASS |
| identity / BUILD_ID / main hash / arm64 / bundle ID / version | PASS |
| ad-hoc deep strict codesign | PASS |
| targeted diagnostic/runtime opt-in markers | PASS（bundle の app-specific runtime/config/capability 対象に該当なし） |
| wildcard capability marker | PASS（該当なし） |
| current source `recoveryOnly` | PASS（sidecar 10 行、storage 18 行） |
| packaged bundle `recoveryOnly` | PASS（sidecar 10 行、`runtime/src/server/infrastructure/desktop-storage.js` に反映） |
| source / packaged sidecar byte comparison | PASS |
| focused desktop contracts | PASS: 51 / FAIL: 0 / SKIP: 0 |
| `git diff --check` | PASS |
| DMG / packaged GUI / sidecar / native dialog | NOT RUN（task 対象外） |

Focused contracts は backup export Replace、managed restore の safety backup 分離、managed catalog `recoveryOnly`、Settings UI、diagnostic feature/runtime boundary を含む。

## Final Workspace Status

作業後 `git status --short` では、開始時から存在した source/docs/tests の変更と `summary/20260906/` の未追跡変更を保持し、Worker が意図して追加した repository 成果物は `Notebook.app` と本 summary のみである。コミット、push、GitHub 操作は行っていない。

## Remaining Unknowns

- packaged GUI 起動、sidecar listen、native dialog、実ユーザー data の読み書きは未確認。task で対象外。
- build 時に既存 Rust warning は出力されたが、release build と focused tests は成功した。

## Next Read

- `summary/20260906/worker-rebuild-normal-artifact-current-source-20260906-fIB1qs8-summary.md`
- `Notebook.app`
- exact artifact: `/private/tmp/cornell-method-normal-runtime-qa-8Gdmh6/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
