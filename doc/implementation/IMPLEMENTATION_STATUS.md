# 実装状況サマリ

更新日: 2026-07-22

## 判定基準

現行 MVP の実装・受け入れ判断は `doc/implementation/MVP_CONTRACT.md` を正本とする。`AGENTS.md` にあるドラフト、Undo、専用復習タスク、PDF、カード分割などの記述は製品ロードマップであり、この文書では現行 MVP と分けて扱う。

- **実装済み（静的確認）**: 現在の route、UI、Prisma schema、サービス、または確認可能な静的検証記録でコード上の実在を確認できるもの。ブラウザ実機 QA の完了を意味しない。
- **部分実装**: 一部のコードは存在するが、MVP 契約の挙動または画面状態を満たしていないもの。
- **未実装**: 現行 MVP の契約に含まれるが、必要なコードまたは route がないもの。
- **未確認（runtime QA）**: 静的な実装は確認できるが、ブラウザでの pointer、wheel、touch、保存・再読込、responsive などの実機確認記録がないもの。
- **Phase 2 / 仕様のみ**: 現行 MVP の対象外であり、仕様・ロードマップにだけ存在するもの。依存関係や型名だけでは実装済みと判定しない。

静的検証の `PASS` は runtime の `PASS` に繰り上げない。ブラウザ実機 QA の証跡がない項目は、コードが存在していても「未確認（runtime QA）」として記録する。

## 1. 現在の判定

現在のコードは、`Notebook` に Canvas または既存 Markdown の本文モードを持たせ、`NotebookCanvas` に `CanvasDocumentV1` JSON を保存し、`Cue` リスト、タグ、一覧検索、詳細画面内の閲覧・編集・復習、手動バックアップを提供する小さな MVP である。

現行 MVP と照合した重要な差分は次のとおり。

- 新規作成時の `nextReviewDate = noteDate + 7日` は実装済み。新規フォームは学習日から 7 日後で始まり、保存前に変更または空欄化できる。既存ノートの未設定値は自動補完せず、学習日を変更しても明示された次回復習日は自動移動しない。
- 復習モードの本文と Summary は初期非表示になる。本文を表示した後に Summary を開ける。
- 削除は確認後に物理削除する。`deletedAt` は schema に残る互換フィールドであり、Undo / soft delete の実装を意味しない。
- 専用復習タスク、ドラフト自動保存、NoteCard、D&D、PDF export などの route・model・UI は存在しない。
- Canvas は、`CanvasDocumentV1`（既定 page 1200x800、各 320〜4000px）の共有 validation、JSON 保存・復元、Canvas text 要素由来の `searchText`、幅・高さ数値入力と適用操作、保存済み `page` 寸法による editor / viewer の実寸描画、page 寸法だけを更新して要素 geometry を保持する処理、draw.io 風 toolbar、sticky tool、消しゴム（触れた要素を object 単位で消去する whole-object eraser）、client history、style controls、図形内文字、既存要素上の重ね描き、図形ドラッグ閾値、Fabric path metadata までコード上で実装されている。2026-07-21 に API の Canvas 保存・復元境界も実リクエストで確認したが、pointer / wheel / touch、Browser UI の保存・再読込、responsive を含むブラウザ実機 QA は未確認である。

## 2. 画面と route

### 実装済み

| Route | 実装状況 | 根拠 |
| --- | --- | --- |
| `/` | `/notes` へ redirect | `src/app/page.tsx` |
| `/notes` | 一覧、フリーワード・日付・タグ・復習対象フィルタ、ページング | `src/app/notes/page.tsx`, `src/modules/notes/ui/components/list/list.tsx` |
| `/notes/new` | 明示保存の新規作成フォーム。Canvas 本文モードを初期化する | `src/app/notes/new/page.tsx`, `src/modules/notes/ui/components/editor/editor.tsx`, `src/modules/notes/ui/components/canvas/editor.tsx` |
| `/notes/[id]` | Canvas / 既存 Markdown の閲覧・編集・復習モード、確認後削除 | `src/app/notes/[id]/page.tsx`, `src/modules/notes/ui/components/detail/modes.tsx`, `src/modules/notes/ui/components/canvas/editor.tsx`, `src/modules/notes/ui/components/canvas/viewer.tsx` |
| `/backup` | 手動バックアップ作成、最新一覧、更新・成功・失敗表示 | `src/app/backup/page.tsx` |

共通ナビゲーションは `/notes`、`/notes/new`、`/backup` の 3 つを提供する。`/tasks/review` と `/notes/backup` は現行 MVP の route ではない。根拠は `src/app/layout.tsx`、`doc/implementation/MVP_CONTRACT.md` §3。

### 実装されていない画面

`/tasks/review`、復習タスクのタブ、未完了タスクバッジ、`/notes/backup` は、対応する page component や API route がない。現行 MVP では `/notes` の `reviewDue` フィルタから `/notes/[id]` の復習モードへ進む。根拠は `src/app/**` の route 一覧、`doc/implementation/MVP_CONTRACT.md` §3・§4.3。

## 3. 実在する API endpoint

route handler の export と一致する一覧は次のとおり。これ以外の endpoint は主な API として扱わない。

