# `globals.css` 分割設計調査 summary

## Objective

`src/app/globals.css` の責務、selector の利用側、Tailwind v4 / App Router / responsive の cascade 依存を棚卸しし、後続の CSS 分割実装 task がそのまま使える移動単位、import 順、検証手順、リスクを設計した。今回の task では CSS、設定、依存関係、生成物を変更していない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | global CSS、App Router の CSS entry、Tailwind/PostCSS 設定、ノート・Canvas・Markdown・spike の class 利用側 |
| 対象ファイル / ディレクトリ | `src/app/globals.css`、`src/app/layout.tsx`、`package.json`、`postcss.config.mjs`、`next.config.ts`、`src/app/_components`、`src/app/notes/_components`、`src/app/spikes/canvas/_components`、`src/shared/markdown` |
| 参照仕様 | `HANDOFF_2026-07-19.md`、`doc/implementation/MVP_CONTRACT.md`、`doc/implementation/IMPLEMENTATION_STATUS.md`、`doc/technical/TARGET_ARCHITECTURE.md`、`summary/README.md` |
| 対象外 | CSS の移動、class 名変更、Tailwind/PostCSS/Next 設定変更、依存関係変更、UI 修正、browser QA、生成物の作成 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| CSS | `src/app/globals.css` | 1,693 行の全体、selector、`@media`、custom property、Tailwind import、重複 selector を確認 |
| CSS entry | `src/app/layout.tsx` | `./globals.css` が root layout から一度だけ読み込まれること、`app-body` に個別 CSS がないことを確認 |
| build config | `package.json`、`postcss.config.mjs`、`next.config.ts` | `@tailwindcss/postcss` のみ、`@import "tailwindcss"` の Tailwind v4 構成、CSS 専用 script / `cssChunking` override がないことを確認 |
| shell | `src/app/_components/app-chrome.tsx`、`src/app/backup/page.tsx` | app chrome、状態 badge、`app-main`、`app-page-header` の利用箇所を確認 |
| note UI | `src/app/notes/new/page.tsx`、`src/app/notes/[id]/page.tsx`、`src/app/notes/_components/*` | paper、metadata、Cue、Summary、Canvas editor/viewer、toolbar の class 利用箇所を確認 |
| spike UI | `src/app/spikes/canvas/_components/*` | `/spikes/canvas` 専用の selector 群と、ノート Canvas との非共有境界を確認 |
| Markdown | `src/shared/markdown/markdown-field.tsx`、`src/shared/markdown/index.ts` | Markdown preview の global class と、実際の本文装飾が Tailwind utility であることを確認 |
| architecture / contract | `HANDOFF_2026-07-19.md`、`doc/implementation/MVP_CONTRACT.md`、`doc/implementation/IMPLEMENTATION_STATUS.md`、`doc/technical/TARGET_ARCHITECTURE.md` | Canvas の用紙・scroll・toolbar 契約、runtime QA 未確認、`src/app/**` を薄く保つ方針を確認 |
| 運用 | `summary/README.md`、`summary/task-summary-template.md` | summary の粒度、`Next Read`、raw log を残さないルールを確認 |
| 外部一次資料 | [Next.js CSS](https://nextjs.org/docs/app/getting-started/css)、[Tailwind CSS Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs) | root layout の global CSS entry、import order、production build での CSS order 検証、Tailwind v4 import 方式を確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260722/0245-css-split-design-audit.md` | 本調査の完了 summary を新規作成 | 後続 coding task の入力を残すため |
| コード / 設定 / 依存関係 / 生成物 | 変更なし | Worker task の制約を遵守 |

## Findings

### 1. 全体構成と責務別の棚卸し

`globals.css` の現行範囲は次のとおり。括弧内は初回の分割先候補で、行番号は調査時点の現行ファイルに対するもの。

| 現行行 | 責務 | 主な selector / at-rule | 主な利用側 | 初回分割判断 |
|---:|---|---|---|---|
| 1-50 | Tailwind import、design token、`@theme`、body base | `@import "tailwindcss"`、`:root`、`@theme inline`、`body` | 全 route。`var(--paper-*)` は Markdown の arbitrary utility からも参照 | Tailwind import は `globals.css` の先頭に残し、`src/app/styles/foundation.css` へ 3-50 の token / `@theme` / body を移す |
| 52-230 | app shell / navigation / page header / main spacing | `.app-chrome-*`、`.app-main`、`.app-page-header`、`.note-paper-page`、max-width 900 media | `src/app/_components/app-chrome.tsx:106-169`、`src/app/backup/page.tsx:70`、`src/app/notes/_components/notes-list.tsx:122`、`src/app/notes/new/page.tsx:5` | `app-shell.css` に一体で移す。`:has(> .note-paper-page--create)` と navigation responsive を分離しない |
| 232-651 | 隔離された Fabric/Konva 比較 spike | `.canvas-spike-page`、`.canvas-spike-page-header`、`.canvas-spike-contract*`、`.canvas-spike-panels`、`.canvas-spike-engine-*`、`.canvas-spike-toolbar*`、`.canvas-spike-viewport`、`.canvas-spike-stage`、`.canvas-spike-*` の max-width 1100 / 700 media | `src/app/spikes/canvas/_components/canvas-spike-page.tsx`、`canvas-toolbar.tsx`、`fabric-canvas-panel.tsx`、`konva-canvas-panel.tsx` | `canvas-spike.css` に全範囲を移す。ノート Canvas と混ぜない |
| 653-655 | 全要素の box sizing | `* { box-sizing: border-box; }` | 全 HTML / Fabric wrapper | `foundation.css` の先頭側へ移す。現行より早く適用されるが、他の box-sizing 宣言と競合しない低リスク移動 |
| 657-982 | 紙面 shell、metadata、Cornell grid、Cue、Summary footer、form control、create sheet | `.note-paper-shell`、`.note-paper-content`、`.note-paper-heading*`、`.note-paper-title`、`.note-paper-meta-*`、`.note-paper-section*`、`.note-paper-cornell-grid`、`.note-paper-cue-*`、`.note-paper-footer`、`.note-paper-alert`、`.note-paper-shell input/textarea/select`、`.note-paper-editor--create ...`、max-width 900 / 640 media | `note-editor.tsx`、`note-editor-metadata.tsx`、`note-editor-cues.tsx`、`note-editor-summary.tsx`、`note-detail-read-view.tsx`、`note-detail-display.tsx`、`note-detail-actions.tsx`、`note-editor-inputs.tsx` | `note-paper.css` に base と create のまとまりを維持。紙面と form control を別 file に割らない |
| 983-998 | Canvas field heading / editor-viewer wrapper | `.note-canvas-field-heading`、`.note-canvas-editor`、`.note-canvas-viewer`、toolbar box sizing | `note-editor-body.tsx`、`note-canvas-editor.tsx`、`note-canvas-viewer.tsx` | 初回は `note-canvas.css` に含める。surface と toolbar の接続点なので先に細分化しない |
| 1000-1601 | Canvas toolbar 全体 | `.note-canvas-toolbar`、group、drawing rail、style、paper size、history、button、active / disabled / tooltip / focus、visually hidden、max-width 1099 / 640 media | `note-canvas-toolbar.tsx` と分割済み toolbar 子 component 群。group key は template literal で `operation` / `draw` / `line` / `shape` / `text` / `erase` を生成 | 初回は `note-canvas.css` に一体で移す。operation/style/paper/history ごとの機械的分割はしない |
| 1603-1675 | Canvas surface、横 scroll、Fabric DOM、error / assistive text | `.note-canvas-viewport`、`.note-canvas-horizontal-scroll`、`.note-canvas-stage`、`.note-canvas-stage .canvas-container`、`.note-canvas-stage canvas`、`.note-canvas-viewport[data-tool="erase"] ...`、`.note-canvas-error`、`.note-canvas-assistive-text` | `note-canvas-surface.tsx`、`note-canvas-editor.tsx`、`note-canvas-viewer.tsx`。`.canvas-container` / `.upper-canvas` は Fabric が生成 | 初回は toolbar と同じ `note-canvas.css`。初回 parity 後に `note-canvas-surface.css` へ抽出する候補 |
| 1677-1693 | Canvas ブロック後に残る create sheet の spacing override | `.note-paper-editor--create .note-paper-meta-grid`、`.note-paper-editor--create .note-paper-cornell-grid > :first-child/last-child`、`.note-paper-editor--create .note-paper-footer` | `note-editor.tsx` の create mode | 初回は import の最後に `note-paper-create-overrides.css` として保持し、後で `note-paper.css` へ coalesce できるか確認する |

### 2. selector 使用箇所の対応

#### App shell / navigation

- `.app-chrome-header`、`.app-chrome-inner`、`.app-chrome-brand`、`-mark`、`-copy`、`-title`、`-subtitle`、`.app-chrome-nav`、`.app-chrome-nav-link`、`.app-chrome-state-slot`、`.app-chrome-state-badge`、`.app-main` は `src/app/_components/app-chrome.tsx:106-169` に対応する。
- `.app-page-header` は `src/app/backup/page.tsx:70` と `src/app/notes/_components/notes-list.tsx:122` に対応する。`.app-page-header h1/p` は Tailwind の文字色 utility を global rule で上書きするため、Tailwind import 後の unlayered rule であることが重要。
- `.note-paper-page` は `src/app/notes/new/page.tsx:5` と `src/app/notes/[id]/page.tsx:45`、`.note-paper-page--create` は新規ページの marker として使われる。`.app-main:has(> .note-paper-page--create)` は新規画面だけ main padding を変える。

#### Note paper / editor / detail

- `.note-paper-shell`、`.note-paper-content`、`.note-paper-detail` は `note-detail-read-view.tsx:42`、`.note-paper-editor` / `--create` は `note-editor.tsx:160` にある。
- `.note-paper-heading` / `heading-copy` / `title` は `note-editor-metadata.tsx:41-42` と `note-detail-display.tsx:104-106`、`.note-paper-meta-grid` / `meta-item` は `note-editor-metadata.tsx:64-135` にある。
- `.note-paper-section` / `section-title` は metadata、Cue、Summary、detail display、detail actions、editor の各 section で共有される。`.note-paper-editor > .note-paper-section:first-of-type` と `.note-paper-detail > ...` は DOM 階層依存の cascade なので、紙面 file 内で保持する。
- `.note-paper-cornell-grid` と first/last child は `note-editor.tsx:191-192` と `note-detail-read-view.tsx:56` にある。desktop は Tailwind の約 30% / 70% grid、global CSS は border / rule / 900px detail overflow を補う。
- `.note-paper-cue-empty` / `.note-paper-cue-item` は `note-editor-cues.tsx:33,44`、`.note-paper-footer` は `note-editor-summary.tsx:39` と `note-detail-actions.tsx:21,77`、`.note-paper-alert` は editor / detail read view の alert にある。
- `.note-paper-shell input:not([type="checkbox"])`、`textarea`、`select` は paper 内の全 form control に効く。create mode の unfocused control を transparent にする selector と Tailwind の `!` utility が共存するため、別 file 化後も unlayered order と specificity を変えない。

#### Markdown

- 実装の入口は `src/shared/markdown/markdown-field.tsx`。`.markdown-preview-empty`、`.markdown-preview-surface`、`.markdown-preview-heading` はそれぞれ `:193`、`:202`、`:266` で使用される。
- これらの通常の padding / border / color はコンポーネントの Tailwind utility であり、`globals.css` の Markdown 固有 rule は create sheet の border-bottom を透明化する 3 selector（`:932-934`、`:973-976`）だけである。
- したがって初回に `markdown.css` を新設してこの 3 rule だけを移す必要はない。create sheet の context override として `note-paper.css` / `note-paper-create-overrides.css` に残す。Markdown 共通 style が増えた時点で `src/shared/markdown` と対応する global import を再設計する。
- `@uiw/react-md-editor` は `package.json` にあるが、現行 source の Markdown field は `react-markdown` / `remark-gfm` / `rehype-sanitize` で実装されている。CSS 分割 task で dependency の整理を混ぜない。

#### Canvas editor / viewer / toolbar

- `.note-canvas-editor`、`.note-canvas-error`、`.note-canvas-assistive-text` は `note-canvas-editor.tsx:301,317,338`、`.note-canvas-viewer`、同じ error / assistive は `note-canvas-viewer.tsx:139-158` にある。
- `.note-canvas-viewport`、`--viewer`、`.note-canvas-horizontal-scroll`、`.note-canvas-stage` は `note-canvas-surface.tsx:44-65` にある。viewer marker `.note-canvas-stage--viewer` は JSX に付くが、現行 CSS の専用 rule はない。
- `.note-canvas-toolbar`、drawing rail、inner、status は `note-canvas-toolbar.tsx:46-116`。tool group、history action、tooltip、visually hidden は `note-canvas-toolbar-actions.tsx:27-129`。style は `note-canvas-toolbar-style-controls.tsx:121-176`、alignment は `note-canvas-toolbar-alignment-controls.tsx:33-56`、paper size は `note-canvas-toolbar-paper-controls.tsx:91-169`、icon は `note-canvas-toolbar-icon.tsx:93` に対応する。
- `.note-canvas-toolbar-group--operation` / `--erase` は `note-canvas-toolbar-actions.tsx` の ``note-canvas-toolbar-group--${group.key}`` から実行時に生成される。静的な literal 検索で unused と判定して削除しない。
- `.canvas-container` と `.upper-canvas` は JSX source の class ではなく Fabric が生成する DOM class。erase cursor と stage sizing のため、Canvas surface CSS に残す。

#### Spike

`.canvas-spike-*` は `src/app/spikes/canvas/_components/canvas-spike-page.tsx`、`canvas-toolbar.tsx`、`fabric-canvas-panel.tsx`、`konva-canvas-panel.tsx` だけで利用される。ノートの `.note-canvas-*` と同じ `--paper-*` token を使うが、DOM / state / responsive は共有しないので、全 spike block を別 file に隔離する。

### 3. custom property / at-rule / cascade 依存

#### Variables

- `:root` の `--background`、`--foreground`、`--surface`、`--muted`、`--muted-foreground`、`--border`、`--font-sans` / `--font-mono` は `@theme inline` の Tailwind token として `bg-surface`、`border-border`、`text-foreground`、font utility 等から参照される。
- `--chrome`、`--chrome-deep`、`--chrome-foreground`、`--chrome-muted`、`--chrome-border`、`--chrome-hover`、`--chrome-focus`、`--chrome-shadow` は app shell と spike header / focus に使われる。note Cue の arbitrary utility から `--chrome` / `--chrome-foreground` も直接参照される。
- `--paper`、`--paper-soft`、`--paper-ink`、`--paper-ink-soft`、`--paper-line`、`--paper-line-strong`、`--paper-rule`、`--paper-accent`、`--paper-accent-deep`、`--paper-danger`、`--paper-shadow` は spike、paper、Canvas、Markdown preview の共通 palette である。token file を route file に寄せない。
- `.note-paper-shell` の `--note-paper-outer-gutter` / `--note-paper-rule-step`、`.note-paper-cornell-grid` の `--note-paper-cornell-rule-step` は selector-local variable。create shell は `--note-paper-outer-gutter` を上書きするので、paper block と create override の順序を維持する。

#### At-rules / global behavior

- 現行の at-rule は `@import "tailwindcss"`、`@theme inline`、`@media (max-width: 900px)`、spike の `1100px` / `700px`、paper の `900px` / `640px`、Canvas toolbar の `1099px and min-width 641px` / `640px` だけである。
- `@layer`、`@keyframes`、`@supports`、`@container`、`@font-face`、`@media print` はない。animation file や print file を新設する根拠は現時点にない。
- transition は app nav、paper-size chevron、Canvas toolbar button / tooltip に局所的にある。keyframe や animation name の移動依存はない。
- `* { box-sizing: border-box; }` は現在 spike block の後ろにあるが、foundation へ早めても box-sizing の競合は見つからない。初回移動では意図的な low-risk change として記録し、`git diff --check` と build を通す。

#### 同名 selector / order

- `.note-paper-editor--create > .note-paper-section` は `:947-949` と `:979-980` に 2 回現れる。後者は padding の compact override であり、削除・結合時に border rule を失わない。
- `.note-paper-editor--create .note-paper-meta-grid` は `:924-926` と `:1677-1680` に分かれ、前者は border、後者は margin / padding を上書きする。
- `.note-paper-editor--create .note-paper-footer` は `:936-939` と `:1690-1693` に分かれ、border/background と margin/padding が別の理由で存在する。
- `.note-canvas-style-field` は `:1108-1113` と `:1115-1119` に連続して 2 回現れる。前者は typography、後者は inline layout。初回はそのまま移す。
- `.note-paper-meta-grid`、`.note-paper-meta-item`、`.note-paper-heading`、`.note-paper-cornell-grid`、`.note-canvas-toolbar`、`.note-canvas-paper-fields`、`.note-canvas-size-field input` は通常 rule と media override の同名 selector 群である。各 media block を対応する component file に残す。
- `.note-canvas-toolbar` 内の generic button、active state、operation / erase special state、tooltip、focus rule は specificity を意図的に積み上げている。toolbar を operation / style / history 単位で分割すると import order による表示差が出やすい。
- `.note-canvas-viewport:focus-visible` の outline rule は toolbar block（`:1465-1472`）にあり、viewport の寸法 / overflow base は後段（`:1603-1623`）にある。surface を後で抽出する場合も、focus と base の property が相互上書きしないことを確認する。

### 4. 推奨する分割先と import 順

初回の実装は `src/app/layout.tsx` の CSS entry を変えず、`src/app/globals.css` を global CSS の importer にする。候補ファイルは次のとおり。

```text
src/app/globals.css                         # Tailwind + local importer
src/app/styles/foundation.css               # 3-50 + 653-655
src/app/styles/app-shell.css                # 52-230
src/app/styles/canvas-spike.css              # 232-651
src/app/styles/note-paper.css                # 657-982
src/app/styles/note-canvas.css               # 983-1675
src/app/styles/note-paper-create-overrides.css # 1677-1693、最終 override
```

推奨 import order は次の順。すべて `@import` なので、通常の CSS rule より前に置く。

```css
@import "tailwindcss";
@import "./styles/foundation.css";
@import "./styles/app-shell.css";
@import "./styles/canvas-spike.css";
@import "./styles/note-paper.css";
@import "./styles/note-canvas.css";
@import "./styles/note-paper-create-overrides.css";
```

- `@import "tailwindcss"` を最初に維持する。foundation の `@theme inline` と root token はその後に処理される位置へ置く。
- `note-paper-create-overrides.css` を最後にするのは、現行 file の 1677 行以降の late override を意味的にも cascade 的にも保持するためである。
- `src/app/layout.tsx` は引き続き `import "./globals.css"` だけを global CSS entry とする。client component、`src/shared/markdown`、Canvas 子 component から global CSS を直接 import しない。
- `.module.css` への変換は今回の selector が global DOM、Fabric generated DOM、Tailwind arbitrary utility と連携しているため採用しない。Next の global CSS ordering を一つの root entry に閉じ込める。
- `postcss.config.mjs` は現状の `@tailwindcss/postcss` のまま、`next.config.ts` の `cssChunking` も変更しない。分割で chunking 設定まで同時に変更しない。

`globals.css` 自体を importer-only（約 7 行）にすることは、150〜200 行という目標値を機械的に満たすより安全である。行数目標は acceptance ではなく目安とし、Toolbar の約 600 行を無理に role 別へ切り刻まない。もし importer-only を避けて `globals.css` に core を残す判断をする場合は、Tailwind import と local `@import` の位置、`@theme` の出力、production CSS order を先に build で確認すること。初回 task では importer-only を推奨する。

### 5. 後続 coding task の段階的な移動手順

1. **Baseline / characterization**
   - `git status --short` で既存変更を再確認する。今回の現行作業ツリーは多数の Canvas / notes / docs 未コミット変更があるため、CSS 以外を戻さない。
   - `npm run lint`、`git diff --check`、`npm run build` を移動前に実行する。build は `.next` 等の生成物を作るため、今回の調査では制約上実行していない。
   - `/notes`、`/notes/new`、`/notes/[id]` の view/edit/review、`/backup`、`/spikes/canvas` を viewport 375 / 768 / 1280 / 1440px で screenshot / console の baseline として記録できる場合は記録する。Browser が使えない場合は未確認のまま残す。

2. **Foundation のみ移動**
   - `:root`、`@theme inline`、`body`、`*`（現行 3-50 と 653-655）だけを `foundation.css` へ移し、`@import "tailwindcss"` は aggregator の先頭に残す。
   - `var(--paper-*)`、Tailwind の `bg-surface` / `border-border` / `text-foreground` が全 route で解決することを確認する。

3. **App shell 移動**
   - 52-230 を `app-shell.css` へ一括移動する。
   - `/notes` と `/backup` の `.app-page-header`、`/notes/new` の `.note-paper-page--create` による `:has()` main padding、header 状態 badge、900px nav collapse を確認する。

4. **Isolated spike 移動**
   - 232-651 を `canvas-spike.css` へ一括移動する。spike 内の見出し、toolbar、Fabric/Konva stage、1100 / 700 breakpoint を同時に移す。
   - `/spikes/canvas` だけを確認し、note Canvas の class と混ざらないことを確認する。

5. **Paper 移動**
   - 657-982 を `note-paper.css` へ移す。paper base、form controls、media、create mode の border removal を同一 file に残す。
   - 1677-1693 は最後の `note-paper-create-overrides.css` として移す。これを先に `note-paper.css` へ混ぜて order を変えない。
   - `/notes/new`、既存 detail、review、Cue empty / item、Summary、Markdown preview の border / background / vertical spacing を確認する。

6. **Canvas 移動**
   - 983-1675 を最初は `note-canvas.css` 一体で移す。toolbar の base / state / focus / tooltip / responsive と surface の overflow / Fabric DOM cursor を同時に保持する。
   - Canvas の 7 シナリオ（`CANVAS-DIMENSION-001`、`CANVAS-INTERACTION-001`、`CANVAS-GESTURE-001`、`CANVAS-SHAPE-TEXT-001`、`CANVAS-STYLE-001`、`CANVAS-PERSISTENCE-STYLE-001`、`CANVAS-TOOLBAR-STYLE-001`）は、CSS 移動の runtime 影響がないことを確認するために再実行する。静的確認だけで runtime PASS にしない。

7. **任意の二次分割**
   - 初回の lint/build/browser parity が取れた後にだけ、`note-canvas.css` から surface（983-998 + 1603-1675）と toolbar（1000-1601）を分ける。
   - toolbar は `note-canvas-toolbar.css` という一体 file を維持し、operation/style/paper/history の役割別分割は別 task とする。surface の focus selector と base overflow の order を確認する。
   - dead/marker 候補（`.note-paper-kicker`、`.note-canvas-paper-size-helper`、`.note-canvas-stage--viewer`、`canvas-spike-tool-button`）の削除は CSS 分割 task に混ぜず、利用実態を別 audit する。

### 6. 検証コマンドと完了条件

#### 各段階で実行

- `git status --short`
- `git diff --name-only -- src/app/globals.css src/app/styles src/app/layout.tsx package.json postcss.config.mjs next.config.ts`
- `rg -n '^@import|^@theme|^@media|^:root|^body|^\*' src/app/globals.css src/app/styles`
- `rg -n 'app-chrome|app-main|app-page-header|note-paper|note-canvas|canvas-spike|markdown-preview' src/app src/shared -g '*.{tsx,ts,css}'`
- `npm run lint`
- `git diff --check`
- `npm run build`（implementation task で実行。production の CSS order を確認するため必須）

#### Browser / visual QA

- `/notes`、`/notes/new`、`/notes/[id]` の閲覧・編集・復習、`/backup`、`/spikes/canvas` を確認する。
- 375 / 768 / 1280 / 1440 px で header、paper、Cornell 30/70、Markdown preview、Canvas toolbar、用紙設定、局所横 scroll、ページ縦 scroll を確認する。
- Canvas は既存 handoff / `doc/testing/TEST_SCENARIOS.md` の runtime 未確認項目を引き継ぐ。CSS 分割後に pointer / wheel / touch / 保存・再読込が未確認なら、未確認のまま記録する。
- build 後の `.next/static/css` は、Tailwind utilities が custom unlayered rules より前にあり、local import 順が崩れていないことを確認する。生成物は調査中の成果物として summary に入れず、実装 task の検証後に必要なら破棄する。

#### 完了条件

- `src/app/globals.css` は Tailwind と local CSS の import entry になり、root `layout.tsx` から一度だけ読まれる。
- token、app shell、spike、paper、Canvas の selector-to-consumer 対応が変わらず、動的 group class と Fabric generated class が残っている。
- Tailwind v4 の `@theme` / utility、unlayered custom CSS、`!` utility の優先順位を変えない。`@layer` を新規導入しない。
- responsive breakpoint と paper create late override の表示が移動前後で一致する。
- lint、build、diff check が成功し、対象外の `layout.tsx`、`package.json`、PostCSS / Next 設定、依存関係に不要な変更がない。

### 7. 高リスク箇所

| リスク | 内容 | 回避策 |
|---|---|---|
| Tailwind import / layer | 現行は `@import "tailwindcss"` の後に unlayered custom rule が続く。`@layer` に入れると Tailwind utility / custom CSS の優先順位が変わる | `@layer` を追加せず、local import の順だけを明示する |
| `@theme` / token | `@theme inline` と `:root` は Tailwind utility と JSX の arbitrary var から共有される | foundation を全 route より先に読み、token を route file へ分散しない |
| paper create tail | 1677-1693 が Canvas の後にあり、同じ paper selector の spacing を最後に上書きする | 初回は `note-paper-create-overrides.css` を import 最後に置く |
| paper / Tailwind `!` | paper の input rule、create transparent rule、JSX の `!bg-transparent` / `!border-*` が相互に効く | CSS file を再編して specificity や layer を変えず、実画面で focus / blur を確認する |
| Canvas toolbar cascade | generic button、active、operation / erase、tooltip、focus、responsive が共通 selector を使う | 初回は 1000-1601 を一体移動する |
| responsive order | paper は 900 / 640、spike は 1100 / 700、toolbar は 1099-641 / 640 で別の breakpoint を持つ | media block を component file の外へ分散しない |
| global selector | `.note-paper-shell input/textarea/select` は paper 内の全 input に効く | form-control を別の global file へ機械分割せず paper block に保持する |
| runtime-generated DOM | `.canvas-container` / `.upper-canvas` は Fabric が生成し、静的 JSX 検索では見えない | unused と判定して削除しない。Canvas surface CSS の対象として明記する |
| App Router CSS order | Next は production build で CSS を chunk / merge し、import order が順序に影響する | root layout の単一 entry を維持し、各段階で `npm run build` と browser QA を行う |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | Canvas、notes、docs、summary 等の既存未コミット変更を確認。今回の対象外として保持 |
| `src/app/globals.css` の差分 | PASS | `git diff -- src/app/globals.css` は空。調査中に CSS は変更していない |
| `src/app/layout.tsx` / `package.json` の差分 | PASS | 対象ファイルの差分は空。CSS entry、依存関係、script は変更していない |
| `npm run lint` | PASS | ESLint 成功 |
| `git diff --check` | PASS | whitespace error なし |
| `npm run build` | 未実行 | 生成物を変更しない制約のため。後続 coding task の各段階で必須 |
| Browser visual/runtime QA | 未実行 | Worker の設計調査 task であり、既存 handoff でも Canvas browser runtime QA は未確認 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| CSS-UNK-01 | Tailwind v4 / Next 16 のこの repository で、local CSS `@import` と imported `@theme inline` の production 出力順が想定どおりか | 実装 task で最小分割後に `npm run build`、`.next/static/css` の順序確認 |
| CSS-UNK-02 | `note-paper-create-overrides.css` を最終的に `note-paper.css` へ統合しても pixel / focus parity が保てるか | 初回分割後の visual diff。統合は別の小さな cleanup task にする |
| CSS-UNK-03 | `note-canvas.css` の surface / toolbar 二次分割が全 selector の specificity / responsive order を保つか | 初回 parity 後に限定的に抽出し、Canvas toolbar 7 シナリオと viewport QA を再実行 |
| CSS-UNK-04 | `.note-paper-kicker`、`.note-canvas-paper-size-helper`、`.canvas-spike-tool-button` の将来利用予定がないか | separate dead-selector audit。今回削除しない |
| CSS-UNK-05 | Browser が利用できない環境での responsive screenshot / wheel / touch QA | Browser backend / local server が利用可能になった時点で `doc/testing/TEST_SCENARIOS.md` に証跡を追加 |

## Next Read

後続 coding task の最小起点:

- `summary/20260722/0245-css-split-design-audit.md`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/_components/app-chrome.tsx`
- `src/app/notes/_components/note-canvas-toolbar.tsx`
- `src/app/notes/_components/note-canvas-surface.tsx`
- `src/app/notes/_components/note-editor.tsx`
- `src/shared/markdown/markdown-field.tsx`
- `doc/implementation/MVP_CONTRACT.md`
- `HANDOFF_2026-07-19.md`
