# Desktop Alpha Data and Backup 設計棚卸し

- 実施日: 2026-08-25
- 種別: Worker の read-only 設計・実装分解
- 対象: Desktop Alpha の Data and Backup（export、managed/external restore、pending restore、complete data deletion）
- 参照した正本: `doc/requirements/PRODUCT_SPEC.md`、`doc/requirements/MVP_SYSTEM_SPEC.md`、`doc/implementation/MVP_CONTRACT.md`、`doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md`、`doc/technical/TARGET_ARCHITECTURE.md`、`doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`、最新引き継ぎ `HANDOFF_2026-08-22.md`

## Objective

Data and Backup の storage / sidecar / API / bridge / UI の現在の責務境界を read-only で固定し、後続 Worker が追加質問なしで投入できる coding task と依存順、検証条件へ分解する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Desktop Alpha の manual SQLite export、managed/external restore、newer-schema pending restore、complete data deletion、および既存 MVP 境界との結合 |
| 対象ファイル / ディレクトリ | canonical requirements/contract、desktop storage/runtime/sidecar、既存 backup/API、Settings/bridge、Canvas validation、desktop/backup tests |
| 対象外 | コード実装、設定・依存関係・lockfile・既存文書・既存テストの変更、task file 作成、packaged artifact 生成、Git/外部サービス操作 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 要件 | `doc/requirements/PRODUCT_SPEC.md`、`doc/requirements/MVP_SYSTEM_SPEC.md` | Desktop Alpha の path、export、restore、pending、deletion 契約 |
| 実装契約 | `doc/implementation/MVP_CONTRACT.md`、`doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md` | 現行 Web `/backup` / API、§9.4、実装順、完了条件 |
| 技術設計 | `doc/technical/TARGET_ARCHITECTURE.md`、`doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md` | shell / sidecar / storage boundary、Application Support layout |
| 実装 | `src/server/infrastructure/desktop-storage.js`、`src-tauri/src/runtime.rs`、`src-tauri/src/main.rs`、`src-tauri/sidecar/launcher.cjs`、`src-tauri/src/update_recovery.rs` | 現行 command、protocol、bootstrap、safety/atomic/recovery pattern |
| Web / UI | `src/server/backup/**`、`src/app/api/backups/route.ts`、`src/app/_components/settings/settings-modal.tsx`、`src/shared/desktop/desktop-settings-bridge.ts` | 既存 backup/API/Settings shell/bridge の変更禁止境界 |
| 検証 | `test/desktop/**`、既存 backup/API contract tests、`src/shared/canvas/**`、`prisma/schema.prisma` | 現行 test contract、Canvas/Markdown/relation semantics |
| 引き継ぎ | `HANDOFF_2026-08-22.md` | Desktop Alpha の未実装・未検証項目と次の優先順 |

## Changes Made

この Worker が作成した成果物は本 summary だけである。コード、設定、依存関係、lockfile、既存テスト、既存設計書、fixture、DB、backup、ログは変更していない。Git commit、PR、外部サービス接続、外部データ送信も行っていない。最終 status では、別 Worker/並行作業由来とみられる `HANDOFF_2026-08-22.md` の変更と `summary/20260825/0824-reconcile-handoff-current-develop-20260825-6e43c552-summary.md` が検出されたが、いずれも本 Worker は変更せず保全した。

## Findings

## 結論

Application Support 配下の user data 境界、SQLite bootstrap、sidecar 起動、update 用の safety backup / staging / atomic switch / reopen パターン、Settings の shell と既存 Web backup はすでに存在する。一方、Data and Backup の業務操作を実行する Tauri command、sidecar command、OS file dialog、bridge、Settings UI は未実装である。

後続実装は、共通の native command / sidecar protocol 境界を先に定め、手動 export、managed/external restore、newer schema の pending restore、Settings UI、complete data deletion、最後の packaged 結合 QA の順に投入する。既存の `/backup`、`GET/POST /api/backups`、ノートの明示保存・物理削除・legacy Markdown・CanvasDocumentV1 は別契約として維持する。

