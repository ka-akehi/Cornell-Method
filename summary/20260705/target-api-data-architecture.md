# Target API / Data Architecture

作成日: 2026-07-05

## Scope

この文書は Cornell Method Notebook の API / data / lib 側について、現行の Route Handler 直書き構成から、service / repository / mapper / DTO / validation / error handling を分けた構成へ移行するためのターゲット案を整理する。

コード、設定、依存関係、DB schema、画像は変更していない。

対象:

- `summary/20260705/api-data-lib-architecture-inventory-report.md`
- `src/app/api/**/route.ts`
- `src/lib/**`
- `prisma/schema.prisma`
- `scripts/**`
- `doc/api/MVP_API_DESIGN.md`
- `doc/data/MVP_DATA_DESIGN.md`
- `doc/technical/MVP_TECHNICAL_DESIGN.md`

## Current Responsibility Inventory

### API Route Handlers

| file | current responsibility |
|---|---|
| `src/app/api/notes/route.ts` | Query parsing, body parsing, Zod validation, Prisma where construction, pagination, date conversion, list/detail DTO mapping, Notebook/Cue/Tag transaction, error response generation |
| `src/app/api/notes/[id]/route.ts` | Path params read, body parsing, validation, not found check, detail DTO mapping, Notebook update transaction, Cue full replace, NotebookTag full replace, physical delete, error response generation |
| `src/app/api/notes/[id]/review/route.ts` | Path params read, body parsing, validation, not found check, reviewedAt/nextReviewDate update, response DTO mapping, error response generation |
| `src/app/api/tags/route.ts` | Tag repository query, Tag DTO response, error response generation |
| `src/app/api/backups/route.ts` | Backup helper invocation, backup response generation, filesystem error to API error conversion |

### Shared lib / data

| file | current responsibility |
|---|---|
| `src/lib/prisma.ts` | Prisma Client singleton and SQLite better-sqlite3 adapter setup |
| `src/lib/validation.ts` | Zod schemas, inferred input types, query/body normalization, API error type, API error factory, HTTP status mapping |
| `src/lib/backup/index.js` | SQLite file path resolution, backup listing, backup creation, pruning, filesystem errors, public backup entry mapping |
| `scripts/backup-copy.js` | CLI entry point that reuses backup helper |
| `prisma/schema.prisma` | MVP models: `Notebook`, `Cue`, `Tag`, `NotebookTag` |

## Current Problems

### Maintainability

- `src/app/api/notes/route.ts` and `src/app/api/notes/[id]/route.ts` each define date helpers, detail mapping, tag mapping, tag upsert/link logic, and API error response helpers. When draft, Undo, NoteCard, NoteCueLink, PDF export, or review task endpoints are added, the same rules will be copied again unless they are extracted.
- Route Handler files are doing both HTTP work and domain work. A reader must scan request parsing, validation, DB transaction rules, and response shape at the same time to understand one endpoint.
- `src/lib/validation.ts` is useful for MVP, but it mixes feature validation and generic API error construction. This makes it harder to update one feature's validation without mentally checking global error behavior.

### Responsibility Boundaries

- Prisma model shape currently leaks into API mapping through `Prisma.NotebookGetPayload` types inside routes. This couples response DTOs to Prisma `include` shapes.
- Repository concerns are not explicit. Query conditions such as `deletedAt: null`, tag OR filters, review due filters, and full replacement of related rows are embedded in routes.
- Backup is better isolated than notes, but its provider boundary is not explicit. The helper is effectively a local SQLite backup provider, yet route and CLI import it as generic backup behavior.

### Change Ease

- Adding optimistic locking and autosave would require route-level transaction edits unless save commands are moved into a service first.
- Changing deletion from physical delete to soft delete + Undo would affect route behavior, repository commands, DTO assumptions, and cleanup scripts. In the current shape those changes are likely to be scattered.
- Moving from SQLite to Postgres/Supabase is not only a `DATABASE_URL` change because `src/lib/prisma.ts` uses `PrismaBetterSqlite3`, `schema.prisma` uses `provider = "sqlite"`, and backup copies a DB file.

