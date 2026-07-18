# MVP API 設計案

確認日: 2026-07-18

## 位置づけ

このドキュメントは、フルリニューアル版 Cornell Method Notebook の MVP API 設計案です。

MVP API は、ノート作成・検索・閲覧・編集・削除・復習済み更新・タグ候補取得・バックアップに絞ります。自動保存、Undo、PDF 出力、高度な復習タスクは Phase 2 とします。

現コードは `Notebook`, `NotebookCanvas`, `Cue`, `Tag`, `NotebookTag` を中心にした MVP 構成です。この文書の request / response / error は、現行の `src/app/api/**`, `src/modules/notes/contracts/note.schema.ts`, `prisma/schema.prisma` に寄せた実装・テスト期待値として扱います。

## API 設計方針

- 認証は行わない。ローカル個人利用を前提にする。
- API は JSON を返す。ただし `DELETE /api/notes/:id` の成功時だけ HTTP 204 No Content とし、body を返さない。
- エラー形式は `{ code, message, errors? }` に統一する。
- ノート作成・更新では、Notebook、Cue、Tag を 1 リクエストで保存する。
- ノート更新時、Cue と Tag 関連はリクエスト内容で全置換する（発注者承認済み）。
- Cue / Tag の差分更新は MVP では行わず、必要になった場合の Phase 2 要件とする。
- Cue と本文の厳密リンクは扱わない。
- 復習モードの本文表示/非表示は UI 状態のため API に保存しない。
- 復習済み更新だけは専用 API に分ける。
- MVP では楽観ロックを行わないため、409 conflict は返さない。

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

### 共通エラーコード

| code | HTTP | message | 用途 |
| --- | ---: | --- | --- |
| `invalid_query` | 400 | `検索条件に誤りがあります` | query string の validation error |
| `invalid_body` | 400 | `入力内容に誤りがあります` | request body の validation error |
| `not_found` | 404 | `対象が見つかりません` または endpoint 固有文言 | 対象データなし |
| `server_error` | 500 | `予期しないエラーが発生しました` または内部エラー文言 | 予期しない例外 |

### `errors[].field` の表記

- ネストは dot notation とする。例: `tags.12.name`, `cues.0.text`
- request body が JSON として読めない、または object ではない場合は、root field として空文字 `""` が入る場合がある。
- 型不一致や enum 不一致など Zod 標準エラーになる項目は、現コードでは Zod の標準 `message` を返す。実装・テストで固定すべきプロダクト独自メッセージは、本書の validation 表に明記する。

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

## 共通スキーマ

### Note detail

