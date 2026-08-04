# UI redesign browser QA (2026-08-03)

## Objective

現在の未コミット UI redesign worktree を変更せず、AppChrome、note paper、Canvas の browser runtime／アクセシビリティ受け入れ可否を確認することを目的とした。対象 route は `/notes`、`/notes/new`、既存ノートが利用できる場合の `/notes/[id]` とし、desktop rail、900/901px breakpoint、mobile overlay、paper／Canvas overflow、floating tooltip、pointer／wheel lifecycle、Canvas 保存復元を確認対象にした。

結論は、in-app Browser が利用できなかったため runtime acceptance は保留である。runtime の PASS／FAIL は一件も断定していない。

## Environment

- 実施日: 2026-08-03（JST）
- Repository: `/Users/blp542/Desktop/自己学習/Cornell-Method`
- 作業開始時に `git status --short` を確認した。AppChrome、paper、Canvas、list、backup、test、summary、画像を含む既存の dirty worktree は保持した。
- Browser surface: `browser:control-in-app-browser` の手順で in-app Browser を選択しようとしたが、`agent.browsers.get("iab")` は `Browser is not available: iab` で失敗した。続けて `agent.browsers.list()` を一度確認し、利用可能ブラウザは `[]` だった。
- Browser tab、screenshot、accessibility tree、computed layout は取得していない。browser unavailable のため dev server も起動していない。
- 指示に従い standalone automation／Computer Use へ切り替えていない。DB write、ノート作成・削除、Canvas 保存、外部サイト検索も行っていない。
- read-only 補助検証: 対象 contract test 7 ファイルを `node --test` で実行し 23 subtests 全件 PASS、`git diff --check` も PASS。これは source-level evidence であり browser acceptance の証明ではない。

## Test Matrix

| ID | Area | Viewport / route | 操作・確認内容 | Status | Runtime evidence / selector |
| --- | --- | --- | --- | --- | --- |
| A-00 | Route bootstrap | `/notes`, `/notes/new`, `/notes/[id]` | 対象画面を開き、共通 AppChrome と note paper を目視・tree 検査 | BLOCKED | tab を取得できず未遷移 |
| A-01 | Desktop rail | 1440 / 1280px | rail open、`#app-chrome-rail-toggle` の collapse、collapsed、reopen。handle の可視範囲、hit area、focus ring、main 幅を確認 | BLOCKED | `#app-chrome-rail-toggle`, `#app-chrome-rail`, `#app-main-content` を実測できず |
| A-02 | Desktop keyboard | 1440 / 1280px | Tab、Enter、Space、collapse／reopen 後の focus と hidden rail の tab/a11y tree からの除外を確認 | BLOCKED | 実 activeElement／accessibility tree 未取得 |
| A-03 | Breakpoint resize | 901→900、900→901px | rail brand／nav／create link／edge handle、mobile button、overlay close／panel nav に focus を置いて resize。focus の一意な復帰先を確認 | BLOCKED | resize と focus 操作未実施 |
| M-01 | Mobile navigation | 768 / 375px | hamburger、dialog semantics、`inert`、body scroll lock、Tab／Shift+Tab、Escape、backdrop、close 後の focus を確認 | BLOCKED | `#app-chrome-mobile-menu-button`, `#app-chrome-mobile-overlay`, `.app-chrome-mobile-panel` 未実測 |
| P-01 | Paper layout | 1024 / 901px | long title／source／tag／Cue／Summary、30/70 grid、focus outline、document-wide overflow を確認 | BLOCKED | `.note-paper-shell`, `.note-paper-cornell-grid` の DOM／scrollWidth 未取得 |
| P-02 | Narrow paper / Canvas | 900 / 768 / 640 / 375px | detail local horizontal scroll、large Canvas page、page-local scroll と document-wide overflow、focus outline clipping を確認 | BLOCKED | `.note-canvas-viewport--scrollable`, `.note-canvas-horizontal-scroll` 未実測 |
| C-01 | Floating tooltip | narrow toolbar、画面上下左右端 | hover／keyboard focus、left clamp、top/bottom placement、window／paper scroll、resize、route/unmount cleanup を確認 | BLOCKED | `.note-canvas-toolbar-tooltip--floating` 未表示確認 |
| C-02 | Canvas input lifecycle | desktop / mobile | pointer、wheel、touch、pointercancel、tool switching を安全な fixture で確認 | NOT RUN | browser unavailable。fixture／pointer trace なし |
| C-03 | Canvas persistence | `/notes/new` または既存ノート | save／reload、page resize 後の CanvasDocumentV1 要素 geometry／points／style／text／searchText 不変性を確認 | NOT RUN | DB write を伴うため、browser と安全な fixture がない状態では未実施 |
| S-01 | Static regression guard | repository | AppChrome、Canvas scroll／toolbar、paper layout contract test と whitespace check | PASS | `node --test ...` 23/23、`git diff --check` |