## 現行の事実と責務境界

| 領域 | 現在実装・確認できたこと | Data and Backup でまだ必要なこと |
|---|---|---|
| user data path | `src/server/infrastructure/desktop-storage.js` が `~/Library/Application Support/com.cornellmethod.notebook/` と `live/`、`backups/`、`settings/`、`logs/`、`pending-restore/` を解決し、必要な directory を bootstrap する。`DATABASE_URL` は live SQLite の絶対 `file:` URL になる。 | 操作ごとの入力 path を canonical root の外へ不用意に広げない。external export は root の管理対象に取り込まず、ユーザー選択先として扱う。 |
| SQLite bootstrap / inspection | `inspectDesktopDatabase` に軽量 open と、integrity、migration history、required table、foreign key の検査がある。通常起動と abnormal/migration/restore 後の詳細検査を分ける既存方針もある。 | restore candidate に対する schema compatibility、required data、Canvas の完全な semantic validation、read-back/reopen を一つの restore pipeline にまとめる。 |
| update safety pattern | `desktop-storage.js` と `src-tauri/src/update_recovery.rs` に、candidate 単位の safety backup、staging、migration、検証、reopen、atomic rename、失敗時の live 維持/restore パターンがある。 | 既存 update 状態機械へ user restore を混ぜず、同じ safety invariant を Data and Backup 用の操作境界へ再利用する。 |
| Tauri runtime | `src-tauri/src/runtime.rs` は paths/bootstrap/staged-migrate/validate-database と `serve` 起動を扱い、`src-tauri/src/main.rs` の command 登録は update 系だけである。 | file dialog、export、restore、pending resume、deletion の typed command と、sidecar の停止・再起動/quiesce の責務を追加する。 |
| Node sidecar | `src-tauri/sidecar/launcher.cjs` は `paths`、`bootstrap`、`staged-migrate`、`validate-database`、`serve` の one-shot JSON protocol を持つ。serve は loopback の Next runtime を起動する。 | Data and Backup の one-shot operation と result/error envelope を追加する。renderer から DB path や任意 command を直接渡さない。 |
| Web backup | `src/server/backup/infrastructure/local-sqlite-backup-provider.js` は既存 Web 用の project-root `backup/`、最新 3 世代、SQLite copy/prune を担当する。 | この provider の restore、保存先、retention、API shape を Desktop 契約のために変更しない。Desktop の export/restore は別 adapter とする。 |
| Web API | `src/app/api/backups/route.ts` は `GET /api/backups`（最新 3 件）と body/query なしの `POST /api/backups`（手動 backup 作成）のみを提供する。 | route、レスポンス、`/backup` の画面を Data and Backup の新機能の API として拡張しない。Settings は既存 bridge と native/sidecar command を経由する。 |
| Settings shell / bridge | `settings-modal.tsx` は General/Updates/Data and Backup の 3 category、dialog/focus/Escape/keyboard、Updates bridge を持つ。Data and Backup は placeholder と `/backup` link のみ。`desktop-settings-bridge.ts` は update/event bridge のみ。 | export、managed restore、external restore、pending、deletion の状態・確認・エラーを bridge 越しに表示する。UI から fetch、filesystem、任意 Tauri invoke を直接行わない。 |
| document semantics | legacy Markdown は `Notebook.body` として保持し auto-convert しない。Canvas は `CanvasDocumentV1`、page/element geometry/style/text/order と `searchText` の契約を持ち、共有 validator と text extraction がある。 | restore candidate の全 Canvas を共有 validator で検証し、canonical text から `searchText` を再生成/照合する。legacy Markdown と relations を壊さない。 |
| OS dialog | 現在の `Cargo.toml`、capability、`main.rs` に file dialog の実装・allowlist は確認できない。 | native save/open dialog の導入方法、capability/dependency、cancel と path handoff を DAB-00 で固定する。これは product contract では未決の実装選択である。 |
| operation status | Data and Backup の実操作、newer schema pending、complete deletion、packaged runtime QA は未実装/未検証である。 | 下記 coding task と disposable fixture、contract test、packaged QA で段階的に受け入れる。 |

