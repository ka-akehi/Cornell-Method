# 現行 MVP 契約

更新日: 2026-07-16
状態: D-01〜D-05 決定済みの現行 MVP 契約

## 1. 位置づけと正本

この文書は、現在実装・受け入れ判断を行う小さな MVP の契約です。D-01〜D-05 で確定した範囲、canonical route、API、保存・削除・復習の扱いをここで固定します。

- [`AGENTS.md`](../../AGENTS.md) は、MVP と将来の Phase 2 以降を含む製品全体の仕様・ロードマップです。AGENTS.md に残る高度機能の記述は削除せず、製品全体の将来境界として扱います。
- この文書は、現行 MVP の実装・受け入れ判断に使う正本です。AGENTS.md のロードマップ記述と現行 MVP の契約が異なる場合、現行 MVP の判断ではこの文書を優先します。
- 詳細な request / response、画面状態、データ項目は API・画面・データ設計書で補足します。詳細書とこの文書が現行 MVP の範囲で矛盾した場合は、この文書を先に更新してから詳細書を追従させます。

## 2. MVP の目的と対象範囲

MVP の目的は、ローカル個人利用で、Cornell Method のノートを「Cue で整理する → 1 本の本文に記録する → 要約する → 閲覧・復習する」流れを、明示保存で最後まで完了できるようにすることです。

### MVP に含めるもの

- ノートの新規作成、一覧、詳細閲覧、編集、確認付き削除。
- Cornell の左欄を `Cue` のリストとして保持すること。
- ノート本文を 1 本の Markdown 文字列として保持すること。
- タイトル、学習日、学習元、概要、タグ、本文、Summary、次回復習日を保存すること。
- タイトル・本文・概要・Summary・Cue と、日付・タグによる一覧検索。
- 詳細画面内の閲覧モード、編集モード、復習モード。
- SQLite DB の手動バックアップ作成と、最新 3 世代の確認。

### MVP の受け入れ対象外

下記は MVP の完成条件・受け入れ条件に含めません。実装する場合は Phase 2 以降の別 task とします。

- ドラフト、autosave、楽観ロック、`409` 競合処理。
- soft delete、削除後 5 秒 Undo、Snackbar、カード単位の復元。
- 独立した復習タスク画面、自動の 1 日後 / 1 週間後タスク、未完了タスクバッジ。
- NoteCard 分割、複数本文カード、Cue と本文の ID リンク、D&D 並び替え、hidden flag。
- PDF / HTML エクスポート、タグの名称変更・削除を行う管理 UI、タグ専用の更新・削除 API。
- モバイル向けの本格的な編集最適化、MVP で定義していない高度なキーボード操作。

## 3. 対象画面と canonical route

| 画面 | canonical route | MVP の責務 |
| --- | --- | --- |
| ノート一覧 | `/notes` | ノート検索、日付・タグ・復習対象の絞り込み、新規作成への入口 |
| ノート作成 | `/notes/new` | 初期値を使った 1 本文 + Cue リストの入力と明示保存 |
| ノート詳細 | `/notes/[id]` | 閲覧、編集、詳細画面内復習、確認付き削除 |
| バックアップ | `/backup` | SQLite DB の手動コピー作成、最新 3 世代の確認 |

`/notes/[id]` の閲覧・編集・復習は同じ route 内のモード切替です。MVP に `/notes/backup` や `/tasks/review` は存在しません。復習対象は `/notes` の `reviewDue` 絞り込みから詳細画面へ入ります。

## 4. 保存・削除・復習の契約

### 4.1 保存方式

- 保存はユーザーが「保存」を明示的に実行した時だけ行います。新規作成は保存成功後に `/notes/[id]` へ遷移します。
- `POST /api/notes` と `PATCH /api/notes/:id` は、Notebook 本体、Cue、タグ関連を 1 リクエストで確定保存します。
- 更新時の Cue とタグ関連は、リクエストに含まれる一覧で全置換します。MVP では Cue / Tag の差分 patch は扱いません。
- MVP では `draft` payload、autosave、`version` / `autosaveVersion`、古い保存を拒否する `409` を扱いません。
- 新規ノートの `nextReviewDate` は `noteDate + 7日` を初期値とします。ユーザーは保存前に変更または空欄化できます。
- 既存ノートの `nextReviewDate` が未設定でも自動補完しません。`noteDate` を変更しても、ユーザーが設定した次回復習日を自動移動しません。

