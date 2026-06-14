# Repository Instructions

このリポジトリは、ローカル個人利用向けの Cornell Method Notebook アプリです。

## Primary References

- 仕様の正本: `AGENTS.md`
- 実装状況: `doc/IMPLEMENTATION_STATUS.md`
- テスト観点: `doc/TEST_SCENARIOS.md`
- Manager / Worker 運用: `codex-queue/README.md`

## Development Policy

- 既存の Next.js App Router、React、Prisma、SQLite 構成を前提に進める。
- 作業前に `git status --short` を確認し、ユーザーの未コミット変更を戻さない。
- 依存関係、DB、UI、API の不整合を見つけた場合は、推測で隠さず明示する。
- 実装は小さく分割し、対象外のリファクタリングを避ける。
- 検証可能な作業では `npm run lint`、`npm run build`、Prisma コマンドなど、適切な確認を行う。
- 検証できない場合は、実行したコマンドと失敗理由を報告する。

## Manager / Worker Policy

- Manager はユーザーと相談してタスクを具体化し、`codex-queue` に投入する。
- Worker は投入された 1 タスクだけを実行し、完了後に変更内容と検証結果を報告する。
- UI タスクは `codex-queue/tasks-ui`、API タスクは `codex-queue/tasks-api`、横断タスクは `codex-queue/tasks` を使う。

---

# Application Specification

この仕様書は、コーネルメソッドノート記録アプリを開発する際にエージェントへ抜け漏れなく依頼するためのテンプレートです。以下の項目を埋め、必要に応じて詳細を更新してください。

---

## 1. 概要

- **タイトル**: コーネルメソッドノート記録アプリ
- **利用想定**: ローカル環境での個人利用。認証・ユーザー管理は不要。
- **目的 / 成功条件**
  - コーネルメソッドのレイアウトでノートを作成・編集・閲覧できる。
  - Markdown（基本記法 + チェックボックス）で入力した内容を Prisma（SQLite）に永続化し、後から読み返せる。
  - 初期テンプレートはコーネルのみ。将来、追加テンプレートを拡張できる構造とする。
  - タイトルエリアでタグ付けし、タグによる検索フィルタが可能（タグは `Tag` テーブルで一元管理）。
  - 保存済みノートの一覧は日付ソート（昇順/降順切替）で閲覧できる。
  - 編集内容はドラフト自動保存され、手動保存で正式版に反映できる。

## 2. 機能要件（UI/UX）

- **共通**

  - 編集モードと閲覧モードをトグルで切り替え。編集モードではドラフト自動保存 + 明示的な保存/破棄ボタンを併用。
  - 削除操作は確認モーダルが必須。削除後はスナックバーで 5 秒間 Undo を表示し復元を許可（Undo 期限まではソフトデリートで DB に退避）。
  - 入力エリアはすべて Markdown 文法（基本記法 + チェックボックス）を受け付ける。エディタとプレビューを縦に並べて同時表示。
  - 編集中は 3 秒間入力が止まると差分のみドラフト保存（`isDraft=true` のまま DB 反映）。連続ドラフト保存は最短 6 秒間隔。楽観ロックで `updatedAt` が古い保存は 409 を返し、再読込を促す。
  - 409 競合時の UI：ドラフト保存（オートセーブ）はバナーで通知＋再読み込みボタン（自動保存は一時停止、編集は継続可）。確定保存（Cmd+S）はモーダルで再読み込み/後でを提示（自動保存は再読み込みまで停止）。
  - 「保存」ボタンで最終確定し `isDraft=false` へ更新。同時にドラフトステータスバッジを消す。ドラフト自体は 1 レコードを使い回し、同一ノートで 10 件以上 `isDraft=true` が残らないよう週次でクリーンアップバッチを走らせる。
  - 自動保存に失敗した場合はバナーで警告し、手動「再試行」ボタンのみ（自動リトライなし）。バナー表示中は自動保存送信を停止するが入力は継続可能。オフライン時も同様の運用。
  - キーボードショートカット：`Cmd+S` 保存、`Cmd+Z` 取り消し、`Cmd+Shift+Z` やり直し。`Cmd+N` はフォーカスしている欄に応じてカードを追加（キーワード欄ならキーワードカード、ノート欄ならノートカード）。どちらにもフォーカスがない場合は無効。
  - ショートカットは Cmd 系に加え Ctrl 系でも動作させる（例：Cmd+S / Ctrl+S）。

