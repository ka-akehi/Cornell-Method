# 現行 MVP 契約

更新日: 2026-08-24
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

Gate 0 の完了後は Desktop PoC と Desktop Alpha を先に進めます。Desktop Alpha 後の Canvas PNG と検索・一覧の規模対応は採用済みですが、現行 MVP へ繰り上げません。PDF export、autosave、Undo、専用復習タスク、NoteCard / D&D 等は未採用であり、実装を自動で開始しません。

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

下記は MVP の完成条件・受け入れ条件に含めません。採用済み要件は Desktop Alpha 後の別 task で実装し、未採用候補は採用判断まで実装を前提にしません。

- ドラフト、autosave、楽観ロック、`409` 競合処理。
- soft delete、削除後 Undo、Snackbar、カード単位の復元。
- 独立した復習タスク画面、自動復習タスク、未完了タスクバッジ。
- NoteCard 分割、複数本文カード、Cue と本文の ID リンク、D&D 並び替え、hidden flag。
- 外部出力、タグの名称変更・削除を行う管理 UI、タグ専用の更新・削除 API。Canvas PNG は Desktop Alpha 後の採用済み要件、PDF / HTML export は現在未採用であり、いずれも現行 MVP には含めない。
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
- MVP では削除後の復元を保証しません。Undo、soft delete、`SoftDeleteBuffer`、期限付き purge は未採用候補です。
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
- この 2 つのバッジは、未採用の専用復習タスク、`review status`、未完了タスクバッジを意味しません。

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

MVP のタグ API は `GET /api/tags` のみです。request body / query はなく、`[{ id, name, color }]` を名前昇順で返します。これはノートに付いたタグの保存・表示順とは独立した候補一覧の契約です。タグが 0 件でも `200 []` です。`POST /api/tags`、タグの rename / delete API、タグ管理 UI は未採用候補です。新規タグはノートの POST / PATCH に含めて自動作成します。

### 5.4 Review API

`POST /api/notes/:id/review` の body は次の形です。

```json
{ "nextReviewDate": "2026-07-23" }
```

`nextReviewDate` は任意で、`YYYY-MM-DD`、`null`、空欄を指定できます。成功時は `200` で `{ id, reviewedAt, nextReviewDate }` を返します。対象がない場合は `404`、日付形式が不正な場合は `400 invalid_body` です。

### 5.5 Backup API

- `GET /api/backups` は `{ "backups": [...] }` を返します。各 entry は `file`、`createdAt`、`path` を持ち、最新 3 世代を新しい順で返します。対象がない場合も `200` です。
- `POST /api/backups` は request body / query を持たず、SQLite DB を `backup/` 配下へコピーします。成功時は `200` で `{ "ok": true, "backup": { "file", "path" } }` を返します。
- MVP のバックアップ操作は手動作成と一覧確認です。Canvas PNG、PDF export、restore、バックアップログ、`/api/backups/retry` はこの契約に含めません。Desktop Alpha の backup / restore は、現行 `/backup` と API をこの文書同期で変更せず、別の Settings 契約として実装します。

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

## 9. 現行 MVP 外の後続境界

現行 MVP の次は Desktop Alpha を完成させます。後続段階の採用状態は次のとおりです。この節は将来要件の入口であり、現行 MVP の route、API、DB、Canvas、手動 backup、受け入れ結果を変更しません。

