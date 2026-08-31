---
summary_type: task-summary
created_at: 2026-08-30 02:00 JST
task_kind: worker-task
task_status: done
---

## Objective

物理削除後に詳細画面の汎用削除エラーへ到達し得る実際の例外境界を、source、既存 contract test、指定 packaged artifact の静的証拠から特定する。

## Scope / provenance

調査対象は指定された detail delete、notes transport、desktop bridge、DELETE route、Tauri command/runtime、関連 test、先行 task summary、指定 `.app` である。コード、設定、依存関係、生成物、DB は変更していない。意図的に変更した repository file はこの summary のみである。

作業前後の `git status --short` を確認し、既存の未コミット変更（`modes.tsx`、`transport.ts`、`main.rs` を含む）は保持した。作業中の cargo の disposable build/log は repository 外で、source の変更ではない。

## Evidence read

- `HANDOFF_2026-08-28.md` と先行 0052 / 0125 summary の Next Read、および先行修正の検証結果を確認した。
- 先行修正は `modes.tsx:298-309` の API request 専用 catch と、`modes.tsx:312-317` の navigation 専用 try/catch の分離である。
- 指定 artifact の `Contents/Resources/runtime/.next/BUILD_ID` は `Fpw20Z2MbPr2etb11YycC`。client chunk に `await ...delete...`、汎用 error、`r.push("/notes"), r.refresh()` の分離、および `request_desktop_state_changing_api` marker があり、先行修正が packaged output に含まれることを確認した。
- packaged artifact は静的確認のみであり、ユーザー環境と同一の runtime 挙動や実際の削除成功を証明しない。

## Findings: fact / inference / unknown

### 確認済み fact

1. `deleteRemoteNote()` は `note-operations.ts:52-59` で DELETE `/api/notes/${id}` を `requestJson` に渡す。`requestJson` の呼び出しは `transport.ts:19` の native bridge await、`transport.ts:20` の browser fetch fallback、`transport.ts:22-27` の status/body error handling、`transport.ts:30` の parse 完了までを含む。
2. native bridge は Tauri runtime・POST/PATCH/DELETE・relative same-origin API path・string body の条件を満たす場合だけ `desktop-api-bridge.ts:49-57` の `invoke` を実行する。ここで `invoke` が reject、または response shape が不正で `response.body` / `response.status` に到達できなければ `requestDesktopStateChangingApi` 自体が reject し、HTTP status 判定前に `modes.tsx:301` の catch へ入る。bridge が `null` を返す通常条件では `transport.ts:20` が fetch fallback を使う。
3. native Rust は `main.rs:196-207` で state/runtime URL を取得して `runtime::request_desktop_state_changing_api` を呼ぶ。runtime は `runtime.rs:2691-2701` で URL/method/client を検証・構築し、`runtime.rs:2717-2724` で reqwest の send と response.text を実行する。URL/method/client build、send、body text の各 error は `Result::Err(String)` となり、Tauri invoke reject として renderer に伝播し得る。redirect は none、Origin/Referer は validated runtime URL から生成される。
4. HTTP response を受信できた場合、`response.ok === false` は `transport.ts:22` で API error path になる。`decodeApiErrorResponse` (`src/shared/http/fetch-json.ts:12-16`) の JSON parse 失敗は null に抑制され、body が契約形でなければ fallback message が `NotesRemoteError` に入る。したがって、403/404/500 等の非 2xx は、body decode が失敗しても non-NotesRemoteError ではなく `NotesRemoteError` として `modes.tsx:303-305` に入る。
5. 204 は `transport.ts:9-11` の `parseJson` が先に `null` を返すため body parse を行わない。DELETE route は `route.ts:68-79` で存在確認後に物理 delete、成功時 `new Response(null, { status: 204 })`、例外時は API error response。従って現行 source 契約では 204 parse failure を原因と断定できない。
6. repository delete は `notebook.command.repository.ts:95-106` で存在を確認し、`prisma.notebook.delete` 完了後に true を返す。物理削除完了後に route の 204 応答生成・bridge response text・renderer response reconstruction 等で失敗する余地はあるが、source static evidence はその実例を示していない。
7. 既存 detail delete / bridge / capability contract test は実行し、13/13 PASS。DELETE / 204 契約、navigation 分離、native bridge の static allowlist / URL 条件を確認した。Tauri Rust test は試行したが、この host では build script が `Not a directory (os error 20)` で失敗し、targeted Rust runtime test の PASS とは扱わない。

### 最も具体的な候補（推論）

