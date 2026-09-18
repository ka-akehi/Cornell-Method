---
summary_type: task-summary
created_at: 2026-08-21 06:29 JST
task_kind: worker-task
task_status: done
---

## Objective

肥大化している5ファイルについて、行数だけでなく責務、依存方向、公開契約、テスト境界、変更頻度を根拠に安全な抽出境界を調査した。後続 Worker が追加質問なしで実装できるよう、抽出候補、順序、検証方法、変更してはいけない契約を整理した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | AppChrome、ノート editor / detail mode、Tauri Desktop Alpha shell |
| 対象ファイル | `src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx`、`src/modules/notes/ui/components/editor/editor.tsx`、`src/modules/notes/ui/components/detail/modes.tsx`、`src-tauri/src/main.rs` |
| 直接関連 | `src/app/layout.tsx`、editor / detail の既存部品、`src/app/_components/settings/`、`src/shared/desktop/`、`src-tauri/sidecar/launcher.cjs`、関連 Desktop / UI contract test |
| 正本 | `doc/implementation/MVP_CONTRACT.md`、`doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`、`doc/implementation/IMPLEMENTATION_STATUS.md`、`HANDOFF_2026-08-17.md` |
| 対象外 | コード、設定、依存関係、lockfile、schema、生成物、テスト、通常のドキュメントの変更、commit、PR、外部サービス接続 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 現行実装 | `src/app/_components/app-chrome.tsx`、`app-chrome-parts.tsx` | shell、responsive navigation、tooltip、Settings、desktop close、icon / brand / route 部品の境界 |
| 現行実装 | `src/modules/notes/ui/components/editor/editor.tsx`、`detail/modes.tsx` | form state、明示保存、Canvas、Summary dirty、review、delete、URL mode の混在箇所 |
| Desktop 実装 | `src-tauri/src/main.rs`、`src-tauri/sidecar/launcher.cjs`、`src/server/infrastructure/desktop-storage.js` | single-instance、bootstrap、sidecar ready / cleanup、window state、close/menu の依存順 |
| UI / Desktop tests | `test/notes/app-chrome-contract.test.js`、`app-chrome-responsive-contract.test.js`、editor / detail contract tests、`test/desktop/desktop-close-bridge.test.js`、`desktop-lifecycle.test.js`、`desktop-settings-shell.test.js`、`desktop-settings-ui.test.js` | source-path と source-section に依存する検査境界、移動時に維持すべき semantic contract |
| 契約 | `doc/implementation/MVP_CONTRACT.md` | canonical route、明示保存、物理削除、detail 内 review、CanvasDocumentV1、Summary checkbox / dirty / PATCH |
| 契約 | `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md` | Tauri + Node sidecar、Application Support、single-instance、startup / close ordering、MVP 非変更境界 |
| 状況 / 引き継ぎ | `doc/implementation/IMPLEMENTATION_STATUS.md`、`HANDOFF_2026-08-17.md` | 実装済み範囲、未検証範囲、Desktop Alpha の順序と未決事項 |
| 直近 summary | `summary/20260821/0313-*`、`0407-*`、`0427-*`、`0503-*`、`0517-*`、`0532-*`、`0545-*`、`0611-*` | 現在の未コミット実装が single-window、dirty bridge、stale recovery、Settings の直近 task で追加されたこと |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| 変更ファイルなし | 調査・設計整理のみ。既存の未コミット変更は保持した | Worker task の制約により、後続 task の発注単位だけを作成するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 作業開始時点で対象コード、契約文書、テストに既存の未コミット変更があった。`src-tauri/`、Settings、Desktop bridge、summary も既存作業として未追跡 / 未コミットだった | 作業前 `git status --short`。対象を戻さず現行 working tree を調査した |
| F-002 | fact | 現行 MVP の canonical route は `/notes`、`/notes/new`、`/notes/[id]`、`/backup`。detail の view / edit / review は同じ route 内の mode 切替で、専用 review task や `/notes/backup` はない | `MVP_CONTRACT.md` §3、§4.3 |
| F-003 | fact | 保存は明示操作のみ。POST / PATCH は Notebook、Cue、tag relation を1リクエストで確定し、Canvas は `CanvasDocumentV1`、legacy Markdown は自動変換しない | `MVP_CONTRACT.md` §4.1、§5.2、§6.1 |
| F-004 | fact | Summary checkbox は view / review の画面上 draft。toggle では API を呼ばず、明示保存だけ既存 `PATCH /api/notes/:id` を使う。保存失敗時は draft と dirty を保持し、review 完了とは別操作 | `MVP_CONTRACT.md` §6.3、`modes.tsx` の Summary controller |
| F-005 | fact | Desktop close は WebView event `cornell:desktop-close-request`、decision `save` / `discard` / `cancel` / `clean`、URL fragment を介して Rust に返す。dirty owner は editor と Summary の複数登録を集約する | `desktop-close-bridge.ts`、`app-chrome.tsx`、`main.rs` の `request_close` / `handle_navigation` |
| F-006 | fact | Tauri startup は single-instance acquisition → focus listener → storage bootstrap → sidecar ready → primary WebView(`/notes`) → window restore → close handler → show / focus の順序に依存する | `main.rs` `run_application`、`DESKTOP_ALPHA_TAURI_FOUNDATION.md` §起動と終了 |
| F-007 | fact | 現在の focused Node contract は 34 tests 中 33 PASS、sidecar loopback test 1件は listener bind 不許可で skip。抽出後も source regex を緩めて契約を隠してはいけない | 2026-08-21 に実行した関連10 test file。skip理由は runner の loopback 制約 |
| U-001 | unknown | packaged Apple Silicon GUI、実 macOS の二重起動前面化、close dialog の実操作は未検証。抽出だけでこの結合 QA を代替できない | `IMPLEMENTATION_STATUS.md` Desktop Alpha 節、直近 summary |

