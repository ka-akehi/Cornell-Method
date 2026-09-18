---
summary_type: task-summary
created_at: 2026-08-21 07:48 JST
task_kind: worker-task
task_status: done
---

## Objective

`extract-summary-draft-controller-5b8e2c14-b907a2d1.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-ui` |
| status | `done` |
| task file | `codex-queue/tasks-ui/done/extract-summary-draft-controller-5b8e2c14-b907a2d1.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks-ui/done/extract-summary-draft-controller-5b8e2c14-b907a2d1.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/modules/notes/ui/components/detail/modes.tsx` | task 実行中に作成または更新 | `extract-summary-draft-controller-5b8e2c14-b907a2d1.task.md` の実行結果 |
| `src/modules/notes/ui/hooks/use-note-detail-summary-draft.ts` | task 実行中に作成または更新 | `extract-summary-draft-controller-5b8e2c14-b907a2d1.task.md` の実行結果 |
| `test/desktop/desktop-close-bridge.test.js` | task 実行中に作成または更新 | `extract-summary-draft-controller-5b8e2c14-b907a2d1.task.md` の実行結果 |
| `test/notes/detail-summary-checkbox-contract.test.js` | task 実行中に作成または更新 | `extract-summary-draft-controller-5b8e2c14-b907a2d1.task.md` の実行結果 |
| `tsconfig.tsbuildinfo` | task 実行中に作成または更新 | `extract-summary-draft-controller-5b8e2c14-b907a2d1.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks-ui/done/extract-summary-draft-controller-5b8e2c14-b907a2d1.task.md` |
| F-002 | fact | task 実行中に成果物の作成または更新があった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

完了しました。既存の未コミット変更は保持しています。

変更:

- `use-note-detail-summary-draft.ts` を追加
  - Summary draft、toggle、PATCH save、revision guard、error、discard、dirty owner 登録を移動
- `modes.tsx`
  - hook 利用、mode/review/delete/read-view 配線に縮小
  - editor 保存後の note 更新は `acceptSavedNote` 経由
- source-contract tests を新 hook の参照へ更新

検証:

- focused tests: 21 PASS / 1 SKIP（loopback listener 制約）/ 0 FAIL
- `npm run lint`: 成功（既存 warning 8件）
- `git diff --check`: 成功
- `npx tsc --noEmit`: 既存の `src-tauri/target`、`fabric`、`konva`、`@prisma/adapter-pg` 参照エラーで失敗。今回の hook 起因エラーなし。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260821/0748-extract-summary-draft-controller-5b8e2c14-b907a2d1-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260821/0748-extract-summary-draft-controller-5b8e2c14-b907a2d1-summary.md`
- `src/modules/notes/ui/components/detail/modes.tsx`
- `src/modules/notes/ui/hooks/use-note-detail-summary-draft.ts`
- `test/desktop/desktop-close-bridge.test.js`
- `test/notes/detail-summary-checkbox-contract.test.js`
- `tsconfig.tsbuildinfo`
