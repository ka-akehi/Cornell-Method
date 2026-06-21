# MVP シーケンス図

確認日: 2026-06-21

## 位置づけ

このドキュメントは、Cornell Method Notebook MVP の主要操作における UI / API / DB / filesystem の責務境界を Mermaid sequenceDiagram で整理した図別設計書です。

参照元:

- `doc/diagrams/MVP_UML_DESIGN.md`
- `doc/workflows/MVP_WORKFLOW_DESIGN.md`
- `doc/api/MVP_API_DESIGN.md`
- `doc/requirements/MVP_SYSTEM_SPEC.md`

MVP は明示保存、Cue / Tag 関連の全置換、手動復習済み更新、手動バックアップで成立させます。差分更新 API、自動保存、楽観ロック、再試行専用バックアップ API は Phase 2 とします。

## ノート作成

```mermaid
sequenceDiagram
  actor User
  participant UI as NoteNew UI
  participant API as Notes API
  participant DB as Prisma SQLite

  User->>UI: 入力して保存
  UI->>API: POST /api/notes
  API->>API: 入力 validation
  API->>DB: transaction 開始
  API->>DB: Notebook 作成
  API->>DB: Cue 作成
  API->>DB: Tag upsert
  API->>DB: NotebookTag 作成
  DB-->>API: 作成済みノート
  API-->>UI: 201 ノート詳細
  UI-->>User: /notes/[id] を表示
```

## ノート検索

```mermaid
sequenceDiagram
  actor User
  participant List as NotesList
  participant API as Notes API
  participant DB as Prisma SQLite

  User->>List: 検索条件を指定
  List->>API: GET /api/notes?query/tag/from/to
  API->>API: query validation
  API->>DB: Notebook Cue Tag を条件検索
  DB-->>API: 一覧と件数
  API-->>List: 200 page total data
  List-->>User: 検索結果を表示
```

## ノート編集

```mermaid
sequenceDiagram
  actor User
  participant Detail as Detail Edit UI
  participant API as Notes API
  participant DB as Prisma SQLite

  User->>Detail: 編集して保存
  Detail->>API: PATCH /api/notes/:id
  API->>API: 入力 validation
  API->>DB: transaction 開始
  API->>DB: Notebook 更新
  API->>DB: 既存 Cue を削除
  API->>DB: Cue を再作成
  API->>DB: NotebookTag を全置換
  API->>DB: 未登録 Tag を作成
  DB-->>API: 更新後ノート
  API-->>Detail: 200 ノート詳細
  Detail-->>User: 閲覧モードで反映
```

MVP の編集は Cue と Tag 関連を全置換します。差分更新 API と楽観ロックは Phase 2 です。

## 復習済み更新

```mermaid
sequenceDiagram
  actor User
  participant Review as ReviewMode UI
  participant API as Review API
  participant DB as Prisma SQLite

  User->>Review: 復習済みにする
  Review->>API: POST /api/notes/:id/review
  API->>API: 入力 validation
  API->>DB: Notebook を取得
  DB-->>API: 対象ノート
  API->>DB: reviewedAt と nextReviewDate を更新
  DB-->>API: 更新結果
  API-->>Review: 200 review result
  Review-->>User: 復習済み状態を表示
```

## バックアップ作成

```mermaid
sequenceDiagram
  actor User
  participant UI as Backup UI
  participant API as Backup API
  participant Helper as backup helper
  participant FS as filesystem

  User->>UI: バックアップ作成
  UI->>API: POST /api/backups
  API->>Helper: DB コピー実行
  Helper->>FS: SQLite DB を backup へコピー
  Helper->>FS: 古い世代を削除
  FS-->>Helper: 作成結果
  Helper-->>API: backup file path
  API-->>UI: 200 backup result
  UI-->>User: 一覧を更新
```
