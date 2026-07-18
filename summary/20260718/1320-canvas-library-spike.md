## Objective

Fabric.js と Konva を同じ固定ページ型 Canvas POC で比較し、次の hybrid Canvas 実装候補を 1 つに絞る。既存の NoteEditor、API、Prisma、DB、Markdown ノートには接続しない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | `/spikes/canvas` の隔離 Client Component、app-owned vector JSON、Fabric/Konva adapter、操作比較 |
| 対象ファイル / ディレクトリ | `src/app/spikes/canvas/**`, `src/app/globals.css`, `package.json` |
| 対象外 | 既存 note route、API、Prisma schema/migration、DB、Markdown 自動変換、autosave、PDF、画像 asset |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-17.md` | 現行紙面 UI と未コミット変更を確認。既存コードを戻さない前提を確認 |
| 設計 | `summary/20260718/1113-freestyle-canvas-policy.md` | Cue/Summary をテキストで残し、本文だけ固定ページ Canvas にする方針を確認 |
| 設計 summary | `summary/20260718/1118-design-freeform-note-canvas-direction-5b8d2e71-b3fcf7c6-summary.md` | `CanvasDocumentV1`、vendor JSON を正本にしない方針、候補評価軸を確認 |
| 構成 | `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/_components/app-chrome.tsx` | Next 16 App Router / React 19 / TypeScript と共通 shell の入口を確認 |
| 公式資料 | Fabric.js / Konva docs | object model、free drawing、serialization、Pointer Events、MIT license、Konva の app state 保存方針を確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/spikes/canvas/page.tsx` | `/spikes/canvas` route を追加 | 既存 note route と分離した検証入口 |
| `src/app/spikes/canvas/_components/canvas-spike-page.tsx` | 共通 fixture、両候補 panel、比較観点、live `searchText` projection を表示 | 同じ操作・同じ初期状態で比較可能にするため |
| `src/app/spikes/canvas/_components/canvas-toolbar.tsx` | select / pen / line / arrow / rect / ellipse / text / erase、Undo/Redo、reset、round trip、Fit/50/100/200% toolbar | 必須操作と focus 可能な操作入口を共通化 |
| `src/app/spikes/canvas/_components/fabric-canvas-panel.tsx` | Fabric の client-only dynamic import、freehand、図形、テキスト、選択/移動/resize/削除、object erase、history、zoom、Pointer Events | Fabric 候補の最小 POC |
| `src/app/spikes/canvas/_components/konva-canvas-panel.tsx` | Konva の client-only dynamic import、同じ drawing tools、Transformer、history、zoom、`pointerdown/move/up`、touch-action | Konva 候補の最小 POC |
| `src/app/spikes/canvas/_lib/canvas-document.ts` | `CanvasDocumentV1`、固定 `1200x800` page、element type/style/z、stroke points、validation、serialize/restore、typed text の `searchText` 抽出、fixture | vendor-neutral な正本形式を先に定義 |
| `src/app/spikes/canvas/_lib/canvas-history.ts` | client memory の bounded undo/redo history | history を保存 payload に混ぜないため |
| `src/app/spikes/canvas/_lib/fabric-adapter.ts` | app-owned element ⇄ Fabric object の変換 | Fabric 内部 JSON を API/DB 正本にしないため |
| `src/app/spikes/canvas/_lib/konva-adapter.ts` | app-owned element ⇄ Konva node の変換 | Konva scene graph を API/DB 正本にしないため |
| `src/app/globals.css` | bounded viewport、固定 page surface、toolbar、focus ring、responsive layout、internal zoom scroll | 意図しない page-wide horizontal overflow を避けるため |
| `package.json` | `fabric@7.4.0`、`konva@10.3.0` を候補依存として追加 | 実際の候補を route で検証するため |

