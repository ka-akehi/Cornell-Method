---
summary_type: task-summary
created_at: 2026-08-05 00:39 JST
task_kind: design
task_status: done
---

# Future-ready Persistent AppChrome Rail Design

## Objective

desktop の expanded sidebar と persistent collapsed icon rail を維持したまま、現在の navigation 1 件でも疎さや役割競合を感じにくく、将来 3〜7 件の主要 destination へ同じ構造のまま拡張できる AppChrome の visual / interaction contract を固定する。

発注者決定を最上位の product authority とし、外部調査の complete-hide 推奨だけを不採用とする。route / action は current worktree の canonical implementation を維持し、未実装 destination、disabled placeholder、`/backup` の追加・削除は本設計に含めない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | desktop AppChrome の expanded / collapsed hierarchy、geometry、state、focus、tooltip、overflow、responsive non-regression |
| 対象 source | `src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx`、`src/app/styles/app-shell.css` |
| 対象 static contract | `test/notes/app-chrome-contract.test.js`、`test/notes/app-chrome-responsive-contract.test.js` |
| 対象 evidence | 指定 summary 3 件、旧 screenshot 2 点、current worktree source / tests |
| 成果物 | 本 design summary 1 件のみ |
| 対象外 | source、test、config、dependency、route、generated artifact、queue state、commit、push、PR / Issue の変更、Browser runtime 実装 |

### Evidence labels

| ラベル | 意味 |
|---|---|
| `発注者決定` | 本 task で外部 recommendation より優先する product authority |
| `外部調査事実` | 完了済み research summary が公式一次資料から確認した値・原則。本 task では web を再調査していない |
| `旧画像観察` | 指定された pre-current screenshot から読み取れる構造。current runtime の PASS 証拠ではない |
| `現行 source 事実` | 本 task 開始時の current worktree source / CSS / tests から直接確認した事実 |
| `設計判断` | 上記 evidence を Cornell Method Notebook に適用して本 task で固定する contract |
| `未確認` | Browser runtime または別 product decision が必要な事項 |

## Decision Override

### Adopted authority

| ID | authority | 決定 |
|---|---|---|
| D-001 | `発注者決定` | desktop persistent icon rail を残す |
| D-002 | `発注者決定` | desktop expanded / collapsed の 2 状態を残す |
| D-003 | `発注者決定` | 将来、主要機能と navigation item が増える前提で設計する |
| D-004 | `発注者決定` | mobile は current overlay navigation を維持する |
| D-005 | `発注者決定` | complete-hide、menu-only、collapse 廃止、常時 expanded へ方針転換しない |

### Overridden recommendation

`summary/20260804/0012-research-modern-sidebar-patterns-20260805-summary.md` の「現在の item 数なら desktop closed は 0px complete-hide」という recommendation だけを不採用とする。同 summary の次の知見は引き続き evidence として採用する。

- Microsoft Compact pane の `48 DIP` と、expanded / compact / minimal を役割別に分ける考え方。
- Material Navigation Rail の standard `72dp`、dense `56dp`、`3〜7` top-level destination、top action を destinations より上に置く考え方。
- shadcn/ui の icon width `3rem`、expanded width `16rem`、state を expanded / collapsed として同じ component hierarchy で扱う考え方。
- Carbon の `256px` panel、selected background + leading border、navigation overflow の責務。
- Apple の critical action を sidebar bottom に孤立させない考え方。
- WCAG 2.2 の target minimum と focus order。Cornell では既存 product target の `44px` を維持する。
- icon-only control は programmatic accessible name と hover / keyboard-focus tooltip を必要とし、current、hover、focus を別 state として表すという原則。

後続作業では、item 数が現時点で少ないことを理由に complete-hide、menu-only、常時 expanded、collapse 廃止を再提案しない。item 数の増加は、本 summary の primary / secondary group と overflow contract の中で処理する。

### `/backup` decision boundary

- `現行 source 事実`: `/backup` page / API は存在するが、current `appChromeNavItems` は `/notes` 1 件だけであり、current focused test は AppChrome に `/backup` がないことを assertion にしている。
- `現行 source 事実`: `IMPLEMENTATION_STATUS.md` と `TEST_SCENARIOS.md` は common navigation に `/backup` がある前提を記載する。
- `設計判断`: この不整合を事実として残すが、本 task では `/backup` を追加も削除もせず、primary / secondary / utility のどこへ置くかも決めない。
- 後続 rail coding task は current route array と `/backup` assertion を rail redesign のついでに変更しない。別 product decision が出た後、その task で navigation source、mobile、desktop、tests、documents を一緒に整合させる。

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| repository instruction | `AGENTS.md` | MVP authority、未コミット変更保護、作業前後 status、summary 運用、Manager / Worker 境界 |
| latest handoff | `HANDOFF_2026-08-03.md` | AppChrome / Issue #91 の履歴、mobile / focus contract、runtime 未確認境界 |
| external research | `summary/20260804/0012-research-modern-sidebar-patterns-20260805-summary.md` | 529 行を分割して全文確認。complete-hide recommendation と再利用する寸法・階層・state・accessibility evidence を分離 |
| prior design | `summary/20260804/2323-design-desktop-collapsed-appchrome-rail-20260804-73749ef0-summary.md` | current 68px rail の設計、DOM、geometry、state、acceptance |
| prior implementation | `summary/20260804/2346-implement-desktop-collapsed-appchrome-rail-20260804-summary.md` | current collapsed rail の実装内容と static / runtime evidence 境界 |
| current controller | `src/app/_components/app-chrome.tsx` | 2 branch desktop DOM、toggle remount / focus restoration、breakpoint reset、mobile overlay lifecycle |
| current parts | `src/app/_components/app-chrome-parts.tsx` | brand link、1 nav item、create link、collapsed component、icons、accessible labels / tooltip |
| current CSS | `src/app/styles/app-shell.css` | 68px collapsed / clamp expanded geometry、bottom CTA、state styles、900 / 901px rules |
| current visual tokens | `src/app/styles/foundation.css` | warm-paper surface、ink、line、accent、focus token |
| current contracts | `test/notes/app-chrome-contract.test.js`、`test/notes/app-chrome-responsive-contract.test.js` | current branch DOM / 68px geometry / mobile behavior / `/backup` exclusion assertions |
| old collapsed image | `/Users/blp542/Desktop/スクショ/スクリーンショット 2026-08-04 3.40.31.png` | C mark、menu、selected notes tile、bottom action が別 treatment として競合する旧表示 |
| old expanded image | `/Users/blp542/Desktop/スクショ/スクリーンショット 2026-08-04 23.12.37.png` | 約 248px sidebar、boundary toggle、1 nav row、孤立した bottom create の旧表示 |
| summary rules | `summary/README.md`、`summary/task-summary-template.md` | filename、required headings、verification |

