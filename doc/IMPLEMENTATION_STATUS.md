# 実装状況サマリ

## 実装済み

- Prisma スキーマ定義と SQLite 環境（`prisma/schema.prisma`, `.env.example`）、依存追加。
- ノート API: 一覧/作成/取得/更新/削除（ソフトデリート＋ Undo バッファ）、タグ自動生成、レビュー予定生成、ドラフト版の楽観ロック（確定版/ドラフトで version, autosaveVersion を分離）。
- タグ API、復習タスク API、バックアップ API（最新 3 世代取得 + 再試行）、Undo API。
- PDF エクスポート（`GET /api/notes/export?from&to`）、Playwright で 1 ノート 1 ページ/カード単位改ページ/日付フッター。
- UI: 共通レイアウト＋ナビ、/notes 一覧、/notes/new、/notes/[id] 編集、復習タスク、バックアップ画面。
- ノートエディタ: Markdown エディタ（縦並び）、タグ入力（最大 12・重複排除・デフォルト色 #f59e0b）、キーワード/ノートカード追加・D&D 並び替え、Cmd/Ctrl+S 保存、3 秒アイドルでドラフト自動保存、409 バナー（ドラフト）/モーダル想定（確定保存時は要拡張）、自動保存失敗バナー＋手動再試行。
- バックアップスクリプト (`npm run backup:copy`) で `backup/` に最新 3 世代を保持。

## 未実装・今後のタスク

- ショートカット: Cmd+N/Cmd+Z/Cmd+Shift+Z の動作、フォーカス位置に応じたカード追加ロジック。
- Undo UI: 削除後 5 秒スナックバー表示と復元操作（API は `/api/undo` あり）。
- 閲覧モード/編集モードのトグル、閲覧モードでの hidden 表示制御。
- Validation UX: インラインエラー表示の強化（未来日ブロックは実装、タグの文字種エラー文言などは簡易）。
- A11y: D&D のキーボード代替操作、モーダルのフォーカス制御、ARIA の詳細付与は未対応。
- バックアップログ UI/DB 連携、エクスポートの HTML モード切替オプション。
- README へのセットアップ手順、migrate/seed、操作デモ、スクリーンショット追記。

## セットアップ/運用コマンド

- 依存インストール: `npm install`
- Prisma クライアント生成: `npm run prisma:generate`
- マイグレーション: `npm run prisma:migrate`
- 開発サーバ: `npm run dev`
- Lint: `npm run lint`
- DB バックアップ: `npm run backup:copy`
- Playwright Chromium インストール（PDF 出力用）: `npx playwright install chromium`

## 主なエンドポイント

- ノート: `GET /api/notes`, `POST /api/notes`, `GET /api/notes/:id`, `PATCH /api/notes/:id`, `DELETE /api/notes/:id`
- タグ: `GET /api/tags`, `POST /api/tags`
- 復習タスク: `GET /api/review-tasks?type=day|week`, `PATCH /api/review-tasks`
- Undo: `POST /api/undo`
- バックアップ: `GET /api/backups`, `POST /api/backups/retry`
- エクスポート: `GET /api/notes/export?from&to`（PDF）

## データモデル補足

- Notebook/NotebookDraftState/NotebookReviewProgress は 1:1 で作成時に初期レコードを生成。
- Draft は `version`（確定保存）と `autosaveVersion`（ドラフト保存）を分離。確定保存で version++, autosaveVersion=0。ドラフト保存で autosaveVersion++。
- ソフトデリートは `deletedAt` と `SoftDeleteBuffer` で管理し、Undo 期限は 5 秒。物理削除は起動時バッチ（実装は未）。
