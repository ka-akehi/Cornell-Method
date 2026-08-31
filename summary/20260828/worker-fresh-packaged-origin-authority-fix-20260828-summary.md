---
summary_type: task-summary
created_at: 2026-08-28 JST
task_kind: worker-task
task_status: done
---

## Objective

Current source including the proxy request-authority fix was packaged as a fresh Apple Silicon diagnostic macOS app in an isolated output root.

## Artifact identity

| Item | Result |
|---|---|
| exact app | `/private/tmp/cornell-method-tauri-target-origin-authority-fix-20260828/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app` |
| target | `aarch64-apple-darwin` |
| `CFBundleIdentifier` | `com.cornellmethod.notebook` |
| `CFBundleExecutable` | `cornell-method-notebook` |
| executable format | Mach-O 64-bit arm64 |
| packaged `BUILD_ID` | `D3ivKYV6DMzwPPfIklhcN` |
| main executable SHA-256 | `8aa7689853fc1da017f5202e45a469267d329d7eb56dcc0aac874c1e991c863a` |
| codesign | ad-hoc; `codesign --verify --deep --strict` PASS |

The output root is new and contains no replacement of the repository target, `Notebook.app` alias, or prior diagnostic artifacts. Only the `.app` bundle was requested; no DMG was generated.

## Build and source relationship

- `npm run build`: PASS (Prisma generation, Next.js production build, TypeScript, static generation).
- `cargo tauri build --target aarch64-apple-darwin --bundles app --ci --features diagnostic-web-inspector --config '{"build":{"beforeBuildCommand":""}}'` with `CARGO_TARGET_DIR=/private/tmp/cornell-method-tauri-target-origin-authority-fix-20260828`: PASS.
- The normal runtime install attempted by `desktop:prepare-node-runtime` could not use the registry/cache (`ENOTCACHED`); disposable staging was prepared from the existing local dependencies and generated arm64 Prisma artifacts. No source, config, lockfile, or DB was changed.
- Diagnostic enablement remains opt-in: Cargo feature `diagnostic-web-inspector` and exact environment value `CORNELL_DESKTOP_DIAGNOSTIC_WEB_INSPECTOR=1`. The default feature set was not changed.
- Packaged `.next/server` contains the proxy same-origin marker and current compiled server resources; packaged executable markers include the diagnostic env contract, state-changing API command, loopback capability, and startup/cleanup diagnostics.

## Packaged resources

PASS: `runtime/node`, `runtime/package.json`, `runtime/node_modules`, `runtime/sidecar/launcher.cjs`, `runtime/.next/BUILD_ID`, `runtime/.next/server`, `runtime/.next/static`, `runtime/prisma`, `runtime/config/project-env.js`, `runtime/src/generated`, `runtime/src/server/infrastructure/desktop-storage.js`, `runtime/next.config.ts`, `runtime/prisma.config.ts`, and `runtime/public`.

## Verification

| Check | Result |
|---|---|
| targeted auth/proxy, devtools, capability tests | PASS, 22/22 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `git diff --check` | PASS |
| disposable direct startup | Attempted once; process was stopped after 8 seconds; host emitted `nice(5) failed: operation not permitted` |
| Worker provenance manifest | empty; no intended repository source/config/lockfile/DB changes recorded |
| before/after `git status --short` | unchanged tracked/untracked worktree state; pre-existing changes preserved |

## Unverified boundary

Worker host constraints prevent confirmation of GUI rendering, Safari Web Inspector, sidecar readiness/loopback bind, same-origin HTTP request status, Tauri invoke result, note save/read-back, backup/SQLite read-back, and window restoration warning. The packaged HTTP 403 reproduction was not attempted and must not be inferred from the startup result. The startup observation is not evidence of a packaged-app defect on a permissive macOS host.

## Changed files

No repository source/config/lockfile/DB files were intentionally changed. This summary is the only repository deliverable created by this Worker; build output and disposable staging are under `/private/tmp`.

## Next Read

- `summary/20260828/worker-fresh-packaged-origin-authority-fix-20260828-summary.md`
- `HANDOFF_2026-08-28.md`
- `src/proxy.ts`
- `src/server/auth/basic-auth.js`