| Candidate | 分類 | 根拠 | 未確定点 |
|---|---|---|---|
| native invoke rejection after sidecar has processed DELETE | inference | `main.rs:196-207` の invoke command は runtime `Err` を reject し、bridge await (`desktop-api-bridge.ts:49`) は fallback せず reject を伝播する。 | 実際に DELETE が sidecar で commit 済みの後に reject したか、rejection code/message は未観測。|
| reqwest send / response.text failure after server-side delete | inference | `runtime.rs:2717-2724` は send と body read を同じ Result chain にしている。server が処理後に transport read failure なら renderer は汎用 catch に到達し得る。 | reqwest の failure timing と DELETE commit の順序は未観測。|
| browser fetch fallback receives non-2xx (e.g. same-origin 403) | inference / lower confidence | bridge が対象外なら `transport.ts:20` で fetch。non-2xx は NotesRemoteError となり、generic 文言ではなく API body message を優先する。body が不正なら fallback 文言になる。 | 実際に fallback が選択されたか、status/body は未観測。|
| Response reconstruction / status-body shape failure | inference / lower confidence | bridge response は `new Response(response.body, { status: response.status })`。Tauri result shape/values の不整合は status 判定前 reject/throw の候補。 | exact malformed response は source/test/artifact から確認できない。|
| navigation (`router.push` / `router.refresh`) failure | ruled out by current source for this message | `modes.tsx:312-317` は DELETE catch の外側に navigation try/catch を置き、navigation failure では generic delete error を設定しない。packaged chunk も同じ構造。 | runtime が stale artifact/root alias を実行していないことは実機で identity確認が必要。|
| 204 `parseJson()` failure | ruled out by current source | `transport.ts:9-10` が status 204 を先に null 処理。 | 実際の response status が 204 だったかは runtime 未観測。|

「削除自体は成功している」が runtime で確認済みという前提なら、残る第一候補は native invoke の reject、reqwest response/body read の reject、または Tauri response の renderer 側復元境界である。ただし現時点では複数候補であり、原因確定ではない。

## Previous fix boundary vs uncovered boundary

- 前回カバー済み: DELETE await が成功した後の `router.push` / `router.refresh` 例外を削除失敗として扱わないこと。navigation catch は空処理で、削除成功後に generic error を設定しない。
- 未カバー: `requestDesktopStateChangingApi` の Tauri `invoke` reject、Rust state/runtime URL validation error、reqwest client/send/body text error、Tauri payload の status/body shape error、browser fallback の fetch reject、HTTP non-2xx response の body decode と fallback message の runtime 実測。特に delete API の server-side delete と response transport failure の順序は既存 test で再現されていない。

## Required minimal runtime observation

実ユーザー DB/本文/credential を読まず、disposable DB と test note を使う permissive macOS host で、同じ exact artifact identityを確認した上で一回の DELETE だけを観測する。保存するのは次の redacted metadata に限定する。

1. app BUILD_ID/hash、sidecar ready URL の host/port、WebView `location.origin`、`window.__TAURI_INTERNALS__` の有無。
2. bridge entry/exit: command name、path、method、invoke started/completed/rejected、reject の分類（code/type/message は秘密・本文を除外）。
3. native request: request started、validated origin/path、HTTP status、response body byte length、send error / body-read error の分類。Origin/Referer は値を保存せず、expected runtime-origin match の boolean のみ。
4. browser fallback: fetch が呼ばれたか、status、body byte length、JSON contract valid の boolean、console error type。ノート本文、API body message、credential は記録しない。
5. server-side: DELETE handler entered、delete result (`found`/`not-found`)、commit/operation completion marker、response status 204、DB existence boolean before/after。ID は hash 化する。
6. UI: generic error set の有無、`NotesRemoteError` の status/code class、navigation push/refresh start/throw。これで delete commit 後のどの境界で失敗したかを順序比較できる。

## Proposed follow-up implementation task (not performed)

原因を runtime で特定した後、修正 task は必要な最小ファイルだけを対象にする。候補は、(a) `src/shared/desktop/desktop-api-bridge.ts` と `src-tauri/src/main.rs` / `src-tauri/src/runtime.rs`（native result/transport の明示的な観測・エラー契約）、または (b) `src/modules/notes/remote/transport.ts` と対象 contract test（response reconstruction/transport boundary の修正）である。原因が navigation でない限り `modes.tsx` は変更対象に戻さない。

完了条件は、disposable runtime で server-side delete completion と renderer の最終分類を同一 request の時系列で確認し、DELETE/204、same-origin guard、Tauri capability、物理削除契約を維持したまま、対象境界の regression test と packaged exact-artifact static check が PASS すること。原因未確定のまま generic error を成功扱いにはしない。

## Verification

- `node --test test/notes/detail-delete-confirmation-contract.test.js test/desktop/desktop-api-bridge-contract.test.js test/desktop/desktop-tauri-capability.test.js`: 13/13 PASS。
- `cargo test request_desktop_state_changing_api --manifest-path src-tauri/Cargo.toml`: host build script failure (`Not a directory (os error 20)`); Rust test PASS ではない。
- Packaged artifact static: BUILD_ID `Fpw20Z2MbPr2etb11YycC`、client delete/navigation marker、native bridge command marker を確認。
- packaged GUI、loopback、実 HTTP DELETE、DB read-back、ユーザー環境 runtime は未実施。

## Next Read

修正 task の再開時は raw log ではなく、次の最小ファイルだけを読む。

- `summary/20260830/0200-investigate-detail-delete-generic-error-20260830-summary.md`
- `src/modules/notes/remote/transport.ts`
- `src/shared/desktop/desktop-api-bridge.ts`
- `src-tauri/src/main.rs`（`request_desktop_state_changing_api` command 部分）
- `src-tauri/src/runtime.rs`（`request_desktop_state_changing_api` 部分）
- `src/app/api/notes/[id]/route.ts`
- `test/notes/detail-delete-confirmation-contract.test.js`
- `test/desktop/desktop-api-bridge-contract.test.js`
