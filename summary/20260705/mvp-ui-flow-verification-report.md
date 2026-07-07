# MVP UI Flow Verification Report

## Environment

| Item | Result |
|---|---|
| Date | 2026-07-05 |
| Worker role | Worker Codex |
| Repository | `/Users/blp542/Desktop/自己学習/Cornell-Method` |
| Initial git status | `?? summary/20260705/1005-verify-mvp-ui-flow-cc309777-summary.md` |
| App start attempt | `npm run dev` failed with `listen EPERM: operation not permitted 0.0.0.0:3000` |
| App start retry | `npx next dev -H 127.0.0.1 -p 3000` failed with `listen EPERM: operation not permitted 127.0.0.1:3000` |
| Existing local server check | `curl http://127.0.0.1:3000/notes` failed to connect |
| Browser / Playwright UI run | NOT RUN because the sandbox refused local port binding |
| Static verification | Source files and validation paths inspected |
| Validation commands | `npm run lint` PASS, `npx prisma validate` PASS |

## Scenarios

| ID | Scenario | Status | Result / Evidence |
|---|---|---|---|
| S-001 | `/` redirects or leads to `/notes` | PARTIAL | Static check only. `src/app/page.tsx` calls `redirect("/notes")`. Browser confirmation was not possible. |
| S-002 | `/notes` initial display handles empty or existing data | PARTIAL | Static check only. `NotesList` has loading, empty, error, result, and pagination states. Browser confirmation was not possible. |
| S-003 | `/notes/new` accepts title, date, source, overview, body, Cue, tag, summary, next review date and saves | PARTIAL | Static check only. `NoteEditor` exposes these fields and posts to `/api/notes`. Browser save was not possible. |
| S-004 | Save from `/notes/new` navigates to detail and renders entered content | PARTIAL | Static check only. `NoteEditor.save()` uses response `id`, then `router.push("/notes/:id")` and `router.refresh()`. Browser confirmation was not possible. |
| S-005 | `/notes/[id]` switches view, edit, and review modes | PARTIAL | Static check only. `NoteDetailModes` has `mode: "view" | "edit" | "review"` and buttons for 編集 / 復習 / 閲覧へ戻る. Browser confirmation was not possible. |
| S-006 | UI-014: edit mode save returns to view and shows latest values | FAIL | Code-level verification indicates likely failure. `PATCH` returns updated detail, but `NoteEditor` discards it. `NoteDetailModes` keeps `note` and `mode` in client state and does not update them after edit save. `router.refresh()` does not explicitly reset that state to view/latest data. Browser confirmation was blocked by local port `EPERM`. |
| S-007 | Review mode hides body initially, toggles body, and updates reviewed status | PARTIAL | Static check only. `showBody=false` when entering review, buttons show/hide body, and `POST /api/notes/:id/review` updates local `note.reviewedAt` / `nextReviewDate` then returns to view. Browser confirmation was not possible. |
| S-008 | `/notes` title search, date From/To, tag selection, review due filter, paging | PARTIAL | Static check only. `NotesList` sends `query`, `from`, `to`, `tag`, `reviewDue`, and `page`; API route handles each. Browser/API live confirmation was not possible. |
| S-009 | From > To date validation appears in UI | PARTIAL | Static check only. `NotesList` sets `dateError` on blur and submit with `開始日は終了日以前の日付を指定してください。`. Browser confirmation was not possible. |
| S-010 | Markdown preview checkbox is display-only and does not mutate saved value | PARTIAL | Static check only. `MarkdownPreview` overrides `input[type=checkbox]` with `readOnly`, `tabIndex={-1}`, and `preventDefault` on click/change. Browser confirmation was not possible. |
| S-011 | Detail delete cancel keeps note; confirm deletes and returns to `/notes` | PARTIAL | Static check only. `deleteNote()` uses `window.confirm`; cancel returns early, confirm calls `DELETE /api/notes/:id` then `router.push("/notes")`. Browser confirmation was not possible. |
| S-012 | `/backup` displays list, creates backup, shows success/error/empty states | PARTIAL | Static check only. `BackupPage` loads `/api/backups`, posts `/api/backups`, shows loading, empty, success, and error states. Browser confirmation was not possible. |
| S-013 | Existing tag candidate selection in `/notes/new` | FAIL | Code-level verification. `NoteEditor.TagInput` is free-text only and does not call `GET /api/tags`; existing-tag select/autocomplete is only present on `/notes`. This matches existing inventory `UI-009`. |
| S-014 | Dev server startup for UI verification | FAIL | Both `npm run dev` and `npx next dev -H 127.0.0.1 -p 3000` failed with `listen EPERM`; no existing server was reachable. |

