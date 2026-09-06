# MVP テストシナリオ（1 項目 1 チェック）

更新日: 2026-08-24

## 位置づけ

このドキュメントは、Cornell Method Notebook MVP の最終検証項目を定めます。

MVP の確認対象は、明示保存、物理削除、手動で管理する `nextReviewDate`、編集画面の Cue / Summary `textarea + Markdown Preview`、詳細画面の Summary 読み取り領域、中央のフリー入力 Canvas 本文、`/notes` の復習対象フィルタ、詳細画面内の復習モード、`/backup` の手動バックアップです。新規ノートの `nextReviewDate` は `noteDate + 7日` を初期値とします。既存ノートの復習画面では保存値を再利用せず、画面を開いた時点の `Asia/Tokyo` 基準の現在日付 + 7日を初期表示します。1 日後 / 1 週間後の自動タスクや専用復習タスク画面は MVP の確認対象ではありません。

MVP の初期データに seed は使いません。検証用データは `/notes/new` または `POST /api/notes` で作成します。

`doc/requirements/PRODUCT_SPEC.md` に含まれる Desktop Alpha、Canvas PNG、検索サジェスト、大規模一覧は、このドキュメント末尾の「Desktop Alpha / Phase 2 / 将来確認」に分離します。autosave、Undo、専用復習タスク画面、D&D、NoteCard 等は未採用候補、PDF export は現在未採用として同じ節で区別します。現行 MVP の受け入れ根拠は `doc/implementation/MVP_CONTRACT.md` です。

## 現行 MVP Gate 0 の最終判定（2026-08-11）

現行 MVP Gate 0 は、発注者が完了と判断した MVP 人力結合テストを根拠に、完了（PASS）とします。人力結合テストには、テスト中に見つかった問題の修正と修正後の再確認を含みます。

| 項目 | 現行判定 |
| --- | --- |
| Gate 0 の受け入れ根拠 | 発注者が実施し、修正・再確認を含めて完了と判断した MVP 人力結合テスト |
| 対象範囲 | `/notes`、`/notes/new`、`/notes/[id]`、`/backup` の現行 MVP。明示保存、閲覧・編集・復習、検索、確認付き物理削除、手動 SQLite backup を含む |
| Browser / mobile / wheel、実 DB read-back、E2E、外部 Postgres、build / Prisma | Gate 0 の必須条件や blocker ではない。未確認の場合は履歴・任意 QA として扱う |
| `BLOCKED` / `NOT RUN` の過去記録 | 削除・改変せず保持する。現行 Gate 0 の未完了根拠にはしない |
| Gate 0 完了後 | Desktop PoC と Desktop Alpha を先行する。Canvas PNG と検索・一覧は Desktop Alpha 後の採用済み要件だが、現行 MVP へ繰り上げない。PDF export 等の未採用候補を自動実装しない |

下記のチェックリスト、個別シナリオ、静的検証、Browser runtime の判定は詳細な証跡・履歴です。個別行の `FAIL（静的照合）`、`部分実施`、`未実施`、`BLOCKED`、`NOT RUN` は、それぞれの記録範囲を示すものであり、現行 Gate 0 の最終判定を取り消しません。

## 再実行可能な Playwright E2E

主要 MVP フローは `npm run test:e2e` で再実行します。`npm install` 済みであることを前提とし、Playwright Chromium が未導入の場合は `npx playwright install chromium` を一度実行します。`@playwright/test` は既存の `playwright` 本体と同じ `1.61.0` に揃えています。

Playwright は `127.0.0.1:4173` の専用 web server を起動し、実行開始時に既存 migration から `prisma/e2e.db` を作成します。テスト終了時に削除する対象は `prisma/e2e.db` とその `-journal` / `-shm` / `-wal` sidecar だけです。`prisma/dev.db`、既存ノート、`backup/`、別ポートで動作中の server は使用・削除しません。worker は 1、serial suite で固定し、並列 fixture 競合を避けます。

自動 E2E は、`/` → `/notes` redirect、現在日以前の日付を使ったタイトル・Cue・Summary の作成、保存後の `/notes/[id]` と Canvas viewer、編集保存、一覧 query 検索をカバーします。詳細の復習モードでは本文表示 / 再非表示と `POST /api/notes/:id/review`、削除では確認ダイアログ受け入れ後の物理削除と一覧 / API からの消失を確認します。保存後に `GET /api/notes/:id` を呼び出し、Cue の `text` と `order` が保存前の内容・順序どおりに復元されることも確認します。失敗時は `test-results/` に trace・screenshot・video、`playwright-report/` に HTML report を生成します。これらは Git 管理対象外です。

2026-07-05 の `summary/20260705/mvp-ui-flow-reverification-report.md` は、既存 DB と単発 QA 用データを使った別の検証記録です。この自動 E2E の実行証拠には使用しません。Desktop Alpha、Canvas PNG、検索サジェスト、大規模一覧と、未採用の PDF export、autosave、soft-delete / Undo、専用 review-tasks、NoteCard / D&D はこの E2E の coverage boundary 外です。Playwright / Chromium の既存利用は Desktop PoC の必須条件を意味しません。

## MVP 受け入れ確認

### 1. 初期表示 / ナビゲーション

- [ ] `/` を開くと `/notes` へ誘導される、またはノート一覧へ移動できる
- [ ] `/notes` を開くとノート一覧画面が表示される
- [ ] `/notes` から `/notes/new` へ移動できる
- [ ] `/notes` のノート項目から `/notes/[id]` へ移動できる
- [ ] 共通ナビゲーションから `/notes` へ移動できる
- [ ] 共通ナビゲーションから `/notes/new` へ移動できる
- [ ] 共通ナビゲーションから `/backup` へ移動できる
- [ ] `/backup` を開くとバックアップ画面が表示される

### 2. ノート作成

- [ ] `/notes/new` でタイトル未入力のまま保存すると validation error が表示される
- [ ] `/notes/new` でタイトルが 120 文字を超えると validation error が表示される
- [ ] `/notes/new` で学習日（`noteDate`）を入力・変更でき、保存した値が作成ノートの学習日として表示される
- [ ] `/notes/new` で未来日の学習日は保存できない
- [ ] `/notes/new` を開くと `nextReviewDate` に `noteDate + 7日` が初期入力される
- [ ] `/notes/new` の `nextReviewDate` 初期値が月末（例: `2026-01-31` → `2026-02-07`）・年末（例: `2026-12-31` → `2027-01-07`）を正しく跨ぐ
- [ ] `/notes/new` で初期入力された `nextReviewDate` を別の日付へ変更、または空欄化して保存できる
- [ ] `/notes/new` で次回復習日が学習日より前の場合は validation error が表示される
- [ ] `/notes/new` で Cue を追加できる
- [ ] `/notes/new` で Cue を削除できる
- [ ] `/notes/new` で空の Cue は保存対象から除外される、または validation error として扱われる
- [ ] `/notes/new` でタグを最大 12 個まで追加できる
- [ ] `/notes/new` で 13 個目のタグ追加または保存が拒否される
- [ ] `/notes/new` で同一ノート内の重複タグが拒否される、または重複除外される
- [ ] `/notes/new` で既存タグ候補を選択して保存できる
- [ ] `/notes/new` で未登録タグを入力すると保存時に自動作成される
- [ ] `/notes/new` で逆アルファベット順（例: `zeta` → `middle` → `alpha`）にタグを追加して保存し、保存後の再読込で `/notes` 一覧、`/notes/[id]` 詳細、編集モードのタグ表示が入力配列の追加順を維持する
- [ ] `/notes/new` で中央の Canvas 本文に文字・図形・線・ストロークを配置できる
- [ ] `/notes/new` の Canvas 用紙サイズ入力が幅 1200px・高さ 800px を既定値として表示する
- [ ] `/notes/new` の Canvas 用紙サイズに幅・高さの数値入力と `適用` 操作がある
- [ ] `/notes/new` の Canvas 用紙サイズ入力は整数 px の 320〜4000 の範囲だけを受け付ける
- [ ] `/notes/new` の Canvas 用紙サイズで小数、0、負数、320 未満、4000 超、空欄などの無効値が適用・保存できず field error が表示される
- [ ] `/notes/new` の Canvas 用紙サイズ変更時に既存要素の `x`, `y`, `width`, `height`, `points`, `style` が変わらない
- [ ] `/notes/new` の Canvas 用紙を小さくして要素が境界外になっても、要素が削除・移動・縮小されない
- [ ] `/notes/new` の現行 UI に `Fit` / `50%` / `100%` / `200%` の表示倍率操作がないことを確認する。将来倍率操作を追加する場合も、表示倍率は用紙サイズ入力・保存値と分離する
- [ ] `/notes/new` のサマリー Markdown preview に入力内容が反映される
- [ ] `/notes/new` で保存中は保存ボタンが disabled になり `保存中...` が表示される
- [ ] `/notes/new` で保存 API が失敗した場合、フォーム上部に error alert が表示される
- [ ] `/notes/new` で有効な入力を保存すると `POST /api/notes` が成功する
- [ ] `/notes/new` の保存成功後に作成したノートの `/notes/[id]` へ遷移する

#### Canvas 本文・用紙サイズの保存／復元

- [ ] Canvas を含むノートを保存すると `bodyMode=canvas` と `CanvasDocumentV1` が保存される
- [ ] Canvas を含むノートの保存後、詳細画面で保存済み `page.width` / `page.height` が表示・復元される
- [ ] Canvas を含むノートを編集して用紙サイズだけを変更し、再保存・再読込しても既存要素の `x`, `y`, `width`, `height`, `points`, `style` が変更されない
- [ ] Canvas の要素を用紙の外側へ置いた状態で保存・再表示しても、要素が削除・移動・縮小されない
- [ ] 既存の 1200x800 Canvas document を開いても、要素データが自動変換されず同じ位置・寸法で表示される
- [ ] 既存 Canvas document を開くだけで用紙サイズや要素の保存値が書き換えられない
- [ ] Canvas の用紙サイズだけを変更しても Canvas text 由来の `searchText` は変わらず、一覧の同じ検索語で同じノートが検索できる
- [ ] 詳細閲覧・編集・復習の各表示が保存済み Canvas document を使い、復習時の本文マスク／表示切替が Canvas JSON を変更しない

#### Canvas 操作・スタイル・図形内文字（2026-07-19 追加）

次の 6 項目は、既存の `CANVAS-DIMENSION-001`（用紙サイズ、保存・復元、resize 前後の要素不変）と分けて確認する。コード・設計との静的照合結果は根拠欄に残すが、ブラウザ実機の pointer、touch、保存・再読込、viewport 証跡がない場合は `PASS` に繰り上げない。

- [ ] `CANVAS-INTERACTION-001` 空白および既存要素上からの Canvas 要素作成と gesture 開始対象の安全境界
  - 対象 route / 画面状態: `/notes/new` の編集状態、および `/notes/[id]` の編集状態。Canvas 本文を表示し、空白と 6 種類の基準要素（pen stroke、line、arrow、rect、ellipse、standalone text）を同一用紙に用意する。
  - 操作:
    1. `pen`、`line`、`arrow`、`rect`、`ellipse`、`text` を順に選び、Canvas の空白から各要素を 1 件ずつ作成する。standalone text は文字を入力して確定する。
    2. 同じ 6 ツールを順に選び、基準要素の上を pointer down の開始点として新しい stroke、line、arrow、rect、ellipse、standalone text を追加する。少なくとも pen stroke、line、arrow、rect、ellipse、standalone text の各上で新規 gesture を行う。
    3. line / arrow / rect / ellipse の drag preview が表示されている間、一時 preview を新規 gesture の対象にしようとする。図形内文字の inline editor overlay を表示した状態でも、overlay またはその周辺から別の新規 gesture を開始しようとする。必要なら metadata がない一時 object / unknown object を使った検証用 fixture または DevTools の観察を併用する。
  - 期待結果:
    - 空白から 6 種類の要素を作成でき、既存のアプリ所有要素上からも同じ tool で新しい要素を追加できる。
    - 重ね描き後も既存要素の id、位置、寸法、points、style、rotation、text、z が意図せず移動・resize・変形・消失しない。新規要素だけが追加される。
    - metadata がない object、`isCanvasPreview` の一時 preview、図形内文字の inline editor overlay 上では新規 gesture が開始されず、preview が保存済み要素へ混入しない。既存 document に変更がないことを確認できる。
  - 未確認時の判定: 空白・6 種類の基準要素上・preview / overlay 境界の実機操作と document 比較の証跡が揃わない限り `未実施` とする。静的に `isCanvasDrawingTarget` 等を確認しただけでは `PASS` にしない。

- [ ] `CANVAS-GESTURE-001` クリック／ダブルクリックと 4px drag threshold の切り分け
  - 対象 route / 画面状態: `/notes/new` または `/notes/[id]` の編集状態。Canvas document の要素数と各要素の geometry を操作前に記録する。
  - 操作:
    1. `line`、`arrow`、`rect`、`ellipse` の各 tool で空白をクリックし、同じ場所をダブルクリックする。pointer の移動がない操作と、開始点から 4px 未満（判定用 3px）の微小 drag をそれぞれ行う。
    2. 4px の実装閾値を十分に超える drag（判定用 5px 以上）を各 tool で行い、pointer move 中の preview と pointer up 後の確定要素を確認する。境界値を試した場合は実際の移動量と結果を記録する。
    3. `text` tool の通常クリックで standalone text を作成し、別の図形を `select`、`rect`、`ellipse` のいずれかでダブルクリックして inline text editor を開く。さらに `rect` / `ellipse` の tool で十分な drag を行い、新規図形を作成する。
  - 期待結果:
    - line / arrow / rect / ellipse のクリック、ダブルクリック、4px 未満の微小 drag は preview も確定要素も作らず、要素数・document が変わらない。小さな不要図形や極小 geometry が残らない。
    - 4px の閾値を超える drag だけが preview を表示し、pointer up で 1 件の新規要素を確定する。click の no-op、図形作成、inline 編集の経路が混同されない。
    - standalone text の通常クリックは standalone text の入力になり、図形のダブルクリックは対象図形の inline editor になり、十分な図形 drag は新規 shape になる。
  - 未確認時の判定: クリック／ダブルクリック、3px 未満、4px 閾値超過、standalone text、shape inline text、十分な shape drag の全パターンを同一手順で実機確認できない限り `未実施` とする。閾値や要素数の記録がない静的確認は `PASS` の根拠にしない。

- [ ] `CANVAS-SHAPE-TEXT-001` 図形内文字の inline editor、表示、確定・キャンセル、Fabric lifecycle
  - 対象 route / 画面状態: `/notes/new` または `/notes/[id]` の編集状態。pen stroke、line、arrow、rect、ellipse、standalone text を先に配置し、rect と ellipse を図形内文字の対象にする。
  - 操作:
    1. `select`、`rect`、`ellipse` の各 tool を使って、rect と ellipse をそれぞれダブルクリックする。inline text editor に入り、文字を入力する。
    2. 編集中に図形の外形、既存の図形内表示文字、inline editor の表示を観察する。既存文字がある図形では、表示文字と editor の二重描画がないことを確認する。
    3. 片方の編集を別操作への移行または blur で確定し、別の試行では `Escape` またはキャンセル相当の操作で取り消す。確定後・キャンセル後に、対象 shape と先に配置した pen stroke、line、arrow、別図形、standalone text を比較する。
    4. inline editor の文字配置を toolbar の `left` / `center` / `right` へ変更する。入力欄へ再フォーカスせず、toolbar 操作直後の図形内文字の表示を確認する。
    5. ブラウザ console と画面の error alert を確認し、編集開始、確定、キャンセル、別要素選択の各 lifecycle を繰り返す。
  - 期待結果:
    - rect / ellipse の外形は inline 編集中も表示され、既存の図形内文字だけが overlay と二重描画されない。
    - 確定時は対象 shape の文字だけが更新され、キャンセル時は元の文字・style へ戻る。対象 shape と他の Canvas 要素が保持される。
    - `exitEditing`、`onDeselect` の cleanup が安全に完了し、`undefined` の `fire` など Fabric lifecycle error、未解放 overlay、孤立した編集 object が発生しない。
    - inline 編集中の文字配置変更は再フォーカスなしで表示へ反映される。
  - 未確認時の判定: rect / ellipse の両方について tool 別のダブルクリック、確定、キャンセル、他要素保持、console error 無し、再フォーカス無しの配置反映を確認できない限り `未実施` とする。コード上の lifecycle 保護だけでは `PASS` にしない。

- [ ] `CANVAS-STYLE-001` style controls の入力制約、対象別の色・文字配置、即時反映
  - 対象 route / 画面状態: `/notes/new` または `/notes/[id]` の編集状態。stroke 系要素、standalone text、rect / ellipse と図形内文字を用意し、選択中と inline 編集中の両方を確認する。
  - 操作:
    1. toolbar の線幅と文字サイズを、対象なし／stroke 選択／text 選択の各状態で確認する。既定値を記録し、線幅は 1、20、0、21、1.5、空欄、文字サイズは 8、96、7、97、12.5、空欄を入力して blur または Enter で適用する。
    2. pen、line、arrow、rect、ellipse または選択中の stroke 系要素へ color input を適用し、線色が変わることを確認する。standalone text を選択中に同じ color input を適用し、文字色が変わることを確認する。
    3. rect / ellipse の inline text editor 中にも color input を適用し、shape の外形色ではなく図形内文字色へ反映されることを確認する。
    4. standalone text と shape inline text のそれぞれで `left`、`center`、`right` を順に選択する。図形内文字の編集中は入力欄へ戻らずに alignment button を操作する。
  - 期待結果:
    - 線幅の既定値は 1px、許容範囲は整数 1〜20px、文字サイズの既定値は 12px、許容範囲は整数 8〜96px である。
    - 小数、空欄、範囲外の値は document や対象 object へ適用されず、field error / `aria-invalid` または既存値維持として確認できる。
    - color input は stroke 対象では線色、standalone text と shape inline text では文字色として反映される。文字配置は両方で left / center / right を選択できる。
    - 選択中の object と図形内文字編集中の text は、線幅・文字サイズ・色・文字配置の変更が入力直後に Canvas 表示へ反映される。
  - 未確認時の判定: 各境界値・無効値、stroke / standalone text / shape inline text の色、両方の文字配置、再フォーカスなしの即時反映を実機で確認できない限り `未実施` とする。toolbar の min / max や静的 handler 確認だけでは `PASS` にしない。

