# フリースタイル・キャンバス導入方針と MVP 境界

作成日: 2026-07-18（JST）
種別: Worker 設計メモ（実装なし）
状態: Manager の次の coding task 発注用

## 結論

Manager 推奨は **方式2: Cue と Summary をテキストのまま残し、本文領域だけをキャンバス化するハイブリッド方式** です。

- Cornell の学習順序（Cue で想起 → 本文で確認 → Summary で要約）を画面構造・復習モードにそのまま残せる。
- 図、矢印、囲み、手書き線を本文の同じ紙面に置けるため、方式3より学習体験の仮説を検証しやすい。
- 既存の `Notebook.body`、Markdown 検索、既存ノートの閲覧・編集を壊さず、新規ノートだけキャンバスを選べる。
- Canvas の編集状態は DB 内のバージョン付き vector JSON とし、SVG/raster は表示・出力用に限定する。

新規ノートは `bodyMode="canvas"` を初期選択する案を推奨します。ただし、Canvas の操作性確認前に固定しないよう、最初の coding task では Markdown への切替も持たせ、初期値を定数または feature flag で変更可能にします。既存ノートは自動移行せず、常に Markdown として扱います。

## 1. 現行前提

現行 MVP の正本は `doc/implementation/MVP_CONTRACT.md` です。現在は次の構成です。

- `Notebook.body` に 1 本の Markdown 本文を保存する。
- `Cue` は `Notebook` に紐づく順序付きリスト、Summary は `Notebook.summary` の Markdown 文字列である。
- `POST /api/notes` と `PATCH /api/notes/:id` は本文、Cue、タグを含む全体を明示保存する。
- 一覧の `query` は title、`body`、summary、Cue text を検索する。並び順は noteDate desc、updatedAt desc。
- 詳細画面内の復習は Cue → 本文を表示 → Summary を開く順序で、Canvas 用の API や model はまだない。
- 削除は確認後の物理削除、バックアップは SQLite ファイルの手動コピーである。autosave、PDF export、カード分割、soft delete は現行 MVP 外である。

### 方式1の比較上の定義

「現在の Markdown 本文をキャンバスへ完全置換」を、ここでは **Cue・本文・Summary のコンテンツ面も一つの自由配置キャンバスへ統合し、構造化された Markdown 本文を持たない方式** と定義します。本文だけをキャンバスにして Cue と Summary をテキストで残す場合は方式2と同じになるため、方式1との差分がなくなります。

## 2. 3方式の比較

