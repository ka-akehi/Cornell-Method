---
summary_type: task-summary
created_at: 2026-08-28 JST
task_kind: worker-task
task_status: done
---

## Objective

Fresh packaged app の起動直後終了と macOS の saved-window-state 復元警告を、source、Tauri 設定、packaged artifact、既存の sanitized log から read-only で切り分ける。コード、設定、依存関係、DB、既存成果物、alias は変更しない。

## Scope and preservation

- Source: `src-tauri/src/main.rs`, `lifecycle.rs`, `runtime.rs`, `window_state.rs`, `tauri.conf.json`, capability / permission、desktop settings bridge、sidecar launcher。
- Artifact: `/private/tmp/cornell-method-tauri-target-current-source-after-desktop-ui-capability-20260828/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- 既存 dirty worktree、`Notebook.app` alias、DB、ノート、backup、saved state、crash report は保持し、今回の調査で参照・変更していない。app-specific sanitized log だけは指定範囲として確認した。

## Inputs Read

- 最新 handoff と、2026-08-28 の packaged build / runtime QA / lifecycle summary。
- 指定された Tauri source、window state、config、capability、permission、settings bridge、sidecar launcher。
- 対象 fresh `.app` の Info.plist、Mach-O metadata、Resources layout、codesign metadata。
- 許可された app-specific sanitized log 4件。DB、ノート、backup、saved state、crash report は読んでいない。

## Changes Made

- 本 summary を新規作成した。
- source/config/lockfile/DB/既存 artifact/alias は変更していない。

## Startup path

`src-tauri/src/main.rs:338-527` の `setup` は次の順序である。

1. single-instance focus listener を開始し、owner/socket を管理する。
2. packaged runtime root と storage layout を解決する。
3. update state を読み、staged migration と startup update recovery を実行する。
4. DB bootstrap を実行する。recovery-only の場合は sidecar を起動しない。
5. 通常起動では Node sidecar を spawn し、ready JSON、`127.0.0.1:<dynamic-port>/notes`、nonce 付き `/api/desktop/health` を検証する。
6. validated external URL で primary WebView を build する。
7. custom `settings/window-state.json` を読み、geometry を適用し、window を show/focus する。
8. 通常起動では startup update check を非同期開始する。

Setup 内のいずれかの失敗は `run_application` から `main` に戻り、`std::process::exit(1)`（`main.rs:550-566`）になる。したがって sidecar bind / ready / health failure は window 表示前終了の具体的候補である。

## Findings

### Fact

- `src-tauri/src/runtime.rs:2333-2425` は packaged `runtime/node` で `sidecar/launcher.cjs serve` を起動し、ready handshake と HTTP health を最大35秒待つ。launcher は `127.0.0.1` の ephemeral port を bind し、Next runtime を production mode で spawn する（`launcher.cjs:1162-1181,1372-1401,1439-1467`）。
- sidecar の stderr は Rust 側で `Stdio::null()`（`runtime.rs:2373-2374`）、Next child の stdout/stderr も `ignore`（`launcher.cjs:1387-1396`）。ready 前の実原因は、現行の通常 app log には詳細が残らない設計である。
- `SidecarHandle::stop` は Unix process group に TERM、最大5秒後に KILL を送り、child と process group の終了を確認する（`runtime.rs:2533-2593`）。これは通常終了・起動失敗時の cleanup 実装であり、今回の実 GUI 正常終了の証明ではない。
- custom window state は `settings/window-state.json` の geometry 4項目だけを読み、visible monitor 外なら補正する（`window_state.rs:28-121`）。保存は close finalization 時の `capture_window_state`（`lifecycle.rs:940-950`）で行う。
- Tauri config は `app.windows` が空で、window は Rust setup で動的に一つだけ作る（`tauri.conf.json:11-16`, `main.rs:466-492`）。source に Tauri window-state plugin、NSWindow restoration API、macOS saved-state の削除・変更処理は確認できない。`Info.plist` にも `NSQuitAlwaysKeepsWindows` 等の restoration 制御キーはない。
- packaged `Info.plist` は `CFBundleExecutable=cornell-method-notebook`、bundle ID `com.cornellmethod.notebook`、package type `APPL`、version `0.1.0`。main executable と bundled Node はともに thin arm64 Mach-O。main SHA-256 は `9cffabdd650fb6f451fc1b6de53ea91ae782c51329cb905dbeb588ad2a01fec3`、BUILD_ID は `6A932olg1ZMFJupJnYhOG`。
- packaged resource layout には `runtime/node`、`runtime/sidecar/launcher.cjs`、`.next/BUILD_ID`、`.next/server`、`.next/static`、`node_modules`、Prisma、generated source、desktop storage module が存在する。ad-hoc codesign と `codesign --verify --deep --strict` は PASS。静的に resource path / architecture / bundle identifier の不整合は見つからない。
- capability / permission の focused contract tests は 8/8 PASS。remote URL は `http://127.0.0.1::port/*`、remote command allowlist は feature-scoped、local allowlist も登録 command を包含する。
- 許可された app-specific sanitized log directory には4件の event JSONL があり、全件 `component=sidecar`, `errorCode=sidecar-start-failed`, `message=A desktop operation failed.`, `stack=redacted`。sidecar が起動経路の観測点になった事実はあるが、bind、spawn、ready、health のどこで失敗したかは log から分からない。

