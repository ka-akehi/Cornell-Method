---
summary_type: task-summary
created_at: 2026-07-07 00:59 JST
task_kind: worker-task
task_status: done
---

## Objective

Notes UI の API 呼び出しを `src/modules/notes/remote` に集約し、UI component から通常の API `fetch`、query string 生成、API error body decode の詳細を外す。

## Changes Made

| パス | 変更内容 |
|---|---|
| `src/modules/notes/remote/index.ts` | notes list / tag options / note create / update / delete / review completion / detail fetch の remote 関数を追加。`NotesRemoteError` で API error body と field errors を保持。 |
| `src/app/notes/_components/notes-list.tsx` | 一覧取得とタグ候補取得を remote 関数へ置換。query string 生成と error decode を UI から削除。 |
| `src/app/notes/_components/note-editor.tsx` | create / update / tag candidates fetch を remote 関数へ置換。validation field errors は `NotesRemoteError.fieldErrors` から既存 UI state に反映。 |
| `src/app/notes/_components/note-detail-modes.tsx` | review completion / delete を remote 関数へ置換。既存の state 更新、遷移、文言は維持。 |
| `src/app/notes/[id]/page.tsx` | SSR detail fetch を `fetchNoteDetail` へ置換し、`cache: "no-store"` と base URL 解決を維持。 |

## Verification

| コマンド | 結果 |
|---|---|
| `npm run lint` | success |
| `npm run build` | success |
| `rg -n "fetch\\(|URLSearchParams|response\\.json|res\\.json|/api/notes|/api/tags" src/app/notes/_components 'src/app/notes/[id]/page.tsx'` | match なし |

## Notes

- API response shape / request body shape は変更していない。
- `.next` 配下の build artifacts は確認対象外。
- 作業前後に `git status --short` を確認済み。既存の未コミット変更は戻していない。

## Next Read

- `src/modules/notes/remote/index.ts`
- `src/app/notes/_components/notes-list.tsx`
- `src/app/notes/_components/note-editor.tsx`
- `src/app/notes/_components/note-detail-modes.tsx`
- `src/app/notes/[id]/page.tsx`
