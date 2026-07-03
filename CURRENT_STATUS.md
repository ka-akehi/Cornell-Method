# CURRENT_STATUS

確認日: 2026-07-02

## 位置づけ

この文書は、後続の Manager / Worker が現在地を誤認しないための、リポジトリ直下の現状サマリです。

参照した主な情報源は `AGENTS.md`, `HANDOFF_2026-06-22.md`, `doc/README.md`, `doc/implementation/IMPLEMENTATION_STATUS.md`, `doc/implementation/MVP_IMPLEMENTATION_TASKS.md`, `doc/testing/TEST_SCENARIOS.md`, `prisma/schema.prisma`, `src/app/**`, `src/lib/**`, `scripts/**`, `package.json` です。

重要: `AGENTS.md` は最終仕様の正本です。一方で、現コードは `doc/testing/TEST_SCENARIOS.md` が定義する MVP 寄りの構成に近く、`doc/implementation/IMPLEMENTATION_STATUS.md` には現コードより進んだ内容が含まれている可能性があります。この文書では、現コードで確認できたものだけを実装済みとして扱います。

## 設計済みの範囲

### 最終仕様として設計済み

`AGENTS.md` には、以下を含む Phase 2 相当までの最終仕様が整理されています。

- ノート一覧、詳細、新規作成、バックアップ、復習タスクの画面構成。
- Markdown 入力、チェックボックス preview、タグ管理、日付範囲フィルタ、日付ソート。
- ドラフト自動保存、409 楽観ロック、確定保存、破棄、削除後 5 秒 Undo。
- CueCard / NoteCard / NoteCueLink によるカードモデルと D&D 並び替え。
- `NotebookDraftState`, `NotebookReviewProgress`, `SoftDeleteBuffer`, `BackupLog` を含む周辺テーブル。
- `/api/review-tasks`, `/api/undo`, `/api/backups/retry`, `/api/backups/logs`, `/api/notes/export` などの API。
- Playwright による PDF エクスポート。
- `/tasks/review` の専用復習タスク画面とグローバルナビの未完タスクバッジ。
- `/notes/backup` のバックアップ画面、失敗履歴、ログ確認リンク。

### MVP 設計として設計済み

`doc/README.md` によると、MVP 設計は以下のカテゴリで整理済みです。

- 要件: `doc/requirements/`
- 業務フロー: `doc/workflows/`
- 画面設計: `doc/screens/`
- API 設計: `doc/api/`
- データ設計: `doc/data/`
- 技術設計: `doc/technical/`
- 図面: `doc/diagrams/`
- テスト観点: `doc/testing/`
- 実装タスク: `doc/implementation/`

`doc/implementation/MVP_IMPLEMENTATION_TASKS.md` は 2026-06-15 時点の MVP 実装順序として、DB/API 先行を推奨し、Prisma schema、validation、notes API、tags API、backup API、layout、Markdown preview、note form、notes list、detail modes、backup screen、test/update、README、final verification の順に分割しています。

`doc/testing/TEST_SCENARIOS.md` は、MVP では明示保存、物理削除、手動復習予定、`textarea + Markdown preview`, `/notes` の復習対象フィルタ、`/backup` の手動バックアップを確認対象にしています。自動保存、Undo、PDF、専用復習タスク、D&D、NoteCard、タグ管理 UI、バックアップログ、高機能 Markdown エディタ、ショートカットは Phase 2 / 将来確認へ分離されています。

## 現コードで確認できる実装済みの範囲

### 技術基盤

- Next.js App Router 構成が存在します。
- Prisma + SQLite 用の Prisma schema と `src/lib/prisma.ts` が存在します。
- `package.json` には Next.js 16, React 19, Prisma 7, Tailwind 4, Zod, react-markdown, remark-gfm, rehype-sanitize などが定義されています。
- `@uiw/react-md-editor`, `@dnd-kit/*`, `react-day-picker`, `playwright` は依存に含まれますが、今回確認した `src/app/**` では実利用を確認していません。

