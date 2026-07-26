---
summary_type: task-summary
created_at: 2026-07-26 22:43 JST
task_kind: worker-task
task_status: done
---

## Objective

保存失敗時にフォーム順で最初の field error へ scroll/focus し、対象不明時は alert へ fallback する。

## Scope

| 項目 | 内容 |
|---|---|
| task file | `codex-queue/tasks-ui/done/jump-to-create-error-field-20260726-d6177e4f.task.md` |
| worker | Worker-ui |
| status | done |
| 対象 | editor error mapping、Canvas viewport、tag input、契約テスト |
| 対象外 | API、DB、Canvas document、Markdown renderer |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks-ui/done/jump-to-create-error-field-20260726-d6177e4f.task.md` | field mapping、DOM order、fallback 条件 |
| source | `src/modules/notes/ui/components/editor/error-focus.ts` | error field から target への mapping |
| test | `test/notes/editor-error-focus-contract.test.js` | mapping、DOM order、fallback の契約 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/modules/notes/ui/components/editor/editor.tsx` | 保存失敗を一度だけ scroll/focus する effect と alert fallback を追加 | 最初の field error を視認可能にするため |
| `src/modules/notes/ui/components/editor/error-focus.ts` | field error を DOM target id へ変換し、DOM 順で target を解決 | API error 配列順に依存しないため |
| `src/modules/notes/ui/components/canvas/editor.tsx` | Canvas viewport/error に id、aria-invalid、aria-describedby を付与 | Canvas error の focus target を提供するため |
| `src/modules/notes/ui/components/canvas/surface.tsx` | viewport の id/ARIA props を受け取るように変更 | Canvas editor から属性を渡すため |
| `src/modules/notes/ui/components/editor/tags.tsx` | tag input と indexed error の aria 属性・id を追加 | tags error の focus/説明対象を提供するため |
| `test/notes/editor-error-focus-contract.test.js` | mapping、DOM order、unavailable target、reduced-motion、alert fallback の契約を追加 | error focus の回帰を検知するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は done として完了処理された。 | task file |
| F-002 | fact | error mapping、Canvas/tag target、focus 契約が実差分にある。 | `HEAD^..HEAD` の source/test diff |
| U-001 | unknown | lint、build、実フォームでの scroll/focus 確認結果は、この summary からは確認できない。 | 元taskの記録に結果なし |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `sh tools/check-summary.sh summary/20260726/2243-jump-to-create-error-field-20260726-d6177e4f-summary.md` | PASS | 必須見出しと形式を確認 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 元taskの lint/build と create/edit の実フォーム確認 | task 実行記録または再実行結果 |

## Next Read

- `src/modules/notes/ui/components/editor/error-focus.ts`
- `src/modules/notes/ui/components/editor/editor.tsx`
- `src/modules/notes/ui/components/canvas/editor.tsx`
- `test/notes/editor-error-focus-contract.test.js`
