# Post-MVP 依存関係付き実装計画

作成日: 2026-08-08

状態: 計画のみ。Phase 2、Desktop、PDF、Local LLM の実装 task は未投入・未着手

## 1. 位置づけ

この文書は、人力 MVP 結合テストと、その結果必要になった MVP 修正が完了した後に着手する作業の順序、依存関係、並行可能範囲、完了条件、Worker task の分割方針を定める。現行 MVP の実装・受け入れ契約を変更する文書ではない。

判断の正本は次のとおりとする。

- 製品全体方針、MVP / Phase 2 / 将来ロードマップ: [`PRODUCT_SPEC.md`](../requirements/PRODUCT_SPEC.md)
- 現行 MVP の実装・受け入れ契約: [`MVP_CONTRACT.md`](MVP_CONTRACT.md)
- 現在の実装状態: [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)
- 現行 MVP のテスト観点と証跡: [`TEST_SCENARIOS.md`](../testing/TEST_SCENARIOS.md)
- 将来の責務境界: [`TARGET_ARCHITECTURE.md`](../technical/TARGET_ARCHITECTURE.md)
- 最新の再開地点: [`HANDOFF_2026-08-08.md`](../../HANDOFF_2026-08-08.md)

本計画の「task 例」は、Gate 通過後に Manager が作成を検討する 1 task 1 file の分割例である。task file の作成・enqueue、実装着手、実装完了を示すものではない。

実装期間を見積もる根拠はまだないため、日数、工数、release date は定義しない。

## 2. 変更しない製品境界

全段階で次の境界を維持する。

- ノートデータの唯一の正本は、Mac 内の `user data directory` に置く SQLite とする。
- DB backup は SQLite の保全用コピーであり、ノートの外部出力形式とは区別する。
- アプリ外へノート内容を出す外部ファイル出力は、SQLite から一方向に生成する PDF だけとする。
- PDF は編集用データ、復元用正本、import 元、SQLite との同期対象にしない。
- クラウド DB、クラウド同期、オンラインサービス、外部 API、Postgres への移行は対象外とする。
- HTML export、任意のノートファイル形式、PDF import、双方向同期を計画へ追加しない。
- 将来の主配布経路は Mac desktop とし、開発・検証用の Next.js Web 起動経路は維持する。
- `app bundle` は実行コードと配布資産、`user data directory` は live SQLite、backup、設定、ログを置く領域として分離する。live DB を `.app` 内や同期フォルダへ置かない。
- モバイル本格最適化は初回 Mac desktop / Phase 2 Productivity の優先対象から外す。ただし開発用 Web、901px / 900px の境界、768px / 375px で主要操作へ到達できることと、ページ全体の意図しない overflow がないことは回帰確認を続ける。

## 3. 現在地と未実装機能の分類

### 3.1 現行 MVP の棚卸し

現行コードには、`/notes`、`/notes/new`、`/notes/[id]`、`/backup`、ノート CRUD、Cue、タグ候補と検索、`CanvasDocumentV1` 本文、Summary、詳細画面内の復習、確認後の物理削除、SQLite の手動 backup が存在する。保存は明示保存であり、Canvas 本文の正本は `NotebookCanvas.documentJson` に保存する `CanvasDocumentV1` である。

人力結合テスト済みの安定 baseline は未確定である。2026-08-08 の最新 handoff では in-app Browser backend が利用できず、AppChrome、一覧、作成、詳細、Canvas toolbar、901px / 900px 境界等の runtime acceptance は `BLOCKED` または `NOT RUN` で、UI runtime の PASS は 0 件である。この未確認範囲を静的確認、curl、過去の部分的な Browser 証跡だけで PASS にしない。

### 3.2 分類表

| 分類 | 機能・作業 | 現時点の扱い |
| --- | --- | --- |
| 必須 | Gate 0 の人力 MVP 結合テスト、見つかった MVP 修正、再テスト、品質コマンド、証跡更新、安定 baseline 確定 | 最優先。完了するまで後続 coding task を投入しない |
| 必須（Mac 主経路） | Desktop PoC と shell 選定、Desktop 基盤、データ保全、配布品質 | Mac desktop を主配布経路にするために必要。Gate 0 後に段階実施 |
| Phase 2（未実装） | 起動時 backup と履歴・retry、PDF export、draft / autosave / version・競合処理、soft delete / 5 秒 Undo / purge、専用復習タスク、タグ管理、Mac keyboard 操作、A11y 仕上げ | Stage 1 で採用範囲と契約を確定するまで未実装・未着手 |
| 判断待ち | Electron と Tauri + Node.js sidecar、user data path の具体値、PDF provider・レイアウト・出力先、backup timing、autosave payload・競合方式、復習タスク状態、Apple Silicon / Intel 配布方式、署名・更新方式 | 各段階の判断 Gate で発注者が承認する。推測で coding しない |
| 判断待ち（本文モデル） | NoteCard、CueCard、Cue と本文の ID link、hidden flag、D&D | 自動採用しない。Canvas 本文と競合するため、後述の本文モデル判断 Gate で分離する |
| 将来 PoC | 完全ローカルの LLM runtime、復習クイズ、Cue 候補 | Public Mac Release とは独立した Stage 11。PoC 採用時だけ別機能として実装する |
| 対象外 | クラウド DB・同期・サービス、外部 API、Postgres 移行、HTML export、任意ノートファイル、PDF import、双方向同期、認証・共有・共同編集 | 調査候補や将来予定へ戻さない |
| 優先度を下げる | モバイル専用の本格編集最適化 | Mac 主経路では後回し。ただし Web と breakpoint 回帰 QA は継続する |

## 4. Gate 0: 人力 MVP 結合テスト完了

### 4.1 現在の Gate 状態

Gate 0 は未通過である。最新 handoff では Browser runtime が利用できず、必須 UI 結合テストに `BLOCKED` / `NOT RUN` が残っているためである。

発注者が「結合テスト由来の修正が完了し、Gate 0 を閉じる」と明示するまで、Manager は Phase 2、Desktop、PDF、Local LLM の coding task を `codex-queue` へ投入しない。進捗 100% の古い queue state、静的テスト PASS、コードの存在、Browser を使わない確認を、この明示承認の代わりにしない。

### 4.2 客観的な完了条件

