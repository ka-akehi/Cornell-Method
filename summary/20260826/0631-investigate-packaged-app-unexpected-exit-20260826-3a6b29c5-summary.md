---
summary_type: task-summary
created_at: 2026-08-26 06:31 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-packaged-app-unexpected-exit-20260826-3a6b29c5.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-packaged-app-unexpected-exit-20260826-3a6b29c5.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-packaged-app-unexpected-exit-20260826-3a6b29c5.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-packaged-app-unexpected-exit-20260826-3a6b29c5.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了しました。

- 直接原因: Tauri の `setup` hook が失敗し、Tauri 2.5.1 が `panic` → `SIGABRT`（exit code 6）。
- 最有力原因: packaged `.next/server` に `app/` と `chunks/` が欠落。manifest は `/api/desktop/health` を参照しているため、sidecar が health handshake を返せず約30秒後に終了した可能性が高い。
- SQLite bootstrap、Prisma migration、`codesign --verify --deep --strict` は PASS。ad-hoc signing failure の証拠はなし。
- Unified Log と実 loopback sidecar は sandbox 制約で未確認。
- Contract tests: 11 PASS、storage 16 PASS、lifecycle 8 PASS / 7 SKIP。

詳細は [調査 summary](</Users/kazuya/Desktop/自己学習/Cornell-Method/summary/20260826/0628-investigate-packaged-app-unexpected-exit-20260826-summary.md>) に記録しました。コード・設定・依存関係・artifact は変更していません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/0631-investigate-packaged-app-unexpected-exit-20260826-3a6b29c5-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/0631-investigate-packaged-app-unexpected-exit-20260826-3a6b29c5-summary.md`