| Method | URL | 実装状況 | 根拠 |
| --- | --- | --- | --- |
| `GET` | `/api/notes` | 一覧・検索・ページング（Canvas `searchText` を含む） | `src/app/api/notes/route.ts`, `src/server/notes/infrastructure/read.repository.ts` |
| `POST` | `/api/notes` | ノート作成、Canvas JSON、Cue・タグ関連作成 | `src/app/api/notes/route.ts`, `src/server/notes/infrastructure/notebook.command.repository.ts` |
| `GET` | `/api/notes/:id` | ノート詳細取得 | `src/app/api/notes/[id]/route.ts` |
| `PATCH` | `/api/notes/:id` | ノート全体の明示更新、Canvas JSON、Cue・タグ関連の全置換 | `src/app/api/notes/[id]/route.ts`, `src/server/notes/infrastructure/notebook.command.repository.ts` |
| `DELETE` | `/api/notes/:id` | 物理削除、成功時 `204` | `src/app/api/notes/[id]/route.ts`, `src/server/notes/infrastructure/notebook.command.repository.ts` |
| `POST` | `/api/notes/:id/review` | `reviewedAt` と任意の `nextReviewDate` を更新 | `src/app/api/notes/[id]/review/route.ts`, `src/server/notes/infrastructure/review.command.repository.ts` |
| `GET` | `/api/tags` | タグ候補を名前昇順で取得 | `src/app/api/tags/route.ts` |
| `GET` | `/api/backups` | 最新 3 世代のバックアップ一覧 | `src/app/api/backups/route.ts`, `src/server/backup/infrastructure/local-sqlite-backup-provider.js` |
| `POST` | `/api/backups` | SQLite DB の手動コピーと世代整理 | `src/app/api/backups/route.ts`, `src/server/backup/infrastructure/local-sqlite-backup-provider.js` |

`POST /api/tags`、`GET /api/review-tasks`、`PATCH /api/review-tasks/:notebookId`、`POST /api/undo`、`GET /api/notes/export`、`POST /api/backups/retry` は route handler がない。`doc/implementation/MVP_CONTRACT.md` §5 では `GET /api/tags` と `GET/POST /api/backups` のみを MVP API とする。

`GET /api/notes` は `query`、`tag`、`from`、`to`、`reviewDue`、`page` を受け付け、タグは OR 条件、ページサイズは 50 件、並び順は `noteDate desc, updatedAt desc` である。根拠は `src/modules/notes/contracts/note.schema.ts`、`src/server/notes/infrastructure/read.repository.ts`。

## 4. Prisma data model

現行 schema に存在する model は `Notebook`、`NotebookCanvas`、`Tag`、`NotebookTag`、`Cue` である。根拠は `prisma/schema.prisma` と作業ツリーの Canvas persistence 定義。

2026-07-18 の `prisma/migrations/20260718011243_remove_notebook_overview/migration.sql` 適用により、Prisma schema と通常使用中の SQLite DB から Notebook の旧 overview 列は削除済みである。

| Model | 実装上の責務・主な field |
| --- | --- |
| `Notebook` | `id`, `title`, `noteDate`, `sourceType`, `sourceTitle`, `body`, `bodyMode`, `summary`, `nextReviewDate`, `reviewedAt`, `createdAt`, `updatedAt`, `deletedAt`。`bodyMode` が `canvas` の場合、本文の正本は `NotebookCanvas`。 |
| `NotebookCanvas` | `notebookId`, `schemaVersion`, `documentJson`, `searchText`, `createdAt`, `updatedAt`。`CanvasDocumentV1.page` に用紙サイズを保持する。 |
| `Tag` | `id`, unique な `name`, `color`, `createdAt`。 |
| `NotebookTag` | `notebookId` + `tagId` の複合主キーによる多対多関連。両方の削除は cascade。 |
| `Cue` | `id`, `notebookId`, `text`, `order`, `createdAt`, `updatedAt`。Notebook の Cue リスト。 |

`Notebook.deletedAt` は schema と一覧・詳細取得の `where deletedAt: null` に存在するが、削除処理は `prisma.notebook.delete` を呼ぶ物理削除である。`SoftDeleteBuffer`、`NotebookDraftState`、`NotebookReviewProgress`、`BackupLog`、`NoteCard`、`CueCard`、`NoteCueLink` の Prisma model はない。現行の `src/modules/notes/model/note-editor-form.ts` と `src/modules/notes/ui/components/editor/editor.tsx` は Cue リストと Canvas 本文を扱い、`CueCard` / `NoteCard` の保存処理・UI・route には接続していない。

## 5. 機能別の実装状況

### 5.1 実装済み（静的確認）