Gate 0 は、次のすべてを満たした場合だけ通過する。

1. `TEST_SCENARIOS.md` で現行 MVP の必須対象を確定し、人力結合テストを実ブラウザで完走する。
2. `/notes`、`/notes/new`、`/notes/[id]` の閲覧・編集・復習、`/backup`、保存・再読込、検索、review、削除、backup の一連の業務フローを確認する。
3. AppChrome、一覧、詳細 paper、Canvas toolbar、pointer / keyboard / wheel / touch、1440 / 1280px、901 / 900px 相互 resize、768 / 375px の必須 runtime 観点を、対象シナリオの契約に従って確認する。
4. Browser backend 未利用、route 未到達、safe fixture 不足、read-only 制約による `BLOCKED` / 必須 `NOT RUN` を PASS と扱わない。必要な環境と安全な fixture を用意して再実行する。
5. 結合テストで見つかった全 finding を記録し、MVP 修正対象は実装修正と再テストを完了する。コード変更不要、重複、対象外と判断する finding も、理由と発注者判断を残す。
6. 未解決の blocker / high severity を 0 件にする。その他の severity でも「MVP 修正対象」と判断したものは未解決のまま残さない。延期する場合は発注者が安定 baseline の既知制約として明示承認する。
7. 修正の影響範囲に応じた対象 test、`npm run test:e2e`、`npm run lint`、`npx tsc --noEmit --pretty false`、`npm run build` を、最終候補の同一 baseline で成功させる。
8. Prisma schema / migration に MVP 修正が触れた場合は、`npx prisma validate`、`npx prisma generate`、空 DB からの migration、既存 DB コピーからの migration も確認する。触れていない場合は非対象理由を証跡へ記録する。
9. `git diff --check` を成功させ、意図しないコード、設定、依存関係、DB、生成物が差分にないことを確認する。
10. `IMPLEMENTATION_STATUS.md` に実装状態、`TEST_SCENARIOS.md` に最終判定と証跡を反映し、最新 `HANDOFF_YYYY-MM-DD.md` と `AGENTS.md` の pointer を更新する。静的確認と Browser runtime の結果を分けて記録する。
11. baseline の branch / commit SHA、適用済み migration、テスト証跡、既知制約を固定し、同じ入力から再検証できる状態にする。
12. Manager が上記証跡を要約し、発注者が結合テスト由来の変更完了と安定 baseline を明示承認する。

### 4.3 Gate 0 の成果物

- MVP 結合テスト結果と finding 一覧。各 finding は severity、再現手順、修正 task、再テスト結果へ追跡できること。
- 最終品質コマンドの実行記録。
- 更新済み `IMPLEMENTATION_STATUS.md`、`TEST_SCENARIOS.md`、最新 handoff。
- 発注者が承認した baseline の識別子と既知制約。

### 4.4 Gate 0 の No-Go 条件

次のいずれかが残る場合は Gate 0 を閉じない。

- Browser runtime の必須項目が `BLOCKED` / `NOT RUN` / 未確認である。
- finding の修正後に同じ手順の再テストがない。
- blocker / high severity が未解決である。
- 対象 test、lint、TypeScript、build のいずれかが失敗または未実施である。
- 実装状況、テスト証跡、handoff、baseline SHA が同期していない。
- 発注者の明示承認がない。

### 4.5 Worker task 分割例

Gate 0 の QA と finding 修正は別 task に分ける。実測 FAIL がない surface の coding task は推測で作らない。

| 区分 | task file 例 | 1 task の目的 | queue |
| --- | --- | --- | --- |
| 仕様 / 調査 | `inventory-mvp-integration-coverage.task.md` | 必須シナリオ、fixture、未確認理由だけを確定する | Common |
| API / DB | `fix-mvp-api-observed-finding.task.md` | 実測済みの 1 API / DB failure family だけを修正する | API |
| UI | `fix-mvp-ui-observed-finding.task.md` | 実測済みの 1 surface / 1 failure family だけを修正する | UI |
| 共通 / 配布 | `restore-mvp-browser-qa-environment.task.md` | Browser runtime の利用可能性だけを回復・確認する | Common |
| QA | `qa-mvp-integration-baseline.task.md` | 修正済み baseline の人力結合テストと証跡更新だけを行う | Common |

## 5. Gate 0 後の実装原則

### 5.1 本文モデル判断 Gate

Manager 推奨: 初回 Desktop / Phase 2 Productivity では Canvas 本文（`CanvasDocumentV1`）を維持し、NoteCard / CueCard / D&D を除外する。Canvas はすでに現行本文の正本であり、NoteCard を先行導入すると、Canvas 要素と card の所有関係、Cue link、検索 index、PDF layout、autosave payload、migration を再定義する必要があるためである。

`TARGET_ARCHITECTURE.md` にある「NoteCard を autosave より先に決める」という案の適用範囲は、NoteCard を採用する場合の依存順に限る。Stage 1 で Canvas との製品整合性を再判断し、Canvas 維持を承認した場合は、その案を初回 Desktop / Phase 2 Productivity の実装順から外して詳細書を追従させる。

発注者が NoteCard を別途採用した場合だけ、Stage 6 の autosave payload と、それに関係する DB migration より前に、独立した仕様・migration 計画を作る。その計画では少なくとも次を決める。

- Canvas 全体を 1 card とみなすのか、card ごとに Canvas を持つのか。
- 既存 `CanvasDocumentV1`、legacy Markdown、Cue、検索 index、PDF の移行方式。
- NoteCard / CueCard / NoteCueLink の ID、順序、hidden、削除、Undo、version の境界。
- 既存ノートを自動変換するか、互換表示するか、rollback 可能性をどう保つか。
- D&D の pointer / keyboard / A11y 契約。

この判断が未確定のまま NoteCard migration と autosave migration を並行実装しない。

### 5.2 Worker task と queue の共通ルール

| 作業種別 | 投入先 | 分割ルール |
| --- | --- | --- |
| UI | `codex-queue/tasks-ui` | React component、page、CSS、画面 UX、UI runtime QA を 1 surface / 1 failure family で分ける |
| API / DB | `codex-queue/tasks-api` | Route Handler、contract validation、Prisma schema / migration、repository、backup / export server 処理を分ける |
| Common / 配布 | `codex-queue/tasks` | 仕様、調査、Desktop shell、packaging、logging、横断 contract、配布 QA を分ける |

