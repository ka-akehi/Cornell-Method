# Task Summary: Canvas 図形内文字の保存・編集設計レビュー

## Objective

四角・円を `select` tool でダブルクリックしたときに、図形内へ plain text を入力・編集できるようにするため、現行 `CanvasDocumentV1`、Fabric adapter、editor、検索・保存経路との整合性を調査した。

推奨案、代替案との比較、実装対象、Worker が追加質問なしで着手できる受け入れ条件、schema/API/DB の変更要否を確定する。コード、設定、依存関係、DB、生成物は変更していない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Canvas の図形内 plain text、Fabric runtime 表現、検索・保存・履歴・全体消去との互換性 |
| 対象ファイル | `src/shared/canvas/canvas-document.ts`、`src/app/spikes/canvas/_lib/fabric-adapter.ts`、`src/app/notes/_components/note-canvas-editor.tsx`、`note-canvas-viewer.tsx`、`note-canvas-toolbar.tsx`、notes validation / repository / mapper / API 周辺 |
| 契約 | `doc/implementation/MVP_CONTRACT.md` §6.1・§8、`doc/implementation/IMPLEMENTATION_STATUS.md`、`HANDOFF_2026-07-19.md` |
| 対象外 | 実装、schema migration、API route の追加、Fabric raw JSON の保存、rich text / Markdown / group 管理 UI、部分消去 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 引き継ぎ | `HANDOFF_2026-07-19.md` | 現行 Canvas の正本、tool 境界、history、whole erase、page resize、未確認事項 |
| 現行契約 | `doc/implementation/MVP_CONTRACT.md` | `CanvasDocumentV1`、保存・検索・DB/API、MVP / Phase 2 境界 |
| 実装状況 | `doc/implementation/IMPLEMENTATION_STATUS.md` | Canvas persistence / search、Fabric renderer、runtime QA の判定 |
| 共通契約 | `src/shared/canvas/canvas-document.ts` | V1 の型、validation、serialize / restore、`extractCanvasSearchText()` |
| adapter | `src/app/spikes/canvas/_lib/fabric-adapter.ts` | Fabric object の生成、metadata、document 投影、arrow の複合 Group 例 |
| editor | `src/app/notes/_components/note-canvas-editor.tsx` | pointer tool 分岐、standalone text、history、whole erase、style controls |
| viewer | `src/app/notes/_components/note-canvas-viewer.tsx` | 保存済み document の read-only Fabric 描画と assistive text |
| 保存 / 検索 | `src/modules/notes/contracts/note.schema.ts`、`src/server/notes/infrastructure/command.repository.ts`、`read.repository.ts`、`src/server/notes/presenters/notes.mapper.ts` | API validation、`documentJson` と `searchText` の保存・復元・一覧検索 |
| 履歴 | `src/app/spikes/canvas/_lib/canvas-history.ts` | snapshot 比較、最大 50 件、Undo / Redo、redo future の破棄 |
| テスト観点 | `doc/testing/TEST_SCENARIOS.md` | 既存 Canvas の保存・復元・検索・page resize の受け入れ観点 |
| Fabric runtime | `node_modules/fabric/package.json`、Fabric 7.4.0 の source 型 / event 実装 | `mouse:dblclick`、Textbox editing、Group / transform の利用可否 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260719/1550-design-canvas-shape-text-20260719-summary.md` | 本設計レビューの完了要約のみ追加 | 後続 Worker の最小再開起点として、raw log ではなく決定事項と受け入れ条件を残すため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-01 | fact | 現在の正本は app-owned `CanvasDocumentV1` であり、Fabric の stage / object JSON は保存しない。 | `HANDOFF_2026-07-19.md` §6.1〜§6.3、`MVP_CONTRACT.md` §6.1・§8 |
| F-02 | fact | `CanvasElementV1` の TypeScript 型には既に `text?: string` があるが、validation が `rawElement.text` をコピーするのは `type === "text"` のときだけである。rect / ellipse に送られた text は現在エラーにならず、`validateCanvasDocument()` の戻り値から silently drop される。 | `src/shared/canvas/canvas-document.ts:32-44, 347-385` |
| F-03 | fact | 現在の text 要素は `style.fill` / `style.fontSize` / `style.fontFamily` を使う一方、rect / ellipse は同じ `style.fill` を図形の fill として使うため、図形内文字を同じ `style` に混ぜると意味が衝突する。 | `src/shared/canvas/canvas-document.ts:24-30`、`fabric-adapter.ts:143-160, 294-315` |
| F-04 | fact | adapter には arrow を line + head の Fabric Group として描く既存パターンがある。外側だけに `canvasElement` metadata を持たせ、内側を document 要素にしない方式を再利用できる。 | `src/app/spikes/canvas/_lib/fabric-adapter.ts:239-321` |
| F-05 | fact | 現在の `fabricObjectToElement()` は point 要素以外について、shape / text の `left`, `top`, `scaleX`, `scaleY`, `width`, `height` を canonical geometry に十分反映していない。shape / text の move / resize を保存する task としても、この箇所が既知のリスクになる。 | `src/app/spikes/canvas/_lib/fabric-adapter.ts:361-414`。point 要素だけ `translatePointList()` と bounds 再計算を行う。 |
| F-06 | fact | editor の現在のダブルクリック相当のイベント登録はなく、`mouse:down` は active tool によって分岐する。shape の描画 tool は既存 target 上で新規 drag を開始しない。 | `src/app/notes/_components/note-canvas-editor.tsx:452-517` |
| F-07 | fact | standalone text は `Textbox` として描画され、`enableTextEditing()` で editable にされる。`text:changed` は現在 commit を呼ぶため、キー入力ごとに history snapshot になり得る。空文字除去も standalone `type: "text"` だけが対象である。 | `note-canvas-editor.tsx:167-184, 637-652`、`fabric-adapter.ts:304-315, 392-400` |
| F-08 | fact | 現行 history は document snapshot の内容比較で no-op を除外し、新規 commit 時に redo future を破棄する。DB や API の Undo ではない。 | `src/app/spikes/canvas/_lib/canvas-history.ts:15-53`、`MVP_CONTRACT.md` §2・§4 |
| F-09 | fact | repository は保存時に `validateCanvasDocument()`、`serializeCanvasDocument()`、`extractCanvasSearchText()` を通し、`searchText` を client payload から信頼せず再生成する。read repository は既存の `NotebookCanvas.searchText` を検索する。 | `src/server/notes/infrastructure/command.repository.ts:21-31`、`read.repository.ts:24-31` |
| F-10 | fact | `NotebookCanvas.documentJson` と `searchText` は既存の一対一保存領域で、page 寸法専用の DB column / migration は契約にない。 | `MVP_CONTRACT.md` §6.1・§8、`command.repository.ts:173-182` |
| F-11 | fact | current tool union は `select`, `pen`, `line`, `arrow`, `rect`, `ellipse`, `text`, `erase`。Cmd/Ctrl+Z と delete は Canvas viewport focus 時の client 操作で、text editing 中は現在の handler が shortcut を奪わない。 | `note-canvas-editor.tsx:311, 856-873`、`HANDOFF_2026-07-19.md` §6.4 |
| F-12 | unknown | 実ブラウザでの Fabric Group の rotated / non-uniform scaled Textbox、double-click timing、toolbar click による editing exit はこの task では未実施。runtime QA が必要。 | `HANDOFF_2026-07-19.md` §2.3・§7.1、現時点で実装変更なし |

## Decision: 推奨案

### 1. 保存表現は「図形要素に任意の inline text」を採用する

四角・円を、文字を内包できる一つの logical Canvas element とする。トップレベルの text element を追加したり、shape と text の親子関係を DB / JSON に持たせたりしない。

推奨する V1 の意味は次のとおり。

```ts
type CanvasTextStyleV1 = {
  fill?: string;
  fontSize?: number;
  fontFamily?: string;
};