- **タイトルエリア**

  - タイトル、概要、日付フィールドを配置。概要は複数行スクロール可。
  - 日付選択はカレンダー UI で入力。手入力も許可する場合はフォーマットを YYYY-MM-DD に統一。
  - タグ入力欄を設置。既存タグのオートコンプリート + 新規追加に対応し、Notebook と Tag を中間テーブルで関連付ける。候補に存在しないタグはその場で `Tag` レコードを自動作成する。各ノートにつき最大 12 個までで、重複は UI/ロジックで弾く。
  - タグ仕様：長さ 1〜30 文字。使用可文字はひらがな・カタカナ・英数字・記号 `!"#$%&'()0=~|-^¥@[\`{;:]+\*},./<>?\_`のみ、空白はトリムし絵文字不可。色は任意入力可（デフォルト`#f59e0b`）。削除は確認付きでノート紐付けも同時解除。名称変更は既存ノートへ即時反映。

- **ノートエリア**

  - 横幅は 30%（キーワード） / 70%（ノート）の比率を基本とし、レスポンシブに調整。
  - **キーワード/質問欄**
    - カード形式で複数エントリを保持。＋ボタンで追加、－ボタンで個別削除（件数制限なし）。
    - 削除時は確認モーダルを表示。閲覧モードでもスクロールは可能。
    - カードはドラッグ＆ドロップで並び替え可能。`dnd-kit` ベースで実装し、ドロップ時に `order` を自動更新。
  - **ノート欄**
    - カード形式でノート本文を保持。カードごとに紐づくキーワード ID を選択できる。
    - カード追加/削除、閲覧モードでの非表示切替（hidden flag）を実装。件数制限なし。
    - カードはドラッグ＆ドロップで並び替え可能（`dnd-kit`）。ドロップ時に `order` を即時計算し、差分のみ保存。
    - ノート欄全体を一時的に非表示にする機能は閲覧モードのみ許可。

- **サマリーエリア**

  - 要約と次アクションを記載する Markdown フィールド。スクロール可能。
  - プレビューのチェックボックスは表示専用 (`react-markdown` + `remark-gfm` + `rehype-sanitize`) とし、クリック時は `preventDefault` でエディタ側のみ変更可能に保つ（キーワード/ノート欄と同仕様）。`react-markdown` の `components.input` を override して tailwind の design token（例: `accent-primary`, `border-muted`, `bg-surface`）に統一したスタイルを適用する。

- **一覧画面**

  - タイトル・日付（From/To 範囲）フィルタに加え、タグはトークナイザー型入力（フリーワード + サジェスト）で OR 条件絞り込み。候補リストは名前順で表示し、検索/オートコンプリート可能。最大 12 個まで追加（重複は自動で弾く）。タグの右クリックメニューから名称変更・削除を行える管理 UI を提供する。
  - 日付範囲は `react-day-picker` の range mode で開始・終了を設定。片側のみ指定した場合は「開始日以降」または「終了日以前」として扱い、ブランクは制限なしとみなす。From > To や無効日付はフォーカスアウト時と検索実行時にバリデーションしてエラー表示。クイックセレクトとして「今日」「過去 7 日」「過去 30 日」をボタンで提供。
  - 並び順は日付ソート（昇順/降順切替）に限定。
  - 新規ノート作成ボタンからテンプレ初期値で詳細画面へ遷移。
  - 期間指定エクスポート：日付フィルタ群の右隣に開始日/終了日ピッカーと「PDF 出力」ボタンを配置し、指定期間内のノートをプリント専用の 1 ノート 1 ページ SSR レイアウトで組み立て、Playwright で PDF 化する（将来 HTML へ戻す可能性あり）。`GET /api/notes/export?from&to` で取得し、`学習記録-YYYYMMDD(開始日)-YYYYMMDD(終了日).pdf` として保存。カード単位で改ページしフッターにノート日付のみ表示。リクエストごとに Chromium を起動して生成。期間未指定・範囲不正時はボタンを無効化し、実行後は進行中インジケータと完了トーストを表示する。

