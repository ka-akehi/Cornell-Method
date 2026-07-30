---
summary_type: manager-summary
created_at: 2026-07-30 01:05 JST
task_status: verified
---

## Objective

長いタグ名でタグ欄の高さが異常に伸び、Cornell セクションが押し下げられる問題を解消する。

## Scope

- タグチップの長文表示
- 新規タグ入力の30文字制限
- タグ名保持、削除操作、既存タグ追加の回帰

## Inputs Read

- `summary/20260730/0102-stabilize-long-tag-layout-20260730-15b1c8a3-summary.md`
- `src/modules/notes/ui/components/editor/tags.tsx`
- `test/notes/editor-metadata-contract.test.js`
- ユーザー提供の `/Users/blp542/Desktop/スクショ/スクリーンショット 2026-07-30 0.55.38.png`

## Changes Made

- タグチップを `overflow-hidden` と `truncate` で一行表示にし、長いタグで縦方向に伸びないようにした。
- 省略表示でも完全なタグ名を `title` と state/API に保持する。
- 削除ボタンを shrink させず常に表示する。
- 新規タグ入力に30文字制限を追加し、候補追加時も30文字超を拒否する。
- タグ表示と既存の追加・削除・重複制御を契約テストで固定した。

## Findings

- スクリーンショットの崩れは `break-all` によるタグチップの多行化が原因だった。
- API/DB のタグ値を切り詰める変更はなく、表示のみを安定化している。

## Verification

- `node --test test/notes/editor-metadata-contract.test.js`: pass (5)
- `node --test test/notes/*.test.js`: pass (47)
- `npx eslint src/modules/notes/ui/components/editor/tags.tsx test/notes/editor-metadata-contract.test.js`: pass
- `npm run build`: pass
- `git diff --check`: pass

## Remaining Unknowns

- in-app Browser backend が利用できないため、修正後の実ブラウザ画面を Manager が直接撮影する確認は未実施。スクリーンショットで特定した多行化原因と契約テスト・Buildで確認した。

## Next Read

- `src/modules/notes/ui/components/editor/tags.tsx:108`
- `test/notes/editor-metadata-contract.test.js:99`
