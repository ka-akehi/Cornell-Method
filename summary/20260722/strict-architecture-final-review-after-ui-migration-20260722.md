# Strict Target Architecture Final Review After Notes UI Migration

監査日: 2026-07-22（JST）
監査対象: 最新 working tree の source / configuration / architecture boundary

## Objective

Target Architecture の strict Notes UI migration 完了後の source を再監査し、依存方向、公開 facade、責務境界、Canvas/Fabric boundary、Tags boundary、CSS 分割、ファイル分割状況を具体的な検索結果と source path で記録する。

この task ではコード、設定、依存関係、Prisma、CSS、生成物を変更していない。成果物は本レポートのみである。

## Scope

- `AGENTS.md`
- `doc/technical/TARGET_ARCHITECTURE.md`
- `doc/implementation/MVP_CONTRACT.md`
- `HANDOFF_2026-07-19.md`
- `src/app/notes`
- `src/modules/notes`
- `src/server/notes`
- `src/shared/canvas`
- `src/shared/http`
- `src/shared/ui`
- `src/app/_components/app-chrome.tsx`
- `src/app/api/tags/route.ts`
- 直前の migration plan と strict refactor summaries

判定対象は current source である。過去 summary 内の旧 path は作業履歴として扱い、runtime import の判定には使用していない。

## Inputs Read

### Primary references

- `AGENTS.md` — repository / Worker policy、MVP と Phase 2 の境界、Canvas・Tag の製品仕様
- `doc/technical/TARGET_ARCHITECTURE.md` — `src/app/**`、module、server、shared の責務と依存方向（特に `:149-323`）
- `doc/implementation/MVP_CONTRACT.md` — current MVP の route、API、CanvasDocumentV1、Tag、browser QA 未確認の扱い
- `HANDOFF_2026-07-19.md` — 現在の Canvas 契約、過去の静的検証、Browser runtime QA 未確認の基線

### Migration / strict refactor inputs

- `summary/20260722/strict-notes-ui-module-migration-plan-20260722.md`
- `summary/20260722/0328-architecture-refactor-detailed-final-review-20260722-c4c8b2a3-summary.md`
- `summary/20260722/0340-architecture-strict-21-isolate-server-persistence-types-20260722-46be7d29-summary.md`
- `summary/20260722/0342-architecture-strict-22-add-tags-contract-presenter-20260722-5f8b3ee7-summary.md`
- `summary/20260722/0351-architecture-strict-23-design-notes-ui-module-migration-20260722-254ca503-summary.md`
- `summary/20260722/0357-architecture-strict-24-app-chrome-shared-bridge-20260722-badd21c3-summary.md`
- `summary/20260722/0358-architecture-strict-25-client-safe-http-facade-20260722-c9307475-summary.md`
- `summary/20260722/0402-architecture-strict-26-fabric-metadata-semantic-api-20260722-58f3974d-summary.md`
- `summary/20260722/0407-architecture-strict-27-move-notes-canvas-pure-helpers-20260722-dc2362e3-summary.md`
- `summary/20260722/0411-architecture-strict-28-promote-canvas-surface-shared-20260722-72979785-summary.md`
- `summary/20260722/0416-architecture-strict-29-move-notes-canvas-hooks-20260722-30e4cb6d-summary.md`
- `summary/20260722/0422-architecture-strict-30-move-notes-canvas-components-20260722-6b620b76-summary.md`
- `summary/20260722/0427-architecture-strict-31-move-notes-editor-detail-components-20260722-eef8b189-summary.md`
- `summary/20260722/0436-architecture-strict-32-move-notes-list-components-20260722-7d9d338a-summary.md`
- `summary/20260722/0442-architecture-strict-33-cleanup-notes-route-legacy-20260722-d5d0ed43-summary.md`
- `summary/20260722/0245-css-split-design-audit.md`
- `summary/20260722/0252-css-ref-19-audit-global-css-boundaries-20260722-9b56afb1-summary.md`
- `summary/20260722/0301-css-ref-20-split-global-css-20260722-8cb62ab6-summary.md`