### DB モデル

`prisma/schema.prisma` で確認できるモデルは次の範囲です。

- `Notebook`
  - `title`, `noteDate`, `sourceType`, `sourceTitle`, `overview`, `body`, `summary`, `nextReviewDate`, `reviewedAt`, `createdAt`, `updatedAt`, `deletedAt`
- `Tag`
- `NotebookTag`
- `Cue`

現 schema は MVP 寄りです。最終仕様の `NotebookDraftState`, `NotebookReviewProgress`, `SoftDeleteBuffer`, `BackupLog`, `CueCard`, `NoteCard`, `NoteCueLink` は確認できません。

### API

現コードで確認できる API は次の通りです。

- `GET /api/notes`
  - `query`, `tag`, `from`, `to`, `reviewDue`, `page` を扱います。
  - 1 ページ 50 件で `page`, `totalPages`, `totalCount`, `data` を返します。
  - タイトル、概要、本文、サマリー、Cue を検索対象にしています。
  - タグは OR 条件で絞り込みます。
  - `reviewDue=true` は `nextReviewDate <= today` を対象にします。
- `POST /api/notes`
  - Notebook 作成、Cue 作成、Tag upsert、NotebookTag 作成をトランザクションで実行します。
- `GET /api/notes/:id`
  - Notebook 詳細、Cue、Tag を返します。
- `PATCH /api/notes/:id`
  - Notebook を更新し、Cue と Tag 関連は全置換します。
- `DELETE /api/notes/:id`
  - Prisma の `delete` を呼び、物理削除しています。
- `POST /api/notes/:id/review`
  - `reviewedAt` と任意の `nextReviewDate` を更新します。
- `GET /api/tags`
  - タグ候補を名前順で返します。
- `GET /api/backups`
  - `backup/` 配下の最新 3 世代を返します。
- `POST /api/backups`
  - SQLite DB ファイルをコピーして最新 3 世代に prune します。

エラー形式は Zod validation と not found / server error で `{ code, message, errors? }` に概ね統一されています。

### UI

現コードで確認できる画面は次の通りです。

- `/`
  - `/notes` へ redirect します。
- 共通 layout
  - `/notes`, `/notes/new`, `/backup` へのナビゲーションがあります。
- `/notes`
  - ノート一覧、フリーワード検索、From/To 日付フィルタ、タグ OR フィルタ、復習対象のみフィルタ、ページング、空状態、loading/error 表示があります。
  - 日付範囲は `<input type="date">` で、`react-day-picker` の range mode ではありません。
  - 日付ソート切替 UI は確認できません。API は `noteDate desc`, `updatedAt desc` 固定です。
- `/notes/new`
  - `NoteEditor` による新規作成フォームがあります。
- `/notes/[id]`
  - 閲覧、編集、復習のモードがあります。
  - 復習モードでは本文を非表示にし、手動で表示できます。
  - 復習済み更新で `reviewedAt` と `nextReviewDate` を更新できます。
  - 削除は `window.confirm` で確認し、成功後 `/notes` へ戻ります。
- `/backup`
  - バックアップ一覧、手動作成、一覧更新、loading/error/success 表示があります。

### 入力・Markdown

- `MarkdownField` は textarea と `react-markdown` preview の縦並びです。
- `remark-gfm` と `rehype-sanitize` が使われています。
- preview の checkbox は `readOnly`, `tabIndex={-1}`, `preventDefault` で表示専用にされています。
- `@uiw/react-md-editor` の利用は確認できません。

### バックアップ

- `scripts/backup-copy.js` と `src/lib/backup/index.js` が存在します。
- `npm run backup:copy` は `backup/` 配下へ DB ファイルをコピーします。
- 最新 3 世代保持の prune 実装があります。
- バックアップログ DB 連携や retry 専用 API は確認できません。

## 現コードで未実装または未確認の範囲

以下は `AGENTS.md` の最終仕様にはありますが、今回の現コード確認では実装を確認できませんでした。

