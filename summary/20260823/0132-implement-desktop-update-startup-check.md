---
summary_type: task-summary
created_at: 2026-08-23 01:32 JST
task_kind: worker-task
task_status: done
---

## Objective

Tauri の起動完了後、window の表示・focus を遅延させない background execution で automatic update check を最大1回起動し、既存の provider → selection → state orchestrator に接続する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Desktop Alpha startup update check |
| 対象ファイル / ディレクトリ | `src-tauri/src/main.rs`、必要最小限の `update_check.rs` / `update_state.rs`、desktop update contract tests |
| 対象外 | manual check、Settings UI / command / bridge、package download、SHA-256 / signature verification、apply、rollback、notification claim、UI event dispatch |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-22.md` | Desktop Alpha の既存 lifecycle と update 未接続範囲 |
| implementation | `src-tauri/src/main.rs` | setup、managed state、window 表示順序 |
| implementation | `src-tauri/src/update_check.rs` | trigger、state、provider、selection の orchestration 契約 |
| implementation | `src-tauri/src/update_state.rs` | automatic 24時間制限、atomic write、epoch-second helper |
| implementation | `src-tauri/src/update_target.rs` / `update_provider.rs` | validated target context と real reqwest transport の既存契約 |
| tests | `test/desktop/desktop-update-*.test.js` | 既存の focused contract と旧 caller 前提 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/src/main.rs` | `show` / `set_focus` 後に `tauri::async_runtime::spawn_blocking` を1回起動。worker 内で managed `UpdateStateStore`、`load_update_target_context()`、`ReqwestManifestHttpTransport`、`CheckTrigger::Automatic`、epoch seconds を使用して `run_update_check` を呼び出す。失敗ログは固定 error code のみ。 | setup / UI thread の blocking network wait を避け、既存 orchestrator に接続するため |
| `src-tauri/src/update_check.rs` | `StateStorage` の安全な固定 error code accessor を追加。 | startup worker が raw error chain をログへ出さないため |
| `src-tauri/src/update_state.rs` | 既存 `current_timestamp()` を crate 内共有 helper として公開。state schema、24時間制限、mapping、atomic write は変更なし。 | startup worker が既存 epoch-second 契約を再利用するため |
| `test/desktop/desktop-update-startup-check.test.js` | 起動順序、background task、managed state、Automatic trigger、固定 error code、manual / package side effect 不在を検証。 | startup caller の focused contract を固定するため |
| `test/desktop/desktop-update-check.test.js` | startup caller 接続後も transport injectable 契約を検証するよう旧「caller なし」期待を更新。 | 新しい責務分離と矛盾する旧 assertion を調整するため |
| `test/desktop/desktop-update-target.test.js` | startup が validated target context を供給する契約へ旧 assertion を更新。 | 新しい startup caller と矛盾する旧 assertion を調整するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | `UpdateStateStore::load_or_default` は既存どおり1回だけ実行され、worker は `app.state::<UpdateStateStore>()` から同じ managed instance を参照する。 | `src-tauri/src/main.rs` |
| F-002 | fact | worker は window の `show` / `set_focus` 成功後に起動し、setup の戻り値を network wait で遅延させない。 | `src-tauri/src/main.rs`、startup contract test |
| F-003 | fact | `Suppressed` / `AlreadyChecking`、NoUpdate / Available / Failed の処理は既存 orchestrator と state store に委譲され、provider は startup caller から直接呼ばれない。 | `src-tauri/src/update_check.rs`、focused tests |
| F-004 | fact | target / transport / state error のログは `.code()` の固定値だけで、URL、response body、command output、error chain は保存しない。 | `src-tauri/src/main.rs`、`update_target.rs`、`update_provider.rs` |
| A-001 | assumption | `spawn_blocking` は Tauri runtime が管理する background work として扱い、worker 自身は child process / sidecar を生成しないため、起動 caller による orphan process は発生しない。 | Tauri runtime API、worker 実装 |
| U-001 | unknown | 実 macOS の packaged app で window lifecycle と `/usr/bin/sw_vers` を含む startup 実行は未確認。 | 外部 / packaged runtime 検証を実施していないため |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| focused update Node tests | pass | 11/11 pass |
| all desktop Node tests | pass with known skip | 38 pass、1 skip。runner が disposable loopback listener を許可しないため |
| Rust unit tests | pass | 66/66 pass。`CARGO_TARGET_DIR` は `/tmp/cornell-method-cargo-target-update-startup-20260823` |
| `cargo fmt --all -- --check` | pass |  |
| `npm run lint` | pass | 0 errors、既存 warning 8件 |
| `git diff --check` | pass |  |
| external GitHub manifest GET | not run | 固定公開 manifest への live connection は検証で禁止のため |
| package / signature / apply / rollback / UI event | not run / not added | task scope 外 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 実 macOS packaged app での startup worker 実行、`sw_vers`、window 表示後の挙動 | disposable settings と packaged GUI を使った runtime QA |
| U-002 | 公開 manifest の実データに対する NoUpdate / Available mapping | 許可済み固定 URL の明示的な別検証。ただし本 task の検証では実行しない |

## Next Read

次回は以下だけを起点にする。

- `summary/20260823/0132-implement-desktop-update-startup-check.md`
- `src-tauri/src/main.rs`
- `src-tauri/src/update_check.rs`
- `test/desktop/desktop-update-startup-check.test.js`
