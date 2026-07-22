# Strict Notes UI Module Migration Plan

作成日: 2026-07-22（JST）
対象: Notes UI の app 層から modules/notes/ui への段階移行設計

## Objective

現行 Notes UI の実体を src/app/notes/_components と src/app/notes/_lib から modules/notes/ui へ移すための配置、公開 import path、依存境界、後続 coding task、検証方法を固定する。今回の作業ではコード、設定、依存関係、Prisma、生成物を変更せず、この report だけを成果物とする。

現行 MVP の保存・削除・復習・Canvas の受け入れ判断は doc/implementation/MVP_CONTRACT.md を正本とする。AGENTS.md にある autosave、soft delete、専用復習タスク、NoteCard など Phase 2 の構想を、UI 移行の範囲へ持ち込まない。

作業開始時の git status --short は空だった。調査途中に別の未コミット変更が同じワークスペースへ現れたが、いずれも戻していない。今回の Worker が意図して追加するのはこの report のみであり、同時進行の source / summary 変更は既存変更として保持する。

## Scope

### Inventory

現行の移行対象は次のとおり。

- UI component: src/app/notes/_components 配下 31 ファイル。
- UI helper / hook: src/app/notes/_lib 配下 8 ファイル。
- route page: src/app/notes/page.tsx、src/app/notes/new/page.tsx、src/app/notes/[id]/page.tsx。
- route-local type: src/app/notes/types.ts。
- app shell: src/app/_components/app-chrome.tsx。
- 既存 module boundary: src/modules/notes/contracts、model、remote の全ファイル。
- shared edge: src/shared/canvas、src/shared/canvas/adapters/fabric、src/shared/markdown、src/shared/http、src/shared/date。

現行 source の重要な事実は次のとおり。

- Notes の list/editor/detail はすでに modules/notes/contracts、modules/notes/model、modules/notes/remote の facade を利用している。
- Notes UI の app 層から server / Prisma への直接 import はない。
- NoteEditor と NoteDetailModes だけが src/app/_components/app-chrome.tsx の AppChromeState を直接 import している。これが移動時の唯一の明確な app shell 逆依存である。
- Canvas editor/viewer は shared/canvas の CanvasDocumentV1 と shared/canvas/adapters/fabric を利用している。Fabric の lifecycle と pointer event orchestration は現行 _lib/use-note-canvas-runtime.ts にあり、図形内文字編集の controller は shape-text-editor-session.ts にある。
- Markdown は shared/markdown の MarkdownField / MarkdownPreview を利用している。Markdown 本文は Canvas に統合せず、bodyMode により表示を切り替える現行契約を維持する。
- src/app/notes/types.ts は src 内から参照されていない。CueCard / NoteCard は現行 MVP の DTO / Prisma model ではなく Phase 2 構想の残骸である。
- src/shared/http/index.ts は client-safe な api-error / fetch-json と server-only な route-response を同じ barrel から再公開している。modules/notes/remote の strict な server 非依存を検証するには client-safe facade を分ける必要がある。

### In scope / out of scope

In scope は配置移行、import facade、AppChrome bridge、Canvas helper の境界、route composition、検証設計である。Canvas の操作仕様、API shape、保存方式、UI の見た目、Phase 2 機能は変更しない。

Out of scope は新しい API、Prisma migration、Canvas 機能追加、Markdown 仕様変更、route の追加、タグ管理機能、NoteCard 化、autosave、Undo、復習タスクである。

## Proposed Mapping

### 1. modules/notes/ui/components

UI の実体は次の全ファイルを modules/notes/ui/components へ移す。ファイル名は最初の移行では維持し、相互 import の機械的な差分を小さくする。

Editor composition:

- note-editor.tsx — NoteEditor。form state、保存、router navigation、AppChrome mode report、section composition の owner。
- note-editor-body.tsx — bodyMode に応じた MarkdownField / NoteCanvasEditor の section。
- note-editor-cues.tsx — Cue list の入力、追加、削除。
- note-editor-inputs.tsx — TitleInput / TextInput の presentation primitive。
- note-editor-metadata.tsx — title、date、source、tag の metadata section。
- note-editor-tags.tsx — tag candidate の remote loading と tag token input。
- note-editor-summary.tsx — Summary Markdown、次回復習日、保存・キャンセル footer。

