# Desktop sidebar collapse DOM design

作成日: 2026-08-03（JST）
種別: 設計成果物（実装変更なし）
対象: `AppChrome` の desktop rail collapse、mobile navigation、ARIA、responsive 境界

## 1. 結論

推奨は **3. rail edge に専用の handle を置く案** です。

ただし、rail を compact width で残すのではなく、collapsed 時は `aside` を完全に `hidden` にし、handle だけを `aside` の外側に残します。これにより、main は rail の幅を受け取らず全面展開できます。

desktop の操作は hamburger ではなく、左右の chevron を使う「サイドバーを折りたたむ／展開する」専用の `button` とします。mobile の hamburger は、mobile header から mobile navigation overlay を開閉する別の `button` として実装します。両者は state、DOM、`aria-controls`、ref、focus 復帰先を共有しません。

この構成を採用する理由は次のとおりです。

- `floating-tooltip-mockup.png` では左 rail が常設ナビゲーションとして描かれている。rail header 内の hamburger は「ナビゲーションを開く」意味に見えやすく、常設 rail を縮める操作としては視覚的にも意味的にも弱い。
- rail の境界に handle を置けば、操作対象（rail）と操作部品の位置関係が直接伝わる。open 時は rail の右端、collapsed 時は main の左端に同じ control が残るため、再展開の入口を失わない。
- rail 全体を `hidden` にするため、collapsed 時に hidden な nav link、brand、footer がキーボード・スクリーンリーダーへ残らない。compact rail 用の icon-only ラベル、tooltip、フォーカス順を追加で設計する必要がない。
- handle は `aside` の外側に置くので、collapse 操作の直後に focus が hidden subtree に残る問題を避けられる。state が変わっても同じ `button` が存在し続ける。

## 2. 現状確認と設計上の問題

### 現行 AppChrome

現行の `src/app/_components/app-chrome.tsx` は次の構造です。

- `isRailOpen` が desktop rail の表示状態を持つ。
- `desktopRailToggle` は `aria-controls="app-chrome-rail"` と `aria-expanded={isRailOpen}` を持つ。
- rail が open のときは `app-chrome-rail-header` 内に desktop toggle を置く。
- rail が closed のときは、同じ `desktopRailToggle` を `app-chrome-mobile-header` 内に移して表示する。
- `aside#app-chrome-rail` には `hidden={!isRailOpen}` と `aria-hidden={!isRailOpen}` が付く。
- mobile hamburger は別の button だが、desktop rail が閉じた desktop 画面では mobile header 自体が表示される。

現行 CSS は `max-width: 900px` を mobile、`min-width: 901px` を desktop としている。desktop では rail open 時だけ mobile header を非表示にし、rail closed 時に mobile header が現れるため、desktop rail collapse が mobile navigation header の表示と結び付いている。これは desktop と mobile の責務を混同する主因です。

### 視覚資料

- `floating-tooltip-mockup.png`: テキスト付きの永続 rail、rail 下部の「新規ノート」、中央の広い note area が主役。desktop rail collapse の control は描かれていない。
- `doc/assets/screenshots/runtime-notes-list-1440.png` などの既存 runtime screenshot は、現行 worktree の AppChrome 変更前の横長 header を含むため、今回の新しい desktop rail DOM の完成証拠には使わない。実装後は 1280 / 1440px の新しい screenshot を取り直す。

## 3. 候補比較

