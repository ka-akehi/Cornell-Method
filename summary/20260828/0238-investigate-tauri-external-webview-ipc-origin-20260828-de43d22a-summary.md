---
summary_type: task-summary
created_at: 2026-08-28 02:38 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-tauri-external-webview-ipc-origin-20260828-de43d22a.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-tauri-external-webview-ipc-origin-20260828-de43d22a.task.md` |
| changed-files provenance | `legacy workspace timestamp` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-tauri-external-webview-ipc-origin-20260828-de43d22a.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | legacy runner の task 実行中 workspace activity を確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-tauri-external-webview-ipc-origin-20260828-de43d22a.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了しました。

主な結論:

- `withGlobalTauri:false` は `window.__TAURI__` を無効にするだけで、import した `invoke` が使う `window.__TAURI_INTERNALS__` まで無効にはしません。
- Tauri 2.5.1 の source では、external WebView にも IPC initialization script が注入されます。したがって「marker 欠落による全件 browser fallback」は可能性はあるものの、静的には主因と断定できません。
- loopback の `WebviewUrl::External` は Tauri 上では Remote context として扱われます。現 capability は `local:true` のみで `remote.urls` は未設定です。
- 5 mutation は共通 bridge を使います。marker が無い場合だけ browser fetch に fallback し、`invoke` が reject しても fallback しません。
- native request 側は `127.0.0.1`、`Origin`、`Referer` を固定しており、静的な origin mismatch は見つかりません。実際の WebView marker、invoke、Host/Origin、proxy の `request.nextUrl.origin` は未観測です。
- Settings bridge も同じ runtime 判定を使います。

詳細は [調査 summary](</Users/kazuya/Desktop/自己学習/Cornell-Method/summary/20260828/0230-investigate-tauri-external-loopback-ipc-20260828-summary.md>) に保存しました。`Next Read` も記載済みです。

検証:

- API bridge tests: 3/3 PASS
- Settings bridge tests: 20/20 PASS
- JSON parse: PASS
- `git diff --check`: PASS
- 今回の変更は summary 1件のみ。既存の未コミット変更は保持
- 実 GUI / IPC request は app `SIGABRT` と sidecar bind `EPERM` のため未確認

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260828/0238-investigate-tauri-external-webview-ipc-origin-20260828-de43d22a-summary.md` |
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

- `summary/20260828/0238-investigate-tauri-external-webview-ipc-origin-20260828-de43d22a-summary.md`
