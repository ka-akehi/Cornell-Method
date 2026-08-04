---
summary_type: task-summary
created_at: 2026-08-05 01:09 JST
task_kind: coding
task_status: done
---

# Implement Future-ready Persistent AppChrome Rail

## Objective

desktop AppChrome を expanded 256px / collapsed 56px の always-mounted same-DOM sidebar へ統合し、現在の navigation 1 件と将来 3〜7 件の navigation が同じ row / scroll contract で成立する構造へ変更する。設計正本 `0039-design-future-ready-persistent-appchrome-rail-20260805-summary.md` の hierarchy、exact geometry、visual state、focus、tooltip、responsive acceptance を実装し、mobile overlay navigation と `/backup` product boundary は変更しない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | desktop AppChrome hierarchy、expanded / collapsed geometry、visual state、tooltip、breakpoint focus、focused static contracts |
| 対象ファイル | `src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx`、`src/app/styles/app-shell.css`、focused tests 2 件 |
| 成果物 | 上記実装・tests と本 summary |
| 対象外 | API、DB、CanvasDocumentV1、route、dependency、foundation token values、mobile navigation redesign、`/backup` navigation decision、commit / push / PR / Issue、queue state |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| design authority | `summary/20260805/0039-design-future-ready-persistent-appchrome-rail-20260805-summary.md` | Decision Override から Next Read まで全文。same-DOM hierarchy、exact coordinates、state priority、tooltip portal、breakpoint focus、static / runtime acceptance |
| repository handoff | `HANDOFF_2026-08-03.md` | 既存 AppChrome / Issue #88 / #91 の focus・responsive 履歴と runtime 未確認境界 |
| current implementation | `src/app/_components/app-chrome.tsx` | staged / unstaged を合成した current worktree の duplicated desktop branch、toggle remount focus、mobile lifecycle |
| current parts | `src/app/_components/app-chrome-parts.tsx` | current `/notes` source、`/notes/new` create、desktop / mobile brand、icons、collapsed duplicate component |
| current CSS | `src/app/styles/app-shell.css` | current 68px / clamp geometry、bottom create、tooltip、mobile styles |
| current contracts | `test/notes/app-chrome-contract.test.js`、`test/notes/app-chrome-responsive-contract.test.js` | old duplicated branch / 68px positive assertionsとmobile non-regression assertions |
| summary rules | `summary/README.md`、`summary/task-summary-template.md` | filename、required sections、verification workflow |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/_components/app-chrome.tsx` | desktop を `aside#app-chrome-sidebar` 1 nodeへ統合。identity → one toggle → top create → nav scroll のsource orderへ変更。portal tooltip controller、direction-aware breakpoint focus predicateを追加し、toggle remount用 ref / effectを削除 | expanded / collapsed の同一DOM・同一focus anchorとtop-cluster information architectureを成立させるため |
| `src/app/_components/app-chrome-parts.tsx` | `AppChromeCollapsedNavigation` を削除。desktop non-link identityを追加。desktop linkのcollapsed name / tooltip dataとlabel visibilityをstate化。panel-left close / open iconsを追加し、mobile brand link / menu iconを維持 | desktop route重複・duplicate focus targetを除去し、icon-only accessible nameを保証するため |
| `src/app/styles/app-shell.css` | exact 16rem / 3.5rem sidebar、56px header、44px controls、20px icons、x6/y64・y120・y180 flow、nav-only scroll、current indicator、filled create、state / focus / reduced-motion、fixed tooltip overlayを実装。old clamp / 68px / boundary handle / collapsed aside / desktop footer rulesを削除 | design summaryのgeometry・visual language・overflow contractをCSSへ固定するため |
| `test/notes/app-chrome-contract.test.js` | same-DOM hierarchy、non-link desktop identity、panel icons、top create、geometry、state、portal tooltip、negative old-contract、`/backup` exclusionを検証する契約へ更新 | 新しいdesktop static acceptanceを固定するため |
| `test/notes/app-chrome-responsive-contract.test.js` | 901 / 900 CSS boundary、same-node toggle、direction-aware focus移動、expanded reset、mobile overlay lifecycleのnon-regressionを検証する契約へ更新 | responsive / focus acceptanceとmobile非回帰を固定するため |
| `summary/20260805/0109-implement-future-ready-persistent-appchrome-rail-20260805-summary.md` | 実装mapping、検証、runtime未確認、Next Readを記録 | Managerがraw logなしで再開・判断できるようにするため |

