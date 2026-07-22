# Cornell Method review checklist

Use this checklist after resolving the changed behavior and affected runtime path. Apply only the sections relevant to the diff; do not create findings merely because a checklist item exists.

### A. Current MVP contract and scope

Check that the change preserves or intentionally updates the current contract:

- Canonical routes remain `/notes`, `/notes/new`, `/notes/[id]`, and `/backup`.
- Current APIs remain the documented notes, review, tags, and backups endpoints.
- Save is explicit; current MVP does not silently acquire autosave, draft,
  optimistic-lock, or `409` semantics.
- Note update replaces the submitted Cue and Tag relations as a complete set.
- Delete remains confirmation followed by physical deletion for the current MVP;
  `deletedAt` is not evidence of current soft-delete behavior.
- Review uses `nextReviewDate` and `reviewedAt` in the detail route; a dedicated
  review-task workflow is Phase 2.
- New notes start with `nextReviewDate = noteDate + 7 days`, while existing notes
  are not silently backfilled and an explicit review date is not moved when
  `noteDate` changes.
- Legacy Markdown notes remain readable and are not automatically converted to
  Canvas.

Flag Phase 2 work mixed into an MVP bug fix or refactor unless the contract and
scope are explicitly changed together.

### B. Next.js App Router and HTTP boundary

Check that:

- `src/app/**` remains a thin routing, page/layout, or HTTP-adapter layer.
- `page.tsx` is a Server Component by default and adds `"use client"` only for a
  real browser/state/event requirement.
- Client Components do not import Prisma, filesystem code, server application,
  or other server-only modules.
- Route Handlers parse request data at the boundary with the shared Zod contract,
  delegate to the server application layer, and translate results into the
  established HTTP response shape.
- Route Handlers do not contain Prisma transactions, persistence mapping, or UI
  state logic.
- Dynamic route params follow the installed Next.js version and the repository's
  established route-context shape.
- Request and response status codes remain consistent, including `201`, `204`,
  `400`, `404`, and `500` behavior.
- `204` responses are not parsed as JSON.
- Mutations refresh, replace, or refetch the relevant UI state without exposing
  stale data.
- Cache options are deliberate for server-side detail reads and do not return a
  stale note immediately after an update or deletion.
- Browser-only globals are not evaluated during server rendering.

### C. React components and hooks

Check that:

- State has a single owner and values derivable from props or existing state are
  not copied into synchronized state without a real lifecycle reason.
- Effects are used for external synchronization, not routine derived-value
  calculation or event handling.
- Effect and callback dependencies are complete; stale closures cannot commit an
  old Canvas document or overwrite a newer form state.
- Timers, listeners, Fabric/Konva objects, observers, and subscriptions are
  removed or disposed on cleanup.
- Rapid submit or repeated clicks cannot create duplicate notes or interleave
  conflicting state transitions.
- Pending, error, empty, partial, and success states are distinguishable.
- Refs used to bridge imperative Canvas runtime and React state remain in sync
  with the authoritative state.
- `useMemo`, `useCallback`, and `memo` have a concrete identity or performance
  purpose; they are not added mechanically.
- A component is split when it owns an independently nameable UI responsibility,
  contract, or test boundary—not merely because it has many lines.
- A custom hook represents one coherent stateful behavior with clear inputs,
  outputs, side effects, cleanup, and errors. Do not accept moving a giant
  component wholesale into a giant hook as an architectural improvement.
- Keyboard access, focus, labels, `aria-*`, alert semantics, and responsive
  behavior are preserved.

### D. TypeScript, Zod, DTOs, and dates

Check that:

- `strict` TypeScript assumptions are preserved; `any`, unsafe assertions,
  non-null assertions, or broad `unknown as` casts do not bypass a real boundary.
- Runtime input is validated with the shared Zod contract before trusted use.
- DTO types, request schemas, response types, UI form state, and Prisma record
  shapes are not treated as interchangeable.
- Form-only values such as empty strings, pending UI flags, and field errors stay
  in the UI model rather than leaking into API DTOs.
- Discriminated behavior such as `bodyMode: "canvas" | "markdown"` remains
  exhaustive and maintains its payload invariants.
- API errors keep the established `{ code, message, errors? }` shape, and field
  errors point to usable fields.
- Date-only values stay `YYYY-MM-DD` across UI and HTTP boundaries.
- Conversion to Prisma `DateTime` uses the shared UTC/date-only policy and does
  not introduce timezone-dependent off-by-one-day behavior.
- Month-end, leap-year, and year-end behavior is covered when date arithmetic
  changes.

### E. Modular architecture and dependency direction

Apply the target architecture pragmatically:

- `src/app/**`: thin route/page/layout adapters only.
- `src/modules/<domain>/ui/**`: React components, hooks, form state, and browser
  interaction.
- `src/modules/<domain>/remote/**`: fetch, query serialization, HTTP error
  decoding, and DTO transport; no React, Prisma, filesystem, or server logic.
- `src/modules/<domain>/contracts/**`: stable request/response types, Zod schemas,
  errors, and date/null conventions.
- `src/modules/<domain>/model/**` and `lib/**`: UI/domain transformations and
  pure helpers that do not belong to rendering or transport.
- `src/server/<domain>/application/**`: use cases and transaction policy; no
  `NextResponse`, React, or UI state.
- `src/server/<domain>/infrastructure/**`: Prisma/filesystem/external adapters;
  no Route Handler or React dependency.
- `src/server/<domain>/presenters/**`: persistence-to-DTO mapping.
- `src/shared/**`: genuinely cross-domain code; do not move notes-specific logic
  there merely to shorten an import.

