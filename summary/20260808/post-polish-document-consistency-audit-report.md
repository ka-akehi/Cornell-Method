# 推敲後 文書横断整合性監査レポート

作成日: 2026-08-08（JST）
状態: 監査完了。現行ファイルから再構成した詳細 summary
判定集計: 要修正 6 件、履歴として許容 1 件、未確認 1 件（合計 8 件）

## Objective

`audit-post-polish-document-consistency-20260808-2ef6132e.task.md` で失われた監査結果を、raw log に戻らず、2026-08-08 時点の現行文書から再構成する。

目的は、製品方針、現行 MVP 契約、詳細設計、実装状況、テスト証跡、履歴資料を役割ごとに分離し、後続 task がそのまま入力として使える重複のない finding と修正順を固定することである。本書は監査成果物であり、製品仕様や現行 MVP 契約そのものを変更しない。

## Scope

| 項目 | 内容 |
| --- | --- |
| 監査基準日 | 2026-08-08 |
| 主な照合軸 | SQLite 唯一正本、PDF の一方向派生出力、ローカル Web と将来 Mac desktop の境界、Canvas / Markdown、Prisma / API、削除、`nextReviewDate`、Gate 0、テスト判定 |
| 正本優先順位 | 製品全体・ロードマップは `PRODUCT_SPEC.md`、現行 MVP の実装・受け入れは `MVP_CONTRACT.md`、業務・機能要件は `MVP_SYSTEM_SPEC.md`。詳細書はこれらへ追従する |
| 判定境界 | 新しい browser / API / CLI runtime は実行せず、既存の `PASS`、`FAIL`、`BLOCKED`、`未実施`、`部分実施` を変更しない |
| 変更範囲 | 本書だけ。仕様本文、コード、設定、依存関係、DB、生成物、queue task は変更しない |
| 対象外 | Phase 2、Desktop、PDF、部分消去の coding、GitHub live state、外部 API、ネットワーク、raw log、`.next` cache |

補完元の自動 summary は task の `done` と mtime ベースの一覧しか保持していないため、finding の根拠には使わない。今回の監査結果の正規の詳細成果物は本書とする。

## Inputs Read

| 区分 | 入力 | 読み方・用途 |
| --- | --- | --- |
| task provenance | `codex-queue/tasks/done/audit-post-polish-document-consistency-20260808-2ef6132e.task.md` | 元監査の条件、照合軸、判定列、制約を再適用 |
| task provenance | `summary/20260808/0918-audit-post-polish-document-consistency-20260808-2ef6132e-summary.md` | finding が欠落していることだけを確認。記載された raw log / `.next` は未読 |
| 運用 | `AGENTS.md` | 正本一覧、Manager / Worker、Gate を越えない task 運用 |
| 再開地点 | `HANDOFF_2026-08-08.md` | 2026-08-08 UI runtime の `BLOCKED` / `NOT RUN` 境界 |
| 製品正本 | `doc/requirements/PRODUCT_SPEC.md` | 製品原則、MVP / Phase 2 / 将来、SQLite / PDF / Desktop 境界 |
| MVP 要件 | `doc/requirements/MVP_SYSTEM_SPEC.md` | 現行業務・機能要件と、古い Markdown 前提の照合 |
| MVP 正本 | `doc/implementation/MVP_CONTRACT.md` | route、Canvas、保存、削除、復習、モデル、受け入れの基準 |
| 実装状況 | `doc/implementation/IMPLEMENTATION_STATUS.md` | 現行 route / model / API / UI の静的実在と runtime 境界 |
| 将来設計 | `doc/technical/TARGET_ARCHITECTURE.md` | 将来責務境界、Desktop、PDF、Phase 2 の前提 |
| テスト証跡 | `doc/testing/TEST_SCENARIOS.md` | 現行判定、履歴判定、未実施・BLOCKED の範囲 |
| 入口 | `README.md` | 利用者向けの現行セットアップ、運用、画面、モデル、QA 説明 |
| 索引 | `doc/README.md` | 文書カテゴリ、Primary Entry Points、正本ルール |
| 詳細設計 | `doc/technical/MVP_TECHNICAL_DESIGN.md` | 現行技術・Prisma・backup・配置方針 |
| 詳細設計 | `doc/data/MVP_DATA_DESIGN.md` | 現行 model、Canvas、削除、復習対象、検索 |
| 詳細設計 | `doc/api/MVP_API_DESIGN.md` | 現行 request / response、Canvas、検索、削除、review API |
| 詳細設計 | `doc/workflows/MVP_WORKFLOW_DESIGN.md` | 作成・検索・復習・削除の業務順序 |
| UI 詳細 | `doc/screens/MVP_SCREEN_DESIGN.md` | current / To-Be の画面契約と受け入れ条件 |
| UI 詳細 | `doc/screens/MVP_SCREEN_INVENTORY.md` | As-Is / To-Be、Action / Data、画面と API の対応 |
| UI 詳細 | `doc/screens/MVP_UI_WIREFRAMES.md` | normal state の低忠実度 wireframe と旧 PNG の位置づけ |
| 履歴資料 | `doc/screens/NTE_020_NEW_NOTE_LAYOUT_POLICY.md` | Canvas 導入前の Markdown UI を含む設計判断資料 |
| Canvas 設計 | `doc/designs/CANVAS_TOOLBAR_DESIGN.md` | toolbar の現行契約、導入前履歴、埋め込み実装 snapshot |
| 将来提案 | `doc/designs/CANVAS_PARTIAL_ERASER_DESIGN.md` | whole-object erase と将来 partial erase、V1 境界、段階導入案 |
| Gate 補助 | `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md` | Gate 0 の状態、No-Go 条件、後続 coding の停止条件。Gate 0 確認に必要な範囲を追加読取 |

