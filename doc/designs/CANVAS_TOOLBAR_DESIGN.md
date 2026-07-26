# Canvas ツールバー v2 情報設計・操作設計

作成日: 2026-07-19（JST）
状態: v2 実装済み（静的確認）／browser runtime QA 未確認
対象: Canvas 本文 toolbar の visual / information architecture と、それに結び付く操作・スタイル・用紙設定の契約

## 1. 目的と v2 の結論

本書は、Canvas 本文の操作を壊さず、draw.io から借りるべき「道具の役割が見える」「現在の状態が分かる」「設定が操作と混ざらない」という toolbar の視覚・情報設計と、toolbar から利用する操作・スタイル・用紙設定の境界を記録する。Canvas の保存形式、Fabric の座標計算、API、DB の実装詳細は対象外とし、必要な保存・復元不変条件だけを契約として参照する。v2 の markup / CSS は実装済みだが、以下の受け入れ観点は browser runtime QA の証跡ではない。

参照画像は /Users/blp542/Desktop/スクショ/スクリーンショット 2026-07-19 9.56.19.png。画像は v2 導入前の `/notes/new` 本文列を確認するための比較基準であり、現行 UI のスクリーンショットとして扱わない。

v2 の決定事項は次のとおり。

- **icon-first、短い可視ラベル併用**を採用する。アイコンを主な視覚アンカーにし、ラベルは選択、ペン、直線、矢印、四角、円、文字、消しゴム、戻す、やり直すのように短くする。
- アイコンは toolbar 内の小さな inline SVG または CSS で表現できる範囲に限定する。絵文字、Unicode 記号を実アイコンとして使うこと、新しいアイコンライブラリ依存を追加することは禁止する。
- 選択、描画、線、図形、文字、消しゴム、履歴を、同じ高さのボタン列ではなく、背景・separator・active 表現の異なる操作グループとして見せる。
- 用紙設定は描画操作の rail に入れず、強い境界を持つ独立パネルとして右端または別行に置く。用紙の幅・高さは zoom と呼ばない。
- tool の lifecycle（初期 `select`、`pen` 継続、配置 tool の配置後 `select` 遷移）、オブジェクト単位の消しゴム、CanvasDocumentV1、Canvas の client Undo / Redo、320〜4000px の用紙寸法、ページ縦 scroll と Canvas 横 scroll は維持する。
- `pen` / `line` / `arrow` / `rect` / `ellipse` / `text` は、空白だけでなく既存のアプリ所有 Canvas 要素上からも新規作成を開始できる。未知 metadata の一時 Fabric object は新規 gesture の対象にしない。
- 図形のドラッグ作成は一定の移動量を超えたときだけ開始・確定し、小さなクリック／ダブルクリックは不要な図形を作らない。`select` / `rect` / `ellipse` で対象図形をダブルクリックした場合は、図形外形を表示したまま図形内文字編集へ入る。
- 文字だけのカテゴリ見出しを横一列に並べる構成は廃止する。group 名は主に ARIA と tooltip の意味に移し、可視上は group の背景・separator とボタン内の短いラベルで役割を示す。

v2 は draw.io の全機能を再現するものではない。道具箱としての認識しやすさを高める最小変更であり、操作の追加や保存契約の拡張ではない。

## 2. v2 導入前の比較基準と現行実装の整理

### 2.0 比較基準の扱い

以下の 2.1〜2.4 は、v2 導入前の画面・source・CSS を比較基準として残した履歴である。現在の source / CSS の状態を説明する節ではない。現行の toolbar 契約は本書の §3〜§6、静的実装と browser runtime 未確認の区別は `doc/implementation/IMPLEMENTATION_STATUS.md` と `doc/testing/TEST_SCENARIOS.md` を参照する。

### 2.1 v2 導入前の画像から確認できたこと

参照画像では、ノート本文の上に「操作」「描く」「線」「図形」「文字」「消去」「履歴」「用紙サイズ」が一列で表示されている。各カテゴリは小さな日本語見出し、各操作は白い角丸のテキストボタンである。選択中の選択ボタンだけが薄い橙色と下側の marker を持つ。

画像上の違和感は、機能の不足ではなく次の構造から生じている。

- すべての操作が同じ白いボタン、同じ最小高さ、ほぼ同じ文字の太さで、選択・描画・消去・履歴の優先度が見えない。
- 見出しは小さく薄い一方、ボタンの文字は大きく、group 名より個々のラベルが目立つ。結果として見出しが操作グループの説明として機能しない。
- アイコンがないため、形状を表す四角・円、線の直線・矢印、履歴の戻す・やり直すを目でスキャンしにくい。
- group の境界は細い縦線だけで、描画 rail の中の小グループと toolbar 全体の境界が同じ強さに見える。
- 用紙サイズの幅・高さ入力と適用ボタンが、描画 tool と同じボタン列に見える。用紙の寸法設定が、描画操作または zoom の一種と誤認されやすい。
- 画面幅が広いときは横一列に詰まるが、幅が減ると何を優先して残すかが見た目から判断できない。

