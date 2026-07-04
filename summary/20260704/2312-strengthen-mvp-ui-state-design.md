# MVP UI State Design Detail Summary

## Objective

MVP 4 画面（`/notes`, `/notes/new`, `/notes/[id]`, `/backup`）について、Worker が UI 実装や検証で迷わないように、画面別の表示項目、操作、validation、button disabled 条件、loading/error/empty、成功時挙動を既存ドキュメントへ補強した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | MVP 画面詳細設計、MVP 画面棚卸し、MVP テスト観点 |
| 対象ファイル / ディレクトリ | `doc/screens/MVP_SCREEN_DESIGN.md`, `doc/screens/MVP_SCREEN_INVENTORY.md`, `doc/testing/TEST_SCENARIOS.md` |
| 対象外 | アプリコード、設定、依存関係、生成物、自動保存、Undo、D&D、`/tasks/review`, PDF export、高機能 Markdown editor |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 状況 | `CURRENT_STATUS.md` | MVP と最終仕様の差分、現コードで確認できる実装範囲 |
| 仕様 | `doc/requirements/MVP_SYSTEM_SPEC.md` | MVP 対象画面、Phase 2 境界、主要業務フロー |
| 画面設計 | `doc/screens/MVP_SCREEN_DESIGN.md` | 既存の画面一覧、表示要素、主要アクション |
| 画面棚卸し | `doc/screens/MVP_SCREEN_INVENTORY.md` | 既存の Action / Data、API 対応 |
| テスト | `doc/testing/TEST_SCENARIOS.md` | MVP 検証項目、Phase 2 分離 |
| 現コード | `src/app/notes/_components/notes-list.tsx` | 一覧の検索、タグ、loading/error/empty、disabled 条件 |
| 現コード | `src/app/notes/_components/note-editor.tsx` | 作成/編集フォーム、validation 表示、保存中、タグ/Cue、成功時遷移 |
| 現コード | `src/app/notes/_components/note-detail-modes.tsx` | 閲覧/編集/復習モード、削除、復習済み更新、empty 表示 |
| 現コード | `src/app/backup/page.tsx` | バックアップ一覧、作成、loading/error/empty/success、disabled 条件 |
| 現コード | `src/app/notes/[id]/page.tsx`, `src/app/layout.tsx`, `src/app/notes/_components/markdown-field.tsx`, `src/lib/validation.ts` | 詳細取得失敗、共通ナビ、Markdown preview、エラー文言 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `doc/screens/MVP_SCREEN_DESIGN.md` | `/notes`, `/notes/new`, `/notes/[id]`, `/backup` の UI 状態詳細を追加 | 画面ごとの validation、disabled、loading/error/empty、保存/削除/復習済み更新/バックアップ作成の成功時挙動を明文化するため |
| `doc/screens/MVP_SCREEN_INVENTORY.md` | 各 MVP 画面に `UI State / Conditions` 表を追加 | 実装・テスト分割時に Action / Data と UI 状態条件を同じ棚卸しで参照できるようにするため |
| `doc/testing/TEST_SCENARIOS.md` | 保存中、一覧取得中、ページャ、復習済み更新中、削除中、バックアップ作成中、成功メッセージ等の UI 確認項目を追加 | 補強した UI 詳細設計と MVP 検証項目を同期するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 現コードの MVP 画面は `/notes`, `/notes/new`, `/notes/[id]`, `/backup` に集中している。 | `src/app/**` |
| F-002 | fact | MVP は `textarea + Markdown preview`、明示保存、物理削除、詳細内復習モード、手動バックアップを前提にしている。 | `CURRENT_STATUS.md`, `doc/testing/TEST_SCENARIOS.md`, 現コード |
| F-003 | fact | 自動保存、Undo、D&D、`/tasks/review`、PDF export、高機能 Markdown editor は MVP 外として扱う必要がある。 | `doc/requirements/MVP_SYSTEM_SPEC.md`, `doc/testing/TEST_SCENARIOS.md` |
| A-001 | assumption | 詳細取得中の専用 loading UI は MVP 必須にせず App Router に委譲する。 | 現コードにページ専用 loading UI がないため |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 実行済み | 既存の未コミット変更が多数あったため戻していない |
| 対象コード参照 | 実行済み | MVP 4 画面の現コードを最小限確認 |
| ドキュメント差分確認 | 実行済み | `git diff -- doc/screens/MVP_SCREEN_DESIGN.md doc/screens/MVP_SCREEN_INVENTORY.md doc/testing/TEST_SCENARIOS.md` |
| 作業後 `git status --short` | 実行済み | 対象 3 ファイルと本 summary が変更/追加。既存の他変更は未操作 |
| `npm run lint` / `npm run build` | 未実行 | ドキュメントのみの変更であり、アプリコード・設定・依存関係は変更していないため |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 既存の未コミット変更のうち、他 Worker の変更内容との最終的な整合 | 各変更ファイルの担当 task summary と最終レビュー |
| U-002 | 編集保存後に現コードが完全に閲覧モードへ戻るかの実挙動 | ブラウザまたは E2E での実操作確認 |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `summary/20260704/2312-strengthen-mvp-ui-state-design.md`
- `doc/screens/MVP_SCREEN_DESIGN.md`
- `doc/screens/MVP_SCREEN_INVENTORY.md`
- `doc/testing/TEST_SCENARIOS.md`