- [ ] `CANVAS-PERSISTENCE-STYLE-001` style / textStyle の保存境界と保存・再読込回帰
  - 対象 route / 画面状態: `/notes/new` の編集・明示保存、`/notes/[id]` の閲覧・編集・再読込、および対応する `POST /api/notes`、`PATCH /api/notes/:id`、`GET /api/notes/:id`。
  - 操作:
    1. standalone text に font size、fill、textAlign を設定し、rect / ellipse の図形内文字にも別の font size、fill、textAlign を設定する。line / arrow / rect / ellipse と pen stroke には線幅・線色を設定する。
    2. 保存前の Canvas document と、明示保存の response または `GET /api/notes/:id` の Canvas JSON を記録する。standalone text、shape inline text、stroke 系要素の保存フィールドをそれぞれ確認する。
    3. `/notes/[id]` を再読込して閲覧・編集を開き、style、textStyle、文字、既存要素、page 寸法が保存前と同じ表示・値で復元されることを確認する。
    4. 既存要素を保持したまま用紙だけを 1920 x 1080 など別寸法へ変更して保存し、再読込後に変更前後の `style`、`text`、geometry（`x`、`y`、`width`、`height`、`points` 等）、`searchText` を比較する。
  - 期待結果:
    - standalone text の font size、fill、textAlign は `style.fontSize`、`style.fill`、`style.textAlign` に入り、shape inline text の同じ値は `textStyle.fontSize`、`textStyle.fill`、`textStyle.textAlign` に入る。線幅・線色は element の `style.strokeWidth`、`style.stroke` に入る。
    - 保存・再読込後も style、textStyle、text、既存要素、page width / height が復元される。Fabric 固有の一時 preview / editor overlay は保存 JSON に入らない。
    - 用紙サイズだけを変更した場合は、style、text、geometry、`searchText` が不要に変化しない。用紙サイズ変更の責務は既存 `CANVAS-DIMENSION-001` と共有し、寸法専用の新規 DB / API を前提にしない。
  - 未確認時の判定: API response または GET の JSON、再読込表示、用紙だけを変更した前後の比較のいずれかが欠ける場合は `未実施` とする。static save boundary の照合は runtime の保存・復元 `PASS` にはしない。

- [ ] `CANVAS-TOOLBAR-STYLE-001` toolbar の responsive、keyboard / touch 到達性、状態表示、Canvas scroll 回帰
  - 対象 route / 画面状態: `/notes/new` と `/notes/[id]` の編集状態。Canvas toolbar、Canvas 本体、Summary、footer が同一ページに存在する状態。
  - 操作:
    1. viewport を 375px、768px、1280px、1440px に切り替える。Tab / Shift+Tab で style input、left / center / right button、用紙の disclosure・幅・高さ・適用、各 tool group の全 controls へ到達する。各 viewport で touch 操作も行う。
    2. tool を切り替え、stroke 系 object を選択し、standalone text と shape inline text を編集する。消しゴム tool の可視 label、accessible name / tooltip、説明文がそれぞれ現行 UI の表記（消しゴム、消しゴムツール、クリックまたはなぞって、触れた要素を消去する）であることを確認する。active tool、style target、alignment の visual state と `aria-pressed`、group / toolbar の accessible name、field の `aria-invalid` / alert、current tool status を確認する。
    3. Canvas pointer 操作後にページを縦 scroll し、Summary と footer まで到達する。用紙を本文列より広くして Canvas の局所横 scroll を行い、ページ全体の横 scroll は発生しないことを確認する。
  - 期待結果:
    - 4 viewport すべてで style input、alignment buttons、用紙入力、tool group を keyboard / touch から操作でき、狭幅でも drawing rail の局所 scroll に閉じ込められる。page-wide horizontal overflow は発生しない。
    - active tool は視覚と ARIA の両方で一つだけ確認でき、style target と alignment の状態も視覚・ARIA の両方で判別できる。用紙入力の invalid は field と alert で判別できる。
    - Canvas pointer 操作後もページ縦 scroll は阻害されず、広い用紙だけが Canvas 本体の局所横 scroll になり、Summary / footer へ到達できる。
  - 未確認時の判定: 375 / 768 / 1280 / 1440px の全 viewport、keyboard と touch、状態の visual / ARIA、縦・局所横 scroll の証跡がない限り `未実施` とする。静的 DOM / CSS 照合だけでは `PASS` にしない。

### 3. ノート一覧

- [ ] `/notes` で保存済みノートのタイトルが表示される
- [ ] `/notes` で保存済みノートの学習日が表示される
- [ ] `/notes` で保存済みノートの学習元が表示される
- [ ] `/notes` で保存済みノートのタグが表示される
- [ ] `/notes` の一覧カードでタグ名と色が表示され、複数タグが折り返し、長いタグ名が省略表示される
- [ ] `/notes` の一覧カードでタグが 0 件の場合、`タグなし` が表示されない。詳細画面など他のタグ表示箇所の既存 `タグなし` 表示はこの確認の対象外とする
- [ ] `/notes` で保存済みノートの Cue 件数が表示される
- [ ] `/notes` で要約未作成の状態が判別できる
- [ ] `/notes` の一覧カードで `reviewedAt` に基づく復習履歴バッジと `nextReviewDate` に基づく次回復習状態バッジが別々に表示される
- [ ] `/notes` でフリーワード検索がタイトルに対して効く
- [ ] `/notes` でフリーワード検索が本文に対して効く
- [ ] `/notes` でフリーワード検索がサマリーに対して効く
- [ ] `/notes` でフリーワード検索が Cue に対して効く
- [ ] `/notes` で From の日付フィルタが効く
- [ ] `/notes` で To の日付フィルタが効く
- [ ] `/notes` で From / To の変更は有効な範囲なら即時検索し、From > To は request 前に拒否して validation error を表示する。From / To の blur は validation 契機だが、それ自体では検索を開始しない
- [ ] `/notes` でタグフィルタが OR 条件で効く
- [ ] `/notes` でカンマを含むタグ名（例: `alpha,beta`）を選ぶと、1 件の完全一致タグとして検索できる
- [ ] `/notes` でタグフィルタの重複追加が防止される
- [ ] `/notes` でタグ候補取得中、タグ select が追加不可状態になる
- [ ] `/notes` で復習対象フィルタを有効にすると `nextReviewDate` が今日以前のノートだけが表示される

#### 一覧カードの復習表示 6 通り

次の 6 通りを `/notes` 一覧カードの受け入れ対象とする。`today` は判定基準日であり、復習履歴と次回復習状態は別々に判定する。

| ケース | `reviewedAt` | `nextReviewDate` | 期待する復習履歴バッジ | 期待する次回復習状態バッジ |
| --- | --- | --- | --- | --- |
| 1 | `null` | 未来（例: `2026-08-10`） | `未復習` | `復習予定日: 2026-08-10` |
| 2 | `2026-08-08T12:00:00.000Z` | 未来（例: `2026-08-10`） | `復習済み` | `復習予定日: 2026-08-10` |
| 3 | `null` | 今日以前（例: `2026-08-08`） | `未復習` | `復習期限到来: 2026-08-08` |
| 4 | `2026-08-08T12:00:00.000Z` | 今日以前（例: `2026-08-08`） | `復習済み` | `復習期限到来: 2026-08-08` |
| 5 | `null` | 未設定（`null`） | `未復習` | `復習予定なし` |
| 6 | `2026-08-08T12:00:00.000Z` | 未設定（`null`） | `復習済み` | `復習予定なし` |

次回復習状態バッジの画面上の表示には、上表の文言の前に `次回: ` を付ける。6 通りの判定は `test/notes/list-visual-contract.test.ts` の静的契約テストで確認する。
- [ ] `/notes` のフリーワード query は入力停止から 300ms debounce される
- [ ] `/notes` のフリーワード入力中に Enter を押すと pending debounce を取り消し、最新条件を即時適用する
- [ ] `/notes` の日付・タグ追加 / 削除・review toggle は、未確定の最新 query を含む全条件で即時検索する
- [ ] `/notes` のクリアは pending debounce を取り消し、query、From / To、タグ、タグ追加候補、review toggle を初期化して即時検索する
- [ ] `/notes` の review toggle は visible label を「復習対象のみ」だけに保ち、`ON` / `OFF` badge を表示しない。非選択時の neutral style、選択時の amber style、`aria-pressed` が押下状態と一致し、Enter / Space で keyboard activation できる
- [ ] `/notes` で選択済みタグチップが増えても、desktop の review toggle はタグ操作行から下へ移動しない
- [ ] `/notes` の検索フォームに visible な `検索` button が存在しない
- [ ] `/notes` の header から冗長な補助文を除いても、`h1` の「ノート一覧」と `/notes/new` の新規作成導線が維持される
- [ ] `/notes` で検索結果が 0 件の場合に空状態が表示される
- [ ] `/notes` で一覧取得中に loading 状態が表示される
- [ ] `/notes` で一覧取得に失敗した場合に error 状態が表示される
- [ ] `/notes` でページ情報が表示される
- [ ] `/notes` でページ移動ができる
- [ ] `/notes` で 1 ページ目の前へ、最終ページの次へが disabled になる

#### 一覧カード表示契約の検証境界（2026-08-09）

| 確認 | 判定 | 判定の意味 |
| --- | --- | --- |
| `node --import tsx/esm --test test/notes/list-visual-contract.test.ts` | PASS、5 tests | 一覧カードの復習バッジの独立性、6 通りの組み合わせ、タグ表示と空タグの `タグなし` 非表示を source contract として確認した |
| Browser runtime | 未確認 / NOT RUN | Browser backend が利用できないため実施していない。静的契約テストの結果を Browser runtime の PASS へ読み替えない |

### 4. ノート詳細

- [ ] `/notes/[id]` の閲覧モードでタイトルが表示される
- [ ] `/notes/[id]` の閲覧モードで学習日が表示される
- [ ] `/notes/[id]` の閲覧モードで学習元が表示される
- [ ] `/notes/[id]` の閲覧モードでタグが表示される
- [ ] `/notes/[id]` の閲覧モードで Cue リストが表示される
- [ ] `/notes/[id]` の閲覧モードで `bodyMode=canvas` の Canvas 本文が表示される
- [ ] `/notes/[id]` の閲覧モードで `bodyMode=markdown` の既存ノートは本文 Markdown が表示される
- [ ] `/notes/[id]` の閲覧モードでサマリー Markdown が表示される

#### Summary checkbox と明示保存

- [ ] `/notes/[id]` の閲覧モードで、Summary の checked / unchecked checkbox を読み取り領域上で toggle できる
- [ ] `/notes/[id]` の復習モードで Summary を開示した後、checked / unchecked checkbox を toggle できる。Summary checkbox の操作は `復習済みにする` の review completion と独立し、review completion が Summary を暗黙保存または dirty 解除しない
- [ ] Summary checkbox を toggle した直後に `PATCH /api/notes/:id` などの API write が発生せず、画面上で未保存（dirty）状態が分かる
- [ ] 詳細画面の明示保存で、Summary の変更が既存 `PATCH /api/notes/:id` を通じて永続化され、再読込後も checked / unchecked 状態が反映される
- [ ] Summary の明示保存成功時に表示中ノートが更新され、dirty 状態が解除される
- [ ] Summary の変更を破棄、または保存せずにモードを離れると、元の Summary に戻り、DB に永続化されない
- [ ] Summary の保存に失敗した場合、未保存の変更と dirty 状態が残り、error が表示される。保存済みとは表示しない
- [ ] Summary checkbox の toggle 後も task の本文、Summary 内の順序、checkbox 以外の Markdown が変更されない
- [ ] 編集画面の Markdown Preview の checkbox は引き続き read-only で、クリックしても Summary の入力値や保存データを変更しない
- [ ] Summary の checkbox 契約について、static contract の確認結果と Browser runtime の結果を別々に記録し、Browser runtime 未実施を PASS と扱わない

- [ ] `/notes/[id]` の閲覧モードから編集モードへ切り替えられる
- [ ] `/notes/[id]` の編集モードで既存ノートの title、学習日（現在値の表示専用）、Cue、Summary、Canvas または既存 Markdown 本文、用紙サイズが反映される
- [ ] `/notes/[id]` の保存後の通常編集画面で学習日（`noteDate`）は変更できず、現在値が維持される
- [ ] `/notes/[id]` の編集モードで `nextReviewDate` 未設定の既存ノートを開いても、編集開始だけでは日付が自動補完されない
- [ ] `/notes/[id]` の編集モードで `nextReviewDate` を学習日と独立して変更またはクリアでき、保存済みの値を学習日から自動再計算しない
- [ ] `/notes/[id]` の編集モードで保存すると `PATCH /api/notes/:id` が成功する
- [ ] `/notes/[id]` の編集モードで保存中は保存ボタンが disabled になり `保存中...` が表示される
- [ ] `/notes/[id]` の編集モードで保存 API が失敗した場合、フォーム上部に error alert が表示される
- [ ] `/notes/[id]` の編集保存後に閲覧モードへ戻る
- [ ] `/notes/[id]` の編集モードでキャンセルすると保存せず閲覧モードへ戻る
- [ ] `/notes/[id]` の閲覧モードから復習モードへ切り替えられる
- [ ] 過去・当日・未来の `nextReviewDate` を保存済みの既存ノートを `/notes/[id]` で復習モードへ切り替えると、保存値にかかわらず、復習画面へ入った時点の `Asia/Tokyo` 基準の現在日付 + 7日が次回復習日の初期値として表示される
- [ ] `/notes/[id]` の復習モードでは本文が初期状態で非表示になる
- [ ] `/notes/[id]` の復習モードでは Summary が初期状態で非表示になる
- [ ] `/notes/[id]` の復習モードで Cue を見て想起し、本文を確認した後に Summary を開ける
- [ ] `/notes/[id]` の復習モードで本文を表示できる
- [ ] `/notes/[id]` の復習モードで表示した本文を再度非表示にできる
- [ ] `/notes/[id]` の復習モードで復習済みにすると `POST /api/notes/:id/review` が成功する
- [ ] `/notes/[id]` の復習済み更新中はボタンが disabled になり `更新中...` が表示される
- [ ] `/notes/[id]` の復習済み更新に失敗した場合に error 状態が表示される
- [ ] `/notes/[id]` の復習済み更新で `reviewedAt` が更新される
- [ ] `/notes/[id]` の復習画面で次回復習日を別の日付へ手動変更して復習済み更新できる
- [ ] `/notes/[id]` の復習画面で次回復習日を空欄化して復習済み更新できる
- [ ] `/notes/[id]` の復習済み更新成功後、画面に `reviewedAt` と更新後の `nextReviewDate` が反映される
- [ ] `/notes/[id]` で削除操作を選ぶと確認 UI が表示される
- [ ] `/notes/[id]` の削除確認をキャンセルすると削除されない
- [ ] `/notes/[id]` の削除確認を確定すると `DELETE /api/notes/:id` が成功する
- [ ] `/notes/[id]` の削除中は削除ボタンが disabled になり `削除中...` が表示される
- [ ] `/notes/[id]` の削除に失敗した場合に error 状態が表示される
- [ ] `/notes/[id]` の削除成功後に `/notes` へ戻る
- [ ] 存在しない `/notes/[id]` を開くと 404 またはノートなし状態が表示される

#### NTE-030 閲覧／復習の共通構造

- [ ] `/notes/[id]` の閲覧モードと復習モードで、タイトル・メタ情報・ヘッダー領域の基本構造が共通している（モードラベルと操作ボタンの違いは許容する）
- [ ] `/notes/[id]` の閲覧モードと復習モードで、メタ情報 → Cornell（Cue／本文）→ Summary の基本順序と位置が共通している
- [ ] デスクトップの閲覧モードと復習モードで、Cornell の Cue が左、本文領域が右にあり、幅は基本的に約 30% / 70% である
- [ ] 復習モードへ切り替えても Cue とサマリーが本文より上の別領域へ移動せず、閲覧モードと同じ詳細画面シェルが維持される
- [ ] 復習モードでは共通 Cornell の本文領域と Summary が初期状態で非表示になり、Cue は表示される
- [ ] 復習モードでは Cue による想起と本文確認の後に Summary を開ける
- [ ] 復習モードで本文を表示／非表示に切り替えても、本文領域の位置と Cue・Summary の位置が変わらない
- [ ] 復習モードの復習記録と復習操作はサマリーの後ろに追加され、共通シェルの基本順序を置き換えない

### 4.1. NTE-020 / NTE-030 edit レイアウト / responsive

次に、`/notes/new` と `/notes/[id]` の編集モードに共通するレイアウトの受け入れ条件を示します。各項目は指定 viewport で確認します。この文書追加の時点では、実ブラウザでの実施結果を記録しません。

#### 共通レイアウト

