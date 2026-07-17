---
summary_type: task-summary
created_at: 2026-07-16 JST
task_kind: worker-task
task_status: done
---

## Objective

`/notes/new` のページラッパーに残っていた重複する `新規ノート` 見出しと不要な縦積みを除き、`NoteEditor mode="create"` の紙面をページの主役にする。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | `/notes/new` のページラッパー |
| 対象ファイル | `src/app/notes/new/page.tsx` |
| 対象外 | `NoteEditor`、layout、globals.css、API、server、Prisma / SQLite、依存関係 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| repository guidance | `AGENTS.md` | 既存変更を保持し、検証と summary を残す運用 |
| handoff | `HANDOFF_2026-07-16.md` | 紙面 UI の現状と未確認点 |
| previous summary | `summary/20260716/2250-ui-paper-003-note-editor-20260716-summary.md` | `NoteEditor` 内の作成見出しが正本であること |
| source | `src/app/notes/new/page.tsx` | 外側 h1 と `space-y-4` ラッパーの現状 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/notes/new/page.tsx` | `NoteEditor mode="create"` を直接 return し、外側 h1 と `space-y-4` ラッパーを削除 | 紙面内のタイトル入力 / kicker を唯一の作成見出しにするため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | `NoteEditor` の create mode、保存、キャンセル、payload、遷移には変更なし | 差分はページの return 構造のみ |
| F-002 | fact | 既存の未コミット変更は保持した | 作業前後の `git status --short` |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前後 `git status --short` | PASS | 既存変更を保持。実装変更は対象ページのみ |
| `git diff --check` | PASS | whitespace error なし |
| `npm run lint` | PASS | ESLint 成功 |
| `npm run build` | PASS | Next.js webpack build、TypeScript、`/notes/new` 静的生成まで成功 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | `/notes/new` の実画面で外側に重複見出しがなく、紙面が主役になっていること | Browser / Playwright による runtime QA |

## Next Read

`/notes/new` の runtime QA は次の最小ファイルから確認する。

- `src/app/notes/new/page.tsx`
- `src/app/notes/_components/note-editor.tsx`
- `src/app/globals.css`
