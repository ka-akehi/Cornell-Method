---
summary_type: task-summary
created_at: 2026-08-04 00:30 JST
task_kind: worker-task
task_status: done
---

## Objective

Issue #91 の `2ae96bd` 実装を read-only で再監査し、実画面で未修正に見える可能性、DOM/CSS の根拠、static contract の不足、次 Worker の最小修正・runtime 判定条件を固定する。コード、設定、依存関係、生成物は変更しない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | AppChrome desktop collapsed rail、physical gutter、handle、responsive cascade |
| 対象ファイル / ディレクトリ | `src/app/_components/app-chrome.tsx`, `src/app/styles/app-shell.css`, `src/app/styles/foundation.css`, AppChrome contract 2 files、親 `src/app/layout.tsx`、関連 summary / handoff |
| 対象外 | UI 実装変更、PR / Issue state、queue task state、DB、依存関係、生成物 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| repository context | `HANDOFF_2026-08-03.md`, `doc/implementation/MVP_CONTRACT.md`, `doc/technical/TARGET_ARCHITECTURE.md`, `doc/implementation/IMPLEMENTATION_STATUS.md`, `doc/testing/TEST_SCENARIOS.md` | static/runtime の証拠レベルと現行契約 |
| prior work | `summary/20260804/0016-fix-issue-91-physical-collapsed-rail-gutter-retry-20260804-7a485672-summary.md`, `summary/20260803/issues-91-triage-20260803.md` | `2ae96bd` の意図、前回の未確認境界 |
| implementation | `src/app/_components/app-chrome.tsx`, `src/app/_components/app-chrome-parts.tsx`, `src/app/layout.tsx`, `src/app/styles/app-shell.css`, `src/app/styles/foundation.css`, `src/app/globals.css` | DOM 階層、flex、containing block、cascade、import 順 |
| tests | `test/notes/app-chrome-contract.test.js`, `test/notes/app-chrome-responsive-contract.test.js` | 既存 static assertion の対象と限界 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| 対象 source / CSS / test | 変更なし | Worker の目的は原因調査・設計レビューのみ |
| `summary/20260804/0029-audit-issue-91-collapsed-rail-runtime-css-reaudit-20260804-summary.md` | 本 summary を新規作成 | 次 Worker へ調査結果と最小検証条件を引き継ぐため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | HEAD は `2ae96bd54d740ca8dd3213b1851eb5bb3f530791`。`2ae96bd` は `app-shell.css` の collapsed handle を `translateX(0)` にし、desktop media 内の rail region を `flex-basis/width: 2.75rem` に変更している。menu icon は親 commit から現行 `app-chrome.tsx:175-177` に残っている。 | `git log`, `git show 2ae96bd`, `app-chrome.tsx:154-179` |
| F-002 | fact | DOM は `shell(display:flex) -> rail-region -> handle + aside[hidden]` の次に `app-chrome-content -> main.app-main`。`aside[hidden]` は layout から消えるが、親 `rail-region` は desktop では残る。 | `app-chrome.tsx:154-236`, `app-shell.css:28-31,98-104,409-443` |
| F-003 | fact | CSS cascade は、base の collapsed `flex-basis/width: 0`（`app-shell.css:22-26`）を、同じ specificity の `@media (min-width: 901px)` 後段（`app-shell.css:416-419`）が 2.75rem へ上書きする。handle は `rail-region`（`position: sticky`）を containing block とし、collapsed 時 `right:0`, 幅/最小幅 2.75rem, `translateX(0)` なので、desktop で通常どおり適用されれば region と同じ x=0〜44px に収まる。 | `app-shell.css:10-26,43-66,409-420`; generated `.next/static/css/8eba850ff9195f5e.css` にも同じ rule を確認 |
| F-004 | fact | 通常の desktop collapsed layout の期待値は、CSS viewport `W >= 901px` で `rail-region: left=0,width=44px`、`handle: left=0,width=44px`、`app-chrome-content/main: left=44px,width=W-44px`。`app-main` の内側開始は `44px + padding-left` で、padding は 901px では約 18.02px、1200px 以上では 24px。mobile `W <= 900px` は rail/handle `display:none`、content/main は left=0 で 44px gutter を持たない。 | `app-shell.css:380-385,409-443`, `foundation.css:1-63`（global `box-sizing` は `global-reset.css`） |
| F-005 | fact | `body { overflow-x: clip; }` がある。collapsed region が 0幅のまま handle が `translateX(0)` の場合、absolute handle は containing block の左側へ `x=-44..0` となり、左端の外側が clip されるため、menu icon と操作面が実画面から消えたように見える。これは media query が適用されない状態（例: CSS viewport が 900px 超〜901px 未満、または配信 CSS が古い場合）の具体的な failure path である。 | `foundation.css:55-63`, `app-shell.css:22-26,43-66,416-419` |
| A-001 | assumption / priority P2 | ユーザーが「未修正」と見た画面の CSS viewport が 900px 以下、900〜901px の fractional width、または古い配信 CSS だった可能性がある。900px 以下なら設計上 desktop handle 自体を隠す。fractional width では `min-width:901px` と `max-width:900px` の間に media gap があり、base 0幅 + `translateX(0)` が F-005 を再現する。 | 現在の breakpoint 定義と F-005。実際の `window.innerWidth`, `matchMedia`, served stylesheet は未取得 |
| A-002 | assumption / priority P2 | physical gutter 自体は透明な `rail-region` のレイアウト幅として存在するため、背景や境界線だけを見た screenshot では「余白が増えていない」と誤認され得る。実際に main/page header が x=44 以降から始まるかは bounding box で判定すべきである。 | `rail-region` に collapsed 時の background/border はなく、`app-main` は rail の次の flex item。runtime 未確認 |
| U-001 | unknown | viewport 901 / 1280px で click 後に `rail-region`, `handle`, `app-chrome-content`, `main` が実際にどの rect / computed style になるか、`aside.hidden` が true か、handle center が hit-test 可能かは未確認。 | in-app Browser が利用不可、localhost:3000 も HTTP 接続不能 |
| U-002 | unknown | 発注者が見た画面が `2ae96bd` の served bundle か、古い preview / dev cache かは未確認。現行 source と生成済み production CSS には 2ae96bd の rule が存在するが、実 server 応答は取得できなかった。 | source / `.next/static/css` read-only 確認、`curl` failure |

