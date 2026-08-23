# 実装状況サマリ

更新日: 2026-08-22

## 判定基準

現行 MVP の実装・受け入れ判断は `doc/implementation/MVP_CONTRACT.md` を正本とする。Desktop Alpha は全体として未完了であり、single-instance recovery / 既存 primary lifecycle / Settings shell・bridge・entrypoint の部分実装は完了（packaged Apple Silicon GUI は未検証）だが、Settings の操作機能、provider normalization、manifest validation、compatible selection、download / apply、署名検証、migration、rollback、backup / restore、完全なデータ削除、診断は未実装である。`settings/update-state.json` の local state persistence は別の部分実装であり、承認済み artifact metadata と更新 pipeline の結合を実装済みとは扱わない。更新契約自体は承認済みであり、実装済みとは扱わない。Canvas PNG、検索サジェスト、大規模一覧は採用済みの将来要件だが未実装であり、この文書では現行 MVP と分けて扱う。autosave、Undo、専用復習タスク、NoteCard / D&D 等は未採用候補、PDF export は未実装かつ現在未採用である。

- **実装済み（静的確認）**: 現在の route、UI、Prisma schema、サービス、または確認可能な静的検証記録でコード上の実在を確認できるもの。ブラウザ実機 QA の完了を意味しない。
- **部分実装**: 一部のコードは存在するが、MVP 契約の挙動または画面状態を満たしていないもの。
- **未実装**: 現行 MVP の契約に含まれるが、必要なコードまたは route がないもの。
- **未確認（runtime QA）**: 静的な実装は確認できるが、ブラウザでの pointer、wheel、touch、保存・再読込、responsive などの実機確認記録がないもの。
- **将来契約 / 未実装**: 現行 MVP の対象外で、正本に採用済み要件として存在するが、対応コードや検証証跡がないもの。依存関係、fixture tooling、型名だけでは製品機能の実装済みと判定しない。
- **未採用候補**: 実装も採用判断も完了していないもの。既存依存や過去文書だけでは採用済みと判定しない。

静的検証の `PASS` は runtime の `PASS` を意味しない。ブラウザ実機 QA の証跡がない項目は、コードが存在していても「未確認（runtime QA）」として記録する。

## 1. 現在の判定

現在のコードには、`Notebook` の Canvas または既存 Markdown の本文モード、`NotebookCanvas` への `CanvasDocumentV1` JSON 保存、`Cue` リスト、タグ、一覧検索、詳細画面内の閲覧・編集・復習、手動バックアップが実装されている。

現行 MVP との照合結果は次のとおり。

- 学習日の不変性は実装済み。作成画面では必須の今日以前の `noteDate` を入力でき、保存後の通常編集画面では現在値を `disabled` / `readOnly` の表示専用として扱う。`PATCH /api/notes/:id` は同値の `noteDate` を許可し、異なる値を 400 `invalid_body` の `noteDate` フィールドエラー（`保存後の学習日は編集できません`）で拒否する。更新 repository は `noteDate` を更新対象に含めず、`POST /api/notes` の作成時入力は保存する。
- 新規ノートの `nextReviewDate = noteDate + 7日` は実装済み。新規フォームは `noteDate` から 7 日後の値で始まり、保存前に変更または空欄化できる。
- 既存ノートの編集では、未設定の `nextReviewDate` を自動補完しない。`nextReviewDate` は学習日と独立して変更または空欄化でき、保存済みの値を学習日から自動再計算しない。保存後の通常編集画面の `noteDate` は表示専用である。
- 既存ノートの復習画面では、画面を開いた時点の `Asia/Tokyo` 基準の現在日付 + 7日を初期表示する。保存済みの `nextReviewDate` は初期値に再利用しない。復習画面内の手動変更・空欄化と、復習成功後の API response による画面反映は維持している。
- 復習モードの本文と Summary は初期非表示になる。本文を表示した後に Summary を開ける。
- ノート内タグは、保存時の `tags` 配列 index を `NotebookTag.order` に 0 始まりで保存し、一覧・詳細の read repository は `order` 昇順で取得する。SQLite / Postgres の `20260809090000_add_notebook_tag_order` migration は既存行を Tag 名昇順（同名は `tagId` 昇順）で決定的に backfill する。`GET /api/tags` は候補を名前昇順で返し、ノート内タグの順序とは分けている。これは実装の静的確認であり、タグ順の保存・再読込を含む Browser runtime QA は未確認である。
- 詳細画面の Summary は `MarkdownReadView` で task-list checkbox を表示し、view / review で toggle できる。toggle は対応する task marker の checked 状態だけを Summary draft に反映し、dirty 状態を表示する。明示保存は既存 `PATCH /api/notes/:id` を使い、成功 response で表示中ノートを更新して dirty 状態を解除する。破棄、モード離脱、復習完了では未保存 draft を保存せずに破棄し、保存失敗時は draft と dirty 状態を保持して error を表示する。編集画面の Markdown Preview checkbox は read-only のままで、自動保存は行わない。これは実装と contract test の静的確認であり、Browser runtime、実 DB read-back、E2E は未確認である。
- 削除は確認後に物理削除する。`deletedAt` は schema に残る互換フィールドであり、Undo / soft delete の実装を意味しない。
- Desktop Alpha は全体として未完了である。single-instance recovery と既存 primary lifecycle、Settings shell / bridge / entrypoint の部分実装は確認できるが、Settings の操作機能、GitHub Releases provider response の normalization、provider-neutral manifest interface、strict manifest validation、`releases[]` の compatible selection、download / apply、公開鍵署名・SHA-256 検証、Application Support 内の app 管理 staging、承認済み artifact metadata を使う update-state integration、staging migration、rollback、完全なデータ削除、診断 bundle は未実装であり、packaged Apple Silicon GUI は未検証である。Canvas PNG、検索対象 selector、語句サジェスト、無限スクロール、list windowing に対応する製品コードは存在しない。専用復習タスク、draft / autosave、NoteCard、D&D、PDF export の route・model・UI も存在しない。
- Canvas は、`CanvasDocumentV1`（既定 page 1200x800、各 320〜4000px）の共有 validation、JSON 保存・復元、Canvas text 要素由来の `searchText`、幅・高さ数値入力と適用操作、保存済み `page` 寸法による editor / viewer の実寸描画、page 寸法だけを更新して要素 geometry を保持する処理、draw.io 風 toolbar、sticky tool、消しゴム（触れた要素を object 単位で消去する whole-object eraser）、client history、style controls、図形内文字、既存要素上の重ね描き、図形ドラッグ閾値、Fabric path metadata までコード上で実装されている。2026-07-21 に API の Canvas 保存・復元境界を確認し、2026-07-25 は Worker の Browser backend `[]` / app-server `Operation not permitted` を補う Manager 側の権限付き headless Playwright Chromium で、寸法、style、保存・再読込、eraser、history、toolbar / touch の確認済み範囲を追加した。厳密な 4px 等を残す `CANVAS-INTERACTION-001` / `CANVAS-GESTURE-001` と、全体未確認の `CANVAS-SHAPE-TEXT-001` は部分実施のままである。
- 2026-07-25 の最新 Manager fallback QA で、既存ノートの desktop edit は 1280 / 1440px、`nextReviewDate` は新規初期値・手動値保持・未設定維持の確認済み範囲を追加した。review 成功 UI、375 / 768px の mobile edit、wheel / trackpad 固有入力は未確認のままである。根拠は `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md`。
- 2026-07-31 の追加 QA では、Canvas の wheel / trackpad / touch scroll handoff と scroll 中の drawing 干渉、および 375 / 768px の note editor・viewer・review・overflow runtime は Browser backend / localhost route / server bind / headless Chromium の制約により `BLOCKED` だった。7/25 に別経路で確認済みの desktop / Canvas subset は履歴として保持し、今回の未測定範囲を runtime `PASS` へ繰り上げない。根拠は `summary/20260731/worker-canvas-scroll-wheel-touch-qa-20260731.md`、`summary/20260731/worker-mobile-note-runtime-20260731.md`。
- `/notes` の一覧カードは、`reviewedAt === null` を `未復習`、`reviewedAt !== null` を `復習済み` とする復習履歴バッジと、`nextReviewDate` の未来・今日以前・未設定を分ける次回復習状態バッジを独立して表示する。タグがある場合はタグ名・色・折り返し・長い名前の省略表示を維持し、タグがない場合は一覧カードに `タグなし` を表示しない。詳細画面などの既存 `タグなし` 表示はこの変更の対象外である。これは専用復習タスクや未完了タスクバッジを意味しない。
- 過去の検討履歴として、2026-07-31 の Postgres source reader evidence を保持する。この証跡は Postgres を採用しない方針の決定前に取得したもので、isolated frozen SQLite fixture と temporary failure injection による `better-sqlite3` require / constructor failure → `sqlite3` CLI fallback、read-only snapshot、row digest、Canvas validation、source hash / size / sidecar 不変を確認した限定 `PASS` である。壊れた native binary、実 Postgres target の baseline / reconcile、production / hosted readiness は未確認のまま保持する。現行 MVP の実装、受け入れ対象、製品ロードマップには含めない。根拠は `summary/20260731/worker-postgres-native-reader-fallback-20260731.md`、`summary/20260731/1804-recheck-postgres-native-reader-fallback-evidence-20260731-d5caeaf3-summary.md`。

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
| `POST` | `/api/notes` | 今日以前の `noteDate` を含むノート作成、Canvas JSON、Cue・タグ関連作成 | `src/app/api/notes/route.ts`, `src/server/notes/infrastructure/notebook.command.repository.ts` |
| `GET` | `/api/notes/:id` | ノート詳細取得 | `src/app/api/notes/[id]/route.ts` |
| `PATCH` | `/api/notes/:id` | ノート全体の明示更新、Canvas JSON、Cue・タグ関連の全置換。保存済み `noteDate` と異なる値は 400 `invalid_body` の `noteDate` フィールドエラー、同値は許可するが `noteDate` 自体は更新しない | `src/app/api/notes/[id]/route.ts`, `src/server/notes/infrastructure/notebook.command.repository.ts` |
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
| `NotebookTag` | `notebookId` + `tagId` の複合主キーによる多対多関連。`order` にノート内表示順を保持し、`notebookId` + `order` index を持つ。両方の削除は cascade。 |
| `Cue` | `id`, `notebookId`, `text`, `order`, `createdAt`, `updatedAt`。Notebook の Cue リスト。 |