| 候補 | DOM / state | 視覚・意味 | アクセシビリティ | 主な影響 | 判定 |
| --- | --- | --- | --- | --- | --- |
| 1. rail を完全 hidden、main 側に展開 button | `aside` を hidden。main の先頭または utility row に「展開」button を置く。open 時は rail 内に「折りたたむ」button を置くと DOM 上の位置が状態で変わる | main の中に独立した操作が置かれるため、ページ見出しや note UI と競合しやすい。button の位置が main content のレイアウトに依存する | `hidden` と `aria-controls` を使えば明快。open / closed で control が入れ替わるため、focus 復帰と tab 順を厳密に実装する必要がある | rail の幅を完全に解放できる。新しい desktop utility/header の設計が必要 | 次善。handle の視覚的な接続を採用できない場合の fallback |
| 2. compact width の rail を残す | `aside` は常に存在。rail body / label を compact 化し、rail 内の toggle が `aria-controls` で body を制御する | rail が常に見えるため再展開は容易。ただし現在の text nav を icon-only にする必要があり、mock の余白・ラベル設計から大きく変わる | hidden にできない nav の accessible name、tooltip、focus 順、create link の icon-only 名称が必要。`aria-expanded` の対象を aside か body か決める必要がある | main が常に数十 px〜の幅を失う。実装・QA の状態数が最も多い | 不採用。compact rail の製品要件がまだない |
| 3. rail edge の専用 handle | `aside` と handle を同じ `rail-region` の兄弟にする。`aside` は hidden、handle は常時 DOM に残す | rail の境界に chevron を置くため、対象と操作の関係が一目で分かる。hamburger の mobile 的意味を持ち込まない | handle が hidden subtree の外にある。固定 id に `aria-controls`、state に `aria-expanded` を設定できる。focus を同じ button に保持できる | rail は完全に hidden、main は全面展開。handle の 44px hit area、境界上の z-index、main content との衝突を QA する必要がある | **推奨** |

## 4. 状態モデルと responsive 境界

### state の責務

```text
viewport: (max-width: 900px) ? mobile : desktop

isRailOpen       desktop rail と desktop edge handle の状態だけを管理
isMobileNavOpen  mobile overlay と mobile hamburger の状態だけを管理
```

- desktop の `isRailOpen` と mobile の `isMobileNavOpen` は独立した boolean とする。
- `isRailOpen` を mobile hamburger の `aria-expanded` や mobile overlay の表示条件に使わない。
- `isMobileNavOpen` を desktop handle の `aria-expanded` や rail の表示条件に使わない。
- 現行どおり state は page reload で open に戻す。localStorage 永続化はこの設計の範囲に追加しない。
- `900px` 以下は mobile、`901px` 以上は desktop とし、breakpoint の gap を作らない。
- viewport が desktop から mobile へ変わるときは mobile overlay を閉じる。viewport が mobile から desktop へ変わるときは mobile overlay を閉じ、rail を open に戻す。
- resize によって現在の trigger が表示対象外になる場合だけ、次の表示対象へ focus を移す。desktop rail の open / close では handle 自体が残るため、原則同じ handle に focus を維持する。

### state と layout の関係

```text
desktop + rail open      rail-region = rail width、aside = visible、handle = rail edge
desktop + rail collapsed rail-region = 0 width、aside = hidden、handle = main left edge
mobile                   desktop rail-region / handle = hidden、mobile header = visible
mobile + overlay open    mobile overlay = visible、main/content = inert、focus = panel 内
```

`is-rail-collapsed` は handle の位置と rail-region の幅を CSS で表す補助 state として使ってよい。ただし rail を視覚的に消す唯一の仕組みにせず、`aside` の native `hidden` を必ず state から設定する。

## 5. 推奨 DOM tree（JSX 風）

### 5.1 desktop / expanded

handle は rail header の子ではなく、`aside` の兄弟として `rail-region` の先頭に置く。これにより、tab 順でも rail に入る最初の操作として collapse を見つけられ、button が hidden な `aside` の内部に入らない。

```tsx
<div className="app-chrome-shell" data-viewport="desktop">
  <div className="app-chrome-rail-region">
    <button
      id="app-chrome-rail-toggle"
      ref={desktopRailHandleRef}
      type="button"
      className="app-chrome-rail-handle"
      aria-label="サイドバーを折りたたむ"
      aria-expanded={true}
      aria-controls="app-chrome-rail"
      onClick={toggleRail}
    >
      <ChevronLeftIcon aria-hidden="true" />
    </button>

    <aside
      id="app-chrome-rail"
      className="app-chrome-rail"
      aria-label="アプリナビゲーション"
      aria-hidden={false}
      hidden={false}
    >
      <div className="app-chrome-rail-inner">
        <header className="app-chrome-sidebar-header">
          <AppChromeBrand />
        </header>

        <div className="app-chrome-sidebar-body">
          <nav aria-label="グローバルナビゲーション">
            <AppChromeNavLink />
          </nav>
        </div>

        <footer className="app-chrome-sidebar-footer">
          <AppChromeCreateLink />
        </footer>
      </div>
    </aside>
  </div>

  <div className="app-chrome-content">
    <main id="app-main-content" className="app-main">
      {children}
    </main>
  </div>
</div>
```

