---
summary_type: task-summary
created_at: 2026-08-05 00:12 JST
task_kind: research
task_status: done
---

# Modern Sidebar Patterns Research for Cornell Method Notebook

## Objective

現行の desktop collapsed AppChrome を、好みではなく一次資料・現行情報量・アクセシビリティから再評価する。Microsoft、Material、Apple、Notion、Slack、Carbon、shadcn/ui と WCAG 2.2 を比較し、Cornell Method Notebook に適した desktop sidebar の開閉方式を 1 案へ絞り、後続の design / coding task が追加判断なしで使える仕様と受け入れ条件を残す。

結論は、desktop は初期状態を expanded とし、閉じたときは sidebar を `0px` まで完全に隠し、main 側の小さな panel toggle だけを残す方式である。現行の「主要遷移 1 件 + 作成 1 件」に persistent icon rail は適合しない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | desktop AppChrome の expanded / collapsed / hidden、sidebar / rail の情報設計、responsive、keyboard / focus / accessible name |
| 外部調査 | Microsoft NavigationView、Material Design 2 Navigation Rail、Apple HIG Sidebars、Notion、Slack、Carbon UI shell left panel、shadcn/ui Sidebar、WCAG 2.2 Target Size / Focus Order |
| 現行照合 | 提供スクリーンショット 2 点、`src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx`、`src/app/styles/app-shell.css`、関連 route / MVP 文書 |
| 成果物 | 本 summary 1 件のみ |
| 対象外 | source / test / config / dependency / generated artifact の変更、runtime UI の変更、commit / push / PR / Issue / queue state の操作 |

### Evidence labels

本文では証拠の種類を次のように分ける。

| ラベル | 意味 |
|---|---|
| `公式記載` | 公式プロダクト Help、公式デザインシステム、公式 component source に明記された事実。外部 URL を同じ行に付ける |
| `提供画像観察` | ユーザーが指定した 2 枚のスクリーンショットから直接読み取れる事実 |
| `現行 source 事実` | 現 worktree の source / CSS / test から直接確認した事実 |
| `Worker 推論` | 公式事実・画像・source を Cornell Method Notebook へ当てはめた判断 |
| `未確認` | 公式資料に明記がない、画像と source の時点が違う、または runtime を実測していない事項 |

公式ページの画像キャプションは公式記載として参照したが、外部プロダクトの実画面を pixel 計測していない。したがって、公式資料が数値を示していない Notion / Slack / Apple の幅や breakpoint を推測で補っていない。

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| repository instructions | `AGENTS.md` | MVP 正本、作業前後 status、summary、未コミット変更保護、Manager / Worker 境界 |
| latest handoff | `HANDOFF_2026-08-03.md` | AppChrome、mobile focus、Issue #91、runtime 未確認境界 |
| prior design | `summary/20260804/2323-design-desktop-collapsed-appchrome-rail-20260804-73749ef0-summary.md` | 4.25rem full-height icon rail の設計根拠、寸法、state、acceptance |
| prior implementation | `summary/20260804/2346-implement-desktop-collapsed-appchrome-rail-20260804-summary.md` | 現行 collapsed rail の実装内容と static verification |
| current AppChrome | `src/app/_components/app-chrome.tsx` | desktop / mobile state、DOM branch、toggle、focus restoration、overlay |
| current parts | `src/app/_components/app-chrome-parts.tsx` | brand、唯一の nav item、create action、icon-only labels / tooltips |
| current CSS | `src/app/styles/app-shell.css` | 68px rail、44 / 48px targets、spacing、footer auto placement、900 / 901px boundary |
| current tests | `test/notes/app-chrome-contract.test.js`、`test/notes/app-chrome-responsive-contract.test.js` | current source contract、`/backup` を除外する assertion、mobile non-regression |
| current routes | `src/app/notes/**`、`src/app/backup/page.tsx` | `/notes`、`/notes/new`、`/notes/[id]`、`/backup` の実在 |
| page headers | `src/modules/notes/ui/components/list/list.tsx`、`src/modules/backup/ui/components/backup-page.tsx`、note detail components | page-level primary action / return action と AppChrome の重複・配置 |
| MVP contract | `doc/implementation/MVP_CONTRACT.md` | canonical route は `/backup`。`/notes/backup` は MVP 外 |
| implementation status | `doc/implementation/IMPLEMENTATION_STATUS.md` | 共通 navigation は `/notes`、`/notes/new`、`/backup` を提供すると記載 |
| test scenarios | `doc/testing/TEST_SCENARIOS.md` | 共通 navigation から `/backup` へ移動できることを確認対象として記載 |
| provided image | `/Users/blp542/Desktop/スクショ/スクリーンショット 2026-08-04 3.40.31.png` | 問題となった collapsed view。1915 x 957px image |
| provided image | `/Users/blp542/Desktop/スクショ/スクリーンショット 2026-08-04 23.12.37.png` | expanded view。1915 x 957px image |
| summary rules | `summary/README.md`、`summary/task-summary-template.md`、`tools/check-summary.sh` | file naming、必須 heading、検証方法 |

## Sources

アクセス日はすべて 2026-08-05 JST。最低 6 件という条件に対し、7 つのプロダクト / デザインシステムと WCAG 2.2 を一次資料で確認した。

### Microsoft

