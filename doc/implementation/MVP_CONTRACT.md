# 現行 MVP 契約

更新日: 2026-07-22
状態: Canvas 操作・スタイル・図形内文字・重ね描き・用紙寸法の契約反映済み。browser runtime QA 未確認

## 1. 位置づけと正本

この文書は、現在実装・受け入れ判断を行う小さな MVP の契約です。D-01〜D-05 で確定した範囲、canonical route、API、保存・削除・復習の扱いをここで固定します。

- [`AGENTS.md`](../../AGENTS.md) は、MVP と将来の Phase 2 以降を含む製品全体の仕様・ロードマップです。AGENTS.md に残る高度機能の記述は削除せず、製品全体の将来境界として扱います。
- この文書は、現行 MVP の実装・受け入れ判断に使う正本です。AGENTS.md のロードマップ記述と現行 MVP の契約が異なる場合、現行 MVP の判断ではこの文書を優先します。
- 詳細な request / response、画面状態、データ項目は API・画面・データ設計書で補足します。詳細書とこの文書が現行 MVP の範囲で矛盾した場合は、この文書を先に更新してから詳細書を追従させます。

## 2. MVP の目的と対象範囲

MVP の目的は、ローカル個人利用で、Cornell Method のノートを「Cue で整理する → 中央のフリー入力 Canvas に本文を記録する → Summary で要約する → 閲覧・復習する」流れを、明示保存で最後まで完了できるようにすることです。既存の Markdown 本文モードは互換表示のために保持し、既存データを Canvas へ自動変換しません。

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

`GET /api/notes` は次の query を受け付けます。

| Query | 内容 |
| --- | --- |
| `query` | title、既存 Markdown mode の body、summary、Cue text、Canvas `searchText` の部分一致 |
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

## 6. Canvas 本文と Markdown / Summary Preview

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

- `select` は既存 Canvas 要素の選択・移動・resize を担う。`erase` は hit した stroke、line、arrow、rect、ellipse、text を object 単位で全体消去する。tool は sticky で、選択した tool を別 tool へ切り替えるまで継続して使える。
- `pen` / `line` / `arrow` / `rect` / `ellipse` / `text` は、空白だけでなく既存のアプリ所有 Canvas 要素上からも新規作成を開始できる。既存要素上からの重ね描きは、`select` による既存要素の操作とは別の役割である。
- 新規 gesture の開始対象は、空白または保存済み `CanvasElementV1` に対応するアプリ所有 object に限る。Fabric の一時 preview、図形内文字の編集 overlay、metadata が欠落または未知の object を新規 gesture の対象にしない。
- `line` / `arrow` / `rect` / `ellipse` の図形・線作成は一定のドラッグ量を超えた場合だけ開始・確定する。小さなクリック／ダブルクリックの gesture は不要な図形を作らず、確定しない。
- `select` / `rect` / `ellipse` で対象図形をダブルクリックすると図形内文字編集に入る。編集中も図形外形を表示し、確定時は対象 shape の `text` と `textStyle` を更新し、キャンセル時は元の図形内文字へ戻す。どちらの場合も、既存のペン線・線・矢印・図形・standalone text など他要素を失わない。
- `text` の通常クリックは standalone text の新規作成であり、図形内文字編集とは別の経路である。図形ダブルクリックの inline 編集と、移動量を超えた図形の重ね描きを同じ gesture として扱わない。
- toolbar の style input は、選択中または新規作成／図形内文字編集中の対象へ即時表示反映する。線幅は整数 1〜20px（既定 1px）、文字サイズは整数 8〜96px（既定 12px）、色は stroke または text の対象に適用し、文字配置は `left` / `center` / `right` の左寄せ・中央寄せ・右寄せを受け付ける。
- standalone text の文字サイズ・色・文字配置は `style.fontSize`・`style.fill`・`style.textAlign` に保存し、図形内文字は `textStyle.fontSize`・`textStyle.fill`・`textStyle.textAlign` に保存する。線幅と線色は `style.strokeWidth`・`style.stroke` に保存する。これは既存の `CanvasDocumentV1` JSON 境界であり、新しい DB/API 保存領域を追加しない。
- Canvas の Undo / Redo は client-side history snapshot であり、DB/API の Undo ではない。tool 切替、入力 focus、小さな no-op gesture は Canvas document の保存値を変更しない。

### 6.3 Markdown と Summary Preview

