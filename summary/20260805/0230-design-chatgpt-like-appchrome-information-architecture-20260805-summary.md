---
summary_type: task-summary
created_at: 2026-08-05 02:30 JST
task_kind: design
task_status: done
---

# Modern assistant-like AppChrome information architecture design

## Objective

現行の Cornell Method Notebook の desktop AppChrome を、特定サービスのブランドや固有実装をコピーせず、現代的な assistant / workspace sidebar に共通する情報設計へ寄せるための実装仕様を固定する。現在の route / API / DB / Canvas 契約を増やさず、将来の実在する navigation、ノート履歴、分類、検索を追加できる余地だけを残す。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | desktop expanded / collapsed rail の hierarchy、density、source order、scroll boundary、state、focus、tooltip、responsive non-regression |
| 対象 source | `src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx`、`src/app/styles/app-shell.css` |
| 対象 focused contract | `test/notes/app-chrome-contract.test.js`、`test/notes/app-chrome-responsive-contract.test.js` |
| 参照 | `AGENTS.md`、`HANDOFF_2026-08-03.md`、`doc/implementation/MVP_CONTRACT.md`、`summary/20260805/0039-design-future-ready-persistent-appchrome-rail-20260805-summary.md`、`summary/20260805/0154-design-appchrome-toggle-identity-cluster-20260805-summary.md`、`summary/20260805/0208-implement-appchrome-toggle-identity-cluster-20260805-73b61849-summary.md`、現行 worktree source / CSS / tests |
| 成果物 | 本 design summary 1 ファイルのみ |
| 対象外 | `src/**`、`test/**`、`AGENTS.md`、`HANDOFF_*.md`、`doc/**`、`package.json`、lockfile、Prisma、API、Canvas、依存関係、生成物、queue state、Issue / PR state の変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| repository instructions | `AGENTS.md` | MVP / Phase 2 の境界、未コミット変更の保護、Worker / summary 運用 |
| latest handoff | `HANDOFF_2026-08-03.md` | desktop rail、mobile overlay、Issue #91、focus / runtime evidence の境界 |
| MVP authority | `doc/implementation/MVP_CONTRACT.md` | canonical route、`/backup`、API / DB / Canvas non-change boundary |
| prior design | `summary/20260805/0039-design-future-ready-persistent-appchrome-rail-20260805-summary.md` | 256 / 56 rail、same-DOM、nav-only scroll、state、tooltip、future group policy |
| prior design | `summary/20260805/0154-design-appchrome-toggle-identity-cluster-20260805-summary.md` | identity header 内 same-node toggle、56 / 100 cluster geometry、source order |
| prior implementation summary | `summary/20260805/0208-implement-appchrome-toggle-identity-cluster-20260805-73b61849-summary.md` | 直前 Worker の完了記録。current worktree source は別途 read-only 確認 |
| current source | `src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx` | desktop / mobile DOM、route item、active predicate、same-node toggle、tooltip、overlay lifecycle |
| current CSS | `src/app/styles/app-shell.css` | rail width、identity / create / nav geometry、fixed / scroll boundary、901 / 900 media rules |
| focused contract | `test/notes/app-chrome-contract.test.js`、`test/notes/app-chrome-responsive-contract.test.js` | source order、`/backup` exclusion、geometry、accessibility、mobile / breakpoint negative contract |

## Decision summary

### 推奨案

「固定 top control cluster + destination-first の nav scroll body + history-ready な空き slot」を採用する。

```text
Desktop AppChrome (>= 901px)
├─ identity header (fixed)
│  ├─ desktop product identity (non-link)
│  └─ one same-node pane toggle
├─ primary create action: /notes/new (fixed)
└─ navigation scroll region (only this region scrolls)
   ├─ primary real destinations: current は /notes のみ
   ├─ optional real secondary / utility destinations (未実装時は render しない)
   └─ optional real note history / classification items (機能実装後のみ render)
```

この案は、現在の source order と直前の identity-cluster 実装をそのまま活かしつつ、「上部は操作」「スクロール領域は移動と履歴」という役割を明確にする。現在 item が 1 件しかないことを理由に complete-hide、menu-only、collapse 廃止、常時 expanded へ変更しない。

### ChatGPT 風として採用する一般化パターン

特定サービスのロゴ、固有文言、固有の内部実装は採用しない。採用するのは次の一般的な UI / UX 原則だけである。

