---
summary_type: task-summary
created_at: 2026-08-28 15:34 JST
task_kind: worker-task
task_status: done
---

## Objective

`classify-runtime-same-origin-403-after-diagnostic-bridge-check-20260828-546a4e1d.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/classify-runtime-same-origin-403-after-diagnostic-bridge-check-20260828-546a4e1d.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/classify-runtime-same-origin-403-after-diagnostic-bridge-check-20260828-546a4e1d.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | Worker が記録した変更ファイルなし | provenance manifest に記録なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/classify-runtime-same-origin-403-after-diagnostic-bridge-check-20260828-546a4e1d.task.md` |
| F-002 | fact | Worker provenance manifest に変更ファイルは記録されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。コード・設定・依存関係・生成物は変更していません。

経路の結論：

- ノート保存  
  `editor.tsx` → `createNote` / `updateNote` → `requestJson` → shared bridge  
  対象は `POST /api/notes`、`PATCH /api/notes/:id`。
- バックアップ作成  
  `BackupPage` → `createBackup` → `requestBackupJson` → shared bridge  
  対象は `POST /api/backups`。
- bridge が利用可能なら、先に Tauri `invoke("request_desktop_state_changing_api")` を実行します。
- `invoke` が reject しても browser `fetch` へ fallback しません。fallback は bridge が `null` を返す場合だけです。
- backup 一覧の `GET /api/backups` は常に browser `fetch` 経路です。

403 の発生地点：

- 固定 body は [`src/proxy.ts:39-53`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/proxy.ts:39) の proxy でのみ返されます。
- 対象は API の `POST`、`PATCH`、`DELETE`。
- `Origin` が存在する場合、`request.nextUrl.origin` と完全一致しなければ拒否。
- `Origin` がない場合だけ `Referer` を検証し、その origin が完全一致する必要があります。
- `Origin: null`、空値、不正形式、`localhost` と `127.0.0.1` の違い、port 違い、scheme 違い、path/query 付き Origin は拒否されます。
- 拒否時は route handler や DB 処理には到達しません。

native 経路の期待値：

- [`runtime.rs:2466-2492`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/runtime.rs:2466) で `http://127.0.0.1:<dynamic-port>/notes` を検証。
- [`runtime.rs:2504-2541`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/runtime.rs:2504) が次を生成します。

```text
Origin:  http://127.0.0.1:<port>
Referer: http://127.0.0.1:<port>/notes
```

renderer 由来の `Origin` / `Referer` は採用されません。native 経路でこの値が送られていれば、通常は proxy の same-origin guard を通過する設計です。

現時点の分類：

- Fact  
  WebView origin は `http://127.0.0.1:57040`。Tauri internals と `invoke` 関数は存在。
- Fact  
  403 固定 body の生成地点と判定条件は proxy に特定できる。
- Fact  
  Worker host では sidecar bind が `EPERM` で、今回の runtime request は未観測。
- Inference  
  403 が実際の HTTP response なら、browser fetch または native HTTP のどちらかが proxy まで到達した。
- Unknown  
  実際の経路、Request URL、Origin、Referer、invoke rejection の有無。
- Unknown  
  ユーザーが確認した packaged app の実行 bundle identity と source の一致。

次回 Safari Web Inspector で取得する最小証拠：

| 操作 | 取得値 | 判定 |
|---|---|---|
| ノート新規保存 | Network entry の有無、method、`/api/notes` の path、status、redacted body | Network entry ありなら browser fetch 経路の証拠 |
| ノート更新 | `PATCH /api/notes/<opaque-id>` の method/path/status のみ | 個人データや ID 本体は報告不要 |
| バックアップ作成 | `POST /api/backups` の Network entry、status | entry ありなら browser fetch |
| 各操作共通 | `window.location.origin`、`typeof window.__TAURI_INTERNALS__`、`typeof ...invoke` | bridge 利用可能性の確認。ただし invoke 実行の証明ではない |
| 各操作共通 | invoke rejection の有無、code/message のみ | rejection ありなら現実装では fetch fallback ではない |
| HTTP request | `Origin`、`Referer` の値または host/port だけを匿名化して記録 | proxy の期待値との一致を判定 |
| 実行物 | BUILD_ID と main executable hash | stale artifact 混入を排除 |

原因候補の優先順位：

1. browser fetch が実行され、Origin または Referer が欠落・不一致。
2. native invoke が実行されたが、sidecar URL と WebView / proxy が異なる origin または port。
3. 実行した packaged artifact が確認済み source と異なる。
4. invoke が reject している。これは 403 HTTP response とは異なるため、同時発生でない限り優先度は低い。

実装 task が必要になる場合は、`desktop-api-bridge.ts` を中心に「native invoke / browser fallback の実測可能性と診断境界」を一つの cohesive responsibility として扱います。proxy guard、capability wildcard、Origin / Referer 検証の緩和は対象にしません。

検証結果：

- auth / proxy / bridge / capability / backup route targeted tests: 22/22 PASS
- `git diff --check`: PASS
- 作業前後の `git status --short`: 既存の未コミット変更と同一
- 変更ファイル: なし
- Worker provenance: 意図した変更ファイルなし

未確認事項は、permissive macOS host 上での実際の invoke、browser Network、native request header、HTTP 403 の再現です。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260828/1534-classify-runtime-same-origin-403-after-diagnostic-bridge-check-20260828-546a4e1d-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| changed-files provenance | 完了 | explicit worker provenance manifest |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260828/1534-classify-runtime-same-origin-403-after-diagnostic-bridge-check-20260828-546a4e1d-summary.md`
