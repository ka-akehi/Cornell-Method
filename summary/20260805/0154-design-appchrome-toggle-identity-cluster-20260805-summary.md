---
summary_type: task-summary
created_at: 2026-08-05 01:54 JST
task_kind: design
task_status: done
---

# AppChrome toggle identity-cluster placement design

## Objective

スクリーンショットで確認された「identity の直下に toggle が単独行で浮く」状態を解消し、desktop expanded / collapsed の両方で pane toggle をブランド identity と同じ top control cluster として読める配置に固定する。persistent rail、expanded 256px / collapsed 56px、同一 desktop sidebar DOM、同一 toggle node、900px 以下の mobile overlay は変更しない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | desktop AppChrome の identity、pane toggle、create、navigation scroll の上部 geometry / hierarchy / focus / tooltip |
| 対象 source | `src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx`、`src/app/styles/app-shell.css` |
| 対象 contract | `test/notes/app-chrome-contract.test.js`、`test/notes/app-chrome-responsive-contract.test.js` |
| 対象 evidence | `summary/20260805/0039-design-future-ready-persistent-appchrome-rail-20260805-summary.md`、指定スクリーンショット2枚、current worktree source / focused tests、Issue #91 の triage / follow-up summary |
| 成果物 | 本 design summary 1ファイルのみ |
| 対象外 | `/backup` navigation decision、route / API / DB / Canvas、foundation token、mobile UI redesign、依存関係、生成物、Issue / PR state、queue state、実装変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| repository instructions | `AGENTS.md`、`HANDOFF_2026-08-03.md` | MVP の優先順位、未コミット変更の保護、summary / Worker 運用、runtime と static evidence の境界 |
| prior design | `summary/20260805/0039-design-future-ready-persistent-appchrome-rail-20260805-summary.md` | persistent same-DOM rail、256 / 56、44px target、20px icon、現在の source order、tooltip / responsive contract |
| current JSX | `src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx` | 現在は identity header → toggle sibling → create → nav scroll。toggle は1 node / 1 ref / 1 handler。desktop identity は非リンク、mobile brand は別 link |
| current CSS | `src/app/styles/app-shell.css` | identity 56px、mark 32px、toggle 44px、現在の toggle y=64 / create y=120 / first nav y=180 の flow、901 / 900 media boundary、tooltip portal 用の state |
| focused tests | `test/notes/app-chrome-contract.test.js`、`test/notes/app-chrome-responsive-contract.test.js` | same-DOM、same-node、aria、focus、tooltip、256 / 56、現在の旧 toggle geometry、900 / 901 mobile non-regression |
| issue history | `summary/20260803/issues-91-triage-20260803.md`、`summary/20260804/0029-audit-issue-91-collapsed-rail-runtime-css-reaudit-20260804-summary.md` | outboard handle が rail 幅0または透明 gutter と組み合わさると、44px handle が main に重なる既知問題 |
| screenshot | `/Users/blp542/Desktop/スクショ/スクリーンショット 2026-08-05 1.39.57.png` | expanded で identity header の下に toggle が単独行として見える旧画像観察 |
| screenshot | `/Users/blp542/Desktop/スクショ/スクリーンショット 2026-08-05 1.40.13.png` | collapsed で 56px rail の C mark と panel-left-open icon が上下に分離して見える旧画像観察 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | current JSX は `<aside>` 内で `AppChromeDesktopIdentity` を header に置き、その直後に同一の desktop toggle button、create、navigation scroll を置いている。 | current `app-chrome.tsx` の desktop aside markup |
| F-002 | fact | toggle は `id={desktopRailToggleId}`、`desktopRailHandleRef`、`toggleRail`、`aria-controls="app-chrome-sidebar"`、state-derived `aria-expanded`、dynamic Japanese accessible name、portal tooltip data を共有する1 nodeである。 | current `app-chrome.tsx` lines 302–318相当、focused contract |
| F-003 | fact | expanded / collapsed の rail border-box はそれぞれ256px / 56px、C mark は32px、toggle target は44px、panel icon は20pxである。 | current CSS tokens、focused contract、発注者決定 |
| F-004 | fact | 56px rail の同一水平面には、左右 insetを確保した32px markと44px targetを衝突なく並べる余白がない。markを x=12..44、targetを x=6..50 とすると横方向で重なる。 | 56 - 32 - 44 < 0、および current inset 6px |
| F-005 | fact | current static focused tests は PASS しているが、旧 geometry（toggle y=64、create y=120、first nav y=180）を正本としている。 | `node --test ...app-chrome-contract... ...responsive...` の6 tests PASS、current contract assertions |
| F-006 | fact | Issue #91 の既知問題は、rail boundary の外側へ出した44px handleが、rail regionの幅0・透明gutter・main paddingとの組み合わせで main content に重なったことだった。 | Issue #91 triage / CSS re-audit summaries |
| F-007 | design decision | toggle を同じ identity header に入れ、expanded では右寄せ、collapsed では同じ header cluster 内で C mark の下へ縦積みにする。これが物理制約を満たしながらブランドとの意味的関係を最も強くする。 | 3案比較、F-003 / F-004 / F-006 |
| U-001 | unknown | 実ブラウザでの新しい bounding box、ブランド文字の実フォント幅、tooltip / focus ring の描画は本 design task では未確認である。 | Browser runtime を実行していない。後続 implementation Worker の確認項目とする |