`package.json`、`prisma/schema.prisma`、`src/**`、`test/**`、`scripts/**` は直接読んでいない。今回の論点は、現行契約、実装状況、API 設計、テスト証跡の相互照合だけで判定できたためである。コードの存在や挙動を本監査で新たに再判定していない。

## Changes Made

| パス | 変更内容 | 理由 |
| --- | --- | --- |
| `summary/20260808/post-polish-document-consistency-audit-report.md` | 監査結果を再構成した本詳細 summary を作成 | 後続 task が finding と投入順を正規の起点として参照できるようにするため |

この監査 task が変更した唯一の成果物は本書である。監査対象の正本文書、設計書、コード、設定、依存関係、DB、生成物は変更していない。

## 文書の役割分類

同じファイル内に複数の役割がある場合は、ファイル全体ではなく節単位で扱う。

| 役割 | 文書・節 | この監査での扱い |
| --- | --- | --- |
| 現行正本 | `PRODUCT_SPEC.md` の製品原則・現行境界、`MVP_SYSTEM_SPEC.md` の業務・機能要件、`MVP_CONTRACT.md` の現行 MVP 契約 | `MVP_CONTRACT.md` を現行実装・受け入れの最優先とする。`MVP_SYSTEM_SPEC.md` 自身に残る競合は finding とする |
| 現行詳細設計 | `MVP_DATA_DESIGN.md`、`MVP_API_DESIGN.md`、`MVP_WORKFLOW_DESIGN.md`、`MVP_SCREEN_DESIGN.md`、`MVP_SCREEN_INVENTORY.md`、`MVP_UI_WIREFRAMES.md`、`MVP_TECHNICAL_DESIGN.md` | 各領域の詳細。正本と競合する記述、現行に見える古い snapshot は修正対象 |
| 将来ロードマップ・目標 | `PRODUCT_SPEC.md` の Phase 2 / 将来、`TARGET_ARCHITECTURE.md`、`POST_MVP_IMPLEMENTATION_PLAN.md`、`CANVAS_PARTIAL_ERASER_DESIGN.md` | 現行 MVP へ混ぜない。Gate 0 後の判断・設計候補であり、task 例や提案は投入済み・実装済みを意味しない |
| 実装状況 | `IMPLEMENTATION_STATUS.md` | コード上の実在と静的確認の正規入口。browser runtime の合格を兼ねない |
| テスト証跡 | `TEST_SCENARIOS.md`、最新 runtime 再開地点としての `HANDOFF_2026-08-08.md` | 判定と根拠を保持する。異なる日付・viewport・subset の結果を合成して PASS にしない |
| 入口・索引 | `README.md`、`doc/README.md`、`AGENTS.md` | README は利用者向け入口であり正本を再定義しない。`doc/README.md` は索引、`AGENTS.md` は運用と正本一覧 |
| 履歴資料 | `NTE_020_NEW_NOTE_LAYOUT_POLICY.md`、`MVP_SCREEN_DESIGN.md:267-271`、`MVP_SCREEN_INVENTORY.md:15-30`、`MVP_UI_WIREFRAMES.md:125-129`、`CANVAS_TOOLBAR_DESIGN.md:26-30`、`TEST_SCENARIOS.md:602,605-606,619-623` | 旧 Markdown UI、旧 screenshot、旧 FAIL を、明示された比較・履歴として保持する。現行仕様へ昇格させない |
| task provenance | 元 task と自動 summary | 監査条件と欠落経緯の証拠。本書の製品判断・test 判定の根拠にはしない |

