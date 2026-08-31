# Tauri external loopback IPC investigation

## Objective

Tauri の `WebviewUrl::External` で sidecar の loopback URL を表示する現行構成について、`window.__TAURI_INTERNALS__`、npm の `invoke`、capability、5 系統の mutation bridge の関係を静的証跡から切り分けた。browser fallback による proxy 403 と、native request 自体が proxy 403 になる経路を分離し、実装を行わずに後続の検証・変更条件を整理した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Tauri 2.5.1 / external loopback WebView / native IPC / state-changing HTTP transport |
| 対象ファイル / ディレクトリ | `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/src/main.rs`, `src-tauri/src/lifecycle.rs`, `src-tauri/src/runtime.rs`, `src-tauri/sidecar/launcher.cjs`, desktop bridge、remote transport、proxy、package/lock、packaged artifact、既存 summary / handoff |
| 対象外 | source/config/dependency/generated artifact/app/DMG/SQLite/user data の変更、GUI 起動、sidecar 起動、network 接続、coding task の enqueue |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| Tauri 設定 | `src-tauri/tauri.conf.json:7-12`, `src-tauri/capabilities/default.json:3-6`, `src-tauri/gen/schemas/capabilities.json` | `frontendDist`, `withGlobalTauri:false`、`primary` と `core:default`、生成後の `local:true`、remote 未設定 |
| Tauri app | `src-tauri/src/main.rs:338-358,437-485`, `src-tauri/src/lifecycle.rs:1280-1327`, `src-tauri/src/runtime.rs:2173-2197,2428-2503` | invoke handler、external URL、navigation、runtime URL 検証、native request の URL / header / redirect 方針 |
| Web client | `src/shared/desktop/desktop-api-bridge.ts`, `src/modules/notes/remote/*`, `src/modules/backup/remote/index.ts` | 5 mutation の native-first と `null` 時だけの browser fallback |
| Settings / HTTP guard | `src/shared/desktop/desktop-settings-bridge.ts`, `src/proxy.ts`, `src/server/auth/basic-auth.js` | 共通 runtime 判定、Settings の fallback、same-origin 403 の生成箇所 |
| Dependency | `node_modules/@tauri-apps/api/core.js`, `node_modules/@tauri-apps/api/package.json`, `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` | npm API `2.5.0`、Rust Tauri `2.5.1`、`invoke` の実装と lock の一致 |
| Tauri local source | Tauri `2.5.1` / `tauri-utils 2.4.0` / `tauri-build 2.2.0` の local source | WebView initialization script、local/remote 判定、ACL の context、`with_global_tauri` の定義、app manifest の扱い |
| Evidence | current packaged app、`.next`、native binary strings、`HANDOFF_2026-08-22.md`、直近の QA / build / audit summary | current bridge/native code が artifact に含まれること、実 runtime 証跡の有無、既存 QA のブロック理由 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260828/0230-investigate-tauri-external-loopback-ipc-20260828-summary.md` | この調査の要約を追加 | 再開時の最小入力と結論を残すため |

上記以外の repository source、設定、依存関係、生成 artifact、packaged app、DMG、SQLite、user data は変更していない。作業前に確認した既存の tracked / untracked 変更も保持した。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-01 | fact | `withGlobalTauri:false` は public な `window.__TAURI__` global API を注入しない設定であり、import した `@tauri-apps/api/core` を無効にする設定ではない。`core.js` の `invoke` は `window.__TAURI_INTERNALS__.invoke(...)` を直接呼ぶ。 | `node_modules/@tauri-apps/api/core.js:10,70,187-188`、Tauri config source の `with_global_tauri` 説明 |
| F-02 | fact | Tauri 2.5.1 の `prepare_pending_webview` は URL 種別を判定する前に、各 WebView の initialization script へ `isTauri` と `window.__TAURI_INTERNALS__` の初期化、および invoke initialization script を追加する。したがって external URL でも marker が存在することは Tauri source 上の期待動作である。 | local Tauri source `tauri-2.5.1/src/manager/webview.rs:114-169` |
| F-03 | fact | Tauri 2.5.1 の local URL 判定は macOS では主に `tauri://localhost`、設定された base URL、登録済み custom protocol である。通常 build の `frontendDist:"ui"` は custom protocol 側で、`WebviewUrl::External(http://127.0.0.1:<dynamic-port>/notes)` はその条件に一致せず `Origin::Remote` として ACL 解決される。 | local Tauri source `src/webview/mod.rs:1431-1471,1477-1529`、`src/manager/mod.rs:344-377` |
| F-04 | fact | 現在の capability は `local:true`（省略時 default）と `core:default` だけで `remote.urls` がない。Tauri ACL は `Local` と `Remote` を別 context として扱い、remote は capability の URL pattern に一致した場合だけその permission context を得る。 | `src-tauri/capabilities/default.json:3-6`、生成 schema、local Tauri source `tauri-utils-2.4.0/src/acl/resolved.rs:209-239`、`tauri-2.5.1/src/ipc/authority.rs:60-68` |
| F-05 | fact / caution | `request_desktop_state_changing_api` は `generate_handler!` に登録された app custom command である。`src-tauri/build.rs` は `tauri_build::build()` のみで、`src-tauri/permissions` も存在しない。Tauri 2.5.1 の IPC gate は plugin command または app ACL manifest がある場合に ACL 不許可を reject する実装なので、`remote.urls` がないことだけから、この custom command が必ず ACL reject されるとは断定できない。 | `src-tauri/build.rs:1-3`、`src-tauri/src/main.rs:338-358`、local Tauri source `tauri-2.5.1/src/webview/mod.rs:1527-1562`、`tauri-build-2.2.0/src/acl.rs:403-440` |
| F-06 | fact | bridge は marker が false、method が POST/PATCH/DELETE 以外、relative API path でない等の場合だけ `null` を返す。marker があり `invoke` が reject した場合は catch していないため、browser fetch へ fallback しない。 | `src/shared/desktop/desktop-api-bridge.ts:13-57` |
| F-07 | fact | ノート作成、更新、削除、復習完了、backup 作成の 5 mutation は共通 bridge を先に呼び、戻り値が `null` のときだけ browser `fetch` を呼ぶ。proxy の state-changing API guard は same-origin 不一致時に共通 body `同一オリジンのリクエストのみ許可されます` を返し、route/provider より前で終了できる。 | `src/modules/notes/remote/note-operations.ts`, `review-operations.ts`, `src/modules/backup/remote/index.ts`, `src/modules/notes/remote/transport.ts:19-20`, `src/proxy.ts:39-53`, `src/server/auth/basic-auth.js:22-29,217-260` |
| F-08 | fact | native request は validated runtime URL を使い、HTTP / host `127.0.0.1` / port / `/notes` base と API path を再検証する。`Origin` は runtime origin、`Referer` は runtime URL、redirect は無効で、launcher も `127.0.0.1` を bind / advertise する。source 上に `localhost` と `127.0.0.1` の取り違えはない。 | `src-tauri/src/runtime.rs:2428-2503`、`src-tauri/sidecar/launcher.cjs:15,1162-1180,1372-1402,1439-1463` |
| F-09 | fact | Settings bridge も同じ `window.__TAURI_INTERNALS__` 判定を使う。marker がなければ data backup、diagnostics、recovery 等の direct command は unsupported-web になり、manual update / state snapshot / verify は canonical loopback の hash-navigation fallback を使う。 | `src/shared/desktop/desktop-settings-bridge.ts:2055-2066,2269-2554`、`src-tauri/src/lifecycle.rs:1280-1327` |
| F-10 | fact | current packaged artifact には bridge の native-first JS、native command 名、`Origin` / `Referer`、runtime validation、Tauri IPC strings が含まれる。これは build 内容の証拠であり、実 WebView で marker が存在したことや command が実行されたことの証明ではない。 | current packaged `.next`、native binary `strings`、既存 build summary |
| H-01 | hypothesis | marker が実際の WebView で欠落していれば、5 mutation は同じ bridge 判定で `null` → browser fetch へ進み、WebView の `Origin` / `Referer` が欠落・不一致なら proxy の共通 403 になる。この因果は成立する。 | F-06 / F-07 |
| H-02 | hypothesis | ただし Tauri 2.5.1 source が external を含む WebView に marker / invoke initialization を無条件で挿入するため、「`withGlobalTauri:false` が原因で全 mutation が browser fallback」という説明は静的証拠と弱く整合する。現時点では runtime の marker を観測するまで主因とは扱わない。 | F-01 / F-02 |
| H-03 | hypothesis | marker があり native invoke が実行される場合、ACL reject なら bridge は browser fallback せず command error になる。native command まで到達して 403 になる別経路は、sidecar / Next が実際に見た Host、`Origin`、`Referer`、`request.nextUrl.origin` の runtime 不一致である。source は canonical 値を設定しているため、現時点で静的な origin mismatch は見つからない。 | F-04-F-08 |
| U-01 | unknown | fresh app の実 WebView に `window.__TAURI_INTERNALS__`、`isTauri`、`window.__TAURI__` が実際に存在するか、imported `invoke` が command を送るかは未観測。 | 現行 QA は GUI 起動前に停止 |
| U-02 | unknown | external loopback URL が current artifact の macOS WebView で initialization script を実行し、Tauri ACL がその command をどう扱うかは未観測。local source から期待動作は絞れるが、実機結果は未取得。 | F-02-F-05 |
| U-03 | unknown | native / browser の実 request について、sidecar が受けた Host、`Origin`、`Referer`、Next の `request.nextUrl.origin`、route/provider 到達有無は未観測。 | 直近 QA で request まで到達していない |
| U-04 | unknown | ユーザーが見た全 403 が current fresh artifact の結果か、旧 artifact / browser fallback の結果かは未確定。 | current packaged artifact の static inspection のみ完了 |

