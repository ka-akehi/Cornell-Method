# Repository Instructions

このリポジトリは、ローカル個人利用向けの Cornell Method Notebook アプリです。

## Primary References

- 製品全体仕様・ロードマップの正本: `AGENTS.md`
- 現行 MVP の実装・受け入れ契約: `doc/implementation/MVP_CONTRACT.md`
- 実装状況: `doc/implementation/IMPLEMENTATION_STATUS.md`
- テスト観点: `doc/testing/TEST_SCENARIOS.md`
- 設計書一覧: `doc/README.md`
- Manager / Worker 運用: `codex-queue/README.md`
- Task Summary 運用: `summary/README.md`
- 最新引き継ぎ: `HANDOFF_2026-07-31.md`

### 仕様書の役割分担

`AGENTS.md` は、現行 MVP と Phase 2 以降の高度機能を含む製品全体の仕様・ロードマップを管理します。現行 MVP の route、API、データモデル、保存・削除・復習方式、受け入れ判断は [`doc/implementation/MVP_CONTRACT.md`](doc/implementation/MVP_CONTRACT.md) を正本とします。MVP 契約と製品全体ロードマップの記載が異なる場合、現行 MVP の実装判断では MVP 契約を優先し、将来機能の記述はロードマップとして保持します。

## Development Policy

- 既存の Next.js App Router、React、Prisma、SQLite 構成を前提に進める。
- 作業前に `git status --short` を確認し、ユーザーの未コミット変更を戻さない。
- 依存関係、DB、UI、API の不整合を見つけた場合は、推測で隠さず明示する。
- 実装は小さく分割し、対象外のリファクタリングを避ける。
- 検証可能な作業では `npm run lint`、`npm run build`、Prisma コマンドなど、適切な確認を行う。
- 検証できない場合は、実行したコマンドと失敗理由を報告する。
- 長い調査、Worker task、`codex exec` の完了要約は `summary/` 配下へ残し、raw log や長い command output をメイン会話へ戻さない。
- 再開時は関連 summary を先に読み、`Next Read` に記載された最小ファイルだけを確認する。
- 作業再開時は、最新の `HANDOFF_YYYY-MM-DD.md` を確認してから続きの作業を判断する。
- 新しい `HANDOFF_YYYY-MM-DD.md` を作成した場合は、`AGENTS.md` の「最新引き継ぎ」を新しいファイルへ更新し、古い `HANDOFF_YYYY-MM-DD.md` は削除する。

## Manager / Worker Policy

- ユーザーは発注者として、仕様判断・優先順位・方針決定を行う。
- Manager はユーザーと相談してタスクを具体化し、`codex-queue` に投入する。
- Worker は投入された 1 タスクだけを実行し、完了後に変更内容と検証結果を報告する。
- Worker / Manager は、必要に応じて `summary/task-summary-template.md` の粒度で完了要約を残す。`codex-queue/bin/worker-run.sh` 経由の task は完了/失敗時に最小 summary を自動作成する。
- UI タスクは `codex-queue/tasks-ui`、API タスクは `codex-queue/tasks-api`、横断タスクは `codex-queue/tasks` を使う。
- Manager / Worker は、仕様が不明な場合や方針判断が必要な場合に推測で進めず、発注者へ随時質問する。
- 技術的に不整合、過剰設計、実装リスクがある場合は、作業者側から論点として提示する。
- 発注者は設計初心者である前提を置き、Manager は発注者が見逃しやすい重要な分岐点、リスク、判断基準を先回りして提示する。
- 重要な分岐点では、Manager は「何を決める必要があるか」「選択肢」「各選択肢の影響」「Manager 推奨」を明示する。
- 発注者から設計学習目的で判断理由や判断基準を質問された場合は、回答内容を `learning-notes/DESIGN_LEARNING_NOTES.md` に追記する。

### PR 作成ルール

