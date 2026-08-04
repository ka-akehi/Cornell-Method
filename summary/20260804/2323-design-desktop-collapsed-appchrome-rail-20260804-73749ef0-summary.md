---
summary_type: task-summary
created_at: 2026-08-04 23:23 JST
task_kind: design
task_status: done
---

## Objective

desktop の collapsed AppChrome を、open sidebar と同じ情報階層を持つ full-height の icon-only rail として再設計する。並行 Worker 2 件の成果を統合し、後続 Worker が追加判断なしで DOM、CSS、static contract、runtime QA を実装できる契約を固定する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | desktop AppChrome の open / collapsed 表示、toggle、icon-only navigation、focus、tooltip、901px breakpoint |
| 対象画像 | `/Users/blp542/Desktop/スクショ/スクリーンショット 2026-08-04 3.40.31.png`、`/Users/blp542/Desktop/スクショ/スクリーンショット 2026-08-04 23.12.37.png` |
| 対象実装 | `src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx`、`src/app/styles/app-shell.css` |
| 対象テスト | `test/notes/app-chrome-contract.test.js`、`test/notes/app-chrome-responsive-contract.test.js` |
| 状態資料 | `HANDOFF_2026-08-03.md`、Issue #91 の task / summary、現在の staged / unstaged diff |
| 対象外 | API、DB、CanvasDocumentV1、route 追加、mobile overlay navigation の再設計、PR / Issue / queue state 操作 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| repository instruction | `AGENTS.md` | 未コミット変更保護、MVP / Phase 2 境界、Manager / Worker 運用 |
| skill | `.agents/skills/cornell-code-review/SKILL.md`、`references/review-checklist.md` | UI、responsive、focus、ARIA、static / runtime 証拠の分離 |
| handoff | `HANDOFF_2026-08-03.md` | PR #84 と Issue #91 の履歴、未実施の Browser QA |
| MVP contract | `doc/implementation/MVP_CONTRACT.md` | desktop 優先、canonical route、mobile は壊さず主要操作へ到達可能にする境界 |
| architecture / status / tests | `doc/technical/TARGET_ARCHITECTURE.md`、`doc/implementation/IMPLEMENTATION_STATUS.md`、`doc/testing/TEST_SCENARIOS.md` | `src/app/**` の UI 責務、静的確認と Browser runtime の判定分離 |
| screenshot | `/Users/blp542/Desktop/スクショ/スクリーンショット 2026-08-04 3.40.31.png` | collapsed state。左 rail と rail 外側の menu button が別の幅として見える |
| screenshot | `/Users/blp542/Desktop/スクショ/スクリーンショット 2026-08-04 23.12.37.png` | open state。brand、nav、bottom CTA を持つ単一 full-height sidebar |
| current source | `src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx`、`src/app/styles/app-shell.css` | 2 Worker の staged / unstaged 成果を重ねた現在の DOM / CSS |
| current tests | `test/notes/app-chrome-contract.test.js`、`test/notes/app-chrome-responsive-contract.test.js` | fixed button、追加 main gutter、collapsed icons、mobile boundary の現行 static contract |
| running task | `codex-queue/tasks-ui/running/fix-issue-91-collapsed-navigation-icons-20260804-78dfd585.task.md` | collapsed rail に brand / notes / create icons を残す責務 |
| running task | `codex-queue/tasks-ui/running/fix-issue-91-explicit-collapsed-menu-button-20260804-f6f7a09e.task.md` | open / closed toggle の明示分岐、44px、ARIA、focus 復帰の責務 |
| progress | `codex-queue/.state/progress/…78dfd585…`、`…f6f7a09e…` | 2 件とも 100%。Browser backend 不可のため runtime は未確認 |
| Manager summary | `summary/20260804/1712-manager-next-work-organization-20260804.md` | local HEAD、staged / unstaged 境界、focused tests PASS、runtime 未確認 |
| Issue summary | `summary/20260803/issues-91-triage-20260803.md` | #91 の従来判断は handle 用余白を確保する案だったこと |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260804/2323-design-desktop-collapsed-appchrome-rail-20260804-73749ef0-summary.md` | screenshot 比較、設計判断、exact dimensions、状態契約、統合方針、後続 coding / QA 契約を記録 | コードを変更せず、並行成果を統合する正本を残すため |

