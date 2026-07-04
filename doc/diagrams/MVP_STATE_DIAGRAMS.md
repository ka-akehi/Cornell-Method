# MVP 状態遷移図

確認日: 2026-06-21

## 位置づけ

このドキュメントは、Cornell Method Notebook MVP の主要状態を Mermaid flowchart で整理した図別設計書です。

参照元:

- `doc/diagrams/MVP_UML_DESIGN.md`
- `doc/screens/MVP_SCREEN_INVENTORY.md`
- `doc/workflows/MVP_WORKFLOW_DESIGN.md`
- `doc/requirements/MVP_SYSTEM_SPEC.md`

MVP の詳細画面は閲覧、編集、復習、削除確認を同一詳細画面内の状態として扱います。読みやすさのため、通常モード遷移、削除遷移、エラー復帰遷移は図を分けて示します。削除 Undo、自動保存停止、409 競合、復習タスク進捗テーブルは Phase 2 とします。

## 詳細画面モード normal mode transitions

```mermaid
flowchart LR
  Start((開始)) -->|取得成功| viewing[閲覧]

  viewing -->|編集| editing[編集]
  editing --> edit_exit{編集終了}
  edit_exit -->|保存成功| return_viewing[閲覧へ戻る]
  edit_exit -->|キャンセル| return_viewing

  viewing -->|復習| reviewing[復習]
  reviewing --> review_exit{復習終了}
  review_exit -->|戻る| return_viewing
  review_exit -->|更新成功| return_viewing
```

通常操作では閲覧を起点に編集または復習へ入り、保存成功、キャンセル、戻る、更新成功で閲覧へ戻ります。

## 詳細画面モード delete transitions

```mermaid
flowchart LR
  Start((開始)) -->|取得成功| viewing[閲覧]
  viewing -->|削除| deleting[削除確認]

  deleting -->|キャンセル| cancel[削除をやめる]
  cancel --> return_viewing[閲覧へ戻る]

  deleting -->|削除成功| deleted[削除済み]
  deleted --> End((終了))

  deleting -->|削除失敗| error[エラー]
```

削除系では、閲覧から削除確認へ入り、キャンセルで閲覧へ戻ります。MVP では deleted からの復元遷移はありません。Undo による復元は Phase 2 です。

## 詳細画面モード error recovery transitions

```mermaid
flowchart LR
  Start((開始)) --> load{初期取得}
  load -->|取得失敗| error[エラー]
  load -->|取得成功| viewing[閲覧]

  viewing --> operation{失敗した操作}

  operation --> view_error[閲覧 API エラー]
  operation --> edit_error[編集 保存失敗]
  operation --> review_error[復習 更新失敗]
  operation --> delete_error[削除確認 削除失敗]

  view_error --> error
  edit_error --> error
  review_error --> error
  delete_error --> error

  error -->|再取得| retry[再取得]
  retry --> return_viewing[閲覧へ戻る]
```

エラー復帰系では、各操作状態から API 失敗でエラーへ入り、再取得成功で閲覧へ戻ります。

## ノート復習状態

```mermaid
flowchart TD
  Start((開始)) --> initial{初期状態}
  initial -->|予定なし| no_schedule[復習予定なし]
  initial -->|予定あり| scheduled[復習予定あり]
  initial -->|期限到来| due[復習期限到来]

  no_schedule -->|設定| scheduled
  scheduled -->|日付到来| due
  scheduled -->|クリア| cleared[復習予定なしへ戻る]

  due -->|復習済み| reviewed[復習済み]
  reviewed --> next_plan{保存後の予定}
  next_plan -->|予定なしで保存| saved_no_schedule[復習予定なしへ戻る]
  next_plan -->|設定| saved_scheduled[復習予定ありへ戻る]
```

`reviewed` は `reviewedAt` が更新された直後の状態を表します。MVP では復習履歴を複数件保持せず、最新の `reviewedAt` のみを保存します。
