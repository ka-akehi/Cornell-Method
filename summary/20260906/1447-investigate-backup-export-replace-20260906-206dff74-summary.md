---
summary_type: task-summary
created_at: 2026-09-06 14:47 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-backup-export-replace-20260906-206dff74.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-backup-export-replace-20260906-206dff74.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-backup-export-replace-20260906-206dff74.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | Worker が記録した変更ファイルなし | provenance manifest に記録なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-backup-export-replace-20260906-206dff74.task.md` |
| F-002 | fact | Worker provenance manifest に変更ファイルは記録されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。コード・設定・依存関係・生成物は変更していません。Worker provenance の記録対象もありません。

- 実 GUI の Replace 押下は、Computer Use / packaged GUI が利用できず未再現。
- disposable fixture と既存テストは 46 PASS / 0 FAIL。

原因は sidecar の validation です。

1. UI は保存先 dialog の `selectionId` だけを bridge 経由で送信する。[settings-modal.tsx:609](</Users/kazuya/Desktop/自己学習/Cornell-Method/src/app/_components/settings/settings-modal.tsx:609)
2. Rust の save destination 検証は既存 regular file を許可する。[runtime.rs:901](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/runtime.rs:901)
3. sidecar が Replace 後の既存ファイルを `destination-exists` / `phase=validation` で拒否する。[launcher.cjs:633](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/sidecar/launcher.cjs:633)、[launcher.cjs:1106](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/sidecar/launcher.cjs:1106)
4. sidecar を通過させても storage 層が `EXPORT_DESTINATION_EXISTS` で拒否する。[desktop-storage.js:2507](</Users/kazuya/Desktop/自己学習/Cornell-Method/src/server/infrastructure/desktop-storage.js:2507)
5. さらに現行 publish は `linkSync` の `EEXIST` を `PUBLISH_RACE` として拒否する。[desktop-storage.js:3000](</Users/kazuya/Desktop/自己学習/Cornell-Method/src/server/infrastructure/desktop-storage.js:3000)

`lifecycle.rs` は export では quiesce/restart を行わず、operation lock 後に runtime へ渡すだけなので主因ではありません。[lifecycle.rs:439](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/lifecycle.rs:439)

最小修正方針：

- renderer には引き続き path や無条件 overwrite flag を渡さない。
- `SaveDestination` の native dialog で作成された opaque selection のみを「Replace 許可済み」として内部伝播する。
- sidecar/storage は、その内部許可がある場合だけ既存 regular file を対象にする。
- symlink、directory、managed path、parent 不在、publish race は従来どおり拒否する。
- publish は競合を検出できる atomic replacement とし、意図しない競合ファイルは保持する。

必要な regression test：

- 新規保存先への export 成功。
- native SaveDestination selection で既存 regular file を Replace した export 成功。
- renderer 偽装、selection 不在、Replace 許可なしは拒否。
- symlink / directory への Replace は拒否し、対象を変更しない。
- publish 直前の競合は `PUBLISH_RACE` とし、競合ファイルと一時ファイルを保護・清掃。
- bridge が selectionId 以外の path を送信しないこと。
- disposable macOS GUI で「同名選択 → Replace → 成功」を確認。

Next Read は `runtime.rs` の selection store / sidecar request、`launcher.cjs` の validation、`desktop-storage.js` の export publish、既存の export/boundary tests です。

開始時は `Notebook.app` と `summary/20260906/` のみでしたが、終了時に別作業由来の note UI / test 変更も出現しました。これらは保持し、対象ファイルには変更がないことを確認しています。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260906/1447-investigate-backup-export-replace-20260906-206dff74-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| changed-files provenance | 完了 | explicit worker provenance manifest |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |
| U-002 | task 実行中に provenance manifest 外の workspace activity を 6 件検出した。他 Worker や並行処理の可能性があるため、この task の変更とは帰属しない。 | 必要時のみ `git status --short` と各 Worker summary を照合 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260906/1447-investigate-backup-export-replace-20260906-206dff74-summary.md`