| 段階 | 採用状態 | 現行 MVP との境界 |
| --- | --- | --- |
| Desktop PoC | Tauri + Node.js sidecar の shell 選定完了（2026-08-17）。renderer UI automation と同形式の追加比較は未確認 | Electron と Tauri + Node.js sidecar を同じ baseline、10,000 note fixture、Apple Silicon Mac、関連 process 合計メモリを含む測定軸で比較する。Tauri retry24 の native lifecycle と `.app` / DMG package は確認済みだが、renderer UI automation、comparable な cold start / RSS 測定、Electron の同形式追加 evidence は未確認である。内部 process を許容し、OS process が複数存在することだけを不合格理由にしない。PDF / Playwright / Chromium は blocker または必須条件にしない |
| Desktop Alpha | 契約を承認済み。single-instance recovery、既存 primary lifecycle、Settings shell / bridge / entrypoint の実装済み範囲あり。更新確認・取得・検証・state・pending verification、verified artifact の apply preparation、staged migration、rollback / recovery、candidate health、checkpoint persistence、cleanup は backend 実装済み。実際の packaged app による更新結合 QA は未検証 | stable advisory lock による single application instance / 1 primary window、二重起動時の既存 primary window 前面化、起動途中の bounded focus、stale metadata recovery、legacy marker fail-safe、終了時の app-owned process cleanup を実装する。更新 pipeline の backend 境界と、backup / restore、完全なデータ削除、診断、privacy の承認済み契約は §9.4 で定める。現行 route と明示保存等を維持する |
| Desktop Alpha 後 | Canvas PNG と検索サジェスト・大規模一覧対応を採用済み、未実装 | 後続仕様 task で未決事項を決めるまで、現行検索 API と 1 ページ 50 件の契約を変更しない |
| 採否未決 | autosave、Undo / soft delete、専用復習タスク、NoteCard / D&D、タグ管理 mutation、定期 backup、暗号化 backup、PDF export 等 | 発注者の採用判断前に API、schema、画面、実装 task を固定しない |

Desktop Alpha の primary window はユーザー向けの主画面を指します。Settings modal、確認 dialog、OS file dialog は primary window に数えず、新しい独立 primary window を作りません。shell の main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper 等の内部 process を許容します。最後の primary window を閉じると application instance を終了し、local runtime と app-owned child process をすべて停止して orphan process を残しません。

single-instance の current implementation は `settings/.instance.lock` を stable advisory OS lock として保持し、owner JSON を `settings/.instance.owner` へ atomic replace する。lock を取得した process だけが focus socket の stale recovery と listener bind を行い、secondary は focus 成功または sanitized な既存 owner / 準備中エラーで終了する。旧 `create_new` marker を自動奪取せず、active / unknown / permission endpoint を削除しない。旧 process との hot upgrade、packaged Apple Silicon GUI、Dock / Finder の表示挙動は未検証である。

Settings の current implementation は、shared event bridge、Mac menu から既存 primary WebView への dispatch、Web gear / mobile trigger、General / Updates / Data and Backup の modal shell と focus / keyboard 制御までである。Updates UI と update backend の接続、Data and Backup の export / restore / 完全削除操作は未実装で、現行 `/backup` は代替受け入れまで維持する。update backend には更新確認・取得・検証・state・pending verification、`apply_verified_update`（引数なしの明示 command）による apply preparation、persisted `ApplyPreparation` を起点とする staged migration、candidate health、bundle switch、rollback / recovery、cleanup の backend 実装がある。実際の packaged app による runtime acceptance は別途未検証である。

### 9.4 Desktop Alpha の更新・migration・privacy 契約

この節は現行 MVP の route、API、明示保存、確認付き物理削除、詳細画面内復習、`/backup`、CanvasDocumentV1、legacy Markdown を変更しない Desktop Alpha の承認済み契約です。契約は確定しています。現行コードには provider normalization、manifest validation、compatible selection、公開 URL 境界、download、signature・SHA-256、archive・bundle validation、update state、pending verification、verified artifact の apply preparation、staged migration、candidate health、bundle switch、rollback / recovery、cleanup の backend 実装があります。実際の packaged app による sidecar health、bundle switch、rollback / recovery、cleanup の runtime acceptance は未検証です。

PR #159 の Code Review Issue #164〜#168 に関する実装状態は、候補 safety backup の再利用・曖昧性、rollback 後の failed bundle marker cleanup、restart handoff の永続化順序、staged migration failure の同一 startup recovery、全 application table の read-back 比較としてこの契約に反映する。Issue の自動 close 用文言は PR 本文の責務とする。

