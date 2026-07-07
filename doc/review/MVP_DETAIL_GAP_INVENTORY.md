# MVP Detail Gap Inventory

作成日: 2026-07-04
更新日: 2026-07-05

## 目的

MVP 要件・設計・テスト観点と現コードを直接照合し、次の Worker 実装 task に切れる粒度で差分を整理する。

この棚卸しでは `doc/implementation/IMPLEMENTATION_STATUS.md` を実装済み判断の根拠にしていない。現コード確認は `src/app/**`, `src/lib/**`, `prisma/schema.prisma`, `scripts/**`, `package.json`, `README.md` を対象にした。

2026-07-05 更新では、主要 UI フロー再検証、API CRUD / validation / backup 再検証、Markdown sanitize / checkbox 検証、`npm run backup:copy` 検証、`npm run lint` / `npm run build` の PASS 結果を反映した。確認根拠は `summary/20260705/mvp-ui-flow-reverification-report.md`、`summary/20260705/manager-mvp-api-crud-validation-backup-reverification-report.md`、`summary/20260705/manager-markdown-sanitize-checkbox-verification-report.md`、`summary/20260705/backup-copy-command-verification-report.md`、`summary/20260705/manager-fix-ui009-note-editor-tag-candidates-summary.md`、`summary/20260705/manager-fix-ui014-edit-save-state-summary.md`、`HANDOFF_2026-07-06.md`。

## 参照した MVP 設計書

- `CURRENT_STATUS.md`
- `doc/requirements/MVP_SYSTEM_SPEC.md`
- `doc/screens/MVP_SCREEN_DESIGN.md`
- `doc/screens/MVP_SCREEN_INVENTORY.md`
- `doc/api/MVP_API_DESIGN.md`
- `doc/data/MVP_DATA_DESIGN.md`
- `doc/technical/MVP_TECHNICAL_DESIGN.md`
- `doc/testing/TEST_SCENARIOS.md`

## 判定基準

| 判定 | 意味 |
| --- | --- |
| OK | MVP 設計上の期待に対して、現コードで実装を確認できた |
| Gap | MVP 設計上の期待に対して、不足または不一致を現コードで確認した |
| Unknown | コード静的確認だけでは挙動確認が不足している |
| MVP外 | MVP 設計書で Phase 2 / 将来扱いとされており、MVP 不足として扱わない |

## 詳細棚卸し