- [ ] `/notes/new` と `/notes/[id]` の編集モードが、共有 `NoteEditor` の「基本情報 → Cornell ノート → Summary」のレイアウト方針を使用する

#### Desktop（1280px 以上）

- [ ] 1280px 前後で基本情報カードの高さと余白が圧縮され、タイトル・学習日・学習元・タグを過度な縦幅なしに確認できる
- [ ] 1280px 前後で Cornell の Cue / Canvas 本文が左約 30% / 右約 70% の幅比で表示される
- [ ] 1280px 前後で Canvas 本文が Cue の右側に約 70% の幅で表示され、Canvas の操作面が確認できる
- [ ] 1440px 前後で基本情報カードの圧縮方針が維持される
- [ ] 1440px 前後で Cornell の Cue / Canvas 本文が左約 30% / 右約 70% の幅比で表示される
- [ ] 1440px 前後で Canvas 本文が Cue の右側に約 70% の幅で表示され、Canvas の操作面が確認できる
- [ ] 1280px 以上で Summary が textarea → Preview → 次回復習日 → キャンセル / 保存の順序で表示される

#### Tablet / mobile（768px / 375px 前後）

- [ ] 768px 前後で Cornell の Cue / Note の 2 列関係が維持され、左右の内容が同時に確認できる
- [ ] 768px 前後で Cornell の Cue 入力欄をフォーカスして操作できる
- [ ] 768px 前後で Cornell の Canvas 本文操作面と用紙サイズ入力を操作できる
- [ ] 375px 前後で Cornell section 内の Cue / Canvas の関係を横スクロールで確認できる
- [ ] 375px 前後で基本情報 section は横スクロールせず通常の縦スクロールで確認できる
- [ ] 375px 前後で Summary section は横スクロールせず通常の縦スクロールで確認できる
- [ ] 375px 前後で Cornell section の外側のページは横スクロールせず、通常の縦スクロールで移動できる
- [ ] 375px 前後で Cue 追加ボタンを押して Cue を追加できる
- [ ] 375px 前後で Cue 削除ボタンを押して対象 Cue を削除できる
- [ ] 375px 前後で Cue の textarea にフォーカスして入力できる
- [ ] 375px 前後で Canvas 本文の操作面、幅・高さ入力、`適用` に到達できる
- [ ] 375px 前後で現行 UI に表示倍率操作がなく、Canvas の幅・高さ入力が用紙そのものの寸法として表示される
- [ ] 375px 前後で Summary の textarea → Preview → 次回復習日 → キャンセル / 保存の順序が維持される
- [ ] 375px 前後でキャンセル操作を実行できる
- [ ] 375px 前後で保存操作を実行できる

#### Overflow 境界

- [ ] 375px 前後で長い Markdown を入力してもページ全体の横 overflow が発生しない
- [ ] 375px 前後で長いタグを表示してもページ全体の横 overflow が発生しない
- [ ] 375px 前後で長い field error を表示してもページ全体の横 overflow が発生しない
- [ ] 375px 前後で Cue が空の状態でもページ全体の横 overflow が発生しない

#### Markdown Preview の layout 回帰

- [ ] 375px / 768px 前後でレイアウト変更後も編集画面の Cue / Summary Markdown Preview の checkbox が表示専用のままで、クリックしても入力値を変更しない
- [ ] 375px / 768px 前後でレイアウト変更後も GFM の表・取り消し線・タスクリスト等が Preview 内に表示される
- [ ] 375px / 768px 前後でレイアウト変更後も危険な HTML が sanitize され、Preview の外へ表示されない

### 5. バックアップ

- [ ] `/backup` で `GET /api/backups` の結果が一覧表示される
- [ ] `/backup` でバックアップファイル名が表示される
- [ ] `/backup` でバックアップ作成日時が表示される
- [ ] `/backup` でバックアップ保存先パスが表示される
- [ ] `/backup` でバックアップが 0 件の場合に空状態が表示される
- [ ] `/backup` でバックアップ作成を実行すると `POST /api/backups` が成功する
- [ ] `/backup` でバックアップ作成中は作成ボタンが disabled になり `作成中...` が表示される
- [ ] `/backup` で一覧取得中または作成中は一覧更新ボタンが disabled になる
- [ ] `/backup` でバックアップ作成成功後に一覧が更新される
- [ ] `/backup` でバックアップ作成成功後に成功メッセージが表示される
- [ ] `/backup` でバックアップは最新 3 世代だけが保持される
- [ ] `/backup` で一覧取得中に loading 状態が表示される
- [ ] `/backup` で一覧取得に失敗した場合に error 状態が表示される
- [ ] `/backup` で作成に失敗した場合に error 状態が表示される

### 6. API / DB

- [ ] `GET /api/notes` が `query` を受け取り一覧を返す
- [ ] `GET /api/notes` が `from` を受け取り一覧を絞り込む
- [ ] `GET /api/notes` が `to` を受け取り一覧を絞り込む
- [ ] `GET /api/notes?tags=alpha%2Cbeta` が `alpha,beta` という 1 件のタグを完全一致で検索する
- [ ] `GET /api/notes?tags=alpha&tags=beta` が通常タグ `alpha` または `beta` の OR 条件で検索する
- [ ] `GET /api/notes` が `tag` を受け取り OR 条件で一覧を絞り込む
- [ ] `GET /api/notes?tag=alpha,beta` が legacy CSV として `alpha` または `beta` の OR 条件で検索する
- [ ] canonical `tags` の空要素、前後空白、重複が検索条件から除外され、value 内のカンマは分割されない
- [ ] `GET /api/notes` が `reviewDue=true` を受け取り復習対象を返す
- [ ] `GET /api/notes` が `page`, `totalPages`, `totalCount`, `data` を返す
- [ ] `POST /api/notes` が Notebook を作成する
- [ ] `POST /api/notes` が指定した今日以前の `noteDate` を作成ノートへ保存する
- [ ] `POST /api/notes` が `bodyMode=canvas` と `CanvasDocumentV1` を保存する
- [ ] `POST /api/notes` が Canvas の `searchText` を text 要素から生成する
- [ ] `POST /api/notes` が Cue を作成する
- [ ] `POST /api/notes` が未登録 Tag を作成する
- [ ] `POST /api/notes` が NotebookTag を作成する
- [ ] `GET /api/notes/:id` がノート詳細を返す
- [ ] `GET /api/notes/:id` が保存済み `bodyMode` と Canvas document の page 寸法・要素を返す
- [ ] `PATCH /api/notes/:id` が Notebook を更新する
- [ ] `PATCH /api/notes/:id` が保存済みの現在値と同じ `noteDate` を受け付け、200 を返す。`noteDate` 自体は更新しない
- [ ] `PATCH /api/notes/:id` が現在値と異なる `noteDate` を受け付けず、他の値を更新せずに 400 `invalid_body` と `errors: [{ field: "noteDate", ... }]` を返す
- [ ] `PATCH /api/notes/:id` が Canvas の page.width / page.height だけを変更して保存できる
- [ ] `PATCH /api/notes/:id` が page 寸法変更時に要素の x / y / width / height / points / style を変更しない
- [ ] `PATCH /api/notes/:id` が Cue をリクエスト内容で全置換する
- [ ] `PATCH /api/notes/:id` が Tag 関連をリクエスト内容で全置換する
- [ ] `POST /api/notes` と `PATCH /api/notes/:id` が `tags` 配列 index を `NotebookTag.order` に 0 始まりで保存し、`GET /api/notes` と `GET /api/notes/:id` のタグ配列をその順序で返す
- [ ] `DELETE /api/notes/:id` がノートを物理削除する
- [ ] `POST /api/notes/:id/review` が `reviewedAt` を現在時刻で更新する
- [ ] `POST /api/notes/:id/review` が `nextReviewDate` を任意の日付または null で更新する
- [ ] `GET /api/tags` がタグ候補一覧をタグ名昇順で返し、ノートに付いたタグの追加順とは別の順序契約を維持する
- [ ] SQLite / Postgres のタグ順序 migration が、過去の順序を持たない既存 `NotebookTag` 行を Notebook ごとの Tag 名昇順、同名時の `tagId` 昇順で 0 始まりに初期化する。結果が実行ごとに変わらないことを確認する
- [ ] `GET /api/backups` がバックアップ一覧を返す
- [ ] `POST /api/backups` が SQLite DB ファイルを `backup/` 配下へコピーする
- [ ] `POST /api/backups` が 4 世代目以降の古いバックアップを削除する
- [ ] API の validation error が `{ code, message, errors? }` 形式で返る
- [ ] API の not found error が `{ code, message, errors? }` 形式で返る
- [ ] API の unexpected error が `{ code, message, errors? }` 形式で返る
- [ ] `GET /api/notes` で不正な `from` / `to` / `page` が `invalid_query` と field 別 error を返す
- [ ] `GET /api/notes` で From > To が `field: "from"` / `message: "開始日は終了日以前の日付を入力してください"` を返す
- [ ] `POST /api/notes` でタイトル未入力、タイトル 120 文字超、未来日の `noteDate` が `invalid_body` と field 別 error を返す
- [ ] `POST /api/notes` で Canvas の幅・高さが整数 px の 320〜4000 の範囲外の場合、`invalid_body` と Canvas field error を返す
- [ ] `POST /api/notes` で `bodyMode=canvas` の `canvas` 未指定、および `bodyMode=markdown` の `canvas` 指定を拒否する
- [ ] `POST /api/notes` で 13 件以上のタグ、重複タグ、使用不可文字を含むタグが `invalid_body` と field 別 error を返す
- [ ] `PATCH /api/notes/:id` で不正 body は not found 確認より先に 400 `invalid_body` を返す
- [ ] `PATCH /api/notes/:id` で保存済みの学習日と異なる `noteDate` は、`code: "invalid_body"`、`errors[0].field: "noteDate"`、`message: "保存後の学習日は編集できません"` を返す
- [ ] `GET /api/notes/:id` / `PATCH /api/notes/:id` / `DELETE /api/notes/:id` / `POST /api/notes/:id/review` が存在しない ID に 404 `not_found` / `message: "ノートが見つかりません"` を返す
- [ ] `POST /api/notes/:id/review` で不正な `nextReviewDate` が `invalid_body` と `field: "nextReviewDate"` を返す
- [ ] `GET /api/tags` でタグ 0 件の場合も 200 と `[]` を返す
- [ ] `GET /api/backups` でバックアップ 0 件の場合も 200 と `{ backups: [] }` を返す
- [ ] `POST /api/backups` で DB ファイル不在・DB 不可用の場合は 500 `backup_database_unavailable`、設定不整合の場合は 500 `backup_configuration_invalid`、バックアップ保存先不良の場合は 500 `backup_storage_failure` を返し、raw path、`DATABASE_URL`、内部 exception を露出しない

- [ ] Canvas 用紙サイズの変更は `NotebookCanvas.documentJson` の JSON 更新で完結し、用紙寸法のためだけに Prisma schema / migration が増えていないことを静的に確認する

タグ順序の保存・再読込、候補 API、既存データの backfill は、対応する runtime または migration の確認を実行するまで未実施とする。静的な文書・source 照合だけで `PASS` にしない。

### 7. Markdown / Security

- [ ] 編集画面の Markdown Preview で見出しが表示される
- [ ] 編集画面の Markdown Preview で箇条書きが表示される
- [ ] 編集画面の Markdown Preview でリンクが表示される
- [ ] 編集画面の Markdown Preview でコードブロックが表示される
- [ ] 編集画面の Markdown Preview で GFM checkbox が表示される
- [ ] 編集画面の Markdown Preview の checkbox は Preview 上でクリックしても保存値を変更しない
- [ ] 編集画面の Markdown Preview に危険な HTML を入力しても sanitize される
- [ ] 閲覧モードの Markdown 表示にも sanitize が効く
- [ ] 復習モードで本文と Summary を開いた後の Markdown 表示にも sanitize が効く

#### Summary checkbox 契約の判定境界（2026-08-09）

| 判定種別 | 対象 | 判定の扱い |
| --- | --- | --- |
| Static contract | 編集画面の Markdown Preview の read-only 境界、詳細画面 Summary の toggle / dirty / 明示保存 / 破棄 / error、review completion との分離 | source と focused contract test で実装済み範囲を確認し、Browser runtime の PASS には繰り上げない |
| Browser runtime | `/notes/[id]` の view / review での checkbox 操作、API write timing、明示保存・再読込、破棄、保存失敗表示 | 未確認 / NOT RUN。Browser backend が利用できないため実施せず、代替操作も行わない |

### Canvas runtime QA 記録（2026-07-21）

Canvas のブラウザ実機 QA は `未実施` とし、API runtime 検証と分けて記録した。権限昇格後は local server の listen に成功したが、Browser backend は利用できなかった。静的 source / docs の確認結果も runtime の PASS 根拠にはしていない。

| 項目 | 記録 |
| --- | --- |
| 起動試行 | 権限昇格後、`npm run dev -- --hostname 127.0.0.1 --port 3107` の server listen に成功 |
| Browser 試行 | `agent.browsers.list()` が空。Browser backend 不可のため runtime 操作は未実施 |
| 対象 route / viewport | 未到達。`/notes/new`、必要時の `/notes/[id]`、375 / 768 / 1280 / 1440px は未確認 |
| fixture | Browser QA 用の基準 fixture（pen stroke、line、arrow、rect、ellipse、standalone text）は未作成。Browser 用 screenshot、console / error log も未取得（API response は下記の独立記録に保存） |
| 操作範囲 | Browser の pointer / click / double-click / 3px 未満 drag / 4px 超過 drag、shape inline text、style controls、wheel / touch、keyboard / ARIA、UI 明示保存・再読込比較は全て未実施 |
| 判定 | `CANVAS-DIMENSION-001`、`CANVAS-INTERACTION-001`、`CANVAS-GESTURE-001`、`CANVAS-SHAPE-TEXT-001`、`CANVAS-STYLE-001`、`CANVAS-PERSISTENCE-STYLE-001`、`CANVAS-TOOLBAR-STYLE-001` は全て `未実施`。API runtime の独立した PASS は下記に記録し、Browser QA へ繰り上げていない |
| 再開条件 | Browser backend が利用可能な環境で、上記 fixture と操作を実行し、console / error、viewport、保存前後 JSON、再読込表示を記録する |

#### 7 シナリオの今回判定

- `CANVAS-DIMENSION-001`: `未実施`。Browser UI の既定値・境界値・別寸法、page 外要素、保存・再読込比較なし。API の page resize と geometry / style / text 不変は下記の API runtime 記録で別途 PASS。
- `CANVAS-INTERACTION-001`: `未実施`。空白・6 種類の既存要素上、preview / inline overlay 境界の作成操作なし。
- `CANVAS-GESTURE-001`: `未実施`。クリック、ダブルクリック、3px 未満、4px 閾値超過の実測なし。
- `CANVAS-SHAPE-TEXT-001`: `未実施`。rect / ellipse の inline editor、確定・キャンセル、既存要素保持、console 状態の確認なし。
- `CANVAS-STYLE-001`: `未実施`。線幅 1〜20px、文字サイズ 8〜96px、色、left / center / right、無効値の実機確認なし。
- `CANVAS-PERSISTENCE-STYLE-001`: `未実施`。API response の page resize、geometry / `style` / `text`、`searchText` は下記で確認済みだが、Browser UI の明示保存・再読込と standalone text / shape inline text の完全な `style` / `textStyle` 復元は未実施。
- `CANVAS-TOOLBAR-STYLE-001`: `未実施`。4 viewport の keyboard / touch 到達性、ARIA / active state、縦 scroll / 局所横 scroll の確認なし。

### Canvas runtime QA 追補（2026-07-22）

in-app Browser で `http://localhost:3000` を操作し、2026-07-21 に未実施だった範囲の一部を確認した。fixture は `Canvas Browser QA 2026-07-22 2030`（ID `cmrvzkjpa0000mtrm7pgwm1xb`）として保持し、後続 QA で重ね描き、消しゴム、Undo / Redo、未確認 viewport を続けられる状態にした。

| 項目 | 2026-07-22 の記録 |
| --- | --- |
| Browser / route | in-app Browser、`http://localhost:3000/notes/new` → `/notes/cmrvzkjpa0000mtrm7pgwm1xb` → 編集 → `/notes?query=QA検索語 Canvas` |
| fixture | 1200x800 から開始し、stroke 1、line 1、arrow 1、rect 2、ellipse 1、standalone text 1 を作成。rect が 2 件なのは ellipse tool の最初の click が rail の clip 外で、active rect tool のまま 1 件作成した操作記録による |
| gesture | line / arrow / rect / ellipse で通常 click、3px drag、5px 超 drag を実行。保存 JSON では通常作成分以外の極小 line / arrow / ellipse は残らず、rect の追加 1 件は上記の tool switch miss に対応する。double-click no-op と厳密な 4px 境界は未確認 |
| shape text | rect に `四角QA` を確定し、ellipse では `取消QA` を Escape でキャンセル。rect は `textStyle.fontSize=32` / `textAlign=left`、ellipse は text なしで保存。console error / warn は 0 |
| standalone text | `QA検索語 Canvas` を作成し、`style.fontSize=96` / `textAlign=right` で保存。文字サイズ 7 と 12.5 は既存値維持として拒否された。色、線幅、残りの境界値は未確認 |
| page / persistence | 用紙を 1920x1080 に変更し明示保存。詳細 viewer と編集再読込で 1920x1080、`四角QA`、`QA検索語 Canvas` を復元。GET JSON で 7 要素と `style` / `textStyle` を確認 |
| search / review date | `QA検索語 Canvas` の一覧検索で fixture 1 件が一致。学習日 2026-07-22 に対する新規 `nextReviewDate=2026-07-29` を入力・保存後の詳細で確認 |
| scroll | 1440px requested（実効 1425px）で 1920px 用紙は `.note-canvas-horizontal-scroll` のみ `scrollWidth=1920`、page / body の横 overflow なし |
| responsive defect | 1280px requested（実効約1265px）で `.note-canvas-toolbar-drawing-rail` の client width が約8px（border box 約10px）まで縮み、描画 tool が見えず実質操作不能。1440px requested（実効1425px）では client width 68pxで局所横 scroll により操作可能 |
| viewport limitation | Browser viewport override が 1440px から縮小方向へ反映されず、375 / 768px の再検証は未実施。touch も未実施 |

