# CURRENT_STATUS

確認日: 2026-07-21

## 位置づけ

この文書は、後続の Manager / Worker が現在地を誤認しないための、リポジトリ直下の現状サマリです。

参照した主な情報源は `AGENTS.md`, `HANDOFF_2026-07-19.md`, `doc/implementation/MVP_CONTRACT.md`, `doc/designs/CANVAS_TOOLBAR_DESIGN.md`, `doc/implementation/IMPLEMENTATION_STATUS.md`, `doc/README.md`, `doc/implementation/MVP_IMPLEMENTATION_TASKS.md`, `doc/testing/TEST_SCENARIOS.md`, `prisma/schema.prisma`, `src/app/**`, `src/lib/**`, `scripts/**`, `package.json` です。

重要: `AGENTS.md` は製品全体の仕様・ロードマップの正本です。現行 MVP の実装・受け入れ判断は `doc/implementation/MVP_CONTRACT.md` を優先します。この文書では、現コードで確認できたものを「実装済み（静的確認）」として扱い、ブラウザ実機 QA がないものを runtime PASS とは扱いません。

## 設計済みの範囲

### 最終仕様として設計済み

`AGENTS.md` には、以下を含む Phase 2 相当までの最終仕様が整理されています。

- ノート一覧、詳細、新規作成、バックアップ、復習タスクの画面構成。
- Markdown 入力、チェックボックス preview、タグ管理、日付範囲フィルタ、日付ソート。
- ドラフト自動保存、409 楽観ロック、確定保存、破棄、削除後 5 秒 Undo。
- CueCard / NoteCard / NoteCueLink によるカードモデルと D&D 並び替え。
- `NotebookDraftState`, `NotebookReviewProgress`, `SoftDeleteBuffer`, `BackupLog` を含む周辺テーブル。
- `/api/review-tasks`, `/api/undo`, `/api/backups/retry`, `/api/backups/logs`, `/api/notes/export` などの API。
- Playwright による PDF エクスポート。
- `/tasks/review` の専用復習タスク画面とグローバルナビの未完タスクバッジ。
- `/notes/backup` のバックアップ画面、失敗履歴、ログ確認リンク。

### MVP 設計として設計済み

`doc/README.md` によると、MVP 設計は以下のカテゴリで整理済みです。

- 要件: `doc/requirements/`
- 業務フロー: `doc/workflows/`
- 画面設計: `doc/screens/`
- API 設計: `doc/api/`
- データ設計: `doc/data/`
- 技術設計: `doc/technical/`
- 図面: `doc/diagrams/`
- テスト観点: `doc/testing/`
- 実装タスク: `doc/implementation/`

`doc/implementation/MVP_IMPLEMENTATION_TASKS.md` は 2026-06-15 時点の MVP 実装順序として、DB/API 先行を推奨し、Prisma schema、validation、notes API、tags API、backup API、layout、Markdown preview、note form、notes list、detail modes、backup screen、test/update、README、final verification の順に分割しています。

`doc/testing/TEST_SCENARIOS.md` は、MVP では明示保存、物理削除、手動復習予定、Cue / Summary の Markdown preview、中央の Canvas 本文、`/notes` の復習対象フィルタ、`/backup` の手動バックアップを確認対象にしています。自動保存、Undo、PDF、専用復習タスク、D&D、NoteCard、タグ管理 UI、バックアップログ、高機能 Markdown エディタ、ショートカットは Phase 2 / 将来確認へ分離されています。

## 現コードで確認できる実装済みの範囲

### 技術基盤

- Next.js App Router 構成が存在します。
- Prisma + SQLite 用の Prisma schema と `src/lib/prisma.ts` が存在します。
- `package.json` には Next.js 16, React 19, Prisma 7, Tailwind 4, Zod, react-markdown, remark-gfm, rehype-sanitize などが定義されています。
- `@uiw/react-md-editor`, `@dnd-kit/*`, `react-day-picker`, `playwright` は依存に含まれますが、今回確認した `src/app/**` では実利用を確認していません。

### DB モデル

`prisma/schema.prisma` で確認できるモデルは次の範囲です。

- `Notebook`
  - `title`, `noteDate`, `sourceType`, `sourceTitle`, `body`, `bodyMode`, `summary`, `nextReviewDate`, `reviewedAt`, `createdAt`, `updatedAt`, `deletedAt`
- `NotebookCanvas`
  - `notebookId`, `schemaVersion`, `documentJson`, `searchText`, `createdAt`, `updatedAt`
