# MVP テストシナリオ（1 項目 1 チェック）

## 位置づけ

このドキュメントは、Cornell Method Notebook MVP の最終検証で使う確認項目です。

MVP では、明示保存、物理削除、手動で管理する `nextReviewDate`、`textarea + Markdown preview`、`/notes` の復習対象フィルタ、詳細画面内の復習モード、`/backup` の手動バックアップを確認対象とします。新規ノートの `nextReviewDate` は `noteDate + 7日` を初期値とし、1 日後 / 1 週間後の自動タスクや専用復習タスク画面は MVP の確認対象ではありません。

MVP の初期データに seed は使いません。検証用データは `/notes/new` または `POST /api/notes` で作成します。

`AGENTS.md` に含まれる将来仕様のうち、自動保存、Undo、PDF、専用復習タスク画面、D&D、NoteCard などは、このドキュメント末尾の「Phase 2 / 将来確認」に分離します。

## MVP 受け入れ確認

### 1. 初期表示 / ナビゲーション

- [ ] `/` を開くと `/notes` へ誘導される、またはノート一覧へ移動できる
- [ ] `/notes` を開くとノート一覧画面が表示される
- [ ] `/notes` から `/notes/new` へ移動できる
- [ ] `/notes` のノート項目から `/notes/[id]` へ移動できる
- [ ] 共通ナビゲーションから `/notes` へ移動できる
- [ ] 共通ナビゲーションから `/notes/new` へ移動できる
- [ ] 共通ナビゲーションから `/backup` へ移動できる
- [ ] `/backup` を開くとバックアップ画面が表示される

### 2. ノート作成

- [ ] `/notes/new` でタイトル未入力のまま保存すると validation error が表示される
- [ ] `/notes/new` でタイトルが 120 文字を超えると validation error が表示される
- [ ] `/notes/new` で未来日の学習日は保存できない
- [ ] `/notes/new` で概要が 400 文字を超えると validation error が表示される
- [ ] `/notes/new` を開くと `nextReviewDate` に `noteDate + 7日` が初期入力される
- [ ] `/notes/new` で初期入力された `nextReviewDate` を別の日付へ変更、または空欄化して保存できる
- [ ] `/notes/new` で次回復習日が学習日より前の場合は validation error が表示される
- [ ] `/notes/new` で Cue を追加できる
- [ ] `/notes/new` で Cue を削除できる
- [ ] `/notes/new` で空の Cue は保存対象から除外される、または validation error として扱われる
- [ ] `/notes/new` でタグを最大 12 個まで追加できる
- [ ] `/notes/new` で 13 個目のタグ追加または保存が拒否される
- [ ] `/notes/new` で同一ノート内の重複タグが拒否される、または重複除外される
- [ ] `/notes/new` で既存タグ候補を選択して保存できる
- [ ] `/notes/new` で未登録タグを入力すると保存時に自動作成される
- [ ] `/notes/new` の本文 Markdown preview に入力内容が反映される
- [ ] `/notes/new` のサマリー Markdown preview に入力内容が反映される
- [ ] `/notes/new` で保存中は保存ボタンが disabled になり `保存中...` が表示される
- [ ] `/notes/new` で保存 API が失敗した場合、フォーム上部に error alert が表示される
- [ ] `/notes/new` で有効な入力を保存すると `POST /api/notes` が成功する
- [ ] `/notes/new` の保存成功後に作成したノートの `/notes/[id]` へ遷移する

### 3. ノート一覧

