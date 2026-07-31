---
summary_type: task-summary
created_at: 2026-07-31 JST
task_kind: worker-task
task_status: done
---

# Docs-only evidence reconciliation summary

## Objective

2026-07-31 の Canvas scroll / wheel QA、mobile note runtime QA、Postgres source reader fallback evidence を、既存の実装状況・テストシナリオ・handoffへ過去の証跡と MVP / Phase 2 境界を壊さず反映する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | runtime QA 判定、受け入れ証跡、Postgres source reader evidence、handoff の未確認事項と Next Read |
| 対象ファイル / ディレクトリ | `doc/implementation/IMPLEMENTATION_STATUS.md`、`doc/testing/TEST_SCENARIOS.md`、`HANDOFF_2026-07-31.md`、`summary/20260731/` |
| 対象外 | 製品コード、テストコード、設定、依存関係、MVP_CONTRACT.md、AGENTS.md、DB、生成物、外部 target 接続、Browser runtime の再実施 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| implementation status | `doc/implementation/IMPLEMENTATION_STATUS.md` | 2026-07-25 までの Canvas / desktop runtime subset と API・Browser の判定境界 |
| test scenarios | `doc/testing/TEST_SCENARIOS.md` | Canvas、mobile、受け入れマトリクス、Phase 2 の判定単位 |
| handoff | `HANDOFF_2026-07-31.md` | 既存の実施済み検証、未実施・残課題、Next Read |
| Canvas evidence | `summary/20260731/worker-canvas-scroll-wheel-touch-qa-20260731.md` | Browser backend `[]`、localhost / server bind blocker、scroll / drawing 未測定範囲 |
| mobile evidence | `summary/20260731/worker-mobile-note-runtime-20260731.md` | Browser backend、dedicated server、headless Chromium blocker、375 / 768px 未測定範囲 |
| Postgres evidence | `summary/20260731/worker-postgres-native-reader-fallback-20260731.md` | require / constructor failure injection、CLI fallback、read-only invariant、targetless reconcile |
| evidence recheck | `summary/20260731/1804-recheck-postgres-native-reader-fallback-evidence-20260731-d5caeaf3-summary.md` | Postgres evidence summary の完了状態と後続 read |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `doc/implementation/IMPLEMENTATION_STATUS.md` | 更新日、現在の判定、2026-07-31 の Canvas / mobile `BLOCKED` と isolated Postgres `PASS`、検証履歴を追記 | 実装状況の最新判定と過去 subset の境界を同じ文書で固定するため |
| `doc/testing/TEST_SCENARIOS.md` | 2026-07-31 の追補節と受け入れ証跡マトリクス行を追加 | 既存シナリオの判定単位を維持したまま、根拠・範囲・未確認事項を追記するため |
| `HANDOFF_2026-07-31.md` | 追加 evidence、未実施・残課題、Next Read、判定分離を更新 | 次回再開時に Browser `BLOCKED` と isolated reader `PASS`、実 target unknown を混同しないため |
| `summary/20260731/worker-docs-evidence-reconciliation-20260731.md` | 本 task の完了 summary を追加 | 変更内容・検証結果・Remaining Unknowns・Next Read を残すため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | Canvas scroll / wheel / touch handoff と scroll 中 drawing の 2026-07-31 追加 QA は `BLOCKED`。Browser backend `[]`、localhost route 到達不可、新規 server bind `EPERM` のため、viewport metrics、input event、Canvas JSON、保存・再読込を取得していない。 | `summary/20260731/worker-canvas-scroll-wheel-touch-qa-20260731.md` |
| F-002 | fact | 375 / 768px の editor、existing-note edit、viewer、review、overflow は `BLOCKED`。Browser backend `[]`、dedicated server bind `EPERM`、headless Chromium 起動制約があり、既存 route の curl 200 は Browser runtime PASS ではない。 | `summary/20260731/worker-mobile-note-runtime-20260731.md` |
| F-003 | fact | 2026-07-25 に確認済みの desktop / Canvas subset は履歴として残し、今回の Browser blocker によって削除・PASS取り消しはしていない。 | 既存3文書と 2026-07-31 追補 |
| F-004 | fact | isolated frozen SQLite fixture で require failure と constructor failure の双方から `/usr/bin/sqlite3` CLI fallback へ到達し、normal native との row digest / count、Canvas validation、source bytes / SHA-256 / WAL / SHM 不変、temporary cleanup を確認した。targetless reconcile は target config 不足で接続前に終了した。 | `summary/20260731/worker-postgres-native-reader-fallback-20260731.md` |
| U-001 | unknown | 実際の壊れた native binary / operator machine packaging が同じ failure を出すかは未確認。 | Postgres evidence summary の Remaining Unknowns |
| U-002 | unknown | 実 Postgres target との baseline / row reconcile、production / hosted readiness は未確認。 | Postgres evidence summary、今回の scope 制約 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 既存の未追跡 summary 7 件を確認し、変更せず保持 |
| `git diff --check` | PASS | docs-only diff に whitespace error なし |
| summary format check | PASS | 4つの根拠 summary を `sh tools/check-summary.sh` で確認。今回の summary も同じ形式で作成 |
| 対象範囲 | PASS | 本 Worker の変更は3つの指定証跡文書と本 Worker summary。作業後 status に別 Worker の `src/modules/notes/ui/components/list/filters.tsx` と `test/notes/list-filter-layout-contract.test.js` が現れたが、変更・改変せず保持した |
| Browser / headless runtime 再実施 | 未実施 | task 制約どおり、既存 summary の blocker を文書へ反映するだけに留めた |
| Postgres target 接続 | 未実施 | task 制約どおり。isolated evidence と実 target readiness を分離して記録 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | Canvas wheel / trackpad / touch handoff、scroll 中 drawing 干渉、375 / 768 / 1280px の Canvas metrics | Browser backend、localhost route、server bind が利用可能な環境での操作前後 metrics / Canvas JSON / request / GET |
| U-002 | 375 / 768px の editor、viewer、review、overflow、console / page error | Browser または sandbox 外で起動できる headless Chromium による各 viewport の DOM / screenshot / listener 記録 |
| U-003 | 実 native binary failure と実 Postgres target baseline / reconcile | 明示許可された operator 環境と isolated Postgres target を使う別 task |

## Next Read

次回は runtime / target が利用可能になった場合だけ、以下を最小順で読む。

- `summary/20260731/worker-docs-evidence-reconciliation-20260731.md`
- `HANDOFF_2026-07-31.md`
- `doc/implementation/IMPLEMENTATION_STATUS.md` と `doc/testing/TEST_SCENARIOS.md` の 2026-07-31 追補
- Browser 再試行時のみ `summary/20260731/worker-canvas-scroll-wheel-touch-qa-20260731.md`、`summary/20260731/worker-mobile-note-runtime-20260731.md`
- source reader / target task 時のみ `summary/20260731/worker-postgres-native-reader-fallback-20260731.md`、`scripts/postgres-migration-common.js`、`scripts/postgres-reconcile.js`