```json
{
  "id": "note_1",
  "title": "読書メモ",
  "noteDate": "2026-06-14",
  "sourceType": "book",
  "sourceTitle": "Sample Book",
  "bodyMode": "canvas",
  "body": "",
  "canvas": {
    "schemaVersion": 1,
    "page": { "width": 1200, "height": 800, "background": "paper" },
    "elements": []
  },
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

### Note input

`POST /api/notes` と `PATCH /api/notes/:id` は同じ body を受け取る。

```json
{
  "title": "読書メモ",
  "noteDate": "2026-06-14",
  "sourceType": "book",
  "sourceTitle": "Sample Book",
  "bodyMode": "canvas",
  "body": "",
  "canvas": {
    "schemaVersion": 1,
    "page": { "width": 1200, "height": 800, "background": "paper" },
    "elements": []
  },
  "summary": "要約 Markdown",
  "nextReviewDate": "2026-06-15",
  "cues": [
    { "text": "重要語句", "order": 0 }
  ],
  "tags": [
    { "name": "読書", "color": null }
  ]
}
```

| field | 必須 | 型 | 仕様 |
| --- | --- | --- | --- |
| `title` | 必須 | string | trim 後 1〜120 文字 |
| `noteDate` | 必須 | string | `YYYY-MM-DD`。今日以前 |
| `sourceType` | 任意 | string | `book`, `lecture`, `video`, `article`, `other` のいずれか |
| `sourceTitle` | 任意 | string | 未指定時 `""`。0〜120 文字 |
| `bodyMode` | 任意 | `"canvas"` \| `"markdown"` | 未指定時は既存 API 互換の `"markdown"`。Canvas 本文では `"canvas"` を指定 |
| `body` | 条件付き | string | `bodyMode="markdown"` の本文 Markdown。`bodyMode="canvas"` では `""` |
| `canvas` | 条件付き | `CanvasDocumentV1` | `bodyMode="canvas"` のとき必須。`bodyMode="markdown"` のとき指定不可 |
| `summary` | 任意 | string | 未指定時 `""` |
| `nextReviewDate` | 任意 | string \| null | `YYYY-MM-DD`、`noteDate` 以降、または `null` / 空文字 / 未指定 |
| `cues` | 任意 | array | 未指定時 `[]` |
| `cues[].text` | 必須 | string | trim 後 1〜120 文字 |
| `cues[].order` | 任意 | integer | 0 以上。未指定時は配列 index |
| `tags` | 任意 | array | 未指定時 `[]`。最大 12 件。同一ノート内で重複不可 |
| `tags[].name` | 必須 | string | trim 後 1〜30 文字。使用可能文字は validation 表を参照 |
| `tags[].color` | 任意 | string \| null | 空文字 / 未指定は `null` |

### CanvasDocumentV1

`canvas` は本文領域の保存・復元に使う JSON です。`schemaVersion=1`、`page.background="paper"` を固定し、`page.width` / `page.height` は整数 px とします。既定値は `1200 x 800`、許容範囲は幅・高さとも `320〜4000`（境界値を含む）です。`elements` の各要素は `x`, `y`, `width`, `height`, `points`, `style` などの既存データを保持します。

用紙サイズ変更リクエストは `canvas.page.width` / `canvas.page.height` だけを変更します。要素の座標・寸法・points・style を API が自動変形してはならず、用紙を小さくして境界外になる要素も削除・移動・縮小しません。既存の 1200x800 Canvas document は自動変換せず、そのまま復元します。

Canvas JSON は既存の `NotebookCanvas.documentJson` 保存領域を利用し、用紙サイズのための新しい Prisma column / migration は追加しません。`NotebookCanvas.searchText` は Canvas の text 要素から生成し、用紙サイズの変更だけでは値を変更しません。

## GET `/api/notes`

ノート一覧を取得します。

### Query

| パラメータ | 必須 | 仕様 |
| --- | --- | --- |
| `query` | 任意 | title, legacy `bodyMode=markdown` の body, summary, cue.text, Canvas text 要素から生成した `searchText` を部分一致検索 |
| `tag` | 任意 | タグ名。複数指定時はカンマ区切り。重複と空要素は除外 |
| `from` | 任意 | `noteDate` の開始日。`YYYY-MM-DD` |
| `to` | 任意 | `noteDate` の終了日。`YYYY-MM-DD` |
| `reviewDue` | 任意 | `true` の場合、`nextReviewDate` が今日以前のノートのみ。未指定 / 空文字 / `false` は false |
| `page` | 任意 | 1 始まりの整数。未指定時 1 |

`tags` ではなく `tag` を使う。MVP 現コードでは `tag=読書,英語` の形を正とする。

### Success Response

HTTP 200

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
      "bodyMode": "canvas",
      "hasCanvas": true,
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

### 並び順・ページング

- 並び順は `noteDate desc, updatedAt desc` 固定。
- 1 ページ 50 件固定。
- `totalPages` は 0 件でも `1`。
- `page` が `totalPages` を超えた場合、`data: []` を返す。validation error にはしない。

### Validation Error

HTTP 400

```json
{
  "code": "invalid_query",
  "message": "検索条件に誤りがあります",
  "errors": [
    { "field": "from", "message": "開始日は終了日以前の日付を入力してください" }
  ]
}
```

| 条件 | field | message |
| --- | --- | --- |
| `from` が `YYYY-MM-DD` ではない、または存在しない日付 | `from` | `YYYY-MM-DD形式で入力してください` |
| `to` が `YYYY-MM-DD` ではない、または存在しない日付 | `to` | `YYYY-MM-DD形式で入力してください` |
| `from > to` | `from` | `開始日は終了日以前の日付を入力してください` |
| `page` が 1 未満 | `page` | `pageは1以上で指定してください` |
| `page` が整数ではない | `page` | `pageは整数で指定してください` または Zod 標準メッセージ |
| `reviewDue` が `true` / `false` / 空文字以外 | `reviewDue` | Zod 標準メッセージ |

### Not Found

一覧取得 API は、条件に一致するノートが 0 件でも 404 にしない。HTTP 200 で `data: []` を返す。

### Unexpected Error

HTTP 500

```json
{
  "code": "server_error",
  "message": "予期しないエラーが発生しました"
}
```

## POST `/api/notes`

ノートを作成します。

### Request Body

`Note input` と同じ。

### Success Response

HTTP 201。作成した `Note detail` を返す。

### 保存仕様

- Notebook、Cue、Tag、NotebookTag をトランザクションで保存する。
- `bodyMode="canvas"` の場合は `CanvasDocumentV1` を `NotebookCanvas.documentJson` に保存し、`schemaVersion` と text 要素由来の `searchText` を更新する。`bodyMode="markdown"` の既存本文は従来どおり `Notebook.body` に保存する。
- タグ名が存在しない場合は自動作成する。
- 既存タグの `color` は更新しない。新規作成時のみ `tags[].color ?? null` を保存する。
- Cue は `order` 指定があればその値、未指定なら配列 index で保存する。
- `noteDate` / `nextReviewDate` は date-only string を UTC 00:00:00 として保存し、response では `YYYY-MM-DD` に戻す。

### Validation Error

HTTP 400

```json
{
  "code": "invalid_body",
  "message": "入力内容に誤りがあります",
  "errors": [
    { "field": "title", "message": "タイトルは必須です" }
  ]
}
```

`PATCH /api/notes/:id` も同じ validation を使う。

| 条件 | field | message |
| --- | --- | --- |
| body が JSON として読めない、または object ではない | `""` | Zod 標準メッセージ |
| `title` が空、または trim 後に空 | `title` | `タイトルは必須です` |
| `title` が 120 文字超 | `title` | `タイトルは120文字以内で入力してください` |
| `noteDate` が `YYYY-MM-DD` ではない、または存在しない日付 | `noteDate` | `YYYY-MM-DD形式で入力してください` |
| `noteDate` が未来日 | `noteDate` | `未来日は入力できません` |
| `sourceType` が許可値以外 | `sourceType` | Zod 標準メッセージ |
| `sourceTitle` が 120 文字超 | `sourceTitle` | `出典タイトルは120文字以内で入力してください` |
| `nextReviewDate` が `YYYY-MM-DD` ではない、または存在しない日付 | `nextReviewDate` | `YYYY-MM-DD形式で入力してください` |
| `nextReviewDate < noteDate` | `nextReviewDate` | `次回復習日は記載日以降の日付を入力してください` |
| `cues[].text` が空、または trim 後に空 | `cues.{index}.text` | `キューは必須です` |
| `cues[].text` が 120 文字超 | `cues.{index}.text` | `キューは120文字以内で入力してください` |
| `cues[].order` が整数ではない | `cues.{index}.order` | `表示順は整数で入力してください` または Zod 標準メッセージ |
| `cues[].order` が 0 未満 | `cues.{index}.order` | `表示順は0以上で入力してください` |
| `tags` が 13 件以上 | `tags` | `タグは12件以内で入力してください` |
| `tags[].name` が空、または trim 後に空 | `tags.{index}.name` | `タグ名は必須です` |
| `tags[].name` が 30 文字超 | `tags.{index}.name` | `タグ名は30文字以内で入力してください` |
| `tags[].name` に使用不可文字が含まれる | `tags.{index}.name` | `タグ名に使用できない文字が含まれています` |
| `tags[].name` が同一ノート内で重複 | `tags.{index}.name` | `タグが重複しています` |

### タグ名の使用可能文字

`tags[].name` は、ひらがな、カタカナ、漢字、英数字、次の記号のみ許可する。

```text
!"#$%&'()0=~|-^¥@[]`{;:+*},./<>?_\
```

