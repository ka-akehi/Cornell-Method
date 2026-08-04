# UI redesign adoption audit (2026-08-03)

この文書は、現在の未コミット UI redesign worktree を Manager が採用範囲、QA 範囲、後続 coding task に分割するための read-only 監査記録です。コード、設定、依存関係、DB、画像、既存 source/test、既存 summary は変更していません。

## Objective

前回の audit-ui-redesign-adoption-scope-20260803-c4620a9a は queue 上では done でしたが、自動生成 summary は task の完了記録に留まり、未コミット差分の実質的な分類や runtime 未確認範囲を判断できる粒度ではありませんでした。

今回の目的は、次の内容を MVP 契約、最新 handoff、AppChrome 設計書、現在の git status/diff、関連 contract test に照合して固定することです。

- AppChrome / desktop rail edge handle / mobile navigation の設計適合性
- note paper / editor / detail / Canvas の採用候補と回帰リスク
- notes list / filter / pagination / backup UI の visual-only 境界
- 変更・追加された contract test の意図、過剰な実装詳細依存、runtime 証拠の不足
- Manager が次に読む最小ファイルと、QA・coding task の分割線

監査の基準は doc/implementation/MVP_CONTRACT.md を優先し、製品全体のロードマップは AGENTS.md、AppChrome の DOM/state 判断は summary/20260803/desktop-sidebar-collapse-dom-design-20260803.md を参照しました。

## Current Worktree Facts

### 作業前 status と差分量

作業開始時に git status --short を実行し、次の状態を保存しました。

- tracked status: 31 件（変更 30、削除 1）
- untracked status: 34 件（summary 27、追加 contract test 5、HANDOFF_2026-08-03.md 1、floating-tooltip-mockup.png 1）
- git diff --stat: tracked 31 ファイル、1,720 insertions / 430 deletions
- git diff --name-status: AGENTS.md、HANDOFF_2026-08-01.md、source 23 ファイル、既存 contract test 6 ファイル
- untracked は git diff --stat / git diff --name-status に含まれない

tracked の status は次の領域に分かれます。

| status | ファイル |
| --- | --- |
| M | AGENTS.md |
| D | HANDOFF_2026-08-01.md |
| M | src/app/_components/app-chrome.tsx |
| M | src/app/notes/[id]/page.tsx、src/app/notes/new/page.tsx |
| M | src/app/styles/app-shell.css、foundation.css、note-paper.css、note-canvas-editor.css、note-canvas-surface.css、note-canvas-toolbar.css |
| M | src/modules/backup/ui/components/backup-page.tsx |
| M | src/modules/notes/ui/components/canvas/editor.tsx、toolbar-actions.tsx、toolbar.tsx |
| M | src/modules/notes/ui/components/detail/display.tsx、read-view.tsx |
| M | src/modules/notes/ui/components/editor/cues.tsx |
| M | src/modules/notes/ui/components/list/card.tsx、feedback.tsx、filters.tsx、list.tsx、pagination.tsx、results.tsx、tags.tsx |
| M | test/notes/app-chrome-contract.test.js、canvas-scroll-contract.test.js、canvas-toolbar-responsive-contract.test.js、list-filter-layout-contract.test.js、list-header-contract.test.js、note-paper-spacing-contract.test.js |

作業前の untracked は次のとおりです。ここにある summary は product source と区別し、運用記録または設計・監査の入力として扱います。