## Responsibility and extraction matrix

### 1. `src/app/_components/app-chrome.tsx`（627行）

現状の責務は、(a) `AppChrome` の公開 shell と `children` の main slot、(b) 901px desktop の同一 DOM sidebar / rail、(c) 900px mobile の header / overlay / focus trap / body scroll lock、(d) pathname / breakpoint による状態 reset、(e) desktop tooltip の pointer / focus delegation と portal geometry、(f) Settings の desktop / mobile entrypoint、(g) Tauri close request の dirty 判定・dialog・save / discard / cancel である。a〜f は shell / navigation の責務、g は desktop lifecycle bridge の責務で、現在の file で最も明確に混在している。

| 候補 | 移動する責務 | 残す責務 | 依存方向 | 維持する public / test contract | リスクと検証 |
|---|---|---|---|---|---|
| `src/app/_components/desktop-close-coordinator.tsx` | `DESKTOP_CLOSE_REQUEST_EVENT` の購読、dirty owner 取得、close dialog state、save / discard / cancel、Escape / backdrop、dialog JSX | AppChrome の shell layout、desktop / mobile navigation、tooltip、Settings entrypoint | coordinator → `src/shared/desktop/desktop-close-bridge.ts`。Tauri API は直接持たない | event 名、4 decision、文言「保存して終了／保存せず終了／戻る」、save 失敗時の cancel + dirty 保持、`desktop-close-dialog*` の role / aria を不変。`AppChrome` は `<DesktopCloseCoordinator />` を1箇所 render | 高優先・最初の Web 抽出。`app-chrome.tsx` と `desktop-close-bridge.test.js` の source-path test を新 file も読むよう最小更新し、app-chrome の route / DOM test は維持。関連 close bridge、lifecycle、AppChrome contract を実行 |
| `src/app/_components/app-chrome-responsive-shell.tsx`（候補、後段） | desktop sidebar、mobile header / overlay、rail / mobile state、focus trap、breakpoint reset、tooltip を navigation shell としてまとめる | `AppChrome` の公開 wrapperと `children` の受け渡し、close coordinator | responsive shell → `app-chrome-parts.tsx`、Settings entrypoint。desktop bridge へ依存させない | `app-chrome-shell`、sidebar 1個、同じ `id` / class / aria / DOM order、901 / 900 breakpoint、same-DOM navigation、`/notes` / `/notes/new` 導線を維持 | 中リスク。props / ref を細切れに渡すだけなら抽出効果がないため、state と JSX を一緒に移す1 taskに限定。source regex test の参照先を移行してから実装し、visual / keyboard runtime は別 QA。tooltip を単独 file に先に切り出さない |

