# Canvas ツールバー情報設計・操作設計

作成日: 2026-07-18（JST）  
状態: Manager 推奨案（設計のみ）  
対象: Canvas 本文の編集 toolbar  
関連 task: `fix-canvas-line-arrow-placement-movement-563d27c2`（進行中）

## 1. 目的と決定事項

この文書は、Fabric.js を使った Canvas 本文の toolbar を、draw.io の「役割が見える道具箱」に近づけるための MVP 情報設計と操作契約を定める。対象はツールの見つけやすさ、選択状態、操作説明、キーボード到達性、レスポンシブ配置であり、Canvas の保存形式や描画アルゴリズムを変更するものではない。

Manager 推奨は、**主要操作を常時表示し、描画ツールを役割別の小グループへ分ける構成**である。

```text
[操作] 選択
│ [描く] ペン │ [線] 直線・矢印 │ [図形] 四角・円 │ [文字] テキスト
│ [消去] 消しゴム（全体）
│ [履歴] Undo・Redo
└ [用紙] 幅 × 高さ px・適用
```

次の判断を今回の MVP の基準とする。

- 初期ツールは現行どおり `選択`。選択中のツールは視覚表示と `aria-pressed` の両方で示す。
- `ペン`、`直線`、`矢印`、`四角`、`円`、`テキスト`は描画グループ内で役割別に整理する。全機能を一つの dropdown に隠さない。
- 現行の `消しゴム`は **`消しゴム（全体）`** と明示し、クリックまたはなぞりで hit したオブジェクト全体を削除する。部分消去とは別機能にする。
- `選択`は既存オブジェクトの選択・移動・サイズ変更専用とする。描画ツールは、既存オブジェクト上から開始した場合に新規図形を作らない。
- Undo/Redo は常時表示し、Canvas の履歴だけを操作する。ツール切替は履歴へ積まない。
- 用紙サイズは描画ツールや zoom と混同しない独立グループにする。幅・高さは用紙そのものの px 寸法であり、既存要素を自動変形しない。
- Canvas は紙面内の bounded surface とし、既存の Canvas 内横スクロールとページ全体の縦スクロールを維持する。
- draw.io の snap、connector routing、複数選択、layer panel などを今回の MVP へ持ち込まない。

本タスクではコード、設定、依存関係、DB、API、生成物を変更しない。実装時も、Canvas JSON の `CanvasDocumentV1` 契約と既存保存経路を維持する。

## 2. 現状の棚卸し

### 2.1 Toolbar の現状

`src/app/notes/_components/note-canvas-toolbar.tsx` は、現在次の状態である。

| 現在の項目 | 現在の意味 | 現在の UI / 操作 | 設計上の整理先 |
| --- | --- | --- | --- |
| 選択 | 選択・移動・サイズ変更 | `select`。初期状態。`aria-pressed` と `data-active` あり | 操作グループ。常時表示 |
| ペン | 自由線を描く | `pen`。Fabric の free drawing | 描くグループ。常時到達 |
| 直線 | 2 点をドラッグして直線を描く | `line`。ドラッグ中は preview | 線グループ |
| 矢印 | 2 点をドラッグして矢印を描く | `arrow`。ドラッグ中は preview | 線グループ |
| 四角 | 四角形を描く | `rect`。ドラッグ中は preview | 図形グループ |
| 円 | 楕円要素を描く | `ellipse`。ドラッグ中は preview | 図形グループ |
| テキスト | Canvas 上へ text element を追加して入力 | `text`。クリック位置で編集開始 | 文字グループ |
| 消しゴム | 対象オブジェクト全体を削除 | `erase`。クリックまたはなぞり。部分消去ではない | 消去グループ。描画グループから分離 |
| Undo / Redo | Canvas 操作を戻す / やり直す | `canUndo` / `canRedo` で disabled | 履歴グループ。常時表示 |
| 用紙サイズ | `page.width` / `page.height` を指定 | 320〜4000 px の整数。適用または Enter | 用紙グループ。右端または別行 |

現行 toolbar は一つの `描画ツール` group に 8 ツールを平置きし、履歴と用紙サイズを後ろへ置いている。ツールボタンには日本語ラベル、`aria-label`、`title`、`aria-pressed`、`data-active`がある。CSS には hover、active、disabled、`focus-visible` の状態と、幅が狭いときの折り返しが既にある。

### 2.2 Editor の現状

`src/app/notes/_components/note-canvas-editor.tsx` では、toolbar の選択値が Fabric の操作モードへ直接反映される。