- [ ] `/notes` で保存済みノートのタイトルが表示される
- [ ] `/notes` で保存済みノートの学習日が表示される
- [ ] `/notes` で保存済みノートの学習元が表示される
- [ ] `/notes` で保存済みノートのタグが表示される
- [ ] `/notes` で保存済みノートの Cue 件数が表示される
- [ ] `/notes` で要約未作成の状態が判別できる
- [ ] `/notes` でフリーワード検索がタイトルに対して効く
- [ ] `/notes` でフリーワード検索が概要に対して効く
- [ ] `/notes` でフリーワード検索が本文に対して効く
- [ ] `/notes` でフリーワード検索がサマリーに対して効く
- [ ] `/notes` でフリーワード検索が Cue に対して効く
- [ ] `/notes` で From の日付フィルタが効く
- [ ] `/notes` で To の日付フィルタが効く
- [ ] `/notes` で From > To の場合に validation error が表示される
- [ ] `/notes` でタグフィルタが OR 条件で効く
- [ ] `/notes` でタグフィルタの重複追加が防止される
- [ ] `/notes` でタグ候補取得中、タグ select が追加不可状態になる
- [ ] `/notes` で復習対象フィルタを有効にすると `nextReviewDate` が今日以前のノートだけが表示される
- [ ] `/notes` で検索結果が 0 件の場合に空状態が表示される
- [ ] `/notes` で一覧取得中に loading 状態が表示される
- [ ] `/notes` で一覧取得中は検索ボタンが disabled になる
- [ ] `/notes` で一覧取得に失敗した場合に error 状態が表示される
- [ ] `/notes` でページ情報が表示される
- [ ] `/notes` でページ移動ができる
- [ ] `/notes` で 1 ページ目の前へ、最終ページの次へが disabled になる

### 4. ノート詳細

- [ ] `/notes/[id]` の閲覧モードでタイトルが表示される
- [ ] `/notes/[id]` の閲覧モードで学習日が表示される
- [ ] `/notes/[id]` の閲覧モードで学習元が表示される
- [ ] `/notes/[id]` の閲覧モードで概要が表示される
- [ ] `/notes/[id]` の閲覧モードでタグが表示される
- [ ] `/notes/[id]` の閲覧モードで Cue リストが表示される
- [ ] `/notes/[id]` の閲覧モードで本文 Markdown が表示される
- [ ] `/notes/[id]` の閲覧モードでサマリー Markdown が表示される
- [ ] `/notes/[id]` の閲覧モードから編集モードへ切り替えられる
- [ ] `/notes/[id]` の編集モードで既存ノートの値がフォームに反映される
- [ ] `/notes/[id]` の編集モードで `nextReviewDate` 未設定の既存ノートを開いても、編集開始だけでは日付が自動補完されない
- [ ] `/notes/[id]` の編集モードで `noteDate` を変更しても、手動設定済みの `nextReviewDate` が自動移動しない
- [ ] `/notes/[id]` の編集モードで保存すると `PATCH /api/notes/:id` が成功する
- [ ] `/notes/[id]` の編集モードで保存中は保存ボタンが disabled になり `保存中...` が表示される
- [ ] `/notes/[id]` の編集モードで保存 API が失敗した場合、フォーム上部に error alert が表示される
- [ ] `/notes/[id]` の編集保存後に閲覧モードへ戻る
- [ ] `/notes/[id]` の編集モードでキャンセルすると保存せず閲覧モードへ戻る
- [ ] `/notes/[id]` の閲覧モードから復習モードへ切り替えられる
- [ ] `/notes/[id]` の復習モードでは本文が初期状態で非表示になる
- [ ] `/notes/[id]` の復習モードでは Summary が初期状態で非表示になる
- [ ] `/notes/[id]` の復習モードで Cue を見て想起し、本文を確認した後に Summary を開ける
- [ ] `/notes/[id]` の復習モードで本文を表示できる
- [ ] `/notes/[id]` の復習モードで表示した本文を再度非表示にできる
- [ ] `/notes/[id]` の復習モードで復習済みにすると `POST /api/notes/:id/review` が成功する
- [ ] `/notes/[id]` の復習済み更新中はボタンが disabled になり `更新中...` が表示される
- [ ] `/notes/[id]` の復習済み更新に失敗した場合に error 状態が表示される
- [ ] `/notes/[id]` の復習済み更新で `reviewedAt` が更新される
- [ ] `/notes/[id]` の復習済み更新で任意の `nextReviewDate` が保存される
- [ ] `/notes/[id]` の復習済み更新で `nextReviewDate` を空にできる
- [ ] `/notes/[id]` の復習済み更新成功後、画面に `reviewedAt` と更新後の `nextReviewDate` が反映される
- [ ] `/notes/[id]` で削除操作を選ぶと確認 UI が表示される
- [ ] `/notes/[id]` の削除確認をキャンセルすると削除されない
- [ ] `/notes/[id]` の削除確認を確定すると `DELETE /api/notes/:id` が成功する
- [ ] `/notes/[id]` の削除中は削除ボタンが disabled になり `削除中...` が表示される
- [ ] `/notes/[id]` の削除に失敗した場合に error 状態が表示される
- [ ] `/notes/[id]` の削除成功後に `/notes` へ戻る
- [ ] 存在しない `/notes/[id]` を開くと 404 またはノートなし状態が表示される