画像 2 点はいずれも current implementation summary より前の capture であり、本設計値や current runtime の PASS 証拠として使用していない。

## Evidence Applied

### External evidence retained after the override

| ID | `外部調査事実` | 本設計への適用 |
|---|---|---|
| E-001 | Microsoft Compact pane は 48 DIP。expanded / compact で pane anatomy を保ち、icon-only には tooltip を用いる | 48px を候補に残し、同一 hierarchy / explicit tooltip を採用 |
| E-002 | Material dense rail は 56dp、default は 72dp。rail は 3〜7 top-level destination 向け | 将来 3〜7 件を主要 sizing case とし、56px を候補の基準値にする |
| E-003 | Material の optional primary action は destination group より上に置き、下には置かない | create を top cluster に置く |
| E-004 | shadcn/ui は icon width 3rem、expanded width 16rem、desktop / mobile state を分離する | 48px は比較候補、expanded 256px と desktop / mobile state 分離を採用 |
| E-005 | Carbon panel は 256px、selected は background + leading border、navigation area は content density に応じて扱う | expanded 256px、current indicator、nav-only scroll responsibility を採用 |
| E-006 | Apple guidance は critical action を sidebar bottom に置かない | bottom create を廃止し、top cluster へ移す |
| E-007 | WCAG 2.2 SC 2.5.8 minimum は原則 24×24 CSS px。research Worker は Cornell product target として 44px を推奨 | 44×44px をすべての desktop interactive row / icon target に固定 |
| E-008 | WCAG 2.2 SC 2.4.3 は意味を保つ sequential focus order を要求 | visual order と DOM / Tab order を一致させ、positive `tabindex` を禁止 |

一次資料 URL とアクセス日は external research summary を正本とする。本 task はその evidence の適用設計であり、外部サイトの再計測はしていない。

### Current implementation and old-image evidence

| ID | evidence type | 確認内容 | 本設計での扱い |
|---|---|---|---|
| C-001 | `現行 source 事実` | collapsed width は `4.25rem` = 68px | 56px へ変更 |
| C-002 | `現行 source 事実` | expanded width は `clamp(13.5rem, 18vw, 15.5rem)` | exact 16rem へ変更 |
| C-003 | `現行 source 事実` | open は boundary-straddling chevron、closed は rail 内 hamburger。別 DOM branch と別 geometry | 1 button / 1 DOM / fixed x-y、panel icon family へ変更 |
| C-004 | `現行 source 事実` | desktop brand は open / collapsed とも `/notes` link | desktop identity を non-link に変更。mobile brand link は維持 |
| C-005 | `現行 source 事実` | current global nav は `/notes` 1 件 | route array は変更せず、新 placeholder を作らない |
| C-006 | `現行 source 事実` | create `/notes/new` は desktop footer の `margin-top:auto` | desktop top cluster へ移す。mobile footer は維持 |
| C-007 | `現行 source 事実` | collapsed brand / toggle / nav / CTA は 44px と 48px、bordered / selected / outlined treatments が混在 | interactive target を 44px、icon を 20px、surface state の優先順位を統一 |
| C-008 | `現行 source 事実` | accessible name と hover / `:focus-visible` tooltip は存在する | accessible-name rule を維持し、non-clipping overlay contract へ強化 |
| C-009 | `現行 source 事実` | mobile は 900px 以下で 72px header + overlay。Escape、Tab loop、backdrop、body lock、pathname close、focus restoration がある | 変更しない |
| I-001 | `旧画像観察` | collapsed は C box、menu box、selected tile、bottom create の 4 treatments が縦一列で競合 | C を noninteractive / unboxed、toggle を borderless neutral、create と current nav を別 semantic style にする |
| I-002 | `旧画像観察` | expanded は 1 nav と bottom CTA の間が大きく、CTA が孤立して見える | create と nav を top cluster にまとめ、残余領域を nav capacity として定義 |
| I-003 | `旧画像観察` | open toggle は boundary、旧 collapsed toggle は別 x-axis | sidebar の左 56px icon column に toggle anchor を固定 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | current desktop brand と current notes item はともに `/notes` を指す | `app-chrome-parts.tsx` |
| F-002 | fact | current open / collapsed toggle は同じ logical id / handler を共有するが、別 branch で mount され、icon と位置が違う | `app-chrome.tsx`、`app-shell.css` |
| F-003 | fact | current desktop create は nav group から `margin-top:auto` で離れる | `app-shell.css` |
| F-004 | fact | current tests は 68px、`AppChromeCollapsedNavigation`、bottom footer、branch toggle を positive contract とする | focused tests 2 件 |
| F-005 | assumption | 56px rail + 44px target + 20px icon は、current 68px より軽く、48px より focus / warm-paper spacing に余裕があり、3〜7 items に耐える最小の comfortable geometry である | E-001〜E-008 と candidate calculation |
| F-006 | assumption | same-DOM sidebar を 56px icon column + 200px label area と考えると、open / collapsed の continuity と future item alignment を同時に説明できる | geometry / focus contract |
| U-001 | unknown | 本 exact geometry の current browser rendering | 本 task は source を変更せず Browser runtime を実施していない |
| U-002 | unknown | `/backup` を common navigation に含める最終 product decision | documents と current source / tests が不一致 |

