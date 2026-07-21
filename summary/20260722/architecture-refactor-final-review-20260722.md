# Architecture Refactor Final Review

監査日: 2026-07-22（JST）

## Objective

Canvas、Notes、spike、CSS の責務分割後について、Target Architecture の依存方向、公開 facade、責務境界、過渡構成、検証状態を現行ソースから再確認し、実装完了の判定材料を具体的なパス・import・コマンド結果で固定する。コード、設定、依存関係、生成物は変更せず、この監査レポートだけを作成する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象仕様 | `AGENTS.md`、`HANDOFF_2026-07-19.md`、`doc/technical/TARGET_ARCHITECTURE.md`、`doc/implementation/MVP_CONTRACT.md` |
| 対象実装 | `src/app/notes`、`src/app/spikes/canvas`、`src/modules/notes`、`src/server/notes`、`src/shared/canvas`、`src/app/globals.css`、`src/app/styles`、`src/app/api/tags/route.ts` |
| 追加確認 | `src` 以下の `.ts` / `.tsx` / `.css` の行数、ローカル import graph、公開 facade、CSS split 前後の cascade 順序、lint / typecheck / diff check |
| 対象外 | `npm run build`、ブラウザ実機 QA、コード・設定・依存関係・生成物の修正、追加実装 task の作成 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| repository instructions | `AGENTS.md` | MVP と Phase 2 の境界、既存変更を戻さない方針、summary / handoff 運用 |
| handoff | `HANDOFF_2026-07-19.md` §2・§4・§6・§7・§9 | Canvas の保存契約、Fabric と app-owned JSON の境界、未確認 runtime QA、次回確認入口 |
| target architecture | `doc/technical/TARGET_ARCHITECTURE.md` | Modular Architecture、app/modules/server/shared の責務、依存方向、禁止依存、移行方針 |
| MVP contract | `doc/implementation/MVP_CONTRACT.md` §6.1・§6.2 と関連 route/API 節 | CanvasDocumentV1、page resize、style/textStyle、保存・復元・検索の受け入れ契約 |
| implementation status | `doc/implementation/IMPLEMENTATION_STATUS.md` §1・§5.3・§5.5・§7 | 静的確認と Browser runtime の判定分離、Canvas の後続確認入口、過去の検証記録 |
| test scenarios | `doc/testing/TEST_SCENARIOS.md` Canvas runtime QA / Notes API runtime / 検証記録 | API runtime と Browser QA の分離、未実施項目、過去の lint/build 記録 |
| background summaries | `summary/20260722/architecture-final-audit-20260722.md`、`summary/20260722/0314-architecture-refactor-final-audit-20260722-2af744b9-summary.md`、直近の Canvas/Notes/CSS refactor summaries | 経緯と既知の確認境界だけを参照。判定は現行 source と今回の検索結果を優先 |
| source | 上記 Scope の全対象ディレクトリ | import、export、責務、selector、行数、重複候補を直接確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260722/architecture-refactor-final-review-20260722.md` | 本監査レポートのみを新規作成 | 指定された詳細な最終レビューを残すため |

実装コード、設定、依存関係、Prisma schema、migration、生成物、他の summary / task queue は変更していない。Worker progress の更新は runner の状態メタデータであり、リポジトリ成果物ではない。

## Findings

### Overall decision

現行 refactor は、明示された禁止依存を検出せず、Canvas/Notes/CSS の主要な責務分割と公開 facade を成立させているため、Target Architecture に「概ね適合」と判定する。ただし、厳密な target tree と renderer/server の境界まで完了条件に含める場合は、次の過渡構成・疑義が残る。

- UI の実体は `src/modules/notes/ui` ではなく `src/app/notes/_components` と `src/app/notes/_lib` に残る。
- server infrastructure の一部が presenter の Prisma payload 型を type-only import している。
- production Canvas runtime / helper が Fabric の app-owned metadata key（`canvasElement`、`isCanvasPreview`、`isCanvasShapeTextEditor`）を直接読む・書く。
- tags API は route → application → infrastructure の境界を持つが、明示的な Tag contract / presenter はない。

これらは今回の禁止依存検索で検出する「UI → server」「remote → Prisma」等の直接違反ではない。厳密な境界を採用するなら、既存挙動を変えない小さな後続 task として扱うべきであり、この監査 task では修正しない。

### Facts

#### F-001: 禁止依存の検査結果

次の検索を現行 source に対して実行した。いずれも該当 import は 0 件だった。

| 禁止依存 | 検索対象・確認方法 | 結果 |
|---|---|---|
| `src/modules` の UI → `src/server` | `rg -n 'server/|@/server' src/modules` | 違反なし |
| `src/modules/notes/remote` → Prisma / filesystem / Route Handler | `rg -n 'from .*next/|from .*react|@prisma/client|from .*prisma|server/|@/server' src/modules/notes/remote` | 違反なし |
| `src/server/notes` → React / Next UI | `rg -n 'from .*react|from .*react-dom|from .*next/' src/server/notes` | 違反なし |
| `src/server/notes/infrastructure` → HTTP / Next / browser | `rg -n 'from .*next/|NextResponse|NextRequest|from .*react|from .*react-dom|\\b(window|navigator|localStorage|sessionStorage|location)\\b|fetch\\s*\\(' src/server/notes/infrastructure` | 違反なし |
| UI → Prisma payload | `rg -n '@prisma/client|Prisma\\.|Prisma[A-Z]|NotebookGetPayload|NotebookWith|PrismaClient' src/app/notes src/modules/notes` | 違反なし |
| production `src/app/notes` → `src/app/spikes` | `rg -n 'src/app/spikes|app/spikes|/spikes' src/app/notes` | 違反なし |

`src/server/notes/infrastructure` の Prisma import 自体は、Target Architecture が許可する DB adapter の責務である。`document` という変数名が `canvas.persistence.ts` にあるが DOM `document` ではなく、browser global の結果には含めていない。

#### F-002: app/page と remote の境界

- `src/app/notes/page.tsx` は `./_components/notes-list` を配置するだけである。
- `src/app/notes/new/page.tsx` は `NoteEditor` を配置するだけである。
- `src/app/notes/[id]/page.tsx:1-15` は `next/link` と `fetchNoteDetail` を使い、detail data の取得、not-found 判定、`NoteDetailModes` の配置に留まる。
- `src/app/notes/_components/note-editor.tsx:8-20` は `modules/notes/contracts`、`modules/notes/model`、`modules/notes/remote` を使う。API の fetch 実装は `src/modules/notes/remote/transport.ts` に閉じている。
- `src/app/notes/_components/note-detail-modes.tsx:6-15` は `completeReview` / `deleteNote` を remote facade から呼び、mode・note snapshot・review/delete state を所有する。
- `src/app/notes/_components/notes-list.tsx:5-15` は list query state、remote loading/error、result state を所有し、filters/results/cards/tags/pagination を controlled props で組み立てる。

フォーム、detail、list の state owner と表示責務は分離され、UI から Prisma record を直接扱う構造はない。

#### F-003: Notes contracts/model/remote facade

- `src/modules/notes/contracts/index.ts:1` → `note.schema.ts`。`note.schema.ts:1-14` が date/tag/cue/canvas/notebook/query/review の schema と type を公開する。
- `src/modules/notes/model/index.ts:1-2` → `note-editor-form` と `note-display`。form の types/initial/errors/payload は `note-editor-form.ts:1-4` から公開される。
- `src/modules/notes/remote/index.ts:1-17` が response type、error、notes CRUD、tag options、review operation を公開する。
- `src/modules/notes/remote/transport.ts` が `fetch` と API error decode を担当し、remote 配下には Prisma、filesystem、Next Route Handler import がない。
- `src/modules/notes/remote/types.ts:6-49` の `NoteTag`、list/detail response は UI/HTTP DTO であり、Prisma payload type ではない。

公開 import path は facade 経由に整理され、現在の UI import は `@/modules/notes/contracts`、`@/modules/notes/model`、`@/modules/notes/remote` に寄っている。

#### F-004: server notes application/infrastructure/presenters

通常の流れは次のとおりである。

```text
src/app/api/notes/**/route.ts
  -> src/server/notes/application
       -> src/server/notes/infrastructure
       -> src/server/notes/presenters
            -> modules/notes contracts / shared canvas
