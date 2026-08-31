---
summary_type: task-summary
created_at: 2026-08-28 JST
task_kind: worker-task
task_status: done
---

## Objective

現在の worktree source/config から、後続 runtime QA 用の専用 fresh Apple Silicon macOS `.app` を生成し、identity と static packaging 検証を固定した。DMG は既存 target を試行し、失敗を app と分離した。

## Artifact identity

| 項目 | 結果 |
|---|---|
| app | `/private/tmp/cornell-method-tauri-target-runtime-qa-20260828/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app` |
| target | `aarch64-apple-darwin` |
| bundle ID | `com.cornellmethod.notebook` |
| executable | `cornell-method-notebook` |
| executable format | Mach-O 64-bit arm64 |
| BUILD_ID | `EDrKC5_Fdl3X2g1DpD5udDMG` |
| main executable SHA-256 | `e20cb89195e0794a9e2ff17386524524640744dfbe7d67343b6990fc13dbe38d` |
| codesign | PASS: ad-hoc `codesign --verify --deep --strict` |

## Build and DMG

- `npm run build`: PASS。Prisma generate、Next production compile、TypeScript、static generation 完了。
- `cargo tauri build --target aarch64-apple-darwin --bundles app,dmg --ci` は beforeBuild の production runtime install が npm registry DNS / cache 制約で停止した。
- source/config/lockfile を変更しないため、root `node_modules` と生成済み arm64 Prisma engine / client / Node executable を disposable `.desktop-runtime` staging に複製し、`--config '{"build":{"beforeBuildCommand":"true"}}'` で Tauri packaging を再試行した。この結果 Rust release compile と `.app` bundle は PASS。
- DMG target は実行されたが `bundle_dmg.sh` が失敗し、`Cornell Method Notebook_0.1.0_aarch64.dmg` は生成されなかった。host の `hdiutil` / disk-image device configuration 制約が blocker で、DMG checksum / `hdiutil verify` は未実施。

## Static resource verification

PASS: `runtime/node`, `runtime/node_modules`, `runtime/package.json`, `runtime/.next/server`, `runtime/.next/static`, `runtime/.next/BUILD_ID`, `runtime/prisma`, `runtime/sidecar/launcher.cjs`, `runtime/config/project-env.js`, `runtime/src/generated`, `runtime/src/server/infrastructure/desktop-storage.js`, `runtime/next.config.ts`, `runtime/prisma.config.ts`, `runtime/public`。

PASS: packaged executable strings contain current state-changing API permission, remote/local capability markers, sidecar startup / readiness / cleanup failure markers, and diagnostics marker set.

## Targeted verification

| Check | Result |
|---|---|
| desktop bridge / capability contract | PASS, 8/8 |
| packaged Node runtime tests | PASS, 12/12 |
| lifecycle tests | PASS 9, SKIP 7; disposable loopback listener is forbidden on this host |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `git diff --check` | PASS |
| Rust targeted test command | BLOCKED: package has no library target; bin test retry hit `Not a directory (os error 20)` in the debug custom build path |
| `npm run lint` | FAIL, known repository baseline: 36 errors / 8 warnings |

## Preservation and boundaries

開始時と完了時の `git status --short` を確認した。開始時に存在した未コミット変更、`AGENTS.md`、`HANDOFF_2026-08-28.md`、既存 summary、root `Notebook.app` broken alias、既存 artifact / DB / user data は変更・削除していない。Tauri CLI が一時的に書き換えた `src-tauri/Cargo.toml` は開始時状態へ戻した。追跡対象の意図的変更はこの summary のみで、source/config/依存関係/lockfile/DB/alias は実装修正していない。

後続 QA では、permissive macOS host 上で exact app path、BUILD_ID、main hash を再確認すること。GUI、external loopback WebView、sidecar ready / health、Tauri invoke、same-origin 403、note save/read-back、backup read-back、window restoration warning、DMG attach/read-back は本 task では未検証である。

## Next Read

- `summary/20260828/fresh-packaged-runtime-qa-20260828-summary.md`
- `HANDOFF_2026-08-28.md`