| 比較軸 | 1. 全面キャンバス | 2. 本文だけキャンバス（推奨） | 3. Markdown + 図の添付 / 埋め込み |
|---|---|---|---|
| Cornell の学習フロー | Cue、本文、Summary の領域を固定しにくい。復習時の「本文だけ隠す」「Summary を後で開く」を canvas の region/visibility で再実装する必要がある。 | Cue と Summary の意味・順序・非表示制御を既存のまま維持できる。本文だけ自由配置になり、Cornell の骨格を壊さない。 | 学習順序はそのまま。ただし本文と図が別編集面になり、図を見ながら本文を整理する体験が弱い。 |
| 自由描画・図形・矢印・テキスト | 最も自由。全要素を同じ座標系で扱えるが、自由度が高く構造制約がない。 | 本文領域に自由描画、線、矢印、図形、テキストを置ける。紙面の 30/70 と Summary を固定できる。 | 図の編集自体は可能だが、Markdown 本文への配置、サイズ変更、順序、表示位置を別途定義する必要がある。 |
| 保存形式 | vector JSON が必要。Cue/Summary の意味、領域、表示状態まで同じ document に入る。SVG は編集用の正本に向かず、raster は再編集できない。 | 本文 canvas の vector JSON だけを保存すればよい。Cue/Summary は既存の text/table のままなので、移行・validation の境界が小さい。 | Markdown と図の参照情報を保存する。画像 inline は DB 肥大、ファイル path はバックアップ漏れ、SVG inline は sanitize/編集互換の問題がある。 |
| SQLite / Prisma / API | Notebook の構造変更が大きく、Cue/Summary の既存 table と二重管理になりやすい。payload も全面的に変わる。 | `bodyMode` と optional 1:1 `NotebookCanvas` を追加する additive change。既存 POST/PATCH を拡張でき、Canvas JSON は別 table に分離できる。 | 添付 table、asset path/blob、Markdown embed 構文などを追加する。DB と filesystem の原子性・バックアップを同時に設計する必要がある。 |
| 既存ノート互換・移行 | Markdown を Cue/本文/Summary の canvas object に変換する必要がある。Markdown の見出し、表、checkbox、改行の意味が崩れる可能性が高い。 | 既存行は `bodyMode="markdown"` のまま。自動変換なし。新規 Canvas 行と既存 Markdown 行を同じ detail route で表示・編集できる。 | 既存 Markdown を完全に保持でき、図を後付けしやすい。ただし既存ノートの本文と図の関係は別管理になる。 |
| 一覧検索・Markdown 検索 | canvas object 内の text 抽出、region 判定、検索対象の定義が必要。検索結果からの本文表示も複雑になる。 | 既存 Markdown 検索を維持し、Canvas の text box だけを `searchText` に投影して検索対象へ追加できる。線・手書き・図形は非検索と明示できる。 | Markdown 検索は維持。添付内の text は通常検索できず、図の alt/注釈を別途保存しない限り検索漏れになる。 |
| バックアップ | JSON を SQLite 内に置けば単純だが、全紙面の巨大な document が Notebook 行に混ざると一覧取得が重くなる。 | `NotebookCanvas` も SQLite に置くため、既存の DB ファイルバックアップで完結する。list query では canvas JSON を読まない。 | filesystem asset を採ると現行の「DB ファイルだけコピー」では復元不能になる。DB inline は容量と payload が膨らむ。 |
| 将来 PDF export | 1 canvas の座標系をそのまま出せるが、Cue/Summary の印刷順・改ページ・検索テキストの意味を再実装する必要がある。 | Canvas 本文を SVG/PNG に描画し、既存の Cue/Summary と合わせて 1 ノート 1 ページへ組み立てやすい。固定 page 座標を採用すれば将来拡張しやすい。 | 図の render と Markdown の render を合成する必要がある。添付位置・サイズ・改ページの仕様が増える。 |
| undo/redo・選択・消去・zoom | 最も自然に実装できるが、Cue/Summary の編集履歴まで一つに統合すると責務が過大になる。 | Canvas 内だけ client history を持つ。テキスト欄の browser undo と衝突しない。bounded page と zoom を定義しやすい。 | 図 editor の履歴と Markdown editor の履歴が分離し、全体の undo の期待値を説明しにくい。 |
| モバイル・キーボード・アクセシビリティ | 全面 canvas はキーボード・スクリーンリーダーでの意味付けが最も難しい。 | Cue/Summary は従来の DOM input/Markdown を維持し、Canvas は toolbar と最小限の操作到達性に限定できる。デスクトップ優先という現行契約にも合う。 | Markdown は扱いやすいが、添付図の編集・選択・代替テキストの問題が残る。 |
| 外部ライブラリ・ローカルリスク | 高機能な editor SDK への依存がほぼ必須。SSR、bundle、license、保存形式のロックインが大きい。 | Canvas 部分だけに依存を閉じ込められる。候補を spike で比較し、app-owned JSON adapter を挟める。 | Markdown は既存のまま。図 editor と asset 管理だけを追加するため初期差分は小さいが、複数の保存経路を抱える。 |

**判定:** 方式1は自由度が高い代わりに、Cornell の意味・検索・互換性・accessibility を同時に作り直す。方式3は安全な段階導入だが「同じ紙面に図を置く」仮説の検証が弱い。方式2が、学習体験の改善量と既存資産の保全の釣り合いが最もよい。

## 3. 推奨案の具体化

### 3.1 正本データの分離

Canvas は vendor-specific な stage/tree をそのまま DB の正本にせず、アプリ所有の `CanvasDocumentV1` に変換する。Canvas ライブラリの JSON は adapter の内側だけで扱い、DB/API には次の意味だけを保存する。

```ts
type CanvasDocumentV1 = {
  schemaVersion: 1;
  page: { width: number; height: number; background: "paper" };
  elements: Array<{
    id: string;
    type: "stroke" | "line" | "arrow" | "rect" | "ellipse" | "text";
    x: number;
    y: number;
    width?: number;
    height?: number;
    rotation?: number;
    points?: Array<[number, number]>;
    text?: string;
    style: {
      stroke?: string;
      fill?: string;
      strokeWidth?: number;
      fontSize?: number;
    };
    z: number;
  }>;
};
```

