## Objective

30文字を超える新規タグが、入力時の暗黙的な切り捨てによってエラーなしで追加される問題を解消する。

## Scope

- `src/modules/notes/ui/components/editor/tags.tsx`
- `test/notes/editor-metadata-contract.test.js`
- Worker task: `remove-silent-tag-input-truncation-20260730-868dca21`

## Inputs Read

- `summary/20260730/0135-remove-silent-tag-input-truncation-20260730-868dca21-summary.md`
- Worker task の完了ファイル
- 対象ソースと対象契約テストの差分

## Changes Made

- 新規タグ入力の native `maxLength` を削除し、31文字以上の入力をブラウザに黙って30文字へ切り詰めさせないようにした。
- `addTagValue` の30文字超過チェックを維持し、追加操作（Enter / 追加ボタン / 候補追加）でエラー表示と追加拒否を行う。
- 追加成功時だけ入力欄をクリアし、入力を修正するとローカルエラーをクリアする挙動を維持した。
- 契約テストに、native `maxLength` がないこと、超過値を繰り返し拒否することを追加した。

## Findings

- 原因は `maxLength={30}` によるブラウザの暗黙的な切り捨てだった。追加ハンドラが受け取る時点では既に30文字以内になっていたため、バリデーションエラーが発生しなかった。
- 修正後は入力値を保持したまま追加時に長さを判定するため、30文字超過時は追加されず、`タグ名は30文字以内で入力してください。` が表示される。

## Verification

- `node --test test/notes/editor-metadata-contract.test.js` — 7 passed
- `node --test test/notes/*.test.js` — 49 passed
- `npx eslint src/modules/notes/ui/components/editor/tags.tsx test/notes/editor-metadata-contract.test.js` — passed
- `git diff --check` — passed
- `npm run build` — passed
- ブラウザ実機確認 — 未実施（利用可能な Browser backend がないため）

## Remaining Unknowns

- 実ブラウザでの表示確認は未実施。入力欄へ31文字以上を入力して Enter / 追加ボタンを押した際のエラー表示は、ローカル画面の再読み込み後に確認が必要。

## Next Read

- `src/modules/notes/ui/components/editor/tags.tsx` の `addTagValue` と新規タグ入力欄
- `test/notes/editor-metadata-contract.test.js` のタグ入力契約テスト