| 原則 | Cornell AppChrome への適用 |
|---|---|
| identity と pane control を一つの top cluster として読む | C mark / product copy と same-node toggle を同じ header に置く。toggle は brand の下に単独行で浮かせない |
| primary action は navigation と同じ優先度にせず、すぐ使える位置へ置く | `/notes/new` は nav item ではなく、identity cluster の直下にある filled action とする |
| 固定領域と履歴・destination のスクロール領域を分ける | identity / toggle / create は固定し、primary nav と将来の実在履歴だけを `app-chrome-navigation-scroll` でスクロールする |
| route navigation と content history の意味を混ぜない | canonical route は primary nav、ノート履歴は将来の別 section。現在は履歴 section を表示しない |
| collapsed は別 tree ではなく同じ sidebar の label area を閉じた state | desktop aside、toggle、create、nav link は 1 DOM tree / 1 node identity のまま。label を視覚的に隠し、target と accessible name は残す |
| current / hover / focus を別 state として表す | current は soft background + leading indicator、hover は current を消さない、focus-visible は独立した ring とする |
| 空の未来機能を見せない | empty heading、disabled link、履歴 placeholder、未実装分類、未実装検索ボタンを追加しない |
| responsive では desktop rail と mobile overlay の責務を分ける | `901px` 以上は persistent rail、`900px` 以下は current mobile header / overlay。mobile を desktop rail の縮小コピーにしない |

## Current baseline and delta

### 現行 source 事実

作業開始時の worktree には、直前 Worker の identity-cluster 実装に相当する未コミット変更が既に存在した。この Worker はそれらを戻さず、read-only の設計根拠として扱った。

現行 desktop JSX の意味上の順序は次のとおりで、推奨案の上部構造はすでに実装されている。

```text
aside#app-chrome-sidebar
└─ header.app-chrome-sidebar-identity
   ├─ AppChromeDesktopIdentity
   └─ one button#app-chrome-rail-toggle
   ├─ AppChromeCreateLink variant="desktop" -> /notes/new
   └─ div.app-chrome-navigation-scroll
      └─ AppChromeNavigation variant="desktop"
         └─ current appChromeNavItems: /notes only
```

現行 behavior は次のとおりである。

| 項目 | 現行契約 |
|---|---|
| desktop rail | expanded `256px`、collapsed `56px`、same DOM、`isRailOpen` の 2 state |
| identity | desktop は非 link の C mark + copy、collapsed は C mark のみ。mobile brand link は維持 |
| toggle | `id` / `ref` / `onClick` / `aria-controls` / state-derived `aria-expanded` / dynamic `aria-label` を持つ同一 button node。`panel-left-close` / `panel-left-open` family |
| create | `/notes/new`。desktop は top action、collapsed では icon-only + accessible name / tooltip。`/notes/new` で action が `aria-current="page"` になるが nav indicator は持たない |
| primary nav | `/notes` 1 件。`/notes` と `/notes/[id]` は active、`/notes/new` は除外 |
| `/backup` | `src/app/backup/page.tsx` と `/api/backups` は存在するが、current `appChromeNavItems` と focused test は AppChrome に `/backup` がないことを契約化している |
| desktop overflow | sidebar は `overflow:hidden`、identity / toggle / create は固定、`.app-chrome-navigation-scroll` だけが `min-height:0; flex:1; overflow-y:auto` |
| mobile | `max-width:900px` で desktop sidebar / desktop tooltip を隠し、current mobile header / overlay / focus trap / Escape / backdrop / body lock / pathname close を使う |

### 現行 UI と一般化された modern sidebar の差分

| 観点 | 現行 | redesign で固定する理解 |
|---|---|---|
| 情報階層 | identity、toggle、create、nav の順はあるが、nav item が 1 件なので下部が空に見えやすい | 空白を placeholder で埋めず、残り高さを navigation capacity と定義する。実在 destination / 履歴が増えたら同じ scroll body に自然に積む |
| top action | create は既に top cluster 直下 | `/notes/new` を navigation destination と重複させず、単独の primary action として固定 |
| route と履歴 | route nav だけ。履歴は未実装 | route nav と将来履歴を semantic section として分離する。ただし未実装 section は DOM に出さない |
| search / classification | sidebar 内にはない。`/notes` 自身が一覧検索を担う | current sidebar に重複 search を追加しない。global search / classification は機能仕様が決まった後の別 task |
| collapsed density | 56px rail、44px target、20px icon の icon-only state | target / icon / tooltip / focus の寸法を固定し、expanded と同じ source order を保つ |
| active / hover / focus | focused contract で既に state を分離 | active indicator を hover で消さず、focus ring を current / filled state と共存させる |
| desktop / mobile | 901 / 900 breakpoint と overlay が存在 | desktop rail の redesign で mobile overlay の anatomy を変更しない |

