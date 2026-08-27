# Desktop SQLite design-flow audit summary

作業日: 2026-08-27 (JST)
対象: `desktop-app-sqlite-design-flow.md`、関連する製品/MVP契約・実装状況・テスト、Desktop storage/runtime/lifecycle/bridge、backup remote/UI、関連テスト

## 結論

中心方針の実装は概ね整合している。コード変更は行っていない。主な gap は実装ではなく、`IMPLEMENTATION_STATUS.md` と `TEST_SCENARIOS.md`、`MVP_CONTRACT.md` の一部が現行の recovery / Data and Backup 実装を未実装と記述していること。packaged macOS runtime の実機 QA は依然として未検証であり、static/disposable PASS を packaged acceptance と扱わない。

## 判定表

| 中心方針 | 判定 | 根拠 |
| --- | --- | --- |
| live SQLite の場所、名前、DATABASE_URL、schema/migration/integrity を user settings にしない | aligned | `src/server/infrastructure/desktop-storage.js:58-66,203-248,293-310` が app 管理 layout と内部 `DATABASE_URL` を生成。`src/shared/desktop/desktop-settings-bridge.ts:434-467` の recovery DTO は path/URL を含まない。`test/desktop/desktop-backup-recovery.test.js:66-87` は private value 非露出を確認。 |
| 初回未初期化時だけ空 DB を作成 | aligned | marker 読み取り `desktop-storage.js:1057-1115`、欠落時の marker 分岐 `desktop-storage.js:1395-1408`、bootstrap の作成入口 `desktop-storage.js:4352-4368,4388-4415`。 |
| 初期化後の欠落/破損/読取不能/schema不整合で空 DB を作成・置換しない | aligned | `databaseMissingAfterInitializationResult` と `UNUSABLE` `desktop-storage.js:1185-1228,1395-1413`、bootstrap は recovery result を返し通常起動へ進めない `desktop-storage.js:4359-4367`。テスト `desktop-backup-recovery.test.js:89-108`。 |
| 内部エラーを安定文言の前に有限回再検査/復旧 | aligned (static scope) | preflight response と recovery-only handoff は `desktop-settings-bridge.ts:304-332`、Tauri command は `main.rs:112-119`、lifecycle の `lifecycle.rs:635-725`。runtime probe の ready/recovery/not-recovered 契約は `runtime.rs:1276-1314`。packaged runtime は未検証。 |
| restore/delete/既存 DB 上書きは明示確認後のみ | aligned | bridge request `desktop-settings-bridge.ts:208-215,540-545`、native confirmation checks `runtime.rs:714-715,1819-1829`、pending restore の明示確認テスト `desktop-recovery-ui.test.js:286-369`。 |
| backup POST の応答消失等で無条件再送しない | aligned | `backup-page.tsx:53-101` は list の ready 後だけ一度再試行し、create は `ready-no-retry`。テスト `backup-page-recovery.test.js:...` の POST ready/no-retry ケース。 |
| Web で Desktop recovery を実行せず既存 Web 契約を維持 | aligned | bridge は `desktop-settings-bridge.ts:2279-2550` で unsupported-web、MVP は `/backup` と `GET/POST /api/backups` を維持 `doc/implementation/MVP_CONTRACT.md:128-129,208-210`。 |
| raw path/DATABASE_URL/raw exception/secret を漏えいしない | aligned for Desktop DTOs; residual risk for legacy Web contract | Desktop catalog/recovery DTO は filename/id のみ `desktop-settings-bridge.ts:473-500`。一方 Web MVP は backup `path` 表示を契約化 `MVP_CONTRACT.md:208-209`、UI が表示 `backup-page.tsx:363-377`。これは今回の中心方針（DB内部設定を user settings にしない）との直接 conflict ではないが、将来 privacy 方針を強めるなら別契約判断が必要。 |

## 仕様差異 / 修正候補 task