## 契約上の必須条件

### Export

- Settings からユーザーが選んだ外部保存先へ、手動の plaintext SQLite export を作る。
- live DB の一貫した snapshot を出力し、出力先への書き込みは途中状態を完成ファイルとして残さない。キャンセルや失敗は live DB を変更しない。
- external export は app-managed backup ではない。既存の app-managed retention/prune、暗号化、archive extension、provider 連携を追加で固定しない。

### Managed / external restore

- managed backup と external file は Settings 上で入口を分けるが、staging validation、明示確認、restore 前 live safety backup、atomic switch、restart/reopen の基盤は共通にする。
- candidate は Application Support 内の staging に隔離して検査する。schema/migration compatibility、SQLite integrity、foreign key、required data、全 CanvasDocumentV1 の semantic validity、legacy Markdown の保持、必要な read-back/reopen を通過しない限り live を変更しない。
- 旧 schema は staging 内で old-to-new migration を行う。新しい schema/format はエラーで live を壊さず `pending-restore` へ保持し、互換 update/restart 後にユーザーの明示確認で再開する。
- restore 前 safety backup の作成、sidecar/DB の quiesce、atomic file switch、switch 後の reopen が成立しない場合は fail closed とし、live DB の既存 bytes と起動可能性を守る。
- external file の元ファイルは読み取り元であり、restore 成功後も削除・移動・上書きしない。managed backup も成功確認前に破壊しない。

### Pending restore

- newer schema の候補を startup で自動適用しない。
- candidate は `pending-restore/` にコピーして保持し、互換 update/restart 後に Settings から明示的に resume/confirm する。
- pending の invalid、missing、複数候補、metadata 不整合は fail closed とし、live DB を変更しない。

### Complete data deletion

- ユーザーによる明示的な入力確認を要求する。cancel、文字列不一致、処理失敗では削除しない。
- 現行契約で明示されている対象は live DB とその SQLite sidecar files（`-wal`/`-shm`/`-journal` が存在する場合）、app-managed backups、settings である。
- ユーザーが選んだ外部 SQLite export は削除しない。uninstall/reinstall/update に削除を暗黙に結びつけない。
- 削除後は初回起動相当の bootstrap で再開できる必要がある。sidecar、DB connection、instance lock を解放してから対象を処理し、Application Support root や任意の親 directory への広範な recursive delete は行わない。

## 変更しない境界

- `/backup` と、既存 `GET /api/backups` / `POST /api/backups` の route、payload、最新 3 件の Web backup 挙動を変更しない。既存 backup provider の `backup/` と Desktop の `backups/` を混同しない。
- explicit save を維持する。Data and Backup 操作のために autosave、dirty note の暗黙保存、保存失敗時の dirty state 破棄を導入しない。
- note delete は引き続き確認後の physical delete。soft delete、Undo、restore を note-level 機能として追加しない。
- legacy Markdown を Canvas に自動変換しない。Notebook/Cue/Tag relation、CanvasDocumentV1 の geometry/style/text/order/search semantics を保存する。
- 未承認の retention policy、archive extension、暗号化、外部 backup provider、network/shared deployment、Phase 2 の autosave/soft delete/NoteCard/D&D/PDF export を新たに固定しない。

## 事実・既存契約・推奨・未決事項

