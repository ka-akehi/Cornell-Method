---
summary_type: task-summary
created_at: 2026-09-17 22:12 JST
task_kind: worker-task
task_status: blocked
---

## Objective

Fresh normal arm64 `.app` の packaged runtime を disposable desktop data で起動し、sidecar / loopback / `/notes` と MVP の最小 note 操作を確認する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象 artifact | `/private/tmp/cornell-method-normal-runtime-pruned-20260917-SmNd83/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app` |
| 対象操作 | exact app launch、GUI、sidecar readiness、health、`/notes`、note CRUD、cleanup |
| 対象外 | source / configuration / dependency / lockfile / existing artifact の変更、外部サービス接続 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-09-07.md` | 既存の evidence boundary と未確認範囲 |
| prior summary | `summary/20260917/worker-build-normal-runtime-pruned-20260917-summary.md` | fresh artifact identity と static verification の既存結果 |
| contract | `doc/implementation/MVP_CONTRACT.md` | MVP route、保存、削除、API 境界 |
| packaged runtime | exact `.app` | BUILD_ID、bundle、runtime launcher、native binary inventory |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260917/worker-qa-packaged-runtime-pruned-20260917-summary.md` | QA summary を追加 | Worker task の観測結果を保存 |

Source、runtime helper / test、設定、依存関係、lockfile、DB schema、`Notebook.app` symlink、既存 artifact は変更していない。開始時に存在した `Notebook.app`、`scripts/prepare-desktop-node-runtime.js`、`test/desktop/desktop-node-runtime.test.ts` の変更と既存 summary は保持した。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | artifact identity は指定値と一致した。`BUILD_ID=BjGVBB59FFaI1ukKvjEVe`、main SHA-256=`1ea1be3954b8406c791205bdaa7fe650a9406879d1bfe8eee57b729934d8ea62`、Mach-O=`arm64`、Bundle ID/version=`com.cornellmethod.notebook` / `0.1.0`。 | `BUILD_ID`、`shasum -a 256`、`file`、`otool -hv`、`Info.plist` |
| F-002 | fact | `codesign --verify --deep --strict` は exit 0。ad-hoc signature、TeamIdentifier unset。 | `codesign --verify`、`codesign -dvv` |
| F-003 | fact | 作業前後の `readlink Notebook.app` は exact artifact と一致した。 | `readlink Notebook.app` |
| F-004 | fact | exact main executable の direct launch は `nice(5) failed: operation not permitted` を出して終了し、GUI / primary window に到達しなかった。 | disposable env での direct launch、launch PID 終了、CUA state |
| F-005 | fact | CUA による exact `.app` launch は 24.8 秒で timeout。直後の app state は `Cornell Method Notebook isRunning=false`。 | CUA `getApp(exact path)`、`getState` |
| F-006 | fact | `/usr/bin/open -n` による exact `.app` launch は exit 1、`kLSNoExecutableErr: The executable is missing`。 | `open` stderr |
| F-007 | fact | packaged sidecar launcher の standalone `serve` 試行は ready 前に `DATABASE_URL must be an absolute file: URL` で停止した。QA 制約上 `DATABASE_URL`、project-root、runtime override は設定していない。 | exact bundle 内 launcher の実行、sanitized stderr |
| F-008 | unknown | app 本体が起動前停止したため、sidecar ready、dynamic loopback URL、health、WebView `/notes`、note create/save/read-back/delete/deleted read-back は観測できなかった。 | 起動前 blocker |
| F-009 | fact | same-origin 403、native invoke rejection、browser fallback は観測されなかった。UI が生成されていないため、成功の証拠にもしていない。 | CUA state、diagnostic output |
| F-010 | fact | Worker が起動した main / sidecar PID は終了し、disposable QA root は削除した。process inventory 全体は `sysmond` 不在 / permission error のため取得できず、未知の child process については完全保証しない。 | `kill -0`、限定 cleanup、`pgrep` / `ps` error |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| exact artifact identity | PASS | 指定 BUILD_ID / hash / arm64 / bundle metadata と一致 |
| ad-hoc codesign static verification | PASS | `codesign --verify --deep --strict` exit 0 |
| `Notebook.app` symlink identity | PASS | 作業前後とも exact artifact |
| runtime pruning inventory | PASS (static only) | bundled Node / `better_sqlite3.node` は arm64。`test_extension.node`、x64 / query-engine filename candidates は absent。既存 build summary の required / forbidden inventory も参照 |
| packaged app launch | BLOCKED | `nice(5) failed: operation not permitted`; CUA timeout; `open` returned `kLSNoExecutableErr` |
| sidecar ready / loopback / health | BLOCKED / NOT REACHED | app orchestrator の DB env を注入できず standalone launcher も ready 前停止 |
| `/notes` | BLOCKED / NOT RUN | primary window 未到達 |
| note create / explicit save / read-back / delete / deleted read-back | NOT RUN | UI / HTTP runtime 未到達。sentinel note は作成していない |
| same-origin / invoke / browser fallback distinction | NOT OBSERVED | エラー表示可能な WebView 自体が未生成 |
| process / disposable cleanup | PASS for owned attempts; UNKNOWN for uninspectable children | owned PID は終了、QA root は削除 |
| repository preservation | PASS | source 等を変更せず、summary のみ意図して追加 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | GUI host 上で exact artifact が primary window を開けるか | `nice(5)` / LaunchServices blocker を解消できる同一環境での CUA 起動結果 |
| U-002 | packaged sidecar が app orchestrator から supplied absolute SQLite URL で ready になるか | app 起動成功後の sanitized ready / health 観測 |
| U-003 | `/notes` と note CRUD の packaged WebView acceptance | primary window、loopback、UI または同一 app boundary の request/response evidence |
| U-004 | 未取得の child process がないこと | process inventory permission が利用可能な環境での PID / listener 確認 |

## Next Read

- `summary/20260917/worker-qa-packaged-runtime-pruned-20260917-summary.md`
- `summary/20260917/worker-build-normal-runtime-pruned-20260917-summary.md`
- `/private/tmp/cornell-method-normal-runtime-pruned-20260917-SmNd83/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