## Information Architecture

### Chosen hierarchy

desktop は expanded / collapsed で別 navigation tree を作らず、次の 1 hierarchy / 1 DOM を共有する。collapsed は同じ sidebar の label area だけを閉じた状態である。

```text
DesktopSidebar (aside, always present at >=901px)
├─ ProductIdentityHeader
│  ├─ C identity mark (non-link, non-focusable)
│  └─ product title/subtitle (expanded visible, collapsed visually hidden)
├─ PaneToggle (one persistent button)
├─ PrimaryCreateAction (`/notes/new`, current implementation)
├─ NavigationScrollRegion
│  ├─ PrimaryNavigationGroup (current `appChromeNavItems` only)
│  └─ SecondaryUtilityGroup (render only after a real product decision adds items)
└─ SidebarFooter (render only when a real non-critical footer responsibility exists)
```

DOM / visual / Tab order は `identity (non-focusable) → toggle → create → primary nav → optional secondary / utility nav → optional footer → main` とする。CSS order、positive `tabindex`、desktop open / collapsed 用の duplicated links で順序を変えない。

### Brand / product identity decision

- desktop expanded: C mark + `Cornell Method Notebook` + `ローカル学習ノート` を product identity として表示する。
- desktop collapsed: C mark だけを残す。
- desktop の C / copy は `<Link>` にせず、`/notes` へ遷移しない noninteractive identity とする。hover、focus、tooltip、current style を持たせない。
- collapsed mark は border / button background を持たない typography-only mark とし、control に見せない。
- product identity の programmatic text は DOM に残すが、Tab stop にはしない。
- mobile header の current brand link は mobile non-regression のため変更しない。

これにより desktop では brand と `/notes` nav の route duplicate を解消し、現在位置は navigation row だけが表す。

### Pane toggle decision

- expanded / collapsed の両方で同じ `<button>` node を使う。state branch で unmount / remount しない。
- button の hit box は両状態で同じ x / y / width / height とする。sidebar は右側だけを 56px ↔ 256px へ伸縮する。
- icon は hamburger と single chevron の混在をやめ、同じ panel-outline family の `panel-left-close` / `panel-left-open` を state で切り替える。
- desktop toggle は navigation destination ではなく neutral pane control であり、current indicator / create fill を使用しない。

### Create placement decision

- desktop create は pane toggle の直下、primary navigation の直前に置く top primary action とする。
- `/notes/new` は action route であり、primary navigation destination count に含めない。
- create は常時 accent-filled。`/notes/new` で `aria-current="page"` を持っても navigation leading indicator を付けない。
- desktop bottom footer から create と divider を除去する。mobile overlay 内の current footer create は変更しない。

Material の top action と Apple の bottom-critical-action 回避を適用し、current 1 item でも `toggle → create → notes` が 1 つの task cluster として読めるようにする。

### Primary, secondary, and footer responsibility

| group | responsibility | current rendering | future rule |
|---|---|---|---|
| primary navigation | 頻繁に切り替える top-level destination | current `ノート一覧` だけ | real canonical destination を 3〜7 件まで同じ 44px rows に append。placeholder 禁止 |
| secondary / utility | 低頻度だが navigation として遷移する destination | group / divider とも render しない | product decision 後だけ primary の下に divider 付きで render |
| footer | user / workspace / status 等、navigation scroll と別に常時見せる non-critical responsibility | render しない | real responsibility がある時だけ render。create や critical action を置かない |

`/backup` は上記どの group にも本 task では割り当てない。

### Empty space and overflow responsibility

- brand、toggle、create は top に固定する。
- primary + optional secondary navigation だけが残り高さを占める `min-height:0; overflow-y:auto` の scroll region になる。
- current 1 item の下の余白は「未使用 footer との距離」ではなく「navigation scroll capacity」である。bottom edge に action、divider、empty placeholder を置かない。
- 3〜7 items は row height / gap を変えず増える。viewport height が不足した場合だけ nav region が縦 scroll し、header / toggle / create / main page は動かない。
- optional secondary group と footer は空なら wrapper / divider を含めて render しない。
- tooltip は scroll region の descendant clipping に依存させず、後述の fixed overlay layer へ描画する。

## Exact Geometry

### Collapsed width comparison

px は current root `16px` の rem 換算。44px target と focus outline は Cornell product contract であり、WCAG が 44px を必須とするという意味ではない。

| candidate | external relation | 44px target の外側余白 | 20px icon の target 内側余白 | Cornell evaluation |
|---|---|---:|---:|---|
| `48px` / `3rem` | Microsoft Compact 48 DIP、shadcn icon width 3rem | 左右 2px | 左右 12px | 2px ring + 2px offset が rail edge へ達し、warm-paper divider と窮屈。最小 target は入るが不採用 |
| `56px` / `3.5rem` | Material dense rail 56dp | 左右 6px | 左右 12px | ring 外端まで rail edge から 2px 残る。3〜7 rows に十分で、68px より軽い。**採用** |
| `64px` / `4rem` | 直接一致する今回の主要 reference value なし | 左右 10px | 左右 12px | comfortable だが 56px より 8px の常時 cost があり、current 1 item の疎さを増やすため不採用 |
| `68px` / `4.25rem` | current Cornell implementation | 44px target なら左右 12px。current 48px rows なら左右 10px | current 20px icon | 44 / 48px target が混在し、C / toggle / tile / footer treatment を大きく見せる。current problem を維持するため不採用 |

Chosen collapsed width は exact `3.5rem` = `56px`。Material の見た目をコピーするのではなく、44px hit target、20px existing icon、2px + 2px focus ring、Cornell の light divider を同居させる最小 comfortable width として採用する。

