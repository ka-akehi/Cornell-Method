# State-changing request same-origin 調査 summary

## Objective

バックアップだけでなく、現行 MVP の state-changing API 全体で「同一オリジンのリクエストのみ許可されます」が発生し得る範囲を、実装変更なしで棚卸しした。
共通の Web same-origin 検査、Tauri native bridge、fresh packaged artifact、実行経路、個別 request の差を分離して記録する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | POST、PATCH、DELETE の API 呼び出し、proxy、Basic Auth、Tauri bridge、sidecar runtime、fresh packaged artifact、既存 QA summary |
| 対象ファイル / ディレクトリ | `src/proxy.ts`、`src/server/auth/basic-auth.js`、`src/shared/desktop/desktop-api-bridge.ts`、`src/modules/**/remote/**`、state-changing request を呼ぶ UI、`src/app/api/**/route.ts`、`src-tauri/src/main.rs`、`src-tauri/src/lifecycle.rs`、`src-tauri/src/runtime.rs`、`src-tauri/sidecar/launcher.cjs` |
| 対象外 | コード、設定、依存関係、lockfile、generated artifact、app、DMG、SQLite、ユーザーデータの変更。GUI 起動、app の置換・インストール、loopback server の起動、外部 network 接続 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 契約 | `doc/implementation/MVP_CONTRACT.md`、`doc/requirements/MVP_SYSTEM_SPEC.md`、`doc/api/MVP_API_DESIGN.md` | 現行 MVP の API、明示保存、物理削除、復習、backup、tag の範囲 |
| 設計・検証 | `doc/technical/TARGET_ARCHITECTURE.md`、`doc/testing/TEST_SCENARIOS.md`、`doc/implementation/IMPLEMENTATION_STATUS.md` | Web / Desktop Alpha の責務境界と検証状況 |
| 引き継ぎ | `HANDOFF_2026-08-22.md` | fresh build、packaged QA、alias、runtime 未到達の既知状態 |
| 既存 summary | `summary/20260827/backup-same-origin-investigation-20260827-summary.md`、`summary/20260828/0000-*`、`0008-*`、`0034-*`、`0041-*`、`0045-*`、`0107-*`、`0114-*`、`0117-*` | 直近の backup origin 修正、redirect hardening、fresh build、packaged QA、alias、再調査の証拠 |
| Web boundary | `src/proxy.ts`、`src/server/auth/basic-auth.js` | 403 を返す条件、Origin / Referer の優先順位、認証との順序 |
| API client / UI | `src/modules/notes/remote/*`、`src/modules/backup/remote/index.ts`、`src/modules/notes/ui/**`、`src/modules/backup/ui/**` | endpoint、呼び出し元、shared transport、直接 fetch の有無 |
| API route | `src/app/api/notes/**`、`src/app/api/backups/route.ts`、`src/app/api/tags/route.ts` | state-changing handler の一覧と成功 status |
| Desktop runtime | `src/shared/desktop/desktop-api-bridge.ts`、`src-tauri/src/main.rs`、`src-tauri/src/lifecycle.rs`、`src-tauri/src/runtime.rs`、`src-tauri/sidecar/launcher.cjs` | bridge の選択条件、native command 登録、validated runtime URL、Origin / Referer 注入 |
| fresh artifact | `/private/tmp/cornell-method-tauri-quarantine-20260828.MrrSjp/fallback-content/Cornell Method Notebook.app` と直近 build summary | packaged JS、Rust binary、BUILD_ID、route の静的内容。実行はしていない |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260828/0135-audit-all-state-changing-same-origin-requests-20260828-summary.md` | 調査結果を追加 | Worker task の成果物 |
| 既存の dirty files | 変更なし | 作業前の未コミット変更を保持 |

## Findings

### Endpoint と呼び出し元の棚卸し

現行ソースで確認できる HTTP state-changing endpoint は 5 系統である。
いずれも UI から remote module を通り、state-changing request では shared native bridge を先に試す。

| Endpoint | route handler | UI 呼び出し元 | remote function / transport | Web | Tauri | bridge 適用 |
|---|---|---|---|---|---|---|
| POST `/api/notes` | `src/app/api/notes/route.ts:38` | `src/modules/notes/ui/components/editor/editor.tsx:248-249` | `createNote` → `requestJson` | relative `fetch` | native invoke を先行 | 適用される |
| PATCH `/api/notes/:id` | `src/app/api/notes/[id]/route.ts:37` | editor の edit save `editor.tsx:250-253`、Summary 保存 `use-note-detail-summary-draft.ts:108-114` | `updateNote` → `requestJson` | relative `fetch` | native invoke を先行 | 適用される |
| DELETE `/api/notes/:id` | `src/app/api/notes/[id]/route.ts:68` | `src/modules/notes/ui/components/detail/modes.tsx:268-284` | `deleteNote` → `requestJson` | relative `fetch` | native invoke を先行 | 適用される。ただし 204 応答に個別不具合がある |
| POST `/api/notes/:id/review` | `src/app/api/notes/[id]/review/route.ts:17` | `modes.tsx:161-163`、dirty な review date の close/save 経路 `modes.tsx:213-216` | `completeReview` → `requestJson` | relative `fetch` | native invoke を先行 | 適用される |
| POST `/api/backups` | `src/app/api/backups/route.ts:42` | `src/modules/backup/ui/components/backup-page.tsx:250-260` | `createBackup` → `requestBackupJson` | relative `fetch` | native invoke を先行 | 適用される |

補足:

- GET の `/api/notes`、`/api/notes/:id`、`/api/tags`、`/api/backups` は bridge の対象外で、browser fetch を使う。
- `/notes/[id]` の初期表示は server 側の application / DB 呼び出しであり、state-changing HTTP request ではない。
- `/api/tags` に POST、PATCH、DELETE はなく、PUT も現行 API client / route にはない。
- Settings の Data / Backup 操作は Tauri の別 native command を直接 invoke する。`/api/*` の HTTP request ではないため、この proxy の same-origin 403 の対象外である。

### Transport の共通経路

`src/modules/notes/remote/transport.ts:14-30` と `src/modules/backup/remote/index.ts:24-39` は、state-changing request の前に `requestDesktopStateChangingApi` を呼ぶ。
bridge が `null` を返した場合だけ browser `fetch` に進む。
native invoke 自体が reject した場合は browser fetch に戻らないため、同じ mutation を二重送信しない設計になっている。

現行の 5 endpoint の mutation はすべて、文字列の相対 path、`/api` 配下、POST / PATCH / DELETE、JSON body または body なしという bridge の条件を満たす。
現行ソースに、state-changing request だけが別の直接 `fetch`、axios、XHR、form method を使う経路は見つからなかった。

### Proxy の 403 発生地点

`src/proxy.ts:27-56` は全 path に適用され、Basic Auth の decision が `allow` のとき、`isStateChangingApiRequest` が真の request に対して `isSameOriginRequest` を実行する。
認証不成立の API は先に 401 になり、same-origin 検査へ進まない。

`src/server/auth/basic-auth.js:27` および `:175-183` の条件は、`/api` または `/api/` 配下の POST、PATCH、DELETE である。
検査は route handler より前に実行されるため、条件不一致時の 403 body はどの mutation endpoint でも同じ `FORBIDDEN_API_ERROR_BODY` になる。

`isSameOriginRequest` の挙動は次のとおりである。

- Origin header が存在する場合、空文字、`null`、不正な URL、path/query/fragment 付き URL、認証情報付き URL、非 HTTP(S)、default port の表記差を含めて reject し、Referer へ fallback しない。
- Origin header が存在しない場合だけ、HTTP(S) Referer の origin を比較する。
- 比較対象は `request.nextUrl.origin` と完全一致する scheme、host、port である。
- Origin と Referer がともに欠ける場合も fail closed になる。

したがって、Web で同一の 403 body が複数 endpoint に出る条件は、各 request が route handler に届く前に同じ proxy 条件で失敗することである。
原因候補は、document origin と request の host / port / scheme の不一致、Origin の欠落または不正、古い build の使用、Tauri bridge が選択されず browser fetch に fallback したことになる。

### Web と Tauri の期待動作

| 実行形態 | 期待される送信 | same-origin 判定 |
|---|---|---|
| Web | UI の相対 `/api/...` fetch が document と同じ origin へ送られ、browser の Origin または同一 origin の Referer が付く | `request.nextUrl.origin` と一致すれば route handler へ進む |
| Tauri | `desktop-api-bridge.ts:24-57` が native invoke を先行し、Rust が validated sidecar origin を使う | `runtime.rs:2428-2503` が `http://127.0.0.1:<dynamic-port>` を Origin に、`/notes` を含む runtime URL を Referer に設定するため、一致すれば route handler へ進む |

Tauri 側では、sidecar launcher が `127.0.0.1` と動的 port の `/notes` URL を ready message として渡し、Rust が host、port、path、scheme を再検証する。
bridge が選択されない条件は、Tauri runtime marker 不在、相対 path でない input、window origin との不一致、`/api` 外の path、文字列以外の body などである。
この場合は browser fetch に戻るため、WebView の origin と sidecar の origin が一致しなければ 403 になり得る。

### Native bridge の適用漏れ

現行ソースの静的確認では、backup だけに bridge がある状態は解消されている。
notes の create、update、delete、review は `requestJson` を共有し、backup create は同じ bridge を直接呼ぶ。
main command registration、runtime URL の取得、Origin / Referer の注入も揃っている。

このため、「現行ソースで backup 以外の state-changing request だけ bridge 適用漏れがある」は fact として確認できない。
ただし、実行中の packaged artifact が別 build であれば、ソース上の適用状況は実行中の挙動を証明しない。

### fresh artifact と runtime evidence の分離

| 確認対象 | 確認済み範囲 | 未確認範囲 |
|---|---|---|
| fresh build の同一性 | 直近 build summary で source と package の BUILD_ID が `JrSkDiiD_Hp4755lZJsra`。extracted fallback artifact も同じ BUILD_ID | ユーザーが実際に起動した app がこの build だったか |
| packaged JS | extracted artifact の common chunk `264-29ceedba3924e4b4.js` と backup page chunk に `request_desktop_state_changing_api`、相対 API 判定、POST / PATCH / DELETE 判定がある | 各操作時にこの chunk が実行されたこと |
| packaged route | backup、notes、review、tags の server route file が存在する | request が proxy を通過し route / provider へ届いたこと |
| native binary | `Contents/MacOS/cornell-method-notebook` は arm64。SHA-256 は `7210a160a24b729ac6e2986bbd72793f841106154a3b131a1afad1a97a1518bb`。command 名、Origin、Referer、runtime validation の文字列を含む | command が実際に invoke され、HTTP request を送ったこと |
| alias | `Cornell-Method-Notebook.app` と DMG alias は fresh target への symlink として作られた記録がある | 現在は symlink 先の release bundle が存在せず、alias 自体は起動証拠にならない |
| packaged QA | 既存 summary で direct app startup は rc=134 / SIGABRT、sidecar bind は `listen EPERM`。window、dynamic port、health、API request、Origin / Referer、native invoke、403 は取得できていない。DMG attach も失敗 | GUI、loopback、browser 操作、API response、proxy の実 request log |

現在読み取れた extracted fallback artifact は静的確認に使える。
既存 QA が記録した起動失敗と合わせても、fresh artifact が「修正を含む」ことと、fresh artifact が「実際の state-changing request に使われた」ことは別の命題である。

### 個別 request 経路の不具合

DELETE には same-origin 403 とは別の transport 不具合がある。

- `DELETE /api/notes/:id` の route は成功時 204 を返す。
- Rust の `DesktopApiResponse.body` は String で、204 の body は空文字になる。
- `desktop-api-bridge.ts:57` は status 204 でも `new Response(response.body, { status: response.status })` を呼ぶ。
- Node の WHATWG Response で `new Response("", { status: 204 })` を実行すると `TypeError: Response constructor: Invalid response status code 204` になった。

Tauri 実行時にこの挙動が WebView でも発生すれば、server 側で削除済みでも client は失敗表示になる。
実際の WebView での発生は未確認であり、same-origin 403 の原因とは別である。

## Classification

| ID | 分類 | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 現行 HTTP mutation は POST notes、PATCH note、DELETE note、POST review、POST backup の 5 系統である | route と remote/UI の静的棚卸し |
| F-002 | fact | 5 系統は proxy の同じ state-changing same-origin 検査を通る | `src/proxy.ts` と `basic-auth.js` |
| F-003 | fact | 現行ソースでは 5 系統すべてが Tauri native bridge を先行適用する | shared transport、backup transport、bridge 条件、Rust command |
| F-004 | fact | fresh artifact の静的内容には修正済み bridge と native command の痕跡がある | BUILD_ID、packaged JS、arm64 binary の静的確認 |
| F-005 | fact | packaged runtime の起動は既存 QA で sidecar / GUI 制約により request 発生前に止まっている | rc=134、bind EPERM、request evidence 不在 |
| F-006 | fact（WebView 実行は unknown） | native bridge の 204 Response mapping は DELETE 成功時に例外になる可能性がある | route の 204、bridge の String body、Node WHATWG Response の実測 |
| H-001 | plausible hypothesis | 「複数または全 POST で 403」が事実なら、個別 route より共通 proxy と origin 不一致の組み合わせが整合する | 403 body は proxy 共通、5 系統は同じ検査を通る。ただし実 request の証拠はない |
| H-002 | plausible hypothesis | 古い app、dangling alias と別の artifact、Tauri marker 不在による browser fallback、sidecar の host / port 差のいずれかが runtime 差を作った可能性がある | source と artifact の静的証拠はあるが、実行経路を特定できていない |
| U-001 | unknown | ユーザーが見た endpoint、status、body、Origin、Referer、document origin | browser / WebView の request capture がない |
| U-002 | unknown | 実行時に `__TAURI_INTERNALS__` が存在し、native invoke と Rust HTTP request が実行されたか | runner が request 発生前に停止 |
| U-003 | unknown | 実際に起動された app と、その内部 BUILD_ID / binary hash | alias は起動記録ではなく、現在の release target も残っていない |
| U-004 | unknown | proxy が見た `request.nextUrl.origin` と、native client が接続した URL / header の実値 | runtime HTTP 到達証拠がない |

### 「全 POST で再現」の扱い

「全 POST で再現」は現時点で再現 fact には分類できない。

現行コードから言える fact は、Origin 検査に失敗した場合、5 系統のどの mutation でも同じ 403 body を返し得ることである。
共通 transport と共通 proxy があるため、複数 endpoint への横展開は plausible hypothesis として妥当である。
fresh Tauri runtime で同じ 403 が発生したこと、または native bridge の適用漏れが実際の原因だったことは unknown のままである。

## Minimal follow-up candidates

### QA / evidence task

fresh artifact を起動できる disposable runtime が用意できた場合、coding 前に 1 回の mutation を追跡する。
記録対象は document origin、`__TAURI_INTERNALS__` の有無、invoke command、validated sidecar URL、native の Origin / Referer、proxy が見た origin、status、body、route 到達である。
これで、proxy mismatch、bridge 未選択、古い artifact、個別 route のどこに進むかを切り分けられる。

### 既知の最小 coding task

DELETE の Tauri 成功表示を直す場合は、対象を `src/shared/desktop/desktop-api-bridge.ts` と bridge contract test に限定する。
status 204 のとき body を `null` として Response を生成し、その他の status の body は保持する。
完了条件は、native DELETE が 204 を返しても bridge が例外を投げず、client が成功として処理すること、既存の 403 / non-2xx body が変わらないこと、focused test が通ることである。
この修正は same-origin 403 の原因を直すものではない。

### 403 が runtime で確認された場合の conditional task

- bridge が呼ばれていなければ、`src/shared/desktop/desktop-api-bridge.ts` と packaged build / 起動経路を調べ、必要な箇所だけ直す。
- bridge は呼ばれているが native header が違えば、`src-tauri/src/runtime.rs` を中心に header の生成と validation test を直す。
- proxy が正しい header を受けている場合は、route handler や UI を変更せず、観測された別原因を対象にする。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `node --test test/auth/basic-auth.test.js test/desktop/desktop-api-bridge-contract.test.js` | PASS | 15 tests passed。same-origin、403 boundary、bridge coverage を含む |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | Rust source を変更していない |
| `git diff --check` | PASS | whitespace error なし |
| `npm run lint` | FAIL（既存問題） | canvas refs、backup effect、summary draft refs など既存箇所で 36 errors / 8 warnings。今回の summary 以外は変更していない |
| fresh artifact の静的確認 | PASS（実行は未確認） | extracted fallback の BUILD_ID、packaged JS、route、arm64 binary、native command strings を確認 |
| fresh packaged GUI / loopback / HTTP request | 未実行・未確認 | task 制約により起動せず。既存 QA も request 前に停止 |
| 作業前後の `git status --short` と差分確認 | 作業前の dirty state を保持 | source/config/dependency/generated artifact の変更なし。追加は summary 1 ファイルのみ |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 403 を返した実 endpoint と request header | WebView または browser の status / header capture |
| U-002 | native bridge invocation の有無 | invoke と Rust command の同時記録 |
| U-003 | 実際に使用された packaged artifact | 起動 path、BUILD_ID、binary hash の記録 |
| U-004 | proxy が計算した request origin | sidecar が listen できる環境での runtime log |
| U-005 | Tauri WebView が 204 Response をどう扱うか | DELETE を含む disposable runtime の read-back |

## Next Read

次の coding / QA 作業では、次の最小ファイルから読む。

- `summary/20260828/0135-audit-all-state-changing-same-origin-requests-20260828-summary.md`
- `src/shared/desktop/desktop-api-bridge.ts`
- `src/modules/notes/remote/transport.ts`
- `src/proxy.ts`
- `src-tauri/src/runtime.rs`
- `summary/20260828/0041-qa-fresh-packaged-alpha-runtime-after-backup-origin-fix-20260828-summary.md`