// existing fields are abbreviated
type CanvasElementV1 = {
  id: string;
  type: "stroke" | "line" | "arrow" | "rect" | "ellipse" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  style: CanvasElementStyle; // shape stroke / fill, or existing standalone text style
  z: number;
  points?: CanvasPoint[]; // stroke / line / arrow only
  text?: string; // required for type=text; optional for rect / ellipse
  textStyle?: CanvasTextStyleV1; // rect / ellipse inline text only
};
```

例:

```json
{
  "id": "rect-1",
  "type": "rect",
  "x": 100,
  "y": 120,
  "width": 260,
  "height": 120,
  "rotation": 0,
  "style": {
    "stroke": "#2f5544",
    "fill": "#fff2df",
    "strokeWidth": 1
  },
  "text": "重要概念",
  "textStyle": {
    "fill": "#25302e",
    "fontSize": 12,
    "fontFamily": "Arial, sans-serif"
  },
  "z": 0
}
```

契約上の意味:

- `rect` / `ellipse` の `style.stroke`, `style.fill`, `style.strokeWidth` は図形専用にする。
- inline text の文字色・サイズ・フォントは `textStyle.fill`, `textStyle.fontSize`, `textStyle.fontFamily` に分離する。
- standalone `type: "text"` は既存どおり `text` + `style.fill/fontSize/fontFamily` を使う。既存 standalone text を inline text へ変換しない。
- inline text は plain text。Markdown、GFM、個別文字単位の rich text、段落リンクは対象外。
- `textStyle` がない既存 shape text は renderer が現行の text defaults（文字色 `#25302e`、font size は editor の current default、font family `Arial, sans-serif`）で表示し、既存 JSON に値を後付けして自動変換しない。
- 新しく文字を追加するときは、編集開始時に現在の `styleDefaultsRef.current.textColor` / `fontSize` を capture して `textStyle` に保存する。図形の fill を文字色の fallback に使わない。

