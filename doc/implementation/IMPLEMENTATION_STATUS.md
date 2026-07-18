# 実装状況サマリ

更新日: 2026-07-18

## 判定基準

現行 MVP の実装・受け入れ判断は `doc/implementation/MVP_CONTRACT.md` を正本とする。`AGENTS.md` にあるドラフト、Undo、専用復習タスク、PDF、カード分割などの記述は製品ロードマップであり、この文書では現行 MVP と分けて扱う。

- **実装済み**: 現在の route、UI、Prisma schema、サービス、または確認可能な検証記録で実在を確認できるもの。
- **部分実装**: 一部のコードは存在するが、MVP 契約の挙動または画面状態を満たしていないもの。
- **未実装**: 現行 MVP の契約に含まれるが、必要なコードまたは route がないもの。
- **Phase 2 / 仕様のみ**: 現行 MVP の対象外であり、仕様・ロードマップにだけ存在するもの。依存関係や型名だけでは実装済みと判定しない。

## 1. 現在の判定

現在のコードは、`Notebook` に Canvas または既存 Markdown の本文モードを持たせ、`NotebookCanvas` に `CanvasDocumentV1` JSON を保存し、`Cue` リスト、タグ、一覧検索、詳細画面内の閲覧・編集・復習、手動バックアップを提供する小さな MVP である。

現行 MVP と照合した重要な差分は次のとおり。

- 新規作成時の `nextReviewDate = noteDate + 7日` は実装されていない。新規フォームは空欄で始まり、空欄のまま保存すると `null` になる。
- 復習モードの本文と Summary は初期非表示になる。本文を表示した後に Summary を開ける。
- 削除は確認後に物理削除する。`deletedAt` は schema に残る互換フィールドであり、Undo / soft delete の実装を意味しない。
- 専用復習タスク、ドラフト自動保存、NoteCard、D&D、PDF export などの route・model・UI は存在しない。
- Canvas の共有 validation、JSON 保存・復元、Canvas text 要素由来の `searchText` はコード上にある。一方、本文領域の幅・高さ数値入力、適用操作、保存済み page 寸法を使った editor / viewer の可変描画、用紙サイズ変更時の要素不変挙動は未完了である。

## 2. 画面と route

### 実装済み

| Route | 実装状況 | 根拠 |
| --- | --- | --- |
| `/` | `/notes` へ redirect | `src/app/page.tsx` |
| `/notes` | 一覧、フリーワード・日付・タグ・復習対象フィルタ、ページング | `src/app/notes/page.tsx`, `src/app/notes/_components/notes-list.tsx` |
| `/notes/new` | 明示保存の新規作成フォーム。Canvas 本文モードを初期化する | `src/app/notes/new/page.tsx`, `src/app/notes/_components/note-editor.tsx`, `src/app/notes/_components/note-canvas-editor.tsx` |
| `/notes/[id]` | Canvas / 既存 Markdown の閲覧・編集・復習モード、確認後削除 | `src/app/notes/[id]/page.tsx`, `src/app/notes/_components/note-detail-modes.tsx`, `src/app/notes/_components/note-canvas-editor.tsx`, `src/app/notes/_components/note-canvas-viewer.tsx` |
| `/backup` | 手動バックアップ作成、最新一覧、更新・成功・失敗表示 | `src/app/backup/page.tsx` |

共通ナビゲーションは `/notes`、`/notes/new`、`/backup` の 3 つを提供する。`/tasks/review` と `/notes/backup` は現行 MVP の route ではない。根拠は `src/app/layout.tsx`、`doc/implementation/MVP_CONTRACT.md` §3。

### 実装されていない画面

`/tasks/review`、復習タスクのタブ、未完了タスクバッジ、`/notes/backup` は、対応する page component や API route がない。現行 MVP では `/notes` の `reviewDue` フィルタから `/notes/[id]` の復習モードへ進む。根拠は `src/app/**` の route 一覧、`doc/implementation/MVP_CONTRACT.md` §3・§4.3。

## 3. 実在する API endpoint

route handler の export と一致する一覧は次のとおり。これ以外の endpoint は主な API として扱わない。

| Method | URL | 実装状況 | 根拠 |
| --- | --- | --- | --- |
| `GET` | `/api/notes` | 一覧・検索・ページング（Canvas `searchText` を含む） | `src/app/api/notes/route.ts`, `src/server/notes/infrastructure/read.repository.ts` |
| `POST` | `/api/notes` | ノート作成、Canvas JSON、Cue・タグ関連作成 | `src/app/api/notes/route.ts`, `src/server/notes/infrastructure/command.repository.ts` |
| `GET` | `/api/notes/:id` | ノート詳細取得 | `src/app/api/notes/[id]/route.ts` |
| `PATCH` | `/api/notes/:id` | ノート全体の明示更新、Canvas JSON、Cue・タグ関連の全置換 | `src/app/api/notes/[id]/route.ts`, `src/server/notes/infrastructure/command.repository.ts` |
| `DELETE` | `/api/notes/:id` | 物理削除、成功時 `204` | `src/app/api/notes/[id]/route.ts`, `src/server/notes/infrastructure/command.repository.ts` |
| `POST` | `/api/notes/:id/review` | `reviewedAt` と任意の `nextReviewDate` を更新 | `src/app/api/notes/[id]/review/route.ts`, `src/server/notes/infrastructure/command.repository.ts` |
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

