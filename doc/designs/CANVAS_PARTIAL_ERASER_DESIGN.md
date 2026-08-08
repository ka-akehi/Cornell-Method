# Canvas 部分消去 設計提案

作成日: 2026-07-18（JST）
現行照合日: 2026-08-08
状態: Gate 0 通過後・未投入の設計候補（この文書ではコード、設定、DB、マイグレーションを変更しない）
対象: `CanvasDocumentV1` と Fabric.js 7.4.0 を使う Canvas 本文

この文書は部分消しゴムの将来提案です。

現行 MVP は whole-object eraser（触れた要素を object 単位で消去する消しゴム）を提供し、部分消しゴムは実装済み機能ではありません。

Gate 0（人力 MVP 結合テスト）と Browser runtime QA が完了し、発注者が後続作業を承認するまで、Phase 1-A〜1-D の coding 案を投入しません。

実装を開始する場合は、[`IMPLEMENTATION_STATUS.md`](../implementation/IMPLEMENTATION_STATUS.md)、[`TEST_SCENARIOS.md`](../testing/TEST_SCENARIOS.md)、[`HANDOFF_2026-08-08.md`](../../HANDOFF_2026-08-08.md)、[`POST_MVP_IMPLEMENTATION_PLAN.md`](../implementation/POST_MVP_IMPLEMENTATION_PLAN.md) を確認し、`rg --files src` で現行パスを再確認します。

## 1. 結論

当面の推奨は、次の二つの消去モードを分けて段階導入することです。

1. 現行の `消しゴム` は `オブジェクト全体を消す` モードとして固定する。既存の自由線、直線、矢印、四角、円、テキストを対象にでき、現在の UI / 履歴挙動を壊さない。
2. 将来の `部分消去` は、最初は `stroke`（自由線）だけを対象にする。ページ座標上の消しゴム軌跡と自由線の polyline を計算し、残った連続区間を複数の `stroke` 要素へ分割して `CanvasDocumentV1` として保存する。

部分消去の正本には、アプリ所有の vector JSON を使います。Fabric の内部 JSON、`eraser` / `clipPath` / `mask`、Canvas の画像データは保存しません。分割後の要素は現在の V1 の `type`, `points`, `style`, `z` だけで表現できるため、最初の部分消去では `schemaVersion` を 1 のまま維持し、Prisma migration や `NotebookCanvas` の新しいカラムを追加しません。

`line`、`arrow`、`rect`、`ellipse`、`text` の輪郭や字形だけを削る意味は種類ごとに異なります。最初の部分消去モードではこれらを変更せず、対象外であることを UI に明示します。全体を消したい場合は、既存のオブジェクト消去モードを使います。

## 2. 範囲と前提

### 2.1 この提案が扱う範囲

- 自由線を消しゴム半径で切断し、複数の自由線へ分割するアルゴリズム。
- 既存の要素単位消去との共存。
- Fabric adapter、editor / viewer、Undo / Redo、明示保存、将来の autosave / API 差分送信への影響。
- 既存 JSON の読み込み互換性、要素 ID、`z` 順、ページ寸法、検索用テキスト、保存サイズ制限。
- Pointer / touch / pen 座標、devicePixelRatio、境界判定、性能、アクセシビリティ、テスト観点。

### 2.2 この提案に含めないもの

- 現行 MVP の契約変更、既存ノートの自動移行、Prisma schema / migration の変更。
- `NotebookDraftState`、autosave、楽観ロック、サーバー側履歴の実装。
- Fabric の生 JSON を API / DB の正本にすること。
- 圧力感度、画像添付、画像化した Canvas の保存、OCR。
- 矢印の矢尻を含む部分切断、図形のブール差分、文字の字形マスク。これらは自由線の導入後に別途判断する。

## 3. 現行実装の棚卸し

### 3.1 現行ファイルの責務

| ファイル | 現行の責務 | 部分消去で注意する点 |
| --- | --- | --- |
| `src/shared/canvas/index.ts`（公開 facade。実体は `canvas-document-types.ts`、`canvas-document-defaults.ts`、`canvas-document-validation.ts`、`canvas-document-serialization.ts`、`canvas-document-search.ts`） | V1 の型、既定ページ、validation、serialize / restore、`searchText` 抽出 | 部分消去後もこの契約だけを通す。V1 に mask や gap の未知フィールドを足さない |
| `src/shared/canvas/adapters/fabric/fabric-adapter.ts` | V1 と Fabric オブジェクトの相互変換 | Fabric オブジェクトを正本にせず、分割処理はページ座標の V1 を入力にする |
| `src/modules/notes/ui/components/canvas/editor.tsx`、`src/modules/notes/ui/hooks/use-note-canvas-runtime.ts` | Fabric の描画、編集、現在の全体消去、ページサイズ、Canvas 履歴 | pointer move ごとに履歴を積まず、消去開始時の状態から pointer up 時に一度だけ commit する |
| `src/modules/notes/ui/components/canvas/viewer.tsx` | 保存済み V1 の read-only 描画と text の補助表示 | V1 の複数 stroke は特別な viewer 実装なしで描画できる。text の検索・補助表示は従来どおり |
| `src/server/notes/infrastructure/notebook.command.repository.ts`、`src/server/notes/infrastructure/canvas.persistence.ts` | V1 validation、JSON 保存、`searchText` 再生成、`NotebookCanvas` upsert | 分割後も全体 document を検証し、`searchText` はサーバーで再生成する |
| `src/server/notes/infrastructure/read.repository.ts` | `NotebookCanvas.searchText` を含む一覧検索 | stroke の分割では値を変えない。text 全体消去時だけ再計算結果から該当文が消える |
| `prisma/schema.prisma` | `Notebook` と 1:1 の `NotebookCanvas` 保存境界 | 部分消去専用の行、mask、履歴、fragment table は追加しない |
| `doc/implementation/MVP_CONTRACT.md` ほか | 現行 MVP の正本 | この設計は提案書であり、正本の契約を直接変更しない |

### 3.2 `CanvasDocumentV1` の現在の保存契約

現在の document は次の形です。

