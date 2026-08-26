---
summary_type: task-summary
created_at: 2026-08-26 08:47 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-packaged-app-reopen-window-crash-20260826-d46af924.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-packaged-app-reopen-window-crash-20260826-d46af924.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-packaged-app-reopen-window-crash-20260826-d46af924.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-packaged-app-reopen-window-crash-20260826-d46af924.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了です。repo・設定・依存関係・生成物の変更はありません。

結論：

- 最有力原因は `window-state` ではなく、worker/QA 環境の GUI・loopback 制約です。
- 08:14 の crash report は `NSApplication init → RegisterApplication → abort()` で終了しており、`restore_window_state`、WebView、sidecar には到達していません。
- 08:28〜08:31 は `tao::...did_finish_launching` 内の Rust panic でした。起動順上、sidecar は window builder より前に起動されます（[main.rs:333](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/main.rs:333>)）。既知の loopback `EPERM` により setup が失敗し、Tauri が setup error を panic に変換した経路と一致します。
- `restore_window_state` は設定ディレクトリの geometry JSON を読むだけで、OS の Saved Application State 復元 API は使用していません（[window_state.rs:103](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/window_state.rs:103>)）。
- 実際に crash した `/private/tmp` artifact は署名・Resources とも検証 PASS でした。対して repo 内の既存 artifact は stale で、resource seal 不在・nested Node 署名不整合があり、受け入れ QA には使用不可です。
- 現 HOME と disposable `/private/tmp` に対象 bundle ID の Saved Application State、`window-state.json` は見つかりませんでした。

安全な回復手順：

1. macOS ダイアログでは「Don't Reopen」を選ぶ。
2. 「Try Again」は繰り返さない。
3. 起動できた場合は通常の Cmd-Q で終了する。
4. `~/Library/Application Support/com.cornellmethod.notebook`、SQLite、Saved Application State は削除しない。

追加 coding task は現時点では不要です。次は loopback listener と WindowServer/GUI 操作が許可された host で、fresh disposable HOME を使い、再ビルド済み artifact の GUI QA を行うべきです。unified log は sandbox 制約で取得できず、今回も新たな GUI 起動試行は行っていません。

検証結果：

- desktop tests: 20 PASS / 7 SKIP / 0 FAIL（SKIP は loopback 制約）
- `cargo fmt --check`: PASS
- `git diff --check`: PASS
- 作業前後の `git status --short`: 一致
- 変更ファイル: なし

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/0847-investigate-packaged-app-reopen-window-crash-20260826-d46af924-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/0847-investigate-packaged-app-reopen-window-crash-20260826-d46af924-summary.md`