- PR は Draft ではなく、レビュー可能な Open 状態で作成する。
- GitHub Issue の修正を含む PR では、修正した Issue ごとに PR 本文へ `Closes #[Issue番号]` を追加する。Issue の自動クローズ参照は PR 本文に記載する。
- `summary/` 配下の Worker task summary は PR の変更ファイルに含めない。PR 作成前に summary ファイルをステージ対象から除外する。summary は完了要約としてリポジトリ内に残してよいが、PR 本文の変更説明や Issue の自動クローズ参照の代わりにはしない。

---

# Application Specification

この仕様書は、コーネルメソッドノート記録アプリを開発する際にエージェントへ抜け漏れなく依頼するためのテンプレートです。以下の項目を埋め、必要に応じて詳細を更新してください。

### 現行 MVP と製品ロードマップの境界

この章には、現行 MVP と Phase 2 以降の製品ロードマップを併記します。現行 MVP の実装・受け入れ判断は [`doc/implementation/MVP_CONTRACT.md`](doc/implementation/MVP_CONTRACT.md) を優先します。特に現行 MVP の削除は、詳細画面で確認 UI を表示した後に `DELETE /api/notes/:id` で物理削除し、削除後の Undo / 復元を保証しません。5 秒 Undo Snackbar、ソフトデリート、Undo buffer（`SoftDeleteBuffer`）、`/api/undo`、期限切れ後の purge は現行 MVP では提供せず、Phase 2 以降のロードマップです。

---

## 1. 製品概要

- **タイトル**: コーネルメソッドノート記録アプリ
- **利用想定**: ローカル環境での個人利用。認証・ユーザー管理は不要。
- **目的 / 成功条件**
  - コーネルメソッドのレイアウトでノートを作成・編集・閲覧できる。
  - Cue と Summary は Markdown（基本記法 + チェックボックス）で入力し、中央の本文領域はフリー入力 Canvas として文字・図形・線・ストロークを Prisma（SQLite）に永続化し、後から読み返せる。
  - 初期テンプレートはコーネルのみ。将来、追加テンプレートを拡張できる構造とする。
  - タイトルエリアでタグ付けし、タグによる検索フィルタが可能（タグは `Tag` テーブルで一元管理）。
  - 保存済みノートの一覧は日付ソート（昇順/降順切替）で閲覧できる。
  - 編集内容はドラフト自動保存され、手動保存で正式版に反映できる。

## 2. 機能要件（UI/UX）

- **共通**

  - 編集モードと閲覧モードをトグルで切り替え。編集モードではドラフト自動保存 + 明示的な保存/破棄ボタンを併用。
  - （Phase 2 以降のロードマップ）削除操作は確認モーダルが必須。削除後はスナックバーで 5 秒間 Undo を表示し復元を許可（Undo 期限まではソフトデリートで DB に退避）。
  - Cue と Summary の入力エリアは Markdown 文法（基本記法 + チェックボックス）を受け付け、エディタとプレビューを縦に並べて同時表示する。中央の本文領域は Markdown 本文欄ではなく、Canvas の直接操作面として扱う。
  - 編集中は 3 秒間入力が止まると差分のみドラフト保存（`isDraft=true` のまま DB 反映）。連続ドラフト保存は最短 6 秒間隔。楽観ロックで `updatedAt` が古い保存は 409 を返し、再読込を促す。
  - 409 競合時の UI：ドラフト保存（オートセーブ）はバナーで通知＋再読み込みボタン（自動保存は一時停止、編集は継続可）。確定保存（Cmd+S）はモーダルで再読み込み/後でを提示（自動保存は再読み込みまで停止）。
  - 「保存」ボタンで最終確定し `isDraft=false` へ更新。同時にドラフトステータスバッジを消す。ドラフト自体は 1 レコードを使い回し、同一ノートで 10 件以上 `isDraft=true` が残らないよう週次でクリーンアップバッチを走らせる。
  - 自動保存に失敗した場合はバナーで警告し、手動「再試行」ボタンのみ（自動リトライなし）。バナー表示中は自動保存送信を停止するが入力は継続可能。オフライン時も同様の運用。
  - キーボードショートカット：`Cmd+S` 保存、`Cmd+Z` 取り消し、`Cmd+Shift+Z` やり直し。`Cmd+N` はフォーカスしている欄に応じてカードを追加（キーワード欄ならキーワードカード、ノート欄ならノートカード）。どちらにもフォーカスがない場合は無効。
  - ショートカットは Cmd 系に加え Ctrl 系でも動作させる（例：Cmd+S / Ctrl+S）。