2026-08-24 時点の staged migration suite は 19/19 PASS、Desktop update Node suite は 69/69 PASS、rollback/recovery focused tests は 8/8 PASS（同 suite に含む）。これは static / disposable fixture と contract test の証跡であり、実 provider / package runtime、実際の macOS packaged `.app` / DMG、Apple Silicon GUI の packaged acceptance ではない。対象 ESLint、対象 Desktop test / launcher / runtime helper の `node --check`、Rust fmt、`git diff --check` は PASS、Rust unit test は offline cache に `base64 0.22.1` がないため compile 前に未検証である。full build と packaged macOS runtime は未検証であり、packaged DMG の配信可否も完了扱いにしない。

- 初期 provider は GitHub Releases とし、更新取得側は provider-neutral な manifest interface とする。具体的な取得 URL や provider 固有 payload はこの契約で固定しない。
- 初期配布は DMG とする。アプリ内更新は Apple Silicon 向け `.app archive` を使い、DMG と更新 package の役割を分ける。archive の具体的な拡張子は未決定とする。
- Desktop Alpha の artifact と packaged QA の対象は Apple Silicon の `aarch64-apple-darwin` だけとする。Intel は Public Mac Release で別途判断し、Alpha の blocker や成果物にしない。
- manifest は `releases[]` を持ち、端末側で channel、version、architecture、macOS compatibility を判定する。同一 channel の現行 version より新しい compatible version だけを選び、downgrade は行わない。
- 各 release の `keyId` はアプリが保持する現行鍵または次期鍵を参照する。更新 package は公開鍵署名と SHA-256 の両方を検証し、manifest から新しい信頼根や公開鍵を追加しない。
- manifest に端末固有 ID、利用状況、ノート内容、検索内容などのユーザー固有情報を載せない。DB compatibility は manifest にユーザー固有情報を載せず、端末内の staging copy で migration と reopen を検証する。
- 更新 package は Application Support 内の app 管理 staging に保管する。`settings/update-state.json` に保存する再起動後の検証用 artifact metadata は承認済みの項目だけとし、ノート本文、SQLite、backup、診断情報を保存しない。state は local schema version を manifest root の `schemaVersion: 1` と分離し、`ApplyPreparation`、`RestartHealthCheck`、`Rollback`、`Cleanup` と recovery checkpoint を atomic に永続化する。checkpoint の stage は `HealthPending`、`BundleSwitching`、`BundleSwitched`、`CleanupPending`、`RollbackPending` とし、failure / interruption 後も candidate と typed failure を保持する。
- 更新はバックグラウンドで取得するが、自動適用しない。ユーザーが明示的に再起動して更新を選んだ場合だけ、package と DB staging の検証後に適用する。
- `apply_verified_update` は引数なしの明示 invoke command とし、verified candidate の manifest / candidate identity、signature・digest、canonical staging path、archive、bundle（bundle ID / version / architecture / arm64 Mach-O）を既存 validator で再検証する。再検証に成功した場合だけ `ApplyPreparation` の atomic state transition を行い、explicit restart handoff へ渡す。handoff の atomic 永続化が成功した後にだけ exit allowance と restart request を行い、永続化失敗時は restart と exit allowance を行わない。明示 handoff のない persisted `ApplyPreparation` は interruption として扱い、自動 apply / 自動 restart を行わない。自動 check、startup check、download 完了、pending notification だけでは apply / restart しない。
- apply 直前には、署名済み archive の期待 tree と extracted candidate tree の全 entry を bytes、type、mode、size、追加・欠落、safe internal symlink target まで照合し、不一致を fail-closed にする。
- `ApplyPreparation` が persisted state として存在する更新だけを staged migration の起点とする。pending migration がある場合だけ適用直前に app 管理 safety backup を作成し、candidate bundle 内の固定 runtime root `Contents/Resources/runtime` から migration source を読み、DB staging copy 上で古い順に migration、schema / integrity / foreign key / reopen を検証する。同じ candidate digest の既存 safety backup は、内容と file identity を検証した後にだけ再利用する。複数件が一致する場合は選択・削除せず fail-closed とする。pending migration がない場合は migration と migration 用 safety backup を実行しない。
- migration の read-back では SQLite の全既存 application table を動的に列挙し、`sqlite_*` system table と `_prisma_migrations` だけを明示的に除外する。各既存 table の column と row を比較し、table、column、row の消失・変更を検証成功前に検出する。Notebook の legacy Markdown body と NotebookCanvas の `CanvasDocumentV1` も確認し、検証成功後だけ staged DB と live DB を atomic switch する。失敗・中断時は live DB を変更しない。
- staged migration の runner、read-back、switch の failure は typed rollback checkpoint として永続化する。failure が発生した同じ startup で update recovery を実行し、recovery 成功時だけ bootstrap へ進む。recovery 自体の failure は fail-closed とし、failure / interruption 後に staged migration を自動再実行しない。
- 旧 app が新しい DB schema を検出した場合は live DB を変更せず、現行版への更新または backup restore を案内する。旧 app が live DB を直接 migration しない。
- package の署名・SHA-256、architecture、macOS compatibility、DB migration、reopen、candidate health の検証に成功した場合だけ切り替える。candidate/current の path、symlink、bundle identity、version、architecture を検証し、archive extraction と recovery は同じ safe internal relative symlink policy を使う。bundle 内の symlink は相対 target、bundle root 内、解決先の存在、cycle なし、`MAX_SYMLINK_HOPS` 内のものだけを許可する。absolute path、backslash、control byte、空 component、`.`、root 外 traversal、dangling link、cycle、hop 超過、special file は fail closed とする。managed root、bundle root、switch temporary parent 等の外側の path component は symlink 不可とし、candidate health には app bundle root ではなく packaged runtime root `Contents/Resources/runtime` を渡す。
- `HealthPending`、`BundleSwitching`、`BundleSwitched`、`CleanupPending`、`RollbackPending` の checkpoint は atomic に保存する。candidate health 成功前は current app、live DB、app 管理 safety backup を保持し、失敗・中断時は rollback、SQLite restore、旧 bundle 復帰、typed failure を fail-closed に扱う。DB / bundle rollback と restore が成功した場合も、terminal rollback state を記録する前に、対象 failed bundle marker を managed root / safe-tree 検証付きで削除する。marker cleanup に失敗した場合は `RollbackPending` と typed failure を保持する。rollback / restore 成功時は `Available + failure + pending candidate` へ atomic に遷移して `RollbackPending`、phase、recovery を解除し、rollback / restore 失敗時は `RollbackPending` と typed failure を保持する。failure / interruption 後に migration を自動再実行しない。
- 新版の初回起動と health check が成功するまで旧 app bundle を保持し、成功後にだけ旧 bundle、不要な staged artifact、migration safety backup を cleanup する。switch / rollback の copy は安全確認済み internal symlink を target string のまま再作成し、cleanup は symlink target を辿らず link 自体を unlink する。自動 apply / 自動 restart は行わず、cleanup failure も checkpoint と typed failure を保持する。
- ノートの作成、編集、閲覧、検索、復習、保存、backup / restore は offline で動作させ、network は manifest と package の取得だけに使う。local log と診断 bundle は自動送信せず、ノート本文、SQLite、backup、検索内容などの user data を含めない。
- Developer ID、notarization、Apple Developer Program、一般公開用配布サイトは Desktop Alpha の必須条件にせず、Public Mac Release で判断する。
- 通常のアンインストールでは live DB を削除しない。Settings の完全なデータ削除は別操作とし、明示確認後に live DB、app 管理 backup、設定だけを対象にする。ユーザーが任意の場所へ保存した外部 SQLite export は削除しない。
- 具体的な GitHub URL、承認済み field allowlist 以外の manifest wire-level details、署名アルゴリズム名、encoding、canonicalization、秘密鍵・公開鍵の値、package archive の具体的な拡張子、retention policy の細則はこの契約で固定しない。