#### 7 シナリオの追補判定

- `CANVAS-DIMENSION-001`: `部分実施`。1200x800 → 1920x1080 の Browser UI 保存・詳細・編集再読込、GET JSON、Canvas text 検索を確認。320 / 4000 境界、範囲外、page 外要素は未確認。
- `CANVAS-INTERACTION-001`: `部分実施`。空白から 6 種類を作成。既存 6 要素上の全重ね描き、preview / overlay / unknown metadata 境界は未確認。
- `CANVAS-GESTURE-001`: `部分実施`。4 種 tool の click、3px drag、5px 超 drag と保存 JSONを確認。double-click no-op、厳密な4px境界は未確認。
- `CANVAS-SHAPE-TEXT-001`: `部分実施`。rect commit、ellipse cancel、他要素保持、console errorなしを確認。全 tool 別経路と繰り返し lifecycle は未確認。
- `CANVAS-STYLE-001`: `部分実施`。standalone / shape text の font size と alignment、無効値 7 / 12.5 を確認。色、線幅、全境界値、left / center / right の全組合せは未確認。
- `CANVAS-PERSISTENCE-STYLE-001`: `部分実施`。明示保存、viewer / editor 再読込、GET JSON、`style` / `textStyle`、Canvas text 検索を確認。用紙変更前後の同一 JSON diff と page 外要素は未確認。
- `CANVAS-TOOLBAR-STYLE-001`: `部分実施`。2026-07-24 の修正後確認では、375 / 768 / 1280 / 1440px の全 viewport で page-wide overflow はなく、全 drawing tool の pointer 到達、Tab / Shift+Tab、375px touch tap を確認した。1280px の rail collapse は再現しなかった。一方、touch の Canvas scroll 干渉、focus-visible の視覚確認、style target 選択後の alignment 即時反映は未確認。

### Canvas toolbar runtime QA 追補（2026-07-24）

2026-07-22 に実効約 1265px で確認した drawing rail collapse について、CSS 修正後の状態を権限付き headless Playwright Chromium で再確認した。詳細は `summary/20260724/canvas-toolbar-browser-qa-runtime-20260724.md` を参照する。

| 項目 | 2026-07-24 の記録 |
| --- | --- |
| viewport | requested / effective ともに 375 / 768 / 1280 / 1440px |
| drawing rail | 375: `305 / 461px`、768: `346 / 461px`、1280: `679 / 679px`、1440: `79 / 461px`（client / scroll）。1280px の約 8px collapse は再現しなかった |
| pointer | ペン、直線、矢印、四角、円、文字を全 viewport で順に click。各 tool の `data-active=true` / `aria-pressed=true` と local scroll 到達を確認 |
| keyboard | 375 / 1280 / 1440px で実際の Tab / Shift+Tab を実行し、toolbar の論理順を往復 |
| overflow / scroll | body / document の `scrollWidth` は各 viewport と一致。1920x1080 用紙では `.note-canvas-horizontal-scroll` のみ `scrollWidth=1920`。Summary / `.note-paper-footer` へ縦 scroll 可能 |
| touch | 375px touch context でペン tap、active / pressed state、console error 0 を確認。Canvas scroll 干渉は未確認 |
| console | error / warning 0 |

今回の追補は responsive、pointer、keyboard、主要 overflow の範囲を確認したが、touch の scroll 干渉、focus-visible の視覚確認、選択対象に対する style alignment 即時反映は未確認であるため、シナリオ全体は `部分実施` のまま維持する。

### Canvas gesture runtime QA 追補（2026-07-24）

`CANVAS-INTERACTION-001` と `CANVAS-GESTURE-001` の未確認範囲を、権限付き headless Playwright Chromium の `page.mouse` で追加確認した。詳細は `summary/20260724/canvas-gesture-browser-qa-runtime-20260724.md` を参照する。

| 項目 | 2026-07-24 の記録 |
| --- | --- |
| route / viewport | `/notes/new`、1280 x 900 |
| click / double-click | 直線・矢印・四角・円の click と double-click は全て保存要素 0 件の no-op |
| drag threshold | 同じ 4 tool の 3px drag は 0 件、5px drag は各 1 件（line / arrow / rect / ellipse） |
| 既存要素上の開始 | stroke、line、arrow、rect、ellipse、standalone text の各上から 6 tool で新規 gesture を開始し、基準 6 件 + 重ね描き 6 件の 12 要素を保存応答で確認 |
| preview / inline editor | 5px line preview を pointer-up 前に保存 handler へ渡しても保存要素 0 件。四角 inline editor overlay 上から同じ四角 tool で drag しても新規 rect は増えず、`INLINE` のみ既存 rect へ確定 |
| console / cleanup | console / page error 0 件。一時ノートは削除し、`GET /api/notes?query=Gesture` の残存 0 件を確認 |
| 未確認 | 厳密な 4px 境界、metadata 欠落 / unknown object の遮断、別 tool へ切り替えた直後の shape inline text と shape drag の分離、保存後の再読込比較 |

この追補により空白および既存要素上の作成、click / double-click / 3px / 5px の境界、未確定 preview の保存除外、同じ tool の inline editor overlay 遮断は確認できたが、残る境界条件があるため `CANVAS-INTERACTION-001` と `CANVAS-GESTURE-001` は `部分実施` のままとする。

### Canvas metadata 境界 hardening 追補（2026-07-24）

unknown target の実 pointer 操作は、Browser backend 不在のため未確認のままである。ここでは、関連 Worker の静的検証と保存境界の実装確認を記録する。pen runtime は Fabric 7 の `mouse:down:before` で metadata 欠落・unknown・preview・shape text editor target の brush 開始を抑止し、異常な `path:created` を cleanup する。converter 側は malformed metadata を共有境界で検証し、正規の `CanvasElementV1` 以外を例外なしで除外する。空白および既知要素の pen target allowlist、既存の geometry / style / text 変換は維持する。

| 項目 | 結果 |
| --- | --- |
| static source / Fabric event order | PASS。`mouse:down:before` が brush 開始より前に発火すること、blocked state の mouseup / pointercancel / touchcancel / unmount cleanup を確認 |
| malformed metadata boundary | PASS。metadata 欠落、unknown type、element / style / points / geometry 不正、preview / editor object は保存変換から除外する実装を確認 |
| `npm run lint` / `npx tsc --noEmit --pretty false` / `npm run build` / `git diff --check` | PASS |
| Browser runtime unknown-target gesture | 未確認。`agent.browsers.list()` が `[]`、local server は `listen EPERM`、Playwright Chromium は MachPort permission error のため pointer、Canvas object 数、保存 response、console / page error は取得できず |
| 判定 | `CANVAS-INTERACTION-001` は部分実施のまま。静的 hardening は確認済みだが、実機の unknown target 操作と保存 JSON の runtime PASS には繰り上げない |

根拠: `summary/20260724/fix-canvas-unknown-target-pen-gesture-20260724-summary.md`、`summary/20260724/2336-harden-canvas-malformed-metadata-converter-20260724-e7e74449-summary.md`、`summary/20260724/2339-fix-canvas-unknown-target-pen-gesture-20260724-c4a0eeee-summary.md`。

### Canvas unknown-target pen runtime 再試行（2026-07-25）

発注者が開いた in-app Browser を対象に `/notes/new` の runtime QA を再試行したが、Browser skill の in-app Browser 選択が `Browser is not available: iab` で失敗し、bootstrap troubleshooting 後の `agent.browsers.list()` も `[]` だった。指定どおり通常の Chrome、standalone Playwright、debug route、恒久 fixture、source code の変更には切り替えていない。

このため今回も route / viewport、console / page error、Fabric pointer 操作、`canvas.getObjects()`、保存 handler / API response の `elements` は未取得である。metadata 欠落・unknown・preview・shape text editor target の pen 遮断、pointercancel / touchcancel 後の stale path cleanup、空白 / 既知要素上の pen 保存は runtime 未確認のままとする。`CANVAS-INTERACTION-001` は `部分実施` のまま維持し、静的 hardening を runtime PASS へ繰り上げない。

根拠: `summary/20260725/verify-canvas-unknown-target-pen-gesture-runtime-20260725-summary.md`。

### Canvas unknown-target pen runtime（2026-07-25、Manager 直接 Playwright）

Worker の in-app Browser backend は `iab` / `[]` のままだったため、前回成功時と同じ Manager 側の権限付き headless Playwright Chromium で runtime を実行した。`/notes/new` の 1280 x 900 で、metadata 欠落、`element.type="unknown"`、`isCanvasPreview`、`isCanvasShapeTextEditor` の各 Fabric object 上へ pen の pointer down / move / up を行い、shape text editor object では pointercancel も挟んだ。

全ケースで `mouse:down:before` の target が想定 object と一致し、操作前後の Canvas object 数は不変、`path` object は 0 件だった。保存 request と保存後 `GET /api/notes/:id` の Canvas `elements` はいずれも空配列で、console / page error は 0 件。一時ノートは `DELETE` 204 後の GET 404 を確認した。unknown-target runtime subset は `PASS` とするが、厳密な 4px 境界、別 tool 切り替え後の分離、touch scroll 干渉などが残るため `CANVAS-INTERACTION-001` 全体は `部分実施` のままとする。

根拠: `summary/20260725/canvas-unknown-target-pen-browser-qa-runtime-20260725.md`。

### Canvas shape-tool switch gesture runtime（2026-07-25、Manager 直接 Playwright）

Worker の app-server 初期化は `Operation not permitted` で失敗し、Browser backend も `[]` だったため、前回成功時と同じ Manager 側の権限付き headless Playwright Chromium で確認した。`/notes/new` の 1280 x 900 で、rect / ellipse の inline editor に対する commit、Escape cancel、別 shape tool への切り替え直後の blank drag、保存 request / GET を実行した。

| 項目 | 結果 |
| --- | --- |
| tool switch と commit | rect editor に `RECT COMMITTED` を入力して ellipse tool へ切り替えると、rect は text 付き group へ確定し、editor / hidden textarea は 0 件。 |
| switch 直後の shape drag | ellipse tool の blank drag は ellipse 1 件だけを追加し、既存 rect の text / geometry を保持。 |
| Escape cancel | ellipse editor の `ELLIPSE CANCELLED` を Escape で取り消すと、ellipse の text は空、editor / hidden textarea は 0 件。直後の rect drag は rect 1 件だけを追加。 |
| 保存境界 | 保存 response `201`、保存 request と保存後 `GET /api/notes/:id` の Canvas `elements` は `rect("RECT COMMITTED")`、`ellipse`、`rect` の 3 件で一致。 |
| console / cleanup | アプリ操作中の console error / warning と page error は 0 件。一時ノートは DELETE `204`、削除後 GET `404`、タイトル検索残留 `totalCount=0`。 |

実装上の tool button click は `flushShapeTextEditRef` により inline editor を先に commit / cleanup する。したがって「切り替え後も editor が残る」ことは期待値ではなく、今回の判定はこの既存契約に沿っている。厳密な 4px、touch scroll、style / alignment 全経路などが残るため、`CANVAS-INTERACTION-001` / `CANVAS-GESTURE-001` 全体は `部分実施` のままとする。詳細は `summary/20260725/canvas-shape-tool-switch-gesture-separation-runtime-20260725.md` を参照する。

### Canvas runtime QA 統合追補（2026-07-25、Manager 直接 Playwright）

Worker task は Browser backend `[]` と app-server `Operation not permitted` により実測できなかったため、Manager 側の権限付き headless Playwright Chromium で同じ `/notes/new` route の残り runtime QA を直接確認した。全ケースで console error / warning と page error は 0 件だった。既確認済みの 3px / 5px、unknown target pen、shape tool switch は再実施せず、厳密な 4px はユーザー判断で不要として実施しなかった。詳細な統合 summary は `summary/20260725/canvas-runtime-qa-completion-20260725.md` に記録する。

| 領域 | 2026-07-25 の実測結果 |
| --- | --- |
| 寸法 | 初期 page は `1200x800`。幅・高さ `320` / `4000` は適用成功。`319` / `4001`、decimal、blank は inline error と `aria-invalid=true` で拒否。幅 `320→4000` と高さ境界の変更前後で rect の `id` / `x` / `y` / `width` / `height` / `style` は不変。 |
| style | standalone text は font size `8` / `96` を適用し、`7` / `97` / `12.5` / blank は既存 `96` を維持。line は stroke width `1` / `20` を適用し、`0` / `21` / `1.5` / blank は既存 `20` を維持。text color / line color は各 target の live Fabric style に反映され、left / center / right alignment は即時反映。rect inline text editor は line width disabled、font / color / alignment enabledで、font `20`、color `#16a34a`、center が commit 後 `textStyle` に保存。 |
| persistence | 一時ノート `Runtime Persistence QA 20260725` を使用。UI POST `201`、GET `200`。Canvas を `1280x900` に変更して保存し、standalone text `PERSIST TEXT`（font `18` / color `#b91c1c`）と line（strokeWidth `4`）の elements と page が request / GET で一致。viewer assistive text、編集画面、reload 後の viewer→edit で title / page / text を確認。DELETE `204`、削除後 query `totalCount=0`。 |
| eraser | text、rect、ellipse、line を個別 click / drag。対象全体のみが消え、非対象の geometry / style / text / points は保持。最後の object 数は `0`、errors は `0`。 |
| history | 空履歴では Undo / Redo が disabled。rect create→Undo で `0 objects`・Redo enabled、Redo で rect 復元。text edit は Undo で末尾 1 文字を戻し、Redo で復元。page `1200x800→1280x900` も Undo / Redo で復元。errors は `0`。 |
| toolbar / touch | 375 / 768 の drawing rail はそれぞれ `305 / 461`、`346 / 461`（client / scrollWidth）。全 tool の `aria-label` / `aria-pressed` / `data-active` が一致。Tab / Shift+Tab で移動し、focus-visible outline は solid `2px`。375 / 768 の valid `640x480` と invalid `319` の error / `aria-invalid`、body / document の viewport-wide scrollWidth 一致を確認。375 touch の縦 swipe 4 回後 `scrollY=1779`、footer visible。1280 touch で 1920x1080 paper の horizontal `scrollLeft 0→1069`、page `scrollY` 不変、body / document overflow なし。 |

#### 2026-07-25 のシナリオ判定境界

- `CANVAS-DIMENSION-001`: 寸法入力、境界値、invalid、resize 前後の要素不変、保存・表示の確認済み範囲を `PASS` とする。
- `CANVAS-STYLE-001`: standalone text、line、color、alignment、rect editor style commit の確認済み範囲を `PASS` とする。
- `CANVAS-PERSISTENCE-STYLE-001`: standalone text / line の style、page、request / GET、viewer / edit / reload、delete / cleanup の確認済み範囲を `PASS` とする。
- `CANVAS-TOOLBAR-STYLE-001`: rail、ARIA / active state、keyboard、focus-visible、page size validation、page / paper scroll の確認済み範囲を `PASS` とする。
- `CANVAS-SHAPE-TEXT-001`: rect / shape editor の style commit subset は `PASS` とするが、繰り返し lifecycle 等を含むシナリオ全体は `部分実施` のままとする。
- `CANVAS-INTERACTION-001` / `CANVAS-GESTURE-001`: 今回は既存 subset を再実施せず、厳密な 4px 等の未確認範囲を保持する。確認済み subset を追記するが、シナリオ全体は `部分実施` のままとする。

### 既存ノート desktop edit / nextReviewDate runtime 追補（2026-07-25）

最新の Manager fallback QA summary は、Worker の Browser backend が利用できなかったため Manager 側の headless Playwright Chromium で確認した範囲を記録する。desktop edit は 1280 / 1440px に限定し、375 / 768px の mobile 専用 edit runtime は未確認のままとする。詳細は `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md` を参照する。

| 項目 | 2026-07-25 の実測結果 | 判定境界 |
| --- | --- | --- |
| 既存ノート desktop edit | 1280 / 1440px の `/notes/[id]` で title、学習日（現在値の表示）、source、tag、Cue、Canvas、Summary、`nextReviewDate` を復元。保存後の再読込、キャンセル、主要 field 到達性、body / document の viewport-wide 横幅不在を確認し、console / page error は 0。保存後の通常編集画面で学習日は表示専用とする。確認用ノートは削除後 GET 404、一覧 query の残留 `totalCount=0`。 | `PASS（desktop 1280 / 1440px の確認済み範囲）`。375 / 768px の mobile edit は未確認。 |
| `nextReviewDate` UI | 新規 `noteDate=2026-07-25` で `2026-08-01` が初期表示・保存された。既存編集では手動値 `2026-08-05` と空欄を再読込でき、`nextReviewDate` は学習日と独立して扱い、学習日から自動再計算しない。 | `部分実施（確認済み範囲）`。review 成功 UI までの画面反映は未確認。 |

### 2026-07-31 runtime QA 追補

