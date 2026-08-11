# 現行 MVP 契約

更新日: 2026-08-11
状態: 現行 MVP Gate 0 の受け入れ境界を確定。Canvas 操作・スタイル・図形内文字・重ね描き・用紙寸法の契約と、Manager fallback で確認した runtime QA の範囲を反映済み。厳密 4px・wheel / trackpad・mobile edit 等の未確認範囲は履歴・任意 QA として維持

## 1. 位置づけと正本

この文書は、現行 MVP の実装・受け入れ契約です。D-01〜D-05 で確定した範囲と、canonical route、API、保存・削除・復習の扱いを定めます。

- [`PRODUCT_SPEC.md`](../requirements/PRODUCT_SPEC.md) は、MVP と将来の Phase 2 以降を含む製品全体の仕様・ロードマップです。製品全体の将来境界は本書ではなく PRODUCT_SPEC.md で管理します。
- この文書は、現行 MVP の実装・受け入れ判断に使う正本です。PRODUCT_SPEC.md のロードマップ記述と現行 MVP の契約が異なる場合、現行 MVP の判断ではこの文書を優先します。
- 詳細な request / response、画面状態、データ項目は API・画面・データ設計書で補足します。詳細書とこの文書が現行 MVP の範囲で矛盾した場合は、この文書を先に更新してから詳細書を追従させます。

### 現行 MVP Gate 0 の受け入れ境界（2026-08-11）

現行 MVP の Gate 0 は、発注者が実施し、テスト中に見つかった問題の修正と修正後の再確認を含めて完了と判断した人力結合テストを根拠に、完了（PASS）とします。

対象範囲は、本書の MVP 範囲と canonical route（`/notes`、`/notes/new`、`/notes/[id]`、`/backup`）に定める明示保存、閲覧・編集・復習、検索、確認付き物理削除、手動 SQLite backup です。

Browser runtime、mobile、wheel / trackpad、実 DB read-back、E2E、外部 Postgres target、build / Prisma runtime、追加の明示承認は、現行 Gate 0 の必須条件や blocker にしません。未確認の項目と既存の `BLOCKED` / `NOT RUN` は、過去記録または任意 QA として保持し、Gate 0 の完了判定を保留・取消しする根拠にはしません。

Gate 0 の完了後も、Phase 2、Mac desktop、PDF、partial eraser などの実装を自動で開始しません。次の機能優先順位と実装着手は、発注者が別途判断します。

## 2. MVP の目的と対象範囲

MVP は、ローカル個人利用で、Cornell Method のノートを「Cue で整理する → 中央のフリー入力 Canvas に本文を記録する → Summary で要約する → 閲覧・復習する」という一連の流れを、明示保存で完了できるようにします。既存の Markdown 本文モードは互換表示のために保持し、既存データを Canvas へ自動変換しません。

### MVP に含めるもの

- ノートの新規作成、一覧、詳細閲覧、編集、確認付き削除。
- Cornell の左欄を `Cue` のリストとして保持すること。
- 中央の本文領域を `CanvasDocumentV1` のフリー入力 Canvas として保持すること。Cue と Summary は従来どおり Markdown として保持すること。
- 既存の Markdown 本文モードを破壊せず、`bodyMode` に応じて Canvas または既存本文を表示すること。
- タイトル、学習日、学習元、タグ、`bodyMode` に応じた Canvas または legacy Markdown 本文、Summary、次回復習日を保存すること。
- タイトル・本文・Summary・Cue と、日付・タグによる一覧検索。
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
| ノート作成 | `/notes/new` | 初期値を使った Canvas 本文 + Cue リスト + Summary の入力と明示保存 |
| ノート詳細 | `/notes/[id]` | 閲覧、編集、詳細画面内復習、確認付き削除 |
| バックアップ | `/backup` | SQLite DB の手動コピー作成、最新 3 世代の確認 |

