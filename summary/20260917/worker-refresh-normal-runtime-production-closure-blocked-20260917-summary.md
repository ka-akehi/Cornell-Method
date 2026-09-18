---
summary_type: task-summary
created_at: 2026-09-17 JST
task_kind: worker-task
task_status: blocked
---

## Objective

Source checkout の dependency tree を disposable seed として offline production prune し、`pathe` を含む fresh normal arm64 `.app` を生成・検証する。

## Changes

- 生成物、`Notebook.app` symlink、source、Tauri config、DB、lockfile は変更していない。
- `.desktop-runtime` は開始時状態（`package.json`、`package-lock.json` のみ）を保持した。
- disposable seed と smoke 用 SQLite/log は cleanup 済み。
- 本 summary は実行記録として追加した。生成物変更がないため、changed-files provenance の追加対象はない。

## Blocker

Source `node_modules` を読み取り専用で `/private/tmp/cornell-method-fresh-runtime-closure-20260917-0Jt2r4/seed` に複製し、seed 側だけで次を試行した。

```text
npm prune --omit=dev --offline --no-audit --no-fund
npm prune --omit=dev --offline --legacy-peer-deps --no-audit --no-fund
```

両方とも `ENOTCACHED` で失敗した。

```text
npm error request to https://registry.npmjs.org/debug failed: cache mode is 'only-if-cached' but no cached response is available.
```

Complete source seed の production prune が成立しなかったため、制約に従い fresh runtime、fresh `.app`、fresh bundled Prisma smoke、sidecar/GUI 起動には進まなかった。旧 artifact や不完全 seed を成功扱いにしていない。

## Evidence

- source checkout には `node_modules/pathe/package.json`、`node_modules/@prisma/dev/package.json`、arm64 Prisma engine、production `better_sqlite3.node` が存在した。
- 開始時 `Notebook.app` は `/private/tmp/cornell-method-normal-runtime-pruned-20260917-SmNd83/.../Cornell Method Notebook.app` を指していた。
- 旧 packaged runtime は `pathe` が欠落し、`@prisma/dev`、arm64 Prisma engine、production `better_sqlite3.node` は存在した。
- 旧 bundled Prisma CLI の disposable `migrate deploy --config` は `MODULE_NOT_FOUND: pathe` で終了し、disposable DB は作成されなかった。
- 旧 artifact static identity: `BUILD_ID=BjGVBB59FFaI1ukKvjEVe`、main SHA-256 `1ea1be3954b8406c791205bdaa7fe650a9406879d1bfe8eee57b729934d8ea62`、arm64、`com.cornellmethod.notebook` / `0.1.0`、`codesign --verify --deep --strict` PASS。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npm prune --omit=dev --offline` on disposable source seed | BLOCKED | `ENOTCACHED debug` |
| `npm prune --omit=dev --offline --legacy-peer-deps` | BLOCKED | 同じ `ENOTCACHED debug` |
| `npm run test:desktop:node-runtime` | PASS | 14/14 |
| `npm run typecheck` | PASS |  |
| `git diff --check` | PASS |  |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |  |
| fresh normal arm64 `.app` | NOT RUN | seed prune blocker |
| fresh bundled `migrate deploy --config` | NOT RUN | seed prune blocker |
| sidecar readiness / primary window / GUI | NOT RUN | seed prune blocker |
| source/config/DB/user data preservation | PASS | source node_modules は変更せず、実ユーザーデータ未使用 |
| disposable cleanup | PASS | owned seed、smoke DB/log を削除 |

## Final status

BLOCKED。`Notebook.app` は検証済み fresh artifact を指していないため、旧 symlink のまま保持した。release signing、notarization、Keychain、commit、push、GitHub 操作は行っていない。

## Next Read

- `summary/20260917/worker-refresh-normal-runtime-production-closure-blocked-20260917-summary.md`
- `scripts/prepare-desktop-node-runtime.js`
- `summary/20260917/worker-refresh-normal-runtime-production-closure-20260917-summary.md`
