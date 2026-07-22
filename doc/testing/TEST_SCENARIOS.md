# MVP テストシナリオ（1 項目 1 チェック）

## 位置づけ

このドキュメントは、Cornell Method Notebook MVP の最終検証で使う確認項目です。

MVP では、明示保存、物理削除、手動で管理する `nextReviewDate`、Cue / Summary の `textarea + Markdown preview`、中央のフリー入力 Canvas 本文、`/notes` の復習対象フィルタ、詳細画面内の復習モード、`/backup` の手動バックアップを確認対象とします。新規ノートの `nextReviewDate` は `noteDate + 7日` を初期値とし、1 日後 / 1 週間後の自動タスクや専用復習タスク画面は MVP の確認対象ではありません。

MVP の初期データに seed は使いません。検証用データは `/notes/new` または `POST /api/notes` で作成します。

`AGENTS.md` に含まれる将来仕様のうち、自動保存、Undo、PDF、専用復習タスク画面、D&D、NoteCard などは、このドキュメント末尾の「Phase 2 / 将来確認」に分離します。

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

以下の 6 項目は、既存の `CANVAS-DIMENSION-001`（用紙サイズ、保存・復元、resize 前後の要素不変）と責務を分けて確認する。コード・設計との静的照合結果は根拠欄に残すが、ブラウザ実機の pointer、touch、保存・再読込、viewport 証跡がない場合は `PASS` に繰り上げない。

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
- [ ] `/notes` で保存済みノートの Cue 件数が表示される
- [ ] `/notes` で要約未作成の状態が判別できる
- [ ] `/notes` でフリーワード検索がタイトルに対して効く
- [ ] `/notes` でフリーワード検索が本文に対して効く
- [ ] `/notes` でフリーワード検索がサマリーに対して効く
- [ ] `/notes` でフリーワード検索が Cue に対して効く
- [ ] `/notes` で From の日付フィルタが効く
- [ ] `/notes` で To の日付フィルタが効く
- [ ] `/notes` で From > To の場合に validation error が表示される
- [ ] `/notes` でタグフィルタが OR 条件で効く
- [ ] `/notes` でタグフィルタの重複追加が防止される
- [ ] `/notes` でタグ候補取得中、タグ select が追加不可状態になる
- [ ] `/notes` で復習対象フィルタを有効にすると `nextReviewDate` が今日以前のノートだけが表示される
- [ ] `/notes` で検索結果が 0 件の場合に空状態が表示される
- [ ] `/notes` で一覧取得中に loading 状態が表示される
- [ ] `/notes` で一覧取得中は検索ボタンが disabled になる
- [ ] `/notes` で一覧取得に失敗した場合に error 状態が表示される
- [ ] `/notes` でページ情報が表示される
- [ ] `/notes` でページ移動ができる
- [ ] `/notes` で 1 ページ目の前へ、最終ページの次へが disabled になる

### 4. ノート詳細

- [ ] `/notes/[id]` の閲覧モードでタイトルが表示される
- [ ] `/notes/[id]` の閲覧モードで学習日が表示される
- [ ] `/notes/[id]` の閲覧モードで学習元が表示される
- [ ] `/notes/[id]` の閲覧モードでタグが表示される
- [ ] `/notes/[id]` の閲覧モードで Cue リストが表示される
- [ ] `/notes/[id]` の閲覧モードで `bodyMode=canvas` の Canvas 本文が表示される
- [ ] `/notes/[id]` の閲覧モードで `bodyMode=markdown` の既存ノートは本文 Markdown が表示される
- [ ] `/notes/[id]` の閲覧モードでサマリー Markdown が表示される
- [ ] `/notes/[id]` の閲覧モードから編集モードへ切り替えられる
- [ ] `/notes/[id]` の編集モードで既存ノートの title、Cue、Summary、Canvas または既存 Markdown 本文、用紙サイズが反映される
- [ ] `/notes/[id]` の編集モードで `nextReviewDate` 未設定の既存ノートを開いても、編集開始だけでは日付が自動補完されない
- [ ] `/notes/[id]` の編集モードで `noteDate` を変更しても、手動設定済みの `nextReviewDate` が自動移動しない
- [ ] `/notes/[id]` の編集モードで保存すると `PATCH /api/notes/:id` が成功する
- [ ] `/notes/[id]` の編集モードで保存中は保存ボタンが disabled になり `保存中...` が表示される
- [ ] `/notes/[id]` の編集モードで保存 API が失敗した場合、フォーム上部に error alert が表示される
- [ ] `/notes/[id]` の編集保存後に閲覧モードへ戻る
- [ ] `/notes/[id]` の編集モードでキャンセルすると保存せず閲覧モードへ戻る
- [ ] `/notes/[id]` の閲覧モードから復習モードへ切り替えられる
- [ ] `/notes/[id]` の復習モードでは本文が初期状態で非表示になる
- [ ] `/notes/[id]` の復習モードでは Summary が初期状態で非表示になる
- [ ] `/notes/[id]` の復習モードで Cue を見て想起し、本文を確認した後に Summary を開ける
- [ ] `/notes/[id]` の復習モードで本文を表示できる
- [ ] `/notes/[id]` の復習モードで表示した本文を再度非表示にできる
- [ ] `/notes/[id]` の復習モードで復習済みにすると `POST /api/notes/:id/review` が成功する
- [ ] `/notes/[id]` の復習済み更新中はボタンが disabled になり `更新中...` が表示される
- [ ] `/notes/[id]` の復習済み更新に失敗した場合に error 状態が表示される
- [ ] `/notes/[id]` の復習済み更新で `reviewedAt` が更新される
- [ ] `/notes/[id]` の復習済み更新で任意の `nextReviewDate` が保存される
- [ ] `/notes/[id]` の復習済み更新で `nextReviewDate` を空にできる
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