expanded 時の親子関係は次のとおりです。

```text
app-chrome-shell
├─ app-chrome-rail-region
│  ├─ app-chrome-rail-handle button
│  └─ aside#app-chrome-rail
│     └─ app-chrome-rail-inner
│        ├─ header.app-chrome-sidebar-header
│        │  └─ a.app-chrome-brand（brand link）
│        ├─ div.app-chrome-sidebar-body
│        │  └─ nav（global navigation）
│        └─ footer.app-chrome-sidebar-footer
│           └─ a.app-chrome-create-link
└─ app-chrome-content
   └─ main#app-main-content
```

### 5.2 desktop / collapsed

`aside` は unmount せず同じ id のまま保持し、`hidden` にする。`aria-controls` の target を state によって消さないため、control の関係が安定する。handle は `rail-region` の中に残し、rail-region 自体は幅 0 とする。

```tsx
<div className="app-chrome-shell is-rail-collapsed" data-viewport="desktop">
  <div className="app-chrome-rail-region is-collapsed">
    <button
      id="app-chrome-rail-toggle"
      ref={desktopRailHandleRef}
      type="button"
      className="app-chrome-rail-handle"
      aria-label="サイドバーを展開する"
      aria-expanded={false}
      aria-controls="app-chrome-rail"
      onClick={toggleRail}
    >
      <ChevronRightIcon aria-hidden="true" />
    </button>

    <aside
      id="app-chrome-rail"
      className="app-chrome-rail"
      aria-label="アプリナビゲーション"
      aria-hidden={true}
      hidden
    >
      {/* DOM は保持するが、hidden により layout / accessibility tree / tab order から除外 */}
    </aside>
  </div>

  <div className="app-chrome-content">
    <main id="app-main-content" className="app-main">
      {children}
    </main>
  </div>
</div>
```

collapsed 時に `aside` の子孫へ focus を残してはいけない。推奨構成では click 元の handle が `aside` の外に残るため、focus は同じ handle に保てる。state 更新後に `requestAnimationFrame(() => desktopRailHandleRef.current?.focus())` を実行してもよい。

### 5.3 mobile / closed

mobile では desktop rail と desktop handle を表示しない。mobile header の hamburger は `isMobileNavOpen` だけを操作し、desktop handle は render しても `hidden` にするか、desktop-only branch として除外する。重要なのは同じ JSX node、同じ ref、同じ `aria-controls` を使わないことです。