`Notebook.deletedAt` は schema と一覧・詳細取得の `where deletedAt: null` に存在するが、削除処理は `prisma.notebook.delete` を呼ぶ物理削除である。`SoftDeleteBuffer`、`NotebookDraftState`、`NotebookReviewProgress`、`BackupLog`、`NoteCard`、`CueCard`、`NoteCueLink` の Prisma model はない。`src/app/notes/types.ts` の `CueCard` / `NoteCard` は型定義だけで、保存処理・UI・route に接続されていない。

## 5. 機能別の実装状況

### 5.1 実装済み

| 機能 | 実装内容 | 根拠 |
| --- | --- | --- |
| 明示保存 | 新規は `POST /api/notes` 成功後に `/notes/[id]` へ遷移、編集は `PATCH` 成功後に閲覧へ戻る。自動保存は行わない。 | `src/app/notes/_components/note-editor.tsx`, `src/modules/notes/remote/index.ts` |
| ノート CRUD | タイトル、学習日、学習元、Canvas または legacy Markdown 本文、Summary、復習日を保存・取得・更新・削除。 | `src/app/api/notes/route.ts`, `src/app/api/notes/[id]/route.ts`, `src/server/notes/infrastructure/command.repository.ts` |
| Cue | Cue の追加・削除、`order` 保存、詳細表示、更新時の全置換。空 Cue はフォームから payload に含めない。 | `src/app/notes/_components/note-editor.tsx`, `src/modules/notes/model/note-editor-form.ts`, `src/server/notes/infrastructure/command.repository.ts` |
| タグ | 既存候補の取得、新規タグの保存時自動作成、1 ノート最大 12 件、同一ノート内の重複防止、一覧 OR フィルタ。 | `src/app/notes/_components/note-editor.tsx`, `src/app/api/tags/route.ts`, `src/modules/notes/contracts/note.schema.ts` |
| 一覧検索 | タイトル・legacy Markdown 本文・Summary・Cue・Canvas `searchText` の部分一致、日付範囲、タグ、`reviewDue`、ページング、空状態・loading・error 表示。 | `src/app/notes/_components/notes-list.tsx`, `src/server/notes/infrastructure/read.repository.ts` |
| 詳細モード | `/notes/[id]` 内で閲覧・編集・復習を切り替える。復習時は本文を隠す／表示する操作がある。 | `src/app/notes/_components/note-detail-modes.tsx` |
| Markdown 表示 | Cue / Summary の textarea と preview、GFM、sanitize、preview checkbox の表示専用化。legacy Markdown body mode は互換表示する。Canvas 本文は Canvas viewer/editor で表示する。 | `src/shared/markdown/markdown-field.tsx`, `package.json`, `src/app/notes/_components/note-canvas-viewer.tsx` |
| 確認後の削除 | 詳細画面で `window.confirm` を表示し、確定後に物理削除して `/notes` へ戻る。削除後の Undo / 個別復元は保証しない。 | `src/app/notes/_components/note-detail-modes.tsx`, `src/app/api/notes/[id]/route.ts`, `prisma/schema.prisma` |
| 手動バックアップ | `/backup` と `POST /api/backups`、`npm run backup:copy` で DB を `backup/` へコピーし、最新 3 世代を保持する。 | `src/app/backup/page.tsx`, `src/app/api/backups/route.ts`, `src/server/backup/infrastructure/local-sqlite-backup-provider.js`, `package.json` |
| API validation / error | Zod による body/query validation と `{ code, message, errors? }` 形式の route response。 | `src/modules/notes/contracts/note.schema.ts`, `src/shared/http/api-error.ts`, `src/shared/http/route-response.ts` |
| Canvas persistence / search | `CanvasDocumentV1` の validation、`NotebookCanvas.documentJson` 保存・復元、text 要素から `searchText` を生成し一覧 query に含める処理。page 寸法 validation は 320〜4000px の整数。 | `src/shared/canvas/canvas-document.ts`, `src/modules/notes/contracts/note.schema.ts`, `src/server/notes/infrastructure/command.repository.ts`, `src/server/notes/infrastructure/read.repository.ts`, `src/server/notes/presenters/notes.mapper.ts` |