#### 9.4.1 Manifest validation boundary

GitHub Releases の応答は provider adapter が provider-neutral な manifest へ正規化してから検証する。provider の並び順、文字列順、raw response、release notes は候補選択に使わず、provider response 全体も保存しない。検証対象の論理 field allowlist と境界は次のとおりです。

| object | 許可する field | 必須・値の境界 |
| --- | --- | --- |
| root | `productId`, `schemaVersion`, `releases` | `productId` は `com.cornellmethod.notebook` と一致する。`schemaVersion` は必須の `1` とし、未知 version は fail closed とする。`releases[]` は必須配列で、空配列は有効な「更新なし」とする。 |
| release | `channel`, `version`, `architecture`, `minVersion`, `maxVersionExclusive`, `artifact`, `signature` | `channel` は `stable` 固定、`version` は SemVer 互換、`minVersion` は必須の macOS 下限、`maxVersionExclusive` は任意の排他的上限とする。macOS version は数値 component で比較する。 |
| artifact | `artifactId`, `format`, `url`, `sizeBytes`, `sha256` | `artifactId` は必須の opaque immutable ID とし、同じ package には同じ ID を使う。`format` は抽象値 `app-archive`、`sizeBytes` は正の整数 byte 数、`sha256` は 64 文字の lowercase hexadecimal とする。 |
| signature | `keyId`, `proof` | `keyId` と opaque な `proof` を必須とする。proof は package digest と release metadata をまとめて署名した結果を表すが、署名アルゴリズム名、encoding、canonicalization、鍵値は固定しない。 |

