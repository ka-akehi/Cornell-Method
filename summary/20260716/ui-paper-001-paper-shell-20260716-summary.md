---
summary_type: task-summary
created_at: 2026-07-16 JST
task_kind: coding
task_status: done
---

## Objective

`UI-PAPER-001` として、ノート作成・編集・閲覧・復習画面の外枠を共通の紙面中心 UI シェルへ移行した。本文、Cue、Summary の payload、既存操作、route、API、Prisma / SQLite は変更していない。

## Scope

| パス | 内容 |
|---|---|
| `src/app/globals.css` | 紙面用 design token、背景、最大 1280px の紙面シェル、罫線・余白・影、レスポンシブ境界を追加 |
| `src/app/notes/_components/note-editor.tsx` | 作成フォームを紙面シェルへ載せ、編集時は詳細シェルへ埋め込めるようにした。既存の入力、Cue 操作、保存処理は維持 |
| `src/app/notes/_components/note-detail-modes.tsx` | 閲覧・復習・編集で同じ紙面シェルを使用。既存のモード切替、本文マスク、復習済み、削除、エラー表示は維持 |

## Changes Made

- 画面背景を暖色のキャンバス、ノート領域を温かい紙面として分離した。
- 紙面を viewport 基準で最大 1280px まで広げ、既存の親 `max-w-6xl` による本文幅の圧迫を避けた。
- Section の大きな白い角丸カードと影を外し、紙面上の薄い罫線・余白へ置き換えた。
- タイトル・モード・主要操作を詳細画面の紙面ヘッダーへまとめ、メタ情報を紙面内の区切りとして表示した。
- 入力境界、Cue 個別境界、エラー表示、フォーカス表示は維持した。Cornell の既存 30 / 70 比率と mobile の局所 `min-w-[640px]` も変更していない。
- `NoteEditor` に `shell` オプションを追加し、作成時は単独シェル、詳細編集時は詳細シェル内へ埋め込む構成にした。データ payload や保存方式には影響しない。

## Verification

| 確認 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 完了 | 既存の仕様書・モック・summary の変更を確認し保持 |
| `npm run lint` | PASS | 最終差分で成功 |
| `npm run build` | PASS | TypeScript、route 生成、build trace まで成功 |
| `git diff --check` | PASS | whitespace error なし |
| 対象実装ファイル | PASS | `globals.css`、`note-editor.tsx`、`note-detail-modes.tsx` の 3 ファイル |
| Browser runtime / screenshot | 未実施 | Browser backend が空で、dev server も `0.0.0.0:3000` の `listen EPERM` で起動不可。未確認を PASS にしていない |

## Contract Safety

- API、Prisma、DB、remote、Markdown sanitize / checkbox 実装、route は変更していない。
- UI-PAPER-002 の本文 Preview 縦配置、UI-PAPER-003 / 004 の基本情報折りたたみ・詳細／復習の細部は先取りしていない。

## Next Read

次の `UI-PAPER-002` は以下を最小限読む。

1. `src/shared/markdown/markdown-field.tsx`
2. `src/app/notes/_components/note-editor.tsx`
3. `src/app/notes/_components/note-detail-modes.tsx`
4. `src/app/globals.css` の `.note-paper-shell` / `.note-paper-cornell-grid` 周辺
5. `doc/screens/MVP_SCREEN_DESIGN.md` の本文 Preview 配置と紙面シェル境界