- `Tag`
- `NotebookTag`
- `Cue`

Canvas 本文の共有契約は `CanvasDocumentV1` です。`schemaVersion=1`、既定の用紙サイズは 1200x800px、幅・高さは 320〜4000px の整数 px、既存要素の geometry は用紙サイズ変更時に変形しません。

現 schema は MVP 寄りです。最終仕様の `NotebookDraftState`, `NotebookReviewProgress`, `SoftDeleteBuffer`, `BackupLog`, `CueCard`, `NoteCard`, `NoteCueLink` は確認できません。

### API

現コードで確認できる API は次の通りです。

- `GET /api/notes`
  - `query`, `tag`, `from`, `to`, `reviewDue`, `page` を扱います。
  - 1 ページ 50 件で `page`, `totalPages`, `totalCount`, `data` を返します。
  - タイトル、既存 Markdown 本文、サマリー、Cue、Canvas text 要素由来の `searchText` を検索対象にしています。
  - タグは OR 条件で絞り込みます。
  - `reviewDue=true` は `nextReviewDate <= today` を対象にします。
- `POST /api/notes`
  - Notebook 作成、Cue 作成、Tag upsert、NotebookTag 作成をトランザクションで実行します。`bodyMode=canvas` の場合は Canvas JSON と `searchText` も保存します。
- `GET /api/notes/:id`
  - Notebook 詳細、Cue、Tag、`bodyMode`、Canvas document を返します。
- `PATCH /api/notes/:id`
  - Notebook を更新し、Cue と Tag 関連は全置換します。Canvas の page 寸法変更では要素座標・寸法・points・style を変更しません。
- `DELETE /api/notes/:id`
  - Prisma の `delete` を呼び、物理削除しています。
- `POST /api/notes/:id/review`
  - `reviewedAt` と任意の `nextReviewDate` を更新します。
- `GET /api/tags`
  - タグ候補を名前順で返します。
- `GET /api/backups`
  - `backup/` 配下の最新 3 世代を返します。
- `POST /api/backups`
  - SQLite DB ファイルをコピーして最新 3 世代に prune します。

2026-07-18 の `prisma/migrations/20260718011243_remove_notebook_overview/migration.sql` 適用後、通常使用中の SQLite DB と `prisma/schema.prisma` に旧 overview 列はありません。Canvas persistence の作業ツリーには `NotebookCanvas` と `bodyMode` も存在し、現行ノート項目はタイトル、学習日、学習元、タグ、Cue、Canvas または既存 Markdown 本文、サマリー、次回復習日、最終復習日時です。用紙サイズ変更だけでは新しい Prisma migration を要求しません。

エラー形式は Zod validation と not found / server error で `{ code, message, errors? }` に概ね統一されています。

### 2026-07-21 Notes API runtime 検証

権限昇格後、`127.0.0.1:3107` で server listen に成功し、既存 DB を壊さない一意な QA note による Notes API 実リクエストを PASS として確認しました。`GET /api/notes`・`/api/tags`・`/api/backups` は 200、作成は 201、Canvas page / text の復元は 200、`640x480` → `1920x1080` の page resize 後も element geometry / `style` / `text` は不変、Canvas text 検索、review（`nextReviewDate=2026-08-01`）、delete（204）、削除後 404、QA title cleanup（`totalCount=0`）を確認済みです。初回 review の 500 は Turbopack 生成キャッシュ破損による環境メモで、`.next/dev` の生成キャッシュ再生成後の再試行を正とします。詳細は `doc/testing/TEST_SCENARIOS.md` の「Notes API runtime 検証記録（2026-07-21）」を参照してください。

これは API runtime の証跡であり、Browser runtime の PASS を意味しません。`agent.browsers.list()` が空だったため、Canvas の pointer / overlap / inline text / eraser / scroll / responsive は引き続き未実施です。

### UI

現コードで確認できる画面は次の通りです。

- `/`
  - `/notes` へ redirect します。
- 共通 layout
  - `/notes`, `/notes/new`, `/backup` へのナビゲーションがあります。
- `/notes`
  - ノート一覧、フリーワード検索、From/To 日付フィルタ、タグ OR フィルタ、復習対象のみフィルタ、ページング、空状態、loading/error 表示があります。
  - 日付範囲は `<input type="date">` で、`react-day-picker` の range mode ではありません。
  - 日付ソート切替 UI は確認できません。API は `noteDate desc`, `updatedAt desc` 固定です。