- **復習タスク画面**
  - `/tasks/review`（仮）に専用画面を設け、タブで「1 日後（作成 1 日以上 7 日未満、`reviewStatus=0`）」と「1 週間後（作成 7 日以上、`reviewStatus=1`）」を切り替えて表示する。
  - 各タスクカードにはタイトル・記載日・タグ・残り時間バッジ・完了チェックボックスを表示。チェック操作で即座に API を呼び出し、1 日後タスク完了時は `reviewStatus=1` へ遷移し `firstReviewCompletedAt` に日時を記録。1 週間後タスク完了時は `reviewStatus=2` とし `secondReviewCompletedAt` に記録する。ステータス 2 のノートは以降タスク抽出対象外。
  - タスクはノート作成直後に自動的に管理され、`noteDate` から 24 時間・7 日が経過したタイミングでそれぞれのタブに出現する。完了後のタスクは即座に一覧から除去し、取り消し操作は不要。
  - グローバルナビゲーションの「復習タスク」リンクに未完タスク総数（1 日後 + 1 週間後）のバッジを表示し、リアルタイムで更新する。

## 3. 技術スタック / 前提

- Next.js 16（App Router）、React 19、TypeScript 5.9、tailwindcss 4.1
- 状態管理は React Hooks と Context で十分。外部ライブラリは最小限。
- Markdown エディタは `@uiw/react-md-editor` を採用し、エディタ＋プレビューの縦並び表示をカスタマイズ。`react-markdown` を組み合わせ、XSS 対策（`rehype-sanitize`）とチェックボックス拡張を有効化する。
- Prisma + SQLite（ローカルファイル）でデータ永続化。`prisma migrate` でスキーマ管理。
- 外部 API との連携なし。ネットワーク接続不要。
- PDF 出力は Playwright（Chromium）を利用し、エクスポート API でリクエストごとに起動する。

## 4. 状態遷移 / ルーティング

| 画面         | パス例          | 主な状態                       | 備考                                 |
| ------------ | --------------- | ------------------------------ | ------------------------------------ |
| ノート一覧   | `/notes`        | 初期ロード / 検索中 / 結果表示 | ローカル検索（タイトル・日付・タグ） |
| ノート詳細   | `/notes/[id]`   | 閲覧 / 編集 / 保存中 / エラー  | モードトグルと Undo Snackbar         |
| 新規作成     | `/notes/new`    | 初期テンプレロード / 下書き    | 保存後 `/notes/[id]` へ遷移          |
| バックアップ | `/notes/backup` | 最新 3 世代の一覧 / 再取得     | 自動コピーの履歴 + リトライボタン    |
| 復習タスク   | `/tasks/review` | タブ切替 / 完了操作            | 1 日後 / 1 週間後タスクの完了管理    |

- RSC + Client Component のハイブリッド。フォーム部分は Client Component。
- Undo は Client 側で`setTimeout`管理し、期限切れ後は完全削除。
- `/notes/backup` は最新 3 世代のバックアップ一覧と、失敗時の再試行ボタン/ログ確認リンクを提供する。

## 5. データモデル / API

| テーブル                     | 主キー                               | 主な列                                                                                                                                                   | 備考                                                                                         |
| ---------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `notebooks`                  | `id` (cuid)                          | `title`, `overview`, `summary`, `note_date`, `created_at`, `updated_at`, `deleted_at`                                                                    | Prisma モデル名は `Notebook` だが、テーブル/カラムは snake_case で管理（日時は `DATETIME`）  |
| `notebook_draft_states`      | `notebook_id` (PK=FK)                | `is_draft`, `draft_updated_at`, `hidden_notes`, `version` (int), `autosave_version` (int)                                                                | Notebook と 1:1 の最新ドラフト専用テーブル。Notebook 作成時に必ず初期レコードを生成          |
| `notebook_review_progresses` | `notebook_id` (PK=FK)                | `review_status` (0=未レビュー,1=1 日後済,2=1 週間後済), `first_review_at`, `second_review_at`, `first_review_completed_at`, `second_review_completed_at` | Notebook 作成時に必ず初期レコードを生成する spaced repetition 用メタデータ                   |
| `tags`                       | `id`                                 | `name` (unique), `color` (任意), `created_at`                                                                                                            | タグ候補のマスタ                                                                             |
| `notebook_tags`              | `notebook_id`, `tag_id` (複合主キー) | -                                                                                                                                                        | Notebook と Tag の多対多中間                                                                 |
| `cue_cards`                  | `id`                                 | `notebook_id` FK, `marker`, `content`, `order`, `deleted_at`                                                                                             | Markdown: `content`                                                                          |
| `note_cards`                 | `id`                                 | `notebook_id` FK, `title`, `content`, `order`, `is_hidden`, `deleted_at`                                                                                 | Markdown: `content`                                                                          |
| `note_cue_links`             | `note_card_id`, `cue_card_id`        | `order` (任意)                                                                                                                                           | CueCard と NoteCard の多対多中間。DB が参照整合性を担保する                                  |
| `soft_delete_buffers`        | `id`                                 | `entity_type` (`notebook`/`cue`/`note`), `entity_id`, `undo_expires_at`, `created_at`, `purged_at`                                                       | Undo 用のソフトデリート領域。ID と種別のみ保持し、実データは各テーブルの `deleted_at` で管理 |
| `backup_logs`                | `id`                                 | `executed_at`, `status` (`success`/`failure`), `error_message`                                                                                           | 自動/手動バックアップのログ。`/notes/backup` で最新順に表示                                  |