- **タイトルエリア**

  - タイトル、学習元、日付、タグのフィールドを配置する。
  - 日付選択はカレンダー UI で入力。手入力も許可する場合はフォーマットを YYYY-MM-DD に統一。
  - タグ入力欄を設置。既存タグのオートコンプリート + 新規追加に対応し、Notebook と Tag を中間テーブルで関連付ける。候補に存在しないタグはその場で `Tag` レコードを自動作成する。各ノートにつき最大 12 個までで、重複は UI/ロジックで弾く。
  - タグ仕様：長さ 1〜30 文字。使用可文字はひらがな・カタカナ・英数字・記号 `!"#$%&'()0=~|-^¥@[\`{;:]+\*},./<>?\_`のみ、空白はトリムし絵文字不可。色は任意入力可（デフォルト`#f59e0b`）。削除は確認付きでノート紐付けも同時解除。名称変更は既存ノートへ即時反映。

- **ノートエリア**

  - 横幅は 30%（キーワード） / 70%（ノート）の比率を基本とし、レスポンシブに調整。
  - **キーワード/質問欄**
    - カード形式で複数エントリを保持。＋ボタンで追加、－ボタンで個別削除（件数制限なし）。
    - 削除時は確認モーダルを表示。閲覧モードでもスクロールは可能。
    - カードはドラッグ＆ドロップで並び替え可能。`dnd-kit` ベースで実装し、ドロップ時に `order` を自動更新。
  - **本文領域（Canvas）**
    - Cue の右側にフリー入力 Canvas を置き、Canvas 上へ文字・図形・線・ストロークを自由に配置する。Cue と Summary は残し、本文をカードや Markdown 本文欄へ自動分割しない。
    - Canvas document は `CanvasDocumentV1` として保存し、`page.width` / `page.height` は可変の整数 px とする。既定値は幅 1200px、高さ 800px、許容範囲は各 320〜4000px。
    - 本文領域には幅・高さの数値入力と適用操作を置く。入力値は表示倍率ではなく用紙そのものの寸法であり、Fit / 50% / 100% / 200% は用紙サイズの選択肢にしない。
    - 用紙サイズを変更しても、既存要素の `x`, `y`, `width`, `height`, `points`, `style` を自動変更しない。境界外になる要素も削除・移動・縮小せず、Canvas JSON の要素データをそのまま保持する。
    - 保存・復元時は既存の Canvas JSON 保存領域を利用し、用紙サイズ変更だけを理由に Prisma migration を追加しない。既存の 1200x800 Canvas document は自動変換せず、そのまま復元する。

  - （Phase 2 以降のロードマップ）本文を NoteCard に分割し、Cue と本文を ID リンクして D&D 並び替え・hidden flag を持たせる案は、Canvas 本文の MVP 契約とは別に扱う。

- **サマリーエリア**

  - 要約と次アクションを記載する Markdown フィールド。スクロール可能。
  - Cue / Summary の Markdown プレビューのチェックボックスは表示専用 (`react-markdown` + `remark-gfm` + `rehype-sanitize`) とし、クリック時は `preventDefault` でエディタ側のみ変更可能に保つ。`react-markdown` の `components.input` を override して tailwind の design token（例: `accent-primary`, `border-muted`, `bg-surface`）に統一したスタイルを適用する。Canvas 本文はこの Markdown Preview の対象にしない。