- 1 task は 1 目的、1 task file とする。表に複数の task 名がある場合も、それぞれ別の `*.task.md` とする。
- 仕様・調査 task と coding task を同じ task file に入れない。coding task には Gate 通過後に `CODEX_TASK_KIND: coding` を付ける。
- 先行 task の summary と `Next Read`、変更結果、承認済み contract を確認してから依存 task を投入する。
- Prisma migration、共有 DTO、同一 UI surface の変更を含む task は並列投入しない。
- 各 coding task は対象 test、lint、TypeScript、build、`git diff --check` のうち影響に応じた検証を完了条件に含める。
- 下記 task 名は分割例であり、本計画作成時にはファイル作成も enqueue も行わない。

## 6. 推奨実装順と依存理由

| 順序 | 段階 | 直前段階へ依存する理由 / 後戻りを避ける理由 |
| --- | --- | --- |
| 0 | 人力 MVP 結合テスト完了 | 不安定な MVP に将来機能を重ねると、回帰原因と Phase 2 由来の不具合を分離できない |
| 1 | Phase 2 契約・採用範囲の確定 | 未決の payload、画面、保存・削除方式を coding で先に固定しないため |
| 2 | Desktop 最小 PoC と shell 選定 | shell により Node.js、Prisma native runtime、SQLite path、Playwright / Chromium、署名・更新の実現方式が変わるため |
| 3 | Desktop 基盤 | backup、PDF、autosave が使う runtime lifecycle、user data path、migration、ログを先に一つへ固定するため |
| 4 | データ保全 | 書き込み頻度や migration を増やす前に、正本 SQLite の backup、履歴、retry、復元可能性を確保するため |
| 5 | PDF export | Desktop の保存 dialog と Playwright 同梱を実配布境界で確定し、SQLite からの read-only 派生出力を先に安定させるため |
| 6 | draft / autosave / version・競合 | Desktop lifecycle、DB path、backup が安定してから書き込み経路と競合状態を増やすため |
| 7 | soft delete / 5 秒 Undo / purge | version 付き保存と削除の同時実行規則を先に持ち、復元・purge でデータを壊さないため |
| 8 | 専用復習タスク | soft-deleted note の除外、復元、purge と review task の参照整合性を先に確定するため |
| 9 | タグ、Mac keyboard、A11y | 主要データフローと画面が安定した後に操作体系を全体へ適用し、同じ UI を繰り返し直さないため |
| 10 | 配布品質 | 機能と migration が固まった候補を対象に署名、notarization、更新、data retention を検証するため |
| 11 | Local LLM 独立 PoC | 公開経路の必須品質と optional intelligence の性能・配布リスクを分離するため |

Desktop 基盤は backup、PDF、autosave より先に実装する。3 機能はいずれも、配布版の process lifecycle、書き込み可能 path、native module、Chromium、終了処理に依存する。Web 開発環境だけで先に実装すると、`.app` 内への誤書き込み、同梱漏れ、migration timing の再設計、保存 dialog の作り直しが起きるため、最小 PoC と基盤を先行させる。

## 7. Stage 1: Phase 2 契約・採用範囲の確定

### 開始条件

- Gate 0 が通過し、発注者が MVP 安定 baseline を承認済みである。
- 現行 MVP 契約と baseline の既知制約を参照できる。

### 成果物

- 現行 MVP を遡及変更しない、独立した Phase 2 契約または承認済み仕様差分。
- Desktop Alpha、Phase 2 Productivity、Public Mac Release の採用範囲。
- 本文モデル判断記録。推奨案では Canvas 維持、NoteCard / D&D 除外。
- draft、削除、復習、backup、PDF、タグの API / DB / UI / QA 影響表。
- 各後続段階の Go / No-Go 判断項目と acceptance matrix。

### Worker task 分割例

| 区分 | task file 例 | 1 task の目的 | queue |
| --- | --- | --- | --- |
| 仕様 / 調査 | `define-phase2-adoption-scope.task.md` | 採用・除外・判断待ちを 1 つの contract に確定する | Common |
| API / DB | `inventory-phase2-api-db-impact.task.md` | 未実装 endpoint、model、migration 依存だけを棚卸しする | API |
| UI | `inventory-phase2-ui-impact.task.md` | route、surface、状態、keyboard / A11y 影響だけを棚卸しする | UI |
| 共通 / 配布 | `define-post-mvp-release-boundaries.task.md` | release ごとの含有機能と非目標を確定する | Common |
| QA | `define-phase2-acceptance-matrix.task.md` | 各機能の静的・API・Browser・packaged-app 判定を分ける | Common |

### 完了条件

- 採用、除外、判断待ち、対象外が相互に矛盾せず、発注者が承認している。
- SQLite 正本、PDF 一方向、クラウド対象外、Canvas 維持または NoteCard 分岐が明記されている。
- 後続 coding task が仕様を推測せず作れる粒度の request / response、状態遷移、データ所有者、失敗時挙動が定義されている。

### 主な検証方法

- `PRODUCT_SPEC.md`、`MVP_CONTRACT.md`、API / data / screen / testing 文書との整合レビュー。
- 未実装 route / model / UI の静的棚卸し。
- `git diff --check`。この段階は docs-only とし、コード・設定・依存関係を変更しない。

## 8. Stage 2: Desktop shell / local runtime / Prisma・SQLite / Playwright 同梱の最小 PoC と shell 選定

### 開始条件

- Stage 1 の採用範囲と PoC 比較表が承認済みである。
- Electron と Tauri + Node.js sidecar を同じ fixture、同じ受け入れ条件で比較できる。

### 成果物

- Electron PoC と Tauri + Node.js sidecar PoC。製品機能追加ではなく同梱可能性の検証に限定する。
- shell が local Next.js runtime を起動し、ready 後に window を開き、終了時に runtime を停止する最小経路。
- PoC 専用の一時 user data path で Prisma Client、SQLite 作成・migration・read / write・再起動後 persistence を確認した証跡。
- packaged context から Playwright / Chromium を起動し、固定 fixture を PDF 化できる証跡。製品 PDF export はまだ実装しない。
- app bundle 内へ live DB を書かず、開発用 Web 経路を維持できる証跡。
- サイズ、起動、process、native module、security、署名・更新見通しを含む比較結果と shell 選定 ADR。

