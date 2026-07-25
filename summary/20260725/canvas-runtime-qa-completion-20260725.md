---
summary_type: canvas-runtime-qa
created_at: 2026-07-25 JST
task_kind: manager-runtime-qa-fallback
task_status: done
---

# Canvas runtime QA completion (2026-07-25)

## Objective

残っていた Canvas MVP の Browser runtime QA を、Worker の Browser backend 初期化制限を補う Manager 側の権限付き headless Playwright Chromium で実測し、確認済み範囲と未確認範囲を固定する。

## Scope

| 項目 | 内容 |
| --- | --- |
| route | http://127.0.0.1:3000/notes/new、保存確認のみ保存後の /notes/:id |
| runtime | 権限付き Playwright Chromium。通常 viewport 1280 x 900、responsive 375 / 768、touch context 375 / 1280 |
| 対象 | 用紙寸法、style / shape text、保存・viewer・edit reload、eraser、Undo/Redo、toolbar focus/ARIA、touch scroll |
| 対象外 | 既確認の 3px / 5px、厳密な 4px 境界、unknown-target pen、shape tool switch の再実施。4px は発注者判断で不要 |

## Inputs Read

- AGENTS.md、HANDOFF_2026-07-23.md
- doc/implementation/MVP_CONTRACT.md
- doc/testing/TEST_SCENARIOS.md
- doc/implementation/IMPLEMENTATION_STATUS.md
- summary/20260725/canvas-shape-tool-switch-gesture-separation-runtime-20260725.md
- summary/20260725/canvas-unknown-target-pen-browser-qa-runtime-20260725.md
- Worker blocker summaries for the six queued runtime tasks

## Changes Made

- Manager fallback の runtime 証跡を本 summary に記録した。
- アプリコード、設定、依存関係、DB schema、API、恒久 fixture は変更していない。
- 以下の検証で作成した一時ノートは DELETE 204、削除後 GET 404、タイトル検索 totalCount=0 を確認した。

## Findings

### Dimension and resize

- 初期表示は 1200 x 800 px。
- 幅・高さの 320 と 4000 は適用でき、319、4001、decimal、blank は inline error と aria-invalid=true で拒否された。
- 幅を 320 → 4000 に変更した前後で rect の id、x、y、width、height、style が一致した。高さの境界でも寸法以外の要素データは保持された。
- console error / warning、page error は 0 件。

### Style and shape text

- standalone text は font size 8 / 96 を適用でき、7 / 97 / 12.5 / blank は直前値 96 を維持した。
- line は stroke width 1 / 20 を適用でき、0 / 21 / 1.5 / blank は直前値 20 を維持した。
- standalone text の色、line の色はそれぞれの選択 target の live Fabric style だけに反映された。
- standalone text の left / center / right alignment は各クリック直後に live style が変化した。
- rect inline text editor は線幅を disabled、文字色・フォントサイズ・配置を enabled とし、font size 20、color #16a34a、center を commit 後の textStyle へ保存した。editor 中の hidden textarea は tool switch 後に解放された。

### Save, viewer, reload, and cleanup

- 一時タイトル Runtime Persistence QA 20260725 を UI から保存した。Canvas を 1280 x 900 に変更し、standalone text PERSIST TEXT（font 18、color #b91c1c）と line（strokeWidth 4）を作成した。
- UI の POST response は 201、保存後 GET は 200。request body と GET の page / elements は一致した。
- 詳細 viewer の assistive text は page 1280 x 900 と PERSIST TEXT を表示した。閲覧から編集へ切り替え、reload 後も viewer → edit で title、page、text が復元された。
- cleanup は DELETE 204、削除後 GET 404、query totalCount=0。アプリ操作中の console / page error は 0 件。

### Eraser and history

