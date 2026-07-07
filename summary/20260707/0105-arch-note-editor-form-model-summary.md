---
summary_type: task-summary
created_at: 2026-07-07 01:05 JST
task_kind: worker-task
task_status: done
---

## Objective

`src/app/notes/_components/note-editor.tsx` から notes editor の form model / payload 変換 / field error helper を分離し、後続の component 分割に備える。

## Changes Made

| パス | 変更内容 |
|---|---|
| `src/modules/notes/model/note-editor-form.ts` | `NoteEditor` 用の form state 型、initial から form state を作る処理、cue normalize、`NotebookInput` payload 変換、field error helper、source type option を移動。 |
| `src/modules/notes/model/index.ts` | notes model module の公開口を追加。 |
| `src/app/notes/_components/note-editor.tsx` | component 内の model / payload 変換定義を削除し、`@/modules/notes/model` の helper を利用するよう差し替え。UI 表示、保存フロー、remote 呼び出し、request / response shape は維持。 |

## Verification

| コマンド | 結果 |
|---|---|
| `npm run lint` | success |
| `npm run build` | success |

## Notes

- 作業前後に `git status --short` を確認済み。
- 既存の未コミット変更は戻していない。
- `.next` 配下の build artifacts は確認対象外。

## Next Read

- `src/modules/notes/model/note-editor-form.ts`
- `src/modules/notes/model/index.ts`
- `src/app/notes/_components/note-editor.tsx`
