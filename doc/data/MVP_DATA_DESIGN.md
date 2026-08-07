# MVP データ設計案

確認日: 2026-07-18

## 位置づけ

このドキュメントは、フルリニューアル版 Cornell Method Notebook の MVP データ設計案です。

目的は、コーネルメソッドの「記録、整理、要約、想起、復習」を支えるために必要な最小データ構造を決めることです。

MVP 実装対象の Prisma schema は `Notebook`, `NotebookCanvas`, `Cue`, `Tag`, `NotebookTag` を中心に整理します。Canvas の用紙サイズは `NotebookCanvas.documentJson` 内の `CanvasDocumentV1.page` で管理し、用紙サイズ変更のために別カラムを増やしません。

## 設計方針

- MVP では、ノート本文をカード分割せず、中央のフリー入力 Canvas として `CanvasDocumentV1` を扱う。Cue と Summary は Markdown として扱い、既存の Markdown 本文モードは互換表示のために保持する。
- キーワード / 質問は Cue リストとして持つ。
- Cue と本文の厳密なリンクは持たない。
- 復習モードは UI 状態ではなく、ノートが復習対象かどうかを判断できる最小データを持つ。
- 自動保存、Undo、詳細な楽観ロック、高度な間隔反復は MVP から外す。
- タグは検索・分類に使うため、MVP でも正規化する。
- MVP の削除は物理削除とする。`Notebook.deletedAt` は現 schema に残るが MVP API では使用しない。
- `Notebook` 削除時は `Cue` と `NotebookTag` を外部キーの `onDelete: Cascade` で同時削除する。

## 保存境界とノートファイル案

現行 MVP の運用上の正本は SQLite DB です。デスクトップ配布でも、クラウド DB を必須にせず、ユーザーごとの Mac 内 SQLite を user data directory に置きます。`app bundle` には実行コード、Next.js 資産、Prisma Client / migration、必要な runtime / driver を含めますが、SQLite の live file は置きません。初回起動時に user data directory を作成して migration を適用し、アプリ更新とデータ更新を分離します。アンインストールとデータ削除は別操作です。

ユーザーがノートを直接ファイルとして扱えるようにする場合は、`optional note workspace / export directory` を user data directory とは別に設ける。既定保存先は OS のユーザーデータ領域とし、`Downloads` は使わない。可搬性が必要なユーザーが明示的に選択した場合だけ、次のような構成または同等の package 形式へ export / import する案を候補にする。

```text
<note-workspace>/<note-id>/
  note.md
  canvas.json
  metadata.json
```

候補ファイルの責務は次のとおりです。これは現行 MVP の DB model / API 契約ではなく、将来の export / import 契約を検討するための案です。

| ファイル | 候補する内容 |
| --- | --- |
| `note.md` | Markdown の Cue / Summary / 互換本文などのテキスト。既存の本文欄を自動的にファイル正本へ変更しない |
| `canvas.json` | `CanvasDocumentV1`、`page.width` / `page.height`、Canvas elements。要素の `x`, `y`, `width`, `height`, `points`, `style` を保持する |
| `metadata.json` | note id、title、noteDate、source、tags（名称・色）、nextReviewDate、reviewedAt、bodyMode、file schema version。Phase 2 の draft を export する場合は draft state も候補に含める |

Canvas の text 要素から生成する `searchText` は派生値であり、file package に含める場合も再生成可能な値として扱う。用紙サイズだけを変更して `searchText` を変えない。`schemaVersion` は Canvas document と file package の互換性確認に使い、未知の version や不正な JSON は import 時に拒否または隔離する方針を別途決める。

### 保存方式の比較と段階導入

| 方式 | 長所 | 短所 / リスク | 現時点の扱い |
| --- | --- | --- | --- |
| file-only | ユーザーがファイルを直接所有でき、差分確認・外部ツール利用・可搬性に向く | 全文検索、タグ OR、atomic write、draft、review、同時更新、整合性復旧を別途実装する必要がある | 採用しない。将来の候補に留める |
| SQLite-only | 現行 API / Prisma / transaction / 検索 / 手動 DB backup を維持しやすい | ノートを直接扱う可搬ファイルではなく、外部ツールや同期との連携に export が必要 | 現行 MVP と第一段階の運用上の正本 |
| file + local SQLite index | ファイルの可搬性と SQLite の検索・一覧性能を両立できる | 正本と index の整合性、再構築、atomic write、競合、schema version、削除・復旧を設計する必要がある | 必要性が確認できた場合に Phase 2 以降で検討 |

Manager 推奨は、第一段階で SQLite を運用上の正本として維持し、ノートファイルを export / backup / migration 用に追加することです。将来、ユーザーがファイルを正本として扱う価値が確認できた場合に、ノートファイルを正本、SQLite を再構築可能な index とする hybrid へ段階移行する。ファイル保存を理由に新しい Prisma model / migration を現行 MVP へ追加しない。