## Results

- Runtime QA: `PASS 0 / FAIL 0 / BLOCKED 9 / NOT RUN 2`。Browser backend がないため、BLOCKED を PASS や FAIL に読み替えていない。
- AppChrome desktop の DOM／state／ARIA、mobile overlay の static contract は S-01 の範囲で PASS した。ただし実効 hit area、visual clipping、focus の移動、`inert`、body scroll lock、dialog tree は未確認である。
- Paper／Canvas の source-level contract は PASS した。CSS 上は paper shell の `overflow: hidden`、detail の narrow grid local scroll、Canvas の horizontal／vertical scroll container、640px 以下の page scroll 方針が存在する。しかし、長文・large page を入れた実画面の `scrollWidth`、clip、scroll chaining は測定していない。
- Floating tooltip の source-level contract は PASS した。anchor の `getBoundingClientRect()`、viewport clamp、top/bottom 判定、capture scroll／resize listener の cleanup、portal が実装されているが、実際の placement と unmount 後の残留は未確認である。
- source 上の resize focus ロジックは `isMobileNavOpen`、mobile menu button、desktop handle の focus を主に判定している。desktop rail 内の brand／nav／create link に focus がある場合を browser で確認できていないため、設計上のリスクとして扱う。

## Findings

1. **[BLOCKED] Browser backend unavailable**

   `agent.browsers.get("iab")` のエラーは `Browser is not available: iab`、`agent.browsers.list()` は空配列だった。対象 URL を開くところまで到達していない。したがって screenshot、accessibility tree、pointer hit test、activeElement、computed style の証拠はない。

2. **[BLOCKED / runtime risk] Desktop edge handle geometry**

   `src/app/styles/app-shell.css:10-26,43-62` では collapsed rail region が width 0 になり、handle は width／height 2.75rem、`right: 0`、`transform: translateX(50%)` で配置される。`src/app/_components/app-chrome.tsx:324-350` では handle は hidden な aside の外に残る。1440／1280px で可視部分、44px 相当の hit area、focus ring の viewport clipping、main との重なりを実測できなかった。これは FAIL の再現ではなく、acceptance に必要な未確認事項である。

3. **[BLOCKED / runtime risk] 901/900px resize focus**

   `src/app/_components/app-chrome.tsx:288-307` の viewport change handler は overlay open、mobile menu button、desktop handle を判定して次の trigger に focus を戻す。一方、rail の brand／nav／create link が activeElement のときの descendant 判定は source 上で確認できない。901→900、900→901 の実挙動を確認できないため、hidden rail や背後 main に focus が残る不具合とは断定しないが、最小の再現対象として残す。

4. **[BLOCKED] Mobile overlay accessibility**

   `src/app/_components/app-chrome.tsx:223-286,363-407` には Escape、Tab trap、body overflow restore、`inert`、dialog／`aria-modal`／hidden が実装されている。`src/app/styles/app-shell.css:283-312,413-434` には fixed overlay、backdrop、panel、breakpoint がある。768／375px の Tab／Shift+Tab、backdrop、close 後 focus、scroll lock の実 browser evidence はない。

