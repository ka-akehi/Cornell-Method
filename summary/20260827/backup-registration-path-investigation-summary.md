# Backup registration path investigation

## Objective

`/backup` の手動 SQLite backup 失敗について、UI から provider までの登録・DB path 解決・Desktop sidecar 境界を事実ベースで調査し、後続実装の設計判断と受け入れ観点を整理した。コード、設定、依存関係、テストは変更していない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | `/backup` GET/POST、error DTO、SQLite backup provider、Prisma runtime、Desktop user data/sidecar |
| 対象ファイル | 指定された src/config/prisma/package/test と関連する desktop storage/sidecar 境界 |
| 対象外 | 実装、env 作成、DB操作、外部サービス、ネットワーク、運用環境接続 |

## Findings

| ID | 種別 | 内容 | 根拠 |
|---|---|---|---|
| F1 | fact | `/backup` page は `fetchBackups` / `createBackup` を呼び、remote は非 2xx の `ApiErrorBody.message` を `BackupRemoteError.message` にコピーし、UI は caught error の message をそのまま表示する。 | `src/modules/backup/remote/index.ts`, `src/modules/backup/ui/components/backup-page.tsx` |
| F2 | fact | `/api/backups` GET/POST は `CORNELL_DESKTOP_BACKUPS_DIRECTORY` だけを service に渡し、例外の `error.message` を `createServerError` に渡す。`ApiErrorBody` は `server_error` 固定で内部 message を秘匿しない。 | `src/app/api/backups/route.ts`, `src/shared/http/api-error.ts` |
| F3 | fact | backup provider は `options.databaseUrl ?? process.env.DATABASE_URL` を独自解決し、値が undefined の場合は `file:./dev.db` を使う。相対 path は provider の `projectRoot`（通常 `process.cwd()`）基準で解決する。 | `local-sqlite-backup-provider.js` の `databaseUrlToPath` / `resolveDatabasePath` |
| F4 | fact | Prisma runtime は `resolveDatabaseUrl(process.cwd())` を呼び、`.env` を読み、未設定の非 hosted 環境では同じ default `file:./dev.db`、設定時は検証済み URL、hosted では追加制約を適用する。 | `src/server/infrastructure/prisma.ts`, `config/project-env.js` |
| F5 | fact | したがって env 未設定の通常開発 Web では両者とも cwd の `dev.db` を指すため env は必須ではない。一方 `.env` に相対/絶対のカスタム `DATABASE_URL` がある場合、Prisma はそれを使うが backup provider は `.env` をロードせず、process env に未注入なら default `dev.db` を見る。これは二重化による実質的な path 不整合である。 | F3/F4、および `test/backup/database-url-resolution.test.js`, `test/config/project-env.test.js` |
| F6 | fact | provider は SQLite のみを受け付け、PostgreSQL URL や query/fragment、memory URL を拒否する。Prisma runtime は SQLite/PostgreSQL の両方を選択可能。`/api/backups` の backup 契約は実質 SQLite 専用。 | provider と `config/project-env.js` |
| F7 | fact | Desktop storage は `~/Library/Application Support/com.cornellmethod.notebook/live/notebook.sqlite` と sibling `backups` を canonical path として解決する。Rust runtime が sidecar に絶対 `DATABASE_URL=file:<user-data>/live/notebook.sqlite`、`CORNELL_DESKTOP_BACKUPS_DIRECTORY=<user-data>/backups`、`PRISMA_PROVIDER=sqlite` を注入する。 | `src/server/infrastructure/desktop-storage.js`, `src-tauri/src/runtime.rs`, `test/desktop/desktop-storage.test.js` |
| F8 | inference | Desktop packaged runtime では sidecar の env 注入により Prisma と provider の DB path は一致する。ただし Web/API route 自体は backup provider に database URL を明示渡ししておらず、sidecar process env への依存が残る。 | F7 と route/service の引数形 |
| F9 | fact | backup directory 未存在は一覧では空扱いだが、作成時は source DB の存在確認、directory 作成、copy/publish、最新3世代 prune を行う。権限、source DB 不在、directory 不正などの raw error/message が route まで伝播し得る。 | provider の `listBackups` / `createBackup` / `pruneBackups` |

## Recommended design