SQLite の live DB を iCloud / Dropbox 等の同期フォルダへ直接置くことは、同時更新、ロック、部分同期、破損のリスクがあるため既定にしない。可搬性が必要な場合は、明示的に選択した note workspace と export / import を優先する。

## 現 Prisma schema との対応

MVP の物理 DB は SQLite で、Prisma model 名は PascalCase、テーブル名とカラム名は `@@map` / `@map` で snake_case に対応させます。

| Prisma model | DB table | MVP での責務 |
| --- | --- | --- |
| `Notebook` | `notebooks` | ノート本体、`bodyMode`、既存 Markdown 本文、要約、手動復習予定を保持する |
| `NotebookCanvas` | `notebook_canvases` | Canvas 本文の JSON、schema version、Canvas text 要素から作る一覧検索用 `searchText` を保持する |
| `Cue` | `cues` | Cornell 左欄の Cue / キーワード / 質問を表示順付きで保持する |
| `Tag` | `tags` | タグ候補のマスタを一元管理する |
| `NotebookTag` | `notebook_tags` | Notebook と Tag の多対多関連を保持する |

MVP 外の DB はこの schema に混ぜません。詳細仕様の `NotebookDraftState`, `NotebookReviewProgress`, `SoftDeleteBuffer`, `BackupLog`, `CueCard`, `NoteCard`, `NoteCueLink` は Phase 2 以降の拡張対象です。

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
| `deletedAt` | datetime | 任意 | MVP では使わない。Phase 2 のソフトデリート用候補 |

責務:

- 1 レコードが 1 ノートを表す。
- `bodyMode=markdown` のとき `body` はカード分割しない本文全体の Markdown を保持する。`bodyMode=canvas` のとき本文の正本は `NotebookCanvas.documentJson` である。
- Canvas document は `schemaVersion=1`、`page.background="paper"`、`page.width` / `page.height` を可変の整数 px とし、既定値を 1200x800、許容範囲を 320〜4000px とする。
- 用紙サイズ変更は JSON の `page.width` / `page.height` だけを更新する。既存要素の `x`, `y`, `width`, `height`, `points`, `style` は変更せず、境界外の要素も削除・移動・縮小しない。
- 既存の 1200x800 Canvas document は自動変換せず、そのまま保存・復元できる。Canvas JSON の保存領域を利用するため、用紙サイズ変更だけでは Prisma migration を追加しない。
- `summary` は Markdown 入力を許可するが、MVP では別テーブルへ分けない。
- `nextReviewDate` は手動で設定する次回復習予定日であり、1 日後 / 7 日後の自動生成は行わない。
- `reviewedAt` はユーザーが復習済みにした最終日時を保持する。
- `deletedAt` は現 migration に存在する互換用カラムだが、MVP の削除判定や API では使わない。MVP の `DELETE` は Prisma `delete` による物理削除を行う。
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

- `documentJson.page.width` / `page.height` は用紙そのものの幅・高さであり、整数 px の 320〜4000 の範囲で保存する。既定値は 1200x800。
- 用紙サイズ変更では `documentJson` の page 寸法だけを変更し、要素の座標・寸法・points・style を書き換えない。用紙境界外の要素も JSON から除外しない。
- `searchText` は保存時に text 要素から再計算する。用紙サイズだけを変更した場合、検索用テキストは同一のままにする。
- 保存・復元はこの既存 JSON 領域で完結する。用紙サイズのために `NotebookCanvas` へ width / height の別カラムを追加したり、新しい Prisma migration を要求したりしない。
- `bodyMode=markdown` の Notebook では Canvas レコードを作成せず、既存の `Notebook.body` を使用する。既存 Canvas document は自動変換・破壊しない。

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

分類・検索用のタグです。

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

複合主キー:

- `notebookId`
- `tagId`

責務:

- Notebook と Tag の多対多関連だけを保持し、追加の属性は持たない。
- 複合主キーで同一 Notebook 内の同一 Tag 重複を防ぐ。
- Notebook または Tag が物理削除された場合は cascade delete する。
- MVP の Notebook 更新では、リクエストされたタグ一覧に合わせて NotebookTag を全置換する。

## 削除方針

MVP は **物理削除** を採用します。

| 対象 | MVP の削除 |
| --- | --- |
| `Notebook` | `DELETE /api/notes/:id` で物理削除する |
| `Cue` | Notebook 削除時に cascade delete。Notebook 更新時はリクエスト内容に合わせて全置換する |
| `NotebookTag` | Notebook / Tag 削除時に cascade delete。Notebook 更新時は全置換する |
| `Tag` | MVP ではタグ削除 API を提供しない |

注意:

- `Notebook.deletedAt` は現 schema に存在するが、MVP では値を設定しない。
- 一覧、詳細、検索 API は `deletedAt IS NULL` を前提条件にしない。物理削除済みレコードは DB に残らないためです。
- 削除前確認 UI は MVP に含めるが、Undo Snackbar、`SoftDeleteBuffer`、期限切れ purge は Phase 2 で扱う。

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