`Notebook.deletedAt` は schema と一覧・詳細取得の `where deletedAt: null` に存在するが、削除処理は `prisma.notebook.delete` を呼ぶ物理削除である。`SoftDeleteBuffer`、`NotebookDraftState`、`NotebookReviewProgress`、`BackupLog`、`NoteCard`、`CueCard`、`NoteCueLink` の Prisma model はない。現行の `src/modules/notes/model/note-editor-form.ts` と `src/modules/notes/ui/components/editor/editor.tsx` は Cue リストと Canvas 本文を扱い、`CueCard` / `NoteCard` の保存処理・UI・route には接続していない。

## 5. 機能別の実装状況

### 5.1 実装済み（静的確認）

| 機能 | 実装内容 | 根拠 |
| --- | --- | --- |
| 明示保存 | 新規は `POST /api/notes` 成功後に `/notes/[id]` へ遷移、編集は `PATCH` 成功後に閲覧へ戻る。自動保存は行わない。 | `src/modules/notes/ui/components/editor/editor.tsx`, `src/modules/notes/remote/index.ts` |
| 学習日の不変性 | 作成画面では `noteDate` を入力でき、保存後の通常編集画面では現在値を表示専用にする。PATCH は同値を許可し、異なる値を 400 `invalid_body` の `noteDate` フィールドエラーで拒否する。 | `src/modules/notes/ui/components/editor/metadata.tsx`, `src/modules/notes/ui/components/editor/inputs.tsx`, `src/app/api/notes/[id]/route.ts`, `src/server/notes/infrastructure/notebook.command.repository.ts`, `test/notes/note-date-immutability-contract.test.js` |
| ノート CRUD | 作成時の学習日、タイトル、学習元、Canvas または legacy Markdown 本文、Summary、復習日を保存・取得する。学習日以外の項目を更新・削除し、保存後の通常編集では学習日を表示専用とする。PATCH の異なる `noteDate` は拒否する。 | `src/app/api/notes/route.ts`, `src/app/api/notes/[id]/route.ts`, `src/server/notes/infrastructure/notebook.command.repository.ts`, `src/server/notes/infrastructure/review.command.repository.ts` |
| Cue | Cue の追加・削除、`order` 保存、詳細表示、更新時の全置換。空 Cue はフォームから payload に含めない。 | `src/modules/notes/ui/components/editor/editor.tsx`, `src/modules/notes/model/note-editor-form.ts`, `src/server/notes/infrastructure/relations.repository.ts` |
| タグ | 既存候補の名前昇順取得、新規タグの保存時自動作成、保存時の `tags` 配列 index による `NotebookTag.order`、一覧・詳細の順序保持、1 ノート最大 12 件、同一ノート内の重複防止、一覧 OR フィルタ。SQLite / Postgres migration で既存行を決定的に backfill する。 | `src/modules/notes/ui/components/editor/editor.tsx`, `src/server/notes/infrastructure/relations.repository.ts`, `src/server/notes/infrastructure/read.repository.ts`, `src/server/notes/infrastructure/tag.repository.ts`, `src/app/api/tags/route.ts`, `prisma/migrations/20260809090000_add_notebook_tag_order/migration.sql`, `prisma/migrations-postgres/20260809090000_add_notebook_tag_order/migration.sql` |
| 一覧ライブ検索 / header | 実装済み（静的確認）。タイトル・legacy Markdown 本文・Summary・Cue・Canvas `searchText` の部分一致、日付範囲、タグ、`reviewDue`、ページング、空状態・loading・error 表示に加え、query の 300ms debounce、Enter の即時適用、日付・タグ・review toggle の即時適用、pending debounce を取り消す Clear を持つ。visible な検索 button はなく、review filter は「復習対象のみ」だけを visible label とし、neutral / amber の押下 style と `aria-pressed` を持つ keyboard-operable toggle button である。visible な `ON` / `OFF` badge は置かず、desktop ではタグチップ増加時もタグ操作行の位置を保つ。header は冗長な補助文を表示せず、`h1` と新規作成導線を維持する。From > To は request 前に拒否し、日付 blur は validation のみを行う。 | `src/modules/notes/ui/components/list/list.tsx`, `src/modules/notes/ui/components/list/filters.tsx`, `src/modules/notes/ui/components/list/tags.tsx`, `src/server/notes/infrastructure/read.repository.ts`, `test/notes/list-filter-layout-contract.test.js`, `test/notes/list-filter-live-search-contract.test.js`, `test/notes/list-header-contract.test.js` |
| ノート一覧カード表示 | 実装済み（静的確認）。`reviewedAt` に基づく復習履歴バッジと `nextReviewDate` に基づく次回復習状態バッジを独立表示し、タグが 0 件のときは一覧カードに `タグなし` を表示しない。 | `src/modules/notes/model/note-display.ts`, `src/modules/notes/ui/components/list/card.tsx`, `test/notes/list-visual-contract.test.js`, `doc/implementation/MVP_CONTRACT.md` §4.4 |
| 詳細モード | `/notes/[id]` 内で閲覧・編集・復習を切り替える。復習時は本文を隠す／表示する操作がある。 | `src/modules/notes/ui/components/detail/modes.tsx` |
| Markdown renderer / 編集 Preview / Summary 読み取り表示 | Cue / Summary の textarea と編集画面 Preview、GFM、sanitize、編集 Preview checkbox の表示専用化に加え、詳細画面 Summary の task-list checkbox toggle と Markdown read renderer を実装している。legacy Markdown body mode は互換表示し、Canvas 本文は Canvas viewer/editor で表示する。 | `src/shared/markdown/markdown-field.tsx`, `src/modules/notes/ui/components/detail/read-view.tsx`, `src/shared/markdown/markdown-task-list.js`, `src/modules/notes/ui/components/canvas/viewer.tsx`, `test/notes/detail-summary-checkbox-contract.test.js`, `test/notes/markdown-task-list.test.js` |
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
| 詳細画面 Summary checkbox / 明示保存 | `MarkdownReadView` が view / review の Summary task-list checkbox を操作可能な読み取り領域として表示する。toggle は task marker の checked 状態だけを `summaryDraft` に反映し、dirty 状態を管理する。明示保存は既存 `PATCH /api/notes/:id` を使い、成功時は response で表示中ノートを更新して dirty 状態を解除する。破棄・モード離脱・復習完了では未保存 draft を保存せずに破棄し、保存失敗時は draft、dirty 状態、error を保持する。編集画面の Markdown Preview checkbox は read-only のままで、自動保存は行わない。 | 実装済み（静的確認。Browser runtime、実 DB read-back、E2E は未確認） | `src/modules/notes/ui/components/detail/read-view.tsx`, `src/modules/notes/ui/components/detail/modes.tsx`, `src/modules/notes/ui/components/detail/actions.tsx`, `src/shared/markdown/markdown-task-list.js`, `src/modules/notes/model/detail-summary-payload.ts`, `test/notes/detail-summary-checkbox-contract.test.js`, `test/notes/markdown-task-list.test.js`, `doc/implementation/MVP_CONTRACT.md` §6.3 |
| 新規ノートの `nextReviewDate` 初期値 | 新規フォームは `noteDate` を基準に `addDaysToDateString(noteDate, 7)` で初期化され、空欄化して保存することもできる。2026-07-25 に初期表示と保存の UI subset を確認した。 | 実装済み（runtime 確認済み範囲） | `src/modules/notes/model/note-editor-form.initial.ts:23-62`, `src/shared/date/date-only.ts:9-17`, `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md`, `doc/implementation/MVP_CONTRACT.md:59-60` |
| 既存ノート編集時の `nextReviewDate` | 未設定値を自動補完せず、学習日と独立して変更または空欄化できる。保存済みの値を学習日から自動再計算しない。2026-07-25 に手動値の保持と未設定維持の UI subset を確認した。 | 実装済み（runtime 確認済み範囲） | `src/modules/notes/model/note-editor-form.initial.ts:23-62`, `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md`, `doc/implementation/MVP_CONTRACT.md:61-62` |
| 既存ノートの復習画面における `nextReviewDate` 初期値 | 画面を開いた時点の `todayDateString()`（`Asia/Tokyo`）の現在日付に 7 日を加えた値を初期表示し、保存済み `nextReviewDate` は初期値に再利用しない。復習画面内の手動変更・空欄化と、成功 response の `nextReviewDate` 反映を維持する。 | 実装済み（静的確認・focused contract test。review 成功 UI は未確認） | `src/modules/notes/ui/components/detail/modes.tsx`, `src/shared/date/date-only.ts:1-20`, `test/notes/detail-actions-layout-contract.test.js` |
| 既存ノート desktop edit | 既存ノートの title、学習日（現在値の表示）、source、tag、Cue、Canvas、Summary、`nextReviewDate` を 1280 / 1440px で復元し、保存後再読込、キャンセル、主要 field 到達性、viewport-wide 横 overflow 不在を確認した。保存後の通常編集画面では学習日を表示専用とする。375 / 768px の mobile edit は未確認。 | runtime 確認済み（desktop 1280 / 1440px の範囲） | `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md` |
| 復習の次回日管理 | `POST /api/notes/:id/review` は存在し、`reviewedAt` とユーザー入力の `nextReviewDate` / `null` を更新する。API / DB の保存値を自動再計算することはなく、復習画面へ入る時の初期表示だけが現在日付 + 7日になる。 | 実装済み | `src/app/api/notes/[id]/review/route.ts`, `src/server/notes/infrastructure/review.command.repository.ts:9-33`, `src/modules/notes/ui/components/detail/modes.tsx` |
| 依存ライブラリに対する高度 UI | `@dnd-kit/*`、`@uiw/react-md-editor`、`react-day-picker` は `package.json` にあるが、現行画面は native textarea / date input と手動 Cue 操作を使う。 | MVP の実装済みとは数えない | `package.json`, `src/modules/notes/ui/components/editor/editor.tsx`, `src/modules/notes/ui/components/list/list.tsx` |