| 状態 | 現行挙動 | 今回の設計で明確にする境界 |
| --- | --- | --- |
| `select` | Fabric の selection を有効にし、既存要素の選択・移動・resize を `object:modified` で履歴へ反映 | 既存要素を操作する入口は `選択`だけと説明する |
| `pen` | free drawing の path を作成し、pointer up 相当で document へ commit | 開始点が既存要素なら新規 stroke を作らない |
| `line` / `arrow` / `rect` / `ellipse` | pointer down から drag draft / preview を作り、pointer up で一要素を commit | 空白から開始した gesture だけを新規作成にする。線・矢印の座標・移動は進行中 task と整合させる |
| `text` | pointer 位置に text element を追加し、編集状態へ入る | 空白では新規作成、既存 text では編集、他の既存要素上では新規作成しない |
| `erase` | hit target を session 内で一度だけ削除し、gesture 終了時に一つの履歴へ commit | 全 element type の全体消去であることをラベルと説明に出す |
| Canvas history | viewport に focus があるとき Cmd/Ctrl+Z、Cmd/Ctrl+Shift+Z。選択中の Delete / Backspace も扱う | 入力欄、用紙サイズ input、text editing の browser 操作を奪わない |
| 用紙サイズ | 有効値を適用すると document の `page` を更新して Canvas を再描画 | page 寸法変更を zoom と呼ばず、要素の座標・寸法・style・points を変更しない |

### 2.3 現状の設計ギャップ

- `選択`と描画ツールが同じ平面上で何を許すか、特に既存オブジェクト上からの描画開始が UI 契約として書かれていない。
- 8 ツールが平置きのため、`直線`と`矢印`、`四角`と`円`の関係が見えにくい。
- `消しゴム`という名称だけでは、線を部分的に消す機能と誤解しやすい。現行実装はオブジェクト単位である。
- `title` は補助にはなるが、タッチ端末では表示されない。ラベル、状態表示、focus 表示を合わせて設計する必要がある。
- 現行コードには `aria-pressed` と focus ring はあるが、現在のツールや、描画開始をキャンセルした理由を live status で伝える契約がない。
- 用紙サイズは既に独立 group だが、描画ツール群と同じ toolbar の中での優先順位と、狭幅時の収納ルールが未定義である。

## 3. MVP の不変条件と境界

### 3.1 維持する機能

次の機能は toolbar の見た目を変えても維持する。

- 本文領域が `CanvasDocumentV1` を編集・閲覧する Canvas であること。
- ペン、直線、矢印、四角、円、テキストの作成、選択、移動、サイズ変更。
- 現行のオブジェクト単位の消しゴム。線・矢印・図形・テキストを部分的に切り刻まない。
- Canvas 内の Undo / Redo と、新しい操作後に Redo が破棄される現行履歴モデル。
- 用紙幅・高さの整数入力、320〜4000 px の範囲検証、適用・Enter 操作。
- 用紙寸法を変えても既存 element の `x`、`y`、`width`、`height`、`points`、`style` を自動変更しないこと。
- 用紙が viewport より広い場合の Canvas 内横スクロールと、Canvas 上から Summary や保存 footer へ戻れるページ全体の縦スクロール。
- 明示保存時に親フォームへ Canvas document を渡し、既存の API / Prisma 保存領域へ保存すること。

ツールを選ぶ、hover する、focus する、Esc で描画をキャンセルする操作は document の履歴や DB の保存値ではない。用紙サイズの適用と Canvas element の編集だけが document history の対象である。

### 3.2 今回導入しない機能

draw.io から借りるのは、役割を分類し、状態を見せ、操作を予測可能にする考え方に限る。次は今回の toolbar MVP に含めない。

- connector の自動 routing、waypoint、orthogonal line、snap、grid、guides、smart handles。
- 複数選択、group / ungroup、layer panel、z-order の専用 UI、rotate、minimap、infinite canvas。
- fill / stroke palette、線幅、矢尻種類、破線、フォント toolbar、rich text、Markdown の Canvas 編集。
- 画像、ファイル、貼り付け asset、外部 URL embed、export、印刷専用 toolbar。
- pixel 単位の消しゴム、図形・矢印・テキストの部分消去。自由線の部分消去は別設計 `CANVAS_PARTIAL_ERASER_DESIGN.md` の段階導入対象であり、今回のボタンへ混ぜない。
- Canvas の server-side undo、autosave、draft、409 競合、revision history、collaboration。
- toolbar 専用の新しい DB column、API、Prisma migration、依存関係。

## 4. 代替案と Manager 推奨

| 案 | 構成 | 長所 | 影響 / リスク | 判断 |
| --- | --- | --- | --- | --- |
| A. 現状維持 | 8 ツールを一つの group に平置き | 差分が小さく、現在の操作をそのまま残せる | 線と図形の関係、全体消去の意味、重要操作の優先度が見えない | 不採用。次の UI task へ進む理由を解消できない |
| B. グループ化・主要操作は常時表示 | 選択、描く、線、図形、文字、消去、履歴、用紙を区切る | discoverability と現行機能の両立。実装が既存 component / CSS の範囲に収まる | 画面幅が狭いと 2 行または local overflow が必要 | **Manager 推奨** |
| C. 線 / 図形を dropdown に収納 | `[線]`や`[図形]`を開いて中のツールを選ぶ | desktop の横幅を節約できる | 直線・矢印・四角・円が隠れ、現在のツールが group trigger だけでは分かりにくい。タッチ操作も一手増える | MVP では不採用。幅が極端に狭い表示の補助案に限る |
| D. draw.io 風の左縦 rail | Canvas 左側へ icon rail を固定 | 役割を視覚的に並べやすく、将来のツール追加に強い | Cornell の Cue 幅を圧迫し、mobile と paper scroll の責務が増える。今回の既存 layout と競合する | 不採用。将来の大規模 editor 化で再評価 |

