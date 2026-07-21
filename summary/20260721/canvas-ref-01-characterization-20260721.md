---
summary_type: characterization
created_at: 2026-07-21 JST
task_kind: worker-task
task_status: done
---

# Canvas / Notes Refactor 前の Characterization

## Objective

Canvas 契約、Canvas 履歴、ノート保存/API、主要 UI の現在の公開境界と代表的な挙動を、後続の責務分離で維持するための参照として記録する。これは調査のみの Worker であり、コード・設定・依存関係・Prisma schema/migration・生成物は変更していない。

## Scope

確認対象は src/shared/canvas/**、src/app/spikes/canvas/_lib/**、ノート Canvas UI、src/modules/notes/**、ノート API、タグ API、および MVP_CONTRACT.md、TEST_SCENARIOS.md、既存の refactor audit / handoff summary である。

作業開始時と終了時の git status --short は、今回の summary 追加を除いて同じだった。既存のユーザー変更として、CURRENT_STATUS.md、Worker layout script、Canvas toolbar、note editor/date モデル、実装・テスト・設計ドキュメント、および summary/20260721/ 内の既存 summary 群が dirty/untracked の状態だった。これらは戻していない。特に現在の toolbar は既存変更を含み、表示ラベルは 消しゴム、ARIA 名は 消しゴムツール になっているため、過去版の文言を現在の契約として扱わない。

## Public export / import boundary

### Canonical Canvas exports

- src/shared/canvas/canvas-document.ts が CanvasDocumentV1、要素・style 型、schema/version・page 制限、empty/demo fixture、validation、serialize/restore/clone、検索文字列抽出、byte 表示を実装している。
- src/shared/canvas/index.ts は上記 document module の再 export だけを行う。共有契約の正規入口は @/shared/canvas または @/shared/canvas/canvas-document である。
- src/app/spikes/canvas/_lib/canvas-document.ts は @/shared/canvas/canvas-document の export * forwarding だけで、独自契約を持たない。現在の consumer は確認できなかった。移動時にこの互換入口を消すと、既存 spike の import 境界を壊す可能性がある。

### Production / spike imports

production のノート Canvas から src/app/spikes/** への直接 import は次の 3 件だった。

| production file | spike module | symbols / use |
| --- | --- | --- |
| src/app/notes/_components/note-canvas-editor.tsx | src/app/spikes/canvas/_lib/fabric-adapter.ts | Fabric と CanvasDocumentV1 の相互変換、shape/text/style helper |
| src/app/notes/_components/note-canvas-editor.tsx | src/app/spikes/canvas/_lib/canvas-history.ts | local undo/redo history |
| src/app/notes/_components/note-canvas-viewer.tsx | src/app/spikes/canvas/_lib/fabric-adapter.ts | 保存済み document の read-only Fabric hydration |

spike 内では fabric-canvas-panel.tsx が fabric adapter/history、konva-canvas-panel.tsx が history と konva adapter を利用する。従って adapter と history を移動する場合は、少なくとも上記 production import と spike panel import の互換 export または同時更新が必要である。fabric-adapter.ts は shared Canvas module だけを import し、React/Next/Prisma/API には依存していない。

fabric-adapter.ts の外部 export は、構造的 Fabric 型 (FabricEventLike、FabricObjectLike、FabricCanvasLike、FabricApiLike、FabricStyleChange) と、style target 解決・style 適用・shape inline text editor・Fabric object 作成・document↔Fabric 変換の関数群である。FabricMetadata は内部型であり、保存される public contract ではない。

その他の確認済み component export は NoteCanvasEditor、NoteCanvasViewer、toolbar の CanvasNoteTool / style 型・制限値・NoteCanvasToolbar、note-editor の NoteEditorSavedNote / NoteEditor である。src/modules/notes は contracts/model/remote の index barrel、src/server/notes は application/repository/presenter の barrel を持つ。

## CanvasDocumentV1 contract

### Shape of the document

- schemaVersion は 1、page.background は "paper" のみ。
- page の既定値は 1200 x 800 px、width/height は有限な整数で 320..4000 の範囲。ページ寸法は表示倍率ではなく document の用紙寸法である。
- element type は stroke | line | arrow | rect | ellipse | text。
- 全 element に、空でない id、有限な x/y/width/height/rotation/z、正の width/height、任意の style がある。
- stroke/line/arrow は少なくとも 2 点の finite [x,y] points を持つ。rect/ellipse は任意の text と textStyle を持つ。standalone text は text 必須で textStyle を持てない。drawing element は text/textStyle を持てない。
- style の代表的な値は stroke、fill、strokeWidth、fontSize、fontFamily、textAlign。textAlign は standalone text の style、shape の textStyle で扱う。

### Limits and validation

現在の実装上の上限は、element 数 1000、総 stroke/line/arrow points 数 20,000、serialized JSON 2 MiB である。schema、page、element、point、shape/text の組み合わせを検証し、違反は CanvasDocumentValidationError を投げる。restoreCanvasDocument の malformed JSON は JSON parse error がそのまま発生する。

element の x/y/width/height は page 内に収まることを要求していない。したがって page resize で範囲外になる element/point が存在しても、削除・移動・縮小しないことが不変条件である。非対応 style の未知キーは正規化時に保存対象から落ちる一方、textStyle の未知キーは明示的に invalid とされる。この差も validation の現挙動として維持要否を確認する。

serializeCanvasDocument は validate 後に JSON 化し、byte 上限を再確認する。restoreCanvasDocument は文字列サイズ確認→parse→validate、cloneCanvasDocument は serialize/parse 経由の deep clone である。native Fabric JSON、selection、viewport/camera、pointer state、history は保存契約に含まれない。

### Geometry and search text

- getElementBounds は points がない要素では element の x/y と少なくとも 1 px の width/height を使い、points がある要素では points の min/max bounds を使う。
- extractCanvasSearchText は standalone text と rect/ellipse の inline text を対象にする。stroke/line/arrow の geometry は対象外。z 昇順、trim、空文字除外、改行 join で生成する。従って shape の text も一覧検索に含まれ、page width/height だけの変更では searchText は変化しない。
- 現在の demo fixture の search text は Canvas text is searchable である。

## Fixtures and renderer boundary

専用の test fixture directory や E2E fixture は確認できなかった。再現用の既存 fixture は createEmptyCanvasDocument() と createDemoCanvasDocument() である。demo は page 1200x800、z 0..5 の 6 要素 (stroke、line、arrow、rect、ellipse、standalone text) を返し、standalone text は Canvas text is searchable。spike page はこの demo を Fabric/Konva panel の両方へ渡し、表示と save→restore round trip を確認できる。

spike toolbar の Fit / 50% / 100% / 200% は isolated spike の zoom semantics であり、production の page width/height 適用とは別契約である。後続 refactor で zoom の意味を production の用紙寸法へ混入させない。

## Canvas history characterization

src/app/spikes/canvas/_lib/canvas-history.ts の history は client-only で、DB/API には保存しない。

- createCanvasHistory は past=[]、clone した document を present、future=[] とする。
- pushCanvasHistory は serialize 結果が present と同じ場合、同じ state object を返す no-op。変更時は旧 present を past に追加し、最大 50 件を末尾保持し、future を全消去する。
- undo は past が空なら同一 state。可能なら直前 present を clone して present にし、旧 present を future の先頭へ追加する。future は最大 50 件。
- redo は future が空なら同一 state。可能なら future 先頭を clone して present にし、旧 present を past に追加する。past は最大 50 件。
- clone により履歴内の document は参照共有しない。戻る/進むは Fabric JSON ではなく app-owned CanvasDocumentV1 snapshot に対して行う。

## Notes module / API / persistence boundary

### Module contracts and remote client

src/modules/notes/contracts/note.schema.ts が title、date、tag、cue、body mode/canvas、query、review payload の入力境界である。title は trim 後 1..120、noteDate は未来不可、tags は最大 12・重複不可、Canvas mode は canvas 必須かつ body empty、Markdown mode は canvas 不可という契約を持つ。query の tag は tag query parameter の comma-separated OR filter で重複除去される。page は server 側で 50 件固定。

src/modules/notes/model/note-editor-form.ts は form state と API payload を変換する。create の Canvas 初期値は empty document、Canvas 保存 payload の body は空文字。現在の worktree では新規 note の nextReviewDate は noteDate + 7 日に初期化され、既存 note の未設定値は自動補完しない。これはこの Worker の変更ではない。

src/modules/notes/remote/index.ts は /api 相対 URL の list/detail/create/update/delete/review/tag option client と DTO/error 型を公開する。remote query は singular tag を使用する。detail の 404 は null として扱う。

### Create/update and Canvas persistence

src/server/notes/infrastructure/command.repository.ts の Canvas preparation は validate→serialize→extractCanvasSearchText の順で行う。

- create は Notebook、Canvas (Canvas mode の場合)、Cue、NotebookTag を 1 transaction で作成する。Canvas mode の Notebook.body は空文字で、document JSON は NotebookCanvas.documentJson、schema version は schemaVersion、検索用文字列は searchText に保存する。tag は名前で upsert される。
- update は既存の未削除 note を確認し、Notebook、Cue (full replace)、NotebookTag (full replace)、Canvas (upsert または Markdown mode 時 delete) を 1 transaction で更新する。
- Canvas page resize は document JSON 全体を再検証して保存するだけで、element の geometry/style/text を変換しない。
- detail mapper は Canvas mode なのに canvas が無い場合、restore が invalid な場合、保存 schemaVersion と document schemaVersion が不一致の場合にエラーにする。空の Canvas への暗黙 fallback はない。
- list repository は title/body/summary/Cue content/Canvas searchText を OR 検索する。Canvas の geometry や page size は検索対象ではない。tag は some + name in の OR 条件、non-deleted のみ、noteDate desc/updatedAt desc、page size 50。
### Delete, review, and tags

- DELETE /api/notes/:id は MVP では確認 UI の後に physical delete。成功は 204、存在しない/削除済みは 404。soft delete、Undo、復元 API は現行 MVP の境界外。
- review は /api/notes/:id/review の POST。手動レビュー完了時に reviewedAt と次回 review date を更新し、成功 200。review task screen や status 0/1/2 の spaced-repetition API は roadmap であり、現行 MVP の実装境界ではない。
- GET /api/tags は src/app/api/tags/route.ts が Prisma を直接呼び、name asc の {id,name,color} 配列を 200 で返す。MVP では GET のみで、タグ管理 POST/rename/delete は未提供。この route は notes server/application repository の外にあるため、refactor 時の境界リスクとして明示する。
- API errors は {code,message,errors?} JSON。入力不正 400、not found 404、予期しない例外 500。現行 MVP の API に optimistic-lock 409 は実装されていない。

## Main UI characterization

### NoteCanvasEditor

- 初期 document は一度 clone/validate し、null または invalid なら alert を出して Fabric を初期化しない。親へ document change を通知するが、保存は note editor の explicit save が行う。
- Fabric は app-owned document を hydrate し、Fabric native JSON を永続化しない。canvas page の実寸を inline width/height と stage に反映する。page apply は page dimensions だけを更新し、既存 element を変えない。
- select は移動/resize を許可し、object:modified で history commit。pen/line/arrow/rect/ellipse/text/erase を持つ。line/arrow/rect/ellipse は drag が 4 px 未満なら no-op、preview は commit しない。eraser は触れた metadata object を whole-object delete し、1 gesture 最大 1 history entry、同一 object の重複 hit は dedupe する。
- shape text は shape 内部の別 textStyle として編集し、standalone text は style に保持する。空白だけの text は commit しない。style change は selection target に即時反映する。
- viewport が focus 中の Cmd/Ctrl+Z と Cmd/Ctrl+Shift+Z が local history、Delete/Backspace は active object の削除。toolbar eraser と keyboard delete は別経路だが、どちらも app document の要素削除に反映される。
- DOM は note-canvas-viewport (application role / focusable) 内に横スクロール wrapper と実寸 stage を持つ。縦スクロールは page layout 側、横スクロールは nested wrapper が担当する。

### NoteCanvasViewer

read-only Fabric canvas。selection、pointer interaction、object event を無効化し、入力 document を clone/validate できない場合は alert のみで canvas を変更しない。page 実寸と同じ rendering/scroll model を使い、text/rect/ellipse の trim 済み text を z 順で accessible text に出す。history と edit action はない。

### NoteCanvasToolbar / NoteEditor

- toolbar は select、pen、line/arrow、rect/ellipse、text、erase を公開し、aria-pressed、group label、tooltip/assistive description、disabled history buttons を持つ。stroke width は 1..20、font size は 8..96。page width/height は 320..4000 の整数として validate し、invalid input は aria-invalid と alert で通知する。
- style controls は color/number/alignment の live input と blur/Enter commit を持つ。current worktree の erase label/ARIA wording は既存ユーザー変更を反映している。
- NoteEditor は create/edit form、Cue list、Canvas editor または legacy Markdown body、Summary Markdown、tags、review date、explicit save/cancel を統合する。Canvas callback は form state だけを更新し、保存時に create/update remote を呼ぶ。タグ候補は GET /api/tags から取得し、UI 上の最大 12 件・重複除去を行う。MVP の Cue 削除に確認 modal はない。
- review mode は MVP 契約どおり Cue を先に表示し、本文はユーザーが reveal するまで隠し、Summary は本文 reveal 後に表示する。detail delete は確認後 physical delete。Undo snackbar/soft delete は維持すべき現行挙動ではない。

## Refactor invariants and risks

| ID | 維持する観測事実 / 不変条件 | 主な確認先 |
| --- | --- | --- |
| CANVAS-REF-INV-01 | Canvas の canonical shape は CanvasDocumentV1。Fabric/Konva native serialization を保存しない | src/shared/canvas/canvas-document.ts, fabric-adapter.ts |
| CANVAS-REF-INV-02 | page resize は page dimensions だけ変更し、範囲外を含む element data を保持する | canvas-document.ts, note editor |
| CANVAS-REF-INV-03 | searchText は text/rect/ellipse の z 順 text の trim+改行であり、page size 変更で変わらない | extractCanvasSearchText, notes read/command repository |
| CANVAS-REF-INV-04 | validation/serialize/restore の上限とエラー境界を変えない | canvas-document.ts, note schema |
| CANVAS-REF-INV-05 | history は local snapshot、content-identical push は state identity を保つ no-op、past/future 各 max 50 | canvas-history.ts |
| CANVAS-REF-INV-06 | shape inline text は text/textStyle、standalone text は text/style に分かれる | fabric adapter/editor |
| NOTES-REF-INV-01 | Canvas create/update は NotebookCanvas JSON + regenerated searchText を transaction 内で保存し、detail は invalid/missing/mismatch を暗黙補正しない | notes command/mapper |
| NOTES-REF-INV-02 | list search は Canvas searchText を含み、tag は OR、page size は 50、non-deleted only | notes read repository / contracts |
| NOTES-REF-INV-03 | delete は physical 204、review は手動 POST。soft delete/Undo/review-task status を MVPへ持ち込まない | API routes / MVP contract |
| BOUNDARY-REF-INV-01 | production の editor/viewer が fabric adapter/history を spike path から直接 import 中。移動時は互換 export または全 consumer の同時更新が必要 | editor/viewer と spike panels |
| BOUNDARY-REF-INV-02 | tags GET は route 内の direct Prisma access。notes repository 分離だけではタグ境界は移動しない | src/app/api/tags/route.ts |

## Verification

この Worker が実行した検証は次のとおり。

- npm run lint — PASS。
- npx tsc --noEmit --pretty false — PASS。
- npx prisma validate — PASS。Prisma schema は valid。
- npm run build — PASS。Next build、TypeScript、静的生成、主要 API/page route の compile が完了。
- git diff --check — PASS。
- production→spike import scan — 3 件を検出。これは失敗ではなく、維持・移動対象として記録すべき現状の境界である（editor から adapter/history、viewer から adapter）。
- 最終 git status --short — 今回の summary 追加以外は開始時と同じ既存変更。対象コード、設定、依存関係、schema/migration、生成物は変更なし。

## Existing evidence and remaining unknowns

- MVP_CONTRACT.md に記録された 2026-07-21 の API runtime evidence では、Canvas create→detail restore→page resize update→Canvas text search→review→delete の一連が成功している。これは既存記録の参照であり、この Worker が再実行した結果ではない。
- TEST_SCENARIOS.md の Canvas Browser QA（dimension、基本 interaction、gesture、shape text、style、style persistence、toolbar style）は未実施のまま。既存記録では browser backend が利用できず、pointer/overlap/inline text/style/eraser/scroll/responsive の実ランタイム挙動は未確認である。
- 専用の automated Canvas fixture/E2E は見つからなかった。再現用 fixture は createDemoCanvasDocument() / createEmptyCanvasDocument() であり、必要なら browser 用 fixture 方針を別タスクで定義する。
- production が spike path へ依存することは静的に確認済みだが、移動後に許容する最終 public module path と compatibility facade の有無は未決定である。これは Manager の設計判断が必要な事項で、今回決めていない。
- API の prior runtime evidence はあるが、ブラウザでの note editor 操作、hydration 後の Fabric object interaction、history identity、shape inline editor の各挙動はこの Worker では未実施。

## Next Read

後続 Worker はまず次の最小集合を読む。

1. summary/20260721/canvas-ref-01-characterization-20260721.md
2. doc/implementation/MVP_CONTRACT.md の Canvas / Notes API / delete / review 節
3. src/shared/canvas/canvas-document.ts
4. src/app/spikes/canvas/_lib/canvas-history.ts
5. src/app/spikes/canvas/_lib/fabric-adapter.ts
6. src/app/notes/_components/note-canvas-editor.tsx
7. src/app/notes/_components/note-canvas-viewer.tsx と note-canvas-toolbar.tsx
8. src/modules/notes/contracts/note.schema.ts と src/modules/notes/model/note-editor-form.ts
9. src/server/notes/infrastructure/command.repository.ts、read.repository.ts、presenters/notes.mapper.ts
10. src/app/api/notes/ と src/app/api/tags/route.ts
11. summary/20260721/architecture-refactor-audit-20260721.md の import graph / proposed split 節

この summary の次段階は、まず shared Canvas contract を移動しても import/export と CanvasDocumentV1 の実行時検証を壊さない characterization test を追加すること、次に history と Fabric adapter の公開境界を個別に移すこと。ただし実装順序・互換 facade の採用は別タスクの仕様判断として扱う。
