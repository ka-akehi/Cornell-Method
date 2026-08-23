---
summary_type: task-summary
created_at: 2026-08-21 08:00 JST
task_kind: worker-task
task_status: done
---

# 責務分割後の最終 audit

## Objective

責務抽出後の Desktop / Web UI module、既存 MVP・Desktop contract、公開 API、テスト境界、主要ファイルの肥大化を read-only で確認し、追加分割の要否を判定する。

## Scope

`src-tauri/src/main.rs` と `instance.rs`、`runtime.rs`、`window_state.rs`、`menu.rs`、`lifecycle.rs`、AppChrome と close coordinator、editor と dirty controller、detail modes と Summary draft controller、`app-chrome-parts.tsx`、関連 contract tests、直近の extraction summary を確認した。

## Inputs Read

- `HANDOFF_2026-08-17.md`
- `doc/requirements/PRODUCT_SPEC.md`
- `doc/requirements/MVP_SYSTEM_SPEC.md`
- `doc/implementation/MVP_CONTRACT.md`
- `doc/implementation/IMPLEMENTATION_STATUS.md`
- `doc/testing/TEST_SCENARIOS.md`
- `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`
- `doc/technical/TARGET_ARCHITECTURE.md`
- `summary/20260821/0629-audit-responsibility-extraction-boundaries.md`
- `summary/20260821/0635-specify-responsibility-boundaries-large-files-3c8f1d20-5d139664-summary.md`
- 直近の close / instance / runtime / window state / menu / lifecycle / editor dirty / Summary draft の task summary

## Changes Made

- コード、設定、依存関係、lockfile、生成物、既存テスト、既存ドキュメントは変更していない。
- 監査成果物として本 summary のみを追加した。

## Findings

追加分割が必要な module はない。現時点では今回の責務抽出で停止する。行数だけを理由に `instance.rs`、`app-chrome.tsx`、`editor.tsx`、`modes.tsx`、`app-chrome-parts.tsx` をさらに分割する根拠は確認できなかった。

### 責務・公開 API・判定

| 対象 | 現在の責務 / 公開 API | composition root または component に残った責務 | 判定と根拠 |
|---|---|---|---|
| `main.rs` (105 行) | `main` と `run_application`。Tauri builder、startup 順序、各 module の配線 | instance → focus listener → bootstrap / sidecar → window state → window build / restore → close handler の順序を保持 | **現時点では分割不要**。明確な composition root で、実装本体の回帰はない |
| `instance.rs` (848 行、tests を含む) | stable lock、owner marker、focus socket、stale / active / unknown endpoint 処理。`acquire_instance`、`InstanceAcquire`、`InstanceGuard`、`start_focus_listener` | `main.rs` から instance protocol を呼び出すだけ | **現時点では分割不要**。848 行の大部分は同一 protocol の unit tests。lock / owner / focus の変更単位とテスト境界が一致している |
| `runtime.rs` (487 行、tests を含む) | bootstrap JSON、SQLite / user-data layout、loopback ready handshake、sidecar の process-group cleanup。`run_bootstrap`、`start_sidecar`、`SidecarHandle` | `main.rs` は runtime の開始と AppState への受け渡しだけ | **現時点では分割不要**。bootstrap → serve → stop が一つの local runtime lifecycle。更新・migration・診断など別の運用責務を追加する時だけ再評価 |
| `window_state.rs` (200 行、tests を含む) | geometry-only の read / normalize / atomic write / restore / capture。`window_state_path`、`restore_window_state`、`capture_window_state` | `main.rs` は restore のタイミングと capture の呼び出しだけ | **現時点では分割不要**。画面表示前 restore と close 時 capture の境界が明確 |
| `menu.rs` (57 行) | Settings menu item と既存 primary WebView への Settings bridge。`build_desktop_menu`、menu event handler | window creation、runtime 起動、Settings modal 本体は持たない | **現時点では分割不要**。小さく凝集し、Settings shell test の参照先も安定している |
| `lifecycle.rs` (211 行、tests を含む) | close decision、pending coordinator、navigation fragment 消費、dirty close timeout、window state capture、sidecar stop。`AppState`、`request_close`、`handle_navigation` | `main.rs` は CloseRequested を coordinator に接続するだけ | **現時点では分割不要**。close の保存 / discard / cancel と process cleanup が一つの lifecycle contract を形成している |
| `app-chrome.tsx` (455 行) | shell、responsive rail / mobile overlay、tooltip、focus trap、body scroll lock、Settings / close coordinator の composition。`AppChrome` | close dialog の state / save / discard 実装、Settings modal 実装は残っていない | **別の機能変更時に再評価**。responsive shell の state と DOM が同一変更単位で、現時点の抽出後は過分割になる。responsive 機能が独立して変わる時に限り再評価 |
| `desktop-close-coordinator.tsx` (184 行) | close request の dirty 判定、dialog state、save / discard / cancel、error 表示。`DesktopCloseCoordinator` | `AppChrome` は component を一つ配置するだけ | **現時点では分割不要**。Web bridge と Rust lifecycle の decision contract に対応する単一 UI controller |
| `app-chrome-parts.tsx` (270 行) | AppChrome 専用 icon、route active 判定、nav、create link、brand / identity。`AppChromeIcon`、`AppChromeNavigation`、`AppChromeCreateLink`、`AppChromeDesktopIdentity`、`AppChromeBrand` | AppChrome は layout と responsive state の composition。Settings entrypoint は別 component | **現時点では分割不要**。SVG と navigation / brand が AppChrome の同じ presentational boundary にまとまっている。行数だけで icon / nav を分離しない |
| `editor.tsx` (348 行) | form 初期化、validation / error、Cue / Canvas handlers、create / update save orchestration、editor render。`NoteEditor`、`NoteEditorProps`、`NoteEditorSavedNote` | dirty registration と baseline 更新は hook。既存の body / cues / metadata / summary 等の子 component も分離済み | **別の機能変更時に再評価**。現在は editor の save composition root として凝集している。独立した persistence / validation feature が追加された時だけ再評価 |
| `use-note-editor-dirty-controller.ts` (47 行) | form snapshot、baseline、dirty state、shared desktop controller の register / unregister、`markSaved`。`mode`、`form`、`save` を受ける hook API | save API、Canvas、Cue、router は editor に残る | **現時点では分割不要**。editor dirty owner の最小境界で、API / remote 依存を持たない |
| `modes.tsx` (309 行) | URL mode、note state、view / edit / review state machine、review confirmation / POST、delete、detail composition。`NoteDetailModes`、props | Summary draft の state / PATCH / dirty registration は hook | **別の機能変更時に再評価**。MVP の detail state machine と review / delete contract が同じ境界にある。専用 review task 等の Phase 2 を先取りして分割しない |
| `use-note-detail-summary-draft.ts` (163 行) | Summary draft、task marker toggle、explicit PATCH、revision、dirty registration、discard、saved note acceptance。`mode`、`note`、`onSavedNote` を受ける hook API | URL、review、delete、view / edit composition は modes に残る | **現時点では分割不要**。Summary explicit save と editor-mode との owner 切替を一つの stateful contract として保持している |

