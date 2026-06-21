# MVP データ設計案

確認日: 2026-06-14

## 位置づけ

このドキュメントは、フルリニューアル版 Cornell Method Notebook の MVP データ設計案です。

目的は、コーネルメソッドの「記録、整理、要約、想起、復習」を支えるために必要な最小データ構造を決めることです。現行実装の Prisma スキーマは制約として扱わず、参考情報に留めます。

## 設計方針

- MVP では、ノート本文をカード分割せず、1 つの Markdown 本文として扱う（発注者承認済み）。
- キーワード / 質問は Cue リストとして持つ。
- Cue と本文の厳密なリンクは持たない。
- 復習モードは UI 状態ではなく、ノートが復習対象かどうかを判断できる最小データを持つ。
- 自動保存、Undo、詳細な楽観ロック、高度な間隔反復は MVP から外す。
- タグは検索・分類に使うため、MVP でも正規化する。

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

### Tag

分類・検索用のタグです。

| 項目 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `id` | string | 必須 | 主キー |
| `name` | string | 必須 | タグ名。ユニーク |
| `color` | string | 任意 | 表示色。MVP では固定色でもよい |
| `createdAt` | datetime | 必須 | 作成日時 |

### NotebookTag

Notebook と Tag の中間テーブルです。

| 項目 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `notebookId` | string | 必須 | Notebook への外部キー |
| `tagId` | string | 必須 | Tag への外部キー |

複合主キー:

- `notebookId`
- `tagId`

## MVP では持たないもの

| 項目 | 理由 |
| --- | --- |
| `NoteCard` | 本文は 1 つの Markdown として扱うため |
| `NoteCueLink` | Cue と本文の厳密リンクは Phase 2 でよい |
| `NotebookDraftState` | 自動保存とドラフト管理は Phase 2 |
| `NotebookReviewProgress` | 高度な復習状態は Phase 2。MVP は `nextReviewDate` と `reviewedAt` で足りる |
| `SoftDeleteBuffer` | Undo は Phase 2。MVP は削除確認で代替 |
| `BackupLog` | MVP はバックアップファイル作成と保持だけでよい |

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
