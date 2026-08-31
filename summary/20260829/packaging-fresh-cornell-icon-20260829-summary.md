# Fresh Cornell icon packaging summary

## Objective

現在の Cornell 用 icon source と repository source を使い、既存 artifact を上書きせず fresh macOS arm64 `.app` を disposable `/private/tmp` に生成・検証した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Tauri macOS arm64 app packaging と静的 / disposable verification |
| 対象ファイル / ディレクトリ | `src-tauri/icons/`, `src-tauri/tauri.conf.json`, current repository build output、`/private/tmp` |
| 対象外 | DMG、GUI acceptance、API / DB / Rust runtime / UI source の変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 引き継ぎ | `HANDOFF_2026-08-28.md` | packaging workflow、既知の host 制約、未コミット変更 |
| task summary | `summary/20260829/tauri-icon-cornell-notebook-summary.md` | Cornell icon source と focused test の完了状態 |
| 設定 | `src-tauri/tauri.conf.json` | `icons/icon.png` の bundle icon path、runtime resources |
| build helper | `scripts/prepare-desktop-node-runtime.js` | arm64 desktop runtime の準備条件 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `/private/tmp/cornell-method-fresh-cornell-icon-e0a0Sl/` | fresh Next / Tauri app、generated ICNS、disposable runtime QA data を作成 | 既存 `.app` を上書きせず package を検証するため |
| repository | source / config の意図的変更なし | Worker task の packaging-only scope を維持 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | fresh app は `/private/tmp/cornell-method-fresh-cornell-icon-e0a0Sl/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app` に生成された。 | Tauri bundle output |
| F-002 | fact | `BUILD_ID` は `cZzlcjosMkzzEH95lWdj9`、main executable SHA-256 は `f230e56d681e168d7ff1c6048e3c9ac92fe09ad1679de0db119e8c0f3c593d99`。 | exact bundle read-back |
| F-003 | fact | bundle ID は `com.cornellmethod.notebook`、main executable は Mach-O arm64、codesign static verification は PASS。 | `Info.plist`、`file`、`codesign --verify --deep --strict` |
| F-004 | fact | packaged `Contents/Resources/icon.icns` は source PNG から disposable に生成した ICNS と SHA-256 / bytes が一致する。`CFBundleIconFile` は `icon.icns`。 | exact ICNS hash / `cmp` / `Info.plist` |
| F-005 | fact | packaged launcher `paths` / `bootstrap` は disposable home 上で rc=0、`status=ready`、`reason=migration-complete`。 | packaged runtime launcher |
| F-006 | fact | 標準 runtime preparation は offline npm cache に `debug` がなく `ENOTCACHED`。外部取得は行わず、既存 repository `node_modules` と arm64 Node/Prisma runtime を disposable staging に配置した。 | `npm_config_offline=true npm run desktop:prepare-node-runtime` |
| F-007 | fact | provenance manifest に今回意図した repository source/config変更はない。summary は運用上 `summary/*` のため manifest 対象外。 | worker recorder / worktree |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npm run build` | PASS | Next production build、Prisma generation、source / packaged BUILD_ID 一致 |
| `node --test test/desktop/tauri-icon-contract.test.js test/desktop/desktop-node-runtime.test.js test/desktop/desktop-startup-recovery.test.js` | PASS | 25/25 |
| Tauri arm64 app bundle | PASS | `cargo tauri build --target aarch64-apple-darwin --bundles app --ci`（icon ICNS は disposable override） |
| bundle identity / architecture / hash | PASS | absolute app path、bundle ID、Mach-O arm64、SHA-256 を確認 |
| codesign static verification | PASS | ad-hoc signing、`codesign --verify --deep --strict` |
| icon provenance | PASS | packaged `icon.icns` と generated ICNS が byte-for-byte 一致。generated ICNS は `src-tauri/icons/icon.png` から生成 |
| packaged launcher paths / bootstrap | PASS | disposable path、SQLite bootstrap ready |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | |
| `git diff --check` | PASS | |
| direct GUI startup | NOT VERIFIED | host の `nice(5) failed: operation not permitted`、rc=134。GUI / WebView / sidecar readiness は未確認 |
| DMG | NOT RUN | task scope 外 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | Finder / Dock / LaunchServices 上の実表示 | permissive macOS host で fresh app を GUI 起動して目視確認 |
| U-002 | packaged sidecar loopback、WebView、HTTP/API read-back | loopback bind が許可された host で disposable data を使った runtime QA |

## Next Read

- `src-tauri/tauri.conf.json`
- `src-tauri/icons/icon.png`
- `src-tauri/icons/icon.svg`
- `test/desktop/tauri-icon-contract.test.js`
