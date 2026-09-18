---
summary_type: task-summary
created_at: 2026-08-29 JST
task_kind: worker-task
task_status: done
---

## Objective

Current source のテーマ設定と最新削除 UI 文言を含む macOS arm64 Cornell Method Notebook.app を、既存 artifact を再利用せず fresh に生成・検証した。

## Artifact

- App: `/private/tmp/cornell-method-fresh-theme-delete-RXP2vg/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- `BUILD_ID`: `_P6Y1-ewC2UTCf_02f87Y`
- main executable SHA-256: `259347ffcda37bdb0cb99a95794f5f8ad54bbaadb57107e51dd56eb11b6314a7`
- target / architecture: `aarch64-apple-darwin` / Mach-O `arm64`
- bundle identifier: `com.cornellmethod.notebook`
- codesign: ad-hoc、`codesign --verify --deep --strict` PASS

## Verification

- `npm run build`: PASS。source `.next/BUILD_ID` と packaged runtime の BUILD_ID が一致。
- Tauri: `cargo tauri build --target aarch64-apple-darwin --bundles app --ci --config '{"build":{"beforeBuildCommand":"true"}}'`: PASS。新規 `CARGO_TARGET_DIR` で生成。
- packaged `.next` static markers: `ThemeProvider`、`一般`、`テーマ`、`ライト`、`ダーク`、`システム`、`削除`、`削除します`、`削除する` を確認。不要文言 `削除を進める` は不在。
- packaged runtime: arm64 Node、`runtime/sidecar/launcher.cjs`、production `.next/server` / `.next/static`、Prisma client / `schema-engine-darwin-arm64`、arm64 `better_sqlite3.node`、Prisma migrations を確認。
- packaged launcher `paths`: parseable JSON、disposable `CORNELL_DESKTOP_HOME` 配下を確認。
- packaged launcher `bootstrap`: `status=ready`、`reason=migration-complete`、disposable SQLite と initialization marker を確認。
- targeted tests: 31/31 PASS（settings UI、startup recovery、Node runtime）。`git diff --check`: PASS。
- launcher SHA-256 は source と packaged で一致。DMG は生成していない。

## Runtime boundary

- direct app executable は disposable HOME / `CORNELL_DESKTOP_HOME` / `TMPDIR` で起動を試み、`rc=134`。GUI、sidecar ready、HTTP/browser、GUI-mediated DB read-back は未確認。既知の Worker host GUI/OS 制約（`nice(5) failed` / loopback bind 制約）として扱う。
- launcher のデフォルト project-root 解決は package の `Resources` を指したため、packaged `paths/bootstrap` は approved な `CORNELL_DESKTOP_PROJECT_ROOT=Contents/Resources/runtime` を設定して確認した。source 修正は行っていない。
- 標準 `desktop:prepare-node-runtime` は npm cache/network 待ちで完了しなかったため、直前に確認した current repository `node_modules` と arm64 Node / Prisma runtime を disposable staging に明示配置した。required runtime contents と bootstrap は PASS。

## Repository preservation

source、設定、lockfile、Prisma schema、DB、root `Notebook.app` alias、既存 artifact は意図して変更していない。既存の未コミット変更は保持した。コミット、push、DMG 生成は行っていない。

## Next Read

- `src-tauri/sidecar/launcher.cjs`
- `src-tauri/tauri.conf.json`
- `src/app/_components/theme/theme.ts`
- `src/app/_components/theme/theme-provider.tsx`
- `src/app/_components/settings/settings-modal.tsx`
