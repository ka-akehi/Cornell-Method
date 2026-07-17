---
summary_type: task-summary
created_at: 2026-07-16 22:48 JST
task_kind: worker-task
task_status: done
---

## Objective

`/notes/[id]` の閲覧・復習モードを、承認済みの紙面構造に合わせ、概要の開閉と復習時の Cue → 本文 → Summary の段階的開示を実装した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象実装 | `src/app/notes/_components/note-detail-modes.tsx` |
| 対象状態 | 閲覧・復習の共通 header、MetaGrid、概要、Cornell、Summary、復習記録 |
| 対象外 | API、payload、route、Prisma / SQLite、`globals.css`、`note-editor.tsx`、Markdown 共通実装、依存関係 |

## Inputs Read

- `HANDOFF_2026-07-16.md`
- `summary/20260716/2228-paper-note-canvas-design-spec-20260716-summary.md`
- `summary/20260716/2235-ui-paper-002-markdown-preview-20260716-summary.md`
- `doc/implementation/MVP_CONTRACT.md`
- `doc/screens/MVP_SCREEN_DESIGN.md`
- `doc/screens/MVP_SCREEN_INVENTORY.md`
- `doc/screens/assets/mockups/mvp-paper-note-canvas-concept.png`
- `doc/screens/assets/mockups/mvp-paper-note-canvas-mock.html`
- `src/app/notes/_components/note-detail-modes.tsx`
- `src/app/globals.css`

## Changes Made

- タグをタイトル帯から除去し、既存 `note-paper-meta-grid` 内の「タグ」項目へ移動した。学習日、学習元、タグ、次回復習日、最終復習日時の順で表示する。
- 概要を native `<details>` として紙面上部に置き、概要本文を開閉できるようにした。閲覧開始時は短いメタ表示、復習開始時は概要を開いた状態にし、未入力時の「概要は未入力です。」を維持した。
- 復習専用の `showSummary` local state を追加した。復習開始時は本文と Summary 本文を隠し、本文表示後にのみ Summary を開示できる。本文を隠すと Summary も閉じる。
- Summary は閲覧時に従来どおり `MarkdownPreview` で表示し、復習時は全幅 Section 内の開示領域として Cornell の後に置いた。
- 復習日入力、`completeReview` 呼び出し、復習済み更新、閲覧へ戻る操作を Summary 後の「復習記録」に配置した。削除、編集切替、alert、MarkdownPreview の GFM / sanitize / 表示専用 checkbox は変更していない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 設計書、concept PNG、紙面シェル、既存 summary を含む未コミット変更を保持 |
| `npm run lint` | PASS | 最終実行で error なし |
| `npm run build` | PASS | Next.js 16.2.9 webpack build、TypeScript、静的ページ生成まで成功 |
| `git diff --check` | PASS | whitespace error なし |
| API / payload / route / Prisma / SQLite 差分 | PASS | 変更なし |
| 実装変更範囲 | PASS | 実装差分は `src/app/notes/_components/note-detail-modes.tsx` のみ。作業前からの他の未コミット変更は保持 |

## Remaining Unknowns

- 375 / 768px の実ブラウザで、MetaGrid の 5 項目、概要 disclosure、Cornell 内部 overflow、ページ全体横 overflow が契約どおりかは未確認。
- `/notes/[id]` の実ブラウザで、復習開始 → 本文表示 → Summary 開示 → Summary 閉鎖 → 本文再マスク → 復習済み更新の操作・focus 表示は未確認。
- 実ブラウザでの Markdown checkbox 表示専用、削除確認、API 呼び出し回帰は今回 static build までで、runtime QA は後続 task に委ねる。

## Next Read

次の runtime QA task は以下を最小順で読む。

1. `summary/20260716/2248-ui-paper-004-detail-review-paper-20260716-summary.md`
2. `src/app/notes/_components/note-detail-modes.tsx`
3. `src/app/globals.css`
4. `src/app/notes/[id]/page.tsx`
5. `doc/implementation/MVP_CONTRACT.md` の復習・Markdown 契約
6. `doc/testing/TEST_SCENARIOS.md` の NTE-030 / mobile overflow 観点

runtime QA では 375 / 768 / 1280 / 1440px の閲覧・復習を確認し、Summary 初期非表示、Cue → 本文 → Summary の順序、Summary 後の復習操作、keyboard focus、Markdown checkbox、削除・復習 API の実動作を証跡化する。