## Design options

### Option 1: fixed cluster + destination-first, history-ready scroll body（推奨）

上部に identity / toggle / create を固定し、スクロール領域の先頭に real primary destinations、後ろに将来の実在履歴・分類 section を置く案である。

| 評価軸 | 内容 |
|---|---|
| 見た目 | 上部の役割が短くまとまり、下の余白が「将来の navigation / history が増えるための scroll capacity」と読める。現在は 1 row のまま静かに保てる |
| 情報設計 | route、utility、note history を section の意味で分けられる。履歴を route nav の偽リンクとして扱わない |
| 操作性 | create は常に手前、長い list だけ scroll。collapsed でも同じ target と Tab 順を維持できる |
| 将来拡張 | 3〜7 件の primary route、real secondary、real note history を同じ scroll boundary に追加できる。空の wrapper は出さない |
| 現行 scope | CSS / JSX の hierarchy と state だけで成立。履歴、検索、分類の API / DB は追加しない |
| Issue #91 | rail の内側に target を収め、main 側の gutter / overlap を作らないため再発リスクが最小 |

### Option 2: flat action-first list

identity / toggle / create の下へ、primary route、utility、履歴をすべて同じフラットな row list として追加する案である。現在の 1 nav component に item を増やすだけで始められる。

| 評価軸 | 内容 |
|---|---|
| 見た目 | 実装は最も軽いが、route とノート履歴の役割が同じ row に見え、item 数が増えると密度の階層が失われる |
| 情報設計 | 「移動先」と「最近見たコンテンツ」が区別しにくい。分類や履歴を後付けすると ad-hoc な並びになりやすい |
| 操作性 | 短い list では単純。ただし長い履歴で primary destination が下へ押され、current route を探しにくくなる |
| 将来拡張 | list 追加は容易だが、section heading、divider、履歴の loading / empty / current item を後から再設計する必要がある |
| Issue #91 | geometry を守れば安全だが、情報量を rail 外へ逃がす理由がなく、outboard handle へ寄せる誘惑を残す |

### Option 3: history-first sidebar with global search

create の下に global search、最近のノート、分類を常設し、route navigation を下部または別 menu に置く案である。見た目の modern assistant sidebar への近さは最も強い。

| 評価軸 | 内容 |
|---|---|
| 見た目 | search と recent content が主役になり、履歴中心の現代的 sidebar になる |
| 情報設計 | 実際のノート選択、最近順、分類、検索結果、current item の semantics を新たに定義できる |
| 操作性 | ノートを頻繁に行き来する場合は便利だが、MVP にない data loading、query state、empty / error、keyboard search を必要とする |
| 将来拡張 | 履歴機能の設計としては強いが、route / API / DB / mobile mirror の別 task が必要 |
| Issue #91 | 機能追加に伴う list 高さ / scroll / focus の複雑さが増し、今回の rail redesign と混ぜると検証範囲が広がる |

### 比較結果

| 評価軸 | Option 1 | Option 2 | Option 3 |
|---|---:|---:|---:|
| current MVP を壊さない | ◎ | ◎ | × |
| route / history の意味の分離 | ◎ | △ | ◎ |
| current 1 item の低密度を安全に扱う | ◎ | ○ | △ |
| 将来の 3〜7 destination | ◎ | ○ | ○ |
| 履歴 / 分類 / 検索への拡張 | ○（real feature 後に section 追加） | △ | ◎ |
| same-DOM / 256px / 56px / Issue #91 | ◎ | ◎ | △ |
| 今すぐ実装できる scope | ◎ | ◎ | × |
| 決定 | **採用** | fallback | 別 feature task |

Option 1 を採用する。Option 2 は visual QA で section の境界が過剰に見える場合の簡素化 fallback とするが、route と履歴を同じ意味の flat list にすることは推奨しない。Option 3 は将来の履歴 / 検索機能の設計候補であり、今回の coding task には含めない。

## Recommended implementation contract

### Source order and semantic boundaries

desktop の source order は expanded / collapsed で変えず、次の順序を正本とする。