案 B では、desktop の横幅を使ってツールを見せ、mobile では描画 group だけを局所的に横スクロールさせる。隠し dropdown を基本にしないため、「どの道具を使えるか」が最初から分かる。ボタン名は短い日本語を残し、アイコンを追加してもラベルを消さない。

## 5. 推奨 toolbar 構成

### 5.1 Desktop の並び順

本文列の上に、通常の document flow で次の順に置く。

```text
┌──────────┬────────┬──────────────┬──────────────┬────────┬──────────────┬────────┬────────────┐
│ 操作     │ 描く   │ 線           │ 図形         │ 文字   │ 消去         │ 履歴   │ 用紙       │
│ 選択     │ ペン   │ 直線 矢印    │ 四角 円      │ テキスト│ 消しゴム(全体)│ Undo Redo│ 幅 高さ 適用│
└──────────┴────────┴──────────────┴──────────────┴────────┴──────────────┴────────┴────────────┘
```

group 間には視覚的な区切りを置く。group 内は隣接したボタンとして扱い、`role="group"` と accessible label を持たせる。`用紙`は値入力があるため描画 group と同じ見た目の segmented control にせず、入力 group として区別する。

### 5.2 Group / visibility 契約

| group | controls | accessible label | desktop | mobile |
| --- | --- | --- | --- | --- |
| 操作 | 選択 | `Canvas 操作` | 常時表示、先頭 | 常時表示 |
| 描く | ペン | `自由線を描く` | 常時表示 | 描画ツール rail 内で常時到達 |
| 線 | 直線、矢印 | `線を描く` | 2 ボタンを表示 | 描画ツール rail 内で 2 ボタンを表示 |
| 図形 | 四角、円 | `図形を描く` | 2 ボタンを表示 | 描画ツール rail 内で 2 ボタンを表示 |
| 文字 | テキスト | `文字を置く` | 常時表示 | 描画ツール rail 内で表示 |
| 消去 | 消しゴム（全体） | `オブジェクトを全体消去` | 描画と区切って常時表示 | 主要 strip に置く |
| 履歴 | Undo、Redo | `Canvas 履歴` | 常時表示。disabled を明示 | 常時表示 |
| 用紙 | 幅、高さ、適用 | `Canvas 用紙サイズ` | 右端または toolbar 下段 | `用紙サイズ` disclosure 内 |

mobile の「描画ツール rail」はページ全体ではなく toolbar 内だけの `overflow-x: auto` とする。group の途中でボタンを折り返して順序を壊さない。消去と履歴は描画 rail の奥へ隠さず、画面上部の主要 strip に残す。用紙入力は disclosure を開けば必ず Tab で到達できる。

### 5.3 ボタン名、説明、状態

| control | 表示ラベル | tooltip / accessible description | active 時の意味 |
| --- | --- | --- | --- |
| select | 選択 | `選択・移動・サイズ変更。既存オブジェクトを操作` | 既存要素を操作できる |
| pen | ペン | `自由線を描く。空白から開始` | 空白から自由線を作成する |
| line | 直線 | `直線を描く。空白から開始` | 空白から直線を作成する |
| arrow | 矢印 | `矢印を描く。空白から開始` | 空白から矢印を作成する |
| rect | 四角 | `四角形を描く。空白から開始` | 空白から四角形を作成する |
| ellipse | 円 | `円または楕円を描く。空白から開始` | 空白から楕円要素を作成する |
| text | テキスト | `空白をクリックしてテキストを入力` | 空白から text element を作成する |
| erase | 消しゴム（全体） | `クリックまたはなぞって、対象オブジェクト全体を削除` | hit した要素を全体削除する |
| undo | Undo | `Canvas の直前の操作を元に戻す` | active state は持たず、利用不可時は disabled |
| redo | Redo | `Canvas の取り消した操作をやり直す` | active state は持たず、利用不可時は disabled |

ラベルは desktop でも mobile でも意味の手がかりとして残す。アイコンを足す場合はアイコンを `aria-hidden="true"` とし、絵文字や色だけを意味の代わりにしない。`title` は fallback として残せるが、hover と keyboard focus で同じ説明を確認できる実装を正とする。

## 6. 操作モデル

### 6.1 ツールの状態

描画ツールは選択後も active のままにする **sticky tool** を MVP の推奨とする。現行の「同じ tool で続けて描く」操作を保ち、複数の線や図形を連続して作れるためである。誤操作対策は自動的に `選択`へ戻すことではなく、開始点の guard と Escape、active 表示で行う。

