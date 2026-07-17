---
summary_type: task-summary
created_at: 2026-07-16 22:50 JST
task_kind: worker-task
task_status: done
---

## Objective

`NoteEditor` の作成・編集紙面を概念モックに合わせ、タイトルを主役にし、日付・学習元・タグをメタ情報帯へ移し、概要を開閉可能な disclosure にした。既存の保存 payload、Cornell、Markdown Preview、Summary、保存操作は維持した。

## Scope

| 項目 | 内容 |
|---|---|
| 実装対象 | `src/app/notes/_components/note-editor.tsx` |
| 既存 class | `note-paper-heading`、`note-paper-title`、`note-paper-meta-grid`、`note-paper-meta-item`、`note-paper-section`、`note-paper-footer` を利用 |
| 対象外 | `note-detail-modes.tsx`、`markdown-field.tsx`、API、server、Prisma / SQLite、modules、globals.css、依存関係 |

## Changes Made

- `基本情報` の大きなカードを廃止し、タイトル入力を紙面上部の主見出し位置へ移動。
- 学習日、学習元タイプ、学習元タイトル、タグを既存の `.note-paper-meta-grid` / `.note-paper-meta-item` に配置し、既存 responsive rule による折り返しを利用。
- 概要を native `details` / `summary` の開閉領域へ変更。新規作成は開いた状態で開始し、保存 API が概要エラーを返した場合は自動で開く。閉じても `form.overview` と payload は保持する。
- 詳細編集の `shell={false}` では外側の既存 header を主役として維持し、内部に大見出しを重複描画せず、編集用タイトル入力をコンパクトに配置。
- Cue の追加・削除・order、本文 `layout="stacked"`、Summary、次回復習日、保存・キャンセル、create/edit の remote 呼び出しは変更していない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前後 `git status --short` | PASS | 既存の設計書、concept PNG、紙面 shell、`note-detail-modes.tsx`、既存 summary の変更を保持 |
| `npm run lint` | PASS | ESLint 成功 |
| `npm run build` | PASS | Next.js webpack build、TypeScript、静的ページ生成まで成功 |
| `git diff --check` | PASS | whitespace error なし |
| API / payload / route / Prisma / SQLite 差分 | PASS | `noteEditorFormToPayload` と remote 呼び出しを維持。対象外ファイルに変更なし |
| 375 / 768px runtime | 未確認 | `next dev` が `0.0.0.0:3000` / `127.0.0.1:3000` の listen EPERM で起動できず |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | `/notes/new` と `/notes/[id]` 編集状態の 375 / 768px 実画面でページ全体の横 overflow がないこと | Browser / Playwright screenshot または runtime DOM 確認 |
| U-002 | 概要 disclosure のキーボード開閉、エラー時の開示、閉じたままの概要 payload 維持の runtime | Browser / E2E 操作確認 |
| U-003 | 詳細編集の外側タイトルと内部編集入力の見た目が concept の情報階層に合うこと | `/notes/[id]` fixture の 375 / 768 / 1280 / 1440px screenshot |

## Next Read

次の `UI-PAPER-005` または `QA-PAPER-001` は以下を最小順で読む。

- `summary/20260716/2250-ui-paper-003-note-editor-20260716-summary.md`
- `doc/implementation/MVP_CONTRACT.md`
- `src/app/notes/_components/note-editor.tsx`
- `src/app/notes/_components/note-detail-modes.tsx`
- `src/app/globals.css`

未確認点は U-001〜U-003。runtime 起動制限が解消するまで、375 / 768px overflow、disclosure keyboard、詳細編集の視覚重複を PASS としない。