以下は `/notes/new` と `/notes/[id]` の編集モードに共通するレイアウトの受け入れ条件です。各項目は指定 viewport で確認し、今回の文書追加では実ブラウザでの実施結果を記録しません。

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

- [ ] 375px / 768px 前後でレイアウト変更後も Cue / Summary の Markdown Preview の checkbox が表示専用のままで、クリックしても入力値を変更しない
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
- [ ] `GET /api/notes` が `tag` を受け取り OR 条件で一覧を絞り込む
- [ ] `GET /api/notes` が `reviewDue=true` を受け取り復習対象を返す
- [ ] `GET /api/notes` が `page`, `totalPages`, `totalCount`, `data` を返す
- [ ] `POST /api/notes` が Notebook を作成する
- [ ] `POST /api/notes` が `bodyMode=canvas` と `CanvasDocumentV1` を保存する
- [ ] `POST /api/notes` が Canvas の `searchText` を text 要素から生成する
- [ ] `POST /api/notes` が Cue を作成する
- [ ] `POST /api/notes` が未登録 Tag を作成する
- [ ] `POST /api/notes` が NotebookTag を作成する
- [ ] `GET /api/notes/:id` がノート詳細を返す
- [ ] `GET /api/notes/:id` が保存済み `bodyMode` と Canvas document の page 寸法・要素を返す
- [ ] `PATCH /api/notes/:id` が Notebook を更新する
- [ ] `PATCH /api/notes/:id` が Canvas の page.width / page.height だけを変更して保存できる
- [ ] `PATCH /api/notes/:id` が page 寸法変更時に要素の x / y / width / height / points / style を変更しない
- [ ] `PATCH /api/notes/:id` が Cue をリクエスト内容で全置換する
- [ ] `PATCH /api/notes/:id` が Tag 関連をリクエスト内容で全置換する
- [ ] `DELETE /api/notes/:id` がノートを物理削除する
- [ ] `POST /api/notes/:id/review` が `reviewedAt` を現在時刻で更新する
- [ ] `POST /api/notes/:id/review` が `nextReviewDate` を任意の日付または null で更新する
- [ ] `GET /api/tags` がタグ候補一覧を返す
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
- [ ] `GET /api/notes/:id` / `PATCH /api/notes/:id` / `DELETE /api/notes/:id` / `POST /api/notes/:id/review` が存在しない ID に 404 `not_found` / `message: "ノートが見つかりません"` を返す
- [ ] `POST /api/notes/:id/review` で不正な `nextReviewDate` が `invalid_body` と `field: "nextReviewDate"` を返す
- [ ] `GET /api/tags` でタグ 0 件の場合も 200 と `[]` を返す
- [ ] `GET /api/backups` でバックアップ 0 件の場合も 200 と `{ backups: [] }` を返す
- [ ] `POST /api/backups` で DB ファイル不在や `DATABASE_URL` 不正の場合は 500 `server_error` を返す

