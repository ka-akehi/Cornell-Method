# MVP UML / Mermaid 設計 Index

確認日: 2026-06-21

## 位置づけ

このドキュメントは、Cornell Method Notebook MVP の UML / Mermaid 図への入口です。

発注者指摘により、図本体は種類ごとの設計書へ分割して管理します。既存参照の入口を壊さないため、このファイルは index / 目次として残します。

詳細な要件は以下を正とします。

- `doc/requirements/MVP_SYSTEM_SPEC.md`
- `doc/workflows/MVP_WORKFLOW_DESIGN.md`
- `doc/screens/MVP_SCREEN_INVENTORY.md`
- `doc/screens/MVP_SCREEN_DESIGN.md`
- `doc/api/MVP_API_DESIGN.md`
- `doc/data/MVP_DATA_DESIGN.md`

MVP は `Notebook`, `Cue`, `Tag`, `NotebookTag` を中心に、明示保存、物理削除、手動復習予定、手動バックアップで成立させます。`NoteCard`, `NotebookDraftState`, `NotebookReviewProgress`, `SoftDeleteBuffer`, `BackupLog`, PDF 出力、専用復習タスク画面は Phase 2 とします。

## 図別設計書

| 図種別 | 設計書 | 内容 |
| --- | --- | --- |
| 業務フロー図 | `doc/diagrams/MVP_BUSINESS_FLOW_DIAGRAMS.md` | 学習記録作成、検索・閲覧、復習、削除、バックアップ |
| シーケンス図 | `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md` | ノート作成、ノート検索、ノート編集、復習済み更新、バックアップ作成 |
| 状態遷移図 | `doc/diagrams/MVP_STATE_DIAGRAMS.md` | 詳細画面モード、ノート復習状態 |
| データ関係図 | `doc/diagrams/MVP_ER_DIAGRAM.md` | Notebook / Cue / Tag / NotebookTag、MVP 外エンティティ注記 |
| 画面遷移図 | `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md` | `/notes`, `/notes/new`, `/notes/[id]`, `/backup` |

## 参照の使い分け

- 業務上の操作順序と判断分岐は `doc/workflows/MVP_WORKFLOW_DESIGN.md` を正とします。
- 画面単位の Action / Data と API 対応は `doc/screens/MVP_SCREEN_INVENTORY.md` を正とします。
- データ項目と採用 / 非採用エンティティは `doc/data/MVP_DATA_DESIGN.md` を正とします。
- API request / response とエラー仕様は `doc/api/MVP_API_DESIGN.md` を正とします。
- Mermaid 図で UI / API / DB の責務境界を確認する場合は、上記の図別設計書を参照します。
- Mermaid の記法確認や外部 live preview の使い方は `doc/technical/MVP_DESIGN_TOOLING_GUIDE.md` を参照します。
