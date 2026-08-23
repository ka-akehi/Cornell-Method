---
summary_type: task-summary
created_at: 2026-08-23 01:42 JST
task_kind: worker-task
task_status: done
---

## Objective

Settings の Updates パネルから、既存の update check orchestrator を使って手動更新確認を実行するための Tauri command、frontend bridge、sanitized state snapshot、UI state、契約テストを、次の coding task が追加質問なしで実装できる粒度まで固定する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Desktop Alpha の Settings Updates manual check |
| 対象ファイル / ディレクトリ | `src/app/_components/settings/settings-modal.tsx`、`src/shared/desktop/desktop-settings-bridge.ts`、`src-tauri/src/main.rs`、`src-tauri/src/menu.rs`、`src-tauri/src/update_check.rs`、`src-tauri/src/update_state.rs`、指定された 3 件の desktop contract test、`package.json` と root lockfile |
| 成果物 | 本 summary のみ。実装コードへ適用する公開契約案 |
| 対象外 | manifest/provider/selection/state/startup 契約の変更、package download、SHA-256 / signature 検証、install、restart/apply、migration、rollback、release notes、履歴一覧、GitHub / network 接続 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-22.md` | Desktop Alpha の現状、既存 update task の順序、未実装境界、検証制約 |
| prior summary | `summary/20260822/1503-specify-desktop-update-contract-20260822-fafa5e92-summary.md`、`summary/20260822/2047-implement-desktop-update-check-state-20260822-5310b7eb-summary.md` | 更新契約、state schema、manual/daily/retry、sanitized persistence の前提 |
| prior summary | `summary/20260823/0048-implement-desktop-update-provider-20260823-ad5deb22-summary.md`、`summary/20260823/0106-implement-desktop-update-check-orchestrator-20260823-356b5085-summary.md` | 固定 GitHub manifest GET、fake transport、provider/selection/state mapping |
| prior summary | `summary/20260823/0121-implement-desktop-update-target-context-20260823-231e0f03-summary.md`、`summary/20260823/0133-implement-desktop-update-startup-check-20260823-dad75600-summary.md` | target context と startup `spawn_blocking` の wiring |
| Rust source | `src-tauri/src/main.rs`、`src-tauri/src/menu.rs` | managed `UpdateStateStore`、visible window 後の automatic check、Settings menu bridge、command 未登録の現状 |
| Rust source | `src-tauri/src/update_check.rs` | `run_update_check`、`CheckTrigger`、`CheckStart`、provider/selection/state の既存 mapping、fake transport tests |
| Rust source | `src-tauri/src/update_state.rs` | `UpdateState` serde schema、atomic write、24 時間抑制、Manual bypass、checking 排他、failure code sanitization |
| Rust source | `src-tauri/src/update_provider.rs`、`src-tauri/src/update_manifest.rs`、`src-tauri/src/update_selection.rs`、`src-tauri/src/update_target.rs` | 固定 provider、validation、compatible selection、target context の公開境界 |
| frontend source | `src/app/_components/settings/settings-modal.tsx`、`settings-entrypoint.tsx`、`src/shared/desktop/desktop-settings-bridge.ts` | Settings shell、既存 event bridge、Updates の準備中表示、WebView 側の bridge 利用状況 |
| tests | `test/desktop/desktop-settings-ui.test.js`、`test/desktop/desktop-update-startup-check.test.js`、`test/desktop/desktop-update-check.test.js`、関連 state/shell tests | 既存の静的 contract と、次 task で拡張する検証境界 |
| config | `package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` | root に `@tauri-apps/api` / `invoke` 利用がなく、`withGlobalTauri: false`、Tauri 2.5.1、blocking reqwest の構成であること |
| canonical docs | `doc/implementation/MVP_CONTRACT.md` §9.4、`doc/implementation/IMPLEMENTATION_STATUS.md` §5.4、`doc/testing/TEST_SCENARIOS.md` §Desktop Alpha | MVP と Desktop Alpha の境界、privacy、manual check、download/apply の分離 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| 実装コード・設定・依存関係・lockfile・テスト・仕様書 | なし | この task は仕様詰め・read-only 棚卸しであり、既存の未コミット変更を保持した |
| `summary/20260823/0142-specify-desktop-manual-update-check-contract.md` | 本完了要約を新規作成 | 採用案、却下案、API/DTO/error mapping、UI、security/privacy、fixture、検証結果、未決事項を後続 task へ引き継ぐため |

## Findings

### 1. 採用案の要約

次の一案を採用する。

- Tauri command 名は `manual_update_check` とする。
- command は JSON 引数を持たない。UI から URL、trigger、channel、architecture、`force`、token、version を受け取らない。
- command は managed `UpdateStateStore`、既存 `load_update_target_context()`、既存 `ReqwestManifestHttpTransport` を使い、`run_update_check(CheckTrigger::Manual, current_timestamp(), ...)` を一度だけ呼ぶ。
- blocking `reqwest` と target context の blocking 処理は command の async body / UI thread で実行せず、`tauri::async_runtime::spawn_blocking` の worker 内で行う。command は worker の完了を await して sanitized response を返すため、response 待ち中も WebView の event loop は応答可能である。
- frontend は既存の Settings bridge module に manual update bridge を追加し、`settings-modal.tsx` は bridge だけを呼ぶ。component から `invoke`、`fetch`、固定 URL、filesystem を直接扱わない。
- `menu.rs` は Settings menu が既存 primary WebView へ Settings event を dispatch する責務だけを維持する。menu から manual check を直接開始する item、別 event、別 window、別 runtime は追加しない。
- command の成功 response は terminal outcome と sanitized snapshot を返す。UI の request 中は local phase `checking` を表示し、既存 check と競合した response は `outcome: "already-checking"` と `state.status: "checking"` で返す。

### 2. Tauri command 契約

#### 2.1 登録と責務

`src-tauri/src/main.rs` に次の責務を持つ command を置く。

```text
#[tauri::command]
async fn manual_update_check(app: tauri::AppHandle)
  -> Result<ManualUpdateCheckResponse, ManualUpdateCheckCommandError>
