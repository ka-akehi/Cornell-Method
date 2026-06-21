# MVP 実装タスク分割案

確認日: 2026-06-15

## 位置づけ

このドキュメントは、フルリニューアル版 Cornell Method Notebook の MVP を Worker タスクへ分割するための計画です。

設計済みドキュメント:

- `doc/MVP_DATA_DESIGN.md`
- `doc/MVP_SCREEN_DESIGN.md`
- `doc/MVP_API_DESIGN.md`
- `doc/MVP_TECHNICAL_DESIGN.md`

## 分割方針

- 1 Worker タスクは 1 目的に絞る。
- DB / validation / API を先に固め、UI はその後に実装する。
- UI は画面単位ではなく、共通フォームやMarkdown表示などの再利用単位を先に作る。
- 各タスクの完了条件には、実行すべき検証コマンドを含める。
- Worker が追加質問なしで着手できる粒度まで、Manager が仕様を明記する。

## 重要な分岐点

### 何を決める必要があるか

実装順序を「UI先行」にするか「DB/API先行」にするか。

### 選択肢

| 選択肢 | 内容 |
| --- | --- |
| A: DB/API先行 | Prisma schema、validation、APIを先に作り、UIはAPIに合わせる |
| B: UI先行 | 画面モックとフォームを先に作り、後からAPIを接続する |

### 影響

| 観点 | A: DB/API先行 | B: UI先行 |
| --- | --- | --- |
| データ整合性 | 高い | 後で調整が発生しやすい |
| UI確認の早さ | 遅い | 早い |
| Worker分割 | API/UIで分けやすい | UIが仮実装を持ちやすい |
| 手戻り | 少なめ | API接続時に増えやすい |

### Manager 推奨

**A: DB/API先行** を推奨します。

理由:

- MVP はデータ構造がすでに明確。
- Note / Cue / Tag / Review の保存仕様が画面の土台になる。
- UI を先に作ると、後から保存形式に合わせてフォームを作り直す可能性がある。

## タスク一覧

| 順序 | キュー | タスクID | 目的 |
| ---: | --- | --- | --- |
| 1 | `tasks-api` | `mvp-prisma-schema` | MVPデータ設計に合わせてPrisma schemaを再設計する |
| 2 | `tasks-api` | `mvp-validation-schemas` | Zod validationと共通型を定義する |
| 3 | `tasks-api` | `mvp-notes-api` | ノート CRUD / 検索 / 復習済みAPIを実装する |
| 4 | `tasks-api` | `mvp-tags-api` | タグ候補APIを実装する |
| 5 | `tasks-api` | `mvp-backup-api` | バックアップ一覧・作成APIとスクリプトを実装する |
| 6 | `tasks-ui` | `mvp-layout-navigation` | 共通レイアウトとナビゲーションを実装する |
| 7 | `tasks-ui` | `mvp-markdown-preview` | textarea + Markdown preview コンポーネントを実装する |
| 8 | `tasks-ui` | `mvp-note-form` | 作成・編集共通のノートフォームを実装する |
| 9 | `tasks-ui` | `mvp-notes-list` | ノート一覧、検索、復習対象フィルタを実装する |
| 10 | `tasks-ui` | `mvp-note-detail-modes` | 閲覧・編集・復習モードを実装する |
| 11 | `tasks-ui` | `mvp-backup-screen` | バックアップ画面を実装する |
| 12 | `tasks` | `mvp-test-scenarios-update` | TEST_SCENARIOSをMVP仕様へ更新する |
| 13 | `tasks` | `mvp-readme-update` | READMEにセットアップ、DB、バックアップ手順を追記する |
| 14 | `tasks` | `mvp-final-verification` | lint/build/migrateと主要フロー確認を実施する |

## タスク詳細

### 1. `mvp-prisma-schema`

キュー: `codex-queue/tasks-api`

目的:

- `doc/MVP_DATA_DESIGN.md` に合わせて Prisma schema を再設計する。

対象:

- `prisma/schema.prisma`

作業内容:

- `Notebook`, `Cue`, `Tag`, `NotebookTag` を定義する。
- MVP外の `NoteCard`, `NoteCueLink`, `NotebookDraftState`, `NotebookReviewProgress`, `SoftDeleteBuffer`, `BackupLog` は削除または未採用にする。
- SQLite / Prisma の migration 前提で整える。

完了条件:

- `npm run prisma:generate` が成功する。
- 必要なら `npm run prisma:migrate` が成功する。

### 2. `mvp-validation-schemas`

キュー: `codex-queue/tasks-api`

目的:

- APIとUIで共有できる入力 validation を作る。

対象:

- `src/lib/validation/*`
- 必要に応じて `src/lib/types/*`

作業内容:

- Notebook input schema を定義する。
- Cue schema を定義する。
- Tag schema を定義する。
- API error helper を用意する。

完了条件:

- `npm run lint` が成功する。
- `npm run build` が成功する。

### 3. `mvp-notes-api`

キュー: `codex-queue/tasks-api`

目的:

- `doc/MVP_API_DESIGN.md` のノートAPIを実装する。

対象:

- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
- `src/app/api/notes/[id]/review/route.ts`

作業内容:

- 一覧取得、作成、詳細取得、更新、削除、復習済み更新を実装する。
- Cue / Tag は更新時に全置換する。
- エラー形式を `{ code, message, errors? }` に統一する。