この追補は、既存の受け入れ証跡マトリクスの判定単位を置き換えない。2026-07-25 に Manager 側の権限付き runtime で確認済みの desktop / Canvas subset は履歴として保持し、今回の Browser runtime blocker によって過去の PASS を変更しない。今回実測できなかった scroll / drawing、mobile、実 target の範囲も `PASS` と推測しない。

#### Canvas scroll / wheel / touch QA

`/notes/new` の Canvas scroll handoff と scroll 中の drawing 干渉について、Browser backend、localhost route、server bind の制約を切り分けたが、Browser 操作は開始できなかった。

| 確認項目 | 判定 | 事実 / 未確認範囲 |
| --- | --- | --- |
| Browser backend | `BLOCKED` | `agent.browsers.list()` は `[]`。 |
| route / server | `BLOCKED` | 既存 localhost listener への `localhost` / `[::1]` / `127.0.0.1` route は HTTP 000。新規 `npm run dev -- --hostname 127.0.0.1 --port 3100` は `listen EPERM`。 |
| 375 / 768 / 1280px scroll | `BLOCKED` | 用紙内 `scrollLeft`、ページ `scrollTop`、page-wide `scrollLeft` を取得していない。wheel / trackpad 相当 event、touch / pointer swipe、pointercancel も送信していない。 |
| scroll 中の drawing / 保存境界 | `BLOCKED` | pen / line / arrow / rect / ellipse / text の誤作成、既存 element の geometry / points / style / text / `searchText` 不変、`/notes/[id]` 保存・再読込、console / page error は未確認。fixture / screenshot / API request は作成していない。 |
| 判定境界 | `BLOCKED` | 静的 source に `pointercancel` / `touchcancel` と scrollable wrapper があっても runtime `PASS` にはしない。2026-07-25 の page / paper scroll を含む確認済み toolbar / touch subset は保持するが、wheel / trackpad / touch handoff と scroll 中 drawing の追加 QA は `BLOCKED` のままとする。 |

根拠: `summary/20260731/worker-canvas-scroll-wheel-touch-qa-20260731.md`。

#### Mobile note runtime QA

375 / 768px の `/notes/new` と `/notes/[id]` を対象に、editor、viewer、review、保存・再読込、キャンセル、overflow を確認する試行は、Browser backend と headless Chromium の起動制約により実測不能だった。

| 確認項目 | 判定 | 事実 / 未確認範囲 |
| --- | --- | --- |
| Browser / dedicated server | `BLOCKED` | Browser backend の `agent.browsers.list()` は `[]`。専用 4173 server は `listen EPERM`。既存 3000 番 route の curl 200 は一部の HTTP 到達性確認に留まり、Browser runtime の証拠ではない。 |
| headless Chromium | `BLOCKED` | 既定 executable は未導入、system Chrome は起動後に終了、利用可能な headless shell は MachPort permission error で終了したため page / session を生成できなかった。 |
| `/notes/new` editor | `BLOCKED` | 375 / 768px の実効 viewport、field 到達性、Cue / Canvas / Summary 操作、保存・再読込を未確認。 |
| existing-note edit / viewer / review | `BLOCKED` | title、noteDate、source、tag、Cue、Canvas、Summary、`nextReviewDate` の復元・保存・再読込・キャンセル、本文初期マスク・表示 / 再マスク、review success UI を未確認。 |
| overflow / errors | `BLOCKED` | 長い tag / Markdown / field error、page-wide overflow、Canvas local scroll、console error、page error、HTTP failure 0 件判定を未取得。fixture / screenshot は作成していない。 |
| 判定境界 | `BLOCKED` | `NTE020-EDIT-ALL` の desktop 1280 / 1440px 確認済み範囲、既存の Canvas subset、1440px の viewer / review 履歴は維持する。375 / 768px の editor・viewer・review・overflow は今回も未確認で、`PASS` へ繰り上げない。 |

根拠: `summary/20260731/worker-mobile-note-runtime-20260731.md`。

### 過去の Postgres source reader 検証履歴（2026-07-31）

Postgres target へ接続せず、現行 MVP schema の isolated frozen SQLite fixture に対して、source reader の native failure fallback と read-only invariant を確認した。この検証は、方針決定前の移行用 script に対する履歴である。下表の `PASS` と `未確認` は当時の判定範囲を表し、値と根拠を変更せず保持する。現行の利用手順、SQLite backup、将来の移行計画には使用しない。

| 確認項目 | 判定 | 事実 / 未確認範囲 |
| --- | --- | --- |
| require failure fallback | `PASS（isolated evidence）` | temporary `Module._load` hook で `better-sqlite3` require に `ERR_DLOPEN_FAILED` を注入し、`/usr/bin/sqlite3` CLI fallback（version probe + query）が呼ばれ、normal native snapshot と row digest / count が一致した。 |
| constructor failure fallback | `PASS（isolated evidence）` | fake constructor に `ERR_DLOPEN_FAILED` を注入し、同じ CLI fallback と snapshot 比較を確認した。 |
| read-only snapshot / validation | `PASS` | frozen fixture は mode `0444`。schema / migration state、integrity、FK、ordered row digest、Canvas `document_json` validation、page `1200x800` / 1 element、`search_text` digest を前後一致で確認した。 |
| source invariant / cleanup | `PASS` | source bytes / SHA-256、WAL / SHM sidecar は各経路で不変。temporary fixture / harness / log は cleanup 済み。 |
| targetless reconcile | `PASS（未接続の確認）` | target configuration 不足で exit `1`、Postgres 接続へ進まないことを確認。実 target の baseline / row reconcile は未実施。 |
| 限界 | `未確認` | 実際の壊れた native binary / operator machine packaging が同じ failure になるか、実 Postgres target / `DIRECT_URL` との baseline / reconcile、production / hosted readiness は今回の scope 外。 |

根拠: `summary/20260731/worker-postgres-native-reader-fallback-20260731.md`、`summary/20260731/1804-recheck-postgres-native-reader-fallback-evidence-20260731-d5caeaf3-summary.md`。

## 受け入れ証跡マトリクス

上のチェックリストは確認項目の一覧です。表の先頭に置く Gate 0 行が現行 MVP の最終判定と対象範囲を示し、その後の行は個別の証跡・履歴として各記録の範囲に限定します。同じ section の未確認項目を、別項目の PASS から推測して繰り上げません。`FAIL（静的照合）` は実装コードと現行 MVP 契約の照合で未達が確認されたもの、`未実施` は runtime 証跡がまだないものです。`POSTGRES-NATIVE-READER-20260731` は現行受け入れ対象から外した過去の検討履歴であり、当時の判定値と根拠の保存だけを目的に掲載します。Browser runtime、mobile、wheel、実 DB read-back、E2E、外部 Postgres、build / Prisma の未確認は、現行 Gate 0 の blocker ではなく、必要に応じて扱う任意 QA です。