### 経路の切り分け

```text
marker absent at runtime
  -> bridge returns null
  -> browser fetch
  -> proxy same-origin check fails
  -> common 403

marker present
  -> imported invoke
  -> ACL rejection: invoke error; no browser fallback
  -> native command: validated URL + canonical Origin/Referer
       -> proxy 2xx/route response, or 403 only if runtime origin evidence mismatches
```

従って「5 系統で同じ 403」は browser fallback 経路なら説明できるが、native invoke が reject しただけではこの proxy body にはならない。native request が同じ body を返す場合は、proxy 到達後の origin 判定を実測する必要がある。

## Follow-up candidate (not implemented)

まず production code を変えず、permissive host の disposable fresh artifact で次の 1 回の観測を行うのが最小である。`location.origin`、marker の有無、`invoke` command と結果、native target / Host / Origin / Referer、proxy の `request.nextUrl.origin`、route/provider hit、status/body を同じ correlation id で記録する。現在の QA 環境は app が `SIGABRT`、sidecar bind が `listen EPERM` で request 前に停止するため、この確認は未実施である。

観測後に実装が必要と判定された場合の最小候補は次の通り。

- capability が原因と実証された場合だけ、`src-tauri/capabilities/default.json` に primary window と `http://127.0.0.1` の dynamic port / 必要 path に限定した remote context と、必要な command permission を追加する。Tauri 2.5.1 の URLPattern における port wildcard の正確な構文を先に検証し、`*://*/*` のような広い許可は使わない。
- custom app command の ACL を明示管理する設計へ進める場合は、`src-tauri/build.rs` と `src-tauri/permissions/*` を一組で変更し、app command の allow permission と remote URL context を明示する。現状は app manifest がないため、いきなり capability だけを足して動作を推測しない。
- native request が実際に 403 を返すと判明した場合だけ、`src-tauri/src/runtime.rs` と必要な server/proxy の観測点を対象に、実測 Host / Origin / Referer に基づいて修正する。bridge の invoke reject を browser fetch に黙って fallback させる変更は、原因を隠して同じ 403 を再発させるため候補にしない。
- `withGlobalTauri` を true に変更する案は採用しない。public global API を増やすだけで、external URL の local/remote context や command authorization の問題を解決しない。