```tsx
<div className="app-chrome-shell" data-viewport="mobile">
  <div className="app-chrome-rail-region" hidden aria-hidden="true">
    <button
      id="app-chrome-rail-toggle"
      type="button"
      className="app-chrome-rail-handle"
      hidden
      aria-hidden="true"
      aria-expanded={false}
      aria-controls="app-chrome-rail"
      tabIndex={-1}
    >
      <ChevronRightIcon aria-hidden="true" />
    </button>
    <aside id="app-chrome-rail" hidden aria-hidden="true">
      {/* desktop-only tree */}
    </aside>
  </div>

  <div
    className="app-chrome-content"
    inert={isMobileNavOpen}
  >
    <header className="app-chrome-mobile-header">
      <AppChromeBrand />
      <button
        id="app-chrome-mobile-menu-button"
        ref={mobileMenuButtonRef}
        type="button"
        className="app-chrome-mobile-menu-button"
        aria-label={isMobileNavOpen ? "ナビゲーションを閉じる" : "ナビゲーションを開く"}
        aria-expanded={isMobileNavOpen}
        aria-controls="app-chrome-mobile-overlay"
        onClick={toggleMobileNav}
      >
        <MenuIcon aria-hidden="true" />
      </button>
    </header>

    <main id="app-main-content" className="app-main">
      {children}
    </main>
  </div>

  <div
    id="app-chrome-mobile-overlay"
    className="app-chrome-mobile-overlay"
    role={isMobileNavOpen ? "dialog" : undefined}
    aria-modal={isMobileNavOpen ? true : undefined}
    aria-labelledby="app-chrome-mobile-overlay-title"
    hidden={!isMobileNavOpen}
  >
    <button
      type="button"
      className="app-chrome-mobile-backdrop"
      aria-label="ナビゲーションを閉じる"
      onClick={closeMobileNav}
    />
    <aside
      id="app-chrome-mobile-panel"
      className="app-chrome-mobile-panel"
      aria-label="モバイルナビゲーション"
    >
      <header className="app-chrome-mobile-panel-header">
        <h2 id="app-chrome-mobile-overlay-title">ナビゲーション</h2>
        <button
          type="button"
          aria-label="ナビゲーションを閉じる"
          onClick={closeMobileNav}
        >
          <CloseIcon aria-hidden="true" />
        </button>
      </header>
      <div className="app-chrome-sidebar-body">
        <nav aria-label="グローバルナビゲーション">
          <AppChromeNavLink onNavigate={closeMobileNav} />
        </nav>
      </div>
      <footer className="app-chrome-sidebar-footer">
        <AppChromeCreateLink onNavigate={closeMobileNav} />
      </footer>
    </aside>
  </div>
</div>
```

mobile の親子関係は次のとおりです。

```text
app-chrome-shell
├─ app-chrome-rail-region（desktop-only、mobile では hidden）
├─ app-chrome-content
│  ├─ header.app-chrome-mobile-header
│  │  ├─ a.app-chrome-brand
│  │  └─ button#app-chrome-mobile-menu-button（mobile hamburger）
│  └─ main#app-main-content
└─ div#app-chrome-mobile-overlay（closed 時 hidden）
   ├─ button.app-chrome-mobile-backdrop
   └─ aside#app-chrome-mobile-panel
      ├─ header.app-chrome-mobile-panel-header
      │  ├─ h2（accessible dialog title）
      │  └─ button（mobile drawer close）
      ├─ div.app-chrome-sidebar-body
      │  └─ nav
      └─ footer.app-chrome-sidebar-footer
         └─ a.app-chrome-create-link
```

mobile overlay に `role="dialog"` / `aria-modal="true"` を付ける場合は、panel 内への focus 移動と focus trap を必ず実装する。実装しない場合は `aria-modal` を付けず、非 modal の navigation drawer として設計する。今回の body scroll lock と backdrop を維持する案では、modal drawer として focus trap を実装する方を推奨する。

## 6. ARIA、hidden、focus の契約

### control の属性

| 要素 | accessible name | `aria-expanded` | `aria-controls` | 状態・注意 |
| --- | --- | --- | --- | --- |
| desktop edge handle | open 時 `サイドバーを折りたたむ`、closed 時 `サイドバーを展開する` | `isRailOpen` | `app-chrome-rail` | hamburger ではなく chevron。`aria-pressed` は付けない |
| mobile header button | open 時 `ナビゲーションを閉じる`、closed 時 `ナビゲーションを開く` | `isMobileNavOpen` | `app-chrome-mobile-overlay` | desktop handle と別 ref / 別 state / 別 id |
| mobile backdrop | `ナビゲーションを閉じる` | なし | なし | focus trap 内の close action。装飾ではなく button として実装 |
| mobile panel close button | `ナビゲーションを閉じる` | なし | なし | panel 内の最初の focus 候補にする |
| `aside#app-chrome-rail` | `アプリナビゲーション` | なし | なし | rail の landmark。expanded/collapsed は handle が表現する |
| `nav` | `グローバルナビゲーション` | なし | なし | active route は既存どおり `aria-current="page"` |
| brand link | `Cornell Method Notebook ノート一覧へ` | なし | なし | rail open 時は sidebar header、mobile 時は mobile header の子 |

### `hidden` と `aria-hidden`