| active tool | pointer down が空白 | pointer down が既存要素 | pointer up / 完了 |
| --- | --- | --- | --- |
| 選択 | active selection を解除または何もしない | その要素を選択。drag で移動、handle で resize | `object:modified` を一つの履歴へ commit |
| ペン | 自由線 gesture を開始 | **新規 stroke を開始せずキャンセル** | 空白から始めた gesture だけ commit |
| 直線 / 矢印 | drag draft を開始 | **新規 line / arrow を作らずキャンセル** | 空白から始めた gesture を一要素として commit |
| 四角 / 円 | drag draft を開始 | **新規 shape を作らずキャンセル** | 空白から始めた gesture を一要素として commit |
| テキスト | 新規 text element を作成して編集開始 | 既存 text ならその text の編集へ入る。text 以外なら新規作成せずキャンセル | 空文字は保存せず、入力済み text の変更を一つの履歴へ commit |
| 消しゴム（全体） | 何もしない | target 全体を session 内で一度だけ削除 | hit があったときだけ一 gesture 一履歴。部分消去はしない |

ここでいう「既存要素上」は、pointer down 時の Fabric hit target を基準にする。空白から開始して gesture の途中で既存要素を横切ることは妨げない。これにより、既存の図形の上へ線を引きたい場合も、空白の余白から開始すれば現在の自由配置を失わない。一方、既存要素をクリックしてから意図せず drag した場合は、新規要素を増やさない。

描画開始がキャンセルされたときは、document、親フォーム、Undo stack を変更しない。Canvas 近くの status に次を一度だけ示す。

> 描画は空白から開始してください。既存オブジェクトの移動・サイズ変更は「選択」を使います。

消しゴムはこの guard の例外である。消しゴムを選んで既存要素へ触れる操作は、意図した全体削除として扱う。hit がない消しゴム gesture は履歴へ積まない。

### 6.2 選択と描画の境界

- `選択`が既存要素の操作専用であることを、ボタン説明、カーソル、status、tooltip で同じ言葉にする。
- `ペン`、`直線`、`矢印`、`四角`、`円`では、既存要素を選択状態にしたり移動させたりしない。描画開始が既存 target に当たった場合は gesture を破棄する。
- 描画 tool へ切り替えたときは、残っている selection handle を描画の対象と見せない。必要な selection 解除は UI state で行い、document の変更にはしない。
- `テキスト`は既存 text の再編集を例外として許可する。既存の図形・線・矢印上に text を重ねたい場合は、空白から開始する。既存 target 上のクリックで別の text box を増やさない。
- `Delete` / `Backspace` は Canvas viewport に focus があり、`選択`で既存要素が選択されているときの削除に限る。text editing 中、用紙サイズ input 中、Cue / Summary 入力中は browser の通常動作を守る。
- `Esc` は進行中の drag、text の未入力 draft、消しゴム gesture を commit せず破棄し、active tool を `選択`へ戻す。既に選択されている要素の選択解除にも使う。
- tool の active state はノートや DB へ保存しない。画面を再読み込みした初期値は `選択`とする。

### 6.3 線・矢印の進行中 task との関係

`fix-canvas-line-arrow-placement-movement-563d27c2` は、直線・矢印の座標生成、移動時の挙動に関する実装 task であり、現在進行中である。この設計は次を前提とするが、座標式や Fabric adapter の実装を決めない。

- 空白から開始した直線・矢印が pointer down / pointer up のページ座標に対応する。
- `選択`で直線・矢印を移動したとき、線分または矢印全体が同じ移動量で移動する。
- toolbar は `line` / `arrow` の値と役割を提供し、`x`、`y`、`points`、矢尻の構造を直接変更しない。
- 既存 target 上からの新規作成 guard は、座標修正 task の pointer target 判定と矛盾しないよう、同 task 完了後に editor へ統合する。

線・矢印の作成と移動の回帰が確定するまでは、同じ `note-canvas-editor.tsx` の `mouse:*` handler や `createDraggedElement` を toolbar task から編集しない。

## 7. 表示、tooltip、focus、キーボード

### 7.1 Active / hover / focus

状態は三つを混同しない。

| 状態 | 表現 | 支援技術 |
| --- | --- | --- |
| active tool | accent 色の背景または枠、`選択中`を示す視覚的 marker。色だけに依存しない | tool button に `aria-pressed="true"` |
| hover | hover で背景をわずかに変化し、tool の詳細説明を表示 | hover できない端末でもラベルは残る |
| keyboard focus | 2 px 以上の高コントラスト outline と十分な offset | `:focus-visible`。active と別の枠で表示 |

tool button の accessible name は `選択`や`直線`のような短い名前にし、詳細説明は `aria-describedby` で参照する。Undo / Redo は toggle ではないため `aria-pressed` を付けない。disabled は opacity だけでなく、native `disabled` と tooltip / name で理由を伝える。

tooltip は pointer hover では短い遅延後、keyboard focus では即時に表示する。画面端で切れない位置に出し、tooltip の文章を唯一の操作説明にしない。touch では長押しを必須にせず、短い表示ラベルと status で理解できるようにする。