### 2.2 v2 導入前の source の比較基準

| 観点 | v2 導入前の確認 | 現行 v2 での整理 |
| --- | --- | --- |
| tool 定義 | `note-canvas-toolbar.tsx` の `ToolDefinition` は value、label、description を持つが icon 情報を持たない | icon key と local SVG renderer を採用し、`CanvasNoteTool` の union は変更していない |
| ボタン内容 | `renderTool` は item.label だけを表示し、アイコンを出力しない | icon を先に配置し、短い可視 label を残している |
| group | TOOL_GROUPS は operation、draw、line、shape、text、erase に分かれ、group label と role="group" がある | group の意味を維持し、見出しの平置きを背景・separator・ARIA に置き換えている |
| rail | drawing-rail は draw、line、shape、text だけを内包する。operation、erase、history、paper は rail の外にある | 描画 tool だけを横 scroll できる rail とし、erase、history、paper を rail 内へ移動しない |
| active | aria-pressed と data-active は存在し、CSS は橙色背景と下側 inset marker を使う | active はアイコン、label、marker、aria-pressed の複数で示す。色だけには依存しない |
| tooltip / 説明 | `title` と `aria-describedby` の visually hidden description はある。`title` は browser の補助表示で、touch では表示されない | desktop / tablet の hover と keyboard focus では visible tooltip を出し、可視 label と hidden description を併用している |
| 履歴 | Undo、Redo の text button があり、canUndo / canRedo により native disabled になる | アイコン＋短い label を使い、disabled と active tool state を混同させない |
| 用紙 | `type="number"` の幅・高さ、320〜4000 の min / max、Enter または適用、`aria-invalid` と `role="alert"` がある | validation と操作を維持し、独立 panel と状態表現を加えている |

### 2.3 v2 導入前の CSS の比較基準

v2 導入前の `src/app/globals.css` では、`note-canvas-toolbar` に `display:flex`、`flex-wrap:wrap`、`paper-soft` の背景、上下の border、0.6rem 前後の padding を指定していた。group は `border-inline-start` と `padding-inline-start` で区切られ、group label は 0.64rem の薄い文字だった。button は共通して `min-height: 2.75rem`、paper 背景、`paper-line` の border、同じ角丸と font-weight を持っていた。

active は paper-accent / paper-accent-deep、淡い橙背景、下側 inset marker だけで示されていた。hover、disabled、focus-visible はあったが、button の icon slot、group ごとの面、primary / secondary の密度差はなかった。

導入前の drawing rail は `overflow-x:auto` で局所横 scroll を持っていた。一方、media query は max-width:640px に集中しており、641〜1023px の tablet で group をどのように優先・折り返しするかの専用方針はなかった。paper-size は `margin-inline-start:auto` で右寄せになるが、同じ toolbar surface と同じ button 規則の中にあった。

### 2.4 v2 導入前のギャップ分析

| 観点 | v2 導入前の問題 | v2 の設計判断 |
| --- | --- | --- |
| visual hierarchy | 見出し、tool、Undo / Redo、適用が同じ横列・同じ密度で、主操作と設定の重みが揃っている | primary tool、drawing rail、secondary action、paper panel を面・余白・境界で階層化する |
| iconography | icon がなく、ラベルの文字列を読まないと形状・履歴の意味を判断できない | currentColor の inline SVG / CSS icon と短い label を併用する |
| button density | すべて min-height 2.75rem、長いラベルも同じ横幅規則で、列が詰まる | icon slot を固定し、label を一行の短語にし、group 間の余白を group 内より大きくする |
| group boundary | 薄い縦線だけで、描画の小グループと大きな責務の境界が読みにくい | group outer separator、subgroup separator、面の差を段階的に使う |
| primary / secondary | 選択、消しゴム、Undo / Redo が通常 tool と同じ重み | 選択を primary、消しゴムを安全確認が必要な distinct action、Undo / Redo を secondary、描画を rail として分ける |
| paper conflict | 幅・高さ・適用が描画 tool と同じ row の一部に見える | paper panel を二重に近い境界で分離し、用紙寸法の入力であることを構造と field label で示す |
| responsive | 640px 以下の rail はあるが、tablet の折り返しと narrow の優先順位が未定義 | desktop / tablet / narrow の行・overflow・disclosure を固定する |
| accessibility | ARIA と focus ring はあるが、visible tooltip と、色以外での active / group の見分けが不足 | label、icon、marker、aria、focus tooltip、live status を重ねる。ラベルを icon-only の奥へ隠さない |