### 5.3 Runtime 検証境界（API と Browser を分離）

API runtime の実リクエスト結果と、ブラウザ実機での pointer / wheel / touch / 保存・再読込 / responsive QA は別に判定する。静的実装の存在だけで Browser runtime を PASS にはしない。

#### 2026-07-21 Notes API runtime（API 境界のみ）

権限昇格後に `127.0.0.1:3107` で server listen に成功し、既存 DB を壊さない一意な QA note で実リクエストを確認した結果は PASS だった。Canvas page の `640x480` → `1920x1080` 変更後も既存 element の geometry / `style` / `text` は不変で、Canvas text 検索、review、物理削除、削除後 404、QA title の `totalCount=0` を確認した。これは API runtime の証跡であり、下表の Browser QA を PASS へ繰り上げない。詳細は `doc/testing/TEST_SCENARIOS.md` の「Notes API runtime 検証記録（2026-07-21）」を参照する。

#### Browser runtime 部分実施（2026-07-22）

2026-07-22 に in-app Browser で `http://localhost:3000` を操作し、基準 Canvas fixture の作成、図形内文字、style の一部、1920x1080 への用紙変更、明示保存、詳細・編集での再読込、Canvas text 検索を確認した。runtime 証跡は 7 シナリオの一部に限られる。重ね描きの全組合せ、preview / overlay 境界、消しゴム、Undo / Redo、全 style 境界値・色、375 / 768px、touch、全 keyboard 経路は未確認であるため、シナリオ全体は PASS にしない。詳細は `summary/20260722/canvas-browser-qa-partial-20260722.md` と `doc/testing/TEST_SCENARIOS.md` の「Canvas runtime QA 追補（2026-07-22）」を参照する。

#### Browser runtime follow-up（2026-07-24）

権限付き headless Playwright Chromium で `http://127.0.0.1:3000/notes/new` を再確認した。375 / 768 / 1280 / 1440px の実効 viewport を個別に測定し、1280px の drawing rail collapse は再現しなかった。全 drawing tool の click、Tab / Shift+Tab、375px の touch tap、body / document の page-wide overflow 不在、1920x1080 用紙の局所 horizontal scroll、Summary / `.note-paper-footer` への縦 scrollを確認した。touch の Canvas scroll 干渉、focus-visible の視覚確認、style target 選択後の alignment 即時反映は未確認のため、`CANVAS-TOOLBAR-STYLE-001` は部分実施のままとする。詳細は `summary/20260724/canvas-toolbar-browser-qa-runtime-20260724.md` と `doc/testing/TEST_SCENARIOS.md` の「Canvas toolbar runtime QA 追補（2026-07-24）」を参照する。

#### Gesture runtime follow-up（2026-07-24）