```

Builder には次を一度だけ登録する。

```text
.invoke_handler(tauri::generate_handler![manual_update_check])
```

`State<'_, UpdateStateStore>` の借用を `spawn_blocking` へ持ち込まず、`AppHandle` を worker closure へ move し、closure 内で `app.state::<UpdateStateStore>()` を取得する。この形なら現行の non-`Clone` な store wiring を変えずに、managed store を startup worker と共有できる。

worker 内の順序は次のとおりとする。

1. `app.state::<UpdateStateStore>()` を取得する。
2. `load_update_target_context()` を呼ぶ。失敗は command error とし、raw error を返さない。
3. `ReqwestManifestHttpTransport::new()` を呼ぶ。失敗は command error とし、manifest GET は行わない。
4. `current_timestamp()` を取得する。
5. 既存 `run_update_check(CheckTrigger::Manual, now, &target_context, state.inner(), &transport)` を呼ぶ。
6. `run_update_check` の結果を response outcome へ変換し、成功した場合だけ `state.snapshot()` を UI DTO へ変換する。

既存の provider、manifest validation、selection、`PendingUpdate::new`、`VerificationState::NotVerified`、atomic state write を command 側へ複製しない。manual check は existing orchestrator への trigger 違いだけであり、startup automatic check と判定・保存経路を共有する。

#### 2.2 blocking と concurrency

- `reqwest::blocking` は `spawn_blocking` worker 内だけで使う。Tauri command future、WebView callback、UI event handler で blocking HTTP を実行しない。
- command は worker の terminal result を await してから response を返す。UI は await 中も render、keyboard、modal close 等を処理できる。
- `UpdateStateStore::begin_check` が state mutex の下で `Checking` への遷移と atomic write を行う。HTTP 自体は mutex を保持しない。
- manual と startup automatic が同時に呼ばれた場合、先に `begin_check` を通った一方だけが provider を呼ぶ。後続は `AlreadyChecking` を返し、provider を呼ばず、state を変更しない。
- manual が先に成功した場合、後続の startup automatic は `lastCheckAt` と 24 時間制限により `Suppressed` となる。startup が先に進行中なら manual は `AlreadyChecking` となる。どちらも別の更新判定を作らない。
- UI の二重クリックは button disabled と module-level in-flight Promise の coalescing で二重送信しない。bridge を経由しない直接 invoke や複数 caller に対しても、Rust state の `AlreadyChecking` が idempotency の最終防衛線になる。

#### 2.3 command 成功 response