### Inference / candidate

- **Candidate A（最有力、ただし host 依存）: sidecar bind / ready failure が setup を window 表示前に止める。** 既存 QA の runner では `listen EPERM: operation not permitted 127.0.0.1`、app direct launch は rc=134 / SIGABRT が観測され、今回の sanitized log も sidecar failure と一致する。反証は、これらが permissive host での fresh app 再現ではなく、runner の bind / GUI 制約でも説明できる点。最小再現条件は、同一 fresh artifact と disposable home を、loopback bind が許可された macOS host で起動すること。
- **Candidate B: setup 内の storage / update recovery / bootstrap failure。** これらは sidecar より前に実行され、失敗すれば window 表示前終了になる。反証は、対象 artifact の disposable bootstrap / SQLite validation が既存 QA で PASS、sanitized log の component が sidecar であること。startup update state や実ユーザー storage の内容は今回読んでいないため完全除外はしない。
- **Candidate C: macOS が前回の異常終了後に saved window を再開しようとして警告している。** 警告文は macOS の前回異常終了・window restoration 状態の症状としては整合する。ただし source は OS saved state を明示的に操作せず、custom geometry state も setup 後に適用するため、custom `window-state.json` が警告の直接原因という根拠はない。警告を消す修正の要否は、permissive host で startup failure の実原因を先に取得してから判断する。
- **Candidate D: same-origin error / Tauri invoke rejection。** 今回の起動警告の直接原因とは扱わない。WebView、sidecar ready、HTTP request、native invoke まで到達していないため、origin、command、403 の観測点が存在しない。bridge は marker / request 条件に応じて native invoke または browser fallback を選ぶが、これは runtime request の別問題である。

### Unknown

- permissive macOS host で main executable が rc=134 になるか、window creation 前後のどこで終了するか。
- macOS の unified log / crash report に現れる実際の SIGABRT reason。今回の制約により crash report は読んでいない。
- sidecar の実 spawn 結果、ephemeral port、ready nonce、health response、WebView document origin、`window.__TAURI_INTERNALS__`、native invoke、API status/body。
- macOS saved-window-state が実際に再開対象として残っているか。saved state は読んでいない。

## Remaining Unknowns

- permissive macOS host での direct startup / SIGABRT の再現性と正確な終了地点。
- sidecar の bind、ready、health、WebView、native invoke、API request の runtime 証跡。
- macOS saved-window-state の実状態と、警告が再発する条件。

## Verification

- `git status --short`: 作業前後とも既存 dirty state を保持。今回の意図的変更はこの summary のみ。
- `node --check src-tauri/sidecar/launcher.cjs`: PASS。
- `node --test test/desktop/desktop-tauri-capability.test.js test/desktop/desktop-api-bridge-contract.test.js`: 8/8 PASS。
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS。
- `git diff --check`: PASS。
- `PlistBuddy`, `file`, `lipo -info`, `shasum -a 256`, `codesign -d/-verify`, resource existence scan: PASS / expected metadata。
- app 起動、sidecar 起動、loopback bind、GUI 操作、alias 更新、saved state 操作、DB / backup 操作、crash report 読み取り: 未実施。

## Recommended next single-responsibility coding task

permissive host で同じ fresh artifact の direct startup が再現した場合だけ、`src-tauri/src/main.rs` と `src-tauri/src/runtime.rs` を対象に「startup failure observability and safe pre-window failure handling」を実装する task を別投入する。範囲は、sidecar spawn / bind / ready timeout / health failure の sanitized allowlisted error code と、stderr を秘密・ユーザーデータなしで診断 log に残すこと、および setup failure の終了経路を focused test することに限定する。window restoration の変更、saved-state 削除、origin bridge 修正は同じ task に混ぜない。

完了条件は、(1) permissive host で原因コードが取得できる、(2) stderr / path / credential / note data を露出しない、(3) sidecar bind failure と WebView/native invoke failure を別イベントとして記録する、(4) startup failure 時に child/process group/instance marker が残らないことを disposable test で確認する、の4点。

## Changed files

- `summary/20260828/investigate-startup-window-restoration-warning-20260828-summary.md` のみ。source/config/lockfile/DB/既存 artifact/alias は変更なし。

## Next Read

- 本 summary の `Startup path`、`Findings`、`Recommended next single-responsibility coding task`。
- permissive host での fresh packaged runtime QA summary（実行後に追加）。
