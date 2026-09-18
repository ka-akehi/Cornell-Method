---
summary_type: task-summary
created_at: 2026-08-26 03:18 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-packaged-prisma-native-engine-20260826-1bae257b.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-packaged-prisma-native-engine-20260826-1bae257b.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-packaged-prisma-native-engine-20260826-1bae257b.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/Cargo.toml` | task 実行中に作成または更新 | `investigate-packaged-prisma-native-engine-20260826-1bae257b.task.md` の実行結果 |
| `src-tauri/target/debug/.fingerprint/cornell-method-notebook-36f1ef0ab80afd96/test-bin-cornell-method-notebook` | task 実行中に作成または更新 | `investigate-packaged-prisma-native-engine-20260826-1bae257b.task.md` の実行結果 |
| `src-tauri/target/debug/.fingerprint/cornell-method-notebook-8e2cfbb59ba7ebde/run-build-script-build-script-build` | task 実行中に作成または更新 | `investigate-packaged-prisma-native-engine-20260826-1bae257b.task.md` の実行結果 |
| `src-tauri/target/debug/.fingerprint/cornell-method-notebook-d69a810deaab04b8/bin-cornell-method-notebook` | task 実行中に作成または更新 | `investigate-packaged-prisma-native-engine-20260826-1bae257b.task.md` の実行結果 |
| `src-tauri/target/debug/build/cornell-method-notebook-8e2cfbb59ba7ebde/invoked.timestamp` | task 実行中に作成または更新 | `investigate-packaged-prisma-native-engine-20260826-1bae257b.task.md` の実行結果 |
| `src-tauri/target/debug/build/cornell-method-notebook-8e2cfbb59ba7ebde/out/__global-api-script.js` | task 実行中に作成または更新 | `investigate-packaged-prisma-native-engine-20260826-1bae257b.task.md` の実行結果 |
| `src-tauri/target/debug/build/cornell-method-notebook-8e2cfbb59ba7ebde/out/app-manifest/__app__-permission-files` | task 実行中に作成または更新 | `investigate-packaged-prisma-native-engine-20260826-1bae257b.task.md` の実行結果 |
| `src-tauri/target/flycheck0/stderr` | task 実行中に作成または更新 | `investigate-packaged-prisma-native-engine-20260826-1bae257b.task.md` の実行結果 |
| `src-tauri/target/flycheck0/stdout` | task 実行中に作成または更新 | `investigate-packaged-prisma-native-engine-20260826-1bae257b.task.md` の実行結果 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-packaged-prisma-native-engine-20260826-1bae257b.task.md` |
| F-002 | fact | task 実行中に成果物の作成または更新があった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。Worker によるコード・設定・依存関係・生成物の変更はありません。

### 結論

- Prisma は `7.8.0`、engine revision は `3c6e192...`、対象は `darwin-arm64`。
- 必須 native binary は次です。

```text
node_modules/@prisma/engines/schema-engine-darwin-arm64
```

mode `755`、arm64 Mach-O、24,153,968 bytes。開発用 `node_modules` と Prisma cache には存在しますが、`.desktop-runtime` と clean artifact にはありません。

- clean artifact の `prisma/build/*.wasm` は native schema-engine の代替ではありません。
- Prisma CLI は `@prisma/engines` package root を探索し、欠落時に cache、最終的に `binaries.prisma.sh` から download します。
- `migrate deploy` は schema-engine のみを必要とします。query-engine binary の同梱は不要です。
- [prepare-desktop-node-runtime.js](/Users/kazuya/Desktop/自己学習/Cornell-Method/scripts/prepare-desktop-node-runtime.js:196) は native engine をコピーしていません。npm postinstall の取得結果に依存しています。
- [launcher.cjs](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/sidecar/launcher.cjs:54) と [desktop-storage.js](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/server/infrastructure/desktop-storage.js:1554) の canonical Prisma invocation は変更不要です。

### 次の最小 coding task

- `prepare-desktop-node-runtime.js` で root の arm64 engine を次へコピーする。

```text
.desktop-runtime/node_modules/@prisma/engines/schema-engine-darwin-arm64
```

- executable permission `755` を保持し、source 不在時は build preparation を fail-closed にする。
- cache や runtime download を fallback にしない。
- [tauri.conf.json](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/tauri.conf.json:28) の既存 directory mapping はそのまま利用できる。追加の flat mapping は不要です。
- focused test で、配置先・arm64 binary・mode `755`・artifact 内の同一 path を確認する。

追加サイズは約24.2 MB（非圧縮）。native Mach-O が app resource に追加されるため、最終的な署名対象にも含まれますが、Developer ID / notarization は対象外です。

### Offline verification

clean target で次を確認します。

1. `runtime/node_modules/@prisma/engines/schema-engine-darwin-arm64` が存在し、arm64 Mach-O / mode `755`。
2. empty disposable `HOME`・`XDG_CACHE_HOME` と outbound network deny の状態で packaged launcher の `bootstrap` を実行。
3. `status=ready`、stderr に download / `binaries.prisma.sh` / DNS error がないことを確認。
4. disposable cache に native engine が生成されていないことを確認する。

### 検証結果

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- `git diff --check`: PASS
- syntax check: PASS
- `node --test test/desktop/desktop-node-runtime.test.js`: 8/8 PASS
- network access、npm install/ci、engine download、cargo build、署名操作: 未実施

開始時に `M src-tauri/Cargo.toml` があり、終了時には表示されませんでした。Worker は同ファイルを編集していないため、共有 workspace の外部変更として Manager 側で確認してください。その他の既存変更は保持されています。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/0318-investigate-packaged-prisma-native-engine-20260826-1bae257b-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/0318-investigate-packaged-prisma-native-engine-20260826-1bae257b-summary.md`
- `src-tauri/Cargo.toml`
- `src-tauri/target/debug/.fingerprint/cornell-method-notebook-36f1ef0ab80afd96/test-bin-cornell-method-notebook`
- `src-tauri/target/debug/.fingerprint/cornell-method-notebook-8e2cfbb59ba7ebde/run-build-script-build-script-build`
- `src-tauri/target/debug/.fingerprint/cornell-method-notebook-d69a810deaab04b8/bin-cornell-method-notebook`
- `src-tauri/target/debug/build/cornell-method-notebook-8e2cfbb59ba7ebde/invoked.timestamp`
- `src-tauri/target/debug/build/cornell-method-notebook-8e2cfbb59ba7ebde/out/__global-api-script.js`
- `src-tauri/target/debug/build/cornell-method-notebook-8e2cfbb59ba7ebde/out/app-manifest/__app__-permission-files`
- `src-tauri/target/flycheck0/stderr`
- `src-tauri/target/flycheck0/stdout`