- `NotebookDraftState` / `NotebookReviewProgress` / `SoftDeleteBuffer` / `BackupLog` テーブル。
- `CueCard` / `NoteCard` / `NoteCueLink` のカードモデル。
- ドラフト自動保存、3 秒アイドル、6 秒間隔、409 楽観ロック、再読み込みバナー、確定保存時モーダル。
- 削除後 5 秒 Undo Snackbar、`POST /api/undo`。
- ソフトデリート。現 `DELETE /api/notes/:id` は物理削除です。
- 起動時クリーンアップバッチ。
- `/tasks/review` 画面、`GET /api/review-tasks`, `PATCH /api/review-tasks/:notebookId`。
- グローバルナビの復習タスク未完バッジ。
- `/api/notes/export?from&to` の PDF エクスポート。
- `/api/backups/retry`, `/api/backups/logs`。
- `/notes/backup` ルート。現コードは `/backup` です。
- `@uiw/react-md-editor` ベースのエディタ UI。
- `react-day-picker` range mode、今日/過去7日/過去30日のクイックセレクト。
- D&D 並び替え。
- Cmd/Ctrl+S, Cmd/Ctrl+N, Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z のショートカット。
- タグの既存候補オートコンプリート付き作成フォーム、色入力、右クリック名称変更/削除 UI。
- タグ削除時の確認と既存ノート紐付け解除。
- ノート欄全体の閲覧モード非表示、NoteCard 単位の hidden flag。
- バックアップのアプリ起動時自動コピー。
- README への migrate / seed / 操作デモ / スクリーンショット追記は今回未確認です。

## `AGENTS.md` 最終仕様と現コードの主な差分

| 項目 | `AGENTS.md` 最終仕様 | 現コードで確認できた状態 |
| --- | --- | --- |
| DB | Draft / ReviewProgress / SoftDeleteBuffer / BackupLog / NoteCard 系まで含む | Notebook / Tag / NotebookTag / Cue の MVP 寄り |
| ノート本文 | NoteCard 複数カード、Cue との多対多リンク | Notebook.body 1 フィールド |
| Cue | CueCard モデル、D&D 並び替え、削除確認 | Cue モデル、フォーム上の追加/削除のみ |
| 削除 | ソフトデリート + Undo 5 秒 | `delete` による物理削除 |
| 自動保存 | 3 秒アイドル + 最短 6 秒 + 409 制御 | 未確認。手動保存のみ |
| 復習 | `/tasks/review` と review status | 詳細画面内の手動復習モード、`nextReviewDate` / `reviewedAt` |
| バックアップ画面 | `/notes/backup`, retry, logs | `/backup`, 手動作成と一覧 |
| PDF | `/api/notes/export?from&to` | 未確認 |
| Markdown editor | `@uiw/react-md-editor` | textarea + `react-markdown` preview |
| 日付 picker | `react-day-picker` range mode | `<input type="date">` |
| 一覧ソート | 昇順/降順切替 | desc 固定 |
| タグ管理 | autocomplete、新規作成、色、名称変更、削除 | 編集フォーム内の自由入力、保存時 upsert、一覧側は select 候補 |
| ショートカット | Cmd/Ctrl 系保存・追加・undo/redo | 未確認 |

## ドキュメント間の同期ズレ

### `doc/implementation/IMPLEMENTATION_STATUS.md`

この文書は現コードより進んだ内容を実装済みとして書いている可能性が高いです。特に以下は現コード確認と食い違います。

- 「ソフトデリート＋ Undo バッファ」実装済みと書かれていますが、現 schema に `SoftDeleteBuffer` はなく、`DELETE /api/notes/:id` は物理削除です。
- 「ドラフト版の楽観ロック」「version / autosaveVersion 分離」実装済みと書かれていますが、現 schema に draft state や version 列はありません。
- 「復習タスク API」実装済みと書かれていますが、`src/app/api/review-tasks` は確認できません。
- 「Undo API」実装済みと書かれていますが、`src/app/api/undo` は確認できません。
- 「PDF エクスポート」実装済みと書かれていますが、`src/app/api/notes/export` は確認できません。
- 「バックアップ API（再試行）」実装済みと書かれていますが、現コードは `GET/POST /api/backups` で、`POST /api/backups/retry` は確認できません。
- 「復習タスク画面」実装済みと書かれていますが、`src/app/tasks/review` は確認できません。
- 「ノートカード追加・D&D 並び替え」「Cmd/Ctrl+S」「3 秒アイドル自動保存」実装済みと書かれていますが、今回確認した `NoteEditor` では未確認です。