- `selectedIds`、camera zoom、pointer state、undo/redo history、event handler は保存しない。zoom と選択は画面セッションの状態である。
- `eraser` は document element ではなく、対象 stroke/shape を削除する command とする。初期 MVP では pixel 単位の部分消去は提供しない。
- text element は plain text とし、Markdown/GFM、画像、HTML、URL embed は含めない。
- Server で schema version、座標の有限値、element type、要素数、stroke point 数、document byte size を検証する。初期上限の推奨値は 1 document 2 MB、1,000 elements、全 stroke 合計 20,000 points で、実測後に調整する。

### 3.2 Prisma / SQLite の変更案（実装しない）

`Json` scalar の provider 差分を避けるため、JSON は text として SQLite に保存する。Notebook の行に大きな JSON を混在させず、1:1 table に分ける。

```prisma
model Notebook {
  // 既存フィールドは維持
  bodyMode String @default("markdown") @map("body_mode")
  canvas   NotebookCanvas?
}

model NotebookCanvas {
  notebookId    String   @id @map("notebook_id")
  schemaVersion Int      @default(1) @map("schema_version")
  documentJson  String   @map("document_json")
  searchText    String   @default("") @map("search_text")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  notebook Notebook @relation(fields: [notebookId], references: [id], onDelete: Cascade)

  @@map("notebook_canvases")
}
```

`body` は既存の Markdown slot として残す。`bodyMode="canvas"` の新規ノートでは `body` は空文字にし、Canvas 内の typed text から作る `searchText` を検索用 projection として持つ。二つの本文をユーザーが別々に編集する dual canonical にはしない。

migration は `notebooks.body_mode` を既存行へ `"markdown"` の default 付きで追加し、`notebook_canvases` を作るだけにする。既存本文の変換、不要な `body` の削除、画像 asset table の追加は行わない。

### 3.3 API / repository の変更案

既存の全体明示保存を保ち、最初の MVP では新しい endpoint を増やしすぎない。

```json
{
  "title": "読書メモ",
  "noteDate": "2026-07-18",
  "sourceType": "book",
  "sourceTitle": "書籍名",
  "bodyMode": "canvas",
  "body": "",
  "canvas": {
    "schemaVersion": 1,
    "page": { "width": 1600, "height": 1200, "background": "paper" },
    "elements": []
  },
  "summary": "要点と次のアクション",
  "nextReviewDate": "2026-07-25",
  "cues": [{ "text": "重要語句", "order": 0 }],
  "tags": [{ "name": "読書", "color": null }]
}
```

- `notebookInputSchema` に `bodyMode: "markdown" | "canvas"` と optional `canvas` を追加する。未指定は `markdown` とする。`canvas` の必須条件、schema version、上限、`bodyMode` との整合性を検証する。
- `POST /api/notes` と `PATCH /api/notes/:id` は Notebook、Cue、Tag link、Canvas を同じ transaction で保存する。Canvas 保存時は `NotebookCanvas` を create/upsert する。
- `GET /api/notes/:id` は `bodyMode` と Canvas document を返す。`body`、Cue、Summary、タグの既存 response 形は維持する。
- `GET /api/notes` は Canvas document 本体を返さず、`bodyMode` / `hasCanvas` の表示用情報だけを返す。`query` は title、summary、Cue、legacy Markdown `body` に加え、`NotebookCanvas.searchText` を OR 条件で検索する。
- `searchText` は text element の本文だけを順序どおりに連結した派生値で、手書き線・図形・矢印は検索対象にしない。Canvas JSON と `searchText` は同じ transaction で更新し、手編集不可とする。
- `DELETE /api/notes/:id` は既存の cascade で Canvas も削除する。Undo/soft delete は追加しない。
- 既存の明示保存では十分だが、将来 autosave を導入する場合は payload 全体を毎回送らない `PATCH /api/notes/:id/canvas` を別 task で追加する。現行 MVP に autosave を持ち込まない。

### 3.4 保存形式の判断