空文字の canonical policy は、編集 UI が確定する際に次のようにする。

- `text.trim()` が空なら、その図形要素を残す。
- `text` と `textStyle` は要素から除去する（少なくとも検索・描画上は空文字として扱う）。
- shape だけの削除は行わず、空文字入力を top-level text element に変換しない。
- API validation は shape の `text: ""` を受け付けてもよいが、editor の commit は空の optional fields を出さない canonical form に寄せる。

### 2. schemaVersion 1 を維持する

この変更は既存 valid document へ optional field を加える additive extension であり、既存の `schemaVersion: 1` document はそのまま有効である。推奨判断は次のとおり。

- `CANVAS_SCHEMA_VERSION` は 1 のまま。
- `validateCanvasDocument()` は `rect` / `ellipse` の `text` と `textStyle` を明示的に読み取り、`serializeCanvasDocument()` / `restoreCanvasDocument()` が保持する。
- `text` / `textStyle` を `stroke` / `line` / `arrow` に付けた入力は shape inline text として解釈せず、field validation error にする。既存の valid document にはこれらの fields がないため後方互換性を壊さない。
- `type: "text"` の `text` 必須ルールは変更しない。
- old shape に `text` がない場合、restore 時に `text: ""` や `textStyle` を自動挿入しない。既存 JSON の意味と不要な byte 差分を維持する。
- `CanvasElementStyle` の existing font fields は standalone text の互換用に残す。shape inline text の新規 fields は `textStyle` を正本にする。

V2 へ上げる案は不採用とする。V2 にすると read dual support、stored `schemaVersion` 更新、migration / backfill、API error handling の追加が必要になるが、今回の optional field 追加では得られる安全性がない。

### 3. Fabric は runtime だけ複合化し、保存は flatten する

文字付き shape を Fabric で描画するときだけ、外側を一つの Fabric `Group` とする。

- Group の子は shape (`Rect` または `Ellipse`) と非編集用 `Textbox`。
- outer Group だけに `canvasElement` metadata（logical element の clone）を持たせる。
- child shape / child text には document element として扱う metadata を付けない。child text は `selectable: false`, `evented: false`、outer Group は `subTargetCheck: false` とする。
- `canvas.getObjects()` では Group が一つだけ見えるため、selection、move、resize、rotate、whole erase、z order は logical shape 一つとして扱う。
- text が空の shape は従来の単独 Rect / Ellipse を維持し、空の child Textbox を常設しない。
- `fabricDocumentToCanvas()` と viewer は同じ adapter を使うため、閲覧・再読込でも文字付き shape は同じ Group 表現で描画される。
- Fabric Group の raw JSON、child id、selection、camera、temporary editor は DB に保存しない。

### 4. 編集時だけ sibling Textbox を一時表示する

Group 内 child Textbox を直接 editing mode にするのではなく、ダブルクリック中だけ外側 Group を一時的に非表示にし、ページ座標へ置いた編集用 `Textbox` を sibling として追加する。Fabric の Group child editing / active selection の差異を保存経路へ持ち込まないためである。

`ShapeTextEditSession` に最低限次を保持する。

- owner shape id
- edit 開始時の shape document snapshot / current textStyle
- target outer Group または Rect / Ellipse
- temporary Textbox
- edit 中に変更した text と textStyle
- finalized flag

編集開始:

1. `mouse:dblclick` の handler が `toolRef.current === "select"` かつ target の logical type が `rect` または `ellipse` の場合だけ開始する。
2. target が preview、temporary editor、standalone text、stroke、line、arrow なら何もしない。
3. shape の current geometry を page 座標で capture する。
4. target を `visible:false`, `evented:false`, `selectable:false` にし、同じ `x/y/width/height/rotation` と text style で temporary Textbox を作る。
5. temporary Textbox に `isCanvasShapeTextEditor: true` を付け、`canvasElement` metadata は付けない。`editable:true` で `enterEditing()` する。
6. 既存 text は表示し、新規 text は空文字で編集を開始する。既存 text の選択範囲（全選択または caret 位置）は runtime 実装で一方に固定し、再現テストする。

編集中:

- `text:changed` は temporary Textbox の表示と parent form への pending document 通知だけを更新し、Canvas history は増やさない。
- `fabricCanvasToDocument()` が temporary Textbox を top-level text に誤変換しないよう、metadata 不在または `isCanvasShapeTextEditor` を除外する。
- toolbar の style controls を編集中に有効化する場合、color / font size は temporary Textbox と session の `textStyle` へ書き、shape `style.fill` / `style.stroke` へ書かない。図形選択中の通常の color / line width は shape style のままにする。
- edit 中に別 tool、Undo / Redo、Delete、page resize、保存が開始された場合は、まず pending session を finalize してから操作する。保存ボタンへ最新文字が渡らない race を残さない。
- 現行の standalone text editing と browser undo はこの session の shortcut path で上書きしない。shape text の history Undo は edit session の finalize 後に行う。

編集確定:

- `text:editing:exited`、canvas 外クリック、tool 切替、保存前 flush のいずれでも同じ finalize 処理を通す。
- temporary Textbox を除去し、target を表示へ戻す。
- `text.trim()` が空なら shape を残し、inline `text` / `textStyle` を除去する。
- 非空なら owner shape の `text` と `textStyle` を更新する。
- geometry / shape style は edit 開始時のものを勝手に戻さず、現在 canonical な shape geometry と合わせる。
- 内容、textStyle、または geometry に実質差分があるときだけ `commitRef` を一回呼ぶ。同じ内容で exit した場合は no-op history にしない。
- commit 後に canonical document を Fabric へ再描画し、temporary object、visibility、selection、scale が残らないようにする。

明示的な Escape cancel を追加する場合は、session 開始 snapshot に戻して history / parent saved value を変更しない処理に限定する。今回の必須受け入れ条件は、既存実装との競合が少ない「exit は commit、空文字は shape を残す」経路であり、Escape の挙動を追加する場合もその commit / cancel 判定を一つに固定する。

### 5. 移動・リサイズ・回転の正規化

文字付き shape の移動・リサイズ・回転は outer Group が子 shape と child Textbox を同時に transform する。保存時に Fabric transform を V1 の flat geometry へ焼き込む。

- move: outer Group の page `left/top` を shape の `x/y` へ反映する。
- resize: `base width/height × scaleX/scaleY` を shape の `width/height` へ反映し、page 外 clipping や自動移動はしない。
- rotate: outer Group の `angle` を shape の `rotation` へ反映する。rotated bounding rect を `x/y/width/height` として保存しない。
- shape style: child shape の `stroke`, `fill`, `strokeWidth` を読む。Group 自身の fill / stroke を正本にしない。
- inline text: child Textbox の文字列と text style を読む。child の z や id を top-level element にしない。
- scale の canonicalization 後は Group を scale 1 で再描画する。`textStyle.fontSize` は logical style 値として保持し、shape resize だけで font size を別の値へ上書きしない。新しい shape box 内で text box の width / height / center を再計算して追従させる。
- text は shape の local box に配置し、move / rotate では一緒に追従する。resize 後も shape 内の同じ local layout rule で表示し、save → reload で見た目がずれないことを受け入れ条件にする。
- Group でない既存 rect / ellipse についても `left/top`, `scaleX/scaleY`, `width/height`, `angle` を読む変換を共通 helper 化する。inline text task のついでに current F-05 を放置しない。

回転した shape の canonical `x/y` は既存の shape 表現と同じ「shape の transform origin / unrotated local box の左上」とする。`getBoundingRect()` の回転後外接矩形を直接保存する方法は採用しない。

### 6. searchText / 保存 / 復元

`extractCanvasSearchText()` を次の意味へ拡張する。

- `elements` を既存どおり z 昇順（同じ z は document 順）に並べる。
- `type: "text"` は既存どおり `element.text` を対象にする。
- `type: "rect" | "ellipse"` は `element.text` があり、trim 後に非空なら対象にする。
- stroke、line、arrow、空の shape は対象外。
- trim した値を newline で連結する既存の形式を維持する。

既存 API / DB 経路は変更しない。

