# Architecture Refactor Audit

監査日: 2026-07-21（JST）

対象: src/app/notes/_components/**、src/app/spikes/canvas/**、
src/shared/canvas/**、src/app/globals.css、src/modules/notes/**、
src/server/notes/**、必要最小限の src/app/api/**、package.json、
tsconfig.json

この summary は、既存 summary / handoff の記述を実装根拠にせず、現在の
source と現在の作業ツリーを読み取った監査結果である。MVP の route、API、
保存、削除、復習、Canvas の受け入れ判断は doc/implementation/MVP_CONTRACT.md
を境界条件として参照した。

## 1. 結論

- import の直接循環は確認できなかった。ただし production の
  Note Canvas が src/app/spikes/canvas/_lib/fabric-adapter.ts と
  src/app/spikes/canvas/_lib/canvas-history.ts を直接 import している。
  これは spike が production に依存される逆方向の境界であり、最優先で直す。
- CanvasDocumentV1 は現在、型、初期値・demo fixture、geometry、validation、
  JSON serialize/restore、clone、search text 抽出を 1 ファイルに持つ。保存契約
  と renderer の都合は混ざっていないが、契約ファイルとしては責務が多い。
- Fabric adapter は Fabric の型境界、metadata、shape/text object factory、
  座標変換、Canvas への hydration、Canvas からの projection、style 更新を
  1 ファイルに持つ。Fabric 固有 object と保存用 JSON の境界は既に存在するが、
  ファイル内で近接しすぎており、mapper の変更が factory と lifecycle に波及しやすい。
- note-canvas-editor.tsx は React state、Fabric dynamic import、Fabric event
  binding、pointer gesture、history、style controls、用紙寸法、standalone text、
  shape inline text、erase、ARIA/render を全て担当する。ここは単純な行数分割では
  壊れやすいので、純粋関数、runtime/event binder、shape-text lifecycle、
  JSX composition の順に段階分割する。
- note-editor.tsx は form controller、保存・router、Cue list、Canvas/Markdown
  の分岐、title/date/source field、tag candidate fetch、tag editing を担当する。
  form state は 1 箇所に残し、controlled child へ分ける。
- globals.css は token/theme、app chrome、spike route、paper shell、note canvas、
  responsive override、create-only override を 1 global cascade に積んでいる。
  CSS Modules 化ではなく、現在の import 順を保った責務別 global CSS へ分けるのが安全。
- package.json には既に Fabric 7.4.0、Konva 10.3.0、Playwright、
  TypeScript/Next の構成がある。今回の分割に新しい依存は不要であり、
  tsconfig の @/* alias も変更不要。

### 作業ツリーの扱い

作業前に git status --short を確認した。既存変更には次が含まれる。

- CURRENT_STATUS.md、各 implementation/testing docs、queue script
- 現在の src/app/notes/_components/note-canvas-toolbar.tsx
- src/modules/notes/model/note-editor-form.ts
- src/shared/date/date-only.ts、src/shared/date/index.ts
- summary/20260721/ の既存 Worker summary 群

今回の変更はこの summary の追加だけに限定する。特に toolbar には、消しゴム
ラベル・ARIA・SVG icon・用紙 helper の未コミット変更があるため、将来の toolbar
分割 Worker はその作業ツリーを基準にし、base 版へ戻さない。

## 2. 現在の依存方向と不適切な境界

現状の主な流れは次のとおり。

    Next route / React UI
      ├─ modules/notes/model, remote
      ├─ shared/canvas
      └─ app/spikes/canvas/_lib/fabric-adapter  ← production から spike を参照

    API route
      ├─ modules/notes/contracts
      └─ server/notes/application
           ├─ server/notes/infrastructure → Prisma
           └─ server/notes/presenters → shared/canvas restore

目標の方向は次の形にする。

    note route / UI
      ├─ notes form/detail controller
      └─ canvas interaction controller
           ├─ CanvasDocumentV1 / canvas history（plain data・shared）
           └─ renderer port
                └─ Fabric adapter → dynamic Fabric runtime

    API route
      ├─ notes contracts（入力の形と validation）
      └─ notes application
           ├─ notes repository / mapper
           └─ Prisma infrastructure

原則は以下とする。

1. CanvasDocumentV1 は plain serializable data だけを知る。HTMLElement、
   FabricObject、Fabric event、hidden textarea、selection、preview、history を
   import も保存もしない。
2. Fabric adapter は CanvasDocumentV1 を import してよいが、React、Next route、
   NoteEditor、Prisma、API response を import しない。
3. React UI は adapter の内部 metadata を直接扱わず、Canvas interaction/runtime
   の公開 interface を通す。adapter の FabricMetadata、isCanvasPreview、
   isCanvasShapeTextEditor は adapter 内部に閉じ込める。
4. API route は薄いままにし、tag route も含めて Prisma を直接呼ばず
   server/notes/application または notes infrastructure の公開関数を呼ぶ。
5. bodyMode=canvas の保存は既存の NotebookCanvas.documentJson と
   searchText を使い続ける。Fabric の native JSON を新しい保存形式にしない。

### 既存の public export

| ファイル | 現在の export / 公開責務 |
| --- | --- |
| note-canvas-editor.tsx | NoteCanvasEditor |
| note-canvas-toolbar.tsx | CanvasNoteTool、style limits/defaults、CanvasStyleTarget、CanvasStyleControlValues、CanvasStyleChange、NoteCanvasToolbar |
| note-editor.tsx | NoteEditorSavedNote、NoteEditor |
| fabric-adapter.ts | FabricEventLike、FabricObjectLike、FabricCanvasLike、FabricApiLike、style/target/object/document conversion functions |
| fabric-canvas-panel.tsx | FabricCanvasPanel |
| konva-canvas-panel.tsx | KonvaCanvasPanel |
| canvas-document.ts | Canvas constants/types/error、factory、validation、serialization、search functions |
| shared/canvas/index.ts | shared Canvas の公開入口 |
| contracts/index.ts、model/index.ts、server 各 index.ts | 各 layer の意図された公開入口 |

分割後も、既存の import を一度に全て書き換えられない場合は、上記の入口だけを
互換 facade として維持する。各新規内部ファイルに機械的な barrel を増やさない。

## 3. 大ファイル責務監査と分割候補

### 3.1 src/app/notes/_components/note-canvas-editor.tsx（1694 行）

#### 現在の責務

- 1〜186 行: props、pointer/drag/erase/shape-text session の型、style default、
  tool と document の補助型・定数。
- 191〜504 行: Fabric object metadata の読み取り、selected style の読み取りと
  style 更新、shape text の置換、drawing target 判定、pointer 座標、dragged
  element 生成。
- 504〜631 行: initial document の clone/error、Fabric/DOM refs、history ref と
  React state、通知・error・用紙寸法・preview・commit。
- 634〜1334 行: Fabric の dynamic import、Canvas 初期化・hydration・dispose、
  shape inline text の開始/確定/取消/hidden textarea cleanup、mouse/path/text/
  selection event の bind/unbind。
- 1343〜1636 行: tool effect、Undo/Redo、style input の対象別反映、active object
  削除、page dimensions、keyboard shortcut、toolbar への値の計算。
- 1638〜1694 行: toolbar、error、viewport、horizontal scroll、canvas surface、
  assistive text の JSX。

#### 分割候補と interface

| 候補 | 主な責務 | 公開 interface の案 |
| --- | --- | --- |
| src/app/notes/_lib/canvas-editor-contract.ts | production editor 専用の tool/style contract。toolbar から UI 型を逆 import させない | CanvasNoteTool、CanvasStyleTarget、CanvasStyleControlValues、CanvasStyleChange、limits/defaults |
| src/app/notes/_lib/canvas-editor-geometry.ts | Point、page clamp、pointer→page 座標、4px threshold、drag element 生成 | pointFromCanvasPointer、createDraggedElement、DRAW_DRAG_THRESHOLD |
| src/app/notes/_lib/canvas-editor-style.ts | Fabric selection から style を読む、選択 object/standalone text/style default を更新する純粋な判断 | SelectedCanvasStyle、readSelectedCanvasStyle、getDrawingStyleTarget、style validation |
| src/app/notes/_lib/shape-text-editor-session.ts | shape text の owner/editor state、確定/取消、detached editor cleanup、Escape/blur | createShapeTextEditorController(deps) が start、flush、cancel、finishFromPointer を返す |
| src/app/notes/_lib/use-note-canvas-runtime.ts | dynamic Fabric import、Canvas dimensions、document apply、event bind/unbind、dispose | useNoteCanvasRuntime({ ... }) が canvasElementRef、canvasRef、ready、error、applyDocument を提供 |
| note-canvas-editor.tsx | state の所有、runtime/controller の接続、toolbar と viewport の composition | 現行 NoteCanvasEditorProps と NoteCanvasEditor を維持 |

shape-text-editor-session.ts と runtime/event binder は、密結合な state machine
なので 150〜200 行を少し超えてもよい。handlers を単純に複数ファイルへ分散すると
stale closure と cleanup 漏れが起きるため、まず factory/controller 1 個として切り出す。

#### 主要リスク

- historyRef が authoritative state、React の history が render mirror、
  Fabric objects が ephemeral projection の三層になっている。新しい hook で二重の
  history を作らない。
- effect 内の handler は historyRef、toolRef、style/session refs を読む。
  callback 化や dependency 追加で Fabric listener が再 bind されると、二重 commit
  や stale state が起きる。
- Fabric 7 の mouse:down:before → mouse:down 順序、onDeselect guard、
  attached editor の exitEditing、detached editor の textarea cleanup は一体で
  保つ。
- path:created は Fabric 7 では event.path が authoritative であり、
  event.target 前提へ戻さない。
- line / arrow / stroke の page/local/group 座標変換、shape の textStyle、
  standalone text の style を別責務へ移す際に geometry を変えない。
- whole erase は一 gesture 一 history、4px 未満の line/shape gesture は no-op、
  preview/unknown metadata/inline editor は drawing target 外という契約を維持する。

### 3.2 src/app/notes/_components/note-canvas-toolbar.tsx（890 行）

#### 現在の責務

- 1〜223 行: tool union、style constants/types、icon/config、tool groups。
- 224〜329 行: 全 SVG icon の renderer。
- 337〜487 行: page dimension validation、style integer input の uncontrolled/
  local state、blur/Enter commit。
- 489〜890 行: tool group、style controls、history actions、details による
  page size controls、ARIA/tooltip/status の JSX。

#### 分割候補と interface

- note-canvas-toolbar-config.ts（約150〜200行）:
  ToolbarIconName、ToolDefinition、ToolGroupDefinition、
  TEXT_ALIGNMENT_OPTIONS、TOOL_GROUPS、style limits/defaults。
- note-canvas-toolbar-icon.tsx（約100〜140行）:
  ToolbarIcon({ name })。ToolbarIconName のみを受け、state を持たない。
- note-canvas-tool-group.tsx（約120〜170行）:
  ToolGroup props は group、activeTool、onToolChange、
  showTooltip、id prefix。現在の aria-pressed、aria-describedby、
  title、visible label を維持。
- note-canvas-style-controls.tsx（約170〜220行）:
  styleTarget、styleValues、onStyleChange を受け、integer input の
  local text と blur/Enter commit、alignment controls を所有。
- note-canvas-paper-size.tsx（約150〜200行）:
  pageDimensions と onPageDimensionsChange を受け、幅/高さの validation、
  pageKey remount、details/mobile collapse を所有。
- note-canvas-toolbar.tsx（約150〜200行）:
  group の配置、history buttons、paper/style/tool child composition、
  current tool status のみを担当。現行 NoteCanvasToolbarProps を維持。

style/tool の型を contract file へ移す場合、旧 toolbar から一時再 export する
compatibility facade は許容する。現在の未コミット erase 表記と icon を、そのまま
分割後の config/icon へ移す。用紙入力の defaultValue と key=pageKey、
Fabric hidden textarea が blur しないための onMouseDown preventDefault は変更しない。

### 3.3 src/app/notes/_components/note-editor.tsx（704 行）

#### 現在の責務

- 1〜145 行: create/edit の form 初期化、form state、保存/更新 remote call、
  field error/message/canvas error、router 遷移。
- 147〜430 行: paper shell の title/meta、source selector、tag input、Cue list、
  Canvas/legacy Markdown 本文、Summary、next review/footer の大きな JSX。
- 441〜533 行: TitleInput と TextInput の field primitives。
- 535〜704 行: TagInput、tag candidate fetch、12件/重複/empty の local validation、
  add/remove UI。

#### 分割候補と interface

- use-note-editor-controller.ts:
  form、saving、messages/errors、updateForm、Cue add/update/remove、
  handleCanvasDocumentChange、save を返す。form state はここだけが所有する。
- note-editor-fields.tsx:
  TitleInputProps と TextInputProps。field error の id/ARIA を変えない。
- note-cue-editor.tsx:
  cues、fieldErrors、onAdd、onUpdate、onRemove を受ける controlled list。
  order 再計算は controller または model の一箇所だけに置く。
- note-tag-input.tsx:
  現在の TagInputProps を公開し、candidate fetch はこの component 内または
  use-tag-options.ts に閉じる。form の tags state を local copy しない。
- note-editor-paper.tsx（必要なら）:
  header/meta、Cornell body、summary/footer の composition。save/router は持たない。
- main NoteEditor:
  controller と section components の接続だけを残し、NoteEditorSavedNote、
  NoteEditor の公開 shape を維持する。

save は create/edit の API shape、router.push("/notes/:id")、
edit success の onSaved、NotesRemoteError.fieldErrors、Canvas clone/error
境界を維持する。新規の nextReviewDate = noteDate + 7日 は現在の未コミット
model変更の責務であり、refactor Worker へ混ぜない。

### 3.4 src/app/spikes/canvas/_lib/fabric-adapter.ts（695 行）

#### 現在の責務

- 1〜99 行: Fabric-like event/object/canvas/API の structural types、
  FabricStyleChange。
- 112〜224 行: Fabric defaults、style setter、metadata attach、shape owner/target。
- 244〜346 行: shape child、shape text group、inline editor の factory。
- 347〜513 行: stroke/line/arrow/rect/ellipse/text の Fabric object factory、
  app-owned metadata attach。
- 514〜530 行: CanvasDocumentV1 → Fabric Canvas hydration。
- 532〜676 行: Fabric object → Canvas element projection、point transform、
  dimensions 読み取り。
- 676〜695 行: fabricCanvasToDocument。

#### 分割候補と interface

- src/shared/canvas/adapters/fabric/fabric-types.ts:
  FabricEventLike、FabricObjectLike、FabricCanvasLike、
  FabricApiLike、FabricStyleChange。Fabric package の concrete import は
  dynamic client runtime に残す。
- fabric-metadata.ts:
  FabricMetadata、metadata attach/read、group owner resolution、
  resolveFabricShapeTarget。metadata は private export にする。
- fabric-style.ts:
  applyFabricObjectStyle と arrow head 同期。
- fabric-shape-factory.ts:
  shape options、shape text group、createFabricShapeTextEditor。
- fabric-object-factory.ts:
  stroke/line/arrow/rect/ellipse/text の createFabricObject。
- fabric-document-to-canvas.ts:
  fabricDocumentToCanvas と Canvas clear/dimensions/render。
- fabric-canvas-to-document.ts:
  fabricCanvasToDocument、object projection、point/arrow transform、
  page dimensions。mapper の base metadata と scale/rotation は同じ責務内に置く。

移行後の公開 interface は少なくとも次を維持する。

    applyFabricObjectStyle(object, elementType, change)
    createFabricObject(fabric, element)
    createFabricShapeTextEditor(fabric, element)
    resolveFabricShapeTarget(event)
    fabricDocumentToCanvas(canvas, fabric, document)
    fabricCanvasToDocument(canvas, pageDimensions?)

CanvasDocumentV1 と Fabric object は同型化しない。Fabric の canvasElement
metadata、baseLeft/baseTop、group child、preview/editor flags は projection の
内部情報であり、save payload と searchText に混入させない。

### 3.5 src/app/spikes/canvas/_components/fabric-canvas-panel.tsx（578 行）

#### 現在の責務

- fixture clone、Fabric/DOM refs、tool/text/zoom/fitScale、history、round-trip state。
- ResizeObserver による Fit scale と CSS surface sizing。
- Fabric dynamic import、Canvas init/dispose、fixture hydration。
- mouse/path/object modified の spike gesture、preview、delete、history commit。
- Undo/Redo、Delete、round-trip save/restore、fixture reset、keyboard shortcut。
- spike toolbar、Canvas viewport、projection metadata の JSX。

#### 分割候補

- use-fabric-spike-runtime.ts: dynamic Fabric init、apply、dispose、
  event bind/unbind。公開は canvasRef、fabricRef、ready、applyDocument。
- fabric-spike-gestures.ts: spike 固有の mouse/path handlers と preview。
  production editor の shape-text/whole-erase semantics と共有しない。
- use-canvas-spike-history.ts または既存 shared history:
  round-trip/reset/history の state。Fabric/Konva 共通化は serializable document
  state だけに限定する。
- canvas-spike-panel-frame.tsx: heading、toolbar slot、viewport slot、
  metadata slot の UI。両 engine に同じ DOM/CSS を適用する場合だけ検討。
- panel 本体: runtime と spike toolbar を接続する composition。

これは隔離された比較画面であり、Fit/50/100/200% は production MVP の用紙寸法
契約へ持ち込まない。spike の挙動不足（現行の target 制限や drag threshold など）
を refactor task で修正しない。

### 3.6 src/app/spikes/canvas/_components/konva-canvas-panel.tsx（621 行）

#### 現在の責務

- Konva stage/layer/transformer/container refs、tool/text/zoom/fitScale、selection、
  history、round-trip state。
- ResizeObserver、Konva dynamic import、stage/layer/transformer の init/dispose。
- pointerdown/move/up、click/tap、dragend/transformend、preview、selection。
- Undo/Redo、selected delete、round-trip save/restore、reset、keyboard shortcut。
- spike toolbar、viewport、Konva container、projection metadata の JSX。

#### 分割候補

- use-konva-spike-runtime.ts: Stage/Layer/Transformer init/dispose、apply、
  resize、handler cleanup。
- konva-spike-gestures.ts: pointer/selection/transform/preview handlers。
- konva-adapter.ts（315行）も同時に、konva-types.ts、
  konva-node-factory.ts、konva-document-mapper.ts へ分ける候補。
- panel 本体は state/controller と JSX composition のみにする。

Fabric と Konva は同じ app contract へ投影する比較対象だが、event semantics、
selection、transformer、grouping は異なる。handler を汎用化して 2 engine の
差を隠さない。共通化するのは document fixture、history snapshot、spike frame
のように挙動差がないものだけにする。

### 3.7 src/shared/canvas/canvas-document.ts（552 行）

#### 現在の責務

- 1〜98 行: schema version、page constants、limits、element/style/document types、
  validation error。
- 99〜255 行: ID、bounds、empty/demo document。
- 256〜405 行: record/number/string/style/points/serialized-size の validation helper。
- 406〜514 行: document 全体の schema/element/point/size validation。
- 515〜552 行: serialize、restore、clone、searchText、byte display。

#### 分割候補と維持する contract

- canvas-document-types.ts: types、constants、CanvasDocumentValidationError。
- canvas-geometry.ts: getElementBounds と point geometry。
- canvas-document-defaults.ts: createEmptyCanvasDocument、
  createDemoCanvasDocument、default style/page。
- canvas-document-validation.ts: validateCanvasDocument と validation helpers。
- canvas-document-serialization.ts: serializeCanvasDocument、
  restoreCanvasDocument、cloneCanvasDocument、serialized byte limit。
- canvas-document-search.ts: extractCanvasSearchText、
  formatDocumentBytes。
- src/shared/canvas/index.ts: 外部向けの明示的な facade。既存の
  @/shared/canvas import を維持する。

次の不変条件は分割後も exact に維持する。

- schema version 1、page background paper、page dimensions 320〜4000。
- 最大 1000 elements、stroke points 合計 20000、serialized 2 MiB。
- shape の text/textStyle と standalone text の style の分離。
- point element の points、positive dimensions、未知 field/version の拒否。
- searchText は z 順の text/rect/ellipse の text のみで、page resize では変えない。
- restore/clone は validation を通し、要素を page 内へ clip/move/scale しない。

型/schema と validation は、無理に 150〜200 行へ切って型の重複や invalid state
を作るくらいなら contract file を 220〜300 行で保つ。公開 facade が
「何でも再 export」になるのではなく、既存の Canvas contract を一つに保つための
入口であることが条件。

### 3.8 src/app/globals.css（1693 行）

#### 現在の cascade layer

- 1〜231 行: Tailwind import、root variables、@theme、body、app chrome、
  app main。
- 232〜656 行: Fabric/Konva spike page、toolbar、engine panel、viewport、
  responsive。canvas-spike-page の同じ rule が 2 回ある。
- 657〜982 行: paper shell、header/meta、Cornell grid、Cue、footer、create
  paper override の前半。
- 983〜1496 行: note canvas toolbar、tool group、style、paper size、tooltip、
  focus、ARIA hidden。
- 1497〜1676 行: toolbar responsive、canvas viewport/horizontal scroll、
  Fabric DOM sizing、error/assistive text。
- 1677〜1693 行: create-only final overrides。base rule より後ろにあることが
  cascade 上重要。

#### 分割候補

- src/app/styles/tokens.css: :root variables と @theme。
- src/app/styles/base.css: box-sizing、body、app main の基礎。
- src/app/styles/chrome.css: app chrome/navigation/state badge。
- src/app/styles/spike-canvas.css: canvas-spike-* 全 selector とその media。
- src/app/styles/note-paper.css: paper shell、Cornell、field/footer、
  create sheet。
- src/app/styles/note-canvas.css: canvas editor/viewer、toolbar、paper size、
  canvas viewport、canvas responsive。
- globals.css: Tailwind import と上記の順序を明示する import entry。

CSS Modules に移すと、現在の server/client component と Fabric が生成する
.canvas-container、.upper-canvas の selector 境界を壊しやすい。global class
のまま、token → base/chrome → spike/paper → canvas → create final override の
順を固定する。note-canvas-style-field、create section override などの重複は
visual equivalence を確認できる CSS-only Worker の範囲で整理し、見た目変更を
同じ task に混ぜない。

## 4. 対象内の中規模ファイルと周辺境界

| ファイル | 監査結果 / 分割方針 |
| --- | --- |
| note-canvas-viewer.tsx（182行） | Fabric dynamic init、DOM dimensions、read-only projection、assistive text。adapter 移動後に CanvasSurface または read-only useFabricCanvasMount を検討する。viewer に history/editor state を持たせない。 |
| canvas-history.ts（55行） | production が spike path から import している。shared canvas の canvas-history.ts へ移し、CanvasHistoryState、create/push/undo/redo、最大50 snapshot の意味を維持する。 |
| konva-adapter.ts（315行） | Konva structural types、metadata、node factory、layer hydration、node projection を混在。Konva panel Worker の対象に含める。 |
| note-detail-modes.tsx（441行） | view/edit/review mode controller、review/delete remote call、detail JSX を混在。use-note-detail-controller、metadata/Cue、review panel、actions へ分ける候補。レビュー順序と物理削除確認は維持。 |
| notes-list.tsx（420行） | filter/date/tag loading、notes loading、result/pagination JSX を混在。use-notes-list-query、filter form、result list、pagination へ分ける候補。query/tag/from/to/reviewDue の API shape は変えない。 |
| note.schema.ts（224行） | write schema、Canvas validation、list query、review schema を混在。note-write.schema.ts、note-query.schema.ts、note-review.schema.ts へ分け、contracts/index.ts の export を互換入口にする。 |
| note-editor-form.ts（168行） | form type、初期値、Cue normalize、field error、payload mapping を混在。UI split と別の model Worker で types/defaults/payload を分ける。現在の未コミット next review/date 変更を保持する。 |
| remote/index.ts（216行） | DTO、API error、query builder、request helper、notes/tags/review CRUD を混在。notes-types、notes-http、notes-query、resource functions へ分ける。server page の baseUrl/cache と client 404 handling を維持。 |
| command.repository.ts（233行） | canvas preparation、tag upsert/link、create/update/delete/review、detail fetch を同居。transaction を壊さない範囲で canvas persistence、tag link、notebook command、review に分ける。 |
| read.repository.ts（92行） | where builder と list/detail query を同居。pure buildNotesWhere と read repository を分ける候補。 |
| notes.mapper.ts（119行） | Prisma payload type、date/tag format、list/detail/review mapping を同居。response field を変えず list/detail/review mapper へ分ける。 |
| src/app/api/tags/route.ts | 現在唯一、route が Prisma を直接呼んでいる。listTagOptions を server notes application/infrastructure に置く境界修正を別 task にする。response は名前昇順の 200 [] を維持。 |

src/app/spikes/canvas/_lib/canvas-document.ts は shared document の一行 re-export
であり、第二の保存契約にしない。adapter/history の移動後に削除するか、移行期間
だけ明示的な deprecated forwarding path として残す。

## 5. 変更リスクの優先度

### P0: 先に characterization が必要

- CanvasDocumentV1 の JSON serialize/restore/clone、validation error、searchText。
- Fabric CanvasDocumentV1 ↔ Fabric object の line/arrow/stroke coordinate、
  resize、rotation、shape text/standalone text style。
- NotebookCanvas.documentJson、schemaVersion、searchText の POST/PATCH/GET
  境界。
- 新規 note の Canvas default、既存 markdown mode、MVP route/API response。

### P1: 分割時に lifecycle を壊しやすい

- React effect の dynamic import、dispose、listener bind/unbind、dependency。
- mouse:down:before、mouse:down、mouse:dblclick、path:created、
  text:changed、text:editing:exited の順序。
- shape inline text の hidden textarea、attached/detached editor、Escape/blur、
  外形表示、cancel/commit。
- history ref/React state/Fabric projection の二重化防止。
- preview/erase session の object identity と一 gesture 一 snapshot。

### P1: cascade/client-server

- globals.css の selector order、create-only final overrides、640/900/1099px
  breakpoints、.canvas-container/.upper-canvas。
- use client component と server page の境界。Fabric/Konva の concrete package
  を server bundle に静的に持ち込まない。
- API route の status/error body、Prisma transaction、mapper の null/format。

## 6. 実装順と Worker task の切り出し

各 task は「移動・分割で behavior を変えない」を基本目的にし、仕様変更・UI
redesign・Phase 2 機能を混ぜない。150〜200 行は目安で、下記の完了条件を優先する。

### Phase 1: 不変条件と共有契約

#### CANVAS-REF-01: Canvas/API characterization

- 対象: 現行 source、MVP contract、既存 Playwright/manual runtime fixture。
- 完了条件: CanvasDocumentV1 の代表 fixture（empty、stroke、line、arrow、
  rect/ellipse text、standalone text、境界外 element、resize）と、notes API の
  bodyMode/canvas/searchText/物理削除の確認項目を固定する。コード・schema・migration
  を変更しない。
- 検証: rg による public export/import inventory、npm run lint、
  npx tsc --noEmit --pretty false、npm run build。browser runtime は未確認と
  明記し、確認できた項目だけ証跡化する。
- 依存: なし。

#### CANVAS-REF-02: CanvasDocumentV1 semantic split

- 対象: src/shared/canvas/canvas-document.ts、新しい shared canvas contract files、
  src/shared/canvas/index.ts、spike の一行 re-export。
- 完了条件: 既存 export と validation/serialization/searchText の結果が変わらず、
  @/shared/canvas が唯一の公開入口になる。新しい DB column、migration、API field
  を追加しない。
- 検証: contract fixture の serialize→restore→clone、limits、shape text style、
  searchText、npm run lint、型検査、build、diff check。
- 依存: REF-01。

#### CANVAS-REF-03: Canvas history boundary relocation

- 対象: src/app/spikes/canvas/_lib/canvas-history.ts、production editor、
  Fabric/Konva spike consumers、新 shared history file。
- 完了条件: CanvasHistoryState と create/push/undo/redo、最大50 snapshot、
  serialize equality による no-op 判定を変えず、production source が app/spikes
  から history を import しない。
- 検証: import scan、Undo/Redo static/manual smoke、lint、型検査、build。
- 依存: REF-02。

### Phase 2: notes module と server boundary

#### NOTES-REF-04: notes contracts/model/remote semantic split

- 対象: src/modules/notes/contracts/note.schema.ts、
  contracts/index.ts、model/note-editor-form.ts、model/index.ts、
  remote/index.ts。
- 完了条件: write/query/review schema、form defaults/payload、remote DTO/request
  を意味単位へ分ける。既存 exports、MVP body shape、field error path、query key、
  fetchNoteDetail の server baseUrl/cache、404 handling を維持する。
- 検証: schema representative inputs、API route type check、lint、型検査、build。
  未コミットの date/nextReview 変更を差分に含めない。
- 依存: REF-02。

#### NOTES-REF-05: notes repository/presenter split

- 対象: server/notes/application/**、infrastructure/command.repository.ts、
  read.repository.ts、presenters/notes.mapper.ts。
- 完了条件: canvas prepare/searchText、tag upsert/link、Cue/tag全置換、
  Notebook/NotebookCanvas transaction、physical delete、review update、
  list/detail response mapping の意味を変えない。各公開 service function を維持。
- 検証: Prisma schema/migration diff が空であること、repository/mapper import scan、
  existing API smoke、lint、型検査、build。DB transaction を分割して partial save
  を作らない。
- 依存: REF-02、REF-04。

#### NOTES-REF-06: tags route application boundary

- 対象: src/app/api/tags/route.ts と notes server の tag read function。
- 完了条件: route から Prisma direct import をなくし、GET /api/tags の
  200 [{id,name,color}]、name 昇順、空配列、500 error shape を維持する。
- 検証: route static import scan、API smoke、lint、型検査、build。
- 依存: REF-05。

### Phase 3: Fabric adapter boundary

#### CANVAS-REF-07: Fabric adapter out of spike path

- 対象: src/app/spikes/canvas/_lib/fabric-adapter.ts、production editor/viewer、
  Fabric spike panel、new src/shared/canvas/adapters/fabric/**。
- 完了条件: production が app/spikes を参照しない。Fabric adapter は shared
  contract と renderer structural types だけを参照し、React/Next/Prisma/API を
  参照しない。old path は必要な場合のみ短期 compatibility forwarding とする。
- 検証: rg で production→spikes import がないこと、dynamic Fabric import の
  client boundary、lint、型検査、build。
- 依存: REF-02、REF-03。

#### CANVAS-REF-08: Fabric adapter factory/mapper split

- 対象: new Fabric adapter files（types、metadata、style、shape factory、object
  factory、document mappers）。
- 完了条件: createFabricObject、createFabricShapeTextEditor、
  resolveFabricShapeTarget、fabricDocumentToCanvas、
  fabricCanvasToDocument、applyFabricObjectStyle の公開 behavior を維持する。
  app-owned JSON と Fabric private object を混ぜない。
- 検証: line/arrow/stroke page coordinate、shape resize/rotation、inline text、
  style（style vs textStyle）、preview/editor exclusion、round-trip fixture、
  lint、型検査、build。
- 依存: REF-07。

### Phase 4: production Canvas UI

#### CANVAS-REF-09: toolbar decomposition

- 対象: note-canvas-toolbar.tsx と config/icon/tool-group/style/paper candidate files。
- 完了条件: main toolbar が composition 中心になり、tool active state、ARIA、
  tooltip、style input の live/blur commit、paper dimension validation、history、
  current tool status を変えない。現在の未コミット erase label/icon を保持。
- 検証: toolbar visual/ARIA smoke、640/900/1099 breakpoint、keyboard focus、
  page input Enter/blur、npm run lint、型検査、build。
- 依存: REF-07（neutral adapter boundary を確定）、REF-03。

#### CANVAS-REF-10: NoteCanvasEditor pure helper extraction

- 対象: note-canvas-editor.tsx と canvas-editor-contract.ts、
  geometry/style helper files。
- 完了条件: JSX component から pure validation、style read/target、
  pointer geometry、drag element、empty text filtering を外す。新 helper は Fabric
  object factory内部へ save metadataを追加しない。main file は目安200〜250行。
- 検証: 4px threshold、page resize が element geometry/style/text/searchText を
  変えないこと、whole erase/history no-op、lint、型検査、build。
- 依存: REF-08、REF-09。

#### CANVAS-REF-11: Fabric runtime and shape-text lifecycle isolation

- 対象: note-canvas-editor.tsx、use-note-canvas-runtime.ts、
  shape-text-editor-session.ts、必要な Fabric adapter interfaces。
- 完了条件: dynamic import、listener bind/unbind、dispose が一箇所で対になり、
  shape text の attached exit/detached cleanup、Escape/blur、cancel/commit、
  shape outline visibility、other elements retention を変えない。新しい history/
  document state を作らない。
- 検証: CANVAS-INTERACTION-001、CANVAS-GESTURE-001、
  CANVAS-SHAPE-TEXT-001、CANVAS-PERSISTENCE-STYLE-001、console error、
  lint、型検査、build。browser runtime 未確認なら完了扱いにしない。
- 依存: REF-10。

#### CANVAS-REF-12: viewer/editor Canvas surface reuse

- 対象: note-canvas-viewer.tsx、editor viewport code、新 read-only surface/
  Fabric mount helper。
- 完了条件: DOM sizing、horizontal scroll、page dimension、accessible text の共通
  部分だけを共有し、viewer は selection/history/editing を持たない。editor と viewer
  の CanvasDocumentV1 hydration/invalid data error semantics を維持する。
- 検証: viewer/edit route static build、1200x800/variable page、read-only object
  flags、scroll/focus manual smoke、lint、型検査、build。
- 依存: REF-08、REF-11。

### Phase 5: note UI composition

#### NOTES-REF-13: NoteEditor controlled section split

- 対象: note-editor.tsx、新 controller/fields/Cue/tag components。
- 完了条件: form state が 1 owner のまま、create/edit save、router transition、
  field errors、Canvas/Markdown branch、Cue order、tag 12件/duplicate/candidate
  loading が変わらない。main は section composition にする。
- 検証: create→Canvas edit→save→detail、existing markdown edit、
  invalid title/date/tag/canvas、tag fetch failure、lint、型検査、build。
- 依存: REF-04、REF-09、REF-12。

#### NOTES-REF-14: detail/list controller split

- 対象: note-detail-modes.tsx、notes-list.tsx と新 controller/view files。
- 完了条件: detail view/edit/review state、Cue→body→Summary review order、
  confirm physical delete、review API、list query/date/tag/reviewDue/pagination の
  response shape を変えない。Canvas UI refactor と list feature change を混ぜない。
- 検証: /notes、/notes/new、/notes/[id] の route smoke、review/delete API、
  list filters、lint、型検査、build。
- 依存: REF-05、REF-06、REF-12、REF-13。

### Phase 6: spike isolation

#### SPIKE-REF-15: Fabric spike panel decomposition

- 対象: fabric-canvas-panel.tsx、spike runtime/gesture/frame candidate files、
  canvas-toolbar.tsx。
- 完了条件: Fabric spike の Fit/50/100/200%、fixture reset、round-trip controls、
  panel独立 state を保つ。production NoteCanvasEditor の behavior と共通化しない。
- 検証: /spikes/canvas の両 panel、round-trip status、zoom/scroll、keyboard、
  lint、型検査、build。
- 依存: REF-07、REF-08。

#### SPIKE-REF-16: Konva adapter/panel decomposition

- 対象: konva-adapter.ts、konva-canvas-panel.tsx、必要な spike frame。
- 完了条件: Konva stage/layer/transformer、selection/resize、pointer gesture、
  app-owned projection、round-trip/zoom semantics を変えない。Fabric event handler
  との擬似共通化をしない。
- 検証: /spikes/canvas Konva panel、transform/selection/delete/round-trip、
  lint、型検査、build。
- 依存: REF-02、REF-03、REF-15 の共通 frame を使う場合のみ frame 完了後。

### Phase 7: global CSS cascade

#### CSS-REF-17: globals.css ownership split

- 対象: src/app/globals.css と src/app/styles/{tokens,base,chrome,spike-canvas,note-paper,note-canvas}.css 候補。
- 完了条件: selector の意味と cascade order を変えず、globals.css は import entry
  になる。Tailwind import、root variables、spike/paper/canvas responsive、
  create-only final overrides、Fabric generated DOM selectors の順を固定する。
  CSS-only task に UI redesign や class rename を混ぜない。
- 検証: npm run lint、型検査、build、git diff --check、375/640/768/900/1099/
  1280/1440 の screenshot/目視、toolbar focus/tooltip、canvas vertical/horizontal
  scroll、create/detail paper cascade。
- 依存: UI component split（REF-09、REF-13、REF-14）、spike split（REF-15、REF-16）。

## 7. 150〜200行目安の例外条件

次の条件では 150〜200 行を機械的に満たさない。

- CanvasDocumentV1 の型 union と validation は、分割で同じ schema rule を
  二重実装するくらいなら contract file を 220〜300 行で保つ。
- Fabric object factory と mapper のうち、group/local/page coordinate、
  metadata base position、shape text child が相互依存する部分は、変換不変条件を
  テストで守れる 1 adapter file を 220〜300 行で保つ。
- shape-text-editor-session と Fabric event binder は attached/detached
  lifecycle の state machine であり、handler を別々にすると cleanup が見えなく
  なる場合は 200 行超を許容する。
- NoteCanvasEditor の main JSX が 200 行を少し超えても、history/ref/controller
  を二重化しないことを優先する。目標は composition + adapter wiring のみ。
- CSS の各 component file は responsive rule と base rule を同居させる。media
  query だけを別ファイルへ切って import 順で cascade を不明瞭にしない。
- public contract facade と Prisma generated payload type は、行数よりも「公開
  API を一つに保ち、内部型を漏らさない」ことを優先する。

## 8. やらないこと / 移行時の禁止事項

- 200 行以下にすることだけを目的に、同じ state を複数 hook/component にコピーしない。
- CanvasDocumentV1 に Fabric object type、React state、DOM node を追加しない。
- Fabric/Konva の event handler を先に汎用化して engine 差を隠さない。
- FabricCanvasPanel の Fit/zoom を production の page dimensions に持ち込まない。
- Canvas page resize のための Prisma migration、DB column、別 API を追加しない。
- native Fabric JSON、preview、selection、history を NotebookCanvas.documentJson
  へ保存しない。
- MVP の /notes、/notes/new、/notes/[id]、/api/notes、
  /api/notes/:id、/api/notes/:id/review、/api/tags、backup API の URL、
  status、error body、request/response shape を変更しない。
- autosave、draft、409、soft delete/Undo、専用 review task、NoteCard/D&D、
  PDF export、tag management UI を refactor task に混ぜない。
- 意味のない index.ts barrel を新規ディレクトリごとに作らない。既存の
  shared/canvas、notes contracts/model、server layer の public facade だけを
  compatibility boundary として使う。

## 9. 最終検証境界

各 Worker の最低限の静的検証は次のとおり。

- npm run lint
- npx tsc --noEmit --pretty false
- npm run build
- git diff --check
- git diff --name-only で意図した新規/移動ファイルだけを確認
- git diff -- prisma schema/migrations が空であることを確認
- rg で production から app/spikes への import が残っていないことを確認

静的検証だけでは、Canvas pointer、Fabric listener lifecycle、図形内文字、
wheel/touch scroll、responsive CSS、保存→再読込を PASS にできない。UI/adapter
Worker 後は次の既存シナリオを browser runtime で別途実施する。

- CANVAS-DIMENSION-001
- CANVAS-INTERACTION-001
- CANVAS-GESTURE-001
- CANVAS-SHAPE-TEXT-001
- CANVAS-STYLE-001
- CANVAS-PERSISTENCE-STYLE-001
- CANVAS-TOOLBAR-STYLE-001

今回の監査ではコード・設定・依存関係・schema・migration・docs・生成物を変更
していない。変更成果物はこの summary のみである。