## Target Principles

- Route Handler remains the HTTP adapter only.
- Service owns use cases and transaction boundaries.
- Repository owns Prisma access and Prisma query construction.
- Mapper owns conversion between Prisma records and API/UI DTOs.
- Schema files own request/query validation and normalized input types.
- Types files own DTOs and service/repository contracts that should not depend on Prisma payload types.
- Shared API error helpers are feature-agnostic and produce consistent JSON responses.
- Shared Prisma setup remains centralized and can be swapped during a future DB migration.

## Target Directory Tree

```text
src/
  app/
    api/
      notes/
        route.ts
        [id]/
          route.ts
          review/
            route.ts
      tags/
        route.ts
      backups/
        route.ts
  features/
    notes/
      schema.ts
      types.ts
      server/
        service.ts
        repository.ts
        mapper.ts
        date.ts
    tags/
      schema.ts
      types.ts
      server/
        service.ts
        repository.ts
        mapper.ts
    backup/
      types.ts
      server/
        service.ts
        local-sqlite-provider.ts
        mapper.ts
  shared/
    api/
      errors.ts
      route.ts
    db/
      prisma.ts
    validation/
      zod.ts
```

## Adoption Decisions

| candidate | decision | reason |
|---|---|---|
| `src/features/notes/server/service.ts` | Adopt | Notes has multiple use cases: list, create, get detail, update, delete, mark reviewed. Service should own use-case sequencing, transactions, not found handling, and future autosave/Undo conflict rules. |
| `src/features/notes/server/repository.ts` | Adopt | Prisma where construction, include shape, count/findMany, upsert tags, replace cues, replace notebook tags, physical/soft delete should be isolated from HTTP handlers. |
| `src/features/notes/server/mapper.ts` | Adopt | `NoteDetailDto`, `NoteListItemDto`, and review update response should be mapped in one place so Prisma include changes do not leak into routes. |
| `src/features/notes/server/date.ts` | Adopt | Date-only conversion is repeated today and is subtle because API uses `YYYY-MM-DD` while DB stores `DateTime`. Keep it near notes or promote later to shared date utilities if reused broadly. |
| `src/features/notes/schema.ts` | Adopt | Current `notebookInputSchema`, `notesQuerySchema`, `reviewUpdateSchema`, tag/cue validation belong to the notes feature. This keeps endpoint validation close to feature DTOs. |
| `src/features/notes/types.ts` | Adopt | Define API DTOs and normalized input/query types independent of Prisma payload types. UI can import DTO types from here if needed. |
| `src/shared/api/errors.ts` | Adopt | API error body, code/status mapping, `createInvalidBodyError`, `createNotFoundError`, `createConflictError`, `createServerError` are cross-feature concerns. |
| `src/shared/api/route.ts` | Adopt | Small helpers such as `jsonError`, `parseJsonBody`, and `withRouteErrorHandling` can reduce repeated try/catch without hiding endpoint logic. Keep it thin. |
| `src/shared/db/prisma.ts` | Adopt | Rename/move `src/lib/prisma.ts` to a shared DB boundary. It remains the only place that knows the Prisma adapter setup. |
| `src/features/backup/server/*` | Adopt | Backup is a feature. Split public service from local SQLite provider so future Supabase/Postgres backup/export can replace the provider without changing route code. |
| `src/lib/**` as long-term home | Do not expand | `src/lib` is currently a catch-all. Keep compatibility during migration if needed, but new domain code should move to `features` / `shared` to make ownership visible. |
| Generic repository for all models | Do not adopt now | A generic CRUD repository would hide domain rules such as tag full replacement, date-only conversion, and delete behavior. Use feature-specific repositories. |

## Route Handler Boundary

Route Handler に残す責務:

- `Request` / path params / search params の読み取り
- feature schema への入力受け渡し
- service 呼び出し
- `NextResponse.json` / 204 response の生成
- generic API error helper による HTTP status 変換
- route-level logging only when uncaught errors reach the adapter