空白は trim されるが、trim 後のタグ名内部に空白を含めることはできない。絵文字も不可。

### Not Found

作成 API では対象 ID がないため not found は発生しない。

### Unexpected Error

HTTP 500

```json
{
  "code": "server_error",
  "message": "予期しないエラーが発生しました"
}
```

## GET `/api/notes/:id`

ノート詳細を取得します。

### Request

query / body は受け取らない。

### Success Response

HTTP 200。`Note detail` を返す。

### Validation Error

MVP 現コードでは `id` の形式 validation は行わない。任意の path segment を ID として検索する。

### Not Found

HTTP 404。ID が存在しない、または `deletedAt` が `null` ではない場合。

```json
{
  "code": "not_found",
  "message": "ノートが見つかりません"
}
```

### Unexpected Error

HTTP 500

```json
{
  "code": "server_error",
  "message": "予期しないエラーが発生しました"
}
```

## PATCH `/api/notes/:id`

ノートを更新します。

### Request Body

`Note input` と同じ。

### 更新仕様

- `id` の Notebook が存在し、`deletedAt` が `null` の場合だけ更新する。
- Notebook を更新する。
- Cue はリクエスト内容で全置換する。
- Tag 関連もリクエスト内容で全置換する。
- `bodyMode="canvas"` の場合は Canvas JSON を同じ `NotebookCanvas` レコードへ upsert する。`page.width` / `page.height` の変更時も要素の `x`, `y`, `width`, `height`, `points`, `style` は変更しない。Canvas から Markdown への自動変換や既存 Canvas document の自動変換は行わない。
- タグ名が存在しない場合は自動作成する。
- MVP では楽観ロックを行わない。

