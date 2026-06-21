# Task Summary: mvp-note-detail-modes

## Objective

`/notes/[id]` で MVP API response に合わせた閲覧・編集・復習・削除モードを実装する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | ノート詳細 MVP |
| 対象ファイル | `src/app/notes/[id]/page.tsx`, `src/app/notes/_components/note-detail-modes.tsx`, `src/app/notes/_components/note-editor.tsx` |
| 対象外 | API / Prisma / validation / 一覧 / バックアップ / Phase 2 機能 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| Status | `git status --short` | 作業前から多数の未コミット変更あり |
| Design | `doc/MVP_SCREEN_DESIGN.md` | `NTE-030` の閲覧・編集・復習モード要件 |
| Inventory | `doc/MVP_SCREEN_INVENTORY.md` | `SCR-002` / `SCR-004` の Action/Data |
| API | `doc/MVP_API_DESIGN.md` | `GET/PATCH/DELETE /api/notes/:id`, `POST /api/notes/:id/review` |
| Task plan | `doc/MVP_IMPLEMENTATION_TASKS.md` | `mvp-note-detail-modes` の位置づけ |
| Summary | `summary/20260621/1747-mvp-notes-list.md` | 一覧から詳細への引き継ぎ |
| Summary | `summary/20260621/1750-mvp-note-form.md` | `NoteEditor` の props と保存仕様 |
| Summary | `summary/20260621/1748-mvp-markdown-preview.md` | `MarkdownPreview` の利用方針 |
| Page | `src/app/notes/[id]/page.tsx` | 旧モデル参照と旧 edit-only 表示 |
| Component | `src/app/notes/_components/note-editor.tsx` | `mode="edit"` と `initial` の受け口 |
| Component | `src/app/notes/_components/markdown-field.tsx` | `MarkdownPreview` の props |
| API | `src/app/api/notes/[id]/route.ts` | 現行 detail response の形 |
| API | `src/app/api/notes/[id]/review/route.ts` | review update response の形 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/notes/[id]/page.tsx` | 旧 `tag.tag`, `cueCards`, `noteCards`, `draftState` 参照を削除し、MVP response を `NoteDetailModes` へ渡す薄い server page に置換 | 現行 API response に合わせるため |
| `src/app/notes/[id]/page.tsx` | `params: Promise<{ id: string }>` として扱うよう更新 | Next.js 16 App Router 前提に合わせるため |
| `src/app/notes/_components/note-detail-modes.tsx` | 閲覧モード、編集モード、復習モード、削除確認を実装 | `NTE-030` / `SCR-002` / `SCR-004` を満たすため |
| `src/app/notes/_components/note-detail-modes.tsx` | 復習モードで本文初期非表示、表示切替、次回復習日入力、`POST /api/notes/:id/review` を実装 | MVP 復習フローを満たすため |
| `src/app/notes/_components/note-editor.tsx` | 任意の `onCancel` prop を追加 | 詳細編集モードのキャンセルを `/notes` 遷移ではなく閲覧モード復帰にするため |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npx eslint 'src/app/notes/[id]/page.tsx'` | success | 指定コマンド |
| `npx eslint 'src/app/notes/[id]/page.tsx' src/app/notes/_components/note-detail-modes.tsx src/app/notes/_components/note-editor.tsx` | success | 変更ファイル周辺 |
| `npm run lint` | failed | 対象外ファイル由来: `src/app/api/notes/export/route.ts`, `src/app/notes/backup/page.tsx`, `src/app/tasks/review/page.tsx` |
| `npm run build` | failed | network restricted により `next/font` が Google Fonts の `Geist` / `Geist Mono` を取得できず失敗 |
| `npx tsc --noEmit --pretty false` | failed | 対象外旧 Phase 2 API 由来: `src/app/api/notes/export/route.ts`, `src/app/api/review-tasks/route.ts`, `src/app/api/undo/route.ts` |
| `git status --short` | completed | 作業後も多数の既存未コミット変更あり |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 実ブラウザでの閲覧・編集・復習・削除フロー | dev server と DB を使った手動確認 |
| U-002 | `npm run build` のコード到達後の結果 | Google Fonts 取得問題を解消した後の再実行 |

## Next Read

- `src/app/notes/[id]/page.tsx`
- `src/app/notes/_components/note-detail-modes.tsx`
- `src/app/notes/_components/note-editor.tsx`
- `src/app/api/notes/[id]/route.ts`
- `src/app/api/notes/[id]/review/route.ts`