## Three design options

### Option 1: identity header 内の right-aligned toggle（推奨）

identity headerをtop control clusterに昇格し、expandedではブランド行の右端にtoggleを置く。collapsedでは56px内に横並びできないため、C markと同じ中心軸上で8px gapの縦積みにする。clusterの境界線はmarkとtoggleの間ではなく、cluster全体の下端に1本だけ置く。

| 観点 | expanded | collapsed |
|---|---|---|
| 見え方 | C + brand copy が左、toggleが右の一行。identityとpane操作が同じヘッダーの役割として読める | C mark（32px）→8px gap→44px targetを同じ56px中心軸に積む。現行の「headerの境界線の下に浮く行」を作らない |
| 56px / 32px / 44px | 横方向に十分な余白がある。targetは rail 内の右6pxに収める | 水平配置を諦めて縦積みにし、mark x=12..44、target x=6..50を衝突させない。targetは rail外へ出ない |
| same-node / focus | current buttonの id / ref / handler / aria / DOM nodeを維持。header内への移動だけ | 同じ button node。state切替で iconとgeometryだけ変わり、remountしない |
| mainへの影響 | aside幅は256pxのまま。main left edgeは256px | aside幅は56pxのまま。main left edgeは56px。追加gutterやmain paddingを作らない |
| 将来nav | createをcluster直下、navだけをscroll regionに置く。top controlsを固定し、3–7 itemが増えても役割が明確 | collapsed clusterの高さ分だけnavの初期位置が下がるが、top controls固定・nav-only scrollの原則を維持 |
| 主なリスク | expanded brand copyが44px targetへ侵入しないよう右側58pxを予約する必要がある | clusterの高さが expanded 56px / collapsed 100pxで異なるため、runtimeで縦フローを確認する必要がある |

### Option 2: identityとcreateの間に残す最小変更

toggleのDOM位置をidentity headerの外に残し、identityの下からcreateまでを一つの低密度なtop-control bandとして見せる案。identityとtoggleの間の強い境界線を除き、toggle / createのgap、surface、縦位置を詰める。

