---
summary_type: task-summary
created_at: 2026-07-18 22:23 JST
task_kind: coding
task_status: done
---

## Objective

編集画面と閲覧画面の Fabric Canvas 上でも、wheel／トラックパッド／タッチの通常操作をブラウザ全体の縦スクロールへ渡す。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Canvas のスクロール抑止設定 |
| 対象ファイル / ディレクトリ | `src/app/notes/_components/note-canvas-editor.tsx`, `src/app/notes/_components/note-canvas-viewer.tsx` |
| 対象外 | API、Prisma、CanvasDocument、依存関係、既存の page-size / horizontal-scroll 実装 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-17.md` | 未コミット変更の保持方針と次回確認観点 |
| summary | `summary/20260718/2213-restore-page-scroll-over-canvas-8ad5ce17-summary.md` | 直前 task の変更対象と未確認事項 |
| source | 対象 editor/viewer と `node_modules/fabric/src/canvas/{Canvas,DOMManagers/CanvasDOMManager,StaticCanvasOptions}.ts` | Fabric の `allowTouchScrolling`、`touch-action`、touch/pointer 抑止挙動 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/notes/_components/note-canvas-editor.tsx` | Fabric 初期化に `allowTouchScrolling: true` を追加し、上層 Canvas の常時 `touchAction = "none"` を削除 | Fabric 管理のスクロール許可設定を有効化し、ページスクロールを常時抑止しないため |
| `src/app/notes/_components/note-canvas-viewer.tsx` | Fabric 初期化に `allowTouchScrolling: true` を追加 | 編集画面と同じスクロール許可設定に揃えるため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | Fabric 7.4 は `allowTouchScrolling: true` のとき Canvas DOM に `touch-action: manipulation` を設定し、通常の touch move では `preventDefault()` を呼ばない。描画／選択操作時の抑止ロジックは Fabric 側に残る。 | Fabric 7.4 source / Canvas.spec.ts |
| F-002 | fact | 手動 wheel 転送、wheel 内の `preventDefault()`、Canvas viewport の内部 vertical scroll は前回変更のまま再導入していない。 | 対象ファイルと `globals.css` |
| U-001 | unknown | in-app browser runtime が利用可能ブラウザ 0 件のため、編集／閲覧画面の実ホイール・トラックパッド・タッチ操作は未確認。 | browser runtime discovery result |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npm run lint` | PASS |  |
| `npx tsc --noEmit --pretty false` | PASS |  |
| `npm run build` | PASS | Next.js production build 完了 |
| `git diff --check` | PASS |  |
| ブラウザ確認 | 未実施 | browser runtime の利用可能リストが空 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 1920 x 1080 の editor/viewer で Canvas 上から Summary／保存 footer／ページ末尾までページスクロールできること | 利用可能なブラウザでの runtime QA |

## Next Read

次回はこの summary と対象 2 ファイルを読み、ブラウザ runtime が利用可能なら `/notes/new` と既存ノート詳細の editor/viewer を確認する。

- `summary/20260718/2223-fix-fabric-page-scroll-over-canvas.md`
- `src/app/notes/_components/note-canvas-editor.tsx`
- `src/app/notes/_components/note-canvas-viewer.tsx`
- `src/app/globals.css`