`/notes/[id]` の閲覧・編集・復習は同じ route 内のモード切替です。MVP に `/notes/backup` や `/tasks/review` は存在しません。復習対象は `/notes` の `reviewDue` 絞り込みから詳細画面へ入ります。

## 4. 保存・削除・復習の契約

### 4.1 保存方式

- 保存はユーザーが「保存」を明示的に実行した時だけ行います。新規作成は保存成功後に `/notes/[id]` へ遷移します。
- `POST /api/notes` と `PATCH /api/notes/:id` は、Notebook 本体、Cue、タグ関連を 1 リクエストで確定保存します。
- 更新時の Cue とタグ関連は、リクエストに含まれる一覧で全置換します。MVP では Cue / Tag の差分 patch は扱いません。
- `tags` 配列の順序はノート内の表示順として `NotebookTag.order` に 0 始まりで保存し、一覧・詳細 response でも維持します。過去の順序を持たない既存行は migration でタグ名昇順に初期化します。
- MVP では `draft` payload、autosave、`version` / `autosaveVersion`、古い保存を拒否する `409` を扱いません。
- 詳細画面の Summary checkbox の toggle は画面上の未保存変更として扱い、toggle ごとに API を呼びません。詳細画面で Summary を明示保存するときは、既存の `PATCH /api/notes/:id` のノート更新契約を使って Summary Markdown を保存します。
- 学習日は学習した事実を記録する `noteDate` として扱います。作成画面では入力・変更でき、必須かつ今日以前の日付を保存します。保存後の通常編集画面では現在値を表示するだけで、変更できません。
- 新規ノートの `nextReviewDate` は `noteDate + 7日` を初期値とします。ユーザーは保存前に変更または空欄化できます。
- 既存ノートの編集では、未設定の `nextReviewDate` を自動補完しません。`nextReviewDate` は学習日とは独立して変更または空欄化でき、学習日を基準に保存済みの値を自動再計算しません。

### 4.2 削除方式

- 削除は詳細画面で確認を取ってから実行します。
- 確認後の `DELETE /api/notes/:id` は Notebook を物理削除し、Cue と NotebookTag は外部キーの cascade で削除します。
- MVP では削除後の復元を保証しません。Undo、soft delete、`SoftDeleteBuffer`、期限付き purge は Phase 2 です。
- `Notebook.deletedAt` が schema に残っている場合でも、MVP の削除判定・復元判定には使用しません。

### 4.3 復習方式

- 復習日はユーザーが手動で管理する `nextReviewDate` だけを使います。
- 既存ノートの復習画面では、画面を開いた時点の `Asia/Tokyo` 基準の現在日付 + 7日を次回復習日の初期値として表示します。保存済みの `nextReviewDate` は、過去・当日・未来を問わず初期値に再利用しません。
- 復習画面では、ユーザーが次回復習日を変更または空欄化できます。復習成功後は API response の `nextReviewDate` を画面へ反映します。
- `/notes/[id]` の復習モードでは Cue を先に表示し、本文を初期非表示にして想起を行います。本文はユーザー操作で表示できます。
- Summary は復習開始時に初期非表示とし、想起後にユーザーが開いて確認します。
- 「復習済み」の確定は `POST /api/notes/:id/review` で行い、`reviewedAt` を現在日時に更新します。
- 専用復習タスク、1 日後 / 1 週間後の自動抽出、復習ステータス遷移、未完了バッジは MVP では行いません。

### 4.4 ノート一覧カードの表示

`/notes` の一覧カードでは、復習履歴と次回復習状態を別のバッジで表示します。復習履歴は `reviewedAt` だけで判定し、次回復習状態は `nextReviewDate` だけで判定します。

- `reviewedAt === null` は `未復習`、`reviewedAt !== null` は `復習済み` と表示します。
- `nextReviewDate` が未来の日付なら `復習予定日: YYYY-MM-DD`、今日以前の日付なら `復習期限到来: YYYY-MM-DD`、未設定なら `復習予定なし` と表示します。カード上の次回バッジは、この表示の前に `次回: ` を付けます。
- 受け入れ対象は、復習履歴 2 通りと次回復習状態 3 通りを組み合わせた次の 6 通りです。`today` は判定基準日です。

