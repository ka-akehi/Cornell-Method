---
summary_type: task-summary
created_at: 2026-08-26 JST
task_kind: worker-task
task_status: done
---

## Objective

packaged app の通常終了で Node sidecar が orphan になる境界を、Tauri の終了経路、Rust の Child/process group ownership、launcher の signal handling から切り分ける。コード、設定、依存関係、lockfile、packaged artifact は変更しない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | macOS packaged Tauri / Node sidecar lifecycle |
| 対象ファイル / ディレクトリ | `src-tauri/src/runtime.rs`、`src-tauri/src/lifecycle.rs`、`src-tauri/src/main.rs`、`src-tauri/sidecar/launcher.cjs`、関連 desktop tests、指定 `.app` |
| 対象外 | Apple Developer portal、証明書・秘密鍵・notarization、コード修正、artifact の再生成・削除 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| source | `src-tauri/src/runtime.rs` | launcher `Child`、process group、`SidecarHandle::stop` / `Drop`、ready handshake |
| source | `src-tauri/src/lifecycle.rs` | `AppState` ownership、`finalize_close`、close bridge、update restart 経路 |
| source | `src-tauri/src/main.rs` | `ExitRequested`、`WindowEvent::CloseRequested`、Tauri `.run()` callback |
| source | `src-tauri/sidecar/launcher.cjs` | `runtimeChild`、`stopRuntime`、`SIGTERM` / `SIGINT`、child exit wait |
| tests | `test/desktop/desktop-lifecycle.test.js`、`test/desktop/desktop-node-runtime.test.js` | launcher cleanup と static lifecycle contract。`RunEvent::Exit` cleanup の回帰契約は未存在 |
| dependency source | local `tauri-2.5.1`、`tauri-runtime-wry-2.9.3`、`tao-0.34.8` | macOS `applicationWillTerminate`、`RunEvent::Exit`、`process::exit` の順序 |
| artifact | `/private/tmp/cornell-method-tauri-target-next-server-adhoc-host-20260826/release/bundle/macos/Cornell Method Notebook.app` | resource、署名、runtime files、既存 normal-close HOME |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| repository source/config/dependency/lockfile/artifact | 変更なし | 調査 task の制約 |
| `summary/20260826/investigate-packaged-sidecar-orphan-lifecycle-20260826-summary.md` | 調査 summary を追加 | 完了要約と Next Read を固定 |
| `/private/tmp/cornell-method-worker-*` | launcher / codesign の診断出力と disposable HOME を作成。削除していない | 既存 artifact・disposable data を削除しない制約を維持 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | Rust は launcher process を `SidecarHandle.child` として保持し、Unix では `process_group(0)` で launcher の PID を process group ID として扱う。`stop()` は group TERM、最大5秒待機、残存時 group KILL、root child wait を行う。 | `runtime.rs:806-812`、`runtime.rs:1897-2069` |
| F-002 | fact | launcher は `runtimeChild`（Next child）を保持し、SIGTERM/SIGINT で `stopRuntime()` を呼び、child を SIGTERM→wait→SIGKILL fallback する。ready 後も child exit を wait している。 | `launcher.cjs:24`、`launcher.cjs:1081-1184`、`launcher.cjs:1228-1229` |
| F-003 | fact | 通常の close bridge は `finalize_close()` で `handle.stop()` を `window.destroy()` / `app.exit(0)` より前に実行する。従ってこの経路だけなら launcher orphan にはなりにくい。 | `lifecycle.rs:684-705` |
| F-004 | fact | `main.rs` が処理するのは `RunEvent::ExitRequested` だけで、`RunEvent::Exit` には cleanup 処理がない。`ExitRequested` は prevent して close bridge に渡す。 | `main.rs:254-270`、`main.rs:390-396` |
| F-005 | fact | local Tauri 2.5.1 は `RuntimeRunEvent::Exit` callback の後に `cleanup_before_exit()` を呼ぶが、これは Tauri resource table の掃除であり、managed `AppState` の `SidecarHandle` を停止しない。Tauri `App::run()` は event loop 終了後に直接 process exit する。 | local `tauri-2.5.1/src/app.rs:1005-1019`、`1270-1292`、`1201-1229` |
| F-006 | fact | macOS tao では `applicationWillTerminate` が `AppState::exit()` を呼び、LoopDestroyed → `RunEvent::Exit` を発生させる。通常 Cmd-Q のこの経路は `ExitRequested` ではない。event loop は `process::exit(exit_code)` で終了するため、Rust Drop は cleanup の根拠にならない。 | local `tao-0.34.8/src/platform_impl/macos/app_delegate.rs:58-65,131-135`、`event_loop.rs:197-244`、`tauri-runtime-wry-2.9.3/src/lib.rs:4008-4010` |
| F-007 | conclusion | orphan の直接原因は「GUI close と process exit の hook が別経路」である。Cmd-Q の AppKit termination が `RunEvent::Exit` に到達したとき、Tauri は Child を保持していても `SidecarHandle::stop()` を呼ばず、`process::exit` により parent が先に終了する。その結果 launcher は PPID 1 に reparent される。分類は主に **GUI close と process exit の hook が別経路**、直後の OS 上の現象は **parent death による launcher orphan**。 | F-001、F-003〜F-006、Manager の実観測「Tauri exit 0 後も `runtime/node runtime/sidecar/launcher.cjs serve` が PPID 1」 |
| F-008 | ruled out / not primary | launcher が SIGTERM を受けても child を停止しないこと、process group 設定そのもの、ad-hoc signing、Next resource mapping、SQLite bootstrap は今回の主因ではない。 | F-002、F-001、artifact checks、既存 normal-close 観測 |
| F-009 | fact | normal-close disposable HOME の `.instance.owner` は `pid:11437`、ファイル時刻は 2026-08-26 07:31:08。後続の `kill -0 11437` は no such process で、app PID は終了済みと確認できる。ただし launcher / Next の数値 PID と各 exit 時刻は HOME / artifact に永続化されていない。 | `/private/tmp/cornell-packaged-next-server-normal-close-home-20260826/.../.instance.owner`、`kill -0 11437` |
| F-010 | fact | 安全な direct launcher 試行では launcher PID 37837、PPID 37834 を記録したが、loopback bind が `EPERM` で `pickEphemeralPort()` 前に失敗し、Next child は生成されなかった。packaged GUI の再現は process list (`ps` / `pgrep`) が sandbox で拒否され、起動後の自分の descendant PID を確実に回収できないため中止した。 | 実行結果 `listen EPERM: operation not permitted 127.0.0.1`、`ps: operation not permitted`、`pgrep: Cannot get process list` |
| F-011 | fact | resource / signing / SQLite は分離して PASS。artifact は `.next/server/app/api/desktop/health/route.js` present、server 140 files、chunks 13 files。`codesign --verify --deep --strict` exit 0、CodeDirectory は `adhoc,runtime`。artifact `validate-database` は `ready / migration-complete`。 | artifact read-only checks、`launcher.cjs validate-database` |