- **一覧画面**

  - タイトル・日付（From/To 範囲）フィルタに加え、タグはトークナイザー型入力（フリーワード + サジェスト）で OR 条件絞り込み。候補リストは名前順で表示し、検索/オートコンプリート可能。最大 12 個まで追加（重複は自動で弾く）。タグの右クリックメニューから名称変更・削除を行える管理 UI を提供する。
  - 日付範囲は `react-day-picker` の range mode で開始・終了を設定。片側のみ指定した場合は「開始日以降」または「終了日以前」として扱い、ブランクは制限なしとみなす。From > To や無効日付はフォーカスアウト時と検索実行時にバリデーションしてエラー表示。クイックセレクトとして「今日」「過去 7 日」「過去 30 日」をボタンで提供。
  - 並び順は日付ソート（昇順/降順切替）に限定。
  - フリーワード検索はタイトル・既存 Markdown 本文・Summary・Cue に加え、Canvas 内の text 要素から生成した `searchText` を対象とする。用紙サイズだけを変更しても `searchText` は変化しない。
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
- Canvas 本文は共有の `CanvasDocumentV1` JSON 契約で扱う。描画ライブラリは保存形式を直接決めず、編集・閲覧 renderer と表示用の倍率を用紙サイズ・要素データから分離する。

## 4. 状態遷移 / ルーティング

| 画面         | パス例          | 主な状態                       | 備考                                 |
| ------------ | --------------- | ------------------------------ | ------------------------------------ |
| ノート一覧   | `/notes`        | 初期ロード / 検索中 / 結果表示 | ローカル検索（タイトル・日付・タグ） |
| ノート詳細   | `/notes/[id]`   | 閲覧 / 編集 / 保存中 / エラー  | モードトグル（Undo Snackbar は Phase 2 以降） |
| 新規作成     | `/notes/new`    | 初期テンプレロード / 下書き    | 保存後 `/notes/[id]` へ遷移          |
| バックアップ | `/notes/backup` | 最新 3 世代の一覧 / 再取得     | 自動コピーの履歴 + リトライボタン    |
| 復習タスク   | `/tasks/review` | タブ切替 / 完了操作            | 1 日後 / 1 週間後タスクの完了管理    |

- RSC + Client Component のハイブリッド。フォーム部分は Client Component。
- Phase 2 以降の Undo は Client 側で`setTimeout`管理し、期限切れ後は完全削除。
- `/notes/backup` は最新 3 世代のバックアップ一覧と、失敗時の再試行ボタン/ログ確認リンクを提供する。

## 5. データモデル / API

