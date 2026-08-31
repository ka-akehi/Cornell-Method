---
summary_type: task-summary
created_at: 2026-08-28 12:37 JST
task_kind: worker-task
task_status: done
---

## Objective

`reconcile-packaged-build-id-conflict-20260828-c32dfbb4.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/reconcile-packaged-build-id-conflict-20260828-c32dfbb4.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/reconcile-packaged-build-id-conflict-20260828-c32dfbb4.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | Worker が記録した変更ファイルなし | provenance manifest に記録なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/reconcile-packaged-build-id-conflict-20260828-c32dfbb4.task.md` |
| F-002 | fact | Worker provenance manifest に変更ファイルは記録されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

静的照合を完了しました。

- source `.next/BUILD_ID`: `EDrKC5_Fdl3X2g1DpD5ud`（21 bytes）
- packaged resource: 同値・同一 mtime（21 bytes）
- `tauri.conf.json`: `../.next/BUILD_ID → runtime/.next/BUILD_ID`
- bundle ID: `com.cornellmethod.notebook`
- architecture: arm64
- executable SHA-256: 指定値と一致

結論:

- source / bundle の不一致、stale resource、resource mapping 差分は根拠なし。
- 両 summary の `EDrKC5_Fdl3X2g1DpD5udDMG` 記録が実 artifact と不一致。
- summary 記録誤りが最も支持されるが、生成 provenance がないため根本原因は UNKNOWN。
- BUILD_ID conflict が same-origin 403 の直接原因とは証明できない。403 の実 response / headers / WebView origin は未観測。

調査結果を [identity-conflict-static-provenance-20260828-summary.md](</Users/kazuya/Desktop/自己学習/Cornell-Method/summary/20260828/identity-conflict-static-provenance-20260828-summary.md>) に記録しました。既存の source、設定、artifact、DB、alias、summary は変更していません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260828/1237-reconcile-packaged-build-id-conflict-20260828-c32dfbb4-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| changed-files provenance | 完了 | explicit worker provenance manifest |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260828/1237-reconcile-packaged-build-id-conflict-20260828-c32dfbb4-summary.md`