Route Handler から移す責務:

- Prisma query / `where` / `include` / transaction construction
- Notebook/Cue/Tag/NotebookTag の作成・更新・削除手順
- tag upsert and link creation
- Cue full replacement
- date-only string to `Date` conversion and response conversion
- DTO mapping
- not found / conflict / domain validation decisions
- backup provider details and filesystem path handling

Example final route shape:

```ts
export async function GET(request: Request) {
  return handleApiRoute(async () => {
    const query = parseNotesQuery(new URL(request.url).searchParams);
    return NextResponse.json(await listNotes(query));
  });
}
```

## Service Boundary

`features/notes/server/service.ts` should expose use cases, not database primitives.

```text
listNotes(query: NotesQuery): Promise<NoteListResponseDto>
createNote(input: NoteInput): Promise<NoteDetailDto>
getNoteDetail(id: string): Promise<NoteDetailDto>
updateNote(id: string, input: NoteInput): Promise<NoteDetailDto>
deleteNote(id: string): Promise<void>
markNoteReviewed(id: string, input: ReviewUpdateInput): Promise<ReviewUpdateResponseDto>
```

Service responsibilities:

- call repository functions in the required order
- own transaction scope for create/update/delete/autosave/Undo
- convert repository `null` result to `ApiError` / `NotFoundError`
- decide conflict behavior when draft/version is introduced
- return DTOs, not Prisma records

Service should not:

- read raw `Request`
- create `NextResponse`
- know HTTP status codes
- expose Prisma payload types to callers

## Repository Boundary

`features/notes/server/repository.ts` owns Prisma access.

Repository responsibilities:

- construct `Prisma.NotebookWhereInput` from normalized query
- define include/select shapes for list and detail
- run count and findMany with pagination
- find existing active notebook by id
- create Notebook and nested Cue rows
- replace Cue rows for a notebook
- upsert Tag rows and replace NotebookTag rows
- update review fields
- physically delete Notebook for MVP
- later, replace physical delete with soft delete implementation behind the same service command

Repository should return records in a stable internal shape accepted by mapper. Prisma payload helper types can live here or in `server/mapper.ts`, but should not be imported by route handlers.

## Mapper Boundary

`features/notes/server/mapper.ts` owns these conversions:

- Prisma/DB `DateTime | null` -> API `YYYY-MM-DD | null`
- Prisma/DB `DateTime | null` -> API ISO datetime string
- `Notebook + cues + tags` -> `NoteDetailDto`
- `Notebook + _count + tags` -> `NoteListItemDto`
- review update record -> `ReviewUpdateResponseDto`
- Tag record -> `TagDto`

Mapper should sort tags by name and cues by order as the current API does. The service can rely on repository ordering, but mapper sorting keeps API response deterministic.

## DTO Boundary

### Prisma model

Prisma model is the persistence schema only. It can include DB-specific fields and relations:

- `Notebook.noteDate: DateTime`
- `Notebook.deletedAt: DateTime?`
- relation rows such as `NotebookTag`
- future tables such as `NotebookDraftState`, `SoftDeleteBuffer`, `NoteCard`, `NoteCueLink`

Prisma model should not be treated as the API contract.

### API DTO

API DTO is the JSON contract documented in `doc/api/MVP_API_DESIGN.md`.

```text
NoteListResponseDto
  page
  totalPages
  totalCount
  data: NoteListItemDto[]

NoteListItemDto
  id
  title
  noteDate: YYYY-MM-DD
  sourceType
  sourceTitle
  overview
  summary
  cueCount
  hasSummary
  nextReviewDate: YYYY-MM-DD | null
  reviewedAt: ISO datetime | null
  tags: TagDto[]

NoteDetailDto
  NoteListItem fields except cueCount/hasSummary
  body
  cues: CueDto[]
```

When Phase 2 adds draft/version/card/link fields, add them intentionally to DTOs rather than exposing new Prisma relations automatically.

### UI DTO

The current UI can continue to consume API DTOs directly for MVP. If editor state diverges from API shape, introduce UI-only types in the UI feature/component area, for example:

- `NoteEditorState`
- `NoteDraftFormState`
- `TagTokenState`

Do not put UI-only flags such as preview visibility, local dirty flags, modal state, or hidden review body state into API DTOs unless persistence is explicitly required.

## Validation Design

Target split:

```text
src/features/notes/schema.ts
  dateStringSchema
  nullableDateStringSchema
  tagSchema
  cueSchema
  noteInputSchema
  notesQuerySchema
  reviewUpdateSchema
  parseNotesQuery(searchParams)
  parseNoteInput(json)
  parseReviewUpdateInput(json)

src/features/tags/schema.ts
  future tag management schemas only

src/shared/validation/zod.ts
  zodErrorToFieldErrors
  parseOrThrow helpers if useful
```

Validation rules that represent product behavior stay in feature schema:

- title length
- noteDate future-date block
- nextReviewDate >= noteDate
- cue text length
- tag name allowed characters
- tag max count and duplicate detection
- list query `from <= to`

Validation rules that represent transport behavior stay in shared helpers:

- JSON body parse failure
- Zod error to `{ field, message }`
- `invalid_body` vs `invalid_query`

Do not validate Prisma constraints only at repository level when they are user-correctable. Repository should still rely on DB constraints for uniqueness and referential integrity, but API validation should produce field-level errors before hitting DB when practical.

## Error Handling Design

Target split:

```text
src/shared/api/errors.ts
  ApiErrorCode
  ApiFieldError
  ApiErrorBody
  apiErrorStatus
  ApiError class
  createApiError
  createInvalidBodyError
  createInvalidQueryError
  createNotFoundError
  createConflictError
  createServerError
  toErrorResponse

src/shared/api/route.ts
  handleApiRoute(fn)
  readJsonBody(request)
```

Error policy:

- Feature services throw or return typed domain errors such as not found and conflict.
- Route helper converts known API/domain errors to `{ code, message, errors? }`.
- Unknown errors become `server_error` with public message `予期しないエラーが発生しました`.
- Internal filesystem paths and stack details are logged server-side only.
- Add `conflict` / HTTP 409 before implementing draft/autosave optimistic locking.

Current `POST /api/backups` and `GET /api/backups` can expose `error.message`; target design should stop passing raw internal error text to `createServerError` by default.

## Backup Target Design

Backup feature should have an explicit provider boundary.

```text
features/backup/types.ts
  BackupEntryDto
  BackupCreateResultDto

features/backup/server/service.ts
  listBackupEntries()
  createBackup()

features/backup/server/local-sqlite-provider.ts
  databaseUrlToPath()
  listBackups()
  createBackup()
  pruneBackups()

features/backup/server/mapper.ts
  provider entry -> API DTO
```

MVP provider:

- local SQLite file copy
- `DATABASE_URL=file:...`
- `backup/` under project root
- newest 3 generations

Future provider:

- Supabase/Postgres export or managed backup metadata
- no local DB file path assumption
- route and UI contract can remain stable if service API stays the same

`scripts/backup-copy.js` should call `features/backup/server/service.ts` or a CLI-safe wrapper. If TypeScript execution is not available for scripts, keep a small JS compatibility wrapper and document it as temporary.

## SQLite MVP vs Future Postgres/Supabase Impact

### SQLite local MVP

Current choices are acceptable for local MVP:

- Prisma + SQLite file
- physical delete for MVP
- no server-side cache
- backup by file copy
- date-only stored as UTC midnight `DateTime`
- Route Handler API

The target architecture should not force DB migration now. The goal is to make later migration localized.

### Postgres/Supabase/Vercel migration impact

Migration is not a simple environment variable change.

Required changes:

- `prisma/schema.prisma`: datasource provider from `sqlite` to `postgresql`
- `src/shared/db/prisma.ts`: remove `PrismaBetterSqlite3` adapter and use Postgres-compatible Prisma Client setup
- migration files: create Postgres migration path and validate date/index behavior
- backup: replace local SQLite file copy provider
- deployment: environment variables and secrets
- access control: add Basic-auth-like middleware before Vercel deployment if still personal-use
- testing: API CRUD, validation, backup/provider behavior, and migration verification

