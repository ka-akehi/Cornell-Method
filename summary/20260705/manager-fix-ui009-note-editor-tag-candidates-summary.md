# Manager Fix: UI-009 NoteEditor Tag Candidates

## Objective

`UI-009` の「NoteEditor で既存タグ候補を選択して保存できる」を補正した。

## Background

- `summary/20260705/mvp-ui-flow-verification-report.md` で `F-003` として Gap が確認された。
- Worker coding task `add-note-editor-tag-candidates-842b9957` と retry `retry-add-note-editor-tag-candidates-1b17c86b` は failed になり、変更ファイルはなかった。
- Worker failure reason を summary に残す仕組みは後続のために補強済み。

## Changes Made

| Path | Change |
|---|---|
| `src/app/notes/_components/note-editor.tsx` | `TagInput` で `GET /api/tags` を読み込み、既存タグ候補を select から追加できるようにした。 |
| `src/app/notes/_components/note-editor.tsx` | 候補追加でも `id`, `name`, `color` を保持し、重複防止と 12 件上限を既存の自由入力と共通化した。 |
| `src/app/notes/_components/note-editor.tsx` | 候補取得中、候補なし、取得失敗の表示を追加した。取得失敗時も自由入力は維持される。 |

## Verification

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run build` | PASS |

## Remaining Items

- sandbox の port bind 制限により、ブラウザでの実 UI 確認は未実施。
- ポート利用可能な環境で `/notes/new` と `/notes/[id]` 編集フォームの候補選択を再確認する必要がある。

## Next Read

- `summary/20260705/manager-fix-ui009-note-editor-tag-candidates-summary.md`
- `summary/20260705/mvp-ui-flow-verification-report.md`
- `src/app/notes/_components/note-editor.tsx`