同じ local runtime で `CANVAS-INTERACTION-001` / `CANVAS-GESTURE-001` の pointer 境界を追加確認した。直線・矢印・四角・円の click、double-click、3px drag は保存要素 0 件、5px drag は各 1 件になり、4px 閾値の no-op / commit の切り分けを実測した。また、stroke、line、arrow、rect、ellipse、standalone text の各既存要素上から 6 tool で新規 gesture を開始し、基準 6 件 + 重ね描き 6 件の保存を確認した。未確定 preview の保存除外と、同じ四角 tool の inline editor overlay 上の drag が新規要素を作らないことも確認した。metadata 欠落 / unknown object、厳密な 4px、別 tool 切り替え後の shape gesture 分離、保存後の再読込は未確認のため、両シナリオは部分実施のままとする。詳細は `summary/20260724/canvas-gesture-browser-qa-runtime-20260724.md` と `doc/testing/TEST_SCENARIOS.md` の「Canvas gesture runtime QA 追補（2026-07-24）」を参照する。

#### Canvas metadata boundary hardening（2026-07-24）

Browser backend がなかったため、unknown target の実 pointer 操作は未確認である。Worker は static review と既存検証コマンドで保存境界を再確認した。pen runtime は Fabric 7 の `mouse:down:before` で metadata 欠落・unknown・preview・shape text editor target の brush 開始を抑止し、異常な `path:created` を除去する。Fabric metadata reader / converter は malformed element を `CanvasElementV1` として扱わず、metadata 欠落、unknown type、element / style / points / geometry 不正を例外なしで skip する。正規要素の geometry / style / text 変換、空白・既知要素の pen target allowlist は維持した。`npm run lint`、`npx tsc --noEmit --pretty false`、`npm run build`、`git diff --check` は PASS。`CANVAS-INTERACTION-001` は実機の unknown target pointer と保存 JSON が未取得のため部分実施のままとする。詳細は `summary/20260724/fix-canvas-unknown-target-pen-gesture-20260724-summary.md`、`summary/20260724/2336-harden-canvas-malformed-metadata-converter-20260724-e7e74449-summary.md`、`summary/20260724/2339-fix-canvas-unknown-target-pen-gesture-20260724-c4a0eeee-summary.md` を参照する。

2026-07-25 の Worker 再試行では Browser backend が `[]`、local server が `listen EPERM`、standalone Chromium が MachPort permission error で未実施だった。その後、前回成功時と同じ Manager 側の権限付き headless Playwright Chromium で `/notes/new` を再実行し、metadata 欠落、unknown type、preview、shape text editor object 上の pen gesture を確認した。全ケースで対象 object 数は不変、`path` object は 0 件、pointercancel 後の stale path はなく、保存 request / GET response の Canvas `elements` は空配列、console / page error は 0 件だった。一時ノートは DELETE 204 後 GET 404 を確認した。unknown-target runtime subset は PASS だが、厳密な 4px 境界、別 tool 切り替え後の分離、touch scroll 干渉などが残るため `CANVAS-INTERACTION-001` 全体は部分実施のままとする。詳細は `summary/20260725/canvas-unknown-target-pen-browser-qa-runtime-20260725.md` を参照する。

#### Canvas shape-tool switch gesture runtime（2026-07-25）

Worker の app-server 初期化エラー後、前回成功時と同じ Manager 側の権限付き headless Playwright Chromium で `/notes/new`（1280 x 900）を確認した。rect editor に `RECT COMMITTED` を入力して ellipse tool へ切り替えると、tool button の `flushShapeTextEditRef` により rect が text 付き group へ確定し、editor / hidden textarea は解放された。ellipse の blank drag は ellipse 1 件だけを追加した。別の ellipse editor に `ELLIPSE CANCELLED` を入力して Escape で取り消し、rect tool の blank drag を行ったところ、rect 1 件だけが追加され、cancel 済み text や stale editor は残らなかった。保存 response `201`、保存 request と保存後 GET の Canvas `elements` は `rect("RECT COMMITTED")`、`ellipse`、`rect` の 3 件で一致した。一時ノートは DELETE `204`、削除後 GET `404`、タイトル検索残留 0 件。アプリ操作中の console / page error は 0 件（cleanup の明示的な削除後 GET 404 は除外）。詳細は `summary/20260725/canvas-shape-tool-switch-gesture-separation-runtime-20260725.md` を参照する。

#### Canvas MVP remaining runtime QA 統合追補（2026-07-25）

Worker task は Browser backend `[]` と app-server `Operation not permitted` により実測できなかったため、Manager 側の権限付き headless Playwright Chromium で `http://127.0.0.1:3000/notes/new` を直接確認した。全ケースの console error / warning と page error は 0 件だった。既確認済みの 3px / 5px、unknown target pen、shape tool switch は再実施せず、厳密な 4px はユーザー判断で不要として実施していない。詳細は `summary/20260725/canvas-runtime-qa-completion-20260725.md` を参照する。

| 領域 | 2026-07-25 の確認済み範囲 | 判定 |
| --- | --- | --- |
| Canvas dimensions | 初期 `1200x800`、幅・高さ `320` / `4000` の適用、`319` / `4001`・decimal・blank の inline error / `aria-invalid=true` 拒否、幅 `320→4000` と高さ境界変更前後の rect `id` / geometry / `style` 不変を確認。 | `PASS（確認済み範囲）` |
| Canvas style controls | standalone text の font size `8` / `96` と invalid `7` / `97` / `12.5` / blank、line の stroke width `1` / `20` と invalid `0` / `21` / `1.5` / blank、text / line color、left / center / right、rect editor の font `20`・color `#16a34a`・center の `textStyle` commit を確認。 | `PASS（確認済み範囲）` |
| Canvas persistence | `Runtime Persistence QA 20260725` で POST `201` / GET `200`、page `1280x900`、standalone text `PERSIST TEXT`、line strokeWidth `4` の request / GET 一致、viewer assistive text、edit / reload title・page・text、DELETE `204`、削除後 query `totalCount=0` を確認。 | `PASS（確認済み範囲）` |
| Eraser / history | text / rect / ellipse / line の whole-object erase、非対象 geometry / style / text / points 保持、最終 object 数 `0`、空履歴 disabled、rect / text edit / page resize の Undo / Redo を確認。 | `PASS（確認済み範囲）` |
| Toolbar / touch | 375 / 768 rail `305 / 461`・`346 / 461`、tool の `aria-label` / `aria-pressed` / `data-active`、Tab / Shift+Tab、focus-visible solid 2px、640x480 / invalid 319、page vertical scroll、1920x1080 paper の local horizontal scroll を確認。375 touch は `scrollY=1779`、1280 touch は `scrollLeft 0→1069` かつ page `scrollY` 不変を確認。 | `PASS（確認済み範囲）` |
| Interaction / gesture | 3px / 5px、unknown target pen、shape tool switch は既存 summary の確認済み範囲を保持。厳密な 4px 等は今回も未確認。 | `部分実施` |
| Shape inline text | rect commit、ellipse Escape cancel、font size / alignment の style、他要素保持、保存 request / GET、再読込の確認済み subset を追加。全 tool の反復 lifecycle は未確認。 | `部分実施（必須 subset は PASS）` |

#### Existing desktop edit / nextReviewDate runtime（2026-07-25）

最新の Manager fallback QA summary に基づき、既存ノートの desktop edit と `nextReviewDate` の runtime 範囲を更新する。desktop edit は 1280 / 1440px のみを確認し、375 / 768px の mobile edit を PASS にはしない。

| 領域 | 2026-07-25 の確認済み範囲 | 判定 |
| --- | --- | --- |
| 既存ノート desktop edit | title、学習日（現在値の表示）、source、tag、Cue、Canvas、Summary、`nextReviewDate` の復元、保存後再読込、キャンセル、主要 field 到達性、body / document の viewport-wide 横幅不在、console / page error 0。保存後の通常編集画面では学習日を表示専用とする。確認用ノートは DELETE 204、GET 404、一覧 query の残留 `totalCount=0`。 | `PASS（desktop 1280 / 1440px の確認済み範囲）` |
| `nextReviewDate` | 新規ノートでは `2026-07-25` → `2026-08-01` の初期表示・保存を確認した。既存ノートの編集では、手動設定した `2026-08-05` と空欄の再読込を確認し、次回復習日は学習日と独立して扱い、学習日から自動再計算しない。 | `部分実施（確認済み範囲。review 成功 UI は未確認）` |

