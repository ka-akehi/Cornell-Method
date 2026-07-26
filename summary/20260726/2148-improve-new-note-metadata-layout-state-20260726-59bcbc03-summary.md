---
summary_type: task-summary
created_at: 2026-07-26 21:48 JST
task_kind: worker-task
task_status: done
---

## Objective

次回復習日を学習日の直下へ移動し、学習元未選択時の note-title を disabled にする。

## Scope

| 項目 | 内容 |
|---|---|
| task file | `codex-queue/tasks-ui/done/improve-new-note-metadata-layout-state-20260726-59bcbc03.task.md` |
| worker | Worker-ui |
| status | done |
| 対象 | editor metadata、入力部品、summary、契約テスト |
| 対象外 | Markdown、Canvas tool、API/DB |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks-ui/done/improve-new-note-metadata-layout-state-20260726-59bcbc03.task.md` | metadata 配置と disabled 条件 |
| source | `src/modules/notes/ui/components/editor/metadata.tsx` | 日付・タイトルの配置と状態 |
| test | `test/notes/editor-metadata-contract.test.js` | 保存 wiring、disabled、tag reset の契約 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/modules/notes/ui/components/editor/editor.tsx` | nextReviewDate を metadata section へ渡す wiring を変更 | 日付移動後も保存 payload を維持するため |
| `src/modules/notes/ui/components/editor/inputs.tsx` | TitleInput/TextInput に disabled と aria-disabled を追加 | 未選択状態を属性とアクセシビリティへ反映するため |
| `src/modules/notes/ui/components/editor/metadata.tsx` | 次回復習日を学習日の直下へ移動し、sourceType 未選択時の title を無効化 | 入力順と状態条件を改善するため |
| `src/modules/notes/ui/components/editor/summary.tsx` | 次回復習日を外し、保存・キャンセル配置を維持 | metadata 移動後の submit を維持するため |
| `test/notes/editor-metadata-contract.test.js` | 日付移動、title disabled、tag reset の契約を追加 | UI wiring の回帰を検知するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は done として完了処理された。 | task file |
| F-002 | fact | metadata の配置変更と title disabled の実差分、契約テストがある。 | `HEAD^..HEAD` の source/test diff |
| U-001 | unknown | lint、build、保存操作の手動確認結果は、この summary からは確認できない。 | 元taskの記録に結果なし |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `sh tools/check-summary.sh summary/20260726/2148-improve-new-note-metadata-layout-state-20260726-59bcbc03-summary.md` | PASS | 必須見出しと形式を確認 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 元taskの lint/build と新規・編集画面の保存確認 | task 実行記録または再実行結果 |

## Next Read

- `src/modules/notes/ui/components/editor/metadata.tsx`
- `src/modules/notes/ui/components/editor/inputs.tsx`
- `src/modules/notes/ui/components/editor/editor.tsx`
- `test/notes/editor-metadata-contract.test.js`