- text、rect、ellipse、line を個別に click / drag で消去し、対象全体だけが削除された。非対象の geometry、style、text、points は保持され、最後の object 数は 0。errors は 0 件。
- 空履歴では Undo / Redo が disabled。rect create → Undo（0 objects、Redo enabled）→ Redo（rect 復元）を確認した。
- text edit は Undo で末尾 1 文字を戻し、Redo で復元した。page 1200 x 800 → 1280 x 900 も Undo / Redo で復元した。errors は 0 件。

### Toolbar, responsive, and touch

- 375 px の drawing rail は clientWidth / scrollWidth 305 / 461、768 px は 346 / 461。全 tool の aria-label、aria-pressed、data-active はクリックした current tool と一致した。
- Tab / Shift+Tab で toolbar を移動し、focus-visible の outline は solid 2 px だった。
- 375 / 768 px で 640 x 480 の適用、319 の inline error と aria-invalid=true を確認した。body / document の scrollWidth は viewport width と一致した。
- touch context 375 px で縦 swipe を 4 回行うと scrollY は 1779 まで増え、footer が viewport 内に到達した。body / document の横 overflow はなかった。
- touch context 1280 px で 1920 x 1080 用紙を横 swipe すると Canvas 内 scrollLeft は 0 → 1069、page scrollY は不変、body / document の横 overflow はなかった。

### Worker fallback and excluded threshold

- 対応する Worker task は Browser backend が空配列、app-server が Operation not permitted で実測前に停止した。Worker の失敗を runtime PASS の根拠にはせず、上記 Manager fallback の実測を根拠にした。
- 3px / 5px、unknown-target pen、shape tool switch は既存 summary の確認済み結果を採用し、重複実施していない。
- 厳密な 4px 境界は発注者判断により再確認していない。4px を除いて残存していた Canvas runtime QA は本 summary で実測済みである。

## Verification

| 確認項目 | 結果 |
| --- | --- |
| Browser runtime | PASS（Manager 権限付き Chromium fallback） |
| Dimension valid / invalid | PASS（幅・高さ 320 / 4000、319 / 4001 / decimal / blank） |
| Geometry/style invariance on resize | PASS |
| Style numeric/color/alignment | PASS |
| Shape inline text style commit | PASS（rect subset） |
| UI save / API POST・GET / viewer / edit reload | PASS |
| Eraser whole-object | PASS |
| Undo/Redo object/text/page | PASS |
| Toolbar ARIA / focus-visible / responsive | PASS（対象範囲） |
| Touch vertical / local horizontal scroll | PASS |
| Console warning/error、page error | PASS（全ケース 0 件） |
| Temporary data cleanup | PASS（204 → 404、query totalCount=0） |
| Source/config/dependency/schema/API/permanent fixture changes | なし |

## Remaining Unknowns

- CANVAS-INTERACTION-001 / CANVAS-GESTURE-001 全体は、厳密な 4px 境界を除外した発注範囲で部分実施のまま。既知要素、preview、metadata boundary、3px / 5px、shape tool switch の確認済み subset は別 summary を参照する。
- CANVAS-SHAPE-TEXT-001 は rect commit、ellipse cancel、tool switch、style commit、cleanup の subset を確認済み。全 tool の反復 lifecycle を網羅した判定ではない。
- wheel / trackpad 固有の物理入力はこの batch では測定していない。touch と page/local scroll の契約は確認済み。
- Phase 2（autosave、soft delete Undo、review task、Card/D&D、PDF export 等）は現行 MVP runtime QA の対象外。

## Next Read

- doc/testing/TEST_SCENARIOS.md の Canvas runtime QA 2026-07-25 追補と受け入れ証跡マトリクス
- doc/implementation/IMPLEMENTATION_STATUS.md §5.3 の Canvas runtime QA 2026-07-25 記録
- src/modules/notes/ui/hooks/use-note-canvas-runtime.ts
- src/modules/notes/ui/components/canvas/toolbar.tsx
- src/modules/notes/ui/components/canvas/toolbar-paper-controls.tsx
- src/modules/notes/ui/components/canvas/toolbar-style-controls.tsx
