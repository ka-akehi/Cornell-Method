# MVP 画面遷移図

確認日: 2026-06-21

## 位置づけ

このドキュメントは、Cornell Method Notebook MVP の画面遷移を Mermaid flowchart で整理した図別設計書です。

参照元:

- `doc/diagrams/MVP_UML_DESIGN.md`
- `doc/screens/MVP_SCREEN_INVENTORY.md`
- `doc/screens/MVP_SCREEN_DESIGN.md`
- `doc/requirements/MVP_SYSTEM_SPEC.md`

MVP の画面は `/notes`, `/notes/new`, `/notes/[id]`, `/backup` を中心にします。`/tasks/review`, `/notes/backup`, PDF 出力画面、タグ管理画面は Phase 2 とします。

## Main route: root nav notes new detail

```mermaid
%%{init: {"flowchart": {"curve": "linear", "nodeSpacing": 90, "rankSpacing": 110, "htmlLabels": false}, "themeVariables": {"fontSize": "16px"}} }%%
flowchart LR
  classDef primary fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px,color:#111827;
  classDef entry fill:#f8fafc,stroke:#64748b,stroke-width:1.5px,color:#111827;

  subgraph Entry["起点 / 共通ナビ"]
    Root["/"]
    Nav["共通ナビ"]
  end

  subgraph Main["主要導線"]
    Notes["一覧 /notes"]
    New["新規作成 /notes/new"]
    Detail["詳細閲覧 /notes/[id]"]
  end

  Root -->|初期表示| Notes
  Nav -->|一覧| Notes
  Nav -.->|直接作成| New

  Notes -->|新規| New
  New -->|保存成功| Detail
  Notes -->|詳細表示| Detail

  class Root,Nav entry;
  class Notes,New,Detail primary;
```

## Detail modes: view edit review

```mermaid
%%{init: {"flowchart": {"curve": "linear", "nodeSpacing": 90, "rankSpacing": 110, "htmlLabels": false}, "themeVariables": {"fontSize": "16px"}} }%%
flowchart LR
  classDef primary fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px,color:#111827;
  classDef mode fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px,color:#111827;
  classDef action fill:#f8fafc,stroke:#64748b,stroke-width:1.5px,color:#111827;

  Detail["詳細閲覧 /notes/[id]"]
  Edit["編集モード /notes/[id]"]
  Review["復習モード /notes/[id]"]
  Save["保存成功"]
  Cancel["キャンセル"]
  BackToView["閲覧へ戻る"]
  Reviewed["復習済み"]

  Detail -->|編集| Edit
  Edit --> Save --> Detail
  Edit -.-> Cancel -.-> Detail

  Detail -->|復習| Review
  Review --> BackToView --> Detail
  Review -.-> Reviewed -.-> Detail

  class Detail primary;
  class Edit,Review mode;
  class Save,Cancel,BackToView,Reviewed action;
```

## Support routes: backup cancel delete return

```mermaid
%%{init: {"flowchart": {"curve": "linear", "nodeSpacing": 90, "rankSpacing": 110, "htmlLabels": false}, "themeVariables": {"fontSize": "16px"}} }%%
flowchart LR
  classDef primary fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px,color:#111827;
  classDef support fill:#fff7ed,stroke:#ea580c,stroke-width:1.5px,color:#111827;
  classDef entry fill:#f8fafc,stroke:#64748b,stroke-width:1.5px,color:#111827;

  Nav["共通ナビ"]
  Notes["一覧 /notes"]
  New["新規作成 /notes/new"]
  Detail["詳細閲覧 /notes/[id]"]
  Backup["バックアップ /backup"]

  Notes -->|バックアップ確認| Backup
  Backup -.->|戻る| Notes
  Nav -.->|直接確認| Backup
  New -.->|キャンセル| Notes
  Detail -.->|削除成功| Notes

  class Nav entry;
  class Notes,New,Detail primary;
  class Backup support;
```

MVP では `/tasks/review`、`/notes/backup`、PDF 出力画面、タグ管理画面は作りません。復習対象確認は `/notes` のフィルタ、復習操作は `/notes/[id]` の復習モード、バックアップは `/backup` に集約します。
