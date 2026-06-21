# MVP API 設計案

確認日: 2026-06-14

## 位置づけ

このドキュメントは、フルリニューアル版 Cornell Method Notebook の MVP API 設計案です。

MVP API は、ノート作成・検索・閲覧・編集・削除・復習済み更新・バックアップに絞ります。自動保存、Undo、PDF 出力、高度な復習タスクは Phase 2 とします。

## API 設計方針

- 認証は行わない。ローカル個人利用を前提にする。
- API は JSON を返す。
- エラー形式は `{ code, message, errors? }` に統一する。
- ノート作成・更新では、Notebook、Cue、Tag を 1 リクエストで保存する。
- ノート更新時、Cue と Tag 関連はリクエスト内容で全置換する（発注者承認済み）。
- Cue / Tag の差分更新は MVP では行わず、必要になった場合の Phase 2 要件とする。
- Cue と本文の厳密リンクは扱わない。
- 復習モードの本文表示/非表示は UI 状態のため API に保存しない。
- 復習済み更新だけは専用 API に分ける。

## 共通エラー形式

```json
{
  "code": "invalid_body",
  "message": "入力内容に誤りがあります",
  "errors": [
    { "field": "title", "message": "タイトルは必須です" }
  ]
}
```

## 共通ステータス

| HTTP | 用途 |
| ---: | --- |
| 200 | 取得・更新成功 |
| 201 | 作成成功 |
| 204 | 削除成功 |
| 400 | 入力不正 |
| 404 | 対象なし |
| 500 | 予期しないエラー |

## エンドポイント一覧

| Method | URL | 用途 |
| --- | --- | --- |
| GET | `/api/notes` | ノート一覧取得 |
| POST | `/api/notes` | ノート作成 |
| GET | `/api/notes/:id` | ノート詳細取得 |
| PATCH | `/api/notes/:id` | ノート更新 |
| DELETE | `/api/notes/:id` | ノート削除 |
| POST | `/api/notes/:id/review` | 復習済み更新 |
| GET | `/api/tags` | タグ候補一覧 |
| GET | `/api/backups` | バックアップ一覧 |
| POST | `/api/backups` | バックアップ作成 |

## GET `/api/notes`

ノート一覧を取得します。

### Query

| パラメータ | 必須 | 説明 |
| --- | --- | --- |
| `query` | 任意 | title, overview, body, summary, cue.text を検索 |
| `tag` | 任意 | タグ名。複数指定時はカンマ区切り |
| `from` | 任意 | noteDate の開始日 |
| `to` | 任意 | noteDate の終了日 |
| `reviewDue` | 任意 | `true` の場合、nextReviewDate が今日以前のノートのみ |
| `page` | 任意 | 1始まり |

### Response

```json
{
  "page": 1,
  "totalPages": 1,
  "totalCount": 1,
  "data": [
    {
      "id": "note_1",
      "title": "読書メモ",
      "noteDate": "2026-06-14",
      "sourceType": "book",
      "sourceTitle": "Sample Book",
      "overview": "第1章の整理",
      "summary": "",
      "cueCount": 3,
      "hasSummary": false,
      "nextReviewDate": "2026-06-15",
      "reviewedAt": null,
      "tags": [
        { "id": "tag_1", "name": "読書", "color": null }
      ]
    }
  ]
}
```

### 並び順

MVP では `noteDate desc, updatedAt desc` 固定とします。

## POST `/api/notes`

ノートを作成します。

### Request

```json
{
  "title": "読書メモ",
  "noteDate": "2026-06-14",
  "sourceType": "book",
  "sourceTitle": "Sample Book",
  "overview": "第1章の整理",
  "body": "本文 Markdown",
  "summary": "要約 Markdown",
  "nextReviewDate": "2026-06-15",
  "cues": [
    { "text": "重要語句", "order": 0 }
  ],
  "tags": [
    { "name": "読書" }
  ]
}
```

### Response

作成したノート詳細を返します。

```json
{
  "id": "note_1",
  "title": "読書メモ",
  "noteDate": "2026-06-14",
  "sourceType": "book",
  "sourceTitle": "Sample Book",
  "overview": "第1章の整理",
  "body": "本文 Markdown",
  "summary": "要約 Markdown",
  "nextReviewDate": "2026-06-15",
  "reviewedAt": null,
  "cues": [
    { "id": "cue_1", "text": "重要語句", "order": 0 }
  ],
  "tags": [
    { "id": "tag_1", "name": "読書", "color": null }
  ]
}
```