`src/modules/notes/ui/hooks/index.ts` はこの二つの hook を barrel export していない。現状は detail / editor 内部の hook API であり、不要な public surface を増やしていない。

### 依存方向と変更頻度

- Web 側は `AppChrome → parts / Settings entrypoint / close coordinator`、close coordinator と notes hooks は shared desktop bridge を利用する方向で閉じている。server、Prisma、filesystem、Tauri API を UI component や hook に持ち込んでいない。
- Notes 側は `modes → summary hook / editor`、hook → notes model / remote / shared markdown / shared desktop bridge の方向で、detail component に PATCH payload や dirty registration の実装本体が戻っていない。
- Rust 側は `main.rs` が composition root で、instance / runtime / window state / menu / lifecycle は Tauri と標準ライブラリ中心の module 境界を保っている。module 間の依存は main が保持する interface に限定されている。
- 直近の task sequence では AppChrome、Rust lifecycle、editor、Summary の順に責務を抽出している。関連 path の直近 git history も 2026-08-02〜11 に UI 変更、2026-08-17 に Desktop foundation を示す。変更頻度の高い component ほど、現時点で先回りした巨大 hook 化を避け、次の機能変更時に再評価する判断が妥当である。
- `app-chrome-parts.tsx` は icon / nav / brand が AppChrome 専用で、現在の変更頻度・依存方向・テスト境界から独立 module へ分ける利益がない。

## Contract Audit