| ID | 領域 | 設計上の期待 | 現コードで確認できた状態 | 判定 | 推奨 next task | queue 推奨 | 優先度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UI-001 | UI | `/` は `/notes` へ誘導する | `src/app/page.tsx` で `redirect("/notes")` | OK | なし | tasks-ui | Low |
| UI-002 | UI | 共通ナビに `/notes`, `/notes/new`, `/backup` を表示する | `src/app/layout.tsx` に 3 導線あり | OK | なし | tasks-ui | Low |
| UI-003 | UI | `/notes` にフリーワード、日付 From/To、タグ OR、復習対象フィルタ、ページングを置く | `NotesList` に該当 UI とページ移動あり。2026-07-05 UI フロー再検証で query/date/tag filter が PASS | OK | 主要条件は確認済み。ページング境界は必要時に追加確認 | tasks-ui | Low |
| UI-004 | UI | `/notes` で From > To は validation error を表示する | `NotesList` が onBlur / 検索時に `dateError` を表示。2026-07-05 UI フロー再検証で PASS | OK | 確認済み | tasks-ui | Low |
| UI-005 | UI | `/notes` のタグフィルタは OR 条件、重複追加を防止する | 既存タグ select + selectedTags Set で重複防止。API へ `tag=a,b` 送信 | OK | タグ候補 0 件時の表示を手動確認する | tasks-ui | Low |
| UI-006 | UI | `/notes` にタイトル、学習日、学習元、タグ、Cue 件数、要約状態、復習状態を表示する | `NotesList` のカードに該当表示あり | OK | 主要データあり/なしの表示を手動確認する | tasks-ui | Medium |
| UI-007 | UI | `/notes` の並び順は `noteDate desc, updatedAt desc` 固定 | UI にソート切替なし。API が固定 orderBy | OK | なし | tasks-ui | Low |
| UI-008 | UI | `/notes/new` で基本情報、タグ、Cue、本文、サマリー、次回復習日を入力できる | `NoteEditor` に該当入力あり。2026-07-05 UI フロー再検証で作成フロー PASS | OK | 確認済み | tasks-ui | Low |
| UI-009 | UI | `/notes/new` で既存タグ候補を選択して保存できる | `TagInput` が `GET /api/tags` から既存タグ候補を取得し、候補選択と自由入力タグ追加の両方に対応。2026-07-05 UI フロー再検証で PASS | OK | 確認済み | tasks-ui | Low |
| UI-010 | UI | `/notes/new` でタグ最大 12 件、重複防止を UI でも扱う | `TagInput` が 12 件上限と重複防止を実装。API 側 validation もあり | OK | 13 件目と重複の表示を手動確認する | tasks-ui | Medium |
| UI-011 | UI | `/notes/new` の空 Cue は保存対象から除外または validation error | `toPayload` が trim 後に空 Cue を filter | OK | 空 Cue 混在保存の手動確認を行う | tasks-ui | Medium |
| UI-012 | UI | `/notes/[id]` は閲覧、編集、復習モードを切り替える | `NoteDetailModes` に `view/edit/review` 状態あり。2026-07-05 UI フロー再検証で編集/復習モード遷移 PASS | OK | 確認済み | tasks-ui | Low |
| UI-013 | UI | `/notes/[id]` 閲覧モードで Cornell レイアウト、Markdown 表示、タグ/Cue/メタ情報を表示する | `NoteDetailModes` が Cue 左、本文右、サマリー下部を表示 | OK | 表示崩れと空状態を手動確認する | tasks-ui | Medium |
| UI-014 | UI | `/notes/[id]` 編集モードで既存値をフォーム反映し保存後閲覧へ戻る | `NoteEditor` が保存成功時に API レスポンスを `onSaved` で親へ渡し、`NoteDetailModes` が最新 state に更新して閲覧モードへ戻す。2026-07-05 UI フロー再検証で PASS | OK | 確認済み | tasks-ui | Low |
| UI-015 | UI | `/notes/[id]` 復習モードは本文初期非表示、表示/非表示切替、復習済み更新ができる | `showBody=false` で開始し、表示/非表示と `POST /api/notes/:id/review` 呼び出しあり。2026-07-05 UI フロー再検証で PASS | OK | 確認済み | tasks-ui | Low |
| UI-016 | UI | 削除は確認 UI を出し、確定後に物理削除して `/notes` へ戻る | `window.confirm` 後に `DELETE /api/notes/:id`、成功時 `/notes` へ遷移。2026-07-05 UI フロー再検証でキャンセル/確定 PASS | OK | 確認済み | tasks-ui | Low |
| UI-017 | UI | 存在しない `/notes/[id]` は 404 またはノートなし状態を表示する | API 取得失敗時に「ノートが見つかりません」表示 | OK | なし | tasks-ui | Low |
| UI-018 | Backup | `/backup` でバックアップ一覧、作成、一覧更新、loading/error/success/空状態を表示する | `src/app/backup/page.tsx` に該当 UI あり。2026-07-05 UI フロー再検証でバックアップ画面表示と作成 PASS | OK | 確認済み。失敗系 UI は必要時に追加確認 | tasks-ui | Low |
| API-001 | API | `GET /api/notes` は `query`, `tag`, `from`, `to`, `reviewDue`, `page` を受ける | `notesQuerySchema` と route で全パラメータを処理。2026-07-05 API 再検証で PASS | OK | 確認済み | tasks-api | Low |
| API-002 | API | `GET /api/notes` は title/overview/body/summary/cue.text を検索し、タグ OR、日付範囲、復習対象を絞り込む | Prisma where に該当条件あり。タグは `name in input.tag`。2026-07-05 API 再検証で PASS | OK | 確認済み | tasks-api | Low |
| API-003 | API | `GET /api/notes` は 50 件固定ページングと `page,totalPages,totalCount,data` を返す | `PAGE_SIZE=50`、レスポンスに該当フィールドあり。2026-07-05 API 再検証で PASS | OK | 確認済み | tasks-api | Low |
| API-004 | API | `POST /api/notes` は Notebook/Cue/Tag/NotebookTag を transaction で作成し、未登録タグを自動作成する | `prisma.$transaction`, `tag.upsert`, `notebookTag.create` あり。2026-07-05 API 再検証で PASS | OK | 確認済み | tasks-api | Low |
| API-005 | API | `GET /api/notes/:id` は詳細を返し、存在しない場合 JSON error | `findFirst({ deletedAt:null })`、not_found JSON。2026-07-05 API 再検証で PASS | OK | 確認済み | tasks-api | Low |
| API-006 | API | `PATCH /api/notes/:id` は Notebook 更新、Cue と Tag 関連全置換、未登録タグ自動作成 | notebook update、cue delete/createMany、notebookTag delete/create あり。2026-07-05 API 再検証で PASS | OK | 確認済み | tasks-api | Low |
| API-007 | API | `DELETE /api/notes/:id` は MVP では物理削除し 204 を返す | `prisma.notebook.delete`、204 response。2026-07-05 API 再検証で PASS | OK | 確認済み | tasks-api | Low |
| API-008 | API | `POST /api/notes/:id/review` は `reviewedAt=now`, `nextReviewDate` 任意/null を更新する | 該当 update と response あり。2026-07-05 API 再検証で PASS | OK | 確認済み | tasks-api | Low |
| API-009 | API | `GET /api/tags` はタグ候補を名前順で返す | `orderBy: { name: "asc" }`。2026-07-05 API 再検証および UI-009 再検証で PASS | OK | 確認済み | tasks-api | Low |
| API-010 | API | API エラーは `{ code, message, errors? }` に統一する | validation/not_found/server_error helper あり。2026-07-05 API 再検証で代表 validation / not_found が PASS | OK | 確認済み。500 は破壊的条件が必要なため必要時に別確認 | tasks-api | Low |
| API-011 | API | MVP では `/api/undo`, `/api/review-tasks`, `/api/notes/export`, `/api/backups/retry`, `/api/backups/logs` を作らない | 現コードにも該当 route なし | MVP外 | Phase 2 着手時に別棚卸しする | tasks | Low |
| DB-001 | DB | MVP モデルは Notebook, Cue, Tag, NotebookTag | `prisma/schema.prisma` に 4 モデルあり | OK | なし | tasks-api | Low |
| DB-002 | DB | Notebook は title/noteDate/sourceType/sourceTitle/overview/body/summary/nextReviewDate/reviewedAt/createdAt/updatedAt/deletedAt を持つ | schema に該当フィールドあり。`deletedAt` は MVP では検索除外用に存在 | OK | なし | tasks-api | Low |
| DB-003 | DB | Cue は notebookId/text/order と timestamps を持つ | schema に該当フィールドと notebookId/order index あり | OK | なし | tasks-api | Low |
| DB-004 | DB | Tag は name unique, color 任意, createdAt を持つ | schema に該当フィールドあり | OK | なし | tasks-api | Low |
| DB-005 | DB | NotebookTag は notebookId/tagId 複合 PK | schema で `@@id([notebookId, tagId])` | OK | なし | tasks-api | Low |
| DB-006 | DB | Phase 2 の NoteCard/NoteCueLink/NotebookDraftState/NotebookReviewProgress/SoftDeleteBuffer/BackupLog は MVP に含めない | schema に存在しない | MVP外 | Phase 2 DB 設計 task で扱う | tasks-api | Low |
| MD-001 | UI | Markdown 入力は textarea + preview | `MarkdownField` が textarea と preview を縦並び表示 | OK | なし | tasks-ui | Low |
| MD-002 | UI | Markdown 表示は `react-markdown` + `remark-gfm` + `rehype-sanitize` | `MarkdownPreview` で該当 plugin 使用。2026-07-05 Markdown 検証で危険 HTML の sanitize が PASS | OK | 確認済み | tasks-ui | Low |
| MD-003 | UI | GFM checkbox は preview 上で保存値を変更しない | `components.input` で checkbox を readOnly、click/change preventDefault。2026-07-05 Markdown 検証で preview checkbox click 後も textarea 値不変を確認 | OK | 確認済み | tasks-ui | Low |
| MD-004 | UI | 閲覧・復習モードの Markdown 表示にも sanitize が効く | 詳細/復習は `MarkdownPreview` を共有。2026-07-05 Markdown 検証で閲覧/復習双方 PASS | OK | 確認済み | tasks-ui | Low |
| BAK-001 | Backup | `GET /api/backups` は最新バックアップ一覧を返す | `listBackups()` を返す route あり。2026-07-05 API 再検証で PASS | OK | 確認済み | tasks-api | Low |
| BAK-002 | Backup | `POST /api/backups` は SQLite DB を `backup/` にコピーし最新 3 世代保持 | `createBackup()` と `pruneBackups()` あり。2026-07-05 API 再検証で 4 世代作成後の prune PASS | OK | 確認済み | tasks-api | Low |
| BAK-003 | Backup | `npm run backup:copy` で同じコピー処理を実行できる | package script と `scripts/backup-copy.js` あり。2026-07-05 に実 DB で 4 回実行し、最新 3 世代保持を確認 | OK | 確認済み | tasks | Low |
| BAK-004 | Backup | MVP は backup log DB/retry API/自動復元を含めない | 現コードにも該当 DB/API/UI なし | MVP外 | Phase 2 で扱う | tasks | Low |
| VAL-001 | API | title 1-120, noteDate 今日以前, sourceType enum, sourceTitle 0-120, overview 0-400 | `notebookInputSchema` に該当 validation あり。2026-07-05 API 再検証で代表 validation PASS | OK | 確認済み | tasks-api | Low |
| VAL-002 | API | nextReviewDate は noteDate 以降または未指定 | `superRefine` で比較あり。2026-07-05 API 再検証で invalid nextReviewDate PASS | OK | 確認済み | tasks-api | Low |
| VAL-003 | API | cue.text 1-120, tags 最大 12 件、tag.name 1-30、重複不可 | schema に該当 validation あり。2026-07-05 API 再検証で empty Cue / duplicate tags など PASS | OK | 確認済み | tasks-api | Low |
| VAL-004 | API | `GET /api/notes` の From > To は query validation error | `notesQuerySchema.superRefine` で invalid_query。2026-07-05 API 再検証で PASS | OK | 確認済み | tasks-api | Low |
| VAL-005 | API | タグ使用可能文字は MVP data では 1-30 文字のみ、全体仕様では詳細 regex | 現コードは日本語漢字を含む regex。MVP を超えるが現テスト例の日本語タグに適合 | OK | MVP 用タグ文字仕様を README/テストで明確化する | tasks | Low |
| TEST-001 | Test | MVP 完成時に `npm run lint`, `npm run build`, Prisma コマンドで検証する | 2026-07-04 handoff で `npx prisma validate` / `npm run prisma:generate` / `npm run lint` / `npm run build` PASS。2026-07-05 の UI-009/UI-014 修正後にも `npm run lint` / `npm run build` が複数回 PASS | OK | 確認済み。最終リリース直前に再実行 | tasks | Low |
| TEST-002 | Test | 主要フローは手動または Playwright で確認する | 2026-07-05 に Playwright Chromium で MVP 主要 UI フロー、Markdown sanitize / checkbox、API CRUD / validation / backup を再検証し PASS | OK | 確認済み | tasks | Low |
| DOC-001 | Docs | README に Prisma migrate / seed 手順を記載する | package script / `prisma/` / `scripts/` に seed 実装なし。MVP では seed 不要と判断し、README と TEST_SCENARIOS に初期データは UI/API で作成する旨を明記 | OK | なし | tasks | Low |
| DOC-002 | Docs | README に主要画面と操作手順を記載する | README に主要画面、基本操作、検証コマンドあり | OK | なし | tasks | Low |
| DOC-003 | Docs | README に操作デモ（動画/GIF）や主要画面スクリーンショットを追加する | README に 2026-07-05 の主要 UI フロー検証 summary 参照と、`doc/assets/screenshots/` 配下の主要 4 画面スクリーンショット参照を追加済み | OK | なし | tasks-ui | Low |
| PH2-001 | UI | 自動保存、下書き、409 競合 UI | MVP_SYSTEM_SPEC / TEST_SCENARIOS で Phase 2 | MVP外 | Phase 2 開始時に設計再確認 | tasks | Low |
| PH2-002 | UI/API/DB | Undo Snackbar、SoftDeleteBuffer、`POST /api/undo` | MVP_SYSTEM_SPEC / TEST_SCENARIOS で Phase 2。MVP は物理削除 | MVP外 | Phase 2 開始時に DB/API/UI を一括設計 | tasks | Low |
| PH2-003 | UI/API/DB | NoteCard, NoteCueLink, D&D, hidden flag | MVP_SYSTEM_SPEC / TEST_SCENARIOS で Phase 2。MVP は body 1 Markdown | MVP外 | Phase 2 開始時に migration から切る | tasks | Low |
| PH2-004 | UI/API/DB | `/tasks/review`, review progress, 未完バッジ | MVP_SYSTEM_SPEC / TEST_SCENARIOS で Phase 2。MVP は `/notes` フィルタ + 詳細復習 | MVP外 | Phase 2 開始時に復習設計を再確認 | tasks | Low |
| PH2-005 | UI/API | PDF export `/api/notes/export` | MVP_SYSTEM_SPEC / TEST_SCENARIOS で Phase 2 | MVP外 | Phase 2 開始時に Playwright PDF task を切る | tasks-api | Low |
| PH2-006 | UI | `@uiw/react-md-editor`, `react-day-picker`, D&D ライブラリの実利用 | package 依存には存在するが、MVP 技術設計では不要。現 UI は textarea/input/select | MVP外 | 依存を残すか整理するかは別 task で判断 | tasks | Low |

