---
summary_type: diagnosis-summary
created_at: 2026-07-18 00:07 JST
task_kind: worker-task
task_status: done
---

## Objective

`/notes/new` が他画面と異なって見える症状を、共通ヘッダーの構成差と紙面の余計な線に分けて静的診断した。実装は行わず、次の Worker が適用できる最小修正方針と未確認範囲を固定する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | `/notes/new` の route wrapper、AppChrome / AppChromeState、create form の罫線と背景画像 |
| 対象ファイル / ディレクトリ | `src/app/notes/new/page.tsx`, `src/app/notes/[id]/page.tsx`, `src/app/notes/_components/note-editor.tsx`, `src/app/notes/_components/note-detail-modes.tsx`, `src/app/_components/app-chrome.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/shared/markdown/markdown-field.tsx`, `src/app/notes/_components/notes-list.tsx`, `doc/screens/assets/mockups/mvp-paper-note-canvas-concept.png`, `doc/screens/assets/mockups/mvp-paper-note-canvas-mock.html`, `AGENTS.md`, `HANDOFF_2026-07-17.md`, 直近 task summary |
| 対象外 | コード、設定、依存関係、DB、生成物、ユーザーの既存未コミット変更の実装変更。`npm run dev/start/build` は実行していない。 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-17.md` | 紙面 UI の正本、共通 chrome の責務、runtime QA 未実施、次回確認観点 |
| repository rules | `AGENTS.md`, `summary/README.md`, `summary/task-summary-template.md` | Worker の保全・summary・検証ルール |
| previous summaries | `summary/20260717/2347-align-new-note-header-only-906c1319-summary.md`, `summary/20260717/2355-retry-reduce-new-note-extra-lines-only-b489c55c-summary.md` | 直近 task の完了状態と、実表示未確認の継続 |
| route/layout | `src/app/notes/new/page.tsx`, `src/app/notes/[id]/page.tsx`, `src/app/layout.tsx`, `src/app/notes/page.tsx` | create/detail/list の wrapper と AppChrome の入口 |
| header/state | `src/app/_components/app-chrome.tsx`, `src/app/notes/_components/note-detail-modes.tsx` | header DOM、path state、component state override、edit の state 登録 |
| form/CSS | `src/app/notes/_components/note-editor.tsx`, `src/app/globals.css`, `src/shared/markdown/markdown-field.tsx` | create DOM と border/background/gradient の全線源、および現在の未コミット selector |
| visual reference | `doc/screens/assets/mockups/mvp-paper-note-canvas-concept.png`, `doc/screens/assets/mockups/mvp-paper-note-canvas-mock.html` | 残す線・避ける重複線の視覚基準 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260718/0007-diagnose-new-note-header-and-lines.md` | 診断結果と次の実装方針を追加 | 次 Worker の再開起点を残すため |

## Worktree Preservation

作業前の `git status --short` は次の状態だった。既存の変更は戻していない。

- `M src/app/globals.css`
- `M src/app/notes/_components/note-editor.tsx`
- 既存の未追跡 summary 5 件

上記 2 ファイルの diff は作業前に読み取り、今回の source 変更は行っていない。`note-editor.tsx` の `note-paper-editor--create` class と `globals.css` 末尾の create 専用 selector は、ユーザーの未コミット変更として保持した。

## Findings

