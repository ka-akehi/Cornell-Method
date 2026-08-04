# Mock UI redesign scope (2026-08-02)

> 2026-08-03 substantive audit addendum: この文書は 2026-08-02 の scope 記録を保持したまま、現在の未コミット UI 差分を read-only 監査した結果を追記する。コード、設定、依存関係、生成物、画像は変更していない。今回の成果物変更はこの summary のみ。

## Objective

`floating-tooltip-mockup.png` と現行 UI の差分を実装可能な単位へ整理し、次段の Worker が共通シェル、ノート紙面、Canvas toolbar、一覧、バックアップを安全に分割実装できる scope・依存関係・受け入れ条件を固定する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | 共通シェル、ナビゲーション、note paper、詳細、編集／新規、Canvas toolbar、一覧、バックアップの視覚棚卸しと task 分割 |
| 対象ファイル | `src/app/_components/app-chrome.tsx`、`src/app/styles/*.css`、指定された route wrapper、notes list/detail/editor/canvas components、backup page component |
| 対象外 | コード実装、API、DB、Prisma、Canvas JSON、保存動作、依存関係追加、画像の組み込み、queue state の編集 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| モック | `floating-tooltip-mockup.png` | 左常設 nav、暖色シェル、連続罫線、Cornell paper、toolbar、tooltip、狭幅例 |
| 引き継ぎ | `HANDOFF_2026-08-01.md` | 前回の UI contract、検証境界、Next Read |
| 実装 | `src/app/_components/app-chrome.tsx`、`src/app/styles/{foundation,app-shell,note-paper,note-canvas-editor,note-canvas-toolbar,note-canvas-surface}.css` | 共通 shell、紙面、Canvas の現行構造と breakpoint |
| 実装 | `src/app/notes/**`、`src/app/backup/**`、`src/modules/notes/ui/components/{list,detail,editor,canvas}/**`、`src/modules/backup/ui/components/backup-page.tsx` | 各 route wrapper と component 責務 |
| 契約 | `doc/implementation/MVP_CONTRACT.md`、`doc/implementation/IMPLEMENTATION_STATUS.md` | canonical route、MVP API、Canvas 保存、MVP 対象外機能 |
| 既存 test | `test/notes/*contract.test.js`、`test/backup/*test.js` | title spacing、action 位置、toolbar、list、backup の既存境界 |