- Cue と Summary は Markdown として編集・保存します。基本記法と GFM のチェックボックスを表示対象とします。Canvas 本文は Markdown Preview ではなく、Canvas viewer/editor で表示します。
- `bodyMode=markdown` の既存ノートでは従来の本文 Markdown を安全にレンダリングし、`bodyMode=canvas` のノートでは保存済み Canvas document を詳細・編集・復習で復元します。
- Summary の Markdown 表示では Preview の checkbox を表示専用とし、クリックして保存データを変更できないものとします。
- 編集モードの Summary Preview は、折りたたみ表示または占有量を抑えた簡易表示のいずれかを採用します。常時大きなフル Preview を MVP の必須条件にはしません。
- 復習モードの Summary は初期非表示です。Cue による想起、本文の確認、その後の Summary 確認という順序を保ちます。

## 7. デスクトップ優先とモバイルの対応範囲

- デスクトップを主対象とし、Cornell は Cue を左、Canvas 本文を右に置く約 30% / 70% を基本とします。Canvas の用紙操作は本文列で確認しやすく配置し、Cue / Summary の Markdown Preview はそれぞれの入力欄に属するものとして扱います。
- 768px 未満では本格的な編集最適化を MVP の必須条件にしません。モバイル専用の縦積み、操作案内、キーボード最適化は Phase 2 以降に再評価します。
- モバイルではページ全体が壊れないこと、主要な入力・保存・閲覧操作へ到達できることを最低限確認します。Cornell 部分の局所的な横スクロールは許容しますが、ページ全体の意図しない横 overflow は許容しません。

## 8. 現行 MVP データモデル

MVP の Prisma model は `Notebook`、`NotebookCanvas`、`Tag`、`NotebookTag`、`Cue` です。Canvas の用紙サイズは `NotebookCanvas.documentJson` 内で管理し、`page.width` / `page.height` の変更のために別の DB カラムを追加しません。DB table / column は既存 schema の mapping に従います。

| Model | 主な責務 | 主な項目 |
| --- | --- | --- |
| `Notebook` | ノート本体、本文モード、既存本文、要約、手動復習情報 | `id`, `title`, `noteDate`, `sourceType`, `sourceTitle`, `bodyMode`, `body`, `summary`, `nextReviewDate`, `reviewedAt`, `createdAt`, `updatedAt` |
| `NotebookCanvas` | Canvas 本文の JSON と一覧検索用 text index | `notebookId`, `schemaVersion`, `documentJson`, `searchText`, `createdAt`, `updatedAt` |
| `Tag` | タグ名のマスタ | `id`, `name` (unique), `color`, `createdAt` |
| `NotebookTag` | Notebook と Tag の多対多関連 | `notebookId` + `tagId` の複合主キー |
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
2. 製品全体のロードマップや Phase 2 の位置づけが変わる場合は [`AGENTS.md`](../../AGENTS.md) を更新する。既存の将来要件を現行 MVP として扱うかどうかをここで明示する。
3. [`doc/README.md`](../README.md) の設計書一覧と Primary Entry Points を更新する。
4. 影響する詳細書を更新する。対象は必要に応じて `doc/api/MVP_API_DESIGN.md`、`doc/data/MVP_DATA_DESIGN.md`、`doc/screens/`、`doc/testing/TEST_SCENARIOS.md`、`README.md` です。
5. 実装状態と受け入れ結果は、仕様変更と混ぜずに `doc/implementation/IMPLEMENTATION_STATUS.md` と `doc/testing/TEST_SCENARIOS.md` へ、現行コードと実際の証跡に基づいて反映する。静的確認と browser runtime QA は別の判定として保持する。

## 11. 現行契約の保守メモ

2026-07-19 時点で、Canvas の用紙寸法、表示倍率との分離、要素データ不変、toolbar、重なり、図形内文字、style の契約は本書へ反映済みです。2026-07-22 の strict Target Architecture 移行では、この機能契約と受け入れ判定を変更していません。現行コードの静的確認は `doc/implementation/IMPLEMENTATION_STATUS.md`、受け入れシナリオと未実施の runtime QA は `doc/testing/TEST_SCENARIOS.md`、再開時の要約は `HANDOFF_2026-07-22.md`、strict 移行後の構成と最新 build の根拠は `summary/20260722/strict-architecture-final-review-after-ui-migration-20260722.md` と `summary/20260722/fresh-build-verification-20260722.md` を参照します。browser runtime の結果が得られた場合は、未確認を PASS に置き換えず証跡に合わせて各文書を更新します。