| テーブル                     | 主キー                               | 主な列                                                                                                                                                   | 備考                                                                                         |
| ---------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `notebooks`                  | `id` (cuid)                          | `title`, `body`, `body_mode`, `summary`, `note_date`, `source_type`, `source_title`, `next_review_date`, `reviewed_at`, `created_at`, `updated_at`, `deleted_at` | Prisma モデル名は `Notebook` だが、テーブル/カラムは snake_case で管理（日時は `DATETIME`）。`body_mode=canvas` では Canvas JSON を `notebook_canvases` に保持し、`body` は空文字とする。`deleted_at` は Phase 2 以降のソフトデリート用 |
| `notebook_canvases`         | `notebook_id` (PK=FK)                | `schema_version`, `document_json`, `search_text`, `created_at`, `updated_at` | `CanvasDocumentV1` の JSON と Canvas text 要素から抽出した一覧検索用 `search_text` を保持。用紙サイズは JSON 内の `page.width` / `page.height` で管理し、寸法変更用の別カラムは持たない |
| `notebook_draft_states`      | `notebook_id` (PK=FK)                | `is_draft`, `draft_updated_at`, `hidden_notes`, `version` (int), `autosave_version` (int)                                                                | Notebook と 1:1 の最新ドラフト専用テーブル。Notebook 作成時に必ず初期レコードを生成          |
| `notebook_review_progresses` | `notebook_id` (PK=FK)                | `review_status` (0=未レビュー,1=1 日後済,2=1 週間後済), `first_review_at`, `second_review_at`, `first_review_completed_at`, `second_review_completed_at` | Notebook 作成時に必ず初期レコードを生成する spaced repetition 用メタデータ                   |
| `tags`                       | `id`                                 | `name` (unique), `color` (任意), `created_at`                                                                                                            | タグ候補のマスタ                                                                             |
| `notebook_tags`              | `notebook_id`, `tag_id` (複合主キー) | -                                                                                                                                                        | Notebook と Tag の多対多中間                                                                 |
| `cue_cards`                  | `id`                                 | `notebook_id` FK, `marker`, `content`, `order`, `deleted_at`                                                                                             | Markdown: `content`。カード分割・`deleted_at` は Phase 2 以降 |
| `note_cards`                 | `id`                                 | `notebook_id` FK, `title`, `content`, `order`, `is_hidden`, `deleted_at`                                                                                 | Markdown: `content`。カード分割・`deleted_at` は Phase 2 以降 |
| `note_cue_links`             | `note_card_id`, `cue_card_id`        | `order` (任意)                                                                                                                                           | CueCard と NoteCard の多対多中間。DB が参照整合性を担保する                                  |
| `soft_delete_buffers`        | `id`                                 | `entity_type` (`notebook`/`cue`/`note`), `entity_id`, `undo_expires_at`, `created_at`, `purged_at`                                                       | Phase 2 以降の Undo 用ソフトデリート領域。ID と種別のみ保持し、実データは各テーブルの `deleted_at` で管理 |
| `backup_logs`                | `id`                                 | `executed_at`, `status` (`success`/`failure`), `error_message`                                                                                           | 自動/手動バックアップのログ。`/notes/backup` で最新順に表示                                  |

- （Phase 2 以降のロードマップ）Notebook は確定版の永続化のみを担い、ドラフトや復習、Undo 等の周辺責務はそれぞれ `NotebookDraftState`、`NotebookReviewProgress`、`SoftDeleteBuffer` が担当する。Notebook 作成時に `NotebookDraftState` / `NotebookReviewProgress` の初期レコードも同時生成し、以降は 1:1 リレーションを維持する。Notebook 保存時は関連テーブルを Prisma のトランザクションで一括更新する（スロークエリが問題になる場合のみ分割を検討）。
- 復習タスクはノート作成時に `first_review_at = note_date + 1 day`, `second_review_at = note_date + 7 days` を算出して `notebook_review_progresses` に保存し、`review_status` に応じて「1 日後」「1 週間後」タブに振り分ける。
- （Phase 2 以降のロードマップ）Notebook/CueCard/NoteCard など削除対象は `deletedAt` によるソフトデリートを採用し、Undo 期限内はレコードを保持する。期限切れまたは明示破棄で `deletedAt IS NOT NULL` のレコードを物理削除する。
- `NoteCueLink` に CueCard との関連を移したことで、ノート本文更新と関連付け更新を別トランザクションにでき、DB 側で外部キー制約が機能する。
- Draft のバージョニングは `version`（確定保存時に +1）と `autosave_version`（自動保存時に +1）を分離し、比較時は `version.autosave_version` を文字列連結して扱う。確定保存時は `version` をインクリメントして `autosave_version` を 0 にリセット、自動保存時は `autosave_version` のみ増やす。

- クリーンアップ方針

  - （Phase 2 以降のロードマップ）アプリ起動時に Prisma 経由で `draftUpdatedAt` から 30 日以上経過した `NotebookDraftState` を削除し、同時に `soft_delete_buffers` の `undo_expires_at < now()` を物理削除する（ログ保持なし）。
  - （Phase 2 以降のロードマップ）同タイミングで `deleted_at` が 30 日以上前の Notebook/CueCard/NoteCard を完全削除し、復元不可にする。

