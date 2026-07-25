---
summary_type: qa-summary
created_at: 2026-07-25 23:25 JST
task_kind: manager-fallback-qa
task_status: completed
---

## Objective

Worker の Browser binding 制約で失敗した MVP 操作デモ task を補完し、一覧 → 詳細 → 編集 → 保存 → 閲覧 / 再読込の実操作を再生可能な WebM として記録した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象 route | `/notes`、`/notes/[id]` |
| 操作 | 一覧検索、詳細表示、編集切替、title 変更、保存、閲覧表示、再読込 |
| viewport | 1280 × 900 |
| artifact | `doc/assets/demos/mvp-note-flow.webm` |
| 対象外 | Phase 2、mobile 専用 QA、exact 4px、wheel/trackpad |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 受入条件 | `AGENTS.md` §9 | 動画または GIF の要求 |
| 受入材料 | `README.md` | 既存 screenshot とデモ記載位置 |
| 契約 | `doc/implementation/MVP_CONTRACT.md` | MVP の route / 保存範囲 |
| Worker summary | `summary/20260725/2319-create-mvp-flow-demo-20260725-1b76682b-summary.md` | Worker failure が Browser binding 起因であること |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `doc/assets/demos/mvp-note-flow.webm` | 実操作 recording を生成 | AGENTS.md §9 の MVP 受入材料 |
| `src/**`、設定、依存関係、DB schema | 変更なし | closeout artifact のみ |
| 一時 QA fixture | 作成後に DELETE し、GET 404 / 検索残留 0 件を確認 | ユーザーデータを残さないため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | WebM artifact は生成済みで、サイズは 524,711 bytes。 | Manager fallback Playwright recording |
| F-002 | fact | recording には `/notes` の一覧検索、詳細表示、編集切替、title の変更、保存後の閲覧、再読込後の値維持を含めた。 | recording script の操作と runtime assertion |
| F-003 | fact | 一時ノート cleanup は DELETE `204`、削除後 GET `404`、title query の `totalCount=0`。 | runtime assertion |
| F-004 | fact | console error / page error は 0 件。 | runtime diagnostics |
| U-001 | unknown | WebM の GUI 視覚確認は再生環境の都合で未実施。ただし Playwright の recording 完了と artifact の存在・サイズは確認済み。 | `doc/assets/demos/mvp-note-flow.webm` |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| WebM 生成 | PASS | `doc/assets/demos/mvp-note-flow.webm`、524,711 bytes |
| 主要操作フロー | PASS | 一覧 → 詳細 → 編集 → 保存 → 閲覧 / 再読込 |
| fixture cleanup | PASS | DELETE 204、GET 404、検索残留 0 件 |
| console / page error | PASS | いずれも 0 |
| source / config / dependency change | なし | closeout artifact のみ |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | WebM を人手で再生した視覚確認 | 必要な場合のみ対応する動画プレイヤーで確認 |

## Next Read

- `summary/20260725/2325-mvp-flow-demo-manager-fallback-20260725.md`
- `doc/assets/demos/mvp-note-flow.webm`
- `README.md`
- `AGENTS.md` §9