### Worker task 分割例

| 区分 | task file 例 | 1 task の目的 | queue |
| --- | --- | --- | --- |
| 仕様 / 調査 | `define-desktop-poc-comparison-contract.task.md` | 両候補共通の受け入れ条件と測定項目を固定する | Common |
| API / DB | `poc-electron-prisma-sqlite-runtime.task.md` | Electron packaged context の Prisma / SQLite 経路だけを検証する | API |
| API / DB | `poc-tauri-sidecar-prisma-sqlite-runtime.task.md` | Tauri sidecar の Prisma / SQLite 経路だけを検証する | API |
| UI | `poc-desktop-window-web-ui-smoke.task.md` | shell window で既存 Web UI の最小 route 表示だけを確認する | UI |
| 共通 / 配布 | `poc-electron-local-runtime-lifecycle.task.md` | Electron の local Next.js 起動・ready・終了だけを検証する | Common |
| 共通 / 配布 | `poc-tauri-sidecar-local-runtime-lifecycle.task.md` | Tauri sidecar の起動・ready・終了だけを検証する | Common |
| 共通 / 配布 | `poc-electron-packaged-playwright-chromium.task.md` | Electron packaged context の Chromium と固定 PDF fixture だけを検証する | Common |
| 共通 / 配布 | `poc-tauri-packaged-playwright-chromium.task.md` | Tauri sidecar packaged context の Chromium と固定 PDF fixture だけを検証する | Common |
| QA | `compare-desktop-shell-poc-evidence.task.md` | 共通基準で結果を比較し ADR の判断材料を作る | Common |

### 完了条件

- 両候補に同じ必須シナリオの実測結果があり、未測定を有利な推測で補っていない。
- 採用 shell、却下理由、残る配布リスクを発注者が承認している。
- Prisma / SQLite / Playwright の native・resource path が packaged app で成立する候補を選べる。
- PoC の一時 DB / PDF / build artifact を製品データや正式実装と扱っていない。

### 主な検証方法

- clean な一時 user data directory で初回起動、migration、CRUD、終了、再起動を実行する。
- local runtime の readiness、loopback 限定、異常終了時 cleanup、二重起動を観測する。
- packaged context の Chromium 起動と固定 PDF 生成、resource path、ログを確認する。
- `npm run lint`、TypeScript、PoC 固有 test、build、`git diff --check`。

## 9. Stage 3: Desktop 基盤

### 開始条件

- Stage 2 で shell が選定され、PoC の残課題と採用条件が承認済みである。
- `app bundle`、`user data directory`、PDF output destination の責務が分離されている。

### 成果物

- 選定 shell の正式な最小基盤。
- OS API で解決した user data directory、初回 directory / DB 作成、bundled migration 適用。
- local runtime の起動、ready、異常時表示、正常終了、子 process cleanup。
- single instance、重複起動時の既存 window activation。
- local file log と診断情報。ノート本文など不要な機微データは記録しない。
- app update と user data migration を分離する境界。
- `npm run dev` 等の開発用 Web 経路の維持。

### Worker task 分割例

| 区分 | task file 例 | 1 task の目的 | queue |
| --- | --- | --- | --- |
| 仕様 / 調査 | `define-desktop-runtime-lifecycle-contract.task.md` | startup / ready / shutdown / failure 状態を確定する | Common |
| API / DB | `implement-user-data-sqlite-bootstrap.task.md` | user data path で初回 DB 作成と migration を行う | API |
| UI | `implement-desktop-startup-failure-ui.task.md` | runtime / migration 失敗時の表示と終了導線を実装する | UI |
| 共通 / 配布 | `implement-desktop-runtime-lifecycle.task.md` | shell と local runtime の lifecycle だけを実装する | Common |
| 共通 / 配布 | `implement-desktop-single-instance.task.md` | single instance と既存 window activation だけを実装する | Common |
| 共通 / 配布 | `implement-desktop-local-logging.task.md` | user data directory の privacy-aware logging を実装する | Common |
| 共通 / 配布 | `preserve-development-web-entrypoint.task.md` | Desktop 追加後も開発 Web 起動を維持する | Common |
| QA | `qa-desktop-bootstrap-lifecycle.task.md` | clean / existing / migration failure / repeated launch を検証する | Common |

### 完了条件

- `.app` を読み取り専用とみなしても、live DB、ログ、設定が user data directory で動作する。
- clean install、既存 DB、migration 成功・失敗、再起動、二重起動、正常・異常終了を処理できる。
- app bundle 更新で user data を再作成・削除しない。
- Desktop と開発 Web が同じ HTTP / Canvas contract を使い、shell 固有 API が domain / UI 全体へ漏れていない。

### 主な検証方法

- path と file permission の自動 test、空 directory からの migration、既存 DB コピーからの migration。
- process / port / child cleanup、single instance、log 出力先の runtime QA。
- Desktop smoke と既存 Web E2E、lint、TypeScript、build、`git diff --check`。

## 10. Stage 4: データ保全

### 開始条件

- Stage 3 の user data path、migration timing、lifecycle、logging が安定している。
- backup の実行 timing、保持世代、失敗時に起動を継続するか止めるかが仕様で決まっている。

### 成果物

- 起動時 SQLite backup。migration 前後のどこで取得するかを明示した契約。
- backup 履歴、成功・失敗 log、retry と重複実行防止。
- `/backup` の履歴・失敗・retry UI。既存の手動 backup を壊さない。
- WAL / sidecar を含む安全な snapshot 方針、integrity check、容量不足・permission failure の扱い。
- 元の live DB を上書きせず、コピー上で行う復元手順と復元 rehearsal 証跡。

### Worker task 分割例

| 区分 | task file 例 | 1 task の目的 | queue |
| --- | --- | --- | --- |
| 仕様 / 調査 | `define-startup-backup-restore-contract.task.md` | timing、retention、failure、restore 手順を確定する | Common |
| API / DB | `implement-backup-history-log.task.md` | backup 実行結果の永続履歴だけを実装する | API |
| API / DB | `implement-backup-retry-service.task.md` | retry の冪等な server 処理だけを実装する | API |
| UI | `implement-backup-history-retry-ui.task.md` | 履歴表示と明示 retry 操作だけを実装する | UI |
| 共通 / 配布 | `implement-startup-backup-trigger.task.md` | Desktop lifecycle からの起動時 trigger だけを実装する | Common |
| QA | `qa-backup-failure-restore-rehearsal.task.md` | 破損させない失敗注入とコピー上の復元を検証する | Common |