| `reviewedAt` | `nextReviewDate` | 復習履歴バッジ | 次回復習状態バッジ |
| --- | --- | --- | --- |
| `null` | 未来 | `未復習` | `復習予定日: YYYY-MM-DD` |
| ISO 8601 日時 | 未来 | `復習済み` | `復習予定日: YYYY-MM-DD` |
| `null` | 今日以前 | `未復習` | `復習期限到来: YYYY-MM-DD` |
| ISO 8601 日時 | 今日以前 | `復習済み` | `復習期限到来: YYYY-MM-DD` |
| `null` | 未設定 | `未復習` | `復習予定なし` |
| ISO 8601 日時 | 未設定 | `復習済み` | `復習予定なし` |

- タグがある場合は、タグ名と色を表示します。複数のタグは折り返し、長いタグ名は省略表示します。
- タグがない場合、一覧カードに `タグなし` のプレースホルダーを表示しません。このルールは一覧カードだけに適用し、`/notes/[id]` など他のタグ表示箇所の既存 `タグなし` 表示は変更しません。
- この 2 つのバッジは、Phase 2 の専用復習タスク、`review status`、未完了タスクバッジを意味しません。

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

`POST /api/notes` と `PATCH /api/notes/:id` の JSON body は次の基本形を共通で使います。`noteDate` の扱いは作成と更新で異なります。

```json
{
  "title": "読書メモ",
  "noteDate": "2026-07-16",
  "sourceType": "book",
  "sourceTitle": "書籍名",
  "bodyMode": "canvas",
  "body": "",
  "canvas": {
    "schemaVersion": 1,
    "page": { "width": 1200, "height": 800, "background": "paper" },
    "elements": []
  },
  "summary": "Summary Markdown",
  "nextReviewDate": "2026-07-23",
  "cues": [{ "text": "重要語句", "order": 0 }],
  "tags": [{ "name": "読書", "color": null }]
}
```

- `title` は trim 後 1〜120 文字、`noteDate` は今日以前の `YYYY-MM-DD` です。
- `sourceType` は `book` / `lecture` / `video` / `article` / `other`、`sourceTitle` は 120 文字以内です。
- `bodyMode` は `canvas` または `markdown` です。`canvas` のとき `canvas` は必須、`body` は空文字として保存します。`markdown` のときは既存の `body` を使用し、`canvas` は指定しません。Cue は `{ text, order }` のリストで、Cue と本文要素の厳密なリンクは持ちません。
- `canvas` は次節の `CanvasDocumentV1` 契約に従います。既存の Canvas document は保存・復元時に破壊・自動変換しません。
- `nextReviewDate` は `YYYY-MM-DD`、`null`、空欄を受け付けます。新規作成時に省略された場合は UI / 保存処理の初期値を `noteDate + 7日` とします。
- `tags` は 1 ノート最大 12 件、同一ノート内で重複不可です。未登録名はノート保存時に Tag として自動作成します。
- 作成・更新の成功 response は保存後のノート詳細です。`GET /api/notes/:id` も同じ詳細形を返します。

- `POST /api/notes` は、今日以前の `noteDate` を受け取り、作成したノートへ保存します。作成時の `noteDate` は省略できません。
- `PATCH /api/notes/:id` は保存済みの現在値と同じ `noteDate` の送信を許可します。同値送信でも `noteDate` 自体は更新対象にしません。
- `PATCH /api/notes/:id` が現在値と異なる `noteDate` を受け取った場合は、他の入力を更新せずに 400 `invalid_body` を返します。エラーは次の `noteDate` フィールドエラーです。

```json
{
  "code": "invalid_body",
  "message": "入力内容に誤りがあります",
  "errors": [
    { "field": "noteDate", "message": "保存後の学習日は編集できません" }
  ]
}
```

`GET /api/notes` は次の query を受け付けます。