- API 例
  - `GET /api/notes?query=...`
  - `GET /api/notes/:id`
  - `POST /api/notes`
  - `PATCH /api/notes/:id`
  - `DELETE /api/notes/:id`（現行 MVP は確認後に物理削除。soft delete 版は Phase 2 以降）
  - `GET /api/review-tasks?type=day|week`（`first_review_at` / `second_review_at` と `review_status` でフィルタ）
  - `PATCH /api/review-tasks/:notebookId`（チェックボックス完了時に `review_status` と完了日時を更新）
  - `POST /api/tags`（一覧用）、ただし通常はノート編集時に未登録タグを自動作成
- `POST /api/notes` / `PATCH /api/notes/:id` の Canvas 入力は `bodyMode: "canvas"` と `canvas: CanvasDocumentV1` を受け付ける。保存時は既存 Canvas JSON 領域へ `documentJson` を保存し、`searchText` は text 要素から再生成する。`GET /api/notes/:id` の詳細・編集・閲覧・復習では保存済み Canvas document をそのまま返し、用紙サイズ変更による要素の自動変形を行わない。
- `POST /api/notes` / `PATCH /api/notes/:id` は Notebook（確定版）と `NotebookDraftState`（自動保存）を並行して更新する。同じリクエスト body に `{ notebook: {...}, draft: {...} }` を含め、ドラフトのみ保存時は `draft` 部分だけを更新し、確定保存時に両方を更新する。ドラフトのバージョンは `version`（整数）と `autosave_version`（整数）を組み合わせて管理し、リクエストで送信された値と DB の値が一致した場合のみ更新する。不一致時は 409 を返し、`errors: [{ field: "draft.version", message: "outdated" }]` などフィールドを明示する。自動保存時は `autosave_version` のみ +1、確定保存時は `version` を +1 して `autosave_version=0` にリセットする。
- （Phase 2 以降のロードマップ）`DELETE` 系 API は直ちにレコードを消さず `deletedAt` を設定し、`SoftDeleteBuffer` に ID/種別を記録する。Undo 期限内であれば `deletedAt=NULL` に戻して復元できる。期限切れまたは明示的な破棄で初めて物理削除する。
- （Phase 2 以降のロードマップ）Undo は送信がシンプルな `POST /api/undo` を定義し、ボディに `{ entityType, entityId }` を渡すと `SoftDeleteBuffer` から対象を復元する。期限切れまたは存在しない場合は 410 を返す。
- バックアップ画面向けに `GET /api/backups`（最新 3 世代 + 失敗履歴 + ログサマリ）、`POST /api/backups/retry`（失敗分の再試行）、`GET /api/backups/logs`（`backup_logs` テーブルを参照）を用意する。`POST /api/backups/retry` は `npm run backup:copy` と同じコマンドをキックする。
- ノート保存時に未登録タグが自動作成された場合、レスポンスに `{ createdTags: Tag[] }` を含めて UI が即座に反映できるようにする。
- すべての API でエラーは JSON 形式に統一し、`{ code, message, errors? }` を返す。バリデーションや 409 競合エラー時は `errors: [{ field, message }]` でフィールド単位の詳細を含める。ドラフト競合時は `field` を `draft.version` または `draft.autosave_version` として返す。
- `GET /api/notes` のクエリは `?query`, `?tags=tag1,tag2`, `?from`, `?to`, `?page`（1 始まり）を受け取り、`tags` は OR 条件で重複タグはロジック側で除外する。1 ページ 50 件固定でページングし、レスポンスには `page`, `totalPages`, `totalCount` を含める。
- 期間指定エクスポートはクライアント側で HTML を生成し、`/api/notes/export?from=...&to=...` などの API でノートデータをまとめて取得して実行する。
- 一覧/復習タスク API は 2000ms を目安に応答し、タイムアウトした場合はエラー JSON を返す。データ量増加で超過する場合は見直しを検討。
- API 呼び出しは Next.js App Router のキャッシュ（`fetch` のデフォルトキャッシュ/SWR 相当）を利用し、追加のサーバーサイドキャッシュは設けない。復習タスクのバッジ更新は画面リロード時に最新状態を取得する。
- バリデーション（タイトル/サマリーはフォーカスアウトと保存時に検証）
  - タイトル: 1〜120 文字
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