```ts
type CanvasDocumentV1 = {
  schemaVersion: 1;
  page: {
    width: number;
    height: number;
    background: "paper";
  };
  elements: CanvasElementV1[];
};

type CanvasElementV1 = {
  id: string;
  type: "stroke" | "line" | "arrow" | "rect" | "ellipse" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  points?: Array<[number, number]>;
  text?: string;
  style: {
    stroke?: string;
    fill?: string;
    strokeWidth?: number;
    fontSize?: number;
    fontFamily?: string;
  };
  z: number;
};
```

| 契約 | 現在の値 / 判定 | 部分消去での扱い |
| --- | --- | --- |
| `schemaVersion` | `1` のみ受け付ける | 自由線の分割だけなら `1` を維持する。mask / segments を導入する場合だけ V2 を検討する |
| `page.width`, `page.height` | 整数 `320〜4000` px、既定 `1200 x 800` | 用紙そのもののページ座標。消去時に変更しない |
| `page.background` | `paper` 固定 | 変更しない |
| `id` | 空でない文字列 | untouched 要素の ID は保持する。分割では ID の重複を禁止し、後述の規則で一つだけ元 ID を引き継ぐ |
| `x`, `y` | finite number | survivor の points はページ座標を保つ。分割 fragment の bounds は points から再計算する |
| `width`, `height` | 正数 | untouched 要素は変更しない。分割した stroke は各 fragment の points の bounds を設定する |
| `rotation` | finite number | 分割 fragment へそのまま継承する。現行の自由線は通常 `0` |
| `points` | `stroke` / `line` / `arrow` では 2 点以上、finite number | 元の点は値を保ち、切断位置だけ補間点を追加する。空または 2 点未満の fragment は保存しない |
| `style` | V1 の既知フィールドだけ | fragment は元 style の shallow copy を継承する。消去処理で色・太さ・font を変えない |
| `z` | finite number。現在の adapter は `z` 昇順で描画し、同値では配列順が実質的な tie-breaker | 元の `z` を fragment 全てに継承し、元の配列位置で隣接させる。全要素の reindex はしない |
| 要素数 | 最大 `1,000` | 分割で増えた後も hard limit を適用する |
| stroke 系 points 合計 | 最大 `20,000` | 分割後の全 points 合計で再検証する |
| serialized JSON | UTF-8 で最大 `2 MiB` | 分割後に `serializeCanvasDocument` で最終判定する |

現行 validation はページ外要素を禁止していません。したがって、用紙サイズ変更時と同じく、ページ境界外にある要素や点を部分消去のために自動 clipping、移動、縮小することはしません。

現行 V1 には、消去履歴、mask、fragment の親 ID、Canvas の zoom、devicePixelRatio、pointer event、選択状態を保存するフィールドはありません。これらは今後も document の正本へ混ぜません。

### 3.3 Fabric 変換の現状

`fabric-adapter.ts` は次のように V1 と Fabric を変換しています。

| V1 | Fabric 表現 | 部分消去への含意 |
| --- | --- | --- |
| `stroke` | `fabric.Polyline`。points はページ座標として作成され、metadata に V1 element を保持 | 分割はこの metadata の編集ではなく、V1 points を入力にする |
| `line` | 最初と最後の points から `fabric.Line` | 現在の object hit / whole erase は利用できるが、初回部分消去の対象にはしない |
| `arrow` | shaft の `Polyline` と `Triangle` の `Group` | metadata は group にあり、矢尻と shaft の意味を保ったまま切るのは単純な points 分割ではない |
| `rect` | `fabric.Rect` | fill と outline のどちらを消すかを別途定義しない限り whole erase が安全 |
| `ellipse` | `fabric.Ellipse` | 同上。部分的な穴は V1 shape だけでは表せない |
| `text` | 編集可能な `fabric.Textbox` | 部分消去すると見た目と検索用全文、再編集時の文字列が不一致になる |

Fabric から V1 へ戻す際は `getBoundingRect()` を使い、points を bounds へスケールして再構成します。arrow は group の bounds を経由します。Fabric オブジェクトを切った直後に `fabricCanvasToDocument()` を実行すると、元の points、group の bounds、rotation が変わるおそれがあります。部分消去は `history.present` または直前に保存された V1 を入力とし、処理結果を `fabricDocumentToCanvas()` で再描画します。

### 3.4 現在のオブジェクト消去と履歴

`NoteCanvasEditor` の `erase` は、pointer down で `EraseSession` を作り、pointer down / move で `event.target` を `Set` に追加して Fabric object を remove し、pointer up で対象が一つ以上あったときだけ `commitCurrent()` を呼びます。したがって、現在すでに「一回の消しゴムストローク = 一つの Canvas history entry」です。

履歴は `CanvasHistoryState` の `past / present / future` に document snapshot を保持し、最大 50 件です。新しい commit は `future` を破棄します。部分消去もこのスナップショット契約を利用し、pointer move ごとの commit、DB 上の undo、Fabric の履歴を追加しません。

## 4. 消しゴムの意味を要素種類ごとに定義する

### 4.1 推奨 UX

ツールを次の二つへ分けます。

| ツール | 対象 | 挙動 |
| --- | --- | --- |
| `消しゴム（全体）` | 全 element type | Fabric の hit target を要素単位で削除する。現在の `消しゴム` の互換挙動 |
| `部分消去（自由線）` | `stroke` のみ | 消しゴム軌跡に重なった自由線の区間だけを削除し、残りを複数 stroke として保存する |

`部分消去（自由線）` が `line`、`arrow`、`rect`、`ellipse`、`text` に触れても、そのモードでは変更しません。ツールチップ、補助説明、`aria-describedby`、画面内 status に「自由線のみ。図形・矢印・テキストは全体消去を使用」と明示します。部分消去と whole erase に別のボタンと説明を与え、誤削除を防ぎます。

### 4.2 要素別の判断

