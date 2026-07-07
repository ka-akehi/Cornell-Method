---
summary_type: task-summary
created_at: 2026-07-07 01:15 JST
task_kind: worker-task
task_status: done
---

## Objective

notes domain で作った contracts / presenters / service / repository / remote の移行パターンを backup domain に適用する場合の対象範囲、過剰設計リスク、後続 Worker task 候補を整理する。

## Scope

確認対象:

- `doc/technical/TARGET_ARCHITECTURE.md`
- `doc/technical/ARCHITECTURE_MIGRATION_PLAN.md`
- `summary/20260707/0059-arch-notes-ui-remote-boundary-summary.md`
- `src/app/api/backups/route.ts`
- `src/app/backup/page.tsx`
- `src/lib/backup/index.js`
- `scripts/backup-copy.js`
- `package.json`

`.next` 配下の build artifacts は今回の確認対象外。既存 summary に `.next` の backup 関連ファイルが出ているが、本棚卸しでは無視した。

## Current Responsibilities

| ファイル | 現状責務 | 備考 |
|---|---|---|
| `src/app/api/backups/route.ts` | `GET /api/backups` と `POST /api/backups` の Route Handler。`listBackups()` / `createBackup()` を直接呼び、`NextResponse.json` と `shared/http` の server error response を返す。 | 既にかなり薄い。HTTP adapter と application 呼び出しが少し混ざっている程度。 |
| `src/app/backup/page.tsx` | Client Component。バックアップ一覧 fetch、手動作成 POST、loading / creating / error / success state、日時表示、画面表示をすべて担当。 | UI と remote 境界が未分離。小さい画面なので UI component 分割はまだ不要。 |
| `src/lib/backup/index.js` | CommonJS helper。SQLite `DATABASE_URL` 解析、backup dir / relative path 生成、ファイル名 timestamp parse、一覧取得、最新 3 世代 prune、DB file copy、backup error を担当。Next API と Node script で共有。 | 実質 filesystem backup provider 兼 service。副作用境界がここに集まっている。 |
| `scripts/backup-copy.js` | CLI entry。`src/lib/backup/index.js` を dynamic import し、project root を指定して `createBackup()` を実行し、作成 path を stdout に出す。 | CLI adapter として十分薄い。 |
| `package.json` | `backup:copy` script を提供。 | backup 実装そのものではないが検証コマンドの正本。 |

## Pattern Fit

backup domain は notes より小さいため、notes と同じ層を機械的に全展開しない方がよい。必要な境界は次の順で十分。

### API Route

`src/app/api/backups/route.ts` は最終的に `request parse -> service call -> response` に寄せる価値がある。ただし現状は引数なしの GET/POST だけなので、巨大な route handler 問題は起きていない。

適用するなら:

- `GET` は `listBackupEntries()` のような application service を呼ぶだけにする。
- `POST` は `createBackupEntry()` のような application service を呼ぶだけにする。
- error response は既存 `shared/http` を使い、response shape `{ code, message, errors? }` を維持する。
- route-specific validation は現時点では不要。query/body がないため Zod schema は作らない。

### Filesystem Backup Provider

filesystem 副作用は将来差し替え可能性があるため、移すなら `server/backup/infrastructure/local-sqlite-backup-provider` が最も自然。

ただし今すぐ interface を切るより、まずは既存 `src/lib/backup/index.js` の責務を保ったまま配置を整理するのが妥当。

推奨配置案:

- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
  - `databaseUrlToPath`
  - `backupDir`
  - `listBackups`
  - `createBackup`
  - `pruneBackups`
  - `BackupError`
- `src/server/backup/application/backup.service.js`
  - provider を呼び、API 用 DTO に載せる最小 service
- `src/lib/backup/index.js`
  - 互換 re-export として一時的に残すか、script と route を同時に移せる task で削除

CommonJS のまま維持するか TypeScript 化するかは coding task で判断が必要。Next API と Node script の両方から使うため、TypeScript 化する場合は CLI から直接 import できる実行形に注意する。過剰な build step は避ける。

### UI Remote

