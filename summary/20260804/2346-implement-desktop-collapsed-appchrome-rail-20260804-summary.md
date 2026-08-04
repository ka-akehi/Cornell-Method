---
summary_type: task-summary
created_at: 2026-08-04 23:46 JST
task_kind: coding
task_status: done
---

## Objective

desktop collapsed AppChrome を、brand、展開 toggle、icon-only navigation、bottom create CTA を内包する幅 `4.25rem` の単一 full-height rail として実装する。先行 Issue #91 Worker の staged / unstaged 差分を戻さず、設計 summary の DOM、寸法、focus、tooltip、responsive、static acceptance を一つの実装へ統合する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | desktop AppChrome の open / collapsed 分岐、collapsed rail、toggle focus、tooltip、901px breakpoint |
| 対象ファイル | `src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx`、`src/app/styles/app-shell.css`、AppChrome focused contract tests 2 件 |
| 追加成果物 | 本 summary |
| 対象外 | API、DB、CanvasDocumentV1、dependencies、mobile overlay navigation の再設計、PR / Issue / queue state、commit / push |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| design source of truth | `summary/20260804/2323-design-desktop-collapsed-appchrome-rail-20260804-73749ef0-summary.md` | Final UI Contract、state matrix、Keep / Integrate / Remove、static / runtime acceptance を全文確認 |
| repository handoff | `HANDOFF_2026-08-03.md` | Issue #91 までの実装・検証履歴、既存 mobile / focus 契約、Browser 未確認履歴 |
| current implementation | `src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx`、`src/app/styles/app-shell.css` | 2 Worker の staged / unstaged 成果を重ねた現 worktree を基準に確認 |
| current static contracts | `test/notes/app-chrome-contract.test.js`、`test/notes/app-chrome-responsive-contract.test.js` | 旧 fixed button、追加 main gutter、collapsed icons、mobile interaction の既存 assertion を確認 |
| summary format | `summary/task-summary-template.md` | 必須 heading と記録粒度 |
| Browser skill | `/Users/blp542/.codex/plugins/cache/openai-bundled/browser/26.727.51351/skills/control-in-app-browser/SKILL.md` | in-app Browser の接続・選択・利用不可判定手順。別 browser surface へ代替しない境界 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/_components/app-chrome.tsx` | desktop rail region 全体へ `desktopRailRef` を移動。open chevron tooltip を追加。closed branch では toggle props / ref / handler を collapsed component へ渡し、shell 直下の button を削除 | collapsed brand / toggle / nav / CTA の全 focus を breakpoint containment に含め、外付け menu 列を廃止するため |
| `src/app/_components/app-chrome-parts.tsx` | `AppChromeCollapsedNavigation` を `aside` root、brand `header`、closed toggle、icon-only `nav`、`footer` の順へ整理。canonical nav / create / brand を再利用し、icon-only control の visual tooltip を追加 | open sidebar と同じ情報階層、1 toggle、canonical route / selected state、ARIA と tooltip 契約を満たすため |
| `src/app/styles/app-shell.css` | collapsed rail を `4.25rem`、brand slot `3.5rem`、toggle `2.75rem`、nav / CTA `3rem`、icon `1.25rem`、brand→toggle `0.5rem`、toggle→nav `0.75rem`、open nav rhythm `4rem` に統合。collapsed aside に surface / border / full-height flex layout を付与。hover / `:focus-visible` tooltip を overlay 表示 | brand、menu、notes、plus を同じ中央軸へ揃え、44px minimum、shared color / selected / focus contract、bottom CTA を実装するため |
| `src/app/styles/app-shell.css` | fixed closed button の viewport anchoring、rail 外 `left: calc(...)`、`z-index: 100`、desktop media の visibility 強制、collapsed 専用 `.app-main` padding 加算を削除 | 二重 gutter を構造として再導入せず、content を 4.25rem rail の直後から開始させるため |
| `test/notes/app-chrome-contract.test.js` | 新しい aside DOM 順、toggle props / ARIA、tooltip hook、exact dimensions、shared rhythm、footer、negative fixed / external-left / main-gutter assertions へ更新 | static acceptance を新設計へ合わせ、旧 separated layout を禁止するため |
| `test/notes/app-chrome-responsive-contract.test.js` | rail region focus containment、mutually exclusive branch、901 / 900px rules、tooltip hide、mobile contract 維持、旧 fixed / extra gutter の negative assertions へ更新 | responsive / focus の source contract と mobile 非回帰を確認するため |

既存の staged 差分は unstage せず、既存 staged / unstaged 内容を現 worktree 上で統合した。既存 untracked files は変更・削除・stage していない。本 summary も stage していない。

## Design Contract Mapping

| 設計契約 | 実装 |
|---|---|
| collapsed root / DOM order | `aside.app-chrome-collapsed-navigation` 内を brand → closed toggle → `nav` → `footer` の順に固定 |
| toggle mutual exclusion | open button は `isRailOpen` branch、collapsed component は `!isRailOpen` branch。runtime に存在する desktop toggle は 1 個 |
| same logical toggle | open は `desktopRailToggleId`、collapsed は同値を `railToggleId` で受け、同じ `desktopRailHandleRef`、`toggleRail`、`aria-controls="app-chrome-rail"`、state-derived label / expanded を使用 |
| focus containment | `desktopRailRef` を open aside から `.app-chrome-rail-region` の `div` へ移し、collapsed brand / toggle / nav / CTA を含むよう変更 |
| rail / central axis | region の flex-basis / width / min-width は `4.25rem`。collapsed aside は inline padding `0.625rem`、44px brand / toggle と48px nav / CTA を中央配置 |
| top rhythm | shared brand slot `3.5rem`。open nav margin `4rem`、collapsed は `0.5rem + 2.75rem + 0.75rem = 4rem` |
| bottom CTA | collapsed footer は `margin-top: auto`、divider、`padding-top: 0.75rem`、rail bottom `1rem`、CTA `3rem` |
| tooltip | accessible label と同文の `aria-hidden="true"` span を absolute overlay とし、hover / `:focus-visible` で rail 右側に表示。flow / main offset に不参加 |
| colors / states | open / collapsed とも既存 brand、nav、create classes と `var(--app-*)` token を共有。collapsed 専用 color token は追加なし |
| main offset | `.app-main` は通常の responsive padding だけ。collapsed 専用 padding-left rule なし |
| responsive boundary | `min-width: 901px` で collapsed aside、`max-width: 900px` で desktop region / tooltip を隠し既存 mobile header を表示 |
| mobile non-regression | Escape、Tab loop、backdrop、body scroll lock、pathname close、mobile focus restoration の source を変更していない |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 作業開始時は `app-chrome.tsx`、CSS、2 test が staged + unstaged、`app-chrome-parts.tsx` が unstaged であり、保護対象だった | 開始時 `git status --short`、`git diff --cached --stat`、`git diff --stat` |
| F-002 | fact | 旧 combined worktree は closed menu を `position: fixed` と rail 外 `left: calc(...)` で配置し、desktop `.app-main` に control 幅分を加算していた | 作業開始時 source / CSS |
| F-003 | fact | collapsed branch の toggle を component 内へ移すことで、shell と collapsed rail の間に第二の control column を持たない構造になった | 更新後 JSX / CSS と negative static contract |
| F-004 | fact | `.app-chrome-rail-region` containment は open / collapsed の desktop controls をすべて含む | 更新後 ref placement と `contains(document.activeElement)` predicate |
| F-005 | fact | local dev server は repository cwd の process として port 3000 で listen していた | `lsof -nP -iTCP:3000 -sTCP:LISTEN`、process cwd 確認 |
| U-001 | unknown | 実ブラウザ上の geometry、tooltip、focus、breakpoint behavior | Browser runtime の利用可能 instance が 0 件だったため未実施 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 確認済み | 既存 5 tracked files の staged / unstaged 状態と既存 untracked files を確認。戻していない |
| 作業前 `git diff --cached --stat` | 確認済み | 4 files、135 insertions / 22 deletions |
| 作業前 `git diff --stat` | 確認済み | 5 files、507 insertions / 86 deletions |
| 作業後 `git status --short` | 確認済み | 開始時と同じ tracked 5 files の staged / unstaged 区分を維持。本 summary は untracked、既存 untracked files も保持 |
| 作業後 `git diff --cached --stat` | 確認済み | 4 files、135 insertions / 22 deletions。既存 staged 差分を unstage / restage していない |
| 作業後 `git diff --stat` | 確認済み | tracked 5 files、712 insertions / 108 deletions |
| `node --test test/notes/app-chrome-contract.test.js test/notes/app-chrome-responsive-contract.test.js` | PASS | 2 tests / 2 pass / 0 fail |
| `npm run lint` | PASS | ESLint exit 0 |
| `npx tsc --noEmit --pretty false --incremental false` | PASS | exit 0 |
| `npm run build` | PASS | Prisma clients generation、Next.js production build、route generation 完了 |
| `git diff --check` | PASS | whitespace error なし |
| `git diff --cached --check` | PASS | staged diff の whitespace error なし |
| `sh tools/check-summary.sh summary/20260804/2346-implement-desktop-collapsed-appchrome-rail-20260804-summary.md` | PASS | 必須 heading / summary format を確認 |
| Browser backend discovery | UNAVAILABLE | Browser runtime 選択が `No browser is available`。troubleshooting 手順後の `agent.browsers.list()` も `[]` |
| `/notes` / `/notes/new` runtime at 900 / 901 / 1280 / 1440px | NOT RUN | Browser backend unavailable。static contract / build を runtime PASS と扱わない |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 1280 / 1440px で rail 実測 68px、content left edge、normal main padding、中央軸 ±1px、8px / 12px gap、open / collapsed first-nav top | Browser computed style / bounding box |
| U-002 | selected fill、focus outline、tooltip が clip されず、hover / Tab の双方で表示され layout shift しないこと | Browser interaction + screenshot / geometry |
| U-003 | collapse 後 menu、expand 後 chevron への focus、collapsed brand / nav / CTA focus 中の 901→900px mobile button focus 復帰 | Browser focus assertions |
| U-004 | `/notes` notes selected、`/notes/new` CTA selected、canonical route click、CTA bottom placement | Browser route interaction |
| U-005 | 900 / 901 / 1280 / 1440px の horizontal overflow、content overlap、二重 gutter 非再現、900px mobile overlay / Escape / Tab loop / backdrop / body scroll / pathname close | Browser viewport matrix |

## Next Read

- `summary/20260804/2323-design-desktop-collapsed-appchrome-rail-20260804-73749ef0-summary.md`
- `summary/20260804/2346-implement-desktop-collapsed-appchrome-rail-20260804-summary.md`
- `src/app/_components/app-chrome.tsx`
- `src/app/_components/app-chrome-parts.tsx`
- `src/app/styles/app-shell.css`
- `test/notes/app-chrome-contract.test.js`
- `test/notes/app-chrome-responsive-contract.test.js`
