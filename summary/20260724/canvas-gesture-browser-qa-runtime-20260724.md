---
summary_type: canvas-runtime-qa
created_at: 2026-07-24 22:55 JST
---

# Canvas gesture browser QA 追補

## Objective

`CANVAS-INTERACTION-001` と `CANVAS-GESTURE-001` のうち、空白・既存要素からの gesture 開始、図形 tool の click / double-click no-op、3px の微小 drag、5px の閾値超過 drag を現行実装で実測する。

## Scope

- `/notes/new` の Canvas editor、1280 x 900、pointer gesture と保存 API 応答
- 恒久的な source / API / DB schema / fixture の変更は対象外

## Inputs Read

- `summary/20260724/2215-verify-canvas-gesture-boundaries-runtime-20260724-1c6c205d-summary.md`
- `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`
- `src/shared/canvas/adapters/fabric/fabric-metadata.ts`
- `doc/testing/TEST_SCENARIOS.md` の `CANVAS-INTERACTION-001` / `CANVAS-GESTURE-001`

## Changes Made

- Canvas runtime の一時ノートを作成し、保存 API の response を読み取り、確認後に削除した。
- 恒久的なアプリコード、設定、依存関係、DB、fixture は変更していない。

## Findings

- 4 種図形 tool は click / double-click / 3px が no-op、5px が 1 件の確定要素になった。
- 6 種の既存要素上から 6 tool の新規 gesture を開始し、12 要素の保存を確認した。
- 図形 tool の inline editor を表示したまま同じ四角 tool で overlay から 70px drag しても、新規 rect は増えず、入力した `INLINE` だけが既存 rect に確定した。
- 5px の line preview 中に pointer-up 前の保存 handler を実行した場合、保存応答の要素数は 0 件で、未確定 preview は保存へ混入しなかった。
- 実行ケースの console / page error は 0 件だった。

## Runtime setup

- route: `http://127.0.0.1:3000/notes/new`
- runtime: 権限付き headless Playwright Chromium の `page.mouse`
- viewport: 1280 x 900
- target source: PR #18 merge `46ca6ea` を含む `main`、QA 記録 commit `7daecdd`
- fixture: 各閾値ケースと既存要素重ね描き用の一時ノートを作成し、保存 API 応答を確認後に ID 指定で削除
- console / page error: 実行したケースで error 0

## Results

### Click / double-click / drag threshold

各 tool の保存 API 応答で `canvas.elements` の件数と type を確認した。

| tool | click | double-click | 3px drag | 5px drag |
| --- | ---: | ---: | ---: | --- |
| 直線 | 0 件 | 0 件 | 0 件 | 1 件 (`line`) |
| 矢印 | 0 件 | 0 件 | 0 件 | 1 件 (`arrow`) |
| 四角 | 0 件 | 0 件 | 0 件 | 1 件 (`rect`) |
| 円 | 0 件 | 0 件 | 0 件 | 1 件 (`ellipse`) |

click / double-click / 3px は no-op となり、5px のみ 1 件の確定要素になった。厳密な 4px 境界値そのものは未確認。

### Existing Canvas element targets

同一の一時ノートに `stroke`、`line`、`arrow`、`rect`、`ellipse`、standalone `text`（`BASE`）を作成した。その後、各既存要素の上を開始点として、同じ 6 tool（pen、line、arrow、rect、ellipse、text）で新しい gesture を実行し、保存応答で次を確認した。

- 保存要素は 12 件で、type は基準 6 件 + 重ね描き 6 件の順に保持された。
- text 要素は `BASE` と `OVERLAP` の 2 件として保持された。
- 既存要素上からの新規 gesture が、既存要素の消失や別 type への変換なしに確定した。
- console error / page error は 0 件。

### Preview / inline editor boundary

- 四角 tool で図形を作成し、同じ tool の double-click で inline editor を開いた。hidden Fabric textarea が active であることを確認した。
- overlay 上から同じ四角 tool の 70px drag を行った後に保存すると、保存要素は rect 1 件のみで、`text: "INLINE"` が保持された。新規 rect は作成されなかった。
- 直線の 5px preview を pointer-up 前に保存 handler へ渡したケースでは、`canvas.elements` は 0 件だった。通常の pointer-up 後は 5px の確定 line になるため、preview と確定要素を分けて観察した。

### Cleanup

一時ノートは全て `DELETE /api/notes/:id` で削除した。終了後に `GET /api/notes?query=Gesture` を再確認し、`totalCount=0` だった。

## Remaining Unknowns

- 厳密な 4px 境界値、metadata 欠落 / unknown object の遮断
- 別 tool へ切り替えた直後の shape inline text と shape drag の分離、保存後の Browser 再読込表示

## Verdict

- `CANVAS-INTERACTION-001`: `部分実施`。空白および既存の 6 種要素上からの新規作成、同じ tool の inline editor overlay からの新規要素遮断、未確定 preview の保存除外を確認済み。metadata 欠落 / unknown object の遮断は未確認。
- `CANVAS-GESTURE-001`: `部分実施`。4 種図形の click / double-click no-op、3px no-op、5px 確定、同じ tool の shape inline text と drag の分離を確認済み。厳密な 4px 境界、別 tool へ切り替えた直後の分離、保存後の再読込比較は未確認。

## Worker fallback

対応する Common Worker task は app-server 初期化時の `Operation not permitted` で失敗した。Manager が同じローカル runtime を権限付き Playwright で補完した。失敗記録は `summary/20260724/2215-verify-canvas-gesture-boundaries-runtime-20260724-1c6c205d-summary.md` に残す。

## Verification

- Playwright runtime: 上記ケース完了
- temporary fixture cleanup: 完了（query 残存 0 件）
- source / API / DB schema / fixture の恒久変更: なし
- `git diff --check`: 後続 commit 前に実行

## Next Read

- `doc/testing/TEST_SCENARIOS.md` の Canvas runtime QA 追補と受け入れ証跡マトリクス
- `doc/implementation/IMPLEMENTATION_STATUS.md` §5.3 の Canvas runtime 記録
- 未確認の exact 4px / unknown metadata / 別 tool 切り替え後の shape gesture 境界