- collapsed desktop の `aside#app-chrome-rail` は `hidden` を必須とする。CSS の `display: none` だけで状態を表現しない。
- `aria-hidden={!isRailOpen}` は明示的な契約として併記してよいが、native `hidden` が accessibility tree から除外する主たる仕組みである。expanded 時は `aria-hidden="false"` か属性省略のどちらかに統一する。
- `hidden` を付ける subtree の中に focus を残さない。handle を aside の外に置くことでこの条件を構造的に満たす。
- `rail-region` は handle を含むため、collapsed 時に `aria-hidden` を付けない。region 全体を hidden にすると再展開 control まで失われる。
- mobile overlay は closed 時に `hidden` とし、open 時だけ `role="dialog"` / `aria-modal="true"` を有効にする。CSS の透明化・画面外移動だけで閉じたことにしない。
- mobile overlay open 中は background content に `inert` を付ける。`aria-hidden` を main に手動で付ける場合は、main 内に focus が残っていないことを保証する必要があるため、原則は `inert` と focus trap を使う。
- `aria-hidden="true"` を、desktop handle を含む wrapper、mobile hamburger を含む header、focus 中の main の親には付けない。

### focus 移動

1. desktop handle で collapse: handle は DOM に残るため focus は同じ handle に維持する。state 更新後に同 handle へ再 focus してもよい。hidden になった `aside` 内へ focus を移さない。
2. desktop handle で expand: 同じ handle に focus を維持し、rail 内の brand や nav へ勝手に focus を飛ばさない。利用者が次の Tab で rail content を進められる順序にする。
3. desktop → mobile resize: focus が desktop handle または hidden になる rail 内要素にある場合、mobile hamburger へ focus を移す。
4. mobile hamburger で open: trigger を記録し、panel の close button（または panel 内の最初の focusable）へ focus を移す。body scroll を lock する。
5. mobile overlay open 中: Tab / Shift+Tab は panel 内で loop させる。Escape、backdrop、panel close button、nav link の遷移で overlay を閉じる。
6. mobile overlay close: `requestAnimationFrame` 後に `mobileMenuButtonRef.current?.focus()` を実行する。
7. mobile → desktop resize: mobile overlay を閉じ、必要なら desktop handle へ focus を移す。desktop rail は open に戻す。

## 7. CSS の責務

実装時は、DOM state と CSS state の二重管理を避ける。

- `.app-chrome-rail-region` は desktop で sticky、`height: 100svh`、rail width を占有する。collapsed 時は `width: 0` / `flex-basis: 0` とし、main が全幅を使えるようにする。
- `.app-chrome-rail` は rail-region の幅を埋める。`[hidden]` は `display: none` で確実に無効化する。
- `.app-chrome-rail-handle` は rail-region の境界に absolute 配置する。open 時は rail の右端、collapsed 時は main の左端に置く。最低 44px の pointer / keyboard hit area を確保し、main の重要な操作を覆わない。
- handle は `menu` icon ではなく left/right chevron を表示する。視覚 tooltip を追加する場合も accessible name の代替にはしない。
- `.app-chrome-mobile-header`、`.app-chrome-mobile-overlay`、`.app-chrome-mobile-menu-button` は `min-width: 901px` で非表示にする。rail collapsed かどうかによって mobile header を表示しない。
- `max-width: 900px` では desktop rail-region と desktop handle を非表示にし、mobile header を表示する。mobile panel は既存の `width: min(20rem, calc(100vw - 1.5rem))` と `overflow-y: auto` の性質を維持できる。
- handle の focus ring は rail edge 上でも clip されないようにする。rail-region / aside の `overflow: hidden` は避けるか、outline が見える余白を確保する。
- mobile overlay の backdrop と panel は overlay の stacking context 内で管理し、main の note paper / canvas の z-index に勝つ。mobile で desktop handle が overlay より前に出ないことを確認する。

## 8. 現行 AppChrome からの移行差分

### `src/app/_components/app-chrome.tsx`

