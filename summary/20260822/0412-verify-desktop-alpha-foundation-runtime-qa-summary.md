---
summary_type: task-summary
created_at: 2026-08-22 04:12 JST
task_kind: worker-task
task_status: done
---

## Objective

Desktop Alpha foundation の current runtime / QA 境界を、コード変更なしで確認する。static contract、focused / unit test、disposable local runtime、packaged GUI の証拠レベルを分け、PASS / FAIL / BLOCKED / 未確認と後続 task の入力を固定する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Tauri foundation、single-instance、primary lifecycle、dynamic loopback、dirty close、Settings、storage、Notes Summary / MVP contract、packaging preflight |
| 対象ファイル / ディレクトリ | `HANDOFF_2026-08-22.md`、2026-08-21 / 2026-08-22 summary、Desktop Alpha 関連 docs、`src-tauri/`、`src/shared/desktop/`、Settings / close coordinator、`test/desktop/`、関連 `test/notes/` |
| 対象外 | 実装修正、設定・依存関係・lockfile の変更、build / package 作成、外部サービス接続、既存の Application Support / 製品 DB の利用 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-22.md` | 完了済み foundation、未検証範囲、既知の runner 制約、Next Read |
| prior evidence | `summary/20260822/0359-reconcile-desktop-alpha-docs-handoff-20260822-ab1e04ee-summary.md` | 直近 reconcile の結果。今回の再実行結果とは分離して扱った |
| prior audit | `summary/20260821/0800-audit-final-responsibility-boundaries.md`、`summary/20260821/0802-audit-responsibility-extractions-final-84c1d5-b794c0f3-summary.md` | static / unit evidence と残る runtime unknown |
| contract | `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`、`doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md`、`doc/implementation/IMPLEMENTATION_STATUS.md`、`doc/implementation/MVP_CONTRACT.md`、`doc/testing/TEST_SCENARIOS.md` | current MVP / Desktop Alpha の契約と packaged QA の完了条件 |
| implementation | `src-tauri/src/{main,instance,runtime,lifecycle,window_state,menu}.rs`、`src-tauri/sidecar/launcher.cjs`、`src/shared/desktop/`、Settings / close coordinator | 起動順序、ready handshake、lock / focus、geometry、close / cleanup、Settings bridge の境界 |
| tests | `test/desktop/`、Summary / review / editor 関連 `test/notes/` | 今回再実行する focused test の範囲 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260822/0412-verify-desktop-alpha-foundation-runtime-qa-summary.md` | 今回の検証報告を新規作成 | 再開時に current evidence、blocker、Next Read を raw log なしで引き継ぐため |

コード、設定、依存関係、lockfile、生成物、既存テスト、既存ドキュメントは変更していない。作業前後の `git status --short` で開始前からの変更 path を保持し、今回の追加は本 summary のみだった（`summary/20260822/` 自体は開始前から untracked 表示）。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | focused Desktop tests は 24 tests、23 pass、1 skip、0 fail。skip は dynamic loopback test のみ。 | `node --test test/desktop/*.test.js` |
| F-002 | fact | 関連 Notes contract は 31 pass、0 skip、0 fail。Summary toggle / explicit save boundary、review separation、editor save failure 関連を含む。 | `node --test` による指定 7 test file の再実行 |
| F-003 | fact | Rust unit は 21 pass、0 fail。single-instance の concurrent acquire、active / unknown / permission endpoint、stale recovery、close decision、window geometry を含む。 | `CARGO_TARGET_DIR=/private/tmp/... cargo test --offline -j 1 --manifest-path src-tauri/Cargo.toml` |
| F-004 | fact | disposable loopback bind は `EPERM:listen EPERM: operation not permitted 127.0.0.1`。既存 dynamic loopback test はこの理由で skip された。 | `node --test test/desktop/desktop-lifecycle.test.js`、独立 bind probe |
| F-005 | fact | Apple Silicon host は `aarch64-apple-darwin`。repo の `src-tauri/target` と disposable POC path に current product の `.app` / `.dmg` は見つからなかった。 | `rustc -vV`、対象 path の `find` |
| F-006 | fact | browser skill の setup / troubleshooting 後も browser session 一覧は空だった。 | browser runtime の `getDefault`、bootstrap troubleshooting、`agent.browsers.list()` |
| F-007 | fact | Cargo test の生成物は `/private/tmp/cornell-desktop-cargo-target.dLsR86` に置き、検証後に削除した。 | `CARGO_TARGET_DIR`、temp path の削除確認 |
| A-001 | assumption | 2026-08-21 audit / 2026-08-22 handoff の PASS は prior evidence として再利用し、今回の test output と混同しない。 | summary 運用ルールと task 指示 |
| U-001 | unknown | packaged GUI での Dock / Finder 前面化、primary window 数、`/notes` 表示、monitor 上の geometry restore、Settings 操作、dirty close の実操作は未確認。 | current `.app` なし、browser session なし、package 作成は今回対象外 |
| U-002 | unknown | 実プロセスの dynamic ready → `/notes` HTTP read-back → stop → child process tree 空を一連で観測していない。 | loopback `EPERM` により test が skip |
| U-003 | unknown | browser / DB を結合した Summary explicit save、dirty close、Canvas / legacy Markdown の再読込 E2E は未確認。 | browser runtime unavailable。storage test は disposable DB の bootstrap / preservation / migration 判定まで |