コード、CSS、テスト、設定、依存関係、生成物、handoff、queue task は変更していない。

## Screenshot Comparison

2 枚とも 1915×957px。collapsed screenshot は右側に Chrome DevTools が dock されているため、content の絶対幅ではなく AppChrome 左端の構造を比較対象とする。画像左下の黒い `N` は Next.js development indicator であり、rail / CTA の設計要素として数えない。

| 観点 | fact（画像・現行実装から確認） | 判断 / 契約 |
|---|---|---|
| レイアウト | open は brand、navigation、bottom CTA が sidebar の面内に収まる。collapsed は細い rail の右外に menu button があり、main 側にも追加 padding がある。 | collapsed も 1 本の full-height rail だけで幅を確定し、独立 button 列と main 用追加 gutter を廃止する。 |
| 情報階層 | open は「brand → nav → bottom CTA」が明確。collapsed の menu button は rail 外へ離れ、brand / nav / CTA と別系統に見える。 | collapsed は「brand → expand toggle → nav → bottom CTA」の順にする。toggle は neutral control、selected nav と CTA を accent の主役にする。 |
| 操作 | current source では notes / create icon link と再展開 button は存在するが、button は `position: fixed` で rail の外側に置かれる。 | 再展開 button を collapsed rail の top cluster 内へ統合する。toggle、notes、create は中央軸を共有する。 |
| accessibility | current icon-only notes / create は `aria-label` と visually-hidden text、toggle は `aria-label` / `aria-expanded` / `aria-controls` を持つ。hover / focus tooltip はない。collapsed brand の見た目は 36px mark で、44px hit area は CSS 契約されていない。 | 既存 ARIA を維持し、すべての desktop icon-only control に 44px 以上の hit areaと hover / keyboard-focus tooltip を付ける。 |
| focus / responsive | breakpoint focus 判定は open `aside` と toggle を検知するが、collapsed navigation は `aside` の sibling で ref の外にある。 | desktop rail region 全体を focus containment の対象にし、collapsed brand / nav / CTA から 900px 以下へ切り替わる経路も mobile menu button へ focus を戻す。 |
| mobile | current CSS は `max-width: 900px` で desktop rail / handle / collapsed navigation を隠し、mobile header / overlay を使う。 | この breakpoint と mobile overlay DOM / interaction は変更しない。 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 作業開始時の tracked AppChrome 5 ファイルには staged / unstaged 差分があり、本 task の保護対象である。 | `git status --short`、`git diff --cached`、`git diff` |
| F-002 | fact | staged 側は rail 幅を 4.25rem にし、collapsed handle を desktop で固定表示する方向を追加している。 | cached diff |
| F-003 | fact | unstaged 側は `AppChromeCollapsedNavigation`、icon-only brand / notes / create、明示的な closed menu button、main の追加 left padding を追加している。 | working-tree diff |
| F-004 | fact | current closed button は rail 幅 `4.25rem` の直後 `+ 0.375rem` に fixed 配置され、`.app-main` に control `2.75rem + 0.375rem` を加算する。 | `app-shell.css` の current source |
| F-005 | fact | したがって current state は 68px rail に加えて 50px 相当を main 内側へ予約し、画像で問題になった二重の幅を構造として残す。 | F-004 と collapsed screenshot |
| F-006 | fact | `4.25rem` rail は 44px control を中央配置して左右 12px、48px nav control を中央配置して左右 10px を確保できる。 | 16px root で 68 − 44 = 24、68 − 48 = 20 |
| F-007 | fact | icon-only routes は既存 `appChromeNavItems` と `AppChromeCreateLink` を再利用するため、`/notes` と `/notes/new` の canonical route を重複定義せず維持できる。 | `app-chrome-parts.tsx` |
| F-008 | fact | current breakpoint focus effect は `desktopRailRef`（open aside）内と toggle を確認するが、collapsed navigation 内 link は containment 対象外である。 | `app-chrome.tsx` の `handleViewportChange` と DOM sibling 関係 |
| F-009 | fact | static contract は DOM / CSS 文字列を確認できるが、実際の重なり、中心軸、tooltip、focus ring、breakpoint transition は証明できない。 | repository の検証判定基準 |
| A-001 | assumption | root font-size は通常の 16px とし、rem の px 換算は説明用に 16px 基準とする。実装契約の正本は rem 値。 | current CSS の rem 運用 |
| U-001 | unknown | current 2 Worker 成果を統合した実ブラウザ表示は未確認。 | 2 progress file と Manager summary |

