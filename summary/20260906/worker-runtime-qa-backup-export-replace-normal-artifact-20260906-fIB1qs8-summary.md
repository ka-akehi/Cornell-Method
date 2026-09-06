---
summary_type: task-summary
created_at: 2026-09-06 JST
task_kind: worker-task
task_status: blocked
---

## Objective

指定された exact normal packaged `.app` を disposable macOS 環境で起動し、Settings の Data and Backup から native SaveDestination の既存 regular file Replace を実測する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | packaged app 起動、sidecar bootstrap、Settings、native save dialog、SQLite export replacement |
| 対象 artifact | 指定された exact normal Apple Silicon `.app` のみ |
| 対象外 | 別 artifact、`Notebook.app` alias、再ビルド、source/config/dependency/schema、実ユーザー data |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-31.md` | packaged runtime の既知の起動・loopback 境界 |
| summary | `summary/20260906/worker-rebuild-normal-artifact-current-source-20260906-fIB1qs8-summary.md` | exact artifact identity と normal build 境界 |
| summary | `summary/20260906/worker-runtime-qa-normal-artifact-20260906-summary.md` | 同 host の既知の Computer Use / startup 制約 |
| source | `src/server/infrastructure/desktop-storage.js`、`src-tauri/sidecar/launcher.cjs` | disposable bootstrap と export boundary |
| schema | exact artifact 内 `runtime/prisma/schema.prisma` | disposable SQLite の必要テーブル |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| source / config / dependency / lockfile / schema / `Notebook.app` / exact artifact | 変更なし | runtime QA の制約 |
| `/private/tmp` disposable directory | live DB、seed、sentinel、起動ログを一時作成後に cleanup | QA 用の一時状態 |
| 本 summary | QA 結果を記録 | Worker 完了要約 |

実ユーザーの home、SQLite、backup、credential は開いていない。disposable directory とその中の live DB、既存 sentinel、settings lock/owner、起動ログは cleanup 済みで、いずれも disposable なので復元不要である。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact / PASS | 起動前後で exact artifact identity は一致した。`BUILD_ID=fIB1qs8IxwiH_P23PYXae`、main SHA-256 は指定値、Mach-O は arm64、bundle ID/version は `com.cornellmethod.notebook` / `0.1.0`。 | `BUILD_ID`、`shasum`、`file`、`Info.plist` の前後照合 |
| F-002 | fact / PASS | bundle 内 sidecar の default project-root 解決は `storage-options` で停止したが、既存の `CORNELL_DESKTOP_PROJECT_ROOT` に bundle 内 `runtime` を明示すると disposable bootstrap は `ready` になった。 | sidecar `bootstrap` の redacted status |
| F-003 | fact / PASS | disposable live DB に QA seed note/cue/tag を用意し、bootstrap 後の `PRAGMA integrity_check` は `ok`、foreign key violation は 0。 | bundled schema/migration と sqlite read-back |
| F-004 | fact / BLOCKED | exact main executable は環境変数を disposable path に限定して起動を試みたが、host 側の `nice(5) failed: operation not permitted` 直後に終了した。3 秒後の対象 app process は不在で、app stdout/stderr は空だった。 | direct packaged startup attempt |
| F-005 | fact / NOT REACHED | Computer Use の利用可能性自体は確認できたが、未起動 app を CUA で開くとユーザー既定環境へ起動し得るため、実ユーザー data を開かない制約により `getApp` による再起動は行わなかった。Settings の初期 General、Data and Backup、native SaveDestination、既存 file 選択、Replace には到達していない。 | CUA state と安全境界 |
| F-006 | fact / PASS | export 操作前後の比較対象として、launch attempt の前後では external sentinel hash と live DB hash/inode/size が不変、managed backup 0 件、pending restore 0 件だった。 | disposable snapshot |
| F-007 | fact / OBSERVED | launch attempt により disposable settings には initialization marker に加えて instance lock/owner が作成された。これは export の結果ではなく、異常終了した起動試行の副作用である。cleanup 済み。 | settings file inventory |
| F-008 | unknown | native Replace 成功、success UI、valid SQLite export、旧 sentinel の置換、export 前後の live DB/managed backup/settings/pending restore 不変性は未確認。 | app が GUI 起動前に終了 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| exact artifact path / BUILD_ID / main hash / Mach-O / bundle identity | PASS | 前後で指定 identity と一致 |
| disposable HOME / desktop home / TMPDIR | PASS | すべて明示した `/private/tmp` 配下 |
| disposable bootstrap / known metadata | PASS | bundled migration、seed metadata、integrity、foreign key を確認 |
| exact packaged app process | BLOCKED | `nice` permission error 後に終了 |
| Computer Use UI | NOT REACHED | 未起動 app の user-data launch を避けた |
| Settings 初期 General / Data and Backup | NOT REACHED | window 表示前に停止 |
| native SaveDestination / existing regular file / Replace | NOT REACHED | selection ID は発生していない |
| external SQLite export / replacement / read-back | NOT RUN | output は生成されていない |
| live DB / managed backup / settings / pending restore export invariant | NOT CONFIRMED | export 自体が未実施。launch attempt 前後の一部 snapshot は不変 |
| disposable cleanup / process cleanup | PASS | disposable directory、sentinel、DB、logs を削除。対象 app/sidecar は残存なし |
| final git status | PASS | 開始時からの既存変更を保持。source 等の新規変更なし |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | permissive host での exact app window / sidecar ready / loopback bind | GUI と loopback bind が許可された macOS host で同じ identity を再起動 |
| U-002 | Settings の General 初期表示と Data and Backup の読込 | U-001 の packaged UI accessibility state |
| U-003 | SaveDestination の同名 existing regular file 選択と Replace confirmation | native dialog の実操作と redacted dialog state |
| U-004 | Replace 後の output integrity と live/managed/settings/pending restore 不変性 | export 後の disposable SQLite `integrity_check`、foreign key、既知 metadata、hash/identity 比較 |
| U-005 | startup failure が host 制約か app 固有か | permissive host で同じ exact artifact の direct startup が再現するか |

## Next Read

次回は raw log ではなく、以下を最小入力として読む。

- `HANDOFF_2026-08-31.md`
- `summary/20260906/worker-rebuild-normal-artifact-current-source-20260906-fIB1qs8-summary.md`
- `summary/20260906/worker-runtime-qa-backup-export-replace-normal-artifact-20260906-fIB1qs8-summary.md`
- `Notebook.app` と指定 exact artifact