wire shape は次のように固定する。optional 値は省略せず `null` とし、UI の型判定を安定させる。

```json
{
  "outcome": "available",
  "state": {
    "snapshotVersion": 1,
    "status": "available",
    "lastCheckAt": 1720000000,
    "checkStartedAt": null,
    "pendingUpdate": {
      "version": "1.2.3",
      "channel": "stable",
      "architecture": "aarch64-apple-darwin",
      "artifact": "cornell-method-notebook-1.2.3",
      "verificationState": "not-verified",
      "discoveredAt": 1720000000
    },
    "failure": null
  }
}
```

`outcome` の許可値と既存 orchestrator の mapping は次のとおり。

| `run_update_check` 結果 | command `outcome` | snapshot の意味 | provider / state |
|---|---|---|---|
| `Started(NoUpdate)` | `no-update` | `status: "no-update"`、`pendingUpdate: null` | manifest は正常取得・検証され、compatible candidate がない |
| `Started(Available)` | `available` | `status: "available"`、`pendingUpdate` あり | compatible manifest を発見し、NotVerified metadata だけ保存 |
| `Started(Failed { code })` | `failed` | `status: "failed"`、`failure.code` は固定 sanitized code | provider/manifest/selection failure。command error ではない |
| `Suppressed` | `suppressed` | state は変更前のまま | 現在の `Manual` では発生しないが、mapping は防御的に保持する |
| `AlreadyChecking` | `already-checking` | `status: "checking"`、`checkStartedAt` あり | 先行 check が provider を所有。後続は provider を呼ばない |
| `UpdateCheckError::StateStorage` | success response ではなく `state-error` | trusted terminal snapshot を返さない | state write/lock/serialization boundary の失敗 |

`checking` は terminal `outcome` として新規 check を fire-and-forget する意味には使わない。manual command は response を await するため、UI は invoke 前から local `phase: "checking"` とし、既存 check との競合時は response の `outcome: "already-checking"` と snapshot の `status: "checking"` を表示する。これにより `checking`、`already-checking`、terminal outcome を混同しない。

#### 2.4 command/state error

Tauri error payload は message、Debug 表現、source error、URL を持たない tagged object とする。

```json
{ "kind": "command-error", "code": "update-target-macos-command-failed" }
```

```json
{ "kind": "state-error", "code": "update-state" }
```

command error の固定 code は次を許可する。

- `update-target-app-version-invalid`
- `update-target-macos-command-failed`
- `update-target-macos-output-invalid`
- `provider-internal`（transport constructor の失敗）
- `update-command-worker-failed`（blocking worker join failure）

provider HTTP、encoding、JSON、manifest validation、selection failure は `run_update_check` が state に記録する `failed` outcome であり、command error へ格上げしない。現在の provider code (`provider-network`、`provider-timeout`、`provider-redirect`、`provider-http-status`、`provider-content-type`、`provider-empty-response`、`provider-response-too-large`、`provider-invalid-encoding`、`provider-invalid-json`、`provider-invalid-manifest`、`provider-internal`) と `update-selection` は固定 lowercase code としてのみ扱う。

state operation が `UpdateCheckError::StateStorage` を返した場合は `kind: "state-error"`, `code: "update-state"` とする。state error の response に不確かな snapshot を添えず、UI は直前の local snapshot を保持して generic error を表示する。bootstrap 時の既存 `load_issue()` logging と startup behavior は変更しない。

### 3. UI sanitized DTO と既存 state schema の比較

#### 3.1 比較

| 案 | 利点 | 問題 | 判定 |
|---|---|---|---|
| 既存 `UpdateState` を serde のまま返す | mapping が不要、既存 Rust tests と一致する | persistence schema が frontend public contract になり、`schemaVersion`、notification bookkeeping、将来の state field が UI に漏れる。state migration と UI deploy を強く結合する | 却下 |
| UI 専用 `UpdateStateSnapshot` を追加 | public allowlist を固定でき、persistence schema と DTO version を分離できる。notification と内部 bookkeeping を除外できる | Rust 側に変換・DTO test が必要 | 採用 |

#### 3.2 allowlist

`UpdateStateSnapshot` は `src-tauri/src/update_state.rs` に DTO / conversion として置くか、同じ module の private state boundary から `update_check.rs` が生成する。JSON は `camelCase`、enum value は既存 state と同じ `kebab-case` とする。