## Minimal Fix Candidate

1. `AppState` に idempotent な `stop_sidecar_for_exit()` を設け、既存 `finalize_close()` と共有する。
2. `main.rs` の Tauri run callback で `RunEvent::Exit` を明示処理し、Tauri の `cleanup_before_exit()` / Tao の `process::exit` より前に `AppState` の sidecar を stop/wait する。`finalize_close()` 済みなら `Option::None` で no-op にする。
3. `request_explicit_update_restart()` と startup `RestartRequired` も同じ final `Exit` cleanup に通ることを確認する。`Drop`、parent death、process group だけに依存しない。

回帰条件:

- packaged Apple Silicon `.app` を fresh disposable HOME で起動し、app PID、launcher PID、Next PID、各 PPID、ready port を記録する。
- Cmd-Q、window close、dirty close の save/discard、explicit restart の各経路で、app が exit 0 になる前に launcher と Next が終了し、ready port が closed、残存 PID がないことを確認する。
- launcher 単体では SIGTERM 後に launcher exit 0、Next child exit、port closed を確認する。
- static contract に `RunEvent::Exit` cleanup の存在と `finalize_close` との idempotence を追加する。loopback / GUI 権限のない環境では skip し、packaged GUI PASS と混同しない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 既存の未コミット変更を確認・保持 |
| `node --test test/desktop/desktop-lifecycle.test.js` | PASS | 8 PASS / 7 SKIP / 0 FAIL。loopback 7件は環境制約 |
| `node --test test/desktop/desktop-node-runtime.test.js` | PASS | 11 PASS / 0 FAIL |
| `node --check src-tauri/sidecar/launcher.cjs` | PASS | |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | |
| packaged resource mapping | PASS | health route / chunks / server tree present |
| packaged ad-hoc signature | PASS | `codesign --verify --deep --strict` exit 0 |
| packaged SQLite validation | PASS | `ready / migration-complete` |
| packaged GUI Cmd-Q 再現 | NOT VERIFIED | `ps` / `pgrep` / loopback が sandbox 制約。既知 Manager 観測と local Tauri source で原因確定 |
| 作業後 `git status --short` | PASS | source/config/dependency/lockfile の既存差分を保持。今回の repo 追加は本 summary のみ |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | Manager が観測した normal-close run の launcher / Next 数値 PID、PPID、時刻ごとの exit order | host GUI + process introspection が許可された環境で、ready handshake の `runtimePid` と process table を同時採取 |
| U-002 | 実 host で Cmd-Q が必ず `applicationWillTerminate` 経路になることの event trace | Tauri/tao trace または host Unified Log。現在の source topology からは最有力かつ orphan 観測と整合 |
| U-003 | Tauri `RunEvent::Exit` callback 内での最大10秒 sidecar wait が WindowServer termination と競合しないこと | 最小修正後の packaged GUI regression。現状コード変更は未実施 |

## Next Read

- `src-tauri/src/main.rs`
- `src-tauri/src/lifecycle.rs`
- `src-tauri/src/runtime.rs`
- `src-tauri/sidecar/launcher.cjs`
- `test/desktop/desktop-lifecycle.test.js`
- local `tauri-2.5.1/src/app.rs` と `tao-0.34.8` macOS event loop source