| 要素 | 現行 `消しゴム（全体）` | 推奨する最初の部分消去 | 理由・将来の扱い |
| --- | --- | --- | --- |
| `stroke` | 要素全体を削除 | **部分消去を実装する対象** | points を polyline として分割でき、V1 の stroke 群へ戻せる。手書きの一本が複数 ID になる点は後述の ID 規則で扱う |
| `line` | 要素全体を削除 | 部分消去モードでは非対応 | 2 点の線なので将来は 2 本まで分割できるが、line として残すか stroke 化するかを先に固定する必要がある。自由線導入とは別 task にする |
| `arrow` | shaft と矢尻を含む group 全体を削除 | 部分消去モードでは非対応 | shaft の途中を切ったとき矢尻を残すか、矢印全体を消すか、矢尻の再配置をどうするかが曖昧。初回は whole erase のみ |
| `rect` | 四角形全体を削除 | 部分消去モードでは非対応 | fill の穴、outline の欠損、閉じた図形としての編集性を同時に定義する必要がある。whole erase が予測可能 |
| `ellipse` | 楕円全体を削除 | 部分消去モードでは非対応 | rect と同じ。楕円の outline だけを切るのか fill も消すのかが一意でない |
| `text` | テキストボックス全体を削除 | 部分消去モードでは非対応 | 字形の一部を消すと保存文字列・検索 `searchText`・再編集の意味が不一致になる。文字の修正は text editing を使う |

将来 line の部分消去を採用する場合も、まず `line` を line fragment に分割する小さな設計を別に確定します。arrow、shape、text へ同じ仕組みを横展開することは前提にしません。

## 5. 方式比較

### 5.1 比較対象

| 方式 | 保存の中心 |
| --- | --- |
| A. 自由線 points 分割 | 消しゴムと polyline の交差区間を除き、残りを複数の V1 `stroke` へ保存 |
| B. ベクター形状 / mask | line / shape / text の path 差分または mask を保存し、renderer が合成 |
| C. Fabric 内部表現 | Fabric eraser、`clipPath`、mask、group、raw Fabric JSON をそのまま保存 |
| D. Canvas の画像化 | Canvas を bitmap / PNG 等へ rasterize し、消しゴムで pixels を透明化して保存 |

### 5.2 評価表

| 評価軸 | A. points 分割（推奨） | B. vector / mask | C. Fabric 内部表現 | D. raster |
| --- | --- | --- | --- | --- |
| 精度 | サンプリングされた polyline の範囲で高い。丸い消しゴムは線分との距離で近似し、境界を定義できる | 図形ごとに理論上高精度。ただし fill / outline / text の意味が複雑 | Fabric の描画結果に近いが、version / renderer 依存 | 見た目は pixel 単位で正確 |
| 実装難易度 | 自由線だけなら中。線分と swept capsule の交差、fragment 化が必要 | 高。path boolean、mask、rotation、fill、text の合成が必要 | 中〜高。Fabric API と serialized shape の追随が必要 | 初期実装は低〜中。ただし保存・再編集・検索の周辺が高い |
| 既存 V1 互換 | 高。既存 type と points の組み合わせだけを使う | 低〜中。新しい field または V2 が必要 | 低。現在の API / DB は V1 を要求している | 低。`elements` の型や viewer を置き換える必要がある |
| Undo / Redo | 現行の document snapshot に自然に乗る | mask と元 shape の履歴を両方扱う必要がある | Fabric history と app history の二重化になりやすい | bitmap snapshot の容量が大きくなる |
| 保存サイズ | fragment 数と補間点分だけ増える。2 MiB / 20,000 points で上限を制御できる | mask path が増え、形状ごとに大きくなりやすい | Fabric metadata / group / clipPath が冗長になりやすい | 解像度・DPRに比例し、DB と backup を膨らませる |
| 再描画 | V1 を通常の Fabric object として描画。viewer 追加対応が少ない | renderer、export、viewer が mask 対応必須 | Fabric 版の互換性に強く拘束される | 画像一枚の描画は速いが zoom で品質が落ちる |
| 検索用 text | stroke 分割では不変。text の whole erase だけ `searchText` が変わる | text mask と検索全文の整合を追加定義する必要がある | raw text の抽出 / sanitize / metadata に依存 | 画像から検索できず、別の text mirror が必要 |
| 将来の編集性 | fragment 単位で移動・削除・再利用できる | 元 shape と mask の編集モデルが複雑 | Fabric 版の API 変更で編集不能になり得る | 要素選択・文字編集・図形編集を失う |
| ブラウザ性能 | 最大 20,000 points と gesture sample cap の範囲で予測しやすい | mask 合成と再計算が重くなりやすい | Fabric の group / cache / clipPath 次第で変動 | 大きな bitmap の upload / memory が支配的 |
| セキュリティ | 既存の JSON validation を再利用し、未知の renderer JSON を受け付けない | mask path の複雑化、SVG injection、DoS を追加検査する必要がある | raw JSON の prototype / unknown property / renderer lock-in を避けにくい | data URL、巨大 payload、画像 decode の DoS 面が増える |
| 総合判断 | **自由線の部分消去に採用** | 今は不採用。将来の line / shape 専用設計で再評価 | 正本には不採用。adapter 内部の一時表現に限定 | 正本には不採用。thumbnail / export の候補に限定 |

### 5.3 推奨しない方式の理由

Fabric の内部 eraser / `clipPath` / mask を保存すると、現在の `validateCanvasDocument()` が保証している type、座標、style、要素数、points 数、2 MiB 制限をそのまま適用できません。Fabric の minor / major version、serialization 形式、group の bounds にアプリデータが依存し、将来 Fabric を交換する選択肢も失います。保存領域は `NotebookCanvas.documentJson` のままでも、実質的には vendor-specific schema へ移行することになります。

画像化方式は見た目の部分消去には向きますが、現在の「文字・図形・線を要素として後から編集・閲覧し、text element を検索する」目的と両立しません。DPR を含む表示倍率を保存サイズへ混ぜ、バックアップも大きくします。したがって export や thumbnail の別用途以外では採用しません。

## 6. 推奨する部分消去契約

### 6.1 永続化しない操作入力

消しゴムの一回の入力は、document element ではなく編集 command として扱います。概念上の入力は次のとおりです。

```ts
type CanvasEraseGesture = {
  mode: "object" | "partial-stroke";
  path: Array<[number, number]>; // page coordinates
  radius: number; // page-coordinate radius
};
```