### 5.2 部分実装または MVP 契約との差分

| 契約項目 | 実際の挙動 | 判定 | 根拠 |
| --- | --- | --- | --- |
| 復習モードの本文・Summary | 本文と Summary は復習開始時に非表示で、本文を表示した後に Summary を開ける。表示・再非表示の状態は保存しない。 | 実装済み（runtime QA は別途確認） | `src/app/notes/_components/note-detail-modes.tsx` |
| 新規 `nextReviewDate` 初期値 | 新規フォームは `initial?.nextReviewDate ?? ""` で初期化され、`noteDate + 7日` の計算がない。空欄保存は `null` になる。 | 未実装（現行 MVP 要件） | `src/modules/notes/model/note-editor-form.ts:66-76`, `src/server/notes/infrastructure/command.repository.ts:76-78`, `doc/implementation/MVP_CONTRACT.md:57-59` |
| 復習の次回日管理 | `POST /api/notes/:id/review` は存在し、`reviewedAt` とユーザー入力の `nextReviewDate` / `null` を更新する。日付の自動再計算はない。 | 実装済み。ただし初期値の不足は上記の未実装 | `src/app/api/notes/[id]/review/route.ts`, `src/server/notes/infrastructure/command.repository.ts:168-195` |
| 依存ライブラリに対する高度 UI | `@dnd-kit/*`、`@uiw/react-md-editor`、`react-day-picker` は `package.json` にあるが、現行画面は native textarea / date input と手動 Cue 操作を使う。 | MVP の実装済みとは数えない | `package.json`, `src/app/notes/_components/note-editor.tsx`, `src/app/notes/_components/notes-list.tsx` |
| Canvas 用紙サイズ UI / renderer | 現在の editor / viewer は `CANVAS_PAGE` の 1200x800 と表示倍率 state を参照する。幅・高さの数値入力、適用操作、保存済み `document.page` に基づく可変描画、既存要素を不変にしたままの resize は未実装。 | 部分実装 | `src/app/notes/_components/note-canvas-editor.tsx`, `src/app/notes/_components/note-canvas-viewer.tsx`, `src/app/notes/_components/note-canvas-toolbar.tsx`, `src/shared/canvas/canvas-document.ts` |

### 5.3 Phase 2 / 仕様のみ

以下は仕様上の将来機能であり、現行コードに対応する route・Prisma model・保存処理・UI はない。

| 領域 | 未実装の機能 | 確認結果・根拠 |
| --- | --- | --- |
| Draft / autosave | `NotebookDraftState`、3 秒 autosave、差分保存、version、楽観ロック、409 UI、再試行バナー | `src/app/api/**`、`prisma/schema.prisma`、`src/app/notes/_components/note-editor.tsx` に対応実装なし。`draft` prop は未使用の props に留まる。仕様は `doc/implementation/MVP_CONTRACT.md` §2・§9。 |
| Undo / soft delete | `SoftDeleteBuffer`、5 秒 Snackbar、`POST /api/undo`、期限切れ purge、削除後復元 | `src/app/api` に Undo route なし。削除は `src/server/notes/infrastructure/command.repository.ts` の `prisma.notebook.delete`。仕様は `doc/implementation/MVP_CONTRACT.md` §4.2・§9。 |
| 専用復習タスク | `/tasks/review`、`/api/review-tasks`、1 日後 / 1 週間後タスク、review status、未完了バッジ、自動予定 | `src/app` と `prisma/schema.prisma` に対応 page / route / model なし。現行 MVP は `GET /api/notes?reviewDue=true` と詳細画面内復習のみ。 |
| Card / D&D | NoteCard、CueCard の永続化、複数本文カード、`NoteCueLink`、hidden flag、D&D 並び替え | `prisma/schema.prisma` に model なし。`src/app/notes/types.ts` は型定義のみで、`src/app/notes/_components/note-editor.tsx` に D&D import / 実装なし。 |
| PDF / HTML export | 期間 export、`GET /api/notes/export`、Playwright PDF、1 ノート 1 ページ | export route と PDF 生成コードなし。`playwright` は `scripts/render-mermaid-diagrams.js` で図の SVG 生成に使われるだけで、PDF export の証拠ではない。根拠は `src/app/api/**`、`scripts/render-mermaid-diagrams.js`、`package.json`。 |
| タグ管理 | `POST /api/tags`、名称変更、削除、右クリック管理 UI | `src/app/api/tags/route.ts` は `GET` のみ。Tag の作成はノート保存時の upsert に限る。 |
| バックアップ高度機能 | 起動時自動コピー、`BackupLog`、`POST /api/backups/retry`、ログ UI、自動復元 | `prisma/schema.prisma` にログ model なし、`src/app/api/backups/route.ts` は GET/POST のみ。現行は手動作成・一覧のみ。 |
| 高度なキーボード操作 / A11y | Cmd/Ctrl+N、Undo/Redo、D&D のキーボード操作、モーダル focus trap、詳細な ARIA 制御 | `src/app/notes` に該当 keydown / D&D / focus trap 実装なし。Cue 追加等の通常ボタン操作と一部の入力 ARIA は実装済み。 |

