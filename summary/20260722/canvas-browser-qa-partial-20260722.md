# Canvas Browser QA 部分実施

実施日: 2026-07-22（JST）  
役割: Manager  
対象: `http://localhost:3000` の Canvas runtime QA 継続

## Objective

`HANDOFF_2026-07-22.md` と直近 task summary を起点に、未実施だった Canvas 7 シナリオの Browser runtime 証跡を増やし、静的 / API runtime と分離して判定する。

## Scope

- Browser runtime QA と証跡記録のみ。
- Canvas 実装、CSS、API、Prisma schema は変更しない。
- 7 シナリオを部分実施し、未確認項目を PASS に繰り上げない。

### Fixture

- title: `Canvas Browser QA 2026-07-22 2030`
- id: `cmrvzkjpa0000mtrm7pgwm1xb`
- route: `/notes/cmrvzkjpa0000mtrm7pgwm1xb`
- page: 1200x800 で作成開始、1920x1080 へ変更して保存
- elements: stroke 1、line 1、arrow 1、rect 2、ellipse 1、standalone text 1
- text: rect `四角QA`、standalone `QA検索語 Canvas`
- retention: 未完了シナリオの後続 QA fixture として DB に保持

rect が 2 件あるのは、ellipse tool へ移る最初の click が狭い drawing rail の clip 外に入り、active rect tool のまま 1 件作成したためである。保存 JSON の余分な rect はこの操作と対応し、3px no-op の失敗とは判定しない。

## Inputs Read

- `HANDOFF_2026-07-22.md`
- `summary/20260722/1928-sync-post-strict-primary-doc-references-20260722-d5078d9e-summary.md`
- `doc/testing/TEST_SCENARIOS.md`
- `doc/implementation/IMPLEMENTATION_STATUS.md`
- Browser QA に必要な Canvas editor / runtime / toolbar の現行 source

## Changes Made

- `doc/implementation/IMPLEMENTATION_STATUS.md` に Browser runtime の部分実施と responsive FAIL を追記。
- `doc/testing/TEST_SCENARIOS.md` に fixture、操作、部分判定、残りを追記。
- 本 summary を作成。
- QA fixture を後続操作用に SQLite DB へ保持。

## Findings

### Runtime Results

| 範囲 | 結果 |
| --- | --- |
| 基本描画 | pen / line / arrow / rect / ellipse / standalone text を空白から作成 |
| gesture | line / arrow / rect / ellipse で click、3px drag、5px 超 drag を実行。保存 JSON で確定要素を照合 |
| shape inline text | rect に `四角QA` を確定、ellipse の `取消QA` を Escape でキャンセル。console error / warn なし |
| style | standalone `fontSize=96`, `textAlign=right`、rect `textStyle.fontSize=32`, `textAlign=left` を保存・再読込。文字サイズ 7 / 12.5 は既存値維持で拒否 |
| persistence | 1920x1080 を明示保存し、detail viewer、再編集、GET JSONで page / elements / style / textStyle / text を復元 |
| search | `QA検索語 Canvas` で一覧検索し fixture 1 件が一致 |
| review date | 2026-07-22 の新規ノートで 2026-07-29 を初期表示・保存・詳細表示 |
| horizontal scroll | 実効1425pxで1920px用紙は局所 scroll、document / body の横 overflowなし |
| console | error / warn 0 |

### Defect

`CANVAS-TOOLBAR-STYLE-001` の responsive 条件で FAIL を確認した。

- 1280px requested（実効約1265px）では drawing rail の client width が約8px、border box が約10pxまで縮む。
- DOM 上に描画 tool は存在するが rail に clip され、pointer での tool 選択が実質できない。
- 1440px requested（実効1425px）では rail client width 68pxとなり、局所横 scrollで各 toolを選択できた。
- 実装修正は行っていない。toolbar layout / flex sizing に限定した一目的 task が必要。

## Verification

- `GET /api/notes/cmrvzkjpa0000mtrm7pgwm1xb` で page 1920x1080、7 elements、standalone `style`、shape `textStyle` を確認。
- `/notes/cmrvzkjpa0000mtrm7pgwm1xb` の viewer と再編集で page / text / style を確認。
- `/notes?query=QA検索語 Canvas` で fixture 1 件を確認。
- Browser console error / warn 0。
- `git diff --check` exit 0。
- `tools/check-summary.sh` は必須見出しを揃えた後に再実行する。

## Remaining Unknowns

- 既存6要素上の全重ね描きと不変比較
- preview / inline overlay / unknown metadata の gesture 遮断
- double-click no-op、厳密な4px境界
- 消しゴム、Undo / Redo
- 線幅、色、全font size境界、全alignment組合せ
- 320 / 4000 / 範囲外寸法、page外要素
- 375 / 768px、touch、全keyboard / focus経路
- wheel / trackpad の縦scrollとCanvas操作の干渉

Browser viewport override は1440pxから縮小方向へ反映されず、375 / 768pxは今回判定していない。

## Next Read

1. 本 summary
2. `doc/testing/TEST_SCENARIOS.md` の「Canvas runtime QA 追補（2026-07-22）」
3. `doc/implementation/IMPLEMENTATION_STATUS.md` §5.3
4. `src/app/styles/note-canvas-toolbar.css`
5. `src/modules/notes/ui/components/note-canvas-toolbar.tsx`

## Recommended Next Task

まず `CANVAS-TOOLBAR-STYLE-001` の drawing rail collapse を一目的 task として修正し、375 / 768 / 1280 / 1440px を再検証する。その後、同じ fixture で overlap、eraser、Undo / Redo、残り style / dimension 境界を続ける。
