---
summary_type: task-summary
created_at: 2026-08-26 02:14 JST
task_kind: worker-task
task_status: done
---

## Objective

`fix-packaged-node-runtime-resource-hierarchy-20260826-a580acf0.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/fix-packaged-node-runtime-resource-hierarchy-20260826-a580acf0.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/fix-packaged-node-runtime-resource-hierarchy-20260826-a580acf0.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/sidecar/launcher.cjs` | task 実行中に作成または更新 | `fix-packaged-node-runtime-resource-hierarchy-20260826-a580acf0.task.md` の実行結果 |
| `src-tauri/tauri.conf.json` | task 実行中に作成または更新 | `fix-packaged-node-runtime-resource-hierarchy-20260826-a580acf0.task.md` の実行結果 |
| `test/desktop/desktop-node-runtime.test.js` | task 実行中に作成または更新 | `fix-packaged-node-runtime-resource-hierarchy-20260826-a580acf0.task.md` の実行結果 |
| `test/desktop/desktop-update-recovery.test.js` | task 実行中に作成または更新 | `fix-packaged-node-runtime-resource-hierarchy-20260826-a580acf0.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/fix-packaged-node-runtime-resource-hierarchy-20260826-a580acf0.task.md` |
| F-002 | fact | task 実行中に成果物の作成または更新があった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

完了しました。

変更内容:
- Tauri の node_modules mapping を directory mapping に変更
- launcher の Prisma / Next を canonical JS entry に変更
- static contract と既存の release path test を更新
- `.bin` 用 WASM mapping は追加せず

検証結果:
- `node --test test/desktop/desktop-node-runtime.test.js`: PASS 8/8
- `node --test test/desktop/desktop-update-recovery.test.js`: PASS 14/14
- `node --check src-tauri/sidecar/launcher.cjs`: PASS
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- `git diff --check`: PASS

作業前後の未コミット変更は保持しています。`cargo tauri build`、npm build/install、packaged `.app` / `.dmg` の再検証は実施していません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/0214-fix-packaged-node-runtime-resource-hierarchy-20260826-a580acf0-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/0214-fix-packaged-node-runtime-resource-hierarchy-20260826-a580acf0-summary.md`
- `src-tauri/sidecar/launcher.cjs`
- `src-tauri/tauri.conf.json`
- `test/desktop/desktop-node-runtime.test.js`
- `test/desktop/desktop-update-recovery.test.js`