## Design Mapping

| design contract | implementation mapping |
|---|---|
| one desktop hierarchy | `aside#app-chrome-sidebar` を常時mountし、collapsed classはshell width / label visibilityだけを変更。desktop linksとtoggleを分岐でunmountしない |
| identity → toggle → create → nav → main | JSX source orderを一致。desktop identityは`div`、mobile brandだけ`Link href="/notes"`を維持 |
| exact 256 / 56px geometry | CSS variables `16rem` / `3.5rem`、border-box、1px right divider、shadow none。flex layoutによりmain開始位置もsidebar widthに追随 |
| x6/y64 toggle、y120 create、y180 first nav | 56px header + 8px toggle margin、44px toggle + 12px create margin、44px create + 12px scroll margin + 4px focus-safe paddingで実現 |
| same toggle node / focus | 1 button、同じ id / ref / handler。`shouldRestoreDesktopFocusRef` と `[isRailOpen]` rAF focus effectを削除しnative focusを維持 |
| panel icon family | shared 24px viewBoxへ `panel-left-close` / `panel-left-open` を追加。desktop toggleだけstate切替、mobile hamburgerは維持 |
| top create / nav-only scroll | desktop createをtoggle直後へ移動。`app-chrome-navigation-scroll`だけ`min-height:0; overflow-y:auto`。desktop footer / dividerなし |
| current / create / hover / pressed / focus state | nav currentはsoft background + 3×20px indicator + deep foreground、createは常時deep fill、hover / activeはrole stateを維持、focusは2px / offset2px |
| collapsed accessible names / tooltip | collapsed create / navにvisible textと同文の`aria-label`とtooltip data。expanded create / navはvisible labelをname sourceにしtooltip dataなし。toggleは両stateでdynamic name / tooltip |
| non-clipping tooltip | `createPortal(..., document.body)` + `position:fixed`。collapsed left=64、expanded toggle=anchor right+8、top / bottom 8px clamp、pointer-events none。hover / focus-visibleでopenし、leave / blur / Escapeでclose |
| breakpoint focus containment | 901→900はdesktop aside descendantだけmobile menuへ、900→901はmobile menu / panel descendantだけdesktop toggleへ移動。main focusはpredicate外。changeごとにexpanded reset |
| mobile non-regression | 72px header、brand link、menu、overlay hierarchy、initial focus、Escape、Tab loop、backdrop、body lock / restore、pathname close、main inertを維持 |
| future 3〜7 items | canonical `appChromeNavItems` mapと44px / 4px rowsを維持し、real route追加時に同じnav scroll regionへappend可能。placeholder / empty groupは追加していない |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | current production navigation sourceは`/notes` 1件、createは`/notes/new`のまま | `app-chrome-parts.tsx`とfocused contract PASS |
| F-002 | fact | desktop identityからroute / focus target / tooltipを除き、mobile brand linkだけを維持した | component sourceとfocused contract PASS |
| F-003 | fact | existing staged / unstaged状態に対するstage / unstage操作は行っていない | task中に`git add`、`git restore --staged`等を未実行。前後status / statを確認 |
| F-004 | fact | static contracts、lint、TypeScript、production build、diff checksはPASS | Verification表の各command |
| F-005 | unknown | actual browserのexact bounding rect、same-node focus、tooltip clipping、900 / 901 focus移動 | Browser backend一覧が空でruntimeを実施できなかったため |
| F-006 | unknown | test-only 7-row / short-height fixtureのactual overflow | productionへplaceholderを追加せず、Browser backendも利用不可だったため |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | CONFIRMED | 対象5 tracked filesの既存 staged / unstaged状態と多数のuntracked成果物を確認・保護 |
| 作業前 `git diff --cached --stat` | CONFIRMED | 4 files、135 insertions / 22 deletionsの既存staged差分を確認 |
| 作業前 `git diff --stat` | CONFIRMED | 対象5 files、712 insertions / 108 deletionsの既存unstaged差分を確認 |
| `node --test test/notes/app-chrome-contract.test.js test/notes/app-chrome-responsive-contract.test.js` | PASS | 6 / 6 tests |
| `node --test test/notes/accent-contrast-contract.test.js` | PASS | 2 / 2 tests。既存AA-safe state契約の追加非回帰確認 |
| `npm run lint` | PASS | ESLint errorなし |
| `npx tsc --noEmit --pretty false --incremental false` | PASS | TypeScript errorなし |
| `npm run build` | PASS | Prisma generate + Next.js 16 webpack production build。11 static pages generation完了 |
| `git diff --check` | PASS | unstaged / combined worktree whitespace errorなし |
| `git diff --cached --check` | PASS | existing staged差分のwhitespace errorなし |
| Browser backend discovery | UNAVAILABLE | Browser runtimeへ接続後、troubleshooting手順でbackend一覧を1回確認したが`[]`。別browser / standalone Playwrightへ代替していない |
| Browser runtime acceptance | NOT RUN | static / build PASSをvisual PASSとして扱わない |
| 作業後 `git status --short` | CONFIRMED | 対象5 tracked filesは開始時と同じ staged / unstaged区分（1件 ` M`、4件 `MM`）を維持。本summaryはuntrackedでstageしていない |
| 作業後 `git diff --cached --stat` | CONFIRMED | 開始時と同じ4 files、135 insertions / 22 deletions。既存staged差分をunstage / restageしていない |
| 作業後 `git diff --stat` | CONFIRMED | 対象5 files、965 insertions / 525 deletions。新summaryはuntrackedのためstat対象外 |