`pointerId`、`pointerType`、client 座標、CSS scale、devicePixelRatio、timestamp、cursor 表示、selected IDs、Fabric object、undo stack は保存しません。入力 path は履歴・API の正本ではなく、pointer up までの一時 state です。

### 6.2 座標と devicePixelRatio

canonical coordinate は常に `CanvasDocumentV1.page` のページ座標です。現在の editor と同じく、client 座標を canvas の CSS `getBoundingClientRect()` で正規化します。

```text
pageX = (clientX - rect.left) / rect.width  * page.width
pageY = (clientY - rect.top)  / rect.height * page.height
```

- `rect.width` / `rect.height` が 0 の場合は処理しない。
- `page.width` / `page.height` は現在の document の値を使い、`CANVAS_PAGE` の固定 1200x800 に戻さない。
- pointer、touch、pen は同じ式で処理する。`pointerType` によって保存座標を変えない。
- `devicePixelRatio` は backing canvas の描画解像度にだけ関係し、canonical coordinates には乗算しない。DPR を二重に掛けると 2x display で消去位置がずれる。
- CSS 上の zoom が 50%、fit、200% でもページ座標の半径と points は同じである。カーソル円だけ表示倍率に応じて描画する。
- pointer down 時は pointer capture を取得し、canvas 外へ少し出ても同じ gesture を完了できるようにする。pointer cancel、blur、Escape は未 commit の gesture を破棄する。

### 6.3 半径、サンプリング、境界

推奨する初期 UI 値は次のとおりです。

| 項目 | 推奨値 |
| --- | --- |
| 表示名 | `消しゴム径`（直径） |
| 初期直径 | `24` page px |
| 内部半径 | `12` page px |
| UI の直径範囲 | `8〜64` page px、整数 step |
| keyboard 操作 | `[` / `]` で直径を 4 px 単位で変更する案 |
| 圧力感度 | 初期対象外。radius は gesture 中固定 |

内部で使う `radius` は消しゴム円の半径で、UI の `消しゴム径` の半分に当たります。stroke の中心線を除去する判定では、描画された stroke の太さも考慮し、次の `effectiveRadius` を使います。

```text
effectiveRadius = eraserRadius + max(stroke.style.strokeWidth ?? 3, 1) / 2
```

この式により、消しゴムの円が線の描画領域に触れた区間を消去します。strokeWidth の検証値が不正な場合は V1 validation で拒否し、アルゴリズム内部では fallback `3` を使います。

pointer move の隣接点を swept capsule で結び、高速な移動でも未消去の隙間ができないようにします。ブラウザが提供する coalesced events が使える場合は利用してもよいですが、保存はしません。

ページ端では pointer を `0〜page.width` / `0〜page.height` に clamp します。消しゴム円がページ外へはみ出しても、要素をページ境界で clipping しません。境界上の要素は、ページ内の消しゴム円に触れた区間だけを消します。もともとページ外にある点も、同じ座標規則で判定します。

交差判定は `distance <= effectiveRadius` を消去とします。浮動小数点誤差には `1e-6` page px の epsilon を使い、ちょうど接する境界は消去側に含めます。

### 6.4 自由線の分割アルゴリズム

`stroke.points` の隣接点を直線 segment とみなし、消しゴム path の各 capsule と交差する segment 上のパラメータ区間を求めます。実装順は次のとおりです。

1. document を検証し、erase path と radius を検証する。
2. stroke の bounds を消しゴム path の bounds `+ effectiveRadius` で粗く絞り込む。交差しない stroke は同じ object をそのまま保持する。
3. 候補 stroke ごとに、全 segment と swept capsule の交差区間を集める。複数回触れた区間は union する。
4. 交差区間の補集合を、元の点列順で連続 survivor にする。segment の途中で切れる位置には線形補間点を追加する。
5. 既存の点は値を保持する。新しく作る cut point だけは保存サイズと浮動誤差を抑えるため `0.1 page px` 単位へ丸める。
6. 点数が 2 未満、または path length が `max(2, strokeWidth / 2)` page px 未満の survivor は空 fragment とみなし捨てる。境界でごく短い cap だけが残ることを防ぐための規則である。
7. survivor ごとに `getElementBounds()` 相当で `x`, `y`, `width`, `height` を再計算する。points、style、rotation、z を元 stroke から継承する。
8. 元要素を fragment 群で同じ配列位置に置き換える。fragment は元の順番で隣接させ、他要素の順序を変えない。
9. 結果全体を `validateCanvasDocument()` / `serializeCanvasDocument()` に通す。上限超過なら、見た目も履歴も保存通知も含めて gesture 全体を atomic に破棄する。

この方式は、保存済み polyline の精度で消去区間を計算します。元の pointer raster や、stroke points に存在しない細かな曲率は再現せず、保存済み segment の geometry だけを対象にします。

### 6.5 element ID、座標、style、z の規則

一つの元要素を複数の fragment へ分割するとき、全 fragment に同じ ID は複製しません。V1 には lineage field がなく、ID 重複は選択、React key、将来の差分更新を壊すためです。

- 元の `id` は、元の points 順で最も早い survivor にだけ引き継ぐ。
- 2 個目以降の survivor は `createElementId("stroke")` で新しい ID を発行する。
- 全区間が消えた場合は元 ID ごと要素を削除する。
- fragment の `style` は元 style のコピーとし、stroke color、fill、strokeWidth、font 系を変更しない。
- fragment の `rotation` は元の値を継承する。将来 rotated stroke を許す場合も、まず canonical points の回転座標系を別途固定する。
- fragment の `z` は元の値をそのまま継承する。既存要素全体の z を詰め直さない。
- 同じ z の fragment の表示順は document の配列順を tie-breaker とする。現在の adapter の安定 sort と整合するため、fragment を元位置へ隣接させる。
- untouched 要素の `id`, `x`, `y`, `width`, `height`, `points`, `style`, `rotation`, `z` は byte-level の JSON 変更を避けるためにも変更しない。

現在は Canvas element を外部から参照する API がなく、元 ID を一つ引き継ぐ規則で十分です。将来 `Cue` や `NoteCard` が element ID を参照する場合は、ID を lineage と兼用せず、V2 で `fragmentOf` 等を追加する設計判断を先に行います。

