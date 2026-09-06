---
summary_type: task-summary
created_at: 2026-09-07 02:36 JST
task_kind: worker-task
task_status: done
---

## Objective

`disable-unsafe-export-replace-20260907-edef0e77.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/disable-unsafe-export-replace-20260907-edef0e77.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/disable-unsafe-export-replace-20260907-edef0e77.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/sidecar/launcher.cjs` | Worker が意図的変更として記録 | `disable-unsafe-export-replace-20260907-edef0e77.task.md` の実行結果 |
| `src-tauri/src/runtime.rs` | Worker が意図的変更として記録 | `disable-unsafe-export-replace-20260907-edef0e77.task.md` の実行結果 |
| `src/server/infrastructure/desktop-storage.js` | Worker が意図的変更として記録 | `disable-unsafe-export-replace-20260907-edef0e77.task.md` の実行結果 |
| `test/desktop/desktop-data-backup-boundary.test.js` | Worker が意図的変更として記録 | `disable-unsafe-export-replace-20260907-edef0e77.task.md` の実行結果 |
| `test/desktop/desktop-data-backup-export.test.js` | Worker が意図的変更として記録 | `disable-unsafe-export-replace-20260907-edef0e77.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/disable-unsafe-export-replace-20260907-edef0e77.task.md` |
| F-002 | fact | Worker が意図的変更として provenance manifest に成果物を記録した。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

実装完了しました。

変更内容:

- Rust の既存 SaveDestination を `destination-exists` で拒否し、selection を保存しないよう変更
- `replace_existing` / `replaceExisting` の伝播を除去
- sidecar の Replace フィールドを strict `invalid-request` 化
- storage の Replace / `renameSync` publish を除去し、`linkSync` の no-replace publish に統一
- publish race 時の winner・temporary・live DB 不変を回帰テストで確認

変更ファイルは対象5件のみです。provenance も記録済みです。

検証:

- boundary: 10/10 pass
- export: 7/7 pass
- target ESLint / TypeScript / `node --check`: pass
- `cargo fmt --check` / `git diff --check`: pass
- Rust unit test: 既存 build script の `Not a directory (os error 20)` でコンパイル前停止
- full `npm run lint`: 既存/generated artifact と Canvas lint 違反で失敗。対象 lint は passしています。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260907/0236-disable-unsafe-export-replace-20260907-edef0e77-summary.md` |
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

- `summary/20260907/0236-disable-unsafe-export-replace-20260907-edef0e77-summary.md`
- `src-tauri/sidecar/launcher.cjs`
- `src-tauri/src/runtime.rs`
- `src/server/infrastructure/desktop-storage.js`
- `test/desktop/desktop-data-backup-boundary.test.js`
- `test/desktop/desktop-data-backup-export.test.js`