### 4.2 削除方式

- 削除は詳細画面で確認を取ってから実行します。
- 確認後の `DELETE /api/notes/:id` は Notebook を物理削除し、Cue と NotebookTag は外部キーの cascade で削除します。
- MVP では削除後の復元を保証しません。Undo、soft delete、`SoftDeleteBuffer`、期限付き purge は Phase 2 です。
- `Notebook.deletedAt` が schema に残っている場合でも、MVP の削除判定・復元判定には使用しません。

### 4.3 復習方式

- 復習日はユーザーが手動で管理する `nextReviewDate` だけを使います。
- 新規ノートの初期値は前記のとおり `noteDate + 7日` です。復習後の日付はユーザーが次回日として入力するか、空欄にできます。
- `/notes/[id]` の復習モードでは Cue を先に表示し、本文を初期非表示にして想起を行います。本文はユーザー操作で表示できます。
- Summary は復習開始時に初期非表示とし、想起後にユーザーが開いて確認します。
- 「復習済み」の確定は `POST /api/notes/:id/review` で行い、`reviewedAt` を現在日時に更新します。
- 専用復習タスク、1 日後 / 1 週間後の自動抽出、復習ステータス遷移、未完了バッジは MVP では行いません。

## 5. 現行 MVP API 契約

認証は行いません。日付だけの値は `YYYY-MM-DD`、日時は ISO 8601 文字列で返します。エラーは原則 `{ code, message, errors? }` 形式です。成功時の主な status は `200` / `201` / `204`、入力不正は `400`、対象なしは `404`、予期しない失敗は `500` です。MVP では保存競合の `409` は返しません。

### 5.1 エンドポイント一覧

| Method | URL | MVP の契約 |
| --- | --- | --- |
| `GET` | `/api/notes` | 一覧・検索・ページング |
| `POST` | `/api/notes` | ノート作成 |
| `GET` | `/api/notes/:id` | ノート詳細取得 |
| `PATCH` | `/api/notes/:id` | ノート全体の明示更新 |
| `DELETE` | `/api/notes/:id` | 確認後の物理削除。成功時 `204` |
| `POST` | `/api/notes/:id/review` | 復習済み日時と次回復習日の更新 |
| `GET` | `/api/tags` | タグ候補一覧。名前昇順 |
| `GET` | `/api/backups` | 最新 3 世代のバックアップ一覧 |
| `POST` | `/api/backups` | SQLite DB の手動バックアップ作成 |

### 5.2 Notes API

`POST /api/notes` と `PATCH /api/notes/:id` の JSON body は次の形を共通で使います。

```json
{
  "title": "読書メモ",
  "noteDate": "2026-07-16",
  "sourceType": "book",
  "sourceTitle": "書籍名",
  "overview": "概要 Markdown",
  "body": "本文 Markdown",
  "summary": "Summary Markdown",
  "nextReviewDate": "2026-07-23",
  "cues": [{ "text": "重要語句", "order": 0 }],
  "tags": [{ "name": "読書", "color": null }]
}
```

- `title` は trim 後 1〜120 文字、`noteDate` は今日以前の `YYYY-MM-DD` です。
- `sourceType` は `book` / `lecture` / `video` / `article` / `other`、`sourceTitle` は 120 文字以内、`overview` は 400 文字以内です。
- `body` は 1 本の Markdown 文字列です。Cue は `{ text, order }` のリストで、Cue と本文の厳密なリンクは持ちません。
- `nextReviewDate` は `YYYY-MM-DD`、`null`、空欄を受け付けます。新規作成時に省略された場合は UI / 保存処理の初期値を `noteDate + 7日` とします。
- `tags` は 1 ノート最大 12 件、同一ノート内で重複不可です。未登録名はノート保存時に Tag として自動作成します。
- 作成・更新の成功 response は保存後のノート詳細です。`GET /api/notes/:id` も同じ詳細形を返します。