## Changes Made

- `summary/20260722/strict-architecture-final-review-after-ui-migration-20260722.md` を新規作成した。
- source、設定、依存関係、Prisma schema / migration、CSS、生成物は変更していない。
- 作業前後の `git status --short` で、既存の UI migration 変更、削除済み legacy path、同時進行の strict summaries を保持していることを確認した。

## Findings

### 1. Forbidden dependency search

#### Search method

TypeScript / TSX の local import・export・dynamic import を resolver 付きの一時 Node script で解析した。`@/*` alias、relative import、extension、省略された `index` を解決し、`src` 全体の graph を作成した。補助的に `rg` で禁止 token と旧 path を検索した。

Graph の対象は `src` 配下の TS / TSX / MTS / JS / JSX で、`174 nodes / 444 resolved local edges` だった。未解決 local import は CSS entry の `src/app/layout.tsx:2 -> ./globals.css` のみで、CSS は別 manifest で確認した。

| 禁止依存 | 結果 | 根拠 |
| --- | ---: | --- |
| `src/modules/notes/ui` / `src/modules/notes/lib` -> `src/app/**` | **0** | graph edge search |
| `src/modules/notes/ui` / `lib` / `remote` / `model` -> `src/server/**` | **0** | graph edge search |
| 同上 -> Prisma、`next/server`、filesystem import | **0** | graph と `rg -n '@/server|@prisma|next/server|NextResponse|fs|node:fs|path|node:path'` |
| `src/server/notes/infrastructure` -> `src/server/notes/presenters` | **0** | graph edge search、infrastructure 全体の `presenters|formatNote|formatTag` search |
| repository / infrastructure -> React、Next UI、HTTP response、browser API | **0** | import specifier scan と browser API token scan |
| production `src/app/notes` -> `src/app/spikes` | **0** | graph edge search |
| route page -> 旧 `_components` / `_lib` / `types.ts` | **0** | route page import scan |
| module UI -> `remote` / `model` / `contracts` の internal deep path | **0** | `@/modules/notes/(remote|model|contracts)/...` scan |

Graph の循環検出は **0 cycles** だった。従って、今回の移行後 source には、指定された app/server/infrastructure 方向の逆依存や local import cycle は確認されない。

### 2. Route composition and public facades

#### Fact

- `src/app/notes/page.tsx:1` は `@/modules/notes/ui/components` の `NotesList` だけを配置する。
- `src/app/notes/new/page.tsx:1-7` は `note-paper-page` wrapper と、同じ components facade の `NoteEditor mode="create"` だけを配置する。
- `src/app/notes/[id]/page.tsx:1-37` は `params` の解決、`getNoteDetail` の server application 初期 read、404 表示、paper wrapper、components facade の `NoteDetailModes` 配置を担う。初期 detail の DB access / DTO mapping は page に直書きされていない。
- `src/app/notes` の production route は上記 3 page のみである。
- `src/modules/notes/ui/components/index.ts:1-46` は `NoteEditor`、`NoteDetailModes`、`NotesList`、Canvas editor/viewer/surface/toolbar と公開 type / toolbar definition を再公開する。
- `src/modules/notes/ui/hooks/index.ts:1-7` は `useNoteCanvasRuntime` と runtime contract type、`RuntimeRef` を再公開する。
- page 外からの components facade consumer は上記 3 route page のみである。`useNoteCanvasRuntime` の screen-level direct consumer はなく、`NoteCanvasEditor` だけが hooks facade を利用する。
- UI leaf component 同士は同一 directory の relative import を使い、barrel 自身を相互 import していない。

#### 判定

Route composition と module UI の公開入口は Target Architecture の想定に適合する。page は route composition / 初期 read / 404 / public component 配置に留まり、UI state や Prisma shape を持たない。

### 3. Modules UI / hooks / lib dependency direction

Graph の直接 edge を層別集計した結果は次のとおりである。

