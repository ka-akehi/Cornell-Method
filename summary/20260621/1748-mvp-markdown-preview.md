# Task Summary: mvp-markdown-preview

## Objective

ノート作成・編集・詳細表示から再利用できる textarea ベースの Markdown 入力部品と Markdown preview 部品を追加する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | MVP UI 共通 Markdown 入力 / 表示 |
| 対象ファイル / ディレクトリ | `src/app/notes/_components/markdown-field.tsx` |
| 対象外 | 既存 `NoteEditor` の全面置換、ノート作成フォーム全体、詳細モード、API、Prisma、依存削除 / 追加 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| Status | `git status --short` | 作業前から多数の未コミット変更あり |
| Design | `doc/MVP_SCREEN_DESIGN.md` | MVP は textarea + preview、リッチエディタなし |
| Technical | `doc/MVP_TECHNICAL_DESIGN.md` | Markdown 表示は `react-markdown` + `remark-gfm` + `rehype-sanitize` 方針 |
| Task list | `doc/MVP_IMPLEMENTATION_TASKS.md` | `mvp-markdown-preview` の目的と完了条件 |
| Package | `package.json` | 必要依存は既に存在、追加不要 |
| Existing UI | `src/app/notes/_components/note-editor.tsx` | 旧 `@uiw/react-md-editor` 実装が残存、今回は全面置換しない |
| Handoff | `summary/20260621/1651-mvp-validation-schemas.md` | 既存 API/UI の旧 Phase 2 参照が検証失敗要因として残っている |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/notes/_components/markdown-field.tsx` | `MarkdownField` を追加 | controlled textarea、label、placeholder、error、helper text、preview 表示切替をフォームから再利用できるようにするため |
| `src/app/notes/_components/markdown-field.tsx` | `MarkdownPreview` を追加 | 閲覧モードや復習モードでも同じ Markdown 表示を使えるようにするため |
| `src/app/notes/_components/markdown-field.tsx` | `react-markdown`、`remark-gfm`、`rehype-sanitize` を適用 | GFM と XSS 対策を MVP 方針に合わせるため |
| `src/app/notes/_components/markdown-field.tsx` | preview checkbox を `readOnly`、`tabIndex=-1`、click/change prevent にした | preview 内チェックボックスを表示専用にするため |
| `summary/20260621/1748-mvp-markdown-preview.md` | 完了要約を追加 | 次回作業の起点を残すため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | `react-markdown`、`remark-gfm`、`rehype-sanitize` は既に依存に含まれている | `package.json` |
| F-002 | fact | `rehype-sanitize` の default schema は GFM task list 用の checkbox input を許可している | `node_modules/hast-util-sanitize/lib/schema.js` |
| F-003 | fact | 既存 `NoteEditor` は旧 `@uiw/react-md-editor` 実装のまま | `src/app/notes/_components/note-editor.tsx` |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npx eslint src/app/notes/_components/markdown-field.tsx` | success | 追加ファイル単体は lint clean |
| `npm run lint` | failed | 対象外の既存ファイルで失敗: `src/app/api/notes/export/route.ts`、`src/app/notes/[id]/page.tsx`、`src/app/notes/_components/notes-list.tsx`、`src/app/notes/backup/page.tsx`、`src/app/tasks/review/page.tsx` |
| `npx tsc --noEmit --pretty false` | failed | 対象外の旧モデル参照で失敗: `src/app/api/notes/export/route.ts`、`src/app/api/review-tasks/route.ts`、`src/app/api/undo/route.ts` |
| `npm run build` | failed | `.next/lock` により `Another next build process is already running.`。`ps` は sandbox で `operation not permitted` |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 実画面での組み込み後レイアウト | `mvp-note-form` / `mvp-note-detail-modes` 実装時のブラウザ確認 |
| U-002 | 既存 `.next/lock` の由来 | sandbox 外でのプロセス確認、または実行中 build の終了確認 |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `src/app/notes/_components/markdown-field.tsx`
- `src/app/notes/_components/note-editor.tsx`
- `src/app/notes/new/page.tsx`
- `src/app/notes/[id]/page.tsx`