| 機能 | 実装内容 | 根拠 |
| --- | --- | --- |
| 明示保存 | 新規は `POST /api/notes` 成功後に `/notes/[id]` へ遷移、編集は `PATCH` 成功後に閲覧へ戻る。自動保存は行わない。 | `src/modules/notes/ui/components/editor/editor.tsx`, `src/modules/notes/remote/index.ts` |
| ノート CRUD | タイトル、学習日、学習元、Canvas または legacy Markdown 本文、Summary、復習日を保存・取得・更新・削除。 | `src/app/api/notes/route.ts`, `src/app/api/notes/[id]/route.ts`, `src/server/notes/infrastructure/notebook.command.repository.ts`, `src/server/notes/infrastructure/review.command.repository.ts` |
| Cue | Cue の追加・削除、`order` 保存、詳細表示、更新時の全置換。空 Cue はフォームから payload に含めない。 | `src/modules/notes/ui/components/editor/editor.tsx`, `src/modules/notes/model/note-editor-form.ts`, `src/server/notes/infrastructure/relations.repository.ts` |
| タグ | 既存候補の取得、新規タグの保存時自動作成、1 ノート最大 12 件、同一ノート内の重複防止、一覧 OR フィルタ。 | `src/modules/notes/ui/components/editor/editor.tsx`, `src/app/api/tags/route.ts`, `src/modules/notes/contracts/note.schema.ts` |
| 一覧検索 | タイトル・legacy Markdown 本文・Summary・Cue・Canvas `searchText` の部分一致、日付範囲、タグ、`reviewDue`、ページング、空状態・loading・error 表示。 | `src/modules/notes/ui/components/list/list.tsx`, `src/server/notes/infrastructure/read.repository.ts` |
| 詳細モード | `/notes/[id]` 内で閲覧・編集・復習を切り替える。復習時は本文を隠す／表示する操作がある。 | `src/modules/notes/ui/components/detail/modes.tsx` |
| Markdown 表示 | Cue / Summary の textarea と preview、GFM、sanitize、preview checkbox の表示専用化。legacy Markdown body mode は互換表示する。Canvas 本文は Canvas viewer/editor で表示する。 | `src/shared/markdown/markdown-field.tsx`, `package.json`, `src/modules/notes/ui/components/canvas/viewer.tsx` |
| 確認後の削除 | 詳細画面で `window.confirm` を表示し、確定後に物理削除して `/notes` へ戻る。削除後の Undo / 個別復元は保証しない。 | `src/modules/notes/ui/components/detail/modes.tsx`, `src/app/api/notes/[id]/route.ts`, `prisma/schema.prisma` |
| 手動バックアップ | `/backup` と `POST /api/backups`、`npm run backup:copy` で DB を `backup/` へコピーし、最新 3 世代を保持する。 | `src/app/backup/page.tsx`, `src/app/api/backups/route.ts`, `src/server/backup/infrastructure/local-sqlite-backup-provider.js`, `package.json` |
| API validation / error | Zod による body/query validation と `{ code, message, errors? }` 形式の route response。 | `src/modules/notes/contracts/note.schema.ts`, `src/shared/http/api-error.ts`, `src/shared/http/route-response.ts` |
| Canvas persistence / search | 実装済み（静的確認）。`CanvasDocumentV1` の validation、既定 page 1200x800、`NotebookCanvas.documentJson` 保存・復元、text 要素から `searchText` を生成し一覧 query に含める処理。page 寸法 validation は 320〜4000px の整数。 | `src/shared/canvas/index.ts`（公開 facade。実体は `canvas-document-*` の責務別ファイル）、`src/modules/notes/contracts/note.schema.ts`, `src/server/notes/infrastructure/canvas.persistence.ts`, `src/server/notes/infrastructure/notebook.command.repository.ts`, `src/server/notes/infrastructure/read.repository.ts`, `src/server/notes/presenters/detail.mapper.ts` |
| Canvas 用紙サイズ UI / 実寸 renderer | 実装済み（静的確認）。toolbar の幅・高さ `type=number` 入力、整数・320〜4000px validation、適用 / Enter 操作、保存済み `document.page` を使う editor / viewer の DOM・Fabric 寸法反映。 | `src/modules/notes/ui/components/canvas/toolbar.tsx`, `src/modules/notes/ui/components/canvas/editor.tsx`, `src/modules/notes/ui/components/canvas/viewer.tsx`, `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`, `src/shared/canvas/adapters/fabric/fabric-canvas-surface.ts` |
| Canvas 用紙サイズ変更の要素不変挙動 | 実装済み（静的確認）。page の `width` / `height` だけを history / document に反映し、既存要素の `x`, `y`, `width`, `height`, `points`, `style` などを再配置・縮小・削除しない。 | `src/modules/notes/ui/components/canvas/editor.tsx`, `src/shared/canvas/index.ts`（公開 facadeと責務別実装）、`doc/implementation/MVP_CONTRACT.md` §6.1 |
| Canvas draw.io 風 toolbar | 実装済み（静的確認）。操作、描く、線、図形、文字、消去、履歴、用紙の group、active state、ARIA、tooltip / description、用紙サイズ入力を持つ。 | `src/modules/notes/ui/components/canvas/toolbar.tsx`, `HANDOFF_2026-07-22.md` §4.2 |
| Canvas tool state / eraser / history | 実装済み（静的確認）。tool は sticky、消しゴムは stroke / line / arrow / rect / ellipse / text を object 単位で消去する whole-object eraser、Undo / Redo は Canvas の client history snapshot。 | `src/modules/notes/ui/components/canvas/editor.tsx`, `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`, `src/shared/canvas/canvas-history.ts`, `HANDOFF_2026-07-22.md` §4.1 |
| Canvas style controls | 実装済み（静的確認）。線幅 1〜20px（既定 1px）、文字サイズ 8〜96px（既定 12px）、color input、文字配置 `left` / `center` / `right` を提供し、選択中または図形内文字編集中に表示へ即時反映する。 | `src/modules/notes/ui/components/canvas/toolbar-style-controls.tsx`, `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`, `src/shared/canvas/adapters/fabric/fabric-style.ts`, `doc/implementation/MVP_CONTRACT.md` §6.2 |
| Canvas text save boundary | 実装済み（静的確認）。standalone text は `style.fontSize` / `style.fill` / `style.textAlign`、図形内文字は `textStyle.fontSize` / `textStyle.fill` / `textStyle.textAlign` に保存する。 | `src/shared/canvas/index.ts`（公開 facadeと責務別実装）、`src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`, `src/shared/canvas/adapters/fabric/fabric-canvas-to-document.ts`, `doc/implementation/MVP_CONTRACT.md` §6.2 |
| Canvas shape inline text | 実装済み（静的確認）。`select` / `rect` / `ellipse` の対象図形をダブルクリックすると、図形外形を表示したまま inline editor を開き、確定・キャンセル後も元の shape と既存のペン線・他要素を保持する。 | `src/modules/notes/ui/hooks/shape-text-editor-session.ts`, `src/shared/canvas/adapters/fabric/fabric-shape-factory.ts`, `doc/implementation/MVP_CONTRACT.md` §6.2 |
| Canvas overlap / drag threshold | 実装済み（静的確認）。pen / line / arrow / rect / ellipse / text は空白または既知の app-owned Canvas 要素上から開始でき、未知 metadata object、preview、inline editor overlay は遮断する。line / arrow / rect / ellipse は 4px の移動閾値を超えた場合だけ作成する。 | `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`, `src/modules/notes/lib/canvas-editor-geometry.ts`, `doc/designs/CANVAS_TOOLBAR_DESIGN.md` §5.1、`HANDOFF_2026-07-22.md` §4.1 |
| Fabric path metadata / geometry | 実装済み（静的確認）。`path:created` の path object に app-owned `canvasElement` metadata と基準座標を付与し、adapter が points、bounds、移動後 transform を `CanvasDocumentV1` へ戻す。 | `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`, `src/shared/canvas/adapters/fabric/fabric-metadata.ts`, `src/shared/canvas/adapters/fabric/fabric-canvas-to-document.ts`, `HANDOFF_2026-07-22.md` §4.1 |