- Notebook は確定版の永続化のみを担い、ドラフトや復習、Undo 等の周辺責務はそれぞれ `NotebookDraftState`、`NotebookReviewProgress`、`SoftDeleteBuffer` が担当する。Notebook 作成時に `NotebookDraftState` / `NotebookReviewProgress` の初期レコードも同時生成し、以降は 1:1 リレーションを維持する。Notebook 保存時は関連テーブルを Prisma のトランザクションで一括更新する（スロークエリが問題になる場合のみ分割を検討）。
- 復習タスクはノート作成時に `first_review_at = note_date + 1 day`, `second_review_at = note_date + 7 days` を算出して `notebook_review_progresses` に保存し、`review_status` に応じて「1 日後」「1 週間後」タブに振り分ける。
- Notebook/CueCard/NoteCard など削除対象は `deletedAt` によるソフトデリートを採用し、Undo 期限内はレコードを保持する。期限切れまたは明示破棄で `deletedAt IS NOT NULL` のレコードを物理削除する。
- `NoteCueLink` に CueCard との関連を移したことで、ノート本文更新と関連付け更新を別トランザクションにでき、DB 側で外部キー制約が機能する。
- Draft のバージョニングは `version`（確定保存時に +1）と `autosave_version`（自動保存時に +1）を分離し、比較時は `version.autosave_version` を文字列連結して扱う。確定保存時は `version` をインクリメントして `autosave_version` を 0 にリセット、自動保存時は `autosave_version` のみ増やす。

- クリーンアップ方針

  - アプリ起動時に Prisma 経由で `draftUpdatedAt` から 30 日以上経過した `NotebookDraftState` を削除し、同時に `soft_delete_buffers` の `undo_expires_at < now()` を物理削除する（ログ保持なし）。
  - 同タイミングで `deleted_at` が 30 日以上前の Notebook/CueCard/NoteCard を完全削除し、復元不可にする。

- API 例
  - `GET /api/notes?query=...`
  - `GET /api/notes/:id`
  - `POST /api/notes`
  - `PATCH /api/notes/:id`
  - `DELETE /api/notes/:id`
  - `GET /api/review-tasks?type=day|week`（`first_review_at` / `second_review_at` と `review_status` でフィルタ）
  - `PATCH /api/review-tasks/:notebookId`（チェックボックス完了時に `review_status` と完了日時を更新）
  - `POST /api/tags`（一覧用）、ただし通常はノート編集時に未登録タグを自動作成