### Current classification

| 観点 | 判定 | 証拠レベルと境界 |
|---|---|---|
| single application instance / primary focus | **PASS（focused / unit）** | stable advisory lock、focus、secondary の no-window / no-sidecar、concurrent acquire、active / unknown / permission / stale の Rust unit と static contract は PASS。packaged Dock / Finder は **未確認**。 |
| startup ready と `/notes` 起点 | **BLOCKED（local runtime）** | source contract は ready handshake 後の `WebviewWindowBuilder` と `/notes` を示すが、loopback bind `EPERM` のため実 startup / HTTP read-back は未実施。 |
| dynamic loopback / sidecar readiness | **BLOCKED** | `desktop-lifecycle.test.js` の対象 test は skip。dynamic port、ready message、stop、port close、child cleanup の実測なし。 |
| window geometry | **PASS（unit / focused）** | geometry-only JSON、offscreen normalization、round-trip は Rust unit PASS。実 window / monitor restore は **未確認**。 |
| dirty close: save / discard / cancel / save failure | **PASS（focused contract / unit）** | bridge owner 集約、Summary draft、save failure の dirty 維持、3 choices、Rust close decision は PASS。React / packaged GUI のクリック、Escape、backdrop、実 save failure は **未確認**。 |
| sidecar / app-owned child process cleanup | **BLOCKED（local runtime）** | source は process group TERM → timeout → KILL を持ち、unit / static boundary は確認済み。実 child process tree の終了確認は loopback `EPERM` で未実施。 |
| Settings menu / Web gear / mobile entrypoint | **PASS（static / focused）** | Mac menu → existing primary WebView event、Web gear / mobile trigger の shared bridge、3 category、dialog / focus / keyboard、既存 `/backup` link は focused test PASS。browser / packaged操作は **BLOCKED**。 |
| browser / DB read-back と既存 MVP 契約 | **PASS（disposable storage / static contract）＋ BLOCKED（browser E2E）** | disposable temp DB の初期化、migration、既存 DB preservation、corrupt / incomplete 判定は PASS。Notes Summary / review / editor contract は 31 PASS。browser-backed `/notes`、DB read-back を伴う Summary explicit save / dirty close / Canvas / legacy Markdown は未確認。 |
| packaged Apple Silicon GUI | **BLOCKED** | host は Apple Silicon だが current `.app` / `.dmg` がなく、package 作成は実行していない。packaged QA には current `aarch64-apple-darwin` artifact、起動可能な macOS GUI、loopback bind 許可、browser / GUI 操作手段が必要。 |

FAIL は今回の再実行範囲では検出していない。static contract PASS、unit PASS、disposable storage PASS を packaged GUI / browser runtime PASS へ繰り上げていない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `git status --short`（作業前後） | PASS | 開始前の既存変更を保持。新規成果物は本 summary のみ |
| `node --test test/desktop/*.test.js` | PASS: 23 pass / 1 skip / 0 fail | 24 tests。dynamic loopback / child cleanup は runner 制約で skip |
| 関連 Notes contract 7 files | PASS: 31 pass / 0 skip / 0 fail | `node --test test/notes/detail-summary-checkbox-contract.test.js test/notes/detail-review-confirmation-contract.test.js test/notes/detail-review-feedback-contract.test.js test/notes/detail-mode-url-contract.test.js test/notes/editor-error-focus-contract.test.js test/notes/editor-metadata-contract.test.js test/notes/note-editor-enter-submit-contract.test.js` |
| Rust unit test | PASS: 21 passed / 0 failed | temp target を repo 外に指定。生成物は削除済み |
| `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | PASS | 書き込みなし |
| `node --check src-tauri/sidecar/launcher.cjs` | PASS | 書き込みなし |
| `git diff --check` | PASS | whitespace error なし |
| disposable loopback probe | BLOCKED | `127.0.0.1:0` bind が `EPERM` |
| browser setup / discovery | BLOCKED | browser session list が空 |
| packaged artifact preflight | BLOCKED | Apple Silicon host は確認、current `.app` / `.dmg` はなし。package は作成していない |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| R-001 | packaged app の single instance、primary focus、`/notes` 起動、window geometry、Settings、dirty close | 現行 `src-tauri/` から作成した Apple Silicon `.app` と、操作可能な macOS GUI の結合 QA |
| R-002 | dynamic sidecar ready、HTTP `/notes`、stop、orphan process なし | loopback bind が許可された runner / macOS session と process tree 観測 |
| R-003 | browser / DB read-back の Summary explicit save、dirty close、Canvas / legacy Markdown | browser session または同等の許可済み local UI runtime、disposable DB、request / response / reload 記録 |
| R-004 | package resource / sidecar / Node runtime の実同梱動作 | package 作成を許可した Apple Silicon preflight と current artifact |

次の実装 task は、これら BLOCKED を理由に今回の foundation を修正することではなく、packaged QA の前提を揃えてから独立に実施する。

## Next Read

次回は以下を最小入力として読む。

- `summary/20260822/0412-verify-desktop-alpha-foundation-runtime-qa-summary.md`
- `HANDOFF_2026-08-22.md`
- `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`
- `doc/testing/TEST_SCENARIOS.md` の Desktop Alpha §2
- `src-tauri/tauri.conf.json`
- `src-tauri/src/main.rs`、`runtime.rs`、`lifecycle.rs`、`instance.rs`
