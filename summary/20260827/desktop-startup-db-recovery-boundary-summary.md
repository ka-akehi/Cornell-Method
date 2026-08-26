# Desktop startup DB recovery boundary investigation

調査日: 2026-08-27

## 結論

- 起動順は `main.rs setup` の instance/focus listener → runtime root と `StorageLayout` 解決 → update staged migration / update recovery → `run_bootstrap_with_storage` → pending-restore status の記録 → `start_sidecar`（launcher の ready handshake と loopback health）→ WebView 作成・表示。Prisma の実 open は Node sidecar の runtime 起動時で、Rust が Prisma を直接 open する境界はない。
- `desktop-storage.js` の bootstrap は lightweight inspection（詳細 integrity なし）を行い、既存 DB は変更せず、初回だけ migration と marker 作成を行う。Rust runtime は bootstrap message が `ready` 以外なら migration/repair せず startup を止める。したがって失敗時に recovery UI を表示する経路、sidecar を起動して診断/復元操作を提供する経路は未実装。
- 初回/既存利用後の判定材料は live DB と user-data 配下の regular file `.database-initialized`（内容 `v1\n`）。marker なしの DB 不在は `initialization-required`、marker ありの DB 不在は `unusable` / `database-missing-after-initialization`。不正 marker、symlink DB、非 SQLite、integrity/foreign-key/read failure も fail-closed の `unusable` で、自動修復しない。marker は削除操作で初期状態へ戻る以外に履歴 DB/利用回数を表す証跡ではない。

## 再利用できる既存実装

- `src/server/infrastructure/desktop-storage.js/.d.ts`: storage layout（live/backups/settings/logs/pending-restore）、database status/reason、軽量/詳細 inspection、managed backup catalog、managed/external restore、staging validation、schema/integrity/foreign-key/Canvas/Markdown validation、atomic switch、post-switch reopen/read-back、safety backup、pending publish/claim/resume を持つ。restore は `confirmed: true` が必要で、失敗時 live DB を変更しない。
- `src-tauri/src/runtime.rs` と `main.rs`: typed Tauri command の invoke bridge、file dialog、catalog/status/resume、sidecar process cleanup、絶対 `file:` DATABASE_URL の環境引き渡し、ready nonce/loopback health の検証。既存の startup error は Rust 内部文字列/eprintln に留まる。
- `src/shared/desktop/desktop-settings-bridge.ts` と Settings UI: `read_desktop_managed_backup_catalog`、`read_desktop_pending_restore_status`、`resume_desktop_pending_restore`、data-backup operation の response normalization と安全な error code 表現、managed/external restore の別入口、pending restore の明示 resume、完全削除を実装済み。これを recovery UI の操作コンポーネント/command として共有できるが、startup recovery の state/route は別契約が必要。
- `test/desktop/desktop-storage.test.js` は marker、missing-after-init、invalid marker、symlink、非 SQLite、migration/integrity の fail-closed を確認。`desktop-data-backup-*.test.js`、managed catalog、settings bridge/UI、lifecycle/runtime tests は restore/bridge/cleanup を確認するが startup recovery UI は対象外。

## 状態契約の提案

判定の authority は Node storage bootstrap（Rust は opaque な typed snapshot を受ける）とし、起動オーケストレーションは Rust、ユーザー操作は WebView/共有 bridge に分ける。`DatabaseRecoverySnapshot` は少なくとも `schemaVersion`、`state`（`first-run` / `restore-available` / `diagnostic-required` / `restore-unavailable`）、`reasonCode`（allow-list）、`managedBackupAvailable`、`pendingRestoreAvailable`、`canStartEmpty`、`operationId` を持たせる。DB failure 時は live DB を作らず sidecar/Prisma を通常起動しない。Rust が snapshot を含む recovery-only runtime を起動し、WebView は `/startup-recovery` 等で表示する、または Tauri が recovery command を直接提供する方式を先に設計する。通常 `/notes` を開いた後のクライアント判定では race と空 DB 作成を防げない。

表示状態は、(1) 初回作成: 新規 DB を作成して通常起動、(2) 復元可能: managed catalog または pending/external restore を提示、(3) 診断が必要: 診断 ZIP、終了、backup restore、(4) 復元不可: backup がないことを示し、確認後の空 DB 開始または終了、の4系統。破損/読取不能では自動 repair/restore/app restart をしない。restore 成功後だけ明示的 restart handoff と reopen を行う。

## privacy boundary

画面、bridge、diagnostic ZIP の外部出力には絶対 path、`DATABASE_URL`、stack/raw error、ノート title/body/Cue/Canvas/query、token、DB 本体、crash dump を出さない。診断 ZIP は仕様どおり error log、時刻、component、sanitized stack、app/macOS version、CPU architecture、DB schema version のみ。local log は Application Support/logs に置き、本文を含めず 14 日/合計 20 MB の retention を守る。内部ログの絶対 path/詳細 error は画面へ直接流さず、固定 reason code と opaque diagnostic id に変換する。

## 後続 Worker task（依存順）

1. **startup DB recovery contract / orchestrator**（先行）。対象: `desktop-storage.js/.d.ts`、`runtime.rs`、`main.rs`、必要な shared types/tests。bootstrap の four-state snapshot、recovery-only startup、sidecar/Prisma 非起動、marker/permission/read-error mapping、明示 restart handoff を契約化。各 missing/corrupt/unreadable と first-run fixture、no mutation を検証。
2. **diagnostic/local-log/privacy boundary**（1 に依存）。対象: Rust/Node log module、diagnostic command/bridge、tests/docs。allow-list snapshot から sanitized local log と ZIP を生成し、path/URL/stack/content/token/DB bytes の漏えいを negative test。14日/20MB prune と disposable paths を検証。
3. **startup recovery UI and restore wiring**（1、restore bridge 再利用）。対象: recovery route/components/CSS、shared bridge、Settings restore command adapters、UI tests。4状態の安全な copy、managed/external/pending 操作、confirmation、busy/error/retry、終了、backupなしの空DB確認を実装。通常 notes route を開かないことを検証。
4. **packaged/integration QA**（1–3）。対象: `test/desktop` integration、packaged runtime harness/docs。sidecar ready→recovery/normal route、Prisma open failure、DB missing/corrupt/unreadable、restore atomic switch→restart/read-back、cleanup/orphan process と privacy artifact を macOS packaged `.app` で確認。DNS/build blocker が解消されるまで static/disposable PASS と混同しない。

## 未解決の設計判断

- recovery-only UI を既存 Next sidecar の special mode で動かすか、Rust/Tauri native recovery window/commands にするか。再利用性は前者、Prisma 起動不能時の独立性は後者が強い。Manager 推奨は recovery snapshot を Rust が保持し、通常 DB を open しない recovery-only sidecar modeを用いる案。
- `restore-unavailable` で空 DB を許す確認文言、診断 ZIP の保存先選択、既存 update pending/restart state との優先順位は未承認。
- current code の `logsDirectory` は layout/env に存在するが、local log/diagnostic writer と retention は未実装。既存 Settings bridge の error allow-list は recovery state を表すには不足。

## 検証

- 読み取りのみ実施。`git status --short` を作業前後に確認し、コード、設定、依存関係、テスト、生成物は変更していない。既存の未追跡 summary 群は保持した。
- 実行した確認: `git status --short`、指定文書/実装/テストへの `rg`、対象コードの `sed`。テスト/build は変更禁止の調査タスクのため実行していない。
