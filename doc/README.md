# Documentation Index

Cornell Method Notebook の設計書、仕様書、テスト観点、設計運用資料を分類した索引です。

## Categories

| ディレクトリ | 用途 | 主なファイル |
| --- | --- | --- |
| `requirements/` | 製品全体方針、要件、MVP スコープ、仕様レビュー、分類判断 | `PRODUCT_SPEC.md`, `MVP_SYSTEM_SPEC.md`, `CORNELL_METHOD_SPEC_REVIEW.md`, `MVP_CLASSIFICATION_DRAFT.md` |
| `workflows/` | 業務フロー、利用者操作、運用ルール | `MVP_WORKFLOW_DESIGN.md` |
| `screens/` | 画面設計、画面棚卸し、Action / Data、低忠実度ワイヤフレーム、PNG 画像ワイヤフレーム、画面補助モック | `MVP_SCREEN_DESIGN.md`, `MVP_SCREEN_INVENTORY.md`, `MVP_UI_WIREFRAMES.md`, `assets/mockups/` |
| `api/` | API 仕様、request / response、エラー仕様 | `MVP_API_DESIGN.md` |
| `data/` | データモデル、エンティティ、検索要件 | `MVP_DATA_DESIGN.md` |
| `technical/` | 技術設計、設計ツール運用、非機能に近い技術方針 | `MVP_TECHNICAL_DESIGN.md`, `TARGET_ARCHITECTURE.md`, `MVP_DESIGN_TOOLING_GUIDE.md` |
| `diagrams/` | UML / Mermaid 図、画面遷移、ER、状態遷移、シーケンス、SVG 表示成果物 | `MVP_UML_DESIGN.md`, `MVP_*_DIAGRAM*.md`, `assets/mmd/`, `assets/svg/` |
| `testing/` | テスト観点、受け入れ条件、手動確認観点 | `TEST_SCENARIOS.md` |
| `implementation/` | 現行 MVP 契約、実装状況、実装タスク分割、Post-MVP 計画 | `MVP_CONTRACT.md`, `IMPLEMENTATION_STATUS.md`, `MVP_IMPLEMENTATION_TASKS.md`, `POST_MVP_IMPLEMENTATION_PLAN.md` |
| `review/` | As-Is 棚卸し、設計レビュー計画、移行判断資料、UI 設計成果物レビュー | `AS_IS_DESIGN_INVENTORY.md`, `DESIGN_REVIEW_PLAN.md`, `MVP_UI_DESIGN_ARTIFACT_GAP_REVIEW.md`, `MVP_SCREENSHOT_WIREFRAME_LAYOUT_REVIEW.md` |
| `designs/` | 個別機能の技術設計・段階導入提案 | `CANVAS_PARTIAL_ERASER_DESIGN.md`, `CANVAS_TOOLBAR_DESIGN.md` |
| `design-studio/` | Google Stitch / Claude Design 風の設計運用、テンプレート | `README.md`, `templates/` |

## Primary Entry Points

- 製品全体仕様・ロードマップ: `requirements/PRODUCT_SPEC.md`
- MVP 仕様: `requirements/MVP_SYSTEM_SPEC.md`
- 業務フロー: `workflows/MVP_WORKFLOW_DESIGN.md`
- 画面設計: `screens/MVP_SCREEN_DESIGN.md`
- 画面棚卸し: `screens/MVP_SCREEN_INVENTORY.md`
- UI ワイヤフレーム: `screens/MVP_UI_WIREFRAMES.md`
- NTE-020 レイアウト方針: `screens/NTE_020_NEW_NOTE_LAYOUT_POLICY.md`
- API 設計: `api/MVP_API_DESIGN.md`
- データ設計: `data/MVP_DATA_DESIGN.md`
- ターゲットアーキテクチャ: `technical/TARGET_ARCHITECTURE.md`
- 図の入口: `diagrams/MVP_UML_DESIGN.md`
- テスト観点: `testing/TEST_SCENARIOS.md`
- 現行 MVP 契約: `implementation/MVP_CONTRACT.md`
- 実装状況: `implementation/IMPLEMENTATION_STATUS.md`
- Post-MVP 依存関係付き実装計画: `implementation/POST_MVP_IMPLEMENTATION_PLAN.md`
- Canvas 部分消去設計: `designs/CANVAS_PARTIAL_ERASER_DESIGN.md`
- Canvas ツールバー設計: `designs/CANVAS_TOOLBAR_DESIGN.md`

## Rules

- 新しい設計書は、目的に合うカテゴリへ追加します。
- UML、ER、状態遷移、シーケンスなどの図は `diagrams/`、業務フローは `workflows/`、画面設計は `screens/` へ置きます。Markdown / Mermaid の配置先は資料の目的に合わせます。
- Mermaid 図は、該当カテゴリの `assets/mmd/` と `assets/svg/` に生成し、視覚確認できる状態にします。
- `requirements/PRODUCT_SPEC.md` は製品全体の仕様・ロードマップの正本です。`requirements/MVP_SYSTEM_SPEC.md` は現行 MVP の業務・機能要件、`implementation/MVP_CONTRACT.md` は現行 MVP の実装・受け入れ判断の正本です。詳細書は現行 MVP 契約に従い、`AGENTS.md` はエージェントの作業指示と正本一覧を担います。
