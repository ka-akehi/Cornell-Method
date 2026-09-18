---
summary_type: task-summary
created_at: 2026-08-31 JST
task_kind: inventory
task_status: done
---

# Desktop runtime / native API / recovery 差分のコミット境界

## 判定

開始時・終了時の `git status --short` は同一集合で、コード、設定、依存関係、生成物、Git index は変更していない。直近3コミット `9d07603`、`6fe6a2b`、`f1de152` の内容は再採用しない。`src-tauri/runtime.rs` の既存 file-dialog failure metadata、AppleScript cancel/error、`9d07603` 相当の診断追加は、候補から除外する。

## ステージ順と正確な候補

### 1. Desktop capability / typed native API bridge

依存の最初。次を whole-file で stageする。

- `src-tauri/capabilities/default.json`
- `src-tauri/permissions/app-commands.toml`
- `src/shared/desktop/desktop-api-bridge.ts`
- `src/modules/notes/remote/transport.ts`
- `src/modules/backup/remote/index.ts`
- `test/desktop/desktop-api-bridge-contract.test.js`
- `test/desktop/desktop-tauri-capability.test.js`

`src/proxy.ts` は same-origin guard hunk（diffの proxy import と `proxy()` 内の origin/forbidden 判定）だけを含める。auth hunkは候補4へ回す。`src-tauri/src/main.rs` は `DesktopApiRequest` / `DesktopApiResponse` import、`request_desktop_state_changing_api` command、invoke登録の3箇所だけを含める。`runtime.rs` は `desktop_api_url`、`desktop_api_method`、`request_desktop_state_changing_api` と、それらを直接検証するテスト hunkだけを含め、file-dialog・bootstrap・recovery hunkは含めない。

最小検証:

`node --test test/desktop/desktop-api-bridge-contract.test.js test/desktop/desktop-tauri-capability.test.js`; `npx tsc --noEmit`; `npm run lint -- --file src/proxy.ts`（scriptがfile optionを受けない場合は対象ESLintを実行）；`git diff --cached --check`。期待値は bridge 4件以上PASS、capability wildcardなし・`withGlobalTauri=false` PASS、typecheck/lint/check PASS。

コミットメッセージ: `feat: add typed desktop API bridge boundary`

### 2. Sidecar bootstrap / startup recovery / diagnostics

候補1の native command が依存する runtime 起動契約を確定する。次を whole-file または指定symbolで stageする。

- `src-tauri/Cargo.toml` の `diagnostic-web-inspector` feature hunkのみ
- `src-tauri/sidecar/launcher.cjs` の `bootstrapFailureMessage`、`reportBootstrapFailure`、`bootstrap()` の storage failure/result validation、export hunk
- `src-tauri/src/diagnostics.rs` の sidecar error-code whitelist と deterministic key-order test hunk
- `src-tauri/src/main.rs` の diagnostic env opt-in、startup error-code reporting、`window_builder.devtools` opt-in、対応test hunk
- `src-tauri/src/runtime.rs` の `BootstrapMessage`/storage bootstrap error、`resolve_storage_layout`、`run_bootstrap_with_storage`、ready/health validation、`start_sidecar`/`cleanup_startup_failure` と関連test hunk（おおむね現行行114–3201のうち、file-dialog/backup/recovery/API/single-instance以外）
- `src-tauri/src/lifecycle.rs` の `AppState::runtime_url` と `start_sidecar` error-code propagation hunk
- `test/desktop/desktop-startup-recovery.test.js`, `test/desktop/desktop-devtools-contract.test.js`

`src-tauri/src/runtime.rs` と `main.rs` は whole-file不可。`runtime.rs` の file-dialog（`desktop_file_dialog_*`、`run_native_file_dialog`、`choose_data_backup_*`）および backup/recovery（`run_*backup*`、`pending_restore_*`、`managed_backup_*`）は候補3へ分離する。`diagnostics.rs` の既コミット済み file-dialog診断追加は含めない。

最小検証: `node --test test/desktop/desktop-startup-recovery.test.js test/desktop/desktop-devtools-contract.test.js`; `npx tsc --noEmit`; `cargo fmt --check`; `cargo test --manifest-path src-tauri/Cargo.toml`（環境制約ならfocused testの結果と分けて記録）。期待値は startup 11件、devtools/capability関連PASS、diagnostic featureは明示env=`1`だけ有効、default buildのdevtools無効。

コミットメッセージ: `feat: harden desktop sidecar startup recovery`

### 3. Single-instance / lifecycle / data recovery operations

候補2の runtime URL/state を利用する後続。次を stageする。

