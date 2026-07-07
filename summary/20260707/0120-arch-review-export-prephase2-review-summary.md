---
summary_type: task-summary
created_at: 2026-07-07 01:20 JST
task_kind: worker-task
task_status: done
---

## Objective

review-tasks と PDF export を Phase 2 実装へ進める前に、architecture migration と機能追加の境界、必要な contract / server / remote 境界、後続 Worker task 候補を整理する。

## Scope

確認対象:

- `AGENTS.md`
- `doc/technical/TARGET_ARCHITECTURE.md`
- `doc/technical/ARCHITECTURE_MIGRATION_PLAN.md`
- `doc/review/MVP_DETAIL_GAP_INVENTORY.md`
- `summary/20260707/0059-arch-notes-ui-remote-boundary-summary.md`
- `summary/20260707/0115-arch-backup-pattern-review-summary.md`
- `src/app/api/notes/**`
- `src/server/notes/**`
- `src/modules/notes/**`
- `prisma/schema.prisma`
- `package.json`

除外:

- `.next/**`
- `doc/assets/**`
- review-tasks / export の実装
- Prisma schema 変更
- Playwright provider 実装
- 依存関係追加

## Current Baseline

notes domain は、現在以下の移行パターンができている。

| 領域 | 現在の形 |
|---|---|
| HTTP adapter | `src/app/api/notes/**/route.ts` が request parse、schema validation、service call、response に寄っている。 |
| contract | `src/modules/notes/contracts/note.schema.ts` に query / body schema と inferred type がある。 |
| server application | `src/server/notes/application` が list/get/create/update/delete/review の use case を持つ。 |
| server infrastructure | `src/server/notes/infrastructure` が Prisma query / transaction を持つ。 |
| presenter | `src/server/notes/presenters` が Prisma shape を API DTO へ変換する。 |
| UI remote | `src/modules/notes/remote` が fetch、query string、HTTP error decode を持つ。 |

backup domain は、notes と同じ層を機械的に増やさず、filesystem provider / optional service / UI remote / DTO に留める方針が整理済み。

review-tasks と PDF export は、`MVP_DETAIL_GAP_INVENTORY.md` では Phase 2 / MVP 外として整理されている。現行 `prisma/schema.prisma` には `NotebookReviewProgress` や NoteCard 系 model は存在しない。現行の復習機能は MVP 用の `Notebook.nextReviewDate` / `Notebook.reviewedAt` と `POST /api/notes/:id/review` であり、Phase 2 の `/api/review-tasks` とは別責務として扱う。

## Architecture Migration vs Phase 2 Feature

architecture migration に含めてよいもの:

- review-tasks / export の contract 境界を設計する。
- server application / infrastructure / presenter / provider の責務分担を設計する。
- UI remote の責務と API error handling を設計する。
- notes / backup の移行パターンと矛盾しない task 分割を作る。
- Prisma model 追加が必要な箇所を明記する。

Phase 2 機能追加に属し、今は実装しないもの:

- `/api/review-tasks` route 作成。
- `/tasks/review` 画面作成。
- グローバルナビの未完 task badge。
- `NotebookReviewProgress` model / migration 追加。
- note 作成時の review progress 初期化。
- review task 完了時の status 更新。
- `/api/notes/export` route 作成。
- export 用 SSR / HTML / PDF レイアウト作成。
- Playwright Chromium 起動処理。
- PDF download UI。
- NoteCard / NoteCueLink / Draft / Undo / SoftDeleteBuffer など他 Phase 2 model の同時追加。

## Review Tasks Boundary

### Contract

推奨配置:

- `src/modules/review-tasks/contracts/index.ts`
- 必要なら `src/modules/review-tasks/contracts/review-task.schema.ts`

最小 DTO / schema:

| contract | 内容 |
|---|---|
| `ReviewTaskType` | `"day" | "week"` |
| `reviewTasksQuerySchema` | `type=day|week` を validate。未指定を許すかは UI 設計時に決める。 |
| `ReviewTaskTagDto` | `{ id, name, color }` |
| `ReviewTaskItemDto` | `{ notebookId, title, noteDate, tags, type, dueAt, reviewStatus, completedAt? }` |
| `ReviewTasksResponseDto` | `{ type, totalCount, data }` |
| `ReviewTaskCountsDto` | `{ day, week, total }`。nav badge で必要。 |
| `CompleteReviewTaskRequestDto` | `{ type: "day" | "week" }` または URL 側で type を受ける。 |
| `CompleteReviewTaskResponseDto` | `{ notebookId, reviewStatus, firstReviewCompletedAt, secondReviewCompletedAt }` |

判断点:

- `PATCH /api/review-tasks/:notebookId` に `type` を body で渡すか、`?type=day|week` で渡すかを統一する必要がある。Manager 推奨は body に `{ type }` を置く形。理由は command payload として扱いやすく、validation error field を `type` にできるため。
- nav badge 用 count を既存 list response から都度集計するか、`GET /api/review-tasks/counts` 相当を作るかを決める必要がある。Manager 推奨は Phase 2 初期では counts endpoint を分ける。理由は navbar が day/week 両方の件数を必要とし、list tab の取得条件と表示単位を混ぜないため。

### Server Application

推奨配置:

- `src/server/review-tasks/application/review-task.service.ts`

use case:

- `listReviewTasks({ type, now })`
- `getReviewTaskCounts({ now })`
- `completeReviewTask({ notebookId, type, completedAt })`

責務:

- day/week の抽出条件を application で明示する。
- status 遷移を application で一元管理する。
- HTTP status / `NextResponse` は知らない。
- Prisma transaction の詳細は infrastructure に寄せる。

抽出条件:

- day: `firstReviewAt <= now` かつ `reviewStatus = 0`
- week: `secondReviewAt <= now` かつ `reviewStatus = 1`
- `deletedAt IS NULL` の Notebook のみ対象。

status 遷移:

- day 完了: `reviewStatus=1`, `firstReviewCompletedAt=completedAt`
- week 完了: `reviewStatus=2`, `secondReviewCompletedAt=completedAt`
- type と現在 status が一致しない場合は 409 conflict または 400 invalid_body のどちらにするか設計判断が必要。Manager 推奨は 409 conflict。理由は UI 表示後に別操作で状態が進んだ可能性を表せるため。

### Server Infrastructure

推奨配置:

- `src/server/review-tasks/infrastructure/review-task.repository.ts`
- `src/server/review-tasks/presenters/review-task.mapper.ts`

repository:

- `findReviewTasks(type, now)`
- `countReviewTasks(now)`
- `findReviewProgressForUpdate(notebookId)`
- `markFirstReviewCompleted(notebookId, completedAt)`
- `markSecondReviewCompleted(notebookId, completedAt)`

presenter:

- Prisma include shape を `ReviewTaskItemDto` / `ReviewTaskCountsDto` に変換する。
- date-only は `YYYY-MM-DD`、datetime は ISO string に統一する。
- tag は名前順に sort する。notes mapper と同じ表示安定性を保つ。

### UI Remote

推奨配置:

- `src/modules/review-tasks/remote/index.ts`

remote functions:

- `fetchReviewTasks({ type })`
- `fetchReviewTaskCounts()`
- `completeReviewTask({ notebookId, type })`

責務:

- `fetch`
- query string 生成
- JSON request / response の受け渡し
- `decodeApiErrorResponse` による error decode
- `ReviewTasksRemoteError` で `status` と `body` を保持

置かないもの:

- React component state
- tab UI
- Prisma / server-only logic
- status 遷移 rule

### Prisma Schema Additions

必要 model:

- `NotebookReviewProgress`
  - `notebookId` PK / FK
  - `reviewStatus` int
  - `firstReviewAt`
  - `secondReviewAt`
  - `firstReviewCompletedAt`
  - `secondReviewCompletedAt`

必要 relation:

- `Notebook.reviewProgress`

必要 repository 変更:

- note 作成時に `NotebookReviewProgress` を同一 transaction で初期化する。
- noteDate 更新時に未完 review schedule を再計算するかどうかを決める必要がある。

判断点:

- 現行 MVP の `nextReviewDate` / `reviewedAt` を Phase 2 で残すか、専用 progress へ移行するか。Manager 推奨は互換上すぐ削除せず、Phase 2 の review-tasks は `NotebookReviewProgress` を正とし、MVP 詳細復習 API とは別 task で整理する。

## PDF Export Boundary

### Notes Export Data Contract

推奨配置:

- `src/modules/export/contracts/index.ts`
- 必要なら `src/modules/export/contracts/export.schema.ts`

HTTP query:

- `from`: `YYYY-MM-DD`
- `to`: `YYYY-MM-DD`
- `from <= to`
- 期間未指定・範囲不正時は UI では button disabled、API では JSON error。

内部 data DTO:

| DTO | 内容 |
|---|---|
| `NotesExportQuery` | `{ from, to }` |
| `ExportNoteTagDto` | `{ id, name, color }` |
| `ExportCueDto` | MVP では `{ id, text, order }`。Phase 2 NoteCard 導入後は cue/note link の再設計が必要。 |
| `ExportNoteDto` | `{ id, title, noteDate, sourceType, sourceTitle, overview, body, summary, tags, cues }` |
| `NotesExportDataDto` | `{ from, to, notes }` |

HTTP response:

- 成功時は `application/pdf` blob。
- `Content-Disposition` で `学習記録-YYYYMMDD-YYYYMMDD.pdf` を返す。
- error は既存 shared error `{ code, message, errors? }` の JSON を返す。

注意:

- PDF binary response と JSON error response が同じ endpoint に混在する。UI remote は `response.ok` の場合だけ blob として読み、error 時は `decodeApiErrorResponse` を使う。
- export data contract は HTTP JSON として外へ出さない可能性がある。server application と provider の境界 DTO として安定させれば十分。

### Server Export Application / Provider

推奨配置:

- `src/server/export/application/export.service.ts`
- `src/server/export/infrastructure/export-notes.repository.ts`
- `src/server/export/infrastructure/playwright-pdf-provider.ts`
- `src/server/export/presenters/export.mapper.ts`

application:

- `exportNotesPdf({ from, to, now })`
- `getNotesExportData({ from, to })`
- filename 生成
- provider 呼び出し

repository:

- `Notebook.deletedAt IS NULL`
- `noteDate >= from`
- `noteDate <= to`
- `orderBy noteDate asc, updatedAt asc` など PDF の安定順を定義する。
- MVP では `Notebook.body` / `Cue` を取得する。
- Phase 2 NoteCard 導入後は export data contract を NoteCard 対応へ拡張する。

presenter:

- Prisma record を `ExportNoteDto` に変換。
- date-only / nullable / tag sort を安定化。

provider boundary:

- `PdfExportProvider` 相当は最初から interface を重くしすぎない。
- ただし Playwright は副作用が大きく、将来 HTML export へ戻す可能性もあるため、Route Handler に直書きしない。
- concrete provider は `renderNotesPdf(data): Promise<Buffer | Uint8Array>` 程度の境界で十分。

Playwright provider:

- `src/server/export/infrastructure/playwright-pdf-provider.ts` に閉じる。
- Chromium 起動、page.setContent、PDF 生成、browser close を provider 内に閉じる。
- HTML template / CSS は provider 内 helper か `server/export/presenters` に分ける。初回は provider 内 private helper でよく、肥大化したら `print-layout` へ分割する。
- API route は Playwright を import しない。

### UI Remote / Download Flow

推奨配置:

- `src/modules/export/remote/index.ts`

remote functions:

- `downloadNotesExportPdf({ from, to }): Promise<{ blob, filename }>`

責務:

- query string 生成。
- `fetch("/api/notes/export?...")`
- `response.ok` なら `blob()`。
- `Content-Disposition` から filename 抽出。取れない場合は UI / remote 側で fallback filename を生成。
- error response は `decodeApiErrorResponse`。
- `ExportRemoteError` で `status` と `body` を保持。