Prefer existing public facades where the module defines them. Flag a dependency
violation when it creates a real server/client bundling problem, contract leak,
change-coupling problem, or testability regression. Do not demand layers or
interfaces solely to satisfy an abstract pattern.

### F. Prisma, SQLite, and data integrity

Check that:

- Notebook, Canvas, Cue, and Tag relation writes that represent one note save are
  atomic in a Prisma transaction.
- Create/update does not leave partially replaced relations after an error.
- `bodyMode="canvas"` stores an empty legacy `body` and a valid
  `NotebookCanvas`; `bodyMode="markdown"` does not accept or retain an
  unintended Canvas relation.
- `CanvasDocumentV1.schemaVersion`, page, elements, styles, geometry, z-order,
  and text survive save and read-back.
- Canvas page resize changes only page dimensions; it does not move, scale,
  delete, clip, or rewrite existing elements.
- Canvas `searchText` is regenerated from the canonical text elements when the
  document changes and is not changed by page-size-only edits.
- Cue order is contiguous after removal/replacement when the UI relies on it.
- Tags remain limited to 12 per note and duplicate names are rejected using the
  contract's normalization rules.
- Physical note deletion relies on intended cascade behavior and does not claim
  Undo or recovery that the MVP does not provide.
- Queries keep the documented page size, ordering, deleted-record filtering,
  date range behavior, tag OR semantics, and total-count consistency.
- Prisma records do not leak directly as public API DTOs.
- Schema changes include an appropriate migration and preserve existing data,
  especially legacy Markdown notes and Canvas JSON.

### G. Canvas runtime

Treat Canvas changes as high-risk because static checks cannot prove browser
interaction correctness.

Check that:

- `CanvasDocumentV1`, not Fabric/Konva object shape, remains the saved contract.
- Renderer-specific metadata does not leak into the persisted JSON contract.
- Initial-document corruption fails safely and does not overwrite stored data.
- History snapshots are immutable enough that undo/redo cannot be mutated by a
  later runtime object change.
- Undo/redo, style updates, inline shape text, eraser, selection, and document
  notification agree on one current document.
- The sticky tool policy remains deliberate.
- Line/arrow/rect/ellipse creation respects the current drag threshold and small
  click/double-click separation.
- Shape inline-text commit/cancel preserves the original shape and unrelated
  elements.
- Whole-object eraser removes only hit app-owned objects.
- Page dimensions remain integer values in the allowed range and describe paper
  size, not zoom.
- Large Canvas documents do not trigger avoidable full serialization or React
  rerender loops on every pointer event.
- Fabric/runtime listeners and objects are disposed during remount, route change,
  or error recovery.

Require browser runtime evidence for changed pointer, wheel, touch, inline text,
history, save/reload, and responsive behavior. Report missing runtime evidence as
a verification gap unless the absence itself makes the change unsafe to merge.

### H. Markdown and security

Check that:

- User-authored Markdown continues through `react-markdown` with
  `rehype-sanitize` or an equally safe explicit policy.
- Untrusted content is not sent to `dangerouslySetInnerHTML`, executable URLs,
  raw HTML, or an unsanitized plugin path.
- Preview checkboxes remain display-only when that is the contract.
- External links use an appropriate `rel` with a new browsing context.
- Error logs and responses do not expose secrets, raw environment values, or
  unnecessary local filesystem paths.
- A change that exposes the app beyond local personal use is treated as a scope
  and threat-model change. The current authentication-free API must not be
  described as safe for shared or public deployment.
- New external network calls, telemetry, or cloud services require an explicit
  product and privacy decision.

Do not raise generic authorization findings for unchanged local-only behavior.
Raise them when the change introduces shared/public access or weakens a newly
added trust boundary.

### I. Backup and destructive operations

Check that:

- Only a `file:` SQLite `DATABASE_URL` is accepted by the local backup provider.
- Path decoding and resolution cannot cause pruning outside the intended backup
  directory.
- The source exists and is a regular file before copying.
- Backup listing and pruning consider only intended `.db` entries.
- The newest three generations are retained deterministically and stale entries
  are removed only after a successful copy.
- Filename generation cannot silently overwrite a distinct backup under the
  expected call pattern.
- API and CLI paths use the same provider behavior.
- A backup failure is surfaced without deleting a valid existing generation.
- Tests use disposable directories and do not touch the developer's real DB or
  backups.
- Physical note deletion still requires explicit UI confirmation and returns the
  documented result.

### J. Performance and resource safety

Report performance findings only with a plausible input size or call frequency.
Check for:

- N+1 Prisma queries or per-row network requests
- unbounded result sets where the API contract requires pagination
- repeated parsing/cloning/serialization of large Canvas JSON in hot pointer
  paths
- excessive React state updates during Canvas interaction
- leaked Fabric objects, event listeners, timers, or browser resources
- redundant DB reads or writes inside a transaction
- blocking filesystem work added to a frequently called request path
- premature caching or memoization with incorrect invalidation

Do not request micro-optimizations without evidence.

### K. Tests and verification evidence

Check that:

- A bug fix contains a regression case that fails before the fix where feasible.
- Changed validation includes valid, invalid, omitted, boundary, and duplicate
  cases.
- Changed persistence includes create/update/read-back and rollback behavior.
- Changed date logic covers month-end/year-end and timezone-safe serialization.
- Changed delete/review behavior covers not found and repeated operations.
- Changed Canvas behavior has browser runtime coverage appropriate to the
  interaction, not only unit/static evidence.
- Static implementation, API runtime, and browser runtime are reported as
  separate evidence levels.
- Documentation and acceptance matrices are updated when the contract or verified
  status changes.

A missing test is a finding only when it leaves a meaningful changed behavior
unprotected. Name the exact test scenario to add.