```

- `src/server/notes/application/index.ts:1-3` は read/command/tag service の facade。
- `src/server/notes/application/read.service.ts:1-3` は contract input、repository、presenter を組み合わせる。
- `src/server/notes/application/command.service.ts:1-11` は create/update/delete/review の use case を公開し、HTTP status や `NextResponse` を知らない。
- `src/server/notes/infrastructure/index.ts:1-3` は read/command/tag repository の facade。
- `src/server/notes/infrastructure/read.repository.ts:1-37` は Prisma query と include、`read.query.ts` は where 条件と page size を担当する。
- `src/server/notes/infrastructure/notebook.command.repository.ts:22-112` は Notebook、Cue、Tag link、Canvas relation を transaction / command として扱う。
- `src/server/notes/infrastructure/canvas.persistence.ts:1-26` は shared validation、serialize、`extractCanvasSearchText` を保存用 `documentJson` / `searchText` に変換する。
- `src/server/notes/presenters/notes.types.ts:1-25` に Prisma `NotebookGetPayload` 型を閉じ込め、`detail.mapper.ts`、`list.mapper.ts`、`review.mapper.ts` が API DTO へ変換する。

主な DB access、DTO mapping、HTTP adapter の混在は解消されている。

#### F-005: tags API

`src/app/api/tags/route.ts:1-9` は `NextResponse`、`listTagOptions`、共通 error response だけを扱う。Prisma import はない。呼び出しは次の境界である。

```text
src/app/api/tags/route.ts
  -> src/server/notes/application/tag.service.ts:1-5
       -> src/server/notes/infrastructure/tag.repository.ts:1-13
            -> src/server/infrastructure/prisma