- [NavigationView — Windows apps](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/navigationview)
- [NavigationView.CompactPaneLength — Windows App SDK / WinUI](https://learn.microsoft.com/en-us/windows/winui/api/microsoft.ui.xaml.controls.navigationview.compactpanelength?view=winui-2.8)
- [NavigationView.OpenPaneLength — Windows App SDK](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.navigationview.openpanelength)
- [Tooltips — Windows apps](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/tooltips)

### Material Design 2

- [Navigation rail — Material Design 2](https://m2.material.io/components/navigation-rail)
- [Bottom navigation — Material Design 2](https://m2.material.io/components/bottom-navigation/)
- [Understanding navigation — Material Design 2](https://m2.material.io/design/navigation/understanding-navigation.html)

### Apple

- [Sidebars — Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/sidebars)
- [NavigationSplitView — SwiftUI](https://developer.apple.com/documentation/swiftui/navigationsplitview)
- [sidebarToggle — SwiftUI ToolbarDefaultItemKind](https://developer.apple.com/documentation/swiftui/toolbardefaultitemkind/sidebartoggle)

### Notion

- [Navigate with the sidebar — Notion Help](https://www.notion.com/help/navigate-with-the-sidebar)
- [The best way to set up your team’s sidebar — Notion guide](https://www.notion.com/en-gb/help/guides/the-best-way-to-set-up-your-teams-sidebar-for-clear-organization)
- [Notion for mobile](https://www.notion.com/help/notion-for-mobile)

### Slack

- [Adjust your sidebar preferences — Slack Help](https://slack.com/help/articles/212596808-Adjust-your-sidebar-preferences)
- [A consolidated set of tabs for Slack on desktop](https://slack.com/help/articles/44134792609555-A-consolidated-set-of-tabs-for-Slack-on-desktop)
- [Customize the Slack mobile app](https://slack.com/help/articles/29788684062739-Customize-the-Slack-mobile-app)
- [Slack keyboard shortcuts](https://slack.com/help/articles/201374536-Slack-keyboard-shortcuts-and-commands)
- [Navigate Slack with your keyboard](https://slack.com/intl/en-gb/help/articles/115003340723-Navigate-Slack-with-your-keyboard)

### Carbon Design System

- [UI shell left panel — Usage](https://carbondesignsystem.com/components/UI-shell-left-panel/usage/)
- [UI shell left panel — Style](https://carbondesignsystem.com/components/UI-shell-left-panel/style/)
- [UI shell left panel — Accessibility](https://carbondesignsystem.com/components/UI-shell-left-panel/accessibility/)

### shadcn/ui

- [Sidebar documentation](https://ui.shadcn.com/docs/components/sidebar)
- [Current new-york-v4 Sidebar registry source](https://ui.shadcn.com/r/styles/new-york-v4/sidebar.json)

### Accessibility baseline

- [WCAG 2.2 Understanding SC 2.5.8 — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [WCAG 2.2 Understanding SC 2.4.3 — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)

## Comparison

### 1. High-level pattern comparison

下表はすべて `公式記載`。数値や挙動が公式資料にない箇所は「未記載」とし、一般的な見た目から補完していない。

| 事例 | 主要遷移先・階層 | expanded / collapsed / hidden | closed 時の残存形 | toggle | content / responsive | 直接根拠 |
|---|---|---|---|---|---|---|
| Microsoft NavigationView | top-level navigation 用。expanded left は同程度に重要な 5〜10 category を推奨。階層は 2 level が理想 | `Left`、`LeftCompact`、`LeftMinimal`、`Top`、`Auto`。Compact は閉時 icon-only、Minimal は menu button のみ | Compact は 48 DIP rail。Minimal は menu button だけで rail は残さない | left pane anatomy の先頭に menu button。open large window では非表示にもできる | `Auto`: 1008px 以上 expanded、641〜1007px compact、640px 以下 minimal。Compact / Minimal の open pane は content 上へ overlay | [NavigationView](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/navigationview)、[CompactPaneLength](https://learn.microsoft.com/en-us/windows/winui/api/microsoft.ui.xaml.controls.navigationview.compactpanelength?view=winui-2.8) |
| Material Design 2 Navigation Rail | 3〜7 の top-level destination。single task、secondary destination、small screen には使わない | 標準 rail は persistent。標準 component 自体は expanded sidebar との 2-state toggle ではない | 72dp、dense 56dp の persistent rail | 標準 rail に collapse toggle はない。secondary 用 modal drawer との併用は可能 | small は bottom navigation、medium は rail、large は drawer へ component swap。例示 breakpoint は 360〜599 / 600〜1239 / 1240dp+ | [Navigation rail](https://m2.material.io/components/navigation-rail)、[Bottom navigation](https://m2.material.io/components/bottom-navigation/) |
| Apple HIG Sidebar | 複数の peer area / top-level collection を broad / flat に表示。通常は 2 hierarchy level 以内 | shown / hidden。narrow では sidebar / tab bar adaptation または split view の single stack | HIG は persistent icon-only rail を規定しない | macOS は show/hide button または View menu、iPadOS は system edge swipe。`NavigationSplitView` は platform により default `sidebarToggle` toolbar item を追加 | sidebar は space を多く使う。narrow size class は single stack、`sidebarAdaptable` は width / rotation に適応 | [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)、[NavigationSplitView](https://developer.apple.com/documentation/swiftui/navigationsplitview)、[sidebarToggle](https://developer.apple.com/documentation/swiftui/toolbardefaultitemkind/sidebartoggle) |
| Notion | top-level tab、Recents / Favorites / Teamspaces / Shared / Private 等の section、無制限 nested page を扱う高密度 hierarchy | open / hide、section-level collapse、resize、temporary reveal / lock-open | help / guide は hide 後に icon rail を残すとは記載せず、top-left から sidebar を開く | `<<` / `>>`、`Cmd/Ctrl + \`。公式 guide は hidden 時に screen top-left hover で開き、arrow で lock-open と説明 | desktop breakpoint / overlay vs reflow の数値は未記載。mobile は hover がなく `•••` / `+` を常時表示する別 interaction | [Navigate with the sidebar](https://www.notion.com/help/navigate-with-the-sidebar)、[Notion sidebar guide](https://www.notion.com/en-gb/help/guides/the-best-way-to-set-up-your-teams-sidebar-for-clear-organization)、[Notion mobile](https://www.notion.com/help/notion-for-mobile) |
| Slack | Home / DMs / Activity / Files 等の top-level tab と、channel / DM section の大量 hierarchy。unchecked tab は More へ | workspace switcher の表示切替、navigation bar の icons-only / icons+text、resizable sidebar | icons-only navigation bar を残す。single workspace は 1 icon に畳める | sidebar 右クリック preference で icons-only / text を変更。単一の panel collapse toggle や exact glyph は当該公式資料に未記載 | desktop と mobile は別。mobile は bottom tab と Home conversation list を使う。numeric breakpoint は未記載 | [Sidebar preferences](https://slack.com/help/articles/212596808-Adjust-your-sidebar-preferences)、[Desktop tabs](https://slack.com/help/articles/44134792609555-A-consolidated-set-of-tabs-for-Slack-on-desktop)、[Mobile](https://slack.com/help/articles/29788684062739-Customize-the-Slack-mobile-app) |
| Carbon UI shell left panel | header は highest-level、left panel は secondary navigation。secondary item が 5 件超、または頻繁に切替える時に推奨。3 tier は非対応 | persistent left panel、small / zoom 時 hamburger overlay、hover / focus で一時展開する side-rail variant | small は完全に隠れて header hamburger。side-rail variant は hover / focus 外で引っ込む。persistent icon destination rail とは異なる | UI shell header 先頭の hamburger、open 時 X | small screen または約 175% zoom で panel を隠し、open 時 content overlay / dim。pixel breakpoint は未記載 | [Usage](https://carbondesignsystem.com/components/UI-shell-left-panel/usage/)、[Accessibility](https://carbondesignsystem.com/components/UI-shell-left-panel/accessibility/) |
| shadcn/ui Sidebar | application-specific primitive で item count 推奨はない。header / groups / nested menu / footer を構成可能 | `collapsible` は `offcanvas`、`icon`、`none`。state は expanded / collapsed、mobile open state は分離 | `offcanvas` は 0 width、`icon` は 3rem、`none` は常時 expanded | example は main 内 `SidebarTrigger`。current registry は `PanelLeftIcon` の 28px trigger、edge `SidebarRail` も提供 | desktop は gap width を変えて reflow。mobile は 18rem Sheet overlay。source は desktop に `md` rule を使うが docs は px 値を規定しない | [Sidebar docs](https://ui.shadcn.com/docs/components/sidebar)、[registry source](https://ui.shadcn.com/r/styles/new-york-v4/sidebar.json) |

### 2. Dimensions, density, brand, action, and state comparison

| 事例 | width / item / spacing | brand / workspace | primary action | active / hover / focus / label / tooltip | keyboard / accessible name | 直接根拠 |
|---|---|---|---|---|---|---|
| Microsoft | compact 48 DIP、expanded default 320 DIP。NavigationView header は 52px。item height / gap は対象 design page に明記なし | `PaneTitle` / `PaneHeader` を menu button 横へ置ける。search / settings / footer slot あり | global primary CTA の固定位置は規定しない。FooterMenuItems は navigation item 専用、free-form は PaneFooter | single selection model。icon-only item の code example は tooltip を付ける。Windows tooltip guidance は unlabeled icon control に tooltip label を推奨 | item は mouse / keyboard 等の同等操作で invoke。native accessible name の具体値は app content / tooltip に依存 | [NavigationView](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/navigationview)、[OpenPaneLength](https://learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.navigationview.openpanelength)、[Tooltips](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/tooltips) |
| Material | default rail / destination 72dp、icon 24dp、group top 8dp。dense design spec は rail / destination 56dp。Android component note は compact style 52dp と記載し、design spec と implementation value に差がある | optional logo を top に置けるが action / destination と誤認されないよう caution | optional FAB を top、destinations より上へ。destinations の下には置かない | active / inactive / hover / focused / pressed。label は persistent / selected-only / hidden。active は high emphasis、inactive は reduced opacity | Android は各 item の `android:title`、Flutter は destination label / Semantics を使用 | [Navigation rail](https://m2.material.io/components/navigation-rail) |
| Apple | fixed px は規定しない。macOS の row / text / glyph は small / medium / large setting に依存。column width API は preferred / min / ideal / max | workspace switcher の一般規定なし | critical action を sidebar bottom に置かないよう macOS guidance | familiar SF Symbols、succinct label、accent color。exact hover / focus token は当該 HIG に未記載 | platform component の keyboard / accessible-name 詳細は当該 HIG に未記載 | [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)、[NavigationSplitView](https://developer.apple.com/documentation/swiftui/navigationsplitview) |
| Notion | resize は明記。default width、row height、gap、breakpoint は未記載 | workspace switcher は sidebar top | top `new page` icon、section / page hover `+`、各 tab bottom quick entry を公式 Help が列挙 | top-level tab は icon + purpose、hover で contextual `•••` / `+`。exact active / focus / tooltip style と accessible name は未記載 | `Cmd/Ctrl + \` で sidebar toggle。search shortcut もあり。focus restoration は未記載 | [Navigate with the sidebar](https://www.notion.com/help/navigate-with-the-sidebar) |
| Slack | drag-resize、icons-only / icons+text。exact width、item size、gap は未記載 | switcher は sidebar 外、または nav bar top の 1 workspace icon | standard sidebar の primary action placement は対象 Help に明記なし。simplified layout は top navigation に create を置く | tabs は custom show / hide、hidden item は More。visual active / hover / tooltip token は未記載 | F6 / Shift+F6 で section 移動、arrow で sidebar resize、Ctrl+number 等で tab switch。focus は blue outline と説明 | [Sidebar preferences](https://slack.com/help/articles/212596808-Adjust-your-sidebar-preferences)、[Keyboard shortcuts](https://slack.com/help/articles/201374536-Slack-keyboard-shortcuts-and-commands)、[Keyboard navigation](https://slack.com/intl/en-gb/help/articles/115003340723-Navigate-Slack-with-your-keyboard) |
| Carbon | panel 256px、link / submenu 32px、icon 16px、inline padding 16px、selected border 4px | brand は highest-level header 側の責務。left panel は optional product navigation | primary CTA の固定位置は規定しない | enabled / hover / focus / active / selected token を分離。focus border、selected background + border | Tab で全 item、Space / Enter で submenu、Enter で link。navigation 後 main top へ focus。`nav aria-label`、nested `ul`、`aria-expanded`、`aria-current="page"` | [Style](https://carbondesignsystem.com/components/UI-shell-left-panel/style/)、[Accessibility](https://carbondesignsystem.com/components/UI-shell-left-panel/accessibility/) |
| shadcn/ui | desktop 16rem、mobile 18rem、icon width 3rem。default menu row 32px、icon 16px、menu gap 4px、trigger 28px | sticky Header は brand / title / workspace switcher、sticky Footer は user / settings / action 用 | placement は composition に委ねる | `data-active`、hover background / text、focus ring。collapsed + nonmobile の時だけ tooltip を表示可能 | `Cmd+B` / `Ctrl+B` shortcut、trigger screen-reader text `Toggle Sidebar`。mobile state / desktop state を分離 | [Sidebar docs](https://ui.shadcn.com/docs/components/sidebar)、[registry source](https://ui.shadcn.com/r/styles/new-york-v4/sidebar.json) |

### 3. Accessibility baseline

- `公式記載`: WCAG 2.2 SC 2.5.8 Level AA の pointer target minimum は原則 24 x 24 CSS px であり、小さい target には spacing 等の例外がある。Understanding document は重要な control ではより大きい target も検討するよう説明している。[WCAG 2.2 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- `公式記載`: WCAG 2.2 SC 2.4.3 Level A は、sequential focus order が意味と操作性を保つことを要求する。visual order と完全一致する必要はないが、random jump や同じ control が二重に focus されたように見える順序は不適切である。[WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
- `Worker 推論`: Cornell の target は WCAG minimum 24px を下限にせず、既存 44 / 48px と同等の 44px を design target とする。これは WCAG が 44px を必須とするという意味ではない。

### 4. When an icon rail is valid

`Worker 推論` として、上記一次資料から persistent icon rail が成立する条件を次に限定する。

1. top-level destination が少なくとも 3 件あり、Material の 3〜7 destination pattern に近い。
2. destination 間を頻繁に切り替え、常時 visible である便益が content width の損失を上回る。
3. 各 destination が互いに異なる familiar icon で明確に識別できる。tooltip / accessible name は補助であり、曖昧な icon の代替にしない。
4. selected state、hover、focus、badge 等の state を rail 内で意味ある情報として表現できる。
5. brand / action を含めても、navigation destinations の hierarchy が rail の主役であり続ける。

完全非表示が適する条件は次のとおり。

1. top-level destination が 0〜2 件で、現在位置は page title や content から十分に分かる。
2. Canvas / editor / data table のように content width の価値が高い。
3. icon-only 化すると label の discoverability を失う一方、切替頻度が低い。
4. primary action が page header にも存在し、rail を残さなくても主要 task が継続できる。
5. visible で十分な hit area と accessible name を持つ reopen trigger を main 側へ残せる。

Cornell Method Notebook は現時点で後者 5 条件すべてに該当する。

## Current Diagnosis

### 1. Screenshot / source time boundary

| ID | 種類 | 観察 |
|---|---|---|
| S-001 | 提供画像観察 | 2 枚とも image file は 1915 x 957px |
| S-002 | 提供画像観察 | collapsed image は browser DevTools device toolbar と右側 DevTools を含む。表示中 app viewport label は 1412 x 937。左に full-height narrow column、上から C brand、menu、selected note icon、最下部 action area が見える |
| S-003 | 提供画像観察 | expanded image は約 248px の full-height sidebar、visible brand copy、境界上の chevron、visible `ノート一覧` label、bottom `新規ノート` CTA、大きな空白を示す |
| S-004 | 未確認 | collapsed screenshot の時刻は 03:40、current implementation summary は 23:46。画像では toggle が narrow rail の直後に見える一方、current source は toggle を 68px rail 内へ置く。したがって collapsed image を現 source の post-implementation pixel proof として扱えない |
| S-005 | 未確認 | expanded screenshot も implementation summary より前の 23:12 capture。open branch は概ね current source と一致するが、current runtime の computed geometry は実測していない |

### 2. Current source facts

| ID | 現行 source 事実 | 根拠 |
|---|---|---|
| C-001 | desktop collapsed rail は `4.25rem` = 68px。full-height `100svh`、right border を持ち、main はその直後から始まる | `src/app/styles/app-shell.css` |
| C-002 | top cluster は brand slot 56px、brand / toggle target 44px、nav / create target 48px、icon 20px | 同上 |
| C-003 | collapsed DOM は brand → menu toggle → nav → footer create の順 | `src/app/_components/app-chrome-parts.tsx` |
| C-004 | global navigation item は `/notes` の `ノート一覧` 1 件だけ | 同上 `appChromeNavItems` |
| C-005 | brand も `/notes` へ link し、rail 内で brand と唯一の nav item が同一 destination を指す | 同上 `AppChromeBrand` / `AppChromeNavLink` |
| C-006 | primary create action は `/notes/new`。collapsed では `margin-top:auto` の footer に置く | `app-chrome-parts.tsx`、`app-shell.css` |
| C-007 | `/backup` route / API は実在するが current AppChrome は link を出さず、current static test は `/backup|バックアップ/` が AppChrome にないことを positive assertion にしている | `src/app/backup/page.tsx`、`src/app/api/backups/route.ts`、`test/notes/app-chrome-contract.test.js` |
| C-008 | mobile は 900px 以下で sticky 72px header + modal overlay panel。Escape、Tab loop、backdrop、body scroll lock、pathname close、focus restoration を持つ | `app-chrome.tsx`、`app-shell.css` |
| C-009 | desktop / mobile boundary は 901 / 900px。breakpoint change で desktop rail を open へ reset する current logic がある | 同上 |
| C-010 | `/notes` page header に already-visible `新規作成` CTA がある。`/backup` page header には `ノート一覧へ` がある | `src/modules/notes/ui/components/list/list.tsx`、`src/modules/backup/ui/components/backup-page.tsx` |

### 3. Internal contract mismatch discovered

- `現行 source 事実`: `doc/implementation/MVP_CONTRACT.md` の canonical backup route は `/backup` であり、`/notes/backup` は MVP 外である。
- `現行 source 事実`: `doc/implementation/IMPLEMENTATION_STATUS.md` は共通 navigation が `/notes`、`/notes/new`、`/backup` を提供すると記載する。
- `現行 source 事実`: `doc/testing/TEST_SCENARIOS.md` は共通 navigation から `/backup` へ移動できることを確認項目にする。
- `現行 source 事実`: current AppChrome は `/backup` を出さず、static test はその欠落を固定している。
- `Worker 推論`: 現在の UI を「主要遷移 1 件 + 作成 1 件」と評価する前提自体は current source と一致する。ただし MVP documentation / test scenario との不整合を残したまま rail の item count を議論すると設計判断が歪む。推奨案では `/backup` を visible-label の secondary navigation として戻し、top-level destination を 2 件として扱う。それでも Material の rail 条件 3〜7 件には届かない。

### 4. Why it looks awkward, sparse, and excessive

| 観点 | 構造診断 |
|---|---|
| information amount | `Worker 推論`: 68px の恒久 column が表す固有機能は `/notes` と `/notes/new` の 2 つだけで、そのうち `/notes` は brand と nav icon で重複する。rail の存在コストに対して情報量が足りない |
| visual hierarchy | `Worker 推論`: C mark、bordered menu button、selected nav tile、outlined / filled create state という 4 種の visual treatment が、わずか 68px の同一軸で競合する。navigation より container / border の方が目立ち、main content より chrome が強く見える |
| density | `現行 source 事実`: 937px viewport、collapsed top padding が max 32px の場合、brand 56 + margin 8 + toggle 44 + margin 12 + nav 48 + footer block 約 61 + bottom padding 16 を除く `margin-top:auto` は概算 660px になる。`Worker 推論`: bottom CTA が nav group から切り離され、意図ある whitespace ではなく item 不足に見える |
| alignment | `提供画像観察`: collapsed capture では rail、外側 toggle、main title が別々の x-axis を持つ。`現行 source 事実`: current source は toggle を rail 内へ直したが、open は boundary-straddling chevron、closed は centered menu と state ごとに toggle の visual anchor が変わる。`Worker 推論`: open / closed が同じ control の連続状態より別 layout に見えやすい |
| affordance | `Worker 推論`: hamburger は一般に hidden menu / drawer を開く signifier だが、current closed state では menu 自体の一部である rail が既に visible。C mark は logo に見えるが link、notes icon は同じ route、plus は viewport bottomにあり、control の役割を見た目だけで区別しにくい |
| discoverability | `現行 source 事実`: icon-only item は visually-hidden label と hover / focus tooltip を持つ。`Worker 推論`: accessibility name は確保されても、pointer hover または keyboard focus 前に `ノート一覧` / `新規ノート` の語を読めない。唯一の destination で label を隠す便益が小さい |
| content tradeoff | `現行 source 事実`: closed でも 68px を全高で予約する。`Worker 推論`: 1200px default Canvas と responsive editor を持つ本アプリでは、常時 68px を失う価値より、sidebar 使用時だけ 216〜248px を明示的に使い、不要時は 0px にする方が状態差を理解しやすい |

### 5. Persistent icon rail verdict

`Worker 推論`: 現行 Cornell に persistent icon rail を残す妥当性はない。

- Material は rail を 3〜7 top-level destination 用とし、single task / secondary destination には使わない。[Material Navigation rail](https://m2.material.io/components/navigation-rail)
- Carbon は left panel すら 5 件超の secondary item、または頻繁な切替を条件にする。[Carbon Usage](https://carbondesignsystem.com/components/UI-shell-left-panel/usage/)
- Microsoft は icon-only Compact を「常時 navigation を見せる重要性」と「icon が明確」という条件で推奨し、そうでない場合は menu button だけの Minimal pattern も公式に示す。[Microsoft NavigationView](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/navigationview)
- Cornell は backup を戻しても destination は `/notes` と `/backup` の 2 件であり、primary action `/notes/new` は destination count に含めない。

rail を将来再評価する trigger は「top-level destination が 3 件以上」だけでは不十分で、3 件以上すべてが頻繁に使われ、20〜24px icon で誤認なく識別でき、常時 visible の価値が content width を上回ることとする。

## Three Options

| 案 | 利点 | 欠点 | 将来拡張 | current route / mobile impact | 評価 |
|---|---|---|---|---|---|
| 1. Notion 型: sidebar を 0px まで隠し、main header に panel toggle のみ | Canvas / list width を完全回収。closed state が明快。open 時は visible label を保てる。icon の暗記不要。Microsoft Minimal / Notion hide と整合 | `/backup` 等へ 1 click 増える。toggle の常時可視、focus、tooltip が必須。open / close reflow の QA が必要 | labeled expanded sidebar に item を追加できる。3〜7 frequent destinations になった時だけ第三 state として icon rail を再検討 | route 変更なし。`/backup` link を current canonical route へ追加。900px 以下の既存 overlay interaction は維持 | **推奨** |
| 2. Microsoft / Material 型: 56〜72px icon-only rail | destinations が多い場合に切替が速い。selected / badge を常時表示できる。現実装からの差分が小さい | current 2 destination 未満の情報量では過剰。label / hierarchy を失い、brand / action が navigation より目立つ。68px を常時消費 | 3〜7 distinct frequent destinations へ増えた時は最も拡張しやすい | current routes は維持できる。mobile は rail を出さず既存 overlay のまま | 今は不採用。将来条件付き |
| 3. desktop 常時 expanded、collapse なし | visible label、最高の discoverability、state / focus 実装が単純。Apple の default discoverability と整合 | 216〜248px を常時消費。Canvas / editor の幅を削る。2 destination では open sidebar 自体が疎に見える。利用者が distraction を減らせない | item 増加には強いが、content-heavy route で不利が続く | route / mobile 影響は最小。desktop toggle / state を削除 | 次点。Canvas 優先のため不採用 |

## Recommendation

### 1. Manager recommendation

`Worker 推論`: 案 1 を採用する。

desktop sidebar は page load 時に expanded とし、利用者が閉じた後は rail / brand mark / nav icon / bottom CTA / divider を一切残さず `0px` にする。main 側には 1 個の 44px panel toggle を残す。Apple が default-hidden を避けるよう勧める discoverability と、Notion / Microsoft Minimal の complete-hide behavior を両立するため、初期状態は open、user-triggered closed state だけ complete-hide とする。[Apple Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)、[Notion sidebar](https://www.notion.com/help/navigate-with-the-sidebar)、[Microsoft NavigationView](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/navigationview)

sidebar open 中は visible-label UI とし、`新規ノート` を top cluster の primary action、`ノート一覧` と `バックアップ` をその直下の navigation rows に置く。current bottom CTA は廃止し、重要 action を viewport bottom に孤立させない。workspace switcher はローカル single-user app に存在しないため追加しない。

### 2. State model

| state | 条件 | sidebar | desktop trigger | content | mobile |
|---|---|---|---|---|---|
| `desktop-open` | `min-width: 901px`、`desktopSidebarOpen=true` | in-flow / sticky、幅 `clamp(216px, 18vw, 248px)`、visible labels | main desktop header 内に 1 個、`panel-left-close`、`aria-expanded=true` | sidebar 幅分 reflow | mobile header / overlay hidden |
| `desktop-closed` | `min-width: 901px`、`desktopSidebarOpen=false` | `hidden` または `visibility:hidden + inert` 完了後に width `0`。focusable descendant なし | 同一 DOM button、`panel-left-open`、`aria-expanded=false` | viewport 幅を回収。rail / border / gutter 0 | mobile header / overlay hidden |
| `mobile-closed` | `max-width: 900px`、`mobileNavOpen=false` | desktop sidebar / trigger hidden | hidden / unfocusable | existing sticky mobile header + main | overlay hidden |
| `mobile-open` | `max-width: 900px`、`mobileNavOpen=true` | desktop sidebar / trigger hidden | hidden / unfocusable | main `inert`、body scroll lock | existing backdrop + modal panel overlay |

State rules:

- `desktopSidebarOpen` default は `true`。初期 implementation では localStorage / cookie persistence を追加しない。App Router layout が生存する client navigation 中だけ state を保持する。
- `mobileNavOpen` は独立 state。desktop close は mobile default を変えず、mobile open は desktop preference を変えない。
- desktop → mobile では mobile overlay を close し、desktop preference は保存する。mobile → desktop では mobile overlay を close し、以前の desktop open / closed を復元する。current の無条件 `setIsRailOpen(true)` は採用しない。
- pathname change は mobile overlay だけを close する。desktop sidebar は route change で勝手に開閉しない。

### 3. DOM responsibility

推奨 DOM は次の責務順とする。visual placement は CSS Grid で行い、positive `tabindex` で並び替えない。

```text
AppChrome (state, breakpoint, focus orchestration)
├─ DesktopChromeHeader (desktop only, grid column 2 / row 1)
│  └─ DesktopSidebarTrigger (the single persistent desktop toggle)
├─ AppChromeSidebar (desktop-open only, grid column 1 / rows 1-2)
│  ├─ Brand (visible mark + title + subtitle)
│  ├─ CreateNoteLink (primary action)
│  └─ GlobalNavigation
│     ├─ NotesListLink
│     └─ BackupLink
├─ AppChromeContent (grid column 2 / row 2)
│  ├─ ExistingMobileHeader (mobile only)
│  └─ main#app-main-content
└─ ExistingMobileOverlay (mobile-open only)
```

- `AppChrome` owns `desktopSidebarOpen`, `mobileNavOpen`, media change, Escape / Tab loop, body scroll, focus restoration.
- `DesktopSidebarTrigger` is outside the sidebar so closing the sidebar never removes the focused trigger. It is one DOM node across desktop open / closed states.
- DOM order is desktop header / trigger → conditional sidebar → content / main. When sidebar opens, next Tab from the trigger enters labeled sidebar controls; when closed, the hidden sidebar drops from sequential focus and next Tab enters main.
- Sidebar `aside` owns only visible identity, primary action, and global navigation. It does not own page title, note editor controls, or mobile overlay state.
- `appChromeNavItems` is the single route source for `/notes` and `/backup`; desktop open and mobile overlay reuse it. `CreateNoteLink` remains a separately styled action.
- Closed state用の `AppChromeCollapsedNavigation` component は削除対象。closed brand / nav / footer DOM を別系統で維持しない。

### 4. Exact geometry

| element | exact contract |
|---|---|
| desktop breakpoint | desktop `min-width: 901px`; mobile `max-width: 900px`。current boundary を維持 |
| open sidebar width | `clamp(13.5rem, 18vw, 15.5rem)` = 216〜248px。current expanded width を維持 |
| closed sidebar width | `0px`。border、shadow、padding、reserved flex-basis、transparent hit area を含めて 0 |
| sidebar height | `100svh`; `position: sticky; top: 0`; own vertical scroll only if content exceeds viewport |
| desktop chrome header | height 52px、grid column main side、sticky top 0、padding `4px 12px`、1px bottom border。sidebar header bottom と同じ y-axis |
| desktop trigger | 44 x 44px hit area、20 x 20px SVG、border radius 8px。header leading edgeから 12px |
| trigger icon | open: `panel-left-close`; closed: `panel-left-open`。24 x 24 viewBox を 20px で描画。hamburger / chevron は使わない |
| sidebar brand row | height 52px、padding `8px 16px`、brand mark 36 x 36px、copy gap 12px。full title + subtitle を visible |
| sidebar body inline padding | 16px |
| create action | brand row の 16px 下。width 100%、height / min-height 44px、icon 20px、icon-label gap 10px、padding inline 12px、radius 8px |
| navigation group | create action の 12px 下。2 rows、row height 44px、gap 4px、icon 20px、icon-label gap 10px、padding inline 12px、radius 8px |
| sidebar bottom | 16px padding。bottom 固定 CTA / separator は置かない |
| mobile header | current 72px (`4.5rem`) を維持。menu / close targets 44px |
| mobile panel | current `min(20rem, calc(100vw - 1.5rem))` = max 320px、viewport side clearance 24px を維持 |

52px desktop header と 44px trigger は、Microsoft の 52px NavigationView header をそのままコピーするのではなく、current 44px control を保ったまま 4px vertical inset を作る Cornell 固有値である。external fact と product decision を混同しない。

### 5. Brand, routes, and action hierarchy

| item | desktop open | desktop closed | mobile | route / state |
|---|---|---|---|---|
| brand | full C mark + `Cornell Method Notebook` + `ローカル学習ノート`。link を維持する場合も active styling は付けない | render しない | existing mobile full brand を維持 | `/notes` shortcut。唯一の nav row と同じ route でも closed icon duplicate は作らない |
| 新規ノート | top primary action。accent-deep filled、visible label | render しない。`/notes` page header の existing `新規作成` は引き続き visible | existing mobile panel create link を維持 | `/notes/new`。pathname が exact match の時 `aria-current="page"` |
| ノート一覧 | first nav row、visible label | render しない | mobile nav で visible label | selected: `/notes` と `/notes/[id]`。`/notes/new` は除外 |
| バックアップ | second nav row、visible label、primary action より低 emphasis | render しない | mobile nav items にも追加 | `/backup` exact / descendant。MVP canonical route は `/backup` |
| workspace switcher | render しない | render しない | render しない | local single-user / single-workspace app のため対象外 |

`/backup` 追加時は、`IMPLEMENTATION_STATUS.md` / `TEST_SCENARIOS.md` と current AppChrome test の不整合を同じ coding task で解消する。`/notes/backup` を新設してはならない。

### 6. Visual and interaction states

| state | contract |
|---|---|
| default nav | transparent background、muted ink、visible label |
| hover | `var(--app-accent-soft)` 相当の low-emphasis background、`var(--app-accent-deep)` text / icon。geometry / transform は変えない |
| active / current | accent-soft background + 3px leading indicator、deep accent text / icon、`aria-current="page"`。color だけに依存しない |
| primary create default | `var(--app-accent-deep)` background、既存 contrast-verified light text。hover は color darkening ではなく border / subtle shadow 程度に留める |
| focus-visible | 2px solid `var(--app-focus)`、2px offset。sidebar / header overflow で clip しない |
| tooltip | desktop panel toggle のみ。hover と keyboard focus で右側へ 8px offset、12px text、padding 6 x 8px。text は dynamic accessible label と同文。visible nav / create / brand には tooltip 不要 |
| motion | width / opacity transition は 160ms ease-out 以下。`prefers-reduced-motion: reduce` では transition 0ms。layout completion 前に hidden focusable element を残さない |

### 7. Keyboard, focus, and accessible names

- Desktop trigger:
  - `button type="button"`
  - `aria-controls="app-chrome-sidebar"`
  - `aria-expanded={desktopSidebarOpen}`
  - open label `サイドバーを閉じる`
  - closed label `サイドバーを開く`
- desktop shortcut は Notion と同じ logical shortcut `Cmd/Ctrl + \` を採用する。Japanese keyboard layout を考慮し、文字だけでなく `event.code === "Backslash"` を判定する。IME composing 中は発火しない。入力欄に focus があっても modifier shortcut として動作し、default を prevent する。
- trigger click / Enter / Space では同一 DOM trigger に focus を維持する。
- shortcut で sidebar を閉じる際、active element が sidebar descendant なら animation 前に desktop trigger へ focus を戻す。active element が main 内なら focus を奪わない。
- shortcut で sidebar を開く際は現在 focus を維持する。trigger から開いた場合は DOM 上の次の Tab が sidebar controls、Shift+Tab が前の browser / skip control となる。
- desktop → mobile で desktop trigger / sidebar descendant が focused なら、render 後に mobile menu button へ focus を移す。
- mobile overlay は existing initial focus、Tab loop、Escape / close / backdrop focus return、pathname-change close、body scroll restore を維持する。pathname navigation による close では旧 triggerへ focus を戻さない current contract を維持する。
- icon-only toggle は visible tooltip に加えて programmatic accessible name を必須とする。visible-label nav は label text 自体を accessible name とし、重複 `aria-label` は付けない。
- target は desktop / mobile すべて 44px 以上とし、WCAG 2.2 の 24px minimum を余裕を持って上回る。[WCAG Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

### 8. Content reflow / overlay

- desktop open: sidebar は normal layout column を占め、main は sidebar width だけ右へ reflow。overlay / backdrop は使わない。
- desktop closed: first grid column は 0px。main header / main content の left edge は shell left edgeへ移る。68px rail、1px divider、shadow、invisible hover stripを残さない。
- desktop header は open / closed とも main column 内に 52px を占めるため、sidebar toggle が page-specific heading / Canvas toolbar を overlay しない。
- mobile: sidebar は normal flow に入れず、existing overlay / backdrop を使用する。
- page route、API、DB、CanvasDocumentV1、Canvas paper size は変更しない。

### 9. ASCII wireframes

Desktop open (`>=901px`):

```text
┌──────── sidebar 216–248px ────────┬──────── main column ──────────────────────┐
│ [ C ] Cornell Method Notebook     │ [panel-left-close]                       │ 52
│       ローカル学習ノート          ├───────────────────────────────────────────┤
│                                   │                                           │
│ [ ＋  新規ノート               ] │  ノート一覧 / 詳細 / editor / backup     │
│                                   │                                           │
│ [ ▤  ノート一覧                ] │  main content reflows                     │
│ [ ◫  バックアップ              ] │                                           │
│                                   │                                           │
│        future labeled items        │                                           │
└───────────────────────────────────┴───────────────────────────────────────────┘
```

Desktop closed (`>=901px`):

```text
┌──────── main column: full shell width ─────────────────────────────────────────┐
│ [panel-left-open]                                                              │ 52
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  page content uses recovered width                                             │
│                                                                                │
│  no C icon / no notes icon / no plus icon / no rail border / no 68px gutter    │
└────────────────────────────────────────────────────────────────────────────────┘
```

Mobile closed / open (`<=900px`):

```text
closed                                      open
┌────────────────────────────┐              ┌──────── panel <=320 ──────┬───────┐
│ [C + brand copy]    [menu] │ 72           │ Navigation          [X]  │ dim   │
├────────────────────────────┤              │ ノート一覧                │ main  │
│ main                       │              │ バックアップ              │ inert │
│                            │              │                           │       │
│                            │              │ [新規ノート]              │       │
└────────────────────────────┘              └───────────────────────────┴───────┘
```

## Acceptance

### 1. Static acceptance

後続 coding task は少なくとも次を source / CSS contract で確認する。

- `AppChromeCollapsedNavigation` と closed brand / icon-only nav / closed footer DOM が存在しない。
- desktop closed width token は `0` であり、`4.25rem` rail、collapsed `flex-basis`、collapsed border / shadow / padding、main の compensating gutter が存在しない。
- desktop trigger は AppChrome 内に 1 DOM node、44 x 44px、20px panel icon、dynamic `aria-label`、`aria-expanded`、`aria-controls` を持つ。
- open / closed branch が同じ triggerを remount しない。
- sidebar width は `clamp(13.5rem, 18vw, 15.5rem)`、desktop header は 52px、brand / create / nav geometry は上記 exact contract と一致する。
- desktop sidebar DOM / visual order は brand → create → nav (`ノート一覧`, `バックアップ`)。bottom create CTA / footer divider がない。
- canonical route は `/notes`、`/notes/new`、`/backup`。`/notes/backup` を追加しない。
- `/notes` / `/notes/[id]`、`/notes/new`、`/backup` の active state と `aria-current` が mutually correct。
- visible-label nav / create に collapsed tooltip / redundant `aria-label` がない。tooltip は panel toggle だけ。
- `Cmd/Ctrl + Backslash` handler は IME guard、`event.code`、hidden-focus restoration を持つ。
- desktop DOM orderは trigger → sidebar controls → main、または同等に logical な order を native DOM で作り、positive `tabindex` を使わない。
- 901px 以上は desktop header / optional sidebar、900px 以下は existing mobile header / overlay だけを表示する。
- existing mobile Escape、Tab loop、backdrop、body scroll lock、pathname close、focus return contract が残る。
- `prefers-reduced-motion` で sidebar transition を停止する。
- API、DB、CanvasDocumentV1、dependencies、route file は変更しない。
- current `assert.doesNotMatch(appChrome, /\/backup|バックアップ/)` は新契約と矛盾するため、backup presence / active behavior の positive assertion へ更新する。

Recommended verification commands for a later coding task:

```sh
node --test test/notes/app-chrome-contract.test.js test/notes/app-chrome-responsive-contract.test.js
npm run lint
npx tsc --noEmit --pretty false --incremental false
npm run build
git diff --check
```

### 2. Browser runtime acceptance

Static test / build は次の runtime acceptance の代用にしない。

| viewport / route | acceptance |
|---|---|
| 901px | open width 216px ±0.5px。closed width 0px。desktop trigger visible、mobile header hidden。horizontal overflow なし |
| 1280px | open width 230.4px ±0.5px。closed 時 main shell left = 0px、rail / border / transparent hit areaなし |
| 1440px | open width 248px ±0.5px。closed 時 content width が 248px 分回復。Canvas / list / detail と toggle が overlap しない |
| 900px | desktop header / sidebar / desktop tooltip が hidden、existing mobile header / menu が visible |
| `/notes` | notes row selected、backup unselected、create unselected。page header `新規作成` は sidebar closed でも visible |
| `/notes/new` | create current、notes unselected。editor / Canvas の page-wide overflow 非発生 |
| `/notes/[id]` | notes current。open / closed で detail heading actions と overlap しない |
| `/backup` | backup current、notes / create unselected。common navigation から到達できる |

Interaction acceptance:

- click / Enter / Space で open ↔ closed。trigger の DOM identity と focus が維持される。
- `Cmd/Ctrl + \` が main / input focus の両方で動き、IME composing 中は動かない。
- sidebar descendant focus 中に shortcut close すると desktop trigger へ focus が戻る。
- closed state の Tab order に hidden sidebar links が入らない。open state では trigger 後に sidebar controls、次に mainへ logical に進む。
- toggle tooltip は pointer hover と Tab focus の両方で表示され、layout shift / clipping がない。
- open / closed transition 中も hidden control を pointer / keyboard で activate できない。
- `prefers-reduced-motion: reduce` で animation がない。
- 900 ↔ 901px transition で focus が hidden DOM に残らず、desktop preference が mobile round-trip 後に復元される。
- mobile overlay は menu open、initial focus、Tab / Shift+Tab loop、Escape、close button、backdrop、body scroll restore、pathname close をすべて満たす。
- 900 / 901 / 1280 / 1440px で page-wide horizontal overflow、double gutter、content overlap がない。
- Next.js development indicator が bottom action と重なるかどうかを product UI acceptance の判定材料にしない。

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260804/0012-research-modern-sidebar-patterns-20260805-summary.md` | 一次資料比較、current diagnosis、3案比較、推奨 state / DOM / dimensions / accessibility / acceptance を追加 | Worker task の唯一の成果物として後続 design / coding task の source of truth を残すため |

source、test、config、dependency、image、generated artifact、queue task state は変更していない。既存 staged / unstaged / untracked files を戻していない。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | Material rail の適用範囲は 3〜7 top-level destination で、single task / secondary destination / small screen は非推奨 | [Material Navigation rail](https://m2.material.io/components/navigation-rail) |
| F-002 | fact | Microsoft は expanded、icon-only Compact、menu-only Minimal を別 mode とし、icons が不明瞭または content space 優先なら Minimal pattern を示す | [Microsoft NavigationView](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/navigationview) |
| F-003 | fact | Carbon left panel は 5 件超の secondary nav または frequent switching を利用条件にする | [Carbon Usage](https://carbondesignsystem.com/components/UI-shell-left-panel/usage/) |
| F-004 | fact | Notion は sidebar を hide / resize でき、top-left reveal と `Cmd/Ctrl + \` を公式に説明する | [Notion Help](https://www.notion.com/help/navigate-with-the-sidebar)、[Notion guide](https://www.notion.com/en-gb/help/guides/the-best-way-to-set-up-your-teams-sidebar-for-clear-organization) |
| F-005 | fact | current collapsed AppChrome は 68px full-height rail に brand、toggle、1 nav、bottom create を持つ | current source / CSS |
| F-006 | fact | current brand と唯一の nav はどちらも `/notes`。distinct destination は notes 1 件、action は create 1 件 | current `app-chrome-parts.tsx` |
| F-007 | fact | canonical `/backup` は実在するが current AppChrome / test は除外し、Implementation Status / Test Scenarios は共通 nav への存在を前提にする | MVP docs、current source / test |
| F-008 | assumption | backup を labeled secondary nav として戻すと documentation / actual navigation の整合が改善する | Worker recommendation。coding authorization は別 task |
| F-009 | assumption | desktop open default + user-triggered complete hide は discoverability と Canvas width の tradeoff が最も良い | 7 一次資料と current information architecture の統合判断 |
| U-001 | unknown | current source の actual collapsed rendering | supplied collapsed image が current implementation より前で、runtime を実行していない |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 確認済み | AppChrome source / CSS / 2 tests の既存 staged + unstaged changes、既存 untracked image / summaries を保護 |
| provided image inspection | PASS | 2 images を original detail で確認。`sips` で各 1915 x 957px |
| current source / CSS read | PASS | AppChrome 2 TSX + CSS を全文確認 |
| current route / contract read | PASS | `/backup` canonical route と common-nav documentation mismatch を確認 |
| primary-source count | PASS | 7 product / design-system families + W3C。最低 6 件を超える |
| external fact URL coverage | PASS | comparison / findings の external facts に official direct URL を付与 |
| summary structure check | PASS | `sh tools/check-summary.sh summary/20260804/0012-research-modern-sidebar-patterns-20260805-summary.md` |
| summary whitespace check | PASS | trailing whitespace なし |
| 作業後 `git status --short` | 確認済み | 作業前から存在した staged / unstaged / untracked files を保持。本 task の追加は本 summary 1 件のみ |
| code / config / dependencies | NOT CHANGED | research-only task |
| runtime browser QA | NOT RUN | supplied images と source の read-only comparison が scope。current implementation の新規 runtime screenshot は生成していない |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | current 23:46 implementation の collapsed pixel appearance | current branch を Browser で 901 / 1280 / 1440px capture。provided 03:40 screenshot で代替しない |
| U-002 | Notion current product の exact sidebar width、row height、main reflow / temporary overlay geometry | official Help は behavior のみ。signed-in current product の screen measurement または公式 spec が必要 |
| U-003 | Slack current desktop の exact nav width / item size / breakpoint | official Help に数値なし。current product measurement または公式 design token が必要 |
| U-004 | Apple sidebar の universal exact width / row size | HIG は system size / user setting / preferred column width に委ねるため、web UI の固定値へ変換できない |
| U-005 | shadcn `md` の project-specific exact px | current registry source は `md` を使うが Tailwind theme customization で変わり得る。Cornell は既存 900 / 901px を維持するため依存しない |
| U-006 | `Cmd/Ctrl + Backslash` の Japanese keyboard / browser conflict | later Browser runtime で `event.code`, `event.key`, IME composing、Mac / Windows equivalent を確認 |
| U-007 | `/backup` common-navigation mismatch の最終 product authority | 本 recommendation は current MVP docs / test scenario に合わせて追加を推奨。Manager が current test の intentional exclusion を優先する場合は design task 前に明示判断が必要 |
| U-008 | 52px desktop shell header が各 note paper / Canvas route で望ましい visual density になるか | later design mock / Browser screenshot at 901 / 1280 / 1440px。static source だけで visual PASS としない |

## Next Read

後続 design task は次の最小順で読む。

1. `summary/20260804/0012-research-modern-sidebar-patterns-20260805-summary.md`
2. `src/app/_components/app-chrome.tsx`
3. `src/app/_components/app-chrome-parts.tsx`
4. `src/app/styles/app-shell.css`
5. `test/notes/app-chrome-contract.test.js`
6. `test/notes/app-chrome-responsive-contract.test.js`
7. `doc/implementation/MVP_CONTRACT.md` §3
8. `doc/implementation/IMPLEMENTATION_STATUS.md` route / common navigation section
9. `doc/testing/TEST_SCENARIOS.md` initial navigation section

後続 task はまず `/backup` common-navigation mismatch を Manager decision として固定し、その後に本 Recommendation / Acceptance を design contract へ転記する。provided collapsed screenshot を current implementation の runtime proof として再利用しない。
