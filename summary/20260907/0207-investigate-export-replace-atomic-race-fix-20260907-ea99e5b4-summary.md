---
summary_type: task-summary
created_at: 2026-09-07 02:07 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-export-replace-atomic-race-fix-20260907-ea99e5b4.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-export-replace-atomic-race-fix-20260907-ea99e5b4.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-export-replace-atomic-race-fix-20260907-ea99e5b4.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | Worker が記録した変更ファイルなし | provenance manifest に記録なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-export-replace-atomic-race-fix-20260907-ea99e5b4.task.md` |
| F-002 | fact | Worker provenance manifest に変更ファイルは記録されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。コード・設定・依存関係・生成物は変更していません。

結論として、現行の Node 標準 `fs`、Rust 標準 API、既存 `libc` だけでは「検証済み inode を条件にした atomic replace（CAS）」は実現できません。

現行の race interleaving は次のとおりです。

1. destination inode A を検証。
2. 別プロセスが destination を inode B に差し替え。
3. `fs.renameSync(temporaryPath, destinationPath)` が inode B を無条件に上書き。
4. race winner の内容が失われ、`PUBLISH_RACE` も返らない。

実 filesystem probe でも、差し替え後の destination が通常 rename により export 内容へ置換されることを確認しました。

推奨方針は、後続 task で以下を実装することです。

- Replace publish を Node 側の通常 `renameSync` から native boundary へ移す。
- macOS native primitive として `renameatx_np` を調査・利用する。
- ただし `RENAME_EXCL` は「destination が存在しない場合 בלבד」の no-replace であり、expected inode CAS ではない。
- `RENAME_SWAP` も条件付き置換ではなく、race winner を一時的に交換するため採用不可。
- よって、完全な CAS が提供できない環境では Replace を安全に実行せず、`PUBLISH_RACE` または専用の `PUBLISH_UNSUPPORTED` として fail-closed する縮退案を採用する。
- new destination は既存どおり `linkSync` による no-replace を維持する。
- temporary file は必ず cleanup し、destination の race winner は unlink しない。
- directory fsync、live DB 不変条件、managed root・symlink・directory・invalid parent 検証は維持する。

却下案：

- 検証後の通常 `rename`：race winner を上書きするため不可。
- advisory lock：非協調プロセスを防げないため不可。
- `RENAME_SWAP` 後の inode 確認・rollback：一時的な上書きと競合が発生し、winner 保全を保証できないため不可。
- destination を開いた file descriptor へ直接書き込む方式：atomic replace でなく、クラッシュ時や同時読込時の破損リスクがあるため不可。

後続 coding task の対象は次のとおりです。

- `src/server/infrastructure/desktop-storage.js`
- `src-tauri/src/runtime.rs`
- `src-tauri/sidecar/launcher.cjs`
- `test/desktop/desktop-data-backup-export.test.js`
- 必要なら既存の native filesystem helper

テスト条件：

- deterministic race：検証後・publish 直前に destination を別 inode へ差し替え、`PUBLISH_RACE`、race winner の inode/bytes 維持、temporary cleanup を確認。
- 実 filesystem race：別プロセスまたは同期可能な注入点で同じ差し替えを実施し、通常 rename が winner を失わないことを確認。
- 新規 destination：競合作成時に `PUBLISH_RACE`、作成側の bytes 維持、temporary cleanup。
- 通常 Replace：CAS primitive が利用可能な環境でのみ成功し、出力 integrity、inode、directory fsync を確認。
- primitive 非対応環境：Replace を実行せず、既存 destination と temporary の cleanup を確認。

検証結果：

- `node --test test/desktop/desktop-data-backup-export.test.js`：7/7 PASS。ただし既存 Replace race test は `renameSync` の monkey-patch であり、実 filesystem semantics の証明にはなりません。
- macOS `man 2 rename`：`renamex_np`、`RENAME_EXCL`、`RENAME_SWAP` の存在を確認。
- Node v24.14.0 / darwin arm64：`fs.renameSync` と `fs.linkSync` は利用可能ですが、条件付き rename 用 API はありません。
- Rust には既存 `libc` 依存があります。新規 dependency と unsafe Rust は、native primitive を採用する場合に限り必要です。
- probe 用 disposable directory は作成後に削除済みです。
- 作業前後の `git status --short` は同一で、既存のユーザー変更のみ残っています。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260907/0207-investigate-export-replace-atomic-race-fix-20260907-ea99e5b4-summary.md` |
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

- `summary/20260907/0207-investigate-export-replace-atomic-race-fix-20260907-ea99e5b4-summary.md`