```tsx
<aside
  id="app-chrome-sidebar"
  ref={desktopSidebarRef}
  className="app-chrome-sidebar"
>
  <header className="app-chrome-sidebar-identity">
    <AppChromeDesktopIdentity />
    <button
      id={desktopRailToggleId}
      ref={desktopRailHandleRef}
      aria-controls="app-chrome-sidebar"
      aria-expanded={isRailOpen}
      aria-label={railToggleLabel}
      onClick={toggleRail}
    >
      <AppChromeIcon
        name={isRailOpen ? "panel-left-close" : "panel-left-open"}
      />
    </button>
  </header>
  <AppChromeCreateLink
    pathname={pathname}
    isCollapsed={!isRailOpen}
    variant="desktop"
  />
  <div className="app-chrome-navigation-scroll">
    <nav aria-label="グローバルナビゲーション">
      {/* current real item: /notes */}
    </nav>
    {/* future real secondary / history sections only when populated */}
  </div>
</aside>
```

実装 Worker は次を守る。

- desktop aside は 1 node、desktop toggle は 1 button node、desktop navigation は 1 shared tree とする。open / collapsed 用の hidden duplicate、別 nav component、conditional remount を作らない。
- `AppChromeDesktopIdentity` は非 link / 非 focusable の identity とする。desktop C mark / copy を `/notes` の route control に戻さない。mobile の `AppChromeBrand` link は current のまま残す。
- `/notes/new` は create action として header cluster の後に 1 回だけ置く。primary nav に同じ href を追加しない。
- current primary nav は `/notes` のみ。`/notes` と `/notes/[id]` で `aria-current="page"`、`/notes/new` では nav current を付けないという現行 predicate を維持する。
- 将来の primary route は real canonical route が決まった時だけ `appChromeNavItems` の source order に追加する。未実装 route、disabled item、空の section heading、count だけの placeholder は追加しない。
- 将来の履歴は primary nav と同じ `<nav>` の意味に詰め込まず、実データがある時だけ scroll region 内の別 semantic section とする。履歴 item は既存の `/notes/[id]` route への real link でなければならない。
- 将来の分類が route / filter のどちらなのかが決まるまでは UI を作らない。タグ master が存在することだけを理由に sidebar に分類 menu を推測追加しない。
- future search は現在の `/notes` の一覧検索を sidebar に重複させない。global search の query ownership、keyboard behavior、API / loading / empty / error が別途決まった後、create と scroll region の間の fixed action として検討する。今回の DOM には置かない。

### Current route handling

| route | sidebar の扱い | 今回の変更 |
|---|---|---|
| `/notes` | primary navigation の唯一の現行 destination。`/notes/[id]` も active に含める | visual state / density を整えるだけ。route は変更しない |
| `/notes/new` | top primary create action。nav row へ重複させない | action の filled state、accessible current、collapsed tooltip を維持 |
| `/backup` | MVP canonical route と page / API は存在するが、current AppChrome source / focused contract は sidebar 非表示を固定 | 今回は追加・削除・移動しない。`/backup` を sidebar に出すかは別 product decision とし、決まったら desktop / mobile / tests / docs を同時に更新する |

`AGENTS.md` のロードマップや古い補助資料に `/notes/backup`、共通 navigation の `/backup`、Phase 2 の backup UI が混在する場合でも、現行 MVP の canonical route は `doc/implementation/MVP_CONTRACT.md` の `/backup` を参照する。ただしこの task は route visibility の不整合を解消する task ではない。

### Exact geometry

座標は desktop viewport の左上を `(0, 0)`、root `16px`、rail border-box を基準とする。以下は current identity-cluster contract をそのまま実装正本として扱う。

| 要素 / state | top | left | width | height | 備考 |
|---|---:|---:|---:|---:|---|
| expanded sidebar | 0 | 0 | 256px | `100svh` | `16rem`、right border 1px は border-box 内、shadow なし |
| collapsed sidebar | 0 | 0 | 56px | `100svh` | `3.5rem`、追加 rail region / transparent gutter なし |
| expanded identity cluster | 0 | 0 | 255px content box | 56px | `3.5rem`、下端に divider 1 本だけ |
| expanded C mark | 12px | 12px | 32px | 32px | noninteractive |
| expanded brand copy | 10px | 56px | auto | 36px 以内 | toggle left の 8px 手前で ellipsis。button の下へ侵入しない |
| expanded toggle target | 6px | 206px | 44px | 44px | right 6px、icon 20px |
| expanded create | 64px | 6px | 244px | 44px | identity 下 8px、filled action |
| expanded nav scroll region | 116px | 0 | 255px | flex remaining | create 下 8px、top padding 4px |
| expanded first nav row | 120px | 6px | 244px | 44px | row gap 4px |
| collapsed identity cluster | 0 | 0 | 55px content box | 100px | `6.25rem`、C と toggle の間に divider を置かない |
| collapsed C mark | 8px | 12px | 32px | 32px | center x=28、noninteractive |
| collapsed toggle target | 48px | 6px | 44px | 44px | C bottom から 8px、rail 内に完全収納 |
| collapsed create | 108px | 6px | 44px | 44px | cluster 下 8px、icon-only |
| collapsed nav scroll region | 160px | 0 | 55px | flex remaining | create 下 8px、top padding 4px |
| collapsed first nav row | 164px | 6px | 44px | 44px | row gap 4px |