## Changes Made (scope record)

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260802/mock-ui-redesign-scope-20260802.md` | 本棚卸しと次段 task 計画を新規作成。2026-08-03 に実質監査 addendum を追記 | Worker task の指定成果物 |
| コード／設定／API／DB／Canvas JSON／画像 | この Worker では変更なし | read-only 棚卸しの制約 |

この scope record 作成時点の status 記述は、現在の 2026-08-03 audit の baseline ではない。現在の baseline と作業後 status は、下記「実質監査」と「Verification」を正とする。既存の source / test / handoff / summary / 画像の dirty state は保護し、上書き・整理・削除していない。

## Findings (scope record, 2026-08-02)

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 現行 AppChrome は上部 sticky header、nav は `/notes` と `/notes/new` のみ。 | `src/app/_components/app-chrome.tsx`、`src/app/styles/app-shell.css` |
| F-002 | fact | note paper は既に continuous heading border、30/70 Cornell grid、Canvas surface、responsive CSS を持つ。 | `src/app/styles/note-paper.css`、`note-canvas-*.css` |
| F-003 | fact | 現行 MVP は `/notes`、`/notes/new`、`/notes/[id]`、`/backup` が canonical route。 | `doc/implementation/MVP_CONTRACT.md` §3 |
| F-004 | fact | title metadata 外側 `!p-0`、title input padding、編集キャンセルの title row 配置、連続 title border、review metadata border 不要は既存境界。 | `test/notes/*spacing*contract.test.js`、`detail-actions-layout-contract.test.js` |
| F-005 | fact | 作業中に `src/app/styles/note-canvas-toolbar.css`、`src/modules/notes/ui/components/canvas/toolbar-actions.tsx`、`toolbar.tsx`、`test/notes/canvas-toolbar-responsive-contract.test.js` の変更を検出した。 | 作業前後の `git status --short` / `git diff --stat` |
| F-006 | fact | 検出した変更は `codex-queue/tasks-ui/done/implement-floating-canvas-tooltip-20260802-a00cf784.task.md` の対象と一致し、描画 tool の portal tooltip、clamp / 上下切替、focus 対応を実装する別 coding task の完了後に現れた。 | 対象 task と source diff、`summary/20260802/1828-implement-floating-canvas-tooltip-20260802-a00cf784-summary.md` |
| A-001 | assumption | モックの左 nav 項目のうち現行 route がないものは、route/API の判断まで表示しない方が安全。 | 現行 MVP route/API とモックの不一致 |
| U-001 | unknown | Canvas toolbar 4 ファイルの変更を UI-05 の実装済み成果として採用するか、追加 UI task として扱うか。 | 別 coding task は done だが、この Worker はその内容の runtime QA を行っていない |

## Findings (実質監査, 2026-08-03)

### Status baseline と分類

作業前の `git status --short` は tracked 31 件（変更 30、削除 1）と untracked 33 件だった。untracked は summary 26、contract test 5、`HANDOFF_2026-08-03.md` 1、`floating-tooltip-mockup.png` 1 に分類できる。`git diff --stat` は tracked 31 ファイル、`1,720 insertions / 430 deletions` であり、untracked はこの統計に含まれない。

| status | 領域別ファイル分類 |
|---|---|
| `M` | `AGENTS.md`、AppChrome／shell（`src/app/_components/app-chrome.tsx`、`src/app/styles/{app-shell,foundation}.css`）、paper／route wrapper／detail／editor（`src/app/notes/**`、`src/app/styles/note-paper.css`、detail components、`editor/cues.tsx`）、Canvas（`src/app/styles/note-canvas-*.css`、`canvas/{editor,toolbar-actions,toolbar}.tsx`）、list（`src/modules/notes/ui/components/list/**`）、backup（`backup-page.tsx`）、既存 contract test 6 件。 |
| `D` | `HANDOFF_2026-08-01.md`。最新 `HANDOFF_2026-08-03.md` が untracked で追加されている。 |
| `??` | 追加 contract test 5 件（`test/notes/{app-chrome-responsive,detail-paper-layout,editor-paper-layout,list-visual}.contract.test.js`、`test/backup/backup-page-visual-contract.test.js`）、`floating-tooltip-mockup.png`、2026-08-02〜03 の summary 26 件（本 summary を含む）。 |

この分類は `git status --short` と `git diff --name-status` の read-only 出力に基づく。untracked summary は product source の変更とは分け、画像は参照資産として扱う。

| 領域 | evidence-backed 内容 | 判断 |
|---|---|---|
| AppChrome / app shell | `app-chrome.tsx:196-221,289-315,319-451` は `isRailOpen` と `isMobileNavOpen`、desktop handle / mobile button の別 ref、breakpoint 時の focus 復帰、native `hidden` rail、mobile dialog / focus trap / `inert` を実装する。`app-shell.css:10-62,283-434` は rail edge handle、collapsed width 0、`900/901px` media boundary を持つ。 | **採用候補（静的確認済み）**。DOM／state の責務分離は `desktop-sidebar-collapse-dom-design-20260803.md:390-426` と整合する。 |
| paper / detail / editor | `note-paper.css:2-31,203-281,351-479` と detail/editor wrapper の変更は、continuous divider、Cornell 30/70、Canvas と Cue の局所 scroll、640/900px の縮退を調整する。route、save、review、delete、Markdown / Canvas 分岐の source 契約は変えていない。 | **採用候補。ただし runtime QA 必須**。 |
| Canvas / toolbar | `toolbar-actions.tsx:105-190` は button anchor を測って `createPortal` する floating tooltip、`toolbar.tsx:45-63` は drawing tool に floating mode を指定する。`editor.tsx:229-241` は page だけを更新し、既存要素を再配置しない。API、DB、Canvas JSON schema、`searchText` の保存領域は変更されていない。 | **視覚差分は採用候補、最終受入れは保留**。tooltip／scroll／pointer の実機確認が必要。 |
| notes list | `list.tsx` の fetch、debounce、date/tag/reviewDue/pagination の流れは維持される。`card.tsx:10-24,77-80` は model の `reviewStatus.label` を残し、badge class を `nextReviewDate` からローカル計算する。 | **採用候補だが判断待ち**。レビュー状態の色を旧 model class から amber/neutral 系へ置換したため、色の意味とコントラストを browser QA で確認する。 |
| backup | `backup-page.tsx:24-83,125-136` は `fetchBackups`、`createBackup`、request id / mounted guard を維持し、visual token と `status` / `alert` semantics のみを調整する。 | **採用候補（visual only）**。manual backup、最新 3 世代、`GET/POST /api/backups` の MVP 境界に影響なし。 |
| contract test | 変更・追加された AppChrome、paper、Canvas、list、backup の source/CSS contract は、今回の関連実行で 46 subtests 全件 PASS。 | **静的 regression guard として採用候補**。exact class、DOM 順序、regex に結び付くため、browser acceptance の代替にはしない。 |
| 運用記録 / 画像 | `AGENTS.md` の最新 handoff pointer、旧 handoff の削除、新 handoff、26 summary、`floating-tooltip-mockup.png` は運用・設計記録／参照画像であり、実行時 UI の証拠ではない。 | **記録として保留／採用**。画像は静的組み込み・生成物ではない。PR の product diff と混同しない。 |

### Fact / assumption / unknown

| ID | 種別 | 判断に必要な内容 | 根拠と残るリスク |
|---|---|---|---|
| F-101 | fact | AppChrome の desktop edge handle と mobile navigation は別責務で実装され、collapsed desktop では `aside#app-chrome-rail` が native `hidden` になる。 | `app-chrome.tsx:319-451`、`app-shell.css:22-62,405-434`、関連 contract PASS。 |
| U-102 | unknown / static risk | 1280/1440px の rail edge、handle の 44px hit area、z-index、focus ring、main controls との重なりが実画面で成立するか。collapsed 時は rail-region が width 0、handle が width 44px・`right: 0`・`translateX(50%)` なので、LTR の viewport 左端では幾何上およそ x=-22〜22px になる。 | 設計は handle が clip されず main を覆わないことを要求する。半分が viewport 外へ出るか、focus ring / click target が欠けるかを screenshot、`getBoundingClientRect()`、pointer test で確認し、再現時だけ CSS 修正を発注する。 |
| F-103 | fact | mobile overlay は `hidden`、open 時の dialog semantics、panel focus、Tab trap、Escape/backdrop close、body overflow restore、background `inert` の static 実装を持つ。 | `app-chrome.tsx:228-286,402-449`、`app-shell.css:283-303`。computed accessibility tree は未確認。 |
| U-104 | unknown | 900/901px resize、375/768px mobile の overlay、focus 復帰、scroll lock、screen-reader tree、paper/canvas より前面の stacking が runtime で成立するか。 | `desktop-sidebar-collapse-dom-design-20260803.md:413-426` の未実施 acceptance。 |
| F-105 | fact | paper / Canvas の変更は既存の MVP route、明示保存、Canvas page-only resize、既存 element geometry/style/text 不変の契約を変えていない。 | `MVP_CONTRACT.md:40-49,58,65-66,165-185`、`editor.tsx:229-241`。 |
| U-106 | unknown | paper shell の `overflow: hidden` と Cornell / Canvas の局所 scroll が 1024/900/768/640/375px、長い Cue、長い Summary、large page で page-wide overflow を作らないか。 | `note-paper.css:2-14,388-479`、`note-canvas-surface.css:18-50,96-114` は static evidence のみ。 |
| F-107 | fact | Canvas tooltip は portal + `getBoundingClientRect` + viewport clamp、toolbar は accessible name / `aria-describedby` / `title` / visible label を保持する。 | `toolbar-actions.tsx:24-190`、`canvas-toolbar-responsive-contract.test.js:70-105`。 |
| U-108 | unknown | tooltip の hover/focus、画面端上下切替、scroll/resize 更新、Canvas wheel/trackpad/touch と描画操作の干渉、用紙変更後の保存／再読込を実機で確認できていない。 | static contract は runtime を証明しない。既存 status でも mobile と Canvas scroll の追加 QA は未確認／BLOCKED と記録されている。 |
| F-109 | fact | list / backup の network、validation、request guard、MVP endpoint は変更されず、変更の中心は visual class と status semantics。 | `list.tsx:90-177`、`backup-page.tsx:24-83`、visual contract PASS。 |
| A-110 | assumption | `nextReviewDate` に基づく amber/neutral badge は旧 `reviewStatus.className` の赤／青／緑の意味を置き換えても、利用者にとって十分に識別できる。 | `card.tsx:10-20` の変更意図は静的に読めるが、仕様で色の意味を固定した根拠はない。視覚・コントラスト確認と Manager 判断が必要。 |
| U-111 | unknown | `/backup` を global nav に追加するか。現行 AppChrome は `/notes` nav と `/notes/new` create link のみだが、`IMPLEMENTATION_STATUS.md:44` は 3 nav と記載する。 | `app-chrome-contract.test.js:144-161` は `/backup` を除外する一方、status 文書は不一致。UI 差分採用前に文書／導線方針を決める。 |
| F-112 | fact | contract test は source/CSS の存在、DOM 順序、class、media rule を固定するが、computed style、real focus、pointer、screen-reader tree、API response は検証しない。 | 46 subtests PASS は静的証拠の範囲に限定する。 |

### 採用範囲と保留線

- **採用候補**: AppChrome DOM/state 分離、paper token / spacing、Canvas の局所 scroll と floating tooltip の static implementation、list / backup の visual token、関連 source contract test。
- **保留**: 上記を「受入れ済み UI」とする判断、AppChrome の desktop/mobile runtime、paper overflow、Canvas tooltip／gesture／save-reload、list review badge の色、`/backup` global nav の文書不一致。
- **追加修正が必要と現時点で断定できるコード所見**: なし。ただし collapsed handle の静的 geometry risk はあり、browser で再現した場合は採用前に修正が必要。現在の evidence だけで推測の coding task は追加しない。

## 背景

`floating-tooltip-mockup.png` を閲覧し、現在の UI を「ツールチップ単体」ではなく、共通アプリシェル、ノート紙面、Canvas toolbar、一覧・バックアップ画面まで含む視覚方針へ段階的に寄せるための実装範囲を棚卸しした。

この scope record の Worker は調査と実装計画の作成だけを行った。モック画像、コード、設定、依存関係、API、DB、Canvas JSON、生成画像は変更していない。作業開始時の status は当時の scope record における値であり、現在の audit baseline ではない。

現行 MVP の正本である `doc/implementation/MVP_CONTRACT.md` と `doc/implementation/IMPLEMENTATION_STATUS.md` も確認した。現行 MVP の canonical route は `/notes`、`/notes/new`、`/notes/[id]`、`/backup` であり、`/notes/backup`、`/tasks/review`、Undo / autosave / PDF export は今回の UI task に混ぜない。

## モックから抽出した UI 方針

### シェルとナビゲーション

- 画面全体は、暗い緑の上部ヘッダーではなく、暖色の紙面を思わせる低彩度の背景を基調にする。
- 左側に常設の縦ナビゲーションを置く。ブランド、現在位置の強調、薄い縦罫線、下部の補助ナビゲーション、新規ノート導線を一つのレールとして扱う。
- 現在位置は低彩度のアンバー／黄土色の塗りで示し、通常のリンクは濃いグレー、背景はほぼ白〜アイボリーにする。
- アプリシェル、サイドレール、ノート紙面を薄い連続ボーダーで区切る。強いグラデーションや大きな影は使わず、影は紙面の浮きを示す最小限にする。
- ナビゲーションはキーボードフォーカスと `aria-label` を維持する。モックに見える項目でも、現行 route がないものを推測でリンク化しない。

### 色、罫線、角丸、Typography、spacing

- 色は役割ベースの token に分ける: `app-background`、`surface`、`paper`、`ink`、`muted-ink`、`line`、`line-strong`、`accent`、`danger`、`focus`。
- `foundation.css` の現在の紙面 token は再利用候補だが、現在の `body` の濃緑 gradient と `chrome` token はモックの方向と異なるため、シェルの task で扱う。
- 罫線は基本 1px、細く連続させる。カードごとの重い枠線を増やさず、タイトル行、Cornell の列境界、Summary の上境界など意味のある場所に限定する。
- 角丸はシェル・入力・操作ボタンの小さな半径を基本にする。タグの pill は既存機能として残すが、画面全体を pill/card の集合にはしない。
- 見出しは濃いチャコール、本文は読みやすい濃いグレー、補助ラベルは小さく低コントラストにする。タイトルは視認性を保ちつつ、現在の title input / H1 の内部 padding を設計判断なしに変更しない。
- 余白は 8 / 12 / 16px を軸に、上下の段差を揃える。現在の `clamp()` による responsive spacing は活用し、全 CSS を固定値へ置換しない。

### タイトル行とメタデータ

- タイトルと右側アクションを同一行に置く。編集時の「キャンセル」はタイトル右側に置く既存の決定を維持する。
- タイトル行の下部ボーダーはタイトル文字や input の幅だけでなく、行全体に連続させる。editor では input 自身が二重線を描かないよう、heading 側の divider を正本にする。
- title metadata section の外側 `!p-0` は維持する。タイトル input の内部 padding は勝手に削除・追加しない。
- 学習日、学習元、タグ、次回復習日などの既存メタデータは機能として残す。モックで視認性が低いからといってフィールドを削除せず、紙面の主役であるタイトルを邪魔しない階層へ整理する。
- 復習日メタデータの上下ボーダーは追加しない。レビュー操作の footer と復習メタデータを混同しない。

### Cornell の紙面レイアウト

- Cue / キーワードを左約 30%、ノート本文を右約 70% に置く。中央本文は Markdown 本文欄ではなく、既存の Canvas 面をそのまま紙面へ収める。
- 2 列の間は一本の細い縦罫線で示す。Cue の各項目は独立したカードにせず、控えめな行区切りと番号／ラベルで読めるようにする。
- Summary は Cornell 行の下で全幅に連続させる。Summary の Markdown editor / preview は既存機能を残し、Canvas 本文を Markdown preview に混ぜない。
- 閲覧、編集、復習の各モードで同じ紙面の骨格を使い、モード固有の操作だけをタイトル行または footer に配置する。

### Canvas toolbar と浮遊 tooltip

- toolbar は紙面の上に浮く、薄い境界線と軽い影を持つコンパクトな操作レールにする。undo / redo、描画、消去、選択、文字、図形、style、用紙設定の役割は維持する。
- 選択中の tool はアンバー系の境界・背景で明示する。アイコン間の細い区切りでグループを読めるようにする。
- tooltip はボタンの直下に浮かぶ小さな紙片として表示し、短い見出し／説明と小さな caret を持たせる。hover だけでなく keyboard focus でも説明を得られるようにする。
- drawing rail の横スクロール、style controls の折り返し、用紙設定の狭幅折りたたみは現在の局所 responsive の方向を維持する。Canvas の物理ページが viewport より広い場合の局所スクロールと、アプリ全体の横 overflow を混同しない。
- toolbar の見た目を簡素化しても、`CanvasDocumentV1`、tool lifecycle、history、用紙寸法、`searchText`、保存タイミングは変更しない。

### レスポンシブ挙動

- 広い画面では左レールと紙面を並べる。紙面は最大幅を持たせつつ、タイトル、metadata、操作を詰め込みすぎない。
- 狭い画面では、タイトルと右側 action を折り返し、toolbar はアイコン列の局所スクロールまたは段階的な折りたたみで収める。紙面の外側が viewport-wide に横溢れしないことを優先する。
- Cornell の狭幅レイアウトを「30/70 を保つ」のか「Cue と本文を縦積みする」のかは、モックの縮退例と既存の 640px / 900px CSS の両方を確認して決める。物理 Canvas の横スクロールまで消してはいけない。
- 一覧・バックアップも同じ色・罫線・focus token を使うが、ノートの紙面専用 30/70 grid を無理に適用しない。

## 現行との差分

### 共通シェル・ナビゲーション

- `src/app/_components/app-chrome.tsx` は `header.app-chrome-header` の sticky 上部ヘッダーで、ブランド左・ナビ右の 2 列構成になっている。ナビは `/notes` と `/notes/new` の 2 リンクのみで、左常設レールではない。
- `src/app/styles/app-shell.css` は暗色 chrome の境界、影、上部 nav の hover/focus、`max-width: 72rem` の一般ページ幅、900px 以下でのヘッダー縦積みを定義している。モックの左レール・暖色シェルとは大きな差分である。
- `src/app/styles/foundation.css` の `body` は濃緑の radial/linear gradient、`--chrome` 系は濃緑、`--paper-*` 系は既にアイボリー／アンバー寄りである。紙面 token の一部は再利用できるが、body と chrome の役割は再設計が必要である。
- `/backup` は route として存在するが、現在の global nav には入口がない。モックの「フォルダ」「タグ」「テンプレート」「ゴミ箱」「設定」「ヘルプ」も現行 MVP の route / API と一致しない。

### ノート紙面・詳細・編集

- `src/app/styles/note-paper.css` は既に連続した `.note-paper-shell`、薄い border、軽い shadow、`.note-paper-heading` の全幅 divider、30/70 の Cornell grid、Summary footer、640px / 900px の縮退を持つ。モックに近い土台はある。
- 一方で shell はまだカード型の rounded surface で、アプリ全体の dark chrome と組み合わさっている。`note-paper-section` の section divider、入力の白／stone utility、モード操作の位置を、共通 token に寄せる余地がある。
- `src/modules/notes/ui/components/detail/read-view.tsx` は title/metadata、Cue、Canvas または legacy Markdown 本文、Summary、review/delete footer を一つの paper shell に組み立てる。`display.tsx` は Cue と metadata の表示、`actions.tsx` は title action と footer action、`modes.tsx` は閲覧／編集／復習の state と route query を担当する。
- `src/modules/notes/ui/components/editor/editor.tsx` は明示保存の form、`metadata.tsx` は title・日付・学習元・タグ、`body.tsx` は Canvas/Markdown 分岐、`cues.tsx` と `summary.tsx` は入力 UI を担当する。新規作成は `bodyMode: "canvas"` で開始し、編集は既存 note の state を保持する。
- 直近の UI task で、title metadata section の外側 `!p-0`、編集キャンセルのタイトル右配置、タイトル下部の連続 border、復習日メタデータの上下 border 不要という境界が既に source と contract test に反映されている。次 task でこれらを崩さない。

### Canvas

- `src/modules/notes/ui/components/canvas/toolbar.tsx` は drawing rail、style、erase、history、paper size の組み合わせで、`note-canvas-toolbar.css` は wide/tablet/mobile の grid area と局所スクロールを定義している。
- 現行 toolbar はラベル付きの複数グループで、drawing rail では `showTooltip={false}` かつ CSS でも tooltip を非表示にしている。モックの icon-first toolbar と、選択中 pen の浮遊 tooltip には差分がある。
- `toolbar-actions.tsx` は `aria-pressed`、`title`、visually hidden description、hover/focus tooltip を持つ。見た目を変更する場合も accessible description と既存の操作対象を削除しない。
- `note-canvas-surface.css` は物理 `page.width` / `page.height` の固定 px surface と局所スクロールを扱う。ここを表示倍率のように変えたり、要素を再配置したりしてはいけない。

### 一覧・バックアップ

- `/notes` は `NotesList` が header、新規作成、検索 form、error、results を `space-y-5` で縦に並べる。filters は query / From / To / tags / reviewDue、results は白い rounded card、header divider、divide-y の note card、pagination という汎用カード UI である。
- `src/modules/notes/ui/components/list/card.tsx` はタイトル・学習日・学習元・Cue 件数・Summary 有無・タグ・review status を表示し、`list.tsx` の debounce / 即時検索 / pagination state は UI 変更と分離できる。
- `/backup` の `BackupPage` は header、手動作成／一覧更新、success/error、最新 3 世代の白い section を持つ。`src/app/backup/page.tsx` は wrapper のみで、バックアップ API は `GET/POST /api/backups` の MVP 契約である。
- どちらもモックの紙面レイアウトとは異なるが、ノートの 30/70 body を流用せず、同じ shell token・罫線・button・focus 表現へ寄せるのが安全である。

## 画面別の実装 task 案

以下の task は一つの Worker が担当する範囲を小さくし、source の責務が重ならないように分ける。全 task 共通で、API / DB / route 契約、Canvas JSON、保存・検索・削除・復習動作、外部依存を変更しない。

### UI-01: 共通 token と左常設アプリシェル

- 対象画面: 全 route（`/notes`、`/notes/new`、`/notes/[id]`、`/backup`）。
- 対象ファイル: `src/app/_components/app-chrome.tsx`、`src/app/styles/foundation.css`、`src/app/styles/app-shell.css`。DOM wrapper が不可避な場合だけ `src/app/layout.tsx`、import 順序が必要な場合だけ `src/app/globals.css` を対象にする。
- 実装範囲: dark green の上部 header を、暖色 background と左 rail を持つシェルへ変換する。既存 route のリンク、landmark、focus state、main の紙面幅制約を維持する。現行 route のないモック項目は dead link として追加しない。
- 変更しない機能境界: route handler、navigation state 以外の page state、API、DB、ノート保存、Canvas、バックアップ操作。
- 完了条件: 広い画面で常設 rail と selected state が表示され、狭い画面で rail/header が破綻せず、紙面と一般ページの幅・横 overflow が分離される。`/backup` への導線を追加するかは未決事項の決定後に行う。
- 検証方法: `test/notes/app-chrome-contract.test.js` と対象 shell contract、1440 / 1024 / 768 / 375px のブラウザ確認、keyboard tab/focus、`npm run lint`、`npx tsc --noEmit --pretty false`。
- 依存関係: 最初に実施。UI-02、UI-06、UI-07 の token と外側レイアウトの前提になる。

### UI-02: note paper の共通 primitive と Cornell 骨格

- 対象画面: 詳細、編集、新規作成、復習モードの紙面部分。
- 対象ファイル: `src/app/styles/note-paper.css`。Canvas の toolbar/surface 固有 CSS は UI-05 が所有する。
- 実装範囲: shell の紙色、薄い border、角丸、影、heading、metadata grid、section divider、30/70 divider、Summary footer、640px / 900px の paper responsive を token ベースに揃える。タイトル行の全幅 continuous border を heading に持たせる。
- 固定する境界: title metadata section 外側の `!p-0`、H1 / title input の現在の内部 padding、編集キャンセルの配置、復習日 metadata の上下 border 不要。section の divider と review action footer の境界を混ぜない。
- 完了条件: detail/editor が同じ paper primitive を使い、タイトル行→metadata→Cornell→Summary の罫線が連続し、二重線・不要な余白・review metadata の上下線がない。create 専用の透明 input / border の意図を壊さない。
- 検証方法: `test/notes/note-paper-spacing-contract.test.js`、`test/notes/detail-actions-layout-contract.test.js`、`test/notes/detail-title-section-spacing-contract.test.js`、`test/notes/editor-title-section-spacing-contract.test.js`、`test/notes/detail-review-metadata-border-contract.test.js` と responsive screenshot。
- 依存関係: UI-01 完了後。UI-03、UI-04、UI-05 の見た目の前提。

### UI-03: ノート詳細の閲覧／復習紙面

- 対象画面: `/notes/[id]` の閲覧モード、復習モード、not-found/error state。
- 対象ファイル: `src/app/notes/[id]/page.tsx`（wrapper の確認・必要最小限の class のみ）、`src/modules/notes/ui/components/detail/display.tsx`、`src/modules/notes/ui/components/detail/read-view.tsx`、`src/modules/notes/ui/components/detail/actions.tsx`、`src/modules/notes/ui/components/detail/modes.tsx`。
- 実装範囲: title と右 action、metadata の階層、Cue list、Canvas viewer / legacy Markdown body、Summary、review/delete footer を UI-02 の紙面へ接続する。モックの Cornell reading order と、復習時の本文／Summary 非表示 affordance を整える。
- 変更しない機能境界: `mode=edit` query、閲覧／編集／復習 state、`POST /api/notes/:id/review`、確認後の物理削除、Canvas viewer の document clone / render。
- 完了条件: title/action が同一行、Cue と本文が 30/70、Summary が全幅、review metadata に上下 border がなく、編集へ進む／復習する／一覧へ戻る／削除する既存操作が動く。not-found も新しい shell で読める。
- 検証方法: `test/notes/detail-actions-layout-contract.test.js`、`test/notes/detail-mode-url-contract.test.js`、`test/notes/cue-display-contract.test.js`、`test/notes/cue-heading-contract.test.js`、ブラウザで view/review/edit 遷移と Canvas viewer を確認。
- 依存関係: UI-02 後。UI-05 の toolbar は viewer には不要だが、Canvas paper token の整合確認は UI-05 と連携する。

### UI-04: 編集・新規作成の metadata / input / Cornell form

- 対象画面: `/notes/new`、`/notes/[id]?mode=edit`。
- 対象ファイル: `src/app/notes/new/page.tsx`（wrapper の確認・必要最小限の class のみ）、`src/modules/notes/ui/components/editor/editor.tsx`、`editor/metadata.tsx`、`editor/inputs.tsx`、`editor/body.tsx`、`editor/cues.tsx`、`editor/summary.tsx`、`editor/tags.tsx`。編集 title action の呼び出し契約は UI-03 の `detail/actions.tsx` と連携する。
- 実装範囲: title metadata section、学習日／学習元／タグ、Cue input、Canvas/legacy Markdown body、Summary preview、保存／キャンセルの紙面階層を整える。編集キャンセルは title row 右側、新規作成の footer cancel は既存の意図を維持する。
- 変更しない機能境界: 明示保存のみの MVP、`POST /api/notes` / `PATCH /api/notes/:id` payload、title/date/tag/Cue validation、Markdown preview の sanitize、Canvas document callback、`bodyMode` 分岐。
- 完了条件: editor と detail で title divider の位置が一致し、外側 `!p-0` と title input 内部 padding を維持する。保存後の遷移、キャンセル、validation error focus、タグ上限、Cue 追加／削除、Summary preview が従来どおり動く。
- 検証方法: `test/notes/editor-metadata-contract.test.js`、`test/notes/note-editor-enter-submit-contract.test.js`、`test/notes/editor-error-focus-contract.test.js`、`test/notes/markdown-preview-contract.test.js`、`test/notes/canvas-initial-tool-contract.test.js`、新規→保存→詳細、既存→編集→キャンセル／保存のブラウザ確認。
- 依存関係: UI-02 後。UI-05 の Canvas toolbar は `NoteEditorBodySection` 内の editor を利用するため、toolbar の markup/class 変更がある場合は連携する。

### UI-05: Canvas toolbar、tooltip、surface の responsive styling

- 対象画面: 編集中の Canvas 本文領域（詳細閲覧の viewer は既存表示を維持）。
- 対象ファイル: `src/app/styles/note-canvas-editor.css`、`src/app/styles/note-canvas-toolbar.css`、`src/app/styles/note-canvas-surface.css`、`src/modules/notes/ui/components/canvas/toolbar.tsx`、`toolbar-actions.tsx`、`toolbar-icon.tsx`、`toolbar-paper-controls.tsx`、`toolbar-style-controls.tsx`、`toolbar-style-input.tsx`、`toolbar-alignment-controls.tsx`。必要な integration class だけ `canvas/editor.tsx` を対象にする。
- 実装範囲: モックの compact icon-first rail、active pen の accent、区切り、浮遊 tooltip/caret、狭幅の rail scroll / style・paper controls 折りたたみを実装する。現在の `title`、`aria-label`、`aria-describedby`、`aria-pressed`、keyboard focus を維持する。
- 変更しない機能境界: `CanvasDocumentV1`、Fabric runtime、tool lifecycle、undo/redo、erase、style の保存先、`page.width` / `page.height` の意味、物理 Canvas surface、`searchText`、保存 API。
- 完了条件: toolbar が paper 上でモックの密度と階層になり、hover/focus の tooltip が画面端で破綻せず、狭幅でも viewport-wide 横 overflow を作らない。drawing rail の局所 scroll と Canvas page の局所 scroll は残る。
- 検証方法: `test/notes/canvas-toolbar-responsive-contract.test.js`、`test/notes/canvas-toolbar-visibility-contract.test.js`、`test/notes/canvas-scroll-contract.test.js`、Canvas toolbar の keyboard / pointer / tooltip と、用紙寸法変更→保存→再読込の browser regression。
- 依存関係: UI-01 と UI-02 後。UI-04 の body へ組み込まれるため、UI-04 と並列に進める場合は class/markup contract を先に固定する。

### UI-06: ノート一覧の visual conversion

- 対象画面: `/notes`。
- 対象ファイル: `src/modules/notes/ui/components/list/list.tsx`、`list/filters.tsx`、`list/tags.tsx`、`list/results.tsx`、`list/card.tsx`、`list/feedback.tsx`、`list/pagination.tsx`。`src/app/notes/page.tsx` は wrapper のため原則変更しない。
- 実装範囲: header と新規作成 button、検索領域、tag tokenizer/select、review toggle、結果行、empty/loading/error、pagination を暖色 token と細い divider へ寄せる。ノート紙面の 30/70 grid や Canvas toolbar を流用しない。
- 変更しない機能境界: query debounce、From/To validation、tag OR 条件、reviewDue、pagination、`fetchNotesList` / `fetchTagOptions`、検索対象（Canvas `searchText` を含む）。
- 完了条件: list が共通 shell と同じ ink/line/accent/focus を使い、結果の title/date/tag/status が読みやすく、狭幅で filter と card が折り返す。検索中・空・エラー状態も同じ visual language になる。
- 検証方法: `test/notes/list-filter-layout-contract.test.js`、`test/notes/list-filter-live-search-contract.test.js`、`test/notes/list-header-contract.test.js`、一覧の query/date/tag/reviewDue/pagination の browser regression、1440 / 768 / 375px screenshot。
- 依存関係: UI-01 後に UI-02 と並列実施可能。

### UI-07: バックアップ画面の visual conversion

- 対象画面: `/backup`。
- 対象ファイル: `src/modules/backup/ui/components/backup-page.tsx`。`src/app/backup/page.tsx` は wrapper のため原則変更しない。
- 実装範囲: page header、manual backup button、refresh、success/error、最新 3 世代 list を共通 shell token、細い divider、控えめな紙面 surface へ寄せる。mock にない機能を増やさない。
- 変更しない機能境界: `fetchBackups`、`createBackup`、loading/error/request id、最新 3 世代、`GET/POST /api/backups`、backup provider / DB。
- 完了条件: 一覧／作成操作の affordance と status message が暖色シェル上で読みやすく、狭幅でファイル名・path・日時・button が重ならない。現在の manual backup の動作が変わらない。
- 検証方法: `test/backup/database-url-resolution.test.js`、`test/backup/local-sqlite-backup-provider.test.js`、`test/backup/filename-collision.test.js`、`npm run lint`、ブラウザで空状態→作成→更新→error 表示を確認。
- 依存関係: UI-01 後に UI-06 と並列実施可能。UI-02 の note paper CSS には依存させない。

### UI-08: 全画面 responsive / visual regression QA

- 対象画面: 全 canonical route と detail の view/edit/review state。
- 対象ファイル: UI-01〜UI-07 で変更されたファイル、および必要なら UI contract test の追加・更新のみ。API、DB、Canvas persistence の source は対象外。
- 実装範囲: 画面間の token、left rail、paper width、title divider、button/focus、mobile collapse の矛盾を統合確認する。個別 task の責務を越えるリファクタリングはしない。
- 完了条件: 1440 / 1024 / 768 / 375px で主要画面が崩れず、意図しない viewport-wide horizontal overflow がなく、Canvas の local scroll だけが必要箇所に残る。主要操作と既存 contract が全て PASS する。
- 検証方法: in-app Browser / Playwright の screenshot と interaction、`git diff --check`、`npm run lint`、`npx tsc --noEmit --pretty false`、`npm run build`、関連する `node --test` 一式。
- 依存関係: UI-03〜UI-07 の完了後。UI-01 と UI-02 の token / geometry が固定されていることが前提。

## 依存関係

```text
UI-01 shared tokens + app shell
  ├── UI-02 note paper primitives
  │     ├── UI-03 detail / review
  │     ├── UI-04 editor / create
  │     └── UI-05 Canvas toolbar
  ├── UI-06 notes list
  └── UI-07 backup

UI-03 + UI-04 + UI-05 + UI-06 + UI-07
  └── UI-08 responsive / visual regression QA
```

推奨順は UI-01 → UI-02 → UI-03 / UI-04 / UI-05、UI-06 / UI-07 は UI-01 後に並列、最後に UI-08 である。UI-02 で token と paper geometry を先に固定してから component markup を調整すると、detail と editor が別々の spacing 方針になるリスクを減らせる。

### 一括で全 CSS を置換する案のリスク

- `foundation.css`、`app-shell.css`、`note-paper.css`、Canvas CSS、Tailwind utility が同じ画面で重なっているため、全置換すると CSS の import 順序・specificity・`!` utility の優先順位を同時に壊しやすい。
- 既に contract test で固定されている title metadata section の外側 `!p-0`、title input の内部 padding、title row の全幅 border、編集キャンセルの位置、review metadata border 不要が意図せず退行する。
- Canvas toolbar のクラスを一般的な button style で上書きすると、drawing rail の局所 scroll、tooltip の hover/focus、ARIA description、用紙設定の mobile collapse が壊れる可能性がある。
- body の背景や `app-main` の幅を一括変更すると、note paper の outer gutter、一般ページの max width、物理 Canvas のページ幅が連鎖して viewport overflow を起こす。
- list / backup は note paper とは異なる情報密度と状態表示を持つため、共通 CSS の一括置換で全てを同じカードへ押し込むと、loading/error/empty と操作 button の視認性が落ちる。

そのため、まず役割 token と外側シェルを固定し、既存の `note-paper-*` / `note-canvas-*` namespace を活用しながら、画面単位で小さく変更する。各 task の直後に focused contract と responsive screenshot を確認し、最後に全体 lint / typecheck / build を行う。

## 完了条件

- モックから抽出した色、背景、角丸、罫線、Typography、spacing、left rail、title action、Cornell 30/70、Summary、Canvas toolbar、tooltip、responsive の方針が次の Worker が実装できる粒度で定義されている。
- 共通シェル、note paper、detail、editor/create、Canvas toolbar、list、backup、統合 QA の task が、対象ファイル、完了条件、検証方法、依存関係付きで重複なく整理されている。
- 現行 MVP の route / API / 明示保存 / 物理削除 / 手動復習 / backup の境界が明記され、未実装の Phase 2 機能を UI task に混ぜていない。
- Canvas JSON / API / 保存動作、`page.width` / `page.height` の意味、既存要素の geometry / style、Canvas `searchText`、Prisma / DB を変更しない境界が明記されている。
- 既確定の `!p-0`、title input padding、編集キャンセル位置、continuous title border、review metadata border 不要を保持する方針が明記されている。
- 一括 CSS 置換のリスクと段階実装の推奨順が明記されている。

## 検証方法 (scope record, 2026-08-02)

### scope record 時点で実施した確認

- scope record 作成時点の `git status --short` を確認し、当時の未追跡画像を閲覧のみとした。これは現在の 2026-08-03 baseline ではない。
- `HANDOFF_2026-08-01.md` を読み、前回の branch / UI contract / 未確認境界を確認した。
- `src/app/_components/app-chrome.tsx`、`src/app/styles/{foundation,app-shell,note-paper,note-canvas-editor,note-canvas-toolbar,note-canvas-surface}.css`、canonical route wrapper、list/detail/editor/canvas/backup components を読み取った。
- `doc/implementation/MVP_CONTRACT.md` と `doc/implementation/IMPLEMENTATION_STATUS.md` で route、API、Canvas persistence、MVP 対象外機能を照合した。
- scope record 時点では生成物・アプリコード・設定・依存関係・API・DB・Canvas JSON・画像は変更せず、lint / typecheck / build は実行していない。現在の audit の検証結果は下記に分離した。

### 次段 coding task で必須にする確認

- focused contract: `app-chrome-contract`、`note-paper-spacing`、`detail-actions-layout`、`detail-title-section-spacing`、`editor-title-section-spacing`、`editor-metadata`、`detail-review-metadata-border`、`canvas-toolbar-responsive`、`canvas-toolbar-visibility`、`canvas-scroll`、`list-filter-layout`、`list-header`。
- browser / screenshot: 1440 / 1024 / 768 / 375px で `/notes`、`/notes/new`、`/notes/[id]` の view/edit/review、`/backup` を確認する。title/action wrap、left rail、tooltip、local Canvas scroll、viewport-wide overflow、loading/error/empty を見る。
- regression: note 作成→保存→詳細、既存 note 編集→キャンセル／保存、review、delete confirmation、list search/date/tag/reviewDue/pagination、backup create/refresh を確認する。
- repository checks: `git diff --check`、`npm run lint`、`npx tsc --noEmit --pretty false`、`npm run build`。Canvas の用紙寸法変更では API / JSON の既存要素不変と保存後復元を確認する。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS（記録済み） | tracked 31（変更30・削除1）、untracked 33（summary26・test5・handoff1・画像1）。既存 dirty state は変更していない |
| `git diff --check` | PASS | whitespace error なし |
| 関連 Node contract test | PASS | `node --test` の変更・関連 17 files、46 subtests。全件 PASS |
| `npm run lint` | PASS | ESLint 成功 |
| `npx tsc --noEmit --pretty false --incremental false` | PASS | TypeScript no-emit 成功。incremental file は作成していない |
| `sh tools/check-summary.sh summary/20260802/mock-ui-redesign-scope-20260802.md` | PASS | summary の運用見出し・形式を確認 |
| `npm run build` | 未実行 | この Worker の明示的な境界。build は生成物を作る可能性があり、今回の read-only audit 対象外 |
| Browser / Playwright runtime QA | 未実行 | desktop 1280/1440、900/901、mobile 375/768、focus/accessibility tree、overflow、Canvas tooltip/gesture/save-reload は PASS と判定しない |
| 作業後 `git status --short` | 確認済み | 作業前に存在した source/test/handoff/画像に加え、この summary の内容だけを更新。reset/stash/checkout/clean 等は未実行 |

## 未決事項

- 左常設ナビを狭い画面で「常に表示する細い icon rail」「hamburger で開閉する」「上部へ縮退する」のどれにするか。
- モックの「フォルダ」「タグ」「テンプレート」「ゴミ箱」「設定」「ヘルプ」を表示するか。現行 MVP に対応 route / API がないため、dead link を作らない方針を推奨する。`/backup` を nav に追加するかも同時に決める。
- title metadata（学習日、学習元、タグ、復習日）をモックの title row 下に常時表示するか、detail/editor で compact に折りたたむか。フィールド削除はしない。
- モックの狭幅例で Cornell 30/70 を維持するのか、Cue と本文を縦積みにするのか。現行 CSS は detail の一部 breakpoint で横 scroll、640px 以下で stack するため、実機で比較して決める。
- Canvas toolbar の tooltip を hover/focus 時だけ表示するか、active tool の補助説明を一定時間表示するか。drawing rail の現在の `showTooltip={false}` を変更する場合、視覚仕様と keyboard/accessibility 仕様を合わせて決める。
- 正確な token 値、フォント family、アイコンの種類（既存 inline SVG を整えるか、新規 icon dependency を許可するか）。新しい依存関係は追加しない方針を推奨する。
- `/notes` と `/backup` を note paper shell と同じ一枚紙に見せるか、共通暖色 surface の別 page とするか。Cornell 用 grid は list/backup に適用しない。

## Remaining Unknowns (2026-08-03 audit)

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-102 / U-104 | AppChrome の desktop edge、900/901 resize、mobile overlay、focus trap、inert、z-index、accessibility tree | design summary §9 の runtime acceptance を browser / Playwright で実施 |
| U-106 | paper / Cornell / Canvas の local scroll と page-wide overflow | 1280/1024/900/768/640/375px の screenshot、長文・large page fixture |
| U-108 | Canvas floating tooltip、wheel/trackpad/touch、drawing interference、page resize 後の保存／再読込 | tooltip hover/focus/edge、pointer/scroll、API request/GET の browser evidence |
| U-110 | list review badge の amber/neutral 色が旧 review status の意味を十分に伝えるか | Manager の visual policy 判断、コントラストと状態別 screenshot |
| U-111 | `/backup` global nav の status 文書と AppChrome source/test の不一致 | `/backup` 導線を採用するか、`IMPLEMENTATION_STATUS.md` を別の docs task で是正するか決定 |
| O-001 | dirty worktree の所有者・統合順序 | Manager がこの棚卸しと browser QA の後に次の coding / integration task を発注。未承認の reset / checkout はしない |

## Next Read

次の Manager / Worker は、browser QA または統合判断に入る前に以下を最小限だけ読む。

1. `summary/20260802/mock-ui-redesign-scope-20260802.md`
2. `HANDOFF_2026-08-03.md`
3. `summary/20260803/desktop-sidebar-collapse-dom-design-20260803.md`
4. `summary/20260803/0043-implement-desktop-sidebar-edge-handle-20260803-342fab85-summary.md`
5. 対象 source: `src/app/_components/app-chrome.tsx`、`src/app/styles/{foundation,app-shell,note-paper,note-canvas-editor,note-canvas-toolbar,note-canvas-surface}.css`、list/detail/editor/canvas/backup components
6. focused contract: `app-chrome-*`、`note-paper-spacing`、`detail-paper-layout`、`editor-paper-layout`、`canvas-scroll`、`canvas-toolbar-responsive`、`list-*`、`backup-page-visual`
7. 受け入れ境界が必要な場合のみ `doc/implementation/MVP_CONTRACT.md`、`doc/implementation/IMPLEMENTATION_STATUS.md`、`doc/testing/TEST_SCENARIOS.md`