`src/app/backup/page.tsx` には fetch / error decode / response DTO 型が直書きされているため、notes UI remote と同じく `src/modules/backup/remote` を作る価値はある。

作るなら:

- `fetchBackups()`
- `createBackup()`
- `BackupsRemoteError`
- `decodeApiErrorResponse` 利用
- `BackupEntryDto`, `BackupsResponseDto`, `CreateBackupResponseDto` 型

UI page は loading / creating / success / rendering に集中できる。バックアップ画面は小さいため、remote 導入と UI component 分割を同時にやらない。

### Contracts / DTO / Error Response

DTO を明示する価値はあるが、Zod schema や細かい presenter 層は現時点では不要。

最小 contract:

- `BackupEntryDto`
  - `file: string`
  - `createdAt: string`
  - `path: string`
- `ListBackupsResponseDto`
  - `backups: BackupEntryDto[]`
- `CreateBackupResponseDto`
  - `ok: true`
  - `backup: { file: string; path: string }`

error response は domain 固有にせず `shared/http` の `{ code, message, errors? }` を使う。backup 固有 error code を増やすのは、UI が原因別に分岐する必要が出るまで待つ。

## Do Not Do Now

- backup に notes と同じ repository / presenter / mapper をフルセットで作らない。DB record や Prisma include shape がないため、repository / presenter の分離効果が薄い。
- OpenAPI や生成 client は導入しない。DTO 型で十分。
- query/body がない `GET /api/backups` / `POST /api/backups` に Zod schema を作らない。
- `src/app/backup/page.tsx` を複数 component / hook に分ける task を先行しない。remote 導入後もまだ小さければ page 内 state でよい。
- `backup_logs` テーブル、`GET /api/backups/logs`、`POST /api/backups/retry` など仕様上の将来 API を architecture migration に混ぜない。これは機能追加 task。
- 自動起動時 backup やログ保持の未実装解消を、この棚卸しや境界移行 task に混ぜない。
- backup ファイル名、保持世代数、保存先、DATABASE_URL の解釈を移行ついでに変更しない。
- `scripts/backup-copy.js` を複雑な CLI framework 化しない。adapter として十分薄い。

## Overengineering Risks

| リスク | 判断 |
|---|---|
| service / repository / presenter / provider / DTO を一括作成する | backup は filesystem 副作用中心で DB repository がない。provider + optional service + remote + DTO で十分。 |
| provider interface を先に抽象化する | 代替 provider がまだない。まず concrete provider を server infrastructure に置くだけでよい。interface はテストや別保存先が必要になってから。 |
| backup-specific error hierarchy を作る | UI は現在 message 表示のみ。`BackupError` を server error message に載せるだけで足りる。 |
| UI hook/component 分割を remote と同時に行う | 挙動差分が追いにくくなる。remote 導入だけを 1 task にする。 |
| CommonJS helper を無理に TypeScript 化する | CLI 実行経路に build/transpile 問題が出やすい。TypeScript 化は価値と実行方法を task 内で確認してから。 |

## Follow-up Worker Task Candidates

### 1. `arch-backup-contracts-remote`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-ui` |
| kind | coding |
| 目的 | backup UI の fetch 直書きと API error decode を `modules/backup/remote` に集約する。 |
| 対象 | `src/modules/backup/contracts`, `src/modules/backup/remote`, `src/app/backup/page.tsx` |
| 完了条件 | `BackupEntryDto` / list response / create response の型が明示され、`page.tsx` から `fetch("/api/backups")`、`response.json()`、API error body decode が消える。画面文言と挙動は維持する。 |
| 検証方法 | `npm run lint`, `npm run build`, 可能なら `/backup` 表示と「バックアップ作成」操作を手動確認。静的確認として `rg -n "fetch\\(|response\\.json|/api/backups" src/app/backup/page.tsx` が match しないこと。 |