| 観点 | 評価 |
|---|---|
| expanded / collapsed | 44px targetは現行同様に縦方向でmarkと衝突しない。surfaceとgapを整えれば空白行感は弱まるが、toggleがbrand headerの一部に見えるわけではない |
| 56px / 32px / 44px | 物理制約は満たす。横並びを試みないため衝突なし |
| same-node / focus | current DOM / ref / aria / focus orderを最も変更しない。実装リスクは低い |
| mainへの影響 | rail width / main left edgeを変更しない。createとnavの開始位置を少し詰められる |
| 将来nav | 現在の縦フローを保ちやすい。item増加時もnav-only scrollへ移行できる |
| 不採用理由 | 発注者の指摘は「toggle単独行がbrandとの関係を失う」こと。rowを少し密にするだけではidentityとの意味的結合が弱く、collapsedのCとpanel iconの縦分離も残る |

### Option 3: rail boundary / outboard handle

toggleをrailの右境界に接する、またはmain側へ少し出るhandleとして置く案。

| 観点 | 評価 |
|---|---|
| expanded / collapsed | 境界の操作としては目立つが、collapsedでは56px railの外側に44px targetを置くことになる |
| 56px / 32px / 44px | rail内に完全収納するとCまたはtargetを圧迫する。main側へ出すとx=56以降を占有し、mainと重なるか、main leftを100pxへ動かす必要がある |
| same-node / focus | 同一node自体は維持可能だが、containing block、overflow、focus ring、hit-test、tooltip anchorの設計が増える。current portal tooltipとは別に境界のclippingを検証する必要がある |
| mainへの影響 | Issue #91 と同じ physical gutter / overlap問題を再発させる。透明な44px gutterを足すと「collapsed rail=56px」とmain left=56pxの契約を壊す |
| 将来nav | railの責務とmain overlayの責務が混ざり、nav item追加時のscroll / hit-area判定が複雑になる |
| 不採用理由 | Issue #91の既知問題を配置だけ変えて再導入するため。今回は outboard handle、negative translate、second gutter、collapsed時のmain padding特例を採用しない |

### Comparison and decision

| 評価軸 | Option 1 | Option 2 | Option 3 |
|---|---:|---:|---:|
| brandとの視覚的結合 | ◎ | △ | ○ |
| 56px / 32px / 44pxの物理成立 | ◎（collapsedは縦積み） | ◎ | △ |
| same-node / focus / tooltip continuity | ◎ | ◎ | △ |
| main content非干渉 | ◎ | ◎ | × |
| 将来navの拡張余地 | ◎ | ○ | △ |
| 実装Workerの判断 | **採用** | fallback | **不採用** |

Option 1を採用する。Option 2はvisual QAでbrandとの結合が不足した場合のfallbackとしてのみ残し、Option 3はIssue #91再発防止のため再提案しない。

## Recommended implementation contract

### JSX hierarchy and node identity

desktop asideの最終的なsource orderは次のとおりとする。

```tsx
<aside id="app-chrome-sidebar" ref={desktopSidebarRef} className="app-chrome-sidebar">
  <header className="app-chrome-sidebar-identity">
    <AppChromeDesktopIdentity />
    <button id={desktopRailToggleId} ref={desktopRailHandleRef} ...>
      <AppChromeIcon
        name={isRailOpen ? "panel-left-close" : "panel-left-open"}
        className="app-chrome-sidebar-toggle-icon"
      />
    </button>
  </header>
  <AppChromeCreateLink pathname={pathname} isCollapsed={!isRailOpen} variant="desktop" />
  <div className="app-chrome-navigation-scroll">
    <AppChromeNavigation pathname={pathname} isCollapsed={!isRailOpen} variant="desktop" />
  </div>
</aside>
```