### 完了条件

- 起動時 backup、手動 backup、履歴、retry が同じ live DB path と retention contract を使う。
- 成功した backup は integrity check を通り、失敗は履歴と UI に残り、無限 retry しない。
- 復元手順が別コピーで再現でき、元 DB と backup を誤って上書きしない。
- migration 失敗、容量不足、read-only、途中終了でも live DB の正本性を失わない。

### 主な検証方法

- 一時 SQLite fixture で success、permission、disk-space 相当、途中終了、retry、retention を自動検証する。
- backup から別 path へ復元し、row、Canvas JSON、検索 text、schema version を比較する。
- packaged Desktop の起動時 runtime QA、既存 `/backup` 回帰、lint、TypeScript、build。

## 11. Stage 5: PDF export

### 開始条件

- Stage 2 で packaged Playwright / Chromium の成立を確認し、Stage 3 の shell / path adapter、Stage 4 のデータ保全が完了している。
- PDF layout、対象範囲、provider、保存 dialog または選択可能な出力先、上書き、cancel、失敗時処理が承認済みである。

### 成果物

- SQLite から read-only に取得した DTO を PDF へ一方向変換する export service / provider。
- Cue、Canvas、Summary、metadata、複数ページ、長文、Canvas page 寸法を扱う PDF layout。
- OS save dialog またはユーザーが明示選択する出力先。`Downloads` への固定保存はしない。
- 進捗、cancel、成功、失敗、再試行可能性を示す UI。
- packaged Desktop での Chromium resource 解決と PDF 生成。
- PDF 生成が SQLite を更新せず、HTML や編集用ファイルを副生成しないことの証跡。

### Worker task 分割例

| 区分 | task file 例 | 1 task の目的 | queue |
| --- | --- | --- | --- |
| 仕様 / 調査 | `define-pdf-export-contract.task.md` | layout、対象、destination、error、cancel を確定する | Common |
| API / DB | `implement-pdf-export-read-model.task.md` | SQLite から export DTO を read-only 取得する | API |
| API / DB | `implement-pdf-generation-provider.task.md` | export DTO から PDF bytes を生成する provider を実装する | API |
| UI | `implement-pdf-export-ui.task.md` | export 操作、進捗、cancel、結果表示を実装する | UI |
| 共通 / 配布 | `implement-desktop-pdf-save-dialog-adapter.task.md` | shell の保存 dialog と出力 path 受け渡しだけを実装する | Common |
| 共通 / 配布 | `package-pdf-chromium-resources.task.md` | 選定 shell に Chromium resource を同梱する | Common |
| QA | `qa-packaged-pdf-export.task.md` | packaged app の layout、failure、DB 不変を検証する | Common |

### 完了条件

- PDF が SQLite の選択データから生成され、生成前後で DB hash / row / Canvas JSON が変わらない。
- cancel、書き込み不可、同名、Chromium 起動失敗、長いノート、空範囲を予測可能に処理する。
- PDF は閲覧可能で layout acceptance を満たし、app bundle / user data directory を暗黙の外部出力先にしない。
- packaged Desktop と開発 Web の対応範囲が仕様どおりである。Web 非対応部分は明示する。

### 主な検証方法

- export read model の API / repository test、DB before / after 比較。
- PDF page render の visual regression、文字・Canvas・改ページ・日本語 font の確認。
- packaged Desktop の save dialog、cancel、permission failure、resource path の runtime QA。

## 12. Stage 6: draft / autosave / version・競合処理

### 開始条件

- Stage 1 の保存契約、本文モデル判断 Gate、Stage 3 の lifecycle、Stage 4 の backup / restore、Stage 5 の read-only export 境界が完了している。
- 推奨案では autosave payload の本文は `CanvasDocumentV1` のままで、NoteCard / D&D を含めない。
- draft と確定保存の関係、idle / throttle、version 発行者、競合判定、再読込・再試行、終了時 flush 方針が承認済みである。

### 成果物

- draft / autosave の共有 request / response contract と version 規則。
- 必要な Prisma migration と、既存 note を失わない backfill / rollback 方針。
- server-side の原子的な version check と競合 response。
- editor の dirty / saving / saved / failed / conflicted 状態、手動 retry、再読込 UI。
- app 終了、runtime crash、複数 tab、遅延 response、Canvas 大容量 payload の扱い。

### Worker task 分割例

| 区分 | task file 例 | 1 task の目的 | queue |
| --- | --- | --- | --- |
| 仕様 / 調査 | `define-autosave-version-conflict-contract.task.md` | draft、version、manual save、conflict 状態を確定する | Common |
| API / DB | `migrate-notebook-draft-version-schema.task.md` | draft / version 用 schema migration だけを実装する | API |
| API / DB | `implement-versioned-autosave-endpoint.task.md` | 原子的 version check を持つ autosave API だけを実装する | API |
| UI | `implement-note-editor-autosave-state.task.md` | editor の autosave 状態機械だけを実装する | UI |
| UI | `implement-note-editor-conflict-recovery-ui.task.md` | conflict の再読込・再試行 UI だけを実装する | UI |
| 共通 / 配布 | `implement-desktop-autosave-shutdown-policy.task.md` | Desktop 終了時の pending save 方針だけを実装する | Common |
| QA | `qa-autosave-race-crash-recovery.task.md` | 遅延・順序逆転・crash・restart・競合を検証する | Common |

### 完了条件

- 古い version の遅延 response が新しい内容を上書きしない。
- 明示保存、autosave、draft restore、conflict recovery の責務が区別され、UI から状態が分かる。
- crash / restart 後に仕様どおり draft を復元または破棄でき、確定 note と Canvas JSON を破壊しない。
- backup、PDF export、既存 Web E2E に回帰がない。

### 主な検証方法

