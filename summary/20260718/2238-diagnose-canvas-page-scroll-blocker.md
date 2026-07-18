---
summary_type: task-summary
created_at: 2026-07-18 22:38 JST
task_kind: worker-task
task_status: done
---

## Objective

Canvas editor / viewer 上でページ縦スクロールを阻害し得るイベント処理とレイアウト要因を切り分け、次の coding task を一目的・最小変更へ絞る。実ブラウザが利用できないため、実行時イベント値と DOM の computed / scroll metrics は取得できなかった。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Fabric Canvas の event path、Canvas 周辺の overflow / touch-action、開発 bundle の一致 |
| 対象ファイル / ディレクトリ | `src/app/notes/_components/note-canvas-editor.tsx`, `src/app/notes/_components/note-canvas-viewer.tsx`, `src/app/globals.css`, `node_modules/fabric/src/canvas/` |
| 対象外 | 実装変更、API、Prisma、依存関係、DB、生成物の更新 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-17.md` | 未コミット変更の保持、Canvas runtime QA の未実施状態 |
| summary | `summary/20260718/2201-fix-canvas-wheel-scroll-4eb96530-summary.md`, `summary/20260718/2213-restore-page-scroll-over-canvas-8ad5ce17-summary.md`, `summary/20260718/2223-fix-fabric-page-scroll-over-canvas.md` | 直前修正と残存 unknown |
| source | `src/app/notes/_components/note-canvas-editor.tsx`, `src/app/notes/_components/note-canvas-viewer.tsx` | DOM 構造、React handler、Fabric options |
| style | `src/app/globals.css` | `body` / `app-main` / paper shell / Canvas 各 overflow |
| dependency source | `node_modules/fabric/src/canvas/Canvas.ts`, `DOMManagers/CanvasDOMManager.ts`, `Canvas.spec.ts` | listener 登録、preventDefault、DOM style、draggable |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260718/2238-diagnose-canvas-page-scroll-blocker.md` | 調査結果のみ追加 | Worker の再開用 summary。コード・設定・依存関係・DB・生成物は変更していない |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 実 Canvas の直上に `.note-canvas-horizontal-scroll` があり、`overflow-x: auto; overflow-y: hidden; overscroll-behavior: auto` を持つ。`note-canvas-viewport` 自体は `overflow: visible`。 | `src/app/globals.css:1105-1125`, editor `:615-640`, viewer `:136-158` |
| F-002 | fact | `overflow-y: hidden` は CSS の scrollable value で、ユーザーの wheel / touch による直接スクロールを許さない。x 軸の auto と組み合わさるため、ページ scroll chain の最有力な残存阻害点はこの水平 wrapper の y 軸指定。`overflow-y: clip` なら x 軸だけの scroll container にできる。 | [CSS Overflow Module Level 3 §3.1](https://drafts.csswg.org/css-overflow-3/#overflow-properties) |
| F-003 | fact | Fabric 7.4 は wheel listener を `passive:false` で登録するが、`_onMouseWheel` は Fabric event を発火するだけで `preventDefault()` を呼ばない。現行ソースに wheel handler / wheel preventDefault はない。 | `node_modules/fabric/src/canvas/Canvas.ts:181-182,236-240`, editor/viewer |
| F-004 | fact | editor は `enablePointerEvents:true` と `allowTouchScrolling:true`。Fabric の pointer `down` は preventDefault せず、pointer `move` の preventDefault は `allowTouchScrolling` が false のときだけ。React `onPointerDown` は `focus({ preventScroll:true })` のみ。 | editor `:284-289,566-568,615-623`, Fabric `Canvas.ts:675-696,776-788` |
| F-005 | fact | viewer は `enablePointerEvents:false` と `allowTouchScrolling:true`。Fabric の touchstart は drawing / active object の場合以外 preventDefault せず、viewer は selection=false / drawing=false / active objectなし。 | viewer `:69-80`, Fabric `Canvas.ts:624-668` |
| F-006 | fact | Fabric は lower / upper canvas を生成し、upper に `draggable="true"`、両 canvas に `touch-action: manipulation`、wrapper に `position: relative` と `data-fabric="wrapper"` を設定する。draggable の preventDefault は dragstart のみで、wheel / pointer scroll の処理ではない。 | `node_modules/fabric/src/canvas/DOMManagers/CanvasDOMManager.ts:53-95`, `Canvas.ts:292-308` |
| F-007 | fact | body は `overflow-x: clip` のみ、app-main に overflow 指定なし。Canvas stage と note paper shell に `overflow:hidden` は残るが、Canvas 特有の残存差分としては水平 wrapper の y 軸指定が最も直接的。 | `src/app/globals.css:42-50,183-188,657-681,1131-1144` |
| F-008 | fact | 初期 Canvas document は 1200 x 800。editor/viewer は React inline style、Fabric setDimensions、Fabric wrapper / upper / lower canvas の style を同じ page 寸法へ更新する。 | `src/shared/canvas/canvas-document.ts:1-8,110-116`, editor `:223-243`, viewer `:104-122` |
| F-009 | fact | `.next` の dev CSS は `overflow: auto hidden`、dev/client bundle と production bundle は `allowTouchScrolling:!0` と `note-canvas-horizontal-scroll` を含む。source mtime 22:21、dev log の compile 22:31 のため、確認した生成物は現行ソースと一致し、古い bundle が主因とは考えにくい。 | `.next/dev/static/chunks/src_app_globals_162hn9o.css`, `.next/dev/static/chunks/src_0bb7rzz._.js`, `.next/static/` |
| U-001 | unknown | Canvas 外と Canvas 上での wheel / trackpad / touchstart / touchmove / pointerdown / pointermove の実イベント名、capture/bubble 順序、defaultPrevented、window.scrollY 差分は未取得。 | in-app browser runtime `agent.browsers.list()` が `[]`、`getDefault()` が `No browser is available` |
| U-002 | unknown | upper / lower canvas、Fabric wrapper、horizontal wrapper、viewport、app-main、body の実 computed style、scrollHeight / clientHeight / scrollTop は未取得。 | 実 DOM を検査するブラウザがない |
| U-003 | unknown | `note-paper-shell` / `.note-canvas-stage` の `overflow:hidden` が対象ブラウザの scroll chaining に追加影響するかは未確認。 | 実機での比較が必要 |

## Recommendation

次の coding task は 1 目的に限定する。

`src/app/globals.css:1117-1125` の `.note-canvas-horizontal-scroll` だけを対象に、`overflow-y: hidden` を `overflow-y: clip` へ変更する。`overflow-x: auto`、Fabric options、React handlers、manual wheel forwarding は変更しない。

実ブラウザが利用可能になったら、editor / viewer の Canvas 外・Canvas 上で次を確認する。

- horizontal wrapper の computed `overflow-x:auto`, `overflow-y:clip`、viewport `overflow:visible`。
- wheel の `defaultPrevented=false`、pointer/touch 系で Fabric / React が preventDefault しないこと。
- 操作前後の `window.scrollY` が Canvas 上でも増加し、wrapper の `scrollTop` は 0 のまま、水平操作時だけ `scrollLeft` が変化すること。
- upper/lower canvas の computed `touch-action: manipulation`、Fabric wrapper の寸法、body/app-main の縦 scroll metrics。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `git diff --check` | PASS | 調査前からの既存 diff に whitespace error なし |
| `git status --short` 作業前後 | 既存一覧は不変 | 調査結果 summary 1 件だけを追加。既存未コミット変更を保持し、実装ファイル・設定・DB・生成物は未変更 |
| in-app browser discovery | 未実施 | runtime の利用可能ブラウザが 0 件 |
| 実イベント / computed style / scroll metrics | 未確認 | browser がないため取得不可 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001/U-002/U-003 | 実機で CSS 修正前後の event path、defaultPrevented、computed overflow / touch-action、scrollY を比較 | 利用可能な in-app browser または発注者環境の DevTools 計測 |

## Next Read

- `summary/20260718/2238-diagnose-canvas-page-scroll-blocker.md`
- `src/app/globals.css`
- `src/app/notes/_components/note-canvas-editor.tsx`
- `src/app/notes/_components/note-canvas-viewer.tsx`
