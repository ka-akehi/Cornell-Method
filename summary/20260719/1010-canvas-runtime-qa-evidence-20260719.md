---
summary_type: task-evidence
created_at: 2026-07-19
task_kind: canvas-runtime-qa-evidence
task_status: blocked
---

## Objective

Canvas runtime QA の実機結果を再現可能な短い matrix に固定する。実機環境が利用できない場合は、静的確認を runtime PASS に繰り上げず、blocker とともに BLOCKED と記録する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象 route | `/notes/new`、保存後の `/notes/[id]` |
| 対象 | Canvas pointer、用紙サイズ、保存・再読込、scroll、responsive / accessibility |
| 対象外 | 実装変更、Phase 2 の autosave / soft delete / 専用復習 task、raw log の転載 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-19.md` | Canvas の静的実装範囲と runtime 未確認境界 |
| contract | `doc/implementation/MVP_CONTRACT.md` | Canvas page / element geometry / 保存契約 |
| status | `doc/implementation/IMPLEMENTATION_STATUS.md` | 静的確認と runtime QA を分離する判定基準 |
| task | `codex-queue/tasks/done/canvas-runtime-qa-20260719-04f934a8.task.md` | 前回 QA の観点と完了条件 |
| prior summary | `summary/20260719/0935-canvas-runtime-qa-20260719-04f934a8-summary.md` | 前回実行の blocker と未固定事項 |
| source | `src/app/notes/_components/note-canvas-editor.tsx`, `note-canvas-toolbar.tsx`, `note-canvas-viewer.tsx` | 対象 UI の実装入口 |
| source | `src/app/spikes/canvas/_lib/fabric-adapter.ts`, `src/shared/canvas/canvas-document.ts` | Fabric 変換と document 契約の実装入口 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | `npm run dev` は `0.0.0.0:3000` で `listen EPERM` により起動できなかった。 | 実行結果 |
| F-002 | fact | `npm run dev -- --hostname 127.0.0.1 --port 3000` も `listen EPERM` により起動できなかった。 | 実行結果 |
| F-003 | fact | Browser 接続を試みたが利用可能な browser がなく、`agent.browsers.list()` は `[]` だった。 | Browser skill の接続・一覧確認 |
| F-004 | fact | route、viewport、fixture、保存 ID は取得できず、pointer / wheel / touch / save / reload は未実施である。 | F-001〜F-003 |
| A-001 | assumption | この環境 blocker が解消されるまで、コード上の実装存在や過去の静的 PASS は runtime PASS の根拠にしない。 | `HANDOFF_2026-07-19.md` §2.3、`doc/implementation/IMPLEMENTATION_STATUS.md` |
| U-001 | unknown | 実機での Canvas 操作、保存・再読込、検索、scroll、各 viewport の到達性と表示状態。 | browser / server 未接続 |

## Verification

### Environment attempt

| 試行 | 対象 | 実結果 | 判定 |
|---|---|---|---|
| 1 | `npm run dev` | `listen EPERM` on `0.0.0.0:3000` | BLOCKED |
| 2 | `npm run dev -- --hostname 127.0.0.1 --port 3000` | `listen EPERM` on `127.0.0.1:3000` | BLOCKED |
| 3 | Browser for `http://127.0.0.1:3000/notes/new` | browser unavailable; available list `[]` | BLOCKED |

### Runtime QA matrix

環境 blocker のため、以下はすべて実機未実施で BLOCKED。静的コード確認は実結果として扱わない。

| # | route | viewport | fixture | 操作 | 期待結果 | 実結果 | 判定 |
|---|---|---|---|---|---|---|---|
| 1 | `/notes/new` | 未取得 | 新規ノート想定 | 初期 Canvas を開き page 寸法を確認 | Canvas が表示され既定 1200 x 800 | route に到達できず未確認 | BLOCKED |
| 2 | `/notes/new` | 未取得 | 新規ノート想定 | 空白から pen / line / arrow / rect / ellipse / text を各 1 回作成 | 6 種の object が作成される | Browser / server 未接続で未実施 | BLOCKED |
| 3 | `/notes/new` | 未取得 | #2 の object 想定 | 既存 object 上から pen / line / arrow / shape を開始 | 余計な object / 線を作らない | fixture を作れず未実施 | BLOCKED |
| 4 | `/notes/new` → `/notes/[id]` | 未取得 | 保存 ID 未取得 | select で line / arrow / shape / text を移動・resize | 表示位置と page 座標が保たれる | 保存 ID・実機状態を取得できず未実施 | BLOCKED |
| 5 | `/notes/new` | 未取得 | #2 の object 想定 | 消しゴムを click / drag、Undo / Redo を確認 | object 全体を 1 gesture 1 history で処理し partial erase しない | fixture を作れず未実施 | BLOCKED |
| 6 | `/notes/new` → `/notes/[id]` → reload / `/notes` | 未取得 | 保存 ID 未取得 | 1920 x 1080 を適用し保存・再読込後に geometry と text 検索を確認 | page 寸法だけ変わり要素 geometry / search text を保持 | server 未起動のため保存・再読込・検索未実施 | BLOCKED |
| 7 | `/notes/new` | 未取得 | 用紙 1920 x 1080 想定 | Canvas 上で wheel / trackpad / touch scroll | ページ縦 scroll は Summary / footer まで通り、広い用紙だけ局所横 scroll | browser 未接続で未実施 | BLOCKED |
| 8 | `/notes/new`、`/notes/[id]` | 375 / 768 / 1280 / 1440px（未取得） | 新規 / 保存済み想定 | toolbar group、active state、focus ring、tooltip / accessible description、drawing rail、用紙入力へ到達 | 各 viewport で対象 UI が到達可能で意図しない overflow がない | viewport を設定できず未実施 | BLOCKED |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260719/1010-canvas-runtime-qa-evidence-20260719.md` | 本 evidence summary を新規作成 | runtime QA の blocker と 8 項目の判定を固定 |
| `src/`、`prisma/`、`package.json`、lockfile、DB、API、設定、テスト、`doc/`、画像、生成物 | 変更なし | task 制約 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 8 項目すべての runtime 結果 | local Next server と Browser が利用可能な環境での再実行 |
| U-002 | 保存・再読込後の実データと Canvas text 検索 | fixture または許可された QA 用ノートの保存 ID |

## Next Read

次回はこの evidence summary を起点にし、環境 blocker 解消後に同じ 8 項目を再実行する。

- `summary/20260719/1010-canvas-runtime-qa-evidence-20260719.md`
- `HANDOFF_2026-07-19.md` §7.1