5. **[BLOCKED] Paper／Canvas overflow and focus clipping**

   `src/app/styles/note-paper.css:2-17,254-284,351-440`、`note-canvas-surface.css:1-32,88-115` は local scroll と narrow layout を制御している。1024／901／900／768／640／375px で long content と large page を使った document-wide overflow、paper-local overflow、focus outline の clipping は未確認である。

6. **[BLOCKED] Floating tooltip placement and cleanup**

   `src/modules/notes/ui/components/canvas/toolbar-actions.tsx:105-199` と `src/app/styles/note-canvas-toolbar.css:436-493` は portal、viewport clamp、top/bottom placement、resize／capture scroll listener、focus-visible style を定義している。画面端、toolbar／paper scroll、resize、route unmount での追随・cleanup は未確認である。

7. **[NOT RUN] Pointer／wheel／touch and persistence**

   安全な fixture がなく、browser backend もないため pointercancel、wheel／trackpad、touch、Canvas save／reload、CanvasDocumentV1 の要素不変性、searchText の保持は実施していない。DB write や破壊的操作を行っていないこと自体は確認できるが、機能 PASS ではない。

## Verification Boundary

- 今回確認できたのは source-level contract test 23 subtests と `git diff --check` のみで、browser runtime QA の evidence level へ繰り上げていない。
- Browser 接続が利用できなかったため、`/notes`、`/notes/new`、`/notes/[id]` の実画面を一度も開いていない。dev server 起動失敗ではなく、browser surface 選択前の環境制約である。
- standalone Playwright／Computer Use への切り替え、外部サイト検索、認証回避は行っていない。
- DB、API、ノートデータ、Canvas JSON、画像、設定、依存関係、既存 source／test／summary は変更していない。変更対象は本レポートのみである（worker progress のメタデータ更新を除く）。
- 初期 dirty worktree の source／test／summary／画像差分は既存ユーザー変更として保護した。FAIL は再現していないため、修正 task を確定できる runtime finding はまだない。

## Recommendation

現時点の UI redesign は **browser runtime acceptance 保留** とする。静的 contract PASS を根拠に採用済み、追加 coding 済み、merge／push 済みとは扱わない。Browser が利用可能になったら A-01〜C-03 を先に実施し、FAIL が再現した項目だけを別の最小 coding task に切り出す。

## Next Read

Browser 復旧後の最小 read order:

1. `HANDOFF_2026-08-03.md`
2. `summary/20260803/ui-redesign-adoption-audit-20260803.md`
3. `src/app/_components/app-chrome.tsx`
4. `src/app/styles/app-shell.css`
5. `src/app/styles/note-paper.css`
6. `src/app/styles/note-canvas-editor.css`
7. `src/app/styles/note-canvas-surface.css`
8. `src/app/styles/note-canvas-toolbar.css`
9. `src/modules/notes/ui/components/canvas/toolbar-actions.tsx`
10. `test/notes/app-chrome-responsive-contract.test.js`、`test/notes/canvas-scroll-contract.test.js`、`test/notes/canvas-toolbar-responsive-contract.test.js`

追加 coding task に切り出す場合の最小単位は、(a) 901/900px の rail descendant focus 復帰、(b) desktop edge handle の実効 hit area／focus ring、(c) paper／Canvas overflow、(d) floating tooltip lifecycle をそれぞれ独立 task とし、runtime reproduction と viewport を acceptance に含めること。まとめて redesign する task にはしない。

list／backup QA の次候補は、note browser QA の後に `/notes` の long title／source／12 tags、From > To、empty／loading／error、pagination、review badge、keyboard focus を read-only で確認し、その次に `/notes/backup` の empty〜3 entries、long path、failure、repeated click、status／alert semantics を fixture または既存データだけで確認すること。backup create／retry のような write 操作は別途安全な fixture と実行許可を確認してから行う。