- `app-chrome.tsx` では現在のtoggle button nodeをidentity header内へ移動する。条件分岐でopen / collapsed用のbuttonを2つ作らない。
- `id={desktopRailToggleId}`、`ref={desktopRailHandleRef}`、`onClick={toggleRail}`、`aria-controls="app-chrome-sidebar"`、`aria-expanded={isRailOpen}`、dynamic `aria-label`を維持する。
- `data-app-chrome-tooltip={railToggleLabel}` と placement state（expanded=`anchor`、collapsed=`rail`）を維持する。tooltipは既存のtop-level fixed portalのまま、buttonの子孫に戻さない。
- `AppChromeDesktopIdentity` は非リンクのidentityとして維持し、C markをTab stopにしない。`app-chrome-parts.tsx` のmobile `AppChromeBrand` link、icon family、nav/create APIは変更しない。
- desktop aside内のnative Tab順は、非focusable identity → toggle → create → nav source order → main。positive `tabIndex`、hidden desktop duplicate、separate collapsed navigationは追加しない。
- `toggleRail`後のrAF focus restoration effectは追加しない。同一button nodeのnative focusを維持する。

### Exact CSS geometry

座標はdesktop viewportの左上を`(0, 0)`、rail border-box幅を256px / 56pxとして記載する。CSSの`rem`は現行の16px rootを前提にする。

| 要素 / state | top | left | width | height | alignment / note |
|---|---:|---:|---:|---:|---|
| expanded sidebar | 0 | 0 | 256px | 100svh | right border 1pxをborder-box内に含む。shadowなし |
| collapsed sidebar | 0 | 0 | 56px | 100svh | 追加rail region / transparent gutterなし |
| expanded identity cluster | 0 | 0 | 255px content box | 56px | `position:relative`、下端に1px divider。markとtoggle間のdividerなし |
| expanded C mark | 12px | 12px | 32px | 32px | center x=28、identityの既存mark geometryを維持 |
| expanded brand copy | 10px | 56px | auto | 36px以内 | right edgeは198px以下（toggleのleft 206pxから8px空ける）。overflowはellipsisでbuttonの下へ侵入させない |
| expanded toggle target | 6px | 206px | 44px | 44px | right 6px、panel icon 20pxはtarget中央 |
| expanded create | 64px | 6px | 244px | 44px | header直下のmargin-top 8px。border-box |
| expanded nav scroll region | 116px | 0 | 255px | flex remaining | create下8px、padding-top 4px。first nav rowはy=120 |
| expanded first nav row | 120px | 6px | 244px | 44px | row gap 4px、以降のnavだけscroll可能 |
| collapsed identity cluster | 0 | 0 | 55px content box | 100px | `6.25rem`。下端に1px divider。Cとtoggleを同じcluster背景に置く |
| collapsed C mark | 8px | 12px | 32px | 32px | center x=28、bottom y=40 |
| collapsed toggle target | 48px | 6px | 44px | 44px | C bottomから8px gap、right edge 50pxでrail内。panel icon center=(28,70) |
| collapsed create | 108px | 6px | 44px | 44px | cluster下8px、border-box |
| collapsed nav scroll region | 160px | 0 | 55px | flex remaining | create下8px、padding-top 4px。first nav rowはy=164 |
| collapsed first nav row | 164px | 6px | 44px | 44px | row gap 4px、以降のnavだけscroll可能 |

実装上の主要なCSS値は次の意味で固定する。

- `--app-chrome-sidebar-expanded-width: 16rem`、`--app-chrome-sidebar-collapsed-width: 3.5rem`、`--app-chrome-sidebar-control-size: 2.75rem`、`--app-chrome-sidebar-icon-size: 1.25rem`、`--app-chrome-sidebar-outer-inset: 0.375rem`を維持する。
- base identity heightは`3.5rem`。collapsedだけidentity clusterを`6.25rem`へ拡張する。collapsed markはtop `0.5rem`、toggleはtop `3rem` / left `0.375rem`。expanded toggleはtop `0.375rem` / right `0.375rem`。toggleはabsolute配置でもtargetの幅・高さ・Tab順を変えない。
- toggleの`margin`は0にし、rail外への`translateX`、negative `right`、outboard handle用の専用regionを使わない。targetと2px focus outline + 2px offsetが56px rail内に収まる。
- headerのborder-bottomはcluster全体の下端に一度だけ置く。collapsedでy=56に線を置かず、C markとtoggleを同じsurfaceの一つのclusterとして見せる。
- createはdesktop footerへ移さず、cluster直下に置く。expandedは`y=64`、collapsedは`y=108`。nav scroll regionはcreateの下8pxから始め、rowの先頭はそれぞれy=120 / y=164とする。
- nav scroll regionだけが`min-height:0; flex:1 1 auto; overflow-y:auto`を持つ。header、toggle、createはscroll region外で固定する。future primary / secondary rowsを追加してもtop geometryは変えず、rowsだけがscrollする。
- expanded brand copyはtoggleのleftより少なくとも8px手前で止める。現行文字が収まらない場合は視覚表示をellipsisにし、buttonの背面へ描画しない。accessible nameとしてのbrand textは失わない。

