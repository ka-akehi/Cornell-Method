# As-Is 設計棚卸し

確認日: 2026-06-14

## 位置づけ

このドキュメントは、現行コードから機械的に確認できる事実を整理した As-Is 設計メモです。今後の設計見直しでは、ここに記載した事実を起点に、MVP / Phase 2 / 保留 / 削除候補を分類します。

発注者判断により、実装段階では現行実装を流用せずフルリニューアルする方針です。そのため、このドキュメントは新設計の制約ではなく、既存状態の把握、捨てる機能、残す概念、再設計が必要な論点を洗い出すための資料として扱います。

履歴注記: 本書は 2026-06-14 時点の As-Is スナップショットです。概要を含む旧実装の事実は履歴として保持し、現行仕様の判断には使用しません。

参考にした設計知識ファイル:

- `/Users/kazuya/Downloads/prompts/docs/INDEX.md`
- `/Users/kazuya/Downloads/prompts/docs/AGENTS.md`
- `/Users/kazuya/Downloads/prompts/docs/miscellaneous/画面棚卸し注意点.md`
- `/Users/kazuya/Downloads/prompts/docs/画面一覧.md`
- `/Users/kazuya/Downloads/prompts/docs/URL一覧.md`
- `/Users/kazuya/Downloads/prompts/docs/item_map.md`
- `/Users/kazuya/Downloads/prompts/docs/セッション切れ・システムエラー仕様.md`

## 棚卸し方針

- 推測で仕様を補完せず、fact / assumption / unknown を分ける。
- 画面、API、DB、バッチ、エラー仕様を分離する。
- 副作用のある操作は「主要アクション」として扱う。
- 次の設計判断が必要な箇所は Open Question として残す。

## Fact: 技術スタック

| 項目 | 内容 | 根拠 |
| --- | --- | --- |
| フレームワーク | Next.js 16 App Router | `package.json`, `src/app/*` |
| UI | React 19, Tailwind CSS 4 | `package.json`, `src/app/globals.css` |
| DB | SQLite + Prisma | `package.json`, `prisma/schema.prisma` |
| Markdown | `@uiw/react-md-editor`, `react-markdown`, `remark-gfm`, `rehype-sanitize` | `package.json` |
| D&D | `@dnd-kit/*` | `package.json` |
| PDF | Playwright Chromium | `package.json`, `src/app/api/notes/export/route.ts` |
| バックアップ | Node script で DB ファイルコピー | `scripts/backup-copy.js` |

## Fact: 画面一覧

| 画面ID | パス | 形式 | 概要・役割 | 主要アクション | 根拠 |
| --- | --- | --- | --- | --- | --- |
| COM-001 | 全画面 | 共通レイアウト | ヘッダー、グローバルナビ、本文領域 | `/notes`, `/notes/new`, `/tasks/review`, `/notes/backup` へ遷移 | `src/app/layout.tsx` |
| NTE-001 | `/` | ページ | ノート一覧へリダイレクト | `/notes` へリダイレクト | `src/app/page.tsx` |
| NTE-010 | `/notes` | ページ | ノート一覧 | 検索、日付絞り込み、タグ絞り込み、PDF出力、削除導線 | `src/app/notes/page.tsx`, `src/app/notes/_components/notes-list.tsx` |
| NTE-020 | `/notes/new` | ページ | ノート新規作成 | ノート作成、タグ入力、カード編集、保存 | `src/app/notes/new/page.tsx`, `src/app/notes/_components/note-editor.tsx` |
| NTE-030 | `/notes/[id]` | ページ | ノート編集 | ノート取得、編集、保存、自動保存 | `src/app/notes/[id]/page.tsx`, `src/app/notes/_components/note-editor.tsx` |
| TSK-010 | `/tasks/review` | ページ | 復習タスク一覧 | 1日後/1週間後タブ切替、タスク完了 | `src/app/tasks/review/page.tsx` |
| BAK-010 | `/notes/backup` | ページ | バックアップ一覧 | 最新3世代表示、再試行、ダウンロード | `src/app/notes/backup/page.tsx` |