## Manager Recommendation / Final UI Contract

### 1. Chosen structure

Manager 推奨を採用し、collapsed state を open sidebar の icon-only 版として扱う。rail の外側に専用列を足さない。再展開 control は rail の top cluster に属し、main content の幅計算には参加させない。

推奨 DOM 責務は次のとおり。

```text
.app-chrome-shell
├─ .app-chrome-rail-region                       desktop only
│  ├─ open:      button.app-chrome-rail-handle  chevron-left
│  ├─ open:      aside#app-chrome-rail          full sidebar
│  └─ collapsed: aside.app-chrome-collapsed-navigation
│     ├─ brand icon-only link
│     ├─ button#app-chrome-rail-toggle           menu / expand
│     ├─ nav                                     icon-only canonical links
│     └─ footer                                  icon-only create CTA
├─ .app-chrome-content
└─ .app-chrome-mobile-overlay                    existing mobile only
```

`AppChromeCollapsedNavigation` の root は icon rail 全体を表す `aside` とし、navigation items はその内側の `nav` に置く。closed toggle を `.app-chrome-shell` 直下の fixed sibling として残さない。

### 2. Exact dimensions and spacing

rem が契約値で、px は root 16px 時の参考値。

| 要素 | exact contract | 補足 |
|---|---|---|
| collapsed rail width | `--app-chrome-collapsed-rail-width: 4.25rem`（68px） | 現在の token を採用。約 4.5rem の要求を満たし、既存差分との統合量を抑える。 |
| rail height | `100svh`、`position: sticky; top: 0` | open と同じ full-height。surface と右 1px border を持つ。 |
| central axis | rail 左端から `2.125rem`（34px） | brand mark、toggle icon、nav icon、bottom CTA icon の中心差は 1px 以下。 |
| horizontal inner padding | collapsed は `0.625rem`（10px） | 48px control を 68px rail の中央へ置く。 |
| top padding | 既存 `--app-chrome-rail-inner-padding-top: clamp(1.25rem, 3vw, 2rem)` | open / collapsed で共有。 |
| brand slot / link hit area | `--app-chrome-rail-brand-slot-height: 3.5rem`（56px）、collapsed link は幅 `2.75rem`（44px） | open の複数行 brand copy と collapsed mark を同じ 56px row に置く。mark は既存 `2.25rem × 2.25rem`（36×36px）で中央配置。 |
| brand → toggle gap | `0.5rem`（8px） | 同一中央軸。 |
| expand toggle | `2.75rem × 2.75rem`（44×44px） | icon `1.25rem`、neutral surface / strong line。fixed positioning を使わない。 |
| toggle → first nav gap | `0.75rem`（12px） | brand hit area の下から first nav まで `0.5 + 2.75 + 0.75 = 4rem`。 |
| brand slot → first nav | `4rem` | open は 4rem の空白、collapsed は `0.5 + 2.75 + 0.75 = 4rem` にして、first nav の vertical start を揃える。current clamp は desktop AppChrome ではこの exact value に統合する。 |
| nav icon control | `3rem × 3rem`（48×48px） | icon `1.25rem`（20px）。link 間 gap `0.5rem`。 |
| bottom CTA | `3rem × 3rem`（48×48px） | `margin-top: auto`、footer divider 後の top padding `0.75rem`、rail bottom padding `1rem`。 |
| focus ring | `2px solid var(--app-focus)`、`outline-offset: 3px` | open / collapsed の全 control で共有し、rail overflow で切らない。 |
| tooltip offset | rail 右端から `0.5rem`（8px） | layout 幅を増やさず overlay 表示。1 行、surface / strong line / ink token を使用。 |