## 3. v2 の toolbar 構造

### 3.1 Group の責務と表示

toolbar の DOM / 認知上の順序は、操作 → 描画 rail → スタイル → 消去 → 履歴 → 用紙とする。描画 rail の中だけが local horizontal scroll の対象である。

| group | controls | 可視表現 | 背景 / separator | active / disabled |
| --- | --- | --- | --- | --- |
| 操作 | 選択 | icon＋選択 | toolbar の先頭。少し広い左右 padding と強めの外周 | active は最も強い accent marker。disabled にはしない |
| 描く | ペン | icon＋ペン | drawing rail 内の先頭 subgroup | 継続 tool。選択中は marker と aria-pressed |
| 線 | 直線、矢印 | icon＋直線 / 矢印 | drawing rail 内で subgroup separator | 片方だけ active。2 ボタンを一つの選択にまとめない |
| 図形 | 四角、円 | icon＋四角 / 円 | drawing rail 内で subgroup separator | 片方だけ active |
| 文字 | テキスト | icon＋文字 | drawing rail 内の末尾 subgroup | active は text tool だけに付ける |
| スタイル | 線幅、色、文字サイズ、文字配置 | field label、px、color input、alignment icon | drawing rail の外。選択対象に応じて有効／無効を示す独立 surface | active tool は持たない。対象なし・対象外では controls を disabled にする |
| 消去 | 消しゴム | eraser icon＋消しゴム | rail の外。通常 tool とは異なる淡い danger tint または強い境界 | active は danger marker。触れた要素を object 単位で消去することを説明 |
| 履歴 | Undo、Redo | undo / redo icon＋戻す / やり直す | rail の外。secondary surface | native disabled。active tool の aria-pressed は持たない |
| 用紙 | 幅、高さ、適用 | 用紙 panel、field label、px、適用 | 描画操作から強い separator で分離。desktop は独立した下段、狭幅は disclosure | active state は持たない。invalid は field と error で示す |

group 名は role="group" の aria-label と tooltip の説明に残す。現在のように「操作」「描く」「線」などの見出しを全 group のボタン横へ一列で表示しない。可視 label は各ボタンに残るため、group 名を視覚的に隠しても操作名が失われるわけではない。

### 3.2 実装 wireframe

下記の SVG:pointer などは実装時の icon slot 名を表す記号であり、絵文字や Unicode 記号を実アイコンにする提案ではない。各 button は icon を先に、短い label を後に置く。

Desktop（広い本文列、paper は独立した下段）:

    ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
    │ [SVG:pointer 選択] │ [SVG:pencil ペン] [SVG:line 直線] │ [SVG:arrow 矢印] │ [SVG:rect 四角] [SVG:circle 円] │ [線幅] [色] [文字サイズ] [配置] │
    │                    │ [描画 rail: local horizontal scroll if needed]                                  │
    │                    │ [SVG:T 文字] │ [SVG:eraser 消しゴム] │ [SVG:undo 戻す] [SVG:redo やり直す] ║       │
    │                    ║ 用紙  [幅 1200 px] [高さ 800 px] [適用]                                  │
    └──────────────────────────────────────────────────────────────────────────────────────────────────────┘

実際の desktop では rail 内の tool は可能な限り一行に置く。wireframe の改行は説明用であり、描画 tool の button を縦に一つずつ並べる指定ではない。縦線は group separator、二重線は paper panel の境界を表す。group の面は薄く異なる背景で示し、ボタンの面より group の面が広く見えるようにする。

Tablet（641〜1099px）:

    row 1: [SVG:pointer 選択] │ [描画 rail: [ペン] [直線] [矢印] [四角] [円] [文字] → 横 scroll]
    row 2: [線幅 ...] [色] [文字サイズ ...] [配置 ...]
    row 3: [SVG:eraser 消しゴム] │ [SVG:undo 戻す] [SVG:redo やり直す]
    row 4: ║ 用紙 [幅 ...] [高さ ...] [適用]

tablet では group の途中で button を折り返さない。drawing rail は row 1 の残り幅だけを使い、rail 外の style、消しゴム、履歴、用紙は rail の scroll に巻き込まない。ページ全体の横 overflow は出さない。

Narrow（640px 以下）:

    row 1: [SVG:pointer 選択]
    row 2: ┌ 描画 rail ──────────────────────────────────────────────────────────────┐
            │ [ペン] [直線] [矢印] [四角] [円] [文字]  → この rail だけ横 scroll │
            └───────────────────────────────────────────────────────────────────────┘
    row 3: [線幅 ...] [色] [文字サイズ ...] [配置 ...]
    row 4: [SVG:eraser 消しゴム] │ [SVG:undo 戻す] [SVG:redo やり直す]
    row 5: [用紙設定 1200 × 800 px ▸]  （開くと幅・高さ・適用・error）

