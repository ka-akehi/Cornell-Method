---
summary_type: manager-summary
created_at: 2026-07-30 01:30 JST
task_status: verified
---

## Objective

30文字超のタグでエラー表示された後、同じ値を再度 Enter / 追加してタグが追加される問題を防ぐ。

## Scope

- タグ追加の成功・失敗判定
- ローカル長さエラーとタグAPI field error の更新
- Enter、追加ボタン、候補追加、削除の回帰

## Inputs Read

- `summary/20260730/0126-fix-tag-length-error-repeat-submit-20260730-1a9ee950-summary.md`
- `src/modules/notes/ui/components/editor/tags.tsx`
- `src/modules/notes/ui/components/editor/editor.tsx`
- `test/notes/editor-metadata-contract.test.js`

## Changes Made

- `addTagValue` が成功時だけ true を返し、成功時だけ入力欄をクリアするようにした。
- 30文字超、タグ数超過、重複時は毎回早期 return し、同じ不正値を再送しても追加されないようにした。
- 入力編集時とタグ削除時にローカルエラーを解除するようにした。
- タグ編集時に保存後の `tags` / `tags.N.name` field error を再評価し、古いエラー表示を残さないようにした。
- タグ名の保存値、最大12件、重複排除、API payload は変更していない。

## Findings

- 失敗時にも入力値を成功時と同じように消去していた候補追加経路と、タグ編集後も保存時の field error が残る経路が、再操作時の混乱要因だった。

## Verification

- `node --test test/notes/editor-metadata-contract.test.js`: pass (7)
- `node --test test/notes/*.test.js`: pass (49)
- `npx eslint src/modules/notes/ui/components/editor/tags.tsx src/modules/notes/ui/components/editor/editor.tsx test/notes/editor-metadata-contract.test.js`: pass
- `npm run build`: pass
- `git diff --check`: pass

## Remaining Unknowns

- in-app Browser backend が利用できないため、実ブラウザでの再Enter操作の直接確認は未実施。イベント経路を契約テストと Build で確認した。

## Next Read

- `src/modules/notes/ui/components/editor/tags.tsx:51`
- `src/modules/notes/ui/components/editor/editor.tsx:57`
- `test/notes/editor-metadata-contract.test.js:89`