```

`tag.repository.ts:3-12` は `id`、`name`、`color` のみを `select` しており、完全な Prisma row を route から直接返してはいない。したがって「tags API が Prisma を直接扱わない」は適合する。

#### F-006: CanvasDocumentV1 facade と分割

- `src/shared/canvas/canvas-document.ts:1-37` は public facade である。
- `canvas-document-types.ts` に `CanvasDocumentV1`、element/page/style type、schema/version/size constants を置く。
- `canvas-document-defaults.ts` に empty/demo document と element id、`canvas-document-geometry.ts` に bounds、`canvas-document-validation.ts` に validation、`canvas-document-serialization.ts` に clone/serialize/restore、`canvas-document-search.ts` に search projection/byte formatting を置く。
- `src/shared/canvas/index.ts:1` は従来の `@/shared/canvas` import path を維持する。
- `src/shared/canvas/canvas-history.ts:1-55` は shared document snapshot history を実装する。
- `src/app/spikes/canvas/_lib/canvas-document.ts:1`、`_lib/canvas-history.ts:1` は shared への互換 facade である。

production `NoteCanvasEditor` は `@/shared/canvas` と `@/shared/canvas/canvas-history` を使い、spike は必要な箇所で `_lib/canvas-document` / `_lib/canvas-history` facade を使う。spike の history 実装が production に逆流する構造はない。

#### F-007: Shared Fabric adapter の境界

`src/shared/canvas/adapters/fabric/index.ts:1` → `fabric-adapter.ts:1-13` が public facade であり、次の内部責務を再公開している。

| 責務 | ファイル |
|---|---|
| structural Fabric types / style change | `fabric-types.ts` |
| style read/write と defaults | `fabric-style.ts` |
| app-owned metadata attach / target resolution | `fabric-metadata.ts` |
| shape object / inline text factory | `fabric-shape-factory.ts` |
| stroke/line/arrow/rect/ellipse/text object factory | `fabric-object-factory.ts` |
| `CanvasDocumentV1` → Fabric hydration | `fabric-document-to-canvas.ts` |
| Fabric object → `CanvasDocumentV1` projection | `fabric-canvas-to-document.ts` |

`src/app/spikes/canvas/_lib/fabric-adapter.ts:1` は shared adapter への互換 facade であり、旧 spike import path を維持する。production の `note-canvas-viewer.tsx:9-14` と `use-note-canvas-runtime.ts:10-18` は shared adapter を直接参照し、production → spike の依存はない。Konva adapter は spike 内に留まる。

#### F-008: Canvas editor/runtime/shape-text/surface/viewer の境界

- `src/app/notes/_components/note-canvas-editor.tsx:50-345` は history、tool/style/page state、runtime 接続、toolbar/surface の composition を所有する。
- `src/app/notes/_lib/use-note-canvas-runtime.ts:69-710` は Fabric dynamic import、canvas lifecycle、pointer/gesture、erase、selection/style event、cleanup をまとめた runtime hook である。
- `src/app/notes/_lib/shape-text-editor-session.ts:155-531` は shape inline text の start/commit/cancel、Escape/blur、detached editor cleanup、Fabric lifecycle を state machine/controller として持つ。
- `src/app/notes/_lib/canvas-editor-contract.ts` と `canvas-runtime-contract.ts` は editor/runtime の interface と型を切り出す。
- `src/app/notes/_components/note-canvas-surface.tsx:25-68` は editor/viewer 共通の DOM surface、ARIA、page dimensions を描画する。
- `src/app/notes/_components/note-canvas-viewer.tsx:29-173` は保存済み document の clone、Fabric read-only hydration、surface、assistive text を担当する。
- `src/app/notes/_lib/canvas-surface.ts:15-53` は DOM/Fabric の page dimensions projection を担当する。

editor と viewer が `NoteCanvasSurface` を共有し、runtime hook と shape-text controller の責務も分かれている。runtime hook は依然大きいが、現状は stateful lifecycle の一体性を優先した妥当な過渡境界である。

#### F-009: Fabric metadata boundary の残存疑義

Handoff §3.3 の「adapter の FabricMetadata、`isCanvasPreview`、`isCanvasShapeTextEditor` は adapter 内部に閉じ込める」という強い契約に対しては、完全適合ではない。

- `src/shared/canvas/adapters/fabric/fabric-metadata.ts:17-39` は `canvasElement` metadata を attach/read する。
- `src/app/notes/_lib/canvas-editor-document.ts:38-87` は `object.get("canvasElement")`、`object.get("isCanvasShapeTextEditor")` を直接読み、metadata/type 判定を再実装する。
- `src/app/notes/_lib/use-note-canvas-runtime.ts:60-66、191-199、221-228、351-352、396-437、440-445` は metadata/preview/editor flag を直接読み書きする。
- `src/app/notes/_lib/canvas-editor-style.ts:78-99` は `readCanvasElement` 経由で同じ Fabric metadata に依存する。

これは Target Architecture の列挙された禁止依存には該当しない。`src/app/notes/_lib` が shared adapter の structural type/API を使うこと自体も問題ではない。ただし、Fabric metadata key の変更理由が shared adapter と production runtime の両方に漏れるため、厳密な adapter boundary を完了扱いにするなら、metadata-aware interaction API を shared adapter facade または明示的な runtime port に寄せる追加 task 候補である。

#### F-010: Server dependency direction の過渡構成

明示的な禁止依存ではないが、Target Architecture の理想図（application → infrastructure / presenters、infrastructure → Prisma/external）に対して、次の type-only import がある。

- `src/server/notes/infrastructure/notebook.command.repository.ts:2-5` → `modules/notes/contracts` の `NotebookInput` と `server/notes/presenters` の `NotebookWithDetailRelations`
- `src/server/notes/infrastructure/review.command.repository.ts:1-3` → `modules/notes/contracts` の `ReviewUpdateInput` と `server/notes/presenters` の `NotebookReviewUpdateRecord`
- `src/server/notes/infrastructure/read.repository.ts:2`、`read.query.ts:2` → `modules/notes/contracts` の `NotesQuery`
- `src/server/notes/infrastructure/canvas.persistence.ts:1`、`relations.repository.ts:2` → `modules/notes/contracts` の `NotebookInput`

contract を server/application と共有する type-only import は機能上自然であり、Prisma payload の runtime 漏出ではない。一方、infrastructure → presenters の型依存は層の上向き依存を作るため、strict 判定では疑義とする。将来整理するなら、repository return 型を server 側の persistence port/type に置くか、application が mapper 入力型を明示的に管理する方法を検討する。

#### F-011: Notes UI の配置は target tree に対する過渡構成

Target Architecture の target tree には `src/modules/notes/ui` があるが、現行 source にはそのディレクトリがなく、UI の実体は次にある。

- `src/app/notes/_components/*.tsx`
- `src/app/notes/_lib/*.ts`

これは import 方向の違反ではない。Target Architecture 自体が target tree を「配置の目安」としており、UI は route boundary の配下に残したまま remote/model/contracts facade を先に成立させる段階移行も許容している。厳密な配置まで完了条件にする場合のみ別の移設 task が必要である。

#### F-012: CSS manifest と cascade

`src/app/globals.css:1-10` は Tailwind と local CSS の import manifest になっている。

```text
1  @import "tailwindcss";
2  foundation.css
3  app-shell.css
4  canvas-spike.css
5  global-reset.css
6  note-paper.css
7  note-canvas-editor.css
8  note-canvas-toolbar.css
9  note-canvas-surface.css
10 note-paper-create-overrides.css
```

要求された段階は `foundation → app shell → spike → reset → note paper → Canvas → override` の順で保たれている。`global-reset.css:1-3` の `* { box-sizing: border-box; }` を spike の後ろに置くこと、`note-paper-create-overrides.css` を最後に置くことは、旧 cascade の順序を維持する判断である。

主要 selector 群の所在は次のとおり。

| selector 群 | 分割先・根拠 |
|---|---|
| token / `:root` / `@theme inline` / body | `src/app/styles/foundation.css:1-48` |
| app chrome / page shell | `src/app/styles/app-shell.css:1-179` |
| spike route / Fabric・Konva comparison | `src/app/styles/canvas-spike.css:3-420`、`canvas-spike-*` class を `src/app/spikes/canvas/_components` が使用 |
| global reset | `src/app/styles/global-reset.css:1-3` |
| paper shell / Cornell grid / Markdown preview / create cascade | `src/app/styles/note-paper.css:2-326` |
| Canvas editor heading / shared editor-viewer rule | `src/app/styles/note-canvas-editor.css:1-16` |
| toolbar、active/focus、style、paper input、responsive rail | `src/app/styles/note-canvas-toolbar.css:1-602` |
| viewport、local horizontal scroll、Fabric canvas、error/assistive text | `src/app/styles/note-canvas-surface.css:1-73` |
| create-only late override | `src/app/styles/note-paper-create-overrides.css:1-17` |

旧 `HEAD:src/app/globals.css` の Tailwind import を除いた本文と、上記 import 順で連結した split CSS を `diff -u` で比較した結果は、境界の空行が除去された差分だけだった。selector、rule、media block の順序逆転や脱落は検出されなかった。したがって現時点では、CSS をさらに role 別に切るより cascade 一体性を維持する方が妥当である。

#### F-013: 200 行超ファイルの全件と判定

`src` 以下の `.ts` / `.tsx` / `.css` を 175 ファイル走査し、200 行超は 13 件だった。

| ファイル | 行数 | 判定 |
|---|---:|---|
| `src/app/spikes/canvas/_components/konva-canvas-interactions.ts` | 214 | spike 固有の pointer/interaction mapping。cohesive で追加分割不要 |
| `src/app/notes/_components/note-canvas-toolbar-style-controls.tsx` | 219 | style input/alignment の state と UI。現状は許容 |
| `src/app/spikes/canvas/_components/use-konva-canvas-stage.ts` | 219 | spike の stage lifecycle/scale/handler 接続。spike 責務として許容 |
| `src/app/notes/_components/note-editor.tsx` | 224 | form/save orchestration の state owner。autosave/409 が増える場合のみ候補 |
| `src/shared/canvas/canvas-document-validation.ts` | 274 | `CanvasDocumentV1` の純粋な validation/normalization。挙動単位を保つ例外 |
| `src/shared/markdown/markdown-field.tsx` | 292 | Markdown editor/preview の shared component。責務は一貫 |
| `src/app/styles/note-paper.css` | 326 | paper shell、Cornell responsive、create-only cascade。行数理由の分割は危険 |
| `src/app/notes/_components/note-canvas-editor.tsx` | 345 | editor orchestration。runtime interface が増えた時の候補 |
| `src/app/styles/canvas-spike.css` | 420 | spike route の isolated responsive/cascade。一体管理が妥当 |
| `src/app/notes/_lib/shape-text-editor-session.ts` | 531 | inline text lifecycle state machine と Fabric cleanup。分割で cleanup 漏れのリスク |
| `src/app/styles/note-canvas-toolbar.css` | 602 | generic/active/focus/media/drawing rail の cascade。分割は優先度低 |
| `src/app/notes/_lib/use-note-canvas-runtime.ts` | 710 | Fabric lifecycle、gesture/erase、selection/style event の stateful runtime。最大の追加分割候補 |

追加分割を検討する順序は、`use-note-canvas-runtime.ts`（initialization/lifecycle、gesture/erase、selection/style の境界を設計できる場合）、次に `note-canvas-editor.tsx` である。`shape-text-editor-session.ts`、`canvas-document-validation.ts`、CSS cascade、spike 固有ファイルは行数だけを理由に分割しない。

#### F-014: 重複実装の確認

- 保存用の Canvas validation/serialization/search は `src/shared/canvas/canvas-document-*` に一元化され、server `canvas.persistence.ts` はそれを呼ぶ。
- `extractCanvasSearchText`（保存・一覧検索）と `extractCanvasEditorText`（editor assistive text）、viewer の text list は用途が異なる projection であり、同じ persistence rule の重複とは判定しない。
- toolbar の `validateDimension`（`note-canvas-toolbar-paper-controls.tsx:22-37`）は即時 UI error 用で、範囲定数は shared から import している。shared document validation の代替ではないため、現状は許容。ただし純粋な page-dimension helper へ寄せる余地はある。
- production の page-aware geometry と Fabric/Konva spike の固定 POC geometry は別 runtime 用であり、同一 adapter の二重実装ではない。
- editor/viewer の empty document constant は双方とも shared `createEmptyCanvasDocument()` を使う。
- 一方、Fabric metadata key の読み書きは `fabric-metadata.ts` と `canvas-editor-document.ts` / `use-note-canvas-runtime.ts` に跨っており、F-009 の adapter-boundary 重複として残る。

#### F-015: 公開 facade、import path、循環

公開入口は次のとおり保たれている。

- `src/shared/canvas/index.ts` と `canvas-document.ts`
- `src/shared/canvas/canvas-history.ts` および spike `_lib/canvas-history.ts`
- `src/shared/canvas/adapters/fabric/index.ts`、`fabric-adapter.ts`、spike `_lib/fabric-adapter.ts`
- `src/modules/notes/contracts/index.ts`、`model/index.ts`、`remote/index.ts`
- `src/server/notes/application/index.ts`、`infrastructure/index.ts`、`presenters/index.ts`
- `src/app/notes/_components/note-canvas-toolbar.tsx:12-26` の旧 toolbar type/constant 再 export

旧 `HEAD` の Canvas document / spike facade の export 名と現行 facade を照合し、`tsc` と lint も通過した。さらに relative import と `@/*` alias を解決する読み取り専用の import graph 走査を実行した結果、TS/TSX 165 ファイル、解決 local edge 389 本、循環 0 件だった。

### Assumptions

| ID | 内容 | 判定への影響 |
|---|---|---|
| A-001 | Target Architecture の `src/modules/notes/ui` は、文書の「配置の目安」と段階移行方針を踏まえ、未配置を直ちに禁止依存とは扱わない。 | strict tree 完了なら追加移設 task が必要 |
| A-002 | infrastructure から `modules/notes/contracts` への type-only import は、HTTP/UI 実装の逆依存ではなく共有 contract 依存として扱う。 | presenter 型への依存だけを境界疑義として残す |
| A-003 | `extractCanvasEditorText` と viewer assistive text の差は、保存検索と表示補助の要件差によるものと扱う。 | 将来検索/アクセシビリティ仕様を統合する場合は再監査が必要 |

### Unknowns

| ID | 内容 | 根拠 / 必要な確認 |
|---|---|---|
| U-001 | refactor 後の fresh `npm run build` は今回実行していない。過去の build PASS は `doc/testing/TEST_SCENARIOS.md` にあるが、今回の split 後の production build の証拠には繰り上げない。 | 実装 task で `npm run build` と生成 CSS を確認 |
| U-002 | Browser runtime QA は未確認。 | Handoff §7.1、`doc/implementation/IMPLEMENTATION_STATUS.md` §5.3、`doc/testing/TEST_SCENARIOS.md` の Canvas QA 記録 |
| U-003 | production runtime が Fabric metadata key を直接扱う境界が、将来の adapter API 変更に対して十分かは runtime では検証していない。 | metadata facade / runtime port を定義する場合に追加設計・型検査 |
| U-004 | infrastructure → presenters の type-only dependency を、今後の strict layering で許容するかは方針未確定。 | Manager が「現行 MVP の概ね適合」か「strict target tree」を選択 |
| U-005 | CSS の Next/Tailwind production chunk 内の最終 cascade は build をしていないため未確認。source の旧本文比較では selector/rule の順序差はなかった。 | build 後 `.next/static/css` と browser screenshot を確認 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS（確認済み） | 開始時点で docs、Canvas/Notes/spike/modules/server/shared の変更、CSS 分割ファイル、直近 summaries が既に存在。指定レポートは absent |
| `npm run lint` | PASS | 終了コード 0。出力は ESLint header のみ |
| `npx tsc --noEmit --pretty false` | PASS | 終了コード 0。出力なし |
| `git diff --check` | PASS | 終了コード 0。whitespace error なし。標準 `git diff` の検査結果 |
| forbidden dependency `rg` audit | PASS | 対象・検索方法・0 matches を F-001 に記録 |
| local import graph | PASS | TS/TSX 165 files、389 local edges、cycle 0 |
| CSS split parity | PASS（source static） | 旧 `globals.css` 本文と split 連結の `diff -u` は境界空行差のみ |
| `npm run build` | 未実行 / 未確認 | `.next` 生成物を変更するため task 制約で実行しない。過去記録は fresh refactor build として扱わない |
| Browser QA | 未実施 / 未確認 | pointer、gesture、inline text、style/erase、保存・再読込、wheel/trackpad/touch、responsive、keyboard/focus/ARIA の実機証跡なし |
| 作業後 `git status --short` | PASS（確認済み） | 作業前に存在した変更は保持。新規に追加する成果物は本レポートだけで、実装コード・設定・依存関係・生成物の変更なし |

## Remaining Unknowns

1. refactor 後の fresh build と production CSS chunk 順序。
2. Canvas の Browser runtime QA（pointer/overlap、4px gesture、shape inline text、style、eraser、保存・再読込、page 外要素）。
3. wheel/trackpad/touch のページ縦 scroll と用紙の局所横 scroll。
4. 375 / 768 / 1280 / 1440px の toolbar responsive、keyboard/touch 到達性、focus/tooltip/ARIA。
5. strict architecture として、`src/modules/notes/ui` への移設、presenter type dependency、Fabric metadata facade、Tag presenter/contract を別 task で必須にするか。

## Next Read

次回作業では、まずこのレポートを読む。

- `summary/20260722/architecture-refactor-final-review-20260722.md`
- `doc/technical/TARGET_ARCHITECTURE.md` の依存方向・移行方針
- `HANDOFF_2026-07-19.md` §7.1 と `doc/testing/TEST_SCENARIOS.md` の Canvas runtime QA 記録

strict 境界の実装 task を起こす場合だけ、次を追加で読む。

- `src/app/notes/_lib/use-note-canvas-runtime.ts`
- `src/app/notes/_lib/canvas-editor-document.ts`
- `src/server/notes/infrastructure/notebook.command.repository.ts`
- `src/server/notes/infrastructure/review.command.repository.ts`
- `src/app/api/tags/route.ts` と `src/server/notes/application/tag.service.ts`

## 最終明記

- 実装追加 task の要否: 現行 MVP を止める実装追加は不要。ただし strict target tree、Fabric metadata boundary、infrastructure/presenter の層依存、Tag contract を完了条件にする場合は、別の小さな追加 task が必要。
- 現時点のアーキテクチャ判定: 「概ね適合（条件付き）」。禁止依存なし、公開 facade 破壊なし、循環 import なし、CSS selector/rule の split 順序差なし。ただし F-009〜F-011 の過渡構成・境界疑義を残すため、strict 完了とは判定しない。
- ブラウザ QA の未確認範囲: Canvas pointer/overlap、gesture threshold、shape inline text lifecycle、style/metadata/eraser、UI 保存・再読込、page 外要素、wheel/trackpad/touch scroll、375/768/1280/1440px responsive、keyboard/focus/tooltip/ARIA。API runtime と source static PASS は Browser PASS に繰り上げない。