寸法の固定値は次のとおりである。

- rail width は expanded `16rem` / `256px`、collapsed `3.5rem` / `56px`。
- interactive target は toggle / create / nav とも `2.75rem` / `44px`、icon は `1.25rem` / `20px`。
- row gap は `0.25rem` / `4px`、target の外側 inset は `0.375rem` / `6px`。
- collapsed target の focus outline も rail 内に収まる。target を rail 外へ出す negative translate、outboard handle、second gutter は使わない。
- main の左端は flex child の sidebar width によって expanded `x=256px`、collapsed `x=56px` になる。collapsed 専用の `.app-main` padding、transparent gutter、overlay は作らない。

### Fixed region and scroll boundary

| region | 固定 / scroll | 責務 |
|---|---|---|
| `app-chrome-sidebar-identity` | fixed | C identity、brand copy、same-node toggle。expanded 56px / collapsed 100px |
| desktop `AppChromeCreateLink` | fixed | `/notes/new` の primary action。`margin-top: 0.5rem`、nav の前 |
| `app-chrome-navigation-scroll` | scroll | primary real destinations、将来の populated secondary / history。`min-height:0; flex:1 1 auto; overflow-y:auto` |
| tooltip overlay | layout 外 | `document.body` へ portal する fixed overlay。scroll port / rail の clipping に依存しない |
| main content | sidebar の隣 | rail width 以外の layout を AppChrome が予約しない |

短い desktop viewport や実在する 7 件程度の row で高さが足りない場合でも、identity、toggle、create の bounding box は変えず、scrollTop が変わるのは navigation scroll region だけとする。将来 section heading を追加する場合も、空なら render せず、heading 自体は Tab stop にしない。履歴 item が icon-only になる collapsed state では title / date を visual label として隠しても `aria-label` と tooltip を残す。

### Visual state and density contract

| control | default | hover / pressed | current / active | focus |
|---|---|---|---|---|
| identity C / copy | ink、noninteractive | なし | なし | なし |
| pane toggle | transparent、muted ink | soft warm surface、deep accent | current indicator / filled state を使わない | `2px` focus ring + `2px` offset。tooltip と共存 |
| `/notes` nav | transparent、muted ink | soft hover、current を消さない | soft background + deep ink + leading `3px × 20px` indicator | current surface と共存 |
| `/notes/new` create | deep accent fill + light text | fill を維持、軽い shadow | `/notes/new` の `aria-current` は付けるが nav indicator は付けない | fill と共存する focus ring |
| future history row | nav と区別できる低優先度の row | current item の state を消さない | real note route / selection semantics が定義された場合だけ | visible name / tooltip と共存 |

hover / pressed / focus で width、height、padding、position、transform を変えない。collapsed の icon-only controls は visible text を `aria-hidden` にし、control 自体に explicit accessible name を持たせる。expanded で visible label がある control に redundant な `aria-label` を付けない。

### Accessible name, tooltip, and Tab order

- sidebar は `aria-label="アプリナビゲーション"`、primary nav は `aria-label="グローバルナビゲーション"` を維持する。
- toggle は expanded `サイドバーを折りたたむ`、collapsed `サイドバーを展開する`。`aria-controls="app-chrome-sidebar"` と `aria-expanded` を維持する。
- collapsed create は `新規ノート`、collapsed `/notes` row は `ノート一覧` を accessible name と tooltip に使う。SVG は `aria-hidden="true"` / `focusable="false"` のままとする。
- desktop native Tab order は次のとおりとする。

  ```text
  desktop identity (no stop)
    → pane toggle
    → /notes/new create
    → /notes primary nav
    → future real primary / secondary rows in source order
    → future real history rows in source order
    → main content
  ```

- C mark、brand copy、tooltip overlay は Tab stop にしない。positive `tabIndex`、focus 用 hidden duplicate、collapsed 専用 link tree は追加しない。
- tooltip は pointer hover と keyboard `:focus-visible` で表示し、pointer leave / blur / Escape で閉じる。`position: fixed`、`pointer-events:none`、`aria-hidden="true"`、viewport edge 8px clamp、layout / `scrollWidth` 非参加を維持する。
- expanded toggle tooltip は anchor の右 8px、collapsed icon-only tooltip は rail の right edge から `left=64px` を基準に表示する。scroll region 内 item でも rail / scroll port に clip されない。