### Accessible name, focus, tooltip

- expanded accessible nameは現行どおり「サイドバーを折りたたむ」、collapsedは「サイドバーを展開する」。visible textがないtoggleなので`aria-label`を必須とする。
- DOM focus orderは`toggle → create → /notes nav → main`。identityのC / brand copy、tooltip overlayはTab stopにならない。
- expanded toggle tooltipは既存JSの`anchorRect.right + 8px`に従い、target右側（想定left=258px）へfixed表示する。collapsed tooltipは既存の`rail` placementでleft=64px、target中心y=70px付近へfixed表示する。
- hover、keyboard `:focus-visible`、blur / pointer leave / Escapeの表示・非表示、tooltipの`aria-hidden`、viewport clamp、layout不参加は維持する。tooltip表示前後でrail / mainのrect、document `scrollWidth`を変えない。
- focus-visible outlineはtoggle targetから2px offsetで、expanded / collapsedともrail境界にclipされないことをruntimeで確認する。

### Create / nav vertical flow and future density

desktopの縦フローは次の順序で固定する。

```text
expanded: identity cluster 0–56 → 8px → create 64–108 → 8px → nav region 116–… → first row 120
collapsed: identity cluster 0–100 → 8px → create 108–152 → 8px → nav region 160–… → first row 164
```

createは常にtop cluster直下のreal actionであり、`margin-top:auto`やbottom footerにはしない。nav itemが将来3–7件へ増えてもrow height 44px / row gap 4px / icon axisを変えず、短いviewportではnav scroll regionだけをスクロールさせる。空のsecondary wrapper、未実装placeholder、`/backup`の追加はこのtaskでは行わない。

### 900 / 901px breakpoint and mobile non-regression

- `@media (min-width: 901px)`では同じdesktop asideを表示し、上記 expanded / collapsed clusterを適用する。
- `@media (max-width: 900px)`ではdesktop sidebar全体（identity、toggle、tooltipを含む）を`display:none`とし、current mobile header / mobile menu button / overlay panelを変更しない。mobile brandは既存の`AppChromeBrand` link、mobile menuは既存のbutton nodeのままとする。
- `900px`ではdesktop targetがTab order / hit-testに現れず、mobile headerが表示される。`901px`ではdesktop asideが表示され、同一toggle nodeがfocus可能になる。
- 901→900のviewport transitionでは、desktop aside内のfocusがある場合に既存のpredicateでmobile menu buttonへ戻る。900→901では既存どおりrailをexpandedへresetし、mobile menu / panel focusからdesktop toggleへ戻る。新しいheader内配置を理由にfocus predicateを狭めない。
- mobile overlayのEscape、backdrop、Tab loop、initial focus、body scroll lock / restore、pathname change close、main `inert`は不変とする。

## Focused contract assertions to update in the implementation task

実装 Workerは次を focused testsへ追加 / 更新する。今回のdesign taskではtestsを変更しない。

### `test/notes/app-chrome-contract.test.js`