## `nextReviewDate` の正本マトリクス

文書修正時に四つの文脈を混ぜないため、`MVP_CONTRACT.md:59-60,71-77,129-140` と `TEST_SCENARIOS.md:7,601-604` から次を固定する。「固定の初期入力」と Phase 2 の「自動間隔反復 / 自動タスク」は別概念である。

| 文脈 | 初期値・対象 | ユーザー操作 / 保存後 |
| --- | --- | --- |
| 新規作成 | `noteDate + 7日` | 保存前に変更・空欄化可 |
| 既存ノート編集 | 保存済み値を表示。未設定は未設定のまま | `noteDate` 変更で自動移動しない。明示値または null を維持 |
| 既存ノートの復習画面 | 画面を開いた時点の `Asia/Tokyo` の現在日付 + 7日。保存済み値は再利用しない | 変更・空欄化可。成功 response の `nextReviewDate` を画面へ反映 |
| 一覧の復習対象フィルタ | `nextReviewDate` が設定済み、かつ今日以前 | 未設定ノートは対象に含めない |

## Findings table

| ID | 判定（要修正 / 履歴として許容 / 未確認） | 論点 | 正本と根拠 | 競合箇所（ファイルと行番号） | 影響 | 最小の修正単位 | Queue（Common / UI / API） | 依存関係 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DOC-001 | 要修正 | ローカル専用・SQLite 唯一正本の製品境界に対し、利用者向け入口と現行 status / test 節が Vercel / Supabase / Postgres を現役の運用経路として見せている | `PRODUCT_SPEC.md:35-37,70,92,123-128`、`MVP_SYSTEM_SPEC.md:150-164,522-536`、`TARGET_ARCHITECTURE.md:15,47-49,478-482`、`POST_MVP_IMPLEMENTATION_PLAN.md:24-35,48-56`。クラウド DB・同期・外部サービス・Postgres 移行は将来予定でもない | `README.md:14,35-50,86-98,127-198,387,393` は hosted setup / operator workflow を現行手順として記載。`IMPLEMENTATION_STATUS.md:32,192-202,278` と `TEST_SCENARIOS.md:566-579,616` は Postgres evidence を現行 status / matrix 内に置き、採用しない履歴であることを明示していない | 新規利用者が誤った DB・認証・配備を設定し、後続 Worker が対象外の migration / hosted readiness を製品ロードマップと誤認する。SQLite backup と Postgres export の運用境界も曖昧になる | 1 件の docs-only task で、README を local SQLite 手順へ限定し、Postgres の既存 `PASS` / `未確認` 証跡は値を変えず「不採用方針決定前の履歴」へ再分類する。コード / scripts の残置判断は別の read-only 棚卸しに分け、この修正で削除しない | Common | 先行可能。コード削除や依存削除を提案する場合は、別棚卸しと発注者判断が必要 |
| DOC-002 | 要修正 | Canvas 導入後の現行 MVP に、本文 1 本の Markdown、4 model、本文 textarea / preview を現行要件として残した文書がある。将来 NoteCard 移行も legacy `body` だけを起点にしている | `PRODUCT_SPEC.md:47-52,56-70`、`MVP_CONTRACT.md:16,22-25,99-140,203-220`、`MVP_API_DESIGN.md:11,142-170,271,391`、`MVP_DATA_DESIGN.md:11,48-109`、`IMPLEMENTATION_STATUS.md:19,74-86`。現行本文は `bodyMode=canvas` の `NotebookCanvas.documentJson` / `CanvasDocumentV1`、既存 Markdown は互換モード、Cue / Summary は Markdown | `MVP_SYSTEM_SPEC.md:70-79,117-127,138-146,170-180,188-200,268-290,335-368,522-536`、`MVP_TECHNICAL_DESIGN.md:153-168,182-203,401-408`、`MVP_WORKFLOW_DESIGN.md:74-83,99-130,168-206,350-374,698-710`、`README.md:5-12,220-248,282-289`、`TARGET_ARCHITECTURE.md:425-433,452-470` | 要件、model、検索対象、UI、Phase 2 migration の入力が相互に変わり、Canvas を消す実装、`NotebookCanvas` を漏らす更新、Canvas text を検索しない実装、誤った NoteCard migration を誘発する | 1 件の横断 docs task で「Canvas V1 + legacy Markdown 互換 + Cue / Summary Markdown + Canvas `searchText`」を System / Technical / Workflow / README / Target に同期する。将来 NoteCard は現行 Canvas と競合する未決事項へ戻し、旧 Markdown screenshot は履歴表示に限定する | Common | DOC-001 と意味上は独立。ただし README を共有するため同時編集せず、DOC-001 後を推奨 |
| DOC-003 | 要修正 | `nextReviewDate` の四文脈が詳細書へ展開されておらず、手動管理・自動計算なしという一般則が、固定の初期値まで否定するように読める。未設定ノートを一覧の復習対象に含める記述もある | `MVP_CONTRACT.md:59-60,71-77,129-140`、`IMPLEMENTATION_STATUS.md:23-25,171-180`、`TEST_SCENARIOS.md:7,601-604`。本書の「`nextReviewDate` の正本マトリクス」を修正入力とする | `MVP_SYSTEM_SPEC.md:232-240,268-283,306-314`、`MVP_DATA_DESIGN.md:201-219`、`MVP_WORKFLOW_DESIGN.md:74-83,99-130,168-225,473-535`、`MVP_SCREEN_DESIGN.md:283-290,626-664,695-709`、`MVP_SCREEN_INVENTORY.md:338-378`、`MVP_UI_WIREFRAMES.md:470-559` | 新規・編集・復習を同じ初期化にして保存値を上書きする、復習画面で保存済み期限を再利用する、null のノートを一覧へ混ぜるなど、日付 state の回帰を起こす | まず 1 件の Common docs task で System / Data / Workflow に四文脈表を追加し、「UI 初期値」と「自動間隔反復」を分離する。画面・wireframe への反映は DOC-004 の UI task に引き渡す。既存 test 判定は変更しない | Common | DOC-002 後を推奨。同じ System / Workflow を編集するため。DOC-004 の入力 |
| DOC-004 | 要修正 | 現行復習契約は Cue → 本文確認 → Summary 開示だが、業務フローと wireframe の一部が Cue + Summary を先に表示する旧順序を normal state としている。README も現行実装を「契約との差分」と逆に説明する | `MVP_CONTRACT.md:71-77,192-195`、`MVP_SCREEN_DESIGN.md:626-657,695-709`、`MVP_SCREEN_INVENTORY.md:338-378`、`IMPLEMENTATION_STATUS.md:25-26` | `MVP_SYSTEM_SPEC.md:95-105,138-147,232-240,306-314`、`MVP_WORKFLOW_DESIGN.md:36-43,74-84,115-130,473-535`、`MVP_UI_WIREFRAMES.md:470-516,524-555` は Summary を想起前から表示。`README.md:228-236,267-271` は Summary 初期非表示を未確認または契約差分として扱う古い説明を残す | 復習の想起順序を壊す UI 改修、Summary の再露出、誤った受け入れシナリオを誘発する | 1 件の UI docs task で、workflow と review wireframe を Cue → 本文 → Summary に統一し、DOC-003 の復習日初期値も同時に画面へ反映する。旧 wireframe を残す場合は normal state から外して履歴ラベルを付ける。コード変更は行わない | UI | DOC-002（Canvas 用語）と DOC-003（日付 matrix）完了後 |
| DOC-005 | 要修正 | 物理削除と `deletedAt IS NULL` read guard の説明が食い違う。guard の存在を soft delete / Undo と誤認しない説明が必要 | `MVP_CONTRACT.md:62-67` は削除 command と復元判定に `deletedAt` を使わない。`MVP_API_DESIGN.md:339-357,377-407,427-452,472-531` と `IMPLEMENTATION_STATUS.md:74-86` は現コードの read / update / review guard と、`prisma.notebook.delete` による物理削除を記録 | `MVP_DATA_DESIGN.md:21,76,88,172-187` は MVP API が `deletedAt` を使わず、一覧・詳細・検索も `deletedAt IS NULL` を前提にしないと記載し、API 設計と実装状況に反する | 実装者が guard を削る、または guard の存在だけから soft delete / 復元を実装済みと誤判定する。404 条件のテスト期待も揺れる | 1 件の API docs task で Data Design を現コードへ合わせ、「read compatibility guard はあるが、削除 command は物理削除、値を立てる処理・Undo・復元・purge はない」と明記する。API / code は変更しない | API | 他 finding と論理的に独立。Data Design の同時編集を避けるため DOC-003 と別 turn を推奨 |
| DOC-006 | 要修正 | 正本でない文書に、旧 source path、完了済みの task 順、古い QA gap、次の coding task が現行入口のように残る。明示された歴史部分と、現行 snapshot を名乗る古い部分が混在する | 現行配置・状態は `IMPLEMENTATION_STATUS.md:38-108`、最新 runtime は `HANDOFF_2026-08-08.md:30-66`、Gate は `POST_MVP_IMPLEMENTATION_PLAN.md:5,20,44-65`、判定は `TEST_SCENARIOS.md:581-619` を入口とする | `README.md:220-248,267-289`、`MVP_TECHNICAL_DESIGN.md:205-225,300-310,372-399,440-442`、`MVP_SCREEN_DESIGN.md:202-220,267-271,845-847`、`CANVAS_TOOLBAR_DESIGN.md:274-286,359-361`、`CANVAS_PARTIAL_ERASER_DESIGN.md:38-49,514-643`。特に `src/app/notes/_components/**`、`src/lib/backup/index.js`、旧 handoff / `CURRENT_STATUS.md`、Gate 0 前の coding task 列挙が live instruction に見える | Worker が存在しない旧 path を対象にする、完了済み UI task を再投入する、古い FAIL を現行判定に戻す、Gate 0 前に partial eraser / Desktop / PDF 等へ進む | 1 件の仕上げ docs task で、埋め込み status は正規入口へのリンクへ置換し、まだ必要な source path だけ現行配置へ更新する。完了済み task / screenshot / pre-v2 節は履歴ラベル、partial eraser の coding plan は「Gate 0 後・未投入」を明記する。判定値と設計本体は変更しない | Common | DOC-001〜DOC-005 の意味修正後。最後に実施して入口と履歴ラベルを確定する |
| HIS-001 | 履歴として許容 | 旧 Markdown UI、旧 screenshot、pre-v2 toolbar、過去の `FAIL` / 部分 PASS が、日付・対象・現行対象外を伴って保存されている | `MVP_CONTRACT.md:10-12,238-250` と `TEST_SCENARIOS.md:581-583,619-623` は、現行判定と履歴判定を分離し、別 subset から PASS を推測しない | 許容する履歴箇所: `NTE_020_NEW_NOTE_LAYOUT_POLICY.md:6-22,24-66`、`MVP_SCREEN_DESIGN.md:267-271`、`MVP_SCREEN_INVENTORY.md:15-30`、`MVP_UI_WIREFRAMES.md:125-129`、`CANVAS_TOOLBAR_DESIGN.md:26-30`、`TEST_SCENARIOS.md:602,605-606,619-623`、`IMPLEMENTATION_STATUS.md:253-269` | 現行仕様の競合ではない。履歴を消すと、変更理由、当時の受け入れ範囲、FAIL 解消前後の追跡性を失う | 修正不要。周辺文書を直す task では、日付、対象 viewport / contract、当時の判定、履歴ラベルを保持する。旧判定を最新判定へ書き換えない | Common | DOC-006 が履歴ラベルを維持すること |
| UNK-001 | 未確認 | 推敲後 UI の人力 MVP 結合テストは未完了で、Gate 0 は未通過。Phase 2 / Desktop / PDF coding の開始条件を満たしていない | `POST_MVP_IMPLEMENTATION_PLAN.md:5,44-65,69-104`、`HANDOFF_2026-08-08.md:34-45,58-66`、`TEST_SCENARIOS.md:614-617`。`IMPLEMENTATION_STATUS.md:204-217` は Phase 2 / PDF の非実装を記録 | 競合ではなく未取得証跡: `HANDOFF_2026-08-08.md:36-45` は Browser backend 不在、UI runtime PASS 0 / FAIL 0、detail / paper `NOT RUN`。`TEST_SCENARIOS.md:614-615` は `BLOCKED` を維持 | 安定 baseline を確定できず、見えていない runtime failure を推測修正する危険がある。将来機能を重ねると回帰原因を分離できない | Browser 環境回復の Common task と、safe fixture を使う Gate 0 人力結合 QA task を分ける。実測 FAIL が出た surface だけ後続 fix task 化する。新証跡なしに判定を変更しない | Common | Browser backend、safe fixture、最終品質コマンド、発注者の Gate 0 明示承認。DOC 修正は並行可だが最終 QA 証跡更新前に完了させる |