### 6.6 空要素、短区間、上限超過

- points が 2 点未満の fragment は保存しない。
- path length が `max(2, strokeWidth / 2)` 未満の fragment は保存しない。
- 全 fragment が消えた stroke は要素ごと削除する。
- 要素数が `1,000`、stroke points 合計が `20,000`、serialized JSON が `2 MiB` を超える結果は commit しない。
- 一つの gesture が過度に断片化しないよう、実装上の推奨上限を `256 fragments / gesture` とする。超えた場合は部分結果を保存せず、status に「消去範囲が複雑すぎるため適用できません」と表示する。
- pointer input の一時サンプルは最大 `2,048` 点を目安とする。超過時は path simplification または逐次処理で上限を守り、入力履歴を JSON に保存しない。単純なイベント捨てで path に見える隙間を作らない。
- 既存の document がすでに上限ぎりぎりでも、全体消去で小さくなる場合は許可する。分割でサイズが増える場合は最終 JSON の hard limit で判定する。

## 7. Fabric adapter / editor / viewer への影響

### 7.1 Adapter の境界

部分消去の純粋な処理は、Fabric API に依存しない shared canvas utility に置くことを推奨します。責務は次のように分けます。

```text
history.present (CanvasDocumentV1)
        │
        ├─ partial-stroke eraser: V1 → V1
        │
        ├─ CanvasHistory: snapshot を一つ push
        │
        └─ fabricDocumentToCanvas: V1 を全再描画
```

`fabric-adapter.ts` は、分割済み `stroke` を通常の Polyline として作成できればよく、mask、Fabric eraser、特殊 metadata を新たに保存しません。Fabric object の `points` を直接 splice してから `fabricCanvasToDocument()` する実装は、bounds / scale / arrow group の変換誤差を招くため採用しません。

### 7.2 Editor の gesture lifecycle

部分消去を追加する場合の editor state は次の契約にします。

1. pointer down で `beforeDocument = history.present` を clone し、erase session を開始する。
2. pointer move は page-coordinate path を更新し、必要なら `workingDocument` の表示だけを更新する。`pushCanvasHistory()`、`onDocumentChange()`、API request は呼ばない。
3. pointer up で `beforeDocument` に対して一度だけ pure eraser を実行する。差分がなければ何もしない。
4. 成功した `afterDocument` を一つの `pushCanvasHistory()` へ渡し、`onDocumentChange()` を一度だけ呼ぶ。
5. validation / size cap / pointer cancel / Escape の失敗時は `beforeDocument` へ戻し、履歴と親フォームを変更しない。

現在の object erase の `EraseSession.deletedObjects` は保持してよいですが、partial mode では object Set を正本にせず、canonical document と gesture path を session に持たせます。全体消去モードは現行の hit target 処理を使い続けます。

preview を pointer move 中に実装する場合も、history へは書きません。最初の coding task では、消去円の cursor と pointer up 後の再描画を先に成立させ、毎 move の全 document 再描画が 16ms を超える場合は、候補 bounds の overlay などへ最適化を分けます。

### 7.3 Viewer と用紙サイズ

V1 の分割 stroke は通常の複数 Polyline なので、`NoteCanvasViewer` の read-only 初期化に専用分岐は不要です。text 補助表示も text element のみを対象とし、stroke fragment の ID や lineage を読み上げません。

用紙サイズは現在の `page.width` / `page.height` をそのまま使います。部分消去のために page bounds へ要素を収めたり、resize 時に points を変形したりしません。1200x800 の既存 document、320 / 4000 境界の document、ページ外要素も従来どおり復元します。

## 8. 保存、検索、Undo / Redo、将来 API

### 8.1 現行 MVP の明示保存

現行の保存経路は、editor の `onDocumentChange` が親フォームへ V1 を渡し、明示保存時に `POST /api/notes` または `PATCH /api/notes/:id` の全体 input へ含める形です。repository は `validateCanvasDocument()`、`serializeCanvasDocument()`、`extractCanvasSearchText()` を経由して `NotebookCanvas.documentJson` と `searchText` を同一 transaction で保存します。

部分消去で追加する DB / API 契約はありません。

- stroke の分割では text element が変わらないため `searchText` は同じです。
- whole erase で text を削除した場合は、保存時に `searchText` からその text が消えます。
- shape や stroke を削っても `searchText` は変わりません。
- page 寸法だけを変更した場合は、points / text / `searchText` を変更しません。
- `NotebookCanvas` は引き続き 1:1 の単一 JSON 保存領域です。分割結果を別 table に保存しません。

### 8.2 Undo / Redo 契約

部分消去一回を一つの document snapshot として扱います。

| 操作 | `past` | `present` | `future` |
| --- | --- | --- | --- |
| erase gesture 前 | 直前の履歴 | 元 document | 既存の redo |
| erase gesture 成功後 | 元 document を一つ追加 | fragment を含む document | 空にする |
| Undo | 元 document へ戻す | 元 document | erase 後 document を先頭へ |
| Redo | 元 document | erase 後 document | 残り |

分割 fragment の ID が変わっても、履歴は ID 単位の inverse command ではなく document snapshot を戻すため、元の一本へ正確に戻せます。履歴に gesture path や Fabric JSON を保存しません。現行の最大 50 snapshot をそのまま使い、サイズ上限のある document を 50 件保持するメモリコストは現行設計の範囲で測定します。

### 8.3 将来 autosave / API 差分送信

現行 MVP では autosave / 409 は実装しません。将来 `NotebookDraftState` を導入する際は、**一回の erase gesture を一つの mutation** として送ります。pointer event ごとの送信は行いません。

初期の安全な選択肢は、既存の 2 MiB 上限内で gesture 後の Canvas 全体を送ることです。通信量の測定後に差分送信を導入する場合は、次の要素差分を推奨します。

```json
{
  "type": "canvas.erase",
  "operationId": "op-unique-id",
  "base": {
    "version": 3,
    "autosaveVersion": 5
  },
  "replacements": [
    {
      "removedElementIds": ["stroke-original"],
      "elements": [
        { "id": "stroke-original", "type": "stroke" },
        { "id": "stroke-fragment-2", "type": "stroke" }
      ]
    }
  ]
}
```

