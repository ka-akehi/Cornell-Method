---
summary_type: task-summary
created_at: 2026-08-26 02:42 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-tauri-resource-bundle-file-exists-20260826-c59c5540.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-tauri-resource-bundle-file-exists-20260826-c59c5540.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-tauri-resource-bundle-file-exists-20260826-c59c5540.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/Cargo.toml` | task 実行中に作成または更新 | `investigate-tauri-resource-bundle-file-exists-20260826-c59c5540.task.md` の実行結果 |
| `src-tauri/target/debug/.fingerprint/cornell-method-notebook-36f1ef0ab80afd96/test-bin-cornell-method-notebook` | task 実行中に作成または更新 | `investigate-tauri-resource-bundle-file-exists-20260826-c59c5540.task.md` の実行結果 |
| `src-tauri/target/debug/.fingerprint/cornell-method-notebook-8e2cfbb59ba7ebde/run-build-script-build-script-build` | task 実行中に作成または更新 | `investigate-tauri-resource-bundle-file-exists-20260826-c59c5540.task.md` の実行結果 |
| `src-tauri/target/debug/.fingerprint/cornell-method-notebook-d69a810deaab04b8/bin-cornell-method-notebook` | task 実行中に作成または更新 | `investigate-tauri-resource-bundle-file-exists-20260826-c59c5540.task.md` の実行結果 |
| `src-tauri/target/debug/build/cornell-method-notebook-8e2cfbb59ba7ebde/invoked.timestamp` | task 実行中に作成または更新 | `investigate-tauri-resource-bundle-file-exists-20260826-c59c5540.task.md` の実行結果 |
| `src-tauri/target/debug/build/cornell-method-notebook-8e2cfbb59ba7ebde/out/__global-api-script.js` | task 実行中に作成または更新 | `investigate-tauri-resource-bundle-file-exists-20260826-c59c5540.task.md` の実行結果 |
| `src-tauri/target/debug/build/cornell-method-notebook-8e2cfbb59ba7ebde/out/app-manifest/__app__-permission-files` | task 実行中に作成または更新 | `investigate-tauri-resource-bundle-file-exists-20260826-c59c5540.task.md` の実行結果 |
| `src-tauri/target/flycheck0/stderr` | task 実行中に作成または更新 | `investigate-tauri-resource-bundle-file-exists-20260826-c59c5540.task.md` の実行結果 |
| `src-tauri/target/flycheck0/stdout` | task 実行中に作成または更新 | `investigate-tauri-resource-bundle-file-exists-20260826-c59c5540.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-tauri-resource-bundle-file-exists-20260826-c59c5540.task.md` |
| F-002 | fact | task 実行中に成果物の作成または更新があった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。Worker によるリポジトリ変更はありません。

### 結論

直接原因は、古い partial bundle の通常ファイルと、現在の directory mapping が要求するディレクトリの衝突です。

- 既存の `runtime/node_modules` には `next`、`prisma` などが通常ファイルとして残存。
- 現在の mapping は `node_modules` 全体を `runtime/node_modules` へ階層保持でコピーするため、`runtime/node_modules/next/dist/...` の親ディレクトリ作成時に `create_dir_all` が `File exists (os error 17)` を返します。
- 現在の app tree では、この file/directory blocker を14件確認しました。
- clean な仮想展開では file/directory 衝突は0件でした。したがって、現時点で node_modules mapping の追加修正より、generated bundle/staging の clean rebuild が必要です。

symlink は直接原因とは判断できません。source 側には `.bin` 等の symlink が18件ありますが、既存 app 側に symlink はなく、Tauri のコピー処理では通常ファイルとして展開されます。

別問題として、`.next/server/**/*`、`.next/static/**/*`、`src/generated/**/*` には basename flatten による同一 destination が18件あります。これは `fs::copy` による上書きの問題であり、今回の `EEXIST` とは別の mapping 修正課題です。

Tauri CLI 2.11.4 / bundler 2.9.4 のソースでは、通常の app bundle 開始時に `.app` を削除します。ただし、今回確認した `src-tauri/target/release/runtime` も flat と階層構造が混在した partial tree で、app cleanup だけでは stale staging を除去できない可能性があります。raw build log がないため、最初に衝突した正確な destination path までは特定できません。

### 次回の安全な再 build 手順

この task では削除・移動を実施していません。次回、明示的な cleanup 許可を得たうえで、以下の generated path だけを削除または復旧可能な quarantine へ移動してください。

- `src-tauri/target/release/bundle/macos/Cornell Method Notebook.app`
- 必要に応じて `src-tauri/target/release/runtime`
- DMG を再生成する場合のみ、既存の DMG 出力も対象化

`src/.desktop-runtime`、`.next`、`prisma`、lockfile、リポジトリ全体の `target` は対象にしません。その後に一度だけ build log を保存して再 build し、失敗時は最初の衝突 path を確認します。

既存 DMG は残していますが、`hdiutil imageinfo` は実行環境のデバイス制限で検査できず、現行 mapping の成果物とは扱わないのが安全です。

### 検証

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- `git diff --check`: PASS
- `cargo tauri build`、`npm install`、`npm run build`、生成物削除・署名操作: 未実施
- 作業前後の `git status --short`: 確認済み
- 既存の未コミット変更は保持。作業中に並行 task の自動 summary 追加と `Cargo.toml` 復元が発生しましたが、当 Worker はそれらを操作していません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/0242-investigate-tauri-resource-bundle-file-exists-20260826-c59c5540-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/0242-investigate-tauri-resource-bundle-file-exists-20260826-c59c5540-summary.md`
- `src-tauri/Cargo.toml`
- `src-tauri/target/debug/.fingerprint/cornell-method-notebook-36f1ef0ab80afd96/test-bin-cornell-method-notebook`
- `src-tauri/target/debug/.fingerprint/cornell-method-notebook-8e2cfbb59ba7ebde/run-build-script-build-script-build`
- `src-tauri/target/debug/.fingerprint/cornell-method-notebook-d69a810deaab04b8/bin-cornell-method-notebook`
- `src-tauri/target/debug/build/cornell-method-notebook-8e2cfbb59ba7ebde/invoked.timestamp`
- `src-tauri/target/debug/build/cornell-method-notebook-8e2cfbb59ba7ebde/out/__global-api-script.js`
- `src-tauri/target/debug/build/cornell-method-notebook-8e2cfbb59ba7ebde/out/app-manifest/__app__-permission-files`
- `src-tauri/target/flycheck0/stderr`
- `src-tauri/target/flycheck0/stdout`