top cluster の寸法関係:

```text
       4.25rem rail（center x = 2.125rem）
    ┌─────────────────┐
    │   top padding   │  1.25rem〜2rem（open と共有）
    │     [  C  ]     │  brand row 3.5rem / width 2.75rem / mark 2.25rem
    │      0.5rem     │
    │     [  ≡  ]     │  2.75rem、展開 control
    │      0.75rem    │
    │     [ note ]    │  3rem nav control
    │       ...       │
    │─────────────────│
    │     [  +  ]     │  3rem bottom CTA
    └─────────────────┘
```

### 3. Main content offset

- collapsed の `.app-chrome-rail-region` 自体が flex item として `4.25rem` を占有する。
- `.app-chrome-content` の開始位置は rail の右 border、すなわち viewport 左端から `4.25rem`。別の menu 列はない。
- `.app-main` は通常の `padding: clamp(0.75rem, 1.75vw, 1.25rem) clamp(0.625rem, 2vw, 1.5rem)` だけを使う。
- `.app-chrome-shell.is-rail-collapsed .app-main` に `control-size + gap` を加える rule は削除する。
- max-width child の中央寄せによる余白は許容するが、collapsed toggle のための専用 gutter は予約しない。

### 4. Color, hover, selected and tooltip contract

- rail background: `var(--app-surface)`、右 border: `var(--app-line)`。
- brand / default toggle: `var(--app-ink)`、toggle border: `var(--app-line-strong)`。
- nav default: current `var(--app-muted-ink)`、hover は current accent hover を維持。
- selected nav: open / collapsed とも同じ `.app-chrome-nav-link.is-selected` / `[aria-current="page"]` を使用し、`var(--app-accent-soft)` background、`var(--app-accent-deep)` text、既存 subtle border を維持。
- create CTA: open / collapsed とも既存 `.app-chrome-create-link` の accent border、hover / selected の `var(--app-accent-deep)` background と `#fffaf1` text を共有。
- collapsed 専用色を新設しない。icon-only modifier は寸法、中央寄せ、tooltip だけを担当する。
- desktop icon-only tooltip 文言は accessible label と一致させる。
  - brand: `Cornell Method Notebook ノート一覧へ`
  - open toggle: `サイドバーを折りたたむ`
  - collapsed toggle: `サイドバーを展開する`
  - notes: `ノート一覧`
  - create: `新規ノート`
- tooltip は hover と `:focus-visible` の両方で rail 右側へ表示する。DOM 内の tooltip text は `aria-hidden="true"` とし、accessible name は `aria-label` の 1 系統にする。tooltip は layout flow、main offset、hit area を変えない。

### 5. Accessibility and focus contract