### Global dimensions

| element | exact contract |
|---|---|
| desktop boundary | `min-width: 901px` |
| mobile boundary | `max-width: 900px` |
| expanded sidebar width | `16rem` = 256px、`box-sizing:border-box`。clamp しない |
| collapsed sidebar width | `3.5rem` = 56px、`box-sizing:border-box` |
| width delta / recovered main width | 200px |
| sidebar height / position | `100svh`; `position:sticky; top:0; align-self:flex-start` |
| sidebar surface | `var(--app-surface)` |
| sidebar outer divider | right `1px solid var(--app-line)`、width に内包 |
| sidebar shadow | none。expanded / collapsed で shadow hierarchy を変えない |
| identity header height | `3.5rem` = 56px、bottom `1px solid var(--app-line)` を height に内包 |
| interactive row height | `2.75rem` = 44px |
| icon size | `1.25rem` = 20px、24×24 viewBox、stroke `1.75` |
| rail / row outer inline inset | `0.375rem` = 6px |
| expanded row inline padding | `0.75rem` = 12px |
| icon-label gap | `0.75rem` = 12px |
| toggle → create gap | `0.75rem` = 12px |
| create → primary nav group gap | `1rem` = 16px |
| navigation row gap | `0.25rem` = 4px |
| primary → optional secondary group | margin-top 16px、top divider 1px、padding-top 12px |
| optional footer separator | top divider 1px、padding `12px 6px`。footer が空なら存在しない |
| control corner radius | `0.5rem` = 8px |
| selected indicator | `3px × 20px`、leading edge、vertical center、radius `999px`、`var(--app-accent-deep)` |
| focus ring | `2px solid var(--app-focus)`、offset `2px` |
| tooltip offset | collapsed は sidebar right edge から 8px。expanded toggle は button right edge から 8px |
| tooltip box | max-width 240px、padding `6px 8px`、border 1px、radius 6px、font `12px/16px`、z-index 60 |
| standard motion | width 160ms `cubic-bezier(0.2, 0, 0, 1)`、label opacity 100ms ease-out |
| reduced motion | width / opacity / tooltip transition `0ms` |

Expanded `16rem` は Carbon panel と shadcn default sidebar の 256px evidence を Cornell の fixed width として採用する。current clamp を廃止し、901 / 1280 / 1440px で label wrapping と toggle x-axis を安定させる。

### Fixed icon-column coordinates

sidebar left edge を `x=0`、top を `y=0` とする。border-box width なので right divider は expanded `x=255..256`、collapsed `x=55..56` に収まる。

| element | expanded rect | collapsed rect | note |
|---|---|---|---|
| identity header | `x=0, y=0, w=256, h=56` | `x=0, y=0, w=56, h=56` | same DOM |
| C identity mark | `x=12, y=12, w=32, h=32` | same | non-link / unboxed |
| brand copy | `x=56, y=10, w=184, h=36` | visually hidden | right inset 16px |
| pane toggle | `x=6, y=64, w=44, h=44` | same | same DOM / hit area / focus anchor |
| pane icon | center `x=28, y=86`, 20×20 | same | icon pathだけ state change |
| create action | `x=6, y=120, w=244, h=44` | `x=6, y=120, w=44, h=44` | label hidden only in collapsed |
| first primary nav row | `x=6, y=180, w=244, h=44` | `x=6, y=180, w=44, h=44` | later rows are `+48px` each |
| current indicator in first row | `x=6, y=192, w=3, h=20` | same | row leading edge |

brand title は `13px/18px`, weight 700、subtitle は `11px/16px`, weight 400、両者の gap は 2px とする。brand title / subtitle は fixed 184px 内の single line とし、default runtime では全文を表示して wrap / ellipsis させない。navigation / create label は `14px/20px`, weight 650 とし、single line + ellipsis で expanded row height を増やさない。

### Toggle icon family

desktop toggle は次の 24×24 panel family だけを使い、mobile hamburger は current mobile button だけに残す。

| state | icon name | shared paths | directional path |
|---|---|---|---|
| expanded | `panel-left-close` | rounded panel outline + `M9 3v18` divider | `m16 9-3 3 3 3`（left） |
| collapsed | `panel-left-open` | rounded panel outline + `M9 3v18` divider | `m14 9 3 3-3 3`（right） |

panel outline は `rect x=3 y=3 width=18 height=18 rx=2` とする。両 icon は 20px、stroke 1.75、round cap / join。hamburger、standalone chevron、bordered square を desktop state 間で切り替えない。

### Tooltip geometry and clipping contract

- collapsed の toggle / create / navigation item は explicit `aria-label` と同文の visual tooltip を持つ。identity mark は control ではないため tooltip を持たない。
- expanded では visible-label create / nav tooltip を出さず、icon-only toggle だけに dynamic tooltip を出す。
- visual tooltip は layout / accessibility name の source にせず `aria-hidden="true"`。programmatic name は button / link の `aria-label` または visible textで担保する。
- tooltip は `document.body` 直下または AppChrome top-level overlay layer に portal し、`position:fixed` で描画する。navigation scroll port / sidebar の overflow に clip される descendant absolute positioning は採用しない。
- collapsed の `left` は sidebar right `56px + 8px = 64px`。expanded toggle は button right `50px + 8px = 58px`。top は anchor の vertical center に合わせ、viewport top / bottom から最低 8px に clamp する。
- pointer hover と `:focus-visible` 相当の focus の両方で表示する。pointer leave / blur / Escape で閉じ、`pointer-events:none` とする。tooltip 表示は main の bounding box / scrollWidth を変えない。

## Visual State Language

### Semantic priority

visual priority は次の順で重ねる。後段は前段を消さない。

1. control role: neutral toggle / primary create / navigation destination
2. current route: navigation だけ background + indicator + icon/text color
3. hover / pressed: interaction feedback。current semantics は残す
4. `:focus-visible`: 2px ring。current / create fill を置換しない
5. tooltip: icon-only label。focus ring / current state を置換しない