narrow では選択・消しゴム・履歴を drawing rail の中へ入れず、rail の横 scroll なしで到達できる別 row に置く。描画 rail はラベルを省略せずに横 scroll する。用紙は summary が現在寸法を示す native disclosure または同等の明示的な開閉 UI とし、開いた入力欄をキーボードで到達できるようにする。disclosure を採用する場合も、入力値・適用・error を DOM から削除しない。

### 3.3 ボタンの label / icon 方針

| tool | icon の意味 | desktop / tablet の可視 label | narrow の可視 label | accessible name / tooltip |
| --- | --- | --- | --- | --- |
| select | pointer / cursor | 選択 | 選択 | 選択・移動・サイズ変更 |
| pen | pencil / freehand | ペン | ペン | 空白または既存のアプリ所有 Canvas 要素上から自由線を描く |
| line | diagonal line | 直線 | 直線 | 空白または既存のアプリ所有 Canvas 要素上からドラッグして直線を描く |
| arrow | line with arrow head | 矢印 | 矢印 | 空白または既存のアプリ所有 Canvas 要素上からドラッグして矢印を描く |
| rect | rectangle | 四角 | 四角 | 空白または既存のアプリ所有 Canvas 要素上からドラッグして四角形を描く |
| ellipse | circle / ellipse | 円 | 円 | 空白または既存のアプリ所有 Canvas 要素上からドラッグして円または楕円を描く |
| text | T / text cursor | 文字 | 文字 | 空白または既存のアプリ所有 Canvas 要素上をクリックして文字を入力する |
| erase | eraser | 消しゴム | 消しゴムツール | クリックまたはなぞって、触れた要素を消去する |
| undo | curved arrow left | 戻す | 戻す | Canvas の直前の操作を元に戻す |
| redo | curved arrow right | やり直す | やり直す | Canvas の取り消した操作をやり直す |

アイコンは 16〜18px 程度の固定 slot、label は一行の短い文字列とする。icon は currentColor の stroke / fill を使い、active、hover、disabled、focus で label と同じ色変化をする。button の accessible name を icon の代替文字へ依存させない。SVG は aria-hidden="true" とし、button の aria-label / visible label を正本にする。

アイコンを置くために既存の Canvas renderer、Fabric adapter、CanvasDocumentV1、外部 icon package を変更しない。実装は note-canvas-toolbar.tsx 内の local SVG component、または globals.css の単純な CSS shape に限定する。複雑な図形を CSS で無理に描く場合は inline SVG を優先する。

## 4. Visual tokens と states

### 4.1 Visual tokens

既存の paper palette を優先して再利用する。新しい色や依存を増やすのではなく、役割を CSS class に割り当てる。

| token / role | 用途 | v2 の表示 |
| --- | --- | --- |
| paper-soft | toolbar 外周、secondary surface、drawing rail の面 | Canvas の紙面より一段暗い背景 |
| paper | button、input、paper panel の内側 | 操作可能な面 |
| paper-line | group 内の弱い境界、input border | default separator |
| paper-line-strong | toolbar 外周、group 間、paper panel | group が変わることを示す 1px 境界 |
| paper-accent / paper-accent-deep | hover、active、focus ring | current tool の共通 accent |
| paper-danger | 消しゴムの active / error | danger 色だけに意味を委ねず、marker と label を併用 |
| icon slot | 16〜18px の固定幅 | label の左側に常に確保 |
| control height | 最低 44px 相当 | pointer / touch の target を確保。高さを下げて横幅だけを詰めない |
| group gap | group 内 gap より広い | 役割の切り替わりを余白で補強 |

group の背景を変えるときも、色差を小さくし、paper palette を逸脱しない。active の判定、focus、disabled、error は色差だけでなく border、marker、属性、説明を併用する。

### 4.2 State matrix

| state | tool button | Undo / Redo | paper field / apply |
| --- | --- | --- | --- |
| default | paper 背景、paper-line、標準 icon / label | paper 背景、標準 icon / label | paper 背景、field label、px |
| hover | accent border、淡い accent surface、tooltip | 同じ。ただし disabled には適用しない | input hover は border のみ |
| active | accent-deep border、accent surface、上または下の 3px marker、aria-pressed="true" | 使用可能でも active tool marker は付けない | active state を持たない |
| keyboard focus | 2px 以上の visible outline、3px 前後の outline-offset。active marker と同時に見える | 同じ | input にも同じ focus ring |
| disabled | native disabled、pointer 不可、標準より低いコントラスト。ただし判読可能な icon / label を残す | canUndo / canRedo が false のときだけ | apply は入力未完了や無効値では実行結果を作らず、error を field に出す |
| invalid | tool には使わない | tool には使わない | aria-invalid="true"、paper-danger border、inline error と role="alert" |
| live status | current tool、no-op、whole erase 結果を必要に応じて status に通知 | undo / redo の結果を必要に応じて通知 | 適用成功時の幅・高さを status に通知してよい |

