---
summary_type: task-summary
created_at: 2026-08-27 07:26 JST
task_kind: worker-task
task_status: done
---

## Objective

`define-pre-error-backup-recovery-boundary-5b5e81bf.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/define-pre-error-backup-recovery-boundary-5b5e81bf.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/define-pre-error-backup-recovery-boundary-5b5e81bf.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | Worker が記録した変更ファイルなし | provenance manifest に記録なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/define-pre-error-backup-recovery-boundary-5b5e81bf.task.md` |
| F-002 | fact | Worker provenance manifest に変更ファイルは記録されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。コード・設定・依存関係・生成物は変更していません。

確認した境界：

- `configuration`
  - `DATABASE_URL` が空、`file:` 以外、query/fragment、authority、`:memory:` の場合。
  - 自動復旧は再検査・canonical path 再解決まで。DB置換は不可。
- `database`
  - SQLite missing、非 regular file、open/read、integrity、foreign key、schema、migration failure。
  - Desktop 起動時は recovery-only。通常 sidecar は起動しない。
- `storage`
  - backup directory の空値、相対 path、symlink、親の不整合、作成・読取・copy failure。
  - 保存先再検査は自動可。managed/external restore は確認後のみ。
- `unknown`
  - API は固定の `backup_unknown_failure`。raw exception は表示しない。
  - 自動 restore や再起動は不可。

経路の結論：

- `/backup`：手動バックアップ作成・一覧確認のみ。restore/recovery UI へ自動遷移しない。
- Desktop 起動 recovery：bootstrap → snapshot → recovery-only window。sidecar/通常 DB runtime は起動しない。
- Settings の Data and Backup：managed/external/pending restore、完全削除を明示操作で実行する既存経路。
- managed/external restore は現在 DB を置換するため、明示確認必須。
- `canStartEmpty` は first-run のみ true。既存利用後の空 DB 新規作成には使用しない。
- pending restore は検証済み artifact の resume のみ。自動適用しない。

推奨する後続 task 分割：

1. startup DB recovery orchestrator  
   `desktop-storage.js/.d.ts`、Rust runtime/main、snapshot・recovery-only・no-sidecar 契約。
2. diagnostic/local-log/privacy boundary  
   固定 reason code、sanitized log、diagnostic export、漏えい防止テスト。
3. recovery UI と bridge 接続  
   recovery 状態表示、診断、確認付き restore、終了/retry。
4. packaged/integration QA  
   missing/corrupt/unreadable DB、restore後再起動、sidecar、privacy artifact を検証。

未決事項：

- recovery UI を recovery-only sidecar で提供するか、Tauri native window/command にするか。推奨は recovery-only sidecar。
- `restore-unavailable` での「空DB開始」確認文言。
- diagnostic ZIP の保存先選択。
- pending restore と update pending state の優先順位。

作業前後の `git status --short` は確認済みです。既存の変更（`src/shared/http/api-error.ts`、バックアップテスト、既存 summary）は保持しています。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260827/0726-define-pre-error-backup-recovery-boundary-5b5e81bf-summary.md` |
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

- `summary/20260827/0726-define-pre-error-backup-recovery-boundary-5b5e81bf-summary.md`