- `/notes/new`
  - `NoteEditor` による新規作成フォームがあります。
  - 新規フォームの `nextReviewDate` は `noteDate + 7日` を初期値とし、保存前に変更または空欄化できます。既存ノートの未設定値は補完せず、学習日の変更でも明示値を自動移動しません。
- `/notes/[id]`
  - 閲覧、編集、復習のモードがあります。
  - 復習モードでは本文を非表示にし、手動で表示できます。
  - 復習済み更新で `reviewedAt` と `nextReviewDate` を更新できます。
  - 削除は `window.confirm` で確認し、成功後 `/notes` へ戻ります。
- `/backup`
  - バックアップ一覧、手動作成、一覧更新、loading/error/success 表示があります。

### 入力・Markdown / Canvas

- `MarkdownField` は textarea と `react-markdown` preview の縦並びです。
- `remark-gfm` と `rehype-sanitize` が使われています。
- preview の checkbox は `readOnly`, `tabIndex={-1}`, `preventDefault` で表示専用にされています。
- `@uiw/react-md-editor` の利用は確認できません。
- Canvas editor / viewer は `CanvasDocumentV1` を読み書きし、Canvas text 要素を `searchText` として保存します。用紙の幅・高さは 1200x800px を既定値とする 320〜4000px の整数入力で、適用時は page だけを更新し、既存要素の `x`, `y`, `width`, `height`, `points`, `style` などを変更しません。保存済み `document.page` を editor / viewer の DOM・Fabric 実寸へ反映します。
- Canvas toolbar は draw.io 風に操作、描く、線、図形、文字、スタイル、消去、履歴、用紙を分け、tool は sticky、消しゴムは触れた要素を object 単位で消去する whole-object eraser、Undo / Redo は client history です。
- style controls は線幅 1〜20px（既定 1px）、文字サイズ 8〜96px（既定 12px）、color input、文字配置 `left` / `center` / `right` を持ち、standalone text は `style`、図形内文字は `textStyle` に保存します。
- `rect` / `ellipse` のダブルクリックは図形内文字編集です。編集中も図形外形を表示し、確定・キャンセル後に既存のペン線・線・矢印・図形・standalone text を保持します。通常の `text` クリックによる standalone text 作成とは別経路です。
- `pen` / `line` / `arrow` / `rect` / `ellipse` / `text` は空白または既知の app-owned Canvas 要素上から開始できます。未知 metadata object、preview、inline editor overlay は遮断し、図形は 4px の移動閾値を超えるまで確定しません。Fabric path 作成時には app-owned metadata と基準座標を付与して保存変換へ渡します。

### バックアップ

- `scripts/backup-copy.js` と `src/lib/backup/index.js` が存在します。
- `npm run backup:copy` は `backup/` 配下へ DB ファイルをコピーします。
- 最新 3 世代保持の prune 実装があります。
- バックアップログ DB 連携や retry 専用 API は確認できません。

## 現コードで未実装または未確認の範囲

以下は `AGENTS.md` の最終仕様にはありますが、今回の現コード確認では実装を確認できないか、ブラウザ実機での挙動をまだ確認できていません。

- `NotebookDraftState` / `NotebookReviewProgress` / `SoftDeleteBuffer` / `BackupLog` テーブル。
- `CueCard` / `NoteCard` / `NoteCueLink` のカードモデル。
- ドラフト自動保存、3 秒アイドル、6 秒間隔、409 楽観ロック、再読み込みバナー、確定保存時モーダル。
- 削除後 5 秒 Undo Snackbar、`POST /api/undo`。
- ソフトデリート。現 `DELETE /api/notes/:id` は物理削除です。
- 起動時クリーンアップバッチ。
- `/tasks/review` 画面、`GET /api/review-tasks`, `PATCH /api/review-tasks/:notebookId`。
- Canvas のブラウザ実機 QA。用紙サイズ UI、実寸 renderer、geometry 不変、toolbar、style controls、図形内文字、重ね描き、drag threshold、消しゴム（触れた要素を object 単位で消去する whole-object eraser）、client history はコード上で実装済み（静的確認）だが、以下の runtime 項目は未確認です。
- グローバルナビの復習タスク未完バッジ。
- `/api/notes/export?from&to` の PDF エクスポート。
- `/api/backups/retry`, `/api/backups/logs`。
- `/notes/backup` ルート。現コードは `/backup` です。
- `@uiw/react-md-editor` ベースのエディタ UI。
- `react-day-picker` range mode、今日/過去7日/過去30日のクイックセレクト。
- D&D 並び替え。
- Cmd/Ctrl+S, Cmd/Ctrl+N, Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z のショートカット。
- タグの既存候補オートコンプリート付き作成フォーム、色入力、右クリック名称変更/削除 UI。
- タグ削除時の確認と既存ノート紐付け解除。
- ノート欄全体の閲覧モード非表示、NoteCard 単位の hidden flag。
- バックアップのアプリ起動時自動コピー。
- README への migrate / seed / 操作デモ / スクリーンショット追記は今回未確認です。

