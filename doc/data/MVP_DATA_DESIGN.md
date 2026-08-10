# MVP データ設計案

確認日: 2026-07-18

## 位置づけ

フルリニューアル版 Cornell Method Notebook の MVP データ設計を定めます。

対象は、コーネルメソッドの「記録、整理、要約、想起、復習」を支える最小データ構造です。

MVP 実装対象の Prisma schema は `Notebook`, `NotebookCanvas`, `Cue`, `Tag`, `NotebookTag` を中心に整理します。Canvas の用紙サイズは `NotebookCanvas.documentJson` 内の `CanvasDocumentV1.page` で管理し、用紙サイズ変更のために別カラムを増やしません。

## 設計方針

- MVP では、ノート本文をカード分割せず、中央のフリー入力 Canvas として `CanvasDocumentV1` を扱う。Cue と Summary は Markdown として扱い、既存の Markdown 本文モードは互換表示のために保持する。
- キーワード / 質問は Cue リストとして持つ。
- Cue と本文の厳密なリンクは持たない。
- ノートが復習対象かどうかを判断できる最小データだけを保存し、復習モードの表示状態は UI に置く。
- 自動保存、Undo、詳細な楽観ロック、高度な間隔反復は MVP から外す。
- タグ名を検索と分類で共有するため、MVP でもタグを正規化する。
- MVP の削除 command は物理削除とする。`Notebook.deletedAt` は現 schema に残る互換用カラムであり、MVP API は互換 guard に限って参照し、値を設定しない。
- `Notebook` 削除時は `Cue` と `NotebookTag` を外部キーの `onDelete: Cascade` で同時削除する。

## 保存・バックアップ・外部出力の境界

現行 MVP、Phase 2、将来のデスクトップ版で、ノートデータの唯一の正本（canonical source of truth）は SQLite DB です。内部データは user data directory 内の SQLite live DB に保存し、アプリ本体の `app bundle` には live file を置きません。開発用 Web 起動では既存の `DATABASE_URL` が指す SQLite file を使い、Desktop 配布では user data directory 内の絶対 path へ解決する adapter を検討します。

保存と出力の役割は次のように分離します。

| 区分 | 内容 | 正本との関係 |
| --- | --- | --- |
| 内部データ | user data directory 内の SQLite live DB。Notebook、Canvas、Cue、Tag 等を保持する | 唯一の正本。アプリの読み書きは SQLite を通す |
| バックアップ | SQLite DB ファイルのコピー | SQLite の保全用コピー。PDF や別形式のノート出力とは別の復元単位 |
| 外部出力 | SQLite から生成する PDF | 一方向に生成する派生出力。編集用データ形式、復元用正本、SQLite との双方向同期対象ではない |

PDF 生成は現行 MVP に実装されていません。Phase 2 で SQLite の保存済みデータから PDF を生成する provider、レイアウト、エラー処理、出力先を定義します。具体的な PDF 出力先は未決定のため、この文書では固定しません。

PDF から SQLite へ戻す import、PDF を編集して SQLite を更新する運用、PDF と SQLite の双方向同期は対象外です。

SQLite の live DB をクラウド DB、iCloud / Dropbox 等の同期フォルダ、オンラインサービスへ置く設計は採用しません。クラウド DB、クラウド同期、オンラインサービスは製品スコープ外であり、将来実装予定の保存方式として扱いません。

## 現 Prisma schema との対応

MVP の物理 DB は SQLite で、Prisma model 名は PascalCase、テーブル名とカラム名は `@@map` / `@map` で snake_case に対応させます。

| Prisma model | DB table | MVP での責務 |
| --- | --- | --- |
| `Notebook` | `notebooks` | ノート本体、`bodyMode`、既存 Markdown 本文、要約、復習予定を保持する |
| `NotebookCanvas` | `notebook_canvases` | Canvas 本文の JSON、schema version、Canvas text 要素から作る一覧検索用 `searchText` を保持する |
| `Cue` | `cues` | Cornell 左欄の Cue / キーワード / 質問を表示順付きで保持する |
| `Tag` | `tags` | タグ候補のマスタを一元管理する |
| `NotebookTag` | `notebook_tags` | Notebook と Tag の多対多関連を保持する |