Architecture impact:

- Repository boundary reduces route churn during DB migration.
- Mapper boundary protects UI/API contract from Prisma relation/include changes.
- Backup provider boundary prevents filesystem assumptions from leaking into UI and route handlers.
- Service boundary gives one place to enforce future transaction and optimistic locking rules.

## Migration Task Candidates

Each task below is one purpose / one Worker task size. Do not combine broad refactors with behavior changes.

1. `API-ARCH-001`: Move shared API error helpers out of `src/lib/validation.ts`.
   - Goal: create `src/shared/api/errors.ts` and update routes to import error helpers from there.
   - Scope: no validation behavior change.
   - Verify: `npm run lint`, `npm run build`, API validation smoke test if dev server is available.

2. `API-ARCH-002`: Move Prisma singleton to `src/shared/db/prisma.ts`.
   - Goal: make DB boundary explicit.
   - Scope: update imports from `@/lib/prisma` to `@/shared/db/prisma`; optionally leave `src/lib/prisma.ts` as temporary re-export for compatibility.
   - Verify: `npx prisma validate`, `npm run lint`, `npm run build`.

3. `API-ARCH-003`: Extract notes DTO types and mapper.
   - Goal: create `src/features/notes/types.ts` and `src/features/notes/server/mapper.ts`.
   - Scope: move `formatListItem`, `formatDetail`, tag/cue response mapping, date response helpers.
   - Verify: `npm run lint`, `npm run build`, `GET /api/notes`, `GET /api/notes/:id`.

4. `API-ARCH-004`: Extract notes validation schema.
   - Goal: move note/cue/tag/query/review schemas from `src/lib/validation.ts` to `src/features/notes/schema.ts`.
   - Scope: preserve current validation messages and inferred types.
   - Verify: `npm run lint`, `npm run build`, invalid body/query API smoke tests.

5. `API-ARCH-005`: Extract notes repository read operations.
   - Goal: create read repository functions for list count/findMany and detail find.
   - Scope: no create/update/delete behavior change.
   - Verify: `npm run lint`, `npm run build`, list/detail API smoke tests.

6. `API-ARCH-006`: Extract notes service read operations.
   - Goal: create `listNotes` and `getNoteDetail` service functions returning DTOs.
   - Scope: route handlers become HTTP adapters for GET endpoints.
   - Verify: `npm run lint`, `npm run build`, list/detail API smoke tests.

7. `API-ARCH-007`: Extract notes create command.
   - Goal: move create Notebook/Cue/Tag transaction into repository/service.
   - Scope: preserve current full response and tag upsert behavior.
   - Verify: `npm run lint`, `npm run build`, `POST /api/notes` smoke test.

8. `API-ARCH-008`: Extract notes update command.
   - Goal: move not found check, Notebook update, Cue full replace, NotebookTag full replace, tag upsert into service/repository.
   - Scope: no optimistic locking yet.
   - Verify: `npm run lint`, `npm run build`, `PATCH /api/notes/:id` smoke test.

9. `API-ARCH-009`: Extract notes delete command.
   - Goal: move MVP physical delete behind `deleteNote(id)`.
   - Scope: behavior remains 204 physical delete.
   - Verify: `npm run lint`, `npm run build`, delete smoke test. This creates the future seam for soft delete/Undo.

10. `API-ARCH-010`: Extract review update command.
    - Goal: move `POST /api/notes/:id/review` logic into notes service/repository/mapper.
    - Scope: preserve current `reviewedAt` and `nextReviewDate` behavior.
    - Verify: `npm run lint`, `npm run build`, review API smoke test.

11. `API-ARCH-011`: Extract tags feature read service.
    - Goal: create `src/features/tags/server/repository.ts`, `service.ts`, `mapper.ts`, `types.ts`.
    - Scope: only `GET /api/tags`.
    - Verify: `npm run lint`, `npm run build`, `GET /api/tags`.