- [ ] Canvas 用紙サイズの変更は `NotebookCanvas.documentJson` の JSON 更新で完結し、用紙寸法のためだけに Prisma schema / migration が増えていないことを静的に確認する

### 7. Markdown / Security

- [ ] Markdown preview で見出しが表示される
- [ ] Markdown preview で箇条書きが表示される
- [ ] Markdown preview でリンクが表示される
- [ ] Markdown preview でコードブロックが表示される
- [ ] Markdown preview で GFM checkbox が表示される
- [ ] Markdown preview の checkbox は preview 上でクリックしても保存値を変更しない
- [ ] Markdown preview に危険な HTML を入力しても sanitize される
- [ ] 閲覧モードの Markdown 表示にも sanitize が効く
- [ ] 復習モードで本文と Summary を開いた後の Markdown 表示にも sanitize が効く

### Canvas runtime QA 記録（2026-07-21）

Canvas のブラウザ実機 QA は、API runtime 検証とは分離して `未実施` のままとした。権限昇格後は local server の listen に成功したが、Browser backend は利用できず、静的 source / docs の確認結果も runtime の PASS 根拠にはしていない。

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

in-app Browser で `http://localhost:3000` を操作し、2026-07-21 に未実施だった範囲の一部を継続した。fixture は `Canvas Browser QA 2026-07-22 2030`（ID `cmrvzkjpa0000mtrm7pgwm1xb`）として保持し、後続 QA で重ね描き、消しゴム、Undo / Redo、未確認 viewport を続けられる状態にした。

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
- `CANVAS-TOOLBAR-STYLE-001`: `FAIL（部分実施）`。実効約1265pxで drawing rail collapse を確認。1440pxの局所横 scroll / page overflow は確認したが、375 / 768px、touch、全 keyboard / focus は未確認。

## 受け入れ証跡マトリクス

上のチェックリストは確認項目の一覧であり、下表を確認済み範囲の正本とします。判定は記録単位の範囲に限ります。同じ section に含まれる未確認項目を、別の項目の PASS から推測して繰り上げません。`FAIL（静的照合）` は実装コードと現行 MVP 契約の照合で未達が確認されたもの、`未実施` は runtime 証跡がまだないものです。

