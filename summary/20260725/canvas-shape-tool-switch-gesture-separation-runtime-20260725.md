---
summary_type: canvas-runtime-qa
created_at: 2026-07-25 JST
task_kind: manager-runtime-qa-fallback
task_status: done
---

# Canvas shape-tool switch gesture separation runtime QA

## Objective

図形の inline text editor を commit / cancel した直後に別の shape tool へ切り替えて drag し、stale editor や意図しない図形が残らないことを確認する。

## Scope

| 項目 | 内容 |
|---|---|
| route | `http://127.0.0.1:3000/notes/new` |
| runtime | Manager 側の権限付き headless Playwright Chromium |
| viewport | 1280 x 900 |
| 対象 | rect / ellipse、inline editor、tool switch、commit / Escape cancel、保存 request / GET、cleanup |
| 対象外 | 既確認済みの 3px / 5px threshold、同一 tool の既存 overlay test、style 境界、touch scroll |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| source | `src/modules/notes/ui/components/canvas/editor.tsx` | tool 切り替え時に `flushShapeTextEditRef` と active object discard を行うこと |
| source | `src/modules/notes/ui/canvas/shape-text-editor-session.ts` | shape editor の commit / cancel / cleanup と hidden textarea lifecycle |
| source | `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts` | shape drag、preview、Fabric event の runtime 境界 |
| prior QA | `summary/20260724/canvas-gesture-browser-qa-runtime-20260724.md` | 既確認の threshold と同一 tool overlay 範囲 |
| failed Worker | `summary/20260725/0203-verify-canvas-shape-tool-switch-gesture-separation-20260725-79d81b7d-summary.md` | Worker app-server 初期化権限エラー |

## Changes Made

| パス | 内容 |
|---|---|
| `summary/20260725/canvas-shape-tool-switch-gesture-separation-runtime-20260725.md` | Manager fallback の runtime 結果を記録 |
| アプリコード / 設定 / 依存関係 / DB schema / API / 恒久 fixture | 変更なし |

QA 中は一時ノートと一時 Canvas 要素だけを作成し、保存後に削除した。debug route、恒久 fixture、source code は作成していない。

## Findings

### Runtime setup

- Worker の in-app Browser backend は `agent.browsers.list()=[]` で起動時にも `Operation not permitted` が発生したため、前回成功時と同じ Manager 側の権限付き Playwright fallback を使用した。
- `/notes/new` は HTTP 200。Canvas は 1200 x 800、viewport は 1280 x 900、開始時の object 数は 0。
- 実装上、tool button の click は inline editor を残さず、`flushShapeTextEditRef` により先に commit / cleanup する。この期待値へ補正して確認した。

### Gesture results

| ケース | 結果 |
|---|---|
| rect editor に `RECT COMMITTED` を入力 → ellipse tool へ切り替え | rect は text 付き group へ変換、editor / hidden textarea は 0 件。意図しない shape なし |
| ellipse tool で blank drag（切り替え直後） | ellipse 1 件だけ追加。rect の text・geometry は保持 |
| ellipse editor に `ELLIPSE CANCELLED` → Escape | ellipse の text は空のまま、editor / hidden textarea は 0 件 |
| rect tool へ切り替え → blank drag | rect 1 件だけ追加。cancel 済み text や stale editor は混入なし |

### Persistence / cleanup

- 保存 response は `201`。request と保存後 `GET /api/notes/:id` はともに次の 3 要素で一致した: `rect("RECT COMMITTED")`, `ellipse`, `rect`。
- 保存後 GET は `200`。一時ノートは `DELETE` `204`、削除後 GET は `404`、タイトル検索の残留は `totalCount=0`。
- application console error / warning と page error は 0 件。QA 中に記録された console 404 は、cleanup 検証のため明示的に `GET` した削除済み ID の `404` であり、アプリ操作中のエラーではない。

## Verification

| 確認項目 | 結果 |
|---|---|
| tool switch 時の inline editor commit | PASS |
| Escape cancel と editor cleanup | PASS |
| switch 直後の別 shape drag | PASS |
| object 数 / type / text / geometry | PASS |
| 保存 request と保存後 GET の Canvas elements | PASS |
| console / page error（cleanup probe を除く） | PASS（0 件） |
| 一時ノート cleanup / 残留検索 | PASS（204 → 404、`totalCount=0`） |
| source / config / dependency / DB schema / permanent fixture changes | なし |

## Remaining Unknowns

`CANVAS-INTERACTION-001` / `CANVAS-GESTURE-001` 全体は `部分実施` のままとする。厳密な 4px 境界、touch の Canvas scroll 干渉、style / alignment の全経路、保存後の viewer を含む完全な再読込表示は別範囲として残る。

## Next Read

- `doc/testing/TEST_SCENARIOS.md` の Canvas runtime QA 追補と受け入れ証跡マトリクス
- `doc/implementation/IMPLEMENTATION_STATUS.md` §5.3 の Canvas runtime 記録
- `src/modules/notes/ui/components/canvas/editor.tsx`
- `src/modules/notes/ui/canvas/shape-text-editor-session.ts`