許可 field は次だけとする。

| field | 型 | UI の責務 |
|---|---|---|
| `snapshotVersion` | literal `1` | UI DTO version。persistence の `schemaVersion` とは別 namespace |
| `status` | `not-checked` / `checking` / `no-update` / `available` / `failed` | panel の大分類。`checking` は完了と表示しない |
| `lastCheckAt` | `number \\| null` | Unix seconds。terminal result 後の「確認日時」としてのみ表示する。現行 state は check 開始時刻を保持するため、完了時刻とは表示しない |
| `checkStartedAt` | `number \\| null` | `checking` の間だけ確認中の開始時刻として使う。terminal result で表示しない |
| `pendingUpdate.version` | string | available 時の候補 version 表示 |
| `pendingUpdate.channel` | string | current stable contract の内部値。通常 UI では表示しない |
| `pendingUpdate.architecture` | string | current target の内部値。通常 UI では表示しない |
| `pendingUpdate.artifact` | opaque string | state identity。URL として扱わず、通常 UI では表示しない |
| `pendingUpdate.verificationState` | `not-verified` / `verified` / `failed` | current manual check では必ず `not-verified`。署名検証済みとは表示しない |
| `pendingUpdate.discoveredAt` | number | candidate 発見日時。必要な場合だけ「検出日時」として表示 |
| `failure.code` | sanitized fixed code | UI は code を raw 表示せず、既知分類を generic copy へ map |
| `failure.retryAt` | number | retry policy の snapshot。通常 UI には表示せず、次回操作判断にも使わない |

次の field は DTO に含めない。

- persistence の `schemaVersion`
- `notification` (`version`, `artifact`, `notifiedAt`)
- manifest artifact `url`
- `sizeBytes`、`sha256`
- signature `keyId`、`proof`
- manifest / provider response body、response headers、redirect trace、token
- command output、raw error message、Rust Debug value
- package path、download state、install state、rollback marker、DB、backup、note data

既存 `UpdateState` 自体の serde schema、atomic file、`PendingUpdate` の current field は変更しない。DTO に field を足す場合はこの allowlist と test を先に更新し、manifest/state schema を混同しない。

### 4. Frontend bridge 契約

#### 4.1 依存と API placement

現状 root `package.json` と `package-lock.json` に `@tauri-apps/api`、`invoke` 利用はない。`src-tauri/tauri.conf.json` は `withGlobalTauri: false` なので、`window.__TAURI__` の global API を前提にしない。

次の coding task で `@tauri-apps/api` を root runtime dependency として追加し、Rust Tauri 2.5.1 と同じ `2.5.1` に pin して lockfile も更新する。bridge 内で `@tauri-apps/api/core` の `invoke` を使い、component へ package API を漏らさない。現在 task では dependency install / lockfile 更新を行っていない。

`src/shared/desktop/desktop-settings-bridge.ts` に既存 Settings event API と同居させるか、同 module から re-export する manual update bridge を追加する。新しい Tauri window / WebView / sidecar channel は作らない。

#### 4.2 bridge function と result union

推奨 API は次の shape とする。

```text
requestManualUpdateCheck(): Promise<DesktopManualUpdateCheckResult>
```

Tauri command 名は定数 `manual_update_check` とし、bridge は引数なしで invoke する。

bridge の result union は次の分類を保つ。

```text
success: { kind: "no-update" | "available" | "failed" | "suppressed" | "already-checking", response: ManualUpdateCheckResponse }
unsupported: { kind: "unsupported-web" }
command error: { kind: "command-error", code: fixed-code }
state error: { kind: "state-error", code: "update-state" }
```

`checking` は bridge promise の await 中に UI が持つ `UpdatePanelPhase` の値であり、response の snapshot にも `status: "checking"` が現れ得る。bridge が terminal result を返す前に fake `checking` response を作らない。

#### 4.3 Web / Desktop fallback

