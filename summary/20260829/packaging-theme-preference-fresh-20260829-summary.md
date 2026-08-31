---
summary_type: task-summary
created_at: 2026-08-29 JST
task_kind: worker-task
task_status: done
---

## Objective

Current source including the theme preference implementation was rebuilt into a fresh macOS arm64 `.app` under disposable `/private/tmp` output.

## Artifact

- App: `/private/tmp/cornell-method-theme-package-FKJH4B/target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- `BUILD_ID`: `TZQdYYvnriCMKvUEg0XuT`
- Main executable SHA-256: `c1b2194fb82a89c8c1b19fe74a68237abc3a9e6e50dc0850946ed048dd2256b6`
- Main executable: Mach-O 64-bit `arm64`
- Bundle identifier: `com.cornellmethod.notebook`
- Codesign: ad-hoc; `codesign --verify --deep --strict` PASS

## Build and static verification

- `npm run build`: PASS on retry; Next.js 16.2.9 production output regenerated from current source.
- Tauri packaging: PASS with `cargo tauri build --target aarch64-apple-darwin --bundles app --ci --config '{"build":{"beforeBuildCommand":"true"}}'` in a new disposable Cargo target.
- Packaged runtime contains arm64 `node`, `sidecar/launcher.cjs`, `.next/server`, `.next/static`, Prisma client, arm64 `schema-engine-darwin-arm64`, and arm64 `better_sqlite3.node`.
- Theme markers in packaged `.next`: `ThemeProvider`, theme initializer/mode markers, and `ライト`, `ダーク`, `システム`, `一般` all found.
- The artifact is not a copied prior app; its BUILD_ID and main executable hash were read from this exact newly generated bundle.

## Disposable runtime verification

- Packaged launcher `paths`: PASS, parseable `storage-paths` JSON, all paths under task-specific `/private/tmp` HOME.
- Packaged launcher `bootstrap`: PASS, `status=ready`, `reason=migration-complete`, disposable SQLite and initialization marker created.
- Direct app executable startup: `rc=134`; GUI/WebView and child sidecar readiness were not confirmed. This is consistent with the known Worker host GUI/OS restriction; no user HOME or database was used.
- DMG was not generated.

## Packaging note

The prescribed `npm ci --omit=dev` runtime preparation could not complete because the host npm cache lacked `debug` and network access was unavailable. The disposable runtime staging was therefore populated from the current repository `node_modules`, with the current arm64 Node executable and Prisma runtime copied explicitly. The packaged required runtime contents and bootstrap passed. Generated `.desktop-runtime/node_modules` cleanup was attempted but the host left a partial ignored staging directory; source/config/lockfile/schema/DB/root alias were not changed.

## Repository preservation

No source, configuration, lockfile, Prisma schema, database, root `Notebook.app` alias, or existing artifact was intentionally changed. No commit or push was made. `git diff --check` passed. Pre-existing worktree changes remain present.

## Next Read

- `src-tauri/sidecar/launcher.cjs`
- `src-tauri/tauri.conf.json`
- `src/app/_components/theme/theme.ts`
- `src/app/_components/theme/theme-provider.tsx`