### 5.2 部分実装または MVP 契約との差分

| 契約項目 | 実際の挙動 | 判定 | 根拠 |
| --- | --- | --- | --- |
| 復習モードの本文・Summary | 本文と Summary は復習開始時に非表示で、本文を表示した後に Summary を開ける。表示・再非表示の状態は保存しない。 | 実装済み（runtime QA は別途確認） | `src/modules/notes/ui/components/detail/modes.tsx` |
| 新規 `nextReviewDate` 初期値 | 新規フォームは `noteDate` を基準に `addDaysToDateString(noteDate, 7)` で初期化され、空欄化して保存することもできる。既存ノートは未設定値を補完せず、`noteDate` 変更時も明示された次回復習日を自動移動しない。 | 実装済み（静的確認。runtime QA は別途確認） | `src/modules/notes/model/note-editor-form.initial.ts:23-62`, `src/shared/date/date-only.ts:9-17`, `doc/implementation/MVP_CONTRACT.md:59-60` |
| 復習の次回日管理 | `POST /api/notes/:id/review` は存在し、`reviewedAt` とユーザー入力の `nextReviewDate` / `null` を更新する。日付の自動再計算はない。 | 実装済み | `src/app/api/notes/[id]/review/route.ts`, `src/server/notes/infrastructure/review.command.repository.ts:9-33` |
| 依存ライブラリに対する高度 UI | `@dnd-kit/*`、`@uiw/react-md-editor`、`react-day-picker` は `package.json` にあるが、現行画面は native textarea / date input と手動 Cue 操作を使う。 | MVP の実装済みとは数えない | `package.json`, `src/modules/notes/ui/components/editor/editor.tsx`, `src/modules/notes/ui/components/list/list.tsx` |

### 5.3 Runtime 検証境界（API と Browser を分離）

API runtime の実リクエスト結果と、ブラウザ実機での pointer / wheel / touch / 保存・再読込 / responsive QA は別の判定として記録する。静的実装の存在だけで Browser runtime を PASS にはしない。

#### 2026-07-21 Notes API runtime（API 境界のみ）

権限昇格後に `127.0.0.1:3107` で server listen に成功し、既存 DB を壊さない一意な QA note を使った実リクエストは PASS。Canvas page の `640x480` → `1920x1080` 変更後も既存 element の geometry / `style` / `text` は不変で、Canvas text 検索、review、物理削除、削除後 404、QA title の `totalCount=0` を確認した。これは API runtime の証跡であり、下表の Browser QA を PASS へ繰り上げない。詳細は `doc/testing/TEST_SCENARIOS.md` の「Notes API runtime 検証記録（2026-07-21）」を参照する。

#### Browser runtime 部分実施（2026-07-22）

2026-07-22 に in-app Browser で `http://localhost:3000` を操作し、基準 Canvas fixture の作成、図形内文字、style の一部、1920x1080 への用紙変更、明示保存、詳細・編集での再読込、Canvas text 検索を確認した。7 シナリオの一部に runtime 証跡ができたが、重ね描きの全組合せ、preview / overlay 境界、消しゴム、Undo / Redo、全 style 境界値・色、375 / 768px、touch、全 keyboard 経路は未確認であるため、シナリオ全体は PASS にしない。詳細は `summary/20260722/canvas-browser-qa-partial-20260722.md` と `doc/testing/TEST_SCENARIOS.md` の「Canvas runtime QA 追補（2026-07-22）」を参照する。

