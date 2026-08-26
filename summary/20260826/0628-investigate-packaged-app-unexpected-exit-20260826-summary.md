---
summary_type: task-summary
created_at: 2026-08-26 JST
task_kind: worker-task
task_status: done
---

## Objective

packaged macOS app の予期しない終了について、crash report、artifact、sidecar/bootstrap、署名、関連 contract test を読み取り専用で切り分ける。

## Scope

| 項目 | 内容 |
|---|---|
| app | `/private/tmp/cornell-method-tauri-target-adhoc-host-20260826/release/bundle/macos/Cornell Method Notebook.app` |
| executable | `Contents/MacOS/cornell-method-notebook` |
| runtime | `Contents/Resources/runtime` |
| 外部ログ | `~/Library/Logs/DiagnosticReports`、Unified Log（sandbox 制約あり） |
| 変更方針 | source、設定、依存関係、lockfile、packaged artifact は変更しない |

## Inputs Read

| 種別 | パス / 対象 | 確認内容 |
|---|---|---|
| crash report | `cornell-method-notebook-2026-08-26-061345.ips`、`061424.ips`、`061650.ips`、controlled 起動の `062158.ips` ほか | signal、termination、faulting thread、parent、launch/exit 時刻 |
| source | `src-tauri/src/main.rs`、`src-tauri/src/runtime.rs`、`src-tauri/src/lifecycle.rs`、`src-tauri/sidecar/launcher.cjs`、`src-tauri/tauri.conf.json` | setup 順序、timeout、stderr、resource mapping |
| local dependency source | `tauri-2.5.1` の `src/app.rs` | setup error が `Failed to setup app` panic になる仕様 |
| app support | `~/Library/Application Support/com.cornellmethod.notebook` | DB / marker / log directory の存在と read-only DB 状態 |
| artifact | `.next` manifest、server tree、Node/Prisma/runtime files | nested route の欠落と required path |

## Changes Made

| パス | 変更内容 |
|---|---|
| `summary/20260826/0628-investigate-packaged-app-unexpected-exit-20260826-summary.md` | 本調査の完了 summary を追加 |
| その他 | 変更なし。既存の未コミット変更は保持 |

## Findings

| ID | 判定 | 内容 / 根拠 |
|---|---|---|
| F-001 | 直接原因 | Finder/LaunchServices 系の crash report（061345、061424、061650）は `EXC_CRASH`、`SIGABRT`、exit code 6。faulting thread は Rust panic → `tao::platform_impl::platform::app_delegate::did_finish_launching`。 |
| F-002 | Tauri 境界 | local `tauri-2.5.1/src/app.rs` の `make_run_event_loop_callback` は `setup(&mut self)` が Err の場合 `panic!("Failed to setup app: {e}")`。今回の abort は署名拒否ではなく、setup failure が AppKit delegate callback 内で panic/abort になったもの。 |
| F-003 | 最有力の setup failure | 061424 は launch `06:13:51.8275` → capture `06:14:22.3800`（約30.55秒）。`launcher.cjs` の local health readiness timeout は30秒、Rust の ready/HTTP timeout は35秒。`start_sidecar` が ready JSON を受け取れず setup が Err になった時系列と一致する。 |
| F-004 | packaged resource defect | packaged runtime の `.next/server` は71 files、nested directoryなし。build 元は140 filesで、`server/app` だけで110 files、`server/chunks` も存在する。packaged には `server/app/api/desktop/health/route.js`、`server/app/api/notes/route.js`、`server/chunks` がない。 |
| F-005 | health handshake との対応 | packaged `app-paths-manifest.json` / `routes-manifest.json` は `/api/desktop/health` → `app/api/desktop/health/route.js` を参照するが、その target file は欠落。build 元の `src/app/api/desktop/health/route.ts` と `.next/server/app/api/desktop/health/route.js` は存在する。従って Next sidecar が health response を返せず、30秒後に launcher が終了した候補が最優先。 |
| F-006 | SQLite bootstrap | disposable home の packaged Node で `paths`、`bootstrap`、`validate-database` はすべて exit 0。実ユーザー DBも `PRAGMA integrity_check=ok`、`foreign_key_check` 無出力、migration 4件すべて finished、packaged launcher の actual app-support `validate-database` も `ready`。SQLite bootstrap / Prisma migration は最有力原因ではない。 |
| F-007 | sidecar log の限界 | `runtime.rs` は launcher stderr を `Stdio::null()`、launcher は Next child の stdout/stderr を `ignore` にしている。実ユーザーの app-support `logs` は空。したがって child の HTTP status / Node stderr は既存 artifact から直接復元できない。 |
| F-008 | controlled 起動 | disposable `CORNELL_DESKTOP_HOME=/private/tmp/cornell-method-worker-home.HW2fsK` で executable を1回起動し、exit `134`。stderr は空、instance lock/owner だけ作成。対応 crash report `062158` は `_RegisterApplication` / `NSApplication` 初期化中の abortで、sidecar/setup 到達前。直接 shell 起動は GUI launch context の別 failure として分離した。 |
| F-009 | 署名 / macOS policy | `codesign --verify --deep --strict --verbose=4` は exit 0、`valid on disk`、`satisfies its Designated Requirement`。app / Node は arm64で、crash report に `codeSigningID=com.cornellmethod.notebook` がある。`spctl` は `internal error in Code Signing subsystem` exit 1で、具体的な signature rejection ではない。ad-hoc signing failure と断定する証拠はない。 |
| F-010 | Unified Log / GUI 制約 | `/usr/bin/log show` は `Cannot run while sandboxed`。`ps` も `operation not permitted`。loopback listener は `listen EPERM: operation not permitted 127.0.0.1`。GUI window、sidecar child の実機終了順、Unified Log は未確認。 |