active は「橙色の背景だけ」では不十分である。marker、太さまたは border、aria-pressed、現在の tool の status を最低限組み合わせる。disabled は opacity だけでなく native disabled 属性を必ず使う。

### 4.3 Tooltip と ARIA

- toolbar root は role="toolbar"、aria-label="Canvas ツールバー"、aria-orientation="horizontal" を持つ。
- 各大 group は role="group" と aria-label を持つ。描画 rail の中の draw / line / shape / text も、役割が分かる nested group を維持する。
- tool button は button type="button"、visible label、aria-label、aria-pressed、必要なら aria-describedby を持つ。SVG は aria-hidden="true" にする。
- Undo / Redo は button type="button" と native disabled を使う。disabled button に tooltip の操作説明を依存させず、aria-label は常に残す。
- 幅・高さは可視 label、type="number"、inputMode="numeric"、min 320、max 4000、step 1、aria-label、aria-invalid、invalid 時の aria-describedby を維持する。
- desktop / tablet では hover と keyboard focus で短い visible tooltip を表示する。tooltip は補足であり、visible label と accessible name の代替にしない。tooltip が drawing rail の overflow にクリップされる場合は、rail 内へ essential text を置かず、toolbar 側の表示領域へ逃がす。
- narrow / touch では hover tooltip を前提にしない。label を常時残し、focus 時の説明と current tool status を利用する。
- DOM の通常 Tab 順を維持する。roving tabindex や矢印キーによる複合 widget は MVP に追加しない。CSS の order だけで focus 順と見た目を大きく逆転させない。
- current tool の live status は visually hidden のままでもよいが、narrow で selected tool を確認できる短い表示を置いてよい。status は tool 切替だけで Canvas history を増やさない。

## 5. 操作状態と既存 MVP 契約

### 5.1 Tool の状態

- 初期 tool は `select` とする。`pen` は継続 tool とし、自由線を配置しても `select` へ自動遷移しない。`line` / `arrow` / `rect` / `ellipse` / `text` は one-shot の配置 tool とし、正常に 1 オブジェクトを配置した場合だけ `select` へ戻る。tool は toolbar から明示的に切り替えられる。`erase` は one-shot 配置 tool には含めず、現行の object 単位の消去説明に留める。
- tool 切替、hover、focus、tooltip の表示は CanvasDocumentV1 と history を変更しない。
- select は既存 element の選択、移動、resize を許可する。既存 element を操作する入口は select と説明する。
- pen、line、arrow、rect、ellipse、text は、空白または既存のアプリ所有 Canvas 要素上から新規 element を作る。これを `既存要素上からの重ね描き` と呼び、既存要素を選択・移動・resize する `select` の役割とは分ける。
- 新規 gesture の開始対象は、空白、または `canvasElement` metadata に既知の `CanvasElementV1` type を持つアプリ所有要素に限る。Fabric の一時 preview object、図形内文字の編集 overlay、metadata が欠落または未知の object が含まれる場合は、新規 gesture を開始しない。
- line、arrow、rect、ellipse は pointer down だけでは図形を作らず、一定の移動量を超えたときだけ drag preview と新規 element の確定を開始する。小さなクリック／ダブルクリックの pointer up は no-op とし、不要な図形を作らない。
- `select`、`rect`、`ellipse` で既存の対象図形をダブルクリックすると、`図形内文字編集` に入る。編集 overlay 中も図形外形を表示し、確定またはキャンセルで overlay を片付ける。既存のペン線、線、矢印、図形、standalone text など他要素は失わない。
- `text` の通常クリックは standalone text の新規作成であり、図形内文字編集とは別の経路である。図形ダブルクリックの inline 編集と、移動量を超えた図形の重ね描きを同じ gesture として扱わない。
- tool の active 表示は現在の tool が一つだけであることを示す。line と arrow、rect と ellipse を同時 active にしない。

### 5.2 スタイル入力

toolbar の style controls は、Canvas の描画・文字の基本スタイルだけを扱う。rich text、font family、全文字単位の装飾、full font / fill / stroke palette は対象外である。

| 入力 | 契約 | 保存境界 |
| --- | --- | --- |
| 線幅 | 整数 1〜20px、既定 1px。pen、line、arrow、rect、ellipse と選択中の非 text element に適用する | `style.strokeWidth` |
| 文字サイズ | 整数 8〜96px、既定 12px。standalone text と図形内文字に適用する | standalone text は `style.fontSize`、図形内文字は `textStyle.fontSize` |
| 色 | color input の値を対象へ適用する。stroke 対象は線色、text 対象は文字色として扱う | stroke 対象は `style.stroke`、standalone text は `style.fill`、図形内文字は `textStyle.fill` |
| 文字配置 | `left` / `center` / `right` の左寄せ・中央寄せ・右寄せ | standalone text は `style.textAlign`、図形内文字は `textStyle.textAlign` |