- desktop asideのregexを、`<header className="app-chrome-sidebar-identity">`内に`<AppChromeDesktopIdentity />`と`id={desktopRailToggleId}`がこの順で存在し、その後にcreate、navigation scrollが続く形へ更新する。
- `id={desktopRailToggleId}`、`ref={desktopRailHandleRef}`、`onClick={toggleRail}`がそれぞれ1回だけで、`AppChromeCollapsedNavigation`、duplicate toggle、`hidden={!isRailOpen}`、outboard rail classesがないことを維持する。
- identity headerのbase `3.5rem`、collapsed `6.25rem`、mark 32px、expanded mark top/left `0.75rem`、collapsed mark top `0.5rem`をassertする。
- toggle ruleの`position:absolute`、44px target、expanded `top/right:0.375rem`、collapsed `top:3rem; left:0.375rem; right:auto; margin:0`をassertする。現行の`margin: 0.5rem 0 0 ...`およびstate共通 y=64 assertionは置き換える。
- create margin-topを8px、nav scroll margin-topを8px、expanded create / first nav geometryの根拠をassertする。collapsedの100px cluster後のflowがCSS selectorで表現されることをassertする。
- 256 / 56 token、20px icon、44px focus target、current nav visual、portal tooltip、no `.app-main` collapsed padding、no `app-chrome-rail-region` / `app-chrome-rail-handle` / `translateX`を維持する。
- brand copyにtoggleと重なるwidthがないことを、right reservation / overflow contractでassertする。brandをlinkへ戻さない。

### `test/notes/app-chrome-responsive-contract.test.js`

- same-DOM desktop asideのnested header + one toggle + create + nav scroll orderを更新する。desktop aside / toggleの重複がないことを維持する。
- `min-width:901px`でmobile header / overlay / menuがhidden、`max-width:900px`でdesktop sidebar / desktop tooltipがhidden、mobile header / menuがvisibleという既存assertionを維持する。
- breakpoint focus predicateが`desktopSidebarRef.current.contains(activeElement)`を使い、header内へ移動したtoggleを含むdesktop descendantからmobile buttonへfocusを戻すことを維持する。
- mobile pathname close、Escape / Tab loop、scroll lock、main `inert` assertionは変更しない。
- 旧「toggleの位置が常にx=6/y=64」というassertionがあれば削除し、desktop expanded / collapsed state別のgeometryをstatic contractとして固定する。runtime rectはBrowser QAで確認する。

## Browser runtime acceptance for the implementation Worker

static regex PASSをruntime PASSに置き換えない。次の項目を901 / 1280 / 1440pxで確認する。