| ID | 対象シナリオ | route と画面状態 | viewport / 実行形態 | 確認日 | fixture / 検証用データの扱い | 判定 | 参照 summary / 根拠ファイル |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MVP-GATE0-MANUAL-20260811 | 現行 MVP の人力結合テスト。テスト中の問題修正と修正後の再確認を含む | `/notes`、`/notes/new`、`/notes/[id]`、`/backup`。明示保存、閲覧・編集・復習、検索、確認付き物理削除、手動 SQLite backup | 発注者実施の人力結合テスト | 2026-08-11 | テスト中に見つかった問題を修正し、修正後に再確認したうえで完了と判断。追加の Browser / DB / E2E / Postgres / build / Prisma 証跡は Gate 0 の条件にしない | PASS（Gate 0 最終判定完了） | 発注者報告、本節「現行 MVP Gate 0 の最終判定」、`doc/implementation/MVP_CONTRACT.md` §1、現行状態の照合として `HANDOFF_2026-08-22.md` |
| MVP-UI-001 | 主要 UI フロー（redirect、一覧、作成、タグ、編集保存、復習、検索、削除、バックアップ） | `/` → `/notes`（redirect / 一覧）、`/notes/new`（作成）、`/notes/[id]`（閲覧・編集・復習・削除）、`/backup`（一覧・作成） | Playwright Chromium runtime。viewport は summary に記録なし | 2026-07-05 | UI 検証用の一時ノート、既存タグ候補、新規タグを作成。API / SQLite cleanup 後に query `UI検証` の `totalCount=0`、一時タグ 0 件を確認 | PASS | `summary/20260705/mvp-ui-flow-reverification-report.md` |
| MVP-API-001 | Notes CRUD、review、一覧検索、タグ、validation、not found、backup API | `/api/notes`、`/api/notes/:id`、`/api/notes/:id/review`、`/api/tags`、`/api/backups` | API / CLI runtime（`127.0.0.1:3000`）。viewport は対象外 | 2026-07-05 | `dev.db` に API 検証用ノート / タグを作成し、API 削除と SQLite cleanup。検証タグ 0 件を確認。backup 最新 3 世代は検証結果として保持 | PASS | `summary/20260705/manager-mvp-api-crud-validation-backup-reverification-report.md` |
| MVP-MD-001 | GFM checkbox、編集画面 Markdown Preview checkbox の表示専用挙動、閲覧 / 復習時の Markdown sanitize（詳細 Summary checkbox の操作は対象外） | `/notes/new`（編集 Preview）、`/notes/[id]`（閲覧・復習） | Playwright Chromium runtime。viewport は summary に記録なし | 2026-07-05 | `MD検証` 接頭辞の一時ノートに危険な Markdown と checkbox を入力。確認後に API cleanup し残存 0 件を確認 | PASS | `summary/20260705/manager-markdown-sanitize-checkbox-verification-report.md` |
| MVP-BAK-001 | `npm run backup:copy` と最新 3 世代保持 | CLI / SQLite backup | CLI runtime。viewport は対象外 | 2026-07-05 | root の SQLite DB を 4 回コピー。古い世代を prune し、`backup/` に最新 3 ファイルだけが残ることを確認 | PASS | `summary/20260705/backup-copy-command-verification-report.md` |
| MVP-TOOL-001 | lint、build | 静的 / CLI 検証 | CLI | 2026-07-04〜2026-07-05 | runtime fixture なし。コード変更後の検証コマンドを実行 | PASS | `summary/20260705/manager-fix-ui009-note-editor-tag-candidates-summary.md`、`summary/20260705/manager-fix-ui014-edit-save-state-summary.md` |
| NTE020-NEW-375 | Policy C の新規作成レイアウト、ページ全体 overflow、Cornell 局所横スクロール、Cue / Markdown Preview 操作 | `/notes/new`（新規作成） | 375px、Puppeteer / headless Chromium runtime | 2026-07-14 | 空 DB、保存済みノート 0 件。保存・削除・API 更新なし。リポジトリ内 screenshot は新規作成画面の記録 | PASS | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`doc/assets/screenshots/nte020-policy-c-new-375.png` |
| NTE020-NEW-768 | Policy C の新規作成レイアウト、Cornell 2 列、ページ全体 overflow | `/notes/new`（新規作成） | 768px、Puppeteer / headless Chromium runtime | 2026-07-14 | 空 DB、保存・削除・API 更新なし | PASS | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`doc/assets/screenshots/nte020-policy-c-new-768.png` |
| NTE020-NEW-1280 | Policy C の desktop split、Cue / Note 約 30% / 70%、本文 textarea / Preview 横並び | `/notes/new`（新規作成） | 1280px、Puppeteer / headless Chromium runtime | 2026-07-14 | 空 DB、保存・削除・API 更新なし | PASS | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`doc/assets/screenshots/nte020-policy-c-new-1280.png` |
| NTE020-NEW-1440 | Policy C の desktop split、Cue / Note 約 30% / 70%、本文 textarea / Preview 横並び | `/notes/new`（新規作成） | 1440px、Puppeteer / headless Chromium runtime | 2026-07-14 | 空 DB、保存・削除・API 更新なし | PASS | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`doc/assets/screenshots/nte020-policy-c-new-1440.png` |
| NTE020-EDIT-ALL | Policy C の既存ノート edit runtime | `/notes/[id]`（編集） | 1280 / 1440px は Manager fallback runtime で確認。375 / 768px は未確認 | 2026-07-25 | desktop edit 用の一時ノートを作成し、保存後再読込・キャンセル・主要 field 到達性を確認。削除後 GET 404、一覧 query の残留 `totalCount=0` | 部分実施（desktop 1280 / 1440px の確認済み範囲。375 / 768px は未確認） | `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md` |
| NTE020-OVERFLOW-375 | 長い Markdown、長いタグ、長い field error の overflow 境界 | `/notes/new` と共有 edit layout | 375px。対象入力の runtime 未確認 | 2026-07-14 | 長い Markdown / 長いタグ / 長い field error は測定に投入していない | 未実施 | `summary/20260714/nte020-policy-c-layout-qa-report.md` § Findings / Remaining Unknowns |
| NTE030-VIEW-1440 | 閲覧の共通詳細シェル、概要 → Cornell → Summary の順序、本文表示 | `/notes/[id]`（閲覧） | 1440px、Puppeteer / headless Chromium runtime | 2026-07-15 | 一時ノート `QA-SCREENSHOT-NTE030-1784048555522` を作成し、確認後に削除。query で残存 0 件を確認 | PASS | `HANDOFF_2026-07-16.md` §4「PASS として記録された範囲」、`summary/20260715/0217-create-handoff-20260715-nte020-nte030-4ee10290-summary.md`、`doc/assets/screenshots/runtime-note-detail-view-1440.png` |
| NTE030-REVIEW-1440 | 復習の共通詳細シェル、本文初期マスク、本文表示 / 再マスク、復習操作 | `/notes/[id]`（復習） | 1440px、Puppeteer / headless Chromium runtime | 2026-07-15 | 一時ノート `QA-SCREENSHOT-NTE030-1784048555522` を作成し、確認後に削除。query で残存 0 件を確認 | PASS | `HANDOFF_2026-07-16.md` §4「PASS として記録された範囲」、`summary/20260715/0217-create-handoff-20260715-nte020-nte030-4ee10290-summary.md`、`doc/assets/screenshots/runtime-note-detail-review-1440.png` |
| NTE030-SUMMARY-CHECKBOX-001 | 詳細 Summary 読み取り領域の checkbox toggle、dirty、明示保存、破棄、保存失敗、review completion との分離。編集画面 Markdown Preview checkbox の read-only 境界 | `/notes/[id]`（閲覧・復習）、`/notes/[id]?mode=edit`（編集 Preview） | Static contract と Browser runtime を分離。Static contract は確認済み、Browser runtime / E2E は未実施 | 2026-08-09 | focused contract test は fixture、DB write、Browser 操作を使わず、task marker 更新、dirty、既存 PATCH による明示保存、成功・失敗時の state、破棄、review completion との分離、編集 Preview の read-only 境界を source と契約で確認した | PASS（静的 contract）。Browser runtime / 実 DB read-back / E2E は未実施（`NOT RUN`） | `doc/implementation/MVP_CONTRACT.md` §4.1・§6.3、`doc/implementation/IMPLEMENTATION_STATUS.md` §5.1・§5.2、`src/modules/notes/ui/components/detail/read-view.tsx`、`src/modules/notes/ui/components/detail/modes.tsx`、`src/shared/markdown/markdown-task-list.js`、`test/notes/detail-summary-checkbox-contract.test.ts`、`test/notes/markdown-task-list.test.ts` |
| NTE030-MOBILE-375-768 | 閲覧 / 復習の共通シェルと本文マスクの mobile runtime | `/notes/[id]`（閲覧・復習） | 375 / 768px。いずれも未確認 | 2026-07-15 | mobile runtime 用の確認・fixture は未実施 | 未実施 | `HANDOFF_2026-07-16.md` §4「未実施のまま残した範囲」、`summary/20260715/0155-qa-nte030-review-shared-shell-puppeteer-network-blocked-summary.md` |
| MVP-REVIEW-EDGE-001 | 編集モードで既存未設定 `nextReviewDate` を非補完、学習日を表示専用としたうえでの次回復習日の独立編集、review 成功後の画面反映 | `/notes/new`、`/notes/[id]`（編集・復習） | 1280 / 1440px の新規・編集 UI。review 成功 UI は未確認 | 2026-07-25 | 新規・既存ノートの `nextReviewDate` を初期値、手動値、空欄で確認。保存・再読込と、学習日を変更せずに次回復習日を扱う契約を確認 | 部分実施（初期値・手動値保持・未設定維持を確認。review 成功 UI は未確認） | `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md`、`doc/implementation/MVP_CONTRACT.md` §4.1・§4.3 |
| MVP-GAP-001（2026-07-16時点の履歴） | 新規 `nextReviewDate = noteDate + 7日` 初期値 | `/notes/new`（新規作成） | 静的照合（viewport / fixture なし） | 2026-07-16 | 当時の実装コード、現行 MVP 契約、実装状況を照合した履歴 | FAIL（静的照合・当時の判定） | `doc/implementation/IMPLEMENTATION_STATUS.md` §1・§5.2、`doc/implementation/MVP_CONTRACT.md` §4.1 |
| MVP-REVIEW-DEFAULT-001 | 新規フォームの `nextReviewDate = noteDate + 7日` 初期値、月末・年末跨ぎ、既存ノートの未設定値非補完、明示値保持 | `/notes/new`、`/notes/[id]`（編集） | 1280 / 1440px、Manager fallback headless Playwright Chromium | 2026-07-25 | `2026-07-25` → `2026-08-01` の初期値、手動 `2026-08-05` の保持、空欄の維持を保存・再読込で確認。既存編集の学習日は表示専用とし、学習日からの自動再計算は行わない。月末・年末跨ぎは 2026-07-21 の静的確認を保持 | 部分実施（runtime 確認済み範囲。review 成功 UI は未確認） | `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md`、`summary/20260721/1940-implement-new-note-review-date-default-20260721-24f5f31b-summary.md`、`doc/implementation/MVP_CONTRACT.md` §4.1 |
| MVP-REVIEW-SCREEN-DEFAULT-001 | 既存ノートの復習画面開始時、保存済み `nextReviewDate`（過去・当日・未来）を初期値に再利用せず、`Asia/Tokyo` 基準の現在日付 + 7日を表示。手動変更・空欄化・保存成功後の response 反映も確認 | `/notes/[id]`（復習） | Browser runtime。実行時の Asia/Tokyo 日付を基準に確認 | 2026-08-08 | focused contract test で review 遷移の初期値計算、保存値非参照、手動変更・空欄化の state 引き継ぎ、成功 response 反映のコード契約を確認。画面 runtime は未実施 | 未実施（runtime） | `src/modules/notes/ui/components/detail/modes.tsx`、`src/shared/date/date-only.ts`、`test/notes/detail-actions-layout-contract.test.ts`、`doc/implementation/MVP_CONTRACT.md` §4.3 |
| MVP-GAP-002 | 復習開始時の Summary 初期非表示と Cue → 本文 → Summary の順序 | `/notes/[id]`（復習） | 静的照合（viewport / fixture なし） | 2026-07-16 | fixture なし。実装コード、現行 MVP 契約、実装状況を照合。runtime 未実施とは別に、Summary 初期非表示の未達を記録 | FAIL（静的照合） | `doc/implementation/IMPLEMENTATION_STATUS.md` §1・§5.2、`doc/implementation/MVP_CONTRACT.md` §4.3・§6 |
| MVP-GAP-003 | 概要の Markdown preview / sanitize | `/notes/new`、`/notes/[id]`（編集・閲覧） | 静的照合（viewport / fixture なし） | 2026-07-16 | fixture なし。概要の保存は確認できるが、本文 / Summary と同じ Markdown preview / sanitize ではない | FAIL（静的照合） | `doc/implementation/IMPLEMENTATION_STATUS.md` §1・§5.2、`doc/implementation/MVP_CONTRACT.md` §2・§6 |
| CANVAS-DIMENSION-001 | Canvas の既定 1200x800、320〜4000px の整数入力、保存後復元、resize 前後の要素データ不変、表示倍率との分離 | `/notes/new`、`/notes/[id]`（編集・閲覧・復習）、`/api/notes` | Manager 直接の権限付き headless Playwright Chromium、Browser runtime | 2026-07-25 | 初期 `1200x800`、320 / 4000 適用、319 / 4001・decimal・blank 拒否、幅 / 高さ変更前後の rect データ不変を確認。保存 run の page `1280x900` と viewer / edit / reload も確認 | PASS（確認済み範囲） | `summary/20260725/canvas-runtime-qa-completion-20260725.md`、`doc/implementation/MVP_CONTRACT.md` §6.1 |
| CANVAS-INTERACTION-001 | 空白および既存の pen stroke、line、arrow、rect、ellipse、standalone text 上からの新規作成、preview / inline editor overlay / metadata 欠落 object の gesture 遮断 | `/notes/new`（編集） | Browser runtime、1280 x 900、pointer | 2026-07-25 | 既知要素、preview、inline overlay、3px / 5px、metadata 欠落、unknown type、preview marker、shape text editor marker の pen 遮断、pointercancel、保存 `elements=[]`、cleanup は既存 summary で確認済み。今回は再実施していない。厳密な 4px、touch scroll、wheel / trackpad 等は未確認 | 部分実施（確認済み subset を保持） | `summary/20260725/canvas-runtime-qa-completion-20260725.md`、`summary/20260724/canvas-gesture-browser-qa-runtime-20260724.md`、`summary/20260725/canvas-unknown-target-pen-browser-qa-runtime-20260725.md`、`src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`、`src/shared/canvas/adapters/fabric/fabric-metadata.ts` |
| CANVAS-GESTURE-001 | line / arrow / rect / ellipse のクリック・ダブルクリック no-op、4px drag threshold、standalone text・shape inline text・shape drag の gesture 分離 | `/notes/new`（編集） | Browser runtime、1280 x 900、pointer | 2026-07-25 | 4 tool の click / double-click / 3px / 5px、同じ tool の inline editor overlay、別 shape tool 切り替え後の commit / Escape cancel → drag 分離は既存 summary で確認済み。今回は再実施していない。厳密な 4px、touch scroll、wheel / trackpad、完全な再読込は未確認 | 部分実施（確認済み subset を保持） | `summary/20260725/canvas-runtime-qa-completion-20260725.md`、`summary/20260724/canvas-gesture-browser-qa-runtime-20260724.md`、`summary/20260725/canvas-shape-tool-switch-gesture-separation-runtime-20260725.md`、`summary/20260722/canvas-browser-qa-partial-20260722.md`、`doc/designs/CANVAS_TOOLBAR_DESIGN.md` §9.2、`src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`、`src/modules/notes/lib/canvas-editor-geometry.ts` |
| CANVAS-SHAPE-TEXT-001 | rect / ellipse の図形内文字 inline editor、外形と文字の表示、確定・キャンセル、他要素保持、Fabric lifecycle error 無し、配置の即時反映 | `/notes/new`、`/notes/[id]`（編集） | Browser runtime、1280 x 900、pointer / keyboard | 2026-07-25 | 最新 summary で rect commit、fontSize `18`・右寄せ、ellipse Escape cancel、線要素保持、POST `201`、再読込 GET `200`、DELETE `204`、console / page error 0 を確認。既存 summary で別 shape tool 切り替え、editor / hidden textarea cleanup、追加 style commit も確認。繰り返し lifecycle、全保存経路は未確認 | 部分実施（必須 subset は PASS） | `summary/20260725/2230-mandatory-qa-manager-fallback-20260725.md`、`summary/20260725/canvas-runtime-qa-completion-20260725.md`、`summary/20260725/canvas-shape-tool-switch-gesture-separation-runtime-20260725.md`、`summary/20260722/canvas-browser-qa-partial-20260722.md`、`src/modules/notes/ui/canvas/shape-text-editor-session.ts`、`src/modules/notes/ui/components/canvas/editor.tsx`、`src/shared/canvas/adapters/fabric/fabric-shape-factory.ts` |
| CANVAS-STYLE-001 | 線幅・文字サイズの既定値と整数範囲、無効値拒否、stroke / text の色、standalone text / shape inline text の left・center・right、選択中・編集中の即時反映 | `/notes/new`、`/notes/[id]`（編集） | Manager 直接の権限付き headless Playwright Chromium、pointer / keyboard | 2026-07-25 | standalone text の 8 / 96 適用と 7 / 97 / 12.5 / blank 拒否、line の 1 / 20 適用と 0 / 21 / 1.5 / blank 拒否、text / line color、left / center / right、rect editor の font / color / alignment commit を確認 | PASS（確認済み範囲） | `summary/20260725/canvas-runtime-qa-completion-20260725.md`、`doc/implementation/MVP_CONTRACT.md` §6.2 |
| CANVAS-PERSISTENCE-STYLE-001 | standalone text の `style`、shape inline text の `textStyle`、線幅・線色の保存境界、保存・再読込、用紙だけ変更した場合の style / text / geometry / searchText 不変 | `/notes/new`、`/notes/[id]`（編集・閲覧）、`/api/notes` | Manager 直接の権限付き headless Playwright Chromium、UI request / GET / 再読込 | 2026-07-25 | `Runtime Persistence QA 20260725` で page `1280x900`、standalone text `PERSIST TEXT` の font / color、line strokeWidth、request / GET の elements、viewer assistive text、edit / reload title・page・text、DELETE 204、cleanup を確認 | PASS（確認済み範囲） | `summary/20260725/canvas-runtime-qa-completion-20260725.md`、`doc/implementation/MVP_CONTRACT.md` §6.1・§6.2 |
| CANVAS-TOOLBAR-STYLE-001 | style input、alignment button、用紙入力、tool group の responsive / keyboard / touch 到達性、active・style target・alignment の visual / ARIA 状態、ページ縦 scroll と用紙局所横 scroll | `/notes/new`、`/notes/[id]`（編集） | Manager 直接の権限付き headless Playwright Chromium、375 / 768 / 1280 touch、keyboard / pointer / touch | 2026-07-25 | rail `305 / 461`・`346 / 461`、全 tool の ARIA / active state、Tab / Shift+Tab、focus-visible solid 2px、640x480 / invalid 319、page scroll、1920x1080 paper の local horizontal scroll を確認。1440px の既存確認は 2026-07-24 の summary を参照 | PASS（確認済み範囲） | `summary/20260725/canvas-runtime-qa-completion-20260725.md`、`summary/20260724/canvas-toolbar-browser-qa-runtime-20260724.md`、`doc/implementation/MVP_CONTRACT.md` §6.1・§6.2・§7 |
| CANVAS-SCROLL-WHEEL-20260731 | Canvas の wheel / trackpad / touch scroll handoff、scroll 中の drawing 誤作成・既存要素不変 | `/notes/new`、必要に応じて `/notes/[id]`（編集・閲覧） | Browser runtime、375 / 768 / 1280px、wheel / touch / pointer | 2026-07-31 | Browser backend `[]`、localhost route 到達不可、新規 server bind `EPERM`。viewport metrics、input event、Canvas JSON、保存 request / GET、console / page error は未取得。2026-07-25 の別経路 subset は履歴として保持 | BLOCKED | `summary/20260731/worker-canvas-scroll-wheel-touch-qa-20260731.md` |
| NTE020-MOBILE-RUNTIME-20260731 | mobile の新規 editor、既存 note edit、viewer、review、long input / validation overflow | `/notes/new`、`/notes/[id]`（編集・閲覧・復習） | 375 / 768px、Browser / headless Chromium runtime | 2026-07-31 | Browser backend `[]`、dedicated server bind `EPERM`、headless Chromium 起動失敗。curl の route 200 は visual / interaction PASS ではない。fixture / screenshot / browser listener は未作成 | BLOCKED | `summary/20260731/worker-mobile-note-runtime-20260731.md` |
| POSTGRES-NATIVE-READER-20260731 | 不採用方針決定前の source reader 検証履歴: native failure fallback、CLI snapshot、read-only invariant、Canvas / row validation、targetless reconcile | `scripts/postgres-migration-common.js`、`scripts/postgres-reconcile.js` | isolated frozen SQLite fixture、temporary harness。実 Postgres target は対象外 | 2026-07-31 | require / constructor の `ERR_DLOPEN_FAILED` 注入から `/usr/bin/sqlite3` CLI fallback に到達。row digest、Canvas validation、source hash / size / sidecar 不変、temporary cleanup、targetless reconcile の未接続を確認 | PASS（isolated evidence の範囲のみ） | `summary/20260731/worker-postgres-native-reader-fallback-20260731.md`、`summary/20260731/1804-recheck-postgres-native-reader-fallback-evidence-20260731-d5caeaf3-summary.md` |
| PHASE2-BOUNDARY | 2026-07-16 時点の将来候補境界。現在は Desktop Alpha、採用済みの Canvas PNG・検索／一覧、未採用候補を分離する | Desktop shell / Settings / export / search 等（MVP 外） | 静的な契約照合。runtime 対象外 | 2026-07-16 | fixture なし。当時から未実施で、現行 MVP の PASS 集計には含めない。PDF export は現在未採用 | 未実施 | `doc/implementation/MVP_CONTRACT.md` §2・§9、本文書「Desktop Alpha / Phase 2 / 将来確認」 |

注記: 2026-07-18 の概要項目削除より前に実施した `NTE030-VIEW-1440`、`MVP-GAP-002`、`MVP-GAP-003` は、当時の画面・契約に対する履歴記録です。現在の受け入れ対象には含めず、過去の確認結果・未達理由を改変せずに保持します。

`POSTGRES-NATIVE-READER-20260731` も、Postgres 不採用方針の決定前に取得した履歴です。SQLite backup の現行受け入れ項目 `MVP-BAK-001` とは別の記録であり、両者を同じ運用経路として扱いません。

NTE-020 の `summary/20260714/2205-document-nte020-policy-c-responsive-acceptance-scenarios-3f7ff466-summary.md` と `summary/20260714/2319-document-nte020-policy-c-runtime-screenshots-3b94ae94-summary.md` は、受け入れ観点・screenshot task の記録です。実画面の判定は `summary/20260714/nte020-policy-c-layout-qa-report.md` と存在確認済みの PNG を根拠にし、edit runtime や長文 overflow を推測で PASS にしていません。

NTE-030 の `summary/20260715/0107-implement-nte030-review-shared-detail-shell-e125e816-summary.md` は実装 task、`summary/20260715/0112-qa-nte030-review-shared-shell-runtime-screenshots-f2358087-summary.md` と `summary/20260715/0206-document-nte030-runtime-screenshot-evidence-fcffd017-summary.md` は task / documentation 記録です。`summary/20260715/0155-qa-nte030-review-shared-shell-puppeteer-network-blocked-summary.md` は接続制約による失敗記録であり、これらの `done` 状態だけを runtime PASS の根拠にはしません。1440px の PASS は、直接確認内容を記した `HANDOFF_2026-07-16.md` と実在する screenshot を根拠にしています。

## Desktop Alpha / Phase 2 / 将来確認

次の項目は現行 MVP 外です。Desktop Alpha は全体として未完了です。更新確認・取得・検証・state・pending verification、verified artifact の明示 apply preparation、persisted `ApplyPreparation` を起点とする staged migration、read-back、candidate health、bundle switch、rollback / recovery、checkpoint persistence、cleanup には backend 実装と static / disposable test 証跡があります。PR #159 の Code Review Issue #164〜#175 では、候補 safety backup の再利用・曖昧性、failed bundle marker cleanup、restart handoff、同一 startup recovery、全 application table read-back、restart 後の signed archive / staging tree 再検証、restore proof、schema compatibility、durable rename、cleanup / retry safety を対象にした回帰観点を追加しています。staged migration suite は 22/22 PASS、`node --import tsx/esm --test test/desktop/desktop-update-*.test.ts` は 77/77 PASS、desktop recovery suite は 14/14 PASS ですが、これは実際の macOS packaged app による更新完了の PASS ではありません。自動 apply / 自動 restart は行わず、Settings の Updates 操作は manual update check の typed bridge 接続まで実装済みです。一方、Data and Backup の操作機能は static / disposable test 済みですが、 update apply、Data and Backup の操作機能の packaged runtime / native GUI、実 provider / package runtime、実 health / switch / rollback / cleanup は未検証です。これらを含む Desktop Alpha の判定は現行 MVP の PASS 集計に含めません。static / disposable test の PASS を packaged GUI、provider / package runtime、browser runtime、DB read-back の PASS へ繰り上げません。Desktop PoC と Desktop Alpha の packaged QA 後に Canvas PNG、検索サジェスト、大規模一覧を確認します。未採用候補は、発注者が採用するまで実装シナリオとして確定しません。

#### 0.1 2026-08-24 Desktop Alpha 検証証跡と境界

| 証跡 | 判定 | 現時点の境界 |
|---|---|---|
| staged migration suite（`test/desktop/desktop-update-migration.test.ts`） | PASS（22/22） | candidate digest ごとの safety backup 再利用、内容・file identity 検証、複数件の曖昧性 fail-closed、全 application table の read-back、`sqlite_*` / `_prisma_migrations` の除外、table / column / row の消失・変更検出、#174 candidate schema gate、#175 post-rename sync failure を含む static / disposable 証跡。実 packaged runtime の代替ではない。 |
| Desktop update Node suite（`test/desktop/desktop-update-*.test.ts`） | PASS（77/77） | provider response の runtime 取得、実 package download、packaged `.app` / DMG、Apple Silicon GUI、更新完了の確認ではない。apply command の no-argument / explicit invoke、restart 後の #169 再検証、handoff 永続化順序、staged migration、read-back、checkpoint、health / switch / rollback / cleanup、#170〜#173 の retry / restore safety、#174 / #175 の migration boundary、archive と extracted tree の全 entry 照合の disposable / static 境界を含む。 |
| desktop recovery suite（`test/desktop/desktop-update-recovery.test.ts`） | PASS（14/14、上記 suite に含む） | candidate health、runtime root、checkpoint、rollback / SQLite restore、failed bundle marker cleanup の順序と安全境界、#170 partial cleanup retry、#171 exact temp cleanup、#172 `Some(true)` restore proof、#173 partial `switch_temp` discard / rebuild、safe internal symlink の switch / cleanup、同一 startup の migration recovery の static / disposable 証跡であり、実際の packaged app の代替ではない。 |
| lifecycle/runtime tests | PASS（15） / SKIP（7） | SKIP は loopback / packaged runtime 依存で、dynamic sidecar health / process cleanup と packaged runtime を確認できないため。 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | Rust unit/build の実行結果ではない。 |
| `git diff --check` | PASS | 文書・作業ツリーの whitespace 検査であり、runtime QA ではない。 |
| Rust unit/build | 未検証 | offline cache に `base64 0.22.1` crate がなく compile 前に停止した。 |
| full build | 未検証 | 今回の確認範囲に full build は含めていない。packaged macOS runtime と packaged DMG の配信可否も未検証である。 |
| 対象 ESLint / Node syntax | PASS | 対象 ESLint、対象 Desktop test / launcher / runtime helper の `node --check` を確認した。repo-wide lint の結果とは分けて扱う。 |

#### 0.2 Issue #169〜#175 回帰シナリオ