`GET /api/notes` は次の query を受け付けます。

| Query | 内容 |
| --- | --- |
| `query` | title、overview、body、summary、Cue text の部分一致 |
| `tag` | タグ名のカンマ区切り。複数タグは OR 条件、重複・空要素は除外 |
| `from` / `to` | `noteDate` の開始日・終了日。片側指定可 |
| `reviewDue` | `true` の場合、`nextReviewDate` が今日以前のノート |
| `page` | 1 始まり。1 ページ 50 件 |

response は `{ page, totalPages, totalCount, data }` です。並び順は `noteDate desc, updatedAt desc` 固定です。`from > to` や無効な日付は `400 invalid_query` とし、0 件は `200` の空配列で返します。

### 5.3 Tags API

MVP のタグ API は `GET /api/tags` のみです。request body / query はなく、`[{ id, name, color }]` を名前昇順で返します。タグが 0 件でも `200 []` です。`POST /api/tags`、タグの rename / delete API、タグ管理 UI は Phase 2 です。新規タグはノートの POST / PATCH に含めて自動作成します。

### 5.4 Review API

`POST /api/notes/:id/review` の body は次の形です。

```json
{ "nextReviewDate": "2026-07-23" }
```

`nextReviewDate` は任意で、`YYYY-MM-DD`、`null`、空欄を指定できます。成功時は `200` で `{ id, reviewedAt, nextReviewDate }` を返します。対象がない場合は `404`、日付形式が不正な場合は `400 invalid_body` です。

### 5.5 Backup API

- `GET /api/backups` は `{ "backups": [...] }` を返します。各 entry は `file`、`createdAt`、`path` を持ち、最新 3 世代を新しい順で返します。対象がない場合も `200` です。
- `POST /api/backups` は request body / query を持たず、SQLite DB を `backup/` 配下へコピーします。成功時は `200` で `{ "ok": true, "backup": { "file", "path" } }` を返します。
- MVP のバックアップ操作は手動作成と一覧確認です。PDF export、バックアップログ、`/api/backups/retry` はこの契約に含めません。

## 6. Markdown と Summary Preview

- 本文は 1 本の Markdown 文字列として編集・保存します。基本記法と GFM のチェックボックスを表示対象とします。
- 閲覧モードでは本文、概要、Summary を Markdown として安全にレンダリングします。Preview の checkbox は表示専用で、クリックして保存データを変更できないものとします。
- 編集モードの Summary Preview は、折りたたみ表示または占有量を抑えた簡易表示のいずれかを採用します。常時大きなフル Preview を MVP の必須条件にはしません。
- 復習モードの Summary は初期非表示です。Cue による想起、本文の確認、その後の Summary 確認という順序を保ちます。

## 7. デスクトップ優先とモバイルの対応範囲

- デスクトップを主対象とし、Cornell は Cue を左、本文を右に置く約 30% / 70% を基本とします。本文の入力と Preview はデスクトップで確認しやすい配置を優先します。
- 768px 未満では本格的な編集最適化を MVP の必須条件にしません。モバイル専用の縦積み、操作案内、キーボード最適化は Phase 2 以降に再評価します。
- モバイルではページ全体が壊れないこと、主要な入力・保存・閲覧操作へ到達できることを最低限確認します。Cornell 部分の局所的な横スクロールは許容しますが、ページ全体の意図しない横 overflow は許容しません。

## 8. 現行 MVP データモデル

MVP の Prisma model は `Notebook`、`Tag`、`NotebookTag`、`Cue` の 4 つです。DB table / column は既存 schema の mapping に従います。