| source layer | direct target layers |
| --- | --- |
| `components` | components、hooks、lib、remote、model、contracts、shared |
| `hooks` | hooks、lib、shared |
| `lib` | lib、shared |
| `remote` | remote、contracts、shared |
| `model` | model、contracts、shared |

`components -> hooks/lib -> shared` の主方向が成立し、`hooks -> components`、`lib -> hooks/components`、UI / lib -> app/server の逆方向は 0 件だった。React / Next navigation は UI の browser / route interaction として components に閉じており、server import ではない。

`src/modules/notes/lib` は Canvas type / helper と shared Canvas/Fabric facade のみを扱い、React component / hook、app、server、Prisma、Next server を import しない。

### 4. AppChrome provider / reporter boundary

#### Fact

- `src/shared/ui/app-chrome-state.tsx:1-73` が `AppChromeMode`、context、`AppChromeStateProvider`、`useAppChromeState`、`AppChromeModeReporter` を所有する。
- `src/app/_components/app-chrome.tsx:7-17` は shared provider / type を利用し、`AppChrome` の pathname 判定、nav、badge 描画を app shell の責務として保持する。
- `src/modules/notes/ui/components/note-editor.tsx` と `note-detail-modes.tsx` は `@/shared/ui/app-chrome-state` の reporter を利用する。
- `src/modules/notes/ui` に `@/app/_components/app-chrome` import は 0 件である。

#### 判定

Provider / reporter の boundary は shared にあり、Notes UI が app shell の実装へ逆依存しない。互換名の再 export は app shell 側に留まり、module UI には漏れていない。

### 5. HTTP client-safe boundary

- `src/shared/http/client.ts:1-12` は `ApiErrorBody`、`ApiErrorCode`、`ApiFieldError`、`decodeApiErrorResponse`、`isApiErrorBody` の client-safe facade である。
- `client.ts` の `next/server`、`NextResponse`、Prisma、filesystem、`server-only` import は **0** 件。
- `src/modules/notes/remote`、`model`、UI の shared/http import は `@/shared/http/client` のみで、`@/shared/http` の server-inclusive barrel を参照しない。
- `src/shared/http/index.ts` が `route-response` を server 側互換入口として再 export する構成は残るが、module client graph には入っていない。

#### 判定

client/server HTTP boundary は strict 条件に適合する。

### 6. CanvasDocumentV1 / history / surface / Fabric boundary

#### Fact

- `CanvasDocumentV1` の type 正本は `src/shared/canvas/canvas-document-types.ts:77-86` に一つだけ存在する。
- validation / serialization / restore / search projection は `src/shared/canvas` にあり、`src/modules/notes/contracts/canvas.schema.ts:1-19` は shared `validateCanvasDocument` を Zod contract に接続するだけで保存形式を複製しない。
- history の正本は `src/shared/canvas/canvas-history.ts:1-52`、surface dimension helper の正本は `src/shared/canvas/canvas-surface.ts:1-57`、Fabric conversion / metadata / style の正本は `src/shared/canvas/adapters/fabric/**` にある。
- module 側の `CanvasDocumentV1` 利用は shared からの type import であり、module UI / lib に同名の保存契約定義はない。
- `src/server/notes/infrastructure/canvas.persistence.ts:1-29` は shared validation / serialization / search projection を使って `documentJson` / `searchText` を作る。Canvas JSON を server presenter や UI に重複定義していない。
- `src/server/notes/presenters/detail.mapper.ts:1-30` は保存 JSON を shared `restoreCanvasDocument` で復元し、stored schema version と照合する。

#### Fabric semantic API search

- raw metadata key literal (`"canvasElement"`、`"isCanvasPreview"`、`"isCanvasShapeTextEditor"`) の Notes module 内件数は **0**。
- Notes module から `fabric-style`、`fabric-metadata`、`@/shared/canvas/adapters/fabric/fabric-*` の private deep import は **0**。
- `isCanvasPreviewObject`、`markCanvasPreviewObject`、`isCanvasShapeTextEditorObject`、`readCanvasElementType`、`applyFabricObjectStyle` などの semantic operation は `@/shared/canvas/adapters/fabric` の public facade を介して利用される。
- `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts` の Fabric object `get/set` は style / position / interaction の公開 runtime property に限られ、metadata key の raw access ではない。