- repository / API の同時更新、順序逆転、重複 request、version mismatch test。
- fake timer を使う idle / throttle test と Browser runtime の状態表示。
- Desktop kill / restart、複数 tab、network delay 相当の E2E。
- migration を clean DB と既存 DB コピーで検証する。

## 13. Stage 7: soft delete / 5 秒 Undo / purge

### 開始条件

- Stage 6 の version / conflict contract と migration が安定している。
- whole-note 削除の soft delete 所有者、5 秒の起点、Undo token、purge timing、関連 row の扱いが承認済みである。
- NoteCard 非採用時は card 単位 Undo を持ち込まない。採用する場合は本文モデルの別計画を先に完了する。

### 成果物

- soft delete、Undo、purge の状態遷移と API contract。
- 必要な Prisma migration、通常 query からの deleted row 除外、関連整合性。
- 5 秒 Undo Snackbar と成功・期限切れ・失敗 UI。
- lifecycle に接続した冪等 purge と監査可能な log。
- backup / restore と削除済みデータの関係を示す運用ルール。

### Worker task 分割例

| 区分 | task file 例 | 1 task の目的 | queue |
| --- | --- | --- | --- |
| 仕様 / 調査 | `define-soft-delete-undo-purge-contract.task.md` | 状態、期限、対象、復元、purge を確定する | Common |
| API / DB | `migrate-soft-delete-state.task.md` | soft delete / Undo 用 schema migration だけを実装する | API |
| API / DB | `implement-note-undo-endpoint.task.md` | 期限内 Undo の server 処理だけを実装する | API |
| API / DB | `implement-expired-note-purge.task.md` | 期限切れ purge の冪等処理だけを実装する | API |
| UI | `implement-delete-undo-snackbar.task.md` | 5 秒 Snackbar と Undo 操作だけを実装する | UI |
| 共通 / 配布 | `schedule-desktop-purge-lifecycle.task.md` | purge を Desktop lifecycle に安全に接続する | Common |
| QA | `qa-soft-delete-undo-purge-boundaries.task.md` | 期限境界、再起動、競合、関連 row を検証する | Common |

### 完了条件

- 削除直後の対象が通常一覧・検索・詳細・review・PDF に現れず、期限内 Undo で同じ内容へ戻る。
- 期限切れ Undo は予測可能に拒否され、purge は二重実行しても安全である。
- autosave / manual save と delete / Undo が競合しても、削除済み note が意図せず復活または上書きされない。
- purge 前に定義済み backup policy が守られ、復元手順が説明できる。

### 主な検証方法

- fake clock で 5 秒前後、重複 Undo、重複 purge、restart を検証する。
- API / DB transaction test、一覧・検索・PDF・review の除外 test。
- Browser E2E で confirm、Snackbar、Undo、期限切れ UI を確認する。

## 14. Stage 8: 1 日後・1 週間後の専用復習タスク

### 開始条件

- Stage 7 の soft delete / restore / purge が完了している。
- task の起算日、1 日後 / 1 週間後の生成方式、timezone、status、完了後遷移、既存 `nextReviewDate` との関係が承認済みである。

### 成果物

- review task / progress の data model、生成・再生成・完了の contract。
- `/tasks/review` と必要な API、1 日後 / 1 週間後の表示、完了状態、未完了 badge。
- 既存の詳細画面内復習と `reviewedAt` / `nextReviewDate` を壊さない移行方針。
- soft-deleted / purged note、日付変更、重複生成、timezone 境界の規則。

### Worker task 分割例

| 区分 | task file 例 | 1 task の目的 | queue |
| --- | --- | --- | --- |
| 仕様 / 調査 | `define-review-task-scheduling-contract.task.md` | 起算日、status、timezone、既存復習との関係を確定する | Common |
| API / DB | `migrate-review-task-progress-schema.task.md` | review task / progress schema だけを実装する | API |
| API / DB | `implement-review-task-query-api.task.md` | task 取得 API だけを実装する | API |
| API / DB | `implement-review-task-completion-api.task.md` | task 完了 command だけを実装する | API |
| UI | `implement-review-task-screen.task.md` | `/tasks/review` の一覧と完了操作だけを実装する | UI |
| UI | `implement-review-task-nav-badge.task.md` | 未完了 badge だけを実装する | UI |
| 共通 / 配布 | `connect-review-task-desktop-date-boundary.task.md` | local timezone の日付切替処理だけを接続する | Common |
| QA | `qa-review-task-date-idempotency.task.md` | 月末・年末・timezone・重複・削除連携を検証する | Common |

### 完了条件

- 同じ note / schedule から重複 task を生成せず、1 日後 / 1 週間後を date-only contract どおり判定する。
- 完了操作、badge、詳細復習、既存 `nextReviewDate` が仕様どおり同期または分離されている。
- soft-deleted / purged note を表示・完了対象にせず、Undo 時の扱いも一意である。
- Web と Desktop で timezone / clock の結果が一致する。

### 主な検証方法

- date-only 純粋関数、month / year boundary、DST 相当、idempotency の test。
- API / DB transaction、soft delete / restore 連携 test。
- Browser E2E で tabs、完了後消失、badge、詳細復習遷移を確認する。

## 15. Stage 9: タグ管理、Mac keyboard 操作、A11y の仕上げ

### 開始条件

- Stage 6〜8 の主要画面・状態遷移が安定している。
- タグ rename / delete の参照整合性、keyboard shortcut の衝突規則、A11y acceptance が承認済みである。

### 成果物

- タグ rename / delete API と管理 UI。既存 note への反映、重複名、使用中削除を定義する。
- Mac 向けの保存、作成、Undo / Redo 等の採用済み shortcut。Canvas history、text editing、browser / OS shortcut と競合しない。
- dialog / Snackbar / menu / D&D 非採用時の全主要 UI に対する focus、keyboard、ARIA、screen-reader name の仕上げ。
- 901px / 900px、768px / 375px の Web 回帰確認。モバイル専用 UX の大規模再設計は含めない。

### Worker task 分割例