## Findings

### F-001

| Field | Value |
|---|---|
| ID | F-001 |
| Severity | Blocker |
| Screen | All UI screens |
| Expected | Local app starts so `/`, `/notes`, `/notes/new`, `/notes/[id]`, and `/backup` can be verified in browser or Playwright. |
| Actual | Local port binding is refused by the execution environment: `listen EPERM` for both `0.0.0.0:3000` and `127.0.0.1:3000`. |
| Reproduction | Run `npm run dev`; retry with `npx next dev -H 127.0.0.1 -p 3000`; then `curl -I --max-time 2 http://127.0.0.1:3000/notes`. |
| Likely Files | Environment / sandbox limitation, not an app source file. |

### F-002

| Field | Value |
|---|---|
| ID | F-002 |
| Severity | High |
| Screen | `/notes/[id]` edit mode |
| Expected | After saving in edit mode, the detail screen returns to view mode and shows the updated values. |
| Actual | Code-level verification indicates this is likely not satisfied. `NoteEditor` receives the updated API response but only extracts `id`; it does not pass updated data back to `NoteDetailModes`. `NoteDetailModes` stores `note` and `mode` in client state, and no callback sets latest `note` or `mode="view"` after edit save. |
| Reproduction | Static path: open `src/app/notes/_components/note-editor.tsx`, inspect `save()`, then open `src/app/notes/_components/note-detail-modes.tsx` edit branch. Browser reproduction could not be run because of F-001. |
| Likely Files | `src/app/notes/_components/note-editor.tsx`, `src/app/notes/_components/note-detail-modes.tsx` |

### F-003

| Field | Value |
|---|---|
| ID | F-003 |
| Severity | Medium |
| Screen | `/notes/new`, `/notes/[id]` edit mode |
| Expected | Note editor can select existing tag candidates as well as add free-text tags. |
| Actual | `TagInput` is free-text only. It does not fetch `/api/tags` or render existing candidates. `/notes` has existing-tag selection for search filters only. |
| Reproduction | Static path: inspect `TagInput` in `src/app/notes/_components/note-editor.tsx`; no `fetch("/api/tags")`, select, or autocomplete exists. |
| Likely Files | `src/app/notes/_components/note-editor.tsx`, `src/app/api/tags/route.ts` |

## Recommended Next Tasks

| Task | Scope | Suggested queue | Reason |
|---|---|---|---|
| Fix UI-014 edit-save state transition | Add an edit-save success callback from `NoteEditor` to `NoteDetailModes`, update local `note` from the PATCH response, and set mode back to `view`. | `codex-queue/tasks-ui` | Current code likely leaves stale client state or edit mode after saving. This is the highest-risk MVP UI gap. |
| Add existing tag candidate selection to NoteEditor | Fetch `/api/tags` in `NoteEditor` or a focused tag picker and allow choosing existing tags without duplicate insertion. | `codex-queue/tasks-ui` | Required by MVP scenario and already tracked as `UI-009`. |
| Re-run browser UI verification in a port-enabled environment | Use Playwright or manual browser verification for the same scenario list and replace `PARTIAL` statuses with actual PASS/FAIL. | `codex-queue/tasks-ui` | This run could not bind localhost, so true UI behavior remains unverified. |

## Verification Commands

| Command | Result |
|---|---|
| `git status --short` | PASS; initial status showed only `?? summary/20260705/1005-verify-mvp-ui-flow-cc309777-summary.md` |
| `npm run dev` | FAIL; `listen EPERM: operation not permitted 0.0.0.0:3000` |
| `npx next dev -H 127.0.0.1 -p 3000` | FAIL; `listen EPERM: operation not permitted 127.0.0.1:3000` |
| `curl -I --max-time 2 http://127.0.0.1:3000/notes` | FAIL; no server reachable |
| `lsof -nP -iTCP -sTCP:LISTEN \| rg '(:3000\|next\|node)'` | No listening Next/Node server found |
| `npm run lint` | PASS |
| `npx prisma validate` | PASS |

## Next Read

次回作業では raw log ではなく、以下を起点にしてください。

- `summary/20260705/mvp-ui-flow-verification-report.md`
- `doc/review/MVP_DETAIL_GAP_INVENTORY.md`
- `doc/testing/TEST_SCENARIOS.md`
- `src/app/notes/_components/note-detail-modes.tsx`
- `src/app/notes/_components/note-editor.tsx`
- `src/app/notes/_components/notes-list.tsx`
- `src/app/backup/page.tsx`