| 形式 | 採用判断 | 理由 |
|---|---|---|
| vector JSON | **正本として採用** | 要素単位の選択・移動・削除・undo/redo・将来 migration が可能。SQLite の text としてバックアップに含められる。 |
| SVG | export/render 用 | 印刷・PDF の中間形式として有用。ただし editor の制御状態や app の意味を正本にしない。SVG import/export は完全な 1:1 互換でない場合があるため、正本にはしない。 |
| PNG/JPEG 等 raster | MVP の正本には不採用 | 描画後の選択・再編集・高倍率表示・検索ができず、品質と容量も解像度に依存する。将来の thumbnail/export のみ候補。 |
| 外部ファイル path / data URL | MVP では不採用 | 現行 backup は DB ファイルだけをコピーする。外部 asset を採るとバックアップと復元を別系統にする必要があり、data URL は DB/API を膨らませる。 |

## 4. 既存 Markdown 本文の互換性

| ノート | `bodyMode` | 表示・編集 | 移行 |
|---|---|---|---|
| 既存ノート | migration default の `markdown` | 現行 `MarkdownField` / `MarkdownPreview` を使用。検索・復習・sanitize は従来どおり。 | 自動変換しない。`body` の文字列を保持する。 |
| 新規 Markdown ノート | `markdown` | 現行と同じ。Cue/Summary も同じ。 | なし。 |
| 新規 Canvas ノート | `canvas` + `NotebookCanvas` | Cue は左の text list、本文は Canvas editor/viewer、Summary は下の Markdown field/viewer。 | `body` は空。Canvas の text element は `searchText` へ投影する。 |

既存ノートを編集しただけで Canvas に切り替えない。Markdown → Canvas の自動変換は表、checkbox、見出し、soft break の意味を失う可能性があるため、将来実装する場合も「原文を残した上で、Markdown 全体を一つの text object として import する」程度から始め、確認 UI と復元手段を別途設計する。Canvas → Markdown の自動変換も MVP 外とする。

detail route は同じ `/notes/[id]` のまま `bodyMode` で分岐する。Canvas の読み込みに失敗した場合は空白に置き換えず、schema version / payload のエラーを表示し、保存済み raw data を上書きしない。

## 5. UI 配置と学習フロー

既存の紙面中心 UI と 30/70 の Cornell 構造を維持する。

```text
タイトル / 学習日 / 学習元 / タグ
┌─ Cue / キーワード（約30%） ┊ ノート本文（約70%） ─────────────┐
│ Cue は通常の text list       ┊ Canvas toolbar                    │
│                              ┊ bounded paper canvas / viewer      │
└──────────────────────────────┴────────────────────────────────────┘
Summary / 要約と次の一歩（既存 Markdown field / preview）
次回復習日                                      キャンセル / 保存
```

- create/edit: Canvas toolbar は本文列の上に置く。ツールは `ペン / 消しゴム / 線 / 矢印 / 四角 / 円 / テキスト / 選択` に限定し、Canvas 内の選択・移動・削除・zoom を行う。保存は紙面 footer の既存明示保存を使う。
- view: 同じ位置に read-only Canvas viewer を置き、toolbar は zoom と表示用の最小操作だけにする。
- review: Cue を先に表示し、本文 Canvas は初期マスクする。「本文を表示」で viewer を開き、その後だけ Summary を開ける。`showBody` / `showSummary` は保存しない。
- Canvas は無限平面ではなく固定 page 座標の bounded surface とする。`50% / 100% / 200% / fit` の zoom と、単一オブジェクトの選択・移動・resize・削除を MVP の対象にする。
- モバイルは mouse/touch/stylus の Pointer Events で基本描画に到達できること、ページ全体に意図しない横 overflow がないことを確認する。専用モバイル toolbar、pressure sensitivity、handwriting recognition は MVP 外。
- Canvas の意味を完全に DOM と同等にするのは難しいため、Cue/Summary、toolbar、選択状態、text element の読み上げ可能な代替表示を最低限用意する。図形・手書き線の object-by-object screen reader 編集は別 task とする。

## 6. Canvas MVP に含めるもの

### 含める

