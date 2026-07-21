---
summary_type: task-summary
created_at: 2026-07-19 JST
task_kind: coding
task_status: done
---

## Objective

Canvas の単独 text と rect / ellipse の inline text に left / center / right alignment を追加し、CanvasDocumentV1 の保存・復元・viewer 表示まで同じ配置を維持する。

## Changes

- `CanvasTextAlign` と `textAlign` を canonical contract に追加。単独 text は `style.textAlign`、shape inline text は `textStyle.textAlign` とし、schemaVersion 1 と DB/API は変更していない。
- 既存の未指定 JSON は単独 text を left、shape inline text を center として表示・編集。drawing element の配置情報は validation で拒否。
- Fabric adapter の Textbox 作成・style 更新・CanvasDocument への逆変換で alignment を保持。
- toolbar に compact な左寄せ・中央寄せ・右寄せボタンを追加し、text target 以外では disabled。`aria-label`、`title`、`aria-pressed`、active state を付与。
- editor の新規 standalone text default、selected text、shape text edit session の style state / immediate preview / history commit を alignment 対応。

## Verification

- `npm run lint` — PASS
- `npx tsc --noEmit --pretty false` — PASS
- `npm run build` — PASS
- `git diff --check` — PASS
- Browser runtime QA — 未実施。利用可能な browser backend がなく、操作確認を開始できなかった。

## Next Read

- `src/shared/canvas/canvas-document.ts`
- `src/app/spikes/canvas/_lib/fabric-adapter.ts`
- `src/app/notes/_components/note-canvas-editor.tsx`
- `src/app/notes/_components/note-canvas-toolbar.tsx`