UI flow:

- date range が未指定・不正なら button disabled。
- click 後は loading indicator。
- success で object URL を作り download link click。
- finally で object URL revoke。
- success toast / error message を表示。

置かないもの:

- PDF layout HTML
- Playwright option
- Prisma query

## Dependency Order

### Review Tasks

1. contract 設計。
2. Prisma schema / migration for `NotebookReviewProgress`。
3. notes create/update transaction に review progress 初期化 / 再計算方針を追加。
4. server review-tasks repository / presenter / application。
5. `/api/review-tasks` HTTP adapter。
6. UI remote。
7. `/tasks/review` UI。
8. nav badge integration。
9. MVP `POST /api/notes/:id/review` との関係整理。

### PDF Export

1. contract 設計。
2. export data repository / presenter。
3. server export application。
4. Playwright PDF provider。
5. `/api/notes/export` HTTP adapter。
6. UI remote download flow。
7. notes list page の date range export UI。
8. PDF visual / content verification。
9. Phase 2 NoteCard 導入後の export layout 再確認。

## Do Not Do Now

- review-tasks と export の空ディレクトリだけを先に作らない。
- review-tasks / export に notes と同じ全層を、中身なしで機械的に作らない。
- `NotebookReviewProgress` と PDF export route を同一 task にしない。
- review task 専用 DB model 追加と UI 実装を同一 task にしない。
- Playwright PDF provider と download UI を同一 task にしない。
- Phase 2 の NoteCard / D&D / autosave / Undo / draft model を review-tasks / export の前提として同時追加しない。
- 現行 MVP の `nextReviewDate` / `reviewedAt` を architecture migration のついでに削除しない。
- OpenAPI / generated client / Rust API をこの段階で導入しない。

## Follow-up Worker Task Candidates

### 1. `arch-review-tasks-contracts-boundary`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-api` |
| kind | coding |
| 目的 | review-tasks の DTO / query / command schema を `modules/review-tasks/contracts` に作り、API contract の正本を置く。 |
| 対象 | `src/modules/review-tasks/contracts`, `src/shared/http` の既存 error DTO 参照 |
| 完了条件 | `ReviewTaskType`, list query, count response, complete command, list item DTO が定義され、date-only / datetime / error field 名が明示される。Route や DB schema は変更しない。 |
| 検証方法 | `npm run lint`, `npm run build`。実装なしなら `sed -n` で contract 内容確認。 |
| 依存関係 | notes contract / remote pattern 確定後。 |

### 2. `phase2-review-progress-prisma-model`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-api` |
| kind | coding |
| 目的 | review-tasks 用 `NotebookReviewProgress` model と migration を追加する。 |
| 対象 | `prisma/schema.prisma`, Prisma migration, 必要な generated client |
| 完了条件 | `NotebookReviewProgress` が `Notebook` と 1:1 で定義され、`reviewStatus`, `firstReviewAt`, `secondReviewAt`, completion fields を持つ。既存 Notebook data を壊さない migration 方針が summary に残る。 |
| 検証方法 | `npx prisma validate`, `npm run prisma:generate`, `npm run lint`, `npm run build`。可能なら migration dry-run または local migrate 実行。 |
| 依存関係 | `arch-review-tasks-contracts-boundary` 推奨。 |

### 3. `phase2-review-progress-note-create-init`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-api` |
| kind | coding |
| 目的 | Notebook 作成時に review progress を同一 transaction で初期化する。 |
| 対象 | `src/server/notes/application`, `src/server/notes/infrastructure`, `prisma/schema.prisma` の relation 利用箇所 |
| 完了条件 | note 作成時に `firstReviewAt = noteDate + 1 day`, `secondReviewAt = noteDate + 7 days`, `reviewStatus=0` が作成される。noteDate 更新時の再計算方針が実装または明記される。 |
| 検証方法 | `npm run lint`, `npm run build`, `npx prisma validate`。可能なら `POST /api/notes` 後に Prisma で progress 作成確認。 |
| 依存関係 | `phase2-review-progress-prisma-model`。 |