- `window` がなく、Tauri runtime capability がない場合、bridge は `unsupported-web` を返す。GitHub への GET、package API import、filesystem、raw exception の取得は行わない。
- capability がある desktop runtime では `@tauri-apps/api/core` を import して `invoke("manual_update_check")` する。
- import 失敗、command 未登録、invoke rejection のうち Rust の allowlisted tagged error と認識できないものは、`command-error` / `command-unavailable` に正規化する。raw rejection message は UI に渡さない。
- Rust が返した tagged `command-error` / `state-error` は allowlisted code だけを保持し、未知形状は `command-unavailable` に落とす。
- module-level `inFlight` Promise を保持し、同じ WebView からの二重 click / duplicate caller は同じ Promise を受け取る。settled 後に clear する。Rust 側の state guard は bridge 外 caller 用に残す。
- Web で `unsupported-web` になった後は button を session 中 disabled とし、「Desktop アプリでのみ利用できます」と表示する。初回 capability 判定を SSR に依存しないため、initial render から Tauri global の存在を断定しない。

### 5. Settings Updates UI 契約

#### 5.1 最小 local state

`SettingsModal` は次の local state だけを持つ。panel open 時に manual check を自動開始しない。

```text
phase: "idle" | "checking" | "resolved"
resultKind: "no-update" | "available" | "failed" | "suppressed" | "already-checking"
  | "unsupported-web" | "command-error" | "state-error" | null
snapshot: UpdateStateSnapshot | null
errorCode: allowlisted code | null
```

遷移は次のとおり。

| 状態 | 操作 | 表示 / 次状態 |
|---|---|---|
| initial `idle` | panel を開く | `更新を確認` button は enabled。自動 check は開始しない |
| `idle` / resolved | button click | `phase: checking`、button disabled、`aria-busy`、status `確認中…` |
| checking | second click | button disabled。bridge in-flight Promise を再利用し、provider を増やさない |
| response `no-update` | await 完了 | `利用可能な更新はありません`、snapshot を保持、button enabled |
| response `available` | await 完了 | version と「互換 manifest を発見」を表示。`not-verified` を明示し、button enabled |
| response `failed` | await 完了 | generic failure copy。raw code/message は表示せず、button enabled |
| response `suppressed` | await 完了 | 「今回は確認を実行しませんでした」。manual では current implementation 上発生しないが表示 mapping は保持 |
| response `already-checking` | await 完了 | `state.status: checking` を使い「別の更新確認が進行中」と表示。自分の Promise は終了するので button を永久 disabled にしない |
| bridge `unsupported-web` | await 完了 | Desktop-only copy。network / invoke retry をせず session 中 disabled |
| bridge `command-error` / `state-error` | await 完了 | generic command/state error。`errorCode` は retry/log classification 用で raw 表示しない |

button は `type="button"` と accessible label を持つ。status は `role="status"`、command/state error は必要に応じて `role="alert"` とする。既存 dialog focus trap、Escape、category navigation、Mac menu の Settings open bridge は壊さない。

#### 5.2 表示境界

- `no-update` は「manifest が正常だったが、この端末の stable / architecture / macOS compatibility に合う新しい候補がない」という意味に限定する。
- `available` は「互換 update manifest を発見し、candidate metadata を state に保存した」という意味だけである。package が download 済み、SHA-256 が検証済み、signature が検証済み、install 可能、再起動待ちとは表示しない。
- current manual check の `pendingUpdate.verificationState` は `not-verified` であり、「署名検証前」または同等の warning を表示する。`Verified` を先取りしない。
- `pendingUpdate.version` は表示してよい。URL、artifact URL の link、SHA-256、signature proof/key、size、release notes は表示しない。
- `failure.code` は固定分類に使うだけで、`provider-timeout` 等の code を end user copy として直接表示しない。UI は「更新情報を確認できませんでした。もう一度お試しください。」等の generic copy に map する。
- `lastCheckAt` / `discoveredAt` は Unix seconds を local date/time へ変換して表示してよい。ただし current state の `lastCheckAt` は `begin_check` 時刻であり、provider response の完了時刻ではない。`checkStartedAt` を terminal success の「最終確認時刻」として使わない。
- Updates panel は manual check、候補 version、確認結果を担当する。download progress、install、restart/apply、rollback、release notes、history、toggle、auto-update設定、Data and Backup、現行 `/backup` の変更は担当しない。

### 6. `src-tauri/src/menu.rs` の境界

- Mac の `Settings…` menu item は現行 `cornell:desktop-settings-request` event を既存 primary WebView へ dispatch するだけとする。
- menu event handler から `manual_update_check`、`run_update_check`、provider、state snapshot を呼ばない。
- menu item を `Check for Updates` として追加しない。manual check の唯一の UI entry point は Updates panel の button とする。
- `test/desktop/desktop-settings-ui.test.js` / shell test の existing Settings event、single primary window、no new runtime の assertions を維持する。

