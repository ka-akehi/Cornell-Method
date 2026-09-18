---
summary_type: task-summary
created_at: 2026-08-09 02:43 JST
task_kind: worker-task
task_status: done
---

## Objective

`show-note-review-history-in-list-20260809-2065670f.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-ui` |
| status | `done` |
| task file | `codex-queue/tasks-ui/done/show-note-review-history-in-list-20260809-2065670f.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks-ui/done/show-note-review-history-in-list-20260809-2065670f.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/modules/notes/model/note-display.ts` | task 実行中に作成または更新 | `show-note-review-history-in-list-20260809-2065670f.task.md` の実行結果 |
| `src/modules/notes/ui/components/list/card.tsx` | task 実行中に作成または更新 | `show-note-review-history-in-list-20260809-2065670f.task.md` の実行結果 |
| `test/notes/list-visual-contract.test.js` | task 実行中に作成または更新 | `show-note-review-history-in-list-20260809-2065670f.task.md` の実行結果 |
| `tsconfig.tsbuildinfo` | task 実行中に作成または更新 | `show-note-review-history-in-list-20260809-2065670f.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks-ui/done/show-note-review-history-in-list-20260809-2065670f.task.md` |
| F-002 | fact | task 実行中に成果物の作成または更新があった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

実装完了しました。

変更内容:

- `reviewedAt` から `未復習` / `復習済み` を導出する表示モデルを追加。
- `getReviewStatus` は `nextReviewDate` の状態だけを判定。
- 一覧カードに「履歴」と「次回」の2バッジを常時表示。
- 6通りの組み合わせを契約テストで固定。

変更ファイル:

- [note-display.ts](/Users/blp542/Desktop/自己学習/Cornell-Method/src/modules/notes/model/note-display.ts)
- [card.tsx](/Users/blp542/Desktop/自己学習/Cornell-Method/src/modules/notes/ui/components/list/card.tsx)
- [list-visual-contract.test.js](/Users/blp542/Desktop/自己学習/Cornell-Method/test/notes/list-visual-contract.test.js)

検証:

- 一覧関連テスト: 9件成功
- `npm run lint`: 成功
- `npx tsc --noEmit --pretty false`: 成功
- `git diff --check`: 成功

API、DB、Prisma、migration は変更していません。保護対象の handoff / summary も変更していません。Browser runtime と build は未実施です。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260809/0243-show-note-review-history-in-list-20260809-2065670f-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260809/0243-show-note-review-history-in-list-20260809-2065670f-summary.md`
- `src/modules/notes/model/note-display.ts`
- `src/modules/notes/ui/components/list/card.tsx`
- `test/notes/list-visual-contract.test.js`
- `tsconfig.tsbuildinfo`