切り出さない方が安全なもの: main slot と sidebar / mobile overlay を別 route や別 DOM tree にすること、desktop / mobile で別の navigation model を導入すること、Settings modal を AppChrome に再統合すること。現行 contract は same-DOM sidebar、single primary window、既存 Settings event と `/backup` 維持を前提にしている。

### 2. `src/app/_components/app-chrome-parts.tsx`（270行）

現状は、(a) SVG icon union と path、(b) `/notes` の route active 判定と nav item、(c) desktop / mobile の navigation link、(d) `/notes/new` create link、(e) desktop identity / mobile brand と共通 brand content を持つ。既に shell から presentational parts を切り出せており、行数の割に責務は AppChrome 固有でまとまっている。

| 候補 | 移動する責務 | 残す責務 | 依存方向 | 維持する contract | 判定 |
|---|---|---|---|---|---|
| `app-chrome-icons.tsx`（条件付き） | `AppChromeIconName` と SVG path / icon renderer | parts の facade、navigation、brand | settings entrypoint / modal と shell → parts facade → icons | icon 名 `close`、`menu`、`notes`、`panel-left-close`、`panel-left-open`、`plus`、`settings`、path、`strokeWidth=1.75`、`aria-hidden`。parts から re-export して direct import を増やさない | 将来 icon 数や変更頻度が増えた場合だけ実施。現状は7種で、re-export と test 更新のコストが利益を上回るため今は task 化しない |
| `app-chrome-navigation.tsx`（条件付き） | nav item、`isActiveRoute`、NavLink、Navigation、CreateLink | icon と brand | shell → navigation → icon facade | `/notes` は detail を active とし `/notes/new` を除外、create は `/notes/new`、collapsed desktop の aria / tooltip、mobile `onNavigate` | nav item 増加や route 変更が頻発する段階で検討。create link は navigation と同じ route / tooltip contract を持つため別々には切らない |
| `app-chrome-brand.tsx`（非推奨） | brand content、desktop identity、mobile brand | icon / navigation | shell → brand | `/notes` link、aria-label、brand text / class | 35行程度の重複解消に過ぎず、ブランド変更が独立して頻発しない限り分割しない |

維持する public / test boundary は、現行の named exports `AppChromeIcon`、`AppChromeNavigation`、`AppChromeCreateLink`、`AppChromeDesktopIdentity`、`AppChromeBrand` と、Settings 側が `AppChromeIcon` を import していること。generic な route config / global icon system へ抽象化しない。今の最小方針は `app-chrome-parts.tsx` を変更せず、必要になった時だけ icons を facade 付きで切り出すことである。

### 3. `src/modules/notes/ui/components/editor/editor.tsx`（365行）

現状は UI の巨大な markup file ではなく、NoteEditor の orchestration である。form 初期化（create は bodyMode=`canvas`）、noteDate / tag error の編集制約、Cue add / update / remove、Canvas document / error の反映、API save と error focus、router 遷移、desktop dirty controller 登録、Metadata / Cue / Body / Summary section の composition を担当する。`body.tsx`、`cues.tsx`、`metadata.tsx`、`summary.tsx`、`tags.tsx`、`error-focus.ts` は既に分離済み。