| ID | 対象シナリオ | route と画面状態 | viewport / 実行形態 | 確認日 | fixture / 検証用データの扱い | 判定 | 参照 summary / 根拠ファイル |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MVP-UI-001 | 主要 UI フロー（redirect、一覧、作成、タグ、編集保存、復習、検索、削除、バックアップ） | `/` → `/notes`（redirect / 一覧）、`/notes/new`（作成）、`/notes/[id]`（閲覧・編集・復習・削除）、`/backup`（一覧・作成） | Playwright Chromium runtime。viewport は summary に記録なし | 2026-07-05 | UI 検証用の一時ノート、既存タグ候補、新規タグを作成。API / SQLite cleanup 後に query `UI検証` の `totalCount=0`、一時タグ 0 件を確認 | PASS | `summary/20260705/mvp-ui-flow-reverification-report.md` |
| MVP-API-001 | Notes CRUD、review、一覧検索、タグ、validation、not found、backup API | `/api/notes`、`/api/notes/:id`、`/api/notes/:id/review`、`/api/tags`、`/api/backups` | API / CLI runtime（`127.0.0.1:3000`）。viewport は対象外 | 2026-07-05 | `dev.db` に API 検証用ノート / タグを作成し、API 削除と SQLite cleanup。検証タグ 0 件を確認。backup 最新 3 世代は検証結果として保持 | PASS | `summary/20260705/manager-mvp-api-crud-validation-backup-reverification-report.md` |
| MVP-MD-001 | GFM checkbox、Preview checkbox の表示専用挙動、閲覧 / 復習時の sanitize | `/notes/new`（編集 preview）、`/notes/[id]`（閲覧・復習） | Playwright Chromium runtime。viewport は summary に記録なし | 2026-07-05 | `MD検証` 接頭辞の一時ノートに危険な Markdown と checkbox を入力。確認後に API cleanup し残存 0 件を確認 | PASS | `summary/20260705/manager-markdown-sanitize-checkbox-verification-report.md` |
| MVP-BAK-001 | `npm run backup:copy` と最新 3 世代保持 | CLI / SQLite backup | CLI runtime。viewport は対象外 | 2026-07-05 | root の SQLite DB を 4 回コピー。古い世代を prune し、`backup/` に最新 3 ファイルだけが残ることを確認 | PASS | `summary/20260705/backup-copy-command-verification-report.md` |
| MVP-TOOL-001 | lint、build | 静的 / CLI 検証 | CLI | 2026-07-04〜2026-07-05 | runtime fixture なし。コード変更後の検証コマンドを実行 | PASS | `summary/20260705/manager-fix-ui009-note-editor-tag-candidates-summary.md`、`summary/20260705/manager-fix-ui014-edit-save-state-summary.md` |
| NTE020-NEW-375 | Policy C の新規作成レイアウト、ページ全体 overflow、Cornell 局所横スクロール、Cue / Markdown Preview 操作 | `/notes/new`（新規作成） | 375px、Puppeteer / headless Chromium runtime | 2026-07-14 | 空 DB、保存済みノート 0 件。保存・削除・API 更新なし。リポジトリ内 screenshot は新規作成画面の記録 | PASS | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`doc/assets/screenshots/nte020-policy-c-new-375.png` |
| NTE020-NEW-768 | Policy C の新規作成レイアウト、Cornell 2 列、ページ全体 overflow | `/notes/new`（新規作成） | 768px、Puppeteer / headless Chromium runtime | 2026-07-14 | 空 DB、保存・削除・API 更新なし | PASS | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`doc/assets/screenshots/nte020-policy-c-new-768.png` |
| NTE020-NEW-1280 | Policy C の desktop split、Cue / Note 約 30% / 70%、本文 textarea / Preview 横並び | `/notes/new`（新規作成） | 1280px、Puppeteer / headless Chromium runtime | 2026-07-14 | 空 DB、保存・削除・API 更新なし | PASS | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`doc/assets/screenshots/nte020-policy-c-new-1280.png` |
| NTE020-NEW-1440 | Policy C の desktop split、Cue / Note 約 30% / 70%、本文 textarea / Preview 横並び | `/notes/new`（新規作成） | 1440px、Puppeteer / headless Chromium runtime | 2026-07-14 | 空 DB、保存・削除・API 更新なし | PASS | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`doc/assets/screenshots/nte020-policy-c-new-1440.png` |
| NTE020-EDIT-ALL | Policy C の既存ノート edit runtime | `/notes/[id]`（編集） | 375 / 768 / 1280 / 1440px。いずれも未確認 | 2026-07-14 | 空 DBで保存済みノート 0 件。既存ノートを開かず、保存・削除・API 更新なし | 未実施 | `summary/20260714/nte020-policy-c-layout-qa-report.md`、`HANDOFF_2026-07-16.md` §4「未実施のまま残した範囲」 |
| NTE020-OVERFLOW-375 | 長い Markdown、長いタグ、長い field error の overflow 境界 | `/notes/new` と共有 edit layout | 375px。対象入力の runtime 未確認 | 2026-07-14 | 長い Markdown / 長いタグ / 長い field error は測定に投入していない | 未実施 | `summary/20260714/nte020-policy-c-layout-qa-report.md` § Findings / Remaining Unknowns |
| NTE030-VIEW-1440 | 閲覧の共通詳細シェル、概要 → Cornell → Summary の順序、本文表示 | `/notes/[id]`（閲覧） | 1440px、Puppeteer / headless Chromium runtime | 2026-07-15 | 一時ノート `QA-SCREENSHOT-NTE030-1784048555522` を作成し、確認後に削除。query で残存 0 件を確認 | PASS | `HANDOFF_2026-07-16.md` §4「PASS として記録された範囲」、`summary/20260715/0217-create-handoff-20260715-nte020-nte030-4ee10290-summary.md`、`doc/assets/screenshots/runtime-note-detail-view-1440.png` |
| NTE030-REVIEW-1440 | 復習の共通詳細シェル、本文初期マスク、本文表示 / 再マスク、復習操作 | `/notes/[id]`（復習） | 1440px、Puppeteer / headless Chromium runtime | 2026-07-15 | 一時ノート `QA-SCREENSHOT-NTE030-1784048555522` を作成し、確認後に削除。query で残存 0 件を確認 | PASS | `HANDOFF_2026-07-16.md` §4「PASS として記録された範囲」、`summary/20260715/0217-create-handoff-20260715-nte020-nte030-4ee10290-summary.md`、`doc/assets/screenshots/runtime-note-detail-review-1440.png` |
| NTE030-MOBILE-375-768 | 閲覧 / 復習の共通シェルと本文マスクの mobile runtime | `/notes/[id]`（閲覧・復習） | 375 / 768px。いずれも未確認 | 2026-07-15 | mobile runtime 用の確認・fixture は未実施 | 未実施 | `HANDOFF_2026-07-16.md` §4「未実施のまま残した範囲」、`summary/20260715/0155-qa-nte030-review-shared-shell-puppeteer-network-blocked-summary.md` |
| MVP-REVIEW-EDGE-001 | 既存未設定 `nextReviewDate` の非補完、`noteDate` 変更時の手動設定日維持、review 成功後の画面反映 | `/notes/[id]`（編集・復習） | runtime viewport は summary に記録なし | 2026-07-16 | 該当 edge case fixture を使った実ブラウザ確認なし | 未実施 | `doc/implementation/IMPLEMENTATION_STATUS.md` §5.2、`doc/implementation/MVP_CONTRACT.md` §4.1・§4.3 |
| MVP-GAP-001（2026-07-16時点の履歴） | 新規 `nextReviewDate = noteDate + 7日` 初期値 | `/notes/new`（新規作成） | 静的照合（viewport / fixture なし） | 2026-07-16 | 当時の実装コード、現行 MVP 契約、実装状況を照合した履歴 | FAIL（静的照合・当時の判定） | `doc/implementation/IMPLEMENTATION_STATUS.md` §1・§5.2、`doc/implementation/MVP_CONTRACT.md` §4.1 |
| MVP-REVIEW-DEFAULT-001 | 新規フォームの `nextReviewDate = noteDate + 7日` 初期値、月末・年末跨ぎ、既存ノートの未設定値非補完、明示値保持 | `/notes/new`、`/notes/[id]`（編集） | 静的コード確認（runtime 未実施、viewport / fixture なし） | 2026-07-21 | `addDaysToDateString` の `2026-01-31` → `2026-02-07`、`2026-12-31` → `2027-01-07` の境界を確認。ブラウザ入力・保存・再読込の runtime 証跡は未取得 | 静的実装確認済み（runtime 未実施） | `summary/20260721/1940-implement-new-note-review-date-default-20260721-24f5f31b-summary.md`、`src/modules/notes/model/note-editor-form.ts`、`src/shared/date/date-only.ts`、`doc/implementation/MVP_CONTRACT.md` §4.1 |
| MVP-GAP-002 | 復習開始時の Summary 初期非表示と Cue → 本文 → Summary の順序 | `/notes/[id]`（復習） | 静的照合（viewport / fixture なし） | 2026-07-16 | fixture なし。実装コード、現行 MVP 契約、実装状況を照合。runtime 未実施とは別に、Summary 初期非表示の未達を記録 | FAIL（静的照合） | `doc/implementation/IMPLEMENTATION_STATUS.md` §1・§5.2、`doc/implementation/MVP_CONTRACT.md` §4.3・§6 |
| MVP-GAP-003 | 概要の Markdown preview / sanitize | `/notes/new`、`/notes/[id]`（編集・閲覧） | 静的照合（viewport / fixture なし） | 2026-07-16 | fixture なし。概要の保存は確認できるが、本文 / Summary と同じ Markdown preview / sanitize ではない | FAIL（静的照合） | `doc/implementation/IMPLEMENTATION_STATUS.md` §1・§5.2、`doc/implementation/MVP_CONTRACT.md` §2・§6 |
| CANVAS-DIMENSION-001 | Canvas の既定 1200x800、320〜4000px の整数入力、保存後復元、resize 前後の要素データ不変、表示倍率との分離 | `/notes/new`、`/notes/[id]`（編集・閲覧・復習）、`/api/notes` | Browser runtime 未確認。API runtime の一部は別途 PASS | 2026-07-18 | Browser UI の入力・保存・再読込は未実施。API の `640x480` → `1920x1080` resize、既存 element の geometry / `style` / `text` 不変は 2026-07-21 に別記録で確認 | 未実施 | `doc/implementation/MVP_CONTRACT.md` §6.1、`src/shared/canvas/canvas-document.ts`、`doc/implementation/IMPLEMENTATION_STATUS.md` §5.1・§5.3、本文書の「Notes API runtime 検証記録（2026-07-21）」 |
| CANVAS-INTERACTION-001 | 空白および既存の pen stroke、line、arrow、rect、ellipse、standalone text 上からの新規作成、preview / inline editor overlay / metadata 欠落 object の gesture 遮断 | `/notes/new`、`/notes/[id]`（編集） | ブラウザ runtime（予定 viewport 1280px、pointer / touch。未実施） | 2026-07-19 | fixture 未作成。後続 QA で空白と 6 種類の基準要素を用意する。今回は操作・保存・比較・overlay 境界の runtime 証跡なし | 未実施 | `summary/20260719/2143-sync-canvas-interaction-design-contract-20260719-5b6bd3a6-summary.md`、`summary/20260719/2153-sync-canvas-implementation-status-20260719-7ac6f95e-summary.md`、`HANDOFF_2026-07-22.md` §4.3、`doc/implementation/MVP_CONTRACT.md` §6.2、`src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`、`src/modules/notes/lib/canvas-editor-document.ts` |
| CANVAS-GESTURE-001 | line / arrow / rect / ellipse のクリック・ダブルクリック no-op、4px drag threshold、standalone text・shape inline text・shape drag の gesture 分離 | `/notes/new`、`/notes/[id]`（編集） | ブラウザ runtime（予定 viewport 1280px、pointer。未実施） | 2026-07-19 | fixture 未作成。3px 未満と 5px 以上の比較、要素数・geometry の記録は後続 QA で行う。今回は runtime 証跡なし | 未実施 | `summary/20260719/2143-sync-canvas-interaction-design-contract-20260719-5b6bd3a6-summary.md`、`HANDOFF_2026-07-22.md` §4.3、`doc/designs/CANVAS_TOOLBAR_DESIGN.md` §9.2、`src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`、`src/modules/notes/lib/canvas-editor-geometry.ts` |
| CANVAS-SHAPE-TEXT-001 | rect / ellipse の図形内文字 inline editor、外形と文字の表示、確定・キャンセル、他要素保持、Fabric lifecycle error 無し、配置の即時反映 | `/notes/new`、`/notes/[id]`（編集） | ブラウザ runtime（予定 viewport 1280px、pointer / keyboard。未実施） | 2026-07-19 | fixture 未作成。pen stroke、line、arrow、別図形、standalone text を含む基準 document は後続 QA で作成する。console / error 証跡なし | 未実施 | `summary/20260719/2143-sync-canvas-interaction-design-contract-20260719-5b6bd3a6-summary.md`、`HANDOFF_2026-07-22.md` §4.3、`doc/implementation/MVP_CONTRACT.md` §6.2、`src/modules/notes/ui/hooks/shape-text-editor-session.ts`、`src/shared/canvas/adapters/fabric/fabric-shape-factory.ts` |
| CANVAS-STYLE-001 | 線幅・文字サイズの既定値と整数範囲、無効値拒否、stroke / text の色、standalone text / shape inline text の left・center・right、選択中・編集中の即時反映 | `/notes/new`、`/notes/[id]`（編集） | ブラウザ runtime（予定 viewport 1280px、pointer / keyboard。未実施） | 2026-07-19 | fixture 未作成。境界値・無効値、stroke / standalone text / shape inline text の対象別確認は後続 QA で行う。今回は runtime 証跡なし | 未実施 | `summary/20260719/2153-sync-canvas-implementation-status-20260719-7ac6f95e-summary.md`、`HANDOFF_2026-07-22.md` §4.3、`doc/implementation/MVP_CONTRACT.md` §6.2、`doc/implementation/IMPLEMENTATION_STATUS.md` §5.1、`src/modules/notes/ui/components/note-canvas-toolbar-style-controls.tsx`、`src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`、`src/shared/canvas/adapters/fabric/fabric-style.ts` |
| CANVAS-PERSISTENCE-STYLE-001 | standalone text の `style`、shape inline text の `textStyle`、線幅・線色の保存境界、保存・再読込、用紙だけ変更した場合の style / text / geometry / searchText 不変 | `/notes/new`、`/notes/[id]`（編集・閲覧）、`/api/notes` | Browser runtime + Notes API response / 再読込（Browser UI 未実施） | 2026-07-19 | API の `GET /api/notes/:id`、page 寸法変更前後の geometry / `style` / `text`、Canvas text 検索は 2026-07-21 に確認。Browser UI の明示保存・再読込、standalone text / shape inline text の完全な `style` / `textStyle` 比較は未実施 | 未実施 | `summary/20260719/2153-sync-canvas-implementation-status-20260719-7ac6f95e-summary.md`、`HANDOFF_2026-07-22.md` §4.1・§4.3、`doc/implementation/MVP_CONTRACT.md` §6.1・§6.2、`doc/implementation/IMPLEMENTATION_STATUS.md` §5.1・§5.3、本文書の「Notes API runtime 検証記録（2026-07-21）」、`src/modules/notes/ui/components/note-canvas-editor.tsx`、`src/shared/canvas/adapters/fabric/fabric-canvas-to-document.ts`、`src/server/notes/infrastructure/canvas.persistence.ts` |
| CANVAS-TOOLBAR-STYLE-001 | style input、alignment button、用紙入力、tool group の responsive / keyboard / touch 到達性、active・style target・alignment の visual / ARIA 状態、ページ縦 scroll と用紙局所横 scroll | `/notes/new`、`/notes/[id]`（編集） | ブラウザ runtime（375 / 768 / 1280 / 1440px、keyboard / touch。未実施） | 2026-07-19 | fixture 未作成。全 viewport の focus、ARIA、pointer 後の Summary / footer 到達、page-wide overflow の測定は後続 QA で行う。今回は screenshot / runtime metrics なし | 未実施 | `summary/20260719/2143-sync-canvas-interaction-design-contract-20260719-5b6bd3a6-summary.md`、`HANDOFF_2026-07-22.md` §4.3、`doc/designs/CANVAS_TOOLBAR_DESIGN.md` §6・§9.3、`doc/implementation/IMPLEMENTATION_STATUS.md` §5.3、`src/modules/notes/ui/components/note-canvas-toolbar.tsx`、`src/modules/notes/ui/components/note-canvas-toolbar-paper-controls.tsx` |
| PHASE2-BOUNDARY | 自動保存、Undo / soft delete、専用復習タスク、NoteCard / D&D、PDF、タグ管理 UI 等 | `/tasks/review`、`/notes/backup`、export 等（MVP 外） | 静的な契約照合。runtime 対象外 | 2026-07-16 | fixture なし。Phase 2 の未実施項目として扱い、MVP の PASS 集計には含めない | 未実施 | `doc/implementation/MVP_CONTRACT.md` §2・§9、本文書「Phase 2 / 将来確認」 |

