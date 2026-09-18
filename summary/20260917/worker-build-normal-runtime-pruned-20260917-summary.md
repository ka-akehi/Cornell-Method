---
summary_type: task-summary
created_at: 2026-09-17 22:00 JST
task_kind: worker-task
task_status: done
---

## Objective

Current checkout と runtime pruning 変更を含む fresh normal Apple Silicon macOS `.app` を disposable target に生成し、静的検証後に root `Notebook.app` symlink を exact artifact へ更新した。

## Changes

- `Notebook.app` symlink を `/private/tmp/cornell-method-normal-runtime-pruned-20260917-SmNd83/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app` へ更新。
- `scripts/prepare-desktop-node-runtime.js`、`test/desktop/desktop-node-runtime.test.ts`、既存 untracked summary、source/config/DB/lockfile は変更していない。
- `.desktop-runtime` は開始時 archive から復元した。

## Artifact identity

- `BUILD_ID`: `BjGVBB59FFaI1ukKvjEVe`
- main executable SHA-256: `1ea1be3954b8406c791205bdaa7fe650a9406879d1bfe8eee57b729934d8ea62`
- architecture: `arm64` (`file` / `lipo -archs`)
- Bundle ID/version: `com.cornellmethod.notebook` / `0.1.0`
- codesign: ad-hoc; `codesign --verify --deep --strict` PASS; TeamIdentifier unset
- root alias exact identity: PASS

## Runtime inventory

- required present: `runtime/node_modules/@prisma/engines/schema-engine-darwin-arm64`, `runtime/node_modules/better-sqlite3/build/Release/better_sqlite3.node`
- forbidden absent: `prebuilds/darwin-x64`, `prebuilds/ios-*`, `better-sqlite3/build/Release/test_extension.node`, `@prisma/engines/schema-engine-darwin`
- exact diagnostic web-inspector feature/opt-in strings absent from main executable; wildcard capability file/marker absent from packaged Tauri resources

## Verification

- `npm run build`: PASS
- `npm run test:desktop:node-runtime`: 14/14 PASS
- `npm run typecheck`: PASS
- `node --check scripts/prepare-desktop-node-runtime.js`: PASS
- `git diff --check`: PASS
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- fresh target packaging: PASS using local `cargo tauri 2.11.4`; disposable config override disabled only icon generation and before-build rerun
- initial helper `npm ci` and offline retry were not network-completed: offline cache lacked `debug` metadata (`ENOTCACHED`). Preserved local runtime seed was used with the current helper pruning/inspection functions; no network fallback was used.

## Evidence boundary / not performed

- No DMG, notarization, staple, `notarytool`, Apple service, Developer ID release signing, Keychain, commit, push, or GitHub operation.
- Packaged GUI/browser/DB read-back and runtime startup acceptance remain unverified.
- Artifact is normal ad-hoc signed, not a notarized or Developer ID release.

## Final status

Final `git status --short` preserves the starting modified files and untracked summaries, plus the intentional `Notebook.app` symlink change. The new summary is intentionally untracked and not included in provenance.

## Next Read

- `summary/20260917/worker-build-normal-runtime-pruned-20260917-summary.md`
- `scripts/prepare-desktop-node-runtime.js`
- `test/desktop/desktop-node-runtime.test.ts`
- `/private/tmp/cornell-method-normal-runtime-pruned-20260917-SmNd83/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