根拠: `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md`。

| 確認項目 | 未確認の範囲 | 判定 | 根拠 |
| --- | --- | --- | --- |
| Canvas pointer / overlap | 空白から pen / line / arrow / rect / ellipse / standalone text を作成し、2026-07-24 に既知の 6 要素上から 6 tool の新規 gesture と保存 12 要素を確認した。未確定 preview と同じ tool の inline overlay 遮断も確認した。2026-07-25 に metadata 欠落、unknown type、preview、shape text editor object の pen 遮断、pointercancel cleanup、保存 `elements=[]` を Manager 直接 runtime で確認した。厳密な 4px、別 tool 切り替え後の分離、touch scroll 干渉などは未確認。 | 部分実施（runtime QA + static hardening; unknown-target subset PASS） | `summary/20260722/canvas-browser-qa-partial-20260722.md`、`summary/20260724/canvas-gesture-browser-qa-runtime-20260724.md`、`summary/20260725/canvas-unknown-target-pen-browser-qa-runtime-20260725.md`、`summary/20260724/fix-canvas-unknown-target-pen-gesture-20260724-summary.md`、`summary/20260724/2336-harden-canvas-malformed-metadata-converter-20260724-e7e74449-summary.md` |
| Canvas drag threshold / gesture separation | 2026-07-24 に line / arrow / rect / ellipse の click、double-click、3px drag、5px drag を実行し、保存 JSON で 0 件 / 1 件と type を照合した。同じ tool の shape inline text overlay 上の drag と、2026-07-25 の別 shape tool 切り替え直後の commit / cancel → drag 分離を確認した。厳密な 4px 境界は未確認。 | 部分実施（runtime QA。shape-tool switch subset PASS） | `summary/20260722/canvas-browser-qa-partial-20260722.md`、`summary/20260724/canvas-gesture-browser-qa-runtime-20260724.md`、`summary/20260725/canvas-shape-tool-switch-gesture-separation-runtime-20260725.md` |
| Canvas shape inline text lifecycle | rect の文字 commit、ellipse の Escape cancel、別 shape tool への切り替え、font size / alignment style、他要素保持、editor / hidden textarea cleanup、保存 request / GET と再読込を確認した。全 tool の反復 lifecycle と全保存境界は未確認。 | 部分実施（必須 subset は PASS） | `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md`、`summary/20260722/canvas-browser-qa-partial-20260722.md`、`summary/20260725/canvas-shape-tool-switch-gesture-separation-runtime-20260725.md` |
| Canvas style controls / persistence | 2026-07-22 の standalone / shape text の既確認に加え、2026-07-25 に standalone text の font size `8` / `96` と invalid `7` / `97` / `12.5` / blank、line の stroke width `1` / `20` と invalid `0` / `21` / `1.5` / blank、text / line color、left / center / right、rect editor の style commit を確認した。shape text の必須 subset の保存・再読込も確認済みだが、全 tool の反復 lifecycle は未確認。 | 実機確認済み（確認範囲） | `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md`、`summary/20260725/canvas-runtime-qa-completion-20260725.md`、`summary/20260722/canvas-browser-qa-partial-20260722.md` |
| Canvas browser 保存・再読込 | 2026-07-22 の 1920x1080 保存・viewer / editor 復元に加え、2026-07-25 に standalone text / line と shape text 必須 subset の request / GET 一致、viewer assistive text、edit / reload title・page・text、DELETE 204、query cleanup を確認した。全 shape lifecycle と page 外要素は未確認。 | 部分実施（保存・再読込 subset は PASS） | `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md`、`summary/20260725/canvas-runtime-qa-completion-20260725.md`、`summary/20260722/canvas-browser-qa-partial-20260722.md` |
| Canvas wheel / trackpad / touch | 2026-07-25 に 375 touch の縦 swipe 4 回後 `scrollY=1779`・footer 到達、1280 touch の 1920x1080 paper `scrollLeft 0→1069`・page `scrollY` 不変、body / document overflow 不在を確認した。wheel / trackpad と全 pointer-scroll 干渉の組合せは未確認。 | 部分実施（touch 境界 subset は PASS） | `summary/20260725/canvas-runtime-qa-completion-20260725.md`、`summary/20260724/canvas-toolbar-browser-qa-runtime-20260724.md` |
| Canvas toolbar keyboard / responsive / focus | 2026-07-24 の 375 / 768 / 1280 / 1440px に加え、2026-07-25 に rail `305 / 461`・`346 / 461`、全 tool の `aria-label` / `aria-pressed` / `data-active`、Tab / Shift+Tab、focus-visible solid 2px、640x480 / invalid 319、page / paper scroll、touch 境界を確認した。 | 実機確認済み（確認範囲） | `summary/20260725/canvas-runtime-qa-completion-20260725.md`、`summary/20260724/canvas-toolbar-browser-qa-runtime-20260724.md` |

#### 2026-07-31 Browser / mobile follow-up

2026-07-25 Manager fallback による desktop / Canvas subset の判定は保持する。今回新たに試行した範囲だけを別判定として記録し、Browser runtime の未測定範囲を静的実装や過去の別 subset から `PASS` に推測しない。

| 対象 | 判定 | 2026-07-31 の事実と未確認範囲 |
| --- | --- | --- |
| Canvas scroll / wheel / touch / drawing handoff | `BLOCKED` | Browser backend の `agent.browsers.list()` が `[]`。既存 localhost listener への route 到達は HTTP 000、新規 server bind は `listen EPERM` で、375 / 768 / 1280px の viewport、wheel / trackpad、touch / pointer scroll、scroll 中の pen / shape 誤作成、既存 element の geometry / points / style / text / `searchText` 不変性、`/notes/[id]` 保存・再読込を測定できなかった。静的な `pointercancel` / `touchcancel` 購読や scrollable wrapper の存在は runtime `PASS` の根拠にしない。7/25 の page / paper scroll を含む確認済み toolbar / touch subset は履歴として保持するが、今回の追加シナリオは `BLOCKED` のままとする。 |
| Mobile note runtime | `BLOCKED` | 375 / 768px の `/notes/new` editor、既存ノート edit、`/notes/[id]` viewer / review、長い入力・validation error の overflow、console / page error は未確認。Browser backend は `[]`、専用 4173 server bind は `EPERM`、headless Chromium は既定 executable 不在・system Chrome 終了・利用可能な shell の MachPort permission error で起動できなかった。既存 3000 番 route の curl 200 は到達性の一部確認に留まり、visual / interaction runtime `PASS` へ繰り上げない。 |

根拠: `summary/20260731/worker-canvas-scroll-wheel-touch-qa-20260731.md`、`summary/20260731/worker-mobile-note-runtime-20260731.md`。

#### 過去の Postgres source reader 検証履歴（2026-07-31）

下表は、Postgres を採用しない方針の決定前に作成した移行用 script の検証履歴である。現行の製品経路や将来の移行計画ではない。既存の `PASS（isolated evidence の範囲）` と未確認範囲、根拠は変更せず保存する。

| 対象 | 判定 | 2026-07-31 の事実と未確認範囲 |
| --- | --- | --- |
| Postgres source reader fallback（過去の検討履歴） | `PASS（isolated evidence の範囲）` | 現行 MVP schema の frozen SQLite fixture を read-only mode `0444` で用意し、temporary harness で `better-sqlite3` の require failure と constructor failure（いずれも `ERR_DLOPEN_FAILED`）を注入した。両経路で `/usr/bin/sqlite3` CLI fallback を呼び、normal native snapshot と row digest / table count / Canvas schema validation を比較し、source bytes / SHA-256 / WAL / SHM を前後不変と確認した。temporary fixture / harness / log は cleanup 済み。targetless reconcile は target configuration 不足で exit `1` のまま Postgres 接続へ進まなかった。実際の壊れた native binary / operator packaging、実 Postgres target の baseline / row reconcile、production / hosted readiness は未確認である。 |

