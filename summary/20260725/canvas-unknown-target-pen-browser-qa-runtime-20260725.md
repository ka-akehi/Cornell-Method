---
summary_type: canvas-runtime-qa
created_at: 2026-07-25 JST
task_kind: manager-runtime-qa
task_status: done
---

# Canvas unknown-target pen Browser runtime QA

## Objective

修正後の `/notes/new` Canvas で、metadata 欠落、未知 metadata、preview、shape text editor object を pen の開始対象にしたとき、新しい stroke / path が生成・残置・保存されないことを Browser runtime で確認する。

## Scope

| 項目 | 内容 |
|---|---|
| route | `http://127.0.0.1:3000/notes/new` |
| runtime | Manager 側の権限付き headless Playwright Chromium |
| viewport | 1280 x 900 |
| 対象 | metadata-less object、`element.type="unknown"` object、`isCanvasPreview` object、`isCanvasShapeTextEditor` object、pointercancel、保存 JSON、cleanup |
| 対象外 | 既確認済みの 3px / 5px threshold、厳密な 4px 境界、恒久 fixture / debug route、既知要素上の通常 pen（2026-07-24 の既存証跡を参照） |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| source | `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts` | `mouse:down:before` の pen guard、pointercancel cleanup、`path:created` cleanup |
| source | `src/shared/canvas/adapters/fabric/fabric-metadata.ts` | metadata/type allowlist、preview/editor 判定 |
| source | `src/shared/canvas/adapters/fabric/fabric-canvas-to-document.ts` | malformed / opaque Fabric object の保存除外 |
| prior QA | `summary/20260724/canvas-gesture-browser-qa-runtime-20260724.md` | 既知要素、preview、inline overlay、3px / 5px の既存 runtime 証跡 |
| prior blocked QA | `summary/20260725/verify-canvas-unknown-target-pen-gesture-runtime-20260725-summary.md` | Worker Browser backend 不在による未確認範囲 |

## Changes Made

| パス | 内容 |
|---|---|
| `summary/20260725/canvas-unknown-target-pen-browser-qa-runtime-20260725.md` | Manager 直接 runtime の結果を記録 |
| アプリコード / 設定 / 依存関係 / DB schema / API / 恒久 fixture | 変更なし |

QA 中は既存 React Fiber から Fabric runtime instance を読み取り、ページ内だけの一時 object を注入した。debug route、恒久 fixture、source code は作成していない。

## Findings

### Runtime setup

- `GET /notes/new`: HTTP 200。
- Canvas runtime: Fabric canvas 1200 x 800、初期 object 数 0。
- pen tool を選択後、Canvas を viewport 上端へスクロールして object 中心へ pointer 操作した。
- 各操作では `mouse:down:before` の target が想定した object と一致した。

### Gesture results

| target | 操作 | 操作前 object 数 | 操作後 object 数 | `path` object | 結果 |
|---|---|---:|---:|---:|---|
| metadata-less Fabric `rect` | pointer down / move / up | 1 | 1 | 0 | 新規 stroke なし |
| metadata object (`element.type="unknown"`) | pointer down / move / up | 2 | 2 | 0 | 新規 stroke なし |
| `isCanvasPreview=true` object | pointer down / move / up | 3 | 3 | 0 | 新規 stroke なし |
| `isCanvasShapeTextEditor=true` object | pointer down / move / pointercancel / up | 4 | 4 | 0 | stale path なし |

### Persistence / cleanup

- 保存 API response: `201`。
- 保存 request の Canvas `elements`: `[]`。
- 保存後 `GET /api/notes/:id`: `200`、Canvas `elements`: `[]`。
- 一時ノートは `DELETE /api/notes/:id`: `204`。
- 削除後 `GET /api/notes/:id`: `404`。
- 座標調整前の探索試行で残った同一 QA title の一時ノート 1 件も検索で特定し、`DELETE` 204 後に `GET /api/notes?query=QA%20unknown%20target%20pen` の `totalCount=0` を確認した。
- console error / warning: 0 件。page error: 0 件。

## Verification

| 確認項目 | 結果 |
|---|---|
| Browser runtime route / Canvas 初期化 | PASS |
| metadata-less target の pen 遮断 | PASS |
| unknown metadata target の pen 遮断 | PASS |
| preview target の pen 遮断 | PASS |
| shape text editor target の pen 遮断 | PASS |
| pointercancel 後の stale path cleanup | PASS |
| 保存 request / GET response の Canvas elements 非混入 | PASS |
| console / page error | PASS（0 件） |
| temporary note cleanup | PASS（204 → 404） |
| QA title residual search | PASS（`totalCount=0`） |
| source / config / dependency / DB schema / permanent fixture changes | なし |

## Remaining Unknowns

`CANVAS-INTERACTION-001` 全体は `部分実施` のままとする。今回で unknown target の runtime subset は PASS になったが、厳密な 4px 境界、別 tool 切り替え後の shape gesture 分離、保存後の全再読込比較、touch の Canvas scroll 干渉などは別記録の未確認範囲として残る。既知要素上の通常 pen と preview / inline overlay の既存結果は `summary/20260724/canvas-gesture-browser-qa-runtime-20260724.md` に記録済みである。

## Next Read

- `doc/testing/TEST_SCENARIOS.md` の `CANVAS-INTERACTION-001`
- `doc/implementation/IMPLEMENTATION_STATUS.md` §5.3
- `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`
- `src/shared/canvas/adapters/fabric/fabric-metadata.ts`