- `POST /api/notes` / `PATCH /api/notes/:id` の top-level payload、route、status、error shape は変更しない。新しい fields は `canvas.elements[]` 内だけに現れる。
- `note.schema.ts` の `canvasDocumentSchema` は shared validator を呼んでいるため、shared validation の更新だけで API body validation に反映される。shape 以外の inline fields は field error にする。
- `command.repository.ts` は validated document を serialize し、server-side で shape text を含む searchText を再生成する。client が送る searchText は追加しない・信頼しない。
- `read.repository.ts` の `NotebookCanvas.searchText contains` はそのまま利用できる。
- `notes.mapper.ts` の `restoreCanvasDocument()` は新しい optional fields を保持して detail に返す。`schemaVersion` 一致チェックは維持する。
- page 寸法だけの変更では shape text / standalone text が変わらないため、searchText は変わらない。
- 既存の stored `searchText` に shape text がないことを理由に migration / backfill は行わない。現在の validator では shape text が保存前に drop されていたため、過去に失われた入力を復元する処理も作らない。

### 7. Undo / Redo / whole erase

- shape text edit は、入力中の各 key ではなく edit session の finalize ごとに最大一つの document snapshot を作る。
- text を変更して確定した後の Undo は shape の `text` / `textStyle` を前の値へ戻し、Redo は再適用する。
- 空 shape へ空文字を確定した場合は document 差分がなければ history entry を作らない。非空 text を消した場合は shape は残るが text fields が消えるため一つの Undo 対象になる。
- move / resize / rotate は既存の `object:modified` 一回を一つの snapshot とし、shape と文字を別々の history entry に分けない。
- whole erase の target は outer Group（空 shape は Rect / Ellipse）だけ。child Textbox を独立 object として消去しない。
- erase 中に temporary editor が残らないよう、tool 切替前に finalize する。erase が shape を削除した場合、searchText からその inline text も保存時に消える。
- erase gesture の同一 target 二重削除防止、hit があったときだけ一履歴、既存の 50 snapshot / redo future 破棄を維持する。

## Alternatives Considered

| 案 | 保存表現 | 長所 | 影響 / リスク | 判断 |
|---|---|---|---|---|
| A | rect / ellipse に optional `text`（推奨）と `textStyle` を持たせる。Fabric では必要時だけ Group / temporary Textbox | logical identity が一つ。shape move / erase / history / search が自然。既存 JSON に optional field を足すだけで DB 関係が増えない | adapter の Group projection、transform bake、editing session が必要。resize serializer は既存 F-05 も直す必要がある | **採用** |
| B | shape element と text element を別に保存し、`parentId` / `groupId` で結ぶ | 既存 text search をそのまま流用しやすい。文字を別スタイル要素として扱える | 親子 ID、z、orphan、group move / resize / rotate、erase、Undo の一貫性が必要。V1 の fields / validator / migration を広げる。親子なしでは追従を保証できない | 不採用 |
| C | Fabric Group / Fabric raw JSON をそのまま保存 | Fabric 上の見た目を保存しやすい | app-owned JSON との境界を壊し、library version / internal metadata / selection を DB へ持ち込む。Konva / viewer / API の portability も失う | 不採用 |
| D | shape に text を足すが、Fabric では shape と text を sibling のまま手動同期 | Group dependency を減らせる | move / resize / rotate / selection / erase の各 event で同期漏れが出やすい。保存時の parent identity がなく、再読込で再結合できない | 不採用 |

## Implementation Task Breakdown

### UI / editor

必須変更:

- `src/app/notes/_components/note-canvas-editor.tsx`
  - `mouse:dblclick` の select-only shape target guard。
  - `ShapeTextEditSession`、temporary Textbox の作成 / finalize、pending parent notification。
  - shape inline text の空文字 canonicalization。
  - temporary object を history / serialization / whole erase から除外。
  - text editing 中の key ごとの history commit を防止し、exit ごとに一つへまとめる。
  - tool switch、style、page resize、Undo / Redo、delete、form save の前に pending edit を flush。
  - shape move / resize / rotate 後の canonical adapter 再描画。
- `src/app/notes/_components/note-canvas-viewer.tsx`
  - adapter の Group 描画を read-only で表示。
  - assistive text / text list が standalone text と shape inline text の両方を列挙する。検索表示用の text 抽出と意味を合わせる。
- `src/app/notes/_components/note-canvas-toolbar.tsx`
  - inline text editing 中に既存の color / font size controls を使う場合、style target を text に切り替える。
  - shape を通常選択中は color / line width を shape style に限定する。
  - shape inline text の style control を今回対象外にする場合でも、disabled / target 表示が shape fill と混同しないことを確認する。
