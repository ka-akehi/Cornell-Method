---
summary_type: task-summary
created_at: 2026-07-24 23:38 JST
task_kind: worker-task
task_status: done
---

## Objective

Metadata のない／app 管理外の Fabric object 上で pen gesture が free-drawing stroke を残したり保存したりしないようにし、空白および既知 Canvas 要素上の pen drawing を維持する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Canvas runtime の pen gesture 境界 |
| 対象ファイル / ディレクトリ | `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts` |
| 対象外 | malformed metadata converter、DB/API、既存の 3px / 5px threshold |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| source | `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts` | Fabric event listener、pen draft、path cleanup |
| source | `src/shared/canvas/adapters/fabric/fabric-metadata.ts` | target allowlist と preview/editor 判定 |
| dependency | `node_modules/fabric/src/canvas/Canvas.ts` | Fabric 7 の `mouse:down:before` と drawing-mode event order |

## Changes Made

| パス | 変更内容 |
|---|---|
| `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts` | pen 専用の blocked target 判定、Fabric 7 の `mouse:down:before` での drawing mode 抑止、blocked path の `path:created` cleanup、mouse up / pointer cancel / unmount cleanup を追加。line / arrow / rect / ellipse / erase / select / inline editor の既存分岐は変更していない。 |

### `CANVAS-INTERACTION-001` の判定根拠

- `isCanvasDrawingTarget` は target なしを許可し、metadata がない object と未知 type の metadata object を拒否する。
- runtime の `isCanvasPenDrawingTarget` は上記に加え、preview object と shape text editor object を拒否する。
- Fabric 7 の `mouse:down:before` は brush 開始より前に発火するため、blocked target では `isDrawingMode=false` にして brush の開始を抑止する。
- 順序異常などで `path:created` が発火した場合も、gesture state が blocked の間は path を Canvas から remove し、metadata 付与・`commitCurrent` を実行しない。
- mouseup、`pointercancel` / `touchcancel`、unmount で `blockedPenGestureRef` と `draftPointsRef` を清掃し、次の gesture で pen mode を復元する。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 開始時は clean。 |
| `npm run lint` | PASS | 最終実行も成功。 |
| `npx tsc --noEmit --pretty false` | PASS | 最終実行も成功。 |
| `npm run build` | PASS | Next.js webpack build、11 route 生成。 |
| `git diff --check` | PASS | whitespace error なし。 |
| standalone Jiti pure-helper check | 未実施 | `@/*` の tsconfig path alias を standalone Jiti が解決できず失敗。既存の lint / typecheck / build を代替検証とした。 |
| Browser runtime | 未実施 | Browser setup 後の `agent.browsers.list()` が `[]`。pointer 操作、Canvas object 数、保存 document、console/page error は確認できなかった。 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | blocked target では `mouse:down:before` で Fabric brush を抑止し、異常な `path:created` も除去する実装になった。 | runtime 差分、Fabric 7 source |
| F-002 | fact | 空白・既知 Canvas 要素は pen target allowlist を通過し、既存の draft/commit 分岐を維持する。 | `isCanvasDrawingTarget` と runtime 差分 |
| F-003 | unknown | 実 pointer 操作による object 数・保存 document は Browser backend 不在のため未確認。 | `agent.browsers.list()` が `[]` |

## Remaining Unknowns

`CANVAS-INTERACTION-001` は `部分実施` のまま。Fabric source の event 順と runtime の static guard / cleanup から、unknown・metadata 欠落・preview・shape text editor target の pen path が保存境界へ進まない実装根拠は確認できた。一方、Browser backend 不在のため、実際の pointer gesture での object 数・保存 response・geometry の runtime PASS は未確認。

作業中、開始時にはなかった `src/shared/canvas/adapters/fabric/fabric-metadata.ts` の別 task 向け変更と関連 summary が作業ツリーへ現れた。これは malformed metadata converter の対象外変更として編集・巻き戻しせず保持した。

## Next Read

- `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`
- `node_modules/fabric/src/canvas/Canvas.ts` の `__onMouseDown` / drawing mode 処理
- `src/shared/canvas/adapters/fabric/fabric-metadata.ts`
- `doc/testing/TEST_SCENARIOS.md` の `CANVAS-INTERACTION-001`