### Canvas の未確認（runtime QA）

- 空白または既存の app-owned Canvas 要素上で、pen / line / arrow / rect / ellipse / text を作成し、既存要素の意図しない移動・resize・変形が起きないこと。未知 metadata object が新規 gesture を開始させないこと。
- 小さなクリック／ダブルクリックが no-op になり、一定のドラッグ量を超えたときだけ line / arrow / rect / ellipse が作成されること。
- 図形内文字編集で外形が表示されたままになること、確定・キャンセル後に元の shape と既存のペン線・他要素が保持されること、Fabric lifecycle error が発生しないこと。
- 線幅・文字サイズ・色・文字配置が選択中／図形内文字編集中に即時反映され、保存・再読込後に `style` / `textStyle` として復元されること。
- toolbar の keyboard / responsive / focus 到達性、Canvas pointer 操作、wheel / trackpad / touch によるページ縦 scroll と広い用紙の局所横 scroll が契約どおりであること。

### 2026-07-19 の検証境界

`HANDOFF_2026-07-19.md` に記録された `npm run lint`、`npx tsc --noEmit --pretty false`、`npm run build`、`git diff --check` の PASS は、コード・型・build・差分の静的検証です。Canvas の pointer 操作、保存・再読込、wheel / touch、responsive QA の browser runtime PASS を意味しません。

## `AGENTS.md` 最終仕様と現コードの主な差分

| 項目 | `AGENTS.md` 最終仕様 | 現コードで確認できた状態 |
| --- | --- | --- |
| DB | Draft / ReviewProgress / SoftDeleteBuffer / BackupLog / NoteCard 系まで含む | Notebook / NotebookCanvas / Tag / NotebookTag / Cue の MVP 寄り |
| ノート本文 | CanvasDocumentV1 のフリー入力本文、将来 NoteCard へ拡張 | NotebookCanvas JSON、可変 page UI、editor / viewer 実寸反映まで静的確認済み。既存 Markdown body も互換保持 |
| Canvas 本文 | `CanvasDocumentV1` の page 寸法を数値入力で変更し、要素 geometry を不変に保つ | 保存・検索境界、寸法 UI、実寸 renderer、geometry 不変は静的確認済み。API の page resize / Canvas text 検索は 2026-07-21 に runtime 確認済み。pointer、Browser UI の保存・再読込、responsive は未確認 |
| Cue | CueCard モデル、D&D 並び替え、削除確認 | Cue モデル、フォーム上の追加/削除のみ |
| 削除 | ソフトデリート + Undo 5 秒 | `delete` による物理削除 |
| 自動保存 | 3 秒アイドル + 最短 6 秒 + 409 制御 | 未確認。手動保存のみ |
| 復習 | `/tasks/review` と review status | 詳細画面内の手動復習モード、`nextReviewDate` / `reviewedAt` |
| バックアップ画面 | `/notes/backup`, retry, logs | `/backup`, 手動作成と一覧 |
| PDF | `/api/notes/export?from&to` | 未確認 |
| Markdown editor | `@uiw/react-md-editor` | textarea + `react-markdown` preview |
| 日付 picker | `react-day-picker` range mode | `<input type="date">` |
| 一覧ソート | 昇順/降順切替 | desc 固定 |
| タグ管理 | autocomplete、新規作成、色、名称変更、削除 | 編集フォーム内の自由入力、保存時 upsert、一覧側は select 候補 |
| ショートカット | Cmd/Ctrl 系保存・追加・undo/redo | 未確認 |

## 文書の参照関係と現在の残課題

### 正本と役割

- 現行 MVP の route、API、保存・削除・復習、Canvas 契約は `doc/implementation/MVP_CONTRACT.md` を正本とします。
- Canvas toolbar の visual / interaction / style 契約は `doc/designs/CANVAS_TOOLBAR_DESIGN.md`、コード上の実装済み・未実装・browser runtime 未確認の判定は `doc/implementation/IMPLEMENTATION_STATUS.md`、受け入れ項目と証跡は `doc/testing/TEST_SCENARIOS.md` を参照します。
- 2026-07-19 時点で、Canvas の設計・実装状況・受け入れシナリオの docs 同期は完了しています。完了済みの docs 同期作業を、未完了の作業や次の作業として扱いません。