| 候補 | 移動する責務 | 残す責務 | 依存方向 | 維持する contract | リスクと検証 |
|---|---|---|---|---|---|
| `src/modules/notes/ui/components/editor/use-note-editor-dirty-controller.ts` | serialized baseline、dirty / save ref、`registerDesktopDirtyController`、save 成功時の baseline 更新 | form state、Cue / Canvas handlers、remote POST / PATCH、error focus、render layout、public props | editor → hook → shared desktop bridge。hook は API / Canvas adapter を import しない | `NoteEditorProps` / `NoteEditorSavedNote` と `components/index.ts` export、明示保存のみ、save は boolean、失敗時 false + dirty 保持、edit では noteDate を更新しない、create Canvas / payload を変更しない | 中リスクだが最小の抽出候補。`JSON.stringify(form)` の順序、save 成功前の baseline 更新禁止、`onSaved` / router 遷移前の dirty reset、effect cleanup を固定。editor、desktop-close bridge、date / metadata / Canvas / enter-submit contract を実行 |

`NoteEditorFormState` 全体、Canvas handler、API payload、error focus を一度に hook 化しない。これらは save、CanvasDocumentV1、noteDate immutable、Cue / tag relation の境界をまたぎ、props が増えるだけの抽象化になりやすい。`draft?: unknown` など既存 public props も、未使用を理由に削除しない。

### 4. `src/modules/notes/ui/components/detail/modes.tsx`（413行）

現状は detail の state machine / controller である。URL と mode（view / edit / review）、note state、Summary draft / revision / saving / dirty、review の本文・Summary confirmation、nextReviewDate、review success、delete state / error を管理し、`NoteEditor`、`NoteDetailReadView`、既存 actions を接続する。Summary の draft persistence と review transition が混在するが、表示部分は既に `read-view.tsx`、`display.tsx`、`actions.tsx` に分離されている。

| 候補 | 移動する責務 | 残す責務 | 依存方向 | 維持する contract | リスクと検証 |
|---|---|---|---|---|---|
| `src/modules/notes/ui/components/detail/use-note-summary-draft.ts` | Summary draft state / refs、task marker toggle、revision guard、既存 PATCH save、discard、dirty owner 登録 | URL `mode=edit`、review confirmation / API / date、delete、mode transition、editor / read-view composition | modes → hook → notes remote / summary payload / markdown marker / desktop bridge | toggle は API を呼ばない、成功時だけ保存済み response と dirty=false、失敗・revision競合・saving中は false / dirty保持、view / review のみ bridge 登録、review POST と Summary PATCH を分離、discard は元 Summary へ戻す | 高めの中リスク。`noteRef` と draft ref の同時性、edit mode で owner を登録しない条件、review 完了時の discard、Canvas / legacy Markdown を含む `noteDetailToSummaryUpdatePayload` を固定。Summary checkbox、detail mode URL、review confirmation / feedback、desktop close tests を実行 |

review flow 全体を `useReviewTask` にする、review を `/tasks/review` に移す、delete を別 service にすることは提案しない。MVP は detail 内 review、手動 `nextReviewDate`、物理削除であり、専用 task / autosave / soft delete を追加する境界ではない。review の confirmation state は `modes.tsx` に残すのが最小である。

### 5. `src-tauri/src/main.rs`（1,782行）

現在の責務は次の6群に分かれる。

1. single-instance: Application Support の instance paths、stable `.instance.lock`、atomic owner marker、Unix focus socket、stale / active / unknown / permission recovery、secondary の bounded retry。
2. bootstrap / runtime: Node launcher の path 解決、storage bootstrap JSON、絶対 `file:` URL / ready status validation、dynamic loopback ready handshake。
3. sidecar cleanup: Node child、process group、TERM → timeout → KILL、root / descendant の終了確認、Drop。
4. window state: geometry-only JSON、read / atomic write、monitor visibility normalization、restore / capture。
5. close lifecycle: `CloseDecision`、pending coordinator、WebView event dispatch、URL fragment decision、save failure 時の close cancellation、sidecar stop 後の destroy / app exit。
6. menu / composition: macOS Settings menu、既存 primary WebView への event dispatch、Tauri setup、primary window 作成、`main()` の instance result 分岐。

