## Objective

日付 input 内のクリックではカレンダーを開き、学習日・次回復習日のラベルクリックではカレンダーを開かないようにする。

## Scope

- `src/modules/notes/ui/components/editor/inputs.tsx`
- `test/notes/editor-metadata-contract.test.js`
- Worker task: `suppress-date-picker-on-label-click-20260730-d698ba3b`

## Inputs Read

- `summary/20260730/0215-manager-verify-date-picker-click-20260730.md`
- `summary/20260730/0215-suppress-date-picker-on-label-click-20260730-d698ba3b-summary.md`
- Worker task の完了ファイル
- 対象ソースと対象契約テストの差分

## Changes Made

- `TextInput` の date 型ラベルに `onClick` を追加し、ラベルのデフォルト代理クリックを `preventDefault()` で抑制した。
- `htmlFor` / `id` のラベル関連付けは維持した。
- date input 本体の `showPicker()` と非対応時の `focus()` フォールバックは維持した。
- 契約テストに、date 型ラベルの picker 抑制と text 型への非適用を追加した。

## Findings

- ラベルクリックでカレンダーが開いていた原因は、`label htmlFor` の代理 input クリックが date input の `onClick` を発火していたため。
- ラベルの関連付け自体は残し、カレンダー起動だけを抑制している。

## Verification

- `node --test test/notes/editor-metadata-contract.test.js` — 8 passed
- `node --test test/notes/*.test.js` — 50 passed
- `npx eslint src/modules/notes/ui/components/editor/inputs.tsx test/notes/editor-metadata-contract.test.js` — passed
- `git diff --check` — passed
- `npm run build` — passed
- 実ブラウザ操作確認 — 未実施（利用可能な Browser backend がないため）

## Remaining Unknowns

- 実ブラウザ上で、ラベルクリックでは picker が開かず、input 内クリックでは picker が開くことは未確認。実環境では画面を再読み込みして確認が必要。

## Next Read

- `src/modules/notes/ui/components/editor/inputs.tsx` の date label `onClick` と date input `onClick`
- `test/notes/editor-metadata-contract.test.js` の date input 契約テスト