## 確認済みで不整合なしの論点

| 論点 | 確認結果 |
| --- | --- |
| 正本の優先順位 | `AGENTS.md`、`PRODUCT_SPEC.md:5-19`、`MVP_CONTRACT.md:6-12`、`doc/README.md:42-47` は、製品ロードマップ、MVP 要件、現行実装契約、詳細書の役割を同じ順で定義している |
| SQLite / PDF / Desktop | README の競合を除けば、`PRODUCT_SPEC.md`、`MVP_SYSTEM_SPEC.md`、`MVP_CONTRACT.md`、`TARGET_ARCHITECTURE.md`、`POST_MVP_IMPLEMENTATION_PLAN.md` は、SQLite 唯一正本、PDF は一方向派生出力、開発用 Web 維持、Mac desktop は Gate / PoC 後という境界で一致する |
| 現行 Canvas API | `MVP_CONTRACT.md`、`MVP_DATA_DESIGN.md`、`MVP_API_DESIGN.md`、`IMPLEMENTATION_STATUS.md` は、`bodyMode`、`NotebookCanvas`、`CanvasDocumentV1`、Canvas `searchText`、legacy Markdown 互換、明示保存で一致する |
| canonical route / API | `/notes`、`/notes/new`、`/notes/[id]`、`/backup` と、Notes / tags GET / backups GET・POST の現行 endpoint は Contract、API Design、Implementation Status で一致する。`/tasks/review`、`/api/undo`、`/api/review-tasks`、`/api/notes/export` は現行 MVP 外と明示されている |
| 削除の機能境界 | DOC-005 の read guard 説明を除き、確認 UI 後の物理削除、復元保証なし、soft delete / 5 秒 Undo / purge は Phase 2 という境界は Contract、API、Screen、Status、Test で一致する |
| PDF coding | `PRODUCT_SPEC.md:68-70,83,104` と `IMPLEMENTATION_STATUS.md:204-217` は PDF export route / 生成コードが未実装であることを区別している。Playwright の存在を PDF 実装の証拠にしていない |
| Desktop coding | `PRODUCT_SPEC.md:41-43,90`、`TARGET_ARCHITECTURE.md:13-17,170-183`、`POST_MVP_IMPLEMENTATION_PLAN.md:50-56` は shell 未決定・未実装、Desktop PoC 後の判断で一致する |
| Phase 2 coding | autosave、soft delete / Undo、専用復習 task、NoteCard / D&D は現行 model / route / UI にないと `IMPLEMENTATION_STATUS.md:204-217` が記録し、Contract / Product のロードマップと一致する |
| Canvas 消しゴム | `CANVAS_TOOLBAR_DESIGN.md:19,288-302` と `CANVAS_PARTIAL_ERASER_DESIGN.md:4-16,28-34` は、現行 whole-object eraser と将来提案の stroke partial eraser を分離し、V1 / Prisma を今回変更しない |
| テスト判定の保持 | `TEST_SCENARIOS.md:581-619` は、現行 `PASS`、過去 `FAIL`、`BLOCKED`、`未実施`、`部分実施` を対象範囲付きで保持する。今回これらを変更していない |