| 分類 | 内容 |
|---|---|
| 事実 | canonical Application Support root と live/backups/settings/logs/pending-restore の path boundary、absolute `DATABASE_URL`、sidecar JSON protocol の既存型、update 用の safety/atomic/reopen パターンがある。 |
| 事実 | Tauri の現行 command と launcher に Data and Backup の operation はなく、Settings は placeholder のままで、OS file dialog の dependency/capability もない。 |
| 既存契約 | export は plaintext のユーザー選択先、managed/external restore は別入口、同一の staging/validation/confirmation/atomic/restart pipeline、newer schema は pending、deletion は live DB/app-managed backups/settings のみ、external export は保持する。 |
| 推奨 | DAB-00 で既存 `launcher_command` の one-shot JSON response 形式を拡張し、`ok/status/errorCode` と machine-readable validation phase を返す。DB path、home path、任意 filesystem path を renderer の公開 API にしない。 |
| 推奨 | export は live runtime の raw file copy だけに依存せず、SQLite の consistent backup mechanism（現行 Node dependency で利用できる機構）を使い、temp file → fsync/検証 → atomic rename の順にする。具体 API は coding task の実装時に dependency の既存利用を確認する。 |
| 推奨 | restore/delete の共通 quiesce は update の `UpdateStateStore` に新しい user-operation phase を足すのではなく、sidecar lifecycle と DB connection を閉じる小さい runtime boundary として設計する。 |
| 未決 | exact Settings copy/layout、確認ダイアログの文言、file extension/filter、既存外部ファイルがある場合の overwrite policy、progress 表示は product contract で固定されていない。UI task で最小案を実装し、受け入れ時に確認する。 |
| 未決 | `pending-restore/` と `logs/` を complete deletion の対象へ含めるかは、明示された live DB/app-managed backups/settings の列挙からは決めない。coding task では勝手に拡張せず、必要なら発注者の仕様判断を別に残す。 |
| 未決 | app-managed backup の新機能側 retention、pending の複数候補や manifest の詳細、暗号化/圧縮の将来仕様は固定しない。既存 Web の最新 3 件は別契約である。 |
| 未確認 | packaged runtime の実機 file dialog、sidecar stop/restart、Application Support 実 path、atomic switch、reopen、更新後 pending resume は、npm registry DNS blocker により build artifact が未生成で、まだ runtime QA できていない。 |

## 後続 coding task 分解

Queue は repository の運用に合わせて `codex-queue/tasks-ui`、`codex-queue/tasks-api`、`codex-queue/tasks` を示す。以下は task file を今回作成せず、Manager が後続投入するための粒度である。

### DAB-00: native dialog / sidecar operation boundary

- Queue: Common（`codex-queue/tasks`）
- 目的: OS file dialog と Tauri → launcher の typed operation boundary だけを追加し、export/restore/delete の業務処理は実装しない。
- 対象領域: `src-tauri/src/main.rs`、`src-tauri/src/runtime.rs`、`src-tauri/sidecar/launcher.cjs`、`src/shared/desktop/desktop-settings-bridge.ts`、必要な `src-tauri/capabilities/default.json` / `src-tauri/Cargo.toml`、`test/desktop/**`。既存 update command/protocol は互換維持。
- 先行依存: なし。既存の `StorageLayout`、`launcher_command`、one-shot JSON protocol を先に読む。
- 完了条件: save/open dialog の cancel/result/error が typed に返る。renderer に arbitrary absolute path や DB path を渡さない。managed source は app-managed identifier/file record、external source は native dialog result として受ける。launcher は既存同様に stdout の JSON response を返し、unknown command・相対 path・canonical root 外の管理 path を fail closed にする。新しい public Web API は作らない。
- 検証: temp home の path/allowlist contract test、dialog cancel と malformed response の unit/static test、existing update/lifecycle/bridge tests、可能なら disposable packaged smoke で command の start/stop を確認する。実ユーザーの Application Support は触らない。

### DAB-01: manual SQLite export