toolbar には `role="toolbar"`、各 group には `role="group"` と日本語 `aria-label` を付ける。MVP は custom roving tabindex を採用せず、通常の Tab / Shift+Tab で各 button と用紙入力へ順番に到達できる構成を推奨する。これにより、描画 tool を隠したまま arrow key 操作へ依存せず、数値入力も同じ tab 順で到達できる。

### 7.2 MVP キーボード契約

| 操作 | 条件 | 挙動 |
| --- | --- | --- |
| Tab / Shift+Tab | toolbar または用紙 group | DOM の表示順で次の control へ移動 |
| Enter / Space | tool button / Undo / Redo / 適用 button に focus | button の通常 click と同じ。ツール選択、履歴、用紙適用を行う |
| Cmd/Ctrl+Z | Canvas viewport に focus、text editing ではない | Canvas Undo |
| Cmd/Ctrl+Shift+Z | Canvas viewport に focus、text editing ではない | Canvas Redo |
| Delete / Backspace | Canvas viewport に focus、`選択`で object が選択されている | 選択 object を削除し、一つの履歴へ commit |
| Escape | drag / text draft / erase session または selection がある | 未 commit 操作を破棄し、必要なら選択解除して `選択`へ戻る |
| Enter | 幅または高さ input に focus | 現在値を検証し、両方が有効なら用紙サイズを適用 |

Canvas shortcut は Canvas に focus がある場合だけ処理する。toolbar button、幅・高さ input、Cue / Summary、通常の text editing が focus のときは、それらの browser 操作を奪わない。単一英字の `V/P/L/A/R/T/E` shortcut は、IME、文章入力、将来の text editing と衝突しやすいため今回の MVP では導入しない。必要になった場合は、フォーカス条件と日本語入力中の除外を別 task で設計する。

### 7.3 Status / assistive text

Canvas 本体の補助テキストは、現在の tool、用紙寸法、text element の有無を既存どおり読み上げられるようにする。これに加え、次のような状態を `aria-live="polite"` の一つの status へ通知する。

- `現在のツール: 選択`、`現在のツール: 矢印`。
- `描画は空白から開始してください。移動やサイズ変更は「選択」を使います。`
- `Undo は利用できません`、`Redo は利用できません`（連続操作で毎回読み上げない）。
- `用紙サイズを 1200 × 800 px に適用しました`、または入力エラー。
- `消しゴム（全体）で 1 個のオブジェクトを削除しました`。

pointer move ごとに live status を更新しない。focus、tool 切替、gesture 完了、エラーなど意味のある状態変化だけを通知する。

## 8. 用紙サイズ、Undo / Redo、保存との関係

### 8.1 用紙サイズ

- group 名は `用紙サイズ`、補助文は `表示倍率ではなく用紙そのものの幅と高さ（px）` とする。
- 幅・高さは現在の `page.width` / `page.height` を初期値として表示し、整数 320〜4000 px を受け付ける。
- 適用はボタンまたは input 上の Enter で行う。空欄、整数以外、範囲外は inline error、`aria-invalid`、`role="alert"` で伝える。
- 適用前に両方を検証し、片方が不正なら document、履歴、親フォームを変更しない。
- 適用成功は Canvas document の一つの history entry とする。Undo で寸法を戻し、Redo で再適用できる。
- resize は element の `x`、`y`、`width`、`height`、`points`、`style`、`rotation`、`z` を変更しない。ページ外へ出た要素も削除・移動・縮小しない。
- `Fit`、`50%`、`100%`、`200%`は用紙サイズ group に置かない。将来 zoom を追加する場合も、表示倍率の別 group として設計する。

### 8.2 Undo / Redo

- Undo / Redo は desktop、tablet、mobile で常時見える主要操作とする。
- disabled は `canUndo` / `canRedo` に一致させ、disabled button を click しても status や履歴を不要に増やさない。
- 一つの描画 gesture、オブジェクト単位の消しゴム gesture、既存要素の移動 / resize、用紙サイズ適用をそれぞれ最大一つの document history entry とする。
- tool 選択、tooltip 表示、focus 移動、描画開始をキャンセルした no-op は履歴へ積まない。
- Canvas の Undo / Redo は、Cue / Summary の text input、タグ、ノート全体の明示保存履歴とは統合しない。

### 8.3 ページスクロール

toolbar は本文列の通常 flow に置き、Canvas を覆う fixed overlay にしない。toolbar の折り返しや mobile rail の local overflow によって、ページ全体の縦 scroll を抑止してはならない。

- Canvas が大きいときは既存の `.note-canvas-horizontal-scroll` で用紙を左右に見る。
- Canvas 上から wheel、trackpad、touch を使って Summary / footer へ縦に戻れる現行のページ scroll を維持する。
- toolbar の responsive 変更で `preventDefault`、常時 `touch-action: none`、ページ全体の `overflow-x` を再導入しない。
- mobile の横 scroll は toolbar の描画 rail と Canvas 用紙の局所領域だけに閉じ込める。ページ全体に横 scrollbar を出さない。

