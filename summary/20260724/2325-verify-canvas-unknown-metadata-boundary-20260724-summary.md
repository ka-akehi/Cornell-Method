## Objective

Canvas の metadata なし／未知 object が新規 drawing gesture の開始対象にならず、保存 Canvas JSON に混入しないことを確認する。`CANVAS-INTERACTION-001` の未確認範囲を、Browser runtime または実装根拠に分類する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Notes Canvas の Fabric metadata、gesture 開始判定、Canvas document 変換 |
| 対象ファイル / ディレクトリ | `src/shared/canvas/adapters/fabric/fabric-metadata.ts`、`src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`、`src/shared/canvas/adapters/fabric/fabric-canvas-to-document.ts`、`doc/testing/TEST_SCENARIOS.md`、Fabric 7 の drawing event 実装 |
| 対象外 | 既確認の threshold、preview、inline editor、恒久的な source / config / DB / test fixture / docs の変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 引き継ぎ | `HANDOFF_2026-07-23.md` | 2026-07-24 Browser QA の既確認範囲と unknown metadata が残課題であること |
| 実装 | `src/shared/canvas/adapters/fabric/fabric-metadata.ts` | `isCanvasDrawingTarget` の metadata/type allowlist 判定 |
| 実装 | `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts` | `canStartCanvasElement`、pen/custom gesture、`path:created` の順序 |
| 実装 | `src/shared/canvas/adapters/fabric/fabric-canvas-to-document.ts` | metadata なし、preview、editor object の変換 filter |
| テスト仕様 | `doc/testing/TEST_SCENARIOS.md` | `CANVAS-INTERACTION-001` は未確認時 `PASS` にしない契約 |
| 依存実装 | `node_modules/fabric/src/canvas/Canvas.ts` | Fabric 7 の drawing mode が app `mouse:down` listener より先に brush を開始すること |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260724/2325-verify-canvas-unknown-metadata-boundary-20260724-summary.md` | 調査結果のみを記録 | Worker の再開用 summary。source、設定、DB、fixture、恒久 docs は変更していない |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | Browser runtime は利用不可。初期化後の `agent.browsers.list()` は空配列で、`/notes/new` の route、viewport、pointer、console/page error、保存 API、cleanup の Browser 証跡は取得できなかった。 | Browser skill の接続結果 |
| F-002 | fact | metadata なし object と `canvasElement.element.type` が未知の object は `isCanvasDrawingTarget` が `false`。target なしは `true`、認識済み type は `true`。 | `readCanvasElementType` の6 type allowlist と `isCanvasDrawingTarget`。in-memory helper 実行でも同じ結果を確認 |
| F-003 | fact | line / arrow / rect / ellipse / text の app custom gesture は `canStartCanvasElement=false` で開始処理を抜ける。preview は別判定でも遮断される。 | `use-note-canvas-runtime.ts` の `onMouseDown` |
| F-004 | fact | metadata なし object、`isCanvasPreview` object、shape text editor object は `fabricObjectToElement` が `null` とし、`fabricCanvasToDocument` の elements から除外する。in-memory canvas で valid line + unknown + preview を変換した結果は line 1 件のみだった。 | `fabric-canvas-to-document.ts` と純粋変換確認 |
| F-005 | fact | pen は安全境界を完全には確認できない。Fabric 7 は `isDrawingMode` 時、内部の `__onMouseDown` で brush を開始してから `mouse:down` を発火する。アプリ handler は unknown target を見て draft points を空にするだけで、Fabric brush 自体を停止しない。pointer up では path が先に canvas に追加され、`path:created` は points 不足で return するため、metadata なし path が Fabric canvas に残り得る。 | Fabric `Canvas.ts` の `__onMouseDown` / drawing mode 処理、runtime の pen guard と `onPathCreated` |
| F-006 | fact | unknown metadata の converter 安全性は不足している。`canvasElement.element.type="unknown"` は gesture target として false だが、converter は metadata の存在だけで処理を進め、`style` なし in-memory object では `base.style` 参照の TypeError になった。 | `readCanvasElementMetadata` の unchecked cast と `fabricObjectToElement`。これは保存混入ではなく、converter の未知 metadata 耐性に関する残課題 |
| F-007 | unknown | Browser で実際に unknown object を pointer down の開始点にした pen / line / rect 等の要素数・geometry・type比較、保存 handler/API response、console/page error、fixture cleanup は未確認。 | Browser runtime 不可。既存 UI から arbitrary Fabric object を安全に注入する fixture も作成していない |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 未コミット変更なし |
| Browser runtime discovery | 未実施 | `agent.browsers.list()` が `[]`。別の Browser backend や source/debug route は使用していない |
| pure metadata / converter check | PASS（限定） | metadata なし／未知 type の target false、metadata なし／preview の document 除外を確認。Browser runtime PASS ではない |
| `npm run lint` | PASS | source変更なしの整合性確認 |
| `npx tsc --noEmit --pretty false` | PASS | source変更なしの型確認 |
| fixture cleanup | 該当なし | Browser fixture は作成していない |
| 作業後 `git status --short` | PASS | summary 以外の変更なし |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | Browser runtime で metadata なし／未知 object 上の全 tool の gesture 開始可否と保存 JSON の要素数・geometry・type | `/notes/new`、既知の基準 document、arbitrary Fabric object fixture、1280 x 900 等の viewport 記録、保存 response |
| U-002 | unknown target 上の pen が生成する metadata なし path が画面上・後続操作・確定保存でどう扱われるか | Browser pointer sequence と `canvas.getObjects()` / save response の観察。現静的根拠では完全遮断を PASS にできない |
| U-003 | unknown metadata shape、または known type だけを持つ malformed metadata が gesture / converter / API validation を壊さないか | 検証用 fixtureまたは adapter unit test。ただし本 task では fixture・test の追加を行わない |

## Verdict

`CANVAS-INTERACTION-001` は `部分実施` のまま。metadata なし object の custom target 判定と保存 converter の除外には実装根拠があるが、Browser runtime の unknown object 証跡がなく、さらに Fabric pen の event order により新規 gesture の完全遮断を静的に保証できない。PASS への繰り上げは行わない。

## Next Read

- `src/shared/canvas/adapters/fabric/fabric-metadata.ts`
- `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`
- `src/shared/canvas/adapters/fabric/fabric-canvas-to-document.ts`
- `doc/testing/TEST_SCENARIOS.md` の `CANVAS-INTERACTION-001` と 2026-07-24 追補
- `node_modules/fabric/src/canvas/Canvas.ts` の drawing mode event 順