#### NTE-030 閲覧／復習の共通構造

- [ ] `/notes/[id]` の閲覧モードと復習モードで、タイトル・メタ情報・ヘッダー領域の基本構造が共通している（モードラベルと操作ボタンの違いは許容する）
- [ ] `/notes/[id]` の閲覧モードと復習モードで、概要 → Cornell（Cue／本文）→ サマリーの基本順序と位置が共通している
- [ ] デスクトップの閲覧モードと復習モードで、Cornell の Cue が左、本文領域が右にあり、幅は基本的に約 30% / 70% である
- [ ] 復習モードへ切り替えても Cue とサマリーが本文より上の別領域へ移動せず、閲覧モードと同じ詳細画面シェルが維持される
- [ ] 復習モードでは共通 Cornell の本文領域と Summary が初期状態で非表示になり、Cue と概要は表示される
- [ ] 復習モードでは Cue による想起と本文確認の後に Summary を開ける
- [ ] 復習モードで本文を表示／非表示に切り替えても、本文領域の位置と概要・Cue・サマリーの位置が変わらない
- [ ] 復習モードの復習記録と復習操作はサマリーの後ろに追加され、共通シェルの基本順序を置き換えない

### 4.1. NTE-020 / NTE-030 edit レイアウト / responsive

以下は `/notes/new` と `/notes/[id]` の編集モードに共通するレイアウトの受け入れ条件です。各項目は指定 viewport で確認し、今回の文書追加では実ブラウザでの実施結果を記録しません。

#### 共通レイアウト

- [ ] `/notes/new` と `/notes/[id]` の編集モードが、共有 `NoteEditor` の「基本情報 → Cornell ノート → Summary」のレイアウト方針を使用する

#### Desktop（1280px 以上）

- [ ] 1280px 前後で基本情報カードの高さと余白が圧縮され、タイトル・学習日・学習元・概要・タグを過度な縦幅なしに確認できる
- [ ] 1280px 前後で Cornell の Cue / Note が左約 30% / 右約 70% の幅比で表示される
- [ ] 1280px 前後で Note 本文の textarea と Preview が横並びで表示される
- [ ] 1440px 前後で基本情報カードの圧縮方針が維持される
- [ ] 1440px 前後で Cornell の Cue / Note が左約 30% / 右約 70% の幅比で表示される
- [ ] 1440px 前後で Note 本文の textarea と Preview が横並びで表示される
- [ ] 1280px 以上で Summary が textarea → Preview → 次回復習日 → キャンセル / 保存の順序で表示される

#### Tablet / mobile（768px / 375px 前後）

- [ ] 768px 前後で Cornell の Cue / Note の 2 列関係が維持され、左右の内容が同時に確認できる
- [ ] 768px 前後で Cornell の Cue 入力欄をフォーカスして操作できる
- [ ] 768px 前後で Cornell の Note 入力欄をフォーカスして操作できる
- [ ] 375px 前後で Cornell section 内の Cue / Note / Preview の関係を横スクロールで確認できる
- [ ] 375px 前後で基本情報 section は横スクロールせず通常の縦スクロールで確認できる
- [ ] 375px 前後で Summary section は横スクロールせず通常の縦スクロールで確認できる
- [ ] 375px 前後で Cornell section の外側のページは横スクロールせず、通常の縦スクロールで移動できる
- [ ] 375px 前後で Cue 追加ボタンを押して Cue を追加できる
- [ ] 375px 前後で Cue 削除ボタンを押して対象 Cue を削除できる
- [ ] 375px 前後で Cue の textarea にフォーカスして入力できる
- [ ] 375px 前後で Note 本文の textarea にフォーカスして Markdown を入力できる
- [ ] 375px 前後で Note 本文の Preview を確認できる
- [ ] 375px 前後で Summary の textarea → Preview → 次回復習日 → キャンセル / 保存の順序が維持される
- [ ] 375px 前後でキャンセル操作を実行できる
- [ ] 375px 前後で保存操作を実行できる

#### Overflow 境界

