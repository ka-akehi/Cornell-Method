---
summary_type: task-summary
created_at: 2026-08-31 09:28 JST
task_kind: worker-task
task_status: done
---

## Objective

`inventory-backup-file-dialog-commit-boundary-20260831-55604672.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/inventory-backup-file-dialog-commit-boundary-20260831-55604672.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/inventory-backup-file-dialog-commit-boundary-20260831-55604672.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | Worker が記録した変更ファイルなし | provenance manifest に記録なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/inventory-backup-file-dialog-commit-boundary-20260831-55604672.task.md` |
| F-002 | fact | Worker provenance manifest に変更ファイルは記録されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。HEAD・working tree・index は変更していません。開始時／終了時ともに index は空で、`git diff --cached --quiet` は成功しました。

Stage plan:

- `src-tauri/src/runtime.rs`：partial stage 必須
  - `DesktopFileDialogFailurePhase` / `DesktopFileDialogFailure` / typed metadata
  - `run_native_file_dialog` と response parser の failure metadata
  - `choose_data_backup_file` の command・path validation・selection store 記録
  - 3 種類の AppleScript error handler 修正（`-128` のみ cancel）
  - 関連する file-dialog unit tests
  - `DesktopApiRequest`、sidecar startup error、bootstrap、health-check などは除外
- `src-tauri/src/diagnostics.rs`：partial stage 必須
  - `LocalLogRecord` の file-dialog metadata
  - `record_file_dialog_failure*`
  - diagnostic export の failure 記録
  - metadata allowlist／validation と関連テスト
  - その他のログ仕様変更・既存テストの並べ替えは除外
- `src-tauri/src/main.rs`：partial stage 必須
  - save destination／external source の `spawn_blocking` failure observability
  - その他の Desktop API、sidecar error code、devtools opt-in、error conversion は除外
- `test/desktop/desktop-data-backup-boundary.test.js`：whole-file stage 可。追加された typed error 境界テストのみ。
- `test/desktop/desktop-diagnostics.test.js`：whole-file stage 可。ただし observability テストと AppleScript syntax 回帰テストを含む。
- `src/app/_components/settings/settings-modal.tsx`：partial stage 必須
  - redundant `/backup` link と説明文の削除
  - `onClose` 引数整理に直接必要な hunk のみ
  - theme、general category、copy変更、delete confirmation UI は除外
- `src/app/_components/settings/settings-modal.module.css`：partial stage 必須
  - `.routeLink` focus selector と `.routeLink` 定義の削除
  - hover、theme、overlay、色変数などは除外
- `test/desktop/desktop-settings-ui.test.js`：partial stage 必須
  - `/backup` 重複導線がないことを検証する追加・更新 hunk のみ
  - theme／general category／confirmation dialog／既存契約変更は除外

依存関係は `runtime.rs` の failure 型を `diagnostics.rs` が利用し、`main.rs` が diagnostics の app helper を呼ぶ構造です。この3ファイルは同じ commit に必要です。

DNF／bad UC:

- DNF：native dialog failure の privacy-safe metadata 記録、AppleScript syntax 修正、Settings 重複導線削除、および回帰テスト。
- bad UC：theme UI、general Settings category、sidecar startup error redesign、Desktop API追加、artifact／summary／queue lifecycle の混入。
- Drift：今回対象部分に限れば低いが、候補ファイル全体の差分は先行 Desktop Alpha 変更が混在しており、whole-file stage は危険。

非対話的 partial-stage は、次の symbol／anchor で `git apply --cached` 用 patch を作成するのが安全です。

- `DesktopFileDialogFailure`、`run_native_file_dialog`、`choose_data_backup_file`
- `record_file_dialog_failure_for_app`
- `choose_data_backup_save_destination_command`
- `choose_data_backup_external_source_command`
- `.routeLink`、`href="/backup"`、`既存のバックアップ画面を開く`

commit message 案：

`fix: harden native backup file dialogs and remove duplicate settings link`

最小 verification:

```sh
npm run lint
node --test test/desktop/desktop-data-backup-boundary.test.js \
  test/desktop/desktop-diagnostics.test.js \
  test/desktop/desktop-settings-ui.test.js
cargo fmt --check
cargo test
git diff --cached --check
```

期待結果は対象 Node テスト、lint、format、diff check が PASS。`cargo test` は既存の custom build 環境要因で停止する可能性があり、その場合は失敗理由を記録します。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260831/0927-inventory-backup-file-dialog-commit-boundary-20260831-55604672-summary.md` |
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

- `summary/20260831/0927-inventory-backup-file-dialog-commit-boundary-20260831-55604672-summary.md`
