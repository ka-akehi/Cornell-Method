# Worker Summary: mobile note runtime QA (2026-07-31)

## Objective

現行 MVP の `/notes/new` と `/notes/[id]`（閲覧・編集・復習）を 375px / 768px で Browser runtime / visual QA し、既存ノート復元、保存・再読込、キャンセル、overflow、復習 shell の未確認範囲を証拠付きで判定する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | `/notes/new`、`/notes/[id]` の閲覧・編集・復習、NTE020-EDIT-ALL、NTE020-OVERFLOW-375、NTE030-MOBILE-375-768、MVP-REVIEW-EDGE-001 |
| 対象ファイル / ディレクトリ | `HANDOFF_2026-07-31.md`、`doc/implementation/MVP_CONTRACT.md`、`doc/implementation/IMPLEMENTATION_STATUS.md`、`doc/testing/TEST_SCENARIOS.md`、`e2e/` の fixture 起動定義 |
| 対象外 | 製品コード、テストコード、設定、依存関係、仕様書、画像、Phase 2 の専用 review task / autosave / Undo / PDF / D&D / タグ管理 UI |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| repository instructions | `AGENTS.md` | MVP と Phase 2 の境界、作業前後 status、summary / Next Read 運用 |
| handoff | `HANDOFF_2026-07-31.md` | 既存ノート desktop edit は 1280 / 1440px のみ確認済みで、mobile edit / Browser QA が未確認であること |
| contract | `doc/implementation/MVP_CONTRACT.md` | 現行 MVP の route、明示保存、詳細内復習、Canvas / Summary の責務 |
| status | `doc/implementation/IMPLEMENTATION_STATUS.md` | static / API / Browser runtime を分離し、mobile runtime を推測で PASS にしない境界 |
| scenarios | `doc/testing/TEST_SCENARIOS.md` | NTE020 / NTE030 / MVP-REVIEW-EDGE-001 の実測条件 |
| browser skill | `control-in-app-browser/SKILL.md` | Browser backend discovery と失敗時 troubleshooting の手順 |
| runtime setup | `e2e/database-fixture.js`、`e2e/web-server.js` | isolated SQLite fixture、server bind、cleanup 対象 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260731/worker-mobile-note-runtime-20260731.md` | 本 summary のみ追加 | Browser runtime が実測不能だった事実、判定、cleanup、Next Read を残すため |

製品コード、テストコード、設定、依存関係、仕様書、画像は変更していない。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 作業前の `git status --short` は clean。branch は `develop`、HEAD は `4333011`。 | 作業開始時のコマンド結果 |
| F-002 | fact | 既存の 3000 番 runtime は HTTP 到達可能で、`GET /notes/new` と未存在 probe の `GET /api/notes` はともに 200。 | curl の実行結果 |
| F-003 | fact | isolated E2E DB を `node -e 'require("./e2e/database-fixture").prepareE2eDatabase()'` で migration 済みにした。専用 4173 番で `DATABASE_URL=file:./prisma/e2e.db PRISMA_PROVIDER=sqlite npm run dev -- --hostname 127.0.0.1 --port 4173` を試したが、`listen EPERM: operation not permitted 127.0.0.1:4173` で起動失敗。 | Next dev server の出力 |
| F-004 | fact | Browser skill の setup 後、`agent.browsers.getForUrl("http://127.0.0.1:3000/notes")` は `No browser is available`。troubleshooting に従って `agent.browsers.list()` を一度実行したが `[]`。 | Browser backend の出力 |
| F-005 | fact | 許可済み headless Playwright を試したが、既定 executable は `chromium_headless_shell-1200` が未インストール。システム Chrome は起動後に終了し、利用可能な headless shell 1228 は `FATAL ... MachPortRendezvousServer ... Permission denied (1100)` で終了。 | Playwright launch の出力 |
| F-006 | unknown | Browser session / page を生成できなかったため、console error、page error、HTTP failure の browser listener は登録できず、screenshot / DOM / pointer / touch / wheel の証拠も取得できない。 | F-004 / F-005 |
| F-007 | fact | Browser 操作を開始できず、note fixture、tag、Canvas element、保存 request は作成していない。 | 操作未開始 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | clean。ユーザー変更を戻していない |
| Browser backend discovery | BLOCKED | `agent.browsers.list()` が `[]` |
| dedicated local server | BLOCKED | 4173 bind が `listen EPERM` |
| fallback HTTP route | PARTIAL | curl の HTTP 200 のみ。Browser runtime / visual QA の PASS には繰り上げない |
| 375px `/notes/new` editor | BLOCKED | 実効 viewport、field 到達性、Cue / Canvas / Summary 操作を未取得 |
| 768px `/notes/new` editor | BLOCKED | 同上 |
| 375px existing-note edit | BLOCKED | title、note date、source、tag、Cue、Canvas、Summary、next review date の復元・保存・再読込・キャンセルを未実施 |
| 768px existing-note edit | BLOCKED | 同上 |
| 375px detail viewer / review | BLOCKED | common shell、本文初期マスク、Summary 順序、本文表示 / 再マスク、review success UI を未実施 |
| 768px detail viewer / review | BLOCKED | 同上 |
| long input / validation overflow | BLOCKED | 長い tag、長い入力値、validation error、page-wide overflow / local scroll を未実施 |
| console / page error | BLOCKED | browser listener を開始できず 0 件判定なし |
| fixture cleanup | PASS | `prisma/e2e.db`、`-journal`、`-shm`、`-wal`、`/private/tmp/cornell-qa-notes-response.txt`、`/private/tmp/cornell-qa-route-response.txt` は直列 cleanup 後すべて不存在。screenshot は未作成 |
| 作業後 `git status --short` | PARTIAL | 製品ファイルの変更なし。作業中に別 Worker runner が生成した `summary/20260731/1744-qa-canvas-scroll-wheel-20260731-eb3bd6f4-summary.md` と `summary/20260731/worker-canvas-scroll-wheel-touch-qa-20260731.md` は保持し、変更していない |

### Viewport decision

| viewport | 判定 | 根拠 |
|---|---|---|
| 375px | BLOCKED | Browser backend が空、headless Chromium が起動不能。過去の desktop / Canvas toolbar PASS や static contract から推測しない |
| 768px | BLOCKED | 同上 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 375 / 768px の既存ノート edit で全主要 field が復元され、保存後再読込・キャンセル・keyboard / touch 到達性が成立するか | Browser session の request / DOM / screenshot と操作ログ |
| U-002 | detail viewer と review の共通 shell、本文 / Summary の初期マスクと操作後の順序・反映 | 各 viewport の DOM / screenshot と review API response |
| U-003 | 長い tag / Markdown / field error で page-wide horizontal overflow がなく、Canvas のみ意図した local scroll になるか | `document.scrollWidth`、`body.scrollWidth`、対象 rail / paper の `scrollWidth` と操作前後 screenshot |
| U-004 | console error、page error、HTTP failure が 0 件か | 操作開始前から登録した Browser listeners の記録 |

## Next Read

Browser backend または sandbox 外の headless Chromium が利用可能になった次回は、次の最小ファイルだけを読む。

- `summary/20260731/worker-mobile-note-runtime-20260731.md`
- `HANDOFF_2026-07-31.md`
- `doc/testing/TEST_SCENARIOS.md`（NTE020、NTE030、MVP-REVIEW-EDGE-001）
- `e2e/database-fixture.js`
- `e2e/web-server.js`