- Queue: API（`codex-queue/tasks-api`）
- 目的: Settings から選択した外部保存先への manual plaintext SQLite export を実装する。
- 対象領域: Desktop storage/backup の新しい application service または sidecar command、`src-tauri/src/runtime.rs` / `main.rs` の command adapter、`src-tauri/sidecar/launcher.cjs`、shared bridge、`test/desktop/**` と disposable storage fixture。`src/server/backup/**`、`src/app/api/backups/route.ts`、`/backup` は変更しない。
- 先行依存: DAB-00。既存 live DB path/bootstrap と runtime lifecycle を利用する。
- 完了条件: cancel は no-op、destination はユーザー選択先、output は plaintext SQLite、snapshot は一貫している。temp output に作成して integrity/read-back 検証後に atomic rename し、失敗時は未完成の destination を完成ファイルとして残さない。export は `backups/` に入れず、既存 retention/prune/encryption/archive を適用しない。source live DB、legacy Markdown、Canvas、relations を変更しない。
- 検証: disposable SQLite に Notebook/Cue/Tag、legacy Markdown、valid Canvas、WAL/sidecar がある fixture を作り、export の integrity、row/byte semantics、source 不変、外部ファイルの存在を確認する。保存先 collision、権限失敗、cancel、途中失敗を contract test する。packaged QA では native save dialog と再起動後の export を確認する。

### DAB-02: managed / external restore pipeline

- Queue: API（`codex-queue/tasks-api`）
- 目的: managed backup と external SQLite file の両方を、共通の staging validation → explicit confirmation → safety backup → atomic switch → restart/reopen pipeline で復元する。
- 対象領域: Desktop restore application service、`desktop-storage.js` の共有 validation/path helper、`src-tauri/src/runtime.rs` / `main.rs`、`launcher.cjs`、shared bridge の operation contract、`test/desktop/**` と storage/restore disposable fixture。既存 update recovery の invariant を参照し、update state machine へ user restore を混ぜない。
- 先行依存: DAB-00。DAB-01 の export fixtureを入力にできると end-to-end 検証が容易だが、restore は既存 managed backup/external fixtureでもテスト可能。
- 完了条件: managed と external は UI 入口を分けるが検証・switch は共通。入力を staging にコピーし、regular file/path boundary、schema/migration compatibility、`PRAGMA integrity_check`、foreign key、required table/data、全 CanvasDocumentV1 の共有 semantic validator、canonical `searchText`、legacy Markdown と relations を検証する。旧 schema は staging 内で migrate、新しい schema は live を触らず pending classification にする。switch 前に live safety backup、sidecar/DB quiesce、same-filesystem temp、atomic rename/fsync、switch 後 read-back/reopen を行い、各 failure path は live bytes/起動可能性を維持する。external original と managed source は破壊しない。
- 検証: disposable candidate（valid、corrupt、schema incompatible、old migratable、newer、FK violation、invalid Canvas、searchText mismatch、legacy Markdown）を用意する。失敗前後の live DB bytes、safety backup、managed source、external source、temp cleanup を確認し、process interruption/rename failure を注入できる範囲で fail-closed を確認する。existing `/backup` API/route tests と note save/delete tests が無変更で通ることも確認する。packaged QA は sidecar停止、atomic switch、再起動、read-back を実機で行う。

### DAB-03: newer-schema pending restore / resume

- Queue: Common（`codex-queue/tasks`）
- 目的: DAB-02 が newer schema と判定した candidate を `pending-restore/` に保持し、互換 update/restart 後に明示確認で同じ restore pipeline を再開する。
- 対象領域: pending file/manifest/status の storage helper、`runtime.rs` / `main.rs` / `launcher.cjs` の startup/resume boundary、shared bridge の pending status/confirm、`test/desktop/**`。既存 update recovery は壊さず、pending は update safety backup と別状態として扱う。
- 先行依存: DAB-02 の validation result と restore service。DAB-00 の command envelope。
- 完了条件: newer candidate を atomic に `pending-restore/` へ隔離し、startup が自動適用しない。互換 update/restart 後に Settings が pending を表示し、ユーザーの explicit confirm の後だけ DAB-02 の validation/safety/switch/reopen を呼ぶ。invalid/missing/multiple/manifest mismatch は live を変更せず fail closed。original external file と managed backup は保持する。
- 検証: old/current/newer schema disposable fixture、restart/update simulation、pending copy interruption、invalid manifest、cancel/no-confirm を確認する。pending が存在しても通常 startup と既存 `/backup` が動くこと、confirm 前後の live bytes を確認する。packaged QA は build artifact で update/restart を跨いだ pending resume を確認する。