各行は、既存の Desktop update test の Issue 番号に対応する再現条件と受け入れ境界です。`PASS` は static / disposable test の結果であり、packaged macOS runtime の受け入れを意味しません。

| Issue | 再現条件 | 受け入れ観点 | 現状 |
|---|---|---|---|
| #169 | restart 後、署名済み archive または extracted staging tree の bytes、type、mode、size、追加・欠落、internal symlink target のいずれかを変更する。 | staged migration、candidate health、bundle switch の前に archive と staging tree 全体を再検証し、不一致なら claim / health / switch を起動せず fail-closed にする。 | PASS（Issue focused 6/6、全体 77/77 に含む） |
| #170 | candidate bundle / package / migration / backup の一部だけが cleanup 済みの状態で、cleanup retry を実行する。 | missing leaf は canonical managed root と existing component の no-follow 検証後に idempotent success とし、残りを cleanup して completion へ進む。root escape、parent / leaf symlink、special file は fail-closed にする。 | PASS（recovery 14/14、全体 77/77 に含む） |
| #171 | rollback restore の validation failure、retry、token / candidate digest mismatch、または前回中断で temporary DB が残った状態を再実行する。 | 作成した exact temp path と managed live directory 内の stale temp だけを安全に cleanup し、別 restore の temp や live DB を削除・上書きしない。 | PASS（recovery 14/14、全体 77/77 に含む） |
| #172 | DB switch 前に failure を発生させた後、live DB を別編集してから rollback recovery を実行する。 | 実切替 proof が `Some(true)` の場合だけ safety backup restore を許可し、`Some(false)` / `None` では restore せず live DB の後続編集を保持する。 | PASS（migration / recovery、全体 77/77 に含む） |
| #173 | bundle copy / recovery interruption で partial `switch_temp` を残し、candidate source から switch retry を行う。 | partial temp を candidate として再利用せず、完全 tree 検証済み source から no-follow cleanup 後に再構築する。safe internal symlink の target string と path boundary を維持する。 | PASS（recovery 14/14、全体 77/77 に含む） |
| #174 | migration history は一致しているが、pending migration がない候補 Prisma schema に新規 column / constraint 等の差分がある状態で起動する。 | `NO_PENDING`、safety backup、switch、cleanup の前に candidate schema と live / staged SQLite schema を比較し、不一致なら live DB と candidate artifact を変更せず fail-closed にする。 | PASS（migration 22/22、全体 77/77 に含む） |
| #175 | staged DB rename 自体は成功した後、live directory の sync を失敗させる。 | post-rename sync failure を `STAGED_MIGRATION_SWITCH_FAILED` として扱い、durable switch の成功へ進めず、backup / live DB の安全境界を保持する。 | PASS（migration 22/22、全体 77/77 に含む） |

上記 focused test の PASS は、provider / manifest / selection / 公開 URL 境界 / download / signature・SHA-256 / archive・bundle validation / update state / pending verification、`apply_verified_update` の explicit no-argument command、verified candidate の再検証、`ApplyPreparation` の atomic state transition、handoff の atomic 永続化後にだけ行う exit allowance / restart request、明示 handoff がない `ApplyPreparation` の interruption 扱い、persisted `ApplyPreparation` を起点とする staged migration の claim / failure、candidate digest ごとの safety backup 再利用、複数 backup の曖昧性 fail-closed、runner / read-back / switch failure の typed rollback checkpoint、同じ startup の recovery と成功時だけの bootstrap、SQLite 全 application table の read-back、`sqlite_*` / `_prisma_migrations` の除外、既存 table / column / row の消失・変更検出、candidate health、bundle switch、rollback / SQLite restore、failed bundle marker の safe cleanup、rollback 成功時の `Available + failure + pending candidate`、rollback 失敗時の `RollbackPending` 保持、archive と extracted candidate tree の全 entry（bytes、type、mode、size、追加・欠落、safe internal symlink target）照合、safe internal symlink の switch / cleanup、automatic path からの非起動境界を示す static / disposable 証跡である。browser / DB read-back、dynamic loopback / sidecar runtime、GUI の dirty close、実 provider / package runtime、実際の macOS packaged `.app` / DMG、packaged Apple Silicon GUI、full build、packaged DMG の配信可否は未検証である。これらの結果は現行 MVP の PASS 集計や Desktop Alpha の packaged acceptance へ繰り上げない。

### 1. Desktop PoC 比較

- [ ] Electron と Tauri + Node.js sidecar が、同じ現行 MVP baseline identifier を使っている
- [ ] 両候補が同じ deterministic な 10,000 note SQLite fixture、同じ seed、同じ Apple Silicon Mac と macOS を使っている
- [ ] cold start を process 起動からノート一覧が操作可能になるまで同じ手順で測定している
- [ ] 一覧表示、検索、詳細遷移、編集・保存の操作反応を同じ fixture と操作で測定している
- [ ] shell の main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper、関連子 process の合計メモリを同じ状態で記録している
- [ ] packaged app / DMG と同梱 runtime のサイズ・内訳を同じ基準で記録している
- [ ] SQLite / Prisma / migration、single application instance / 1 primary window、既存 primary window の前面化、shutdown、app-owned process tree cleanup の成立性を確認している
- [ ] shell が必要とする main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper、関連子 process の存在を許容している
- [ ] OS process が複数存在することだけを候補の blocker または不合格理由にしていない
- [ ] DMG、静的 manifest、architecture / OS compatibility の端末内判定、background download、明示再起動による更新の成立見通しを比較している
- [ ] Desktop Alpha の artifact / QA 対象を Apple Silicon `aarch64-apple-darwin` に限定し、Intel を Public Mac Release の別判断としている
- [ ] 初期配布 DMG とアプリ内更新用 `.app archive` の役割を分け、archive の具体的な拡張子をこのシナリオで固定していない
- [ ] Developer ID / notarization を Desktop Alpha の必須条件や PoC blocker にしていない
- [ ] 保守性、安全性、license、Apple 関連費用、配布 storage / bandwidth、CI、保守工数を含む総コストを比較している
- [ ] 成功、失敗、未測定、blocker を候補ごとに同じ形式で記録し、発注者が shell を選定している
- [ ] PDF export、packaged Playwright / Chromium、Canvas PNG、Intel、未検証の古い macOS を blocker または必須受け入れ条件にしていない

### 2. Desktop lifecycle / Settings

#### 2.1 single-instance recovery（実装済み・packaged GUI 未検証）

| シナリオ | 実装・Rust unit test の期待値 | 現時点の境界 |
|---|---|---|
| 正常な二重起動 | stable advisory lock が `WouldBlock` になり、focus socket の `focused` で既存 primary を前面化する。secondary は window / sidecar を作らない | packaged app の Dock / Finder 前面化は未検証 |
| primary 起動途中、socket 未作成または `not-ready` | focus を bounded retry し、期限内に lock が解放された場合だけ acquire を再試行する。期限切れは sanitized な既存 owner / 準備中エラーで停止する | packaged GUI の起動時間・表示は未検証 |
| crash 後の marker / socket | lock free 後に owner marker は atomic replace し、接続不能な stale socket だけ lock 保持中に再 bind する。stable `.instance.lock` は残す | SIGKILL 後の packaged app 再起動は未検証 |
| 破損・空・schema / application id 不一致 marker | 別 owner marker は lock free のときだけ atomic replace する。stable lock に旧形式 JSON があれば legacy fail-safe error とし、marker/socket/DB/backup を削除しない | recovery UI は未実装 |
| PID reuse 相当 | marker の PID、生存確認、socket pathname を ownership 判定に使わない。advisory lock の状態だけで primary / existing owner を決める | 実機での PID 再利用再現は未実施 |
| concurrent acquire | 一方だけが stable advisory lock と primary state を取得し、他方は focus または bounded not-ready state になる | packaged process 起動競合は未検証 |
| active / unknown protocol / permission endpoint | socket を削除せず、sanitized な bind / 起動失敗として停止する | macOS packaged permission 境界は未検証 |

2026-08-24 の確認では lifecycle static test が 8 PASS、dynamic loopback 関連が 7 SKIP だった。Rust unit test は production の `HOME` や Application Support を使わず temp directory と injected instance paths を使う設計だが、今回の環境では offline cache の `base64` 不足で未検証である。Node の `test/desktop/desktop-lifecycle.test.ts` は製品 identifier、dynamic loopback、focus / recovery の静的契約を確認する補助であり、packaged app の代替ではない。

#### 2.2 Settings shell / bridge / entrypoint（shell と Data and Backup は static / disposable test 済み、managed restore の packaged GUI は限定確認）

現行 Settings modal のトップレベル区分は General と Data and Backup の2つで、更新確認は General 内のセクションである。General のテーマ設定と UpdatesPanel から manual update check の typed bridge を呼ぶ UI 接続、Data and Backup の操作は static / disposable test で確認できる。外部 SQLite export は create-only / no-replace とし、既存 destination は `destination-exists` で拒否して別名保存を案内する。managed restore は exact normal artifact / disposable data に限定した packaged GUI PASS である。実 provider、update apply、その他の packaged runtime / native GUI は未検証である。

`SettingsEntrypoint` は AppChrome の desktop rail と mobile trigger に接続され、shared event bridge を介して Mac menu からも既存 primary WebView の同じ modal を開く。Settings modal には General と Data and Backup の2つのトップレベル区分（更新確認は General 内のセクション）、dialog / focus trap / keyboard navigation がある。General はテーマ設定と manual update check bridge 接続を持ち、Data and Backup は native file-dialog / typed bridge、create-only / no-replace の手動 plaintext SQLite export、managed backup catalog、managed / external restore 共通 pipeline、pending restore と明示 resume、complete data deletion を static / disposable test 済みの操作として提供し、現行 `/backup` への入口を維持する。managed restore の packaged GUI は限定的に確認済みで、その他の packaged runtime / native GUI は未検証である。新しい primary window は追加していない。

`test/desktop/desktop-settings-shell.test.ts` と `test/desktop/desktop-settings-ui.test.ts` はこの shell / bridge / UI 境界を静的に確認する補助であり、Settings の実操作、browser runtime、packaged GUI の受け入れを PASS に繰り上げない。

- [ ] packaged app が single application instance / 1 primary window で起動する
- [ ] アプリを 2 回起動しても application instance と primary window が増えず、既存 primary window が前面へ出る
- [ ] Settings modal、確認 dialog、OS file dialog が新しい独立 primary window を作らない
- [ ] 最後の primary window を閉じると application instance が終了し、local runtime と app-owned child process をすべて停止した後に app-owned process tree（orphan process）が残らない
- [ ] 次回起動はノート一覧から始まり、前回 route を復元しない
- [ ] 保存した window size / position が現在の画面領域外にある場合、見える位置へ補正する
- [ ] dirty close で保存して終了、保存せず終了、終了取消しの 3 結果を選べる
- [ ] dirty update で保存して更新、保存せず更新、更新取消しの 3 結果を選べる
- [ ] close / update dialog の Escape と dialog 外操作が取消しになり、保存失敗時は終了・更新せず draft と dirty 状態を保持する
- [ ] Settings modal に General と Data and Backup があり、更新確認は General 内に含まれ、Mac は Settings menu、開発用 Web は gear から開ける
- [ ] 現行 `/backup` は Data and Backup が代替して受け入れ確認を通るまで維持され、確認後の Desktop UI だけで段階的に廃止される

### 3. Desktop update / migration（backend 実装済み、packaged runtime 未検証）

下表は既存コードと focused static contract test の現状であり、下記チェックリストは Desktop Alpha 完了条件である。static `PASS` の行も runtime の受け入れ済みとは扱わず、未完了の行は未チェックのまま保持する。

| 範囲 | 現状 | 検証境界 |
|---|---|---|
| provider / manifest / compatible selection / 公開 URL 境界 | backend 実装済み、static / disposable PASS | GitHub Releases provider response の実取得、dynamic network、browser / GUI 経由の確認は未検証。 |
| package download / signature・SHA-256 / archive・bundle validation | backend 実装済み、static / disposable PASS | disposable fixture と source contract の確認であり、実 package、packaged `.app`、Apple Silicon GUI の検証ではない。 |
| update state / pending verification | backend 実装済み、static / disposable PASS | atomic state と staging revalidation、`ApplyPreparation` / restart health / rollback / cleanup checkpoint の境界を持つ。実 runtime は未検証。 |
| verified artifact の update apply preparation | backend 実装済み、static / disposable PASS（77/77） | `apply_verified_update` は引数なしの明示 command。manifest / candidate identity、signature・digest、canonical staging path、archive、bundle ID / version / architecture / arm64 Mach-O を再検証し、`ApplyPreparation` の atomic state transition 後に explicit restart handoff へ渡す。handoff の atomic 永続化が成功した後にだけ exit allowance と restart request を行い、永続化失敗時は restart しない。明示 handoff のない persisted `ApplyPreparation` は interruption として扱い、自動 apply / restart しない。apply 直前に署名済み archive と extracted candidate tree の全 entry（bytes、type、mode、size、追加・欠落、safe internal symlink target）を照合する。実 provider / package runtime、packaged `.app` / DMG、Apple Silicon GUI は未検証。 |
| staged migration | backend 実装済み、migration suite 22/22 PASS | persisted `ApplyPreparation` と explicit restart handoff だけを起点とし、migration claim を永続化する。pending migration 時だけ safety backup、DB staging copy の migration / reopen を行う。同じ candidate digest の既存 safety backup は内容・file identity 検証後にだけ再利用し、複数件は選択・削除せず fail-closed とする。pending migration がない場合も `NO_PENDING` 前に candidate Prisma schema と live / staged SQLite schema の compatibility を検証する。全 application table を動的に read-back 比較し、`sqlite_*` / `_prisma_migrations` だけを除外して既存 table / column / row の消失・変更を switch 前に検出する。runner / read-back / switch failure は typed rollback checkpoint として保存し、同じ startup で recovery を実行する。recovery 成功時だけ bootstrap へ進み、recovery failure は fail-closed とする。failure / interruption 後は staged migration を自動再実行しない。rename 後の live directory sync failure も switch failure として扱う。実 packaged runtime は未検証。 |
| rollback / recovery / candidate health / cleanup | backend 実装済み、desktop recovery 14/14 PASS（77/77 に含む） | `HealthPending`、`BundleSwitching`、`BundleSwitched`、`CleanupPending`、`RollbackPending` の checkpoint、candidate health、bundle switch、SQLite restore、旧 bundle 復帰、成功後だけの cleanup を実装。DB / bundle rollback と restore の成功後、terminal rollback state の記録前に managed root / safe-tree 検証付きで failed bundle marker を削除し、cleanup failure 時は `RollbackPending` と typed failure を保持する。rollback / restore 成功時は `Available + failure + pending candidate` へ遷移し、失敗時は `RollbackPending` と typed failure を保持する。candidate health は `Contents/Resources/runtime` を使用し、safe internal symlink のみを許可する。実 macOS packaged `.app` / DMG の sidecar health / switch / rollback / cleanup は未検証。 |
| runtime QA | 未検証 | dynamic loopback / sidecar runtime、browser / DB read-back、GUI の dirty close、実 provider / package runtime、実際の macOS packaged `.app` / DMG、packaged Apple Silicon GUI は未確認。 |