注記: 2026-07-18 の概要項目削除より前に実施した `NTE030-VIEW-1440`、`MVP-GAP-002`、`MVP-GAP-003` は、当時の画面・契約に対する履歴記録です。現在の受け入れ対象には含めず、過去の確認結果・未達理由を改変せずに保持します。

NTE-020 の `summary/20260714/2205-document-nte020-policy-c-responsive-acceptance-scenarios-3f7ff466-summary.md` と `summary/20260714/2319-document-nte020-policy-c-runtime-screenshots-3b94ae94-summary.md` は、受け入れ観点・screenshot task の記録です。実画面の判定は `summary/20260714/nte020-policy-c-layout-qa-report.md` と存在確認済みの PNG を根拠にし、edit runtime や長文 overflow を推測で PASS にしていません。

NTE-030 の `summary/20260715/0107-implement-nte030-review-shared-detail-shell-e125e816-summary.md` は実装 task、`summary/20260715/0112-qa-nte030-review-shared-shell-runtime-screenshots-f2358087-summary.md` と `summary/20260715/0206-document-nte030-runtime-screenshot-evidence-fcffd017-summary.md` は task / documentation 記録です。`summary/20260715/0155-qa-nte030-review-shared-shell-puppeteer-network-blocked-summary.md` は接続制約による失敗記録であり、これらの `done` 状態だけを runtime PASS の根拠にはしません。1440px の PASS は、直接確認内容を記した `HANDOFF_2026-07-16.md` と実在する screenshot を根拠にしています。