- [x] ノートの一覧 → 詳細 → 編集 → 保存 → 閲覧の操作デモ（動画 or GIF）
- [x] `npm run lint` が成功
- [x] Prisma migrate / seed 手順を README に記載
- [x] 主要画面のスクリーンショットを README へ追加

## 10. 未決事項 / ToDo

- 保留案 / 将来構想: AI による自動復習クイズ生成
  - これは現時点では実装予定ではなく、MVP / Phase 2 の既存実装タスクには混ぜない。
  - AI クイズは、ノート詳細の復習モード内で解く想起支援機能とする。復習タスク画面は、今日復習すべきノートへ誘導する入口として扱う。
  - 一般的な Cornell Method に合わせ、復習時は左側の Cue / キーワード / 質問を表示し、右側本文を隠す前提にする。
  - AI クイズは左側 Cue を出題軸・ヒントとして使い、右側本文やサマリーの理解を問う。左側に見えている語句そのものが答えになる問題は極力避ける。
  - 初期形式は一問一答と穴埋めを中心にする。
  - 選択式は、答えが長い場合や理解確認に向く場合に限り、拡張形式として検討する。誤答選択肢の品質管理と誤学習防止を設計条件に含める。
  - 採点ではなく答え合わせを目的とする。解答後に正答、根拠、解説を表示する。一問一答 / 穴埋めでは厳密な自動採点を必須にしない。選択式を採用する場合のみ選択肢ベースの正誤判定を検討する。
  - 初期の生成タイミングは、ユーザーが「クイズ生成」ボタンを押したときにする。保存後バックグラウンド生成は、将来 Vercel など外部展開やジョブ基盤を検討する段階で再評価する。
  - 初期保存モデルは、保存しないオンデマンド生成にする。
  - 将来保存する場合は、同じクイズの固定再利用ではなく、生成を続けてクイズ候補プールを増やす。復習時は候補プールからランダムまたは条件付きで 5〜10 問を出題する。
  - 将来の実現方式は、Rust API 実装が完了した後、Rust 側で Local LLM を扱う方針を第一候補にする。外部 API は利用しない。
  - 初期はモデル自体を学習させるのではなく、ノート、Cue、サマリー、生成クイズ、復習結果を蓄積し、Local LLM に渡す知識ベースを育てる。
  - 将来的には、十分なデータが蓄積された段階で、モデル自体の追加学習 / fine-tuning に挑戦する余地を残す。

- 保留案 / 将来構想: Local LLM による Cue / キーワード / 質問の不足候補提案
  - これは現時点では実装予定ではなく、MVP / Phase 2 の既存実装タスクには混ぜない。
  - Cornell Method では、ユーザー自身が重要点を選び、左側の Cue / キーワード / 質問として整理する行為自体が学習体験として重要である。
  - AI は左側を自動入力しない。ユーザーが先に自分で Cue / キーワード / 質問を書いた後、本文・サマリー・既存 Cue を見て、不足していそうな候補を提案する補助に留める。
  - 候補は、重要概念、問いに変換できる論点、既存 Cue と重複しないキーワードなどを対象にする。
  - ユーザーは候補を `追加` / `編集して追加` / `無視` できる。候補は自動採用せず、ユーザーの判断を必ず挟む。
  - AI クイズは復習時の想起支援であり、AI Cue 候補提案はノート整理時または復習前の整理支援として扱う。両者は別の将来構想として設計する。

---

追加の要件や決定事項が出た場合は、本テンプレートに追記・更新してください。
