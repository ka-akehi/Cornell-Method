# Managed backup restore investigation

## Objective

設定画面の managed backup restore について、選択した backup、live SQLite、renderer 表示を分離して追跡し、DB置換不良・catalog/選択不良・復元後の古い UI state のどこまで再現できるかを確認した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | managed / external restore、catalog、confirmation、bridge、Tauri lifecycle、sidecar、SQLite read-back、pending restore |
| 対象ファイル / ディレクトリ | `src/app/_components/settings/settings-modal.tsx`、`src/shared/desktop/desktop-settings-bridge.ts`、`src-tauri/src/lifecycle.rs`、`src-tauri/src/runtime.rs`、`src-tauri/sidecar/launcher.cjs`、`src/server/infrastructure/desktop-storage.js`、指定 desktop tests |
| 対象外 | 実ユーザーデータ、実運用 backup、既存の未コミット変更、コード修正・設定修正・依存関係変更・test 修正 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 仕様 / 運用 | `AGENTS.md`、`HANDOFF_2026-08-31.md`、`summary/README.md`、`summary/task-summary-template.md` | 変更禁止、dirty worktree 保護、summary 運用、packaged runtime の既知の未確認条件 |
| UI / bridge | `src/app/_components/settings/settings-modal.tsx`、`src/shared/desktop/desktop-settings-bridge.ts` | confirmation 後の request、`backupId` の typed bridge、catalog 表示、成功後の UI 処理 |
| native boundary | `src-tauri/src/lifecycle.rs`、`src-tauri/src/runtime.rs`、`src-tauri/src/main.rs` | sidecar quiesce/restart、rollback、`window.location.replace`、managed path の解決 |
| sidecar / storage | `src-tauri/sidecar/launcher.cjs`、`src/server/infrastructure/desktop-storage.js` | request validation、staging、migration/integrity/FK/semantic validation、atomic switch、safety backup、read-back、pending 分岐 |
| verification | 指定 5 test、`test/desktop/desktop-managed-backup-catalog.test.js`、`test/desktop/desktop-lifecycle.test.js` | 既存保証範囲と未実行/skip 条件 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260906/1533-investigate-managed-backup-restore-20260906.md` | 調査結果のみを追加 | Worker task の完了要約を残すため |

コード、設定、依存関係、生成物、test ファイルは変更していない。`summary/` は Worker provenance helper の対象外とした。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F1 | fact | managed restore は、一覧の entry を押すだけでは実行せず、確認ダイアログの完了後に `source.kind="managed-backup"` と `source.backupId=selectedConfirmation.backup.backupId`、`confirmed=true` を typed bridge へ渡す。 | `settings-modal.tsx` の `handleManagedRestoreIntent` / `handleConfirm`、`desktop-settings-bridge.ts` の request validator |
| F2 | fact | bridge は renderer から path を受け取らず、Tauri は safe な `backupId` を承認済み backups directory へ解決して sidecar request を作る。managed / external は native boundary 上で分離されている。 | `desktop-settings-bridge.ts`、`runtime.rs`、`launcher.cjs` |
| F3 | fact | 通常 restore は sidecar 停止後に staging candidate を検証し、live の safety backup を作成してから switch し、再オープンした live DB の integrity/FK/schema/semantic snapshot を read-back する。read-back 失敗時は safety backup へ rollback する。 | `desktop-storage.js` の restore pipeline、指定 restore/pending tests |
| F4 | fact | disposable SQLite fixture で managed backup A/B を作成し、A を選択して restore したところ、選択 backup の digest と復元後 live DB の digest が一致した。Markdown の title/body/summary、Cue、Tag relation、Canvas document/searchText も A の値に戻り、選択 source は変更されなかった。 | 一時 home、2 managed backup、別 state の live DB を使った read-back。実データ・実運用 backup は不使用 |
| F5 | fact | 同じ fixture で restore 前 live state を `restore-<operationId>.sqlite.bak` として safety backup に保存できた。safety backup には restore 前の current title/body/summary が残った。safety backup の生成自体は意図された安全機構である。 | disposable backup の SQLite read-back と managed catalog |
| F6 | fact | managed catalog backend は backups directory 内の regular file をすべて返し、安全用 backup を通常の catalog entry として除外しない。fixture では restore 前後で catalog に user backup と safety backup が並んだ。 | `listManagedBackupCatalog` と catalog fixture |
| F7 | fact | 現在の `settings-modal.tsx` は `catalogState.backups.slice(0, 1).map(...)` のため、bridge/backend が返す複数 entry のうち先頭 1 件だけを表示する。fixture では `backup-a` を選べる状態でも表示は `backup-b` の 1 件だけで、restore 後も safety backup を含む全履歴は見えない。 | UI source と `desktop-settings-ui.test.js`、disposable catalog 比較 |
| F8 | fact | lifecycle は通常 restore で sidecar を停止し、成功後に再起動して `window.location.replace(restartedRuntimeUrl)` を実行する。renderer 側の restore success handler には DB read-back/fingerprint の明示処理はなく、通常経路は full navigation に依存している。 | `lifecycle.rs`、`settings-modal.tsx` |
| F9 | fact | packaged runtime の sidecar にも、Tauri が設定する `CORNELL_DESKTOP_PROJECT_ROOT` を明示して managed catalog と restore を実行した。catalog は target を返し、restore response は typed success、live title/digest は target と一致し、安全用 backup には restore 前 title が残った。 | disposable packaged app resources + packaged Node/launcher |
| F10 | unknown | disposable packaged GUI/WebView で、restore 後の画面が再読込されて restored note を表示するところまでは確認できなかった。既存の同 bundle アプリが起動中だったためそれには触れず、隔離 home で packaged executable を直接起動した試行は exit code 1・stderr なしで終了した。 | Computer Use の state では既存 Cornell app を確認。隔離 home の GUI 起動試行。sidecar 単体は成功 |
| F11 | fact | newer-schema は通常 restore と別に pending artifact/status を作り、明示的 confirmation と compatible app からの resume を要求する。pending の claim/release/consume、migration/integrity/FK/Canvas/searchText validation は targeted tests で確認済みで、通常 restore の成功表示とは混同しない。 | `desktop-storage.js`、`lifecycle.rs`、`desktop-data-backup-pending.test.js` |
| F12 | fact | external restore は native selection の path を受ける別 request であり、managed `backupId` と同じ入力としては扱われない。external と managed の既存 restore tests はともに pass した。 | `runtime.rs`、`launcher.cjs`、`desktop-data-backup-restore.test.js` |

### Root cause / narrowed hypothesis

DB の atomic replacement・managed source 解決・post-switch read-back の失敗は disposable fixture では再現しなかった。したがって「live DB が置き換わっていない」は現時点の第一候補ではない。

最も具体的な不具合候補は catalog/UI の境界である。backend は user backup と safety backup を含む複数 entry を返す一方、Settings UI は先頭 1 件だけを表示する。報告者が古い managed backup、または safety backup を意図していた場合、期待した backup を選べない／表示履歴と選択対象が一致しない。safety backup が作成されること自体は復元失敗ではないが、user backup と同じ catalog に分類情報なしで出るため、表示・選択の誤認を生み得る。

一方、表示されている 1 件を選んだにもかかわらず復元後に旧内容が表示されるケースは、この調査では再現していない。lifecycle の sidecar restart + full navigation は存在するが、renderer の実 WebView read-back は未確認なので、そこは残る二次候補である。

## Minimal coding task direction (未実装)

1. 「managed catalog は最新 1 件だけか、user backup 全件か」「safety backup は選択対象か」を仕様として決める。
2. 全件選択が正なら、`slice(0, 1)` を見直し、safety backup の表示・除外・識別を明示する。安全用 backup を catalog API から分離する設計も比較する。
3. A/B の managed backup と自動生成 safety backup を含む regression test を追加し、表示 entry → confirmation → exact `backupId` → restore 後 live title/body/Cue/Tag/Canvas/searchText → renderer 再読込後の表示を別々に検証する。
4. packaged GUI を CI/QA で起動できる条件が整ったら、`window.location.replace` 後に新 runtime が restored DB を読み直すことを実 WebView で確認する。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 指定 targeted tests | PASS: 54/54 | `desktop-data-backup-restore`、`desktop-data-backup-pending`、`desktop-data-backup-boundary`、`desktop-settings-bridge`、`desktop-settings-ui`。skip なし |
| catalog + lifecycle tests | PASS: 21、FAIL: 0、SKIP: 7 | loopback listener を許可しない runner のため handshake 系 7 件を skip |
| disposable managed restore | PASS | source/live/safety backup を digest と SQLite application snapshot で分離して確認 |
| packaged sidecar catalog/restore | PASS | packaged Node/launcher を隔離 home で実行。GUI/WebView は未確認 |
| pending/newer-schema | PASS | 既存 targeted tests。通常 restore と別経路で確認 |
| external restore | PASS | 既存 targeted restore tests。managed と入力境界を混同しないことを確認 |
| worktree safety | PASS | 作業前後の `git status --short` を確認し、開始時から存在した dirty files は戻していない。作業中の最終 status には開始時に無かった documentation 9 paths も現れたが、この Worker はそれらを読取り・編集していない |
| diff sanity | PASS | `git diff --check` に問題なし |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U1 | 実ユーザー報告で、どの `backupId` を選択したか、表示された 1 件か、safety backup か、古い user backup か | 再現時の非機密 operation/catalog metadata または disposable と同じ A/B fixture |
| U2 | packaged GUI の Tauri lifecycle と WebView の実際の reload/read-back | 起動可能な隔離 packaged app または CI の disposable GUI harness |
| U3 | restore success response と `window.location.replace` の race が renderer 表示へ影響するか | WebView 側で operation result、runtime URL、再読込後の note query を時系列で観測 |
| U4 | safety backup を user-facing managed catalog に含めることが仕様か | MVP contract / 発注者の仕様判断 |

### Final worktree note

開始時 status に無かった次の documentation paths が最終 status で modified になっていた。共有 worktree の別作業による変更として保護し、この Worker は変更していない。

- `doc/implementation/IMPLEMENTATION_STATUS.md`
- `doc/implementation/MVP_CONTRACT.md`
- `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md`
- `doc/requirements/MVP_SYSTEM_SPEC.md`
- `doc/requirements/PRODUCT_SPEC.md`
- `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`
- `doc/technical/TARGET_ARCHITECTURE.md`
- `doc/testing/TEST_SCENARIOS.md`

## Next Read

- `summary/20260906/1533-investigate-managed-backup-restore-20260906.md`
- `HANDOFF_2026-08-31.md`
- `src/app/_components/settings/settings-modal.tsx`
- `src-tauri/src/lifecycle.rs`
- `src/server/infrastructure/desktop-storage.js`