### 現行 MVP 契約との差分

- 新規 `nextReviewDate = noteDate + 7日` の初期値は現行 form に実装済みです。`addDaysToDateString` により月末・年末を跨ぐ日付も計算します。既存ノートの未設定値は補完せず、学習日変更時も明示値を保持します。今回の確認は静的確認であり、runtime PASS ではありません。
- autosave / draft / 409 optimistic lock、soft delete / Undo、専用復習 task、NoteCard / D&D、PDF export、タグ管理 UI、バックアップ高度機能などは現行 MVP 外または未実装の Phase 2 / ロードマップ項目です。
- Canvas の用紙サイズ UI、実寸 renderer、geometry 不変、toolbar、style、図形内文字、重ね描き、drag threshold、消しゴム（触れた要素を object 単位で消去する whole-object eraser）、path metadata はコード上で静的確認済みです。これを browser runtime PASS とは扱いません。

### 現在の主な残課題: Canvas browser runtime QA

以下は実機確認がないため、すべて未確認のままです。

- Canvas の初期表示、pointer による空白・既存要素上の作成、重なり時の既存要素保持。
- クリック／ダブルクリックの no-op、4px drag threshold、standalone text と図形内文字の gesture 分離。
- 図形内文字の外形表示、確定・キャンセル、既存要素保持、Fabric lifecycle error の有無。
- 線幅・文字サイズ・色・文字配置の即時反映と保存・再読込後の `style` / `textStyle` 復元。
- Browser UI での用紙寸法変更後の保存・再読込、page 外要素、Canvas text 検索、wheel / trackpad / touch の縦・局所横 scroll（API の page resize / Canvas text 検索は別途 2026-07-21 に PASS）。
- 375 / 768 / 1280 / 1440px の toolbar responsive、keyboard / touch 到達性、focus、ARIA、tooltip、page-wide horizontal overflow。

静的検証の `npm run lint`、`npx tsc --noEmit --pretty false`、`npm run build`、`git diff --check` と、2026-07-21 の Notes API runtime PASS は Browser runtime QA の PASS を意味しません。実施結果は `doc/testing/TEST_SCENARIOS.md` の Canvas シナリオと API runtime 記録へ分離して記録し、必要に応じてこの文書と `IMPLEMENTATION_STATUS.md`、handoff を証跡に合わせて更新します。

### Phase 2 / 将来設計の扱い

- `doc/designs/CANVAS_PARTIAL_ERASER_DESIGN.md` の部分消しゴムは将来設計として保持し、現行の whole-object eraser と混同しません。
- `AGENTS.md` にある autosave、Undo、専用復習 task、カード分割、PDF などのロードマップと、過去の QA 記録は各設計・テスト・summary に履歴として保持します。現行 MVP の実装済み判定には繰り上げません。

## 次回作業時の最小 Next Read

次回は次の順で、現在の docs と直近 Canvas 同期 summary を起点にします。

1. `HANDOFF_2026-07-19.md`
2. `summary/20260719/2143-sync-canvas-interaction-design-contract-20260719-5b6bd3a6-summary.md`
3. `summary/20260719/2153-sync-canvas-implementation-status-20260719-7ac6f95e-summary.md`
4. `summary/20260719/2200-sync-canvas-acceptance-scenarios-20260719-62f6da35-summary.md`
5. `doc/implementation/MVP_CONTRACT.md`
6. `doc/designs/CANVAS_TOOLBAR_DESIGN.md`
7. `doc/implementation/IMPLEMENTATION_STATUS.md`
8. `doc/testing/TEST_SCENARIOS.md`
9. runtime QA または実装確認が必要な場合だけ、対象の `src/app/notes/_components/**`、Canvas adapter、共有 Canvas 契約を読む。

## 今回の確認で実行した主なコマンド

- `git status --short`
- `sed` による指定ドキュメントと対象コードの読み取り
- `find src/app -maxdepth 4 -type f`
- `find src/lib -maxdepth 4 -type f`
- `rg --files src/app src/lib scripts`
- `rg` による未実装候補 API / model / UI キーワード確認

raw log はこの文書に含めていません。判断に必要な要約のみを記録しています。