対象を選択中、または図形内文字を編集中に style を変更した場合は、Canvas の表示へ即時反映する。入力の preview／commit は現行の editor の明示保存と client history の境界を使い、新しい DB/API 保存領域を追加しない。

### 5.3 消しゴム

現行の erase は部分消去ではなく、hit した Fabric object 全体を削除する。v2 ではこの意味を見た目と説明に固定する。

- 表示 label は「消しゴム」、group / button の accessible name と tooltip は「消しゴムツール」とする。説明は「クリックまたはなぞって、触れた要素を消去する」とする。
- click または drag / なぞりで hit した stroke、line、arrow、rect、ellipse、text を対象要素として object 単位で削除する。
- 一 gesture 中に同じ object を二重削除せず、hit があった場合だけ一つの history entry を作る。
- no-hit は document、history、親フォームの値を変更しない。
- active は danger tint または danger marker で示すが、部分消去や不可逆なサーバー削除を意味しない。

### 5.4 Undo / Redo

- Undo / Redo は Canvas の client history snapshot を操作する。DB や API の server-side Undo ではない。
- canUndo / canRedo が false の button は native disabled。tool の active 表示を Undo / Redo に付けない。
- 新しい Canvas 操作の commit 後は Redo が破棄される現行 history model を維持する。
- 用紙サイズ変更が現在の editor で history の document commit になる契約を維持する。tool 切替や input focus は history に積まない。
- Canvas viewport に focus があるときの Cmd/Ctrl+Z、Cmd/Ctrl+Shift+Z を維持する。Cue、Summary、text editing、用紙 input の通常 undo を奪わない。

### 5.5 用紙設定

- page.width / page.height の既定値は 1200 × 800px、許容範囲は各 320〜4000px の整数である。
- input は page の幅・高さを用紙寸法として入力する。Fit、50%、100%、200% は表示倍率を表す概念であり、用紙サイズの選択肢ではない。現行 UI に倍率操作はなく、将来追加する場合も page 寸法の state / 保存値と分離する。
- 幅・高さの適用は既存の onPageDimensionsChange callback を使う。無効値では document を変更せず、field 単位の error を表示する。
- 用紙寸法を変更しても element の x、y、width、height、points、style、rotation、text、z を自動変更しない。境界外の element も削除、移動、縮小、clip しない。
- page の JSON と text element 由来の searchText の保存契約は維持する。用紙サイズだけの変更で searchText を書き換えない。
- paper panel は drawing rail と同じ横 scroll container にしない。desktop の right aligned panel、tablet の別行、narrow の disclosure のいずれでも、入力自体は keyboard / touch から到達できるようにする。

### 5.6 Scroll

- ページ全体の縦 scroll は通常 document flow のまま維持する。Canvas の上から Summary / footer へ戻れることを優先する。
- 用紙が本文列より広い場合だけ note-canvas-horizontal-scroll が Canvas 用紙を横 scroll する。
- toolbar の drawing rail の横 scroll と Canvas 用紙の横 scroll は別の local overflow である。
- toolbar v2 で page-wide overflow-x、Canvas viewport の overflow-y:hidden、manual wheel forwarding、fixed overlay を追加しない。
- rail の横 scroll によって page-wide horizontal scrollbar を出さない。focus された button は local rail の中で視認できるようにする。

## 6. Responsive 方針

| viewport | toolbar layout | rail / paper | 必須の挙動 |
| --- | --- | --- | --- |
| 1100px 以上 | 操作、drawing rail、style、消去、履歴を上段に置き、paper を独立した下段へ置く | drawing rail のみ local x scroll。paper は toolbar 全幅の独立 panelで、rail の外 | 全 group と全 label が見える。button の途中で折り返さない |
| 641〜1099px | 操作と drawing rail、style、消去・履歴、paper の順に行を分ける | drawing rail は残り幅を local x scroll。paper は同じ rail に入れない | tablet 用の優先順位が見た目から分かる。focus 順は DOM 順を保つ |
| 640px 以下 | 操作、drawing rail、style、消去・履歴、paper の順に行を分ける。paper は disclosure | drawing rail だけ x scroll。paper の入力は開閉後も page width を増やさない | 44px touch target、visible label、全 controls の keyboard / touch 到達、page-wide x overflow なし |

desktop で一行に収めるために label を極端に小さくしない。tablet では長い label を省略記号で切らず、rail を scroll する。narrow でも icon-only を既定にしない。将来、幅が極端に小さい端末で icon-only を検討する場合は、別 task で current tool 名の常時表示、tooltip、accessible name、focus scroll を含む設計を先に決める。