- [ ] 375px 前後で長い Markdown を入力してもページ全体の横 overflow が発生しない
- [ ] 375px 前後で長いタグを表示してもページ全体の横 overflow が発生しない
- [ ] 375px 前後で長い field error を表示してもページ全体の横 overflow が発生しない
- [ ] 375px 前後で Cue が空の状態でもページ全体の横 overflow が発生しない

#### Markdown Preview の layout 回帰

- [ ] 375px / 768px 前後でレイアウト変更後も Markdown Preview の checkbox が表示専用のままで、クリックしても入力値を変更しない
- [ ] 375px / 768px 前後でレイアウト変更後も GFM の表・取り消し線・タスクリスト等が Preview 内に表示される
- [ ] 375px / 768px 前後でレイアウト変更後も危険な HTML が sanitize され、Preview の外へ表示されない

### 5. バックアップ

- [ ] `/backup` で `GET /api/backups` の結果が一覧表示される
- [ ] `/backup` でバックアップファイル名が表示される
- [ ] `/backup` でバックアップ作成日時が表示される
- [ ] `/backup` でバックアップ保存先パスが表示される
- [ ] `/backup` でバックアップが 0 件の場合に空状態が表示される
- [ ] `/backup` でバックアップ作成を実行すると `POST /api/backups` が成功する
- [ ] `/backup` でバックアップ作成中は作成ボタンが disabled になり `作成中...` が表示される
- [ ] `/backup` で一覧取得中または作成中は一覧更新ボタンが disabled になる
- [ ] `/backup` でバックアップ作成成功後に一覧が更新される
- [ ] `/backup` でバックアップ作成成功後に成功メッセージが表示される
- [ ] `/backup` でバックアップは最新 3 世代だけが保持される
- [ ] `/backup` で一覧取得中に loading 状態が表示される
- [ ] `/backup` で一覧取得に失敗した場合に error 状態が表示される
- [ ] `/backup` で作成に失敗した場合に error 状態が表示される

### 6. API / DB

- [ ] `GET /api/notes` が `query` を受け取り一覧を返す
- [ ] `GET /api/notes` が `from` を受け取り一覧を絞り込む
- [ ] `GET /api/notes` が `to` を受け取り一覧を絞り込む
- [ ] `GET /api/notes` が `tag` を受け取り OR 条件で一覧を絞り込む
- [ ] `GET /api/notes` が `reviewDue=true` を受け取り復習対象を返す
- [ ] `GET /api/notes` が `page`, `totalPages`, `totalCount`, `data` を返す
- [ ] `POST /api/notes` が Notebook を作成する
- [ ] `POST /api/notes` が Cue を作成する
- [ ] `POST /api/notes` が未登録 Tag を作成する
- [ ] `POST /api/notes` が NotebookTag を作成する
- [ ] `GET /api/notes/:id` がノート詳細を返す
- [ ] `PATCH /api/notes/:id` が Notebook を更新する
- [ ] `PATCH /api/notes/:id` が Cue をリクエスト内容で全置換する
- [ ] `PATCH /api/notes/:id` が Tag 関連をリクエスト内容で全置換する
- [ ] `DELETE /api/notes/:id` がノートを物理削除する
- [ ] `POST /api/notes/:id/review` が `reviewedAt` を現在時刻で更新する
- [ ] `POST /api/notes/:id/review` が `nextReviewDate` を任意の日付または null で更新する
- [ ] `GET /api/tags` がタグ候補一覧を返す
- [ ] `GET /api/backups` がバックアップ一覧を返す
- [ ] `POST /api/backups` が SQLite DB ファイルを `backup/` 配下へコピーする
- [ ] `POST /api/backups` が 4 世代目以降の古いバックアップを削除する
- [ ] API の validation error が `{ code, message, errors? }` 形式で返る
- [ ] API の not found error が `{ code, message, errors? }` 形式で返る
- [ ] API の unexpected error が `{ code, message, errors? }` 形式で返る
- [ ] `GET /api/notes` で不正な `from` / `to` / `page` が `invalid_query` と field 別 error を返す
- [ ] `GET /api/notes` で From > To が `field: "from"` / `message: "開始日は終了日以前の日付を入力してください"` を返す
- [ ] `POST /api/notes` でタイトル未入力、タイトル 120 文字超、未来日の `noteDate` が `invalid_body` と field 別 error を返す
- [ ] `POST /api/notes` で 13 件以上のタグ、重複タグ、使用不可文字を含むタグが `invalid_body` と field 別 error を返す
- [ ] `PATCH /api/notes/:id` で不正 body は not found 確認より先に 400 `invalid_body` を返す
- [ ] `GET /api/notes/:id` / `PATCH /api/notes/:id` / `DELETE /api/notes/:id` / `POST /api/notes/:id/review` が存在しない ID に 404 `not_found` / `message: "ノートが見つかりません"` を返す
- [ ] `POST /api/notes/:id/review` で不正な `nextReviewDate` が `invalid_body` と `field: "nextReviewDate"` を返す
- [ ] `GET /api/tags` でタグ 0 件の場合も 200 と `[]` を返す
- [ ] `GET /api/backups` でバックアップ 0 件の場合も 200 と `{ backups: [] }` を返す
- [ ] `POST /api/backups` で DB ファイル不在や `DATABASE_URL` 不正の場合は 500 `server_error` を返す

