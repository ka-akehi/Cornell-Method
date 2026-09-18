---
summary_type: task-summary
created_at: 2026-09-06 JST
task_kind: worker-task
task_status: done
---

## Objective

close lifecycle fix を含む current source から Apple Silicon 向け normal release `.app` を fresh に生成し、成功した artifact へ `Notebook.app` を更新した。

## Changes Made

| パス | 変更内容 |
|---|---|
| `Notebook.app` | fresh normal artifact への symlink に更新 |
| `summary/20260906/worker-rebuild-normal-app-20260906-summary.md` | build / identity / 境界の証跡を記録 |

source、設定、依存関係、lockfile、DB、MVP 契約、実ユーザー data は変更していない。DMG は生成していない。

## Artifact Identity

- path: `/private/tmp/cornell-method-close-fix-normal-20260906-FhigAv/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- `BUILD_ID`: `TP446-_3y5FLHBQwztoXM`
- main executable SHA-256: `3fcb96f784f43d268b057d2f9a3ad3d5531d1c0048108f7d020b2f1d96936fa6`
- target / architecture: `aarch64-apple-darwin` / Mach-O `arm64`
- bundle ID / version: `com.cornellmethod.notebook` / `0.1.0`
- codesign: ad-hoc、`codesign --verify --deep --strict` PASS
- `Notebook.app` readlink は上記 exact path と一致し、alias 経由の BUILD_ID / hash も一致した。

## Normal / Diagnostic Boundary

- build は `--bundles app`、Cargo default features（空）で実行した。
- `diagnostic-web-inspector` feature、`CORNELL_DESKTOP_DIAGNOSTIC_WEB_INSPECTOR`、wildcard capability は指定・混入させていない。
- packaged Resources の static marker scan（diagnostic feature / runtime opt-in / wildcard capability / devtools）は該当ファイルなし。Rust build warning でも diagnostic constants は未使用であり、diagnostic feature 未有効の通常 build と整合する。

## Verification

| 確認項目 | 結果 |
|---|---|
| fresh normal `.app` build | PASS |
| app existence / BUILD_ID / main hash | PASS |
| Mach-O arm64 | PASS |
| bundle ID / version | PASS |
| ad-hoc codesign verify | PASS |
| diagnostic / runtime opt-in / wildcard markers | PASS（該当なし） |
| root alias identity | PASS |
| final `git status --short` | ` M Notebook.app` のみ |

Build 中に registry 到達不可による production `npm ci` failure と、1024px source icon の bundler mapping failure が発生したが、source は変更せず disposable runtime copy と一時 512px icon、before-build CLI override で解消した。最終 build は exit code 0。

## Remaining Unknowns

- packaged GUI runtime、sidecar、native dialog、実ユーザー data の読み書き、DMG は task 対象外のため未確認。

## Next Read

- `summary/20260906/worker-rebuild-normal-app-20260906-summary.md`
- `Notebook.app`
- exact artifact path（上記 Artifact Identity）
