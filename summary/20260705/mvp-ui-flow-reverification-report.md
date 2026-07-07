# MVP UI Flow Reverification Report

## Environment

| Item | Result |
|---|---|
| Date | 2026-07-05 |
| Target | `http://127.0.0.1:3000` |
| Server | `npm run dev -- -H 127.0.0.1 -p 3000` |
| Browser | Playwright Chromium headless |
| Network permission | escalated local connection to `127.0.0.1:3000` |

## Scenarios

| ID | Scenario | Status | Notes |
|---|---|---|---|
| S-001 | `/` redirects to `/notes` | PASS | URL ended with `/notes`. |
| S-002 | `/notes` initial display | PASS | `ノート一覧` heading and main `新規作成` link displayed. |
| S-003 | `/notes/new` create with existing tag candidate and free tag | PASS | Existing tag was loaded from `GET /api/tags`; selected existing tag and free-input tag both rendered after save. |
| S-004 | `/notes/[id]` edit save updates detail and returns to view mode | PASS | Updated title and summary appeared under `閲覧モード`. |
| S-005 | Review mode hides body, toggles body, and marks reviewed | PASS | Body started hidden, could be shown, and review update returned to view mode. |
| S-006 | `/notes` query/date/tag filters and From > To validation | PASS | Search result appeared with query/date/tag filters; invalid range displayed validation message. |
| S-007 | Delete cancel keeps note; confirm deletes note | PASS | Cancel left detail page intact; confirm redirected to `/notes`; API returned 404 for deleted note. |
| S-008 | `/backup` lists and creates backup | PASS | Backup page displayed; backup creation produced success text and `.db` entry. |

## Findings

| ID | Severity | 内容 |
|---|---|---|
| F-001 | Info | Earlier failures in this verification were Playwright selector issues: `新規作成`, `追加`, and `バックアップ` matched multiple elements unless `main` / `exact: true` was used. They were not app failures. |
| F-002 | Info | Backup creation generated backup DB files as expected. |
| F-003 | Info | Temporary verification notes were deleted through the API; temporary `既存タグ...` / `新規タグ...` tag masters were removed from `dev.db` with `sqlite3`. |

## Verification Commands

| Command | Result |
|---|---|
| `curl -I --max-time 5 http://127.0.0.1:3000/notes` | PASS |
| Playwright main flow script | PASS for S-001 through S-006; delete scenario was rerun separately with a focused note. |
| Playwright delete script | PASS |
| Playwright backup script | PASS |
| `curl 'http://127.0.0.1:3000/api/notes?query=UI%E6%A4%9C%E8%A8%BC'` after cleanup | PASS: `totalCount: 0` |
| `sqlite3 dev.db "SELECT COUNT(*) FROM tags WHERE name LIKE '既存タグ%' OR name LIKE '新規タグ%';"` | PASS: `0` |

## Runtime Changes

- `dev.db` was changed during verification because notes/tags were created, updated, reviewed, deleted, and cleanup was performed.
- `backup/` received backup files from the backup UI verification.
- `.next/` may have runtime event files from the dev server.

## Next Read

- `summary/20260705/mvp-ui-flow-reverification-report.md`
- `summary/20260705/manager-fix-ui009-note-editor-tag-candidates-summary.md`
- `summary/20260705/manager-fix-ui014-edit-save-state-summary.md`
- `src/app/notes/_components/note-editor.tsx`
- `src/app/notes/_components/note-detail-modes.tsx`