#### Strict gap / judgment

`src/modules/notes/ui/components/note-canvas-editor.tsx:16-21` は history を `@/shared/canvas/canvas-history` から deep import している。一方、migration plan の public entry 方針は `@/shared/canvas` を CanvasDocumentV1 / history / surface の入口として記載しているが、現行 `src/shared/canvas/index.ts:1-35` は history を再 export していない。

これは保存契約の複製や禁止方向の逆依存ではないため、Canvas の source ownership 自体は **PASS** と判定する。ただし「shared public facade を唯一の入口」と strict に解釈する場合は、history の public export を揃える必要がある。今回の audit では制約上修正しない。

### 7. Tags contract / presenter / repository / application / route

Tags の依存経路は次のように成立している。

```text
src/app/api/tags/route.ts
  -> src/server/notes/application/tag.service.ts
     ├-> src/server/notes/infrastructure/tag.repository.ts
     └-> src/server/notes/presenters/tag.mapper.ts
         -> src/modules/notes/contracts/tag.schema.ts
```

具体的には、次の境界を確認した。

- `src/modules/notes/contracts/tag.schema.ts:1-31` が `tagSchema`、`TagDto`、`TagOptionsResponse` を所有する。
- `src/server/notes/infrastructure/tag.repository.ts:1-15` は Prisma で `id/name/color` を名前昇順取得するだけで、presenter / HTTP / React を参照しない。
- `src/server/notes/presenters/tag.mapper.ts:1-16` が persistence record を `TagDto` に変換し、`src/server/notes/presenters/index.ts:1-2` から再公開する。
- `src/server/notes/application/tag.service.ts:1-8` が repository 結果を presenter mapper に渡す。HTTP status / `NextResponse` は知らない。
- `src/app/api/tags/route.ts:1-13` が `NextResponse`、application service、server-safe HTTP error helper を組み合わせる薄い HTTP adapter になっている。
- `src/server/notes/infrastructure` から `src/server/notes/presenters` への import は **0**。presenter import は `read.service.ts`、`command.service.ts`、`tag.service.ts` の application 層だけである。
- `@prisma` import は `src/server` の内部に閉じ、`src/modules`、`src/shared`、`src/app` には漏れていない。

#### 判定

Tags contract / presenter / repository / application / route boundary は strict 条件に適合する。MVP が `GET /api/tags` のみを提供する契約とも整合する。

### 8. Legacy Notes path cleanup

Filesystem check:

```text
ABSENT src/app/notes/_components
ABSENT src/app/notes/_lib
ABSENT src/app/notes/types.ts
```

`src/app/notes` に残る file は `page.tsx`、`new/page.tsx`、`[id]/page.tsx` の 3 route page のみである。current source の旧 `_components` / `_lib` / `types.ts` import は **0** 件。過去 strict summary / migration plan に旧 path が記載されているのは移行履歴であり、current production import ではない。

### 9. Source line count and split judgment

`rg --files src -g '*.ts' -g '*.tsx' -g '*.css'` で列挙し、各 file に `wc -l` を適用した。`src` には `125 ts`、`44 tsx`、`10 css` があり、200 行超は次の 12 file だった。

