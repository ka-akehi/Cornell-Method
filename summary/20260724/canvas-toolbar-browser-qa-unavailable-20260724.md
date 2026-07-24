# Canvas Toolbar Browser QA 未確認

実施日: 2026-07-24（JST）
対象 commit: `46ca6ea` (`main`)
対象シナリオ: `CANVAS-TOOLBAR-STYLE-001`

## Objective

CSS 修正後の `/notes/new` Canvas 編集画面について、375 / 768 / 1280 / 1440px の実効 viewport で drawing rail の collapse、toolbar 到達性、Canvas 局所 scroll、page-wide horizontal overflow、Summary / footer への縦 scroll を Browser runtime で再検証する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象 route | `/notes/new`（必要時 `/notes/[id]`） |
| 対象 | Canvas toolbar、Canvas 本体、Summary、footer |
| 対象外 | コード、CSS、設定、依存関係、DB、API、既存 fixture の変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-23.md` | Browser QA の残課題と再開条件 |
| 既存 QA | `summary/20260722/canvas-browser-qa-partial-20260722.md` | 実効約1265pxでの旧 rail collapse と未確認範囲 |
| シナリオ | `doc/testing/TEST_SCENARIOS.md` | `CANVAS-TOOLBAR-STYLE-001` の判定条件 |
| 実装状況 | `doc/implementation/IMPLEMENTATION_STATUS.md` | Canvas Browser QA の既存判定 |
| 実装 | `src/app/styles/note-canvas-toolbar.css` | 641〜1439px の二列 media query が存在すること |
| 実装 | `src/modules/notes/ui/components/canvas/toolbar.tsx` | toolbar / drawing rail の role と aria-label |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260724/canvas-toolbar-browser-qa-unavailable-20260724.md` | Browser runtime 実施試行、未確認理由、判定表、Next Read を記録 | runtime 証跡なしで PASS に繰り上げないため |

既存の docs、source、fixture、ユーザーデータは変更していない。今回の一時 fixture は作成していないため、削除対象もない。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 作業前の worktree は clean、current branch は `main`、HEAD は `46ca6ea`。 | `git status --short`、`git branch --show-current`、`git log -1` |
| F-002 | fact | `npm run dev -- --hostname 127.0.0.1 --port 3000` は `listen EPERM` で起動できなかった。listen 中の 3000 / 3107 も確認できなかった。 | 起動コマンド出力、`lsof` |
| F-003 | fact | Browser runtime は利用できなかった。Browser backend の列挙結果は空配列だった。 | Browser setup の `agent.browsers.list()` |
| F-004 | fact | standalone Playwright は Chromium 起動時に `mach_port_rendezvous ... Permission denied` で停止した。 | Playwright launch log |
| F-005 | fact | source には 641〜1439px で `operation drawing` / `style style` / `erase history` / `paper paper` の二列 layout が定義されている。 | `src/app/styles/note-canvas-toolbar.css` |
| U-001 | unknown | 修正後の実効 viewport、drawing rail の computed / client width、全 drawing tool の pointer 到達性は未測定。 | Browser / Playwright runtime 未接続 |
| U-002 | unknown | 375 / 768 / 1280 / 1440px の keyboard / Shift+Tab、focus-visible、active / disabled / ARIA 状態は未測定。 | Browser / Playwright runtime 未接続 |
| U-003 | unknown | 1920px 用紙の local scroll、document / body の scrollWidth、Canvas 操作後の Summary / footer への縦 scroll は未測定。 | Browser / Playwright runtime 未接続 |
| U-004 | unknown | touch 操作と drawing rail / Canvas scroll の干渉は未測定。 | touch-capable runtime 未接続 |

## Runtime 判定表

| 確認項目 | 375px | 768px | 1280px | 1440px |
|---|---|---|---|---|
| 実効 viewport 記録 | 未確認 | 未確認 | 未確認 | 未確認 |
| drawing rail collapse / 全 tool pointer 到達 | 未確認 | 未確認 | 未確認 | 未確認 |
| keyboard Tab / Shift+Tab の論理順 | 未確認 | 未確認 | 未確認 | 未確認 |
| active / focus-visible / disabled / ARIA | 未確認 | 未確認 | 未確認 | 未確認 |
| page-wide horizontal overflow | 未確認 | 未確認 | 未確認 | 未確認 |
| Canvas local scroll / 1920px 用紙 | 未確認 | 未確認 | 未確認 | 未確認 |
| Canvas 操作後の Summary / footer 縦 scroll | 未確認 | 未確認 | 未確認 | 未確認 |
| touch 操作 | 未確認 | 未確認 | 未確認 | 未確認 |
| console error / warning / error alert | 未確認 | 未確認 | 未確認 | 未確認 |

`CANVAS-TOOLBAR-STYLE-001` は、2026-07-22 の既存実機記録にある `FAIL（部分実施）`（実効約1265pxで rail 約8px）を維持する。今回の修正後 runtime 証跡が得られていないため、PASS への繰り上げ、旧 FAIL の解消判定、実効幅の推測は行わない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| Browser backend | 未確認 | `agent.browsers.list()` は `[]` |
| local app startup | 失敗 | `127.0.0.1:3000` listen が `EPERM` |
| standalone Playwright | 失敗 | Chromium launch が macOS sandbox 権限エラー |
| fixture cleanup | 完了 | 今回は fixture を作成していない |
| docs/source/DB/API変更 | なし | summary のみ追加 |
| `git diff --check` | PASS | 作業後に実行、出力なし |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| R-001 | 375 / 768 / 1280 / 1440px の実効 viewport と rail width | Browser backend または listen 可能な runtime |
| R-002 | pointer / keyboard / focus / ARIA / disabled の全 toolbar 到達性 | 各 viewport の DOM 実測と操作ログ |
| R-003 | Canvas local scroll、page-wide overflow、Summary / footer 縦 scroll | `clientWidth`、`scrollWidth`、pointer 後の scroll 実測 |
| R-004 | touch の干渉 | touch-capable Browser runtime |

## Next Read

次回はまずこの summary を読み、Browser backend と local server が利用可能な環境で再試行する。

- `summary/20260724/canvas-toolbar-browser-qa-unavailable-20260724.md`
- `doc/testing/TEST_SCENARIOS.md` の `CANVAS-TOOLBAR-STYLE-001`
- `doc/implementation/IMPLEMENTATION_STATUS.md` §5.3
- `src/app/styles/note-canvas-toolbar.css`
- `src/modules/notes/ui/components/canvas/toolbar.tsx`