| Query | 内容 |
| --- | --- |
| `query` | title、既存 Markdown mode の body、summary、Cue text、Canvas `searchText` の部分一致 |
| `tags` | canonical transport。タグ名を repeated query parameter で指定する（例: `tags=alpha%2Cbeta&tags=読書`）。各 value は 1 件の完全一致タグとして扱い、trim 後に空要素・重複を除外する。value 内のカンマは分割しない |
| `tag` | legacy transport。タグ名のカンマ区切り。複数タグは OR 条件、重複・空要素は除外する。既存の `tag=読書,英語` 呼び出しとの後方互換のために受け付ける |
| `from` / `to` | `noteDate` の開始日・終了日。片側指定可 |
| `reviewDue` | `true` の場合、`nextReviewDate` が今日以前のノート |
| `page` | 1 始まり。1 ページ 50 件 |

一覧 UI からの検索は `tags` を canonical とし、選択したタグごとに同じ parameter を 1 回ずつ送信します。`tags` と legacy `tag` が同時に指定された場合は、それぞれの方式で正規化したタグを OR 条件として統合します。

response は `{ page, totalPages, totalCount, data }` です。並び順は `noteDate desc, updatedAt desc` 固定です。`from > to` や無効な日付は `400 invalid_query` とし、0 件は `200` の空配列で返します。

### 5.3 Tags API

MVP のタグ API は `GET /api/tags` のみです。request body / query はなく、`[{ id, name, color }]` を名前昇順で返します。これはノートに付いたタグの保存・表示順とは独立した候補一覧の契約です。タグが 0 件でも `200 []` です。`POST /api/tags`、タグの rename / delete API、タグ管理 UI は Phase 2 です。新規タグはノートの POST / PATCH に含めて自動作成します。

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

## 6. Canvas 本文と Markdown 編集 Preview / Summary 読み取り領域

### 6.1 CanvasDocumentV1 と用紙サイズ

- Canvas の保存形式は `CanvasDocumentV1` とし、`page.width` / `page.height` は可変の整数 px とする。
- 既定の用紙サイズは幅 1200px、高さ 800px。各寸法の許容範囲は 320〜4000px（境界値を含む）。`schemaVersion` は `1`、`page.background` は `paper` とする。
- 本文領域には幅・高さの数値入力と適用操作を置く。入力値は用紙そのものの寸法であり、表示倍率ではない。
- Fit / 50% / 100% / 200% は表示倍率を表す概念であり、用紙サイズの選択肢ではない。現行 MVP UI に倍率操作はなく、保存値・API 入力は `page.width` / `page.height` の用紙寸法だけを扱う。将来倍率 UI を追加する場合も、表示倍率と page 寸法を別 state と責務で扱う。
- 用紙サイズの変更は `page.width` / `page.height` のみを更新する。既存要素の `x`, `y`, `width`, `height`, `points`, `style`、`rotation`、`text`、`z` は自動変更しない。
- 用紙を小さくして要素が境界外になる場合も、要素を削除・移動・縮小・クリップして保存しない。境界外の要素データはそのまま保持し、後から用紙を広げたときも同じ位置・寸法で復元する。
- 保存・復元は既存の Canvas JSON 保存領域を利用する。用紙サイズ変更だけを理由に Notebook の新しいカラムや Prisma migration を追加しない。
- 既存の `schemaVersion=1` かつ 1200x800 の Canvas document はそのまま有効なデータとして復元し、既存要素を自動変換しない。未知の schema version や寸法範囲外は validation error とする。

### 6.2 Canvas 本文の操作・スタイル

