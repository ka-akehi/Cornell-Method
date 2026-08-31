---
summary_type: task-summary
created_at: 2026-08-28 05:46 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-current-alpha-same-origin-after-loopback-ipc-20260828-a5c44d62.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-current-alpha-same-origin-after-loopback-ipc-20260828-a5c44d62.task.md` |
| changed-files provenance | `legacy workspace timestamp` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-current-alpha-same-origin-after-loopback-ipc-20260828-a5c44d62.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | legacy runner の task 実行中 workspace activity を確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-current-alpha-same-origin-after-loopback-ipc-20260828-a5c44d62.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査結果は以下です。

- A（別 artifact / 起動経路）: 除外  
  `Notebook.app` は指定 target を指し、BUILD_ID `6A932olg1ZMFJupJnYhOG`、arm64、bundle ID `com.cornellmethod.notebook`、main executable SHA-256 `791e...d93c7f`、ad-hoc codesign が一致しました。

- D（app / sidecar 起動境界）: current runner で確認  
  alias 経由の app 直接起動は rc=134、`nice(5) failed: operation not permitted`。bundled launcher は disposable SQLite bootstrap までは成功しましたが、`serve` が `listen EPERM: operation not permitted 127.0.0.1` で dynamic port 取得前に終了しました。

- B（marker / invoke / browser fallback）: 未分類  
  WebView が生成されず marker と native invoke は未観測です。静的には [`desktop-api-bridge.ts`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/shared/desktop/desktop-api-bridge.ts:24) が marker 不在・非対応 method・非相対 API 等で `null` を返し、[`transport.ts`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/modules/notes/remote/transport.ts:19) と [`backup remote`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/modules/backup/remote/index.ts:28) がその場合だけ browser `fetch` に fallback します。invoke rejection は catch されず、そのまま失敗します。

- C（native request の 403）: 未分類  
  native invoke、HTTP status/body、same-origin 403 は今回観測できませんでした。静的には [`runtime.rs`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/runtime.rs:2466) が validated loopback origin から `Origin` / `Referer` を生成し、redirect follow を無効化しています。[`proxy.ts`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/proxy.ts:39) の guard も変更されていません。

照合結果:

- fresh bundle の主要 `.next` chunk は source 側と一致。
- bundle 内 `launcher.cjs`、storage helper、runtime config は source と一致。
- bundle binary に `request_desktop_state_changing_api`、`allow-request-desktop-state-changing-api`、`local-app-commands`、`127.0.0.1::port` が埋め込まれています。
- [`default.json`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/capabilities/default.json:3) と [`app-commands.toml`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/permissions/app-commands.toml:6) の remote capability / command allowlist は契約どおりです。
- app-specific sanitized logs はディレクトリ存在、ファイルなし。イベント証拠はありません。

変更ファイル: なし。作業前から存在した未コミット変更は保持しています。

検証:

- bridge / capability contract tests: 7/7 PASS
- JavaScript syntax checks: PASS
- identity、hash、codesign、source/bundle hash、disposable launcher `paths` / `bootstrap` / `serve` を確認
- ユーザー SQLite、ノート、設定、認証情報は未読・未変更

現時点で coding task を切る根拠はありません。次の handoff は、`127.0.0.1` bind と GUI 起動が許可された macOS host で、同じ fresh artifact・disposable home を使い、sidecar URL/origin、`location.origin`、marker 有無、invoke result、native/browser 別の status/body、console error、sanitized log event を取得することです。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260828/0546-investigate-current-alpha-same-origin-after-loopback-ipc-20260828-a5c44d62-summary.md` |
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

- `summary/20260828/0546-investigate-current-alpha-same-origin-after-loopback-ipc-20260828-a5c44d62-summary.md`
