---
summary_type: task-summary
created_at: 2026-08-09 18:48 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-prisma-runtime-cache-mismatch-20260809-5bb4d32f.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-prisma-runtime-cache-mismatch-20260809-5bb4d32f.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-prisma-runtime-cache-mismatch-20260809-5bb4d32f.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-prisma-runtime-cache-mismatch-20260809-5bb4d32f.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。コード・設定・生成物・migration・docs は変更していません。

結論:

- [schema.postgres.prisma](/Users/blp542/Desktop/自己学習/Cornell-Method/prisma/schema.postgres.prisma:61)、SQLite schema、生成済み schema に `NotebookTag.order` が存在。
- Postgres Client の `index.d.ts`、`index.js` runtime model にも `order` が存在。
- 現在の `.next/dev` 生成 chunk も `NotebookTag` fields が `notebookId, tagId, order, notebook, tag` で、生成 Client と一致。
- よって、提示された `Unknown argument order` は DB ではなく、実行時に古い Prisma runtime data model が読み込まれた場合の client-side validation error。過去の `.next/dev` cache または起動済み dev process の残存が最有力だが、現在の artifact だけでは stale cache を断定できない。
- DB migration 未適用は、この validation error の直接原因ではない。復旧後に `notebook_tags.order` が存在しない旨の DB エラー（通常 P2022）が出た場合に別途疑う。

Prisma 経路:

- [prisma.ts](/Users/blp542/Desktop/自己学習/Cornell-Method/src/server/infrastructure/prisma.ts:20) は `DATABASE_URL` が `postgres:` / `postgresql:` の場合に Postgres Client を選択。
- [scripts/prisma-generate.js](/Users/blp542/Desktop/自己学習/Cornell-Method/scripts/prisma-generate.js:40) は SQLite、Postgres の順で両方を生成。
- `prisma.config.ts` は `PRISMA_PROVIDER=postgresql` のとき Postgres schema を選択する。

最小復旧手順（未実行）:

```sh
# dev server を停止
npm run prisma:generate
rm -rf .next/dev
npm run dev
```

復旧後も DB column エラーが出る場合は、`DIRECT_URL` を確認したうえで次を実行します。

```sh
node scripts/prisma-run-postgres.js migrate status
npm run prisma:migrate:postgres
```

`git status --short` は作業前後で同じ既存変更一覧でした。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260809/1848-investigate-prisma-runtime-cache-mismatch-20260809-5bb4d32f-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260809/1848-investigate-prisma-runtime-cache-mismatch-20260809-5bb4d32f-summary.md`
