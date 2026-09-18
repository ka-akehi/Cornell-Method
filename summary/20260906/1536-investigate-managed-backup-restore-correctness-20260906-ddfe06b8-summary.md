---
summary_type: task-summary
created_at: 2026-09-06 15:36 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-managed-backup-restore-correctness-20260906-ddfe06b8.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-managed-backup-restore-correctness-20260906-ddfe06b8.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-managed-backup-restore-correctness-20260906-ddfe06b8.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | Worker が記録した変更ファイルなし | provenance manifest に記録なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-managed-backup-restore-correctness-20260906-ddfe06b8.task.md` |
| F-002 | fact | Worker provenance manifest に変更ファイルは記録されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査を完了しました。コード・設定・依存関係・test は変更していません。調査 summary のみ追加しました。

結論：

- disposable fixture では、managed backup の選択、SQLite 置換、Cue/Tag/Canvas/searchText の read-back は正常でした。
- safety backup も復元前 DB を正しく保存しています。
- 最も有力な不具合候補は、Settings UI が `catalogState.backups.slice(0, 1)` で先頭 1 件しか表示しない点です。catalog には safety backup も含まれるため、意図した backup を選べない可能性があります。
- renderer の再読込後表示は packaged GUI では未確認です。隔離 home で GUI 起動を試しましたが終了コード 1となり、既存起動中アプリには触れていません。
- pending/newer-schema と external restore は通常 restore と分離され、既存テストで保証されています。

検証結果：

- 指定 targeted tests: 54/54 PASS
- catalog/lifecycle tests: 21 PASS、0 FAIL、7 SKIP
- packaged sidecar managed restore: PASS
- `git diff --check`: PASS
- 最終 status でも既存変更は保持。作業中に documentation 9 files の変更が現れましたが、この Worker は触れていません。

[調査 summary](</Users/kazuya/Desktop/自己学習/Cornell-Method/summary/20260906/1533-investigate-managed-backup-restore-20260906.md:1>)に詳細と Next Read を残しました。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260906/1536-investigate-managed-backup-restore-correctness-20260906-ddfe06b8-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| changed-files provenance | 完了 | explicit worker provenance manifest |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |
| U-002 | task 実行中に provenance manifest 外の workspace activity を 8 件検出した。他 Worker や並行処理の可能性があるため、この task の変更とは帰属しない。 | 必要時のみ `git status --short` と各 Worker summary を照合 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260906/1536-investigate-managed-backup-restore-correctness-20260906-ddfe06b8-summary.md`