実際の payload では `elements` の全 V1 フィールドを含めます。この replace 形式にする理由は、元 ID を一つ更新し、新 ID を追加し、元要素を一つの atomic change として置き換える必要があるためです。pointer path だけを送り、サーバーとクライアントが別々に geometry を再計算する方式は、Fabric / browser の差、algorithm version の差、丸め差を生むため採用しません。

将来 API の処理規則は次のとおりです。

- `base.version` / `base.autosaveVersion` は、製品全体の draft optimistic lock 契約に合わせる。Canvas 専用の別 version を先に追加しない。
- `operationId` は retry の重複適用を防ぐために付ける。保存側で idempotency の保持方法を決める task を、autosave 導入時に別途行う。
- サーバーは affected IDs、全 replacement element、最終 document を V1 validation とサイズ制限で検証する。
- `searchText` は payload を信頼せず、確定後の document からサーバーが再生成する。
- base version が一致しなければ 409 を返し、自動適用せず、現行ロードマップの競合 UI（再読み込み / 後で）へ渡す。
- ローカル Undo はサーバーの過去 revision を巻き戻す API ではない。現在の document から inverse の element replacement を新しい operation として送る。競合時は autosave を停止する。
- 保存中の別ユーザーを想定しないローカル利用でも、将来の autosave と明示保存の競合を同じ version 契約へ揃える。

この差分 API は将来提案であり、今回 `command.repository.ts`、`read.repository.ts`、`prisma/schema.prisma` を変更する根拠にはしません。

## 9. 既存データ互換性と schemaVersion

### 9.1 移行不要の範囲

自由線を複数 `stroke` 要素へ置き換える結果は、V1 がもともと許している `elements[]` と `points[]` の組み合わせです。そのため次を保証できます。

- 既存 `schemaVersion=1` の document は変更せず読み込む。
- 既存の 1200x800 document は自動変換しない。
- 既存 stroke / line / arrow / rect / ellipse / text の JSON shape は変えない。
- 新しい部分消去を一度も使わないノートには DB 差分がない。
- 部分消去後の document も V1 reader / viewer が通常の要素群として読める。
- `NotebookCanvas.schemaVersion` は document の `schemaVersion` と一致する 1 のまま。
- 用紙サイズ、要素 bounds、points、style、z を部分消去の都合で全体変換しない。

### 9.2 V2 が必要になる境界

次のいずれかを保存したくなった時点では、V1 に未知フィールドを足さず `CanvasDocumentV2` と dual-read / explicit migration を設計します。

- 一つの element 内に gap / multiple segments を保持する `segments` field。
- mask / clipPath / boolean path。
- fragment lineage を全て保持する `fragmentOf`、operation metadata。
- text の一部可視 / 非表示を検索にも反映する契約。
- Fabric-specific serialized object を正本に近い形で保存する契約。

現行 validation は unknown schema version を拒否するため、V2 が必要になったら API / mapper / viewer / server validation を同時に更新する別 migration task とします。今回の自由線分割では V2 を作りません。

## 10. 性能、保存サイズ、セキュリティ

### 10.1 性能上限

既存 document の上限に加え、gesture の一時処理で次を使います。

| 上限 | 推奨値 | 目的 |
| --- | ---: | --- |
| document elements | 1,000 | 既存 hard limit |
| stroke points 合計 | 20,000 | 既存 hard limit |
| serialized JSON | 2 MiB | 既存 hard limit |
| erase path samples | 2,048 | 長時間 pointer input のメモリ上限 |
| fragments created by one gesture | 256 | 病的な zig-zag による要素増殖防止 |
| UI radius | 4〜32 page px | 半径。直径 8〜64 px |

処理は、まず bounds で候補 stroke を絞り、その後 segment 距離を計算します。目標は通常の手書き document で pointer move の UI が追従し、pointer up の分割処理が 200ms 以内に完了することです。20,000 points の worst case は別測定とし、超過時は UI をブロックし続けず、未 commit のままエラー表示して戻します。

document 全体の JSON serialize と Fabric canvas 全体の再構成は、pointer move ごとには実行しません。最終 pointer up の一回だけ validation / serialize / history commit を行い、preview の再描画は requestAnimationFrame 単位で制御します。

### 10.2 セキュリティと堅牢性

- API は client が送る `searchText`、Fabric raw JSON、mask path を信頼せず、既存の V1 validation と server-side 再生成を使う。
- `NaN`、`Infinity`、負の寸法、points 2 点未満、未知 type、未知 schema version、過大要素数、過大 points、2 MiB 超過を拒否する。
- text は plain string として描画し、HTML / SVG markup として評価しない。viewer の補助表示も text node とする。
- Fabric object metadata は renderer 内部の一時値であり、API payload に直接シリアライズしない。
- mask / clipPath / data URL を将来追加する場合は、SVG injection、巨大 path、再帰的 group、画像 decode DoS を別の threat model として評価する。
- 部分消去の失敗は空 document への置換、部分結果だけの保存、未検証 JSON の親フォーム通知をしない。操作単位で atomic に失敗させる。

## 11. アクセシビリティと UX 詳細

- toolbar は `role="toolbar"` とし、`aria-pressed`、visible focus ring、disabled 状態を維持する。
- ラベルは `消しゴム（全体）` と `部分消去（自由線のみ）` を区別する。既存の `object erase` という補助説明を日本語でも確認できるようにする。
- radius input は number / range どちらでもキーボードで操作でき、現在値を `24 px` のように読み上げる。
- `部分消去（自由線のみ）` で図形へ触れたときは、何も起きない理由を live status へ出す。ただし pointer move ごとに大量の status 更新はせず、gesture 完了時に一度だけ通知する。
- 成功時は「自由線を 2 区間に分割しました」または「自由線を削除しました」と通知し、失敗時は「保存サイズ上限のため適用できません」のように原因を示す。
- `Escape` は erase gesture をキャンセルして選択モードへ戻す案を採用する。Undo は canvas viewport に focus がある場合だけ働かせ、text input の browser undo を奪わない。
- touch / pen では pointer capture を使い、画面をスクロールするジェスチャーと描画を混同しない。既存の `allowTouchScrolling` とページ全体の scroll への影響を runtime QA する。
- Canvas の意味は完全に screen reader へ変換できないため、既存の text element 補助リスト、toolbar、status、キーボードでの whole delete / undo を維持する。自由線 fragment 単位の screen reader 編集は対象外と明示する。
- 色だけで erase 対象 / 非対応を伝えず、文字ラベルと status を併用する。