### Header symptom: same shared implementation, not a `/notes/new`-only header DOM

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| H-001 | fact | `layout.tsx` は `body.app-body` の中で `AppChrome` を一度だけ描画し、`AppChrome` が `<header class="app-chrome-header">` と `<main class="app-main">` を共通生成する。 | `src/app/layout.tsx:11-19`, `src/app/_components/app-chrome.tsx:104-170` |
| H-002 | fact | `/notes/new` は `note-paper-page` → `NoteEditor mode="create"`、詳細成功経路は `note-paper-page` → `NoteDetailModes` で、route wrapper は同じ。詳細 edit でも `NoteEditor shell={true}` が同じ paper shell を生成する。 | `src/app/notes/new/page.tsx:3-7`, `src/app/notes/[id]/page.tsx:38-42`, `src/app/notes/_components/note-detail-modes.tsx:250-267` |
| H-003 | fact | `AppChromeState` は JSX から `null` を返し、DOM の header を追加せず、`useEffect` で context の state だけを更新する。create は path state と component state がともに `create`、detail は path の `view` を edit/review component state が一時的に override する。 | `src/app/_components/app-chrome.tsx:33-68`, `src/app/_components/app-chrome.tsx:75-102`, `src/app/notes/_components/note-editor.tsx:155`, `src/app/notes/_components/note-detail-modes.tsx:184`, `:252` |
| H-004 | fact | header の brand、nav、state slot、CSS は route-specific class を持たない。`note-paper-editor--create` は form 自身と子孫だけを対象にするため、ancestor の `.app-chrome-header` を変えられない。 | `src/app/_components/app-chrome.tsx:106-170`, `src/app/globals.css:52-181`, `:487-514` |
| H-005 | fact | `/notes` だけは AppChrome の下に page-local な `.app-page-header`（「ノート一覧」＋説明＋新規作成ボタン）を持つ。`/notes/new` と `/notes/[id]` はこの list header を持たず paper title を持つため、これを「共通ヘッダー差」と見ている場合は別症状。 | `src/app/notes/_components/notes-list.tsx:124-139` |
| H-006 | unknown | 実画面でユーザーが見た「ヘッダーが違う」の具体的な差分（brand/nav の位置か、state badge の文言/幅か、list page-local header か）は browser で確認できていない。 | browser runtime の target が空、localhost:3000 も応答なし |

結論として、`/notes/new` 固有の二重 header、brand/nav の別 DOM、page wrapper による AppChrome の迂回は静的には確認できない。state badge の文言が `新規作成` になることは mode 差であり、header 構造差ではない。次の実装 Worker は `app-chrome.tsx`、`layout.tsx`、`new/page.tsx` を header 修正対象にしない。

### Line inventory and current selector coverage