### Success Response

HTTP 200。更新後の `Note detail` を返す。

### Validation Error

HTTP 400。`POST /api/notes` と同じ。

validation は not found 確認より先に行う。したがって、存在しない `id` でも body が不正なら 404 ではなく 400 を返す。

### Not Found

HTTP 404。ID が存在しない、または `deletedAt` が `null` ではない場合。

```json
{
  "code": "not_found",
  "message": "ノートが見つかりません"
}
```

### Unexpected Error

HTTP 500

```json
{
  "code": "server_error",
  "message": "予期しないエラーが発生しました"
}
```

## DELETE `/api/notes/:id`

ノートを削除します。

### Request

query / body は受け取らない。

### 仕様

- MVP では確認ダイアログを UI 側で出した上で削除する。
- API は物理削除を行う。
- Notebook 削除により、Prisma relation の cascade で Cue / NotebookTag も削除される。
- Undo は Phase 2 とする。

### Success Response

HTTP 204 No Content。body なし。

### Validation Error

MVP 現コードでは `id` の形式 validation は行わない。任意の path segment を ID として検索する。

### Not Found

HTTP 404。ID が存在しない、または `deletedAt` が `null` ではない場合。

```json
{
  "code": "not_found",
  "message": "ノートが見つかりません"
}
```

### Unexpected Error

HTTP 500

```json
{
  "code": "server_error",
  "message": "予期しないエラーが発生しました"
}
```

## POST `/api/notes/:id/review`

復習済みにします。

### Request Body

```json
{
  "nextReviewDate": "2026-06-21"
}
```

| field | 必須 | 型 | 仕様 |
| --- | --- | --- | --- |
| `nextReviewDate` | 任意 | string \| null | `YYYY-MM-DD`、または `null` / 空文字 / 未指定 |

`nextReviewDate` は任意です。未指定、空文字、`null` の場合、次回復習日は `null` になります。現コードでは `noteDate` 以降かどうかは検証しません。

