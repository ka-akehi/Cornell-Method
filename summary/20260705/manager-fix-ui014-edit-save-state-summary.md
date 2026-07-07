# Manager Fix: UI-014 Edit Save State

## Objective

`UI-014` の「詳細編集保存後に最新値が閲覧表示へ反映されるか」を補正した。

## Background

- `summary/20260705/mvp-ui-flow-verification-report.md` で `F-002` として高優先の不具合候補が確認された。
- Worker coding task `fix-edit-save-detail-state-a609bbe8` と retry `retry-fix-edit-save-detail-state-aa447b2f` は、どちらも変更なしで failed になった。
- 同じ Worker task を繰り返すと重複になるため、Manager が最小範囲で直接補正した。

## Changes Made

| Path | Change |
|---|---|
| `src/app/notes/_components/note-editor.tsx` | 保存成功時の API レスポンスを親へ渡す `onSaved` callback と `NoteEditorSavedNote` 型を追加した。edit mode では `onSaved` があれば遷移ではなく callback 経由で state 更新へ渡す。 |
| `src/app/notes/_components/note-detail-modes.tsx` | edit mode の `NoteEditor` に `onSaved` を渡し、保存後に `note` / `reviewNextDate` / `showBody` / `error` / `mode` を更新するようにした。 |

## Verification

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run build` | PASS |

## Remaining Items

- sandbox の port bind 制限により、ブラウザでの実 UI 確認は未実施。
- `UI-009` の既存タグ候補選択 UI は未対応。別 task で扱う。

## Next Read

- `summary/20260705/manager-fix-ui014-edit-save-state-summary.md`
- `summary/20260705/mvp-ui-flow-verification-report.md`
- `src/app/notes/_components/note-editor.tsx`
- `src/app/notes/_components/note-detail-modes.tsx`