| lines | file | responsibility judgment |
| ---: | --- | --- |
| 714 | `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts` | stateful Fabric lifecycle、gesture、erase、selection、style event を協調する runtime。責務上の例外として現状維持は妥当だが、最大の将来分割候補。 |
| 602 | `src/app/styles/note-canvas-toolbar.css` | toolbar 全体の cascade、focus、active/disabled、responsive rule。role 単位に機械分割すると order / specificity が壊れやすい。責務上の例外。 |
| 531 | `src/modules/notes/ui/hooks/shape-text-editor-session.ts` | 図形内 text editor の lifecycle state machine と Fabric cleanup。分割による cleanup 漏れリスクが高い。責務上の例外。 |
| 420 | `src/app/styles/canvas-spike.css` | Fabric / Konva 比較 spike の隔離 CSS。production Notes ではないため今回の追加分割対象外。 |
| 345 | `src/modules/notes/ui/components/note-canvas-editor.tsx` | history、runtime、toolbar、surface の stateful composition。runtime interface が増える場合のみ分割候補。 |
| 326 | `src/app/styles/note-paper.css` | paper DOM hierarchy、Cornell rule、form control、media override の cascade。責務上の例外。 |
| 292 | `src/shared/markdown/markdown-field.tsx` | Markdown input / preview / sanitize / checkbox 表示をまとめる shared component。契約境界が一つであり、現時点で必須分割ではない。 |
| 274 | `src/shared/canvas/canvas-document-validation.ts` | CanvasDocumentV1 の単一 validation / normalization boundary。保存契約を分割して drift させないための責務上の例外。 |
| 224 | `src/modules/notes/ui/components/note-editor.tsx` | form state と save / create / update orchestration の owner。autosave / 409 が追加される時点で分割候補。 |
| 219 | `src/modules/notes/ui/components/note-canvas-toolbar-style-controls.tsx` | style input の local state、range validation、alignment control の composition。現状は一つの style control boundary に収まる。 |
| 219 | `src/app/spikes/canvas/_components/use-konva-canvas-stage.ts` | spike runtime。production Notes strict boundary の追加分割対象外。 |
| 214 | `src/app/spikes/canvas/_components/konva-canvas-interactions.ts` | spike interaction runtime。production Notes strict boundary の追加分割対象外。 |

#### Split conclusion

strict boundary の観点で直ちに追加分割が必要な file はない。実際の次候補は `use-note-canvas-runtime.ts` だが、Fabric lifecycle と event cleanup をさらに細かく分ける場合は browser QA と挙動 characterization を先に行い、runtime orchestration の境界を決めるべきである。`note-editor.tsx` は autosave / 409 を実装する時にのみ再評価する。行数だけを理由に split task を追加しない。

### 10. CSS globals import manifest and source parity

#### Import manifest

`src/app/globals.css:1-10` を解析し、`src/app/styles/*.css` の実体と set comparison を行った。

- Tailwind import: 1 (`@import "tailwindcss"`)
- local split CSS import: **9**
- split CSS files: **9**
- unimported split CSS: **0**
- missing imported CSS: **0**
- duplicate local import: **0**
- root `src/app/layout.tsx:3` の `globals.css` import: **1**

現行の import order は `foundation -> app-shell -> canvas-spike -> global-reset -> note-paper -> note-canvas-editor -> note-canvas-toolbar -> note-canvas-surface -> note-paper-create-overrides` である。

#### Source parity scan

split CSS の custom selector（`app-*`、`note-*`、`canvas-spike-*`、`markdown-*`、Fabric generated DOM class）を source TS / TSX の literal class usage と照合した。107 CSS class selector のうち custom selector は 106。literal match がないものは 6 だった。

- 動的生成で説明できるもの: `note-canvas-toolbar-group--operation`、`note-canvas-toolbar-group--erase`（`note-canvas-toolbar-group--${group.key}`）、`.canvas-container`、`.upper-canvas`（Fabric が生成する DOM）
- current source に literal usage がないもの: `.note-paper-kicker`（`src/app/styles/note-paper.css:45`）、`.note-canvas-paper-size-helper`（`src/app/styles/note-canvas-toolbar.css:253`）

従って import manifest は parity しているが、selector source parity には上記 2 件の stale / unused 候補が残る。今回の audit は read-only 制約のため CSS cleanup は行わない。これは依存方向の違反ではなく、低優先度の CSS hygiene 残課題である。

## Verification