#### Browser runtime follow-up（2026-07-24）

権限付き headless Playwright Chromium で `http://127.0.0.1:3000/notes/new` を再確認した。375 / 768 / 1280 / 1440px の実効 viewport を個別に測定し、1280px の drawing rail collapse は再現しなかった。全 drawing tool の click、Tab / Shift+Tab、375px の touch tap、body / document の page-wide overflow 不在、1920x1080 用紙の局所 horizontal scroll、Summary / `.note-paper-footer` への縦 scrollを確認した。touch の Canvas scroll 干渉、focus-visible の視覚確認、style target 選択後の alignment 即時反映は未確認のため、`CANVAS-TOOLBAR-STYLE-001` は部分実施のままとする。詳細は `summary/20260724/canvas-toolbar-browser-qa-runtime-20260724.md` と `doc/testing/TEST_SCENARIOS.md` の「Canvas toolbar runtime QA 追補（2026-07-24）」を参照する。

#### Gesture runtime follow-up（2026-07-24）

同じ local runtime で `CANVAS-INTERACTION-001` / `CANVAS-GESTURE-001` の pointer 境界を追加確認した。直線・矢印・四角・円の click、double-click、3px drag は保存要素 0 件、5px drag は各 1 件になり、4px 閾値の no-op / commit の切り分けを実測した。また、stroke、line、arrow、rect、ellipse、standalone text の各既存要素上から 6 tool で新規 gesture を開始し、基準 6 件 + 重ね描き 6 件の保存を確認した。未確定 preview の保存除外と、同じ四角 tool の inline editor overlay 上の drag が新規要素を作らないことも確認した。metadata 欠落 / unknown object、厳密な 4px、別 tool 切り替え後の shape gesture 分離、保存後の再読込は未確認のため、両シナリオは部分実施のままとする。詳細は `summary/20260724/canvas-gesture-browser-qa-runtime-20260724.md` と `doc/testing/TEST_SCENARIOS.md` の「Canvas gesture runtime QA 追補（2026-07-24）」を参照する。

#### Canvas metadata boundary hardening（2026-07-24）

unknown target の実 pointer 操作は Browser backend 不在のため未確認のままだが、Worker の static review と既存検証コマンドで保存境界を再確認した。pen runtime は Fabric 7 の `mouse:down:before` で metadata 欠落・unknown・preview・shape text editor target の brush 開始を抑止し、異常な `path:created` を除去する。Fabric metadata reader / converter は malformed element を `CanvasElementV1` として扱わず、metadata 欠落、unknown type、element / style / points / geometry 不正を例外なしで skip する。正規要素の geometry / style / text 変換、空白・既知要素の pen target allowlist は維持した。`npm run lint`、`npx tsc --noEmit --pretty false`、`npm run build`、`git diff --check` は PASS。`CANVAS-INTERACTION-001` は実機の unknown target pointer と保存 JSON が未取得のため部分実施のままとする。詳細は `summary/20260724/fix-canvas-unknown-target-pen-gesture-20260724-summary.md`、`summary/20260724/2336-harden-canvas-malformed-metadata-converter-20260724-e7e74449-summary.md`、`summary/20260724/2339-fix-canvas-unknown-target-pen-gesture-20260724-c4a0eeee-summary.md` を参照する。

| 確認項目 | 未確認の範囲 | 判定 | 根拠 |
| --- | --- | --- | --- |
| Canvas pointer / overlap | 空白から pen / line / arrow / rect / ellipse / standalone text を作成し、2026-07-24 に既知の 6 要素上から 6 tool の新規 gesture と保存 12 要素を確認した。未確定 preview と同じ tool の inline overlay 遮断も確認した。unknown target の実機操作は未確認だが、pen runtime guard と malformed metadata の保存境界は static review で確認済み。 | 部分実施（runtime QA + static hardening） | `summary/20260722/canvas-browser-qa-partial-20260722.md`、`summary/20260724/canvas-gesture-browser-qa-runtime-20260724.md`、`summary/20260724/fix-canvas-unknown-target-pen-gesture-20260724-summary.md`、`summary/20260724/2336-harden-canvas-malformed-metadata-converter-20260724-e7e74449-summary.md` |
| Canvas drag threshold / gesture separation | 2026-07-24 に line / arrow / rect / ellipse の click、double-click、3px drag、5px drag を実行し、保存 JSON で 0 件 / 1 件と type を照合した。同じ tool の shape inline text overlay 上の drag は新規要素を作らないことを確認した。厳密な 4px 境界、別 tool 切り替え後の分離は未確認。 | 部分実施（runtime QA） | `summary/20260722/canvas-browser-qa-partial-20260722.md`、`summary/20260724/canvas-gesture-browser-qa-runtime-20260724.md` |
| Canvas shape inline text lifecycle | rect の文字確定、ellipse の文字キャンセル、配置変更、他要素保持、console error なしを確認した。rect / ellipse の全 tool 別経路と繰り返し lifecycle は未確認。 | 部分実施（runtime QA） | `summary/20260722/canvas-browser-qa-partial-20260722.md` |
| Canvas style controls / persistence | standalone text の `fontSize=96` / `textAlign=right`、shape `textStyle.fontSize=32` / `textAlign=left` を保存・再読込で確認した。文字サイズ 7 と 12.5 は既存値維持で拒否された。線幅・色・全配置・全境界値は未確認。 | 部分実施（runtime QA） | `summary/20260722/canvas-browser-qa-partial-20260722.md` |
| Canvas browser 保存・再読込 | 1200x800 の新規 Canvas を 1920x1080 に変更し、明示保存後の詳細・編集・GET JSON で page、7 要素、`style` / `textStyle` / text を復元した。Canvas text 検索も 1 件一致した。page 外要素は未確認。 | 部分実施（runtime QA） | `summary/20260722/canvas-browser-qa-partial-20260722.md` |
| Canvas wheel / trackpad / touch | ページ縦 scroll が Summary / footer まで通ること、広い用紙だけが局所横 scroll になること、Canvas pointer 操作と scroll が干渉しないこと。 | 未確認（runtime QA） | `HANDOFF_2026-07-22.md` §4.3、`doc/designs/CANVAS_TOOLBAR_DESIGN.md` §5.6 |
| Canvas toolbar keyboard / responsive / focus | 2026-07-22 は実効約 1265px で rail 約 8pxの collapse を確認したが、2026-07-24 の修正後再確認では 375 / 768 / 1280 / 1440px の rail が 305 / 346 / 679 / 79pxを確保し、全 drawing tool の click、Tab / Shift+Tab、page-wide overflow 不在、1920x1080 用紙の局所 scroll、375px touch tap を確認した。touch の Canvas scroll 干渉、focus-visible の視覚確認、style target 選択後の alignment 即時反映は未確認。 | 部分実施（修正後 runtime QA） | `summary/20260722/canvas-browser-qa-partial-20260722.md`、`summary/20260724/canvas-toolbar-browser-qa-runtime-20260724.md` |