| 区分 | task file 例 | 1 task の目的 | queue |
| --- | --- | --- | --- |
| 仕様 / 調査 | `define-tag-management-contract.task.md` | tag rename / delete の参照・重複・確認規則だけを確定する | Common |
| 仕様 / 調査 | `define-mac-keyboard-contract.task.md` | 採用 shortcut と focus context の競合規則だけを確定する | Common |
| 仕様 / 調査 | `define-a11y-acceptance-contract.task.md` | keyboard / focus / ARIA の受け入れ条件だけを確定する | Common |
| API / DB | `implement-tag-rename-endpoint.task.md` | tag rename と重複処理だけを実装する | API |
| API / DB | `implement-tag-delete-endpoint.task.md` | tag delete と参照処理だけを実装する | API |
| UI | `implement-tag-management-ui.task.md` | tag 管理 surface だけを実装する | UI |
| UI | `implement-mac-note-shortcuts.task.md` | 採用済み Mac shortcut だけを実装する | UI |
| UI | `fix-dialog-focus-a11y.task.md` | dialog の focus / ARIA family だけを修正する | UI |
| 共通 / 配布 | `document-mac-keyboard-reference.task.md` | shortcut の利用者向け一覧だけを整備する | Common |
| QA | `qa-tag-management-runtime.task.md` | rename / delete と全利用箇所への反映だけを確認する | UI |
| QA | `qa-mac-keyboard-runtime.task.md` | shortcut と focus context の競合だけを確認する | UI |
| QA | `qa-a11y-responsive-regression.task.md` | screen reader、focus、901/900、768/375 回帰を確認する | UI |

### 完了条件

- tag rename / delete が全 note、filter、PDF、review task に一貫して反映される。
- shortcut が input / textarea / Canvas / dialog の focus context を尊重し、データ破壊や二重実行を起こさない。
- keyboard-only で主要フローを完了でき、focus が可視で、dialog focus が閉じた後に復元される。
- 901 / 900px 相互 resize と 768 / 375px で主要操作へ到達でき、ページ全体の意図しない horizontal overflow がない。

### 主な検証方法

- tag repository / API の重複、使用中削除、transaction test。
- Browser の keyboard-only、accessibility tree、focus order、Escape、Tab / Shift+Tab、screen reader spot check。
- Desktop と Web の shortcut、Canvas Undo / Redo、responsive regression E2E。

## 16. Stage 10: 配布品質

### 開始条件

- Desktop Alpha と Phase 2 Productivity の採用機能、migration、resource が release candidate として固定されている。
- Apple Silicon / Intel の配布方式、署名 identity、notarization、更新方式、rollback、データ保持方針が承認済みである。
- オンライン update service を当然の前提にしない。手動更新を含め、製品の「オンラインサービス対象外」と矛盾しない方式を選ぶ。

### 成果物

- Apple Silicon / Intel の対応 artifact。universal / arch 別の選択理由を記録する。
- code signing、hardened runtime、notarization、stapling の再現可能な release 手順。
- Prisma / SQLite native runtime、Node.js sidecar、Playwright / Chromium、font、migration の完全な同梱確認。
- 更新時の pre-update backup、migration、失敗時 rollback / recovery、user data 保持。
- install / update / reinstall / uninstall のデータ保持仕様。アンインストールと user data 削除を別操作にする。
- release checklist、support log の収集手順、既知制約。

### Worker task 分割例

| 区分 | task file 例 | 1 task の目的 | queue |
| --- | --- | --- | --- |
| 仕様 / 調査 | `define-mac-distribution-update-policy.task.md` | arch、署名、更新、rollback、data retention を確定する | Common |
| API / DB | `verify-packaged-migration-upgrade-path.task.md` | 旧 DB コピーからの packaged migration だけを検証する | API |
| UI | `implement-desktop-update-recovery-ui.task.md` | 採用方式で必要な update / recovery 表示だけを実装する | UI |
| 共通 / 配布 | `build-apple-silicon-release-artifact.task.md` | Apple Silicon artifact だけを構築・検証する | Common |
| 共通 / 配布 | `build-intel-release-artifact.task.md` | Intel artifact だけを構築・検証する | Common |
| 共通 / 配布 | `implement-sign-notarize-pipeline.task.md` | signing / notarization / stapling だけを自動化する | Common |
| QA | `qa-install-update-uninstall-data-retention.task.md` | install / update / reinstall / uninstall のデータ保持を検証する | Common |

### 完了条件

- 対象 arch の clean Mac で install、first launch、migration、主要フロー、PDF、backup、再起動が成功する。
- 署名・notarization の検証を通り、Gatekeeper 警告なく起動できる。
- update / reinstall で live SQLite、backup、設定を失わず、失敗時に recovery 手順を実行できる。
- uninstall だけでは user data を暗黙削除せず、削除方法を明示する。
- release artifact と source / commit / migration / checksum を追跡できる。

### 主な検証方法

- Apple Silicon / Intel の clean-environment smoke と packaged E2E。
- `codesign`、notarization、stapling、Gatekeeper の検証。
- 旧版 fixture からの update、migration failure、rollback、backup restore rehearsal。
- artifact 内容の native module / Chromium / font / migration inventory。

## 17. Stage 11: Local LLM の独立 PoC と採用時の別機能実装

### 開始条件

- Public Mac Release の必須品質と、Local Intelligence の optional scope を分離できる。
- 外部 API やクラウド推論を使わず、完全ローカルで比較する PoC 契約が承認済みである。

### 成果物

- production note を変更しない独立 PoC。
- model / runtime の license、配布サイズ、起動時間、推論時間、メモリ、CPU / GPU、Apple Silicon / Intel 可否、offline 動作の測定。
- notebook data を外部送信しないこと、log に本文を残さないことの確認。
- Go / No-Go ADR。No-Go でも PoC は完了とし、製品実装を作らない。
- Go の場合だけ、復習クイズと Cue 候補を別々の仕様・task 群として作る。

採用時の機能境界は次のとおりとする。

- 復習クイズはユーザーの明示操作で生成し、想起、答え合わせ、根拠、解説を支援する。自動採点や自動保存を初期前提にしない。
- Cue 候補はユーザーが先に書いた Cue を置き換えず、追加、編集して追加、無視を選べる候補として表示する。
- どちらも自動で SQLite の note 本文を更新しない。結果を保持する場合は、採用後の別 contract と migration を先に承認する。

### Worker task 分割例