| Model | 主な責務 | 主な項目 |
| --- | --- | --- |
| `Notebook` | ノート本体、1 本の本文、要約、手動復習情報 | `id`, `title`, `noteDate`, `sourceType`, `sourceTitle`, `overview`, `body`, `summary`, `nextReviewDate`, `reviewedAt`, `createdAt`, `updatedAt` |
| `Tag` | タグ名のマスタ | `id`, `name` (unique), `color`, `createdAt` |
| `NotebookTag` | Notebook と Tag の多対多関連 | `notebookId` + `tagId` の複合主キー |
| `Cue` | Cornell 左欄のキーワード / 質問 | `id`, `notebookId`, `text`, `order`, `createdAt`, `updatedAt` |

- `Notebook.body` が MVP の本文です。`NoteCard`、`CueCard`、`NoteCueLink` は持ちません。
- Notebook の物理削除時は Cue と NotebookTag を cascade delete します。
- `Notebook.deletedAt` が既存 schema にあっても、MVP では soft delete 用の互換フィールドとして未使用です。
- `NotebookDraftState`、`NotebookReviewProgress`、`SoftDeleteBuffer`、`BackupLog` は MVP のモデル範囲外です。

## 9. Phase 2 へ送る機能

MVP と Phase 2 の境界を実装・受け入れ時に混同しないため、次を明確に Phase 2 へ送ります。

| 分野 | Phase 2 以降の機能 |
| --- | --- |
| 保存 | draft、3 秒 autosave、差分保存、楽観ロック、409 UI、確定保存との競合解決 |
| 削除 | soft delete、5 秒 Undo Snackbar、Undo API、期限切れ purge、カード単位復元 |
| 復習 | `/tasks/review`、1 日後 / 1 週間後の自動タスク、review status、未完了バッジ、spaced repetition 拡張 |
| コンテンツ | NoteCard、複数本文カード、Cue / Note の ID link、hidden flag、D&D 並び替え |
| タグ | タグの名称変更・削除、右クリック管理 UI、タグ専用 mutation API、より高度な色管理 |
| 出力・運用 | PDF / HTML export、期間 export、起動時自動バックアップ、backup log、retry UI |
| 端末対応 | モバイルの縦積み・操作案内・本格的な編集最適化、高度なキーボード操作 |

これらを実装する task では、先に本契約の Phase 2 境界を更新し、API・schema・画面・テストの変更を別 task として投入します。

## 10. 契約を変更する場合の更新対象

MVP の route、API、データ、保存、削除、復習、Markdown、端末対応のいずれかを変更する場合は、次の順で更新します。

1. この文書 `doc/implementation/MVP_CONTRACT.md` に決定内容、採用日、MVP / Phase 2 の境界を反映する。
2. 製品全体のロードマップや Phase 2 の位置づけが変わる場合は [`AGENTS.md`](../../AGENTS.md) を更新する。既存の将来要件を現行 MVP として扱うかどうかをここで明示する。
3. [`doc/README.md`](../README.md) の設計書一覧と Primary Entry Points を更新する。
4. 影響する詳細書を更新する。対象は必要に応じて `doc/api/MVP_API_DESIGN.md`、`doc/data/MVP_DATA_DESIGN.md`、`doc/screens/`、`doc/testing/TEST_SCENARIOS.md`、`README.md` です。
5. 実装状態の正誤は、仕様変更と混ぜずに後続の [`DOC-001`](../../summary/20260716/current-spec-design-task-list.md) で `doc/implementation/IMPLEMENTATION_STATUS.md` をコード・schema・route・証跡に照合して更新する。

## 11. この契約に続く task

今回の task は契約文書の固定、`AGENTS.md` と `doc/README.md` からの参照導線追加だけを行います。コード、設定、依存関係、Prisma schema、DB、UI、API、テスト、画像、および実装状況の棚卸しは対象外です。

次の記録 task は **DOC-001「実装状況サマリを実態へ修正」** です。DOC-001 で、現行コードがこの MVP 契約のどの項目を実装済み・部分実装・未実装・仕様のみとして満たすかを、推測せずに修正します。