### 5.4 Phase 2 / 仕様のみ

以下は仕様上の将来機能であり、現行コードに対応する route・Prisma model・保存処理・UI はない。

| 領域 | 未実装の機能 | 確認結果・根拠 |
| --- | --- | --- |
| Draft / autosave | `NotebookDraftState`、3 秒 autosave、差分保存、version、楽観ロック、409 UI、再試行バナー | `src/app/api/**`、`prisma/schema.prisma`、`src/modules/notes/ui/components/editor/editor.tsx` に対応実装なし。`draft` prop は未使用の props に留まる。仕様は `doc/implementation/MVP_CONTRACT.md` §2・§9。 |
| Undo / soft delete | `SoftDeleteBuffer`、5 秒 Snackbar、`POST /api/undo`、期限切れ purge、削除後復元 | `src/app/api` に Undo route なし。削除は `src/server/notes/infrastructure/notebook.command.repository.ts` の `prisma.notebook.delete`。仕様は `doc/implementation/MVP_CONTRACT.md` §4.2・§9。 |
| 専用復習タスク | `/tasks/review`、`/api/review-tasks`、1 日後 / 1 週間後タスク、review status、未完了バッジ、自動予定 | `src/app` と `prisma/schema.prisma` に対応 page / route / model なし。現行 MVP は `GET /api/notes?reviewDue=true` と詳細画面内復習のみ。 |
| Card / D&D | NoteCard、CueCard の永続化、複数本文カード、`NoteCueLink`、hidden flag、D&D 並び替え | `prisma/schema.prisma` に model なし。現行の `src/modules/notes/model/note-editor-form.ts` と `src/modules/notes/ui/components/editor/editor.tsx` は Cue リストと Canvas 本文を扱い、D&D import / 実装はない。 |
| PDF / HTML export | 期間 export、`GET /api/notes/export`、Playwright PDF、1 ノート 1 ページ | export route と PDF 生成コードなし。`playwright` は `scripts/render-mermaid-diagrams.js` で図の SVG 生成に使われるだけで、PDF export の証拠ではない。根拠は `src/app/api/**`、`scripts/render-mermaid-diagrams.js`、`package.json`。 |
| タグ管理 | `POST /api/tags`、名称変更、削除、右クリック管理 UI | `src/app/api/tags/route.ts` は `GET` のみ。Tag の作成はノート保存時の upsert に限る。 |
| バックアップ高度機能 | 起動時自動コピー、`BackupLog`、`POST /api/backups/retry`、ログ UI、自動復元 | `prisma/schema.prisma` にログ model なし、`src/app/api/backups/route.ts` は GET/POST のみ。現行は手動作成・一覧のみ。 |
| 高度なキーボード操作 / A11y | Cmd/Ctrl+N、Undo/Redo、D&D のキーボード操作、モーダル focus trap、詳細な ARIA 制御 | `src/modules/notes/ui` に該当 keydown / D&D / focus trap 実装なし。Cue 追加等の通常ボタン操作と一部の入力 ARIA は実装済み。 |

### 5.5 Canvas 実装・検証境界（後続確認入口）

用紙サイズと Canvas の保存・描画を後続確認するときは、現行 MVP 契約 §6.1 と次の責務分担を正本として読む。コード上の実装確認とブラウザ実機 QA の残りを分ける。