根拠: `summary/20260731/worker-postgres-native-reader-fallback-20260731.md`、`summary/20260731/1804-recheck-postgres-native-reader-fallback-evidence-20260731-d5caeaf3-summary.md`。

### 5.4 将来契約と未採用候補

Desktop Alpha は全体として未完了である。single-instance recovery と既存 primary lifecycle、Settings shell / bridge / entrypoint の部分実装は確認できるが、packaged Apple Silicon GUI は未検証で、Settings の操作機能、更新、migration、backup / restore、完全なデータ削除、診断は未実装である。次表は正本上の採用状態と、現在のコードで確認できる事実を分けて示す。

| 領域 | 採用状態 / 実装状態 | 確認結果・根拠 |
| --- | --- | --- |
| Desktop PoC | Tauri + Node.js sidecar の shell 選定完了（2026-08-17）。retry24 の native lifecycle / package は PASS、renderer UI automation は BLOCKED | Electron と Tauri + Node.js sidecar を、同じ現行 MVP、deterministic な 10,000 note fixture、Apple Silicon Mac、shell の main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper、関連子 process の合計メモリを含む測定軸で比較する。Tauri retry24 の `.app` / DMG package は確認済みだが、comparable な cold start / RSS と Electron の同形式追加 evidence は未確認である。製品実装は PoC と分離した `src-tauri/` にある。PDF / Playwright / Chromium は PoC の blocker や必須条件ではない。 |
| Desktop lifecycle / Settings | 採用済みの将来契約、部分実装（single-instance recovery / 既存 primary lifecycle / Settings shell） | `settings/.instance.lock` を rename / unlink しない stable advisory lock とし、Unix/macOS の `flock(LOCK_EX | LOCK_NB)` を取得する。owner 情報は別の `settings/.instance.owner` に全量書き込み・`sync_all`・同一 directory 内の `rename` で atomic replace する。secondary は focus socket を bounded retry し、`focused` または `AlreadyRunningNotReady` で終了して Tauri window / sidecar を作らない。lock を取得した primary だけが focus listener を bind し、接続不能で stale と確認できた Unix socket だけを再利用する。active / unknown protocol / permission endpoint は削除せず fail-safe で停止する。primary の ready 後の window 作成、最後の primary window close 時の app-owned sidecar / child process cleanup、guard の自分の owner marker / socket だけの cleanup も実装済みである。Settings は Mac menu と Web gear / mobile trigger の shared bridge、既存 primary WebView 内の General / Updates / Data and Backup の modal shell、focus / keyboard 制御までで、更新、backup / restore、完全削除などの操作は未実装である。根拠は `src-tauri/src/main.rs`、`src-tauri/src/window_state.rs`、`src-tauri/src/menu.rs`、`src/app/_components/settings/`、`src/shared/desktop/`、Rust / Node contract test。packaged Apple Silicon GUI は未検証で、現行 `/backup` は代替受け入れまで維持する。 |
| 更新 / migration / rollback | 採用済みの将来契約、未実装 | 初期 provider は GitHub Releases、取得側は provider-neutral な manifest interface とする。`releases[]`、channel / version / architecture / macOS compatibility の端末内判定、同一 channel の新しい compatible version のみの選択、downgrade 防止、初期配布 DMG、Apple Silicon `aarch64-apple-darwin` 向け `.app archive`、最大 1 日 1 回の更新確認、手動確認、toggle なし、background download、公開鍵署名と SHA-256、`keyId` によるアプリ内の現行鍵・次期鍵の参照、Application Support 内の app 管理 staging、atomic な `settings/update-state.json`、pending migration 時だけの safety backup、DB staging copy の migration / reopen、newer schema の非破壊導線、旧 app bundle 保持、health check 後の削除、失敗時 rollback に対応する code / packaging 設定はない。Intel、Developer ID、notarization は Public Mac Release の判断範囲である。 |
| Backup / restore / 完全なデータ削除 | 採用済みの将来契約、未実装 | 手動 SQLite export、app 管理 backup と外部 file の別 restore、restore 前 backup、schema / integrity / semantic validation、pending restore、live DB・app 管理 backup・設定だけを対象とする完全削除は未実装。通常のアンインストールでは live DB を削除せず、外部 SQLite export は完全なデータ削除の対象にしない。現行コードは `/backup` と `GET/POST /api/backups` の手動作成・一覧だけである。 |
| Startup / diagnostics / privacy | 採用済みの将来契約、未実装 | DB recovery UI、user data を含まない local log、local 診断 bundle、禁止データの allowlist / denylist test、異常終了後の一度だけの通知は未実装。local log の保持期間・容量・世代整理は未決定である。外部 telemetry や app 独自 DB encryption を Desktop Alpha の要件にはしない。 |
| Canvas PNG | Desktop Alpha 後の最初の外部出力として採用済み、未実装 | Canvas の保存済み page 全体を同寸法で出力し、paper 背景を含め、UI / Cue / Summary / legacy Markdown を除外し、page 外を切り取り、`[タイトル]_[学習日].png` を初期名にする契約である。PNG export UI、route、provider、保存処理はない。使用不可文字、同名 file、保存先、失敗時 UI、色管理は未決定。 |
| 検索サジェスト | Desktop Alpha 後の採用済み要件、未実装 | 単一の検索対象 selector、既定タイトル、タイトル / 学習元 / 本文 / Cue / すべて、local data の語句候補、1 文字目から最大 5 件、前方一致優先に対応する UI / contract / query はない。現行の tag 専用 filter は実装済みで、将来 selector に含めない。 |
| 大規模一覧 | Desktop Alpha 後の採用済み要件、未実装 | 5,000 件の長期利用目標、10,000 件の性能確認、追加読み込み型の無限スクロール、virtualization / windowing は製品 UI に未実装。現行一覧は 1 ページ 50 件のページングである。現行 query の 300ms debounce は、将来サジェストの debounce 採用を意味しない。 |
| 10,000 note fixture tooling | 比較・性能検証の補助 tooling は存在。製品機能の実装証拠ではない | `package.json` に `fixture:generate` と `dev:fixture` があり、`scripts/generate-sqlite-fixture.js` と `scripts/dev-sqlite-fixture.js` は既定 10,000 件、固定 seed `cornell-method-fixture-v1` を使う。generator は既存 migration を適用し、Canvas と relation を read-back 検証する。この文書同期では生成・性能測定を実行していない。 |
| PDF export | 未実装かつ現在未採用。再検討するかも未決定 | export route と PDF 生成コードはない。Playwright は `npm run test:e2e`、過去の MVP QA、`scripts/render-mermaid-diagrams.js` の図生成に使われているが、PDF export または Desktop PoC 必須条件の証拠ではない。 |
| Draft / autosave / version・競合 | 未採用、未実装 | `NotebookDraftState` model、autosave route / persistence、version、409 UI はない。`draft` prop や依存の存在を採用・実装済みと数えない。 |
| Undo / soft delete | 未採用、未実装 | `SoftDeleteBuffer` と Undo route はない。削除は `prisma.notebook.delete` による物理削除である。 |
| 専用復習タスク | 未採用、未実装 | `/tasks/review`、`/api/review-tasks`、進捗 model はない。現行 MVP は `reviewDue` と詳細画面内復習を使う。 |
| NoteCard / D&D | 未採用、未実装 | `NoteCard`、`CueCard`、`NoteCueLink` model と永続化 UI はない。`@dnd-kit/*` の依存だけでは実装済みと判定しない。 |
| タグ管理 mutation / 定期 backup 等 | 未採用、未実装 | `POST /api/tags`、rename / delete UI、定期 backup、`BackupLog`、`POST /api/backups/retry` はない。Tag 作成は現行ノート保存時の upsert、backup は手動作成・一覧に限る。 |

