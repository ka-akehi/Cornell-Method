# MVP データ設計案

確認日: 2026-07-04

## 位置づけ

このドキュメントは、フルリニューアル版 Cornell Method Notebook の MVP データ設計案です。

目的は、コーネルメソッドの「記録、整理、要約、想起、復習」を支えるために必要な最小データ構造を決めることです。

2026-07-04 時点では、MVP 実装対象の Prisma schema は `Notebook`, `Cue`, `Tag`, `NotebookTag` の 4 モデルに整理済みです。この文書では、その 4 モデルだけを MVP DB の対象として扱います。

## 設計方針

- MVP では、ノート本文をカード分割せず、1 つの Markdown 本文として扱う（発注者承認済み）。
- キーワード / 質問は Cue リストとして持つ。
- Cue と本文の厳密なリンクは持たない。
- 復習モードは UI 状態ではなく、ノートが復習対象かどうかを判断できる最小データを持つ。
- 自動保存、Undo、詳細な楽観ロック、高度な間隔反復は MVP から外す。
- タグは検索・分類に使うため、MVP でも正規化する。
- MVP の削除は物理削除とする。`Notebook.deletedAt` は現 schema に残るが MVP API では使用しない。
- `Notebook` 削除時は `Cue` と `NotebookTag` を外部キーの `onDelete: Cascade` で同時削除する。

## 現 Prisma schema との対応

MVP の物理 DB は SQLite で、Prisma model 名は PascalCase、テーブル名とカラム名は `@@map` / `@map` で snake_case に対応させます。

| Prisma model | DB table | MVP での責務 |
| --- | --- | --- |
| `Notebook` | `notebooks` | ノート本体、Markdown 本文、要約、手動復習予定を保持する |
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
| `overview` | string | 任意 | ノートの概要 |
| `body` | string | 必須 | ノート本文。Markdown |
| `summary` | string | 任意 | 要約。Markdown |
| `nextReviewDate` | date | 任意 | 次に復習する予定日 |
| `reviewedAt` | datetime | 任意 | 最後に復習済みにした日時 |
| `createdAt` | datetime | 必須 | 作成日時 |
| `updatedAt` | datetime | 必須 | 更新日時 |
| `deletedAt` | datetime | 任意 | MVP では使わない。Phase 2 のソフトデリート用候補 |

責務:

- 1 レコードが 1 ノートを表す。
- `body` は MVP ではカード分割しない本文全体の Markdown を保持する。
- `overview` と `summary` も Markdown 入力を許可するが、MVP では別テーブルへ分けない。
- `nextReviewDate` は手動で設定する次回復習予定日であり、1 日後 / 7 日後の自動生成は行わない。
- `reviewedAt` はユーザーが復習済みにした最終日時を保持する。
- `deletedAt` は現 migration に存在する互換用カラムだが、MVP の削除判定や API では使わない。MVP の `DELETE` は Prisma `delete` による物理削除を行う。
- 一覧の基本絞り込みに使うため、`noteDate` と `nextReviewDate` に index を持つ。

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
| `NoteCard` | 本文は 1 つの Markdown として扱うため |
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
| `overview` | 0〜400文字 |
| `body` | 空でも保存可。ただし MVP 完成条件では本文入力フローを確認する |
| `summary` | 空でも保存可。空の場合は要約未作成として表示 |
| `cue.text` | 1〜120文字 |
| `tag.name` | 1〜30文字 |
| `tag` 数 | 1ノート最大12個 |

## 検索要件

MVP の検索・絞り込みは以下に限定します。

| 条件 | 対象 |
| --- | --- |
| フリーワード | title, overview, body, summary, cue.text |
| タグ | OR 条件 |
| 日付 | from / to |
| 復習対象 | nextReviewDate が今日以前 |

## Migration / Seed のデータ設計判断

### Migration

MVP の migration は、`Notebook`, `Cue`, `Tag`, `NotebookTag` の 4 モデルだけを作成します。

現行 migration:

- `prisma/migrations/20260621073258_init/migration.sql`

この migration では以下を作成します。

- `notebooks`
- `cues`
- `tags`
- `notebook_tags`
- `notebooks.note_date` index
- `notebooks.next_review_date` index
- `tags.name` unique index
- `cues(notebook_id, order)` index

新しい migration を追加する条件:

- 上記 4 モデルのカラム、index、外部キーを変更する場合。
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
| Q-001 | ノート本文は MVP では 1 つの Markdown 本文でよいか | はい（発注者承認済み） |
| Q-002 | Cue と本文の厳密リンクを MVP から外してよいか | はい |
| Q-003 | 復習管理は `nextReviewDate` と `reviewedAt` のみでよいか | はい |
| Q-004 | sourceType / sourceTitle を MVP に含めるか | 含める |
| Q-005 | タグは MVP でも正規化するか | はい |

## 次に決めること

発注者確認後、このデータ設計を元に MVP の画面設計へ進む。