1. **Desktop recovery/Data and Backup の契約・状態文書同期**
   - 目的: 実装済みの startup recovery-only、pre-error backup preflight、managed/external restore、complete deletion の状態を canonical docs に反映し、未実装記述を除去する。
   - 対象: `doc/implementation/IMPLEMENTATION_STATUS.md`（特に現行 `Startup / diagnostics / privacy` と `Backup / restore`）、`doc/testing/TEST_SCENARIOS.md:764,771,857-891`、`doc/implementation/MVP_CONTRACT.md:291`。
   - 完了条件: MVP `/backup` 契約を変更せず、Desktop Alpha の別契約として static/disposable PASS と packaged runtime 未検証を明記。`PRODUCT_SPEC.md`/`MVP_SYSTEM_SPEC.md` と矛盾しない。
   - 依存: 現行コード・今回のテスト結果を根拠に先行可能。runtime QA の完了は不要。

2. **Packaged macOS recovery/preflight acceptance**
   - 目的: static test で未確認の Tauri sidecar、startup recovery-only、runtime URL/navigation、再起動後の ready/recovery handoff を実機で検証する。
   - 対象: `src-tauri/src/main.rs`, `runtime.rs`, `lifecycle.rs`, `sidecar/launcher.cjs` と packaged `.app` QA。
   - 完了条件: healthy/missing/corrupt DB、backup preflight ready/recovery/not-recovered、Web unsupported、確認境界を実 packaged runtime で記録。DB/backup は disposable fixture のみ。
   - 依存: packaging/build 環境、Apple Silicon/macOS 実機。Task 1 は並行可能。

3. **Legacy Web backup path の privacy 方針判断（任意・別タスク）**
   - 目的: `/api/backups` の `path` を表示する現行 MVP 契約を維持するか、表示を filename 等へ変更するかを決定する。
   - 対象: `MVP_CONTRACT.md:208-210`, `TEST_SCENARIOS.md:357-361`, `backup-page.tsx:363-377`, API DTO/tests。
   - 完了条件: 発注者が契約変更を承認した場合のみ docs/API/UI/tests を同時更新。今回の中心方針だけでは変更しない。
   - 依存: privacy 要件の明示判断。

## 今回の対象外

設計書の Advanced 保存場所変更、WAL 専用 backup、添付ファイル object store、Keychain、Storage used 表示は、中心方針を満たすために不要な将来案として実装対象外。MVP/Phase 2 の位置付けは変更していない。autosave、soft delete/Undo、専用復習、NoteCard/D&D、PDF、定期/暗号化 backup も同様に対象外。

## Spotlight

- `desktop-storage.js` bootstrap/inspection: 初回と既存欠落の分岐を確認済み、Finding なし。
- `lifecycle.rs`/`runtime.rs` recovery handoff: recovery-only、bounded preflight、confirmation boundary を確認済み、packaged runtime は residual risk。
- `desktop-settings-bridge.ts`: DTO validation と unsupported-web を確認済み、Finding なし。
- `backup-page.tsx`/remote: GET の単回再試行と POST 再送禁止を確認済み、Finding なし。
- canonical docs: 実装済み範囲との stale statements を確認。修正候補 Task 1。

## 検証

実行: `node --test test/desktop/desktop-backup-recovery.test.js test/backup/backup-page-recovery.test.js test/desktop/desktop-recovery-ui.test.js test/backup/backup-page-visual-contract.test.js test/backup/backup-route-desktop-directory.test.js`

結果: 21 tests / 21 PASS、skip なし。作業前後の `git status --short` は同一で、既存変更（`src-tauri/*`、backup UI/bridge/tests、`desktop-app-sqlite-design-flow.md`、既存 summary 等）を戻していない。今回意図して変更したリポジトリのコード・設定・依存関係・設計書・生成物はない。

## Next Read

次回は Task 1 を行う場合、まず本 summary、`doc/implementation/IMPLEMENTATION_STATUS.md` の該当行、`doc/testing/TEST_SCENARIOS.md:757-891`、`doc/implementation/MVP_CONTRACT.md:278-332` を読む。実装変更を行う場合は `src/server/infrastructure/desktop-storage.js:1057-1413,4338-4471` と `src-tauri/src/lifecycle.rs:635-725` を起点にする。