MVP の schema は上記の model に限定します。詳細仕様の `NotebookDraftState`, `NotebookReviewProgress`, `SoftDeleteBuffer`, `BackupLog`, `CueCard`, `NoteCard`, `NoteCueLink` は Phase 2 以降の拡張対象です。

## MVP エンティティ

### Notebook

ノート本体です。Cornell Method の本文、要約、復習状態を持ちます。

| 項目 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `id` | string | 必須 | 主キー |
| `title` | string | 必須 | ノートタイトル |
| `noteDate` | date | 必須 | 学習日 |
| `sourceType` | string | 任意 | 学習元の種類。例: book, lecture, video, article, other |
| `sourceTitle` | string | 任意 | 書籍名、講義名、動画名など |
| `bodyMode` | string | 必須 | `canvas` または `markdown`。Canvas を既定の新規本文モードとし、既存 Markdown 本文は互換モードで保持する |
| `body` | string | 必須 | `bodyMode=markdown` の本文 Markdown。`bodyMode=canvas` では空文字 |
| `summary` | string | 任意 | 要約。Markdown |
| `nextReviewDate` | date | 任意 | 次に復習する予定日 |
| `reviewedAt` | datetime | 任意 | 最後に復習済みにした日時 |
| `createdAt` | datetime | 必須 | 作成日時 |
| `updatedAt` | datetime | 必須 | 更新日時 |
| `deletedAt` | datetime | 任意 | 現 schema の互換用カラム。MVP は値を設定せず、互換 guard に限って参照する。soft delete は Phase 2 の候補 |

責務:

- 1 レコードが 1 ノートを表す。
- `bodyMode=markdown` のとき `body` はカード分割しない本文全体の Markdown を保持する。`bodyMode=canvas` のとき本文の正本は `NotebookCanvas.documentJson` である。
- Canvas document は `schemaVersion=1`、`page.background="paper"`、`page.width` / `page.height` を可変の整数 px とし、既定値を 1200x800、許容範囲を 320〜4000px とする。
- 用紙サイズ変更は JSON の `page.width` / `page.height` だけを更新する。既存要素の `x`, `y`, `width`, `height`, `points`, `style` は変更せず、境界外の要素も削除、移動、縮小しない。
- 既存の 1200x800 Canvas document は自動変換せず、そのまま保存と復元ができる。Canvas JSON の保存領域を利用するため、用紙サイズ変更だけでは Prisma migration を追加しない。
- `summary` は Markdown 入力を許可するが、MVP では別テーブルへ分けない。
- `nextReviewDate` は、ユーザーが保存前に確定した次回復習予定日または null を保持する。新規作成画面と復習画面は固定初期値を表示するが、既存保存値への追従更新や継続的な復習スケジュール生成は行わない。
- `reviewedAt` はユーザーが復習済みにした最終日時を保持する。
- `deletedAt` は現 migration に存在する互換用カラムである。一覧と件数取得（検索、絞り込みを含む）、詳細取得、更新、削除、復習更新の対象を `deletedAt: null` の Notebook に限定する guard として参照する。
- MVP の書き込み処理は `deletedAt` を設定しない。`DELETE /api/notes/:id` は guard 通過後に Prisma `delete` で Notebook を物理削除する。
- 一覧の基本絞り込みに使うため、`noteDate` と `nextReviewDate` に index を持つ。

### NotebookCanvas

Canvas 本文を使う Notebook と 1:1 で関連する JSON 保存領域です。