- 初期 tool は `select` とする。`select` は既存 Canvas 要素の選択・移動・resize を担う。`pen` は継続 tool とし、自由線を配置しても `select` へ自動遷移しない。`line` / `arrow` / `rect` / `ellipse` / `text` は one-shot の配置 tool とし、正常に 1 オブジェクトを配置した場合だけ `select` へ戻る。tool は toolbar から明示的に切り替えられる。`erase` は hit した stroke、line、arrow、rect、ellipse、text を object 単位で全体消去するが、この one-shot 配置 lifecycle の対象には含めない。
- `pen` / `line` / `arrow` / `rect` / `ellipse` / `text` は、空白だけでなく既存のアプリ所有 Canvas 要素上からも新規作成を開始できる。既存要素上からの重ね描きは、`select` による既存要素の操作とは別の役割である。
- 新規 gesture の開始対象は、空白または保存済み `CanvasElementV1` に対応するアプリ所有 object に限る。Fabric の一時 preview、図形内文字の編集 overlay、metadata が欠落または未知の object を新規 gesture の対象にしない。
- `line` / `arrow` / `rect` / `ellipse` の図形・線作成は一定のドラッグ量を超えた場合だけ開始・確定する。小さなクリック／ダブルクリックの gesture は不要な図形を作らず、確定しない。
- `select` / `rect` / `ellipse` で対象図形をダブルクリックすると図形内文字編集に入る。編集中も図形外形を表示し、確定時は対象 shape の `text` と `textStyle` を更新し、キャンセル時は元の図形内文字へ戻す。どちらの場合も、既存のペン線・線・矢印・図形・standalone text など他要素を失わない。
- `text` の通常クリックは standalone text の新規作成であり、図形内文字編集とは別の経路である。図形ダブルクリックの inline 編集と、移動量を超えた図形の重ね描きを同じ gesture として扱わない。
- toolbar の style input は、選択中または新規作成／図形内文字編集中の対象へ即時表示反映する。線幅は整数 1〜20px（既定 1px）、文字サイズは整数 8〜96px（既定 12px）、色は stroke または text の対象に適用し、文字配置は `left` / `center` / `right` の左寄せ・中央寄せ・右寄せを受け付ける。
- standalone text の文字サイズ・色・文字配置は `style.fontSize`・`style.fill`・`style.textAlign` に保存し、図形内文字は `textStyle.fontSize`・`textStyle.fill`・`textStyle.textAlign` に保存する。線幅と線色は `style.strokeWidth`・`style.stroke` に保存する。これは既存の `CanvasDocumentV1` JSON 境界であり、新しい DB/API 保存領域を追加しない。
- Canvas の Undo / Redo は client-side history snapshot であり、DB/API の Undo ではない。tool 切替、入力 focus、小さな no-op gesture は Canvas document の保存値を変更しない。

### 6.3 Markdown 編集 Preview と Summary 読み取り領域

- Cue と Summary は Markdown として編集・保存します。基本記法と GFM のチェックボックスを表示対象とします。Canvas 本文は Markdown Preview ではなく、Canvas viewer/editor で表示します。
- `bodyMode=markdown` の既存ノートでは従来の本文 Markdown を安全にレンダリングし、`bodyMode=canvas` のノートでは保存済み Canvas document を詳細・編集・復習で復元します。
- 編集画面の `Markdown Preview` に表示する checkbox は表示専用です。クリックしても Summary の入力値や保存データを変更しません。
- 詳細画面 `/notes/[id]` の Summary は `Markdown Preview` ではなく、保存済み Markdown を読むための操作可能な読み取り領域です。閲覧モードと復習モードのどちらでも、表示後の checked / unchecked checkbox をユーザーが toggle できます。
- Summary checkbox の toggle は対応する GFM task-list marker の checked 状態だけを変更します。task の本文、Summary 内の順序、checkbox 以外の Markdown は変更しません。変更は画面上の dirty 状態として表示し、クリックごとに API を呼びません。
- ユーザーが詳細画面の Summary 保存を明示的に実行したときだけ、既存の `PATCH /api/notes/:id` を使って Summary Markdown を保存します。この操作のための新 API、schema、Prisma migration は追加しません。
- 明示保存が成功したら、表示中ノートを保存済み response で更新し、dirty 状態を解除します。保存に失敗したら未保存の Summary と dirty 状態を保持し、エラーを表示します。保存済みと誤表示してはいけません。
- Summary の変更を破棄する、または保存せずにモードを離れる場合は、変更前の Summary に戻し、DB を変更しません。Summary について autosave、draft、Undo は MVP に追加しません。
- 編集画面の Summary Markdown Preview は、折りたたみ表示または占有量を抑えた簡易表示のいずれかを採用します。常時大きなフル Preview を MVP の必須条件にはしません。
- 復習モードの Summary は初期非表示です。Cue による想起、本文の確認、その後の Summary 確認という順序を保ちます。Summary を開いた後の checkbox 操作と Summary 保存は、`POST /api/notes/:id/review` による復習完了とは別の操作です。復習完了は reviewedAt / nextReviewDate を更新しますが、Summary を保存済みと扱ったり dirty 状態を解除したりしません。復習完了でモードを離れ、Summary を別途保存していない場合は、保存せずに離れるルールに従って変更を破棄します。
- 詳細画面の Summary 読み取り領域は、閲覧・復習のどちらでも Cornell の下に置く既存の表示順を維持します。checkbox の toggle、Summary 保存、復習完了のいずれも Summary の表示位置や Cue → 本文 → Summary の順序を変更しません。