### 7. Markdown / Security

- [ ] Markdown preview で見出しが表示される
- [ ] Markdown preview で箇条書きが表示される
- [ ] Markdown preview でリンクが表示される
- [ ] Markdown preview でコードブロックが表示される
- [ ] Markdown preview で GFM checkbox が表示される
- [ ] Markdown preview の checkbox は preview 上でクリックしても保存値を変更しない
- [ ] Markdown preview に危険な HTML を入力しても sanitize される
- [ ] 閲覧モードの Markdown 表示にも sanitize が効く
- [ ] 復習モードで本文と Summary を開いた後の Markdown 表示にも sanitize が効く

## 受け入れ証跡マトリクス

上のチェックリストは確認項目の一覧であり、下表を確認済み範囲の正本とします。判定は記録単位の範囲に限ります。同じ section に含まれる未確認項目を、別の項目の PASS から推測して繰り上げません。`FAIL（静的照合）` は実装コードと現行 MVP 契約の照合で未達が確認されたもの、`未実施` は runtime 証跡がまだないものです。

| ID | 対象シナリオ | route と画面状態 | viewport / 実行形態 | 確認日 | fixture / 検証用データの扱い | 判定 | 参照 summary / 根拠ファイル |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MVP-UI-001 | 主要 UI フロー（redirect、一覧、作成、タグ、編集保存、復習、検索、削除、バックアップ） | `/` → `/notes`（redirect / 一覧）、`/notes/new`（作成）、`/notes/[id]`（閲覧・編集・復習・削除）、`/backup`（一覧・作成） | Playwright Chromium runtime。viewport は summary に記録なし | 2026-07-05 | UI 検証用の一時ノート、既存タグ候補、新規タグを作成。API / SQLite cleanup 後に query `UI検証` の `totalCount=0`、一時タグ 0 件を確認 | PASS | `summary/20260705/mvp-ui-flow-reverification-report.md` |
| MVP-API-001 | Notes CRUD、review、一覧検索、タグ、validation、not found、backup API | `/api/notes`、`/api/notes/:id`、`/api/notes/:id/review`、`/api/tags`、`/api/backups` | API / CLI runtime（`127.0.0.1:3000`）。viewport は対象外 | 2026-07-05 | `dev.db` に API 検証用ノート / タグを作成し、API 削除と SQLite cleanup。検証タグ 0 件を確認。backup 最新 3 世代は検証結果として保持 | PASS | `summary/20260705/manager-mvp-api-crud-validation-backup-reverification-report.md` |
| MVP-MD-001 | GFM checkbox、Preview checkbox の表示専用挙動、閲覧 / 復習時の sanitize | `/notes/new`（編集 preview）、`/notes/[id]`（閲覧・復習） | Playwright Chromium runtime。viewport は summary に記録なし | 2026-07-05 | `MD検証` 接頭辞の一時ノートに危険な Markdown と checkbox を入力。確認後に API cleanup し残存 0 件を確認 | PASS | `summary/20260705/manager-markdown-sanitize-checkbox-verification-report.md` |
| MVP-BAK-001 | `npm run backup:copy` と最新 3 世代保持 | CLI / SQLite backup | CLI runtime。viewport は対象外 | 2026-07-05 | root の SQLite DB を 4 回コピー。古い世代を prune し、`backup/` に最新 3 ファイルだけが残ることを確認 | PASS | `summary/20260705/backup-copy-command-verification-report.md` |
| MVP-TOOL-001 | lint、build | 静的 / CLI 検証 | CLI | 2026-07-04〜2026-07-05 | runtime fixture なし。コード変更後の検証コマンドを実行 | PASS | `summary/20260705/manager-fix-ui009-note-editor-tag-candidates-summary.md`、`summary/20260705/manager-fix-ui014-edit-save-state-summary.md` |
| NTE020-NEW-375 | Policy C の新規作成レイアウト、ページ全体 overflow、Cornell 局所横スクロール、Cue / Markdown Preview 操作 | `/notes/new`（新規作成） | 375px、Puppeteer / headless Chromium runtime | 2026-07-14 | 空 DB、保存済みノート 0 件。保存・削除・API 更新なし。リポジトリ内 screenshot は新規作成画面の記録 | PASS | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`doc/assets/screenshots/nte020-policy-c-new-375.png` |
| NTE020-NEW-768 | Policy C の新規作成レイアウト、Cornell 2 列、ページ全体 overflow | `/notes/new`（新規作成） | 768px、Puppeteer / headless Chromium runtime | 2026-07-14 | 空 DB、保存・削除・API 更新なし | PASS | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`doc/assets/screenshots/nte020-policy-c-new-768.png` |
| NTE020-NEW-1280 | Policy C の desktop split、Cue / Note 約 30% / 70%、本文 textarea / Preview 横並び | `/notes/new`（新規作成） | 1280px、Puppeteer / headless Chromium runtime | 2026-07-14 | 空 DB、保存・削除・API 更新なし | PASS | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`doc/assets/screenshots/nte020-policy-c-new-1280.png` |
| NTE020-NEW-1440 | Policy C の desktop split、Cue / Note 約 30% / 70%、本文 textarea / Preview 横並び | `/notes/new`（新規作成） | 1440px、Puppeteer / headless Chromium runtime | 2026-07-14 | 空 DB、保存・削除・API 更新なし | PASS | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`doc/assets/screenshots/nte020-policy-c-new-1440.png` |
| NTE020-EDIT-ALL | Policy C の既存ノート edit runtime | `/notes/[id]`（編集） | 375 / 768 / 1280 / 1440px。いずれも未確認 | 2026-07-14 | 空 DBで保存済みノート 0 件。既存ノートを開かず、保存・削除・API 更新なし | 未実施 | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`HANDOFF_2026-07-16.md` §4「未実施のまま残した範囲」 |
| NTE020-OVERFLOW-375 | 長い Markdown、長いタグ、長い field error の overflow 境界 | `/notes/new` と共有 edit layout | 375px。対象入力の runtime 未確認 | 2026-07-14 | 長い Markdown / 長いタグ / 長い field error は測定に投入していない | 未実施 | `summary/20260714/nte020-policy-c-layout-qa-report.md` § Findings / Remaining Unknowns |
| NTE030-VIEW-1440 | 閲覧の共通詳細シェル、概要 → Cornell → Summary の順序、本文表示 | `/notes/[id]`（閲覧） | 1440px、Puppeteer / headless Chromium runtime | 2026-07-15 | 一時ノート `QA-SCREENSHOT-NTE030-1784048555522` を作成し、確認後に削除。query で残存 0 件を確認 | PASS | `HANDOFF_2026-07-16.md` §4「PASS として記録された範囲」、`summary/20260715/0217-create-handoff-20260715-nte020-nte030-4ee10290-summary.md`、`doc/assets/screenshots/runtime-note-detail-view-1440.png` |
| NTE030-REVIEW-1440 | 復習の共通詳細シェル、本文初期マスク、本文表示 / 再マスク、復習操作 | `/notes/[id]`（復習） | 1440px、Puppeteer / headless Chromium runtime | 2026-07-15 | 一時ノート `QA-SCREENSHOT-NTE030-1784048555522` を作成し、確認後に削除。query で残存 0 件を確認 | PASS | `HANDOFF_2026-07-16.md` §4「PASS として記録された範囲」、`summary/20260715/0217-create-handoff-20260715-nte020-nte030-4ee10290-summary.md`、`doc/assets/screenshots/runtime-note-detail-review-1440.png` |
| NTE030-MOBILE-375-768 | 閲覧 / 復習の共通シェルと本文マスクの mobile runtime | `/notes/[id]`（閲覧・復習） | 375 / 768px。いずれも未確認 | 2026-07-15 | mobile runtime 用の確認・fixture は未実施 | 未実施 | `HANDOFF_2026-07-16.md` §4「未実施のまま残した範囲」、`summary/20260715/0155-qa-nte030-review-shared-shell-puppeteer-network-blocked-summary.md` |
| MVP-REVIEW-EDGE-001 | 既存未設定 `nextReviewDate` の非補完、`noteDate` 変更時の手動設定日維持、review 成功後の画面反映 | `/notes/[id]`（編集・復習） | runtime viewport は summary に記録なし | 2026-07-16 | 該当 edge case fixture を使った実ブラウザ確認なし | 未実施 | `doc/implementation/IMPLEMENTATION_STATUS.md` §5.2、`doc/implementation/MVP_CONTRACT.md` §4.1・§4.3 |
| MVP-GAP-001 | 新規 `nextReviewDate = noteDate + 7日` 初期値 | `/notes/new`（新規作成） | 静的照合（viewport / fixture なし） | 2026-07-16 | fixture なし。実装コード、現行 MVP 契約、実装状況を照合 | FAIL（静的照合） | `doc/implementation/IMPLEMENTATION_STATUS.md` §1・§5.2、`doc/implementation/MVP_CONTRACT.md` §4.1 |
| MVP-GAP-002 | 復習開始時の Summary 初期非表示と Cue → 本文 → Summary の順序 | `/notes/[id]`（復習） | 静的照合（viewport / fixture なし） | 2026-07-16 | fixture なし。実装コード、現行 MVP 契約、実装状況を照合。runtime 未実施とは別に、Summary 初期非表示の未達を記録 | FAIL（静的照合） | `doc/implementation/IMPLEMENTATION_STATUS.md` §1・§5.2、`doc/implementation/MVP_CONTRACT.md` §4.3・§6 |
| MVP-GAP-003 | 概要の Markdown preview / sanitize | `/notes/new`、`/notes/[id]`（編集・閲覧） | 静的照合（viewport / fixture なし） | 2026-07-16 | fixture なし。概要の保存は確認できるが、本文 / Summary と同じ Markdown preview / sanitize ではない | FAIL（静的照合） | `doc/implementation/IMPLEMENTATION_STATUS.md` §1・§5.2、`doc/implementation/MVP_CONTRACT.md` §2・§6 |
| PHASE2-BOUNDARY | 自動保存、Undo / soft delete、専用復習タスク、NoteCard / D&D、PDF、タグ管理 UI 等 | `/tasks/review`、`/notes/backup`、export 等（MVP 外） | 静的な契約照合。runtime 対象外 | 2026-07-16 | fixture なし。Phase 2 の未実施項目として扱い、MVP の PASS 集計には含めない | 未実施 | `doc/implementation/MVP_CONTRACT.md` §2・§9、本文書「Phase 2 / 将来確認」 |