## 12. テスト観点

### 12.1 Pure geometry / document テスト

次のケースを deterministic fixture で確認します。

| 観点 | 期待結果 |
| --- | --- |
| stroke に触れない | document が serialize 上同一。履歴 entry なし |
| middle を一回横切る | 2 fragment。元の最初の survivor が元 ID、次が新 ID |
| 始点を消す | 残り一 fragment。元 ID は最初の survivor へ移る |
| 終点を消す | 残り一 fragment。元 ID を保持 |
| 全区間を消す | stroke element 自体を削除 |
| 複数回横切る | 交差区間を union し、順序どおり複数 fragment |
| 同じ場所を往復 | fragment を重複生成しない |
| ちょうど境界に接する | `<= effectiveRadius + epsilon` の規則で消える |
| 高速 pointer move | 隣接サンプルを capsule として扱い、間に未消去の穴を作らない |
| 短い survivor | 2 点未満、または path length 閾値未満を保存しない |
| style / rotation / z | survivor の全 fragment が元値を継承。untouched は変更なし |
| ID | document 全体で重複なし。fragment は配列上で元位置に隣接 |
| line / arrow / rect / ellipse / text | partial mode では unchanged、object mode では全体削除 |
| page boundary | page 外へ要素を clipping しない。用紙寸法も変更しない |
| 320 / 1200 / 4000 page | 同じページ座標式で動作。固定 1200 に戻らない |
| 2 MiB / 20,000 points / 1,000 elements | 結果が上限を超える場合は操作全体を atomic に reject |
| serialize / restore | 分割後 V1 が round trip し、points と text が保持される |
| searchText | stroke 分割では不変。text whole erase では該当 text が消える |

### 12.2 History / persistence テスト

- pointer move 中に `past` の件数、親の `onDocumentChange`、API mock が増えない。
- pointer up 一回につき最大一つの history entry が追加される。
- erase → undo で元の一本、元 ID、元 points、元 z が戻る。
- erase → undo → redo で同じ fragment 構成へ戻る。
- 新しい erase 後に redo が破棄される。
- 明示保存 → reload → viewer で fragment が同じ位置・style・z で描画される。
- 既存の V1 fixture（1200x800、各 element type）が partial eraser 導入前後で読める。
- page resize の前後で要素 data と `searchText` が変わらない。
- 保存失敗 / validation error 時、親フォームと DB mock に部分結果を送らない。

### 12.3 Pointer / browser / accessibility テスト

- CSS 表示幅が page と異なる fit / 50% / 200% で同じ page coordinate を消す。
- devicePixelRatio 1 と 2 の環境で結果 JSON が同じになる。
- mouse、touch、pen、pointer cancel、pointer capture、canvas 外 pointer up を確認する。
- 320px 前後の狭い viewport、4000px の大きい page、ページ全体 scroll と canvas 内 scroll の干渉を確認する。
- toolbar の tab order、focus ring、`aria-pressed`、radius の keyboard 操作、live status、Escape、Undo / Redo を確認する。
- text input の Cmd/Ctrl+Z が Canvas history に奪われない。
- partial mode で図形に触れても消えず、whole mode へ切り替える案内が確認できる。

### 12.4 静的 / セキュリティ確認

- `npm run lint`、`npm run build`。
- schema version、finite number、要素数、points 数、JSON byte limit の validation 回帰。
- raw Fabric JSON、未知 style field、巨大 text、巨大 points、悪意のある SVG / HTML が正本へ入らないこと。
- 保存 JSON が `NotebookCanvas.documentJson` のみで、画像 asset、Fabric internal eraser、mask の別保存を作らないこと。

## 13. Gate 0 通過後の候補段階（未投入）

この節は、Gate 0 通過後に部分消しゴムを採用すると決めた場合の設計候補です。

現在の queue への投入順、実装開始、MVP の現行機能を示しません。

各候補の開始前に、現行の正本と `rg --files src` の結果を再確認します。

### 候補 0: この設計の確認（実装未着手）

対象: `doc/designs/CANVAS_PARTIAL_ERASER_DESIGN.md` と索引リンクのみ。

- 方式比較、要素別挙動、座標 / 半径 / 境界 / 上限、履歴、互換性、API 方針が確定している。
- `CanvasDocumentV1`、Fabric adapter、Prisma、DB、依存関係、生成物を変更しない。

### 候補 A（旧 Phase 1-A 相当）: 現行 object erase の回帰固定（Gate 0 通過後・未投入）

想定 task 名: `CANVAS-ERASER-001-object-erase-contract`

対象ファイル:

- `src/modules/notes/ui/components/canvas/editor.tsx`
- `src/modules/notes/ui/components/canvas/toolbar.tsx`
- `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`
- 既存の Canvas テスト fixture / `doc/testing/TEST_SCENARIOS.md` は実装 task の受け入れ証跡として必要な範囲だけ

実装内容:

- 現在の `erase` の一 gesture 一 history entry、shape / text / arrow group whole erase を回帰固定する。
- UI 表示を `消しゴム（全体）` または同等の誤解のない説明へする。
- pointer cancel、Escape、empty hit で不要な commit をしないことを確認する。
- partial mode の placeholder を先に導入する必要はない。既存 mode を壊さないことを優先する。

完了条件:

- 全 element type の whole erase が動き、Undo / Redo が一段で戻る。
- 既存 V1 fixture の save / reload / viewer に差分がない。
- schema、Prisma、API payload、依存関係を変更しない。

テスト:

- `EraseSession` の hit / no-hit / multi-object / group arrow / text 回帰。
- 50 history 上限と新規操作後の redo 破棄。
- `npm run lint`、`npm run build`、対象 route の手動確認。