## 7. デスクトップ優先とモバイルの対応範囲

- デスクトップを主対象とし、Cornell は Cue を左、Canvas 本文を右に置く約 30% / 70% を基本とします。Canvas の用紙操作は本文列で確認しやすく配置し、編集画面の Cue / Summary Markdown Preview はそれぞれの入力欄に属するものとして扱います。詳細画面の Summary は読み取り領域として Cornell の下に置きます。
- 768px 未満では本格的な編集最適化を MVP の必須条件にしません。モバイル専用の縦積み、操作案内、キーボード最適化は Phase 2 以降に再評価します。
- モバイルではページ全体が壊れないこと、主要な入力・保存・閲覧操作へ到達できることを最低限確認します。Cornell 部分の局所的な横スクロールは許容しますが、ページ全体の意図しない横 overflow は許容しません。

## 8. 現行 MVP データモデル

MVP の Prisma model は `Notebook`、`NotebookCanvas`、`Tag`、`NotebookTag`、`Cue` です。Canvas の用紙サイズは `NotebookCanvas.documentJson` 内で管理し、`page.width` / `page.height` の変更のために別の DB カラムを追加しません。DB table / column は既存 schema の mapping に従います。

| Model | 主な責務 | 主な項目 |
| --- | --- | --- |
| `Notebook` | ノート本体、本文モード、既存本文、要約、手動復習情報 | `id`, `title`, `noteDate`, `sourceType`, `sourceTitle`, `bodyMode`, `body`, `summary`, `nextReviewDate`, `reviewedAt`, `createdAt`, `updatedAt` |
| `NotebookCanvas` | Canvas 本文の JSON と一覧検索用 text index | `notebookId`, `schemaVersion`, `documentJson`, `searchText`, `createdAt`, `updatedAt` |
| `Tag` | タグ名のマスタ | `id`, `name` (unique), `color`, `createdAt` |
| `NotebookTag` | Notebook と Tag の多対多関連とノート内表示順 | `notebookId`, `tagId`, `order`。`notebookId` + `tagId` の複合主キー、`notebookId` + `order` index |
| `Cue` | Cornell 左欄のキーワード / 質問 | `id`, `notebookId`, `text`, `order`, `createdAt`, `updatedAt` |