NTE-020 の `summary/20260714/2205-document-nte020-policy-c-responsive-acceptance-scenarios-3f7ff466-summary.md` と `summary/20260714/2319-document-nte020-policy-c-runtime-screenshots-3b94ae94-summary.md` は、受け入れ観点・screenshot task の記録です。実画面の判定は `summary/20260714/nte020-policy-c-layout-qa-report.md` と存在確認済みの PNG を根拠にし、edit runtime や長文 overflow を推測で PASS にしていません。

NTE-030 の `summary/20260715/0107-implement-nte030-review-shared-detail-shell-e125e816-summary.md` は実装 task、`summary/20260715/0112-qa-nte030-review-shared-shell-runtime-screenshots-f2358087-summary.md` と `summary/20260715/0206-document-nte030-runtime-screenshot-evidence-fcffd017-summary.md` は task / documentation 記録です。`summary/20260715/0155-qa-nte030-review-shared-shell-puppeteer-network-blocked-summary.md` は接続制約による失敗記録であり、これらの `done` 状態だけを runtime PASS の根拠にはしません。1440px の PASS は、直接確認内容を記した `HANDOFF_2026-07-16.md` と実在する screenshot を根拠にしています。

## Phase 2 / 将来確認

以下は MVP 外です。MVP の必須受け入れ条件としては扱わず、Phase 2 以降の実装時に確認します。