- HANDOFF_2026-08-03.md
- floating-tooltip-mockup.png
- 2026-08-02 summary: 1828-implement-floating-canvas-tooltip-20260802-a00cf784-summary.md、1830-audit-mock-ui-redesign-scope-20260802-14838cc5-summary.md、1934-fix-canvas-toolbar-button-wrap-tooltip-area-20260802-a206b150-summary.md、1937-implement-app-shell-left-rail-20260802-1832be00-summary.md、1947-align-note-paper-cornell-primitives-20260802-39514565-summary.md、1956-polish-backup-page-mock-ui-20260802-552ed53f-summary.md、2001-polish-canvas-surface-responsive-ui-20260802-cf255983-summary.md、2007-polish-detail-reading-review-paper-20260802-f46cfb99-summary.md、2010-polish-editor-create-paper-form-20260802-9371fea8-summary.md、2014-polish-notes-list-mock-ui-20260802-52e91ff0-summary.md、2027-audit-mock-ui-responsive-regression-20260802-1737f904-summary.md、2100-toggle-app-shell-menu-all-viewports-20260802-fa90b158-summary.md、2120-fix-app-shell-header-rail-mutual-exclusive-20260802-1ab8bf8c-summary.md、2222-move-desktop-rail-toggle-outside-brand-row-20260802-5216f0fe-summary.md、2313-audit-develop-origin-main-pr71-state-20260802-5cb103b5-summary.md、2319-audit-current-ui-worktree-after-mock-redesign-20260802-de08f298-summary.md、2350-fix-app-chrome-hamburger-position-20260802-b4b31d2f-summary.md、manager-next-work-organization-after-ui-redesign-20260802.md、mock-ui-redesign-scope-20260802.md
- 2026-08-03 summary: 0000-align-app-chrome-hamburger-with-brand-header-20260802-91b05ce1-summary.md、0027-design-desktop-sidebar-collapse-dom-20260803-e22f044b-summary.md、0043-implement-desktop-sidebar-edge-handle-20260803-342fab85-summary.md、0054-create-handoff-20260803-next-session-558d528c-summary.md、1546-audit-origin-main-pr71-live-state-20260803-6b273d1a-summary.md、1557-audit-ui-redesign-adoption-scope-20260803-c4620a9a-summary.md、audit-develop-origin-main-pr71-state-20260803.md、desktop-sidebar-collapse-dom-design-20260803.md
- 追加 contract test: test/notes/app-chrome-responsive-contract.test.js、detail-paper-layout-contract.test.js、editor-paper-layout-contract.test.js、list-visual-contract.test.js、test/backup/backup-page-visual-contract.test.js

summary/20260803/1557-audit-ui-redesign-adoption-scope-20260803-c4620a9a-summary.md は task 完了記録であり、本監査レポートの代替証拠にはしません。summary/20260802/mock-ui-redesign-scope-20260802.md に実質監査 addendum があることは確認しましたが、今回の baseline と検証結果はこのレポートで再取得した値を正とします。

### 作業後 status

本レポート作成後の最終確認で、作業前の tracked 31 件と untracked 34 件は保持され、追加されたのは本ファイルだけであることを確認しました。実測した作業後の status 集計は次のとおりです。

- tracked status: 31 件（M30、D1）のまま
- untracked status: 35 件（既存 summary 27、今回の report を含む summary 28、追加 test 5、handoff 1、画像 1）
- source / test / CSS / API / DB / 依存関係の追加変更: なし
- stash、reset、checkout、clean、commit、merge、rebase、push、fetch: 未実行

## Scope Classification

### 1. AppChrome / desktop rail edge handle / mobile navigation

対象:

- src/app/_components/app-chrome.tsx
- src/app/styles/app-shell.css
- src/app/styles/foundation.css
- test/notes/app-chrome-contract.test.js
- test/notes/app-chrome-responsive-contract.test.js
- summary/20260803/desktop-sidebar-collapse-dom-design-20260803.md
- summary/20260803/0043-implement-desktop-sidebar-edge-handle-20260803-342fab85-summary.md

採用候補:

- isRailOpen と isMobileNavOpen を別の state として持つこと
- desktopRailHandleRef と mobileMenuButtonRef を分けること
- desktop handle を app-chrome-rail-region 内で aside の兄弟に置き、collapse 前後も同じ button を DOM に残すこと
- collapsed 時に aside#app-chrome-rail を native hidden と aria-hidden で除外すること
- mobile overlay に stable id、dialog semantics、aria-modal、title、close button、Tab trap、Escape/backdrop close、body scroll lock、content inert を持たせること
- 900px 以下を mobile、901px 以上を desktop とする media boundary

根拠:

- app-chrome.tsx:196-221、228-315、319-451
- app-shell.css:10-31、43-62、283-311、405-440
- design summary:56-78、313-354
- MVP の canonical route、API、保存方式、DB、Canvas JSON はこの差分で変更されていない

保留・対象外候補:

- /backup、folders、tags、templates、trash、settings、help など、現行 source に存在しない nav route を mock 画像だけから追加すること
- rail の localStorage 永続化、compact icon-only rail、Phase 2 の状態バッジや復習タスクをこの差分に混ぜること
- edge handle の実画面受け入れ前に追加 coding で見た目を推測修正すること

要 QA:

- collapsed 時の handle の実際の位置、可視幅、44px hit area、focus ring、main 操作との重なり
- 1280 / 1440px の rail open、collapse、再展開、keyboard focus、accessibility tree
- 900 / 901px 境界と 375 / 768px の mobile hamburger、overlay、Tab / Shift+Tab、Escape、backdrop、close 後の focus
- overlay open 中の main/header 背後への focus 漏れ、body overflow 復元、note paper / Canvas より前面に出る z-index

### 2. note paper / editor / detail / Canvas layout

対象:

- src/app/styles/note-paper.css
- src/app/styles/note-canvas-editor.css
- src/app/styles/note-canvas-surface.css
- src/app/styles/note-canvas-toolbar.css
- src/app/notes/[id]/page.tsx
- src/app/notes/new/page.tsx
- src/modules/notes/ui/components/canvas/editor.tsx
- src/modules/notes/ui/components/canvas/toolbar-actions.tsx
- src/modules/notes/ui/components/canvas/toolbar.tsx
- src/modules/notes/ui/components/detail/display.tsx
- src/modules/notes/ui/components/detail/read-view.tsx
- src/modules/notes/ui/components/editor/cues.tsx
- test/notes/canvas-scroll-contract.test.js
- test/notes/canvas-toolbar-responsive-contract.test.js
- test/notes/detail-paper-layout-contract.test.js
- test/notes/editor-paper-layout-contract.test.js
- test/notes/note-paper-spacing-contract.test.js

採用候補:

- app token を使った暖色 background / paper / ink / line / accent / focus の統一
- note-paper-shell の連続 divider、title row、metadata grid、30/70 Cornell grid
- Cue の行区切り、Canvas editor surface、Cue と Canvas の局所 scroll
- create route と detail not-found state を共有 paper hierarchy に寄せること
- Canvas toolbar の visible label、aria-label、aria-describedby、title、focus-visible を維持しつつ drawing rail の floating tooltip を portal で配置すること
- surface.tsx の page width / height を保存値どおりに使い、page 寸法変更だけで要素 geometry / points / style / text を変更しないこと。editor.tsx:229-241 の責務は MVP の CanvasDocumentV1 契約と整合する

保留・対象外候補:

- Canvas 本文を Markdown 本文欄、NoteCard、Cue と本文の ID link、D&D card model へ変換すること
- page 寸法を zoom 値に置き換えること、DB/API/migration を新設すること
- Fit、50%、100%、200% を用紙サイズ UI として追加すること
- mock image に描かれた image、folder、template、trash 等を route がないまま実装すること

要 QA:

- 1440 / 1280 / 1024 / 901 / 900 / 768 / 640 / 375px の paper width、page-wide scroll、focus outline、long title / source / tags / Cue / Summary
- 30/70 列、901-1023px の detail、900px 以下の detail local horizontal scroll、640px 以下の縦積み
- large Canvas page、Canvas toolbar の narrow rail、page local horizontal scroll と page vertical scroll の干渉
- tooltip の hover / keyboard focus、画面端の left clamp、top/bottom placement、scroll / resize 更新、unmount cleanup
- pen / line / shape / text / erase、pointercancel、wheel / trackpad / touch、save / reload、Canvas JSON と searchText の不変性

### 3. notes list / filters / pagination / backup UI

対象:

- src/modules/notes/ui/components/list/card.tsx
- feedback.tsx、filters.tsx、list.tsx、pagination.tsx、results.tsx、tags.tsx
- src/modules/backup/ui/components/backup-page.tsx
- test/notes/list-filter-layout-contract.test.js
- test/notes/list-header-contract.test.js
- test/notes/list-visual-contract.test.js
- test/backup/backup-page-visual-contract.test.js

採用候補:

- list / filter / tag chips / pagination の app token、responsive wrapping、focus-visible
- loading を status、error を alert として示すこと
- list の fetch、300ms query debounce、date/tag/reviewDue/pagination、request id guard を変更せず visual class を更新すること
- card の reviewStatus.label を model から維持し、backup の fetchBackups / createBackup、最新 3 世代、manual /backup API 境界を維持すること
- backup の成功 / 失敗 message に status / alert semantics を付けること

保留・対象外候補:

- PDF export、backup log、retry API、/notes/backup、自動 backup を UI redesign の採用根拠として扱うこと
- list の tag tokenizer、tag rename/delete 管理 UI、専用 review-task route をこの visual diff だけで追加すること

要 QA:

- review badge の色を旧 model の red / blue / green class から amber / neutral token へ置き換えた意図が、label と視覚コントラストを含めて受け入れ可能か
- long title、long source、12 tags、comma を含む tag、From > To、empty/loading/error、pagination の narrow width
- /backup の empty / one-to-three entries、長い file/path、create/list refresh、failure、repeated click 時の button state

### 4. contract tests / visual contract tests

変更・追加された 11 test files は、今回の関連実行で 30 subtests 全件 PASS でした。

採用候補:

- AppChrome の rail sibling、native hidden、state/ref/aria-controls の分離を static regression guard として置くこと
- paper hierarchy、30/70、Canvas local scroll、toolbar labels / portal、list responsive token、backup visual token を static guard として残すこと
- route、明示保存、Canvas / Markdown 分岐、backup remote operation の既存境界を test source 上で維持すること

境界・懸念:

- test/notes/app-chrome-contract.test.js と app-chrome-responsive-contract.test.js は JSX の空白、class 名、属性順、media rule の文字列配置に強く依存する。compact() と長い regex は DOM の意味を検証する一方、実際の render tree / computed style / focus を検証しない
- test/notes/list-visual-contract.test.js と test/backup/backup-page-visual-contract.test.js は token/class の存在または旧 class の不在を検証するが、色の contrast、overflow、実際の wrap、screen reader semantics は検証しない
- Canvas test は portal、getBoundingClientRect、CSS overflow の実装意図を固定するが、pointer / wheel / touch / save-reload lifecycle の runtime evidence にはならない
- source-level contract が PASS でも、browser acceptance や accessibility tree の PASS へ繰り上げない

### 5. handoff / summary / image など運用記録・参考資料

対象:

- AGENTS.md の最新 handoff pointer
- D HANDOFF_2026-08-01.md と ?? HANDOFF_2026-08-03.md
- status に出ている summary/20260802 の 19 件、summary/20260803 の 8 件
- floating-tooltip-mockup.png

分類:

- AGENTS.md と handoff の置換は運用記録の更新であり、UI product diff とは別の採用判断にする
- summary/20260803/desktop-sidebar-collapse-dom-design-20260803.md は AppChrome 設計の source of truth として参照する
- summary/20260802/mock-ui-redesign-scope-20260802.md は scope / 既存判断の入力として参照するが、作業前 baseline は今回の status を優先する
- 1557 の自動 summary は完了記録であり、実質監査の根拠や browser QA 証拠にはしない
- floating-tooltip-mockup.png は目視した参照画像であり、src からの import は確認できない。実行時 asset、生成物、UI acceptance screenshot として扱わない

## AppChrome Design Conformance