1. DB URL の正本を runtime と backup で共有する。推奨は backup application service の境界で、Prisma runtime と同じ `resolveDatabaseUrl(projectRoot)` を一度解決し、その検証済み URL/path を provider に明示渡しする方式。provider 自身の process env fallback は compatibility 用に限定するか段階的に廃止する。
2. Desktop では sidecar が確定した user data の絶対 DB URL と backup directory を application service に明示的に渡す境界を維持する。外部 export は別機能（native dialog/managed backup protocol）の境界であり、`/api/backups` の内部手動 backupを外部出力先へ変更しない。
3. API は raw exception message を DTO に出さず、安定した backup 専用 code（例: `backup_database_unavailable`, `backup_storage_unavailable`, `backup_configuration_invalid`, `backup_failed`）と固定された日本語 message を返す。path、`DATABASE_URL`、env 名、内部 exception は response に含めない。ログを追加する場合も local server log のみにし、秘密情報を含めない。

### User-facing classification and recovery

| 分類 | 表示案 | ユーザーの復旧行動 |
|---|---|---|
| DB 未検出 / 設定不整合 | `バックアップ元のデータベースを確認できません。アプリを再起動して、データが表示されることを確認してください。` | 再起動、Desktop の初期化/復旧状態確認。データが無い場合は backup 作成を繰り返さない |
| 権限・読み書き失敗 | `バックアップ保存先にアクセスできません。空き容量と保存先のアクセス権を確認してください。` | 空き容量・OS 権限確認、再試行 |
| 入力・環境設定不正 | `バックアップ設定を確認できません。アプリの設定を確認して再起動してください。` | 管理対象の設定を修正。ユーザーに raw env/path を要求しない |
| 不明な失敗 | `バックアップを作成できませんでした。しばらくしてから再試行してください。` | 再試行、継続する場合は診断情報を添えて報告 |

GET 一覧失敗も同じ分類契約を使うが、作成失敗と文脈を分ける。成功 DTO の `path` は現行 UI が表示しているため、Desktop user data の絶対 path を返さず、現行の相対表示契約を維持する。

## Follow-up implementation split

1. Shared backup error contract: code/DTO、server-side error classifier、raw message を外へ出さない route mapping。
2. Registration/path resolution: `resolveDatabaseUrl` を backup 経路でも利用し、service/provider に明示的な validated database URL と Desktop backup directory を渡す。未設定開発、`.env` custom SQLite、絶対 URL、Desktop sidecar を対象にする。
3. UI/remote: error code を分類表示へ変換し、unknown/non-Error と malformed API body の fallback を固定する。
4. Targeted tests: route が raw message を返さないこと、各分類の status/code/message、remote decode、UI の分類表示、`.env` custom URL の Prisma/provider path equality、env 未設定 default、Desktop absolute injection、DB missing/read permission/config-invalid/unknown、backup directory boundary と最新3世代を検証する。

## MVP impact

現行 MVP の `/backup`、手動 SQLite backup、明示操作、最新3世代保持は維持できる。autosave、soft delete/Undo、専用 review、NoteCard/D&D、PDF export、自動 backup、外部 export の自動化は追加しない。DB 登録経路の変更は API route/service/provider 内部の整合性修正として扱い、route、shared contract、UI、tests を同時更新する必要がある。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 完了 | 既存の未追跡 summary 5件のみを確認。変更せず保持 |
| 対象コード・関連テスト読解 | 完了 | backup/config/desktop の path と error 経路を確認 |
| コード・設定・依存関係・テスト・生成物 | 変更なし | 調査のための test 実行も行っていない |
| 作業後 `git status --short` | 完了予定 | 本 summary の新規作成のみが本 Worker の意図した変更 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U1 | 実際の Next server 起動時に Prisma import より先に backup API が評価される全モジュール順序 | build/runtime の統合テスト。ただし provider の direct env read だけで不整合根拠は十分 |
| U2 | OS の読み取り/書き込み errno をどの分類へ厳密に割り当てるか | 実装時の error code matrix と targeted tests |
| U3 | Desktop UI が `/api/backups` と managed external backup protocol をどの画面で併用するか | Desktop acceptance flow の確認 |

## Next Read

- `src/shared/http/api-error.ts`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `src/server/infrastructure/prisma.ts`
- `src/server/infrastructure/desktop-storage.js`
