---
summary_type: task-summary
created_at: 2026-08-28 01:14 JST
task_kind: worker-task
task_status: done
---

# Backup same-origin forbidden 再発の切り分け

## Objective

fresh Tauri artifact に native bridge が含まれ、backup の state-changing request がその経路を先に試すことを source・bundle・disposable evidence の読み取りで確認した。ユーザー報告の same-origin forbidden を fresh Tauri、旧 artifact/browser、または別経路へ帰属できる実行時証拠があるかを切り分けた。

## Scope

- 対象 source: `src/modules/backup/remote/index.ts`、`src/shared/desktop/desktop-api-bridge.ts`、`src/proxy.ts`、`src/server/auth/basic-auth.js`、`src-tauri/src/main.rs`、`src-tauri/src/runtime.rs`
- fresh app: `/private/tmp/cornell-method-tauri-target-current-source-after-backup-origin-fix-20260828/release/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- fresh DMG: `/private/tmp/cornell-method-tauri-target-current-source-after-backup-origin-fix-20260828/release/aarch64-apple-darwin/release/bundle/dmg/Cornell Method Notebook_0.1.0_aarch64.dmg`
- disposable evidence: `/private/tmp/cornell-method-packaged-runtime-qa-20260828.BvG9lY`

アプリのインストール・置換、起動による新規 runtime 検証、server 起動、外部 network、実ユーザー home / SQLite / credentials の読み取りは行っていない。source/config/dependency/lockfile/generated artifact は変更していない。

## Inputs Read

- `HANDOFF_2026-08-22.md`
- same-origin investigation / native bridge / redirect hardening / fresh build / packaged QA / alias creation summaries under `summary/20260827` and `summary/20260828`
- 対象 source files と `test/desktop/desktop-api-bridge-contract.test.js`
- fresh app / DMG metadata、packaged `.next`、main executable strings、指定 disposable evidence の非 database log

## Changes Made

- source、設定、依存関係、lockfile、generated artifact、app、DMG、SQLite は変更していない。
- 本 summary のみを調査結果として追加した。実行時検証のための server 起動、app install/replace、外部接続は行っていない。

## Findings

### Fact: forbidden response の発生地点

- `src/proxy.ts:39-53` は、認証で `allow` になった state-changing API（POST/PATCH/DELETE）が `isSameOriginRequest` に失敗した場合、`403` と `FORBIDDEN_API_ERROR_BODY` を返す。したがって body `同一オリジンのリクエストのみ許可されます` は proxy の response であり、`/api/backups` route、provider、`createBackupEntry` より前に返る。
- `src/server/auth/basic-auth.js:22-25,175-247` の契約は exact な request origin と `Origin` の検証を要求する。`Origin` が存在する場合は malformed / empty / `null` でも Referer に fallback せず、Origin が欠落した場合だけ HTTP(S) Referer の parsed origin を比較する。
- `src/modules/backup/remote/index.ts:24-39,49-52` は `/api/backups` の POST について `requestDesktopStateChangingApi` を先に await し、戻り値が `null` の場合だけ browser `fetch` に fallback する。GET の一覧取得は native bridge の method 条件を満たさず browser fetch になる。

### Fact: fresh source の native bridge 契約

- `src/shared/desktop/desktop-api-bridge.ts:13-57` は `window.__TAURI_INTERNALS__` が存在する場合だけ、相対 path の `/api` 配下かつ POST/PATCH/DELETE の request を対象に Tauri `invoke` を呼ぶ。absolute URL、別 origin、API 外 path、非文字列 body は native bridge に渡さず `null` を返す。
- `src-tauri/src/main.rs:182-196,342-358` は `request_desktop_state_changing_api` command を定義し、`AppState` の sidecar runtime URL を取得して `runtime::request_desktop_state_changing_api` を呼び、Tauri invoke handler に登録している。
- `src-tauri/src/main.rs:447-469` は sidecar の validated runtime URL を `WebviewUrl::External` に渡す。
- `src-tauri/src/runtime.rs:2173-2197,2428-2503` は ready URL を `http://127.0.0.1:<dynamic-port>/notes` に限定し、API path と port を検証する。native request は runtime URL の origin を `Origin` に、runtime URL 自体を `Referer` に設定し、Accept / Content-Type 以外の renderer header を採用しない。`reqwest::redirect::Policy::none()` により redirect を自動追従しない。

### Fact: fresh artifact provenance

| 確認項目 | 結果 |
|---|---|
| architecture | `aarch64-apple-darwin` / Mach-O `arm64` |
| bundle ID / version | `com.cornellmethod.notebook` / `0.1.0` |
| packaged BUILD_ID | `JrSkDiiD_Hp4755lZJsra` |
| source `.next/BUILD_ID` | `JrSkDiiD_Hp4755lZJsra` |
| main executable SHA-256 | `7210a160a24b729ac6e2986bbd72793f841106154a3b131a1afad1a97a1518bb` |
| DMG SHA-256 | `9a2181e73cbd8b3db9265ca762c5a8e4462482cb8afa58b4ce29d7f0e0e3e058` |
| native command evidence | executable strings に `request_desktop_state_changing_api`、`Origin`、`Referer`、validated runtime/path error strings を確認 |
| packaged JS evidence | backup page chunk に `request_desktop_state_changing_api`、`window.__TAURI_INTERNALS__`、relative API 条件、native-first backup call を確認 |
| app alias | `Cornell-Method-Notebook.app` は fresh app 実体への symlink。alias 経由 executable の SHA-256 も同一 |
| DMG alias | `Cornell-Method-Notebook_0.1.0_aarch64.dmg` は fresh DMG 実体への symlink。alias と target の SHA-256 は同一 |