| 設計項目 | 静的照合結果 | 判定 |
| --- | --- | --- |
| desktop / mobile state | isRailOpen と isMobileNavOpen は別 state。相互の aria-expanded / overlay / rail 表示を共有していない | 適合 |
| ref / focus return | desktopRailHandleRef と mobileMenuButtonRef は別 ref。collapse / expand は handle、mobile close は menu button へ戻す実装 | 適合。ただし resize descendant focus は未確認 |
| desktop DOM | app-chrome-rail-region の直下に handle、続いて aside#app-chrome-rail。handle は hidden subtree 外で同じ id のまま残る | 適合 |
| native hidden | hidden={!isRailOpen} と aria-hidden={!isRailOpen}。CSS-only offscreen ではない | 適合 |
| desktop control | left/right chevron、状態別 accessible name、aria-expanded、aria-controls="app-chrome-rail" | 適合 |
| breakpoint | max-width:900px で desktop rail/handle を非表示、min-width:901px で mobile header/overlay/button を非表示 | 適合 |
| mobile overlay | hidden、open 時 role=dialog、aria-modal、aria-labelledby、panel close、Escape、Tab trap、backdrop、inert、body overflow restore | static 適合、runtime 未確認 |
| edge handle geometry | open 時は rail edge に張り出す。collapsed 時は rail-region width 0 に対し right:0 と translateX(50%) | 要 QA。実効 hit area と viewport clipping を未確認 |
| resize focus | handle / mobile button / open overlay を対象に次の trigger へ focus を移す | 部分適合。rail 内の任意 descendant focus は条件に含まれない |

設計書の主な整合点は design summary:61-78、196-280、313-354 です。特に、desktop handle を mobile header に再利用しない、collapsed rail は native hidden、mobile overlay は別 state と別 aria-controls、という要件は current source と合っています。

ただし、設計書が要求する「resize によって現在の trigger が表示対象外になる場合の focus 移動」に対して、app-chrome.tsx:291-305 の shouldRestoreFocus は次だけを見ています。

- isMobileNavOpenRef.current
- document.activeElement === mobileMenuButtonRef.current
- document.activeElement === desktopRailHandleRef.current

desktop rail の brand link / nav link / create link に focus がある状態で 900/901px を跨いだ場合を直接判定していません。native hidden / media rule による browser の focus 処理に依存するため、design conformance は static 完全適合ではなく、runtime QA 前提の部分適合とします。

## Regression Risks and Required QA

### R-01: collapsed edge handle の実効 hit area

app-shell.css:43-62 は handle を width/min-width 2.75rem、right:0、transform:translateX(50%) とし、collapsed rail-region は width/flex-basis 0 です。LTR の viewport 左端では、幾何上 button の中央が x=0 付近になり、概算で半分が viewport 外へ出る可能性があります。foundation.css の body は overflow-x: clip です。

これは static な geometry risk であり、現時点で browser bug と断定して修正 task は作りません。1280 / 1440px で open / collapsed の getBoundingClientRect、可視部分、pointer hit test、focus ring、main の先頭操作への重なりを測定してください。44px hit area または focus ring が欠ける場合だけ、handle の配置を別 UI fix task に切り出します。

### R-02: breakpoint resize 時の rail descendant focus

R-01 と同様に、これは app-chrome.tsx:291-305 の static evidence に基づく具体的な focus risk です。desktop の nav link を keyboard focus したまま viewport を 901px から 900px 以下へ変更した場合、source は activeElement が rail descendant かどうかを見ず、mobile menu button へ focus を戻さない可能性があります。

必須確認:

1. rail brand / nav / create link、edge handle の各 focus 状態から 901→900px
2. mobile button、overlay close、panel nav の各 focus 状態から 900→901px
3. overlay open 中の 901→900px / 900→901px
4. focus が body、hidden rail、背後の main に残らず、次の表示対象へ一度だけ移ること

再現すれば、rail ref を追加して contains(document.activeElement) を判定するなど、最小の focus fix を別 task にします。

### R-03: paper / Canvas overflow と focus clipping

note-paper.css:2-14 は paper shell に overflow:hidden、同 388-479 は 900px / 640px の grid・overflow を切り替えます。note-canvas-surface.css:17-32 は horizontal scroll、105-115 は 640px 以下で viewport overflow visible、note-canvas-editor.css:27-57 は editor / Cue surface の境界を追加しています。