- `src-tauri/src/instance.rs` の `MACOS_UNIX_SOCKET_PATH_LIMIT`、`FocusSocketCheckStage`/`SanitizedIoError`、fallback path、bounded path、700 permissions、unavailable diagnostic、関連test hunk
- `src-tauri/src/lifecycle.rs` の `run_data_backup_operation_command`、`run_desktop_backup_recovery_command`、`run_pending_restore_resume_command`、recovery navigation/ready hunk（`runtime_url` と start error propagation は候補2のみ）
- `src-tauri/src/runtime.rs` の `Desktop*Backup*`、pending restore、managed catalog、database recovery の request/response/parser/launcher hunk と関連test hunk
- `test/desktop/desktop-lifecycle.test.js`, `test/desktop/desktop-startup-recovery.test.js` の single-instance/recovery hunkのみ

file-dialog command (`desktop_file_dialog_*`, native AppleScript) は除外し、既コミット済み診断と重複させない。`test/desktop/tauri-icon-contract.test.js` は icon採用が確定するまで除外。

最小検証: `node --test test/desktop/desktop-lifecycle.test.js test/desktop/desktop-startup-recovery.test.js`; `cargo fmt --check`; focused Rust test; `git diff --cached --check`。期待値は single-instance 11 PASS、loopback依存SKIPは環境制約として明記、long TMPDIR fallback pathが104 bytes未満・700 permissions。

コミットメッセージ: `fix: make desktop instance and recovery paths resilient`

### 4. Basic auth boundary

- `src/server/auth/basic-auth.js` whole-file（今回追加の authority-origin parserを含む）
- `test/auth/basic-auth.test.js` whole-file
- `src/proxy.ts` の auth関連hunkのみ

same-origin hunkは候補1に残す。`node --test test/auth/basic-auth.test.js` と対象lintを実行し、authorityの不正形式、IPv6、port、credentials混入をPASSさせる。メッセージ: `fix: tighten local basic-auth handling`。canonical MVPが authentication-free のため、この候補は意図確認なしにはstageしない。確認できなければ保留。

### 5. UI候補（Desktop runtime候補から除外）

候補AのDesktop責務に混ぜず、既存inventoryのB/Cとして別commitにする。

- Theme: `src/app/_components/theme/*`、`layout.tsx`、theme関連CSS、settings modal/testのtheme hunk。`feat: add persistent theme preferences`
- Note UI: app chrome、detail delete/review、editor metadata/cues/tags、canvas viewer/runtime、markdown、関連 `test/notes/*`。settings modal/test内のdelete/general/backup hunkは各責務へpartial stage。`fix: refine note editor and detail interactions`

このUI候補の focused tests/typecheck/lint が必要であり、Desktop runtimeの完了根拠にはしない。

## 保留（stageしない）

- `Notebook.app`: packaged artifact/alias。ソース成果commitに含めない。
- `src-tauri/icons/icon.png`、`src-tauri/icons/icon.svg`、`test/desktop/tauri-icon-contract.test.js`: product icon採用を別途決めるまで保留。binary生成物とsourceを混在させない。
- `summary/20260826`〜`summary/20260831`、`codex-queue/tasks-common/`、queue `.tmp`: 運用記録・queue lifecycle。source commitに含めない。
- `HANDOFF_2026-08-28.md`、`AGENTS.md`、旧handoff削除: コード候補とは独立した `docs: refresh current project handoff`。最新参照と削除対象を確認した場合のみstageする。
- `src/app/_components/settings/settings-modal.tsx`、`src/modules/notes/ui/components/detail/actions.tsx`、`src-tauri/src/runtime.rs` は、上記境界に対応しない残余hunkをstageしない。未完了またはprovenance不明の残余は保留。

## 全差分の分類確認

tracked変更は候補1〜5または保留へ割当済み。untrackedのtheme/bridge/permissionは候補1または5、icon/Notebook.app/queue/summaryは保留。既コミットのfile-dialog修正・診断は再コミットしない。未確認のpackaged GUI、Safari inspector、sidecar ready実測、loopback API、SQLite read-backは「検証済み」と記載せず、候補のcommit理由にも使わない。

## 最終確認

実行済み: `git status --short`（作業前後）、`git log -3 --oneline`、候補ファイルの `git diff --unified=0`、関連summary/contractの照合。実装テスト・lint・build・cargo testは棚卸しのため再実行していない。コード・設定・indexは変更していない。

## Next Read

1. 本summary
2. `summary/20260830/worker-fresh-diagnostic-bridge-204-20260830-summary.md`
3. `summary/20260830/0307-fix-single-instance-focus-socket-long-tmpdir-20260830-abf1b4e0-summary.md`
4. `src/shared/desktop/desktop-api-bridge.ts`, `src-tauri/src/instance.rs`, `src-tauri/src/runtime.rs`, `src-tauri/src/main.rs`