Detail composition:

- note-detail-modes.tsx — view / edit / review state、review/delete remote command、NoteEditor / NoteDetailReadView の切替、AppChrome mode report。
- note-detail-read-view.tsx — detail paper の view / review layout と body / Summary reveal state の props composition。
- note-detail-display.tsx — heading、metadata、Cue list、body renderer、tag presentation。
- note-detail-actions.tsx — view action と review action。
- note-detail-types.ts — NoteDetail の UI-facing alias。最初の移行では保持し、remote DTO の再配置後に alias を削除できるようにする。

List composition:

- notes-list.tsx — list query state、tag loading、remote loading/error、page change、filter/result composition。
- notes-list-filters.tsx — query、date range、reviewDue、tag filter の form。
- notes-list-tags.tsx — list 側 tag token UI。
- notes-list-results.tsx — loading、empty、card、pagination の composition。
- notes-list-card.tsx — NotebookListItem の表示と detail route link。
- notes-list-pagination.tsx — page navigation。
- notes-list-feedback.tsx — error、loading、empty presentation。

Canvas composition:

- note-canvas-editor.tsx — Canvas history、tool/style/page state、runtime hook、toolbar/surface composition。
- note-canvas-viewer.tsx — read-only Fabric hydration、assistive text、surface composition。
- note-canvas-surface.tsx — editor/viewer 共通の viewport、horizontal scroll、stage、canvas DOM。
- note-canvas-toolbar.tsx — toolbar の公開 composite。
- note-canvas-toolbar.types.ts — toolbar props と canvas editor type の UI boundary。
- note-canvas-toolbar-definitions.ts — tool group / icon / text alignment definition。
- note-canvas-toolbar-actions.tsx — tool group / history buttons。
- note-canvas-toolbar-icon.tsx — SVG icon presentation。
- note-canvas-toolbar-paper-controls.tsx — page width / height input と validation。
- note-canvas-toolbar-style-controls.tsx — stroke / color / font / alignment controls。
- note-canvas-toolbar-style-input.tsx — integer style input と parser presentation。
- note-canvas-toolbar-alignment-controls.tsx — text alignment controls。

### 2. modules/notes/ui/hooks

Browser lifecycle と Fabric event orchestration は components から分離し、次のファイルを modules/notes/ui/hooks へ移す。

- use-note-canvas-runtime.ts — Fabric dynamic import、canvas lifecycle、pointer gesture、erase、selection、style event、cleanup の hook。
- shape-text-editor-session.ts — shape inline text の start / commit / cancel / Escape / blur / detached editor cleanup controller。
- canvas-runtime-contract.ts — runtime hook の options / result と ref contract。

canvas-runtime-contract.ts と shape-text-editor-session.ts は hook implementation の内部 contract である。pages や外部 app component が直接 import しない。必要な公開入口は ui/hooks/index.ts から useNoteCanvasRuntime と runtime type を再公開するが、通常の screen composition は NoteCanvasEditor 経由に限定する。

### 3. modules/notes/lib

React component ではなく、Notes 固有の Canvas 編集 semantics を置く。次の _lib ファイルを modules/notes/lib へ移す。

- canvas-editor-contract.ts — CanvasNoteTool、style change/default、Point、DragDraft、ShapeCanvasElement、FabricInteractionState、NoteCanvasEditorProps。React import を持たないので lower-level contract として置ける。
- canvas-editor-document.ts — empty text の除去、shape 判定、Canvas element metadata の読取、shape text 置換、editor search text の抽出。
- canvas-editor-geometry.ts — pointer を page coordinate に変換し、drag threshold と line / arrow / rect / ellipse の Canvas element を作る。
- canvas-editor-style.ts — Notes editor の style default、選択中 style 読取、style change 適用、shape text style、drawing target 判定。

この 4 ファイルは ui/hooks へ戻さない。ui/hooks が lib を参照し、lib が ui/hooks を参照しないことで、components -> hooks / lib の一方向を保つ。Canvas metadata の raw key 読取は後述の Fabric adapter seam 完了後に adapter API へ置き換える。

### 4. shared/canvas と shared UI

次の edge は domain-independent と判断し、Notes module に複製しない。

