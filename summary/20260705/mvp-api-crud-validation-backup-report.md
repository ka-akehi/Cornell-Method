# MVP API CRUD Validation Backup Report

## Environment

| Item | Result |
|---|---|
| Date | 2026-07-05 |
| Target | `http://127.0.0.1:3000` |
| Runtime | Next.js dev server |
| DB | `dev.db` |
| Initial localhost check | `curl -I --max-time 3 http://127.0.0.1:3000/notes` failed: connection refused |
| Dev server start | `npm run dev -- -H 127.0.0.1 -p 3000` failed |
| Failure reason | `listen EPERM: operation not permitted 127.0.0.1:3000` |
| API execution | NOT RUN because the sandbox did not permit binding localhost port 3000 |
| Fallback executed | `npm run backup:copy` repeated 4 times to verify backup helper prune behavior |

## Scenarios

| ID | Scenario | Status | Notes |
|---|---|---|---|
| S-001 | Start or reuse Next.js dev server on `127.0.0.1:3000` | FAIL | No server was running. Starting dev server failed with `listen EPERM: operation not permitted 127.0.0.1:3000`. |
| S-002 | `POST /api/notes` normal create with new tag and Cue | NOT RUN | Blocked by localhost bind failure. |
| S-003 | `GET /api/notes/:id` detail fetch | NOT RUN | Blocked by localhost bind failure. |
| S-004 | `PATCH /api/notes/:id` update with Cue / Tag full replacement and new tag auto-create | NOT RUN | Blocked by localhost bind failure. |
| S-005 | `POST /api/notes/:id/review` updates `reviewedAt` and `nextReviewDate` | NOT RUN | Blocked by localhost bind failure. Static read shows route accepts optional `nextReviewDate` and writes `null` when omitted/null, but localhost API was not executed. |
| S-006 | `GET /api/notes` query filters: `query`, `tag`, `from`, `to`, `reviewDue`, `page` | NOT RUN | Blocked by localhost bind failure. Static read confirms MVP uses `tag`, not `tags`. |
| S-007 | `GET /api/tags` returns name-ascending tags | NOT RUN | Blocked by localhost bind failure. |
| S-008 | `DELETE /api/notes/:id` returns 204, then detail returns not_found JSON | NOT RUN | Blocked by localhost bind failure. |
| S-009 | validation: empty title | NOT RUN | Blocked by localhost bind failure. |
| S-010 | validation: future `noteDate` | NOT RUN | Blocked by localhost bind failure. |
| S-011 | validation: `nextReviewDate < noteDate` | NOT RUN | Blocked by localhost bind failure. |
| S-012 | validation: duplicate tags | NOT RUN | Blocked by localhost bind failure. |
| S-013 | validation: empty Cue | NOT RUN | Blocked by localhost bind failure. |
| S-014 | validation: `from > to` query | NOT RUN | Blocked by localhost bind failure. |
| S-015 | not_found: missing note id for GET/PATCH/DELETE/review | NOT RUN | Blocked by localhost bind failure. |
| S-016 | `GET /api/backups` returns `{ backups: [] \| Backup[] }` | NOT RUN | Blocked by localhost bind failure. |
| S-017 | `POST /api/backups` creates backup and keeps latest 3 generations | PARTIAL | API was not runnable. Fallback `npm run backup:copy` uses the same `src/lib/backup/index.js` helper and passed: after 4 backup copies, `backup/` contained only the latest 3 `.db` files. |

## Findings

| ID | Severity | Finding |
|---|---|---|
| F-001 | Blocker | The sandbox prevented starting the required localhost dev server. Expected: `next dev` binds `127.0.0.1:3000`. Actual: `listen EPERM: operation not permitted 127.0.0.1:3000`. Repro: run `npm run dev -- -H 127.0.0.1 -p 3000`. Estimated target: execution environment permission, not application code. Next task candidate: rerun this exact API verification in an environment that permits localhost port binding. |
| F-002 | Info | Because the API could not be reached, CRUD / validation / not_found / search / tags / review scenarios are `NOT RUN`; no API-created Notebook cleanup was needed. |
| F-003 | Info | Backup helper prune behavior passed via `npm run backup:copy`. Before fallback verification, `backup/` had 3 files. After 4 backup copies, only `2026-07-05T02-03-20.db`, `2026-07-05T02-03-21.db`, and `2026-07-05T02-03-22.db` remained. |
| F-004 | Info | Static route read matched the MVP API design shape: `GET /api/notes` accepts `query`, `tag`, `from`, `to`, `reviewDue`, `page`; `POST/PATCH /api/notes` use `notebookInputSchema`; `DELETE /api/notes/:id` physically deletes and returns 204; `POST /api/notes/:id/review` updates `reviewedAt` and nullable `nextReviewDate`; `GET /api/tags` orders by name ascending; backup routes call `listBackups()` / `createBackup()`. This is not a substitute for localhost runtime verification. |

## Cleanup

| Item | Result |
|---|---|
| Verification notebooks | None created because localhost API was not runnable. |
| Verification tags | None created because localhost API was not runnable. |
| SQLite DB | `dev.db` was not intentionally modified by API verification. |
| Backup files | Runtime backup files were intentionally created by fallback verification and left in place. Current retained files are the latest 3 generations in `backup/`. |
| Dev server | No running dev server session remained; startup failed before a session was established. |

## Verification Commands

| Command | Result |
|---|---|
| `git status --short` | PASS: captured pre-task dirty worktree. Existing unrelated modified files and summary files were present before this task. |
| `curl -sS -I --max-time 3 http://127.0.0.1:3000/notes` | FAIL: connection refused, no existing server. |
| `npm run dev -- -H 127.0.0.1 -p 3000` | FAIL: `listen EPERM: operation not permitted 127.0.0.1:3000`. |
| `sed -n ... src/app/api/notes/route.ts`, `src/app/api/notes/[id]/route.ts`, `src/app/api/notes/[id]/review/route.ts`, `src/app/api/tags/route.ts`, `src/app/api/backups/route.ts`, `src/lib/validation.ts`, `src/lib/backup/index.js` | PASS: static implementation read completed. |
| `ls -la backup` before fallback | PASS: 3 `.db` files existed. |
| `npm run backup:copy && sleep 1 && npm run backup:copy && sleep 1 && npm run backup:copy && sleep 1 && npm run backup:copy && ls -la backup` | PASS: backup helper created files and pruned to latest 3. |

## Next Read

- `summary/20260705/mvp-api-crud-validation-backup-report.md`
- `doc/api/MVP_API_DESIGN.md`
- `doc/testing/TEST_SCENARIOS.md`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
- `src/app/api/notes/[id]/review/route.ts`
- `src/app/api/tags/route.ts`
- `src/app/api/backups/route.ts`
- `src/lib/validation.ts`
- `src/lib/backup/index.js`
