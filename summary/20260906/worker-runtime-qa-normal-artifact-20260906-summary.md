---
summary_type: task-summary
created_at: 2026-09-06 JST
task_kind: worker-task
task_status: blocked
---

## Objective

Exact normal packaged artifact を disposable macOS runtime で起動し、note save / backup の transport 経路と same-origin エラー発生位置を実測分類する。

## Changes Made

- リポジトリ内の source、設定、依存関係、lockfile、DB schema、MVP 契約、`Notebook.app`、生成 artifact は変更していない。
- 調査用の disposable directory `/private/tmp/cornell-method-runtime-qa-20260906` と起動ログ空ファイルを作成した。実ユーザーの home、SQLite、backup、note、credential は読んでいない。
- 調査 summary のみ作成した。provenance は worker helper に記録済み。

## Findings

| ID | 判定 | 内容 | 根拠 |
|---|---|---|---|
| F-001 | PASS | exact artifact path は指定値と一致した。 | 起動前後の path 照合 |
| F-002 | PASS | main executable SHA-256 は `3fcb96f784f43d268b057d2f9a3ad3d5531d1c0048108f7d020b2f1d96936fa6`、Mach-O は arm64、bundle ID は `com.cornellmethod.notebook`、version は `0.1.0`。 | `shasum` / `file` / `Info.plist` |
| F-003 | PASS | `Notebook.app` は exact artifact への symlink のまま。 | `readlink` |
| F-004 | UNKNOWN | `BUILD_ID=TP446-_3y5FLHBQwztoXM` は task で固定された identity と照合したが、packaged Info.plist 内には同名 key がなく、実行時表示は取得できなかった。 | identity 再照合、GUI 未接続 |
| F-005 | BLOCKED | Worker host から executable を直接起動しようとしたところ、host 側で `nice(5) failed: operation not permitted`。stdout / stderr は空で、対象 app process と対象 sidecar listener は観測できなかった。 | disposable 起動記録、loopback listener 確認 |
| F-006 | BLOCKED | Computer Use は `Computer Use permissions are not granted`。window restoration warning、window state、Web Inspector、`location.origin`、`window.__TAURI_INTERNALS__` は取得不能。 | CUA app inspection |
| F-007 | BLOCKED | sidecar ready URL / port に到達せず、`POST /api/notes`、`PATCH /api/notes/:id`、`POST /api/backups`、`GET /api/backups`、`DELETE /api/notes/:id` は request 前に停止。status、response code/message、native invoke / browser fetch、Network entry、Origin / Referer は未観測。 | sidecar listener 不在、GUI/request 操作不可 |
| F-008 | UNKNOWN | same-origin の HTTP 403 は未観測。原因確定、再現、proxy 到達のいずれも判定不能であり、invoke rejection / 起動失敗 / request 前停止を 403 と混同しない。 | F-005〜F-007 |
| F-009 | NOT RUN | disposable DB / API read-back、backup metadata read-back、削除後 read-back は request 自体を実施できず未実施。 | F-007 |

## Request Transport Matrix

| Request | 経路 | status / redacted response | Network entry | Origin / Referer |
|---|---|---|---|---|
| `POST /api/notes` | pre-request failure | 未観測 | 未観測 | 未観測 |
| `PATCH /api/notes/:id` | pre-request failure | 未観測 | 未観測 | 未観測 |
| `POST /api/backups` | pre-request failure | 未観測 | 未観測 | 未観測 |
| `GET /api/backups` | pre-request failure | 未観測 | 未観測 | 未観測 |
| `DELETE /api/notes/:id` | pre-request failure | 未観測 | 未観測 | 未観測 |

## Verification

- 作業前後に `git status --short` を確認し、開始時から存在した `Notebook.app` と `summary/20260906/` の変更を保持した。
- exact artifact identity は再確認した。
- 起動用 disposable path を明示した。実ユーザー data への read-back は行っていない。
- `codex-queue/bin/worker-progress.sh` は 25% と 70% の節目で実行した。
- 完了時の workspace 状態は summary 作成分を除き、開始時の変更から増加させていない。

## Remaining Unknowns

- permissive な GUI host での packaged window 起動、sidecar ready URL / port、window restoration warning。
- WebView の `location.origin`、Tauri internals、native invoke と browser fallback の実測。
- 各 API request の実 status / response metadata、Network entry、Origin / Referer 判定。
- disposable DB / backup の保存後・削除後 read-back。
- same-origin guard が実際に 403 を返すか、およびその発生位置。

## Next Read

- `summary/20260906/worker-runtime-qa-normal-artifact-20260906-summary.md`
- `summary/20260906/worker-rebuild-normal-app-20260906-summary.md`
- `Notebook.app`
- 必要時のみ exact artifact の `Contents/MacOS/cornell-method-notebook`

## Next Branch Decision

この host では原因を確定しない。次回は Computer Use permissions が付与され、GUI app の起動と loopback bind を許可する disposable macOS host で同じ exact identity を再確認する。そこで初めて 403 / invoke rejection / browser fallback / pre-request failure を分岐する。
