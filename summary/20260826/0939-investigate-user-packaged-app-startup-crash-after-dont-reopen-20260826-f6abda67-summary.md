---
summary_type: task-summary
created_at: 2026-08-26 09:39 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-user-packaged-app-startup-crash-after-dont-reopen-20260826-f6abda67.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-user-packaged-app-startup-crash-after-dont-reopen-20260826-f6abda67.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-user-packaged-app-startup-crash-after-dont-reopen-20260826-f6abda67.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-user-packaged-app-startup-crash-after-dont-reopen-20260826-f6abda67.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査結果は以下です。

- 変更ファイル：なし。開始・終了時の `git status --short` は一致、`git diff --check` も PASS。
- crash report の executable UUID `9DA56684…` は、指定の `next-server` ではなく、次の古い artifact と一致しました。  
  `/private/tmp/cornell-method-tauri-target-adhoc-host-20260826/.../Cornell Method Notebook.app`
- この artifact は署名自体は PASS ですが、`.next/server` が 71 ファイル בלבדで、`app/`、`chunks/`、`/api/desktop/health` が欠落しています。manifest は health route を参照しています。
- そのため、sidecar の health readiness が失敗し、Tauri の `setup` エラーが `did_finish_launching` 内の Rust panic → `SIGABRT` になった可能性が最も高いです。これは推定ですが、Saved Application State が原因ではありません。
- `restore_window_state` は設定ディレクトリの `window-state.json` を読むだけで、OS Saved Application State は使用していません（[window_state.rs:103](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/window_state.rs:103>)）。実際、対象 Saved Application State と `window-state.json` は見つかりませんでした。
- 現在の `next-server` artifact（UUID `968026E6…`）は、health route を含む `server=140 / app=110 / chunks=13` で、codesign・resource seal とも PASS です（[tauri.conf.json:32](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/tauri.conf.json:32>)）。

コード上も、sidecar 起動は window build より前です（[main.rs:333](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/main.rs:333>)、window state 復元は [main.rs:364](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/main.rs:364>)）。したがって `Don't Reopen` でも起動できない説明がつきます。

追加 coding task は現時点では不要です。既存の resource hierarchy 修正後に生成された artifact を使うのが最小の回復手順です。ユーザーデータ、SQLite、Saved Application State は削除しないでください。

未確認事項：

- crash report の `/private/tmp/*` 匿名化により、実際にユーザーが Finder 起動したものか、worker QA 起動かは断定不能。
- worker 環境では unified log が sandbox 制約で取得不能、loopback bind は `EPERM`、GUI 再起動も未確認。したがって修正版 artifact の実機 GUI 起動は PASS 判定していません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/0939-investigate-user-packaged-app-startup-crash-after-dont-reopen-20260826-f6abda67-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/0939-investigate-user-packaged-app-startup-crash-after-dont-reopen-20260826-f6abda67-summary.md`