完了条件:

- `npm run lint` が成功する。
- `npm run build` が成功する。
- 手動または簡易スクリプトで主要APIが動作確認できる。

### 4. `mvp-tags-api`

キュー: `codex-queue/tasks-api`

目的:

- タグ候補一覧APIを実装する。

対象:

- `src/app/api/tags/route.ts`

作業内容:

- `GET /api/tags` を実装する。
- タグ作成・編集・削除APIは作らない。

完了条件:

- `npm run lint` が成功する。
- `npm run build` が成功する。

### 5. `mvp-backup-api`

キュー: `codex-queue/tasks-api`

目的:

- SQLite DB のバックアップ作成・一覧取得を実装する。

対象:

- `src/app/api/backups/route.ts`
- `scripts/backup-copy.js` または `scripts/backup-copy.ts`
- 必要に応じて `src/lib/backup/*`

作業内容:

- `GET /api/backups` を実装する。
- `POST /api/backups` を実装する。
- 最新3世代保持を実装する。

完了条件:

- `npm run lint` が成功する。
- `npm run build` が成功する。
- バックアップファイル作成が確認できる。

### 6. `mvp-layout-navigation`

キュー: `codex-queue/tasks-ui`

目的:

- MVP画面構成に合わせた共通レイアウトを作る。

対象:

- `src/app/layout.tsx`
- 必要に応じて `src/components/ui/*`

作業内容:

- ノート一覧、新規作成、バックアップへのナビを実装する。
- 復習専用ナビや未完バッジは作らない。

完了条件:

- `npm run lint` が成功する。
- `npm run build` が成功する。

### 7. `mvp-markdown-preview`

キュー: `codex-queue/tasks-ui`

目的:

- `textarea + preview` の Markdown 入力部品を作る。

対象:

- `src/app/notes/_components/*`
- または `src/components/*`

作業内容:

- textarea 入力を実装する。
- Markdown preview を実装する。
- GFM と sanitize を適用する。

完了条件:

- `npm run lint` が成功する。
- `npm run build` が成功する。

### 8. `mvp-note-form`

キュー: `codex-queue/tasks-ui`

目的:

- ノート作成・編集共通フォームを実装する。

対象:

- `src/app/notes/_components/*`
- `src/app/notes/new/page.tsx`

作業内容:

- タイトル、学習日、学習元、概要、タグ、Cue、本文、サマリー、次回復習日を入力できるようにする。
- Cue 追加・削除を実装する。
- 保存後に詳細画面へ遷移する。

完了条件:

- `npm run lint` が成功する。
- `npm run build` が成功する。

### 9. `mvp-notes-list`

キュー: `codex-queue/tasks-ui`

目的:

- ノート一覧と検索・絞り込みを実装する。

対象:

- `src/app/notes/page.tsx`
- `src/app/notes/_components/*`

作業内容:

- フリーワード、日付、タグ、復習対象フィルタを実装する。
- 要約未作成と復習状態を表示する。

完了条件:

- `npm run lint` が成功する。
- `npm run build` が成功する。

### 10. `mvp-note-detail-modes`

キュー: `codex-queue/tasks-ui`

目的:

- ノート詳細の閲覧・編集・復習モードを実装する。

対象:

- `src/app/notes/[id]/page.tsx`
- `src/app/notes/_components/*`

作業内容:

- 閲覧モードを実装する。
- 編集モードを実装する。
- 復習モードを実装する。
- 本文表示/非表示と復習済み更新を実装する。
- 削除確認と削除を実装する。

完了条件:

- `npm run lint` が成功する。
- `npm run build` が成功する。

### 11. `mvp-backup-screen`

キュー: `codex-queue/tasks-ui`

目的:

- バックアップ画面を実装する。

対象:

- `src/app/backup/page.tsx`

作業内容:

- バックアップ一覧を表示する。
- バックアップ作成ボタンを実装する。
- 成功/失敗メッセージを表示する。

完了条件:

- `npm run lint` が成功する。
- `npm run build` が成功する。

### 12. `mvp-test-scenarios-update`

キュー: `codex-queue/tasks`

目的:

- `doc/TEST_SCENARIOS.md` をMVP仕様に合わせる。

対象:

- `doc/TEST_SCENARIOS.md`

作業内容:

- MVP確認項目を整理する。
- Phase 2項目を分離する。

完了条件:

- MVP受け入れ条件がテスト観点として表現されている。

### 13. `mvp-readme-update`

キュー: `codex-queue/tasks`

目的:

- READMEをフルリニューアル版MVPに合わせて更新する。

対象:

- `README.md`

作業内容:

- セットアップ手順を更新する。
- Prisma migrate / generate を記載する。
- バックアップ手順を記載する。

完了条件:

- 新規環境で起動手順が追える。

### 14. `mvp-final-verification`

キュー: `codex-queue/tasks`

目的:

- MVP全体の検証を行う。

作業内容:

- `npm run lint`
- `npm run build`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- 主要フローの手動確認

完了条件:

- ノート作成、閲覧、編集、復習、検索、バックアップが確認できる。

## 次に決めること

このタスク分割で進めてよいか発注者確認を行う。承認後、Manager が `codex-queue` へ最初の Worker タスクを投入する。