CSS の order だけで視覚的な row と DOM の Tab 順を大きく反転させない。row を分ける場合は、operation → drawing rail → style → erase → history → paper の論理順を読み手が追える配置にする。rail 外の style、erase、history、paper は rail の scroll に隠れないことを優先する。

## 7. 現行実装と確認境界

### 7.1 静的に確認できる現行実装

- `src/app/notes/_components/note-canvas-toolbar.tsx` に local SVG icon、短い visible label、group の ARIA、active state、tooltip、style controls、用紙寸法入力・validation、Undo / Redo、narrow の paper disclosure がある。
- `src/app/globals.css` に operation / drawing rail / style / erase / history / paper の面、separator、active・disabled・focus・invalid の状態、desktop / tablet / narrow の行構成、drawing rail の local horizontal scroll がある。
- toolbar から利用する tool lifecycle（初期 `select`、`pen` 継続、配置後 `select` 遷移）、既存要素上の重ね描き、4px drag threshold、図形内文字、whole-object eraser、client history、CanvasDocumentV1 の page 寸法・要素不変契約は `note-canvas-editor.tsx`、Fabric adapter、共有 Canvas 契約に接続している。

### 7.2 Browser runtime QA の境界

現行実装の browser runtime QA は未確認である。特に、各 viewport の表示、keyboard / touch 到達性、tooltip / focus、pointer による重ね描き・図形内文字・style 反映、保存・再読込、wheel / trackpad / touch scroll は PASS と判定しない。確認項目は `doc/testing/TEST_SCENARIOS.md` の `CANVAS-DIMENSION-001`、`CANVAS-INTERACTION-001`、`CANVAS-GESTURE-001`、`CANVAS-SHAPE-TEXT-001`、`CANVAS-STYLE-001`、`CANVAS-PERSISTENCE-STYLE-001`、`CANVAS-TOOLBAR-STYLE-001` に記録する。

`npm run lint`、型検査、build、`git diff --check` の成功は静的検証であり、browser runtime PASS の代替ではない。runtime 結果が得られた場合は `IMPLEMENTATION_STATUS.md`、`CURRENT_STATUS.md`、`HANDOFF_2026-07-19.md`、`TEST_SCENARIOS.md` を証跡に合わせて同期する。

## 8. 今回の対象外

次は v2 toolbar の設計・実装・受け入れ条件に含めない。

- snap、grid、guides、smart handles
- connector routing、waypoint、orthogonal connector
- layer panel、z-order 専用 UI、group / ungroup、rotate
- minimap、infinite canvas、ページ一覧
- 複数選択、multi-select 操作、整列
- rich text、font family、full font / fill / stroke palette（単色の color input は 5.2 の範囲）、破線、矢尻の種類
- 画像、ファイル添付、貼り付け asset、export / print toolbar
- stroke の partial eraser、line / arrow / shape / text の部分消去
- server-side Undo、autosave、draft、409 競合、共同編集

現行の whole-object eraser と、将来検討する自由線 partial eraser は別機能である。partial eraser は CANVAS_PARTIAL_ERASER_DESIGN.md に従う別 task とし、v2 の消しゴム button の意味を変更しない。

## 9. 現行契約と QA 観点

以下は現行 toolbar の契約と browser runtime QA の確認観点であり、実施済み判定の一覧ではない。静的実装確認と runtime の判定は `doc/implementation/IMPLEMENTATION_STATUS.md`、実施結果は `doc/testing/TEST_SCENARIOS.md` を正本とする。

### 9.1 見た目

- [ ] toolbar が Canvas 本文列の上に表示され、Cornell の Cue 30% / 本文 70%、Summary、Canvas の紙面位置を変更していない。
- [ ] 文字だけのカテゴリ見出しを横一列に置かず、選択、描画 rail、消しゴム、履歴、用紙の境界が背景・余白・separator で判別できる。
- [ ] すべての tool button に SVG / CSS icon と短い可視 label があり、label-only の平置きから移行している。
- [ ] 選択、消しゴム、Undo / Redo、描画 tool の primary / secondary の重みが、面・marker・余白の差で見える。
- [ ] active は icon / label の色だけでなく marker または border と aria-pressed で分かる。active tool は一つだけである。
- [ ] paper panel が drawing rail の中に入らず、幅・高さ・px・適用が用紙寸法の設定として視覚的に分離されている。
- [ ] hover、focus、disabled、invalid の見た目が default と区別でき、focus ring が active marker に埋もれない。
- [ ] desktop、tablet、narrow で button の途中折り返しや page-wide horizontal overflow がない。

### 9.2 操作