## 推奨する後続 task と投入順

以下は提案であり、この監査では task file の作成・enqueue・実装をしていない。文書修正は Gate 0 を越える coding ではないが、同じファイルへの競合を避けるため順序を付ける。

| 波 | 推奨 task | 対象 finding | Queue | 独立 / 依存 | 完了条件 |
| --- | --- | --- | --- | --- | --- |
| 1 | local-only 入口と旧 Postgres 証跡の再分類 | DOC-001 | Common | 先行。ほかと意味上独立 | README が SQLite 手順だけを現行として示し、Postgres の判定値を変えず履歴化 |
| 1（並行可） | `deletedAt` read guard と物理削除の文書整合 | DOC-005 | API | DOC-001 と独立。別 worktree / file owner なら並行可 | Data / API / Status の説明が一致し、soft delete 実装済みとは書かない |
| 2 | Canvas / legacy Markdown / model / search の基準同期 | DOC-002 | Common | README を共有するため DOC-001 後 | System / Technical / Workflow / README / Target が Canvas V1 を現行として扱う |
| 3 | `nextReviewDate` 四文脈の要件・データ・業務フロー固定 | DOC-003 | Common | DOC-002 後。同じ文書を編集するため直列 | 四文脈表と「初期値 vs 自動間隔反復」の区別が正本へ追従 |
| 4 | 復習 UI 順序と wireframe の同期 | DOC-004 | UI | DOC-002・DOC-003 依存 | Cue → 本文 → Summary、復習画面 today + 7日の初期値、成功 response 反映が画面資料に揃う |
| 5 | 古い path / status / task 入口の履歴化と current pointer 整理 | DOC-006、HIS-001 | Common | DOC-001〜DOC-005 後 | 正規 status / test / handoff / Gate へのリンクが入口になり、履歴判定は保持される |
| 6A | Browser runtime 環境回復 | UNK-001 | Common | 文書修正と並行可 | Browser backend と safe fixture の利用可否を確認。画面未観測を PASS / FAIL にしない |
| 6B | Gate 0 人力 MVP 結合テストと証跡更新 | UNK-001 | Common | 6A と文書修正完了後 | `POST_MVP_IMPLEMENTATION_PLAN.md:69-100` の条件、最終品質コマンド、発注者承認を満たす |