これは fresh artifact に修正が入っていることの証拠であり、artifact が実際に起動・使用されたことの証拠ではない。

### Fact: disposable runtime evidence の範囲

- `/private/tmp/cornell-method-packaged-runtime-qa-20260828.BvG9lY/qa.log` には専用 disposable path の storage、bootstrap `status=ready`、database validation `status=ready` がある。
- sidecar evidence は `listen EPERM: operation not permitted 127.0.0.1`。dynamic port、ready URL、health response は生成されていない。
- 前回 QA summary の app direct startup は rc=134 / SIGABRT。app stdout/stderr は空で、WebView window と sidecar ready へ進んでいない。
- DMG attach evidence は `装置が構成されていません`。`hdiutil verify` の image integrity PASS とは別に、mount / app read-back は未検証である。
- evidence 内に `/api/backups` の実 request、`Origin` / `Referer`、native invoke、403 response body、proxy から route/provider への到達記録はない。disposable DB の直接 read-back は GUI/API runtime の証拠ではない。

## Remaining Unknowns

- ユーザーが見た forbidden response の実 status/body が、今回の fresh app、旧 artifact、browser のどれに帰属するか。
- fresh Tauri WebView で `window.__TAURI_INTERNALS__` が実際に存在し native invoke が選択されたか。
- native request の実 destination、`Origin`、`Referer`、proxy の `request.nextUrl.origin`、`/api/backups` route/provider 到達有無。
- permissive macOS host で fresh app を起動・loopback bind・DMG attach できるか。

## Classification

**runtime evidence 不足（分類不能）**。

- **fresh Tauri app で再現**とは分類しない。fresh artifact の内容は一致するが、前回 QA では app が SIGABRT、sidecar が loopback bind EPERM であり、same-origin request が発生する地点まで到達していない。
- **旧 artifact/browser で発生**とも分類しない。今回確認した evidence に旧 artifact の実行証拠、browser の request、または forbidden body の実 response はない。
- source の静的契約上、同じ body が出る地点は proxy の same-origin check である。しかし、ユーザーが見た response が fresh app の native bridge 経由か browser fallback 経由か、`__TAURI_INTERNALS__` 判定が実 runtime で true だったか、native transport の request が proxy に届いたかは unknown である。

## Verification

- `node --test test/auth/basic-auth.test.js test/backup/backup-page-recovery.test.js test/backup/backup-service-database-url.test.js test/desktop/desktop-api-bridge-contract.test.js`: **24/24 PASS**
- `git diff --check`: **PASS**
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: **PASS**
- 作業前後の `git status --short` を確認した。作業前から存在した `HANDOFF_2026-08-22.md`、`src-tauri` / `src/modules` の未コミット変更、既存 summary、bridge contract test は保持され、今回の意図したリポジトリ変更は本 summary の追加だけである。
- build、DMG変更、install/replace、GUI/browser/runtime 再実行は制約により実施していない。

## Next task candidate

現時点で coding task は切り出さない。最小の次 task は、GUI起動・`127.0.0.1` bind・DMG attach が許可された macOS host で同じ fresh artifact と disposable home を再実行し、次を同一 request について記録すること。

1. WebView の `location.href` / `location.origin` と `__TAURI_INTERNALS__` の有無
2. `requestDesktopStateChangingApi` の invoke 実行有無と command response
3. native request の destination、`Origin`、`Referer`、status / body
4. proxy の `request.nextUrl.origin` と受信 header、route/provider 到達有無

fresh app で native bridge が使われず browser fallback になった証拠が得られた場合の最小候補は `src/shared/desktop/desktop-api-bridge.ts` と `src/modules/backup/remote/index.ts`。native request が exact header 付きで到達しても 403 になる場合は、まず runtime URL / proxy 到達時の実値を確認し、`src-tauri/src/runtime.rs` と `src-tauri/src/main.rs` を候補に別 task 化する。今回の task では実装・enqueue を行わない。

## Next Read

- `summary/20260828/0114-investigate-recurrent-backup-same-origin-20260828-summary.md`
- `summary/20260828/0041-qa-fresh-packaged-alpha-runtime-after-backup-origin-fix-20260828-summary.md`
- `summary/20260828/0034-build-fresh-packaged-current-source-after-backup-origin-fix-20260828-22f829b2-summary.md`
- `src/shared/desktop/desktop-api-bridge.ts`
- `src-tauri/src/runtime.rs`