| 線源 | 現在の実装 | 現在の create selector の効果 | 方針 |
|---|---|---|---|
| 紙面外枠 | `.note-paper-shell` の `border: 1px solid ...` | 対象外 | 残す。concept PNG の紙面外周に対応する。 |
| 紙面全体の横罫線 | `.note-paper-shell` の `background-image: repeating-linear-gradient(...)` (`globals.css:247-253`) | `border-color` selector では変わらない | 最有力の未解消原因。create shell の外側（title/meta/overview/Summary/footer）にも線を描き、Cornell 内では grid の gradient と二重化する。次の最小修正候補は同一要素を明示する `.note-paper-editor--create.note-paper-shell { background-image: none; }`。 |
| メタ帯の下線 | `.note-paper-meta-grid { border-bottom: 1px solid ... }` | 対象外 | 残す。concept の meta 帯と Cornell の境界を一組で表す。shell gradient だけを除いて重複をなくす。 |
| メタ項目の縦線 | `.note-paper-meta-item { border-left: 1px ... }` | `border-top: 0` では消えない | desktop の項目間 separator は残す。640/900px の responsive top border は create selector が抑制するが、900px 付近の border-left は残るため runtime で確認する。 |
| section 区切り | `.note-paper-section { border-top: 1px ... }` | `.note-paper-editor--create > .note-paper-section { border-top: 0 }` が direct child の create sections に適用される | 現在の抑制は selector scope/order 上は届いている。残る線があれば section border ではなく shell gradient、Cornell border、Preview/footer の別線源を疑う。 |
| title 見出し帯 | JSX の `.note-paper-heading !border-b-0 !pb-0` が共通 `.note-paper-heading` の下線を抑制 | create CSS も title heading には不要 | heading の下線は重複させない。 |
| title input | `.note-paper-title` は `border-0 border-b border-stone-300`。create selector は `:not(.note-paper-title)` で意図的に除外 | 下線は残る。focus/error も残る | concept の補助 mock は title input の下線を定義しているため、現時点では残す。ユーザーの対象線だと確認できた場合だけ別判断にする。 |
| Cornell 上下境界 | `.note-paper-cornell-grid` の `border-top` / `border-bottom` | 対象外 | 残す。metadata と Summary の大きな構造境界。 |
| Cornell 中央線 | `.note-paper-cornell-grid > :first-child { border-right }`、640px 以下は JSX の `max-[640px]:!border-b` で Cue/本文の横分割 | 対象外 | 必須。30/70 の視覚的な中央線であり、mobile の横分割も残す。 |
| Cornell 本文横罫線 | `.note-paper-cornell-grid` の第二の `repeating-linear-gradient` (`globals.css:350-361`) | 対象外 | Cornell 内の一組だけ残す。shell gradient を消して二重描画を避ける。 |
| Cue empty | `note-paper-cue-empty` の dashed border | `border-color: transparent` が適用される | 通常時の空カード枠は消える。focus/error ではなく、cue 操作ボタンの border は残る。 |
| Cue item / textarea | `note-paper-cue-item` の dashed `border-b`、Cue textarea の `border-b` | item は `border-color: transparent`、textarea は create textarea selector が通常時 transparent。focus/error の下線は残る | カード線と入力線の二重化は既に抑制されている。これ以上 global に消さない。 |
| 入力欄（date/source/tag/select/overview） | JSX/Tailwind の `border`, `border-stone-*`, `bg-white`, `shadow-sm`。UA border だけが原因ではない | 通常・非 error・非 focus の input/textarea/select は create selector が border color/background/shadow を抑制する | Tailwind v4 の通常 utility には後置かつ高 specificity で届く。focus/error affordance は残す。buttons は selector 対象外なので border が残る。 |
| Markdown textarea | `MarkdownField` の base `border` と呼び出し側の `!border-0 !border-b` | 通常時は create textarea selector が border color を透明化。`!` utility は主に width を指定し、border-color の原因ではない | 残る線を textarea border と誤認しない。 |
| Preview の見出し | `MarkdownField` の `h3.border-b` (`markdown-field.tsx:217-223`) | `.markdown-preview-surface` / `.markdown-preview-empty` selector は h3 に届かない | 現在も body/Summary 各 Preview に一行残る。concept に合わせて Preview の区切りを一組だけ残すか、消す場合は意味のある専用 class を追加して h3 一般を狙わない。 |
| Preview surface 下辺 | `markdown-preview-surface` / `markdown-preview-empty` の `border-b` | create selector が `border-bottom-color: transparent` にする | この線がまだ見えるなら、h3、grid/shell gradient、または Markdown content の table/blockquote を確認する。 |
| Preview の半透明背景 | `bg-[color:var(--paper-soft)]/70`、empty は `/40` | 現在の create selector は Preview background を対象にしない | grid/shell の gradient が半透明面を通して見える可能性がある。まず shell gradient を除き、まだ必要なら create scope の Preview surface 背景を opaque にする。 |
| Summary / footer | Summary section の top border は create selector で抑制。Cornell bottom border、Preview h3、`.note-paper-footer { border-top }`、buttons の border は残る | footer top と h3 は対象外 | PNG で確実に必要なのは Cornell→Summary の一つの全幅境界。Summary 内に repeated rule を持ち込まず、footer top はその境界と重複する場合だけ create scope で削る。spacing と保存 button は残す。 |
| 動的 Markdown の線 | ReactMarkdown の table cell border、blockquote の left border、checkbox は内容に応じて生成 | create form selector の対象外 | 内容由来の線をフォーム罫線と混同しない。空の初期画面では発生しない。 |

### Why the previous selector only partially works