| command | result | record |
| --- | --- | --- |
| `npm run lint` | **PASS** | ESLint が終了コード 0。error / warning output なし。 |
| `npx tsc --noEmit --pretty false` | **PASS** | 終了コード 0。type error output なし。 |
| `git diff --check` | **PASS** | whitespace error なし。 |
| `npm run build` | **NOT RUN** | 生成物を変更しない audit 制約により実行しない。current source に対する fresh build は unknown。 |
| Browser runtime QA | **NOT RUN** | Browser 操作・目視・local server runtime は実施していない。 |

`git status --short` は作業前と検証後に確認した。既存の migration source change、削除済み legacy path、同時進行 summary は保持され、Worker が追加した repository artifact は本レポートのみである。

## Remaining Unknowns

| ID | type | 内容 | 次に必要な確認 |
| --- | --- | --- | --- |
| U-001 | unknown | current working tree に対する `npm run build` の fresh result は未確認。 | 別の build verification task で実行し、生成物を commit 対象にしないことを確認する。 |
| U-002 | unknown | `/notes`、`/notes/new`、`/notes/[id]` の list -> detail -> edit -> save -> view -> review -> delete の browser runtime は未確認。 | Browser runtime QA と、Handoff / `doc/testing/TEST_SCENARIOS.md` の Canvas scenario 実機証跡。 |
| U-003 | assumption / design gap | migration plan の public entry を厳密に適用する場合、`canvas-history` の deep import と `shared/canvas/index.ts` の未再公開が不一致。 | history export を public facade に揃えるか、deep import を許容する設計判断を明文化する。今回は変更しない。 |
| U-004 | fact / cleanup | CSS の `.note-paper-kicker` と `.note-canvas-paper-size-helper` は current TS / TSX literal usage がない。 | source parity を再確認した上で、意図した将来 selector でなければ別 CSS cleanup task で削除する。 |

## Next Read

次回この監査または残課題に着手する場合は、次の最小範囲から読む。

1. `summary/20260722/strict-architecture-final-review-after-ui-migration-20260722.md`
2. `doc/technical/TARGET_ARCHITECTURE.md:285-323`
3. `summary/20260722/strict-notes-ui-module-migration-plan-20260722.md` の `Public entry points`、`Dependency Rules`、`Task 7`、`Task 8`
4. `src/shared/canvas/index.ts` と `src/shared/canvas/canvas-history.ts`
5. `src/modules/notes/ui/components/note-canvas-editor.tsx:14-22`
6. `src/app/globals.css`、`src/app/styles/note-paper.css:45`、`src/app/styles/note-canvas-toolbar.css:253`
7. `HANDOFF_2026-07-19.md` の Browser QA / Canvas 未確認範囲

## 最終判定

### Strict Target Architecture 適合性

**主要な strict boundary は適合（static structural PASS）。** 禁止依存、循環、route page の旧 path、module UI の server/app shell 逆依存、client-safe HTTP、Fabric raw metadata key / private style path、Tags の application boundary、旧 Notes implementation path はすべて指定検索で 0 件だった。CanvasDocumentV1、validation、serialization、history、surface、Fabric adapter の source ownership も shared にあり、module UI に保存契約の複製はない。

ただし、完全な strict closeout としては残課題がある。migration plan の public facade 方針を厳密に採るなら history の deep import が一件あり、CSS source parity には unused 候補が 2 件ある。どちらも今回の禁止依存・実行時挙動を直接示す違反ではないが、設計の公開入口と CSS hygiene を揃える余地として記録する。

### 残課題

- `@/shared/canvas/canvas-history` を shared Canvas public facade へ揃えるか判断する。
- `.note-paper-kicker` / `.note-canvas-paper-size-helper` の意図を確認し、必要なら別 cleanup task で整理する。
- fresh build を別途実行する。

### Browser QA 未確認範囲

Browser runtime は本監査の判定対象外で未確認である。Canvas の pointer / drag / erase / shape inline text / style / undo-redo / page resize 後の geometry 不変、Fabric DOM の scroll、route の実際の保存・再読込・review・delete、各 viewport の表示は static lint / typecheck / graph PASS からは判定できない。したがって、MVP static/API verification と Browser QA PASS を混同せず、runtime 未確認のまま残す。