Gate 0 通過前は、Phase 2、Desktop、PDF、Local LLM、partial eraser の coding task を投入しない。Gate 0 QA で実測 FAIL が出た場合だけ、1 surface / 1 failure family の UI または API fix task に分ける。

Gate 0 後についても、本監査が提案するのは次の判断材料までである。

- legacy Postgres scripts / dependency の残置範囲を read-only で棚卸しし、削除・保管を発注者が判断する。
- NoteCard / D&D が Canvas 本文と両立するかを Stage 1 の本文モデル判断で決める。legacy `body` からの自動移行を前提にしない。
- Desktop shell、user data path、PDF provider / layout / output destination は PoC と仕様決定後に task 化する。

## Verification

| 確認項目 | 結果 | 備考 |
| --- | --- | --- |
| 作業前 `git status --short` | 実施 | 多数の既存 tracked / untracked 変更を確認し、すべてユーザーの保護対象として扱った。本書は開始時に存在しなかった |
| 作業後 `git status --short` | 実施 | 本書の追加を確認。開始時一覧になかった `codex-queue/README.md`、`codex-queue/bin/worker-run.sh`、`codex-queue/bin/write-task-summary.sh`、`summary/20260808/0936-persist-worker-success-report-in-task-summary-20260808-c1dd590c-summary.md`、`test/codex-queue/worker-summary.test.js` も終了時に現れたが、本 task の編集操作対象ではないため、並行変更として内容を読まず、変更・復元していない |
| 必須入力・横断入力 | 完了 | 行番号付きで読み、正本、status、test、履歴を分離した |
| raw log / `.next` | 未読 | 自動 summary に path があっても開いていない |
| network / external API | 未使用 | ローカルファイルの read-only 照合だけを実施 |
| runtime / lint / build / Prisma | 未実施 | 文書監査だけであり、新しい runtime 証跡や判定を作らないため。既存判定をそのまま保持 |
| code / config / dependency / generated output | 変更なし | 本書以外を編集していない |
| finding の原因統合 | 完了 | 同じ hosted/Postgres、Canvas baseline、日付文脈、snapshot drift は各 1 件へ統合 |
| 必須 section / finding 列 | 完了 | Objective、Scope、Inputs Read、役割分類、Findings、確認済み、投入順、Verification、Remaining Unknowns、Next Read を含む |