| 区分 | task file 例 | 1 task の目的 | queue |
| --- | --- | --- | --- |
| 仕様 / 調査 | `define-local-llm-poc-contract.task.md` | offline、privacy、性能、license の評価基準を確定する | Common |
| API / DB | `poc-local-llm-note-read-adapter.task.md` | read-only DTO を PoC へ渡す境界だけを検証する | API |
| UI | `poc-local-llm-interaction-surface.task.md` | production 保存へ接続しない PoC UI だけを検証する | UI |
| 共通 / 配布 | `poc-local-llm-runtime-packaging.task.md` | local model runtime の同梱・起動・resource 使用量を測る | Common |
| QA | `evaluate-local-llm-poc-evidence.task.md` | privacy、offline、品質、性能、arch 差を判定する | Common |
| 仕様 / 調査（採用時のみ） | `define-review-quiz-feature-contract.task.md` | 復習クイズだけの製品 contract を作る | Common |
| 仕様 / 調査（採用時のみ） | `define-cue-suggestion-feature-contract.task.md` | Cue 候補だけの製品 contract を作る | Common |

### 完了条件

- PoC はネットワークなしで再現でき、本文の外部送信と暗黙保存がない。
- 対象 arch での資源量と品質を測定し、未測定値を推測で補っていない。
- 発注者が Go / No-Go を判断できる ADR がある。
- Go の場合も、復習クイズと Cue 候補を同じ coding task に混ぜず、それぞれの完了条件を持つ。

### 主な検証方法

- network disabled の packaged PoC、process / file / log 観測、resource 計測。
- 固定したローカル fixture に対する再現性、誤答・根拠・日本語品質の人手評価。
- model / runtime license と artifact inventory のレビュー。

## 18. 並行可能範囲と直列化する範囲

### 18.1 並行可能な作業

| 作業 | 並行条件 |
| --- | --- |
| Electron PoC と Tauri sidecar PoC | 共通 PoC contract と fixture を先に固定し、root の package / config を共有編集しない独立 directory・manifest・build artifact を使う。分離できない場合は直列化する |
| Desktop PoC の runtime 測定と shell 非依存の比較資料 | 測定項目と出力形式を固定し、比較判定は両結果が揃ってから行う |
| backup UI wire / acceptance と backup server の設計 | API / state contract を先に固定し、同じ実装ファイルを触らない |
| PDF layout fixture と read-only export projection | PDF contract を先に固定し、provider integration は両方の完了後に行う |
| Stage 9 の tag API と keyboard / A11y 調査 | notes contract と対象 UI file の編集開始前。UI 統合時は直列化する |
| Apple Silicon と Intel の artifact 検証 | 同じ release commit、同じ packaging contract、arch 別 output directory を使う |
| Local LLM の license / performance / quality 調査 | 固定 fixture と read-only PoC 境界を共有し、production code / data に接続しない |

### 18.2 直列化が必要な作業

| 競合点 | 直列化する理由 |
| --- | --- |
| `prisma/schema.prisma` と migration history | Stage 3、4、6、7、8、9 の schema 変更を並べると migration 順序、backfill、rollback が競合する。1 migration ごとに clean / existing DB を検証して次へ進む |
| notes の共有 DTO / Zod contract / save payload | Canvas、autosave、soft delete、review、tag が同じ contract を触る。承認済み contract → server → UI の順で統合する |
| note editor / detail / list / AppChrome の同一 UI file | autosave state、Undo、review badge、keyboard、A11y を同時編集すると状態と focus の回帰原因を分離できない。surface ごとに merge と QA を終えて次へ進む |
| Desktop main process / sidecar lifecycle / packaging config | path、port、process、resource、signing の設定が共有される。shell 基盤を固定してから backup / PDF hook、最後に release 設定を入れる |
| PDF provider と Playwright / Chromium packaging | resource path と launch options を共有する。PoC 結果 → provider → packaged integration の順にする |
| backup、migration、purge、update | 全て live SQLite を扱う。backup policy を先に固定し、migration、purge、update ごとに復元 rehearsal を挟む |
| Phase 2 contract、acceptance matrix、release boundary 文書 | 同じ決定を複数文書へ並行記入せず、正本決定後に詳細書を追従させる |

Manager は、作業が異なる queue にあっても、共有 contract、Prisma schema、同一 UI file のいずれかを変更する場合、依存 task の完了 summary と差分を確認してから次を enqueue する。

## 19. 推奨リリース境界

| Release boundary | 含める段階 | 出荷判断 |
| --- | --- | --- |
| MVP 安定 baseline | Gate 0 | 現行 Web MVP の人力結合テスト、修正、品質コマンド、証跡、発注者承認が完了 |
| Desktop Alpha | Stage 1〜5 | 選定 shell、user data SQLite、migration / lifecycle、backup / restore、PDF が packaged app で動作。内部評価用で、Public 配布品質はまだ要求しない |
| Phase 2 Productivity | Stage 6〜9 | Canvas 本文を維持した autosave、Undo、review task、tag / keyboard / A11y が統合済み。NoteCard / D&D は別途採用しない限り含めない |
| Public Mac Release | Stage 10 | 対象 arch、署名、notarization、更新、install / uninstall data retention、packaged regression が完了 |
| Local Intelligence | Stage 11 の Go 後 | Local LLM PoC 採用後、復習クイズと Cue 候補を別機能として受け入れ済み。Public Mac Release の必須条件にはしない |

各 release boundary は前段の完了条件を継承する。後段の機能を部分的に先行 demo できても、前段 Gate を通過したことにはしない。

## 20. 発注者が次に承認する事項

発注者が最初に承認する事項は Gate 0 の閉じ方である。

1. Gate 0 の客観的完了条件と、「Browser 未利用の未確認は PASS にしない」基準を承認する。
2. Browser runtime を利用できる環境で MVP 結合テストを再開し、finding 修正と再テストを完了する。
3. 証跡が揃った後、MVP 安定 baseline と Gate 0 通過を明示承認する。
4. Gate 0 後に、Stage 1 の採用範囲と、Manager 推奨である「初回 Desktop / Phase 2 Productivity は Canvas 本文を維持し、NoteCard / D&D を除外する」を承認または変更する。
5. Stage 1 完了後に、Stage 2 の Electron / Tauri + Node.js sidecar 共通 PoC contract を承認する。

この順番を飛ばして、Phase 2、Desktop、PDF、Local LLM の coding task を投入しない。