#### 5.4.1 承認済み manifest 境界と未実装状態

更新 manifest の論理 field allowlist と validation boundary は承認済みだが、実装・検証の証跡はない。GitHub Releases の provider response を正規化する adapter、strict manifest validation、compatible selection、download、signature verification、migration、apply / rollback は未実装である。

| object | 許可する field | validation boundary |
| --- | --- | --- |
| root | `productId`, `schemaVersion`, `releases` | `productId` は `com.cornellmethod.notebook` と一致し、root `schemaVersion` は必須の `1`。未知 schema version は fail closed。`releases[]` は空配列を有効な「更新なし」とする。 |
| release | `channel`, `version`, `architecture`, `minVersion`, `maxVersionExclusive`, `artifact`, `signature` | `stable` 固定、SemVer version、必須の macOS `minVersion`、任意の排他的 `maxVersionExclusive`。macOS version は数値 component で比較する。 |
| artifact | `artifactId`, `format`, `url`, `sizeBytes`, `sha256` | opaque immutable `artifactId`、`app-archive`、公開 direct HTTPS、正の整数 byte 数、64 文字 lowercase hexadecimal。 |
| signature | `keyId`, `proof` | `keyId` と opaque proof。package digest と release metadata をまとめて署名する。署名アルゴリズム名、encoding、canonicalization、鍵値は未固定。 |

実際の最低対応 macOS version と deployment target は、Apple Silicon の packaged PoC 後に決める。`minVersion` / `maxVersionExclusive` の validation boundary は承認済みだが、最低対応 version の数値は未確定である。

root、release、artifact、signature の未知 field、product ID 不一致、未知 root schema version、必須 field・型・SemVer・macOS range・artifact metadata・URL・proof の不備、同じ channel・version・architecture・macOS target の重複（duplicate）は manifest 全体を拒否する。`stable` 以外の channel、未知 architecture、未知 format はその release だけを対象外とし、他の有効な候補を評価する。Desktop Alpha の architecture は `aarch64-apple-darwin` である。

候補選択は SemVer precedence だけで行い、provider の並び順や文字列順を使わない。prerelease は対象外、build metadata は大小判定の対象外とする。現行 version より新しく、stable、Apple Silicon、`app-archive`、macOS range に適合する候補のうち最大の version を選ぶ。HTTPS から HTTPS への redirect だけを許可し、HTTP downgrade、credential、token、ユーザー固有 query は拒否する。空配列または非対象 release だけなら「更新なし」である。

manifest root の `schemaVersion: 1` と local `settings/update-state.json` の schema version は別管理とする。update state に保存するのは version、channel、architecture、`artifactId`、`sizeBytes`、`sha256`、`keyId`、verification state、app 管理 staging からの relative package path、時刻だけであり、URL、provider response 全体、token、DB、user path は保存しない。現在の state persistence の部分実装を、この artifact metadata contract や manifest validation の実装済み証拠とは扱わない。

### 5.5 Canvas 実装・検証境界（後続確認入口）

用紙サイズと Canvas の保存・描画は、現行 MVP 契約 §6.1 と次の責務分担を正本として後続確認する。コード上の実装確認と、残るブラウザ実機 QA は分けて判定する。

| 参照ファイル | 静的に確認できる責務 | 残る runtime / 後続確認 |
| --- | --- | --- |
| `src/shared/canvas/index.ts`（公開 facade。実体は `canvas-document-*` の責務別ファイル） | `CanvasDocumentV1`、既定 1200x800、320〜4000px validation、serialize / restore、`extractCanvasSearchText`。 | 2026-07-25 に無効値・境界値・page resize の Browser UI を確認済み。壊れた document の Browser / API 実機確認は残る。 |
| `src/modules/notes/contracts/note.schema.ts` | `bodyMode` と `canvas` の相互排他、Canvas validation の API 入力境界。 | API の field error 表示と保存時の実機確認。 |
| `src/server/notes/infrastructure/canvas.persistence.ts` / `src/server/notes/infrastructure/notebook.command.repository.ts` | `documentJson` / `searchText` の生成と create・update 保存。page 寸法変更用の別 API / DB column はない。 | 2026-07-25 に Browser UI の request / GET 保存境界を standalone text / line と shape text 必須 subset で確認済み。shape inline text の全保存境界と `searchText` の Browser UI は残る。 |
| `src/server/notes/infrastructure/read.repository.ts` / `src/server/notes/presenters/detail.mapper.ts` | Canvas `searchText` を一覧検索に含め、保存済み JSON を復元する。 | 2026-07-25 に viewer assistive text、編集画面、reload 後 viewer→edit の詳細復元と shape text 必須 subset の保存境界を確認済み。一覧検索の Browser UI、全 shape lifecycle、page 外要素は残る。 |
| `src/modules/notes/ui/components/canvas/editor.tsx` / `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts` | toolbar から page を更新し、DOM / Fabric を `document.page` の実寸に反映する。page 更新時は要素データを変更せず、sticky tool、重ね描き、drag threshold、図形内文字、style 即時反映、消しゴムの whole-object erase、client history を扱う。 | 2026-07-25 に page resize、style、shape text 必須 subset、eraser、history、保存・再読込、touch の確認済み範囲を追加。厳密な 4px、shape inline text の全 lifecycle、wheel / trackpad は残る。 |
| `src/modules/notes/ui/components/canvas/viewer.tsx` | 保存済み `document.page` を使って viewer の用紙を実寸描画する。 | 2026-07-25 に viewer assistive text と reload 後の title / page / text を確認済み。復習専用表示、page 外要素、responsive の全経路は残る。 |
| `src/modules/notes/ui/components/canvas/toolbar.tsx` | 用紙の幅・高さ入力、整数・範囲 validation、適用 / Enter、tool group、sticky tool の active state、線幅・文字サイズ・color・文字配置 controls、ARIA。 | 2026-07-25 に 375 / 768 rail、keyboard、focus-visible、style 即時反映、page / paper scroll、touch 境界の確認済み範囲を追加。shape inline text の保存境界全経路は残る。 |
| `src/shared/canvas/adapters/fabric/fabric-document-to-canvas.ts` / `src/shared/canvas/adapters/fabric/fabric-canvas-to-document.ts` / `src/shared/canvas/adapters/fabric/fabric-metadata.ts` / `src/shared/canvas/adapters/fabric/fabric-shape-factory.ts` | app-owned `CanvasDocumentV1` と Fabric object の変換、page 寸法・座標の反映、path metadata、points / bounds / transform の復元、shape inline text の renderer。 | 2026-07-25 に shape text の rect commit、ellipse cancel、style、他要素保持、保存・再読込の必須 subset を確認。全 tool の反復 lifecycle、厳密な 4px、wheel / trackpad は残る。 |

用紙サイズ変更は既存 `NotebookCanvas.documentJson` の page 更新だけで完結する。寸法専用の Prisma migration、Canvas document の自動変換、要素の自動再配置は追加しない。page 寸法だけを変更しても `searchText` の元である text 要素は変わらない。

## 6. セットアップ・運用コマンド

`package.json` と実在する script で確認できるコマンドだけを掲載する。製品 DB を初期化する seed は使わない。性能比較用の isolated fixture generator は製品 seed と分けて扱う。