実際の最低対応 macOS version と deployment target は、Apple Silicon の packaged PoC 後に決める。`minVersion` / `maxVersionExclusive` の validation boundary を先に固定することは、最低対応 version の数値を確定することを意味しない。

root、release、artifact、signature の未知 field、product ID 不一致、未知 root schema version、必須 field・型・SemVer・macOS range・artifact metadata・URL・signature proof の不備、同一 target の重複（duplicate）は manifest 全体を拒否する。`stable` 以外の channel、未知 architecture、未知 format はその release だけを対象外とし、他の有効な release を評価する。Desktop Alpha で評価する architecture は `aarch64-apple-darwin` である。

`version` は SemVer の precedence で比較し、`releases[]` の並び順や文字列順を使わない。prerelease は対象外とし、build metadata は version の大小判定に使わない。対象 channel、architecture、format、macOS range に適合し、現行 version より新しい候補のうち、最も高い SemVer precedence の release を選ぶ。空配列、または非対象 release だけの manifest は有効な「更新なし」とする。

同じ channel、version、architecture、macOS target（`minVersion` と `maxVersionExclusive` の組）の重複が manifest 全体にあれば、対象外 release を含めて manifest 全体を拒否する。`maxVersionExclusive` がない target は、上限なしの target として重複判定する。

artifact URL は公開 direct HTTPS とする。許可する redirect は HTTPS から HTTPS への redirect だけであり、HTTP への downgrade、credential、token、ユーザー固有 query を含む URL は拒否する。package format は `app-archive` という抽象値だけを契約に置き、archive の具体的な拡張子は固定しない。

manifest root の `schemaVersion: 1` は manifest の version namespace であり、local `settings/update-state.json` の schema version と分離する。update state には再起動後の検証に必要な version、channel、architecture、`artifactId`、`sizeBytes`、`sha256`、`keyId`、verification state、app 管理 staging からの relative package path、時刻、recovery checkpoint、typed failure だけを保存する。URL、provider response 全体、token、DB、user path は保存しない。候補 bundle は固定の `Contents/Resources/runtime` を検証済み runtime root として扱い、app bundle root を candidate health の runtime に渡さない。