### Exact states

| control / state | background | indicator / border / shadow | foreground |
|---|---|---|---|
| identity | transparent | border / hover / focus none | `var(--app-ink)`; subtitle `var(--app-muted-ink)` |
| toggle default | transparent | border / shadow none | `var(--app-muted-ink)` |
| toggle hover | `rgb(243 228 207 / 62%)` | none | `var(--app-accent-deep)` |
| toggle pressed | `var(--app-accent-soft)` | none | `var(--app-accent-deep)` |
| nav default | transparent | indicator / border none | `var(--app-muted-ink)` |
| nav hover, not current | `rgb(243 228 207 / 62%)` | indicator none | `var(--app-accent-deep)` |
| nav pressed, not current | `var(--app-accent-soft)` | indicator none | `var(--app-accent-deep)` |
| nav current | `var(--app-accent-soft)` | leading 3×20px indicator | `var(--app-accent-deep)` |
| nav current + hover | current background / indicator maintained | inset `0 0 0 1px rgb(143 77 19 / 18%)` | deep maintained |
| nav current + pressed | current background / indicator maintained | inset `0 0 0 2px rgb(143 77 19 / 22%)` | deep maintained |
| create default | `var(--app-accent-deep)` | border none | `#fffaf1` |
| create hover | deep maintained | `0 2px 8px rgb(79 65 45 / 16%)` | light maintained |
| create pressed | deep maintained | inset `0 0 0 2px rgb(255 250 241 / 28%)` | light maintained |
| any `:focus-visible` | role / current background maintained | 2px focus ring, 2px offset | role / current foreground maintained |

- navigation current を color だけで示さず、soft background + 3px indicator を常に組み合わせる。
- create は常時 filled action であり、navigation current indicator を使わない。`/notes/new` の `aria-current="page"` は programmatic current を伝えるが、action を selected nav tile へ変えない。
- default control ごとの 1px border box は置かない。sidebar outer divider、header / populated group divider、focus ring だけが線を担う。
- hover / pressed で width、height、padding、position、transform を変えない。

## Focus, Keyboard, Responsive, and Motion

### Desktop toggle and Tab order

- toggle は `button type="button"`, `id="app-chrome-rail-toggle"`, `aria-controls="app-chrome-sidebar"`, `aria-expanded={isRailOpen}` を持つ。
- label は expanded `サイドバーを折りたたむ`、collapsed `サイドバーを展開する`。
- pointer click / Enter / Space 後も同じ button node に focus が残る。toggle 用 remount 後 focus restoration / `requestAnimationFrame` は不要。
- brand は Tab stop にしない。
- desktop native Tab order は toggle → create → primary nav rows → optional secondary rows → optional footer controls → main とする。
- open / collapsed で links の DOM identity と順序を変えない。collapsed labels は visually hidden にするだけで、control は残す。
- positive `tabindex` は使用しない。
- 新しい Cmd/Ctrl sidebar shortcut は本 contract に追加しない。

### Breakpoint focus

current 900 / 901px state boundary と current breakpoint reset policy を維持する。

- `901px以上 → 900px以下`: mobile overlay を closed にする。desktop sidebar 内（toggle / create / nav / future utility）に focus があった場合だけ、render 後に visible mobile menu button へ focus を移す。main 内 focus は奪わない。
- `900px以下 → 901px以上`: mobile overlay を閉じ、body scroll lock を解除する。mobile menu / overlay descendant に focus があった場合は desktop toggle へ移す。current behavior と同じく desktop sidebar は expanded に reset する。
- pathname change は mobile overlay だけを閉じ、旧 mobile triggerへ focus を戻さない current contract を維持する。
- breakpoint により hidden になった DOM に focus を残さない。

### Mobile non-regression

次を変更しない。

- `max-width:900px` の sticky 72px header。
- current mobile brand link / menu button。
- overlay / backdrop / panel width、initial focus。
- Tab / Shift+Tab loop、Escape、close button、backdrop close。
- `inert` main、body scroll lock / restore。
- pathname-change close とその focus policy。
- desktop sidebar / tooltip を mobile で非表示・非 focusable にする rule。

### Motion

- normal motion は sidebar inline-size 160ms、label opacity 100ms だけ。control / icon の x-y は動かさない。
- `prefers-reduced-motion: reduce` では sidebar width、label、tooltip の transition / animation を `0ms` にする。
- transition 中も one DOM controls を維持し、duplicate focus target、transparent clickable gutter、pointer-activatable hidden label areaを作らない。

## State Matrix

| state | geometry / visible hierarchy | route / hover | keyboard focus | overflow responsibility |
|---|---|---|---|---|
| desktop expanded (`>=901`, open) | sidebar 256px。C + copy、same toggle at 6/64、filled create、visible-label nav。main starts at x=256 | current nav = soft + 3px indicator。hover は current を消さない | toggle tooltip。Tab は toggle → create → nav → main | nav region only scrolls。header / toggle / create fixed |
| desktop collapsed (`>=901`, closed) | sidebar 56px。non-link C、same toggle at 6/64、icon create、icon nav。main starts at x=56 | same current background / indicatorを44px tile内に表示。create は filledのまま | toggle / create / nav は explicit name。focus ring + tooltip を同時表示 | same nav scroll region。tooltip は fixed overlay、rail に clip されない |
| mobile closed (`<=900`) | desktop sidebar / tooltip hidden。current 72px mobile header + main | current desktop visual state は描画しない | mobile menu が Tab stop。desktop focused control から来た場合ここへ focus | page / current mobile behavior |
| mobile overlay open (`<=900`) | current backdrop + panel overlay。main inert | visible-label mobile nav / create の current behaviorを維持 | initial focus、Tab loop、Escape / close / backdrop、body lock | panel own vertical scroll |
| current route (orthogonal) | geometry unchanged | navigation: background + indicator + deep icon/text。create: filled unchanged + `aria-current` | focus ring overlays current state | unchanged |
| pointer hover / pressed (orthogonal) | geometry / position unchanged | low-emphasis hover、role-specific pressed。current foundation retained | focus stateとは独立 | unchanged |
| keyboard focus (orthogonal) | 2px ring + 2px offset。collapsed icon-onlyはtooltip | current / create fill retained | visible focus order follows DOM。tooltip is not a Tab stop | focusing scrolled item brings it into view |
| future 3〜7 primary items | exact 44px rows + 4px gapsをappend。未実装 placeholderなし | each real routeだけcurrent判定 | source array orderどおり | 通常高さでは同じ cluster。高さ不足時だけ nav region scroll |
| future overflow / optional secondary | primary後に real secondary groupだけ divider付きでrender | primary / secondaryとも同じ nav state language | Tabでscroll region内をsource orderで進む | header / toggle / create / populated footerは固定、primary+secondaryだけscroll |