`package-lock.json` は未変更。外部 registry がこの環境から解決できず、lockfile を npm で生成できなかったため、未生成の integrity / transitive dependency 情報を手編集していない。ネットワークまたは npm cache が使える環境で `npm install --save-exact fabric@7.4.0 konva@10.3.0` を実行し、lockfile を更新する。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-01 | fact | Fabric は object model、selection/controls、free drawing、JSON/SVG export を持つため、今回の操作を短いコードで組みやすい。ただし POC の保存は Fabric JSON ではなく adapter 経由の app-owned JSON にした。 | [Fabric core concepts](https://fabricjs.com/docs/core-concepts/) |
| F-02 | fact | Fabric 7 は `enablePointerEvents` を提供し、POC は `enablePointerEvents: true` と `touch-action: none` を設定した。Fabric 7 では旧 `getPointer` が削除されているため、POC は DOM `clientX/clientY` から固定 page 座標へ変換する。 | [Fabric CanvasOptions](https://fabricjs.com/api/interfaces/canvasoptions/)、[Fabric 7 upgrade notes](https://fabricjs.com/docs/upgrading/upgrading-to-fabric-70/) |
| F-03 | fact | Konva は shape/scene graph、drag、Transformer、pointer events を提供するが、history と app state の設計はアプリ側に残る。POC は React binding を追加せず、`konva` core を dynamic import して state/adapter を自前管理した。 | [Konva overview](https://konvajs.org/docs/overview.html)、[Konva Pointer Events](https://konvajs.org/docs/events/Pointer_Events.html) |
| F-04 | fact | Konva の公式 serialization best practices は、大きなアプリでは stage/tree の内部 JSON より、アプリに必要な state を保存し、create/update 関数で scene を再構成する方式を推奨している。今回の app-owned adapter と整合する。 | [Konva serialization best practices](https://konvajs.org/docs/data_and_serialization/Best_Practices.html) |
| F-05 | fact | Fabric.js と Konva は MIT license で、local-only 個人利用に license fee / production key は不要という前提で比較できる。 | [Fabric LICENSE](https://github.com/fabricjs/fabric.js/blob/master/LICENSE)、[Konva about/license](https://konvajs.org/docs/about.html) |
| F-06 | fact | Konva `10.3.0` の npm package は 0 dependencies。Fabric `7.4.0` は npm package に browser 用 optional な `canvas` / `jsdom` が記載され、導入コストは Konva より複雑になり得る。 | [Konva npm package](https://www.npmjs.com/package/konva?activeTab=versions)、[Fabric package metadata](https://app.unpkg.com/fabric%407.4.0/files/package.json) |
| A-01 | assumption | 本体の次 task では、Canvas 本文の要素単位操作を増やすため Fabric の built-in object model を優先すると実装量が抑えられる。 | 両 panel の同一 POC 構造と上記公式 API |
| U-01 | unknown | 実 browser での freehand/arrow/group resize の見た目、touch/stylus 実機、production bundle の gzip size は未確認。依存未導入のため route を起動できない。 | `npm run build` が `Can't resolve 'fabric'/'konva'` で停止 |
| U-02 | unknown | `package-lock.json` の正確な resolved/integrity と Fabric optional dependency の実インストール結果は未確定。 | registry DNS / npm cache が利用できない |

## Recommendation

次の hybrid Canvas 実装候補は **Fabric.js** を推奨する。

- Fabric は selection、移動、resize controls、free drawing、shape/text object が最初から同じ object model に乗るため、今回の要件を Konva より少ないアプリ側コードで検証しやすい。
- ただし persistence、検索、schema version、undo/redo、上限 validation は `CanvasDocumentV1` と app 側で管理する。Fabric の内部 JSON を保存しない。
- Konva は比較候補として十分成立する。scene graph と Pointer Events は扱いやすく、将来アプリ state を完全に React state で管理する、または描画性能を優先する場合の fallback とする。ただし Transformer の結線、shape 更新、history、serialization を自前で持つ量が Fabric より多い。
- 両者とも MIT で local-only 条件には適合する。Fabric の optional Node dependencies と正確な production bundle size は導入後に再確認する。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npm run lint` | PASS | 既存変更を含む lint が成功 |
| `git diff --check` | PASS | whitespace error なし |
| `npx tsc --noEmit --pretty false` | BLOCKED | `fabric` / `konva` の型解決だけが未導入依存として失敗 |
| `npm run build` | BLOCKED | Webpack が `Can't resolve 'fabric'` / `Can't resolve 'konva'` で停止 |
| `npm install --package-lock-only --ignore-scripts --no-audit --no-fund --offline` | BLOCKED | `ENOTCACHED`: registry metadata が npm cache にない |
| route/runtime visual QA | NOT RUN | 候補依存を取得できず、ブラウザで `/spikes/canvas` を起動できない |
| 既存 note/API/Prisma 差分 | PASS by scope | 新規 route/CSS/package.json 以外の既存本体は変更していない。未コミット変更は保持した |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-01 | npm install 後の lockfile、build、実ブラウザの操作/Pointer Events | `npm install --save-exact fabric@7.4.0 konva@10.3.0`、`npm run build`、desktop/mobile route QA |
| U-02 | production bundle の実測と Fabric optional dependency の導入判断 | build artifact または bundle analyzer の測定 |
| U-03 | Fabric の arrow group と stroke resize/rotation の保存精度 | 実ブラウザで操作 → Save → refresh 相当の restore fixture QA |

## Next Read

次の作業では、まず以下だけを読む。

- `summary/20260718/1320-canvas-library-spike.md`
- `package.json`
- `src/app/spikes/canvas/_lib/canvas-document.ts`
- `src/app/spikes/canvas/_components/fabric-canvas-panel.tsx`
- `src/app/spikes/canvas/_components/konva-canvas-panel.tsx`

## Worker follow-up (2026-07-18)

依存解決と実行確認を再試行した。既存の未コミット変更は保持し、`package-lock.json` と DB / API / 既存 NoteEditor 本体は変更していない。

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npm install --save-exact --no-audit --no-fund fabric@7.4.0 konva@10.3.0` | BLOCKED | `ENOTFOUND registry.npmjs.org`。registry DNS / ネットワークに到達できない |
| `npm install --package-lock-only --ignore-scripts --no-audit --no-fund --offline fabric@7.4.0 konva@10.3.0` | BLOCKED | `ENOTCACHED`。npm cache に `fabric` の registry metadata がない |
| `npm ls fabric konva --depth=0` | BLOCKED | `(empty)`。`node_modules` に両候補なし |
| `package.json` / `package-lock.json` / `node_modules` | INCONSISTENT (environment-blocked) | `package.json` の指定は `fabric: 7.4.0` / `konva: 10.3.0`。lockfile の root dependency / package entry は両方なく、npm で lockfile を更新できなかった |
| `npx tsc --noEmit --pretty false` | BLOCKED | production build が依存解決で停止したため `.next/types/**/*.ts` の生成型がなく、tsconfig の include で `TS6053`。候補依存込みの full typecheck は未確定 |
| Canvas lib targeted `tsc` | PASS | `canvas-document`、`canvas-history`、`fabric-adapter`、`konva-adapter` を DOM / ES2022 / strict 条件で外部候補型なしに確認 |
| `npm run lint` | PASS | exit code 0 |
| `npm run build` | BLOCKED | Webpack が `fabric` / `konva` を resolve できず停止 |
| `git diff --check` | PASS | whitespace error なし |
| `/spikes/canvas` 実ブラウザ QA | NOT RUN | in-app browser の利用可能 backend が空。依存未導入のため local route も起動できず、両 panel / fixture round trip / typed `searchText` / toolbar focus / page overflow / pointer-touch 操作は未確認 |

`npm cache verify` も root-owned cache file の unlink に対する `EPERM` で完了しなかった。lockfile の integrity / transitive dependency を推測で手編集していないため、依存解決可能な環境で次のコマンドを再実行する必要がある。

```sh
npm install --save-exact --no-audit --no-fund fabric@7.4.0 konva@10.3.0
npm ls fabric konva --depth=0
npx tsc --noEmit --pretty false
npm run lint
npm run build
```

Fabric.js 推奨は維持する。これは実ブラウザ操作の再判定ではなく、既存 spike の app-owned `CanvasDocumentV1` 設計、Fabric の object model / controls / free drawing の実装適合性、Konva 側で必要になる Transformer・scene update・history の追加アプリコード量に基づく暫定判定である。依存解決後に両 panel の主要操作、round trip、pointer/touch 相当入力、production build を実測して最終確定する。