専用の復習タスク画面、1 日後 / 1 週間後の自動タスク、`review status`、未完了タスクバッジは、この節だけで扱います。現行 MVP の確認項目（`nextReviewDate` の手動管理、`reviewedAt` の更新、詳細画面内復習）とは混同しません。

### 1. 自動保存 / 下書き / 競合制御

- [ ] 3 秒アイドルでドラフト自動保存が走る
- [ ] 連続ドラフト保存が最短 6 秒間隔に抑制される
- [ ] 確定保存後にドラフトステータスがリセットされる
- [ ] 409 競合時にバナーで再読み込みを促す
- [ ] 409 競合時に自動保存が停止する
- [ ] 自動保存失敗時にバナーが表示される
- [ ] 自動保存失敗時に手動「再試行」ボタンだけが表示される
- [ ] オフライン時に自動保存失敗バナーが表示される
- [ ] 作成時にドラフトレコードが初期化される
- [ ] 起動時バッチで 30 日超のドラフトがクリーンアップされる

### 2. Undo / Soft Delete

- [ ] 削除後の Undo Snackbar が 5 秒表示される
- [ ] Undo Snackbar から削除済みノートを復元できる
- [ ] `POST /api/undo` で Undo 期限内の対象を復元できる
- [ ] `SoftDeleteBuffer` に削除対象が記録される
- [ ] Undo 期限切れ後にソフトデリート済みデータが物理削除される

