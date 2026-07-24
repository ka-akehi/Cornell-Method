---
summary_type: canvas-runtime-qa
created_at: 2026-07-25 JST
task_kind: worker-task
task_status: blocked
---

# Canvas unknown-target pen gesture runtime 証跡

## Objective

修正後の `/notes/new` Canvas で、metadata 欠落・unknown・preview・shape text editor target 上の pen gesture が新規 stroke/path や保存 JSON を残さないこと、空白および既知要素上の pen drawing が通常どおり保存されることを Browser runtime で確認する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Canvas unknown-target pen gesture の Browser runtime QA |
| 対象ファイル / ディレクトリ | `/notes/new`、既存 Canvas runtime / metadata boundary |
| 対象外 | コード変更、3px / 5px threshold、厳密な 4px 境界、恒久 fixture / debug route |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| summary | `summary/20260724/fix-canvas-unknown-target-pen-gesture-20260724-summary.md` | 修正内容と既存の未確認範囲 |
| summary | `summary/20260724/2325-verify-canvas-unknown-metadata-boundary-20260724-summary.md` | unknown metadata の調査結果 |
| source | `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts` | pen guard / path cleanup / lifecycle cleanup |
| source | `src/shared/canvas/adapters/fabric/fabric-metadata.ts` | metadata validation と target allowlist |

## Changes Made

| パス | 内容 |
|---|---|
| `summary/20260725/verify-canvas-unknown-target-pen-gesture-runtime-20260725-summary.md` | Browser/runtime 試行結果と未確認範囲のみを記録 |

アプリコード、設定、依存関係、lockfile、DB schema、API 契約、恒久 fixture、debug route は変更していない。

## Runtime attempts

| 試行 | 結果 |
|---|---|
| Browser skill setup / `agent.browsers.list()` | `No browser is available`。一覧は `[]` |
| `npm run dev -- --hostname 127.0.0.1 --port 3000` | `listen EPERM: operation not permitted 127.0.0.1:3000` で起動失敗 |
| local Playwright Chromium launch | Chromium はローカルに存在するが、起動直後に `mach_port_rendezvous ... Permission denied (1100)` で終了。プロセス cleanup も `kill EPERM` |
| 既存 server `lsof` / `curl` | listen 中の 3000 はなく、`curl` は接続失敗 |

対象 route は `http://127.0.0.1:3000/notes/new` を想定したが、ページへ接続できなかった。したがって viewport、console/page error、Fabric pointer 操作、`canvas.getObjects()`、保存 handler/API response の取得は未実施。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | Browser backend は利用できず、一覧は `[]` だった。 | Browser skill setup |
| F-002 | fact | local server は `listen EPERM`、Playwright Chromium は MachPort permission error で起動できなかった。 | Runtime attempts |
| F-003 | unknown | unknown / preview / editor target 上の実 pointer 操作、Canvas object 数、保存 JSON は未確認。 | Browser / local runtime blocked |

## Remaining Unknowns

`CANVAS-INTERACTION-001` は runtime PASS に繰り上げない。次の項目は未確認のまま残る。

- metadata なし Fabric object 上の pen down/move/up、pointercancel、touchcancel
- `element.type` unknown metadata object 上の pen gesture
- `isCanvasPreview` object 上の pen gesture
- `isCanvasShapeTextEditor` object / inline editor overlay 上の pen gesture
- 各操作前後の Canvas object 数、type、metadata 有無、stale path/draft の有無
- blocked target 操作後の保存 document / API response `elements`
- 空白および既知 stroke / line / arrow / rect / ellipse / standalone text 上の通常 pen 保存
- console error / page error と一時ノートの API cleanup 検索

今回 arbitrary Fabric object を注入する fixture、debug route、恒久 fixture は作成していないため、削除・残存検索の対象となる一時ノートはない。

## Static evidence (runtime PASS ではない)

- `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts:230-245` に `mouse:down:before` で blocked pen target の Fabric drawing mode を抑止する処理がある。
- 同ファイル `:446-505` に blocked `path:created` の除去と commit 抑止がある。
- 同ファイル `:186-189`, `:531-582` に mouse up、pointer cancel / touch cancel、unmount 時の draft / blocked state cleanup がある。
- `src/shared/canvas/adapters/fabric/fabric-metadata.ts:175-192,237-274` に validated metadata と既知 element type の target allowlist がある。
- `src/shared/canvas/adapters/fabric/fabric-canvas-to-document.ts:30-50` に metadata 欠落、preview、shape text editor object の document 除外がある。

## Verification

| コマンド | 結果 |
|---|---|
| 作業前 `git status --short` | PASS（clean） |
| `npm run lint` | PASS |
| `npx tsc --noEmit --pretty false` | PASS |
| `git diff --check` | PASS |
| Browser runtime | BLOCKED（backend `[]`） |
| local app server | BLOCKED（listen `EPERM`） |
| standalone Playwright Chromium | BLOCKED（macOS MachPort permission error） |

## Next Read

- `summary/20260724/fix-canvas-unknown-target-pen-gesture-20260724-summary.md`
- `summary/20260724/2325-verify-canvas-unknown-metadata-boundary-20260724-summary.md`
- `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`
- `src/shared/canvas/adapters/fabric/fabric-metadata.ts`
- `doc/testing/TEST_SCENARIOS.md` の `CANVAS-INTERACTION-001`