MVP では、復習管理を以下に絞ります。

### 復習対象

以下のいずれかに該当するノートを復習対象とします。

- `nextReviewDate` が今日以前
- `nextReviewDate` が未設定だが、手動で復習予定日を設定したい

### 復習済み

ユーザーが「復習済み」にすると、以下を更新します。

- `reviewedAt = now`
- `nextReviewDate` は空にする、または次の日付を手動設定する

MVP では、自動で 1日後 / 7日後などを計算する高度な間隔反復は行いません。

## 復習モードのデータ要件

復習モードでは、保存データは増やさず表示だけを切り替えます。

表示:

- タイトル
- 日付
- タグ
- Cue リスト
- サマリー
- 本文表示ボタン

初期状態:

- `body` は非表示

操作:

- 「本文を表示」で `body` を表示する
- 「復習済み」で `reviewedAt` を更新する

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

MVP の検索・絞り込みは以下に限定します。

| 条件 | 対象 |
| --- | --- |
| フリーワード | title, `Notebook.body`（Markdown mode）、summary、cue.text、`NotebookCanvas.searchText`（Canvas の text 要素） |
| タグ | OR 条件 |
| 日付 | from / to |
| 復習対象 | nextReviewDate が今日以前 |

## Migration / Seed のデータ設計判断

### Desktop の DB 初期化・更新・backup 境界

開発用 Web 起動では、現行の `DATABASE_URL` が指す SQLite file と `backup/` への手動コピーを維持する。Desktop 配布では、同じデータ model を user data directory 内の SQLite file に解決する adapter を検討する。

- `.app` 内に live DB を置かない。`app bundle` に含める migration は読み取り専用の配布資産とし、初回起動時に user data directory を作成して適用する。
- アプリ更新は bundle 更新と DB migration を分離し、既存の DB、DB backup、設定を更新で消さない。アンインストールと user data 削除は別操作とする。
- 現行 MVP の backup は SQLite DB file の手動コピーであり、workspace file の backup、起動時 migration / 初期化、export / import、復元、破損検出は Desktop 化後の追加候補である。実装済みとは扱わない。
- DB backup と note workspace backup を同じ復元単位にするか、`note.md` / `canvas.json` / `metadata.json` の atomic write・整合性検査をどう定義するかは、export / import 契約と合わせて別途決める。

ファイル保存を追加するだけで、現行の `Notebook`, `NotebookCanvas`, `Cue`, `Tag`, `NotebookTag` へ新しい Prisma model や migration を追加することはしない。ファイルを正本に変える場合でも、schema change の必要性、再構築可能な index の扱い、既存データ移行を別の Phase 2 task として承認する。

### Migration

MVP の migration は、`Notebook`, `NotebookCanvas`, `Cue`, `Tag`, `NotebookTag` の保存境界を作成します。用紙サイズの変更は `NotebookCanvas.documentJson` 内の JSON 更新で完結するため、ページ寸法専用の Prisma column / migration は追加しません。

現行 migration:

- `prisma/migrations/20260621073258_init/migration.sql`
- `prisma/migrations/20260718011243_remove_notebook_overview/migration.sql`
- Canvas 保存領域を導入する migration は、Canvas persistence を別 task で導入済みの場合に限り参照する。今回の用紙サイズ変更 task では新規 migration を作成しない。

後者で `notebooks.overview` を削除し、現行の `Notebook` model と SQLite table の列を一致させています。既存データの overview 値はこの migration 適用時に失われます。

Canvas persistence を含む migration 適用後は以下を作成・保持します。

- `notebooks`
- `cues`
- `tags`
- `notebook_tags`
- `notebook_canvases`（`document_json`, `search_text`, `schema_version`）
- `notebooks.note_date` index
- `notebooks.next_review_date` index
- `tags.name` unique index
- `cues(notebook_id, order)` index

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
| Q-007 | user data / workspace path をどう分けるか | live DB・DB backup は OS user data、可搬ファイルだけ明示選択 workspace |
| Q-008 | SQLite-only と file + local SQLite index の境界をいつ変えるか | 第一段階は SQLite 正本 + note file export。必要性が確認できた場合だけ hybrid を検討 |
| Q-009 | export / import のファイル契約をどうするか | `note.md` / `canvas.json` / `metadata.json` または package、schema version、atomic write、整合性検査を定義する |
| Q-010 | Mac 配布・署名・更新をどう検証するか | Apple Silicon / Intel、Prisma native runtime / driver、Playwright / Chromium、migration、データ保持を PoC で確認する |

## 次に決めること

発注者確認後、Desktop shell の選定、user data / workspace path、SQLite-only と hybrid の境界、export / import 契約、配布・署名・更新 PoC の順に判断する。その後も、現行 MVP の SQLite schema と手動 backup 契約を保ったまま、必要なデータ移行 task へ分割する。