1. ノートごとの `bodyMode`。新規ノートで Canvas / Markdown を選べること。既存ノートは Markdown 固定。
2. 固定 page canvas と保存・復元。初期 document schema version は 1。
3. ペン（freehand stroke）、object erase、直線、矢印、四角、円、plain text box。
4. 単一要素の選択、移動、resize、削除、Escape による選択解除。
5. Canvas 内の undo/redo。履歴は client memory のみ、保存 payload に含めない。`Cmd/Ctrl+Z` と `Cmd/Ctrl+Shift+Z` は Canvas に focus があるときだけ処理する。
6. zoom（50/100/200/fit）、mouse/touch/stylus の基本 Pointer Events、保存後の再読込。
7. Cue / Summary の既存 text-first UI、view/review の本文マスク → Summary 開示順序。
8. Canvas text element の `searchText` 投影と、既存の title / Markdown body / Summary / Cue 検索の維持。
9. accessible name 付き toolbar、focus ring、disabled/loading/error 表示、document 上限超過時の保存拒否。
10. Prisma migration、API validation、既存 fixture の読み込み、Canvas note の作成・編集・閲覧・復習の QA。

### 含めない

- Cue/本文/Summary を一枚の全面 canvas にする方式1。
- Markdown/GFM を Canvas text box で編集すること、Canvas ↔ Markdown の自動相互変換。
- 画像、ファイル、貼り付け asset、外部 URL embed、sticky note、rich text、table、code block。
- pixel 単位の消しゴム、複数選択、group/ungroup、rotate、layer panel、snap/grid、infinite canvas、minimap。
- autosave、draft、optimistic lock、409 競合、server-side undo、revision history、collaboration。
- PDF/PNG/SVG export、thumbnail、印刷専用 layout。将来は vector JSON から SVG を生成する別 task とする。
- 本格的なモバイル編集最適化、pressure sensitivity、手書き文字認識、object 単位の完全な screen reader 操作。
- 既存 Markdown ノートの自動 Canvas 化、Canvas から Markdown への復元、既存本文の破棄を伴う mode 切替。

## 7. 主なリスクと回避策

| リスク | 回避策 |
|---|---|
| Canvas の図・手書きが検索・accessibility から孤立する | Cue/Summary を DOM text として維持し、typed text だけ `searchText` に投影する。図の検索不可を UI/契約に明記し、Canvas 本文の補足説明は Summary/Cue に書けるようにする。 |
| editor library の JSON にロックインする | DB/API は `CanvasDocumentV1`、library は adapter 内だけ。document schema version と migration 関数を用意する。 |
| freehand point 数や JSON payload が増え、SQLite/API/再描画が重くなる | separate table、list query から document 除外、element/point/byte 上限、履歴非保存、明示保存を採用する。 |
| 既存 Markdown が消える・変換で意味が変わる | migration default を `markdown` にし、自動変換・既存 mode 切替を MVP から外す。Canvas note の `body` は空 slot とし、raw Markdown を上書きしない。 |
| 将来 PDF で紙面と違う結果になる | infinite canvas ではなく固定 page 座標を採用し、render adapter を正本 JSON から作る。PDF は今回の受け入れ対象にしない。 |
| Next.js/React の SSR、bundle、license、local-only 実行に依存する | client-only boundary、production build、offline 起動、bundle size、license と asset の確認を先に spike する。tldraw は JSON snapshot/migration が強い一方、公式 SDK は production license key が必要なため、個人ローカル利用でも採用判断を分ける。 |

## 8. 外部ライブラリの判断

現行 `package.json` に Canvas editor はないため、ペン・選択・図形・touch を自前で実装するか外部 library を追加する必要がある。推奨の評価順は次のとおりです。

1. **Fabric.js を第一候補として spike**: object model、free drawing、選択、JSON/SVG 出力が要件に近い。ただし DB 正本には Fabric JSON を直接保存せず、app-owned JSON へ変換する。
2. **Konva/react-konva を比較候補**: shape/event/drag/transform と mobile pointer は扱いやすいが、toolbar、history、state serialization、accessibility はアプリ側の責務が増える。公式 docs も stage JSON より application state を保存する方針を示しているため、adapter 設計とは整合する。
3. **tldraw は高機能候補だが初期採用を保留**: persistence snapshot、schema migration、history、accessibility は魅力的。しかし公式 SDK は production license key が必要で、hobby license には watermark 条件がある。ローカル個人利用でも将来の配布・production 判定を先に決める必要がある。