- icon-only link / button はすべて明示的な `aria-label` を持つ。SVG は `aria-hidden="true"` / `focusable="false"` を維持する。
- current route link は `aria-current="page"` と `.is-selected` を同時に持つ。
- toggle は open / collapsed の両 branch で同じ logical id、`aria-controls="app-chrome-rail"`、正しい `aria-expanded`、同じ `toggleRail` を使う。同時に DOM に存在する toggle は 1 個だけ。
- collapse click 後は新しく mounted された collapsed toggle、expand click 後は open chevron handle へ `requestAnimationFrame` 後に focus を戻す current behavior を維持する。
- `desktopRailRef` の containment を open aside だけに限定しない。`.app-chrome-rail-region` 全体へ ref を移すか collapsed aside の ref を追加し、collapsed brand / toggle / nav / CTA のどこに focus があっても 901→900px で mobile menu button へ focus を戻す。
- brand は 44×56px、toggle は 44×44px、nav / CTA は 48×48px とし、全 control で 44px minimum を満たす。
- focus outline、selected fill、tooltip は互いに置換しない。keyboard focus では focus ring と tooltip の両方が見える。

## State Matrix

| state | 表示するもの | 非表示にするもの | main / navigation behavior |
|---|---|---|---|
| desktop open（`min-width: 901px`, `isRailOpen=true`） | full sidebar、brand mark + copy、chevron-left handle、label 付き nav、label 付き bottom CTA | collapsed aside、collapsed menu button、mobile header / overlay | sidebar width `clamp(13.5rem, 18vw, 15.5rem)`。現行 main padding。 |
| desktop collapsed（`min-width: 901px`, `isRailOpen=false`） | 4.25rem full-height rail、icon-only brand、rail 内 menu toggle、icon-only nav、icon-only bottom CTA、hover / focus tooltip | full sidebar、open chevron handle、mobile header / overlay、rail 外 fixed menu | content starts immediately after 4.25rem rail。追加 gutter なし。 |
| mobile（`max-width: 900px`） | existing sticky mobile header、mobile menu button、open 時の existing overlay / panel / full-label nav / CTA | desktop full sidebar、collapsed rail、desktop open / collapsed toggle、desktop tooltip | current mobile close、Escape、Tab loop、backdrop、body scroll lock、pathname close を変更しない。 |

## Current Implementation: Keep / Integrate / Remove

### Keep

| 現在の責務 | 維持理由 |
|---|---|
| `isRailOpen`、`toggleRail`、`shouldRestoreDesktopFocusRef`、toggle 後の focus 復帰 | open / collapsed を keyboard で往復する基盤として正しい。 |
| open chevron と closed menu を相互排他的に描画する分岐 | 同一 id の重複を避け、icon の存在を明示できる。 |
| `aria-label`、`aria-expanded`、`aria-controls` | toggle の accessible state 契約。 |
| `AppChromeIcon` の menu / notes / plus path | 既存 visual language を共有できる。 |
| `appChromeNavItems`、`isActiveRoute`、`AppChromeNavLink`、`AppChromeCreateLink` の再利用 | canonical route と selected state の drift を防ぐ。 |
| `iconOnly`、visually-hidden label、`aria-current` | collapsed link の accessible name と route state の基礎。 |
| `AppChromeCollapsedNavigation` の brand / nav / footer という責務 | open sidebar の icon-only counterpart として採用する。 |
| `4.25rem` width token、`100svh`、surface / border、footer `margin-top:auto` | 単一 full-height rail の土台。 |
| `max-width: 900px` の desktop hide / mobile show と既存 overlay logic | mobile navigation は再設計対象外。 |

### Integrate / adjust

| 現在の責務 | 統合後 |
|---|---|
| shell 直下の closed menu button | `AppChromeCollapsedNavigation` の brand と nav の間へ移し、rail top cluster の一要素にする。 |
| collapsed root の `<nav>` | rail 全体は `aside`、items 部分だけを `nav` として情報階層を明示する。 |
| open aside のみを指す `desktopRailRef` | desktop rail region 全体の ref にし、collapsed links も breakpoint focus 復帰対象へ含める。 |
| current `--app-chrome-rail-nav-margin-top` clamp | shared brand slot を 3.5rem、desktop top rhythm を exact `4rem` に統合し、collapsed では 8px + 44px + 12px で同じ 4rem を構成する。 |
| collapsed link の `width:100%` | 3rem square を中央配置し、selected background を rail 内に収める。 |
| accessible label only | label と同文の visual tooltip を hover / focus に追加する。 |