### DAB-04: Settings Data and Backup UI

- Queue: UI（`codex-queue/tasks-ui`）
- 目的: 既存 Settings modal の Data and Backup placeholder を、bridge 経由の export、managed restore、external restore、pending 状態/確認 UI に置き換える。
- 対象領域: `src/app/_components/settings/settings-modal.tsx`、`src/shared/desktop/desktop-settings-bridge.ts`、必要な shared types、`test/desktop/desktop-settings-ui.test.js`、`desktop-settings-bridge.test.js`、shell/browser test。新しい Web route/API、renderer filesystem access、別 primary window は追加しない。
- 先行依存: DAB-01、DAB-02、DAB-03 の stable command/bridge contract。既存 Settings shell、focus trap、Escape、keyboard、Updates panel の挙動を維持する。
- 完了条件: export、managed backup 選択、external file 選択、pending resume/confirm、loading/error/cancel/成功状態を明示する。restore と deletion の前には個別に確認し、未保存 note を暗黙保存・破棄しない。既存 `/backup` link は replacement acceptance まで残す。UI は bridge の fake implementation でテストでき、直接 `fetch`/filesystem/任意 `invoke` を行わない。exact copy/layout は既存 3-category shell に沿った最小実装とし、未承認の retention/暗号化設定を表示しない。
- 検証: static UI contract、keyboard/focus/accessibility、dialog cancel、pending confirmation、error/retry、dirty note boundary を unit/browser test する。existing `/backup` navigation と update settings test が通ることを確認し、packaged QA で native dialog と sidecar result を結合する。

### DAB-05: complete data deletion

- Queue: Common（`codex-queue/tasks`）
- 目的: explicit confirmation 後に、契約で指定された app data だけを完全削除し、初回 bootstrap 可能な状態へ戻す。
- 対象領域: deletion application service、`desktop-storage.js` の canonical target/path validation、Tauri/sidecar command、Settings の deletion confirmation/error UI、`test/desktop/**` と disposable deletion fixture。DAB-02 の quiesce/atomic safety boundary を再利用する。
- 先行依存: DAB-00、DAB-02 の runtime quiesce、DAB-04 の Settings operation UX。DAB-03 の pending implementationを削除対象へ暗黙に含めない。
- 完了条件: input confirmation の不一致/cancel では no-op。sidecar、DB connection、instance lock を安全に解放した後、live DB と `-wal`/`-shm`/`-journal`、app-managed `backups/`、settings を canonical root 内だけで削除する。external export、通常の Web `backup/`、任意のユーザー選択 file、uninstall/reinstall/update は対象外。途中失敗は広範な recursive delete をせず明示的に報告し、削除後は clean bootstrap/startup と Settings 初期状態を確認する。`pending-restore/`/`logs/` を含めるかは別途決定するまで固定しない。
- 検証: temp root に対象/非対象ファイル、SQLite sidecar、symlink、外部 export、Web `backup/` を用意する。confirm/cancel、wrong input、permission/lock failure、再起動後 bootstrap、external export survival、対象外 path 不変、二重実行を contract test する。packaged QA で running sidecar/lock を含む確認、削除後の再起動と新規保存を行う。

### DAB-06: final packaged Data and Backup contract QA