1. `desktopRailToggle` を共有 JSX fragment として持つ構造をやめ、`DesktopRailHandle` と `MobileNavToggle` を別 component または別 JSX として定義する。
2. `desktopMenuButtonRef` は `desktopRailHandleRef` へ役割を明確化する。mobileMenuButtonRef と共有しない。
3. `desktopRailToggle` を `app-chrome-rail-header` に置かない。rail header は brand link のみとし、handle は `app-chrome-rail-region` の兄弟にする。
4. `!isRailOpen ? desktopRailToggle : null` を mobile header から削除する。desktop rail が closed でも mobile header は desktop では表示しない。
5. `aside#app-chrome-rail` は同じ id を保持し、`hidden={!isRailOpen}` と `aria-hidden={!isRailOpen}` を適用する。handle は aside の外側に置く。
6. `isRailOpen` と `isMobileNavOpen` の resize / focus effect を分離する。breakpoint 変更時だけ、現在の viewport に合う trigger へ focus を復帰する。
7. mobile overlay に stable id、`role="dialog"`、`aria-modal`、label、panel close button、focus trap を追加する。既存の Escape、backdrop close、body overflow restore は維持する。
8. `main` は `.app-chrome-content` の子として維持し、aside の子に移さない。rail open / collapsed で `main` の landmark が増減しないようにする。

### `src/app/styles/app-shell.css`

1. `.app-chrome-rail-region` と `.app-chrome-rail-handle` の layout / position / focus ring を追加する。
2. rail width の flex responsibility を `rail-region` に移し、collapsed 時の region width 0 と main full width を定義する。
3. `app-chrome-rail-header .app-chrome-menu-button` の selector と header の grid 列を削除または sidebar header 用に整理する。collapse button を header 内に残さない。
4. `@media (min-width: 901px)` で mobile header を常に非表示にする。現行の `.app-chrome-shell:not(.is-rail-collapsed) .app-chrome-mobile-header` という条件依存を削除する。
5. `@media (max-width: 900px)` で desktop rail-region / handle を非表示にし、mobile header / overlay だけを使う。
6. `.app-chrome-mobile-overlay[hidden]`、panel、backdrop の display / stacking を idempotent にする。CSS だけで hidden state を代用しない。

### `test/notes/app-chrome-contract.test.js`

既存テストのうち、現行の「同じ `desktopRailToggle` を rail header と mobile header に条件配置する」期待値は、推奨 DOM と矛盾するため置き換える。canonical route、brand label、nav、create link、main landmark、theme token の契約は維持する。

### `test/notes/app-chrome-responsive-contract.test.js`

既存の `900px / 901px` 境界は維持する。rail-region / edge handle / mobile overlay の display・width・height・focus 関係の契約を追加する。特に「desktop rail collapsed だから mobile header を表示する」という現行条件を禁止する。

### `doc/implementation/MVP_CONTRACT.md`

今回の設計は shared shell の DOM / responsive UI であり、MVP の route、API、DB、Canvas 保存契約を変更しないため、現時点で MVP contract の API / data 節を変更する必要はない。desktop collapse を正式な UI 受け入れ条件として採用する段階では、UI 契約または testing document に breakpoint、focus、screenshot の証拠を追記する。`MVP_CONTRACT.md` が示す desktop 1280 / 1440px の runtime QA 範囲と矛盾させない。

## 9. 必要な contract test と受け入れ条件

### static contract

`app-chrome-contract.test.js` に追加・変更する項目:

- `aside#app-chrome-rail` が `aria-label="アプリナビゲーション"`、`hidden`、`aria-hidden` を持つ。
- `button#app-chrome-rail-toggle` が 1 個だけ存在し、`aria-expanded`、`aria-controls="app-chrome-rail"`、open / closed の accessible name を持つ。
- desktop handle が `app-chrome-sidebar-header` の子ではなく、`app-chrome-rail-region` 直下で aside の兄弟である。
- desktop handle と mobile hamburger が別 class、別 ref、別 `aria-controls` を持ち、desktop handle を mobile header に再利用していない。
- `main#app-main-content` が `.app-chrome-content` の子であり、aside の子ではない。
- hidden rail 内の `brand link`、nav、footer を再表示するための CSS-only / offscreen-only 実装がない。
- mobile overlay が stable id、`hidden`、`role="dialog"`、`aria-modal="true"`、accessible title を持つ（modal drawer を採用する場合）。