- `src/app/spikes/canvas/_components/fabric-canvas-panel.tsx`
  - 共通 adapter の Group / shape geometry serializer 変更による spike の create / move / resize / round-trip 回帰を確認する。shape double-click UI を spike に追加する必要はない。

### 共通契約 / adapter

- `src/shared/canvas/canvas-document.ts`
  - `CanvasTextStyleV1`（または同等の名前）を追加。
  - rect / ellipse だけの optional `text` / `textStyle` validation、serialize / restore 保持。
  - empty inline text の canonical helper または editor から呼ぶ normalization helper。
  - `extractCanvasSearchText()` を shape inline text 対応へ拡張。
  - schemaVersion 1、既定 page、既存 limits を維持。
- `src/app/spikes/canvas/_lib/fabric-adapter.ts`
  - text-bearing shape の Group renderer、shape child / text child の metadata と style routing。
  - temporary Textbox が canonical object にならない除外条件。
  - Group / non-Group の shape transform を page geometry へ焼き込む。
  - shape style と `textStyle` の read / write を分離し、rotation / resize / move 後の round-trip を固定。
  - existing arrow Group の処理と共通化する場合も、arrow / line / stroke の既存 points semantics を変更しない。
- `src/shared/canvas/index.ts`
  - 新しい public type / helper を追加した場合だけ export を確認する。
- `src/app/spikes/canvas/_lib/canvas-history.ts`
  - 原則変更不要。新しい shape fields が `cloneCanvasDocument()` と serialize 比較に含まれることを確認する。

### API / repository / docs

構造的な API / DB 変更は不要。実装時は次を確認し、必要な validation / docs の差分だけに限定する。

- `src/modules/notes/contracts/note.schema.ts`: shared validation error が `canvas` または `canvas.elements[index].text/textStyle` として返ることを確認する。new endpoint は追加しない。
- `src/server/notes/infrastructure/command.repository.ts`: `prepareCanvas()` が new fields を保持し、`searchText` を server-side 再生成することを確認する。repository の別保存列は追加しない。
- `src/server/notes/infrastructure/read.repository.ts`: existing `searchText contains` query で shape label が検索されることを確認する。query shape は変更しない。
- `src/server/notes/presenters/notes.mapper.ts`: restore / schemaVersion mismatch error を維持し、new fields が detail response に残ることを確認する。
- `src/app/api/notes/route.ts`、`src/app/api/notes/[id]/route.ts`: route、status、top-level request / response、error envelope は変更しない。
- `doc/implementation/MVP_CONTRACT.md` §6.1 / §8: rect / ellipse inline text、plain text、search、V1 additive extension、no migration を追記する。
- `doc/implementation/IMPLEMENTATION_STATUS.md`: static implementation と runtime QA を分けて記録する。
- `doc/testing/TEST_SCENARIOS.md`: shape text、empty、move / resize / rotate、search、erase、undo / redo、save / reload、tool matrix を追加する。

## Schema / DB / API Change Decision

| 対象 | 判断 | 内容 |
|---|---|---|
| `CanvasDocument.schemaVersion` | **変更不要** | V1 の optional additive field として `rect` / `ellipse` に `text` / `textStyle` を許可する |
| Prisma schema | **変更不要** | `NotebookCanvas.documentJson` に既存 JSON を保存する。新しい relation / column は作らない |
| Prisma migration | **不要** | shape label は JSON 内 field、search index は既存 `searchText` column を再生成する |
| `POST /api/notes` | **route 変更不要** | 同じ `canvas.elements[]` payload を受ける。shared validation が new fields を許可する |
| `PATCH /api/notes/:id` | **route 変更不要** | 同上。全体 document を既存 transaction で保存する |
| `GET /api/notes` | **query 変更不要** | existing `NotebookCanvas.searchText contains` を利用する |
| `GET /api/notes/:id` | **response shape 変更不要** | detail の `canvas` 内に optional fields が現れるだけ |
| DB backfill | **不要** | 既存 valid docs はそのまま。過去に validator で drop された shape text の復元は行わない |

## Acceptance Criteria for the Implementation Worker

### Contract / validation