### 7. Security / privacy 境界

- manual check の外部接続は、既存 provider が固定している GitHub Releases manifest URL への GET だけである。UI から URL、query、redirect、header、token、user data を指定できない。
- network は manifest の取得までで止める。artifact URL を読むだけの既存 selection metadata は command response/state DTO へ流さず、package 本体を取得しない。
- package download、SHA-256、signature proof、install、restart/apply、migration、rollback は後続 task の別 command / pipeline であり、本 command に混ぜない。
- state snapshot、Tauri error、bridge result に URL、SHA-256、signature proof、response body、token、command output、note本文、Cue、Summary、SQLite、backup、診断 log、user path を含めない。
- `UpdateStateStore` の current atomic write、`deny_unknown_fields`、fixed error-code sanitization、24時間 automatic gate は変更しない。
- state `Available` を installability または package trust の表示へ昇格させない。これは security boundary と UI wording の両方で test する。

### 8. 採用しなかった案

| 却下案 | 却下理由 |
|---|---|
| component から GitHub `fetch` / artifact URL GET | provider/validation/selection の重複、固定 URL 境界の破壊、Web fallback と privacy の混乱 |
| `UpdateState` serde object をそのまま public response にする | persistence schema と UI contract の結合、notification/internal fields の漏出、将来 migration の影響範囲拡大 |
| raw manifest / provider response / URL / SHA-256 / signature proof を返す | state snapshot の privacy allowlist と command response 境界に違反 |
| `force`、URL、trigger を command 引数にする | manual 以外の trigger、provider 差し替え、arbitrary network access を UI から許すため |
| Tauri menu から check を開始する | Settings panel の責務を bypass し、既存 Settings bridge と別 entry point を増やすため |
| fire-and-forget command と未定義の completion event | UI が terminal outcome を確定できず、startup/manual の concurrent ownership と state refresh が曖昧になるため |
| Tauri updater plugin、download、signature/install/rollback を同時導入 | 本 task の manifest check 境界と Desktop Alpha の後続 pipeline を混ぜるため |
| UI thread で blocking reqwest を実行 | response 待ち中に WebView が固まり、既存 startup の non-blocking 契約を壊すため |

### 9. 次の coding task のテスト fixture / 観点

外部 GitHub へ接続せず、既存の fake transport と disposable state directory を使う。real `ReqwestManifestHttpTransport` は command wiring の compile/static check 以外で呼ばない。

#### `test/desktop/desktop-update-check.test.js`

- `main.rs` が `#[tauri::command]` の `manual_update_check`、`generate_handler![manual_update_check]`、`spawn_blocking`、`run_update_check(CheckTrigger::Manual, ...)` を持つこと。
- command が `AppHandle` から managed `UpdateStateStore` を取得し、`state` を新規作成していないこと。
- response DTO に `snapshotVersion`、`outcome`、allowlisted state fields があり、`url`、`sha256`、`signature`、`proof`、`response`、`body`、`token`、raw error interpolation がないこと。
- command production source が selection/provider/state mapping を複製せず、`run_update_check` を経由していること。
- `UpdateCheckResult` mapping が `NoUpdate` / `Available` / `Failed` / `Suppressed` / `AlreadyChecking` を潰さないこと。
- fake transport fixture（empty manifest、valid compatible manifest、timeout、invalid manifest）と temp `UpdateStateStore` で provider call count、state result、forbidden JSON field absence を確認すること。
- fresh state の manual check は `no-update`、valid candidate は `available + pendingUpdate.verificationState=not-verified`、provider/selection failure は `failed + fixed failure.code` になること。
- state path write failure は `state-error` となり、`begin_check` write failure 前に provider を呼ばないこと。
- `available` response / persisted state に artifact URL、SHA-256、signature proof、response body がないこと。

#### `test/desktop/desktop-update-startup-check.test.js`