## Phase 2 / 将来確認

以下は MVP 外です。MVP の必須受け入れ条件としては扱わず、Phase 2 以降の実装時に確認します。

専用の復習タスク画面、1 日後 / 1 週間後の自動タスク、`review status`、未完了タスクバッジは、この節だけで扱います。現行 MVP の確認項目（`nextReviewDate` の手動管理、`reviewedAt` の更新、詳細画面内復習）とは混同しません。

### 1. 自動保存 / 下書き / 競合制御

- [ ] 3 秒アイドルでドラフト自動保存が走る
- [ ] 連続ドラフト保存が最短 6 秒間隔に抑制される
- [ ] 確定保存後にドラフトステータスがリセットされる
- [ ] 409 競合時にバナーで再読み込みを促す
- [ ] 409 競合時に自動保存が停止する
- [ ] 自動保存失敗時にバナーが表示される
- [ ] 自動保存失敗時に手動「再試行」ボタンだけが表示される
- [ ] オフライン時に自動保存失敗バナーが表示される
- [ ] 作成時にドラフトレコードが初期化される
- [ ] 起動時バッチで 30 日超のドラフトがクリーンアップされる

### 2. Undo / Soft Delete

- [ ] 削除後の Undo Snackbar が 5 秒表示される
- [ ] Undo Snackbar から削除済みノートを復元できる
- [ ] `POST /api/undo` で Undo 期限内の対象を復元できる
- [ ] `SoftDeleteBuffer` に削除対象が記録される
- [ ] Undo 期限切れ後にソフトデリート済みデータが物理削除される