参照した公式資料: [Fabric.js core concepts](https://fabricjs.com/docs/core-concepts/)、[Konva serialization best practices](https://konvajs.org/docs/data_and_serialization/Best_Practices.html)、[tldraw persistence](https://tldraw.dev/docs/persistence)、[tldraw license](https://tldraw.dev/community/license)。

## 9. QA 観点

次の coding task の受け入れでは、既存 Markdown と Canvas の両方を fixture で確認する。

| 領域 | 確認内容 |
|---|---|
| schema / migration | 空 DB と既存 DB の migration、既存 Notebook の `bodyMode=markdown`、Canvas 1:1、Notebook delete 時の cascade、Prisma validate/generate。 |
| API | markdown payload の後方互換、canvas payload の create/update/read、schema version/上限/不正 type、`bodyMode` と canvas の不整合、検索、list で JSON を返さないこと。 |
| 保存復元 | 各 tool の作成 → 明示保存 → route refresh → detail 再読込で座標、順序、text、style が一致すること。空 Canvas、長い text、上限境界も確認する。 |
| Cornell / review | Cue は常時先に見える、Canvas 本文は初期非表示、本文表示後のみ Summary 開示、view/edit/review の mode state が混ざらないこと。 |
| interaction | pointer draw、touch、選択、移動、resize、delete、object erase、undo/redo、zoom、Escape、textarea 上の browser undo と Canvas shortcut の非干渉。 |
| compatibility | 既存 Markdown note の表示・編集・検索・復習・backup が従来どおりで、Canvas schema を理解しないデータを空白上書きしないこと。 |
| responsive / a11y | 375 / 768 / 1280 / 1440px、ページ全体の横 overflow、Cue 30/本文70、toolbar keyboard focus、aria-label、disabled/loading/error、Canvas 以外の input 到達性。 |
| performance / local | document 上限内の保存・再表示、list query の payload、`npm run lint`、`npm run build`、Prisma migration、ネットワーク遮断下の起動と操作、SQLite backup 後の復元。 |

## 10. 未決事項（3件以内）

| ID | 決めること | 選択肢と影響 | Manager 推奨 |
|---|---|---|---|
| U-01 | 新規ノートの初期本文モード | Canvas default は仮説検証が速いが、未成熟な操作で離脱するリスク。Markdown default は安全だが Canvas 利用率が下がる。 | Canvas default + Markdown 切替。初期値は定数/feature flag で変更可能にする。既存ノートは Markdown 固定。 |
| U-02 | editor library の最終選定 | Fabric.js は要件に近い。Konva は低レベルで自由だが実装量が増える。tldraw は高機能だが production license/watermark を確認する必要がある。 | まず Fabric.js / Konva の小規模 spike。tldraw は license 条件を受け入れる判断が先。 |
| U-03 | Canvas text search と document 上限を MVP 契約へ固定するか | searchText を持つと既存の検索契約を保てるが、projection と上限 validation が増える。非対応なら Canvas text が一覧検索できない。 | typed text の `searchText` projection を MVP に含め、2 MB/1,000 elements/20,000 points を初期値として実測で調整する。 |

## 11. 次の coding task 発注案

### CANVAS-001: Canvas editor 技術 spike と保存契約の固定

**目的:** Prisma/API を変更せず、Fabric.js と Konva の候補から、現行 Next.js 16 / React 19 / local-only 前提に合う実装基盤を選ぶ。

**対象:** 新規 client component または隔離した検証 route、app-owned `CanvasDocumentV1` adapter、toolbar/Pointer Events の最小 POC。

**含める:** pen、line、arrow、rect、ellipse、text、single select/move/delete、object erase、undo/redo、zoom、serialize/restore、mouse/touch、keyboard focus、SSR/build、bundle size、license確認。

**含めない:** Prisma schema、migration、API、既存 NoteEditor の接続、autosave、既存ノート移行、画像 asset、PDF export。

**完了条件:** 候補ごとに保存 JSON の例、app-owned schema への変換可否、Next build/lint、local/offline 起動、375/1440px の overflow、操作上の未解決点を summary に残す。CANVAS-001 の結果を受けて CANVAS-002（hybrid の DB/API/UI 実装）を発注する。

## Task Summary

### Objective

フリースタイル Canvas を導入する方式を比較し、Cornell の学習フロー、既存 Markdown 互換、SQLite/Prisma/API、検索・backup・将来 export、interaction/accessibility、外部 library のリスクを踏まえた MVP 境界を定義する。

### Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | 製品方針、保存形式、Canvas MVP、既存互換、API/DB 設計、QA、次の coding task |
| 対象ファイル / ディレクトリ | `summary/20260718/1113-freestyle-canvas-policy.md` のみ |
| 対象外 | コード、設定、依存関係、Prisma schema/migration、DB、生成物、通常の仕様書、queue 管理ファイル |

### Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-17.md` | 現行紙面 UI、MVP/Phase 2 境界、未コミット方針、Next Read |
| 契約 | `doc/implementation/MVP_CONTRACT.md` | 現行 route、Markdown body、Cue/Summary、API、検索、保存、backup、mobile/a11y 境界 |
| 実装状況 | `doc/implementation/IMPLEMENTATION_STATUS.md` | 実装済みの現行 MVP と Phase 2 未実装項目 |
| DB | `prisma/schema.prisma` | Notebook、Cue、Tag、NotebookTag の現行 schema |
| validation/model | `src/modules/notes/contracts/note.schema.ts`, `src/modules/notes/model/note-editor-form.ts` | request payload、Cue、body、Summary、tag validation、form 初期値 |
| UI | `src/app/notes/_components/note-editor.tsx`, `note-detail-modes.tsx`, `src/shared/markdown/markdown-field.tsx` | create/edit/view/review、Markdown preview、Cue/Summary 配置、復習開示順序 |
| API/repository | `src/app/api/notes/**`, `src/server/notes/**`, `src/modules/notes/remote/index.ts` | CRUD payload、検索条件、mapper、transaction、list/detail response |
| external docs | Fabric.js / Konva / tldraw 公式資料 | vector JSON、SVG、snapshot/migration、license、保存時の注意 |

### Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260718/1113-freestyle-canvas-policy.md` | 3方式比較、方式2の推奨、CanvasDocumentV1、Prisma/API案、互換方針、MVP範囲、QA、未決事項、CANVAS-001案を記録 | 次の coding task を発注可能にするため |

### Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-01 | fact | 現行 MVP の本文は `Notebook.body` の 1 本の Markdown、Cue は別リスト、Summary は `Notebook.summary`。 | `MVP_CONTRACT.md`、`prisma/schema.prisma`、現行 repository |
| F-02 | fact | 現行 MVP に Canvas model/API/library はなく、保存は明示保存、backup は SQLite file copy。 | `IMPLEMENTATION_STATUS.md`、`package.json`、API/repository |
| F-03 | assumption | Canvas の typed text は検索用 projection にでき、図形・手書きは検索対象外とする。 | 推奨設計。CANVAS-002 で Zod/上限とともに検証する |
| F-04 | assumption | Canvas は固定 page 座標で扱い、無限キャンバスを採用しない。 | Cornell 紙面、将来 PDF、local payload 上限との整合 |
| F-05 | unknown | 新規 Canvas default、editor library、searchText/上限を正式契約へ入れる最終判断。 | U-01〜U-03 |

### Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 実施 | 多数の既存未コミット変更を確認し、保持した |
| 設計メモ要件 | PASS | 比較表、推奨、MVP/非対象、互換、DB/API、QA、未決事項、次 task を記載 |
| コード/設定/schema/migration/DB/生成物変更 | なし | 設計メモ 1 件のみを追加 |
| lint/build | 未実施 | コード変更なし。次の実装 task で実施する |

### Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-01 | 新規ノートの Canvas default | CANVAS-001 の操作性 QA と Manager の product decision |
| U-02 | Fabric.js / Konva / tldraw の最終採用 | client-only build、bundle、pointer、license、保存 adapter の spike |
| U-03 | typed text 検索と document 上限の正式値 | fixture での保存/再描画/performance と API validation QA |

### Next Read

- `HANDOFF_2026-07-17.md`
- `doc/implementation/MVP_CONTRACT.md`
- `summary/20260718/1113-freestyle-canvas-policy.md`
- `src/app/notes/_components/note-editor.tsx`
- `src/app/notes/_components/note-detail-modes.tsx`
- `src/modules/notes/contracts/note.schema.ts`
- `prisma/schema.prisma`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
- `src/server/notes/infrastructure/command.repository.ts`
- `src/server/notes/infrastructure/read.repository.ts`
