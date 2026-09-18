---
summary_type: task-summary
created_at: 2026-08-27 07:18 JST
task_kind: worker-task
task_status: done
---

## Objective

`replace-nonrestartable-backup-error-copy-ef9e2492.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-api` |
| status | `done` |
| task file | `codex-queue/tasks-api/done/replace-nonrestartable-backup-error-copy-ef9e2492.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks-api/done/replace-nonrestartable-backup-error-copy-ef9e2492.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/shared/http/api-error.ts` | Worker が意図的変更として記録 | `replace-nonrestartable-backup-error-copy-ef9e2492.task.md` の実行結果 |
| `test/backup/backup-route-desktop-directory.test.js` | Worker が意図的変更として記録 | `replace-nonrestartable-backup-error-copy-ef9e2492.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks-api/done/replace-nonrestartable-backup-error-copy-ef9e2492.task.md` |
| F-002 | fact | Worker が意図的変更として provenance manifest に成果物を記録した。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

対応完了しました。

変更ファイル:

- `src/shared/http/api-error.ts`
- `test/backup/backup-route-desktop-directory.test.js`

変更内容:

- 指定3エラーのユーザー向けメッセージを更新
- `backup_unknown_failure` など対象外は未変更
- API分類・ステータス・内部詳細・診断情報・処理は未変更
- provenance 記録済み

検証結果:

- 対象テスト: 2件 PASS
- `npm run lint`: PASS（既存警告8件）
- `git diff --check`: PASS
- 変更範囲: 指定対象ファイルのみ

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260827/0717-replace-nonrestartable-backup-error-copy-ef9e2492-summary.md` |
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

- `summary/20260827/0717-replace-nonrestartable-backup-error-copy-ef9e2492-summary.md`
- `src/shared/http/api-error.ts`
- `test/backup/backup-route-desktop-directory.test.js`