- startup worker は引き続き visible window の `show()` / `set_focus()` 後に一度だけ起動し、`CheckTrigger::Automatic` のままであること。
- `invoke_handler` の追加が startup worker 内の manual/provider/package side effect を増やしていないこと。
- startup worker に `CheckTrigger::Manual`、download、signature、apply、rollback、raw output がないこと。
- fake state fixture で startup automatic が先に `Checking` を取得した場合、manual invocation は `already-checking` / `status: checking`、transport call count 追加なしになること。
- automatic が直前に成功して 24 時間以内の場合は `Suppressed`、同じ state への manual は provider を一度呼んで terminal outcome になること。

#### `test/desktop/desktop-settings-ui.test.js`

- Updates panel に `更新を確認` button、`role="status"`、local `checking`/disabled state、terminal result mapping があること。
- modal が `requestManualUpdateCheck()` だけを呼び、直接 `invoke`、`fetch`、GitHub URL、filesystem、new window/runtime を持たないこと。
- available copy に「manifest を発見」「署名検証前 / 未検証」「download/install 未実施」の境界があり、`installable`、`verified`、`restart` を先取りしないこと。
- second click が disabled になり、bridge in-flight Promise coalescing の契約があること。
- Web の `window` / Tauri capability 不在は `unsupported-web` になり、network や raw exception を発生させないこと。
- command missing / unknown invoke rejection は `command-error: command-unavailable`、Rust state error は `state-error: update-state` として generic UI になること。
- Settings menu event は既存 `cornell:desktop-settings-request` のままで、manual check command を直接 dispatch しないこと。

#### Rust focused tests

既存 `update_check.rs` / `update_state.rs` unit tests の fake transport/state fixture を維持し、必要な command mapping helper の pure test を追加する。real GitHub、real package、real signature key、Application Support の production path は使わない。`cargo fmt --check`、focused Rust test、指定 Node contract tests、`npm run lint`、`npm run build` は次 task の変更量に応じて実行し、build に必要な dependency/lockfile が未整備ならその理由を記録する。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 完了 | 既存の変更・未追跡 `src-tauri/`、Settings、update tests、過去 summary を確認。ユーザー変更は戻していない |
| handoff / prior summary 読了 | 完了 | `HANDOFF_2026-08-22.md` と update provider/orchestrator/target/startup/state 関連 summary を確認 |
| 対象 source / tests / package read-only 棚卸し | 完了 | `sed`、`rg`、`package.json`、Cargo/Tauri config を使用。外部接続なし |
| focused existing Node contract tests | PASS | `node --test test/desktop/desktop-settings-ui.test.js test/desktop/desktop-update-startup-check.test.js test/desktop/desktop-update-check.test.js`、8 tests pass |
| Rust/build/lint | 未実行 | 仕様 task で実装変更がなく、Rust/build は生成物を更新し得るため。既存 prior summary の証跡は参照したが本 task の再実行結果とは扱わない |
| GitHub / network / external service | 未実行 | 制約どおり。fake transport/state fixture の設計だけを行った |
| code/config/dependency/test/spec changes | なし | 本 summary 以外の成果物は変更していない |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | `@tauri-apps/api` 2.5.1 の実 lock 解決と Tauri 2.5.1 command serialization は未確認 | 次 task で dependency/lockfile を追加し、TypeScript build と Tauri compile を実行する |
| U-002 | `spawn_blocking` の実 Tauri runtime、Mac `sw_vers`、packaged WebView の response 待ち UI は未確認 | disposable fake test 後、Apple Silicon packaged GUI で検証する。GitHub は fake transport で代替する |
| U-003 | startup が完了した結果を Settings panel へ push event なしで即時表示する runtime は未確認 | 本契約では panel open 時の自動 check/event は追加せず、manual response と persisted state boundary に限定する。startup result notification は別 task の scope にしない |
| U-004 | command setup error の固定 code constant の配置は未実装 | `main.rs` / `update_check.rs` の command error type に定数を置き、raw error が漏れない pure test を追加する |

## Next Read

次の coding task は、まずこの summary と次の最小ファイルだけを読む。

- `summary/20260823/0142-specify-desktop-manual-update-check-contract.md`
- `src-tauri/src/main.rs`
- `src-tauri/src/update_check.rs`
- `src-tauri/src/update_state.rs`
- `src/shared/desktop/desktop-settings-bridge.ts`
- `src/app/_components/settings/settings-modal.tsx`
- `test/desktop/desktop-update-check.test.js`
- `test/desktop/desktop-update-startup-check.test.js`
- `test/desktop/desktop-settings-ui.test.js`
- `package.json`

