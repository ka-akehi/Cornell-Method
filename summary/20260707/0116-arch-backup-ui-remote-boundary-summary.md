---
summary_type: task-summary
created_at: 2026-07-07 01:16 JST
task_kind: worker-task
task_status: done
---

## Objective

`src/app/backup/page.tsx` から `/api/backups` の fetch 直書き、response JSON parse、API error decode を外し、backup UI の remote 境界へ集約する。

## Changed Files

| パス | 変更内容 |
|---|---|
| `src/modules/backup/contracts/index.ts` | `BackupEntryDto`、`ListBackupsResponseDto`、`CreateBackupResponseDto` を追加。既存 API response shape `{ backups }` / `{ ok: true, backup }` を型として明示。 |
| `src/modules/backup/remote/index.ts` | `fetchBackups()`、`createBackup()`、`BackupRemoteError` を追加。`/api/backups` fetch と `decodeApiErrorResponse` による API error body decode を集約。 |
| `src/app/backup/page.tsx` | ローカル DTO、`readErrorMessage()`、fetch / `response.json()` を削除し、remote 関数呼び出しへ置換。UI 文言、loading / creating / success / error state、表示レイアウトは維持。 |

## Verification

| コマンド | 結果 |
|---|---|
| `git status --short` | 作業前後に実行。既存の未コミット変更多数あり。対象外変更は戻していない。 |
| `rg -n "fetch\\(|response\\.json|/api/backups" src/app/backup/page.tsx` | match なし。 |
| `npm run lint` | 成功。 |
| `npm run build` | 成功。 |

## Notes

- `.next` 配下の build artifacts は確認対象外として扱った。
- `backup_logs` / retry API / app startup backup / `/notes/backup` などの機能追加は行っていない。

## Next Read

- `src/modules/backup/contracts/index.ts`
- `src/modules/backup/remote/index.ts`
- `src/app/backup/page.tsx`
