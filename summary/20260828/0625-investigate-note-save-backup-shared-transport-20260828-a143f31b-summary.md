---
summary_type: task-summary
created_at: 2026-08-28 06:25 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-note-save-backup-shared-transport-20260828-a143f31b.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-note-save-backup-shared-transport-20260828-a143f31b.task.md` |
| changed-files provenance | `legacy workspace timestamp` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-note-save-backup-shared-transport-20260828-a143f31b.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | legacy runner の task 実行中 workspace activity を確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-note-save-backup-shared-transport-20260828-a143f31b.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査結果です。実装変更はありません。

結論として、現在の runner で確認できたのは API 到達前の D です。sidecar 起動時に `listen EPERM: operation not permitted 127.0.0.1` で停止し、native invoke、browser fetch、HTTP status/body は未観測でした。

ただし、画面に正確に「同一オリジンのリクエストのみ許可されます」と表示されたなら、現在の error propagation 上は HTTP 403 response が返ったことを示します。したがって候補は A（browser fallback）または B（native HTTP response）です。invoke rejection の D なら、現在の UI は別の通信エラーを表示します。

## Artifact 照合

- `Notebook.app` は指定 target への symlink。
- BUILD_ID: `6A932olg1ZMFJupJnYhOG`
- main executable: arm64 Mach-O
- SHA-256: `791e412bcd5bb81f0fcd10189e15a9bbb90fbebb13988769dc973d5bd6d93c7f`
- Bundle ID: `com.cornellmethod.notebook`
- `.next` の対応 server/client files、`launcher.cjs`、`next.config.ts`、storage helper は source と byte-identical。
- binary に command、remote permission、local permission、`http://127.0.0.1::port/*` の marker あり。
- app-specific sanitized logs は存在するが空。API request / invoke の記録なし。

従って、指定 alias が古い artifact を指している可能性は除外できます。ただし、実際にユーザーが起動した process の identity は未観測です。

## 経路

| 操作 | UI / remote | native 条件 | browser fallback |
|---|---|---|---|
| 新規ノート保存 | `editor.tsx` → `createNote` → `requestJson` → `POST /api/notes` | POST、相対 `/api`、Tauri internals、文字列 JSON body なら invoke | bridge が `null` の場合のみ `fetch` |
| 既存ノート保存 | `updateNote` → `PATCH /api/notes/:id` | 同じ shared bridge | 同じ |
| バックアップ作成 | `BackupPage` → `createBackup` → `requestBackupJson` → `POST /api/backups` | POST、相対 `/api`、body なしなら invoke | bridge が `null` の場合のみ `fetch` |

共通箇所は [`desktop-api-bridge.ts`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/shared/desktop/desktop-api-bridge.ts:24) と [`transport.ts`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/modules/notes/remote/transport.ts:14) です。バックアップも同じ bridge を使っています（[`backup remote`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/modules/backup/remote/index.ts:24)）。

bridge が `null` を返す条件は、Tauri internals 不在、state-changing method 以外、相対文字列でない input、API path 外、window origin 不一致、body が非文字列の場合です。invoke が reject した場合は `null` に変換されず、browser fallback も発生しません。

## Native path と proxy

native 側は [`runtime.rs`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/runtime.rs:2428) で runtime URL を以下に固定します。

- `http`
- host `127.0.0.1`
- dynamic port
- path `/notes`
- credentials/query/fragment なし
- target path は `/api` または `/api/*`

そのうえで、次を native 側で生成します。

- `Origin: http://127.0.0.1:<port>`
- `Referer: http://127.0.0.1:<port>/notes`
- redirect policy: `none`

renderer から渡された `Origin` / `Referer` は native 側で採用されません。転送される renderer header は `Accept` と `Content-Type` だけです。Basic Auth が有効でも `Authorization` は転送されないため、その場合は 403 ではなく 401 になります。

proxy の [`proxy.ts`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/proxy.ts:39) は、認証判定後、state-changing API に対して次を要求します。

- `Origin` が存在する場合: canonical な origin が `request.nextUrl.origin` と完全一致
- `Origin` がない場合: `Referer` の origin が完全一致
- `Origin: null`、空文字、malformed、異なる host/port は拒否
- 不正な `Origin` が存在すると、正しい Referer へ fallback しない

拒否 response は proxy が route handler より前に返す固定の HTTP 403 / `{ code: "forbidden", message: "同一オリジンのリクエストのみ許可されます" }` です。したがって DB/API handler には到達しません。API handler まで到達した場合、ノート作成は 201、バックアップ作成は 200 です。

## A〜D の分類

- A: 現在のコードでも browser fallback は存在します。Tauri internals 不在などで fallback し、Origin/Referer が欠落または不一致なら 403 になります。runtime 未観測。
- B: native request が proxy に届き、`request.nextUrl.origin` が native の validated runtime origin と異なる場合は 403 になり得ます。ただし fresh native code は Origin/Referer を validated URL から生成するため、通常条件では想定しにくいです。runtime 未観測。
- C: 指定 alias と fresh target の identity mismatch は除外済みです。別 process / 別起動元の画面だった可能性だけは未観測です。
- D: 現在の runner では sidecar bind failure として確認済みです。今回の same-origin 文言そのものを説明する HTTP response は未取得です。

## 検証

- auth / proxy / bridge / capability tests: 19/19 PASS
- `node --check`: PASS
- `cargo fmt -- --check`: PASS
- `git diff --check`: PASS
- disposable bundle `paths` / `bootstrap` / `validate-database`: PASS
- disposable bundle `serve`: BLOCKED (`listen EPERM`)
- 作業前後の `git status --short`: 同一
- 変更ファイル: なし

## 次の handoff

permissive な macOS host で同じ fresh artifact と disposable storage を使い、各操作について一回ずつ次を取得してください。

- ノート保存: 実際の `POST /api/notes` または `PATCH /api/notes/:id`、status、redacted response body、Origin/Referer の有無、browser Network entry の有無、console/invoke error。
- バックアップ: `POST /api/backups` と、作成後の GET を分離して、status、response body、Origin/Referer、browser Network entry の有無を取得。
- 共通: `location.origin`、`Boolean(window.__TAURI_INTERNALS__)`、実行 bundle の SHA-256。

現時点では runtime 証拠なしに shared transport を変更する coding task は不要です。proxy guard の緩和、external URL capability、`withGlobalTauri:true` は提案しません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260828/0625-investigate-note-save-backup-shared-transport-20260828-a143f31b-summary.md` |
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

- `summary/20260828/0625-investigate-note-save-backup-shared-transport-20260828-a143f31b-summary.md`