## ASCII Wireframes

座標は sidebar border-box の left / top 基準。図中の future capacity は説明用であり、production DOM に placeholder を表示しない。

### Desktop expanded (`>=901px`, width 256px)

```text
x=0                         x=256
┌──────────────────────────────┬───────────────────────────────┐ y=0
│  C    Cornell Method Notebook│                               │
│       ローカル学習ノート     │                               │ h=56
├──────────────────────────────┤            MAIN               │ y=56 (1px divider)
│[ panel-left-close ]           │                               │ y=64, 44×44 at x=6
│                               │                               │ 12px
│[ +   新規ノート            ]│                               │ y=120, 244×44
│                               │                               │ 16px group gap
│▌[ note  ノート一覧         ]│                               │ y=180, 244×44 current example
│  (real nav rows: +48px each)  │                               │
│                               │                               │
│  navigation scroll capacity   │                               │
│  no placeholder / no bottom   │                               │
│  create CTA                    │                               │
└──────────────────────────────┴───────────────────────────────┘
  right divider included in 256px; main begins at x=256
```

### Desktop collapsed (`>=901px`, width 56px)

```text
x=0     x=56
┌────────┬─────────────────────────────────────────────────────┐ y=0
│   C    │                                                     │ non-link 32×32 at 12/12
├────────┤                    MAIN                             │ y=56
│[panel>]│                                                     │ y=64, same 44×44 at x=6
│        │                                                     │ 12px
│[  +  ] │                                                     │ y=120, filled 44×44
│        │                                                     │ 16px
│▌[note] │                                                     │ y=180, current 44×44
│  ...   │                                                     │ real items only
│        │                                                     │ nav scroll capacity
│        │                                                     │ no isolated bottom CTA
└────────┴─────────────────────────────────────────────────────┘
  right divider included in 56px; main begins at x=56
  collapsed tooltip begins at x=64 and overlays without reflow
```

## Keep / Change / Remove

### Keep

| current responsibility | reason |
|---|---|
| `isRailOpen` default `true` と expanded / collapsed state class | 発注者決定の 2-state model |
| `/notes` current matching（`/notes/new` を除外）と `/notes/new` create current | canonical current behavior |
| `appChromeNavItems` を desktop / mobile の source として再利用 | route drift / placeholder 防止 |
| `aria-current="page"`、SVG `aria-hidden` / `focusable=false` | current route と icon accessibility |
| existing warm-paper tokens (`surface`, `ink`, `line`, `accent`, `focus`) | Cornell visual language |
| desktop 901px / mobile 900px boundary | explicit non-regression requirement |
| mobile overlay、Escape、Tab loop、backdrop、body lock、pathname close、focus return | explicit non-regression requirement |
| `main#app-main-content` と mobile open 時の `inert` | landmark / modal interaction |
| 20px icon base と 44px minimum target | current asset language + chosen density |

### Change

| current responsibility | final contract |
|---|---|
| expanded clamp 216〜248px | exact 256px / 16rem |
| collapsed 68px / 4.25rem | exact 56px / 3.5rem |
| open aside + collapsed aside の branch | always-mounted 1 desktop aside / same link DOM |
| boundary chevron + centered hamburger | same 44px button at x6 / y64、panel-left close/open family |
| desktop brand `/notes` link | non-link identity。expanded mark+copy / collapsed mark-only |
| bordered C mark | unboxed typography-only 32px mark |
| bordered pane toggle | neutral borderless control。hover / pressed / focusだけsurfaceを付与 |
| desktop bottom create | top cluster、toggleの12px下、navの16px上 |
| 48px collapsed nav / CTA と 44px toggleの混在 | all interactive rows 44px、icons 20px |
| current selected border tile | borderなし soft background + 3×20px leading indicator |
| descendant absolute tooltip | fixed top-level overlay、8px offset、viewport clamp |
| whole railのlarge empty middle + footer separation | nav-only scroll capacity。bottom critical actionなし |
| remount後の desktop toggle focus restoration | same nodeにnative focus維持 |

### Remove

| current element / rule | reason |
|---|---|
| `AppChromeCollapsedNavigation` component / import / export | duplicated desktop tree と remount を作るため |
| `hidden={!isRailOpen}` / `aria-hidden={!isRailOpen}` desktop aside branch | collapsed でも same aside / nav を使うため |
| conditional open toggle / collapsed toggle nodes | one control identity のため |
| desktop `chevron-left` / collapsed `menu` toggle pairing | state間で別 controlに見えるため |
| desktop brand `href="/notes"`, brand tooltip, brand focus state | notes nav との semantic duplicate を解消するため |
| desktop footer `margin-top:auto` create / divider | action isolation を解消するため |
| default border box を C / toggle / nav / create へ重ねる rules | visual treatment competition を解消するため |
| current 68px / brand-slot / 48px collapsed-specific geometry assertions | new exact geometry と矛盾するため |
| `shouldRestoreDesktopFocusRef` と toggle remount用 rAF focus | one DOM buttonでは不要なため |