1. CSS の順序は主因ではない。`@import "tailwindcss"` の後、responsive rule の後に create rule が置かれている。通常の `.border-stone-*` / `.bg-white` utility に対して、`.note-paper-editor--create ...` は同等以上の specificity で後勝ちするため、通常 input、textarea、select、Cue、section、Preview 下辺には到達する。
2. `border-color: transparent` は `background-image` を消さない。紙面全体の repeating-linear-gradient は border ではなく background paint なので、前回の border selector で何本線を消しても、title/meta/overview/Summary/footer に横線が残る。
3. create input selector は `.note-paper-title` を除外しているため、タイトル下線は意図どおり残る。focus/error も pseudo-class 除外で残る。
4. Preview selector は surface/empty の div だけを対象にし、`MarkdownField` 内の `h3.border-b` は対象外。したがって Preview の見出し下線は残る。
5. `.note-paper-meta-item` の `border-top: 0` は `border-left` を消さない。desktop の meta separator が見えるのは selector failure ではなく、別方向の border を狙っていないため。
6. `!border-0` / `!border-b` / `!bg-transparent` は Tailwind の important utility だが、主に border width/background の指定であり、通常の `border-color` を透明化できない理由にはならない。逆に `!bg-transparent` と create rule が競合する textarea は、どちらも透明で結果は同じ。
7. 対象 CSS に `::before` / `::after` の静的 pseudo-element はない。`details` の native marker は線ではない。UA の default border より、明示された Tailwind border と2層の background gradient が支配的である。
8. `background-image` を create shell だけ無効にする場合、form と shell は同一要素なので descendant selector ではなく `.note-paper-editor--create.note-paper-shell` のような compound selector が必要。` .note-paper-editor--create .note-paper-shell` では match しない。

### Concept PNG mapping

| 概念画像の領域 | 残すべき線 | 消す／重複させない線 |
|---|---|---|
| 紙面外枠 | paper の薄い外周 border、控えめな shadow | 入力欄や section の box border を外周と同じ強さで重ねない |
| メタ帯 | meta 帯下の一本の横線、項目間の縦線 | shell gradient による帯内の複数横線、responsive で重なった top/bottom 線 |
| Cornell 中央線 | Cue 30% と本文 70% の中央 vertical divider（mobile は横 divider） | Cue item/input の dashed/solid border を中央線の代わりに残すこと |
| 本文横罫線 | Cue と本文の Cornell surface 内の薄い repeating rules を一組 | shell 全体の rules、grid と shell の位相違いによる二重 rules |
| Preview | 本文と Preview の関係を示す一つの控えめな divider、必要なら淡い Preview surface | Preview h3 border + surface bottom border +背面 gradient の三重表示。現在 surface bottom は既に透明化済み |
| Summary / footer | Cornell bottom から Summary に入る一つの全幅境界、保存/キャンセル操作の button affordance、paper の下端 | Summary/footer 内の repeating rules、Cornell 境界と重なる footer top、不要な Preview bottom の二重線 |

## Recommended Implementation for the Next Worker

### Priority 1: one CSS-only, create-only change

対象は `src/app/globals.css` のみとし、既存 create selector を拡張する最小候補は次の一つ。

```css
.note-paper-editor--create.note-paper-shell {
  background-image: none;
}
```

これで paper の background-color、外枠、Cornell grid 自身の repeating-linear-gradient は残る。title/meta/overview/Summary/footer の shell-wide rules と、Cornell 内の shell/grid 二重描画だけを消せる。`note-editor.tsx` の既存 create class は変更不要で、detail/edit/list/header には波及しない。

### Priority 2: runtime で残線を一つずつ確認

Priority 1 の後にまだ線が見える場合だけ、線の位置で分岐する。

- title 下線: concept の補助 mock が title input の下線を定義しているため、初期推奨は保持。
- Preview 見出し線: Preview を区切る一線として保持するか判断。削除する場合は `markdown-field.tsx` の h3 に semantic class（例 `markdown-preview-heading`）を追加し、create scope だけを対象にする。generic `h3` selector は使わない。
- footer 上線: PNG の Cornell→Summary 境界が既に一線を担い、footer 上線が二本目として見える場合だけ `.note-paper-editor--create .note-paper-footer { border-top: 0; }` を検討する。padding と action button は残す。
- Preview 面の横線: gradient が半透明面を通している場合だけ、create scope の `.markdown-preview-surface` / `.markdown-preview-empty` を opaque な paper color にする。Preview の内容・sanitize・checkbox 動作は変更しない。

### Files and impact