`app-chrome-responsive-contract.test.js` に追加・変更する項目:

- `@media (min-width: 901px)` では mobile header、mobile hamburger、mobile overlay が常に非表示である。
- `@media (max-width: 900px)` では desktop rail-region と desktop handle が非表示で、mobile header が表示される。
- expanded / collapsed で rail-region の幅が変わり、collapsed 時も handle が表示される。
- rail は `position: sticky`、`height: 100svh` を維持する。
- handle の focus-visible style と 44px 以上の hit area がある。
- mobile panel は narrow width で overflow-y scroll 可能で、backdrop が header 下から overlay を覆う。

### behavior / runtime acceptance

static regex だけでは focus と accessibility tree を証明できないため、Playwright または実ブラウザで次を確認する。

1. 1280 / 1440px の expanded desktop で、rail header は brand のみ、handle は rail の境界にある。hamburger は表示されない。
2. desktop handle をクリック / Enter / Space で collapsed にすると、aside が `hidden`、nav / footer が Tab 順と accessibility tree から消え、main が rail 分だけ広がる。
3. collapsed desktop で handle が main 左端に残り、accessible name が「サイドバーを展開する」になる。再クリックで rail が戻る。
4. collapse / expand のいずれでも focus が失われず、hidden rail 内へ focus が入らない。
5. 900px では mobile、901px では desktop として動作する。resize で desktop handle と mobile hamburger の focus 復帰先が正しい。
6. 375 / 768px では desktop rail と desktop handle が Tab で到達不能で、mobile header の hamburger だけが mobile overlay を開く。
7. mobile overlay open 時は panel の最初の control に focus、Tab trap、Escape、backdrop、close button、nav 遷移で close、close 後の hamburger focus 復帰、body overflow restore が成立する。
8. overlay open 中に main / header の背後要素へ keyboard focus が抜けず、note content の操作を誤って実行できない。
9. screen reader で desktop rail landmark、global nav、brand link、desktop collapse、mobile navigation dialog の名称が重複・混同なく読み上げられる。
10. 既存の note list、note detail、new note、backup route の main content が rail open / collapsed、mobile overlay closed / open の全状態で layout overflow や z-index 破綻を起こさない。

## 10. 実装順序

1. この設計を source of truth として AppChrome の DOM invariant と breakpoint (`900 / 901px`) を確定する。
2. `DesktopRailHandle`、`MobileNavToggle`、必要なら `MobileNavigationOverlay` を分離し、state / ref / id / accessible name を分離する。
3. rail-region、aside、sidebar header/body/nav/footer、main の親子関係を変更する。handle を aside の外へ移す。
4. CSS を rail-region 中心へ移行し、collapsed 時の `hidden` と width 0、desktop / mobile の media rule、focus ring を実装する。
5. mobile overlay の dialog semantics、close button、focus trap、resize 時の focus 復帰を実装する。
6. 2 件の既存 AppChrome contract test を新 DOM 契約へ更新し、必要なら focus / aria の focused test を追加する。
7. `node --test test/notes/app-chrome-contract.test.js test/notes/app-chrome-responsive-contract.test.js`、`npm run lint`、可能なら targeted Playwright / browser QA を実行する。
8. 1280 / 1440 / 900 / 901 / 768 / 375px の screenshot と accessibility tree を確認し、既存未コミット変更と混同しない形で報告する。

## 11. この成果物の検証範囲

- 作業開始前に `git status --short` を確認し、既存の未コミット変更は保持した。
- `src/app/_components/app-chrome.tsx`、`src/app/styles/app-shell.css`、`test/notes/app-chrome-contract.test.js`、`test/notes/app-chrome-responsive-contract.test.js`、`HANDOFF_2026-08-01.md`、`doc/implementation/MVP_CONTRACT.md` を読み、現行 state / DOM / CSS / breakpoint / contract を確認した。
- `floating-tooltip-mockup.png` と既存 runtime / common layout screenshot を目視確認した。
- 対象の既存 diff に対して `git diff --check` を実行し、空白エラーはなかった。
- 本 task ではコード、CSS、設定、依存関係、既存 test を変更していない。変更対象はこの設計成果物のみである。