mobile panel footer、mobile brand link、mobile hamburger は Remove 対象ではない。

## Acceptance

### Static acceptance for the later coding Worker

#### DOM and information architecture

- desktop `aside#app-chrome-sidebar` は 901px 以上で expanded / collapsed とも 1 node。`AppChromeCollapsedNavigation` が source / import / test に存在しない。
- desktop aside 内の source order は non-link identity header → one toggle → desktop create → navigation scroll region（primary → optional secondary）→ optional footer。
- desktop brand markup に `href="/notes"` がない。collapsed C は non-focusable。mobile brand link は current のまま残る。
- current production nav items は `/notes` だけ、create は `/notes/new` のまま。future route / disabled placeholder / empty secondary wrapper を追加しない。
- `/backup` の presence / absence assertion、route source、documents を本 rail coding task で変更しない。
- desktop create は nav 前の top cluster にあり、desktop footer / `margin-top:auto` に存在しない。mobile create footer は残る。

#### Toggle, state, and focus

- desktop toggle button は JSX 上 1 node、same id / ref / handler。open / collapsed conditional branchの外にある。
- `aria-controls="app-chrome-sidebar"`、state-derived `aria-expanded`、dynamic Japanese accessible label を持つ。
- desktop toggle icon は `panel-left-close` / `panel-left-open`。desktop state control に `menu` / standalone chevron を使わない。mobile menu icon は維持する。
- toggle click 後の remount focus restoration ref / effect を削除し、same button focus を維持する。
- native DOM / Tab order は toggle → create → primary → secondary → footer → main。positive `tabindex` なし。
- breakpoint focus predicate は desktop aside の全 focusable descendants を包含し、900 / 901 transition の current focus policyを維持する。

#### CSS geometry

- expanded token は exact `16rem`、collapsed token は exact `3.5rem`。current clamp / `4.25rem` は desktop width contract から消える。
- header 3.5rem、target 2.75rem、icon 1.25rem、outer inset 0.375rem、row padding / icon-label gap 0.75rem、action gap 0.75rem、nav group gap 1rem、row gap 0.25rem を source contract が固定する。
- toggle は両 state で x6 / y64 / 44×44、create は y120、first nav は y180 になる flow rulesを持つ。state別 left / top overrideなし。
- sidebar border-box は right 1px dividerを幅に含み、expanded / collapsed とも shadowなし。
- navigation rowsは44px、radius8px。current indicatorは3×20px。focusは2px + offset2px。
- desktop brand mark 32px、copy typography 13/18 + 11/16、nav / create 14/20。
- nav scroll region は `min-height:0; overflow-y:auto`。header / toggle / createはscroll region外。empty secondary / footer dividerなし。
- `@media (prefers-reduced-motion: reduce)` が width / label / tooltip transitionを0msにする。

#### Visual states and tooltip

- default nav / toggleに1px border boxなし。current navだけsoft background + 3px indicator + deep icon/text。
- createはdefaultからdeep filled / light text。`/notes/new` でもnav indicatorを持たない。
- hover / pressed rulesはcurrent background / indicatorを消さず、geometry / transformを変えない。
- focus-visible ruleはrole / current fillと共存する。
- collapsed toggle / create / navはexplicit accessible nameを持つ。expanded visible-label nav / createにredundant `aria-label`を付けない。
- tooltipはtop-level fixed overlayで、collapsed left 64px、expanded toggleはbutton right+8px、viewport edge 8px clamp。nav scroll containerのabsolute descendantだけに依存しない。
- tooltipはhoverとkeyboard focusで表示し、blur / leave / Escapeで消え、layout width / scrollWidthへ参加しない。

#### Responsive and non-scope

- 901px以上はdesktop same-DOM sidebar、900px以下はcurrent mobile header / overlayだけ。
- mobile Escape、Tab loop、initial focus、backdrop、body scroll lock / restore、pathname close、focus return、main `inert` source contractが残る。
- API、DB、CanvasDocumentV1、route files、dependencies、foundation token valuesを変更しない。
- code Worker は focused testsをnew contractへ更新し、旧 `AppChromeCollapsedNavigation` / 68px / bottom desktop footer assertionsをnegative assertionへ変える。ただし `/backup` product assertionは別 taskまで保持する。

Recommended later verification commands:

```sh
node --test test/notes/app-chrome-contract.test.js test/notes/app-chrome-responsive-contract.test.js
npm run lint
npx tsc --noEmit --pretty false --incremental false
npm run build
git diff --check
git diff --cached --check
```

### Browser runtime acceptance

本 task では未実施。static contract / old screenshots を runtime PASS として代用しない。later coding Worker は current runtime から新しい screenshot / bounding-box evidence を取得する。

#### Geometry and route matrix

| viewport / state | runtime acceptance |
|---|---|
| 901px expanded | sidebar border-box 256px ±0.5、main left 256px ±0.5、horizontal overflowなし |
| 901px collapsed | sidebar 56px ±0.5、main left 56px ±0.5、expanded比でmain widthが200px ±0.5回復 |
| 1280 / 1440 expanded | widthはclampせず256px ±0.5。brand label ellipsis / wrap regressionなし |
| 1280 / 1440 collapsed | width56px ±0.5。transparent gutter / second control column / shadowなし |
| both desktop states | toggle rect x6 / y64 / 44×44 ±0.5、icon center x28 / y86 ±0.5。DOM node identityとfocus維持 |
| expanded geometry | C 12/12/32×32、create 6/120/244×44、first nav 6/180/244×44 ±0.5 |
| collapsed geometry | C 12/12/32×32、create 6/120/44×44、first nav 6/180/44×44 ±0.5 |
| `/notes` | notes current background + 3px indicator。createはfilled but non-current。brandはclick / focus不可 |
| `/notes/new` | createにprogrammatic current。create visualはfilled actionのまま、notes current indicatorなし |
| 900px | desktop sidebar / desktop tooltip / desktop toggle hidden and unfocusable。current 72px mobile header visible |

