---
summary_type: task-summary
created_at: 2026-08-28 JST
task_kind: worker-task
task_status: blocked
---

## Objective

指定された exact fresh packaged app を disposable 環境で起動し、ノート保存・backup の同一オリジン 403 を native bridge、browser fallback、proxy 判定、artifact / origin 不一致、sidecar / WebView 起動失敗に分離する。source、設定、依存関係、DB、alias、既存 artifact は変更しない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象 artifact | `/private/tmp/cornell-method-tauri-target-runtime-qa-20260828/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app` |
| disposable 環境 | `/private/tmp` 配下の新規 `HOME`、`CORNELL_DESKTOP_HOME`、`TMPDIR`、SQLite / backup 用ディレクトリ |
| 対象 source | `src/proxy.ts`、`src/server/auth/basic-auth.js`、desktop bridge / transport、`src-tauri/src/runtime.rs`、capability / permission |
| 対象外 | 実ユーザー home、SQLite、backup、credential、saved state、crash report、外部サービス、root `Notebook.app` alias |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-28.md` | 最新 artifact、既知の loopback / GUI blocker、次の最小調査 |
| packaged build summary | `summary/20260828/fresh-packaged-runtime-qa-20260828-summary.md` | exact artifact の build / static 検証、DMG blocker |
| exact rebuild summary | `summary/20260828/1144-rebuild-current-packaged-alpha-for-runtime-qa-20260828-275c316f-summary.md` | exact path、BUILD_ID、hash、bundle ID、codesign の既存証跡 |
| shared transport summary | `summary/20260828/0625-investigate-note-save-backup-shared-transport-20260828-a143f31b-summary.md` | note / backup の共通 bridge、A〜D の静的分類 |
| same-origin summary | `summary/20260828/0546-investigate-current-alpha-same-origin-after-loopback-ipc-20260828-a5c44d62-summary.md` | 過去の request 前 blocker と未観測範囲 |
| source | 対象 source / capability files | fixed 403 message、Origin / Referer guard、bridge → fetch fallback、native URL 検証の境界 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260828/1200-investigate-desktop-same-origin-runtime-cause-20260828-summary.md` | exact runtime QA の redacted 証拠、分類、未観測範囲を記録 | Worker 完了要約 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | exact `.app` は存在し、main executable の SHA-256 は指定値 `e20cb89195e0794a9e2ff17386524524640744dfbe7d67343b6990fc13dbe38d` と一致した。`CFBundleIdentifier` は `com.cornellmethod.notebook`、executable は Mach-O 64-bit `arm64` だった。 | `stat`、`shasum -a 256`、`PlistBuddy`、`file`、`lipo` |
| F-002 | fact | bundle 内 `Contents/Resources/runtime/.next/BUILD_ID` の実値は `EDrKC5_Fdl3X2g1DpD5ud`（21 bytes）で、task 指定 `EDrKC5_Fdl3X2g1DpD5udDMG` とは不一致だった。指定 BUILD_ID の artifact 内 occurrence も見つからなかった。 | exact bundle の BUILD_ID bytes / artifact search |
| F-003 | fact | exact path の root `Notebook.app` alias は実行していない。hash と bundle ID / architecture は一致したが、BUILD_ID 不一致があるため、stale artifact か build summary の記録差かは確定しない。 | 実行コマンドの対象 path、F-001〜F-002 |
| F-004 | fact | 既存 exact build summary では ad-hoc codesign と `codesign --verify --deep --strict` PASS が記録されている。今回の再確認コマンドは host 上で 30 秒超 return せず、今回の live recheck は PASS として扱っていない。 | `summary/20260828/fresh-packaged-runtime-qa-20260828-summary.md`、今回の bounded metadata / verify probe |
| F-005 | fact | host loopback bind preflight は 1 回で `EPERM: listen EPERM: operation not permitted 127.0.0.1`、rc=2。無制限の再試行はしていない。 | disposable Node `net.Server.listen(0, "127.0.0.1")` |
| F-006 | fact | exact packaged `runtime/node` + `runtime/sidecar/launcher.cjs serve` を disposable env で 1 回実行すると rc=1、stderr の redacted 固定句は `listen EPERM: operation not permitted 127.0.0.1`。stdout は空、ready URL / dynamic port は生成されなかった。 | packaged sidecar direct serve |
| F-007 | fact | exact main executable は disposable `HOME`、`CORNELL_DESKTOP_HOME`、`TMPDIR` で 1 回直接起動し、rc=0、stdout / stderr は空だった。GUI window、sidecar ready、WebView の存在はこの方法では確認できなかった。追加の GUI 起動は user home を避けられないため実施していない。 | bounded direct launch、GUI 未到達 |
| F-008 | fact | static source では proxy / auth helper が `POST` / `PATCH` / `DELETE` の Origin / Referer を検証し、不一致時に固定 HTTP 403 message `同一オリジンのリクエストのみ許可されます` を返す。bridge は Tauri internals と相対 state-changing API 条件を満たす場合に invoke し、bridge が `null` の場合だけ transport が browser `fetch` に fallback する。 | `src/server/auth/basic-auth.js`、`src/proxy.ts`、`src/shared/desktop/desktop-api-bridge.ts`、notes / backup transport |
| F-009 | fact | static source では native runtime が validated `http://127.0.0.1:<port>/notes` から API URL、`Origin`、`Referer` を生成し、redirect を追従しない。remote capability は dynamic loopback と state-changing command allowlist を持つ。 | `src-tauri/src/runtime.rs`、`src-tauri/capabilities/default.json`、`src-tauri/permissions/app-commands.toml` |
| U-001 | unknown | A（bridge null → browser fetch → 403）か B（native invoke → proxy Origin / Referer 判定 → 403）かは未分類。HTTP 403 response、request header、WebView origin は取得できなかった。 | sidecar が ready 前に bind failure |
| U-002 | unknown | Tauri `invoke` の success、command unavailable、invoke rejection は未観測。HTTP 403 と invoke error は混同しない。 | external WebView / `window.__TAURI_INTERNALS__` 未到達 |
| U-003 | blocked | disposable note create / update と backup create は実行できなかった。したがって `POST /api/notes`、`PATCH /api/notes/:id`、`POST /api/backups` の Network entry、response、DB / backup read-back はない。 | sidecar bind failure |
| U-004 | unknown | window restoration warning の画面上の有無と因果は未観測。saved state / crash report は読んでいない。 | GUI window 未到達 |

