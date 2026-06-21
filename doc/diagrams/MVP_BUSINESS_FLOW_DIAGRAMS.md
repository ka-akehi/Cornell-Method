# MVP 業務フロー図

確認日: 2026-06-21

## 位置づけ

このドキュメントは、Cornell Method Notebook MVP の主要業務フローを Mermaid で整理した図別設計書です。

参照元:

- `doc/diagrams/MVP_UML_DESIGN.md`
- `doc/workflows/MVP_WORKFLOW_DESIGN.md`
- `doc/requirements/MVP_SYSTEM_SPEC.md`

MVP は `Notebook`, `Cue`, `Tag`, `NotebookTag` を中心に、明示保存、物理削除、手動復習予定、手動バックアップで成立させます。自動保存、Undo、専用復習タスク画面、PDF 出力は Phase 2 とします。

## 学習記録作成

```mermaid
flowchart TD
  Start["学習内容を記録する"] --> OpenNew["/notes/new を開く"]
  OpenNew --> LoadTags["タグ候補を取得"]
  LoadTags --> Input["タイトル 学習日 Cue 本文 サマリーを入力"]
  Input --> SetReview{"復習予定を設定するか"}
  SetReview -- "設定する" --> InputReview["nextReviewDate を入力"]
  SetReview -- "設定しない" --> Save["保存"]
  InputReview --> Save
  Save --> Validate{"入力は有効か"}
  Validate -- "有効" --> Persist["Notebook Cue Tag NotebookTag を保存"]
  Validate -- "不正" --> ShowError["入力エラーを表示"]
  ShowError --> Input
  Persist --> Detail["/notes/[id] 閲覧モードへ遷移"]
```

MVP では作成時に自動保存やドラフトを持ちません。保存ボタンで確定し、未登録タグは保存時に自動作成します。

## 検索・閲覧

```mermaid
flowchart TD
  Start["過去ノートを探す"] --> OpenList["/notes を開く"]
  OpenList --> SetFilters["検索語 日付 タグ 復習対象を指定"]
  SetFilters --> Fetch["GET /api/notes"]
  Fetch --> HasResult{"結果があるか"}
  HasResult -- "ある" --> Select["ノートを選択"]
  HasResult -- "ない" --> Empty["空状態を表示"]
  Empty --> SetFilters
  Select --> LoadDetail["GET /api/notes/:id"]
  LoadDetail --> View["/notes/[id] 閲覧モードで表示"]
```

検索は参照のみで DB を更新しません。タグは OR 条件、並び順は `noteDate desc, updatedAt desc` 固定です。

## 復習

```mermaid
flowchart TD
  Start["復習を開始"] --> List["/notes を開く"]
  List --> DueFilter["reviewDue を有効化"]
  DueFilter --> FetchDue["GET /api/notes?reviewDue=true"]
  FetchDue --> Exists{"復習対象があるか"}
  Exists -- "ない" --> Done["復習対象なし"]
  Exists -- "ある" --> Detail["対象ノートを開く"]
  Detail --> ReviewMode["復習モードへ切替"]
  ReviewMode --> Recall["Cue とサマリーで想起"]
  Recall --> ShowBody["本文を表示して確認"]
  ShowBody --> SetNext["次回復習日を任意入力"]
  SetNext --> Mark["復習済みにする"]
  Mark --> Update["reviewedAt と nextReviewDate を更新"]
  Update --> View["閲覧モードへ戻る"]
```

MVP の復習は `Notebook.reviewedAt` と `Notebook.nextReviewDate` のみで管理します。1日後 / 1週間後タスクや復習進捗テーブルは Phase 2 です。

## 削除

```mermaid
flowchart TD
  Start["詳細画面を確認"] --> ClickDelete["削除を選択"]
  ClickDelete --> Confirm{"削除を確定するか"}
  Confirm -- "キャンセル" --> Keep["閲覧モードへ戻る"]
  Confirm -- "確定" --> NeedBackup{"削除前バックアップが必要か"}
  NeedBackup -- "必要" --> Backup["/backup でバックアップ作成"]
  NeedBackup -- "不要" --> Delete["DELETE /api/notes/:id"]
  Backup --> Delete
  Delete --> Deleted["物理削除完了"]
  Deleted --> Notes["/notes へ戻る"]
```

MVP は確認ダイアログ後に物理削除します。ソフトデリート、Undo Snackbar、`SoftDeleteBuffer` は Phase 2 です。

## バックアップ

```mermaid
flowchart TD
  Start["バックアップを確認"] --> OpenBackup["/backup を開く"]
  OpenBackup --> FetchList["GET /api/backups"]
  FetchList --> ShowList["最新バックアップ一覧を表示"]
  ShowList --> Create{"新規作成するか"}
  Create -- "作成する" --> Post["POST /api/backups"]
  Create -- "作成しない" --> Done["確認終了"]
  Post --> Copy["SQLite DB ファイルを backup 配下へコピー"]
  Copy --> Rotate["最新 3 世代だけ保持"]
  Rotate --> Refresh["一覧を再取得"]
  Refresh --> ShowList
```

MVP はファイルコピーと最新 3 世代保持のみを扱います。DB 管理のバックアップログ、再試行専用 API、自動復元は Phase 2 です。