| 候補ファイル | 移動する責務 | 残す責務 | 依存関係 / 順序 | 維持する contract | リスクと検証 |
|---|---|---|---|---|---|
| `src-tauri/src/instance.rs` | 1の types、lock / owner / socket protocol、`InstanceGuard` Drop、acquire、focus request / listener と Rust unit test | composition root、bootstrap / sidecar / window / close | `main.rs` → instance。primary は listener bind 後に bootstrap する順序を維持。Tauri focus listener を同 module に置く場合も window creation は持たせない | stable lock は unlink / rename しない、authority は OS advisory lock、owner marker は全量 write + sync + same-dir rename、legacy marker は fail-safe、stale socket だけ再利用、secondary は window / sidecar を作らない、cleanup は自分の owner / socket だけ | 最初の Rust 抽出。instance unit test（現 main.rs 1309〜1755 の大部分）を module 内へ移し、Node lifecycle test の source path を更新。`cargo fmt --check`、`cargo test --offline -j 1`、desktop lifecycle / settings contract。`libc` / lockfile は変更しない |
| `src-tauri/src/runtime.rs` | 2 + 3。`BootstrapMessage` / `StorageLayout`、bootstrap process、launcher / node path、ready validation、runtime wait、`SidecarHandle` と process-group cleanup | `runtime_project_root` の Tauri resource lookup、composition | `main.rs` が root を解決し、runtime が bootstrap → sidecar の順で実行。`StorageLayout` を crate 内で公開 | Application Support layout、bootstrap non-ready は起動停止、既存 DB を Rust 側で migrate / repair しない、絶対 `DATABASE_URL`、dynamic 127.0.0.1 port、`/notes` ready、child / descendant cleanup、orphan を残さない | T1後。`launcher.cjs` の `bootstrap` / `serve` command、env 名、ready JSON を変更しない。Rust bootstrap / URL tests、desktop storage、desktop lifecycle（loopback可能時）、`node --check` を実行。Sidecar の明示 stop と Drop の二重呼出しを壊さない |
| `src-tauri/src/window_state.rs` | 4の `WindowState`、`MonitorRect`、read / write / normalize、restore / capture | `AppState` の composition、close の最終呼出し | `main.rs` / lifecycle → window_state。runtime と独立だが shared main.rs wiring の競合を避けるため T2後に行う | `settings/window-state.json`、width / height / x / y だけ、min 640x480、visible intersection 80x60、offscreen は見える monitor へ補正、初期値 1280x900、show 前 restore。DB / note / query を保存しない | Rust window state tests、`cargo fmt` / `cargo test`。画面 QA は packaged GUI の別 task。window state を settings schema や note data と混ぜない |
| `src-tauri/src/menu.rs` | 6の Settings menu builder、menu event、`cornell:desktop-settings-request` dispatch script | `run_application` の Tauri builder 呼出し | menu → Tauri `AppHandle` / `MenuEvent`。window / runtime を生成しない | macOS menu item id `desktop-settings`、既存 primary WebView への event、window 未作成時 no-op、non-macOS default menu、Settings は dirty close と独立 | 低〜中リスク。`desktop-settings-shell.test.js` の source path を更新し、Settings UI / close bridge を実行。menu 抽出を理由に `WebviewWindow` や sidecar を新設しない |
| `src-tauri/src/lifecycle.rs`（最後） | 5の `CloseDecision`、`CloseCoordinator`、`AppState`、request / finalize close、navigation fragment handler | `run_application` と `main()` の startup composition | lifecycle → runtime / window_state / Tauri。T1〜T4の crate 内 interface 固定後 | close request event、`save` / `discard` / `cancel` / `clean`、120秒 timeout の既定 cancel、save failure は window destroy しない、sidecar stop 成功後だけ destroy / exit、navigation は decision fragment を消費して画面遷移させない | 最も後段。Rust close unit test、desktop-close-bridge、AppChrome contract、lifecycle / Settings test。dirty close の WebView event と `sendDesktopCloseDecision` を同時変更しない |

`run_application` と `main()` は最終的にも composition root として `main.rs` に残す。Tauri setup の順序をさらに `bootstrap_app`、`create_window` などへ細分化すると、listener bind、sidecar ownership、window restore、close handler の順序が見えにくくなるため、現段階では提案しない。`StorageLayout` を DB repository、Canvas、MVP API へ渡すことも禁止する。