12. `API-ARCH-012`: Move backup to feature provider structure.
    - Goal: create `src/features/backup/server/local-sqlite-provider.ts` and service wrapper.
    - Scope: preserve `GET /api/backups`, `POST /api/backups`, and `npm run backup:copy` behavior.
    - Verify: `npm run lint`, `npm run build`, `npm run backup:copy`, backup API smoke test.

13. `API-ARCH-013`: Make backup API errors user-safe.
    - Goal: stop returning internal filesystem paths in API `message`.
    - Scope: route/service error mapping only.
    - Verify: `npm run lint`, `npm run build`, simulate invalid `DATABASE_URL` or missing DB where practical.

14. `API-ARCH-014`: Add conflict error type before draft/autosave work.
    - Goal: add `conflict` / 409 support in shared API errors.
    - Scope: no endpoint should emit it yet unless draft work starts.
    - Verify: `npm run lint`, `npm run build`.

15. `API-ARCH-015`: Design and implement draft/autosave service boundary.
    - Goal: add `NotebookDraftState` transaction command and version comparison in service/repository, not route.
    - Scope: requires separate DB migration and UI/API contract task.
    - Verify: Prisma migration, lint, build, conflict API tests.

16. `API-ARCH-016`: Design and implement soft delete/Undo boundary.
    - Goal: replace `deleteNote` internals with soft delete and `SoftDeleteBuffer`; add undo service.
    - Scope: separate from mapper/validation refactors.
    - Verify: Prisma migration, lint, build, delete/undo/purge tests.

17. `API-ARCH-017`: DB provider migration spike for Postgres/Supabase.
    - Goal: document exact changes needed for Prisma datasource, client setup, migrations, backup provider, and deployment env.
    - Scope: docs/spike only unless approved.
    - Verify: no runtime validation required beyond file existence and referenced commands if not changing code.

## Recommended Order

1. Shared API errors and shared Prisma move.
2. Notes mapper/types extraction.
3. Notes validation extraction.
4. Notes read repository/service.
5. Notes command repository/service.
6. Tags and backup feature extraction.
7. User-safe backup errors.
8. Only after that, draft/autosave or Undo DB changes.

Reason: extract pure boundaries before changing behavior. This keeps every Worker task verifiable and reduces the chance of mixing architecture movement with feature bugs.

## Open Questions

| ID | question | recommended decision |
|---|---|---|
| Q-001 | Keep MVP physical delete until Undo task, or switch earlier because `deletedAt` exists? | Keep physical delete until a dedicated Undo task. Extract `deleteNote` first so behavior can change later behind service. |
| Q-002 | Should UI import DTO types from `features/notes/types.ts`? | Yes for API response/request DTOs. Keep UI-only state types near UI components. |
| Q-003 | Should date helpers be shared globally now? | Keep in `features/notes/server/date.ts` first. Promote to shared only when another feature needs the same date-only policy. |
| Q-004 | Should backup stay CommonJS? | Temporarily yes if needed for CLI compatibility. Target architecture should still name it as local SQLite provider and keep route behavior provider-agnostic. |
| Q-005 | Should repository return DTOs directly? | No. Repository returns persistence records; mapper creates DTOs. This keeps DB access and API contract separate. |

## Verification

This task produced a design summary only. No code, configuration, dependency, schema, or image file was changed.

Commands run:

| command | result |
|---|---|
| `git status --short` before | Dirty worktree confirmed. Existing modified/untracked files were present before this task. |
| `rg --files src/app/api src/lib prisma scripts doc summary/20260705 AGENTS.md HANDOFF_2026-07-04.md` | Target files located. |
| `sed` / `nl -ba` on target docs and code | Current responsibilities and line-level structure reviewed. |

## Next Read

Next Worker should start from:

- `summary/20260705/target-api-data-architecture.md`
- `summary/20260705/api-data-lib-architecture-inventory-report.md`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
- `src/lib/validation.ts`
- `src/lib/prisma.ts`
- `src/lib/backup/index.js`