### 2. `arch-backup-server-provider-boundary`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-api` |
| kind | coding |
| 目的 | filesystem backup 実装を server backup infrastructure 境界へ寄せ、API route と CLI script が同じ provider/service を使う状態にする。 |
| 対象 | `src/server/backup/infrastructure`, `src/server/backup/application`, `src/lib/backup/index.js`, `src/app/api/backups/route.ts`, `scripts/backup-copy.js` |
| 完了条件 | `route.ts` は service call と response だけに近づき、filesystem 操作は server backup infrastructure に閉じる。`npm run backup:copy` と `POST /api/backups` の response shape / copy / prune 挙動は維持する。`src/lib/backup/index.js` を残す場合は互換 re-export として理由をコメントまたは summary に残す。 |
| 検証方法 | `npm run lint`, `npm run build`, `npm run backup:copy`。可能なら `GET /api/backups` / `POST /api/backups` 手動確認。`backup/` が最新 3 世代保持であることを `ls -la backup` で確認。 |

### 3. `arch-backup-api-thin-route`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-api` |
| kind | coding |
| 目的 | backup API route を HTTP adapter としてさらに薄くし、error handling と response mapping の位置を整理する。 |
| 対象 | `src/app/api/backups/route.ts`, `src/server/backup/application`, `src/modules/backup/contracts` |
| 完了条件 | `GET` / `POST` が `try -> service call -> NextResponse.json` と `catch -> apiErrorResponse` 程度になり、API response DTO が contracts と一致する。既存 `{ backups }` と `{ ok: true, backup }` は変えない。 |
| 検証方法 | `npm run lint`, `npm run build`, 可能なら `GET /api/backups` / `POST /api/backups` 手動確認。 |
| 依存関係 | `arch-backup-server-provider-boundary` 後が望ましい。provider 移動と同時実施するならこの task は不要。 |

### 4. `backup-mvp-feature-gap-review`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks` |
| kind | docs/review |
| 目的 | 仕様上の backup_logs / retry / app startup backup / `/notes/backup` と、現行 MVP の `/backup` 手動 backup の差分を機能追加候補として整理する。 |
| 対象 | `AGENTS.md`, `README.md`, `doc/review/MVP_DETAIL_GAP_INVENTORY.md`, `src/app/backup/page.tsx`, `src/app/api/backups/route.ts`, `scripts/backup-copy.js` |
| 完了条件 | architecture migration ではなく機能追加として扱うべき backup gap が、優先度・リスク・受け入れ条件付きで整理される。 |
| 検証方法 | docs/review task のため `git diff -- <summary or doc>` と `sed -n` による内容確認。コード変更なし。 |

## Recommended Order

1. `arch-backup-contracts-remote`
2. `arch-backup-server-provider-boundary`
3. 必要な場合のみ `arch-backup-api-thin-route`
4. architecture migration とは別枠で `backup-mvp-feature-gap-review`

理由:

- UI remote は notes で確定した移行パターンを小さく適用でき、`src/app/backup/page.tsx` の fetch 直書きを取り除ける。
- filesystem provider は副作用境界として価値があるが、CommonJS / CLI 実行経路の扱いを慎重に見る必要がある。
- API route は既に薄いため、provider 移動 task に含められるなら単独 task 化しなくてよい。

## Verification

| コマンド | 結果 |
|---|---|
| `git status --short` | 実行済み。既存の未コミット変更多数あり。`src/app/api/backups/route.ts` も作業前から modified。戻していない。 |
| `sed -n` for target files | 実行済み。対象 backup API / UI / lib / script と architecture docs / notes remote summary を確認。 |
| `rg -n "backup\|backups\|backup:copy" package.json README.md doc summary/20260705 summary/20260707 -g '!**/.next/**'` | 実行済み。出力が大きく truncate されたが、README / package script / backup 検証 summary / `.next` 除外対象の存在を確認。 |
| `npm run lint` / `npm run build` | 未実行。docs/review task であり、実装変更は summary 追加のみのため。後続 coding task では必須。 |

## Changed Files

| パス | 変更内容 |
|---|---|
| `summary/20260707/0115-arch-backup-pattern-review-summary.md` | backup domain の現状責務、移行境界、過剰設計回避、後続 Worker task 候補を整理。 |

## Next Read

- `summary/20260707/0115-arch-backup-pattern-review-summary.md`
- `src/app/backup/page.tsx`
- `src/app/api/backups/route.ts`
- `src/lib/backup/index.js`
- `scripts/backup-copy.js`