Desktop Alpha の詳細な実装順と受け入れ境界は [`POST_MVP_IMPLEMENTATION_PLAN.md`](POST_MVP_IMPLEMENTATION_PLAN.md)、責務境界は [`TARGET_ARCHITECTURE.md`](../technical/TARGET_ARCHITECTURE.md) を参照します。現行 MVP の `/backup` は、Desktop の Settings modal にある代替機能が完成して受け入れ確認を通るまで残します。

### 9.1 Canvas PNG

Canvas PNG は Desktop Alpha 後の最初の外部出力として採用済みですが、未実装です。

- 保存済み `CanvasDocumentV1.page.width` × `page.height` の用紙全体を同じ寸法で PNG 化する。
- 現在の paper 背景を含む Canvas の用紙だけを対象とし、アプリ UI、Cue、Summary を含めない。
- 用紙外の要素部分を切り取り、legacy `bodyMode=markdown` の本文を対象にしない。
- 初期ファイル名を `[タイトル]_[学習日].png` とし、その文字列を画像内へ描画しない。
- 使用不可文字、同名 file、保存先、失敗時 UI、色管理は未決定のまま、後続仕様 task で決める。

PDF export は採用しておらず、将来再検討するかも未決定です。PNG の契約から PDF の provider、layout、出力先を推測しません。

### 9.2 検索サジェストと大規模一覧

検索改善と一覧の規模対応は Desktop Alpha 後の採用済み要件ですが、未実装です。

- 既存の tag 専用 filter を維持し、tag を検索対象 selector に含めない。
- 検索対象は単一選択で既定値をタイトルとし、タイトル、学習元、本文、Cue、すべてを基本候補にする。「すべて」はタイトル、学習元、本文、Cue を検索する。
- サジェストはノート card ではなく、選択範囲の local data に存在する語句候補とする。入力 1 文字目から最大 5 件を返し、前方一致を優先する。外部辞書 API と telemetry は使わない。
- debounce は 10,000 件での実測により必要な場合だけ導入する。現行 MVP に存在する query debounce を、将来サジェストの方式決定とみなさない。
- 5,000 件を長期利用の最低目標とし、deterministic な 10,000 note fixture で性能余裕を確認する。
- 一覧は追加読み込み型の無限スクロールとし、virtualization または同等の windowing で DOM 要素数を制限する。
- Summary の検索対象分類、tokenization、同順位、API / index、取得単位、仮想化方式は未決定とする。

### 9.3 採否未決の候補

draft / autosave / version・競合、soft delete / Undo / purge、専用復習タスク、NoteCard / Cue link / hidden / D&D、タグ管理 mutation、定期 backup、暗号化 backup、PDF export は未採用です。採用する場合は、本契約の現行 MVP 境界を暗黙に変更せず、製品仕様、後続契約、API、schema、画面、テストを別 task で更新します。

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

Desktop Alpha の残る受け入れ範囲、Canvas PNG、検索サジェスト、大規模一覧は未完了または未実装であり、今回の runtime QA の PASS 集計には含めない。autosave、soft-delete Undo、専用復習タスク、NoteCard / D&D、PDF、タグ管理 UI、mobile 専用最適化は §2・§9 の未採用境界を維持する。

## 12. 現行契約の保守メモ

2026-07-25 時点で、本書には Canvas の用紙寸法、表示倍率との分離、要素データ不変、toolbar、重なり、図形内文字、style の契約と、Manager fallback で確認した runtime 範囲を反映済みです。静的確認は `doc/implementation/IMPLEMENTATION_STATUS.md`、受け入れシナリオと runtime QA 境界は `doc/testing/TEST_SCENARIOS.md`、再開時の要約は `HANDOFF_2026-07-25.md` と `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md` を参照します。厳密 4px、wheel / trackpad、mobile edit、review 成功 UI などの未確認事項は、証拠が追加されるまで PASS に置き換えません。
