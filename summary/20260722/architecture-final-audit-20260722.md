---
summary_type: architecture-audit
created_at: 2026-07-22
task_kind: worker-task
task_status: completed
---

# Architecture final audit

## Scope and method

監査対象は `AGENTS.md`、`HANDOFF_2026-07-19.md`、`doc/technical/TARGET_ARCHITECTURE.md`、`doc/implementation/MVP_CONTRACT.md`、指定された notes / Canvas / server / shared / CSS ソースである。直近の refactor summary は経緯確認に限定し、判定は現行ソース、公開 facade、import graph、行数、静的検証を根拠にした。

監査開始前の `git status --short` では、今回のリファクタリングに該当する変更を含むユーザーの未コミット変更がすでに存在していた。監査中は実装コード、設定、依存関係、生成物を編集していない。監査結果だけを本 summary に記録する。

## Findings

### Overall decision

リファクタリングの主要な依存方向と責務分離は、Target Architecture に概ね適合している。禁止依存は検出されず、公開 facade も `tsc` と lint を通過している。現行 MVP の実装を止める構造的な不整合は確認できなかった。

ただし、Target Architecture のツリーに対して次の二つは過渡構成または境界の弱点として残る。

- ノートの UI 実装は `src/modules/notes/ui` ではなく `src/app/notes/_components` と `_lib` に置かれている。app boundary は薄いが、配置まで厳密に適合させるなら別の移設 task が必要である。
- tags API は route handler → application service → repository の境界を持つが、専用 presenter / 明示的な `TagOption` response contract を経ず、repository の select 結果をそのまま返している。現在は Prisma payload 全体の漏出ではないが、Target Architecture の presenter 契約を厳密に適用するなら小規模な補強候補である。

したがって判定は「現在の MVP/refactor は実装上ほぼ完了。ただし strict な target tree と presenter 契約まで完了条件に含めるなら追加実装 task が必要。ブラウザ QA は別途未確認」である。

### F-001: app/page/route handler の boundary — 適合

- `src/app/page.tsx` は `/notes` への redirect のみである。
- `src/app/notes/page.tsx`、`src/app/notes/new/page.tsx` は UI を呼び出す薄い page boundary である。
- `src/app/notes/[id]/page.tsx` は remote の `fetchNoteDetail`、URL 組み立て、not-found 表示、UI 呼び出しに留まっている。
- `src/app/api/notes/route.ts`、`src/app/api/notes/[id]/route.ts`、review route は contract validation、application service 呼び出し、`NextResponse` / エラー status への変換だけを担当している。
- `src/app/api/tags/route.ts` も `listTagOptions()` の呼び出しと JSON/error response の変換だけで、Prisma や UI state を持たない。

page/route handler への business logic、Prisma query、DTO mapper の混入は確認できなかった。

### F-002: modules の contracts/model/remote — 概ね適合、UI 配置のみ過渡

- `src/modules/notes/contracts/index.ts` が `note.schema.ts` 以下の notebook、canvas、cue、date、query、review、tag schema/type を公開している。
- `src/modules/notes/model/index.ts` が editor form と display model を公開している。form の initial/errors/payload/types も model facade から辿れる。
- `src/modules/notes/remote/index.ts` が response type、transport/error、notes/tags/review operations を公開している。
- remote は fetch と API error/response の扱いに限定され、Prisma、filesystem、Next route handler は import していない。
- UI component は controlled props と model/remote contract を使い、Prisma payload type を直接参照していない。

一方、UI component/hook の実体は `src/app/notes/_components` と `src/app/notes/_lib` にある。これは route boundary と domain UI の配置がまだ app 側に残る過渡構成であり、禁止依存ではない。Target Architecture の `src/modules/notes/ui` を実装上の必須配置とする場合は、移設と import path 確認を別 task に切り出すべきである。

`src/app/notes/types.ts` には現在の runtime path から参照されていない `Tag`、Phase 2 用の `CueCard` / `NoteCard` 型が残っている。実害はないが、過渡的な dead type として将来の整理候補である。

### F-003: server application/infrastructure/presenters — 適合

- `src/server/notes/application/*` は contract、repository、presenter を組み合わせる use case / transaction policy を持ち、React、Next、HTTP response を import していない。
- `src/server/notes/infrastructure/*` は Prisma query、command、relation、review、tag、canvas persistence を担当し、HTTP、Next、React、browser global、fetch を import していない。
- `src/server/notes/presenters/*` が Prisma payload を読み取り、detail/list/review の API DTO へ変換している。
- Prisma payload type の参照は `src/server/notes/presenters/notes.types.ts` に閉じており、UI/remote へ persistence shape を漏らしていない。

read query、command repository、relation repository、review repository の分割後も、application → infrastructure / presenters の向きは保たれている。server から UI への逆依存や repository から HTTP への依存は確認できなかった。