## Fact: API 一覧

| Method | URL | 用途 | 主な副作用 | 根拠 |
| --- | --- | --- | --- | --- |
| GET | `/api/notes` | ノート一覧取得 | なし | `src/app/api/notes/route.ts` |
| POST | `/api/notes` | ノート作成 | Notebook, DraftState, ReviewProgress, CueCard, NoteCard, Tag, NotebookTag を作成 | `src/app/api/notes/route.ts` |
| GET | `/api/notes/:id` | ノート詳細取得 | なし | `src/app/api/notes/[id]/route.ts` |
| PATCH | `/api/notes/:id` | ノート更新 / ドラフト保存 | Notebook, DraftState, ReviewProgress, Tag, CueCard, NoteCard, NoteCueLink を更新 | `src/app/api/notes/[id]/route.ts` |
| DELETE | `/api/notes/:id` | ノート削除 | Notebook.deletedAt 設定、SoftDeleteBuffer 作成 | `src/app/api/notes/[id]/route.ts` |
| GET | `/api/tags` | タグ一覧取得 | なし | `src/app/api/tags/route.ts` |
| POST | `/api/tags` | タグ作成/更新 | Tag を upsert | `src/app/api/tags/route.ts` |
| GET | `/api/review-tasks?type=day\|week` | 復習タスク取得 | なし | `src/app/api/review-tasks/route.ts` |
| PATCH | `/api/review-tasks` | 復習タスク完了 | ReviewProgress の status / completedAt 更新 | `src/app/api/review-tasks/route.ts` |
| POST | `/api/undo` | ソフトデリート復元 | deletedAt を null に戻し、SoftDeleteBuffer を削除 | `src/app/api/undo/route.ts` |
| GET | `/api/backups` | バックアップ一覧取得 | なし | `src/app/api/backups/route.ts` |
| POST | `/api/backups/retry` | バックアップ再実行 | `scripts/backup-copy.js` を実行 | `src/app/api/backups/retry/route.ts` |
| GET | `/api/notes/export?from&to` | PDF エクスポート | Playwright Chromium を起動して PDF 生成 | `src/app/api/notes/export/route.ts` |

## Fact: DB モデル

| モデル | 役割 | 主な関係 | 根拠 |
| --- | --- | --- | --- |
| `Notebook` | ノート本体 | DraftState, ReviewProgress, CueCard, NoteCard, Tag と関連 | `prisma/schema.prisma` |
| `NotebookDraftState` | ドラフト状態とバージョン | Notebook と 1:1 | `prisma/schema.prisma` |
| `NotebookReviewProgress` | 復習タスク状態 | Notebook と 1:1 | `prisma/schema.prisma` |
| `Tag` | タグマスタ | Notebook と多対多 | `prisma/schema.prisma` |
| `NotebookTag` | Notebook / Tag 中間 | 複合主キー | `prisma/schema.prisma` |
| `CueCard` | キーワード/質問カード | Notebook に所属、NoteCueLink と関連 | `prisma/schema.prisma` |
| `NoteCard` | ノート本文カード | Notebook に所属、NoteCueLink と関連 | `prisma/schema.prisma` |
| `NoteCueLink` | CueCard / NoteCard 関連 | 多対多 | `prisma/schema.prisma` |
| `SoftDeleteBuffer` | Undo 用バッファ | entityType / entityId で対象を表現 | `prisma/schema.prisma` |
| `BackupLog` | バックアップログ | 現行 API では未使用 | `prisma/schema.prisma`, `src/app/api/backups/*` |

## Fact: バリデーション

| 対象 | 制約 | 根拠 |
| --- | --- | --- |
| タイトル | 1〜120文字 | `src/lib/validation.ts` |
| 概要 | 最大400文字 | `src/lib/validation.ts` |
| タグ名 | 1〜30文字、正規表現制約 | `src/lib/validation.ts` |
| タグ数 | 最大12個 | `src/lib/validation.ts` |
| キーワード marker | 1〜50文字 | `src/lib/validation.ts` |
| order | 0以上の整数 | `src/lib/validation.ts` |
| noteDate | 未来日は API 側で拒否 | `src/app/api/notes/route.ts`, `src/app/api/notes/[id]/route.ts` |

