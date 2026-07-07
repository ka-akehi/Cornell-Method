# MVP テストシナリオ（1 項目 1 チェック）

## 位置づけ

このドキュメントは、Cornell Method Notebook MVP の最終検証で使う確認項目です。

MVP では、明示保存、物理削除、手動復習予定、`textarea + Markdown preview`、`/notes` の復習対象フィルタ、`/backup` の手動バックアップを確認対象とします。

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
- [ ] `/notes/[id]` の編集モードで保存すると `PATCH /api/notes/:id` が成功する
- [ ] `/notes/[id]` の編集モードで保存中は保存ボタンが disabled になり `保存中...` が表示される
- [ ] `/notes/[id]` の編集モードで保存 API が失敗した場合、フォーム上部に error alert が表示される
- [ ] `/notes/[id]` の編集保存後に閲覧モードへ戻る
- [ ] `/notes/[id]` の編集モードでキャンセルすると保存せず閲覧モードへ戻る
- [ ] `/notes/[id]` の閲覧モードから復習モードへ切り替えられる
- [ ] `/notes/[id]` の復習モードでは本文が初期状態で非表示になる
- [ ] `/notes/[id]` の復習モードで本文を表示できる
- [ ] `/notes/[id]` の復習モードで表示した本文を再度非表示にできる
- [ ] `/notes/[id]` の復習モードで復習済みにすると `POST /api/notes/:id/review` が成功する
- [ ] `/notes/[id]` の復習済み更新中はボタンが disabled になり `更新中...` が表示される
- [ ] `/notes/[id]` の復習済み更新に失敗した場合に error 状態が表示される
- [ ] `/notes/[id]` の復習済み更新で `reviewedAt` が更新される
- [ ] `/notes/[id]` の復習済み更新で任意の `nextReviewDate` が保存される
- [ ] `/notes/[id]` の復習済み更新で `nextReviewDate` を空にできる
- [ ] `/notes/[id]` で削除操作を選ぶと確認 UI が表示される
- [ ] `/notes/[id]` の削除確認をキャンセルすると削除されない
- [ ] `/notes/[id]` の削除確認を確定すると `DELETE /api/notes/:id` が成功する
- [ ] `/notes/[id]` の削除中は削除ボタンが disabled になり `削除中...` が表示される
- [ ] `/notes/[id]` の削除に失敗した場合に error 状態が表示される
- [ ] `/notes/[id]` の削除成功後に `/notes` へ戻る
- [ ] 存在しない `/notes/[id]` を開くと 404 またはノートなし状態が表示される

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
- [ ] 復習モードの Markdown 表示にも sanitize が効く

## 検証記録

| 日付 | 範囲 | 結果 | 参照 |
| --- | --- | --- | --- |
| 2026-07-05 | MVP 主要 UI フロー: `/` redirect、一覧、新規作成、既存タグ候補選択、自由入力タグ追加、詳細編集保存、復習、検索/日付/タグ filter、削除、バックアップ作成 | PASS | `summary/20260705/mvp-ui-flow-reverification-report.md` |
| 2026-07-05 | API CRUD / review / search / tags / validation / not_found / backup prune | PASS | `summary/20260705/manager-mvp-api-crud-validation-backup-reverification-report.md` |
| 2026-07-05 | Markdown sanitize / checkbox: GFM checkbox 表示、preview checkbox click 後の textarea 値不変、閲覧/復習モードの sanitize | PASS | `summary/20260705/manager-markdown-sanitize-checkbox-verification-report.md` |
| 2026-07-05 | `npm run backup:copy`: 実 DB コピーと最新 3 世代保持 | PASS | `summary/20260705/backup-copy-command-verification-report.md` |
| 2026-07-04〜2026-07-05 | Prisma validate/generate、`npm run lint`、`npm run build` | PASS | `HANDOFF_2026-07-06.md`、`summary/20260705/manager-fix-ui009-note-editor-tag-candidates-summary.md`、`summary/20260705/manager-fix-ui014-edit-save-state-summary.md` |

## Phase 2 / 将来確認

以下は MVP 外です。MVP の必須受け入れ条件としては扱わず、Phase 2 以降の実装時に確認します。

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
