## Objective

セクション外枠ではなく、Cue と Summary の実際の入力フォームに枠線を付ける。

## Scope

- `src/modules/notes/ui/components/editor/cues.tsx`
- `src/modules/notes/ui/components/editor/summary.tsx`
- `src/app/styles/note-paper.css`
- `test/notes/note-paper-spacing-contract.test.js`
- Worker task: `move-cue-summary-border-to-input-forms-20260730-2f879cfc`

## Inputs Read

- `summary/20260730/0240-manager-verify-add-cue-summary-borders-20260730.md`
- `summary/20260730/0242-move-cue-summary-border-to-input-forms-20260730-2f879cfc-summary.md`
- Worker task の完了ファイル
- Cue / Summary コンポーネント、MarkdownField、paper CSS、契約テストの差分

## Changes Made

- Cue の各 `textarea` を四辺枠・角丸・内側余白付きの入力フォームへ変更した。
- Summary の Markdown 入力 `textarea` も四辺枠・角丸・内側余白付きに変更した。
- `note-paper-cue-frame` / `note-paper-summary-frame` の外側セクション枠を撤去した。
- 新規作成画面でも Cue / Summary の入力枠が透明化されないよう、既存 create 用透明化 CSS との競合を解消した。
- Cue の追加・削除・スクロール、Summary の入力/プレビュー切替、Cornell の responsive 境界線は維持した。
- 契約テストを外側 frame の確認から、直接フォーム枠と frame 不在の確認へ更新した。

## Findings

- 前回の外枠は発注者の意図と異なっていたため、今回の task で外枠を除去し、入力対象そのものへ枠線を移した。
- Summary のプレビュー面は変更せず、入力表示時の textarea を対象にした。

## Verification

- `node --test test/notes/note-paper-spacing-contract.test.js` — 7 passed
- `node --test test/notes/*.test.js` — 51 passed
- `npx eslint src/modules/notes/ui/components/editor/cues.tsx src/modules/notes/ui/components/editor/summary.tsx test/notes/note-paper-spacing-contract.test.js` — passed
- 外側 frame class search — `note-paper-cue-frame` / `note-paper-summary-frame` なし
- `git diff --check` — passed
- `npm run build` — passed
- 実ブラウザ表示確認 — 未実施（利用可能な Browser backend がないため）

## Remaining Unknowns

- 実ブラウザ上で、新規作成・既存編集の各入力フォーム枠の見た目は未確認。実画面を再読み込みして確認が必要。

## Next Read

- `src/modules/notes/ui/components/editor/cues.tsx` の Cue `textarea` class
- `src/modules/notes/ui/components/editor/summary.tsx` の `textareaClassName`
- `src/app/styles/note-paper.css` の create 用 textarea 透明化規則
