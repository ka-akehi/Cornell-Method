---
summary_type: task-summary
created_at: 2026-07-07 01:11 JST
task_kind: worker-task
task_status: done
---

## Objective

backup の filesystem 操作を `src/server/backup/infrastructure` へ寄せ、API route と CLI script が同じ server backup 境界を利用する状態にする。

## Changed Files

| パス | 変更内容 |
|---|---|
| `src/server/backup/infrastructure/local-sqlite-backup-provider.js` | 既存 `src/lib/backup/index.js` の filesystem backup 実装を移動。SQLite `DATABASE_URL` 解釈、backup dir、file name、最新 3 世代 prune、copy、list の挙動を維持。 |
| `src/server/backup/infrastructure/*.d.ts`, `index.js` | TypeScript route と CommonJS CLI から参照できる型定義と re-export を追加。 |
| `src/server/backup/application/backup.service.js` | `listBackupEntries()` / `createBackupEntry()` の最小 application service を追加。provider interface / repository / presenter / schema は作らず、concrete provider 呼び出しに留めた。 |
| `src/server/backup/application/*.d.ts`, `index.js` | API route と CLI が同じ service を参照するための入口を追加。 |
| `src/app/api/backups/route.ts` | `@/server/backup/application` の service call + response handling 中心に変更。`GET { backups }` / `POST { ok: true, backup }` shape は維持。 |
| `scripts/backup-copy.js` | `src/server/backup/application` の `createBackupEntry()` を利用するよう変更。 |
| `src/lib/backup/index.js` | 旧 import 互換の re-export に変更。既存の `@/lib/backup` / `require("./src/lib/backup")` 利用を壊さないため残した。filesystem 実装の正本は `src/server/backup/infrastructure`。 |
| `summary/20260707/0111-arch-backup-server-provider-boundary-summary.md` | 本 Worker task の完了要約。 |

## Verification

| コマンド | 結果 |
|---|---|
| `git status --short` | 作業前後に実行。既存の未コミット変更多数あり。対象外の変更は戻していない。 |
| `node -e "const backup = require('./src/lib/backup'); ..."` | 旧互換 re-export が `BackupError, createBackup, listBackups, pruneBackups, resolveDatabasePath` を公開することを確認。 |
| `node -e "const backup = require('./src/server/backup/application'); ..."` | service が `createBackupEntry, listBackupEntries` を公開することを確認。 |
| `npm run lint` | 成功。 |
| `npm run build` | 成功。 |
| `npm run backup:copy` | 成功。`backup/2026-07-06T16-10-44.db` を作成。 |
| `ls -la backup` | backup `.db` が 3 件で、最新 3 世代 prune 挙動を確認。 |

## Notes

- CommonJS / ESM / TypeScript の実行経路を維持するため、backup provider/service は `.js` + `.d.ts` にした。
- `src/lib/backup/index.js` は互換 re-export として残した。削除すると既存 import の置換範囲が広がり、今回の目的を超えるため。
- `.next` 配下の build artifacts は確認対象外として扱った。

## Next Read

- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `src/server/backup/application/backup.service.js`
- `src/app/api/backups/route.ts`
- `scripts/backup-copy.js`
- `src/lib/backup/index.js`