mobile は current source order を変更しない。mobile header は `AppChromeBrand → menu button`、overlay panel は `close → nav → create footer` の順を維持する。desktop の fixed / scroll redesign を mobile panel の新しい section や footerへ波及させない。

### 900 / 901 breakpoint and Issue #91 non-regression

- `@media (min-width: 901px)` は desktop same-DOM sidebar を表示し、mobile header / overlay / menu button を hidden にする。
- `@media (max-width: 900px)` は desktop sidebar / desktop tooltip を hidden にし、current mobile header / menu / overlay を表示する。`900px` は mobile、`901px` は desktop とする。
- 901→900 の viewport change で desktop aside 内（toggle、create、nav、将来 utility / history）の focus があった場合だけ、visible mobile menu button へ focus を戻す。main 内 focus は奪わない。
- 900→901 では current policy どおり overlay / body lock を解除し、mobile menu / panel 内 focus から desktop toggle へ戻す。rail は expanded に reset する。
- pathname change は mobile overlay を閉じるが、pathname effect が旧 mobile trigger へ focus を戻す処理は追加しない。
- Issue #91 対策として、collapsed rail の外側へ target を配置しない。`translateX`、negative position、透明な 44px gutter、collapsed 専用 main padding、別の rail region / handle は作らない。main left edge は常に rail width だけで決まる。

## Feature boundary: visual / IA only vs functionality required

### 今回の design / coding task で変更できる範囲

以下は既存の DOM、route、API、DB、Canvas を使い、見た目・情報設計・操作状態だけで扱える。

- identity / toggle / create の top cluster と固定順序の整理。
- expanded / collapsed の 256px / 56px、100px collapsed identity、44px target、20px icon、row gap、main left edge の維持。
- nav-only scroll boundary、active / hover / focus state、tooltip portal、accessible name。
- current `/notes` と `/notes/new` の visual hierarchy の整理。
- collapsed state で label を隠し、同じ link / button node と Tab order を維持すること。
- 901 / 900 breakpoint、mobile overlay、focus restoration、Issue #91 の negative contract を維持すること。
- current item が 1 件でも empty placeholder / fake section を出さず、navigation capacity として余白を扱うこと。

### 別途、実機能の仕様と実装が必要な範囲

| 機能 | 追加で必要な責務 | 今回の扱い |
|---|---|---|
| recent note history | notes data の取得、並び順、loading / empty / error、current note link、件数増加時の性能、mobile mirror | scroll body の将来 section slotだけ定義。UI / fetch は作らない |
| classification | tag / folder / saved view のどれを分類と呼ぶか、route / filter semantics、名称変更・削除・権限の扱い | タグが存在することを理由に sidebar menu を追加しない |
| global sidebar search | query ownership、debounce / keyboard behavior、検索対象、API response、loading / no result / error、結果 item focus | `/notes` の既存一覧検索と重複する search control は作らない |
| `/backup` navigation exposure | primary / secondary / utility の product decision、desktop / mobile source、active predicate、focused tests、docs の同時更新 | route / API は保持し、sidebar link は今回追加しない |
| unread / review count badge | source of truth、refresh / realtime policy、screen reader announcement | placeholder badge を追加しない |
| collapsed state persistence | localStorage 等の state persistence と hydration 方針 | current local state を変更しない |