### F-004: tags API — 境界は適合、presenter 契約は補強候補

`src/app/api/tags/route.ts` → `src/server/notes/application/tag.service.ts` → `src/server/notes/infrastructure/tag.repository.ts` の流れは薄い route / application / infrastructure の構造になっている。repository の `findMany` は `{ id, name, color }` に select されており、完全な Prisma payload をそのまま公開しているわけではない。

ただし、`tag.service.ts` は `findTagOptions()` の戻り値をそのまま返し、notes presenter のような明示的な `TagOption` mapper/contract はない。将来 Tag の persistence 列が増えた際に API shape と DB shape が近づきやすいため、strict 判定では専用 contract + presenter を追加する候補とする。

### F-005: Canvas public facade — 適合

- `src/shared/canvas/canvas-document.ts` が `CanvasDocumentV1`、page/element/style 型、default、geometry、validation、serialization、search projection を公開する中心 facade である。
- `src/shared/canvas/index.ts` が canvas-document facade を再公開する。
- 内部は `canvas-document-types.ts`、defaults、geometry、size、validation、serialization、search に分割されている。
- `src/shared/canvas/canvas-history.ts` に history の shared 実装があり、production notes は `@/shared/canvas/canvas-history` を参照している。
- `src/app/spikes/canvas/_lib/canvas-history.ts` と `_lib/canvas-document.ts` は shared への互換 facade である。spike は facade を使うが、production notes から spike への import はない。

Canvas document は app-owned JSON を正本としており、Fabric/Konva の runtime object を保存形式にしていない。公開 import path の破壊、shared ↔ spike の facade cycle は確認できなかった。

### F-006: Fabric adapter — shared 化と内部分割は適合

- `src/shared/canvas/adapters/fabric/index.ts` が Fabric adapter facade である。
- `fabric-adapter.ts` は公開 facade として types/style/metadata/object factory/document roundtrip を再公開する。
- `fabric-canvas-to-document.ts`、`fabric-document-to-canvas.ts`、metadata、object/shape factory、style、types に内部責務が分割されている。
- `src/app/spikes/canvas/_lib/fabric-adapter.ts` は shared adapter への facade で、既存 spike import path を保っている。

Fabric/Konva の spike 実装と production Canvas の依存方向は分離されている。Konva adapter は spike 内部に留まり、production notes から `src/app/spikes` を参照していない。

### F-007: Canvas editor/runtime/shape-text/surface — 責務は分離、runtime は最大の分割候補

- `note-canvas-editor.tsx` は editor 側の history、tool/style/page state、runtime との接続を所有する orchestration component である。
- `use-note-canvas-runtime.ts` は Fabric canvas lifecycle、pointer/gesture、erase、selection/style event をまとめる stateful runtime boundary である。
- `shape-text-editor-session.ts` は inline text editing の状態機械、commit/cancel、Escape/blur、Fabric object cleanup を所有する。
- `canvas-editor-contract.ts` / `canvas-runtime-contract.ts` は editor/runtime の接続型を切り出している。
- `note-canvas-surface.tsx`、`canvas-surface.ts` は canvas surface と表示・resize の責務を持つ。

`use-note-canvas-runtime.ts` は 710 行で最大だが、Fabric lifecycle と pointer/gesture/event cleanup を分割した場合に挙動を壊しやすい。現状は stateful runtime として妥当で、直ちに分割する必要はない。ただし機能追加時には initialization/lifecycle、gesture/erase、selection/style integration へ分ける優先候補である。

### F-008: Canvas 保存・検索・用紙サイズ契約 — 保存経路は一元化、表示 projection に限定的な重複

- `src/server/notes/infrastructure/canvas.persistence.ts` は shared の validation/serialization/search を使い、`documentJson` と `searchText` を保存用に組み立てる。
- presenter は保存済み Canvas document を shared serializer/restore で復元し、list は `hasCanvas` を返す。用紙サイズ変更のための別 DB column や Prisma migration はない。
- `extractCanvasSearchText` は text/rect/ellipse の要素を z-order で投影し、用紙サイズ変更で検索文字列を変えない契約を保っている。
- page width/height の既定値・許容範囲・整数性は shared contract を中心に使っている。

次の重複は persistence contract の二重実装ではなく、表示/入力補助の projection または UI validation である。ただし将来の drift 防止候補として記録する。

- `src/app/notes/_lib/canvas-editor-document.ts` の `extractCanvasEditorText` は、保存用 `searchText` とは目的が異なる編集補助用文字列で、shape/text の選別と区切り文字が異なる。
- `note-canvas-viewer.tsx` は assistive rendering 用に text-bearing element を独自に抽出・sort している。保存検索と表示読み上げの要件が変わる場合に差が出る可能性がある。
- `note-canvas-toolbar-paper-controls.tsx` は即時 UI エラー表示のために寸法の整数・範囲をローカル検証している。shared の min/max と役割が重なるため、純粋な dimension validator へ寄せる余地がある。
- `canvas-editor-geometry.ts` の pointer clamp、Konva spike の `displayScale`、Fabric adapter の dimension fallback は、それぞれ interaction/render fallback であり、保存用 page contract の重複実装とは判定しない。