### 候補 B（旧 Phase 1-B 相当）: 自由線の pure partial eraser（Gate 0 通過後・未投入）

想定 task 名: `CANVAS-ERASER-002-stroke-split-geometry`

対象ファイル:

- 新規候補 `src/shared/canvas/canvas-eraser.ts`（現時点では存在しない）
- `src/shared/canvas/index.ts`
- 必要最小限の Canvas document helper（既存の `src/shared/canvas/canvas-document-*.ts` を直接変更する場合は V1 契約を壊さない範囲に限定）
- pure geometry fixture / test file（新規候補。現時点では存在しない）

実装内容:

- `CanvasEraseGesture` の入力 validation、page-coordinate capsule 判定、polyline split、cut point rounding、short survivor removal、ID / z / style / bounds 規則を pure function として実装する。
- `line`、`arrow`、`rect`、`ellipse`、`text` はこの関数の partial target にしない。
- 結果を既存 `validateCanvasDocument()` と `serializeCanvasDocument()` で検証できる形にする。

完了条件:

- 本書 12.1 の geometry ケースを再現可能なテストで満たす。
- V1 の `schemaVersion=1`、既存 element shape、既存上限を維持する。
- input path、DPR、Fabric object を保存結果へ混ぜない。

### 候補 C（旧 Phase 1-C 相当）: Editor への partial mode 統合（Gate 0 通過後・未投入）

想定 task 名: `CANVAS-ERASER-003-editor-partial-stroke`

対象ファイル:

- `src/modules/notes/ui/components/canvas/editor.tsx`
- `src/modules/notes/ui/components/canvas/toolbar.tsx`
- `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`
- `src/shared/canvas/adapters/fabric/fabric-adapter.ts`
- 必要に応じて `src/modules/notes/ui/components/canvas/viewer.tsx`（V1 fragment の read-only 回帰だけ）

実装内容:

- `部分消去（自由線のみ）` の UI、radius state、pointer capture / cancel、page-coordinate mapping を追加する。
- pointer move では履歴、親通知、API 通信を行わず、pointer up で pure function の結果を一度だけ commit する。
- object erase の現行挙動は別モードとして維持する。
- shape / arrow / text に触れた際の非対応 status と assistive text を追加する。

完了条件:

- 1 gesture = 1 history entry、Undo / Redo、保存後 reload、viewer 描画、searchText 回帰が成立する。
- 50% / fit / 200%、DPR 1 / 2、mouse / touch / pen で同じ page geometry になる。
- page size を変えても既存 elements と `searchText` が変わらない。
- `fabricCanvasToDocument()` の bounds / arrow group を partial geometry の入力にしない。

### 候補 D（旧 Phase 1-D 相当）: Persistence / QA の回帰確認（Gate 0 通過後・未投入）

想定 task 名: `CANVAS-ERASER-004-persistence-qa`

対象ファイル:

- `src/server/notes/infrastructure/notebook.command.repository.ts`
- `src/server/notes/infrastructure/canvas.persistence.ts`
- `src/server/notes/infrastructure/read.repository.ts`
- `src/shared/canvas/index.ts`（公開 facade。Canvas document の実装は責務別ファイルに分割）
- `prisma/schema.prisma` は変更せず、変更不要であることを確認する
- `doc/testing/TEST_SCENARIOS.md` は、実装 task の証跡を追加する場合だけ更新対象にする

実装内容:

- 分割後 V1 の create / update / reload、size reject、text search、page resize 不変を確認する。
- server が client `searchText` を信頼せず再生成する現在の流れを確認する。

完了条件:

- 既存 Canvas note と新しい fragment note が同じ `NotebookCanvas` 保存領域で round trip する。
- 新しい DB table、column、migration、asset file がない。
- validation error が JSON 形式で返り、部分結果が保存されない。

### Phase 2: line / vector shape の再評価（未着手）

自由線の運用結果と runtime QA で必要性を確認できた場合だけ、別 task とします。

- line は 2 点の segment 分割を検証できるが、`line` の ID / z / bounds、切断後の複数 line の意味を別途固定する。
- arrow は shaft と矢尻の lifecycle を決めるまで partial 対象にしない。
- rect / ellipse は fill と outline の差分表現、編集・検索・export を定義するまで partial 対象にしない。
- text は whole erase / text editing を基本とし、字形 mask を導入しない。
- mask / Fabric raw JSON / raster は、V1 の延長として実装せず、採用するなら V2 の別設計・threat model・migration を必須とする。

## 14. 未決定事項と判断期限

次の事項は、runtime の体験または将来要件を確認して決めます。

1. radius の初期値 `12` page px が、5 px stroke、fit 表示、touch 操作で十分か。実機 QA で `8〜32` の範囲を調整する。
2. partial mode の非対応要素へ触れた時の status 文言と cursor 表現。挙動の契約は「非対応で変更しない」で固定する。
3. line の部分消去を本当に必要とするか。必要になっても自由線の Phase 1 完了後に別 task 化する。
4. autosave 初期実装で全体 snapshot と element replacement diff のどちらを採るか。2 MiB 上限と実測通信量を見て決め、どちらも一 gesture 一 mutation、base version、409 契約を守る。
5. element ID を外部参照する機能を将来導入するか。導入する場合は V1 の「一つだけ元 ID を継承」に依存せず、lineage field を含む V2 設計を先に行う。
6. 現在 package scripts に test runner がないため、pure geometry の自動テストを既存の検証基盤へ載せる方法は `CANVAS-ERASER-002` の開始時に確定する。テスト runner 導入を理由に部分消去の保存契約を広げない。

## 15. この設計で変更しないもの

- `CanvasDocumentV1` の既存 JSON shape、schemaVersion、page 寸法、要素上限、points 上限、2 MiB 上限。
- `NotebookCanvas.documentJson` と `searchText` の保存場所、`NotebookCanvas` の 1:1 関係。
- `POST /api/notes` / `PATCH /api/notes/:id` の現行 MVP 明示保存契約。
- 既存 Markdown 本文モード、Cue、Summary、検索、復習の順序。
- page resize 時に elements と `searchText` を変えない契約。
- 現行の object erase、Canvas snapshot history、viewer の read-only 表示。