- 現行 src/app/notes/_lib/canvas-surface.ts は src/shared/canvas/canvas-surface.ts へ移す。page width / height を DOM surface、HTML canvas、Fabric wrapper へ反映するだけで、Notebook、Cue、Summary、route path を知らないため shared/canvas が適切である。shared/canvas/index.ts から stable に再公開する。
- CanvasDocumentV1、canvas history、geometry、serialization、search projection は既存の src/shared/canvas を正本として維持する。Notes UI は @/shared/canvas から import し、MVP の保存 JSON を UI ファイルへ複製しない。
- Fabric adapter は src/shared/canvas/adapters/fabric の正本を維持する。NoteCanvasViewer と useNoteCanvasRuntime は adapter の public facade を使い、spike adapter や src/app/spikes を import しない。
- MarkdownField / MarkdownPreview は既存の src/shared/markdown を維持する。Markdown preview の sanitize、GFM checkbox、soft break、display-only checkbox の契約を Notes UI に再実装しない。
- AppChrome の mode reporting は新しい domain-independent bridge、src/shared/ui/app-chrome-state.tsx に移す。app shell の見た目と pathname 判定は src/app/_components/app-chrome.tsx に残す。
- remote / UI / model が使う HTTP error 型・decode は client-safe な src/shared/http/client.ts を新しい公開入口にする。route-response は app/api と server のみが使う src/shared/http の server 側入口に残す。

### 5. Existing modules/notes

既存の contract、model、remote は移動せず、現在の module boundary を正本として維持する。

Contracts に残すファイル:

- contracts/canvas.schema.ts
- contracts/cue.schema.ts
- contracts/date.schema.ts
- contracts/index.ts
- contracts/note.schema.ts
- contracts/notebook.schema.ts
- contracts/query.schema.ts
- contracts/review.schema.ts
- contracts/schema-helpers.ts
- contracts/tag.schema.ts

Model に残すファイル:

- model/index.ts
- model/note-display.ts
- model/note-editor-form.errors.ts
- model/note-editor-form.initial.ts
- model/note-editor-form.payload.ts
- model/note-editor-form.ts
- model/note-editor-form.types.ts

Remote に残すファイル:

- remote/error.ts
- remote/index.ts
- remote/note-operations.ts
- remote/query.ts
- remote/review-operations.ts
- remote/tag-operations.ts
- remote/transport.ts
- remote/types.ts

TagDto / TagOptionsResponse が contracts に置かれている現行変更もこの方向に合う。UI は remote facade の response type を利用し、Prisma record や server presenter type を取り込まない。model/remote の shared/http import は client-safe facade へ更新する。

### 6. app route/page と legacy files

残す app route composition は次の 3 page だけである。

- src/app/notes/page.tsx: NotesList の public facade を配置するだけにする。最終 import は @/modules/notes/ui/components。
- src/app/notes/new/page.tsx: create 用 note-paper-page wrapper と NoteEditor mode=create の配置だけにする。最終 import は @/modules/notes/ui/components。
- src/app/notes/[id]/page.tsx: params の解決、初期 detail の取得、404 表示、paper wrapper、NoteDetailModes の配置だけにする。最終 import は @/modules/notes/ui/components。

詳細 page の初期データは Target Architecture に合わせ、最終形では Server Component から @/server/notes/application の getNoteDetail を使う。現行の fetchNoteDetail remote 呼び出しは、機械的な UI 移動中に挙動を変えないための一時互換経路として残してよいが、route cleanup task の終了時に server application 初期取得へ寄せる。ページが server application を使っても、modules/notes/ui から server へ逆向きに依存してはならない。

- src/app/_components/app-chrome.tsx は app shell として残す。provider の実装と AppChrome badge の描画は shared bridge を利用するが、pathname と nav link は app 層が所有する。
- src/app/notes/types.ts は参照がないため modules/notes/model へ移さない。Phase 2 の未使用 CueCard / NoteCard 型なので、legacy cleanup task で削除する。削除までの短い移行期間は app route/page の未使用 legacy file として保持する。
- src/app/notes/_components と src/app/notes/_lib は最終的に削除する。内部 app-only import のため、旧 import path を package compatibility のために残す必要はない。

### 7. Public entry points

pages が依存する公開入口は次の 1 つに限定する。