### 3. PDF Export

- [ ] `/notes` で日付範囲指定し PDF 出力を実行できる
- [ ] PDF 出力が `GET /api/notes/export?from&to` を使う
- [ ] PDF が 1 ノート 1 ページでダウンロードされる
- [ ] 期間未指定または不正範囲のとき PDF 出力ボタンが無効化される
- [ ] PDF 出力完了時にトーストが表示される

### 4. 専用復習タスク画面 / バッジ

- [ ] `/tasks/review` の 1 日後タブでタスクが表示される
- [ ] `/tasks/review` の 1 週間後タブでタスクが表示される
- [ ] `/tasks/review` で完了チェックすると次ステータスに遷移する
- [ ] `/tasks/review` で完了チェック後にタスクが即時消える
- [ ] グローバルナビゲーションに未完タスクバッジが表示される
- [ ] 作成時にレビュー進捗レコードが初期化される
- [ ] 作成時に 1 日後 / 7 日後のレビュー予定が保存される

### 5. D&D / Card Model

- [ ] キーワードカードを D&D で並び替えできる
- [ ] ノートカードを追加できる
- [ ] ノートカードを D&D で並び替えできる
- [ ] ノートカードの hidden flag を閲覧モードで反映できる
- [ ] ノート欄全体の一時非表示を閲覧モードで切り替えられる
- [ ] Cue と Note の関連を `NoteCueLink` に保存できる
- [ ] D&D のキーボード代替操作が用意されている
- [ ] D&D リストに必要な ARIA 属性が付与されている

### 6. タグ管理 UI

- [ ] タグ一覧で右クリックメニューから名称変更できる
- [ ] タグ一覧で右クリックメニューから削除できる
- [ ] タグ削除時に確認 UI が表示される
- [ ] タグ名称変更が既存ノートへ即時反映される

### 7. バックアップログ / Retry API

- [ ] `backup_logs` にバックアップ結果が保存される
- [ ] バックアップログを UI で確認できる
- [ ] `POST /api/backups/retry` で失敗分を再試行できる
- [ ] `/backup` でログ詳細を確認できる

### 8. 高機能 Markdown エディタ / ショートカット

- [ ] `@uiw/react-md-editor` などの高機能 Markdown エディタで入力できる
- [ ] Markdown ツールバーから装飾を挿入できる
- [ ] Cmd/Ctrl+S で確定保存できる
- [ ] Cmd/Ctrl+N でフォーカス位置に応じてカード追加できる
- [ ] Cmd/Ctrl+N でフォーカスなしの場合は無効になる
- [ ] Cmd/Ctrl+Z で取り消しが効く
- [ ] Cmd/Ctrl+Shift+Z でやり直しが効く

### 9. アクセシビリティ強化

- [ ] モーダルに必要な ARIA 属性が付与されている
- [ ] モーダルのフォーカス制御が実装されている
- [ ] 削除確認以外の確認モーダルにもフォーカストラップが効く