## Worker Report

完了しました。unexpected exit の直接境界は「Tauri setup hook の Err が Tauri 2.5.1 の `run()` 内で panic し、`did_finish_launching` から SIGABRT」まで特定できました。setup の実体としては、約30秒の readiness timeout と、packaged `.next/server` の nested application route / chunks 欠落が一致するため、Node sidecar が `/api/desktop/health` を ready と返せないことを最有力とします。

packaged resource path / Next route の欠落が artifact defect であることは確定していますが、それが今回の sidecar health failure の直接原因か、child が実際に返した HTTP status または stderr は、現行コードが捨てているため未確定です。SQLite、Prisma migration、strict codesign は PASS であり、静的 contract PASS と packaged GUI crash は分離されます。

## Verification

| 確認項目 | 結果 |
|---|---|
| 作業前 `git status --short` | 既存の未コミット変更を確認し保持 |
| controlled executable | exit 134、対応 crash report 生成、stderr 空 |
| `codesign --verify --deep --strict` | PASS / exit 0 |
| packaged Node `paths/bootstrap/validate-database` | PASS / 各 exit 0 |
| actual app-support read-only SQLite validation | PASS |
| `npm run test:desktop:node-runtime` | 11 PASS / 0 FAIL |
| `npm run test:desktop:lifecycle` | 8 PASS / 7 SKIP / 0 FAIL（loopback sandbox） |
| `node --test test/desktop/desktop-storage.test.js` | 16 PASS / 0 FAIL |
| source / packaged `launcher.cjs` `node --check` | PASS |
| `git diff --check` | PASS |
| Unified Log | BLOCKED: sandbox |
| real loopback sidecar readiness | BLOCKED: `listen EPERM` |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | Next child の実 stderr / health HTTP status | loopback bind と child stderr capture が許可された環境で、同じ artifact の launcher を起動して stderr と child exit order を採取 |
| U-002 | `tauri.conf.json` resource glob が nested `.next/server` を落とす正確な bundler 挙動 | resource mapping を修正した新 artifact の再生成後、`server/app` / `server/chunks` と health route の存在を再確認 |
| U-003 | GUI window/WebView creation までの正常起動 | sidecar ready を満たす修正版 artifact を LaunchServices/Finder から起動し、WindowServer が許可された環境で確認 |

## Next Read

- `src-tauri/tauri.conf.json` の `.next/server` resource mapping
- `src-tauri/src/runtime.rs` の `start_sidecar` / readiness timeout
- `src-tauri/sidecar/launcher.cjs` の `spawnRuntime` / `waitForHttpReady`
- `test/desktop/desktop-node-runtime.test.js`
- `test/desktop/desktop-lifecycle.test.js`
- 修正版 packaged artifact の `.next/server/app/api/desktop/health/route.js` と `.next/server/chunks`