## Runtime Evidence

### Artifact / host preflight

| 確認 | 結果 |
|---|---|
| exact app existence | PASS |
| main hash | PASS（指定値一致） |
| bundle ID | PASS（指定値一致） |
| arm64 | PASS |
| BUILD_ID | FAIL / identity conflict（実値が指定値と不一致） |
| prior ad-hoc codesign record | PASS（既存 build summary） |
| current codesign recheck | BLOCKED（`codesign` probe が return せず） |
| 127.0.0.1 bind | BLOCKED（EPERM、1 回） |

### Startup boundary

実行したコマンドは、すべて新規 disposable `HOME`、`CORNELL_DESKTOP_HOME`、`TMPDIR` と disposable DB / backup directory を環境変数へ設定したものだけである。

- main executable direct launch: rc=0、stdout / stderr empty。window / WebView / ready の実測なし。
- packaged sidecar `serve`: rc=1、`listen EPERM: operation not permitted 127.0.0.1`。ephemeral port、ready URL、health、runtime child、external WebView へ未到達。
- host preflight: `listen EPERM: operation not permitted 127.0.0.1`。この host policy のため、GUI / WebView 経由の操作へ進まなかった。

### Note / backup operation matrix

| 操作 | method / path | browser Network | Tauri invoke | native / browser response | Origin / Referer | DB / backup read-back |
|---|---|---|---|---|---|---|
| note create | `POST /api/notes` | 未実行 | 未観測 | 未観測 | 未観測 | 未実行 |
| note update | `PATCH /api/notes/:id` | 未実行 | 未観測 | 未観測 | 未観測 | 未実行 |
| backup create | `POST /api/backups` | 未実行 | 未観測 | 未観測 | 未観測 | 未実行 |

## Classification

| 分類 | 結果 |
|---|---|
| A: bridge null → browser fetch 403 | UNKNOWN / 未観測 |
| B: native invoke → proxy 403 | UNKNOWN / 未観測 |
| C: artifact / runtime URL / WebView origin / alias 不一致 | PARTIAL: BUILD_ID identity conflict を観測。alias 実行は除外。stale artifact / origin mismatch の因果は UNKNOWN |
| D: sidecar / WebView 起動失敗または request 前 host blocker | BLOCKED / host loopback `EPERM` と packaged sidecar `serve` failure を確認 |
| 別分類: command unavailable / invoke rejection | UNKNOWN / HTTP 403 と分離して未観測 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 / 作業後 `git status --short` | PASS | 既存の未コミット変更を保持。意図した追加は本 summary のみ |
| source / config / dependency / lockfile / DB / alias / existing artifact | PASS | 変更なし。root alias は実行・更新なし |
| exact artifact identity | PARTIAL | hash / bundle ID / arm64 は一致、BUILD_ID は不一致 |
| host bind preflight | BLOCKED | `EPERM`、single attempt |
| packaged sidecar | BLOCKED | rc=1、ready 前に停止 |
| GUI / external WebView | BLOCKED | user home を使う非隔離 GUI 起動は実施せず |
| same-origin HTTP 403 | UNKNOWN | response body / status 未観測 |
| note / backup disposable E2E | BLOCKED | request 前に停止、read-back なし |
| raw log / credential / user data | PASS | 既存 raw log は読まず、今回出力も固定句のみ抽出。credential / user data 非接触 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | A / B の実 runtime 経路、403 status / body、Origin / Referer | 127.0.0.1 bind と packaged GUI / external WebView を許可する別 macOS host |
| U-002 | Tauri internals、invoke command / rejection、browser Network / console、`location.origin` | U-001 成功後、同じ exact artifact と disposable env の WebView QA |
| U-003 | note create / update、backup create、DB / backup read-back | sidecar ready / health 後の各 mutation 1 回ずつの E2E |
| U-004 | BUILD_ID 不一致の原因 | build provenance と bundle metadata の再照合。stale artifact と断定するには別証拠が必要 |
| U-005 | window restoration warning | permissive host の visible window / restart 実測。saved state / crash report は別途明示許可が必要 |

## Next Read

- `summary/20260828/1200-investigate-desktop-same-origin-runtime-cause-20260828-summary.md`
- `HANDOFF_2026-08-28.md`
- `summary/20260828/fresh-packaged-runtime-qa-20260828-summary.md`
- `summary/20260828/0625-investigate-note-save-backup-shared-transport-20260828-a143f31b-summary.md`