### 5.4 Canvas 用紙サイズの後続実装入口

用紙サイズ UI を実装する Worker は、次の責務境界を正本として読む。

| 参照ファイル | 確認する責務 | 現在の未決／未実装 |
| --- | --- | --- |
| `src/shared/canvas/canvas-document.ts` | `CanvasDocumentV1`、既定値、320〜4000px validation、serialize/restore、`extractCanvasSearchText` | page 寸法の既存要素不変更新 helper は未定義 |
| `src/modules/notes/contracts/note.schema.ts` | `bodyMode` と `canvas` の相互排他、Canvas validation の API 入力境界 | field 単位の page 寸法エラー表示形式は UI task で確定する |
| `src/server/notes/infrastructure/command.repository.ts` | `documentJson` / `searchText` の create・upsert 保存 | resize 用の別 API や DB column は作らない |
| `src/server/notes/infrastructure/read.repository.ts` | Canvas `searchText` を含む一覧検索 | page 寸法だけでは検索結果を変えないことを確認する |
| `src/app/notes/_components/note-canvas-editor.tsx` | 編集操作、表示倍率、Fabric への document 反映 | `CANVAS_PAGE` 定数ではなく保存済み `document.page` を使い、幅・高さ数値入力を追加する |
| `src/app/notes/_components/note-canvas-viewer.tsx` | 保存済み Canvas の閲覧 renderer | 保存済み `document.page` と表示用 Fit scale を分離する |
| `src/app/notes/_components/note-canvas-toolbar.tsx` | 現在の Fit / 50% / 100% / 200% 表示操作 | これらを用紙サイズ操作と混同しない UI 配置へ分離する |

用紙サイズ変更の保存は既存の `NotebookCanvas.documentJson` 更新で完結する。page 寸法用の Prisma migration、Canvas document の自動変換、要素の自動再配置はこの実装 task の前提にしない。

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

注記: 2026-07-16 の記録は UI-PAPER-015 適用前の静的照合結果です。復習時 Summary の現在状態は本書 §5.2 と現行コードを正とし、過去の判定は履歴として保持します。

| 日付 | 確認範囲 | 結果 | 証跡 |
| --- | --- | --- | --- |
| 2026-07-05 | `/` redirect、一覧、新規作成、編集保存、復習モード、検索、削除、バックアップの主要 UI フロー | PASS | `summary/20260705/mvp-ui-flow-reverification-report.md` |
| 2026-07-05 | API CRUD、review、検索、タグ、validation、not found、backup prune | PASS | `summary/20260705/manager-mvp-api-crud-validation-backup-reverification-report.md` |
| 2026-07-05 | GFM checkbox、preview checkbox の表示専用挙動、閲覧・復習時の Markdown sanitize | PASS | `summary/20260705/manager-markdown-sanitize-checkbox-verification-report.md` |
| 2026-07-05 | `npm run backup:copy` と最新 3 世代保持 | PASS | `summary/20260705/backup-copy-command-verification-report.md` |
| 2026-07-04〜2026-07-05 | Prisma validate/generate、`npm run lint`、`npm run build` | PASS | `doc/testing/TEST_SCENARIOS.md` の検証記録、`summary/20260705/mvp-ui-flow-reverification-report.md`, `summary/20260705/manager-fix-ui009-note-editor-tag-candidates-summary.md`, `summary/20260705/manager-fix-ui014-edit-save-state-summary.md` |
| 2026-07-16 | `nextReviewDate + 7日` 初期値、既存未設定値の非補完、復習 Summary 初期非表示 | 未実施。静的照合では初期値と Summary 非表示に差分あり | `doc/testing/TEST_SCENARIOS.md` の 2026-07-16 記録、本文書 §5.2 |
| 2026-07-18 | Canvas 用紙サイズの数値入力、既定 1200x800、320〜4000px 検証、保存後復元、resize 時の要素不変、表示倍率との分離 | 未実施。共有 validation / JSON 保存境界は確認済みだが、editor / viewer の可変 page UI と runtime resize は未確認 | `doc/testing/TEST_SCENARIOS.md` の `CANVAS-DIMENSION-001`、本文書 §5.2・§5.4 |

この文書の更新ではコード、設定、schema、DB、UI、API、テスト、画像、生成物を変更しない。最終確認では対象ファイルが `doc/implementation/IMPLEMENTATION_STATUS.md` のみであることと `git diff --check` を確認する。