## 9. レスポンシブ方針

| viewport | 推奨配置 | 操作上の注意 |
| --- | --- | --- |
| 1024 px 以上 | 全 group を表示。用紙 group は右端。必要なら group 境界で 2 行に折り返す | ラベルと group 名を見せ、主要操作を画面内に残す |
| 641〜1023 px | 描画 group のまとまりを保った 2 行構成。履歴は toolbar 上段または末尾に常時表示 | 個別 button の途中で折り返さない。focus 順は DOM 順を保つ |
| 640 px 以下 | 主要 strip に `選択`、`消しゴム（全体）`、`Undo`、`Redo`。描画 group は toolbar 内 local horizontal rail。用紙は disclosure | page-wide horizontal overflow を出さない。44 px 以上の touch target を確保し、active tool status を見せる |

desktop では短いラベルと任意の icon を併用できる。mobile で icon-only へ圧縮する場合も、選択中の tool 名、`aria-label`、focus tooltip を必ず残す。ただし MVP の第一実装では、ラベルを短く保ったまま local overflow させる方を推奨し、アイコンだけに依存しない。

toolbar の背景、group 境界、active、focus、disabled、error の design token は既存の paper palette と `globals.css` の focus 規則に合わせる。Canvas 本体の紙面、Cue の 30%、本文 70% の比率、Summary の位置は変更しない。

## 10. 現在進行中の線・矢印修正との依存関係

### 10.1 独立して実装できる範囲

次は `fix-canvas-line-arrow-placement-movement-563d27c2` の完了を待たずに、toolbar の UI task として実装できる。

- `note-canvas-toolbar.tsx` 内の group 分割、表示順、ラベル、説明文、`aria-label`、`aria-pressed`、disabled 表示。
- 選択 / 描く / 線 / 図形 / 文字 / 消去 / 履歴 / 用紙の視覚的な区切り。
- tooltip の hover / focus 表示、active と focus ring の CSS、ボタンの touch target。
- Undo / Redo と用紙サイズ group の desktop / mobile 配置。
- 用紙サイズ input の helper、エラー表示、Enter 適用の既存 contract を壊さない responsive CSS。
- toolbar の `role="toolbar"`、nested group、通常 Tab 順。Canvas の pointer 座標や Fabric object は触らない。

### 10.2 依存する範囲

次は、線・矢印の修正 task が完了し、変更内容と回帰結果を確認してから実装する。

- 既存オブジェクト上からの line / arrow の新規作成 guard。
- line / arrow の pointer down target、preview、pointer up、select 移動に関する status と受け入れ確認。
- 描画 tool 切替時の selection 解除と、Fabric `mouse:*` event の no-op 処理。
- `Escape` で未完了の line / arrow draft を破棄する処理。
- line / arrow を選択して移動した後も duplicate や座標ずれがないことの runtime QA。

依存範囲を実装する Worker は、進行中 task の変更中ファイルを同時に編集しない。特に `note-canvas-editor.tsx` の `pointFromPointer`、`createDraggedElement`、Fabric の `mouse:down` / `mouse:move` / `mouse:up` handler は、線・矢印 task の完了後に再読してから変更する。

## 11. 次の UI coding task の分割案

### CANVAS-TB-001: Toolbar information architecture

**目的:** 現行の機能を変えず、toolbar のグループ、ラベル、active、tooltip、focus、履歴、用紙 group を実装する。

**候補ファイル:**

- `src/app/notes/_components/note-canvas-toolbar.tsx`
- `src/app/globals.css`

**含める:**

- 5 つの描画役割（描く / 線 / 図形 / 文字）と、選択・消去・履歴・用紙の group 分割。
- `消しゴム（全体）`の表示名と説明。partial eraser の placeholder や新規 mode は追加しない。
- active `aria-pressed`、disabled、hover / focus tooltip、current-tool status の入口。
- desktop / tablet / mobile の group 境界、local overflow、44 px touch target。
- 既存の callback、tool union、page dimension validation、Undo / Redo callback の互換性。

**含めない:** Canvas event handler、座標計算、Fabric adapter、schema、API、partial eraser。

**完了条件:**

- 8 tool と Undo / Redo / 用紙サイズが、推奨 group と順序で到達できる。
- 選択中の tool が色だけでなく枠または marker と `aria-pressed` で分かる。
- hover と keyboard focus で tool の説明が確認できる。
- width / height input、適用、inline error、Canvas 内横 scroll の既存操作を壊さない。

### CANVAS-TB-002: Selection / drawing boundary

**目的:** toolbar の役割表示と Canvas の pointer 操作を接続し、既存要素上の誤操作で新規図形を作らない。

**前提:** `fix-canvas-line-arrow-placement-movement-563d27c2` が完了し、線・矢印の作成 / 移動回帰が確認済みであること。

**候補ファイル:**

- `src/app/notes/_components/note-canvas-editor.tsx`
- 必要最小限の `src/app/notes/_components/note-canvas-toolbar.tsx`
- 必要に応じて既存の Canvas assistive status の表示領域

