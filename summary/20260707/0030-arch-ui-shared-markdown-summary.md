# Task Summary

## Objective

`MarkdownField` / `MarkdownPreview` の正規配置を `src/shared/markdown` に移し、notes component から shared import へ切り替えた。Markdown sanitize、GFM checkbox の表示専用挙動、textarea + preview の UI 挙動は維持した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | UI architecture migration / shared markdown |
| 対象ファイル / ディレクトリ | `src/shared/markdown/**`, `src/app/notes/_components/markdown-field.tsx`, `src/app/notes/_components/note-editor.tsx`, `src/app/notes/_components/note-detail-modes.tsx` |
| 対象外 | デザイン変更、Phase 2 機能追加、API Route Handler、Prisma schema、DB migration、date helper shared 化 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| design | `doc/technical/ARCHITECTURE_MIGRATION_PLAN.md` | shared markdown 整理の位置づけと移行制約 |
| summary | `summary/20260705/manager-markdown-sanitize-checkbox-verification-report.md` | 既存 Markdown sanitize / checkbox 表示専用の検証観点 |
| summary | `summary/20260707/0000-arch-api-shared-http-errors-summary.md` | 直近 architecture migration task の状態 |
| code | `src/app/notes/_components/markdown-field.tsx` | 移動対象 component と sanitize / checkbox logic |
| code | `src/app/notes/_components/note-editor.tsx`, `src/app/notes/_components/note-detail-modes.tsx` | Markdown component の利用箇所 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/shared/markdown/markdown-field.tsx` | 既存 `MarkdownField` / `MarkdownPreview` と markdown component policy を移動 | domain 非依存 UI component を shared 配下に置くため |
| `src/shared/markdown/index.ts` | shared markdown の export entry を追加 | notes 側の import 経路を安定させるため |
| `src/app/notes/_components/note-editor.tsx` | `MarkdownField` import を `@/shared/markdown` に変更 | shared component 利用へ切り替えるため |
| `src/app/notes/_components/note-detail-modes.tsx` | `MarkdownPreview` import を `@/shared/markdown` に変更 | shared component 利用へ切り替えるため |
| `src/app/notes/_components/markdown-field.tsx` | 旧 component ファイルを削除 | 薄い互換 wrapper を残さず正規配置を一本化するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | `remark-gfm` と `rehype-sanitize` の適用は維持した。 | `src/shared/markdown/markdown-field.tsx` |
| F-002 | fact | checkbox preview は `readOnly`, `tabIndex={-1}`, click/change `preventDefault` を維持した。 | `src/shared/markdown/markdown-field.tsx` |
| F-003 | fact | 旧 `./markdown-field` import は残っていない。 | `rg -n "markdown-field\|MarkdownField\|MarkdownPreview" src/app src/shared` |
| U-001 | unknown | ブラウザでの Markdown sanitize / checkbox 手動操作確認は未実行。 | dev server が `listen EPERM` で起動不可 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `git status --short` before | 完了 | 既存の未コミット変更が多数ある状態を確認 |
| `rg -n "markdown-field\|@/shared/markdown\|MarkdownField\|MarkdownPreview" src/app src/shared` | PASS | notes 利用箇所は shared import へ切り替え済み |
| `npm run lint` | PASS | eslint 成功 |
| `npm run build` | PASS | Next.js build / TypeScript 成功 |
| `npm run dev -- -H 127.0.0.1 -p 3000` | FAIL | `listen EPERM: operation not permitted 127.0.0.1:3000` |
| `git status --short` after | 完了 | 本 task の変更と既存変更が混在していることを確認 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 実ブラウザでの Markdown sanitize / checkbox 表示専用確認 | localhost 起動可能な環境で `/notes/new` と detail/review mode の既存検証観点を再実行 |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `summary/20260707/0030-arch-ui-shared-markdown-summary.md`
- `src/shared/markdown/markdown-field.tsx`
- `src/shared/markdown/index.ts`
- `src/app/notes/_components/note-editor.tsx`
- `src/app/notes/_components/note-detail-modes.tsx`