#### Interaction acceptance

- pointer / Enter / Space で expanded ↔ collapsed。toggleの`isSameNode`相当がtrueで、focusが同じbuttonに残る。
- state change前後で toggle bounding rect x / y / size が ±0.5px以内、iconだけpanel-close / panel-openへ変わる。
- collapsedのbrand Cはpointer cursor / hover surface / tooltip / route navigationを持たない。
- create、nav、toggleのdefault / hover / pressed / current / focus-visibleを個別と複合で確認し、current indicator、create fill、focus ring、tooltipが互いを消さない。
- collapsed toggle / create / nav tooltipがpointer hoverとTab focusの両方で表示される。left=64px ±1、main / sidebarのbounding boxとdocument scrollWidthが表示前後で不変、viewport top / bottomから8px以上、scroll portにclipされない。
- expanded nav / createにはtooltipを出さず、toggle tooltipだけbutton right+8pxに出る。
- Tab orderがtoggle → create →current source orderのnav → main。brand / hidden label / tooltipはTab stopにならない。
- desktop sidebar descendant focus中の901→900でmobile menuへfocus。main focus中はfocusを奪わない。
- mobile menu / overlay focus中の900→901でoverlay / body lockが解除され、expanded desktop toggleへfocusする。
- mobile overlayでinitial focus、Tab / Shift+Tab loop、Escape、close、backdrop、body scroll restore、pathname closeがcurrent contractどおり動く。
- `prefers-reduced-motion:reduce` でwidth / label / tooltip animationのcomputed durationが0s。

#### Future density / overflow acceptance

production UIへ placeholderを追加せず、test-only fixtureまたは一時的な Browser test dataで real-shaped primary rowsを7件にして確認する。

- 7 rowsでも row 44px / gap 4px / icon axis x28を維持し、item数に応じてgapを伸縮しない。
- short desktop heightで `navigationScrollHeight > navigationClientHeight` となり、header、toggle、createのy座標はscroll前後で不変。
- wheel / trackpad / keyboard focusでlast nav itemへ到達できる。
- optional secondary test fixtureではprimary後のdivider 1px / margin16 / padding12が現れ、empty fixtureではwrapper / dividerが存在しない。
- scrollしたicon-only itemのtooltipがrail / scroll viewportにclipされず、viewportへclampされる。
- bottom edgeにcreate / critical actionが出現しない。

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260805/0039-design-future-ready-persistent-appchrome-rail-20260805-summary.md` | Decision Override、evidence、future-ready hierarchy、exact geometry、state / focus / tooltip / overflow、wireframe、Keep / Change / Remove、static / runtime acceptanceを作成 | 後続 coding Workerが追加判断なしでpersistent railを実装できる正本を残すため |

source、CSS、tests、settings、dependencies、routes、images、generated artifacts、queue running / done / failed、Git historyは変更していない。既存 staged / unstaged / untracked filesを戻していない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 確認済み | AppChrome 5 tracked filesの既存 staged / unstaged状態と多数の既存untracked filesを保護 |
| external research全文 | PASS | 529行を3分割して末尾 `Next Read` まで確認 |
| prior design / implementation summary | PASS | 指定2件を全文確認 |
| current source / CSS / tests | PASS | 対象5 filesをcurrent worktreeからread-only確認 |
| old screenshots 2点 | PASS as old-image observation | original detailで確認。current runtime evidenceには不使用 |
| Decision Override | PASS | complete-hide recommendationだけを不採用とし、persistent 2-stateを前提化 |
| required design sections | PASS | Decision Override、Evidence Applied、Information Architecture、Exact Geometry、State Matrix、Keep / Change / Remove、Acceptance、Remaining Unknowns、Next Readを収録 |
| code / settings / dependencies / generated artifacts | NOT CHANGED | design-only task |
| Browser runtime | NOT RUN | exact valuesはdesign acceptance。current runtime PASSとは記録しない |

## Remaining Unknowns

| ID | 未確認事項 | 影響 | 次に必要な根拠 |
|---|---|---|---|
| U-001 | 56 / 256px geometryのactual runtime | visual density、main width、bounding boxは未証明 | implementation後の901 / 1280 / 1440px Browser computed geometryとnew screenshots |
| U-002 | same-DOM toggle / breakpoint focusのactual browser behavior | static sourceだけではfocus移動とDOM identityを証明できない | click / keyboard / 900↔901 runtime assertions |
| U-003 | portal tooltipのviewport clampとnav overflow時のplacement | browser layout / scroll依存 | collapsed hover / focus、short-height / 7-row fixture runtime |
| U-004 | 256pxでbrand full titleが各font renderingでsingle-line表示できるか | system font差でellipsisになる可能性 | Mac runtime at 901 / 1280 / 1440px。unexpected ellipsis / wrapはFAIL |
| U-005 | `/backup` common navigationのfinal product authority | future item count / group assignmentへ影響 | 発注者 / Managerの別product decision。rail coding taskへ混ぜない |
| U-006 | future secondary / footerの実際のitems | architecture slotだけ確定、production UIは空 | real feature / route decision後のseparate design task |

## Next Read

後続 coding Worker は次の最小順で読む。

1. `summary/20260805/0039-design-future-ready-persistent-appchrome-rail-20260805-summary.md`
2. `src/app/_components/app-chrome.tsx`
3. `src/app/_components/app-chrome-parts.tsx`
4. `src/app/styles/app-shell.css`
5. `test/notes/app-chrome-contract.test.js`
6. `test/notes/app-chrome-responsive-contract.test.js`

`/backup` product decisionを行う task は追加で `doc/implementation/MVP_CONTRACT.md`、`doc/implementation/IMPLEMENTATION_STATUS.md`、`doc/testing/TEST_SCENARIOS.md` を読む。rail implementationだけを行う場合は route / documentsを変更しない。