**含める:**

- `select`でのみ既存要素を選択・移動・resize する境界。
- pen / line / arrow / rect / ellipse は空白開始だけを commit し、既存 target 開始は no-op にする。
- text は空白で新規作成、既存 text で編集、他の既存要素では新規作成しない。
- erase は既存どおり object whole erase とし、no-hit では履歴を増やさない。
- Escape、Delete / Backspace、Canvas focus 中の Undo / Redo、text / input との shortcut 非干渉。
- no-op 理由、現在の tool、成功した whole erase を status へ通知する。

**含めない:** line / arrow の座標式を再設計すること、矢尻の新 schema、partial eraser、multi-select、snap。

**完了条件:** 下記の受け入れシナリオ TB-02〜TB-06 を、線・矢印修正後の挙動と一緒に通過する。

### CANVAS-TB-003: Responsive / accessibility regression QA

**目的:** toolbar の実ブラウザ到達性と、紙面の scroll / Canvas 操作が壊れていないことを確認する。

**候補ファイル:**

- 実装済み toolbar / editor / `src/app/globals.css`
- 必要な確認記録のみ `doc/testing/TEST_SCENARIOS.md`

**確認 viewport:** 375 px、768 px、1280 px、1440 px。Canvas page は既定 1200 × 800 と、許容範囲の小さい / 大きい値を使う。

**含める:** Tab 順、focus ring、active state、disabled state、tooltip、狭幅 local overflow、ページ縦 scroll、用紙サイズ入力、Undo / Redo、mouse / touch / pen の基本操作。

**含めない:** runtime で未実装の draw.io 機能を要求すること、Canvas の保存形式や API の変更。

## 12. 受け入れシナリオ

UI coding task は、少なくとも次のシナリオを確認する。線・矢印に関するシナリオは `fix-canvas-line-arrow-placement-movement-563d27c2` の完了後に実施する。

| ID | 操作 | 期待結果 |
| --- | --- | --- |
| TB-01 | Canvas editor を開く | toolbar が本文列の上に表示され、`選択`が初期 active。Canvas、Cue / Summary、paper layout の位置は変わらない |
| TB-02 | 選択、ペン、直線、矢印、四角、円、テキストを順番に選ぶ | 各 tool が所属 group から見つかり、active marker と `aria-pressed=true` が一つだけ移る。tool 切替だけでは document / history が変わらない |
| TB-03 | 各 tool button へ Tab で移動し、Enter / Space、hover、focus を試す | 通常の DOM 順で到達でき、説明が表示され、visible focus ring が active marker と別に見える。touch ではラベルだけで意味が分かる |
| TB-04 | `選択`で既存の線、矢印、図形、テキストを click / drag / resize する | 既存 object だけが選択・移動・resize され、新規 element は作成されない。Delete / Backspace で選択 object を一度だけ削除できる |
| TB-05 | ペン / 直線 / 矢印 / 四角 / 円を、空白から開始して既存 object の上を通過させる | 空白から始めた一つの gesture は一つの object として作成され、途中で他の object に触れても描画は継続する |
| TB-06 | ペン / 直線 / 矢印 / 四角 / 円を、既存 object の上から drag する | 新規 object が作成されず、既存 object も移動・変形されない。document、親フォーム、history は変更され、status が「選択を使う」旨を示す |
| TB-07 | 既存 text 上でテキスト tool を使い、既存図形上で同じ操作をする | 既存 text は編集に入り、既存図形上では新規 text を作らず status を示す |
| TB-08 | 消しゴム（全体）で線、矢印、四角、円、テキストを click / なぞりする | hit した object 全体だけが削除され、部分的な切断や mask は起きない。一 gesture 一履歴で、Undo / Redo で元に戻せる。no-hit は no-op |
| TB-09 | Canvas viewport に focus を置いて Cmd/Ctrl+Z、Cmd/Ctrl+Shift+Z を押す | Canvas の Undo / Redo が動く。toolbar button、width / height、Cue / Summary、text editing 中では browser の通常 undo を奪わない |
| TB-10 | Undo / Redo が空の状態、または新しい操作後に toolbar を見る | 利用できない button は native disabled。新規操作後は Redo が disabled になり、クリックで無意味な status / history を増やさない |
| TB-11 | 幅または高さへ無効値を入力し、次に有効値を入力して適用する | 無効値は inline error と `aria-invalid`。有効値は page 寸法だけを更新し、element の座標・寸法・points・style は不変。用紙サイズ変更は Undo / Redo できる |
| TB-12 | 1200 × 800 の用紙を viewport より狭い / 広い寸法へ変え、Canvas 上で wheel / trackpad / touch scroll する | 大きな用紙は Canvas 内で横スクロールでき、Canvas の上からページを縦スクロールして Summary / footer へ戻れる。ページ全体の横 overflow は発生しない |
| TB-13 | 375 / 768 / 1280 / 1440 px で toolbar を開く | desktop は group が見え、tablet は group 境界を保って折り返し、mobile は主要 strip と描画 local rail / 用紙 disclosure が使える。active tool と全 controls が keyboard / touch から到達できる |
| TB-14 | 進行中の line / arrow 修正後に、空白から作成して select で移動する | pointer 位置と保存された座標が一致し、移動時の offset / duplicate がない。TB-06 の既存 object 上開始 guard も同時に通る |