| 参照ファイル | 静的に確認できる責務 | 残る runtime / 後続確認 |
| --- | --- | --- |
| `src/shared/canvas/index.ts`（公開 facade。実体は `canvas-document-*` の責務別ファイル） | `CanvasDocumentV1`、既定 1200x800、320〜4000px validation、serialize / restore、`extractCanvasSearchText`。 | 無効値入力・境界値・壊れた document のブラウザ / API 実機確認。 |
| `src/modules/notes/contracts/note.schema.ts` | `bodyMode` と `canvas` の相互排他、Canvas validation の API 入力境界。 | API の field error 表示と保存時の実機確認。 |
| `src/server/notes/infrastructure/canvas.persistence.ts` / `src/server/notes/infrastructure/notebook.command.repository.ts` | `documentJson` / `searchText` の生成と create・update 保存。page 寸法変更用の別 API / DB column はない。 | Browser UI での保存・再読込は未確認。API の page、要素 geometry、`style` / `text`、`searchText` は 2026-07-21 に実データ確認済み。 |
| `src/server/notes/infrastructure/read.repository.ts` / `src/server/notes/presenters/detail.mapper.ts` | Canvas `searchText` を一覧検索に含め、保存済み JSON を復元する。 | 一覧検索と詳細復元のブラウザ実機確認。 |
| `src/modules/notes/ui/components/canvas/editor.tsx` / `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts` | toolbar から page を更新し、DOM / Fabric を `document.page` の実寸に反映する。page 更新時は要素データを変更せず、sticky tool、重ね描き、drag threshold、図形内文字、style 即時反映、消しゴムの whole-object erase、client history を扱う。 | pointer 操作、移動・resize、図形内文字 lifecycle、style、消しゴム、保存・再読込、wheel / touch の実機確認。 |
| `src/modules/notes/ui/components/canvas/viewer.tsx` | 保存済み `document.page` を使って viewer の用紙を実寸描画する。 | 閲覧・復習時の表示、page 外要素の復元、responsive の実機確認。 |
| `src/modules/notes/ui/components/canvas/toolbar.tsx` | 用紙の幅・高さ入力、整数・範囲 validation、適用 / Enter、tool group、sticky tool の active state、線幅・文字サイズ・color・文字配置 controls、ARIA。 | 375 / 768 / 1280 / 1440px の keyboard / touch 到達性、focus、tooltip、local rail、style の即時反映と保存境界の実機確認。 |
| `src/shared/canvas/adapters/fabric/fabric-document-to-canvas.ts` / `src/shared/canvas/adapters/fabric/fabric-canvas-to-document.ts` / `src/shared/canvas/adapters/fabric/fabric-metadata.ts` / `src/shared/canvas/adapters/fabric/fabric-shape-factory.ts` | app-owned `CanvasDocumentV1` と Fabric object の変換、page 寸法・座標の反映、path metadata、points / bounds / transform の復元、shape inline text の renderer。 | pointer で作成・移動・resize した geometry、path の保存・再読込、shape inline text lifecycle の実機確認。 |

用紙サイズ変更は既存 `NotebookCanvas.documentJson` の page 更新だけで完結する。寸法専用の Prisma migration、Canvas document の自動変換、要素の自動再配置は追加しない。page 寸法だけを変更しても `searchText` の元である text 要素は変わらない。

## 6. セットアップ・運用コマンド

`package.json` と `README.md` で確認できるコマンドだけを掲載する。seed script はなく、`README.md` も seed 不要としている。

| コマンド | 用途 |
| --- | --- |
| `npm install` | 依存関係のインストール |
| `npm run prisma:generate` | Prisma Client 生成 |
| `npm run prisma:migrate` | Prisma migration 実行と SQLite DB 作成・更新 |
| `npm run dev` | 開発サーバ起動 |
| `npm run build` | webpack を使った本番 build |
| `npm run lint` | ESLint |
| `npm run backup:copy` | SQLite DB の手動バックアップ |
| `npm run diagrams:build` | Mermaid 図の抽出・SVG 生成 |

`npm run seed`、PDF 生成用の npm script、`npm run backups:retry` は存在しない。根拠は `package.json`、`README.md`。

## 7. 検証証跡

以下はリポジトリに残る確認記録であり、仕様上のチェック項目を実装済みの証拠として扱う範囲を限定する。

注記: 2026-07-16 の記録は UI-PAPER-015 適用前の静的照合結果です。復習時 Summary の現在状態は本書 §5.2 と現行コードを正とし、過去の判定は履歴として保持します。Canvas については、静的実装確認とブラウザ実機 QA を別の判定として記録します。