1. `schemaVersion: 1`、`page` の既存契約、要素上限、point 上限、2 MiB 上限が変わらない。
2. 既存の text なし rect / ellipse document を validate → serialize → restore しても、shape の `x`, `y`, `width`, `height`, `rotation`, `style`, `z` が変わらない。optional `text` / `textStyle` を自動挿入しない。
3. rect / ellipse の non-empty plain text と `textStyle` が validate / serialize / restore で保持される。
4. shape の empty / whitespace-only text は validation でクラッシュせず、editor commit 後は shape が残り、inline text が検索・描画対象にならない。
5. `stroke` / `line` / `arrow` に inline text fields を付けた入力を shape text として保存しない。API は既存の JSON error envelope で拒否する。
6. standalone `type: "text"` の required `text` と既存 `style` semantics が変わらない。

### Fabric rendering / editing

7. non-empty rect / ellipse は通常表示で shape と文字が一体に見え、`canvas.getObjects()` 上は logical object 一つとして選択できる。text child は独立選択できない。
8. `select` tool で rect / ellipse をダブルクリックすると、その shape の既存 text が表示された editable Textbox へ入り、空 shape なら空欄から入力できる。
9. `pen`, `line`, `arrow`, `text`, `erase` を active にした状態のダブルクリックでは shape text edit session が開始しない。既存の blank drawing、standalone text、whole erase の操作が回帰しない。
10. shape text editing 中の key input は parent document を最新値へ通知できるが、キーごとに history snapshot を作らない。editing exit / explicit flush は最大一つの commit になる。
11. shape text を変更せずに exit した場合は no-op history を作らない。既存 text を空にした場合は shape を残し、text / textStyle だけを消す。
12. shape text の text color / font size は `textStyle` に入り、shape の `style.fill` / `style.stroke` を汚染しない。新規 inline text は編集開始時の current `textColor` / `fontSize` default を使用する。
13. shape を move / resize / rotate すると text が shape と同時に追従し、保存 document では一つの shape element の geometry / rotation / text / textStyle に投影される。
14. resize 後に Group scale を canonicalize して再描画しても text の相対配置が崩れず、save → reload / viewer で同じ shape label が表示される。`textStyle.fontSize` は shape resize だけで別値へ変わらない。
15. shape text の double-click / edit / exit は standalone `text` element を新規作成しない。既存 standalone text の edit / save / reload は従来どおり動く。

### Search / persistence / history / erase

16. `extractCanvasSearchText()` は z 順の standalone text と non-empty rect / ellipse text を両方 newline 連結し、stroke / line / arrow / empty shape を含めない。
17. shape text を含む document を POST / PATCH すると、repository が既存 `NotebookCanvas.documentJson` に保存し、`searchText` を server-side で再生成する。client が searchText を送らなくても正しい。
18. save → `GET /api/notes/:id` → editor / viewer reload 後に shape text、textStyle、shape style、page dimensions が復元される。schemaVersion mismatch / broken JSON の既存 error behavior は変わらない。
19. page width / height だけを変更しても shape text、standalone text、searchText、shape geometry が変わらない。
20. shape text を一覧 query で検索でき、empty shape label は検索できない。existing query parameter / OR tag / pagination behavior は変わらない。
21. shape text edit の確定後 Undo は text / textStyle を戻し、Redo は再適用する。新規 commit 後は existing redo future discard behavior を維持する。
22. whole erase は shape + inline text を一つの object として消し、同一 gesture で一つの history entry だけを作る。Undo / Redo と `searchText` 更新が成立する。

### Verification evidence

23. static checks after implementation: `npm run lint`, `npx tsc --noEmit --pretty false`, `npm run build`、必要なら `git diff --check` が成功する。build が生成する `.next` は既存運用に従い、差分扱いを確認する。
24. runtime checks in a browser at least cover `/notes/new` and an existing `bodyMode=canvas` note: select-only double-click, Japanese / multiline text, empty commit, move, resize, rotate, save / reload, viewer, list search, whole erase, Undo / Redo。
25. runtime tool matrix covers active `pen`, `line`, `arrow`, `text`, `erase`; each must prove that shape double-click editing is not accidentally entered and its existing action still works.
26. runtime viewport / scroll checks cover the existing 375 / 768 / 1280 / 1440 QA targets enough to prove the temporary Textbox does not create page-wide overflow or block page vertical scrolling.
27. API / persistence check verifies no Prisma schema or migration diff, no new endpoint, and `NotebookCanvas.searchText` is derived from the final document rather than client input.

## Risks and Remaining Unknowns