### 3. PDF Export

- [ ] `/notes` で日付範囲指定し PDF 出力を実行できる
- [ ] PDF 出力が `GET /api/notes/export?from&to` を使う
- [ ] PDF が 1 ノート 1 ページでダウンロードされる
- [ ] 期間未指定または不正範囲のとき PDF 出力ボタンが無効化される
- [ ] PDF 出力完了時にトーストが表示される

### 4. 専用復習タスク画面 / バッジ

- [ ] `/tasks/review` の 1 日後タブでタスクが表示される
- [ ] `/tasks/review` の 1 週間後タブでタスクが表示される
- [ ] `/tasks/review` で完了チェックすると次ステータスに遷移する
- [ ] `/tasks/review` で完了チェック後にタスクが即時消える
- [ ] グローバルナビゲーションに未完タスクバッジが表示される
- [ ] 作成時にレビュー進捗レコードが初期化される
- [ ] 作成時に 1 日後 / 7 日後のレビュー予定が保存される

### 5. D&D / Card Model

- [ ] キーワードカードを D&D で並び替えできる
- [ ] ノートカードを追加できる
- [ ] ノートカードを D&D で並び替えできる
- [ ] ノートカードの hidden flag を閲覧モードで反映できる
- [ ] ノート欄全体の一時非表示を閲覧モードで切り替えられる
- [ ] Cue と Note の関連を `NoteCueLink` に保存できる
- [ ] D&D のキーボード代替操作が用意されている
- [ ] D&D リストに必要な ARIA 属性が付与されている