### Remove

| 削除対象 | 理由 |
|---|---|
| shell 直下の `.app-chrome-rail-collapsed-menu-button` fixed placement | rail と独立した第二列に見える根本原因。 |
| `left: calc(var(--app-chrome-collapsed-rail-width) + var(--app-chrome-rail-control-gap))` | control を rail 外へ押し出す。 |
| collapsed menu 用 `z-index: 100` の viewport anchoring | rail 内 control では不要。tooltip / focus ring に必要な局所 stacking だけを定義する。 |
| `.app-chrome-shell.is-rail-collapsed .app-main` の追加 `padding-left` calc | main に別 gutter を予約する根本原因。 |
| fixed button の表示を強制する重複 `display / visibility / opacity` contract | state DOM と desktop media rule の 1 系統で可視性を決める。 |
| tests の「fixed button が rail 外」「main が control 幅を予約」の positive assertions | 新設計と逆の旧契約。negative assertion へ置き換える。 |

## Follow-up Coding Task Contract

### Target files

1. `src/app/_components/app-chrome.tsx`
2. `src/app/_components/app-chrome-parts.tsx`
3. `src/app/styles/app-shell.css`
4. `test/notes/app-chrome-contract.test.js`
5. `test/notes/app-chrome-responsive-contract.test.js`

`HANDOFF_2026-08-03.md`、API、DB、Canvas、dependencies、generated files、queue state は coding task の対象に含めない。

### Implementation steps

1. 現在の staged / unstaged 差分を失わない状態で 2 Worker の最終成果を再確認する。
2. closed toggle の props / ref / `toggleRail` を `AppChromeCollapsedNavigation` へ渡し、collapsed aside 内へ描画する。shell 直下 branch を削除する。
3. rail region へ ref を付け、breakpoint focus predicate が open / collapsed の全 desktop controls を包含するよう更新する。
4. collapsed component を `aside + nav + footer` に整理し、brand、toggle、nav、CTA の DOM 順を固定する。
5. 4.25rem rail、3.5rem shared brand slot、中央軸、44 / 48px hit area、8 / 12px top-cluster gap、4rem shared nav rhythm、bottom CTA、tooltip を CSS 化する。
6. fixed closed button と collapsed-specific main padding を削除する。normal `.app-main` padding と mobile CSS を維持する。
7. static contracts を新しい DOM / CSS 責務へ更新し、旧 separated layout を negative assertion で禁止する。
8. focused tests、lint、TypeScript、build、diff check を実行する。Browser が利用できる場合だけ下記 runtime acceptance を実施する。

## Static Contract vs Browser Runtime

### Static contract で確認する項目

- width token が `4.25rem` で、collapsed rail の `flex-basis / width / min-width` が同 token を使う。
- closed toggle が collapsed aside の内側、brand と nav の間にあり、shell 直下 fixed sibling ではない。
- open / collapsed toggle が相互排他的で、runtime DOM 上 1 個になる分岐、同じ id / handler / ARIA を持つ。
- menu / notes / plus SVG path が存在する。
- collapsed brand / nav / create が canonical component / items を再利用する。
- icon-only controls に要求した `aria-label`、`aria-current`、tooltip text hook がある。
- rail region ref または collapsed ref が breakpoint focus containment に含まれる。
- 3.5rem brand slot、44px 以上の brand / toggle、48px nav / CTA、20px icon、8px / 12px top gap、4rem nav rhythm、中央寄せ、bottom footer の CSS がある。
- open / collapsed が同じ nav selected / hover / focus token rule を共有する。
- `.app-main` に collapsed 専用の control-size 加算が存在しない。
- closed toggle に `position: fixed` と rail 外 `left: calc(...)` が存在しない。
- `min-width: 901px` だけ collapsed rail を表示し、`max-width: 900px` では desktop rail / toggle / tooltip を隠して existing mobile header を表示する。
- mobile overlay、Escape、focus trap、body scroll lock、pathname close の既存 source contract が残る。