### 保存仕様

- Notebook、Cue、Tag、NotebookTag をトランザクションで保存する。
- タグ名が存在しない場合は自動作成する。
- Cue は request の配列順または `order` 順で保存する。

## GET `/api/notes/:id`

ノート詳細を取得します。

### Response

`POST /api/notes` の Response と同じ形を返します。

### Not Found

```json
{
  "code": "not_found",
  "message": "ノートが見つかりません"
}
```

## PATCH `/api/notes/:id`

ノートを更新します。

### Request

`POST /api/notes` と同じ形です。

### 更新仕様

- Notebook を更新する。
- Cue はリクエスト内容で全置換する。
- Tag 関連もリクエスト内容で全置換する。
- タグ名が存在しない場合は自動作成する。
- MVP では楽観ロックを行わない。

### Response

更新後のノート詳細を返します。

## DELETE `/api/notes/:id`

ノートを削除します。

### 仕様

- MVP では確認ダイアログを UI 側で出した上で削除する。
- API は物理削除を行う。
- Undo は Phase 2 とする。

### Response

HTTP 204 No Content

## POST `/api/notes/:id/review`

復習済みにします。

### Request

```json
{
  "nextReviewDate": "2026-06-21"
}
```

`nextReviewDate` は任意です。未指定の場合、次回復習日は空にします。

### 更新仕様

- `reviewedAt = now`
- `nextReviewDate = request.nextReviewDate ?? null`

### Response

```json
{
  "id": "note_1",
  "reviewedAt": "2026-06-14T12:00:00.000Z",
  "nextReviewDate": "2026-06-21"
}
```

## GET `/api/tags`

タグ候補一覧を取得します。

### Response

```json
[
  { "id": "tag_1", "name": "読書", "color": null }
]
```

### MVP では作らないタグ API

- `POST /api/tags`
- `PATCH /api/tags/:id`
- `DELETE /api/tags/:id`

タグはノート保存時に自動作成します。タグ管理 UI は Phase 2 とします。

## GET `/api/backups`

バックアップ一覧を取得します。

### Response

```json
{
  "backups": [
    {
      "file": "2026-06-14T12-00-00.db",
      "createdAt": "2026-06-14T12:00:00.000Z",
      "path": "backup/2026-06-14T12-00-00.db"
    }
  ]
}
```

## POST `/api/backups`

バックアップを作成します。

### 仕様

- SQLite DB ファイルを `backup/` 配下へコピーする。
- 最新3世代を保持する。
- 4世代目以降は古いものから削除する。

### Response

```json
{
  "ok": true,
  "backup": {
    "file": "2026-06-14T12-00-00.db",
    "path": "backup/2026-06-14T12-00-00.db"
  }
}
```

## バリデーション

| field | ルール |
| --- | --- |
| `title` | 1〜120文字 |
| `noteDate` | 今日以前 |
| `sourceType` | book, lecture, video, article, other, 未指定 |
| `sourceTitle` | 0〜120文字 |
| `overview` | 0〜400文字 |
| `body` | 文字列 |
| `summary` | 文字列 |
| `nextReviewDate` | noteDate 以降の日付、または未指定 |
| `cues[].text` | 1〜120文字 |
| `tags[].name` | 1〜30文字 |
| `tags` | 最大12件、重複不可 |

## MVP から外す API

| API | 理由 |
| --- | --- |
| `/api/undo` | Undo は Phase 2 |
| `/api/review-tasks` | 復習専用画面を MVP では作らない |
| `/api/notes/export` | PDF 出力は Phase 2 |
| `/api/tags/:id` | タグ管理 UI は Phase 2 |
| `/api/backups/retry` | MVP は `POST /api/backups` に統一 |
| Cue / Tag 差分更新 API | MVP では全置換。必要になった場合に Phase 2 で検討 |

## Open Question

| ID | 論点 | Manager 推奨 |
| --- | --- | --- |
| Q-001 | Cue は更新時に全置換でよいか | はい（発注者承認済み） |
| Q-002 | Tag 関連は更新時に全置換でよいか | はい（発注者承認済み） |
| Q-003 | 削除は MVP では物理削除でよいか | はい |
| Q-004 | タグ作成はノート保存時の自動作成だけでよいか | はい |
| Q-005 | バックアップ作成 API は `POST /api/backups` に統一してよいか | はい |

## 次に決めること

発注者確認後、この API 設計を元に MVP 技術選定と実装タスク分割へ進む。