| 項目 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `notebookId` | string | 必須 | `Notebook.id` と同じ主キー。Notebook 削除時は cascade delete |
| `schemaVersion` | integer | 必須 | 現行は `1`。未知の version は復元せず validation error とする |
| `documentJson` | string | 必須 | `CanvasDocumentV1` の JSON。`page` と `elements` を含む |
| `searchText` | string | 必須 | Canvas の text 要素を表示順に連結した一覧検索用の派生値 |
| `createdAt` / `updatedAt` | datetime | 必須 | Canvas JSON の作成・更新日時 |

責務:

- `documentJson.page.width` / `page.height` は用紙そのものの幅と高さであり、整数 px の 320〜4000 の範囲で保存する。既定値は 1200x800。
- 用紙サイズ変更では `documentJson` の page 寸法だけを変更し、要素の座標、寸法、points、style を書き換えない。用紙境界外の要素も JSON から除外しない。
- `searchText` は保存時に text 要素から再計算する。用紙サイズだけを変更した場合、検索用テキストは同一のままにする。
- 保存と復元はこの既存 JSON 領域で完結する。用紙サイズのために `NotebookCanvas` へ width / height の別カラムを追加したり、新しい Prisma migration を要求したりしない。
- `bodyMode=markdown` の Notebook では Canvas レコードを作成せず、既存の `Notebook.body` を使用する。既存 Canvas document は自動変換も破壊もしない。

### Cue

左欄のキーワード / 質問 / 論点です。本文を思い出すための手がかりとして扱います。

| 項目 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `id` | string | 必須 | 主キー |
| `notebookId` | string | 必須 | Notebook への外部キー |
| `text` | string | 必須 | キーワード、質問、用語、論点 |
| `order` | number | 必須 | 表示順 |
| `createdAt` | datetime | 必須 | 作成日時 |
| `updatedAt` | datetime | 必須 | 更新日時 |

責務:

- 1 レコードが 1 つの Cue / キーワード / 質問を表す。
- `notebookId` は必ず `Notebook.id` を参照し、Notebook 物理削除時は cascade delete する。
- `order` は同一 Notebook 内の表示順を表す。MVP の更新 API では Cue 全置換または指定順で再作成し、`order` を 0 始まりまたは 1 始まりのどちらかに統一して保存する。
- Cue と本文範囲の厳密な関連は持たない。Phase 2 の `NoteCueLink` で扱う。
- 検索では `cue.text` をフリーワード対象に含める。

### Tag

分類と検索に使うタグです。

| 項目 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `id` | string | 必須 | 主キー |
| `name` | string | 必須 | タグ名。ユニーク |
| `color` | string | 任意 | 表示色。MVP では固定色でもよい |
| `createdAt` | datetime | 必須 | 作成日時 |

責務:

- 1 レコードが 1 タグ候補を表す。
- `name` はユニークで、同名タグを重複作成しない。
- ノート保存時に未登録タグ名が指定された場合は、`Tag` を upsert してから `NotebookTag` を作成する。
- `color` は任意。MVP では未指定または固定色でもよく、タグ管理 UI での色編集は Phase 2 とする。
- タグ削除 API / 名称変更 API は MVP では作らない。

### NotebookTag

Notebook と Tag の中間テーブルです。

| 項目 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `notebookId` | string | 必須 | Notebook への外部キー |
| `tagId` | string | 必須 | Tag への外部キー |
| `order` | number | 必須 | ノート内の表示順。0 始まり |

複合主キー:

- `notebookId`
- `tagId`

責務:

- Notebook と Tag の多対多関連と、ノート内のタグ表示順を保持する。
- 複合主キーで同一 Notebook 内の同一 Tag 重複を防ぐ。
- `order` は同一 Notebook 内で一意な 0 始まりの順序とし、ノート保存時の `tags` 配列 index を保存する。
- Notebook または Tag が物理削除された場合は cascade delete する。
- MVP の Notebook 更新では、リクエストされたタグ一覧に合わせて NotebookTag を全置換する。
- 既存行の migration backfill では過去の追加順を推測せず、各 Notebook 内を Tag の `name` 昇順（同名時は `tagId` 昇順）で 0 始まりに初期化する。