## Browser Runtime Items Not Confirmed

- 901px expanded / collapsedのsidebar 256 / 56px、main left、200px回復、horizontal overflow。
- 1280 / 1440pxでのfixed width、brand single-line、transparent gutter / second control column / shadow absence。
- toggle / C / create / first navのactual rectと、toggle click / Enter / Space後のsame node / same focus。
- `/notes` / `/notes/new`のactual current / create visual state、hover / pressed / focus-visible複合表示。
- collapsed / expanded tooltipのhover / keyboard focus、left / clamp、scrollWidth不変、scroll viewport clipping absence。
- Tab order、901→900 / 900→901 focus transfer、mobile overlay interactionのactual browser behavior。
- reduced-motion computed duration。
- test-only 7-row / short-height / optional secondary fixtureのoverflow acceptance。

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | exact desktop geometryとvisual density | Browser backend復旧後の901 / 1280 / 1440px computed rectとnew screenshots |
| U-002 | same-node toggle / breakpoint focusのactual behavior | pointer / keyboard toggleと900↔901 resizeによるactiveElement assertions |
| U-003 | tooltip placement / clipping / scrollWidth | collapsed hover / Tab focus、viewport clamp、before / after geometry計測 |
| U-004 | mobile overlayのactual non-regression | 900pxでinitial focus、Tab loop、Escape、close、backdrop、body restore、pathname changeを再実行 |
| U-005 | future density / overflow | non-production fixtureでreal-shaped 7 rowsとshort viewportを使うruntime確認 |
| U-006 | `/backup` common navigationのproduct decision | 発注者 / Managerの別task。source / assertion / documentsを同時に整合させる判断 |

## Next Read

次に読むべき最小ファイル:

1. `summary/20260805/0109-implement-future-ready-persistent-appchrome-rail-20260805-summary.md`
2. `summary/20260805/0039-design-future-ready-persistent-appchrome-rail-20260805-summary.md`
3. `src/app/_components/app-chrome.tsx`
4. `src/app/_components/app-chrome-parts.tsx`
5. `src/app/styles/app-shell.css`
6. `test/notes/app-chrome-responsive-contract.test.js`

Browser backend復旧後は本summaryの「Browser Runtime Items Not Confirmed」をacceptance checklistとして使う。`/backup` decisionを行わない限りroute / documentsは追加で読まない。