後続作業では、`IMPLEMENTATION_STATUS.md` を根拠に「実装済み」と判断せず、必ず現コードで裏取りしてください。

### `doc/testing/TEST_SCENARIOS.md`

`TEST_SCENARIOS.md` は現コードとかなり近い MVP 前提で整理されていますが、最終仕様とは意図的にズレています。

- MVP 確認対象は `/backup` ですが、`AGENTS.md` の最終仕様は `/notes/backup` です。
- MVP では物理削除を確認対象にしていますが、`AGENTS.md` の最終仕様はソフトデリート + Undo です。
- MVP では手動復習予定を確認対象にしていますが、`AGENTS.md` の最終仕様は `NotebookReviewProgress` と `/tasks/review` です。
- MVP では `textarea + Markdown preview` を確認対象にしていますが、`AGENTS.md` の最終仕様は `@uiw/react-md-editor` です。

これは単純な誤りというより、「MVP と最終仕様の層が違う」ことによるズレです。次の作業では、MVP 継続か最終仕様への拡張かを先に決める必要があります。

## 重要な分岐点

### 1. 何を決める必要があるか

次の実装方針を「MVP を安定させる」か「`AGENTS.md` 最終仕様へ拡張する」か。

### 選択肢

| 選択肢 | 内容 |
| --- | --- |
| A: MVP 安定化 | 現 schema / 現 UI を前提に、`doc/testing/TEST_SCENARIOS.md` の MVP 項目を通す |
| B: 最終仕様へ拡張 | Draft / Undo / ReviewProgress / NoteCard / PDF などを `AGENTS.md` に合わせて追加する |

### 各選択肢の影響

| 観点 | A: MVP 安定化 | B: 最終仕様へ拡張 |
| --- | --- | --- |
| 手戻り | 少ない | DB/API/UI の再設計が必要 |
| 早く動くもの | 作りやすい | 時間がかかる |
| 最終仕様との差 | 残る | 縮まる |
| Worker 分割 | 小さく切りやすい | 依存順を厳密に切る必要がある |
| リスク | ドキュメント差分が残る | migration と UI 変更の影響が大きい |

### Manager 推奨

まず **A: MVP 安定化** を推奨します。

理由は、現コードが MVP 前提でかなり組まれており、いきなり最終仕様の Draft / Undo / NoteCard へ進むと DB と UI の変更範囲が大きくなるためです。MVP の lint/build/API/主要手動フローを安定させたうえで、最終仕様との差分を Phase 2 task として順に切る方が判断しやすいです。

### 2. 何を決める必要があるか

バックアップ画面の正式ルートを `/backup` のままにするか、最終仕様どおり `/notes/backup` へ寄せるか。

### 選択肢

| 選択肢 | 内容 |
| --- | --- |
| A: `/backup` 継続 | 現コードと `TEST_SCENARIOS.md` を維持する |
| B: `/notes/backup` へ変更 | `AGENTS.md` の最終仕様へ合わせる |
| C: 両方対応 | `/backup` を互換 redirect にし、正式ルートを `/notes/backup` にする |

### 各選択肢の影響

| 観点 | A | B | C |
| --- | --- | --- | --- |
| 変更量 | 最小 | 中 | 中 |
| 最終仕様との一致 | 低い | 高い | 高い |
| 既存テスト観点との一致 | 高い | 低い | 中 |
| 利用者影響 | なし | URL 変更 | 小さい |

### Manager 推奨