- [ ] GitHub Releases の provider response を provider-neutral な manifest へ正規化し、provider の並び順、文字列順、raw response、release notes を候補選択に使わない
- [ ] root の `productId` が必須で `com.cornellmethod.notebook` と一致し、root の `schemaVersion: 1` が必須で、未知 schema version を fail closed にする
- [ ] root、release、artifact、signature の未知 field を検出した manifest 全体を拒否する
- [ ] manifest が必須の `releases[]` を持ち、空配列を有効な「更新なし」として扱う
- [ ] release の `channel`、`version`、`architecture`、`minVersion`、任意の `maxVersionExclusive`、`artifact`、`signature` と、artifact / signature の許可 field を strict に検証する
- [ ] version が SemVer precedence で比較され、prerelease を対象外とし、build metadata を大小判定に使わず、provider order / 文字列順を使わない
- [ ] channel が `stable` 固定で、Desktop Alpha の architecture が `aarch64-apple-darwin` である
- [ ] `minVersion` を必須の macOS 下限、`maxVersionExclusive` を任意の排他的上限として、macOS version を数値 component で比較する。実際の最低対応 macOS version は packaged PoC 後まで固定しない
- [ ] `artifactId` が必須の opaque immutable ID で、同じ package に同じ ID を使う
- [ ] `format` が抽象値 `app-archive`、`sizeBytes` が必須の正の整数 byte 数、`sha256` が 64 文字の lowercase hexadecimal である
- [ ] artifact URL が公開 direct HTTPS で、HTTPS → HTTPS redirect だけを許可し、HTTP downgrade、credential、token、ユーザー固有 query を拒否する
- [ ] signature の `keyId` と opaque `proof` が必須で、package digest と release metadata をまとめて署名する。署名アルゴリズム名、encoding、canonicalization、鍵値をこのシナリオで固定しない
- [ ] 同じ channel・version・architecture・macOS target の重複が manifest 全体を拒否し、対象外 release の重複も除外処理前に検出される
- [ ] `stable` 以外の channel、未知 architecture、未知 format はその release だけを対象外とし、他の有効な候補を評価する
- [ ] root / field / type / range / URL / proof の不備や duplicate では manifest 全体を拒否し、非対象 release の値だけでは manifest 全体を拒否しない
- [ ] 同一 channel の現行 version より新しい compatible version だけを選び、downgrade を行わない
- [ ] 各 release の `keyId` がアプリに保持する現行鍵または次期鍵を参照し、manifest から新しい信頼根を追加しない
- [ ] 更新 package の公開鍵署名と SHA-256 を検証し、検証失敗時に取得物を破棄して現行版を維持する
- [ ] 初期インストール用 DMG を作成できる
- [ ] アプリ内更新 package が Apple Silicon 向け `.app archive` で、DMG と役割を分けている
- [ ] 起動完了後の更新確認は非同期で、最大 1 日 1 回に制限され、手動確認もできる
- [ ] 更新確認の ON / OFF 設定が存在しない
- [ ] 更新 package を background download し、自動適用せず、明示的な「再起動して更新」でだけ適用する
- [ ] `apply_verified_update` が `Available` かつ `Verified` の candidate に対する引数なしの明示 invoke だけで起動し、manifest / signature・digest / canonical staging path / archive / bundle を再検証してから `ApplyPreparation` を atomic に保存し、explicit restart handoff へ渡す。明示 handoff のない persisted `ApplyPreparation` は interruption として扱い、自動 apply / restart しない
- [ ] explicit restart handoff の atomic 永続化成功後にだけ exit allowance と restart request を行い、永続化失敗時は restart も exit allowance も行わない
- [ ] 更新確認または download に失敗しても現行版を利用でき、次回の定期確認または手動確認で manifest 確認から更新処理全体を再試行する
- [ ] 同じ保留更新を modal で繰り返し通知せず、Settings から状態を確認できる
- [ ] 複数版を飛ばす更新で、端末が利用できる最新の compatible version を選ぶ
- [ ] package の署名・完全性検証に失敗した場合、取得物を破棄して現行版を維持する
- [ ] manifest は更新判定に必要な最小情報だけを扱い、端末固有 ID、利用状況、ノート本文、Cue、Summary、タイトル、タグ、学習元、検索内容、SQLite、backup、診断 log を含めない
- [ ] 更新 package を Application Support 内の app 管理 staging に保管する
- [ ] manifest root の `schemaVersion: 1` と local `settings/update-state.json` の schema version を分離する
- [ ] `settings/update-state.json` が version、channel、architecture、`artifactId`、`sizeBytes`、`sha256`、`keyId`、verification state、app 管理 staging からの relative package path、時刻だけを atomic に保存し、URL、provider response 全体、token、DB、user path、user data を保存しない
- [ ] pending migration がある更新だけ、適用直前に app 管理 safety backup を作る
- [ ] pending migration がない更新で、migration 用 safety backup と migration を実行しない
- [ ] 同じ candidate digest の既存 safety backup を、内容と file identity の検証後にだけ再利用する
- [ ] 同一 candidate digest の safety backup が複数ある場合、選択・削除せず fail-closed にする
- [ ] migration を DB staging copy 上で古い順に適用し、schema、必須データ、Canvas、reopen を検証する
- [ ] migration の read-back で既存 table の列・row、Notebook の legacy Markdown、NotebookCanvas の `CanvasDocumentV1` を保持していることを検証する
- [ ] SQLite の全既存 application table を動的に read-back 比較し、`sqlite_*` system table と `_prisma_migrations` だけを除外する。既存 table、column、row の消失・変更を switch 前に検出する
- [ ] staged migration の runner / read-back / switch failure を typed rollback checkpoint として保存し、同じ startup で recovery を実行する。recovery 成功時だけ bootstrap へ進み、recovery failure は fail-closed にする
- [ ] 旧 app が新しい DB schema を検出した場合、live DB を変更せず、現行版への更新または backup restore を案内する
- [ ] 検証成功後だけ新しい app と DB へ atomic switch し、失敗時は現行 app と live DB を維持する
- [ ] package / DB staging の検証と更新後の health check が成功するまで旧 app bundle を保持し、失敗時は現行 app、live DB、app 管理 backup を維持して rollback する
- [ ] 新版の初回起動と health check 成功後にだけ旧 app bundle を削除する
- [ ] DB / bundle rollback と restore の成功後、terminal rollback state の記録前に、managed root / safe-tree 検証付きで対象 failed bundle marker を削除する。cleanup failure 時は `RollbackPending` と typed failure を保持する
- [ ] `RestartHealthCheck` の `HealthPending` / `BundleSwitching` / `BundleSwitched` / `CleanupPending` / `RollbackPending` checkpoint を再起動後も保持し、failure / interruption 後に staged migration を自動再実行しない。rollback / restore 成功時は `Available + failure + pending candidate` へ遷移し、失敗時は `RollbackPending` と typed failure を保持する
- [ ] candidate/current の path、bundle identity、version、architecture を検証し、candidate health に app bundle root ではなく `Contents/Resources/runtime` を渡す。apply 直前に署名済み archive と extracted candidate tree の全 entry（bytes、type、mode、size、追加・欠落、safe internal symlink target）を照合する
- [ ] archive extraction と recovery の symlink policy が一致し、相対 target、bundle root 内、存在する終端、cycle なし、`MAX_SYMLINK_HOPS` 内の internal symlink だけを許可する
- [ ] absolute path、backslash、control byte、空 component、`.`、bundle root 外 traversal、dangling、cycle、hop 超過、special file を recovery が typed error で fail closed にし、current app と live DB を変更しない
- [ ] switch / rollback の temporary copy が安全な internal symlink を target string のまま再作成し、target file の内容を辿らず、cleanup が link 自体だけを unlink する
- [ ] app 管理 safety backup の retention policy の細則を、この契約やシナリオで未承認のまま固定していない
- [ ] 定期・日次・通常起動時・データ変更時の自動 backup を Desktop Alpha の必須挙動として実装していない

### 4. Backup / restore / 完全なデータ削除

外部 SQLite export は新規 destination への create-only / no-replace とする。既存 regular file は native selection 境界で `destination-exists` として拒否し、別名保存を案内する。`replaceExisting` / `allowReplaceExisting` permission と通常の既存 destination への rename publish は提供しない。focused tests 17/17 と再レビュー `APPROVE` を証跡とする。

Desktop Alpha の Data and Backup（native file-dialog / typed bridge、手動 plaintext SQLite export、managed backup catalog、managed / external restore、pending restore と明示 resume、complete data deletion、Settings UI）は static / disposable test 済みとして扱う。外部 SQLite export は create-only / no-replace とし、既存 destination は `destination-exists` で拒否して別名保存を案内する。managed restore については、exact normal artifact と disposable data に限定した packaged GUI PASS として、Notebook / Cue / Tag / CanvasDocumentV1 / searchText の再起動後 read-back、SQLite integrity、`recoveryOnly=true` safety backup の保持と通常一覧からの除外を確認済みである。これは任意の実ユーザー環境や Desktop Alpha 全体の受け入れ完了を意味しない。packaged managed restore では same-origin error は再現しなかったが、WebView 内部 bridge / Network panel の直接確認や一般的な解消を示す証拠ではない。実 provider / package runtime、update apply、health / bundle switch / rollback / cleanup、DMG は未完了のまま残す。現行 MVP の `/backup` と `GET/POST /api/backups` は維持する。

既知の backup API error では安全な preflight を有限回だけ行い、GET は一回だけ再試行する。POST は重複作成を避けるため自動再送しない。Web bridge は `unsupported-web` を返し、raw path / exception を画面へ渡さない。これらは focused static / disposable test の PASS であり、packaged macOS GUI、sidecar 実 runtime、browser / DB read-back の acceptance ではない。

- [ ] Data and Backup で、手動 SQLite export、app 管理 backup からの復元、外部 backup file からの復元を別操作として表示する
- [ ] 手動 export はユーザーが保存先を選ぶ平文 SQLite で、app 管理 backup の retention policy を適用しない
- [ ] 2 つの restore 入口が staging validation、明示確認、atomic switch、restart の同じ pipeline を使う
- [ ] restore の開始前に現在の live DB を app 管理 safety backup として保存する
- [ ] restore 前に作成する `restore-<operationId>.sqlite.bak` 等の safety backup は managed catalog metadata の `recoveryOnly=true` で内部 recovery / rollback 用に保持し、startup recovery と recovery availability から利用できる
- [ ] Settings の通常復元一覧は `recoveryOnly=true` を表示・選択せず、残った user backup の最新 1 件だけを表示・選択する
- [ ] restore file の SQLite integrity、foreign key、schema / migration compatibility、必須データ、全 `CanvasDocumentV1`、切替後 reopen を検証する
- [ ] schema、integrity、semantic validation、reopen のいずれかに失敗した file を適用せず、live DB を変更しない
- [ ] 古い schema の backup は staging copy に migration を古い順に適用してから復元する
- [ ] 現行 app より新しい schema の backup はその場で復元せず、compatible な更新後にユーザーの明示確認で再開する pending restore になる
- [ ] 完全なデータ削除が入力確認を要求し、live DB、app 管理 backup、設定だけを削除して初回状態へ戻る
- [ ] 完全なデータ削除が外部 SQLite export を削除せず、更新、reinstall、通常の uninstall から暗黙に実行されない

### 5. Startup failure / diagnostics / privacy

DB bootstrap、recovery-only restore、diagnostic export / local log の privacy boundary は static / disposable test 済みである。packaged macOS GUI、sidecar 実 runtime、browser / DB read-back は未検証で、static / disposable PASS を acceptance 完了とは扱わない。live SQLite の path・ファイル名・`DATABASE_URL`・schema / migration / integrity はユーザー設定にしない。

- [ ] 通常起動は DB open と schema 状態だけを確認し、全件 integrity check を毎回実行しない
- [ ] 詳細 integrity check は異常終了後、migration 後、restore 後等の必要時だけ実行する
- [ ] 初回利用で DB がない場合は新規作成し、過去の利用記録があるのに DB がない場合は空 DB を自動作成しない
- [ ] DB が破損・読み取り不能の場合は通常のノート UI を開かず、自動修復しない
- [ ] 起動不能時は診断情報を書き出して終了する操作を主とし、終了と backup 復元への案内を提供する
- [ ] backup がない場合だけ、明示確認後に空 DB で始める選択肢を提供する
- [ ] save 失敗時は編集内容と dirty 状態を保持し、保存成功扱い、自動終了、自動再起動を行わない
- [ ] 異常終了後の次回手動起動で DB open と schema 確認が成功した場合、ノート一覧と一度だけの非 blocking 通知を表示する
- [ ] 診断 bundle はユーザーの明示操作で local にだけ作成し、自動送信しない
- [ ] Application Support の local log は note data を含まず、保持期間・容量・世代整理の細則を未承認のまま固定していない
- [ ] local log と診断 bundle にノート本文、Cue、Summary、タイトル、タグ、学習元、SQLite、backup、Canvas JSON、検索文字列、token、user path、crash dump が含まれない
- [ ] 診断 bundle が error log、時刻、component、sanitized stack、app version、macOS version、CPU architecture、DB schema version の allowlist で構成される
- [ ] ノート操作は offline で、network は更新 manifest と package の取得だけに使う
- [ ] 通常のアンインストールでは live DB を削除せず、Settings の完全なデータ削除と分離している
- [ ] Settings の完全なデータ削除は明示確認後に live DB、app 管理 backup、設定だけを対象とし、外部 SQLite export を削除しない
- [ ] Developer ID / notarization は Desktop Alpha の必須条件にせず、Public Mac Release の判断へ残している
- [ ] Full Disk Access を要求せず、Application Support とユーザーが明示選択した file だけへアクセスする
- [ ] local SQLite は macOS の file permission と FileVault を前提とし、app 独自 DB encryption や専用 password / Touch ID lock を Desktop Alpha の必須条件にしていない

### 6. Canvas PNG

- [ ] 保存済み `CanvasDocumentV1.page.width` × `page.height` の用紙全体を同じ寸法で PNG 化する
- [ ] 現在の paper 背景を含める
- [ ] Canvas の用紙だけを出力し、header、sidebar、toolbar、Cue、Summary、Settings 等のアプリ UI を含めない
- [ ] 用紙外の要素部分を用紙境界で切り取り、画像を用紙外まで広げない
- [ ] legacy `bodyMode=markdown` の本文を出力対象にしない
- [ ] 初期ファイル名が `[タイトル]_[学習日].png` になる
- [ ] ファイル名の文字列を画像内へ描画しない
- [ ] 使用不可文字、同名 file、保存先、失敗時 UI、色管理は仕様 task で決定するまで固定しない
- [ ] PNG を編集用 backup、復元用正本、SQLite との双方向同期に使わない

### 7. 検索サジェスト

- [ ] 既存の tag 専用 filter を維持し、tag を検索対象 selector とサジェストに含めない
- [ ] 検索対象は単一選択で、既定値がタイトルになる
- [ ] 検索対象の基本候補がタイトル、学習元、本文、Cue、すべてになる
- [ ] 「すべて」がタイトル、学習元、本文、Cue を検索する
- [ ] サジェストはノート card ではなく、選択範囲の local data に存在する語句候補を返す
- [ ] 入力 1 文字目から最大 5 件を返し、前方一致を優先する
- [ ] 外部辞書 API、外部推論、telemetry を使わない
- [ ] debounce は 10,000 件の実測で必要な場合だけ導入する
- [ ] Summary の検索対象分類、tokenization、同順位、API / index を仕様 task で決定するまで固定しない

### 8. 10,000 件一覧

- [ ] 5,000 件を長期利用の最低目標とし、利用上限として扱わない
- [ ] deterministic な 10,000 note fixture と固定 seed を使い、生成条件と fixture identifier を証跡に残す
- [ ] 10,000 件で一覧表示、検索、詳細遷移、編集・保存、メモリを測定する
- [ ] 一覧が全件を一度に取得・描画せず、下端付近で次のまとまりを読む追加読み込み型の無限スクロールになる
- [ ] virtualization または同等の windowing で、長時間スクロール後の DOM 要素数とメモリ増加を制限する
- [ ] 取得単位、cursor / offset、仮想化方式、事前読み込み距離を実測後に決める
- [ ] 後続仕様 task の承認前に、現行 MVP の検索 API と 1 ページ 50 件の契約を変更しない

### 9. 未採用候補

次の機能は現在未採用です。下記は実装チェックリストではなく、採用前の境界確認です。

- [ ] autosave、draft、version・競合処理を実装する前に、発注者が採用を承認し、明示保存との境界を更新している
- [ ] Undo / soft delete / purge を実装する前に、発注者が採用を承認し、確認付き物理削除との境界を更新している
- [ ] 専用復習タスクを実装する前に、発注者が採用を承認し、`reviewDue` と詳細画面内復習との境界を更新している
- [ ] NoteCard / Cue link / hidden / D&D を実装する前に、発注者が採用を承認し、`CanvasDocumentV1` との所有関係を決めている
- [ ] 定期 backup、暗号化 backup、タグ管理 mutation を実装する前に、発注者が採用を承認している
- [ ] PDF export は未採用のまま実装 checklist や Desktop PoC の必須条件へ追加されていない
- [ ] PDF を再検討する場合は Canvas PNG と分けた仕様、PoC、採用判断を行っている

## MVP 静的検証記録（2026-07-21）

| 検証 | 判定 | 記録 |
| --- | --- | --- |
| `npm run lint` | PASS | 終了コード 0 |
| `npx tsc --noEmit --pretty false` | PASS | 終了コード 0 |
| `npm run build` | PASS | Next.js webpack build、TypeScript、route 生成まで終了コード 0 |
| `git diff --check` | PASS | whitespace error なし |
| `npx prisma validate` | PASS | `prisma/schema.prisma` は valid |
| `npx prisma generate` | PASS | Prisma Client v7.8.0 生成。リポジトリ内生成物の追加・変更なし |
| Canvas / date 境界の純粋関数実行 | PASS | default 1200×800、320 / 4000 px 境界、319 / 4001 px・小数拒否、text 要素からの `searchText`、page resize 後の geometry / points / style / text 不変、`2026-01-31` → `2026-02-07`、`2026-12-31` → `2027-01-07` を確認 |

### Notes API runtime 検証記録（2026-07-21）

権限昇格後に `npm run dev -- --hostname 127.0.0.1 --port 3107` の server listen に成功した。一意な QA note を使い、既存 DB を壊さず実リクエストを確認した。API runtime の判定は次のとおり。

| リクエスト | status | 確認結果 |
| --- | --- | --- |
| `GET /api/notes` | 200 | 一覧取得 |
| `GET /api/tags` | 200 | タグ取得 |
| `GET /api/backups` | 200 | バックアップ一覧取得 |
| `POST /api/notes` | 201 | QA note 作成 |
| `GET /api/notes/:id` | 200 | Canvas の page と text を復元 |
| `PATCH /api/notes/:id` | 200 | page を `640x480` から `1920x1080` へ変更。既存 element の geometry / `style` / `text` は不変 |
| `GET /api/notes?query=API_SEARCH_TOKEN` | 200 | Canvas text の検索ヒット |
| `POST /api/notes/:id/review` | 200 | `nextReviewDate=2026-08-01` を確認 |
| `DELETE /api/notes/:id` | 204 | QA note を物理削除 |
| 削除後 `GET /api/notes/:id` | 404 | 削除済みであることを確認 |
| QA note title の cleanup 検索 | 200 | `totalCount=0`。QA データ cleanup 済み |

補足的な検証環境メモ: 初回の review API request は Turbopack の生成キャッシュ破損により 500 になったが、`.next/dev` の生成キャッシュだけを再生成して再試行した結果は PASS だった。初回 500 はアプリ API の機能 FAIL として扱わない。この 2026-07-21 記録時点では Browser runtime が `agent.browsers.list()` 空のため pointer、overlap、inline text、eraser、scroll、responsive の各 QA は未実施だった。最新の 2026-07-25 Manager fallback の判定は、上記「Canvas runtime QA 統合追補」と本マトリクスの最新行を正とする。