### 実ブラウザでのみ確認できる項目

- 1280 / 1440px で collapsed rail の実測幅が 68px（許容 ±0.5px）、content の左端が rail 右端と一致する。
- main の computed padding-left が normal rule の値で、collapsed 時だけ約 50px 増えない。
- brand mark、menu、notes、plus の中心 x が ±1px 以内で一致する。
- brand hit area と toggle が重ならず、8px gap、toggle と first nav に 12px gap がある。
- open / collapsed の first nav top が ±1px 以内で一致する。
- selected fill、focus outline、tooltip が rail border / ancestor overflow で clip されない。
- hover と Tab focus の双方で正しい tooltip が rail 右側に表示され、main のレイアウトを動かさない。
- collapse 後に menu button、expand 後に chevron button へ focus が残る。
- collapsed brand / notes / CTA に focus がある状態で 901→900px へ変更すると mobile menu button へ focus が移る。
- `/notes` で notes が selected、`/notes/new` で CTA が selected となり、icon link click で canonical route へ遷移する。
- CTA が viewport 下部に収まり、Next.js development indicator の有無を判定材料にしない。
- 901px では desktop rail、900px では既存 mobile header / overlay だけが使われる。
- 900 / 901 / 1280 / 1440px で page-wide horizontal overflow、content overlap、二重 gutter がない。

### Required verification commands

```sh
node --test test/notes/app-chrome-contract.test.js test/notes/app-chrome-responsive-contract.test.js
npm run lint
npx tsc --noEmit --pretty false --incremental false
npm run build
git diff --check
git diff --cached --check
```

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 確認済み | AppChrome 5 ファイルの staged / unstaged 差分と既存 untracked files を記録。戻していない。 |
| 作業後 `git status --short` | 確認済み | 開始時の AppChrome 5 ファイルと既存 untracked files を維持し、本 task の追加成果はこの詳細 summary 1 件だけ。 |
| screenshot 2 点 | 確認済み | `view_image` original detail。両方 1915×957px。 |
| staged / unstaged diff | 確認済み | 2 Worker の責務を別々に確認。 |
| Issue #91 task / progress | 確認済み | 2 件とも progress 100%、queue 上は running。直接編集していない。 |
| source / test inspection | 確認済み | current combined worktree を read-only で確認。 |
| code / CSS / tests execution | 未実施 | docs-only design task であり、保護中の並行成果へ test/build による生成物更新を加えないため。 |
| Browser runtime | 未実施 | この task は提供 screenshot の比較まで。2 Worker の記録でも Browser backend は利用不可。 |
| `sh tools/check-summary.sh <summary>` | PASS | 必須 heading と summary 形式を確認。 |
| summary whitespace / status | PASS | `git diff --check` と作業後 status を確認。 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 2 running Worker の runner による queue move / final summary | runner の自動完了処理。手動で running / done / failed を編集しない。 |
| U-002 | 統合実装後の実ブラウザ geometry、tooltip、focus、breakpoint | Browser backend 復旧後の runtime QA。 |
| U-003 | 16px 以外の root font-size での px 実測 | rem 契約を正とし、必要なら Browser computed style で確認。 |

## Next Read

後続 coding Worker は次だけを先に読む。

- `summary/20260804/2323-design-desktop-collapsed-appchrome-rail-20260804-73749ef0-summary.md`
- `src/app/_components/app-chrome.tsx`
- `src/app/_components/app-chrome-parts.tsx`
- `src/app/styles/app-shell.css`
- `test/notes/app-chrome-contract.test.js`
- `test/notes/app-chrome-responsive-contract.test.js`
