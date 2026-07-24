# Canvas Toolbar Browser QA 追補

実施日: 2026-07-24（JST）
対象 commit: `46ca6ea`（`main`）
対象シナリオ: `CANVAS-TOOLBAR-STYLE-001`

## Objective

2026-07-22 に確認された実効約 1265px の drawing rail collapse が、CSS 修正後の現行 main で再現しないこと、および toolbar の responsive・pointer・keyboard・touch 到達性と Canvas の局所 scroll を Browser runtime で再確認する。

## Runtime setup

- route: `http://127.0.0.1:3000/notes/new`
- runtime: headless Playwright Chromium（権限付きローカル実行）
- requested viewport: 375 / 768 / 1280 / 1440px、height 1000px
- console / page error: 全 viewport で error / warning 0
- fixture: 作成なし。既存ノート・既存 fixture は変更していない

## Results

| requested width | effective width | toolbar width | drawing rail `clientWidth / scrollWidth` | body / document `scrollWidth` | pointer tool reachability |
| ---: | ---: | ---: | ---: | ---: | --- |
| 375 | 375 | 325 | 305 / 461（local scroll） | 375 / 375 | 6 tools を順に click、全て `data-active=true` |
| 768 | 768 | 483.88 | 346 / 461（local scroll） | 768 / 768 | 6 tools を順に click、全て `data-active=true` |
| 1280 | 1280 | 816.84 | 679 / 679（collapse なし） | 1280 / 1280 | 6 tools を順に click、全て `data-active=true` |
| 1440 | 1440 | 925 | 79 / 461（local scroll） | 1440 / 1440 | 6 tools を順に click、全て `data-active=true` |

375px、768px、1440px は rail の `scrollWidth > clientWidth` を確認し、Playwright の click が必要な tool まで local scroll して到達した。1280px では rail が 679px を確保し、旧記録の約 8px sliver は再現しなかった。

### Keyboard / ARIA

- 375 / 1280 / 1440px で実際の `Tab` と `Shift+Tab` を実行し、toolbar 内の論理順を往復できた。
- 375px の順序は `選択 → ペン → 直線 → 矢印 → 四角 → 円 → 文字 → 消しゴム → 用紙サイズの summary → 幅 → 高さ`。折りたたみ状態の `適用` は summary 展開後の対象となる。
- 1280 / 1440px の順序は `選択 → ペン → 直線 → 矢印 → 四角 → 円 → 文字 → 消しゴム → 幅 → 高さ → 適用`。
- drawing tool の `aria-label`、`aria-pressed`、active state は各 click 後に確認できた。初期状態で選択対象がない style alignment と history は disabled だった。

### Paper size / scroll

1280px で用紙を 1920 x 1080 に変更したところ、保存対象表示は `用紙サイズ: 1920 x 1080 px` となった。

- `body.scrollWidth = 1280`、`document.documentElement.scrollWidth = 1280`
- 横 overflow は `.note-canvas-horizontal-scroll`（`clientWidth=794`, `scrollWidth=1920`, `overflow-x=auto`）に限定
- Summary と `.note-paper-footer` はページ下端への縦 scroll 後に viewport 内へ到達

375px の touch context で `ペン` を tap し、`data-active=true` / `aria-pressed=true` と console error 0 を確認した。

## 判定

`CANVAS-TOOLBAR-STYLE-001` は `部分実施` とする。

responsive rail collapse、pointer による全 drawing tool 到達、Tab / Shift+Tab、body-wide overflow の主要範囲は確認できた。一方、touch の Canvas scroll 干渉、focus-visible の視覚確認、style target を選択した状態での alignment 即時反映、375px で summary を開いた後の `適用` 操作はこの追補の対象外または未確認であるため、シナリオ全体を PASS へ繰り上げない。

## Changes

- source / CSS / API / DB / fixture は変更していない
- 本 summary と `doc/testing/TEST_SCENARIOS.md`、`doc/implementation/IMPLEMENTATION_STATUS.md` に runtime 証跡を追記した
- `git diff --check`: PASS

## Next Read

- `doc/testing/TEST_SCENARIOS.md` の「Canvas toolbar runtime QA 追補（2026-07-24）」
- `doc/implementation/IMPLEMENTATION_STATUS.md` §5.3
- `src/app/styles/note-canvas-toolbar.css`
- `src/modules/notes/ui/components/canvas/toolbar.tsx`
