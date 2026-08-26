# Diagnostic / recovery contract investigation

## 結論

診断・local log の実装は未着手。`src-tauri/ui/index.html` は「ノートを準備しています…」だけで、復旧画面の操作・bridge 接続はない。既存 recovery backend は recovery snapshot、managed/external restore、pending restore resume、recovery-only mode までであり、診断を代替しない。

## 現状棚卸し

- `src-tauri/src/main.rs`: invoke handler は backup file dialog/operation、managed catalog、pending restore status/resume、`read_desktop_database_recovery_snapshot` 等。bootstrap が `BootstrapOutcome::Recovery` なら sidecar を起動せず primary window を `index.html` で表示し、exit を許可する。diagnostic command/window はない。
- `src-tauri/src/runtime.rs`: `run_bootstrap_with_storage` は sanitized `DesktopDatabaseRecoverySnapshot` を返し、private path fields を recovery response から拒否する。`DesktopFileSelectionStore` と macOS `osascript` の save/open dialog は backup 用だけ。`start_sidecar` は stdout を pipe するが stderr は `Stdio::null()`、ready timeout/child failure は文字列 error のみ。
- `src-tauri/src/lifecycle.rs`: recovery-only restore/resume は sidecar を止めたまま DB を検証・切替し、成功後 restart-sidecar/`mark_ready`。診断・終了処理は未接続。
- `src/shared/desktop/desktop-settings-bridge.ts`: recovery snapshot と backup dialog/selection sanitizer は実装済み。recovery-specific diagnostic API/types はない。UI は `invoke` の typed normalization boundary を再利用すべき。
- `src/server/infrastructure/desktop-storage.js/.d.ts`: Application Support 配下の live/backups/settings/logs/pending-restore layout と recovery snapshot/restore contract はあるが、log writer、14-day/20-MB prune、diagnostic bundle はない。
- tests: `desktop-startup-recovery.test.js` と backup suites は recovery/restore/deletion boundaries を確認する。diagnostic/local-log/privacy/retention/UI flow の tests はない。

## 固定すべき契約

診断 ZIP はユーザー明示操作でのみ local に作成し、自動送信しない。保存先は既存 save dialog の「ユーザーが明示選択した file」境界に置くが、SQLite export selection と混同しない専用 dialog/selection kind を追加する。bridge には path を返さず opaque selectionId と basename/status/error code のみを返し、native 側が canonical path を selection store から解決する。既存 Application Support 配下へ診断 ZIP を自動保存しない。

Allowlist は error log、timestamp、component、sanitized stack、app version、macOS version、CPU architecture、DB schema version のみ。denylist は title/body/Cue/Summary/tag/learning source/search query、SQLite 本体、backup、Canvas JSON、token、user path、crash dump。stack/path/message の sanitizer は user path・query・token・note data を redact し、unknown fields は fail closed。failure は cancel を成功扱いせず、dialog/selection/write/zip failure を typed error とし、部分 ZIP を publish しない。

local log は Application Support `logs/` に privacy-safe structured records を appendし、14日かつ合計20 MB、超過時は古いものから prune。細かな file rotation/record size/clock policy は仕様上未決定だが、実装 task の既定は bounded records、atomic temp+rename、起動時/append後 prune、prune failure は起動を止めず診断可能な typed local error とする。通常 log には note data や user path を書かない。stderr は現状捨てられているため、直接保存せず sanitizer 経由の component error event に変換する。

Recovery UI の責務は snapshot を読む、理由/backup availability を表示し、主操作「診断を書き出して終了」、副操作「そのまま終了」、source がある場合のみ「backup から復元」を導くこと。backup がない場合のみ空DB開始を提示（現 snapshot の `canStartEmpty` を根拠）。restore は既存 managed catalog/外部 file dialog/confirmation/pending-resume pipeline を再利用し、UI は DB path や private snapshot fields を扱わない。成功した recovery restore は既存の recovery-only transition/sidecar restart semantics を壊さない。

## 後続 coding tasks（依存順）

1. **local log + diagnostic export backend** — `src-tauri/src/diagnostics.rs`（新規）、`runtime.rs`/`main.rs` の lifecycle error hooks、必要なら storage `.d.ts/.js`、Cargo dependency は最小化。log schema/sanitizer/retention、allowlist ZIP、atomic publish、専用 save dialog と selection store を実装。完了: allow/deny fixtures、14日/20MB prune、cancel/write/zip failure、no partial output、path/token redaction。検証: `cargo fmt --check`、Rust unit tests、Node static contract tests。
2. **diagnostic bridge contract** — `src/shared/desktop/desktop-settings-bridge.ts` と `test/desktop/desktop-diagnostic-bridge.test.js`。command名、request/response schema、normalizer、unsupported-web、typed errors、selectionId-only boundary を実装。Task 1 に依存。
3. **recovery window UI + bridge connection** — `src-tauri/ui/index.html`（必要な同梱 asset のみ）、bridge の recovery/diagnostic/restore 呼び出し。snapshot state ごとの主操作と keyboard/failed-operation semantics、restore confirmation、exit handoff を実装。Task 2 に依存。
4. **integration/static acceptance** — `test/desktop/desktop-recovery-ui.test.js`、startup recovery tests の追加。window route/no sidecar、diagnostic-first、backup availability、restore success/failure/exit、privacy artifact inspection を disposable temp で確認。Tasks 1–3 に依存。packaged macOS GUI は別 QA として未検証のまま扱う。

## Next Read

後続 Worker は最小限、`src-tauri/src/main.rs`（setup/invoke）、`src-tauri/src/runtime.rs`（storage/dialog/sidecar）、`src-tauri/src/lifecycle.rs`（recovery restore/exit）、`src/shared/desktop/desktop-settings-bridge.ts`（sanitizer/bridge）、`src/server/infrastructure/desktop-storage.js` と `.d.ts`（layout/types）、`test/desktop/desktop-startup-recovery.test.js`、`test/desktop/desktop-data-backup-restore.test.js`、`test/desktop/desktop-settings-bridge.test.js`、`doc/requirements/PRODUCT_SPEC.md` の diagnostics 節だけを読む。