Phase 2 に進むタイミングで **C: 両方対応** を推奨します。今すぐ MVP 安定化を優先するなら `/backup` 継続でよいですが、最終仕様へ寄せる際は `/backup` を redirect として残すと混乱が少ないです。

### 3. 何を決める必要があるか

削除仕様を現 MVP の物理削除のままにするか、最終仕様のソフトデリート + Undo に変更するか。

### 選択肢

| 選択肢 | 内容 |
| --- | --- |
| A: 物理削除を維持 | 現 `DELETE` のまま進める |
| B: Notebook のみソフトデリート | `deletedAt` を使い、まずノート単位だけ Undo 可能にする |
| C: Notebook / Cue / NoteCard まで含めて最終仕様化 | `SoftDeleteBuffer` と周辺モデルを一括で整える |

### 各選択肢の影響

| 観点 | A | B | C |
| --- | --- | --- | --- |
| 実装量 | 最小 | 中 | 大 |
| データ復旧性 | 低い | 中 | 高い |
| 最終仕様との一致 | 低い | 中 | 高い |
| 依存関係 | 少ない | Undo UI/API が必要 | NoteCard 設計にも依存 |

### Manager 推奨

MVP 安定化後に **B: Notebook のみソフトデリート** を最初の Phase 2 task として切るのを推奨します。いきなり C へ進むと NoteCard など未実装モデルにも波及し、差分が大きくなります。

## 次に切るべき Worker task 候補と推奨順

1. `current-status-sync-implementation-status`
   - 目的: `doc/implementation/IMPLEMENTATION_STATUS.md` を現コードに合わせて修正する。
   - 理由: 現状、最も誤認リスクが高い文書です。今回作成した `CURRENT_STATUS.md` を起点に、実装済み/未実装を再分類するのがよいです。

2. `mvp-verification-lint-build`
   - 目的: `npm run lint`, `npm run build`, 必要に応じて `npm run prisma:generate` を実行し、MVP 現コードの壊れを洗い出す。
   - 理由: 実装範囲の棚卸し後は、まず現コードがビルド可能かを確認する必要があります。

3. `mvp-api-smoke-test`
   - 目的: `GET/POST/PATCH/DELETE /api/notes`, `POST /api/notes/:id/review`, `GET /api/tags`, `GET/POST /api/backups` の最小疎通を確認する。
   - 理由: UI より先に DB/API の実挙動を固めると、後続 UI 修正の前提が安定します。

4. `mvp-test-scenarios-sync`
   - 目的: `doc/testing/TEST_SCENARIOS.md` を現コードと最終仕様のどちらに合わせるか整理し、必要なら MVP / Phase 2 の境界を更新する。
   - 理由: 現状は MVP と最終仕様の違いが表現されていますが、`AGENTS.md` 更新後の最終判断との整合を再確認した方がよいです。

5. `readme-setup-prisma-backup-update`
   - 目的: README にセットアップ、Prisma generate/migrate、バックアップ、主要ルートを追記する。
   - 理由: 受け入れ条件に README 更新があり、次の利用者/Worker の立ち上がりに効きます。

6. `phase2-soft-delete-undo-design-task`
   - 目的: `SoftDeleteBuffer` と Undo を実装する前に、Notebook のみから始めるか、Cue/NoteCard まで含めるかを設計タスクとして決める。
   - 理由: DB migration を伴うため、仕様判断なしに実装へ入ると手戻りが大きいです。

7. `phase2-review-tasks-design-task`
   - 目的: 現 `nextReviewDate/reviewedAt` 方式から `NotebookReviewProgress` + `/tasks/review` 方式へ移行する設計を固める。
   - 理由: 復習仕様は MVP と最終仕様でデータモデルが大きく違います。

8. `phase2-note-card-dnd-design-task`
   - 目的: 現 `Notebook.body` 方式から NoteCard / CueCard / NoteCueLink 方式へ移行する範囲と migration 方針を決める。
   - 理由: UI と DB の両方に影響する最大級の変更です。