現在の MVP では `Notebook`、`NotebookCanvas`、`Tag`、`NotebookTag`、`Cue` と既存 CanvasDocumentV1 / API が正本であり、sidebar redesign のために Prisma migration、API endpoint、Canvas document、searchText を変更しない。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | current worktree は AppChrome source / CSS / focused tests に未コミット差分を持つが、この task 開始時点から存在し、戻してはいない | 作業前 `git status --short` |
| F-002 | fact | current desktop source は identity header 内の same-node toggle → `/notes/new` create → `/notes` navigation scroll の順である | `app-chrome.tsx`、`app-chrome-parts.tsx` |
| F-003 | fact | current focused contract は `/backup` route / API の存在を認めつつ、AppChrome source に `/backup` / `バックアップ` がないことを assert している | `app-chrome-contract.test.js` |
| F-004 | fact | current rail geometry は expanded 256px / collapsed 56px、identity 56px / 100px、interactive target 44px、icon 20px である | `app-shell.css`、focused contract、prior design summaries |
| F-005 | fact | current mobile behavior is owned by the 900px boundary and overlay lifecycle, while desktop focus restoration checks the entire desktop sidebar ref | `app-chrome.tsx`、responsive contract |
| D-001 | design decision | Option 1 の fixed top cluster + destination-first / history-ready scroll body を採用する | 3案比較、current MVP scope、Issue #91 non-regression |
| D-002 | design decision | current production navigation は `/notes` だけ、`/notes/new` は create action、`/backup` は今回の AppChrome に追加しない | MVP contract と current focused contract の不整合を上書きしないため |
| D-003 | design decision | empty future section、placeholder、sidebar search / history / classification UI は、実機能の仕様と data source が決まるまで render しない | 現行 MVP の route / API / DB を増やさないため |
| D-004 | design decision | main left edge は rail width のみで決め、outboard handle、transparent gutter、collapsed main padding、negative transform を採用しない | Issue #91 の overlap 再発防止 |
| U-001 | unknown | exact rect、tooltip clipping、short-height nav-only scroll、900↔901 focus は static source だけでは証明できない | Browser runtime 未実施。後続 coding Worker の acceptance に移す |

## Focused test update policy for the coding Worker

今回の design-only task では test file を変更しない。次の coding Worker は対象の 2 focused contract を、実装差分に合わせて最小限更新する。

### `test/notes/app-chrome-contract.test.js`

- desktop aside が `identity header → one toggle → desktop create → navigation scroll` の source order であることを確認する。
- `id="app-chrome-sidebar"`、`id={desktopRailToggleId}`、toggle ref / handler が 1 件だけであること、duplicate navigation / hidden desktop tree / placeholder がないことを維持する。
- `/notes` が primary item 1 件、`/notes/new` が create action 1 件であることを確認し、`/backup` 非表示 assertion は今回も保持する。page / API の存在確認を AppChrome の nav contract と混ぜない。
- `16rem` / `3.5rem`、identity `3.5rem` / collapsed `6.25rem`、44px target、20px icon、create / nav scroll の fixed boundary、no outboard / no collapsed main padding を assert する。
- current active predicate、`aria-current`、collapsed accessible label / tooltip、portal fixed tooltip、focus ring、reduced-motion の contract を維持する。
- future section はまだ render しないため、空の wrapper / heading / disabled placeholder がないことを negative contract として固定する。実在 feature が追加される task でだけ positive contract を追加する。

### `test/notes/app-chrome-responsive-contract.test.js`

- desktop same-DOM sidebar と same-node toggle、expanded / collapsed の CSS state、`min-width:901px` / `max-width:900px` visibility を確認する。
- breakpoint predicate が `desktopSidebarRef.current.contains(activeElement)` を使い、header 内へ移動した toggle を含む全 desktop descendant から mobile button へ focus を戻すことを維持する。
- mobile brand / menu、overlay dialog、close / backdrop、Tab loop、Escape、body scroll lock、pathname close、main `inert` の assertions は変更しない。
- collapsed state で rail 外の handle、`translateX`、transparent gutter、`.app-main` 特例がないことを維持する。

### Browser runtime acceptance（static contract とは別）

coding Worker は可能なら 901 / 1280 / 1440px、short-height、900px の実ブラウザで次を確認する。

- expanded / collapsed の rail、identity、toggle、create、first nav row の rect が上記 geometry と一致する。
- 7 件以上の real-shaped fixture で scrollTop が nav region だけに生じ、identity / toggle / create / main left edge が動かない。
- collapsed target と focus ring が 56px rail 内に収まり、main と重ならない。tooltip は rail / scroll port に clip されず、表示前後で `scrollWidth` を変えない。
- `/notes`、`/notes/[id]`、`/notes/new` の active / create state が相互に壊れない。`/backup` は今回の AppChrome nav には出ない。
- 900↔901 の focus restoration、mobile overlay の Escape / backdrop / Tab / body lock / pathname close が current behavior と同じである。

## MVP / route / API / DB / Canvas non-change contract

この design と次の coding taskで、次を変更しない。

- `/notes`、`/notes/new`、`/notes/[id]`、`/backup` の canonical route definition。
- Notes / backup API、Prisma model / migration、SQLite data、Tag / Cue relation。
- CanvasDocumentV1、用紙寸法、Canvas element geometry / style / `searchText`。
- mobile overlay の route behavior、review mode、明示保存、削除、backup 操作。
- 外部依存関係、foundation token の意味、既存の 256px / 56px rail、same-DOM、same-node toggle。