## Follow-up Worker tasks

以下は1 task 1目的を守る発注単位。`対象` は主実装境界で、必要な `main.rs` の module wiring と source-contract test の最小更新だけを同じ task に含める。テストを消す・regex を広げて実装を見えなくすることは完了条件に含めない。

| 順序 | task | 対象 | 依存 | 完了条件 | 検証方法 | 変更してはいけない契約 |
|---:|---|---|---|---|---|---|
| 1 | Web desktop close coordinator を AppChrome から抽出 | `desktop-close-coordinator.tsx`、`app-chrome.tsx` の1箇所 wiring | 現行 shared close bridge | dialog と coordinator が新 file に移り、AppChrome は shell / responsive nav を担当。dirty owner の save / discard / cancel / clean semantics が同じ | `node --test test/desktop/desktop-close-bridge.test.js test/desktop/desktop-lifecycle.test.js test/notes/app-chrome-contract.test.js test/notes/app-chrome-responsive-contract.test.js`、`npm run lint` | event 名、decision、save failure dirty 保持、same-DOM shell、MVP route / API / Canvas / review |
| 2 | Tauri single-instance protocol を抽出 | `src-tauri/src/instance.rs`、`main.rs` wiring、対応 Rust / Node contract path | なし。ただし Task 1 と同じ test file を同時編集しない | lock / owner / socket protocol と Rust test が module に移り、secondary が Tauri resource を作らない | `cargo fmt --check`、`cargo test --offline -j 1`、`node --test test/desktop/desktop-lifecycle.test.js` | stable lock authority、legacy / stale recovery、bounded focus、application id、no unconditional delete |
| 3 | Tauri bootstrap / sidecar runtime を抽出 | `src-tauri/src/runtime.rs`、`main.rs` wiring | Task 2（shared main wiring を順序化） | bootstrap と sidecar が runtime module に移り、startup / ready / cleanup の順序と env boundary が不変 | `cargo fmt --check`、`cargo test --offline -j 1`、`node --test test/desktop/desktop-storage.test.js test/desktop/desktop-lifecycle.test.js`、`node --check src-tauri/sidecar/launcher.cjs` | absolute SQLite URL、dynamic loopback `/notes`、bootstrap no repair、process-group cleanup、既存 Web API |
| 4 | Window state を抽出 | `src-tauri/src/window_state.rs`、`main.rs` wiring | Task 3 | geometry の read / write / restore / normalize が module に移り、sidecar / DB に依存しない | Rust window unit test、`cargo fmt --check`、`cargo test --offline -j 1` | settings path、geometry-only JSON、visible monitor 補正、初期 window size |
| 5 | Tauri Settings menu bridge を抽出 | `src-tauri/src/menu.rs`、`main.rs` wiring、`desktop-settings-shell.test.js` の参照先 | Task 4（同じ main.rs の競合回避） | menu は既存 primary WebView に event を送るだけで、新 window / runtime / sidecar を作らない | `node --test test/desktop/desktop-settings-shell.test.js test/desktop/desktop-settings-ui.test.js test/desktop/desktop-close-bridge.test.js`、Rust tests | menu id / event、Settings と close bridge の独立、`/backup` 維持 |
| 6 | Rust close lifecycle を抽出 | `src-tauri/src/lifecycle.rs`、`main.rs` wiring | Tasks 3〜5 | close coordinator / navigation decision / final cleanup が module に移り、composition root の順序だけ main に残る | `cargo test --offline -j 1`、desktop close / lifecycle / Settings tests、AppChrome focused tests | `cornell:desktop-close-request`、4 decisions、save failure cancel、stop-before-destroy、MVP contract |
| 7 | NoteEditor dirty registration を抽出 | `use-note-editor-dirty-controller.ts`、`editor.tsx` の wiring | Task 1 の bridge contract を固定後 | dirty baseline と bridge registration だけが hook に移り、form / Canvas / API orchestration は editor に残る | editor 全 contract、`test/desktop/desktop-close-bridge.test.js`、`npm run lint`、可能なら `npx tsc --noEmit --pretty false` | explicit save only、boolean save result、CanvasDocumentV1、noteDate immutable、Cue / tag relation、onSaved / router behavior |
| 8 | detail Summary draft controller を抽出 | `use-note-summary-draft.ts`、`modes.tsx` の wiring | Task 7後を推奨（shared dirty test の競合回避） | Summary toggle / save / discard / dirty owner が hook に移り、URL mode、review confirmation / POST、delete、render composition は modes に残る | Summary checkbox、mode URL、review confirmation / feedback、desktop close、`npm run lint` | existing PATCH only、toggle no API、failure dirty retention、review と Summary save の分離、legacy Markdown / Canvas payload |