| コマンド | 用途 |
| --- | --- |
| `npm install` | 依存関係のインストール |
| `npm run prisma:generate` | Prisma Client 生成 |
| `npm run prisma:migrate` | Prisma migration 実行と SQLite DB 作成・更新 |
| `npm run dev` | 開発サーバ起動 |
| `npm run build` | webpack を使った本番 build |
| `npm run lint` | ESLint |
| `npm run backup:copy` | SQLite DB の手動バックアップ |
| `npm run fixture:generate -- [options]` | 既存 file と live DB を上書きせず、既定 10,000 件の deterministic な SQLite fixture を生成して read-back 検証する |
| `npm run dev:fixture -- [options]` | OS の一時 directory に既定 10,000 件の fixture を作り、その DB 専用の Next.js 開発 server を起動する。終了時は生成した一時 file だけを削除する |
| `npm run diagrams:build` | Mermaid 図の抽出・SVG 生成 |

`npm run seed`、PDF / Canvas PNG 生成用の npm script、`npm run backups:retry` は存在しない。fixture command の存在は Desktop PoC、Canvas PNG、検索サジェスト、無限スクロールの実装・性能検証済みを意味しない。根拠は `package.json`、`scripts/generate-sqlite-fixture.js`、`scripts/dev-sqlite-fixture.js`。

## 7. 検証証跡

次表は、リポジトリに残る確認記録と、それを実装済みの証拠として扱える範囲を示す。

注記: 2026-07-16 の記録は UI-PAPER-015 適用前の静的照合結果です。復習時 Summary の現在状態は本書 §5.2 と現行コードを正とし、過去の判定は履歴として保持します。Canvas については、静的実装確認とブラウザ実機 QA を別の判定として記録します。2026-07-31 の Postgres source reader 証跡も、不採用方針決定前の履歴として判定値と根拠を保持し、現行 MVP やロードマップの実装証跡には使用しません。

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
| 2026-07-25 | Manager fallback: Canvas 寸法、style、shape text 必須 subset、standalone / line の保存・再読込、eraser、history、toolbar / touch | 確認済み範囲は PASS。`CANVAS-INTERACTION-001` / `CANVAS-GESTURE-001` は厳密な 4px 等が未確認のため部分実施、`CANVAS-SHAPE-TEXT-001` は必須 subset のみ PASS | `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md`、`summary/20260725/canvas-runtime-qa-completion-20260725.md` |
| 2026-07-25 | 既存ノート desktop edit と `nextReviewDate` UI: 1280 / 1440px、初期値・手動値保持・未設定維持 | desktop edit は確認済み範囲 PASS。`nextReviewDate` は review 成功 UI 未確認のため確認済み範囲の部分実施 | `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md` |
| 2026-07-31 | Canvas scroll / wheel / touch handoff と scroll 中の drawing 干渉の追加 runtime QA | `BLOCKED`。Browser backend `[]`、localhost route 到達不可、新規 server bind `EPERM` のため scroll metrics、input event、Canvas JSON 比較なし。7/25 の確認済み desktop / Canvas subset は履歴として保持し、追加範囲を PASS にしない | `summary/20260731/worker-canvas-scroll-wheel-touch-qa-20260731.md` |
| 2026-07-31 | 375 / 768px の note editor、viewer、review、overflow runtime | `BLOCKED`。Browser backend `[]` と dedicated server / headless Chromium 起動制約により、visual / interaction / console 証跡なし。curl の route 200 は runtime PASS ではない | `summary/20260731/worker-mobile-note-runtime-20260731.md` |
| 2026-07-31 | Postgres source reader（不採用方針決定前の履歴）: native failure fallback、read-only snapshot、Canvas / row integrity、targetless reconcile | `PASS（isolated frozen SQLite fixture の evidence に限定）`。実 native binary failure、実 Postgres target の baseline / reconcile、production / hosted readiness は未確認 | `summary/20260731/worker-postgres-native-reader-fallback-20260731.md`、`summary/20260731/1804-recheck-postgres-native-reader-fallback-evidence-20260731-d5caeaf3-summary.md` |

### 7.1 2026-07-19 の静的検証結果と 2026-07-22 の再確認

2026-07-19 の結果は、コード・型・build・差分の静的確認として履歴に残す。2026-07-22 の strict 移行後、`summary/20260722/strict-architecture-final-review-after-ui-migration-20260722.md` の構造監査と `summary/20260722/fresh-build-verification-20260722.md` の最新 working tree で同じ結果を再確認した。いずれもブラウザ実機 QA の PASS ではない。

| コマンド | 結果 | 判定の意味 | 証跡 |
| --- | --- | --- | --- |
| `npm run lint` | PASS | ESLint の静的検査に成功 | `summary/20260722/fresh-build-verification-20260722.md` |
| `npx tsc --noEmit --pretty false` | PASS | TypeScript 型検査に成功 | `summary/20260722/fresh-build-verification-20260722.md` |
| `npm run build` | PASS | Next.js webpack build、TypeScript、route 生成に成功 | `summary/20260722/fresh-build-verification-20260722.md` |
| `git diff --check` | PASS | whitespace error なし | `summary/20260722/fresh-build-verification-20260722.md`、および文書更新時の再確認 |

### 7.2 2026-07-31 ノート一覧ライブ検索 UI の静的検証

次表は、現行 working tree のノート一覧 UI decision に対する検証結果を、静的確認と Browser runtime に分けて記録する。

| 確認 | 結果 | 判定の意味 |
| --- | --- | --- |
| `node --test test/notes/list-filter-layout-contract.test.js test/notes/list-filter-live-search-contract.test.js test/notes/list-header-contract.test.js` | PASS、5 tests | 300ms debounce、Enter / 非 query 条件 / Clear の即時適用、visible Search button 不在、review toggle の属性・neutral / pressed style・visible `ON` / `OFF` 不在・desktop alignment、header の `h1` / 新規作成導線を source contract として確認 |
| `npm run lint` | PASS | ESLint の静的検査に成功 |
| `npx tsc --noEmit --pretty false` | PASS | TypeScript 型検査に成功 |
| `npm run build` | PASS | Prisma Client 生成を含む Next.js production build に成功 |
| `git diff --check` | PASS | 文書同期後の whitespace error なし |
| Browser visual / interaction runtime | 未確認 | live timing の実時間計測、Enter / toggle の実ブラウザ操作、loading 遷移、responsive alignment、header 視覚状態はこの docs-only task では確認していない。上記 source-contract test の PASS を Browser runtime PASS へ読み替えない |

### 7.3 2026-08-09 ノート一覧カード表示契約の静的検証

| 確認 | 結果 | 判定の意味 |
| --- | --- | --- |
| `node --test test/notes/list-visual-contract.test.js` | PASS（静的契約、5 tests） | `reviewedAt` と `nextReviewDate` の独立判定、6 通りの組み合わせ、タグ表示、空タグ時の `タグなし` 非表示を source contract として確認した |
| Browser runtime | 未確認 / NOT RUN | Browser backend が利用できないため実施していない。静的契約テストの結果を Browser runtime の PASS へ読み替えない |

### 7.4 2026-08-09 詳細 Summary checkbox 契約の判定境界

| 確認 | 結果 | 判定の意味 |
| --- | --- | --- |
| Static contract | PASS（実装・contract test の静的確認） | 詳細 Summary の checkbox toggle、task marker だけを変更する draft 更新、dirty、既存 PATCH を使う明示保存、成功時の state 更新、破棄、保存失敗時の保持、review completion との分離を source と focused contract test で確認した。編集画面 Preview の read-only 契約も確認範囲に含む。 |
| Browser runtime | 未確認 / NOT RUN | Browser backend が利用できないため view / review の toggle、API write timing、明示保存・再読込、破棄、保存失敗表示、実 DB read-back、E2E は実施していない。静的確認を Browser runtime の PASS に読み替えない |

今回の確認では safe fixture の作成、DB write、Browser runtime の代替操作を行わない。

更新対象は実装状況と検証証跡に限り、コード、設定、schema、DB、UI、API、テスト、画像、生成物は変更しない。作業前後に `git status --short` と `git diff --check` を確認する。