static contract は local scroll の意図を確認できますが、paper shell、grid、Canvas stage、body overflow の組み合わせを実画面では確認していません。長い title、長い Cue、長い Summary、最大 page、375 / 640 / 768 / 900 / 1024px を使い、document.documentElement.scrollWidth と body.scrollWidth、paper 内の scrollWidth、focus outline の切れを記録してください。

### R-04: Canvas floating tooltip と input lifecycle

toolbar-actions.tsx:105-199 は button anchor の getBoundingClientRect、tooltip 自身の rect、viewport clamp、top/bottom 判定、resize / capture scroll listener、portal を実装しています。tool の focus / hover の static guard はありますが、次は未確認です。

- 画面上端・下端・左右端で説明文が切れずに表示されるか
- toolbar の local scroll、paper scroll、window scroll 後も anchor 直下に追随するか
- mouse leave と keyboard focus の切替で tooltip が早期消失または残留しないか
- route change / component unmount 後に scroll / resize listener が残らないか
- tooltip が Canvas pointer target、focus ring、mobile overlay と重ならないか

既存の CanvasDocumentV1、DB/API、searchText の変更は確認できないため、これは persistence contract の変更ではなく browser interaction QA の保留です。

### R-05: list review badge の意味とコントラスト

list/card.tsx:10-20、77-80 は getReviewStatus(note).label を維持しつつ、旧 reviewStatus.className の red / blue / green を使わず、nextReviewDate と今日の日付だけで amber / neutral token を選びます。これにより visual redesign は統一されますが、「復習済み」「期限到来」「予定日」「予定なし」の状態を色だけで区別していた既存の利用者期待は変わります。

label を主情報とする設計か、色にも意味を持たせるかを Manager が決めてください。今日境界、reviewedAt + nextReviewDate=null、未来日、予定なしを含めて実画面の contrast と label の可読性を確認し、必要なら model の color semantics を別 task で token 化します。

### R-06: contract test の実装詳細依存

AppChrome test は DOM 順序、className の順序、属性の並び、具体的な aria label、CSS declaration の並びを regex で固定しています。list / backup visual test も具体的 class の存在／不在を固定します。

これらは今回の意図を早く検知する guard としては有用ですが、次の変更で false negative になりやすいです。

- JSX の無害な whitespace / 属性順 / component 抽出
- Tailwind class の順序変更、token alias 化
- CSS declaration の移動、selector の分割

反対に、regex が PASS しても computed layout、focus、aria tree、pointer、save/reload は証明しません。採用時は static contract と browser QA を別の証拠レベルとして維持し、runtime failure を test PASS で覆わないでください。

### R-07: /backup の nav 方針が文書間で不一致

MVP_CONTRACT.md:40-49 は /backup を canonical route とします。IMPLEMENTATION_STATUS.md:44 は共通 nav が /notes、/notes/new、/backup の 3 つと記録しています。一方、current app-chrome.tsx の appChromeNavItems は /notes だけで、create link が /notes/new、app-chrome-contract.test.js:144-161 は /backup の AppChrome 追加を禁止しています。

これは今回の redesign が新しく壊した API ではなく、既存 UI と status 文書の scope 不一致です。Manager は「backup は共通 nav に出すか、backup page の direct link だけにするか」を決めるまで、mock の folder 等と同様に推測実装しないでください。

### Required QA matrix

| 領域 | 最小 viewport / 操作 | 合格条件 |
| --- | --- | --- |
| AppChrome | 1440 / 1280、rail open/collapse/reopen、Tab / Enter / Space | handle が操作可能、hidden rail が tab/a11y tree から消える、main が全面利用できる |
| AppChrome resize | 901↔900、rail descendant / handle / mobile trigger / overlay 各 focus | focus の移動先が一意で、hidden subtree / 背後 main に残らない |
| Mobile nav | 768 / 375、open、Tab / Shift+Tab、Escape、backdrop、close、nav 遷移 | dialog、inert、body lock、focus trap、close 後 trigger focus が成立 |
| Paper | 1024 / 901 / 900 / 768 / 640 / 375、長文・12 tag | page-wide horizontal overflow なし、paper / grid / focus ring が切れない |
| Canvas | 1440 / 1280 / 768 / 375、large page、tooltip edge、wheel / touch / pointercancel | tooltip placement、local scroll、drawing lifecycle、page scroll、cleanup が成立 |
| Canvas persistence | page resize、tool/style/text、明示保存、reload、list search | CanvasDocumentV1 の要素データ、style、text、searchText が意図せず変わらない |
| Notes list | empty/loading/error、長い title/source/tag、date boundary、pagination、review states | label、color、contrast、wrap、keyboard focus、request guard が成立 |
| Backup | 0〜3 entries、long path、create/list refresh、failure、repeated click | manual API boundary、最新3世代表示、status/alert、button disable が成立 |

