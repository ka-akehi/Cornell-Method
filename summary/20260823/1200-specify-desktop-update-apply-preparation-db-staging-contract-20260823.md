---
summary_type: task-summary
created_at: 2026-08-23 12:00 JST
task_kind: worker-task
task_status: done
---

## Objective

Desktop Alpha の explicit verification (`Available + Verified`) の後段について、現行の Tauri / Node sidecar / Prisma / SQLite / Application Support の実装事実を起点に、apply preparation と DB staging の実装契約を一つに固定する。

対象は、fresh revalidation、sidecar の quiesce、pending migration の検出、必要な safety backup、隔離 staging DB、migration、integrity / reopen / health、state lifecycle、失敗時の非破壊性、後続 Worker task の分割である。

actual app bundle replacement、live DB の切り替え、restart、post-restart health check、rollback の実装は後続 task に残す。

## Scope

コード、設定、依存関係、lockfile、既存仕様書本文、生成物、live DB、実 backup、外部 export、実 package、実 app bundle、GitHub / 外部ネットワークは変更・使用していない。成果物はこの summary のみである。

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-22.md` | MVP Gate 0、Desktop Alpha の現行実装境界、更新 / migration safety 未実装部分 |
| canonical requirements | `doc/requirements/PRODUCT_SPEC.md` | 製品境界、Desktop Alpha の DB / backup / update 方針。app-managed backup の「最新 3 世代」と、他文書の retention 未決定の不整合も確認 |
| MVP contract | `doc/implementation/MVP_CONTRACT.md` | route / API / explicit save / CanvasDocumentV1 / legacy Markdown / backup-delete 契約と Desktop Alpha の live DB 境界 |
| post-MVP plan | `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md` | pending migration のみ safety backup、staging migration、migration 順序、外部 export 分離、startup failure 方針 |
| implementation status | `doc/implementation/IMPLEMENTATION_STATUS.md` | 現行実装状況と未実装領域 |
| desktop foundation | `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md` | Application Support layout、Tauri / sidecar / adapter の責務、DB と backup の保存境界 |
| test contract | `doc/testing/TEST_SCENARIOS.md` | Desktop runtime / DB / update の検証観点 |
| runtime | `src-tauri/src/runtime.rs`、`src-tauri/src/main.rs`、`src-tauri/src/lifecycle.rs` | bootstrap message、sidecar 起動環境、process group、ready check、close 時の停止、現在の update command |
| update implementation | `src-tauri/src/update_state.rs`、`update_verification.rs`、`update_archive.rs`、`update_bundle.rs`、`update_download.rs`、`update_signature.rs` | state v2、phase、atomic state write、fresh manifest / package / Ed25519 / archive / bundle verification、staging path と sanitized code |
| Node storage | `src/server/infrastructure/desktop-storage.js`、`.d.ts`、`src-tauri/sidecar/launcher.cjs` | Application Support 解決、migration manifest、read-only DB inspection、初回 migration、sidecar の `DATABASE_URL` 境界 |
| Prisma / SQLite | `prisma/schema.prisma`、`prisma.config.ts`、`src/server/infrastructure/prisma.ts`、`config/project-env.js`、`prisma/migrations/*/migration.sql` | provider、database URL、migration file、schema history、既存の migration 実行主体 |
| current manual backup | `src/server/backup/infrastructure/local-sqlite-backup-provider.js`、`src/server/backup/application/*`、`src/app/api/backups/route.ts`、`scripts/backup-copy.js` | 現行 Web MVP の project-root `backup/`、単純 file copy、最新 3 世代、外部 export と将来の app-managed safety backup の違い |
| related tests | `test/desktop/desktop-storage.test.js`、`test/desktop/desktop-update-state.test.js`、`test/desktop/desktop-update-verification.test.js`、`test/backup/local-sqlite-backup-provider.test.js`、`test/e2e-cleanup-contract.test.js`、`scripts/generate-sqlite-fixture.js`、`scripts/dev-sqlite-fixture.js` | disposable DB、migration failure、state privacy、package cache cleanup、SQLite sidecar cleanup の既存観点 |
| prior summaries | `summary/20260823/0518-specify-desktop-update-state-lifecycle-contract.md`、`0525-specify-desktop-update-state-verification-contract-20260823-a6fd312b-summary.md`、`0830-implement-desktop-update-state-v2-migration-20260823-f8872c7d-summary.md`、`0312-specify-desktop-update-signature-contract.md`、`0324-specify-desktop-update-signature-contract-20260823-b44097e1-summary.md`、`0451-implement-desktop-update-archive-extraction-20260823-96fed217-summary.md`、`0913-implement-desktop-update-verification-coordinator-20260823-58baedfb-summary.md` | state、Ed25519 trust store、safe archive、bundle、verification coordinator の既存契約と未実装境界 |

## Changes Made

| パス | 変更内容 |
|---|---|
| `summary/20260823/1200-specify-desktop-update-apply-preparation-db-staging-contract-20260823.md` | 現行調査、fact / assumption / unknown、推奨 apply preparation / DB staging 契約、state lifecycle、failure matrix、後続 Worker task、検証方法を記録 |
| 製品コード、設定、依存関係、lockfile、既存仕様書、生成物 | 変更なし |

## Findings

### 1. 結論: 推奨する一つの契約

次の境界を採用する。

1. `Available + Verified` は「package / archive / bundle の verification が済んだ候補」であり、apply preparation の証明ではない。`verifiedAt` や persisted marker だけを信頼しない。
2. apply preparation 開始時に、manifest selection、candidate identity、trust store、package bytes、Ed25519 proof、archive、bundle、target runtime resources を全て fresh revalidation する。候補が変わったら DB / backup に触れずに停止する。
3. DB に触れる直前に、ユーザーの未保存内容の扱いを完了させ、Tauri が Node sidecar を process group 単位で停止して SQLite writer を quiesce する。stop が timeout / forced kill になった場合は DB copy を始めない。
4. live DB の `PRAGMA` や schema を更新するのではなく、SQLite-native online backup 相当で Application Support 内の一時 file へ snapshot を作る。現行依存の Node `better-sqlite3` の backup API を第一候補とし、新しい Rust SQLite dependency や shell command は追加しない。実装は disposable fixture で API と packaged resource の成立を確認する。
5. live DB の migration history を read-only で判定する。完全な migration prefix に既知の pending migration がある場合だけ app-managed safety backup を publish し、staging copy に対して candidate app bundle の Prisma migration を古い順に実行する。pending migration がなければ backup、staging copy、migration を実行しない。
6. staging migration 後に `integrity_check`、`foreign_key_check`、migration history / checksum / required table、close、同じ SQLite / Prisma adapter による reopen、最小 `SELECT 1` 相当を確認する。note 本文、Cue、Canvas JSON、全件 dump、件数を成功条件に使わない。
7. preparation 成功時は sidecar を停止したまま、actual apply に `PreparedApplyHandoff` を in-memory で渡す。handoff は candidate identity、canonical relative package / app path、必要なら canonical relative staged DB path、backup identity を持つ。live DB、app bundle、backup はこの段階では変更しない。
8. stale staged DB を避けるため、preparation を独立した「準備済みで待機する」公開操作にはしない。actual apply task は同じ update operation の次の処理として直ちに handoff を消費する。後続 task が process 境界をまたぐ handoff を必要とする場合だけ、別途 state v2 の optional allowlist を追加し、同じ fresh revalidation と explicit apply を要求する。
9. preparation の migration / backup / staging / reopen に失敗したら、current app bundle、live DB、既存 app-managed backups は変更しない。失敗前に作成済みの safety backup は削除せず、DB staging の temp / 未コミット copy だけを exact path で cleanup する。package staging の cleanup と DB staging / backup の cleanup は別実装にする。
10. process interruption / restart は state を `Failed` として回復するだけで、自動 app switch、live DB migration、restart、rollback を行わない。

### 2. 現行実装の fact

#### 2.1 runtime、database URL、sidecar

現行の実行経路は次のとおりである。

```text
Tauri main
  -> runtime_project_root()
  -> Node launcher.cjs bootstrap
  -> desktop-storage.js bootstrapDesktopStorage()
  -> JSON bootstrap message
  -> Tauri が StorageLayout を保持
  -> launcher.cjs serve
  -> Next.js production runtime
  -> PrismaBetterSqlite3
  -> Application Support/live/notebook.sqlite
```

| 項目 | 現行 fact |
|---|---|
| live DB | `~/Library/Application Support/com.cornellmethod.notebook/live/notebook.sqlite` |
| database URL | `file:<absolute live DB path>`。query / fragment / authority / relative path を拒否し、`databasePath` と一致することを Rust 側で確認 |
| bootstrap の環境 | `CORNELL_DESKTOP_PROJECT_ROOT`、`PRISMA_PROVIDER=sqlite`。Node bootstrap は `CORNELL_DESKTOP_HOME` または `os.homedir()`、repository の `prisma/migrations`、`prisma.config.ts`、Prisma binary を解決 |
| bootstrap の返却 | `applicationSupportRoot`、`liveDirectory`、`databasePath`、`databaseUrl`、`backupsDirectory`、`settingsDirectory`、`logsDirectory`、`pendingRestoreDirectory`、status / reason / created を JSON で Tauri へ返す |
| sidecar の環境 | `CORNELL_DESKTOP_APPLICATION_SUPPORT_ROOT`、`..._LIVE_DIRECTORY`、`..._DATABASE_PATH`、`..._DATABASE_URL`、`..._BACKUPS_DIRECTORY`、`..._SETTINGS_DIRECTORY`、`..._LOGS_DIRECTORY`、`..._PENDING_RESTORE_DIRECTORY`、`DATABASE_URL`、`PRISMA_PROVIDER=sqlite`、`NODE_ENV=production` |
| WebView 境界 | WebView は SQLite path を受け取らず、既存 HTTP API を使用する。画面から SQLite file を直接操作しない |
| sidecar stop | Tauri は launcher の process group を SIGTERM、bounded wait、必要なら SIGKILL で停止できる。DB close / flush の完了を確認する専用 handshake や restart method はまだない |
| readiness | launcher の dynamic loopback `/notes` HTTP ready と Tauri 側の host / port / runtime PID 検証がある。DB migration 後の専用 reopen / health coordinator はない |

`src-tauri/tauri.conf.json` は candidate app bundle の Resources に `.next`、`node_modules`、`prisma`、`prisma.config.ts`、`desktop-storage.js` などを `runtime/` として配置する設定を持つ。したがって staging migration は、current app の repository root や current app の migration を暗黙に使わず、freshly validated candidate bundle の `Contents/Resources/runtime/` を migration source / Prisma runner として使う。

#### 2.2 Prisma / migration / schema version

現行の migration は次の 4 件で、`readMigrationManifest()` が directory name の lexical order と migration.sql の SHA-256 checksum を作る。

```text
20260621073258_init
20260718011243_remove_notebook_overview
20260718140000_add_notebook_canvas
20260809090000_add_notebook_tag_order
```

現行コードに DB の独立した integer schema version はない。schema version の判定は、read-only inspection による次の情報の組み合わせである。

- `_prisma_migrations` の存在と required columns
- applied migration name の重複、未知名、順序 gap
- migration.sql checksum
- `finished_at` / `rolled_back_at` / `applied_steps_count`
- required tables (`notebooks`、`notebook_canvases`、`tags`、`notebook_tags`、`cues`)
- `PRAGMA integrity_check`
- `PRAGMA foreign_key_check`

現行 `inspectDesktopDatabase()` は、完全な prefix より短い history を `migration-required / missing`、未完了 row を `migration-required / incomplete` と分類し、未知 migration、順序 gap、checksum mismatch、required table 欠落、integrity / FK failure を `unusable` に分類する。`migration deploy` を既存 DB に自動実行しない。

初回だけは、missing path を `openSync(..., "wx")` で claim した空の新規 file に対して、Node `applyInitialMigrations()` が `prisma migrate deploy --config <absolute prisma.config.ts>` を `DATABASE_URL=file:<absolute path>` で実行する。existing DB、missing migration、incomplete migration、corrupt DB を bootstrap が repair する機構はない。既存 DB が ready でない場合、launcher は `ready` を返さず sidecar 起動を止める。

#### 2.3 現行 backup と将来 backup の境界

| 種別 | 現行 / 推奨 path | 目的 | update cleanup の扱い |
|---|---|---|---|
| live DB | Application Support `live/notebook.sqlite` | ノートデータの唯一の正本 | apply preparation は直接変更・rename・delete しない |
| app-managed safety backup | Application Support `backups/` | pending migration 前（将来 restore 前も別契約）の保全 | 作成済みなら preparation failure でも保持。世代数を prune しない |
| 現行 MVP manual backup | repository root の `backup/`、`DATABASE_URL` の source を単純 copy | 開発 Web の `/backup` / API の手動 backup。timestamp file を最新 3 件に prune | Desktop app-managed backup と同一視しない。apply cleanup から除外 |
| user-selected external SQLite export | Application Support 外のユーザー指定 path（将来の Desktop export） | ユーザーが保存・持ち出す平文 export | update verification / apply / cleanup から除外。削除・prune しない |
| package staging | Application Support `staging/incoming`、`packages`、`extract` | verified package / extracted app tree | package task の exact temp cleanup のみ。DB / backup を触らない |
| DB staging | 推奨 `staging/db/<sha256>/notebook.sqlite` | candidate migration を検証する一時 DB | DB task の operation-owned cleanup のみ。package cleanup と分離 |

現行 manual provider は `fs.copyFileSync()` で main DB file だけを temporary directory へ copy し、hard link で project-root `backup/` に publish する。`MAX_BACKUPS=3`、symlink / path boundary / collision のテストはあるが、SQLite online backup、WAL checkpoint、sidecar close、Application Support `backups/` は扱わない。この provider を future safety backup にそのまま再利用してはならない。

Tauri sidecar 起動時には `CORNELL_DESKTOP_BACKUPS_DIRECTORY` も渡しているが、現行 manual provider はその環境変数を保存先として読まず、`projectRoot/backup` を解決する。したがって env が存在することだけを根拠に Desktop app-managed backup が接続済みだと判断してはならない。

#### 2.4 update state / verification の現行境界

現行 state は schema v2、status `not-checked | checking | no-update | available | failed`、phase `manifest-check | package-verification | apply-preparation | restart-health-check | rollback` を持つ。`Available + Verified` の `PendingUpdate` は version / channel / architecture / artifact、size、sha256、keyId、verified package path、extracted app path、verification time を保持する。

既存の canonical path は次である。

```text
packages/<sha256>.app.tar.gz
extract/<sha256>/Cornell Method Notebook.app
```

これは Application Support の `staging/` を base に解決する契約として扱う。現行 state loader の symlink component validation は `settings_directory` を base に呼び出されているため、実際の staging root を保護する十分条件ではない。apply task は state loader の検査だけを信頼せず、`StorageLayout.staging_directory()` を base に no-follow、canonical relative path、regular file / directory を再検査する。

`update_verification.rs` は、fresh manifest selection、candidate identity 比較、cache / download、size / SHA-256、Ed25519 trust store、safe archive extraction、bundle identity / version / thin arm64 validation を行い、最後に `Available + Verified` へ atomic transition する。DB、backup、sidecar stop、live DB switch、restart、rollback には触れない。

現行 state の `Failed` は pending candidate を持たず、UI snapshot は package path、absolute path、size / digest / key / proof などの persistence metadata を出さない。この性質を apply preparation でも維持する。

### 3. fact / assumption / unknown

#### 3.1 Fact

| ID | 内容 | 根拠 |
|---|---|---|
| F-001 | live DB の正本は Application Support `live/notebook.sqlite` で、app bundle 内 DB は使わない | foundation、runtime、desktop-storage |
| F-002 | sidecar は absolute `DATABASE_URL` を環境変数で受け取る。bootstrap JSON は Tauri が storage layout を確認するための message であり、DB path を WebView へ渡す bootstrap message ではない | `runtime.rs`、`launcher.cjs` |
| F-003 | normal startup は既存 DB の migration / repair を行わず、ready でない DB なら sidecar 起動を止める | `desktop-storage.js`、`launcher.cjs`、storage tests |
| F-004 | schema 判定は Prisma migration history、migration checksum、required tables、integrity / FK check の組み合わせで、独立 schema integer ではない | `desktop-storage.js`、`prisma/migrations` |
| F-005 | current app の migration actor は初回空 DB に限る `prisma migrate deploy`。staging migration actor はまだない | `desktop-storage.js`、`prisma.config.ts` |
| F-006 | production source に `journal_mode=WAL`、`wal_checkpoint`、`busy_timeout`、lock flush の明示設定は見つからない | `rg` による source 調査 |
| F-007 | fixture script は disposable DB で `journal_mode=DELETE` を設定するが、production runtime が常に DELETE mode だという証明ではない。fixture cleanup は `-journal`、`-wal`、`-shm` を対象にする | `scripts/generate-sqlite-fixture.js`、`scripts/dev-sqlite-fixture.js` |
| F-008 | current manual backup は project-root `backup/`、main file copy、latest 3 generations であり、Application Support app-managed safety backup ではない | `local-sqlite-backup-provider.js`、MVP backup tests |
| F-009 | app-managed `backups/` directory は Desktop storage bootstrap が作るが、そこへ migration-before safety backup を作る実装はまだない | `desktop-storage.js`、`runtime.rs` |
| F-010 | trusted key table は compile-time table で、current implementation の production key table は空。verification は current / next を受け、retired / revoked を拒否する設計である | `update_signature.rs`、signature summary |
| F-011 | archive は gzip POSIX tar、`.app.tar.gz`、safe extraction、atomic extracted tree rename、no-follow path を実装済み。bundle validator は identifier / version / executable / thin arm64 と Mach-O tree を確認する | `update_archive.rs`、`update_bundle.rs` |
| F-012 | Tauri resource config は candidate app bundle に Prisma migrations、Prisma binary、Node modules、Next runtime を `Contents/Resources/runtime/` として置く想定を持つが、実 app bundle での read-back は未実施 | `src-tauri/tauri.conf.json`、bundle task の境界 |
| F-013 | state v2 に `applyPreparation` や staged DB path / backup identity の field はまだない。`ApplyPreparation` phase と interruption mapping (`update-interrupted`) だけが先に存在する | `update_state.rs` |
| F-014 | current lifecycle は close 時の sidecar stop を持つが、update 用 quiesce / resume / DB close acknowledgment はない | `lifecycle.rs`、`runtime.rs` |
| F-015 | update verification の package / extracted tree cache は failure の種類によって保持され、`.part` / extraction temp の exact cleanup と immutable package/tree の保持は分離されている | `update_verification.rs`、verification summary |
| F-016 | storage bootstrap が作成するのは root、live、backups、settings、logs、pending-restore。`staging/` は `StorageLayout::staging_directory()` で解決され、package download / archive extraction が必要時に作成する | `desktop-storage.js`、`runtime.rs`、`update_download.rs`、`update_archive.rs` |
| F-017 | Tauri が `CORNELL_DESKTOP_BACKUPS_DIRECTORY` を sidecar に渡しても、現行 Web backup provider の保存先は project-root `backup/` のままである | `runtime.rs`、`local-sqlite-backup-provider.js` |

#### 3.2 Assumption / recommended decision

| ID | 推奨として固定する内容 | 理由 |
|---|---|---|
| A-001 | sidecar 停止後も、main DB の raw file copy ではなく SQLite-native online backup を第一方式とする | WAL / journal mode が production で固定されておらず、main file だけの copy は証明条件が厳しいため |
| A-002 | source / destination を同じ Application Support volume 上で native backup し、temp file、fsync 相当、no-overwrite atomic rename、read-back validation の順で publish する | backup / staging file を部分状態で final name にしないため |
| A-003 | target migration は current repository ではなく fresh candidate bundle の `Contents/Resources/runtime/prisma/migrations` と `.../node_modules/.bin/prisma` を使う | 新 app の DB schema を current app の migration と取り違えないため |
| A-004 | `MIGRATION_REQUIRED/MISSING` のうち、完全な applied prefix と既知の pending suffix だけを eligible とする。`INCOMPLETE`、unknown、gap、duplicate、checksum mismatch、newer schema は repair せず fail closed | 現行 startup が incomplete / unusable DB を repair しないため。Prisma の failed migration repair semantics を推測しないため |
| A-005 | preparation 成功は stable state へ保存せず、sidecar quiesced のまま同一 update operation の actual apply task に typed in-memory handoff する | preparation 後に live DB が編集されると staged DB が stale になり、後で live DB を置き換えた際に保存内容を失うため |
| A-006 | state v2 の version number、`UpdateStateSnapshot` allowlist、`Failed` は pending を持たない invariant をこの task では変更しない | actual apply / restart / rollback が必要とする process-boundary handoff は後続 task の責務であり、DB path を state に長期保存しないため |
| A-007 | pending migration がある場合の safety backup は作成後に prune しない。retention 世代数は別途決定する | current docs の retention 未決定を保ち、`MAX_BACKUPS=3` を将来 app-managed backup に誤適用しないため |
| A-008 | app-managed file は no-follow、canonical relative path、regular file / directory、current-user-only permission を満たすことを要求する。具体的な chmod は implementation task の disposable permission test で確認する | DB / backup / staged copy は note data の複製であり、symlink escape と過剰 permission を防ぐ必要があるため |

#### 3.3 Unknown

| ID | 未確認事項 | 契約上の扱い |
|---|---|---|
| U-001 | production runtime の journal mode、WAL / SHM の有無、busy / lock の実測 | native backup を使い、sidecar stop / lock failure を必須条件にする。raw main-file copy を既定にしない |
| U-002 | graceful sidecar stop が Prisma / better-sqlite3 connection の close と flush 完了を保証するか | update task で bounded quiesce handshake を追加し、ack がない / forced kill なら DB copy を中止 |
| U-003 | real packaged `.app` の `Contents/Resources/runtime` に Prisma CLI、migration、better-sqlite3 native binding が揃うか | candidate resource preflight で確認し、欠落時は backup 前に `db-migration-source` で fail |
| U-004 | `better-sqlite3` の既存 version で online backup API を packaged sidecar から呼べるか | new dependency を追加せず disposable fixture で検証。失敗時に `fs.copyFile` へ黙って fallback しない |
| U-005 | Prisma `migrate deploy` が incomplete migration row をどのように扱うか | 未完了 history は eligible にせず、`db-migration-state` で停止。repair semantics は別承認 |
| U-006 | app-managed backup の exact filename generator、retention、将来の listing UI | identity は安全な basename として扱うが、世代数・prune は今回決めない |
| U-007 | current docs の `PRODUCT_SPEC.md` は app-managed safety backup を最新 3 世代と記載し、foundation / MVP contract / post-MVP plan は retention 未決定 | 今回はユーザー指示と後二者を優先し、3 世代を実装契約にしない。仕様書本文は変更しない |
| U-008 | update dialog が未保存 content をどう save / discard / cancel するか、sidecar stop 中の UI bridge | UI bridge / dialog task の前提入力。prep は未保存状態を勝手に破棄しない |
| U-009 | current installed app bundle の replacement target、署名 / notarization、atomic app switch の exact macOS behavior | actual apply / restart / rollback task の対象外 |

### 4. 責務境界

#### 4.1 Fresh update revalidation

apply preparation の最初に次を行う。

- state file 自体を regular non-symlink として読み、schema v2、`status=available`、`phase=null`、pending candidate、`verificationState=verified` を確認する。
- current target context が Apple Silicon `aarch64-apple-darwin` であることを確認する。
- current manifest を fresh fetch し、strict parse、trust / URL / selection を行う。
- persisted candidate と fresh selected release の version、channel、architecture、artifactId、sizeBytes、sha256、keyId を exact compare する。fresh selected candidate がない、または identity が変わった場合は `update-candidate-changed` として終了する。DB、backup、sidecar quiesce はまだ行わない。
- embedded trust store の current / next を lookup し、unknown、retired、revoked、malformed key は `update-signature-key`。manifest / package から trust root を追加しない。
- cached package または fresh download の raw bytes を size、SHA-256、Ed25519 signature で確認する。失敗は `update-integrity`、`update-signature-proof`、`update-signature-key` の固定 code にする。
- `.app.tar.gz` を safe extraction し、archive root、symlink、special file、limits、bundle identity、version、executable、thin arm64 を確認する。失敗は `update-archive` または `update-bundle`。
- candidate bundle の `Contents/Resources/runtime/` に、migration manifest、`migration.sql`、`prisma.config.ts`、Prisma CLI、必要な Node / better-sqlite3 runtime があることを no-follow で preflight する。欠落時は `db-migration-source` とし、backup 前に停止する。

persisted `Verified` marker は、上記を一つでも省略する理由にならない。fresh revalidation は actual apply task が後で明示的に呼ばれる場合にも再度行う。

#### 4.2 DB migration preparation

fresh package validation が終わって初めて次へ進む。

1. update operation lock を取得し、二重 invocation は `update-busy` で拒否する。既に `Checking` の state を別 invocation が変更しない。
2. 未保存 content の save / discard / cancel が完了したことを caller から受け取る。cancel は failure ではなく preparation 中止であり、DB / backup を変更しない。
3. state を atomic に `status=checking`、`phase=apply-preparation`、`checkStartedAt=now` へ遷移する。既存 candidate は保持するが、verified marker はまだ信頼しない。
4. WebView / sidecar の新しい write を止め、sidecar process group を graceful stop する。bounded wait 内に全 child が終了しない、または externally held SQLite lock が解けない場合は `apply-quiesce` / `db-live-open` で停止する。外部 process を kill しない。
5. live DB の path、parent、symlink、regular file、permission、readability を no-follow で確認し、read-only inspection を行う。`READY` なら pending migration なし、`MIGRATION_REQUIRED/MISSING` の完全 prefix なら known pending、`INCOMPLETE` / `UNUSABLE` / unknown / gap / checksum mismatch なら停止する。
6. pending migration がない場合は safety backup、DB staging copy、migration を全て skip する。live DB は actual apply でも置き換え対象にしない。
7. pending migration がある場合だけ、live DB がまだ変更されていない時点で app-managed safety backup を作る。backup copy、integrity、atomic publish が完了するまで migration を始めない。
8. SQLite-native online backup で live DB を `staging/db/<sha256>/notebook.sqlite.tmp` へ snapshot し、source / destination close、file durability、regular non-symlink、same-operation ownership を確認して `notebook.sqlite` へ no-overwrite atomic rename する。`-wal` / `-shm` を手作業で横に copy して一貫性を作らない。
9. candidate runtime の `prisma migrate deploy --config <candidate runtime>/prisma.config.ts` を `DATABASE_URL=file:<staged absolute path>`、`PRISMA_PROVIDER=sqlite`、candidate runtime cwd で実行する。live DB URL、current app runtime の migration directory、`prisma migrate dev` は使わない。
10. migration 後に staging DB を read-only inspection し、全 migration prefix / checksum / required table、`PRAGMA integrity_check = ok`、`PRAGMA foreign_key_check` empty を確認する。connection を close し、同じ adapter で reopen して最小 query / schema probe を行う。
11. preparation が失敗したら staged DB の temp / incomplete directory を exact operation path だけ cleanup し、live DB、current app、existing backups は触らない。既に publish 済み safety backup は保持する。
12. 成功時は sidecar を停止したまま `PreparedApplyHandoff` を actual apply task に渡す。actual apply task がない状態でこの成功を UI command として返さない。

#### 4.3 Actual apply（今回対象外）

後続 task が handoff を受け取った後にだけ、次を実装する。

- current app bundle の保持、candidate app bundle の install target への atomic replacement
- pending migration があった場合の staged DB と live DB の atomic switch。no-pending の場合は live DB をそのまま保持
- explicit restart、candidate sidecar / Next runtime bootstrap、new app health check
- health success まで old app bundle と safety backup を保持
- actual apply の途中で process が落ちた場合の fail-closed state と rollback entrypoint

この task では app bundle、live DB、installed app、restart を変更しない。

#### 4.4 Apply failure recovery

- current app bundle、live DB、existing app-managed backup は、preparation の全ての failure path で不変。
- package bytes と validated extracted app tree は、DB preparation failure だけを理由に削除しない。再試行時に fresh revalidate する。invalid bundle tree を削除する場合も、candidate digest から導出した exact tree だけを no-follow で扱う。
- `incoming/*.part`、archive extraction `.tmp`、DB staging `.tmp`、未コミットの operation directory は cleanup 対象。`packages/<sha>.app.tar.gz`、validated `extract/<sha>/...`、published safety backup は今回の failure cleanup で削除しない。
- state の failure は current v2 invariant に従って pending candidate を clear し、fixed sanitized code と `retryAt` だけを保存する。失敗した candidate を自動で再開しない。
- active `ApplyPreparation` の process interruption / restart は `Failed/update-interrupted` に回復し、自動 migration、app switch、restart、rollback を行わない。
- actual apply task が later process boundary を必要とする場合は、その task が fresh revalidation、handoff persistence、rollback identity を別途設計する。preparation task はそれを推測して state v2 に DB content を追加しない。

### 5. DB staging / backup 候補の比較と採用

| 方式 | 長所 | リスク / 必須条件 | 判定 |
|---|---|---|---|
| sidecar を止めて `fs::copy` / `copyFileSync` | 実装が単純、既存 file API で可能、全 writer が閉じていれば main file の byte copy を作れる | production journal mode が未固定。WAL / SHM を main file と別に copy すると不整合になり、close / checkpoint / lock / durability を証明する必要がある。sidecar を forced kill した後は安全条件を満たさない | 既定にしない。DELETE mode、sidecar graceful close、sidecar file 不在、lock 解放、fsync を全て検証できた場合だけ限定 fallback |
| SQLite online backup API / native backup | SQLite の transaction / page 単位で snapshot を作り、WAL / journal を ad hoc copy しない。既存 `better-sqlite3` runtime を使える | source connection、busy / lock、destination close、durability、package runtime での native binding を検証する必要がある。writer が継続すると actual switch 時点の最新 save と snapshot がずれるため、実際の apply では quiesce が必要 | 採用。sidecar quiesce 後も native backup を使用し、backup と DB staging の共通 primitive にする |
| shell `sqlite3 .backup` / 新 Rust SQLite crate | native backup を利用可能にできる | CLI / crate の同梱、version、path、new dependency、error mapping、packaged runtime の差が増える | 今回は決め打ちしない。既存 `better-sqlite3` が成立しない場合だけ別承認 |

SQLite-native backup を採用しても、次の条件は必須である。

- source writer を止める。online backup が concurrent writer に対応していても、後で staged DB を使う update では post-snapshot save を失うため、quiesce を省略しない。
- sidecar stop timeout / SIGKILL 後は source DB を copy しない。
- `-wal`、`-shm`、`-journal` を個別に足し合わせて一貫性を作らない。
- destination temp は `staging/db` または `backups` と同じ filesystem に作り、final name を先に上書きしない。
- temp / final の全 path は Application Support の所定 directory 内、no-follow、非 symlink、operation が生成した名前であることを確認する。
- backup publish collision は新しい安全な identity を生成するか fail し、既存 backup を overwrite しない。既存 backup の retention / prune は行わない。
- backup failure は migration 開始前に `backup-safety` / `backup-publish` として停止する。partial temp だけを cleanup し、既存 backup は保持する。

### 6. State lifecycle / retention 契約

#### 6.1 state v2 の再利用

この task では schema version を 2 のまま維持し、current `UpdateState` に `stagedDatabasePath`、DB content、backup contents、absolute path、URL、proof、public key、user path を追加しない。

`PendingUpdate.packagePath` と `extractedAppPath` は既存の canonical relative artifact metadata として残す。ただし actual root は `staging/` なので、consumer が `settings/` を base にした既存 loader の symlink check だけを信頼せず、staging root で再検査する。

preparation 成功の handoff は state JSON ではなく次の in-memory typed value とする。

```text
PreparedApplyHandoff {
  candidate identity: version / channel / architecture / artifactId / size / sha256 / keyId
  packagePath: packages/<sha256>.app.tar.gz
  extractedAppPath: extract/<sha256>/Cornell Method Notebook.app
  stagedDatabasePath: db/<sha256>/notebook.sqlite | none
  safetyBackupId: generated basename under Application Support/backups | none
  dbAction: unchanged | migrated
}
```

handoff の path は canonical relative path とし、actual apply task が known `StorageLayout` の staging / backups directory 下へ resolve して no-follow 再確認する。`safetyBackupId` は path や user-selected export ではなく、app が生成した安全な basename だけである。handoff は UI、state snapshot、log、network payload へ serialize しない。

#### 6.2 遷移

| 時点 | state | 実行内容 |
|---|---|---|
| 開始条件 | `Available + Verified`、phase null、pending candidate あり | explicit apply preparation のみ開始。automatic startup check は開始しない |
| 開始 checkpoint | `Checking + ApplyPreparation` | `checkStartedAt` を atomic write。candidate marker は保持するが再検証を省略しない |
| fresh revalidation | 同じ `Checking + ApplyPreparation` | manifest / selection / trust / package / archive / bundle / candidate runtime resource を再検証。failure は fixed code、DB / backup 前 |
| migration 判定 | 同じ phase | live DB の read-only inspection。`READY` は `dbAction=unchanged`、known pending prefix は `dbAction=migrated`、その他は failure |
| migration 前 backup | 同じ phase | pending の場合のみ safety backup を atomic publish。backup failure なら migration / staging を開始しない |
| staged copy | 同じ phase | SQLite-native backup で temp -> canonical staged DB。copy / permission / capacity / integrity を確認 |
| migration execution | 同じ phase | candidate runtime の `prisma migrate deploy` を staged DB へ実行。live `DATABASE_URL` は不可 |
| schema / integrity / reopen | 同じ phase | migration history / checksum、integrity、FK、close / reopen、minimum health を確認 |
| preparation success | state はまだ `Checking + ApplyPreparation` のまま | sidecar stopped のまま `PreparedApplyHandoff` を actual apply task に渡す。actual apply が handoff を受理して初めて次の state transition を行う |
| preparation failure | `Failed`、phase null、pending null | `update-*` / `db-*` / `backup-*` の fixed code と retryAt。current app / live DB / existing backups は不変 |
| process restart during preparation | loader が `ApplyPreparation` を `Failed/update-interrupted` へ変換 | 自動 resume / migration / app switch / rollback なし。operation-owned DB temp を cleanup 可能。published backup は保持 |
| concurrent second invocation | state は変更しない | operation lock の `update-busy`。二つ目の backup / migration / sidecar stop を行わない |

state v2 の current `Failed` が pending candidate を持たないため、failure 後の retry は explicit manual check / explicit apply flow から新たに candidate を取得する。package / extracted tree の存在は新しい Verified の証明にならず、retry 時に全検証をやり直す。

#### 6.3 retention

- app-managed safety backup の世代数、prune の日時、容量上限は今回決めない。
- preparation は既存 app-managed backups を scan / prune / overwrite しない。
- newly created safety backup は preparation failure、state write failure、actual apply の後続 failure のいずれでも、rollback task が明示的に不要と判断するまで保持する。
- package cache、extracted app tree、DB staging の retention は同じ policy にしない。今回の cleanup は operation temp と invalid exact tree に限定し、cache GC は別 task にする。
- external SQLite export は path が Application Support 外でも inside でも、ユーザーが選択した export として update cleanup の所有外にする。state に path を保存しない。

### 7. Fixed failure matrix

UI の表示は内部 code や raw error をそのまま出さず、「更新の準備に失敗しました。現在のアプリとデータは変更されていません。」という generic outcome と retry / close の選択を基本にする。state / local log には下表の fixed sanitized code だけを残す。

| 条件 | persisted code | UI outcome | current app / live DB / existing backups | safe cleanup |
|---|---|---|---|---|
| state JSON tamper、unknown schema、state symlink、path allowlist failure | `update-state` | 更新状態を確認できない | 変更しない | state、live、backup、external export を削除しない |
| candidate が manifest refresh で変化 | `update-candidate-changed` | 候補が更新されたため再確認が必要 | 変更しない | DB / backup なし。old package / tree は cache として残し、次回 fresh verify |
| revoked / retired / unknown / malformed key | `update-signature-key` | package を信頼できない | 変更しない | exact invalid artifact のみ後続 cleanup 可。backup なし |
| package size / SHA-256 mismatch | `update-integrity` | package を検証できない | 変更しない | `.part` / invalid exact temp。既存 backup は不変 |
| Ed25519 proof encoding / payload / mismatch | `update-signature-proof` | package の署名を検証できない | 変更しない | package verification の exact temp。DB staging なし |
| tar / gzip root、path traversal、symlink、special file、limit failure | `update-archive` | package を展開できない | 変更しない | exact extraction temp。live / backup を触らない |
| Info.plist、bundle ID、version、executable、arm64 / Mach-O failure | `update-bundle` | app bundle を検証できない | 変更しない | exact invalid extracted tree。package を勝手に全消去しない |
| candidate runtime の migration / Prisma resource 欠落 | `db-migration-source` | DB migration を実行できない | 変更しない | DB staging / backup なし |
| sidecar が止まらない、child が残る、forced kill、quiesce ack failure | `apply-quiesce` | データを安全に固定できない | live / backup 不変。current app は relaunch が必要になることがある | DB copy を開始しない。外部 process は kill しない |
| live DB missing | `db-live-missing` | DB recovery / compatible app が必要 | 空 DB を自動作成せず、変更しない | cleanup なし |
| live DB read-only、permission、locked、open failure | `db-live-open` | DB を安全に開けない | 変更しない | temp なし。既存 backup は保持 |
| WAL / SHM / journal を含む live snapshot が整合しない | `db-live-integrity` | DB integrity を確認できない | 変更しない | sidecar file を削除・合成しない |
| live `integrity_check` / FK check failure | `db-live-integrity` | DB recovery が必要 | 変更しない | backup / staging なし |
| DB の migration history が current candidate より新しい / unknown | `db-migration-state` | compatible app が必要 | live / backup 不変 | staging なし |
| migration name gap、duplicate、checksum mismatch、unfinished row | `db-migration-state` | migration state を自動 repair しない | 変更しない | backup 前に停止 |
| migration source が missing / non-contiguous | `db-migration-source` | 更新を準備できない | 変更しない | backup 前に停止 |
| safety backup の read / native backup / integrity failure | `backup-safety` | safety backup を作れないので更新しない | live / existing backups 不変 | temp backup だけ cleanup |
| backup final name collision / atomic publish / permission failure | `backup-publish` | safety backup を確定できない | live / existing backups 不変。既存 file を overwrite しない | pending temp のみ cleanup |
| staged DB path symlink、traversal、non-regular、wrong root | `db-staging-path` | DB staging path が安全でない | 変更しない | exact operation directory のみ。broad recursive delete 不可 |
| staging capacity / write / native backup / lock failure | `db-staging-copy` | DB staging を作れない | live / backup 不変。published backup は保持 | `.tmp` / incomplete DB だけ cleanup |
| staged DB migration SQL failure | `db-migration-failed` | migration failed、現行版を維持 | live DB は絶対に repair / rewrite しない。backup は保持 | staged DB temp / operation copy を cleanup |
| staged migration 後の schema / checksum / integrity / FK failure | `db-staging-integrity` | staged DB を使用できない | live / backup 不変 | staged DB を cleanup、package / tree は保持 |
| staged DB reopen failure | `db-reopen` | DB を再オープンできない | live / backup 不変 | staged DB を cleanup、published backup は保持 |
| minimum health failure | `db-health` | candidate DB を使用できない | live / backup 不変 | staged DB cleanup |
| state checkpoint / final handoff write failure | `update-state` | update state を保存できない | live / app / existing backup 不変。new backup は保持 | unreferenced staged DB は exact cleanup、cache は一括削除しない |
| process crash / interruption in `ApplyPreparation` | `update-interrupted` | 次回 explicit retry が必要 | 自動 action なし。current / live / backup 不変 | temp / incomplete staged DB のみ。published backup は保持 |
| second invocation while operation lock held | `update-busy`（通常は state を更新しない） | 処理中として終了 | 一つ目の operation 以外は何もしない | cleanup なし |
| old verified cache is changed / missing at retry | relevant `update-integrity` / `update-archive` / `update-bundle` | fresh verification failure | 変更しない | exact invalid cache only |
| future rollback backup restore failure | `backup-restore`（actual rollback task の code） | recovery requires manual action | current / live / all existing backups を削除しない | failed restore temp only。今回の prep は restore を呼ばない |

### 8. SQLite、permission、symlink、capacity の実装条件

- `Application Support/<id>/staging`、`db`、operation directory、`backups` は app-owned path として no-follow で作成 / 検査する。既存 symlink、unexpected directory、parent escape は failure にする。
- source live DB、backup temp、staged DB temp、final DB は `lstat` で regular file を確認し、open 時も可能なら `O_NOFOLLOW` 相当を使う。
- current code の `fs.statSync()` は live DB inspection で symlink を follow するため、apply preparation の security boundary には再利用しない。future adapter は `lstat` / no-follow を先に行う。
- staging / backup temp の permission は current-user-only を要求する。具体的な mode、owner、umask 依存を implementation task で disposable test し、失敗時は `db-staging-path` / `backup-publish` にする。
- SQLite の `foreign_keys` は current migration SQL で一時的に off / on される箇所がある。migration 後の health では `foreign_key_check` を必ず実行し、connection close / reopen 後にも確認する。
- `PRAGMA integrity_check` は live DB を repair する command ではない。結果が `ok` 以外なら read-only failure とし、`VACUUM`、`REINDEX`、`PRAGMA writable_schema`、自動 repair を行わない。
- capacity は source size の単純な倍数だけで success と判定しない。native copy / migration の write error を fixed code に map し、既存 backup / live DB を削除して空きを作らない。
- DB の migration SQL、SQL error、migration output、absolute path、note data は state / UI / sanitized log に出さず、内部 test の failure injection に限定する。

### 9. 後続 Worker task の分割

依存順と completion criteria を次のように固定する。全 task は live DB、実 backup、実 package、実 app bundle を使わず、temp home / temp Application Support / generated SQLite fixture / fake transport / fake process で検証する。

| 順 | task | 対象 file / 領域 | 依存 | 完了条件と fixture / failure injection |
|---:|---|---|---|---|
| 0 | runtime quiesce / resume primitive | `src-tauri/src/runtime.rs`、`src-tauri/src/lifecycle.rs`、`main.rs`、必要なら `launcher.cjs` | 現行 process group / ready handshake | fake sidecar を graceful stop、child exit、forced kill、restart / `/notes` ready まで検証。forced kill 後に DB copy を始めない。実 sidecar / live DB 不使用 |
| 1 | apply preparation / fresh revalidation | `src-tauri/src/update_verification.rs`、新規 preparation module、`main.rs`、`update_state.rs`、candidate resource preflight、`test/desktop/desktop-update-verification*.test.js` | state v2、manifest / selection、download、signature、archive、bundle、T0 | exact candidate identity、fresh trust / package / archive / bundle / runtime resource を全て再検証。candidate changed、revoked key、digest、proof、archive traversal、bundle mismatch、resource missing を fixed code で確認。DB / backup side effect がない failure test |
| 2 | DB staging copy / schema detection | `src/server/infrastructure/desktop-storage.js` または専用 desktop-update storage module、`.d.ts`、必要な `launcher.cjs`、`test/desktop/desktop-storage*.test.js` | T0、T1、candidate runtime path | `staging/db/<sha256>/` の no-follow layout、native backup、pending / ready / newer / gap / incomplete / corrupt 判定。temp home の generated fixture、WAL / journal sidecar fixture、symlink、permission、capacity、locked fake を使う。live path は fixture only |
| 3 | pre-migration safety backup | 新規 app-managed backup provider、`desktop-storage.js` の path helper、専用 tests | T0、T2 の pending 判定 | pending のときだけ Application Support `backups/` に native snapshot、integrity read-back、atomic no-overwrite publish。backup failure、collision、permission、partial temp cleanup。retention prune がないことを確認 |
| 4 | isolated migration / integrity / reopen | candidate runtime migration runner、`desktop-storage.js`、必要な `prisma.config.ts` adapter、`test/desktop` の disposable migration fixture | T2、T3 | candidate runtime の `prisma migrate deploy` を staged `DATABASE_URL` にだけ実行。oldest-first、schema / checksum / integrity / FK / close / reopen / minimum health を確認。SQL failure、missing source、newer schema、gap、checksum、reopen / health injection。live DB URL は test assertion で拒否 |
| 5 | state checkpoint / atomic handoff | `src-tauri/src/update_state.rs`、preparation coordinator、`main.rs` response type、state tests | T1〜T4 | `Checking + ApplyPreparation` の begin / failure / interruption、固定 code、atomic state write、operation lock、no UI path / DB content / external path。`PreparedApplyHandoff` の relative path / basename invariant を型で検証。成功 handoff は sidecar quiesced の actual apply stub へ一度だけ渡す |
| 6 | actual app replacement / live DB switch / restart / health | `runtime.rs`、`lifecycle.rs`、`main.rs`、新規 apply module、packaged app path adapter | T5 | actual `.app`、installed current app、live DB を disposable Application Support / fake install root に置き、explicit invocation のみで atomic switch。health success 前に old app / backup を保持。今回未実装 |
| 7 | rollback / cleanup | apply / rollback module、state、runtime、cleanup tests | T6 | app switch、DB switch、restart、health の各 failure injection で current app / live DB / backup を維持。old app restore、DB backup restore、package / extract / DB temp の所有別 cleanup。external export を作成して cleanup 対象外を確認。今回未実装 |
| 8 | UI bridge / update dialog | desktop bridge、既存 editor dirty controller / close coordinator、update UI | T1、T5、T6 | 未保存内容について save / discard / cancel。save failure は edit / dirty state を保持。cancel は quiesce 前に中止。UI / log に note content、DB path、external export path を出さない。今回未実装 |

#### task 間の実装順の注意

- T1〜T5 は live DB を変更しないため、current app bundle の replacement task と分離して先に検証できる。
- T2〜T4 は、`scripts/generate-sqlite-fixture.js` のような disposable fixture を temp home に出し、既存 `prisma/migrations` を読み取るだけにする。fixture の output を `DATABASE_URL`、`prisma/dev.db`、Application Support の実 path に向けない。
- T6 以降で初めて installed app / live DB switch を扱う。T5 の in-memory handoff が process boundary をまたぐ設計へ変わる場合は、state v2 optional fields、crash recovery、privacy を同時に再承認する。
- 既存の `/notes`、`/notes/new`、`/notes/[id]`、`/backup`、API、explicit save、CanvasDocumentV1、legacy Markdown、物理削除契約は各 task の対象外とし、変更しない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 完了 | 既存の未コミット変更（docs、UI、`src-tauri`、tests、既存 summaries 等）を確認し、戻していない |
| read-only source / summary 調査 | 完了 | runtime、sidecar、Prisma、SQLite storage、backup、state、verification、関連 tests / summaries を確認 |
| live DB /実 backup / external export /実 package /実 app bundle | 未使用 | task 制約どおり disposable path 以外へアクセスしていない |
| GitHub / external network | 未使用 | network access なし |
| code / config / dependency / lockfile / existing docs | 未変更 | summary 以外の製品成果物は変更していない |
| summary format | 後続確認 | `tools/check-summary.sh` をこの file に対して実行する |
| tests / lint / build | 未実行 | 仕様詰め・read-only task のため。後続 coding task が disposable fixture で実行する |

## Remaining Unknowns

実装開始前に追加で確認・検証する必要がある重要事項は U-001〜U-009 に集約した。特に、T0 の graceful sidecar close acknowledgment、candidate bundle 内 `runtime` resource の実在、既存 `better-sqlite3` online backup API の packaged runtime 成立が未確認である。ただし推奨契約は、これらが未成立の場合に raw copy や live migration へ黙って fallback せず、固定 failure code で停止する形にしている。

仕様判断として残るのは次の二点である。

1. app-managed safety backup の retention policy（`PRODUCT_SPEC.md` の最新 3 世代を採用するか、未決定を維持するか）。今回の apply preparation では未決定を維持し、prune を実装しない。
2. actual apply / rollback が process crash 後にも handoff を必要とするか。その場合のみ、actual apply task で state v2 の canonical relative path / backup identity extension を設計し、fresh revalidation と atomic handoff を同時に実装する。preparation 単体では in-memory handoff を採用する。

## Next Read

次の coding task / review では、まずこの summary を読み、次の最小ファイルだけを確認する。

- `src-tauri/src/update_state.rs`
- `src-tauri/src/update_verification.rs`
- `src-tauri/src/runtime.rs`
- `src-tauri/src/lifecycle.rs`
- `src-tauri/src/main.rs`
- `src/server/infrastructure/desktop-storage.js`
- `src-tauri/sidecar/launcher.cjs`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/update_bundle.rs`
- `prisma.config.ts`
- `test/desktop/desktop-storage.test.js`
- `test/desktop/desktop-update-state.test.js`
- `test/desktop/desktop-update-verification.test.js`
- `test/backup/local-sqlite-backup-provider.test.js`

Do not start with raw worker logs, live `notebook.sqlite`、real Application Support backups、実 package、実 app bundle、GitHub resource。検証は temp home、generated SQLite fixture、fake manifest / artifact transport、fake sidecar / candidate runtime から開始する。