`/backup` の sidebar visibility だけは現行 source / focused contract と MVP 文書の common-navigation 記載に不整合があるため、今回の design ではその決定を上書きしない。追加する場合は別 task で product decision を行い、desktop / mobile / source array / active predicate / tests / documents を一緒に変更する。

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260805/0230-design-chatgpt-like-appchrome-information-architecture-20260805-summary.md` | 現行との差分、一般化した modern sidebar 原則、3案比較、Option 1 の source order / geometry / scroll / accessibility / responsive / focused test / feature boundary を固定 | 実装 Worker が追加質問なしで AppChrome coding task に移行できる設計正本を残すため |

source、tests、設定、依存関係、route、API、DB、Canvas、生成物、既存 summary、queue state は変更していない。作業前から存在した AppChrome 5 tracked files の staged / unstaged 差分、`floating-tooltip-mockup.png`、既存 untracked summary は保持した。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | AppChrome source / focused tests の既存 staged / unstaged 差分と既存 untracked files を確認。復元・削除・stage変更なし |
| latest handoff / prior summaries | PASS | `HANDOFF_2026-08-03.md`、`0039`、`0154`、`0208` を確認 |
| current source / CSS / focused tests | PASS | DOM、same-node、geometry、route exclusion、900 / 901 breakpoint、mobile overlay、Issue #91 negative contract を read-only確認 |
| `AGENTS.md` / `MVP_CONTRACT.md` | PASS | 現行 MVP route、`/backup` canonical route、API / DB / Canvas non-change boundary を確認 |
| code / test / config / dependency changes | NOT CHANGED | design-only task |
| Browser runtime | NOT RUN | 本 task は仕様詰め。geometry / focus / tooltip は後続 coding Worker の runtime acceptance とする |
| 作業後 `git status --short` | 要確認 | summary 作成後に実行し、summary 1ファイル以外の差分が増えていないことを確認する |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 現行 identity-cluster の実ブラウザ bounding box / transition / visual density | 901 / 1280 / 1440px の Browser computed rect と screenshot |
| U-002 | short-height で future-shaped rows が nav-only scroll になる実挙動 | 7 row 以上の runtime fixture、scrollTop 前後の rect |
| U-003 | collapsed tooltip / focus ring の clipping と Issue #91 overlap 非再発 | pointer / keyboard runtime QA、`elementFromPoint` / `scrollWidth` 確認 |
| U-004 | `/backup` を AppChrome common navigation に公開する最終 product authority | 発注者 / Manager の別 decision。決まるまで current no-link assertion を保持 |
| U-005 | note history / classification / global search の実仕様 | API / data source、route semantics、mobile behavior、loading / empty / error の別 design task |

## Next Read

次の AppChrome coding Worker は次の最小順で読む。raw log や `.next` 生成物は読まない。

1. `summary/20260805/0230-design-chatgpt-like-appchrome-information-architecture-20260805-summary.md`
2. `src/app/_components/app-chrome.tsx`
3. `src/app/_components/app-chrome-parts.tsx`
4. `src/app/styles/app-shell.css`
5. `test/notes/app-chrome-contract.test.js`
6. `test/notes/app-chrome-responsive-contract.test.js`

history / classification / search の機能 task は、上記に加えて `doc/implementation/MVP_CONTRACT.md`、notes / tags の API 設計、mobile overlay の current contract を読み、API / DB / route scope を別途決める。

## Next coding task boundary

### 直後に切り出す AppChrome coding task

`src/app/_components/app-chrome.tsx`、`src/app/_components/app-chrome-parts.tsx`、`src/app/styles/app-shell.css` と 2 focused contract だけを対象に、Option 1 の current implementation contract を実装・検証する。current production item は `/notes` のみ、create は `/notes/new` のみとし、`/backup`、history、classification、global search、badge、API / DB は触らない。

実装内容は identity-cluster source order、fixed / scroll boundary、256 / 56 geometry、same-node toggle、collapsed tooltip / accessible name、active / hover / focus states、900 / 901 mobile non-regression のみに限定する。実装後に focused tests、lint / typecheck 等の適切な静的検証と、可能なら Browser runtime acceptance を実施する。

### 別の後続 task に分けるもの

1. `/backup` を sidebar に出すかどうかの product decision と route visibility 整合。
2. recent note history の data source、loading / empty / error、current selection、desktop / mobile UI。
3. classification / saved views / tags の sidebar semantics。
4. global search の query / API / keyboard / result focus。

これらを AppChrome visual polish task に混ぜない。