- Queue: Common（`codex-queue/tasks`）
- 目的: Desktop Alpha の Data and Backup と既存 MVP 境界を packaged runtime で一括受け入れする。
- 対象領域: `test/desktop/**` の packaged/runtime QA、disposable Application Support fixture、build/launch/restart harness。製品コードの追加仕様はこの task で行わない。
- 先行依存: DAB-00〜DAB-05 全完了、packaged build artifact の生成可能化。
- 完了条件: path/bootstrap、native dialog、export、managed/external restore、invalid/old/newer/pending、safety backup、integrity/FK/schema/Canvas/Markdown/relation validation、atomic switch、sidecar lifecycle、reopen、explicit deletion、external export survival を確認する。同時に `/backup`、`GET/POST /api/backups`、explicit save、note physical delete、legacy Markdown、CanvasDocumentV1 の既存 acceptance を再確認する。未検証の build/runtime を PASS と報告しない。
- 検証: macOS packaged `.app` の disposable user data directory だけを使う。通常テスト、lint、可能なら build、実機 restart/update scenario を分けて記録する。現在の npm registry DNS blocker が残る場合、source/static/disposable test は PASS とし、packaged runtime は BLOCKED/未検証として分離する。

## 推奨依存順

```text
DAB-00 native boundary
        ↓
DAB-01 manual export
        ↓
DAB-02 managed/external restore
        ↓
DAB-03 pending restore/resume
        ↓
DAB-04 Settings UI
        ↓
DAB-05 complete data deletion
        ↓
DAB-06 final packaged QA
```

DAB-01 と DAB-02 の backend を先に完了させ、DAB-03 で newer schema を閉じ、その安定した contract を DAB-04 が消費する。削除は共有 quiesce と確認 UX が揃った後に実装し、最後に packaged runtime と既存 MVP 境界を結合確認する。各 task は上記の目的以外の retention、archive、暗号化、provider、autosave、soft delete を含めない。

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-01 | Settings の exact copy/layout、confirmation wording、file extension/filter、destination overwrite policy、progress 表示 | DAB-04 の UI acceptance と発注者の確認 |
| U-02 | `pending-restore/` と `logs/` を complete deletion に含めるか | 明示された deletion target 以外を含める仕様判断 |
| U-03 | pending の複数候補、manifest/status の詳細、app-managed backup の新機能側 retention | DAB-02/DAB-03 の contract review。未承認の policy は追加しない |
| U-04 | native dialog の具体 dependency/capability と packaged runtime の実機挙動 | DAB-00 の implementation と packaged macOS QA |
| U-05 | npm registry DNS blocker 解消後の packaged artifact、sidecar stop/restart、atomic switch、reopen、pending resume | DAB-06 の runtime evidence |

## Verification

- 作業前の `git status --short --untracked-files=all` は clean だった。
- 作業後の `git status --short --untracked-files=all` には、本 summary に加えて上記 handoff 変更と別 summary が出力された。本 Worker の成果物と混同せず、ユーザーの変更を戻していない。
- 仕様、実装、既存テストを read-only で照合した。実ユーザーデータの Application Support、正式な backup、fixture、ログには書き込んでいない。
- `git diff --check` は PASS。
- 既存の backup / desktop storage / Settings / bridge / Node runtime 関連 test 88 件は PASS（`node --test` の選択実行）。
- summary checker は標準見出し追加後に再実行する。
- packaged runtime build/QA は、既知の npm registry DNS blocker によりこの棚卸しでは実施しない。これを source contract の未確認事項と混同しない。

## Next Read

1. `summary/20260825/0830-desktop-data-backup-design-audit.md`
2. `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md` §6.5、§6.6、§7、§8
3. `doc/technical/TARGET_ARCHITECTURE.md` の user data / backup / restore 境界
4. 次の coding task では DAB-00 の対象だけを再確認し、DAB-01 以降を先読みして scope を広げない。