| ID | 種別 | 内容 | 対応 |
|---|---|---|---|
| R-01 | implementation risk | 現在の adapter は shape / standalone text の move / resize geometry を十分に投影していない。inline text だけを足すと、見た目は動いても reload で戻る。 | shape non-Group と Group の transform bake を同じ task で実装し、round-trip を必須にする |
| R-02 | implementation risk | Group 自身から style を読むと shape fill と text fill が混ざる。 | child shape / child text を明示的に識別し、style routing を分離する |
| R-03 | implementation risk | temporary Textbox が `canvas.getObjects()` に残ると、standalone text として保存・検索・erase される。 | `isCanvasShapeTextEditor` と metadata 不在を二重 guard にし、finalize / cleanup を idempotent にする |
| R-04 | implementation risk | parent form の明示保存が Fabric の editing exit より先に起きると、最後の文字が payload に入らない可能性がある。 | `text:changed` の pending projection または save 前 flush を実装し、form submit の runtime を確認する |
| R-05 | implementation risk | non-uniform resize と rotated Group の `left/top` / scale / bounding rect は Fabric の origin semantics に依存する。 | `getBoundingRect()` を canonical x/y に使わず、固定 fixture で move / scale / rotate の JSON と再描画を比較する |
| R-06 | compatibility risk | 現在 shape に付いた未知 `text` は validator が silently drop する。新仕様では shape text を保持するため、raw DB に存在する異常 JSON の扱いを決める必要がある。 | 既存 valid document は no-text とみなし、過去に drop された値の復元はしない。異常な非-shape inline fields は API error にする |
| R-07 | UX scope | inline text の既存文字を全選択して置換するか caret を double-click 位置へ置くかは Fabric の実際の editing UX に依存する。 | 実装時に一方へ固定し、受け入れシナリオへ記録する。保存契約・検索契約には影響しない |
| U-01 | unknown | Fabric 7.4.0 の Group で temporary sibling Textbox を表示・編集した際の Safari / touch pointer の event order は未確認。 | Chromium と対象環境で runtime QA、必要なら pointer capture / blur cleanup を追加 |
| U-02 | unknown | 現行 toolbar の style controls を shape text editing 中に有効化するかは UI 差分が増える。 | 推奨は有効化して text target を明示するが、最小実装では current defaults の snapshot だけでもよい。shape fill に文字色を保存しないことは必須 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 開始時 `git status --short` | PASS（確認済み） | 対象を含む既存未コミット変更を確認。`src/shared/canvas/canvas-document.ts` は dirty ではなく、`fabric-adapter.ts` と `note-canvas-editor.tsx` は既存変更を保持した |
| 最新 handoff / 関連 summary の確認 | PASS | `HANDOFF_2026-07-19.md` と直近 Canvas style / toolbar / erase summary を起点にした |
| 現行 source / contract / repository の静的照合 | PASS | 保存・検索・history・tool 分岐と既知の shape geometry gap を根拠行付きで整理した |
| コード・設定・依存関係・DB・生成物の変更 | なし | 制約どおり実装は行わず、summary だけを追加した |
| `npm run lint` / typecheck / build | 未実施 | 実装 task ではない。build による生成物変更を避け、実装後の必須検証として受け入れ条件へ記載した |
| Browser runtime | 未実施 | 現行 handoff の runtime 未確認状態を引き継ぐ。Fabric Group / pointer / save-reload は実装後に確認する |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-01 | Fabric Group + temporary Textbox の double-click / exit / touch event order | 実装後の Chromium runtime と必要な対象ブラウザ操作 |
| U-02 | Group resize / rotation の exact canonical transform と非均等 scale 後の text layout | 固定 fixture の before / after JSON、save-reload visual comparison |
| U-03 | toolbar style controls を shape text editing に公開する最終 UI | Manager が U-02 と合わせて runtime 見た目を確認。保存 schema は `textStyle` で固定 |
| U-04 | 既存 DB に異常な non-shape `text` / `textStyle` が残っているか | read-only DB fixture scan。発見しても自動修復・migration はせず、明示エラー方針を維持 |

## Next Read

後続 Worker は次の順で最小限を読む。

1. 本 summary（このファイル）
2. `doc/implementation/MVP_CONTRACT.md` §6.1・§8
3. `src/shared/canvas/canvas-document.ts`
4. `src/app/spikes/canvas/_lib/fabric-adapter.ts`
5. `src/app/notes/_components/note-canvas-editor.tsx`
6. `src/app/notes/_components/note-canvas-viewer.tsx`
7. `src/app/notes/_components/note-canvas-toolbar.tsx`
8. `src/server/notes/infrastructure/command.repository.ts` と `src/server/notes/infrastructure/read.repository.ts`