- @/modules/notes/ui/components/index.ts
  - NotesList
  - NoteEditor
  - NoteDetailModes と NoteDetail type
  - NoteCanvasEditor
  - NoteCanvasViewer
  - NoteCanvasToolbar と toolbar type

ui/components 内の leaf component は index barrel を相互 import せず、同一 directory の relative leaf import を使う。ui/hooks/index.ts は useNoteCanvasRuntime と必要な type の安定入口とするが、screen page は hook を直接 import しない。

Canvas と shared の入口は次のとおり。

- @/shared/canvas — CanvasDocumentV1、history、surface dimension helper。
- @/shared/canvas/adapters/fabric — Fabric object factory、document projection、public metadata/style operations。
- @/shared/markdown — MarkdownField / MarkdownPreview。
- @/shared/http/client — client-safe API error type / decode。
- @/shared/ui/app-chrome-state — AppChrome mode type、provider、mode reporter。
- @/modules/notes/contracts — Zod schema と request / DTO contract。
- @/modules/notes/model — form state、initial、payload、display helper。
- @/modules/notes/remote — HTTP operation と response facade。

## Dependency Rules

### Final import graph

最終の route composition と module graph は次の形にする。

    src/app/layout.tsx
      -> src/app/_components/app-chrome.tsx
         -> src/shared/ui/app-chrome-state.tsx

    src/app/notes/page.tsx
      -> @/modules/notes/ui/components (NotesList)

    src/app/notes/new/page.tsx
      -> @/modules/notes/ui/components (NoteEditor)

    src/app/notes/[id]/page.tsx
      -> @/server/notes/application (getNoteDetail, initial read only)
      -> @/modules/notes/ui/components (NoteDetailModes)

    @/modules/notes/ui/components
      -> @/modules/notes/ui/hooks
      -> @/modules/notes/lib
      -> @/modules/notes/model
      -> @/modules/notes/remote
      -> @/modules/notes/contracts (type/schema only where needed)
      -> @/shared/ui/app-chrome-state
      -> @/shared/markdown
      -> @/shared/http/client
      -> @/shared/date
      -> @/shared/canvas
      -> @/shared/canvas/adapters/fabric
      -> next/link / next/navigation (current client navigation only)

    @/modules/notes/ui/hooks
      -> @/modules/notes/lib
      -> @/shared/canvas
      -> @/shared/canvas/adapters/fabric
      -> react

    @/modules/notes/lib
      -> @/shared/canvas
      -> @/shared/canvas/adapters/fabric public facade

    @/modules/notes/remote
      -> @/modules/notes/contracts
      -> @/shared/http/client
      -> fetch

    @/modules/notes/model
      -> @/modules/notes/contracts
      -> @/shared/canvas
      -> @/shared/date
      -> @/shared/http/client (error type only)

    @/modules/notes/contracts
      -> zod
      -> @/shared/canvas

    @/server/notes/application
      -> @/server/notes/infrastructure
      -> @/server/notes/presenters
      -> @/modules/notes/contracts

page / app は module UI の public facade を使う。module UI は app shell、server、Prisma、Route Handler implementation、filesystem、server-only HTTP response を import しない。

### AppChromeState bridge recommendation

推奨は「app shell 側の shared UI bridge/provider へ移す」である。

- src/shared/ui/app-chrome-state.tsx が AppChromeMode、mode label reporting の context、provider、mode reporter component を所有する。
- src/app/_components/app-chrome.tsx は usePathname による default state、pathname ごとの override、nav、badge の見た目を所有し、shared provider を root layout で提供する。
- NoteEditor と NoteDetailModes は @/shared/ui/app-chrome-state の reporter を render する。app shell への import は 0 件になる。
- mode reporter は mount 時に setState、unmount 時に同じ scope の state を clear する current semantics を維持する。detail の edit mode では NoteEditor が reporter を持つため NoteDetailModes の二重 reporter を出さない現行挙動も維持する。
- shared bridge は pathname や note domain を直接判定しない。default pathname state と日本語の shell copy は app shell から provider API へ渡すか、badge renderer 側に残す。これにより shared UI が Notes route の知識を持たない。

候補比較:

| 候補 | 利点 | 欠点 | 判定 |
| --- | --- | --- | --- |
| app shell 側の shared UI bridge/provider | dynamic な edit/view/review state を内部で報告でき、props の受け渡しが不要。module -> shared は許可方向で、app shell -> shared も一方向になる。 | provider / context の責務を app shell から一度移す必要がある。 | 推奨 |
| page が mode callback / slot を渡す | app shell を module から隠せる。 | page は Server Component であり、NoteDetailModes 内の client mode 変化を自然に監視できない。callback と mode slot を NoteDetailModes、NoteEditor、各 section へ thread するため route composition が厚くなる。 | 不採用 |
| UI module から app shell を依存させない最小 adapter | 差分が小さく見える。 | adapter を app に置けば逆依存が残り、module に置けば app-specific state を複製する。結局 provider または prop injection が必要で、責務の owner が曖昧になる。 | 不採用 |

### Strict dependency prohibitions

- src/modules/notes/ui、src/modules/notes/lib から src/app/** を import しない。特に @/app/_components/app-chrome と src/app/notes の旧 path を禁止する。
- src/modules/notes/ui、src/modules/notes/lib、src/modules/notes/remote、src/modules/notes/model から src/server/**、@prisma/client、Prisma payload、filesystem、Route Handler implementation、next/server を import しない。
- UI から remote の transport / operation 内部へ deep import しない。公開入口は @/modules/notes/remote に限定する。
- remote は contracts と shared/http/client だけを知り、React component、Prisma、Route Handler、NextResponse を知らない。
- model は UI component、remote operation、server record を知らない。API input と UI form state の変換は既存 model facade に閉じ込める。
- lib は components / hooks を import しない。Fabric の構造 API は shared/canvas/adapters/fabric public facade のみを使う。
- shared/canvas と shared/markdown は modules/notes を import しない。CanvasDocumentV1 と Markdown renderer は domain-independent のままにする。
- app page は internal leaf path の _components / _lib を import しない。public facade または server application のみを使う。
- next/link と next/navigation は現在の client UI navigation のための許可された framework edge とする。next/server、NextResponse、Route Handler の import は禁止する。将来 portable UI が必要になった場合だけ navigation callback/adapter を別 task にする。

### Fabric and Canvas boundary

- shared/canvas が保存正本 CanvasDocumentV1 と history / validation / serialization / search projection を所有する。
- shared/canvas/adapters/fabric が Fabric object factory、Fabric <-> CanvasDocument projection、app-owned metadata、Fabric style read/write の唯一の adapter boundary になる。
- useNoteCanvasRuntime が Fabric lifecycle、pointer gesture、event subscription、cleanup を所有する。NoteCanvasEditor は state/history と hook/composition を所有し、Fabric object の変換を再実装しない。
- NoteCanvasViewer は read-only hydration と surface layout だけを所有する。保存 JSON や Fabric JSON を viewer 内で変形・再保存しない。
- 現行 canvas-editor-style.ts の shared/canvas/adapters/fabric/fabric-style.ts 直接 import は、adapter index の public re-export または semantic adapter function へ更新する。
- canvasElement、isCanvasPreview、isCanvasShapeTextEditor などの Fabric metadata key を modules/notes/lib / ui/hooks が直接 get/set する現行箇所は、adapter の semantic function へ寄せる。例: readCanvasElementMetadata、isCanvasPreviewObject、markCanvasPreviewObject、isShapeTextEditorObject。metadata key の文字列を Notes UI の複数ファイルに残さない。
- Canvas page resize は page.width / page.height だけを変え、既存 element geometry、style、text、searchText を変えない MVP 契約を維持する。

### Markdown and remote/model boundary

- Cue と Summary は既存 shared/markdown の MarkdownField / MarkdownPreview を利用し、Canvas 本文を Markdown preview に流さない。
- NoteEditor form state は modules/notes/model、request schema は modules/notes/contracts、HTTP call は modules/notes/remote の責務とする。
- NoteTag / DTO は remote facade または contracts DTO から取得し、UI component 内に Prisma shape や独自 response type を再定義しない。
- src/shared/http/index.ts の server route-response export が module client graph に入らないよう、client-safe facade を必ず経由する。

## Migration Steps

一括移動ではなく、lower-level seam から上位 composition へ進める。各 task は挙動を変えず、完了後に lint / typecheck と禁止 import 検索を通す。

### Task 1: Freeze public seams and app-shell bridge

対象:

- src/shared/ui/app-chrome-state.tsx の新規 bridge/provider。
- src/app/_components/app-chrome.tsx の provider / badge 接続。
- src/shared/http/client.ts の新規 client-safe facade と modules/notes の error type / transport import 更新。
- src/shared/canvas の surface helper / history public export 方針。
- shared/canvas/adapters/fabric の style / metadata public API の設計。

完了条件:

- NoteEditor / NoteDetailModes の mode report が shared bridge から動き、module UI から app shell import がない。
- modules/notes/remote と modules/notes/model が @/shared/http の server-inclusive barrel を参照しない。
- Fabric style / metadata の必要 API と public export が決まり、private fabric-style import と raw metadata key access を次 task で消せる。
- MVP contract、Prisma schema、API response shape は変更しない。

### Task 2: Move Notes Canvas pure helpers

対象:

- _lib/canvas-editor-contract.ts、canvas-editor-document.ts、canvas-editor-geometry.ts、canvas-editor-style.ts を modules/notes/lib へ移す。
- former helper の shared/canvas、Fabric public facade、相互 relative import を更新する。
- NoteCanvasEditorProps は lib contract に残し、hooks/components の cycle を作らない。

完了条件:

- modules/notes/lib が app、server、Prisma、React component/hook を import しない。
- Fabric private style module と raw metadata access の残りは adapter seam task の明示した public API へ向ける。
- 既存 Canvas tool、style range、drag threshold、shape text replacement、search text の挙動を変えない。

### Task 3: Move Canvas runtime hooks

対象:

- _lib/use-note-canvas-runtime.ts、shape-text-editor-session.ts、canvas-runtime-contract.ts を modules/notes/ui/hooks へ移す。
- hooks の lib import を ../../lib、shared import を public facade に更新する。
- NoteCanvasEditor / viewer の一時的な app path import を新しい hook path に切り替える。

完了条件:

- hooks が components、pages、app shell、server、Prisma を import しない。
- Fabric dynamic import、lifecycle cleanup、shape inline editor の commit/cancel、erase、undo/redo の current behavior を保持する。
- runtime hook を直接使うテスト以外の screen code は hook implementation path を知らない。

### Task 4: Move Canvas components and publish Canvas entries

対象:

- 12 個の Canvas component / toolbar file を modules/notes/ui/components へ移す。
- note-canvas-surface.tsx は shared/canvas/canvas-surface.ts の public helper を使う。
- components/index.ts から NoteCanvasEditor、NoteCanvasViewer、NoteCanvasToolbar、必要な props/type を再公開する。
- NoteEditorBodySection、NoteDetailBody の leaf import を同 directory の relative path へ更新する。

完了条件:

- Canvas UI の外部入口は @/modules/notes/ui/components で解決する。
- Canvas component から src/app/notes/_lib、src/app/spikes、app shell への import がない。
- editor / viewer が同じ shared surface と CanvasDocumentV1 を使い、Fabric JSON を保存境界にしない。

### Task 5: Move editor and detail components

対象:

- 7 個の Editor component を components へ移す。
- 5 個の Detail component と note-detail-types.ts を components へ移す。
- NoteEditor / NoteDetailModes の AppChromeState import を shared bridge に置き換える。
- remote/model/contracts/markdown/http client の import を公開 facade に寄せる。

完了条件:

- NoteEditor と NoteDetailModes が module UI の public screen entry になる。
- view/edit/review、明示保存、確認付き物理削除、review API、Markdown preview、Canvas bodyMode の現行 MVP behavior を保持する。
- modules/notes/ui に app shell、server、Prisma、Route Handler import が 0 件である。

### Task 6: Move list components

対象:

- 7 個の NotesList component を components へ移す。
- default export の NotesList を named public entry へ寄せ、内部 leaf は barrel 相互参照しない。
- remote query / tag options と model date validation の import を既存 facade 経由へ更新する。

完了条件:

- NotesList は page から public facade で配置できる。
- query、date range validation、tag OR filter、reviewDue、loading/error/empty、pagination の現行 behavior を保持する。
- list component から app/notes 旧 path、server、Prisma への import がない。

### Task 7: Switch pages and remove legacy paths

対象:

- 3 route page の import を @/modules/notes/ui/components へ切り替える。
- [id] page の initial read を @/server/notes/application の getNoteDetail へ切り替える。remote は Client UI の mutation / list boundary として残す。
- repo-wide import search で旧 _components / _lib 参照がないことを確認する。
- src/app/notes/_components と src/app/notes/_lib を削除する。空 wrapper は残さない。
- src/app/notes/types.ts を削除する。Phase 2 type を新 module に移さない。

完了条件:

- page は params、初期データ取得、404、route wrapper、public component 配置だけを行う。
- app/notes の旧 import path が 0 件である。
- module UI の外からは components/index.ts が Notes screen / Canvas entry の唯一の入口になる。
- legacy directory と types.ts の削除後も typecheck / build が通る。

### Task 8: Verification and runtime QA

対象:

- static graph checks、lint、typecheck、build、diff check。
- /notes、/notes/new、/notes/[id] の list -> detail -> edit -> save -> view -> review -> delete flow。
- Handoff と TEST_SCENARIOS に記録された Canvas runtime scenarios。

完了条件:

- 下記 Verification の forbidden import checks が 0 件。
- npm run lint、npx tsc --noEmit --pretty false、npm run build、git diff --check が成功する。
- Canvas の browser runtime は static PASS と分けて記録し、未実施を PASS にしない。

### Relative import update unit and cycle order

機械的な relative import の置換は次の単位で行う。

- app page の ./_components / ../_components は @/modules/notes/ui/components の public facade へ置換する。
- component 同士の ./note-*、./notes-* import は同じ components directory 内で維持する。
- component から旧 _lib/use-note-canvas-runtime は ../hooks/use-note-canvas-runtime へ置換する。
- component から Notes 固有 helper は ../lib/...、shared surface は @/shared/canvas へ置換する。
- hooks から Notes lib は ../../lib/...、Fabric / Canvas は shared の public facade へ置換する。
- modules/notes/model、contracts、remote は UI directory へ移さない。UI 移行の影響で path を戻さない。
- components/index.ts / hooks/index.ts の内部から barrel 自身を import しない。cycle を避けるため screen component は leaf path を使う。

依存順は shared seam -> modules/notes/lib -> modules/notes/ui/hooks -> Canvas leaf components -> editor/detail/list screen components -> public facades -> route pages -> legacy deletion の順とする。上位 file を先に移して仮 wrapper を増やさない。

## Verification

この report task では source を変更していないため、lint / build は移行実装後の coding task で実行する。今回の確認としては inventory、import、契約、status の read-only 確認を行った。

移行 coding task ごとに次を実行する。

1. git status --short — task 前後で対象外変更を戻していないことを確認する。
2. rg で src/modules/notes/ui と src/modules/notes/lib の import を検索し、@/app/、@/server/、@prisma/client、Prisma payload、next/server、Route Handler implementation、src/app/notes/_components、src/app/notes/_lib が 0 件であることを確認する。
3. rg で src/modules/notes/remote と src/modules/notes/model の @/shared/http import を確認し、client-safe facade 以外が 0 件であることを確認する。
4. rg で src/modules/notes/ui と src/modules/notes/lib の fabric-style private path、src/app/spikes、canvasElement、isCanvasPreview、isCanvasShapeTextEditor の raw access を確認し、adapter seam 完了後は 0 件であることを確認する。
5. rg で src/app 全体の src/app/notes/_components、src/app/notes/_lib、@/app/notes の旧 import を検索し、route cleanup 後は 0 件であることを確認する。
6. npm run lint。
7. npx tsc --noEmit --pretty false。
8. npm run build。生成される .next は検証用であり、commit 対象にしない。
9. git diff --check。

静的確認と browser runtime QA は分ける。runtime の最低限の対象は次のとおり。

- /notes: list 初期取得、検索、From/To validation、tag OR、reviewDue、pagination、新規作成 link。
- /notes/new: create mode、Canvas initial document、Cue / Summary Markdown、tag options、明示保存後 detail 遷移。
- /notes/[id]: view、edit、Canvas / legacy Markdown 切替、保存後 view、review body/Summary reveal、確認付き delete。
- Canvas: 1200x800 default、320〜4000 range、page resize 後の element geometry/style/text/searchText 不変、空白/既存 app-owned 要素上の gesture、4px threshold、shape inline text、style controls、undo/redo、縦 scroll / 局所横 scroll。
- 既存 Handoff の 7 シナリオ CANVAS-DIMENSION-001、CANVAS-INTERACTION-001、CANVAS-GESTURE-001、CANVAS-SHAPE-TEXT-001、CANVAS-STYLE-001、CANVAS-PERSISTENCE-STYLE-001、CANVAS-TOOLBAR-STYLE-001。

## Risks / Remaining Decisions

### Risks

- AppChrome bridge を provider ではなく prop callback で実装すると、detail の client mode が page へ戻らず、mode badge が stale になる。shared provider を先に確定する。
- shared/http の barrel をそのまま module UI から使うと、route-response 経由で next/server が client graph に混ざる。client facade を必須にする。
- Canvas helper の移動を単純な ../_lib -> ../hooks 置換で行うと、pure helper が hook 層へ膨らむか、lib -> hooks の cycle ができる。contract を Notes lib に置き、hooks -> lib の順で移す。
- Fabric private style import と raw metadata key access を残したまま「adapter 境界完了」と判定すると、Fabric implementation の変更が複数 Notes UI file へ漏れる。public adapter API を先に固定する。
- CanvasDocumentV1 を module UI にコピーすると、page resize、searchText、保存 JSON の drift が起きる。shared/canvas の正本を使い続ける。
- 空 wrapper を残すと、旧 app path と新 module path が同時に public に見え、次の変更がどちらを編集すべきか不明になる。internal-only repository なので final cleanup で削除する。
- src/app/notes/types.ts を model へ移すと Phase 2 NoteCard shape を MVP UI に再導入する。未使用のまま削除する。
- Next navigation を module UI に残すと、将来別 router へ移す時の adapter task が必要になる。ただし current Target Architecture の禁止依存ではなく、今回の app shell/server 逆依存とは別問題である。

### Decisions fixed by this plan

- AppChromeState は shared UI bridge/provider 案を採用する。
- final public Notes UI entry は @/modules/notes/ui/components とし、pages は old app path を import しない。
- final legacy _components / _lib は削除し、empty wrapper は残さない。
- Canvas generic surface は shared/canvas、Notes-specific helper は modules/notes/lib、Fabric lifecycle は modules/notes/ui/hooks、visual component は modules/notes/ui/components に置く。
- Canvas adapter は shared/canvas/adapters/fabric に残し、Notes UI が spike adapter や Fabric private module を直接 import しない。
- [id] page の final initial read は server application、UI mutation/list/review は remote facade とする。
- MVP contract と Phase 2 boundary はこの移行では変更しない。

### Remaining decisions for implementation review

- shared/ui bridge の具体 API 名を AppChromeState の互換名で残すか、AppChromeModeReporter へ改名するか。推奨は mode reporter の責務が明確な AppChromeModeReporter、短期移行では互換 export を許可する。
- shared/canvas/adapters/fabric に追加する metadata/style semantic API の最終関数名。関数の責務と public-only access を先に合意し、名前は実装 task で確定する。
- Next Link / Router を route adapter callback に切り出す時期。今回の module move の blocking decision ではなく、別の portable UI task とする。
- browser runtime QA の実行環境。静的検証成功だけで Canvas runtime PASS としない。

## Next Read

再開時は raw log や .next を読まず、次の最小入口から確認する。

1. summary/20260722/strict-notes-ui-module-migration-plan-20260722.md
2. doc/technical/TARGET_ARCHITECTURE.md の target tree、dependency direction、migration policy。
3. doc/implementation/MVP_CONTRACT.md の route、Canvas、Markdown、保存・削除契約。
4. src/app/_components/app-chrome.tsx — bridge 接続前後の shell owner。
5. src/app/notes/page.tsx、src/app/notes/new/page.tsx、src/app/notes/[id]/page.tsx — route composition。
6. src/modules/notes/contracts/index.ts、src/modules/notes/model/index.ts、src/modules/notes/remote/index.ts — existing public facades。
7. 実装後は src/modules/notes/ui/components/index.ts と src/modules/notes/ui/hooks/index.ts — new public entry。

この report 以外の source / config / dependency / generated artifact はこの Worker の成果物ではない。
