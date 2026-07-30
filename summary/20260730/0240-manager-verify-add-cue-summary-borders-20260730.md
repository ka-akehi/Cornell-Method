## Objective

キューと Summary の入力領域を視認しやすくするため、セクション外枠を追加する。

## Scope

- `src/modules/notes/ui/components/editor/cues.tsx`
- `src/modules/notes/ui/components/editor/summary.tsx`
- `src/app/styles/note-paper.css`
- `test/notes/note-paper-spacing-contract.test.js`
- Worker task: `add-cue-summary-section-borders-20260730-09c3d03e`

## Inputs Read

- `summary/20260730/0220-manager-verify-suppress-date-picker-label-20260730.md`
- `summary/20260730/0208-open-date-picker-from-full-date-input-20260730-32a91f6c-summary.md`
- Worker task の完了ファイル
- Cue / Summary コンポーネント、paper CSS、契約テストの差分

## Changes Made

- Cue 列へ `note-paper-cue-frame` を追加し、Cue セクション全体の外枠を表示するようにした。
- Summary セクションへ `note-paper-summary-frame` を追加し、Markdown 入力・プレビュー・操作領域を外枠で囲んだ。
- 外枠は `--paper-line`、既存の角丸・余白方針を利用した。
- desktop では Cornell の30%境界線と重複しないよう Cue の右枠を省略し、mobile では右枠を復元した。
- mobile の Cue 下区切り線、Cue 内スクロール、Summary の Markdown 入力/プレビュー切替を維持した。
- Cue / Summary 外枠と responsive Cornell 境界の契約テストを追加した。

## Findings

- 既存の Cornell 中央境界線は grid 擬似要素が担当しているため、Cue 外枠の右線を desktop で重ねない構成にした。
- Summary は既存の section padding を維持した上で外枠を追加し、保存・キャンセル操作も同じ枠内に保持した。

## Verification

- `node --test test/notes/note-paper-spacing-contract.test.js` — 7 passed
- `node --test test/notes/*.test.js` — 51 passed
- `npx eslint src/modules/notes/ui/components/editor/cues.tsx src/modules/notes/ui/components/editor/summary.tsx test/notes/note-paper-spacing-contract.test.js` — passed
- CSS lint attempt: `src/app/styles/note-paper.css` は ESLint 設定対象外の warning のみ、error なし
- `git diff --check` — passed
- `npm run build` — passed
- 実ブラウザ表示確認 — 未実施（利用可能な Browser backend がないため）

## Remaining Unknowns

- 実ブラウザ上で各 viewport の枠線の見た目、長い Cue のスクロール、Summary の枠内レイアウトは未確認。実画面で再読み込みして確認が必要。

## Next Read

- `src/modules/notes/ui/components/editor/cues.tsx` の `note-paper-cue-frame`
- `src/modules/notes/ui/components/editor/summary.tsx` の `note-paper-summary-frame`
- `src/app/styles/note-paper.css` の両 frame と responsive rules
