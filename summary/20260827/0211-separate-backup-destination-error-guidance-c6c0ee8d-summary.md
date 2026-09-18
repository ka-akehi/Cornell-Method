---
summary_type: task-summary
created_at: 2026-08-27 02:11 JST
task_kind: worker-task
task_status: done
---

## Objective

`separate-backup-destination-error-guidance-c6c0ee8d.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-api` |
| status | `done` |
| task file | `codex-queue/tasks-api/done/separate-backup-destination-error-guidance-c6c0ee8d.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks-api/done/separate-backup-destination-error-guidance-c6c0ee8d.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/server/backup/infrastructure/local-sqlite-backup-provider.js` | Worker が意図的変更として記録 | `separate-backup-destination-error-guidance-c6c0ee8d.task.md` の実行結果 |
| `src/shared/http/api-error.ts` | Worker が意図的変更として記録 | `separate-backup-destination-error-guidance-c6c0ee8d.task.md` の実行結果 |
| `test/backup/backup-route-desktop-directory.test.js` | Worker が意図的変更として記録 | `separate-backup-destination-error-guidance-c6c0ee8d.task.md` の実行結果 |
| `test/backup/local-sqlite-backup-provider.test.js` | Worker が意図的変更として記録 | `separate-backup-destination-error-guidance-c6c0ee8d.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks-api/done/separate-backup-destination-error-guidance-c6c0ee8d.task.md` |
| F-002 | fact | Worker が意図的変更として provenance manifest に成果物を記録した。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

完了しました。

変更内容:
- 保存先ディレクトリの不正・境界違反を `storage_failure` に分類
- `DATABASE_URL` 不正は `configuration_invalid`、DB 不在は `database_unavailable` を維持
- 保存先・DB分類の回帰テストを追加・更新
- API の固定メッセージと内部情報非漏えいテストを維持

検証:
- バックアップ関連テスト: 42/42 成功
- 対象 ESLint: 成功
- `node --check`: 成功
- `git diff --check`: 成功
- 変更ファイルを provenance に記録済み

既存の未コミット変更および `summary/` の未追跡ファイルは保持しています。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260827/0211-separate-backup-destination-error-guidance-c6c0ee8d-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| changed-files provenance | 完了 | explicit worker provenance manifest |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260827/0211-separate-backup-destination-error-guidance-c6c0ee8d-summary.md`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `src/shared/http/api-error.ts`
- `test/backup/backup-route-desktop-directory.test.js`
- `test/backup/local-sqlite-backup-provider.test.js`