### 4. `phase2-review-tasks-server-api`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-api` |
| kind | coding |
| 目的 | `/api/review-tasks` の list / counts / complete API を server application / infrastructure / presenter 境界付きで実装する。 |
| 対象 | `src/app/api/review-tasks/**`, `src/server/review-tasks/**`, `src/modules/review-tasks/contracts` |
| 完了条件 | day/week list、未完 counts、complete command が JSON contract と error shape を守る。Route Handler は validation / service call / response に留まる。 |
| 検証方法 | `npm run lint`, `npm run build`, 可能なら day/week API 手動確認。status 不一致・not_found・validation error の代表確認。 |
| 依存関係 | `phase2-review-progress-note-create-init`。 |

### 5. `phase2-review-tasks-ui-remote`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-ui` |
| kind | coding |
| 目的 | review-tasks UI 用 remote を作り、fetch / error decode / command payload を UI から分離する。 |
| 対象 | `src/modules/review-tasks/remote`, `src/modules/review-tasks/contracts` |
| 完了条件 | `fetchReviewTasks`, `fetchReviewTaskCounts`, `completeReviewTask` があり、`ReviewTasksRemoteError` が API error body を保持する。UI 画面はまだ作らない。 |
| 検証方法 | `npm run lint`, `npm run build`。静的確認として remote に fetch が閉じていることを `rg` で確認。 |
| 依存関係 | `phase2-review-tasks-server-api` 推奨。 |

### 6. `phase2-review-tasks-screen`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-ui` |
| kind | coding |
| 目的 | `/tasks/review` 画面を実装し、day/week tab と完了操作を提供する。 |
| 対象 | `src/app/tasks/review`, `src/modules/review-tasks/ui`, `src/modules/review-tasks/remote` |
| 完了条件 | day/week tab、task card、タグ表示、完了 checkbox、完了後即時除去、loading/error/empty state が実装される。 |
| 検証方法 | `npm run lint`, `npm run build`, 可能なら Playwright または手動で day/week 表示と完了操作確認。 |
| 依存関係 | `phase2-review-tasks-ui-remote`。 |

### 7. `arch-export-contracts-boundary`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-api` |
| kind | coding |
| 目的 | PDF export の query schema、export data DTO、binary response / JSON error の contract を定義する。 |
| 対象 | `src/modules/export/contracts`, `src/shared/http` の既存 error DTO 参照 |
| 完了条件 | `NotesExportQuery`, `ExportNoteDto`, `NotesExportDataDto`, filename policy, error fields が明示される。Route、DB、Playwright は変更しない。 |
| 検証方法 | `npm run lint`, `npm run build`。実装なしなら `sed -n` で contract 内容確認。 |
| 依存関係 | notes mapper / date helper pattern 確定後。 |

### 8. `phase2-export-server-data`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-api` |
| kind | coding |
| 目的 | export 対象 notes を取得し、PDF provider に渡す data DTO へ変換する server application / repository / presenter を作る。 |
| 対象 | `src/server/export/application`, `src/server/export/infrastructure/export-notes.repository.ts`, `src/server/export/presenters` |
| 完了条件 | `from/to` 範囲の notes が安定順で取得され、`NotesExportDataDto` に変換される。PDF 生成や route はまだ作らない。 |
| 検証方法 | `npm run lint`, `npm run build`。可能なら service を呼ぶ軽量確認または API 未接続の静的確認。 |
| 依存関係 | `arch-export-contracts-boundary`。 |

### 9. `phase2-export-playwright-provider`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-api` |
| kind | coding |
| 目的 | Playwright PDF provider を server infrastructure に閉じ込め、export data から PDF buffer を生成する。 |
| 対象 | `src/server/export/infrastructure/playwright-pdf-provider.ts`, 必要なら print layout helper |
| 完了条件 | provider が Chromium 起動、HTML content 設定、PDF buffer 生成、browser close を担当し、Route Handler から直接 Playwright を使わない構成になる。 |
| 検証方法 | `npm run lint`, `npm run build`, provider 経由の PDF 生成確認。生成 PDF は `doc/assets/**` に置かない。 |
| 依存関係 | `phase2-export-server-data`。 |