9. `future-ai-quiz-generation-design`
   - 目的: AI 自動復習クイズ生成は、ノート詳細の復習モード内で解く想起支援機能として扱う将来構想です。復習タスク画面は今日復習すべきノートへ誘導する入口とし、復習時は Cornell Method に合わせて左側の Cue / キーワード / 質問を表示し、右側本文を隠す前提にします。AI クイズは左側 Cue を出題軸・ヒントにしつつ、右側本文やサマリーの理解を問います。左側に見えている語句そのものが答えになる問題は極力避けます。
   - 出題・答え合わせ方針: 初期形式は一問一答と穴埋めを中心にします。選択式は、答えが長い場合や理解確認に向く場合に限る拡張形式として検討し、誤答選択肢の品質管理と誤学習防止を設計条件に含めます。採点ではなく答え合わせを目的とし、解答後に正答、根拠、解説を表示します。一問一答 / 穴埋めでは厳密な自動採点を必須にせず、選択式を採用する場合のみ選択肢ベースの正誤判定を検討します。
   - 生成・保存方針: 初期の生成タイミングはユーザーが「クイズ生成」ボタンを押したときにし、保存しないオンデマンド生成から始めます。保存後バックグラウンド生成は、将来 Vercel など外部展開やジョブ基盤を検討する段階で再評価します。将来保存する場合は、同じクイズの固定再利用ではなく、生成を続けてクイズ候補プールを増やし、復習時にランダムまたは条件付きで 5〜10 問を出題します。
   - 実現方式: 外部 API は使いません。将来の実現方式は、Rust API 実装が完了した後、Rust 側で Local LLM を扱う方針を第一候補にします。初期はモデル自体を学習させず、ノート、Cue、サマリー、生成クイズ、復習結果を蓄積して Local LLM に渡す知識ベースを育てます。十分なデータが蓄積された段階で、モデル自体の追加学習 / fine-tuning に挑戦する余地を残します。
   - 理由: 想起支援としての設計、ローカル AI の性能、モデル配布方法、ストレージ、生成品質、採点方式、誤学習防止を先に比較する必要があります。MVP 安定化や既存 Phase 2 より優先する実装タスクではありません。

10. `future-ai-cue-suggestion-design`
   - 目的: Local LLM による Cue / キーワード / 質問の不足候補提案は、ノート整理時または復習前の整理支援として扱う将来構想です。Cornell Method では、ユーザー自身が重要点を選んで左側を整理する行為が学習体験として重要なため、AI は左側を自動入力しません。
   - 体験方針: ユーザーが先に本文、サマリー、Cue / キーワード / 質問を書いた後、AI が本文・サマリー・既存 Cue を見て、不足していそうな重要概念、問いに変換できる論点、既存 Cue と重複しないキーワードを候補として出します。候補は `追加` / `編集して追加` / `無視` でき、自動採用はしません。
   - AI クイズとの関係: AI クイズは復習時の想起支援、AI Cue 候補提案はノート整理時または復習前の整理支援です。両者は別の将来構想として扱い、MVP 安定化や既存 Phase 2 より優先する実装タスクではありません。

## 次回作業時の最小 Next Read

次回この整理を起点に作業する場合は、まず以下を読んでください。

1. `CURRENT_STATUS.md`
2. `AGENTS.md`
3. `doc/testing/TEST_SCENARIOS.md`
4. 実装作業なら対象に応じて `prisma/schema.prisma`, `src/app/api/**`, `src/app/notes/_components/**`
5. 実装状況文書を直す task なら `doc/implementation/IMPLEMENTATION_STATUS.md`

## 今回の確認で実行した主なコマンド

- `git status --short`
- `sed` による指定ドキュメントと対象コードの読み取り
- `find src/app -maxdepth 4 -type f`
- `find src/lib -maxdepth 4 -type f`
- `rg --files src/app src/lib scripts`
- `rg` による未実装候補 API / model / UI キーワード確認

raw log はこの文書に含めていません。判断に必要な要約のみを記録しています。