### 6. タグ管理 UI

- [ ] タグ一覧で右クリックメニューから名称変更できる
- [ ] タグ一覧で右クリックメニューから削除できる
- [ ] タグ削除時に確認 UI が表示される
- [ ] タグ名称変更が既存ノートへ即時反映される

### 7. バックアップログ / Retry API

- [ ] `backup_logs` にバックアップ結果が保存される
- [ ] バックアップログを UI で確認できる
- [ ] `POST /api/backups/retry` で失敗分を再試行できる
- [ ] `/backup` でログ詳細を確認できる

### 8. 高機能 Markdown エディタ / ショートカット

- [ ] `@uiw/react-md-editor` などの高機能 Markdown エディタで入力できる
- [ ] Markdown ツールバーから装飾を挿入できる
- [ ] Cmd/Ctrl+S で確定保存できる
- [ ] Cmd/Ctrl+N でフォーカス位置に応じてカード追加できる
- [ ] Cmd/Ctrl+N でフォーカスなしの場合は無効になる
- [ ] Cmd/Ctrl+Z で取り消しが効く
- [ ] Cmd/Ctrl+Shift+Z でやり直しが効く

### 9. アクセシビリティ強化

- [ ] モーダルに必要な ARIA 属性が付与されている
- [ ] モーダルのフォーカス制御が実装されている
- [ ] 削除確認以外の確認モーダルにもフォーカストラップが効く

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

権限昇格後に `npm run dev -- --hostname 127.0.0.1 --port 3107` の server listen に成功し、既存 DB を壊さない一意な QA note を用いて実リクエストを確認した。API runtime の判定は次のとおり。

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

補足的な検証環境メモ: 初回の review API request は Turbopack の生成キャッシュ破損により 500 になったが、`.next/dev` の生成キャッシュだけを再生成して再試行した結果は PASS だった。初回 500 はアプリ API の機能 FAIL として扱わない。Browser runtime は `agent.browsers.list()` が空で未実施のため、pointer、overlap、inline text、eraser、scroll、responsive の各 QA は引き続き `未実施` とする。
