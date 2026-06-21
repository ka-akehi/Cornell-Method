# Task Summary: MVP Workflow Design

## Objective

Cornell Method Notebook MVP の実務運用向けに、主要業務フローと操作ワークフローを整理した `doc/MVP_WORKFLOW_DESIGN.md` を作成する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | MVP 業務フロー、操作フロー、判断基準、MVP / Phase 2 境界 |
| 対象ファイル / ディレクトリ | `doc/MVP_WORKFLOW_DESIGN.md` |
| 対象外 | 実装ファイル変更、API / DB / UI 仕様変更、画像図作成 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 既存設計 | `doc/MVP_DATA_DESIGN.md` | MVP データモデル、Phase 2 境界、復習管理の最小仕様 |
| 既存設計 | `doc/MVP_API_DESIGN.md` | API 一覧、保存・削除・復習済み更新・バックアップ仕様 |
| 既存設計 | `doc/MVP_SCREEN_DESIGN.md` | 画面一覧、画面遷移、MVP で扱わない画面・機能 |
| 既存設計 | `doc/MVP_TECHNICAL_DESIGN.md` | ローカル SQLite MVP と Phase 2 デプロイ方針 |
| 既存設計 | `doc/MVP_IMPLEMENTATION_TASKS.md` | 実装分割と MVP の前提 |
| 外部参考 | `/Users/kazuya/Downloads/prompts/docs/miscellaneous/doc/業務フローチャートの作り方.md` | 業務目的、判断点、標準化、属人判断排除の観点 |
| 外部参考 | `/Users/kazuya/Downloads/prompts/docs/miscellaneous/doc/要件定義の基本と実践.md` | 要求の曖昧さ、関係者・業務範囲整理の観点 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `doc/MVP_WORKFLOW_DESIGN.md` | 新規作成。利用者・目的・業務範囲、運用ルール、画面/API対応、代表 Mermaid 図、7 主要フロー、MVP / Phase 2 境界、未決事項、検証観点を記載 | MVP を実務運用で参照できるワークフロー設計として整理するため |
| `summary/20260621/1740-mvp-workflow-design.md` | 本タスクの完了要約を追加 | 次回作業時の再開起点を残すため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | MVP は本文カード分割、自動保存、Undo、専用復習タスクを扱わない | `doc/MVP_DATA_DESIGN.md`, `doc/MVP_SCREEN_DESIGN.md`, `doc/MVP_API_DESIGN.md` |
| F-002 | fact | MVP の復習は `nextReviewDate` と `reviewedAt` を中心に扱う | `doc/MVP_DATA_DESIGN.md`, `doc/MVP_API_DESIGN.md` |
| F-003 | fact | MVP の削除は確認ダイアログ後の物理削除で、Undo は Phase 2 | `doc/MVP_API_DESIGN.md`, `doc/MVP_SCREEN_DESIGN.md` |
| U-001 | unknown | Cue 空行の扱いは UI 自動除外か validation エラーか未確定 | 既存 MVP 資料に明示なし |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 実行済み | 既存の未コミット変更多数を確認 |
| 既存 MVP 設計との整合確認 | 実施 | MVP / Phase 2 境界を既存資料に合わせた |
| 追加文書の内容確認 | 実施 | `sed -n '1,220p' doc/MVP_WORKFLOW_DESIGN.md` で冒頭から構成確認 |
| 作業後 `git status --short` | 実行済み | `doc/MVP_WORKFLOW_DESIGN.md` が未追跡として表示 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| W-001 | Cue の空行を UI で自動除外するか、validation エラーにするか | フォーム実装方針、validation 実装 |
| W-002 | 復習済み更新前に本文表示を必須制御するか | 復習モード UI 実装方針 |
| W-003 | 削除前バックアップを UI 上で推奨表示するか | 削除確認ダイアログ設計 |
| W-004 | バックアップ作成の標準タイミングを README にどこまで明記するか | README 更新タスク |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `doc/MVP_WORKFLOW_DESIGN.md`
- `doc/MVP_SCREEN_DESIGN.md`
- `doc/MVP_API_DESIGN.md`
