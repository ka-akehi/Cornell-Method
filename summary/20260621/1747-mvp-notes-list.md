# Task Summary: mvp-notes-list

## Objective

`/notes` で保存済みノートを検索・絞り込みし、詳細・新規作成へ進める MVP 一覧画面を実装する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | MVP ノート一覧、検索、復習対象フィルタ |
| 対象ファイル | `src/app/notes/_components/notes-list.tsx`, `src/app/notes/page.tsx` |
| 対象外 | 詳細画面、作成フォーム追加改修、バックアップ画面、API、Prisma、依存追加 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| Status | `git status --short` | 作業前から多数の未コミット変更あり |
| Design | `doc/MVP_SCREEN_DESIGN.md` | `NTE-010` の表示項目、アクション、MVP 外項目 |
| Inventory | `doc/MVP_SCREEN_INVENTORY.md` | `SCR-001` の Action/Data、API 対応 |
| API | `doc/MVP_API_DESIGN.md` | `GET /api/notes`, `GET /api/tags` の query/response |
| Task plan | `doc/MVP_IMPLEMENTATION_TASKS.md` | `mvp-notes-list` の位置づけ |
| Summary | `summary/20260621/1750-mvp-note-form.md` | 前タスクの対象外・未確認事項 |
| Page | `src/app/notes/page.tsx` | `NotesList` 呼び出しのみ |
| Component | `src/app/notes/_components/notes-list.tsx` | 旧 response 参照と PDF export 導線 |
| API | `src/app/api/notes/route.ts` | 現在の `tags: { id, name, color }[]` と `tag` query |
| API | `src/app/api/tags/route.ts` | タグ候補一覧 response |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/notes/_components/notes-list.tsx` | MVP API response に合わせて一覧型と描画を更新 | 旧 `tags[].tag` 参照を廃止し、`tags: [{ id, name, color }]` を表示するため |
| `src/app/notes/_components/notes-list.tsx` | `GET /api/notes` の `query`, `from`, `to`, `tag`, `reviewDue`, `page` を組み立てる検索 UI を実装 | MVP の一覧検索・絞り込み条件に合わせるため |
| `src/app/notes/_components/notes-list.tsx` | `GET /api/tags` から候補を取得し、選択済みタグの重複追加を防止 | タグ OR 条件の UI 要件を満たすため |
| `src/app/notes/_components/notes-list.tsx` | タイトル、学習日、学習元、タグ、Cue 件数、要約状態、復習状態を表示 | `NTE-010` の一覧カード要件に合わせるため |
| `src/app/notes/_components/notes-list.tsx` | loading、error、0件状態、ページングを表示 | MVP 画面状態を揃えるため |
| `src/app/notes/_components/notes-list.tsx` | PDF 出力処理とボタンを削除 | PDF export は MVP 外のため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | `GET /api/notes` のタグ絞り込み query は `tag` であり、`tags` ではない | `src/app/api/notes/route.ts`, `doc/MVP_API_DESIGN.md` |
| F-002 | fact | `GET /api/notes` は `tags: [{ id, name, color }]` を返す | `formatListItem` / `formatTags` |
| F-003 | fact | `src/app/notes/page.tsx` は `NotesList` を返すだけで変更不要 | `src/app/notes/page.tsx` |
| A-001 | assumption | `reviewedAt` があり `nextReviewDate` がない場合を「復習済み」と表示する | MVP API の `reviewedAt` / `nextReviewDate` から一覧で状態化するため |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npx eslint src/app/notes/page.tsx src/app/notes/_components/notes-list.tsx` | success | 対象ファイル単体は lint clean |
| `npm run lint` | failed | 対象外ファイル由来: `src/app/api/notes/export/route.ts`, `src/app/notes/[id]/page.tsx`, `src/app/notes/backup/page.tsx`, `src/app/tasks/review/page.tsx` |
| `npm run build` | failed | network restricted により `next/font` が Google Fonts の `Geist` / `Geist Mono` を取得できず失敗 |
| `git status --short` | completed | 作業前から多数の既存未コミット変更あり。今回の主変更は `notes-list.tsx` とこの summary |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 実ブラウザでの `/notes` 検索操作 | dev server 起動後に API/DB と合わせた手動確認 |
| U-002 | `npm run build` のコード到達後の結果 | Google Fonts 取得問題を解消、または font 設定をローカル化した後の再実行 |
| U-003 | `/notes/[id]` 遷移後の詳細画面挙動 | 後続 `mvp-note-detail-modes` で対象ファイルを確認 |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `src/app/notes/_components/notes-list.tsx`
- `src/app/notes/page.tsx`
- `src/app/notes/[id]/page.tsx`
- `src/app/api/notes/[id]/route.ts`
- `src/app/api/notes/[id]/review/route.ts`
