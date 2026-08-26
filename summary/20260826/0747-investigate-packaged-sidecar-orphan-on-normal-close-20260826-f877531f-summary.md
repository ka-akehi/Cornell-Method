---
summary_type: task-summary
created_at: 2026-08-26 07:47 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-packaged-sidecar-orphan-on-normal-close-20260826-f877531f.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-packaged-sidecar-orphan-on-normal-close-20260826-f877531f.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-packaged-sidecar-orphan-on-normal-close-20260826-f877531f.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-packaged-sidecar-orphan-on-normal-close-20260826-f877531f.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了しました。コード本体は変更していません。完了 summary は [investigate-packaged-sidecar-orphan-lifecycle-20260826-summary.md](/Users/kazuya/Desktop/自己学習/Cornell-Method/summary/20260826/investigate-packaged-sidecar-orphan-lifecycle-20260826-summary.md) に記録しました。

結論:

- 直接原因は、macOS の `applicationWillTerminate` → Tauri `RunEvent::Exit` 経路が、`ExitRequested`／`finalize_close` の sidecar cleanup を通らないことです。
- Tauri/Tao はその後 `process::exit` するため、Rust の `Drop` による `SidecarHandle` cleanup は実行保証されません。
- launcher の SIGTERM／Next child cleanup と process group 実装は存在し、主因ではありません。
- app は exit 0、launcher は親終了後に PPID 1 へ reparent され残存します。

PID 記録:

- normal-close HOME の app PID: `11437`。終了後 `kill -0` は no such process。
- Manager 観測順: app exit 0 → launcher 残存（PPID 1）。
- launcher/Next の数値 PIDは artifact 側に保存されておらず未確定。
- direct launcher 試行は launcher `37837` / PPID `37834`、loopback `EPERM` により Next child 未生成。

検証:

- lifecycle: 8 PASS / 7 SKIP
- node-runtime: 11 PASS
- `node --check`: PASS
- `cargo fmt --check`: PASS
- resource mapping、ad-hoc signing、SQLite validation: PASS

最小修正候補は、`RunEvent::Exit` で idempotent な sidecar stop/wait を `process::exit` より前に実行し、`finalize_close` と共有することです。既存の未コミット変更は保持しています。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/0747-investigate-packaged-sidecar-orphan-on-normal-close-20260826-f877531f-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/0747-investigate-packaged-sidecar-orphan-on-normal-close-20260826-f877531f-summary.md`