- `bodyMode=canvas` の MVP 本文は `NotebookCanvas.documentJson` です。`bodyMode=markdown` の既存本文は互換用に保持します。`NoteCard`、`CueCard`、`NoteCueLink` は持ちません。
- `Notebook.bodyMode=canvas` の本文は `NotebookCanvas.documentJson` の `CanvasDocumentV1` です。`bodyMode=markdown` は既存本文の互換モードとして残します。
- `NotebookCanvas.searchText` は Canvas の text 要素から生成し、一覧のフリーワード検索に使います。用紙サイズ変更だけでは searchText を更新する必要はありません。
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
2. 製品全体のロードマップや Phase 2 の位置づけが変わる場合は [`PRODUCT_SPEC.md`](../requirements/PRODUCT_SPEC.md) を更新する。既存の将来要件を現行 MVP として扱うかどうかをここで明示する。
3. [`doc/README.md`](../README.md) の設計書一覧と Primary Entry Points を更新する。
4. 影響する詳細書を更新する。対象は必要に応じて `doc/api/MVP_API_DESIGN.md`、`doc/data/MVP_DATA_DESIGN.md`、`doc/screens/`、`doc/testing/TEST_SCENARIOS.md`、`README.md` です。
5. 実装状態と受け入れ結果は、仕様変更と混ぜずに `doc/implementation/IMPLEMENTATION_STATUS.md` と `doc/testing/TEST_SCENARIOS.md` へ、現行コードと実際の証跡に基づいて反映する。静的確認と browser runtime QA は別の判定として保持する。

## 11. Runtime QA 状態（2026-07-25）

次表は、現行 MVP 契約に対する runtime の証拠範囲である。確認済み subset をシナリオ全体の PASS や Phase 2 機能の実装済みへ繰り上げない。Manager fallback の根拠は [`summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md`](../../summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md)、Canvas の既確認範囲は `summary/20260725/canvas-runtime-qa-completion-20260725.md`、受け入れ証跡の判定は [`doc/testing/TEST_SCENARIOS.md`](../testing/TEST_SCENARIOS.md) を参照する。

| 領域 | runtime で確認した範囲 | 残る境界 |
| --- | --- | --- |
| Canvas shape text | rect の文字 commit、fontSize `18`・右寄せ、ellipse の Escape cancel、他要素保持、POST `201`、再読込 GET `200`、削除 `204`、console / page error 0 を確認。 | 初期 `select`、`pen` 継続、描画 tool の配置後 `select` 遷移を含む全 lifecycle と全保存経路は未確認。`CANVAS-SHAPE-TEXT-001` は必須 subset の部分実施。 |
| Canvas dimensions / style / persistence | 既存の Canvas runtime QA で、用紙寸法、style、standalone text / line の保存・再読込、eraser、history、toolbar / touch の確認済み範囲を確認。 | `CANVAS-INTERACTION-001` / `CANVAS-GESTURE-001` の厳密 4px、wheel / trackpad 固有入力は未確認。 |
| Desktop edit | `/notes/[id]` の title、学習日（現在値の表示）、source、tag、Cue、Canvas、Summary、`nextReviewDate` の復元、保存後再読込、キャンセル、主要 field 到達性を 1280 / 1440px で確認。 | 375 / 768px の mobile edit は未確認。 |
| `nextReviewDate` | 新規 `2026-07-25` → `2026-08-01` の初期表示・保存、手動 `2026-08-05` の保持、空欄の再読込を確認。既存編集では学習日と独立して変更でき、保存済み値を学習日から自動再計算しない。 | review 成功 UI の画面反映は未確認。 |

autosave、soft-delete Undo、専用復習タスク、NoteCard / D&D、PDF、タグ管理 UI、mobile 専用最適化などは §2・§9 の Phase 2 境界を維持し、今回の runtime QA の PASS 集計には含めない。

## 12. 現行契約の保守メモ

2026-07-25 時点で、本書には Canvas の用紙寸法、表示倍率との分離、要素データ不変、toolbar、重なり、図形内文字、style の契約と、Manager fallback で確認した runtime 範囲を反映済みです。静的確認は `doc/implementation/IMPLEMENTATION_STATUS.md`、受け入れシナリオと runtime QA 境界は `doc/testing/TEST_SCENARIOS.md`、再開時の要約は `HANDOFF_2026-07-25.md` と `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md` を参照します。厳密 4px、wheel / trackpad、mobile edit、review 成功 UI などの未確認事項は、証拠が追加されるまで PASS に置き換えません。