## 削除方針

MVP は **物理削除** を採用します。

| 対象 | MVP の削除 |
| --- | --- |
| `Notebook` | `DELETE /api/notes/:id` で物理削除する |
| `Cue` | Notebook 削除時に cascade delete。Notebook 更新時はリクエスト内容に合わせて全置換する |
| `NotebookTag` | Notebook / Tag 削除時に cascade delete。Notebook 更新時は全置換する |
| `Tag` | MVP ではタグ削除 API を提供しない |

注意:

- `GET /api/notes` の一覧と件数取得（検索、絞り込みを含む）は、`deletedAt: null` を互換 read guard に使う。値が `null` でない Notebook は response に含めない。
- `GET /api/notes/:id` の詳細取得も同じ read guard を使う。値が `null` でない Notebook は not found として扱う。
- `PATCH /api/notes/:id`、`DELETE /api/notes/:id`、`POST /api/notes/:id/review` の対象確認も `deletedAt: null` を互換 guard に使う。値が `null` でない Notebook は not found として扱う。
- 削除 command は guard 通過後に Notebook を物理削除する。MVP は `deletedAt` を設定しない。
- これらは参照・操作対象を限定する互換 guard であり、削除状態や復元可否の判定ではない。guard の存在は、soft delete、Undo、復元、purge の実装済み根拠にはならない。
- MVP には `deletedAt` を設定する処理、Undo、復元、purge がなく、物理削除後の復元を保証しない。
- 削除前確認 UI は MVP に含める。soft delete、Undo、復元、期限切れ purge は Phase 2 の候補であり、現行 MVP の処理には含めない。

## MVP では持たないもの

| 項目 | 理由 |
| --- | --- |
| `NotebookDraftState` | 自動保存とドラフト管理は Phase 2 |
| `NotebookReviewProgress` | 高度な復習状態は Phase 2。MVP は `nextReviewDate` と `reviewedAt` で足りる |
| `SoftDeleteBuffer` | Undo は Phase 2。MVP は削除確認で代替 |
| `BackupLog` | MVP はバックアップファイル作成と保持だけでよい |
| `CueCard` | MVP の左欄は `Cue` で扱い、カードモデルや D&D は Phase 2 |
| `NoteCard` | MVP の本文は `CanvasDocumentV1` の自由配置 Canvas（既存 `bodyMode=markdown` は互換保持）として扱い、カード分割は Phase 2 とするため |
| `NoteCueLink` | Cue と本文の厳密リンクは Phase 2 でよい |

## 復習管理の最小仕様

MVP の復習管理は、復習対象の判定と復習済み更新に絞ります。

### `nextReviewDate` の利用文脈

| 文脈 | 値の由来または抽出条件 | 保存データと画面状態の扱い |
| --- | --- | --- |
| 新規ノート作成 | UI は `noteDate + 7日` を固定初期値として表示する | ユーザーは保存前に変更またはクリアできる。保存時は指定値または null を `Notebook.nextReviewDate` に格納する |
| 既存ノート編集 | 保存済みの `Notebook.nextReviewDate` を表示し、null なら空欄のまま表示する | ユーザーは変更またはクリアできる。`noteDate` を変更しても再計算せず、保存時に指定した値または null を格納する |
| 既存ノートの復習画面 | 画面を開いた時点の `Asia/Tokyo` の現在日付 + 7日を固定初期値として表示し、保存済み値は再利用しない | ユーザーは保存前に変更またはクリアできる。復習 API の成功応答に含まれる `nextReviewDate` を保存後の画面状態へ反映する |
| 一覧の `reviewDue` 絞り込み | `nextReviewDate IS NOT NULL` かつ `nextReviewDate <= today` | 条件に一致するノートだけを返し、null のノートは対象外とする。保存データは更新しない |