## Remaining Unknowns

| ID | 未確認事項 | 現在の扱い | 次に必要な根拠 |
| --- | --- | --- | --- |
| U-001 | 推敲後 UI の AppChrome、list、detail / paper、Canvas toolbar、901 / 900px、768 / 375px の runtime | Gate 0 未通過。`BLOCKED` / `NOT RUN` のまま | Browser backend、safe fixture、実 viewport / pointer / keyboard / scroll / screenshot、最終品質コマンド |
| U-002 | repository に残る Postgres scripts、依存、migration 資料を最終的に削除するか、履歴保管するか | 製品には不採用。本監査ではコードを直接棚卸しせず変更もしない | 専用 read-only inventory と発注者判断。実削除は別 task |
| U-003 | NoteCard / NoteCueLink / D&D を Canvas 本文とどう両立させるか | Phase 2 の未決事項。Target の legacy `body` 前提は採用しない | Gate 0 後の本文モデル判断、Canvas 維持 / card 併用 / 不採用の比較 |
| U-004 | Electron と Tauri + Node.js sidecar、user data directory の具体 path、PDF provider・layout・output destination | 意図的な未決事項。未着手 | Desktop PoC、PDF 設計、発注者承認 |
| U-005 | GitHub PR / Issue / checks の live state | 本監査対象外 | 必要になった時点の GitHub live read |