### Acceptance conditions for a later coding task

1. permissive macOS host で fresh artifact を起動し、external loopback page の marker / `isTauri` / `window.__TAURI__` を確認できる。
2. 5 mutation それぞれで native invoke が 1 回送られ、marker 判定による browser fallback が発生しない。
3. invoke の ACL 結果、native target、Host、`Origin`、`Referer`、proxy の `request.nextUrl.origin`、route/provider hit を観測できる。
4. Settings の direct command と update hash fallback がそれぞれ既存契約を満たし、任意の外部 origin は capability を利用できない。
5. hosted/browser mode の same-origin fail-closed 契約と local-first の security boundary を維持する。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `node --test test/desktop/desktop-api-bridge-contract.test.js` | PASS | 3 tests passed |
| `node --test test/desktop/desktop-settings-bridge.test.js` | PASS | 20 tests passed |
| Tauri config / capability JSON parse | PASS | `tauri.conf.json`, `default.json`, generated `capabilities.json` |
| `git diff --check` | PASS | whitespace error なし |
| packaged artifact static inspection | PASS (static only) | current JS/native strings と build identity を確認。実 WebView / IPC request は未証明 |
| GUI / fresh app / sidecar request | BLOCKED | app direct startup `SIGABRT`、sidecar bind `listen EPERM`。制約により GUI 起動・server 起動は行っていない |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| R-01 | 実 WebView の marker と imported invoke の実行有無 | permissive host の DevTools / disposable instrumentation |
| R-02 | current artifact における remote ACL の実効結果 | invoke rejection message または native command hit |
| R-03 | native / browser request の実 header と proxy origin | sidecar / Next の request capture |
| R-04 | current artifact とユーザー報告 artifact の同一性 | BUILD_ID / packaged binary hash と実行対象の照合 |

## Next Read

次回は以下の最小ファイルから再開する。

- `summary/20260828/0230-investigate-tauri-external-loopback-ipc-20260828-summary.md`
- `src-tauri/capabilities/default.json`
- `src-tauri/src/runtime.rs`
- `src/shared/desktop/desktop-api-bridge.ts`
- `src/shared/desktop/desktop-settings-bridge.ts`
- `summary/20260828/0041-qa-fresh-packaged-alpha-runtime-after-backup-origin-fix-20260828-summary.md`