- [ ] 初期 tool は `select` である。
- [ ] `pen` は継続 tool として、自由線を配置した後も `pen` が active である。
- [ ] `line` / `arrow` / `rect` / `ellipse` / `text` は、正常に 1 オブジェクトを配置した後に `select` へ戻る。
- [ ] 選択、ペン、直線、矢印、四角、円、文字をそれぞれの group / rail から一回の操作で選べる。
- [ ] tool 切替、hover、focus、tooltip 表示だけでは CanvasDocumentV1、history、親フォームの値が変わらない。
- [ ] 消しゴムは click / なぞりで hit した要素を object 単位で削除し、Canvas 全体の削除、partial erase、mask を行わない。no-hit は no-op である。
- [ ] Undo / Redo は canUndo / canRedo と連動し、disabled button をクリックして無意味な history を増やさない。
- [ ] 用紙サイズ input は整数 320〜4000px、Enter または適用で更新でき、不正値は document を更新せず field error を出す。
- [ ] narrow の drawing rail だけが横 scroll し、rail 外の選択・消しゴム・履歴・用紙へ横 scroll なしで到達できる。
- [ ] pen、line、arrow、rect、ellipse、text は空白と既存のアプリ所有 Canvas 要素上のどちらからも新規作成でき、未知 metadata の一時 object 上では開始しない。
- [ ] line、arrow、rect、ellipse は一定の移動量を超えた場合だけ作成し、クリック／ダブルクリックだけでは不要な図形を作らない。
- [ ] `select`、`rect`、`ellipse` の対象図形のダブルクリックで図形内文字編集に入り、図形外形を表示したまま、確定・キャンセル後も他要素を失わない。
- [ ] Canvas の描画 gesture、text editing、Delete / Backspace、Cmd/Ctrl+Z、Cmd/Ctrl+Shift+Z を toolbar markup の変更で壊していない。
- [ ] 線幅 1〜20px（既定 1px）、文字サイズ 8〜96px（既定 12px）、色、文字配置 left / center / right が選択中・図形内文字編集中に即時反映される。

### 9.3 アクセシビリティ

- [ ] root に role="toolbar"、aria-label、aria-orientation があり、各 group に role="group" と日本語 aria-label がある。
- [ ] button は button type="button" で、visible label、aria-label、必要な aria-describedby、tool button の aria-pressed を持つ。
- [ ] icon は aria-hidden="true" で、意味を icon の形だけに依存しない。
- [ ] hover と keyboard focus で tooltip / 説明を確認でき、touch では visible label が意味を伝える。
- [ ] 全 button、input、disclosure に Tab で到達でき、Enter / Space、Enter 適用が機能する。DOM の論理順と見た目の group 順が大きく矛盾しない。
- [ ] focus-visible は 2px 以上で、active、hover、disabled と同時に視認できる。focus を色だけで表現しない。
- [ ] active は aria-pressed、disabled は native disabled、用紙の invalid は aria-invalid と aria-describedby / role="alert" で表現する。
- [ ] current tool、no-op、消しゴムの結果など、画面上で伝わりにくい状態は status / aria-live に通知できる。通知だけで操作の意味を置き換えない。
- [ ] narrow で label を icon-only の tooltip のみに隠さず、rail 内でも label と focus 位置を確認できる。

### 9.4 既存機能回帰

- [ ] CanvasDocumentV1 の schemaVersion、page.background、elements の保存・復元形式を変更していない。
- [ ] 1200 × 800 の既定値、320〜4000px の整数範囲、用紙変更時に x、y、width、height、points、style、rotation、text、z を不変にする契約が保たれている。
- [ ] 用紙サイズ変更だけでは Canvas text 由来の searchText が変わらない。
- [ ] standalone text の文字配置は `style.textAlign`、図形内文字の文字配置は `textStyle.textAlign` に保存される。inline 編集の確定・キャンセルで他の Canvas 要素は保持される。
- [ ] ペン、直線、矢印、四角、円、文字の作成、select による移動 / resize、whole erase、Undo / Redo が回帰していない。
- [ ] Canvas の横 scroll とページ全体の縦 scroll が独立しており、Canvas 上から Summary / footer へ戻れる。
- [ ] Cue、Summary、保存、閲覧、legacy markdown body mode に関する既存 UI を変更していない。
- [ ] npm run lint、必要な type check / build、対象 route の browser runtime QA を分けて報告する。browser を実行できない場合は未確認とし、PASS と書き換えない。

## 10. 設計・実装履歴

2026-07-19 時点で、v2 の toolbar 設計と実装同期は完了している。以前の実装着手前の比較情報は §2 に履歴として残し、旧 Worker task 名、実装依頼手順、変更ファイル制限は現行の作業指示として扱わない。現行の残課題は §7.2 とテストシナリオに記載した browser runtime QA である。