| 日付 | 確認範囲 | 結果 | 証跡 |
| --- | --- | --- | --- |
| 2026-07-05 | `/` redirect、一覧、新規作成、編集保存、復習モード、検索、削除、バックアップの主要 UI フロー | PASS | `summary/20260705/mvp-ui-flow-reverification-report.md` |
| 2026-07-05 | API CRUD、review、検索、タグ、validation、not found、backup prune | PASS | `summary/20260705/manager-mvp-api-crud-validation-backup-reverification-report.md` |
| 2026-07-05 | GFM checkbox、preview checkbox の表示専用挙動、閲覧・復習時の Markdown sanitize | PASS | `summary/20260705/manager-markdown-sanitize-checkbox-verification-report.md` |
| 2026-07-05 | `npm run backup:copy` と最新 3 世代保持 | PASS | `summary/20260705/backup-copy-command-verification-report.md` |
| 2026-07-04〜2026-07-05 | Prisma validate/generate、`npm run lint`、`npm run build` | PASS | `doc/testing/TEST_SCENARIOS.md` の検証記録、`summary/20260705/mvp-ui-flow-reverification-report.md`, `summary/20260705/manager-fix-ui009-note-editor-tag-candidates-summary.md`, `summary/20260705/manager-fix-ui014-edit-save-state-summary.md` |
| 2026-07-16 | `nextReviewDate + 7日` 初期値、既存未設定値の非補完、復習 Summary 初期非表示 | 未実施。静的照合では初期値と Summary 非表示に差分あり | `doc/testing/TEST_SCENARIOS.md` の 2026-07-16 記録、本文書 §5.2 |
| 2026-07-19 | Canvas 用紙サイズの数値入力、既定 1200x800、320〜4000px 検証、保存境界、editor / viewer の実寸描画、resize 時の要素不変、toolbar、Canvas text `searchText` | 静的実装確認済み。ブラウザ実機 QA は未確認 | `HANDOFF_2026-07-22.md` §2.1・§4.1・§4.3、`doc/implementation/MVP_CONTRACT.md` §6.1、本文書 §5.1・§5.5 |
| 2026-07-19 | Canvas の style controls、text alignment、shape inline text、既存要素上の重ね描き、図形 drag threshold、消しゴム（触れた要素を object 単位で消去する whole-object eraser）、client history、Fabric path metadata | 静的実装確認済み。ブラウザ実機 QA は未確認 | `HANDOFF_2026-07-22.md` §2.1・§4.1、`doc/implementation/MVP_CONTRACT.md` §6.2、本文書 §5.1 |
| 2026-07-19 | Canvas Browser の pointer / wheel / trackpad / touch、UI 保存・再読込、responsive QA | 未確認。静的コードの存在を runtime PASS の根拠にしない | `HANDOFF_2026-07-22.md` §4.3、`doc/testing/TEST_SCENARIOS.md` の `CANVAS-DIMENSION-001`、本文書 §5.3 |
| 2026-07-21 | 新規 `nextReviewDate = noteDate + 7日` 初期値、既存未設定値の非補完、明示値の保持 | 静的実装確認済み。月末・年末跨ぎを含む runtime QA は未確認 | `summary/20260721/1940-implement-new-note-review-date-default-20260721-24f5f31b-summary.md`, `src/modules/notes/model/note-editor-form.ts`, `src/shared/date/date-only.ts`, `doc/testing/TEST_SCENARIOS.md` |
| 2026-07-21 | Notes API runtime: 一覧 / tags / backups、Canvas 作成・復元、page resize 後の element 不変、Canvas text 検索、review、物理削除 / 404、QA cleanup | PASS（API runtime のみ。Browser QA は未確認） | `doc/testing/TEST_SCENARIOS.md` の「Notes API runtime 検証記録（2026-07-21）」 |
| 2026-07-22 | Canvas Browser runtime: 基準要素作成、drag threshold の一部、図形内文字、style 一部、1920x1080 保存・再読込、Canvas text 検索 | 部分実施。保存・復元経路は確認、実効約1265pxで drawing rail collapse を確認。7シナリオ全体は未完了 | `summary/20260722/canvas-browser-qa-partial-20260722.md`、`doc/testing/TEST_SCENARIOS.md` の「Canvas runtime QA 追補（2026-07-22）」 |
| 2026-07-24 | Canvas toolbar 修正後 Browser runtime: 375 / 768 / 1280 / 1440px、全 drawing tool click、Tab / Shift+Tab、375px touch tap、1920x1080 用紙の局所 scroll、page-wide overflow、Summary / footer scroll | 部分実施。1280px の旧 rail collapse は再現せず、主要 toolbar 到達性を確認。touch scroll 干渉、focus-visible の視覚確認、style target alignment は未確認 | `summary/20260724/canvas-toolbar-browser-qa-runtime-20260724.md`、`doc/testing/TEST_SCENARIOS.md` の「Canvas toolbar runtime QA 追補（2026-07-24）」 |

### 7.1 2026-07-19 の静的検証結果と 2026-07-22 の再確認

2026-07-19 に記録された次の結果は、コード・型・build・差分の静的確認として履歴を保持する。2026-07-22 の strict 移行後は、`summary/20260722/strict-architecture-final-review-after-ui-migration-20260722.md` の構造監査と `summary/20260722/fresh-build-verification-20260722.md` の最新 working tree に対する同じ検証結果で再確認されている。いずれもブラウザ実機 QA の PASS ではない。

| コマンド | 結果 | 判定の意味 | 証跡 |
| --- | --- | --- | --- |
| `npm run lint` | PASS | ESLint の静的検査に成功 | `summary/20260722/fresh-build-verification-20260722.md` |
| `npx tsc --noEmit --pretty false` | PASS | TypeScript 型検査に成功 | `summary/20260722/fresh-build-verification-20260722.md` |
| `npm run build` | PASS | Next.js webpack build、TypeScript、route 生成に成功 | `summary/20260722/fresh-build-verification-20260722.md` |
| `git diff --check` | PASS | whitespace error なし | `summary/20260722/fresh-build-verification-20260722.md`、および文書更新時の再確認 |

この文書はコード、設定、schema、DB、UI、API、テスト、画像、生成物を変更せず、実装状況と検証証跡を記録する。更新時は作業前後の `git status --short` と `git diff --check` を確認する。