### 更新仕様

- `id` の Notebook が存在し、`deletedAt` が `null` の場合だけ更新する。
- `reviewedAt = now`
- `nextReviewDate = request.nextReviewDate ?? null`

### Success Response

HTTP 200

```json
{
  "id": "note_1",
  "reviewedAt": "2026-06-14T12:00:00.000Z",
  "nextReviewDate": "2026-06-21"
}
```

### Validation Error

HTTP 400

```json
{
  "code": "invalid_body",
  "message": "入力内容に誤りがあります",
  "errors": [
    { "field": "nextReviewDate", "message": "YYYY-MM-DD形式で入力してください" }
  ]
}
```

| 条件 | field | message |
| --- | --- | --- |
| body が JSON として読めない、または object ではない | `""` | Zod 標準メッセージ |
| `nextReviewDate` が `YYYY-MM-DD` ではない、または存在しない日付 | `nextReviewDate` | `YYYY-MM-DD形式で入力してください` |

validation は not found 確認より先に行う。したがって、存在しない `id` でも body が不正なら 404 ではなく 400 を返す。

### Not Found

HTTP 404。ID が存在しない、または `deletedAt` が `null` ではない場合。

```json
{
  "code": "not_found",
  "message": "ノートが見つかりません"
}
```

### Unexpected Error

HTTP 500

```json
{
  "code": "server_error",
  "message": "予期しないエラーが発生しました"
}
```

## GET `/api/tags`

タグ候補一覧を取得します。

### Request

query / body は受け取らない。

### Success Response

HTTP 200。タグ名昇順で返す。

```json
[
  { "id": "tag_1", "name": "読書", "color": null }
]
```

### Validation Error

なし。MVP 現コードでは query validation を行わない。

### Not Found

タグが 0 件でも 404 にしない。HTTP 200 で `[]` を返す。

### Unexpected Error

HTTP 500

```json
{
  "code": "server_error",
  "message": "予期しないエラーが発生しました"
}
```

### MVP では作らないタグ API

- `POST /api/tags`
- `PATCH /api/tags/:id`
- `DELETE /api/tags/:id`

タグはノート保存時に自動作成します。タグ管理 UI は Phase 2 とします。

## GET `/api/backups`

バックアップ一覧を取得します。

### Request

query / body は受け取らない。

### Success Response

HTTP 200。最新 3 世代までを新しい順で返す。

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

バックアップが 0 件の場合は HTTP 200 で `{ "backups": [] }` を返す。

### Validation Error

なし。MVP 現コードでは query validation を行わない。

### Not Found

なし。`backup/` ディレクトリが存在しない場合も 404 にせず、HTTP 200 で `{ "backups": [] }` を返す。

### Unexpected Error

HTTP 500。バックアップ一覧取得中の filesystem 例外など。

```json
{
  "code": "server_error",
  "message": "予期しないエラーが発生しました"
}
```

現コードでは、内部例外が `Error` の場合、その `error.message` が `message` に入る場合がある。例:

```json
{
  "code": "server_error",
  "message": "EACCES: permission denied, scandir 'backup'"
}
```

## POST `/api/backups`

バックアップを作成します。

### Request

query / body は受け取らない。

### 仕様

- SQLite DB ファイルを `backup/` 配下へコピーする。
- `DATABASE_URL` は `file:` 形式の SQLite path を対象にする。
- backup file name は `YYYY-MM-DDTHH-mm-ss.db`。
- 最新 3 世代を保持する。
- 4 世代目以降は古いものから削除する。

### Success Response

HTTP 200

```json
{
  "ok": true,
  "backup": {
    "file": "2026-06-14T12-00-00.db",
    "path": "backup/2026-06-14T12-00-00.db"
  }
}
```

### Validation Error

なし。MVP 現コードでは body / query validation を行わない。

### Not Found

DB ファイルが存在しない場合も 404 ではなく、HTTP 500 `server_error` を返す。

### Unexpected Error

