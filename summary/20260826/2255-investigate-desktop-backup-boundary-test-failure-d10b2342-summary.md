---
summary_type: task-summary
created_at: 2026-08-26 22:55 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-desktop-backup-boundary-test-failure-d10b2342.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-desktop-backup-boundary-test-failure-d10b2342.task.md` |
| changed-files provenance | `legacy workspace timestamp` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-desktop-backup-boundary-test-failure-d10b2342.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | legacy runner の task 実行中 workspace activity を確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-desktop-backup-boundary-test-failure-d10b2342.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。原因はテストの環境依存で、本番コードの欠陥ではありません。

- テストは一時 directory を destination に使うだけで、`CORNELL_DESKTOP_HOME` を設定していません（[test]( /Users/kazuya/Desktop/自己学習/Cornell-Method/test/desktop/desktop-data-backup-boundary.test.js:231)）。
- sidecar は未設定時に実ユーザーの `~/Library/Application Support/com.cornellmethod.notebook/live/notebook.sqlite` を使います（[launcher]( /Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/sidecar/launcher.cjs:43)）。
- 実際にその DB は存在し、73,728 bytes ありました。そのため export 成功は正しい挙動です。
- `CORNELL_DESKTOP_HOME` を fresh な一時 home にすると、対象テストは 8/8 PASS。canonical directory だけ存在し DB がない場合も、`invalid-live-database` で fail-closed しました（[storage]( /Users/kazuya/Desktop/自己学習/Cornell-Method/src/server/infrastructure/desktop-storage.js:2699)）。

検証結果:

- 既定環境: 7 PASS / 1 FAIL（実応答は `success`）
- disposable home: 8 PASS
- desktop 全体: 200 PASS / 1 FAIL / 7 SKIP。FAIL は同じ 1 件
- 作業中、コード・設定・依存関係・テストは変更していません。追加したのは調査 summary のみ: [summary]( /Users/kazuya/Desktop/自己学習/Cornell-Method/summary/20260826/2252-investigate-desktop-backup-unavailable-export.md)

後続 task は production source ではなく、`test/desktop/desktop-data-backup-boundary.test.js` のみを修正対象にしてください。`CORNELL_DESKTOP_HOME`（必要なら project root / application ID）を disposable home に固定し、対象テスト 8/8 PASS・desktop suite の FAIL 0 を完了条件とします。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/2255-investigate-desktop-backup-boundary-test-failure-d10b2342-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| changed-files provenance | legacy | legacy workspace timestamp |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/2255-investigate-desktop-backup-boundary-test-failure-d10b2342-summary.md`