### F-009: Notes editor/detail/list の state owner — 概ね適合

- `note-editor.tsx` が form state、saving/message/field errors、Canvas errors、save/cancel を所有する。
- metadata/title/source/tags、cue、body/Canvas、summary は `note-editor-metadata.tsx`、`note-editor-cues.tsx`、`note-editor-body.tsx`、`note-editor-summary.tsx` などの controlled section に分割されている。
- `note-detail-modes.tsx` が view/edit/review mode、note snapshot、showBody/showSummary、review/delete/loading/error を所有し、read view/display/actions は表示・操作に留まる。
- `notes-list.tsx` が query/from/to/selectedTags、loading/errors、result/pagination state を所有し、filters/results/cards/tags/pagination を分割している。

親 state owner と子表示責務の境界は明確で、UI から Prisma payload への直接依存はない。現状の主な論点は責務混在ではなく、前述の app 側配置である。

### F-010: CSS manifest/cascade — 適合

`src/app/globals.css` は Tailwind import と CSS module の import manifest になっている。現在の順序は次のとおりで、分割前の selector/rule の相対順序を維持している。

1. Tailwind
2. `foundation.css`
3. `app-shell.css`
4. `canvas-spike.css`
5. `global-reset.css`
6. `note-paper.css`
7. `note-canvas-editor.css`
8. `note-canvas-toolbar.css`
9. `note-canvas-surface.css`
10. `note-paper-create-overrides.css`

`global-reset.css` が spike と note paper の間にあるのは、分割前の `*` reset の cascade 位置を保存したものとして妥当である。foundation/app shell/spike/note paper/Canvas/late override の意図した段階は保持されている。

分割前の `HEAD:src/app/globals.css` と現行の import 順で selector/rule 構造を照合した結果、selector の脱落、`note-paper-editor--create` の late override の前倒し、Canvas toolbar の generic/active/media rule の順序逆転は確認できなかった。`app-shell.css` は 179 行で閾値近辺だが、現状の責務で追加分割する根拠は弱い。

### F-011: 200 行超ファイルの妥当性と分割候補

行数集計対象は `src` 以下の `.ts` / `.tsx` / `.css` である。200 行超は次のとおり。

| ファイル | 行数 | 判定 |
| --- | ---: | --- |
| `src/app/spikes/canvas/_components/konva-canvas-interactions.ts` | 214 | spike 固有の pointer/interaction mapping。現状は cohesive。 |
| `src/app/notes/_components/note-canvas-toolbar-style-controls.tsx` | 219 | style controls と入力 state。現状は許容範囲。 |
| `src/app/spikes/canvas/_components/use-konva-canvas-stage.ts` | 219 | spike の stage lifecycle/scale/handlers。spike 責務として許容。 |
| `src/app/notes/_components/note-editor.tsx` | 224 | form state/save orchestration の owner。autosave/409 が増える場合のみ分割候補。 |
| `src/shared/canvas/canvas-document-validation.ts` | 274 | 純粋な大規模 validation/normalization。分割しない根拠あり。 |
| `src/shared/markdown/markdown-field.tsx` | 292 | Markdown editor/preview と field contract の shared component。現状は cohesive。 |
| `src/app/styles/note-paper.css` | 326 | paper shell、paper-specific responsive/create cascade。順序保持のため一体管理が妥当。 |
| `src/app/notes/_components/note-canvas-editor.tsx` | 345 | Canvas editor orchestration。runtime interface がさらに増えれば分割候補。 |
| `src/app/styles/canvas-spike.css` | 420 | spike route の隔離された responsive/cascade。spike 内で一体管理が妥当。 |
| `src/app/notes/_lib/shape-text-editor-session.ts` | 531 | inline text editing の state machine と Fabric cleanup。lifecycle safety のため現状維持が妥当。 |
| `src/app/styles/note-canvas-toolbar.css` | 602 | toolbar の generic/active/focus/media/draw-rail cascade。順序を壊さないため現状維持が妥当。 |
| `src/app/notes/_lib/use-note-canvas-runtime.ts` | 710 | Fabric lifecycle、gesture/erase、selection/style event の stateful runtime。次の主要分割候補だが、現時点では過剰分割を避ける。 |

追加分割の優先順位を付けるなら、`use-note-canvas-runtime.ts`、次に `note-canvas-editor.tsx` である。validation、shape-text session、CSS cascade、spike-specific files は、行数だけを理由に分割しない。