### 次 Worker に渡す最小修正案

1. まず runtime 再現を行い、標準 desktop で F-004 が成立するなら source 修正を追加しない。`app-chrome.tsx` と `foundation.css` は変更対象にしない。
2. computed style で desktop collapsed region が 0px になる場合だけ、`app-shell.css` の collapsed region / desktop-mobile breakpoint の最小 CSS 修正を検討する。候補は region の物理幅指定と handle placement を同じ desktop 条件で一つの規則として保ち、mobile の `display:none` を維持すること。`flex-basis` / `width` の二重予約や `.app-main` padding 加算は再導入しない。
3. runtime が source と一致せず served CSS が古い場合は、コードではなく dev server / preview の再起動・再デプロイ・cache invalidation を対象にする。

## Static contract の不足点

- 既存 test は source/CSS の文字列 regex だけで、CSS parser による brace scope、cascade、media query の computed result を検証しない。
- `rail-region` が `44px`、handle が `44px`、content/main が `left=44px` になることを `getBoundingClientRect()` で検証しない。
- click 後の `is-rail-collapsed`、`aside.hidden`、`aria-expanded=false`、SVG の menu path、handle の `elementFromPoint()` / click 到達性を検証しない。
- 900px、901px、1280px（可能なら 900〜901px fractional）の viewport matrix、main/page-header との overlap、横 overflow を検証しない。
- `assert.doesNotMatch(/\.app-chrome-shell\.is-rail-collapsed \.app-main/)` は二重 padding selector の文字列不在しか確認せず、物理 gutter が実際に main を押し出すことを証明しない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 既存の untracked summary / image は保全。tracked source 差分なし |
| `git show 2ae96bd` / current source | PASS | 対象 commit と現行ファイルの反映を確認 |
| generated production CSS read-only check | PASS | `.next/static/css/8eba850ff9195f5e.css` に media 44px / handle 0 を確認。生成物は変更していない |
| focused contract | PASS | `node --test test/notes/app-chrome-contract.test.js test/notes/app-chrome-responsive-contract.test.js` |
| lint | PASS | `npm run lint` |
| TypeScript | PASS | `npx tsc --noEmit --pretty false --incremental false` |
| build | 既存記録 PASS / 今回未実行 | handoff / task context の PASS を参照。生成物不変更制約のため再実行しない |
| Browser runtime | BLOCKED / 未確認 | `agent.browsers.list()` が `[]`。Playwright browser binary も cache に見つからず、localhost:3000 は `curl` 接続失敗 |
| 作業後 `git status --short` | PASS | summary 1件のみ追加。対象 source/CSS/test の変更なし、既存 untracked は保全 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 標準 desktop の computed bounding box / hit-test | Browser または `npm run test:e2e` の disposable server で viewport 901 / 1280 を実測 |
| U-002 | 発注者の画面が現行 bundle か | served HTML の stylesheet URL と `getComputedStyle(region).flexBasis/width/handle.transform` |
| U-003 | fractional breakpoint が実環境で発生するか | `window.innerWidth`, `document.documentElement.clientWidth`, `matchMedia` を 900〜901px 付近で記録 |

## Next Read

次の Worker は raw log ではなく、まずこの summary と次の最小ファイルを読む。

- `summary/20260804/0029-audit-issue-91-collapsed-rail-runtime-css-reaudit-20260804-summary.md`
- `src/app/_components/app-chrome.tsx`
- `src/app/styles/app-shell.css`
- `src/app/styles/foundation.css`
- `test/notes/app-chrome-contract.test.js`
- `test/notes/app-chrome-responsive-contract.test.js`
- `playwright.config.js`
- `e2e/web-server.js`

runtime 完了条件:

- `W=901` と `W=1280` で collapsed 後 `region.width=44`, `handle.width=44`, `content.left=44`, `main.left=44`, `aside.hidden=true`。
- handle center が button に hit-test し、menu SVG が表示され、click で open に戻る。
- `W=900` では desktop rail/handle が hidden、mobile header が表示され、main left=0。
- main/page header/先頭操作領域と handle の overlap がない。必要なら computed padding と first content rect を併記する。
