---
summary_type: task-summary
created_at: 2026-08-24 00:18 JST
task_kind: worker-task
task_status: done
---

## Objective

`fix-desktop-missing-database-initialization-marker-20260824-116-dbe52731.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-api` |
| status | `done` |
| task file | `codex-queue/tasks-api/done/fix-desktop-missing-database-initialization-marker-20260824-116-dbe52731.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks-api/done/fix-desktop-missing-database-initialization-marker-20260824-116-dbe52731.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/server/infrastructure/desktop-storage.d.ts` | task 実行中に作成または更新 | `fix-desktop-missing-database-initialization-marker-20260824-116-dbe52731.task.md` の実行結果 |
| `src/server/infrastructure/desktop-storage.js` | task 実行中に作成または更新 | `fix-desktop-missing-database-initialization-marker-20260824-116-dbe52731.task.md` の実行結果 |
| `test/desktop/desktop-storage.test.js` | task 実行中に作成または更新 | `fix-desktop-missing-database-initialization-marker-20260824-116-dbe52731.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks-api/done/fix-desktop-missing-database-initialization-marker-20260824-116-dbe52731.task.md` |
| F-002 | fact | task 実行中に成果物の作成または更新があった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

実装完了しました。

- 原因：DB 不在を常に初回利用と判定し、空 DB を再作成していた。
- 対応：`settings/.database-initialized` を導入。初回 migration/readiness 成功後のみ排他的に作成。
- marker あり・DB 不在時は migration/DB作成を行わず、`unusable` / `database-missing-after-initialization` で停止。
- 既存正常 DB、marker 不正・非 regular、backup/settings 保持、migration 失敗 cleanup をテスト。

変更ファイル：

- `src/server/infrastructure/desktop-storage.js`
- `src/server/infrastructure/desktop-storage.d.ts`
- `test/desktop/desktop-storage.test.js`

検証：

- Desktop storage tests: 13/13 PASS
- `node --check`: PASS
- 対象 ESLint: PASS
- `git diff --check`: PASS
- `npm run lint`: 既存の対象外 React/ref 等のエラーで失敗

未コミットの既存 `summary/` ディレクトリは変更していません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260824/0018-fix-desktop-missing-database-initialization-marker-20260824-116-dbe52731-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260824/0018-fix-desktop-missing-database-initialization-marker-20260824-116-dbe52731-summary.md`
- `src/server/infrastructure/desktop-storage.d.ts`
- `src/server/infrastructure/desktop-storage.js`
- `test/desktop/desktop-storage.test.js`
