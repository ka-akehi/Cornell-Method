---
summary_type: task-summary
created_at: 2026-08-27 03:37 JST
task_kind: worker-task
task_status: done
---

## Objective

`enable-recovery-only-restore-transition-447438ad.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/enable-recovery-only-restore-transition-447438ad.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/enable-recovery-only-restore-transition-447438ad.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/src/lifecycle.rs` | Worker が意図的変更として記録 | `enable-recovery-only-restore-transition-447438ad.task.md` の実行結果 |
| `src-tauri/src/main.rs` | Worker が意図的変更として記録 | `enable-recovery-only-restore-transition-447438ad.task.md` の実行結果 |
| `src-tauri/src/runtime.rs` | Worker が意図的変更として記録 | `enable-recovery-only-restore-transition-447438ad.task.md` の実行結果 |
| `src/shared/desktop/desktop-settings-bridge.ts` | Worker が意図的変更として記録 | `enable-recovery-only-restore-transition-447438ad.task.md` の実行結果 |
| `test/desktop/desktop-startup-recovery.test.js` | Worker が意図的変更として記録 | `enable-recovery-only-restore-transition-447438ad.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/enable-recovery-only-restore-transition-447438ad.task.md` |
| F-002 | fact | Worker が意図的変更として provenance manifest に成果物を記録した。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

実装完了しました。

変更内容:

- recovery-only では quiesce を省略し、既存 one-shot restore/pending pipeline を使用
- 成功時のみ sidecar 再起動、runtime 遷移、recovery status を `ready` 化
- 失敗時は recovery-only を維持し、既存 typed rollback を利用
- recovery snapshot の bridge 型・厳格な情報漏えい防止を追加
- 回帰テストと provenance 記録を追加

検証:

- Desktop tests: 209 pass / 7 skip（loopback 制限）
- TypeScript、Node 構文、Rust format、diff check: pass
- `cargo check/test --offline`: `tauri` crate 不在で依存解決前に実行不能
- `npm run lint`: 既存の無関係な5エラーで失敗
- 変更ファイル: 5件。既存 `summary/` は未変更

なお、既存 `desktop-storage.js` の「live DB が READY でない restore は `invalid-live-database`」という前提は今回変更していません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260827/0337-enable-recovery-only-restore-transition-447438ad-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| changed-files provenance | 完了 | explicit worker provenance manifest |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |
| U-002 | task 実行中に provenance manifest 外の workspace activity を 1 件検出した。他 Worker や並行処理の可能性があるため、この task の変更とは帰属しない。 | 必要時のみ `git status --short` と各 Worker summary を照合 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260827/0337-enable-recovery-only-restore-transition-447438ad-summary.md`
- `src-tauri/src/lifecycle.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/runtime.rs`
- `src/shared/desktop/desktop-settings-bridge.ts`
- `test/desktop/desktop-startup-recovery.test.js`
