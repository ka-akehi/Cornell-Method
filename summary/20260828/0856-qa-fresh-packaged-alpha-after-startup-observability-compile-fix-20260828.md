---
summary_type: task-summary
created_at: 2026-08-28 08:56 JST
task_kind: worker-task
task_status: done
---

## Objective

指定された fresh arm64 packaged app の identity、静的 diagnostics / capability、隔離した direct startup、packaged sidecar の loopback 起動可否を確認する。GUI が到達可能な場合の Settings / Data and Backup、ノート保存、backup 作成も確認対象とし、起動不能時は same-origin、Tauri invoke、HTTP 403、window restore warning と分離して記録する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | macOS packaged app startup、sidecar loopback、desktop bridge / capability、Data and Backup の runtime QA |
| 対象 artifact | `/private/tmp/cornell-method-tauri-target-current-source-after-startup-observability-compile-fix-20260828/release/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app` |
| disposable 環境 | `/private/tmp` の新規 disposable home / `TMPDIR` のみ。実ユーザー home、既存 SQLite、既存 backup、saved state、crash report は対象外 |
| 対象外 | コード・設定・依存関係・lockfile・既存 artifact・alias・HANDOFF の変更、外部サービス接続、GUI の非隔離起動 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 引き継ぎ | `HANDOFF_2026-08-22.md` | current packaged alpha の既知の startup / loopback 制約、既存変更の保持範囲 |
| 関連 summary | `summary/20260828/0727-add-sanitized-startup-failure-observability-20260828-c95d241c-summary.md` | startup stage code と cleanup の実装範囲 |
| 関連 summary | `summary/20260828/0748-fix-sidecar-startup-error-conversion-20260828-9c54be5d-summary.md` | compile fix の範囲 |
| build summary | `summary/20260828/build-current-source-after-startup-observability-compile-fix-20260828-summary.md` | fresh app の生成 identity、既存 static verification、DMG 未生成 |
| source | `src-tauri/src/diagnostics.rs`, `src-tauri/src/main.rs`, `src-tauri/src/runtime.rs` | sanitized error allowlist、startup order、sidecar stage mapping / origin validation |
| source | `src/shared/desktop/desktop-api-bridge.ts`, `src/shared/desktop/desktop-settings-bridge.ts` | native state-changing bridge と Settings / Data and Backup command surface |
| source | `src/modules/notes/remote/transport.ts`, `src/modules/backup/remote/index.ts` | notes / backup の state-changing transport |
| capability / contract | `src-tauri/capabilities/default.json`, `src-tauri/permissions/app-commands.toml`, `test/desktop/desktop-tauri-capability.test.js`, `test/desktop/desktop-api-bridge-contract.test.js` | local / remote capability、固定 command allowlist、same-origin transport 契約 |
| app bundle | `Contents/Info.plist`、main executable、compiled strings、同梱 `runtime/sidecar/launcher.cjs` | packaged identity、arm64、BUILD_ID、diagnostics / capability marker、sidecar command order |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260828/0856-qa-fresh-packaged-alpha-after-startup-observability-compile-fix-20260828.md` | QA 結果、実行コマンド、証拠、未確認範囲を記録 | Worker 完了要約 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 対象 `.app` は存在し、`CFBundleIdentifier=com.cornellmethod.notebook`、`CFBundleExecutable=cornell-method-notebook`、Mach-O `arm64`、BUILD_ID `cZbD3ISDyjv-IhavTZK45`、main executable SHA-256 `4113e36008e37f32c90c79db966cb93e9f1e8b31b474b7b1d1f443313dbbf6c6` だった。 | `PlistBuddy`、`file`、`shasum -a 256`、bundle `BUILD_ID` |
| F-002 | fact | app は ad-hoc codesign で、`codesign --verify --deep --strict` は `valid on disk` / designated requirement 満足で PASS。 | `codesign -dv --verbose=4`、`codesign --verify --deep --strict --verbose=2` |
| F-003 | fact | packaged main executable に `sidecar-spawn-failed`、`sidecar-ready-handshake-failed`、`sidecar-ready-url-invalid`、`sidecar-health-check-failed`、`sidecar-startup-cleanup-failed`、remote backup / diagnostics / state-changing API permission marker が存在した。 | `strings` の固定 marker presence check |
| F-004 | fact | app direct startup は disposable `CORNELL_DESKTOP_HOME` / `HOME` / `TMPDIR` で二度試行し、いずれも `rc=134`。一回目は `nice(5) failed: operation not permitted`、二回目は非 login shell で `Abort trap: 6` を観測した。 | direct executable の終了コード、shell を変えた再試行 |
| F-005 | fact | direct startup の disposable inventory は settings の instance lock / owner と一時 socket directory のみで、logs は空、listener は残らなかった。lock / owner の内容は読んでいない。 | disposable directory の names/types-only inventory、PID / listener check |
| F-006 | fact | app 起動直後の app-specific sanitized diagnostics は取得できなかった。disposable logs に診断ファイルがなく、stderr 全文や crash report は読んでいない。 | logs inventory が空 |
| F-007 | fact | 同梱 packaged Node + `runtime/sidecar/launcher.cjs serve` を別 disposable root で実行すると、stderr は安全な固定句だけを抽出して `listen EPERM` / `operation not permitted`、終了コード 1。ready URL、nonce、HTTP body は出力・記録していない。 | packaged sidecar direct serve |
| F-008 | fact | sidecar source / launcher の順序では ephemeral loopback port を取得してから runtime child を spawn する。今回の bind failure では ready handshake、ready URL validation、health check、external WebView navigation に到達しない。 | `runtime.rs`、同梱 `launcher.cjs` の `pickEphemeralPort` → `spawnRuntime` → `waitForHttpReady` |
| F-009 | fact | targeted desktop contract test は 8/8 PASS。Node runtime test は 12/12 PASS。lifecycle test は 9 PASS / 7 SKIP で、SKIP 理由は runner が disposable loopback listener を許可しないため。 | `node --test ...`、`npm run test:desktop:node-runtime`、`npm run test:desktop:lifecycle` |
| A-001 | assumption | `nice(5)` の permission failure と loopback `EPERM` は current runner の host policy / capability 制約と整合するが、permissive macOS host で再現するまで app の恒久的不具合とは断定しない。 | 現行 handoff の既知制約と今回の再測定 |
| U-001 | unknown | macOS window restore warning の実状態は未確認。app は window 表示前に終了し、saved state / crash report は読んでいない。 | GUI 未到達、制約により saved state 非接触 |
| U-002 | unknown | external loopback WebView、same-origin message、Tauri invoke rejection、command unavailable、HTTP 403 は未観測。 | app / sidecar が ready 前に終了 |
| U-003 | unknown | Settings > Data and Backup の pending restore status、managed backup catalog、backup / recovery modal は未確認。 | GUI 未到達 |
| U-004 | unknown | disposable ノートの create / update / read-back / delete、backup destination 選択・作成・read-back は未確認。 | GUI / HTTP runtime 未到達 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| app existence / bundle identity / arm64 / BUILD_ID / main hash | PASS | 指定値と一致 |
| ad-hoc codesign | PASS | `codesign --verify --deep --strict` 成功 |
| packaged diagnostics / capability static markers | PASS | binary marker presence、source capability contract と一致 |
| desktop capability / bridge contract | PASS | 8/8 |
| packaged Node runtime checks | PASS | 12/12 |
| lifecycle contract checks | PASS with SKIP | 9 PASS / 7 SKIP。loopback listener 制約による SKIP |
| app direct startup | FAIL | disposable root で `rc=134` / `Abort trap: 6`; `nice(5)` permission failure も観測 |
| packaged sidecar loopback bind | BLOCKED | `listen EPERM`、終了コード 1。ready / health 未到達 |
| app-specific sanitized diagnostics | UNKNOWN | log file が空で、stage code の app runtime 記録なし |
| `/notes` display / external WebView | BLOCKED | sidecar ready 前に app 終了 |
| Settings / Data and Backup | BLOCKED | GUI 未到達 |
| pending restore / managed backup catalog | BLOCKED | GUI / Tauri invoke 未到達 |
| disposable note save / read-back | BLOCKED | API runtime 未到達 |
| disposable backup creation / read-back | BLOCKED | API runtime 未到達 |
| backup / recovery modal | BLOCKED | GUI 未到達 |
| same-origin 403 / message failure | UNKNOWN, not observed | bridge が実行される前に終了。403 と混同しない |
| command unavailable / Tauri invoke rejection | UNKNOWN, not observed | remote WebView が生成されず未観測 |
| HTTP 403 | UNKNOWN, not observed | state-changing request が送信されず未観測 |
| window restore warning | UNKNOWN, not observed | macOS saved state / crash report 非接触 |
| worktree preservation | PASS | summary 追加前の `git status --short` は開始時 status と一致。source/config/lockfile/DB/alias/HANDOFF/既存 artifact は変更なし |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | permissive host での real app startup、window 表示、external WebView、sidecar ready / health | `127.0.0.1` bind と GUI 起動を許可する macOS host |
| U-002 | Settings / Data and Backup の実 GUI と native invoke、pending restore / catalog | U-001 成功後の同じ disposable 環境での GUI 操作 |
| U-003 | note mutation と backup mutation の HTTP / native bridge response、DB / backup read-back | sidecar ready 後の disposable API / UI E2E |
| U-004 | macOS saved-window-state warning の因果関係 | permissive host での再起動 / window lifecycle の実測。crash report は別途許可された診断範囲でのみ確認 |

## Next Read

- `HANDOFF_2026-08-22.md`
- `summary/20260828/0856-qa-fresh-packaged-alpha-after-startup-observability-compile-fix-20260828.md`
- `src-tauri/src/diagnostics.rs`
- `src-tauri/src/runtime.rs`