## Verification

### 実行済み

| コマンド / 確認 | 結果 | 証拠の範囲 |
| --- | --- | --- |
| git diff --check | PASS | whitespace のみ。runtime / layout は証明しない |
| node --test test/notes/app-chrome-contract.test.js test/notes/app-chrome-responsive-contract.test.js test/notes/canvas-scroll-contract.test.js test/notes/canvas-toolbar-responsive-contract.test.js test/notes/detail-paper-layout-contract.test.js test/notes/editor-paper-layout-contract.test.js test/notes/list-filter-layout-contract.test.js test/notes/list-header-contract.test.js test/notes/list-visual-contract.test.js test/notes/note-paper-spacing-contract.test.js test/backup/backup-page-visual-contract.test.js | PASS（30 subtests） | source / CSS contract のみ |
| npm run lint | PASS | ESLint。runtime は未確認 |
| npx tsc --noEmit --pretty false --incremental false | PASS | TypeScript compile boundary。browser lifecycle は未確認 |
| floating-tooltip-mockup.png の目視 | 完了 | 参照 mock のみ。実装受け入れ screenshot ではない |
| git status --short 作業前後 | PASS | 既存 dirty state を保持し、report 以外の変更なし |

### 実施していない確認

- npm run build: 実施しない。今回の task は read-only audit であり、指定された verification set に build は含まれていない
- Playwright / E2E / in-app Browser / standalone browser runtime: 実施しない。指定どおり browser runtime QA は別 task とし、既存 handoff が記録する Browser backend / server bind の制約も保持する
- Prisma migrate / DB write / backup copy: schema、API、DB、backup provider は変更対象外であり、通常 DB を mutate する検証は行っていない

したがって、lint / typecheck / static contract が PASS でも、App shell の focus / hit area、paper overflow、Canvas pointer / wheel / touch / tooltip、list / backup の実効 visual acceptance は未確認です。

## Facts / Assumptions / Unknowns

| ID | 種別 | 内容 | 根拠 / 影響 |
| --- | --- | --- | --- |
| F-01 | fact | 作業前は tracked status 31、untracked status 34。tracked diff は 1,720 insertions / 430 deletions | git status --short、git diff --stat |
| F-02 | fact | AppChrome は desktop handle と mobile navigation を state、ref、DOM、aria-controls で分離している | app-chrome.tsx:196-221、319-451 |
| F-03 | fact | collapsed rail は aside を native hidden にし、handle は region 内で保持する | app-chrome.tsx:324-360、design summary:17-20 |
| F-04 | fact | source diff に API route、server application、Prisma schema / migration、Canvas JSON validator、依存関係の変更はない | git diff --name-status と対象 diff |
| F-05 | fact | current MVP は明示保存、canonical route /notes /notes/new /notes/[id] /backup、CanvasDocumentV1、manual backup の範囲 | MVP_CONTRACT.md:16-49、157-174 |
| F-06 | fact | changed/added contract test 11 files の関連実行は 30 subtests PASS | node --test の今回実行 |
| F-07 | fact | floating-tooltip-mockup.png は参照画像で、src の runtime import は確認できない | rg 実行と目視 |
| A-01 | assumption | amber / neutral review badge は label を主情報とすれば MVP の意味を保てる | color semantics は MVP_CONTRACT.md に固定されていない。contrast QA が必要 |
| A-02 | assumption | report 以外の dirty state はすべてユーザー／先行 Worker の意図した変更であり、今回の audit が触れてはいけない | 作業前 status と AGENTS.md の保護方針 |
| A-03 | assumption | desktop rail の 44px hit area は実画面上でも完全に viewport 内へ置く設計意図である | design summary:48、CSS geometry は未確認 |
| U-01 | unknown | collapsed handle の実効可視幅、hit test、focus ring、main との重なり | R-01 の browser QA が必要 |
| U-02 | unknown | 901↔900 resize で rail descendant focus が安全に移るか | R-02 の browser QA が必要 |
| U-03 | unknown | mobile dialog / inert / focus trap / body lock / z-index が実 browser / accessibility tree で成立するか | static source だけでは判定不可 |
| U-04 | unknown | paper / Canvas local scroll と page-wide overflow、tooltip placement、pointer / wheel / touch lifecycle | 既存 status の未確認範囲を PASS に繰り上げない |
| U-05 | unknown | /backup を AppChrome global nav に含めるべきか | MVP_CONTRACT / IMPLEMENTATION_STATUS と current AppChrome test の scope 不一致 |
| U-06 | unknown | 全 visual diff を一括採用するか、AppChrome / Canvas-paper / list-backup に分けて採用するか | Manager の統合単位判断が必要 |

