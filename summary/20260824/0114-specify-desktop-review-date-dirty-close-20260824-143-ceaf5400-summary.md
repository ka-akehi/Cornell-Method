---
summary_type: task-summary
created_at: 2026-08-24 01:14 JST
task_kind: worker-task
task_status: done
---

## Objective

`specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-ui` |
| status | `done` |
| task file | `codex-queue/tasks-ui/done/specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks-ui/done/specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/sidecar/launcher.cjs` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `src-tauri/src/runtime.rs` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `src/app/api/backups/route.ts` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `src/app/api/desktop/health/route.ts` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `src/modules/notes/ui/hooks/use-note-detail-summary-draft.ts` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `src/server/backup/application/backup.service.d.ts` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `src/server/backup/application/backup.service.js` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `src/server/backup/infrastructure/local-sqlite-backup-provider.d.ts` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `src/server/backup/infrastructure/local-sqlite-backup-provider.js` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `src/server/infrastructure/desktop-storage.d.ts` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `src/server/infrastructure/desktop-storage.js` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `test/backup/local-sqlite-backup-provider.test.js` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `test/desktop/desktop-lifecycle.test.js` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `test/desktop/desktop-storage.test.js` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `test/desktop/fixtures/runtime-child.cjs` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |
| `test/notes/detail-summary-checkbox-contract.test.js` | task 実行中に作成または更新 | `specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks-ui/done/specify-desktop-review-date-dirty-close-20260824-143-ceaf5400.task.md` |
| F-002 | fact | task 実行中に成果物の作成または更新があった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査・仕様確定を完了しました。コード・設定・依存関係・docs は変更していません。

推奨方針は、`reviewNextDate` を Review 用 dirty owner として登録し、「保存して終了」を review completion と扱うことです。

- 保存：本文・Summary の確認済み条件を満たす場合のみ既存 `POST /api/notes/:id/review` を実行。成功時だけ終了し、`reviewedAt` と `nextReviewDate` を更新する。
- 保存失敗／確認不足：close decision は `save` に進めず、既存の cancel 処理で draft を保持する。
- 破棄：Review session 開始時の `today + 7日` baseline に戻し、API は呼ばずに終了する。
- キャンセル：Review date と Summary の両方を変更せず、終了要求だけをキャンセルする。
- clean close：Review date が baseline と同じ場合のみ clean 扱い。変更後は必ず close dialog を表示する。

date-only の PATCH は追加しません。これにより既存の review completion / Summary save 分離を維持しつつ、入力を黙って失いません。

後続 coding task では、主に [modes.tsx](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/modules/notes/ui/components/detail/modes.tsx:63) に baseline・dirty owner・最新 callback ref・discard reset を追加します。[desktop-close-bridge.ts](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/shared/desktop/desktop-close-bridge.ts:26) と [desktop-close-coordinator.tsx](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/app/_components/desktop-close-coordinator.tsx:211) の既存 save/discard/cancel semantics は維持します。Summary owner の保存を Review completion より先に実行し、Summary 保存後の stale state による巻き戻しを防いでください。

回帰テスト対象：

- Review date 変更時に clean close にならない
- Summary → Review completion の保存順
- 確認不足・API失敗時の cancel と date draft 保持
- discard で baseline に戻る
- cancel で全 draft 保持
- review completion が date-only PATCH にならない

検証は関連テスト 12 pass / 1 skip（loopback listener 制約）でした。並行 Worker による未コミット変更が現在のワークツリーに存在しますが、本タスクでは変更・復元していません。

Next Read: [modes.tsx](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/modules/notes/ui/components/detail/modes.tsx:104)、[use-note-detail-summary-draft.ts](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/modules/notes/ui/hooks/use-note-detail-summary-draft.ts:140)、[desktop-close-bridge.ts](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/shared/desktop/desktop-close-bridge.ts:47)、[desktop-close-coordinator.tsx](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/app/_components/desktop-close-coordinator.tsx:211)。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260824/0114-specify-desktop-review-date-dirty-close-20260824-143-ceaf5400-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260824/0114-specify-desktop-review-date-dirty-close-20260824-143-ceaf5400-summary.md`
- `src-tauri/sidecar/launcher.cjs`
- `src-tauri/src/runtime.rs`
- `src/app/api/backups/route.ts`
- `src/app/api/desktop/health/route.ts`
- `src/modules/notes/ui/hooks/use-note-detail-summary-draft.ts`
- `src/server/backup/application/backup.service.d.ts`
- `src/server/backup/application/backup.service.js`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.d.ts`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `src/server/infrastructure/desktop-storage.d.ts`
- `src/server/infrastructure/desktop-storage.js`
- `test/backup/local-sqlite-backup-provider.test.js`
- `test/desktop/desktop-lifecycle.test.js`
- `test/desktop/desktop-storage.test.js`
- `test/desktop/fixtures/runtime-child.cjs`
- `test/notes/detail-summary-checkbox-contract.test.js`
