---
summary_type: task-summary
created_at: 2026-08-11 17:07 JST
task_kind: worker-task
task_status: done
---

## Objective

`move-note-date-invariant-to-application-20260811-030633f5.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-api` |
| status | `done` |
| task file | `codex-queue/tasks-api/done/move-note-date-invariant-to-application-20260811-030633f5.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks-api/done/move-note-date-invariant-to-application-20260811-030633f5.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/api/notes/[id]/route.ts` | task 実行中に作成または更新 | `move-note-date-invariant-to-application-20260811-030633f5.task.md` の実行結果 |
| `src/modules/notes/ui/components/detail/actions.tsx` | task 実行中に作成または更新 | `move-note-date-invariant-to-application-20260811-030633f5.task.md` の実行結果 |
| `src/modules/notes/ui/components/detail/modes.tsx` | task 実行中に作成または更新 | `move-note-date-invariant-to-application-20260811-030633f5.task.md` の実行結果 |
| `src/server/notes/application/command.service.ts` | task 実行中に作成または更新 | `move-note-date-invariant-to-application-20260811-030633f5.task.md` の実行結果 |
| `src/server/notes/application/errors.ts` | task 実行中に作成または更新 | `move-note-date-invariant-to-application-20260811-030633f5.task.md` の実行結果 |
| `src/server/notes/application/index.ts` | task 実行中に作成または更新 | `move-note-date-invariant-to-application-20260811-030633f5.task.md` の実行結果 |
| `src/server/notes/infrastructure/note-existence.repository.ts` | task 実行中に作成または更新 | `move-note-date-invariant-to-application-20260811-030633f5.task.md` の実行結果 |
| `src/shared/markdown/markdown-field.tsx` | task 実行中に作成または更新 | `move-note-date-invariant-to-application-20260811-030633f5.task.md` の実行結果 |
| `test/notes/detail-summary-checkbox-contract.test.js` | task 実行中に作成または更新 | `move-note-date-invariant-to-application-20260811-030633f5.task.md` の実行結果 |
| `test/notes/markdown-preview-contract.test.js` | task 実行中に作成または更新 | `move-note-date-invariant-to-application-20260811-030633f5.task.md` の実行結果 |
| `test/notes/note-date-immutability-contract.test.js` | task 実行中に作成または更新 | `move-note-date-invariant-to-application-20260811-030633f5.task.md` の実行結果 |
| `tsconfig.tsbuildinfo` | task 実行中に作成または更新 | `move-note-date-invariant-to-application-20260811-030633f5.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks-api/done/move-note-date-invariant-to-application-20260811-030633f5.task.md` |
| F-002 | fact | task 実行中に成果物の作成または更新があった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

実装完了しました。

- application 層で noteDate 不変条件を検証し、型付きエラーを追加。
- Route Handler の比較処理を削除し、HTTP 400 へ変換。
- 同値更新・404・更新抑止の回帰テストを追加。

変更: [command.service.ts](</Users/blp542/Desktop/自己学習/Cornell-Method/src/server/notes/application/command.service.ts>)、[errors.ts](</Users/blp542/Desktop/自己学習/Cornell-Method/src/server/notes/application/errors.ts>)、[route.ts](</Users/blp542/Desktop/自己学習/Cornell-Method/src/app/api/notes/[id]/route.ts>)、repository、focused test。

検証 PASS:

- focused test 5/5
- notes tests 131/131
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `git diff --check`

既存の handoff・文書・summary、および別作業中の変更は保持しています。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260811/1707-move-note-date-invariant-to-application-20260811-030633f5-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260811/1707-move-note-date-invariant-to-application-20260811-030633f5-summary.md`
- `src/app/api/notes/[id]/route.ts`
- `src/modules/notes/ui/components/detail/actions.tsx`
- `src/modules/notes/ui/components/detail/modes.tsx`
- `src/server/notes/application/command.service.ts`
- `src/server/notes/application/errors.ts`
- `src/server/notes/application/index.ts`
- `src/server/notes/infrastructure/note-existence.repository.ts`
- `src/shared/markdown/markdown-field.tsx`
- `test/notes/detail-summary-checkbox-contract.test.js`
- `test/notes/markdown-preview-contract.test.js`
- `test/notes/note-date-immutability-contract.test.js`
- `tsconfig.tsbuildinfo`
