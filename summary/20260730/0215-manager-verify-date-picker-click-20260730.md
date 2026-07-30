## Objective

学習日と次回復習日の date input を、カレンダーアイコンだけでなく入力フォーム全体のクリックで操作できるようにする。

## Scope

- `src/modules/notes/ui/components/editor/inputs.tsx`
- `test/notes/editor-metadata-contract.test.js`
- Worker task: `open-date-picker-from-full-date-input-20260730-32a91f6c`

## Inputs Read

- `HANDOFF_2026-07-27.md`
- `summary/20260730/0208-open-date-picker-from-full-date-input-20260730-32a91f6c-summary.md`
- Worker task の完了ファイル
- 対象ソースと対象契約テストの差分

## Changes Made

- 共通 `TextInput` に date input 用のクリック処理を追加した。
- `type="date"` のクリック時だけ `HTMLInputElement.showPicker()` を呼び、フォーム領域からネイティブ日付ピッカーを開くようにした。
- `showPicker` 非対応または例外発生時は `focus()` にフォールバックし、disabled input は操作しない。
- `type="text"` のタイトル等にはクリック処理を付与していない。
- date input 限定、disabled 処理、`showPicker` とフォールバックを契約テストで固定した。

## Findings

- 学習日・次回復習日は共通 `TextInput` の `type="date"` なので、共通コンポーネント側で日付型だけを扱うことで両方へ適用できた。
- 既存の `onChange`、`max`、`required`、disabled、エラー表示、ARIA 属性は変更していない。

## Verification

- `node --test test/notes/editor-metadata-contract.test.js` — 8 passed
- `node --test test/notes/*.test.js` — 50 passed
- `npx eslint src/modules/notes/ui/components/editor/inputs.tsx test/notes/editor-metadata-contract.test.js` — passed
- `git diff --check` — passed
- `npm run build` — passed
- 実ブラウザ操作確認 — 未実施（利用可能な Browser backend がないため）

## Remaining Unknowns

- 実ブラウザ上で、入力欄の値表示部分をクリックした際に各ブラウザのネイティブ日付ピッカーが表示されることは未確認。実環境では画面を再読み込みして確認が必要。

## Next Read

- `src/modules/notes/ui/components/editor/inputs.tsx` の `openDatePicker` と `TextInput` の `onClick`
- `test/notes/editor-metadata-contract.test.js` の date input 契約テスト