## 完了済み Worker task / 検証候補

| 候補ID | 完了内容 | 根拠 |
| --- | --- | --- |
| NEXT-001 | MVP 主要 UI フロー検証 | `summary/20260705/mvp-ui-flow-reverification-report.md` |
| NEXT-002 | Prisma / lint / build 検証 | `HANDOFF_2026-07-06.md`、`summary/20260705/manager-fix-ui009-note-editor-tag-candidates-summary.md`、`summary/20260705/manager-fix-ui014-edit-save-state-summary.md` |
| NEXT-003 | NoteEditor 既存タグ候補取得・候補選択追加 | `summary/20260705/manager-fix-ui009-note-editor-tag-candidates-summary.md`、`summary/20260705/mvp-ui-flow-reverification-report.md` |
| NEXT-004 | 編集保存後の詳細画面 state 反映補正 | `summary/20260705/manager-fix-ui014-edit-save-state-summary.md`、`summary/20260705/mvp-ui-flow-reverification-report.md` |
| NEXT-005 | API CRUD / review / search / validation / backup prune 検証 | `summary/20260705/manager-mvp-api-crud-validation-backup-reverification-report.md` |
| NEXT-006 | `npm run backup:copy` 実 DB 検証 | `summary/20260705/backup-copy-command-verification-report.md` |
| NEXT-007 | Markdown sanitize / checkbox 表示専用検証 | `summary/20260705/manager-markdown-sanitize-checkbox-verification-report.md` |
| DOC-003 | README の MVP 受け入れ材料スクリーンショット追加 | `README.md`、`doc/assets/screenshots/` |

## 次に投入すべき Worker task 候補

現時点で MVP 完了に向けた次 task 候補はありません。最終リリース直前に `npm run lint`、`npm run build`、Prisma validate/generate を再実行する。

## 補足

- MVP では `/backup` が正であり、`/notes/backup` は最終仕様側の候補として扱う。
- MVP では削除は確認ダイアログ + 物理削除が正であり、Undo / Soft Delete は不足扱いしない。
- MVP では本文は 1 つの Markdown 文字列が正であり、NoteCard / D&D / Cue と本文の厳密リンクは不足扱いしない。
- MVP では復習は `/notes` の復習対象フィルタと `/notes/[id]` の復習モードが正であり、専用復習タスク画面は不足扱いしない。