HTTP 500。DB ファイル不在、`DATABASE_URL` 不正、コピー失敗、削除失敗など。

```json
{
  "code": "server_error",
  "message": "SQLite DB file not found: /path/to/dev.db"
}
```

代表例:

| 条件 | code | message |
| --- | --- | --- |
| `DATABASE_URL` が `file:` 形式ではない | `server_error` | `DATABASE_URL は file: 形式の SQLite パスを指定してください` |
| SQLite path が空 | `server_error` | `DATABASE_URL の SQLite ファイルパスが空です` |
| SQLite DB file が存在しない | `server_error` | `SQLite DB file not found: {path}` |
| SQLite DB path が file ではない | `server_error` | `SQLite DB path is not a file: {path}` |
| filesystem の copy / unlink に失敗 | `server_error` | Node.js の filesystem error message |

## バリデーション一覧

MVP の固定 validation message は次を正とする。

| field | ルール | message |
| --- | --- | --- |
| `title` | 1〜120 文字 | `タイトルは必須です` / `タイトルは120文字以内で入力してください` |
| `noteDate` | `YYYY-MM-DD`、今日以前 | `YYYY-MM-DD形式で入力してください` / `未来日は入力できません` |
| `sourceType` | `book`, `lecture`, `video`, `article`, `other`, 未指定 | Zod 標準メッセージ |
| `sourceTitle` | 0〜120 文字 | `出典タイトルは120文字以内で入力してください` |
| `body` | 文字列 | Zod 標準メッセージ |
| `bodyMode` | `canvas` または `markdown` | Zod 標準メッセージ |
| `canvas` が `bodyMode="canvas"` で未指定 | Canvas document 必須 | `bodyMode=canvasではcanvasが必須です` |
| `canvas` が `bodyMode="markdown"` で指定 | Canvas document 指定不可 | `bodyMode=markdownではcanvasを指定できません` |
| `canvas.page.width` / `canvas.page.height` | 整数 px、320〜4000 | `Canvas page width/height must be an integer between 320 and 4000 pixels` 相当の Canvas validation message |
| `canvas` の要素データ | `CanvasDocumentV1` の型・要素数・points・JSON サイズ制約 | Canvas validation message |
| `summary` | 文字列 | Zod 標準メッセージ |
| `nextReviewDate` | `YYYY-MM-DD`、ノート保存時は `noteDate` 以降、または未指定 / 空文字 / null | `YYYY-MM-DD形式で入力してください` / `次回復習日は記載日以降の日付を入力してください` |
| `cues[].text` | 1〜120 文字 | `キューは必須です` / `キューは120文字以内で入力してください` |
| `cues[].order` | 0 以上の整数 | `表示順は整数で入力してください` / `表示順は0以上で入力してください` |
| `tags[].name` | 1〜30 文字、使用可能文字のみ | `タグ名は必須です` / `タグ名は30文字以内で入力してください` / `タグ名に使用できない文字が含まれています` |
| `tags` | 最大 12 件、重複不可 | `タグは12件以内で入力してください` / `タグが重複しています` |
| `from` | `YYYY-MM-DD` | `YYYY-MM-DD形式で入力してください` |
| `to` | `YYYY-MM-DD` | `YYYY-MM-DD形式で入力してください` |
| `from` + `to` | `from <= to` | `開始日は終了日以前の日付を入力してください` |
| `page` | 1 以上の整数 | `pageは整数で指定してください` / `pageは1以上で指定してください` |

## MVP から外す API

次の API は MVP 外です。MVP API の実装・テスト期待値に混ぜない。

| API | 理由 |
| --- | --- |
| `/api/undo` | Undo は Phase 2 |
| `/api/review-tasks` | 復習専用画面を MVP では作らない |
| `/api/backups/retry` | MVP は `POST /api/backups` に統一 |
| `/api/backups/logs` | バックアップログは Phase 2 |
| `/api/notes/export` | PDF 出力は Phase 2 |
| `/api/tags/:id` | タグ管理 UI は Phase 2 |
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
