# Manager MVP API CRUD Validation Backup Reverification Report

## Environment

| Item | Result |
|---|---|
| Date | 2026-07-05 |
| Target | `http://127.0.0.1:3000` |
| Server | `npm run dev -- -H 127.0.0.1 -p 3000` |
| DB | `dev.db` |
| Reason for Manager rerun | Worker report could not execute localhost API because Worker sandbox hit `listen EPERM`; Manager reran with approved localhost access. |

## Scenarios

| ID | Scenario | Status |
|---|---|---|
| S-001 | `POST /api/notes` creates note with tag and Cue | PASS |
| S-002 | `GET /api/notes/:id` returns detail | PASS |
| S-003 | `PATCH /api/notes/:id` replaces Cue and Tag relations | PASS |
| S-004 | `POST /api/notes/:id/review` updates `reviewedAt` and nullable `nextReviewDate` | PASS |
| S-005 | `GET /api/notes` supports `query`, `tag`, `from`, `to`, `reviewDue`, `page` | PASS |
| S-006 | `GET /api/tags` returns name-sorted tags | PASS |
| S-007 | Validation errors return `{ code, message, errors }` for empty title, future noteDate, invalid nextReviewDate, duplicate tags, empty Cue, and From > To query | PASS |
| S-008 | Missing note routes return not_found JSON for GET/PATCH/DELETE/review | PASS |
| S-009 | `DELETE /api/notes/:id` returns 204, then detail returns 404 | PASS |
| S-010 | `GET /api/backups` lists backups and `POST /api/backups` creates/prunes to latest 3 generations | PASS |

## Findings

| ID | Severity | 内容 |
|---|---|---|
| F-001 | Info | Runtime API behavior matches MVP expectations for CRUD, search, validation, not_found, review update, tag listing, and backup prune. |
| F-002 | Info | Worker-created report `summary/20260705/mvp-api-crud-validation-backup-report.md` remains useful for documenting Worker sandbox limitation, but this Manager reverification is the runtime API result. |

## Cleanup

| Item | Result |
|---|---|
| Verification notebooks | Deleted through API cleanup in the verification script. |
| Verification tags | Removed from `dev.db` with `sqlite3` for names starting with `API検証`. Count after cleanup: `0`. |
| Backup files | Backup API intentionally left latest 3 `.db` files: `backup/2026-07-05T02-07-43.db`, `backup/2026-07-05T02-07-44.db`, `backup/2026-07-05T02-07-45.db`. |

## Verification Commands

| Command | Result |
|---|---|
| `npm run dev -- -H 127.0.0.1 -p 3000` | PASS |
| Node fetch API verification script against `127.0.0.1:3000` | PASS: all 11 checks passed |
| `sqlite3 dev.db "DELETE ... API検証 ...; SELECT COUNT(*) ..."` | PASS: notebooks/tags count `0` |
| `find backup -maxdepth 1 -type f -print \| sort` | PASS: latest 3 backup files retained |

## Next Read

- `summary/20260705/manager-mvp-api-crud-validation-backup-reverification-report.md`
- `summary/20260705/mvp-api-crud-validation-backup-report.md`
- `doc/review/MVP_DETAIL_GAP_INVENTORY.md`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
- `src/app/api/notes/[id]/review/route.ts`
- `src/app/api/tags/route.ts`
- `src/app/api/backups/route.ts`