## Fact: バッチ・ファイル操作

| 処理 | 内容 | 根拠 |
| --- | --- | --- |
| `npm run backup:copy` | `prisma/dev.db` を `backup/` へコピーし、最新3世代だけ残す | `scripts/backup-copy.js` |
| バックアップ再試行 API | `node scripts/backup-copy.js` を `exec` で実行 | `src/app/api/backups/retry/route.ts` |
| PDF 出力 | リクエストごとに Chromium を起動し、HTML から PDF を生成 | `src/app/api/notes/export/route.ts` |

## Fact: エラー形式

多くの API は以下の JSON 形式を返します。

```json
{ "code": "invalid_body", "message": "validation error", "errors": [] }
```

確認できた主なエラー:

| code | HTTP | 用途 | 根拠 |
| --- | ---: | --- | --- |
| `invalid_body` | 400 | body 不正、validation error | `src/app/api/notes/*`, `src/app/api/tags/route.ts`, `src/app/api/undo/route.ts` |
| `invalid_date` | 400 | 未来日拒否 | `src/app/api/notes/*` |
| `not_found` | 404 | ノート未存在 | `src/app/api/notes/[id]/route.ts` |
| `conflict` | 409 | Draft version 不一致 | `src/app/api/notes/[id]/route.ts` |
| `gone` | 410 | Undo 対象なし / 期限切れ | `src/app/api/undo/route.ts` |
| `server_error` | 500 | 予期しないエラー | `src/app/api/notes/*`, `src/app/api/tags/route.ts` |
| `backup_failed` | 500 | バックアップ失敗 | `src/app/api/backups/retry/route.ts` |
| `invalid_range` | 400 | PDF 出力範囲不正 | `src/app/api/notes/export/route.ts` |

## Assumption: 現行設計の意図

- `Notebook` は確定版、`NotebookDraftState` はドラフト状態を持つ意図に見える。
- 復習タスクはノート作成日を起点に 1日後 / 7日後を自動生成する意図に見える。
- `SoftDeleteBuffer` は UI の Undo スナックバー実装を前提にした API 側の土台に見える。
- `BackupLog` は将来的なログ UI / DB 連携を想定したモデルに見えるが、現時点では使われていない。

## Unknown / Open Question

発注者判断が必要な論点です。

| ID | 論点 | 判断が必要な理由 |
| --- | --- | --- |
| OQ-001 | MVP にドラフト自動保存を含めるか | 実装済みだが、競合制御・UI状態・テスト負荷が高い |
| OQ-002 | MVP に復習タスクを含めるか | Cornell Method の中核ではないが、学習アプリとして価値はある |
| OQ-003 | MVP に PDF 出力を含めるか | Playwright 依存と実行環境の確認が必要 |
| OQ-004 | 削除は MVP でソフトデリート + Undo にするか、物理削除に戻すか | UI が未完成の場合、DB/API だけ複雑になる |
| OQ-005 | `CueCard` / `NoteCard` / `NoteCueLink` のカード構造を維持するか | Cornell レイアウトとしては自然だが、最小実装より複雑 |
| OQ-006 | D&D 並び替えを MVP に含めるか、上下ボタンに簡略化するか | A11y とテスト負荷に影響する |
| OQ-007 | タグは正規化テーブルを維持するか、MVP では文字列配列に簡略化するか | 検索や名称変更を重視するなら正規化が有利 |
| OQ-008 | バックアップログを DB 管理するか、ファイル一覧だけにするか | `BackupLog` はあるが現行実装では未使用 |

## 次の設計作業

次は、この As-Is を元に `AGENTS.md` の機能を MVP / Phase 2 / 保留 / 削除候補へ分類する。