| 変更候補 | 役割 | 影響範囲 |
|---|---|---|
| `src/app/globals.css` | create shell の background-image と、必要なら create-only residual line を制御 | `/notes/new` の紙面だけ |
| `src/app/notes/_components/note-editor.tsx` | 既存 `note-paper-editor--create` class を保持。追加 class は Priority 1 では不要 | form の DOM/操作は維持 |
| `src/shared/markdown/markdown-field.tsx` | Preview 見出しを個別に狙う必要が出た場合のみ semantic class を追加 | create/edit/detail の Preview markup に影響するため、変更時は create CSS scope とセットで確認 |
| `src/app/_components/app-chrome.tsx`, `src/app/layout.tsx`, route page, `note-detail-modes.tsx` | header 原因ではないため変更しない | 共通 header/detail への波及を避ける |

## Acceptance Criteria for Implementation Worker

- `/notes/new` の header は `<header.app-chrome-header>` 1個だけで、brand/nav/state slot の DOM/class は `/notes` と detail で同じ。`新規作成` badge の文言差は mode 差として許容する。
- 1440px で paper 外枠、meta 下線/縦 separator、Cornell 中央線、Cornell 内の薄い横罫線一組、Summary への構造境界が残る。
- create shell の title/meta/overview/Summary/footer に shell-wide repeating rules が出ず、Cornell の shell/grid 二重線がない。
- 通常時の入力・Cue・Preview 下辺の不要な box/divider は出ない一方、focus/error border/ring と操作 button border は残る。
- Preview の区切りは一つに収まり、Summary/footer の区切りが Cornell 境界と二重にならない。
- 375px では mobile の Cue→本文 divider、外枠、meta の折り返しが保たれ、ページ全体の横溢れがない。
- 検証時は `/notes/new` と `/notes/[id]` の create/edit/view/review を同じ viewport で比較し、可能なら computed style で create shell の `backgroundImage` と各 border を確認する。
- 実装後は `git diff --check`、`npm run lint`、必要なら `npm run build` を実行し、browser 目視ができない場合は PASS と断定しない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | `globals.css` / `note-editor.tsx` の既存変更と summary 5件を確認し保全 |
| 対象 route/layout/header の静的比較 | PASS | `/notes/new` と detail は同じ `note-paper-page` wrapper、header は layout の AppChrome 一経路 |
| border/background/selector の静的棚卸し | PASS | shell/grid gradient、section/meta/Cornell/Cue/input/Preview/Summary/footer を列挙 |
| 概念 PNG の視覚確認 | PASS | `view_image` で外枠、meta 帯、中央線、本文 rules、Summary/footer の構造を確認 |
| in-app browser discovery | 未実施扱い | browser runtime の available list が `[]`。利用可能 target がない |
| localhost runtime | 未実施扱い | `curl -I http://localhost:3000/notes/new` は connection refused。server は起動していない |
| `npm run lint/build/dev/start` | 未実施 | 診断 task の制約どおり |
| source/config/dependency/generated artifact | 変更なし | summary ファイルと summary 用ディレクトリのみ追加 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 実画面で shell gradient が何本に見え、grid gradient とどの程度重なるか | browser/server が利用可能な状態で 1440px / 375px screenshot と computed style |
| U-002 | ユーザーが余計と感じた線が shell gradient、Preview h3、footer top、title 下線のどれか | `/notes/new` の実 screenshot 上で y 座標を source selector に対応付ける |
| U-003 | `MarkdownPreview` の半透明 background 越しに Cornell rules が見えるか | body/Summary に空/短文/見出し/table の fixture を入れた browser 確認 |
| U-004 | 900px/640px 付近の meta top/left border と mobile Cornell bottom divider の見え方 | responsive viewport の browser 確認 |

## Next Read

次の実装 Worker は、まずこの summary と次の最小ファイルを読む。

- `summary/20260718/0007-diagnose-new-note-header-and-lines.md`
- `src/app/globals.css`
- `src/app/notes/_components/note-editor.tsx`
- `src/shared/markdown/markdown-field.tsx`（Preview 見出し線を変更する場合のみ）
- `doc/screens/assets/mockups/mvp-paper-note-canvas-concept.png`

