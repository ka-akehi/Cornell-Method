# backup:copy command verification report

- Task: BAK-003 `npm run backup:copy` package script verification
- Executed at: 2026-07-05 12:10:35 JST
- Result: PASS

## Commands

```sh
git status --short
find backup -maxdepth 1 -type f -name '*.db' -print | sort
for i in 1 2 3 4; do npm run backup:copy; if [ "$i" != 4 ]; then sleep 1; fi; done
find backup -maxdepth 1 -type f -name '*.db' -print | sort
ls -l backup/*.db
git status --short
```

## Pre-run backup files

```text
backup/2026-07-05T02-07-43.db
backup/2026-07-05T02-07-44.db
backup/2026-07-05T02-07-45.db
```

## Execution output

`npm run backup:copy` was executed 4 times with a 1 second interval between runs.

```text
backup/2026-07-05T03-10-25.db
backup/2026-07-05T03-10-26.db
backup/2026-07-05T03-10-28.db
backup/2026-07-05T03-10-29.db
```

All 4 executions exited with code 0.

## Post-run backup files

```text
backup/2026-07-05T03-10-26.db
backup/2026-07-05T03-10-28.db
backup/2026-07-05T03-10-29.db
```

File count after execution: 3

File sizes:

```text
-rw-r--r--@ 1 blp542  staff  61440 Jul  5 12:10 backup/2026-07-05T03-10-26.db
-rw-r--r--@ 1 blp542  staff  61440 Jul  5 12:10 backup/2026-07-05T03-10-28.db
-rw-r--r--@ 1 blp542  staff  61440 Jul  5 12:10 backup/2026-07-05T03-10-29.db
```

## Verification

- `package.json` maps `backup:copy` to `node scripts/backup-copy.js`.
- `scripts/backup-copy.js` calls `createBackup({ projectRoot })` from `src/lib/backup/index.js`.
- The command copied the SQLite DB into `backup/` using timestamped `.db` filenames.
- After 4 executions, `backup/` contained only the latest 3 `.db` files.
- Older backup files were pruned as expected.

## Failure cause / next task

None. No fix task is needed for BAK-003.

## Git status notes

Pre-run `git status --short` already contained unrelated modified and untracked files. This task did not intentionally modify code, configuration, or dependencies.

Post-run `git status --short` showed the expected new report file plus existing unrelated working tree changes. Backup `.db` file creation/prune occurred as expected runtime verification output.

## Next Read

- `summary/20260705/backup-copy-command-verification-report.md`
- `doc/review/MVP_DETAIL_GAP_INVENTORY.md`
