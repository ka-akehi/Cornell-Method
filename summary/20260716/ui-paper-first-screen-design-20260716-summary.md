---
summary_type: task-summary
created_at: 2026-07-16 JST
task_kind: worker-task
task_status: done
---

## Objective

現行 MVP の機能契約を変えずに、ノート画面を「紙面を中心にした学習ノート」へ方向転換する目標 UI、実装境界、後続 task、QA 証跡の扱いを画面設計書へ反映した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | 紙面中心 UI の画面設計・画面棚卸し |
| 対象ファイル / ディレクトリ | `doc/screens/MVP_SCREEN_DESIGN.md`, `doc/screens/MVP_SCREEN_INVENTORY.md` |
| 対象外 | コード、設定、依存関係、Prisma / SQLite、API、UI component、テストコード、画像、生成物。新しい補助設計書は作成していない |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 契約 | `doc/implementation/MVP_CONTRACT.md` | canonical route、API、1 本の本文、明示保存、手動復習、確認後の物理削除、Markdown 契約 |
| 引き継ぎ | `HANDOFF_2026-07-16.md` | 既存 NTE-020 / NTE-030 runtime 証跡、未確認範囲、MVP と Phase 2 の境界 |
| 現行 UI | `src/app/notes/_components/note-editor.tsx` | 基本情報 / Cornell / Summary のカード縦積み、本文 `desktop-split`、保存操作 |
| 現行 UI | `src/app/notes/_components/note-detail-modes.tsx` | 詳細 Section、閲覧 / 編集 / 復習シェル、本文マスク、Summary の現状配置 |
| Markdown | `src/shared/markdown/markdown-field.tsx` | `stacked` / `desktop-split`、GFM、sanitize、checkbox 表示専用 |
| 証跡 | `doc/testing/TEST_SCENARIOS.md` | NTE-020 / NTE-030 の旧 layout screenshot、viewport、PASS / 未実施の記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `doc/screens/MVP_SCREEN_DESIGN.md` | 紙面コンセプト、情報階層、タイトル常時表示範囲、基本情報の圧縮 / 概要開閉、Cue 28〜32% / 本文 68〜72%、本文 Preview 縦並び、Summary と操作配置、responsive 受け入れ、契約境界、`UI-PAPER-001`〜`QA-PAPER-001` の依存順、旧証跡の再取得条件を追加・整理 | 後続 coding Worker が To-Be と As-Is を混同せず着手できるようにするため |
| `doc/screens/MVP_SCREEN_INVENTORY.md` | As-Is / To-Be の棚卸し基準、共通レイアウト契約、実装境界、task 分割、旧 screenshot の扱いを追加し、SCR-002〜004 の layout / 操作配置を目標 UI に追従 | 画面ごとの Action / Data と目標レイアウトの対応を明確にするため |
| `summary/20260716/ui-paper-first-screen-design-20260716-summary.md` | 完了要約、設計判断、検証結果、最小 Next Read を記録 | 次回 Worker が raw log を再読せず再開できるようにするため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 現行 `NoteEditor` は大きな Section カードを縦積みし、本文の `MarkdownField` は `desktop-split` を利用している。 | 指定 source の読み取り |
| F-002 | fact | 現行 MVP 契約は UI レイアウトと独立しており、本文は 1 本、Cue はリスト、保存・復習・削除方式は維持すべきである。 | `MVP_CONTRACT.md` |
| F-003 | fact | 既存 NTE-020 / NTE-030 screenshot は旧 layout の証跡であり、目標 UI 実装後の runtime 確認を代替しない。 | `HANDOFF_2026-07-16.md`, `TEST_SCENARIOS.md` |
| F-004 | fact | 目標 UI は一枚の紙面、本文主役、本文 textarea → Preview の縦並び、Summary の復習時初期非表示を採用した。 | 更新した設計書 |
| U-001 | unknown | 目標 UI 実装後の 375 / 768 / 1280 / 1440px runtime、本文幅、overflow、操作到達性は未確認である。 | 新レイアウト未実装 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 成功 | 出力なし。開始時の作業ツリーは clean |
| 作業後 `git status --short` | 成功 | 設計書 2 件と本 summary のみ変更 |
| `git diff --check` | 成功 | whitespace error なし |
| Markdown 見出し確認 | 成功 | 対象 2 設計書の見出し階層を確認 |
| 追加・変更リンクの参照先確認 | 成功 | MVP 契約、旧 screenshot、`TEST_SCENARIOS.md` の存在を確認 |
| `npm run lint` / `npm run build` | 未実施 | コード変更のない設計 task のため |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 紙面中心 UI の実画面がまだ存在しない | `UI-PAPER-001`〜`UI-PAPER-004` 実装後の runtime QA |
| U-002 | 旧 screenshot の PASS は新レイアウトの PASS ではない | `QA-PAPER-001` で viewport / mode / fixture を記録した再取得証跡 |

## Next Read

次の UI Worker は以下を最小順で読む。

- `doc/implementation/MVP_CONTRACT.md`
- `doc/screens/MVP_SCREEN_DESIGN.md` の「目標コンセプト」「現行 MVP 契約を変更しない実装境界」「後続 coding task の分割と依存順」
- `doc/screens/MVP_SCREEN_INVENTORY.md` の「紙面中心 UI の棚卸し基準」「現行 MVP 契約と UI 実装境界」「後続 task と依存順」
- `src/app/notes/_components/note-editor.tsx`
- `src/app/notes/_components/note-detail-modes.tsx`
- `src/shared/markdown/markdown-field.tsx`

最初の coding task は `UI-PAPER-001` 共通紙面シェル。API / DB は変更しない。