- `POST /api/notes` / `PATCH /api/notes/:id` は Notebook（確定版）と `NotebookDraftState`（自動保存）を並行して更新する。同じリクエスト body に `{ notebook: {...}, draft: {...} }` を含め、ドラフトのみ保存時は `draft` 部分だけを更新し、確定保存時に両方を更新する。ドラフトのバージョンは `version`（整数）と `autosave_version`（整数）を組み合わせて管理し、リクエストで送信された値と DB の値が一致した場合のみ更新する。不一致時は 409 を返し、`errors: [{ field: "draft.version", message: "outdated" }]` などフィールドを明示する。自動保存時は `autosave_version` のみ +1、確定保存時は `version` を +1 して `autosave_version=0` にリセットする。
- `DELETE` 系 API は直ちにレコードを消さず `deletedAt` を設定し、`SoftDeleteBuffer` に ID/種別を記録する。Undo 期限内であれば `deletedAt=NULL` に戻して復元できる。期限切れまたは明示的な破棄で初めて物理削除する。
- Undo は送信がシンプルな `POST /api/undo` を定義し、ボディに `{ entityType, entityId }` を渡すと `SoftDeleteBuffer` から対象を復元する。期限切れまたは存在しない場合は 410 を返す。
- バックアップ画面向けに `GET /api/backups`（最新 3 世代 + 失敗履歴 + ログサマリ）、`POST /api/backups/retry`（失敗分の再試行）、`GET /api/backups/logs`（`backup_logs` テーブルを参照）を用意する。`POST /api/backups/retry` は `npm run backup:copy` と同じコマンドをキックする。
- ノート保存時に未登録タグが自動作成された場合、レスポンスに `{ createdTags: Tag[] }` を含めて UI が即座に反映できるようにする。
- すべての API でエラーは JSON 形式に統一し、`{ code, message, errors? }` を返す。バリデーションや 409 競合エラー時は `errors: [{ field, message }]` でフィールド単位の詳細を含める。ドラフト競合時は `field` を `draft.version` または `draft.autosave_version` として返す。
- `GET /api/notes` のクエリは `?query`, `?tags=tag1,tag2`, `?from`, `?to`, `?page`（1 始まり）を受け取り、`tags` は OR 条件で重複タグはロジック側で除外する。1 ページ 50 件固定でページングし、レスポンスには `page`, `totalPages`, `totalCount` を含める。
- 期間指定エクスポートはクライアント側で HTML を生成し、`/api/notes/export?from=...&to=...` などの API でノートデータをまとめて取得して実行する。
- 一覧/復習タスク API は 2000ms を目安に応答し、タイムアウトした場合はエラー JSON を返す。データ量増加で超過する場合は見直しを検討。
- API 呼び出しは Next.js App Router のキャッシュ（`fetch` のデフォルトキャッシュ/SWR 相当）を利用し、追加のサーバーサイドキャッシュは設けない。復習タスクのバッジ更新は画面リロード時に最新状態を取得する。
- バリデーション（タイトル/概要/サマリーはフォーカスアウトと保存時に検証）
  - タイトル: 1〜120 文字
  - 概要: 0〜400 文字（Markdown）
  - カード数: 制限なし（パフォーマンス上の注意のみ）
  - 日付: 過去〜今日、未来日は入力をブロックする（無効日付や From>To はインラインエラー＋枠ハイライト）

## 6. 非機能要件

- **パフォーマンス**: ローカル環境で主要操作（カード追加/削除/保存）が 200ms 以内に反映。
- **アクセシビリティ**: キーボード操作で全要素にアクセス可能。ARIA ランドマークと適切なラベルを付与。
- **テスト**: `npm run lint` 必須。可能であれば Playwright/E2E で主要フロー（作成 → 保存 → 閲覧）を自動化。
- **バックアップ**: アプリ起動時のみ SQLite DB ファイルを `backup/` 配下へ `YYYY-MM-DDTHH-mm-ss` フォーマットのタイムスタンプ付きで自動コピー。直近 3 世代を保持し、4 世代目以降は最古を削除。コピー対象は DB ファイルのみ（ログ等は除外）。コピー処理は Node スクリプト化し、UI からの再試行も `npm run backup:copy`（同一コマンド）で実行する。コピー失敗時はトースト＋再試行ボタンで即リトライし、詳細は `/notes/backup` で確認できる。README には手動コピー手順も記載。エクスポートは Playwright による PDF 出力を採用（`GET /api/notes/export?from&to`）、印刷 UI は不要（PDF で代替）。将来の HTML 出力復帰は運用後に検討。
- **アクセシビリティ補足**: 現時点では D&D 並び替えのキーボード操作は未実装（必要になれば上下移動ボタン等を追加）。モーダルのフォーカス制御も省略しており、後から追加可能。

## 7. 制約 / 前提

- 共有・コメント・マルチユーザー機能は実装しない。
- 画像やファイルの添付は対象外（テキストのみ）。
- テンプレートデータは `src/templates/` 配下で定義し、ツリー形式で UI と連動させる。
- 外部ライブラリ追加時は事前に記載（例: Markdown エディタ、カレンダーピッカー）。ショートカットは Cmd 系で統一する（Windows 環境も Cmd 相当のキーにマッピング）。

## 8. スケジュール（例）

- 着手: 2025-03-XX
- UI 固定: +1 週間
- CRUD / Prisma 実装: +2 週間
- QA（Lint + 手動確認）: +3 週間

## 9. 受け入れ条件

- [ ] ノートの一覧 → 詳細 → 編集 → 保存 → 閲覧の操作デモ（動画 or GIF）
- [ ] `npm run lint` が成功
- [ ] Prisma migrate / seed 手順を README に記載
- [ ] 主要画面のスクリーンショットを README へ追加

## 10. 未決事項 / ToDo

- 現時点で未決事項はなし。追加要件が出た場合にここへ追記する。

---

追加の要件や決定事項が出た場合は、本テンプレートに追記・更新してください。