| contract | source boundary | 確認結果 |
|---|---|---|
| close bridge | `src/shared/desktop/desktop-close-bridge.ts`、`desktop-close-coordinator.tsx`、`lifecycle.rs` | `clean` / `save` / `discard` / `cancel` の fragment decision、dirty save failure 時の dirty 維持、Rust 側の timeout / cleanup が対応している。drift なし |
| Settings bridge | `src/shared/desktop/desktop-settings-bridge.ts`、Settings entrypoint、`menu.rs` | menu event は既存 primary WebView に Settings event を送るだけで、新規 window / runtime / sidecar を作らない。General / Updates / Data と既存 `/backup` の扱いを維持している。drift なし |
| single-instance | `instance.rs`、`main.rs` | stable `.instance.lock`、atomic owner marker、focus socket、secondary の primary / sidecar 非起動、active / stale / unknown endpoint の fail-safe を維持している。drift なし |
| runtime / cleanup | `runtime.rs`、`src-tauri/sidecar/launcher.cjs`、`lifecycle.rs` | user-data 配下の SQLite / settings、dynamic loopback、`/notes` ready handshake、process-group TERM → timeout KILL、close 時 stop-before-destroy を保持している。source / Rust tests 上の drift なし。実プロセス確認は未完了 |
| window geometry | `window_state.rs`、`main.rs` | geometry-only の JSON、atomic replace、offscreen normalization、visible 前 restore、close 時 capture を維持している。drift なし |
| Summary explicit save / review separation | `use-note-detail-summary-draft.ts`、`modes.tsx`、detail contract tests | toggle は draft-only、explicit existing-note PATCH と revision を経て成功時だけ note / dirty state を更新する。discard は draft を戻し、review 完了は Summary save と分離している。drift なし |
| editor dirty owner | `use-note-editor-dirty-controller.ts`、`editor.tsx`、shared desktop bridge | create / edit の form snapshot を editor owner として登録し、save 成功後に baseline を更新する。detail Summary hook は edit mode では登録せず owner が重複しない。drift なし |
| MVP boundary | `MVP_CONTRACT.md` と対象 source | autosave、soft delete / Undo、専用 review task、NoteCard / D&D、PDF export、Settings による未承認の backup replacement は追加されていない。既存 route / explicit save / physical delete / `/backup` を維持している。drift なし |

重大な correctness / security / MVP contract drift は確認できなかった。source contract tests が保証するのは主に静的な責務・文字列・依存境界であり、実 browser / packaged GUI の挙動を保証するものではない点は残る。

## Verification

| command | result |
|---|---|
| 指定 Desktop contract tests | PASS: 15 tests、14 pass、1 skip、0 fail |
| 指定 Detail contract tests | PASS: 14 pass、0 skip、0 fail |
| editor 関連補足 contract tests | PASS: 40 pass、0 skip、0 fail |
| `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo test --offline -j 1 --manifest-path src-tauri/Cargo.toml` | PASS: 21 passed、0 failed、0 ignored |
| `npm run lint` | PASS、error 0。`tools/desktop-poc` の既存 warning 8 件 |
| `node --check src-tauri/sidecar/launcher.cjs` | PASS |
| `git diff --check` | PASS |

Desktop の 1 skip は、この runner が disposable loopback listener を許可しないため、dynamic loopback の sidecar ready handshake を実プロセスで確認できなかったもの。補足の `npx tsc --noEmit --pretty false --incremental false` は、広域 tsconfig が `src-tauri/target/debug/runtime` を含むこと、`fabric` / `konva` / `@prisma/adapter-pg` の型解決不足など既存環境の解決エラーで失敗した。今回の hook / component に対する新規 TypeScript エラーは出ていない。

作業前後に `git status --short` を確認し、表示内容は同一だった。コード、設定、依存関係、lockfile、生成物、既存テスト、既存ドキュメントは変更していない。成果物はこの task summary のみである。

## Remaining Unknowns

- packaged macOS GUI での second launch → primary focus、close dialog の実操作、save failure / discard、sidecar process tree の完全終了は未確認。
- browser runtime / DB read-back を伴う Summary explicit save、dirty close、Canvas / legacy Markdown 保存の E2E は未確認。既存 testing docs でも static contract PASS と runtime未確認を分けている。
- runner 制限により dynamic loopback listener の実 runtime test は未確認。
- TypeScript 全体型検査は上記の既存 generated runtime / optional dependency 解決問題が解消されるまで audit の成功条件にできない。

## Follow-up Decision

後続の追加 coding task は **なし**。次の条件が発生した場合だけ、1 task 1目的で再評価する。

1. runtime に update / migration / diagnostic / backup lifecycle を追加する時は、bootstrap・sidecar cleanup との新しい依存境界を再監査する。
2. AppChrome の responsive DOM または独立した navigation feature が変わる時は、`app-chrome.tsx` の state / DOM 分離を再評価する。
3. editor に独立した persistence / validation 機能、detail に Phase 2 の専用 review workflow を追加する時は、それぞれの state machine と hook API を再評価する。

## Next Read

次回この判断を更新する場合は、まず以下だけを読む。

- `doc/implementation/MVP_CONTRACT.md`
- `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`
- `src-tauri/src/main.rs` と変更対象の Rust module
- `src/shared/desktop/desktop-close-bridge.ts`
- 変更対象の notes hook / component と対応 contract test