### F-012: public export/import、cycle、対象外変更 — 問題なし

`npx tsc --noEmit --pretty false` が成功しているため、今回確認した contracts/model/remote、server facade、Canvas public facade の export/import 破壊は検出されていない。shared Canvas と spike facade の参照は一方向で、facade cycle は見つからなかった。

監査中に実装コード、設定、依存関係、生成物を変更していない。作業前から存在したユーザー変更は保持している。作業後に追加される変更はこの監査 summary のみである。

## Forbidden dependency audit

対象ソースに対して `rg` で次の禁止依存を直接検査した。いずれも該当 import は 0 件だった。

| 禁止依存 | 結果 | 補足 |
| --- | --- | --- |
| `src/modules/notes` UI → `src/server` | 0 matches | UI は server を import していない。 |
| `src/modules/notes/remote` → Prisma / filesystem / Route Handler | 0 matches | `/api/notes`、`/api/tags` 等の endpoint literal は remote の責務として存在する。 |
| `src/server/notes` → React / Next UI | 0 matches | application/infrastructure/presenters に React/Next import はない。 |
| `src/server/notes/infrastructure` → HTTP / Next / browser | 0 matches | `NextResponse`、browser global、client storage、`fetch` はない。 |
| `src/app/notes` / `src/modules/notes` UI → Prisma payload | 0 matches | Prisma payload type は server presenter 境界に限定されている。 |
| production notes code → `src/app/spikes` | 0 matches | spike facade は spike 内部の既存 import path 維持にのみ使われる。 |

追加確認として、`@prisma` / Prisma payload 参照は notes infrastructure と `src/server/notes/presenters/notes.types.ts` に限定されている。これは Target Architecture が許容する persistence/application boundary 内の利用である。

## Verification

今回の読み取り中心の検証結果は次のとおり。

- `npm run lint`: PASS。終了コード 0。
- `npx tsc --noEmit --pretty false`: PASS。終了コード 0。
- `git diff --check`: PASS。終了コード 0。通常の tracked diff に対する検査であり、untracked ファイル自体は Git diff check の対象外であるが、lint/typecheck は実行した。
- `npm run build`: この task の制約により未実行。`HANDOFF_2026-07-19.md` と `doc/implementation/IMPLEMENTATION_STATUS.md` には過去の build PASS が記録されているが、今回の refactor 後の fresh build は未確認とする。
- Browser QA: 未実行。特に Fabric Canvas の pointer/wheel/touch、resize、responsive scale、save/reload、用紙サイズ変更後の復元、CSS の実画面 cascade は未確認である。handoff の既知の未確認事項を解消したとは判定しない。

作業後 `git status --short` でも、監査対象の実装変更は作業前から存在した状態のままである。監査 worker が追加する成果物はこの summary だけで、コード・設定・依存関係・生成物の変更はない。

## Remaining Unknowns

- Target Architecture の strict な配置として `src/modules/notes/ui` へ移設するか、現行 `src/app/notes/_components` を過渡構成として文書化して維持するかは未決定である。
- tags API に `TagOption` contract と presenter を置くかは設計判断が必要である。現状は select 済みの小さな shape なので MVP blocker ではない。
- Canvas の editor text projection、viewer assistive projection、保存用 search projection をどこまで共有するかは未決定である。用語・区切り・z-order 要件を統一する場合は別 task とする。
- paper dimension UI validator を shared pure validator に寄せるかは未決定である。
- `use-note-canvas-runtime.ts` と `note-canvas-editor.tsx` の追加分割は、機能追加または browser QA で lifecycle complexity が顕在化した場合に再評価する。
- refactor 後の fresh build は、task 制約上実行していないため未確認である。
- Canvas のブラウザ実動作、印刷/表示倍率、タッチ操作、保存後再読込、CSS visual regression は未確認である。

## Next Read

再開時はこの summary を起点にし、最小限として次を読む。

1. `doc/technical/TARGET_ARCHITECTURE.md`
2. `doc/implementation/MVP_CONTRACT.md`
3. `HANDOFF_2026-07-19.md`
4. `src/app/notes/_components/note-editor.tsx`
5. `src/app/notes/_components/note-canvas-editor.tsx`
6. `src/app/notes/_lib/use-note-canvas-runtime.ts`
7. `src/app/notes/_lib/shape-text-editor-session.ts`
8. `src/server/notes/application/tag.service.ts`
9. `src/server/notes/infrastructure/tag.repository.ts`
10. `src/app/globals.css`
11. `src/app/styles/note-canvas-toolbar.css`

## Final handoff

監査結論は「主要な refactor は静的には適合し、禁止依存・公開 facade 破壊・CSS selector 脱落は見つからない。ただし strict target tree の UI 配置と tags presenter は追加 task 候補。ブラウザ QA と refactor 後 fresh build は未確認」である。