## Next Read

次回は raw log や欠落した自動 summary ではなく、本書を起点にする。

1. `summary/20260808/post-polish-document-consistency-audit-report.md`
2. DOC-001: `doc/requirements/PRODUCT_SPEC.md` → `README.md` → `doc/implementation/IMPLEMENTATION_STATUS.md` → `doc/testing/TEST_SCENARIOS.md`
3. DOC-002: `doc/implementation/MVP_CONTRACT.md` → `doc/requirements/MVP_SYSTEM_SPEC.md` → `doc/technical/MVP_TECHNICAL_DESIGN.md` → `doc/workflows/MVP_WORKFLOW_DESIGN.md`
4. DOC-003 / DOC-004: `doc/implementation/MVP_CONTRACT.md:51-77` → 本書の `nextReviewDate` matrix → `doc/screens/MVP_SCREEN_DESIGN.md` → `doc/screens/MVP_SCREEN_INVENTORY.md` → `doc/screens/MVP_UI_WIREFRAMES.md`
5. DOC-005: `doc/data/MVP_DATA_DESIGN.md:172-187` → `doc/api/MVP_API_DESIGN.md:339-531` → `doc/implementation/IMPLEMENTATION_STATUS.md:72-86`
6. Gate 0: `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md:59-112` → `HANDOFF_2026-08-08.md:30-66` → `doc/testing/TEST_SCENARIOS.md`