### 依存関係と並行可否

```text
現行 bridge / contract
  ├─ Task 1 Web close coordinator
  ├─ Task 2 Rust instance
  │    └─ Task 3 runtime/bootstrap/sidecar
  │         └─ Task 4 window state
  │              └─ Task 5 menu
  │                   └─ Task 6 Rust close lifecycle
  └─ Task 7 editor dirty hook
       └─ Task 8 Summary draft hook（順序化推奨）
```

Task 1、Task 2、Task 7 は責務上は並行可能だが、同じ shared contract test や manager の確認を触るため、同一 working tree では同時実行しない。Rust Task 2〜6 はすべて `main.rs` の module wiring と Rust test ownership を変更するため、別 worker を並列起動せず、上記順で1 workerずつ実施する。AppChrome / editor / modes の source-contract test は移動元 file の文字列に依存するため、実装とテスト参照先の更新を分離して後回しにしない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 既存の tracked modification と untracked `src-tauri/`、Settings、Desktop bridge、summary 等を確認。変更は戻していない |
| 対象5ファイルの責務 / 行数確認 | PASS | `app-chrome.tsx` 627、`app-chrome-parts.tsx` 270、`editor.tsx` 365、`modes.tsx` 413、`main.rs` 1,782 lines |
| focused related Node contract | 33 PASS / 1 SKIP | 34 tests。skip は `desktop-lifecycle.test.js` の disposable loopback bind 不許可のみ。failure 0 |
| コード / 設定 / lockfile / schema / test / docs | 変更なし | この task は調査のみ。summary 作成以外の repository artifact は変更していない |
| Git commit / PR / 外部接続 | 実施なし | 制約どおり |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | packaged macOS GUI の single-instance、window restore、Settings menu、dirty close の実操作 | packaged Apple Silicon app の Desktop Alpha QA。source extraction の完了だけでは PASS にしない |
| U-002 | Rust module 分割後の最適な `pub(crate)` interface と unit test 配置 | Task 2〜6 を順番に実装し、`cargo test --offline -j 1` と source contract を確認して決める。先に抽象 trait / shared error module を作らない |
| U-003 | AppChrome responsive shell をさらに抽出した場合の runtime focus / responsive 証跡 | Task 1後の DOM-preserving diff と Browser / keyboard QA。現在の static contract は exact source location を前提にする |
| U-004 | editor / modes の dirty hook が React lifecycle と concurrent Summary save に与える影響 | Task 7 / 8 の focused test と実 DB read-back。API route、Canvas persistence、review success を変更して補うのは禁止 |

## Next Read

次の coding task は、まず対象 task の summary と次の最小ファイルだけを読む。

- `summary/20260821/0629-audit-responsibility-extraction-boundaries.md`
- `src/app/_components/app-chrome.tsx`（Task 1 の移動前 close 範囲）
- `src/shared/desktop/desktop-close-bridge.ts`
- `test/desktop/desktop-close-bridge.test.js`
- `src-tauri/src/main.rs`（Rust Task 2〜6 の場合は対象範囲の行のみ）
- `test/desktop/desktop-lifecycle.test.js`
- `doc/implementation/MVP_CONTRACT.md`
- `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`
