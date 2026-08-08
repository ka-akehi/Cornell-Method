# Task Summary

## Objective

製品全体仕様を `AGENTS.md` から分離し、製品方針・ロードマップの正本を `doc/requirements/PRODUCT_SPEC.md` に移した。現行 MVP の実装・受け入れ契約と、詳細設計・履歴資料の役割を参照関係として整理した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | 要件書・実装契約・設計書の正本参照整理 |
| 対象ファイル / ディレクトリ | `AGENTS.md`、`doc/requirements/PRODUCT_SPEC.md`、`doc/README.md`、指定された現行設計書・履歴資料 |
| 対象外 | コード、設定、依存関係、lockfile、Prisma schema / migration、API、テスト、生成物、queue state |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 作業指示 | `AGENTS.md`、最新 task 指示 | 文書責務、保護対象、検証条件 |
| 引き継ぎ | `HANDOFF_2026-08-08.md` | 現在の worktree、local-first 方針、Next Read |
| 直前 summary | `summary/20260808/0517-document-mac-desktop-local-first-architecture-20260808-a1c9e4-160ca0f4-summary.md` | Mac desktop / local-first 更新の変更対象と残存 unknown |
| 現行契約・設計 | `doc/requirements/MVP_SYSTEM_SPEC.md`、`doc/implementation/MVP_CONTRACT.md`、`doc/technical/*` ほか | MVP の現在の意味と詳細設計への委譲先 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `AGENTS.md` | 詳細な Application Specification を削除し、運用指示、正本一覧、短い製品境界へ整理 | エージェント指示と製品仕様の責務分離 |
| `doc/requirements/PRODUCT_SPEC.md` | 製品概要、製品原則、MVP / Phase 2 / 将来構想、機能マップ、Mac desktop / local-first 保存境界、非目標、未決事項、詳細書リンクを新規作成 | 製品全体仕様・ロードマップの新しい正本 |
| `doc/README.md`、`doc/requirements/MVP_SYSTEM_SPEC.md` | Primary Entry Points と役割分担を更新 | Product Spec、MVP 要件、MVP 契約の関係を明示 |
| `doc/implementation/MVP_CONTRACT.md`、`doc/implementation/IMPLEMENTATION_STATUS.md`、`doc/testing/TEST_SCENARIOS.md` | 製品ロードマップの参照を Product Spec、MVP 受け入れ根拠を MVP Contract へ更新 | 現行 MVP と将来機能の混同を防止 |
| `doc/technical/MVP_DESIGN_TOOLING_GUIDE.md`、`doc/screens/NTE_020_NEW_NOTE_LAYOUT_POLICY.md` | 現行の正本参照を更新 | 製品方針と MVP 契約の参照先を明示 |
| `doc/requirements/MVP_CLASSIFICATION_DRAFT.md`、`doc/review/DESIGN_REVIEW_PLAN.md` | 作成時点の `AGENTS.md` 参照を履歴として保持し、現在の正本注記を追加 | 過去の分類・レビュー結果を再編集しないため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 現行 MVP は明示保存、手動 SQLite backup、確認後の物理削除であり、自動保存・Undo・専用復習タスク等は Phase 2 境界にある。 | `doc/implementation/MVP_CONTRACT.md` |
| F-002 | fact | Mac desktop / local-first 方針、`app bundle` と `user data directory` の分離、SQLite 正本 + file export の段階導入を Product Spec に保持した。 | `doc/requirements/PRODUCT_SPEC.md`、`doc/technical/MVP_TECHNICAL_DESIGN.md` |
| F-003 | fact | `doc/review/AS_IS_DESIGN_INVENTORY.md` の外部 `AGENTS.md` 参照は As-Is 履歴の入力資料であり、現行正本を示す参照ではないため変更していない。 | 同ファイル §位置づけ・履歴注記 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `git status --short` | 完了 | 文書変更と新規 Product Spec / summary のみ。保護対象の data / technical 文書、コード、設定には追加変更なし |
| `git diff --check` | PASS | 空白エラーなし |
| `rg -n -i "AGENTS\\.md|PRODUCT_SPEC|製品全体仕様|製品仕様|Application Specification|MVP_CONTRACT" AGENTS.md doc README.md` | 完了 | 現行正本は Product Spec、MVP 受け入れは MVP Contract と読める。残る AGENTS 参照は履歴資料または repository instructions |
| 対象ファイル存在確認 | PASS | 指定された現行・履歴資料と新規 Product Spec を確認 |
| `git diff --name-only` | 完了 | 変更対象は文書のみ。コード、設定、Prisma、API、テスト、生成物は含まれない |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | Desktop shell、具体的な user data / workspace path、SQLite-only と hybrid の切替条件、export / import 契約は未決定。 | Desktop PoC と別途の export / migration 設計 |
| U-002 | Apple Silicon / Intel の署名・更新、Prisma / SQLite native runtime、Playwright / Chromium 同梱の検証は未実施。 | Desktop 配布・署名・更新 PoC |

## Next Read

- `summary/20260808/0551-separate-product-spec-from-agents-20260808-summary.md`
- `HANDOFF_2026-08-08.md`
- `doc/requirements/PRODUCT_SPEC.md`
- `doc/implementation/MVP_CONTRACT.md`
