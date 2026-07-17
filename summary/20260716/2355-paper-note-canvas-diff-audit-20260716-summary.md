---
summary_type: task-summary
created_at: 2026-07-16 JST
task_kind: worker-task
task_status: done
---

## Objective

概念画像 `doc/screens/assets/mockups/mvp-paper-note-canvas-concept.png` と現行 create / detail view / edit / review の DOM・class・表示 state を照合し、差分、仕様競合、responsive rule、次の UI Worker task を設計書へ固定した。

## Changes Made

| Path | 内容 |
| --- | --- |
| `doc/screens/MVP_SCREEN_DESIGN.md` | 画像の上から下への領域分解、現行 DOM/state 表、実装済み／部分一致／未実装／仕様競合の差分表、画像と MVP 契約の解決、1440 / 375 の fluid rule、`UI-PAPER-011`〜`015` と QA の依存順を追加。旧 `UI-PAPER-001`〜`010` は履歴として整理 |
| `doc/screens/MVP_SCREEN_INVENTORY.md` | As-Is を現行コードの実態へ補正し、画像領域・モード別完成イメージ・responsive 差分・競合解決・1 file 1 task の棚卸しを同期 |
| `summary/20260716/2355-paper-note-canvas-diff-audit-20260716-summary.md` | 完了要約と次回の最小 Read を記録 |

## Key Findings

- 背景、brand/nav、暖色 paper shell、create/edit の body textarea → Preview、review の body / Summary 初期 mask は既存実装にある。
- app chrome 右上 state badge、画像相当の metadata 一行帯、notebook ruled horizontal lines、detail の Cornell local scroll、paper-native Preview、Summary/footer の一体化は未達または部分一致。
- detail edit は外側 `h1` と embedded `NoteEditor` title input が重複する。
- PNG の `編集中` と visible Summary は create/edit の視覚正本と解釈し、review は MVP 契約どおり Summary 初期非表示を維持する。概要、nextReviewDate、reviewedAt、Cue list / 一つの body も削除・分割しない。

## Next Task Order

1. `UI-PAPER-011` — `src/app/layout.tsx` — common chrome state slot
2. `UI-PAPER-012` — `src/app/globals.css` — fluid paper shell / ruling / responsive CSS
3. `UI-PAPER-013` — `src/shared/markdown/markdown-field.tsx` — shared Preview surface
4. `UI-PAPER-014` — `src/app/notes/_components/note-editor.tsx` — create/edit paper
5. `UI-PAPER-015` — `src/app/notes/_components/note-detail-modes.tsx` — detail view/review paper
6. `QA-PAPER-011` — `doc/testing/TEST_SCENARIOS.md` — 375 / 768 / 1280 / 1440 evidence

Dependencies are fixed as `011 → 012 → 013 → 014 / 015 → QA`; 014 and 015 may run in parallel after 013 when their edit-shell handoff is checked.

## Verification

- Concept PNG inspected: 1672 × 941.
- Worktree status checked before and after; existing code, mock, and summary changes were preserved.
- `git diff --check`: PASS.
- `npm run lint` / `npm run build`: not run because this task changed documentation only.

## Next Read

- `summary/20260716/2355-paper-note-canvas-diff-audit-20260716-summary.md`
- `doc/screens/MVP_SCREEN_DESIGN.md` の「概念画像と現行 DOM の詳細差分」「監査後の UI coding task」
- `doc/screens/MVP_SCREEN_INVENTORY.md` の「概念画像と現行 DOM の差分」「後続 Worker task と依存順」
- 次の coding task では `src/app/layout.tsx` と `doc/implementation/MVP_CONTRACT.md` を最小確認する
