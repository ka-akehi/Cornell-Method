---
summary_type: task-summary
created_at: 2026-09-17 JST
task_kind: worker-task
task_status: blocked
---

## Objective

既存 lockfile から production dependency closure を fresh に再生成し、`pathe` を含む normal arm64 packaged `.app` を検証する。

## Changes

- `scripts/prepare-desktop-node-runtime.js`
  - 既存の arm64 native pruning / inspection を維持。
  - `@prisma/dev/package.json` と `pathe/package.json` を required production dependency として fail-closed inspection に追加。
- `test/desktop/desktop-node-runtime.test.ts`
  - 上記 dependency manifest の fixture と、`pathe` 欠落時の fail-closed test を追加。
- `package.json`、`package-lock.json`、`src-tauri/src/main.rs`、DB/schema、MVP API は変更していない。
- 開始時から存在した `Notebook.app` の変更は保持し、fresh 検証前の symlink 更新は行っていない。

## Fresh install blocker

`.desktop-runtime` を生成物から空にして source の package/lock をコピーした後、fresh `npm ci --omit=dev` を試行した。

- bounded online install: `ENOTFOUND https://registry.npmjs.org/debug`
- offline install: `ENOTCACHED`（`debug` の cached response なし）
- npm cache verify: root-owned cache file に対する `EPERM`

install は成功しておらず、`.desktop-runtime/node_modules` は存在しない。不完全 seed や source `node_modules` の流用による build は行っていない。

## Reproduction / artifact evidence

開始時の `Notebook.app` が指す旧 artifact で、disposable SQLite URL を使った packaged Prisma CLI を直接実行したところ、次で停止した。

`Error: Cannot find module 'pathe'`（`@prisma/dev/dist/state.cjs` からの require）

旧 artifact の static identity は以下のとおりで、fresh artifact ではない。

- path: `/private/tmp/cornell-method-normal-runtime-pruned-20260917-SmNd83/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- `BUILD_ID`: `BjGVBB59FFaI1ukKvjEVe`
- main SHA-256: `1ea1be3954b8406c791205bdaa7fe650a9406879d1bfe8eee57b729934d8ea62`
- architecture: `arm64`
- bundle ID / version: `com.cornellmethod.notebook` / `0.1.0`
- `codesign --verify --deep --strict`: PASS
- packaged `runtime/node_modules/pathe`: absent

## Verification

- PASS: `npm run test:desktop:node-runtime`（14/14）
- PASS: `node --check scripts/prepare-desktop-node-runtime.js`
- PASS: `npm run typecheck`
- PASS: `git diff --check`
- PASS: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- FAIL unrelated baseline: `npm run lint`（Canvas / backup の既存 React lint errors 36件、warning 8件）
- NOT RUN: fresh normal arm64 `.app` build、fresh packaged `migrate deploy --config`、sidecar readiness / primary window。fresh npm install blocker のため。

## Final status

`Notebook.app` symlink は検証済み fresh artifact を指していないため、旧 artifact のまま保持した。release signing / notarization / user data access / commit / push / GitHub 操作は行っていない。source/test の意図した変更は `worker-record-change.sh` に記録済み。

## Next Read

- `scripts/prepare-desktop-node-runtime.js`
- `test/desktop/desktop-node-runtime.test.ts`
- `summary/20260917/worker-build-normal-runtime-pruned-20260917-summary.md`
- `summary/20260917/worker-qa-packaged-runtime-pruned-20260917-summary.md`