### 10. `phase2-export-api-route`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-api` |
| kind | coding |
| 目的 | `GET /api/notes/export?from&to` を HTTP adapter として実装し、PDF binary response と JSON error response を返す。 |
| 対象 | `src/app/api/notes/export/route.ts`, `src/server/export/application`, `src/modules/export/contracts` |
| 完了条件 | valid range は `application/pdf` と `Content-Disposition` を返し、invalid range / server error は `{ code, message, errors? }` JSON を返す。 |
| 検証方法 | `npm run lint`, `npm run build`, valid/invalid query の API 手動確認。PDF file が開けることを確認。 |
| 依存関係 | `phase2-export-playwright-provider`。 |

### 11. `phase2-export-ui-remote-download`

| 項目 | 内容 |
|---|---|
| queue | `codex-queue/tasks-ui` |
| kind | coding |
| 目的 | export UI 用 remote と download flow を作り、binary response / JSON error decode を UI から分離する。 |
| 対象 | `src/modules/export/remote`, notes list page export UI |
| 完了条件 | `downloadNotesExportPdf` が blob と filename を返し、UI は range validation、loading、download、success/error state を扱う。 |
| 検証方法 | `npm run lint`, `npm run build`, 可能なら `/notes` で期間指定 export を手動確認。 |
| 依存関係 | `phase2-export-api-route`。 |

## Recommended Order

1. `arch-review-tasks-contracts-boundary`
2. `phase2-review-progress-prisma-model`
3. `phase2-review-progress-note-create-init`
4. `phase2-review-tasks-server-api`
5. `phase2-review-tasks-ui-remote`
6. `phase2-review-tasks-screen`
7. `arch-export-contracts-boundary`
8. `phase2-export-server-data`
9. `phase2-export-playwright-provider`
10. `phase2-export-api-route`
11. `phase2-export-ui-remote-download`

理由:

- review-tasks は DB model と note 作成 transaction が前提なので、contract の後は Prisma model 追加を先に切る必要がある。
- PDF export は DB model 追加を伴わないが、binary response と Playwright 副作用が大きいため、data contract / server data / provider / route / UI download を分ける。
- review-tasks と PDF export は互いに独立している。並行可能だが、同じ Worker task には混ぜない。

## Verification

| コマンド | 結果 |
|---|---|
| `git status --short` | 実行済み。既存の未コミット変更多数あり。戻していない。 |
| `sed -n` for target docs and summaries | 実行済み。architecture docs、gap inventory、notes remote summary、backup pattern summary を確認。 |
| `sed -n` / `rg --files` for notes pattern | 実行済み。notes contracts / remote / application / infrastructure / presenters / route を確認。 |
| `sed -n '1,260p' prisma/schema.prisma` | 実行済み。`NotebookReviewProgress` は未追加、MVP 用 `nextReviewDate` / `reviewedAt` のみ存在することを確認。 |
| `rg -n "playwright\|export\|review-tasks\|NotebookReviewProgress"` | 実行済み。`package.json` に `playwright` 依存あり、Phase 2 route/model は現行対象外であることを確認。 |
| `npm run lint` / `npm run build` | 未実行。docs/review task であり、実装変更は summary 追加のみのため。後続 coding task では必須。 |

## Changed Files

| パス | 変更内容 |
|---|---|
| `summary/20260707/0120-arch-review-export-prephase2-review-summary.md` | review-tasks / PDF export の Phase 2 前境界、依存順、実装しない範囲、後続 Worker task 候補を整理。 |

## Next Read

- `summary/20260707/0120-arch-review-export-prephase2-review-summary.md`
- `doc/technical/TARGET_ARCHITECTURE.md`
- `doc/technical/ARCHITECTURE_MIGRATION_PLAN.md`
- `prisma/schema.prisma`
- `src/modules/notes/remote/index.ts`
