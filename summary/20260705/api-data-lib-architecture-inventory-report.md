# API / Data / Lib Architecture Inventory Report

作成日: 2026-07-05

## Scope

この報告は API / DB / lib 側の現状棚卸しに限定する。コード、設定、依存関係、DB schema、backup ファイルは変更していない。

対象:

- `src/app/api/**/route.ts`
- `src/lib/**`
- `prisma/schema.prisma`
- `scripts/**`
- `package.json`
- 指定された MVP 設計書と 2026-07-05 の検証 summary

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-04.md` | 再開時に読むべき設計書、MVP の設計/検証状況 |
| design | `doc/technical/MVP_TECHNICAL_DESIGN.md` | Route Handler, Prisma, SQLite, backup, Phase 2 移行方針 |
| design | `doc/api/MVP_API_DESIGN.md` | MVP API endpoint, error format, validation,物理削除方針 |
| design | `doc/data/MVP_DATA_DESIGN.md` | MVP 4 model 構成、Phase 2 外テーブル |
| review | `doc/review/MVP_DETAIL_GAP_INVENTORY.md` | 2026-07-05 時点の MVP gap 解消状況 |
| summary | `summary/20260705/manager-mvp-api-crud-validation-backup-reverification-report.md` | API CRUD / validation / backup runtime PASS |
| summary | `summary/20260705/backup-copy-command-verification-report.md` | `npm run backup:copy` runtime PASS |
| code | `src/app/api/**/route.ts`, `src/lib/**`, `prisma/schema.prisma`, `scripts/**`, `package.json` | 現 API/data/lib 構成 |

## Current Dependency Map

```text
UI pages/components
  -> fetch /api/notes, /api/tags, /api/backups

src/app/api/notes/route.ts
  -> src/lib/validation.ts
  -> src/lib/prisma.ts
  -> Prisma Client models: Notebook, Cue, Tag, NotebookTag

src/app/api/notes/[id]/route.ts
  -> src/lib/validation.ts
  -> src/lib/prisma.ts
  -> Prisma transaction for Notebook update + Cue full replace + NotebookTag full replace

src/app/api/notes/[id]/review/route.ts
  -> src/lib/validation.ts
  -> src/lib/prisma.ts
  -> Notebook.reviewedAt / nextReviewDate update

src/app/api/tags/route.ts
  -> src/lib/prisma.ts
  -> Tag list

src/app/api/backups/route.ts
  -> src/lib/backup/index.js
  -> filesystem copy/list/prune under backup/

scripts/backup-copy.js
  -> src/lib/backup/index.js
  -> same createBackup helper as API

src/lib/prisma.ts
  -> @prisma/adapter-better-sqlite3
  -> DATABASE_URL fallback file:./dev.db

prisma/schema.prisma
  -> SQLite datasource
  -> Notebook, Cue, Tag, NotebookTag only
```

## Findings

| ID | Area | Classification | Finding |
|---|---|---|---|
| A-001 | API routes | Phase 2 | Route Handler に request parsing、validation 呼び出し、Prisma where 組み立て、transaction、DTO mapping、error response helper が同居している。MVP では小さいため成立しているが、自動保存/Undo/NoteCard/PDF/export 追加前に service/repository/mapper へ切り出した方がよい。根拠: `src/app/api/notes/route.ts:30-142`, `src/app/api/notes/route.ts:144-260`, `src/app/api/notes/[id]/route.ts:24-107`, `src/app/api/notes/[id]/route.ts:125-181` |
| A-002 | API routes | Phase 2 | `formatDetail`, `dateOnlyString`, `dateFromDateOnly`, `createTagsAndLinks`, `getNotebookDetail` が notes list/detail route 間で重複している。今すぐ壊れてはいないが、payload に draft/version/card/link が増えると route 間の response 差分が出やすい。 |
| A-003 | Validation | Keep | `src/lib/validation.ts` は Zod schema、query/body validation、API error body 生成を一箇所に集めており、MVP の境界として妥当。runtime validation も 2026-07-05 の API 再検証で PASS。根拠: `src/lib/validation.ts:31-189`, `src/lib/validation.ts:197-256` |
| A-004 | Validation | Phase 2 | `validation.ts` は request schema と API error factory が同居している。Phase 2 で endpoint 数が増えたら `validation/note.ts`, `validation/review.ts`, `api/errors.ts` へ分割すると影響範囲が読みやすい。 |
| A-005 | Prisma access | Phase 2 | `src/lib/prisma.ts` は Prisma Client singleton だけで、domain query / command 層はない。MVP では OK。ただし Route Handler から Prisma model を直接操作しているため、Undo、draft 楽観ロック、review progress の transaction ルールを route ごとに実装すると重複と不整合が出る。根拠: `src/lib/prisma.ts:1-19` |
| A-006 | Data model | Keep | MVP schema は `Notebook`, `Cue`, `Tag`, `NotebookTag` の 4 model に絞られており、設計書と一致する。Phase 2 外の `NotebookDraftState`, `SoftDeleteBuffer`, `NoteCard` などは混入していない。根拠: `prisma/schema.prisma:9-65` |
| A-007 | Data model | Phase 2 | `Notebook.deletedAt` は schema にあるが MVP API は物理削除、かつ一覧/detail では `deletedAt: null` を条件にしている。Undo 導入時に「物理削除」と「soft delete 互換カラム」の意味を改めて統一する必要がある。根拠: `prisma/schema.prisma:22`, `src/app/api/notes/[id]/route.ts:191-207` |
| A-008 | Data model | Phase 2 | UI/API payload は `Notebook` に `body`, `summary`, `cues`, `tags` を直接ぶら下げる MVP DTO で、Prisma shape に近い。NoteCard / NoteCueLink / draft state に進む前に API DTO を Prisma model から独立した `NoteDetailDto` / `NoteInputDto` として固定する方がよい。 |
| A-009 | Backup | Keep | backup 処理は `src/lib/backup/index.js` に閉じており、API と CLI が同じ `createBackup` / `listBackups` helper を使っている。DB ファイルコピー前提は UI や notes API には漏れていない。根拠: `src/app/api/backups/route.ts`, `scripts/backup-copy.js:1-13`, `src/lib/backup/index.js:118-148` |
| A-010 | Backup | Phase 2 | backup helper は `file:` SQLite URL、`process.cwd()`, `backup/`, synchronous fs を前提にしている。ローカル MVP では妥当だが、Vercel/Postgres/Supabase へ移る時は helper の差し替えが必要。根拠: `src/lib/backup/index.js:5-7`, `src/lib/backup/index.js:16-37`, `src/lib/backup/index.js:93-123` |
| A-011 | Backup | Fix Now | `POST /api/backups` の 500 response は internal filesystem path をそのまま message に出す可能性がある。ローカル個人利用では被害は小さいが、Phase 2 で Vercel/認証を考えるなら、今のうちに server error message を固定し、詳細は console/error log に留める方がよい。根拠: `src/app/api/backups/route.ts` が `error.message` を `createServerError` に渡す。 |
| A-012 | SQLite/Postgres migration | Phase 2 | `src/lib/prisma.ts` は `PrismaBetterSqlite3` adapter 固定、schema datasource も `provider = "sqlite"` 固定。Supabase/Postgres 移行は単なる `DATABASE_URL` 差し替えではなく、adapter/schema/migration/backup 方針の同時変更 task になる。根拠: `src/lib/prisma.ts:1-8`, `prisma/schema.prisma:5-7` |
| A-013 | Query performance | Phase 2 | `GET /api/notes` は body/summary/cue text を `contains` 検索する。ローカル小規模では妥当だが、データ増加や Postgres 移行時は全文検索、index、pagination cursor を検討する余地がある。根拠: `src/app/api/notes/route.ts:165-172`, `src/app/api/notes/route.ts:198-205` |
| A-014 | Scripts | Keep | `package.json` の API/data/lib 関連 script は `prisma:generate`, `prisma:migrate`, `backup:copy` が明確。diagram script は docs 生成用で API/data 境界には影響しない。根拠: `package.json:5-16` |
| A-015 | Dependencies | Phase 2 | package には D&D、`@uiw/react-md-editor`, `react-day-picker`, Playwright が存在する。MVP 設計では一部 Phase 2 候補扱いなので、依存整理は別 task で判断すればよい。今すぐ API/data/lib の破綻要因ではない。根拠: `package.json:18-35` |

## Keep

- MVP 4 model schema は設計書と一致しており、Phase 2 外の DB テーブルが混入していない。
- `src/lib/validation.ts` に validation と API error body 生成が集約されており、MVP の endpoint 数では追いやすい。
- backup は notes/tags API から分離され、API と CLI が同じ helper を使っている。
- API CRUD / validation / backup prune と `npm run backup:copy` は 2026-07-05 の runtime 検証で PASS 済み。
- Route Handler API 採用、Server Actions 不採用、SQLite local MVP 方針は現構成と整合している。

## Fix Now

| 優先 | 対象 | 理由 | 推奨 task |
|---|---|---|---|
| Medium | `src/app/api/backups/route.ts` | 失敗時に filesystem path 等の内部詳細を JSON `message` へ返す可能性がある。ローカル MVP でも公開前提の癖を減らせる小修正。 | `createServerError()` の public message は固定し、詳細は `console.error` のみにする。必要なら `BackupError` の user-safe code を別途返す。 |

それ以外に、MVP 完了状態を壊す即時修正は確認していない。

## Phase 2

| 優先 | 対象 | 内容 |
|---|---|---|
| High | API service layer | 自動保存、Undo、NoteCard/NoteCueLink、review task を入れる前に `src/lib/notes` などへ query/command/mapper を分離する。Route Handler は parsing、schema validation、service 呼び出し、HTTP response に寄せる。 |
| High | DTO boundary | `NoteInputDto`, `NoteDetailDto`, `NoteListItemDto` を Prisma include shape から独立して定義する。UI 型と DB model の密結合を弱める。 |
| High | Deletion model | `deletedAt` 互換カラム、物理削除、Undo soft delete、purge の責務を再設計する。`DELETE /api/notes/:id` の挙動変更は DB/API/UI 同時 task にする。 |
| High | Draft/autosave model | `NotebookDraftState`, version/autosaveVersion, 409 conflict を route 直書きで足さず、保存 command と transaction policy を先に作る。 |
| Medium | Backup provider boundary | `src/lib/backup` を `localSqliteBackupProvider` として位置づけ、Postgres/Supabase 時の backup/export provider と差し替えられる API にする。 |
| Medium | Prisma/Postgres migration | Supabase/Postgres へ行く場合は `PrismaBetterSqlite3` adapter、schema provider、migration SQL、date handling、backup を一括変更する migration spike を切る。 |
| Medium | Review task | `reviewedAt/nextReviewDate` の MVP 復習と、Phase 2 の `NotebookReviewProgress` をどう移行するかを決める。 |
| Medium | PDF export | PDF generation は notes query と response mapper を再利用できる形にする。Route Handler 内に Playwright と DB query を直結させない。 |
| Low | Validation split | endpoint 増加時に `validation.ts` を note/review/tag/backup/error に分割する。 |
| Low | Dependency audit | MVP で未使用の Phase 2 依存を残すか削るかを判断する。 |

## Open Questions

| ID | Question | 判断が必要なタイミング |
|---|---|---|
| Q-001 | Phase 2 はまず自動保存/Undo/NoteCard/review task のどれから入るか。優先順によって service layer の切り方が変わる。 | Phase 2 最初の実装 task 作成前 |
| Q-002 | `deletedAt` を Phase 2 soft delete の正式カラムとして使い続けるか、MVP 互換カラムとして migration し直すか。 | Undo 設計前 |
| Q-003 | Supabase/Postgres 移行は現実に近い Phase 2 目標か、当面ローカル SQLite 固定か。 | backup/provider 設計前 |
| Q-004 | Backup error はローカル個人利用向けに詳細表示を優先するか、将来公開前提で常に user-safe message に寄せるか。 | Fix Now task 着手前 |
| Q-005 | `tag` query の MVP 名称を維持するか、最終仕様の `tags` へ寄せるか。 | 一覧 API の Phase 2 改修前 |

## Candidate Next Tasks

必要な場合のみ、以下を実装 task に切れる。

1. `API-ARCH-001`: backup API の error response を user-safe にする。
   - 対象: `src/app/api/backups/route.ts`, 必要なら `src/lib/backup/index.js`
   - 検証: `npm run lint`, `npm run build`, `GET/POST /api/backups` 正常系、DB 不在または invalid `DATABASE_URL` の失敗系

2. `API-ARCH-002`: notes API の mapper/date/tag helper を `src/lib/notes` へ切り出す。
   - 対象: `src/app/api/notes/route.ts`, `src/app/api/notes/[id]/route.ts`, 新規 `src/lib/notes/*`
   - 検証: `npm run lint`, `npm run build`, API CRUD 再検証
   - 注意: Phase 2 前の整備 task。MVP リリース直前なら無理に入れない。

3. `API-ARCH-003`: Phase 2 用 DB/API 境界設計 mini design を作る。
   - 対象: docs/summary のみ
   - 内容: draft/autosave, Undo, NoteCard, review task の追加順と transaction boundary を決める。

## Verification

今回のタスクではコード・設定を変更していないため、runtime 再検証は必須ではない。事実確認として以下を実行した。

| Command | Result |
|---|---|
| `git status --short` before | 既存の modified/untracked files を確認。本タスク開始時点で作業ツリーは dirty。 |
| `rg --files ...` / `find ...` | 対象ファイルの存在を確認。 |
| `sed` / `nl -ba` | 指定設計書、summary、API route、lib、schema、scripts、package を確認。 |

## Next Read

次回この棚卸しを起点にする場合は、raw log ではなく以下を読む。

- `summary/20260705/api-data-lib-architecture-inventory-report.md`
- `doc/technical/MVP_TECHNICAL_DESIGN.md`
- `doc/api/MVP_API_DESIGN.md`
- `doc/data/MVP_DATA_DESIGN.md`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
- `src/app/api/backups/route.ts`
- `src/lib/validation.ts`
- `src/lib/backup/index.js`
- `src/lib/prisma.ts`
- `prisma/schema.prisma`
