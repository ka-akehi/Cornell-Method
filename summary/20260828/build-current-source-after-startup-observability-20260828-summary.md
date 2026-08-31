---
summary_type: task-summary
created_at: 2026-08-28 JST
task_kind: worker-task
task_status: blocked
---

## Objective

現行 source の startup diagnostics / cleanup 変更を含む arm64 macOS app/DMG を、既存 seed を再利用して新規 disposable target へ fresh build する。

## Result

- Target: `/private/tmp/cornell-method-tauri-target-current-source-after-startup-observability-20260828`
- `npm run build`: PASS。fresh BUILD_ID は `PVRx76MbDHyvePeJhaloq`、`.next/server/app` は 110 files、`.next/server/chunks` は 13 files、`server/app/api/desktop/health/route.js` は存在。
- Tauri packaging: BLOCKED。Rust compile は `src-tauri/src/lifecycle.rs:311` の `?` に対する `SidecarStartupError -> String` 変換不足 `E0277` で停止。`src-tauri/src/runtime.rs:1084` の新しい error type と、既存未コミット `lifecycle.rs` の呼び出し側が不整合。
- `.app`: 未生成。DMG: 未生成。従って app checksum、bundle/codesign/runtime/capability/diagnostics の packaged 検証、DMG SHA-256 / `hdiutil verify` は未取得。

## Seed and safety

- 指定 seed は target の `seed-runtime` に複製し、seed 自体は変更・削除していない。
- disposable `.desktop-runtime` へ seed を staging し、現行生成 Prisma client と arm64 `better_sqlite3.node` を補填した。作業後は作業前 snapshot と一致する状態へ復元。
- root `.next` も作業前 snapshot へ復元。既存 artifact、target、`Notebook.app` alias、未コミット変更、summary 群は上書きしていない。
- Tauri CLI が一時変更した `src-tauri/Cargo.toml` の `features = []` は復元済み。package/config/lock/schema の最終 checksum は build 前後で一致。

## Verification

- `node --test test/desktop/desktop-tauri-capability.test.js test/desktop/desktop-api-bridge-contract.test.js`: PASS 8/8
- `npm run test:desktop:node-runtime`: PASS 12/12
- `npm run test:desktop:lifecycle`: PASS 9、SKIP 7。runner が disposable loopback listener を許可しないため。
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- `git diff --check`: PASS
- `npm run lint`: FAIL。既存 canvas/ref・effect 系を中心に 36 errors / 8 warnings。今回の packaging task では修正していない。
- Rust targeted test: 未実行。Tauri compile が上記 E0277 で停止。
- GUI、loopback 実 runtime、browser/API read-back、DB read-back、process timing: 未検証。

## Next Read

`src-tauri/src/lifecycle.rs:311` の `start_sidecar` error conversion を、発注者の承認した別修正として整合させた後、同じ target は上書きせず新しい target で packaging を再実行する。