新規作成画面と復習画面の初期値は UI が入力開始時に設定する固定値です。データ層が保存後も復習間隔を再計算する機能ではありません。

### 復習対象

一覧で `reviewDue=true` を指定した場合、`nextReviewDate` が設定済みで、かつ今日以前のノートだけを復習対象とします。`nextReviewDate` が未設定のノートは対象に含めません。

### 復習済み

ユーザーが「復習済み」にすると、次を更新します。

- `reviewedAt = now`
- `nextReviewDate` は空にする、または次の日付を手動設定する

復習 API は、保存した `nextReviewDate` または null を応答に含めます。画面は成功応答の値を復習完了後の状態へ反映します。MVP は保存済み値への追従更新と、復習履歴に基づく継続的な間隔反復を行いません。

## 復習モードのデータ要件

復習モードへの切替自体は表示状態だけを変え、復習進捗用の追加レコードを保存しません。「復習済み」の実行時は、既存の `Notebook.reviewedAt` と `Notebook.nextReviewDate` を更新します。

表示:

- タイトル
- 日付
- タグ
- Cue リスト
- サマリー
- 本文表示ボタン
- 次回復習日の入力欄

初期状態:

- `body` は非表示
- 次回復習日は、保存済みの `nextReviewDate` を再利用せず、画面を開いた時点の `Asia/Tokyo` の現在日付 + 7日

操作:

- 「本文を表示」で `body` を表示する
- 次回復習日は保存前に変更またはクリアできる
- 「復習済み」で `reviewedAt` と `nextReviewDate` を更新し、成功応答の `nextReviewDate` を画面へ反映する

## バリデーション案

| 対象 | 制約 |
| --- | --- |
| `title` | 1〜120文字 |
| `noteDate` | 今日以前 |
| `sourceType` | book, lecture, video, article, other のいずれか。未選択可 |
| `sourceTitle` | 0〜120文字 |
| `body` | 空でも保存可。ただし MVP 完成条件では本文入力フローを確認する |
| `summary` | 空でも保存可。空の場合は要約未作成として表示 |
| `cue.text` | 1〜120文字 |
| `tag.name` | 1〜30文字 |
| `tag` 数 | 1ノート最大12個 |

## 検索要件

MVP の検索と絞り込みは次に限定します。

| 条件 | 対象 |
| --- | --- |
| フリーワード | title, `Notebook.body`（Markdown mode）、summary、cue.text、`NotebookCanvas.searchText`（Canvas の text 要素） |
| タグ | OR 条件 |
| 日付 | from / to |
| 復習対象 | `nextReviewDate` が設定済みで、かつ今日以前。未設定は対象外 |

## Migration / Seed のデータ設計判断

### Desktop の DB 初期化・更新・backup 境界

開発用 Web 起動では、現行の `DATABASE_URL` が指す SQLite file と `backup/` への手動コピーを維持する。Desktop 配布では、同じデータ model を user data directory 内の SQLite file に解決する adapter を検討する。

- `.app` 内に live DB を置かない。`app bundle` に含める migration は読み取り専用の配布資産とし、初回起動時に user data directory を作成して適用する。
- アプリ更新は bundle 更新と DB migration を分離し、既存の DB、DB backup、設定を更新で消さない。アンインストールと user data 削除は別操作とする。
- 現行 MVP の backup は SQLite DB file の手動コピーであり、起動時 migration / 初期化、復元、破損検出は Desktop 化後の追加候補である。実装済みとは扱わない。
- DB backup は SQLite の保全単位であり、SQLite から生成する PDF output とは別に扱う。PDF を DB backup や復元用の正本とはみなさない。

PDF output を追加しても、現行の `Notebook`, `NotebookCanvas`, `Cue`, `Tag`, `NotebookTag` へ新しい Prisma model や migration を追加することはしない。PDF は SQLite から生成する派生物であり、PDF 用の別正本や index は持たない。

