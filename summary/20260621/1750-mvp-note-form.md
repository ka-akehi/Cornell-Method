# Task Summary: mvp-note-form

## Objective

MVP 仕様に合わせて、ノート作成・編集で共通利用するフォームを実装する。`/notes/new` から `POST /api/notes` でノートを作成し、成功時に `/notes/[id]` へ遷移できる状態にする。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | MVP ノート作成・編集共通フォーム |
| 対象ファイル / ディレクトリ | `src/app/notes/_components/note-editor.tsx`, `src/app/notes/new/page.tsx` |
| 対象外 | ノート一覧、詳細の閲覧/編集/復習モード、バックアップ画面、API、Prisma、依存追加 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| Status | `git status --short` | 作業前から多数の未コミット変更あり |
| Design | `doc/MVP_SCREEN_DESIGN.md` | `NTE-020` の入力項目、レイアウト、MVP 外項目 |
| API | `doc/MVP_API_DESIGN.md` | `POST /api/notes` / `PATCH /api/notes/:id` の request / response / error 形式 |
| Task plan | `doc/MVP_IMPLEMENTATION_TASKS.md` | `mvp-note-form` の目的と完了条件 |
| Summary | `summary/20260621/1748-mvp-markdown-preview.md` | `MarkdownField` / `MarkdownPreview` の引き継ぎ |
| Summary | `summary/20260621/1736-mvp-layout-navigation-summary.md` | レイアウト作業後の引き継ぎ |
| Component | `src/app/notes/_components/markdown-field.tsx` | textarea + preview の props と表示仕様 |
| Component | `src/app/notes/_components/note-editor.tsx` | 旧 `@uiw/react-md-editor`、autosave、D&D、NoteCard 実装 |
| Page | `src/app/notes/new/page.tsx` | `NoteEditor mode="create"` 呼び出し |
| Validation | `src/lib/validation.ts` | `NotebookInput`、API error 型、日付/タグ/Cue validation |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/notes/_components/note-editor.tsx` | 旧フォームを MVP 共通フォームへ置換 | autosave、draft、D&D、NoteCard、`@uiw/react-md-editor` を使わない MVP 仕様へ合わせるため |
| `src/app/notes/_components/note-editor.tsx` | `mode="create" | "edit"` と `initial` props を維持 | 後続 `mvp-note-detail-modes` で編集フォームとして再利用できるようにするため |
| `src/app/notes/_components/note-editor.tsx` | タイトル、学習日、学習元、概要、タグ、Cue、本文、サマリー、次回復習日を実装 | `NTE-020` と API request に合わせるため |
| `src/app/notes/_components/note-editor.tsx` | 本文とサマリーに `MarkdownField` を使用 | `mvp-markdown-preview` 成果物をフォームへ組み込むため |
| `src/app/notes/_components/note-editor.tsx` | 保存時に `POST /api/notes` / `PATCH /api/notes/:id` へ送信し、成功時に `/notes/[id]` へ遷移 | MVP 作成フローを満たすため |
| `src/app/notes/_components/note-editor.tsx` | API error の `errors` をフィールド別に表示 | 400 の `{ code, message, errors? }` をユーザーに見える形にするため |
| `summary/20260621/1750-mvp-note-form.md` | 完了要約を追加 | 次回作業の起点を残すため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | `src/app/notes/[id]/page.tsx` も `NoteEditor` を import している | `rg "NoteEditor" -n src` |
| F-002 | fact | MVP API は `{ title, noteDate, sourceType, sourceTitle, overview, body, summary, nextReviewDate, cues, tags }` を直接受け取る | `doc/MVP_API_DESIGN.md`, `src/app/api/notes/route.ts` |
| F-003 | fact | 空 Cue は送信前に除外している | `src/app/notes/_components/note-editor.tsx` |
| A-001 | assumption | このタスクでは詳細ページ本体を直さないため、`NoteEditor` の旧 props 互換は最小限に留める | Worker Task の対象外指定 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npx eslint src/app/notes/_components/note-editor.tsx src/app/notes/new/page.tsx` | success | 対象ファイル単体は lint clean |
| `npm run lint` | failed | 対象外ファイル由来: `src/app/api/notes/export/route.ts`, `src/app/notes/[id]/page.tsx`, `src/app/notes/_components/notes-list.tsx`, `src/app/notes/backup/page.tsx`, `src/app/tasks/review/page.tsx` |
| `npm run build` | failed | network restricted により `next/font` が Google Fonts の `Geist` / `Geist Mono` を取得できず失敗 |
| `npx tsc --noEmit --pretty false` | failed | 対象外の旧モデル参照: `src/app/api/notes/export/route.ts`, `src/app/api/review-tasks/route.ts`, `src/app/api/undo/route.ts` |
| `git status --short` | completed | 作業後も多数の既存未コミット変更あり。今回の主変更は `note-editor.tsx` とこの summary |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 実ブラウザでの `/notes/new` 作成フロー | dev server 起動後に API/DB と合わせた手動確認 |
| U-002 | `npm run build` のコード到達後の結果 | Google Fonts 取得問題を解消、または font 設定をローカル化した後の再実行 |
| U-003 | 詳細ページから edit mode で使う際の initial 変換 | 後続 `mvp-note-detail-modes` で `src/app/notes/[id]/page.tsx` を MVP API response に合わせる |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `src/app/notes/_components/note-editor.tsx`
- `src/app/notes/_components/markdown-field.tsx`
- `src/app/notes/new/page.tsx`
- `src/app/notes/[id]/page.tsx`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