## Recommendation

現時点の判定は **条件付き採用候補。runtime QA 前の全面受け入れ・追加 coding・branch 統合は保留** です。

具体的には次を推奨します。

1. source の採用候補は、AppChrome の state/DOM 分離、paper token / spacing、Canvas local scroll / floating tooltip の実装意図、list / backup の visual-only 差分、関連 static contract test として保持する。
2. まず read-only browser QA task を別に投入し、Required QA matrix の AppChrome と paper/Canvas を優先する。特に R-01 と R-02 は、設計適合性を確定する前提条件にする。
3. QA で再現した問題だけを、AppChrome、Canvas/paper、list/backup の小さな coding task に分割する。今回の audit から推測だけで CSS 修正を追加しない。
4. review badge の色と /backup global nav の方針を Manager が決定し、必要なら UI contract / IMPLEMENTATION_STATUS の記録を別 task で同期する。
5. product PR を作る場合、summary、handoff、参考 PNG は product source diff と混同せず、AGENTS.md の PR / summary ルールに従って別扱いにする。AGENTS.md の pointer 更新と handoff の置換も、意図した運用変更として明示する。
6. browser QA と採用範囲が確定するまで、origin/main merge、push、追加 redesign、全体 build / E2E を開始しない。

この report の根拠だけでは P0/P1 のデータ破壊、API contract 破壊、Canvas JSON migration 不整合は確認できません。一方、browser runtime 未確認のため、App shell の accessibility / layout と Canvas interaction の受け入れを APPROVE とする根拠もありません。

## Next Read

Manager が次回この判断を再開する際の最小順序は次のとおりです。

1. summary/20260803/ui-redesign-adoption-audit-20260803.md
2. HANDOFF_2026-08-03.md
3. summary/20260802/mock-ui-redesign-scope-20260802.md
4. summary/20260803/desktop-sidebar-collapse-dom-design-20260803.md
5. summary/20260803/0043-implement-desktop-sidebar-edge-handle-20260803-342fab85-summary.md
6. src/app/_components/app-chrome.tsx
7. src/app/styles/app-shell.css
8. src/app/styles/note-paper.css、src/app/styles/note-canvas-surface.css、src/modules/notes/ui/components/canvas/toolbar-actions.tsx
9. test/notes/app-chrome-contract.test.js、test/notes/app-chrome-responsive-contract.test.js、test/notes/canvas-scroll-contract.test.js、test/notes/canvas-toolbar-responsive-contract.test.js
10. doc/implementation/MVP_CONTRACT.md の §3、§4、§5.5、§6、§7 と doc/implementation/IMPLEMENTATION_STATUS.md の §2、§3

raw log や前回の自動完了 summary を Next Read の起点にしません。