### Migration

MVP の migration は、`Notebook`, `NotebookCanvas`, `Cue`, `Tag`, `NotebookTag` の保存境界を作成します。用紙サイズの変更は `NotebookCanvas.documentJson` 内の JSON 更新で完結するため、ページ寸法専用の Prisma column / migration は追加しません。

現行 migration:

- `prisma/migrations/20260621073258_init/migration.sql`
- `prisma/migrations/20260718011243_remove_notebook_overview/migration.sql`
- `prisma/migrations/20260809090000_add_notebook_tag_order/migration.sql`（既存 NotebookTag の決定的 backfill を含む）
- `prisma/migrations-postgres/20260809090000_add_notebook_tag_order/migration.sql`
- Canvas 保存領域を導入する migration は、Canvas persistence を別 task で導入済みの場合に限り参照する。今回の用紙サイズ変更 task では新規 migration を作成しない。

後者で `notebooks.overview` を削除し、現行の `Notebook` model と SQLite table の列を一致させています。既存データの overview 値はこの migration 適用時に失われます。

Canvas persistence を含む migration 適用後は、次を作成して保持します。

- `notebooks`
- `cues`
- `tags`
- `notebook_tags`
- `notebook_canvases`（`document_json`, `search_text`, `schema_version`）
- `notebooks.note_date` index
- `notebooks.next_review_date` index
- `tags.name` unique index
- `cues(notebook_id, order)` index
- `notebook_tags(notebook_id, order)` index

新しい migration を追加する条件:

- 上記モデルのカラム、index、外部キーを変更する場合。Canvas の page 寸法変更だけは JSON 内更新のため対象外。
- MVP 外テーブルを追加する場合は、MVP ではなく Phase 2 migration として別タスク化する。

### Seed

MVP では seed は必須にしません。

理由:

- ノート、Cue、Tag はユーザー作成データであり、初期マスタが不要。
- タグ候補もノート保存時に upsert されるため、事前投入しなくても主要フローを確認できる。
- README のセットアップ手順では seed 実行を必須にしない。

必要になった場合だけ、開発確認用の任意 seed としてサンプル Notebook / Cue / Tag を投入する。ただし、MVP 完成条件や通常セットアップ手順には含めません。

## Open Question

| ID | 論点 | Manager 推奨 |
| --- | --- | --- |
| Q-001 | MVP の中央本文を Canvas document とし、既存 Markdown 本文を互換保持するか | はい。新規本文は Canvas、既存 Markdown は自動変換せず保持（発注者承認済み） |
| Q-002 | Cue と本文の厳密リンクを MVP から外してよいか | はい |
| Q-003 | 復習管理は `nextReviewDate` と `reviewedAt` のみでよいか | はい |
| Q-004 | sourceType / sourceTitle を MVP に含めるか | 含める |
| Q-005 | タグは MVP でも正規化するか | はい |
| Q-006 | Desktop shell の選定をどうするか | Electron-first candidate と Tauri + Node.js sidecar alternative を PoC で比較する |
| Q-007 | user data directory と PDF output destination の path をどう分けるか | live DB・DB backup は user data directory。PDF の具体的な出力先は未決定のまま別途定義する |
| Q-008 | PDF export の生成 provider、レイアウト、エラー処理をどう定義するか | Phase 2 の PDF export 設計で決める。PDF import / 双方向同期は設計しない |
| Q-009 | Mac 配布・署名・更新をどう検証するか | Apple Silicon / Intel、Prisma native runtime / driver、Playwright / Chromium、migration、データ保持を PoC で確認する |

## 次に決めること

発注者確認後、Desktop shell の選定、user data directory と PDF output destination の境界、PDF export 契約、配布、署名、更新に関する PoC の順に判断します。その後も、現行 MVP の SQLite schema と手動 backup 契約を保ったまま、必要な PDF 出力 task へ分割します。