## 13. 完了条件チェックリスト

次の UI coding task の完了時に、Worker は次を報告する。

- [ ] toolbar group、表示順、ラベル、tooltip / accessible name、active / focus / disabled が本設計と一致する。
- [ ] `選択`、描画 tool、`消しゴム（全体）`の役割境界が UI と操作で一致する。
- [ ] 既存 object 上からの pen / line / arrow / shape の誤操作で新規 object が増えない。
- [ ] line / arrow の座標・移動は `fix-canvas-line-arrow-placement-movement-563d27c2` の結果と整合し、toolbar 側で座標を再計算していない。
- [ ] Undo / Redo、用紙サイズ、Canvas 本文、オブジェクト全体消去、Canvas 内横 scroll、ページ縦 scroll が回帰していない。
- [ ] Cmd/Ctrl+Z、Cmd/Ctrl+Shift+Z、Delete / Backspace、Escape、Tab、Enter / Space の focus 条件が守られる。
- [ ] 375 / 768 / 1280 / 1440 px でページ全体の意図しない横 overflow がなく、touch target と focus ring が確認できる。
- [ ] `npm run lint`、必要な type check / build、対象 route の runtime QA 結果を分けて報告する。ブラウザ確認ができない場合は未確認とする。
- [ ] `src/app/notes/_components/note-canvas-toolbar.tsx`、必要最小限の editor / CSS 以外を変更していない。
- [ ] schema、migration、API、DB、依存関係、生成物に変更がない。

## 14. 対象ファイルと変更境界

### 14.1 今回の設計 task

作成・更新する文書は次のとおり。

- `doc/designs/CANVAS_TOOLBAR_DESIGN.md`（本書）
- `doc/README.md`（設計書一覧と Primary Entry Point の最小追記）

コード、設定、依存関係、DB、Prisma、API、テスト実装、画像、生成物、進行中 Worker の変更中ファイルは変更しない。

### 14.2 次の UI coding task の候補

| 責務 | 第一候補 | 条件 |
| --- | --- | --- |
| Toolbar markup / group / props | `src/app/notes/_components/note-canvas-toolbar.tsx` | CANVAS-TB-001。既存 `CanvasNoteTool` と callback を維持 |
| toolbar visual / responsive / focus | `src/app/globals.css` | CANVAS-TB-001 / 003。paper token と page scroll を維持 |
| tool state と pointer guard | `src/app/notes/_components/note-canvas-editor.tsx` | CANVAS-TB-002。線・矢印修正 task 後に着手 |
| viewer | `src/app/notes/_components/note-canvas-viewer.tsx` | 今回は原則変更なし。閲覧 toolbar が必要になった別 task で判断 |
| Canvas schema / adapter / server | `src/shared/canvas/**`, `src/app/spikes/canvas/_lib/**`, `src/server/**` | 今回の toolbar 情報設計では変更しない |
| 受け入れ記録 | `doc/testing/TEST_SCENARIOS.md` | runtime QA の結果を追加する場合だけ |

## 15. 参照した設計と判断の引き継ぎ

- `AGENTS.md`: Canvas 本文、用紙サイズ、ページスクロール、Canvas JSON 保存の製品仕様。
- `doc/implementation/MVP_CONTRACT.md`: 現行 MVP の保存・削除・画面契約。toolbar redesign はこの契約を変更しない。
- `summary/20260718/1113-freestyle-canvas-policy.md`: Cue / Summary を残し、本文だけを bounded Canvas にする MVP 方針、tool の初期範囲。
- `summary/20260718/1320-canvas-library-spike.md`: Fabric adapter、toolbar、focus、responsive、scroll の検証観点。
- `doc/designs/CANVAS_PARTIAL_ERASER_DESIGN.md`: 現行 whole erase と将来の自由線 partial erase を分ける判断。
- `summary/20260718/2223-fix-fabric-page-scroll-over-canvas.md` ほか直近 Canvas scroll summary: Canvas 上の通常ページ縦 scroll と local horizontal scroll を維持する判断。
- `src/app/notes/_components/note-canvas-toolbar.tsx`: 現在の tool union、button state、用紙入力、Undo / Redo の実装。
- `src/app/notes/_components/note-canvas-editor.tsx`: 現在の Fabric tool state、gesture、history、keyboard の実装。
- `src/app/globals.css`: 現在の toolbar group、active / disabled / focus、Canvas viewport overflow の style。

本書で確定したのは、次の実装 Worker が迷わず分割できる UI の契約である。線・矢印の座標・移動修正、部分消去、Canvas の保存形式はそれぞれの設計・実装 task の責務として残す。