- expanded: aside width=256px、identity cluster height=56px、C rect=(12,12,32,32)、toggle rect=(206,6,44,44)、create rect=(6,64,244,44)、first nav rect=(6,120,244,44)。brand title / subtitleがtoggleの下へ侵入しない。
- collapsed: aside width=56px、identity cluster height=100px、C rect=(12,8,32,32)、toggle rect=(6,48,44,44)、create rect=(6,108,44,44)、first nav rect=(6,164,44,44)。Cとtargetのvertical gap=8px、target全体とfocus ringがrail内に収まる。
- expanded → collapsed → expandedのclick / Enter / Spaceで、toggleの`isSameNode`がtrue、focusが同じbuttonに残り、`aria-expanded` / label / icon pathだけがstateに応じて変わる。state changeでmain left edgeやhorizontal overflowが変わらない。
- expanded toggle hover / keyboard focus tooltipはbutton右8px、collapsed toggle tooltipはleft=64pxで表示される。tooltipはrail / nav scrollにclipされず、表示前後のsidebar / main rectとdocument scrollWidthを変えない。
- collapsedでtoggle targetをrail boundary外へ出す別column、negative translate、transparent gutter、mainへの追加paddingが存在しない。main left=56px、toggle hit-testがrail内で完結する。
- short desktop heightとreal-shaped nav fixture（少なくとも7 rows）で、identity cluster / toggle / createのy座標を固定したままnav rowsだけがscrollする。future row追加でtop controlがnav scrollに巻き込まれない。
- 900pxではdesktop sidebar / tooltipが不可視かつunfocusable、mobile header / menuが表示される。901pxではdesktop clusterが表示される。900↔901のfocus復帰、mobile overlayのEscape / backdrop / Tab / body scroll / pathname closeが既存どおり動く。
- `/notes` と `/notes/new`でnav current indicator、create filled state、toggle focus ring、tooltipが互いを消さない。route / API / DB / Canvasのruntime変更がない。

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260805/0154-design-appchrome-toggle-identity-cluster-20260805-summary.md` | toggleをidentity clusterへ配置する3案比較、Option 1のJSX / CSS geometry / focus / tooltip / flow / responsive / focused assertions / Browser acceptanceを固定 | 実装 Worker が追加の配置判断なしに、発注者のpersistent rail決定とIssue #91の非干渉契約を維持して実装できるようにするため |

source、tests、config、dependencies、routes、DB、Canvas、画像、生成物、既存summary、queue stateは変更していない。作業前から存在した `src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx`、`src/app/styles/app-shell.css`、focused testsの未コミット差分および既存untracked filesは保持した。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | source 5 filesの既存 staged / unstaged差分、`floating-tooltip-mockup.png`、既存summary群を確認。復元・削除・stage変更なし |
| 指定スクリーンショット2枚 | PASS as old-image observation | original detailで確認。current runtimeのPASS証拠にはしていない |
| current source / CSS / focused tests / prior summary | PASS | 対象source、test、`0039` design summary、Issue #91関連summaryをread-only確認 |
| `node --test test/notes/app-chrome-contract.test.js test/notes/app-chrome-responsive-contract.test.js` | PASS | 6 tests / 6 passed。現行旧geometry contractのPASSであり、新配置のruntime証明ではない |
| `git diff --check` | PASS | whitespace errorなし |
| `sh tools/check-summary.sh summary/20260805/0154-design-appchrome-toggle-identity-cluster-20260805-summary.md` | PASS | 必須heading、summary配置、conflict markerなしを確認 |
| Browser runtime | NOT RUN | 本 taskはdesign-only。実装後に本summaryのBrowser runtime acceptanceを実施する |
| 作業後 `git status --short` | PASS | 既存状態を保持し、本summary 1ファイルだけを追加。対象5 source/test files以外の変更なし |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | Option 1の実描画でbrand copyがtoggleと8px以上離れ、視覚的に自然に収まるか | implementation後の901 / 1280 / 1440px screenshot、brand / toggle bounding boxes |
| U-002 | expanded 56px / collapsed 100px header切替時のtransition、focus ring、短いviewportでのnav scroll | Browser computed style、focus / scroll interaction |
| U-003 | 900 / 901px境界でdesktop header内toggleがhidden / focus復帰契約を壊さないか | viewport resize中のactiveElement、mobile menu focus、overlay / body lock QA |
| U-004 | current worktreeの既存未コミット実装が今回のdesign geometryと一致するか | implementation Workerがコード変更後にfocused tests、lint、typecheck、必要ならbuildとBrowser QAを実施 |

## Next Read

実装 Workerは最初にこのsummaryを読み、次の最小ファイルだけを順に確認する。

- `summary/20260805/0154-design-appchrome-toggle-identity-cluster-20260805-summary.md`
- `src/app/_components/app-chrome.tsx`
- `src/app/_components/app-chrome-parts.tsx`
- `src/app/styles/app-shell.css`
- `test/notes/app-chrome-contract.test.js`
- `test/notes/app-chrome-responsive-contract.test.js`

次のtask slugは `implement-appchrome-toggle-identity-cluster-20260805` とする。UI横断の1 taskとして上記5 source / test filesだけを対象にし、`/backup`、API、DB、Canvas、foundation token、mobile redesignを混ぜない。実装後はこのsummaryの「Browser runtime acceptance」を先に実行し、static contract PASSだけで完了扱いにしない。
