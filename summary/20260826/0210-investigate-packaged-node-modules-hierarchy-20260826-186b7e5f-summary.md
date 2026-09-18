---
summary_type: task-summary
created_at: 2026-08-26 02:10 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-packaged-node-modules-hierarchy-20260826-186b7e5f.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-packaged-node-modules-hierarchy-20260826-186b7e5f.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-packaged-node-modules-hierarchy-20260826-186b7e5f.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-packaged-node-modules-hierarchy-20260826-186b7e5f.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。コード・設定・テスト・生成物は変更していません。

### 直接原因

- Source: `.desktop-runtime/node_modules/prisma/build/prisma_schema_build_bg.wasm`
- `.bin/prisma`: `../prisma/build/index.js` の symlink
- Packaged artifact:
  - `.bin/prisma` は通常ファイル化
  - `.bin/prisma_schema_build_bg.wasm` は欠落
  - `node_modules/prisma_schema_build_bg.wasm` に basename だけで配置

Prisma の `index.js` は `${__dirname}/prisma_schema_build_bg.wasm` を読むため、通常ファイル化された `.bin/prisma` は `.bin` 配下の WASM を要求し、失敗します。

Source は symlink 18個、artifact は0個でした。artifact の `node_modules` 直下には `.bin` と `.prisma` しかなく、`prisma/build`、`@prisma/client`、`next/dist/bin`、`.prisma/client` も失われています。

### Mapping の結論

現行の次の glob が flattening の直接原因です。

```json
"../.desktop-runtime/node_modules/**/*": "runtime/node_modules/",
"../.desktop-runtime/node_modules/.bin/**/*": "runtime/node_modules/.bin/",
"../.desktop-runtime/node_modules/.prisma/**/*": "runtime/node_modules/.prisma/"
```

Tauri の glob mapping は match の basename だけを destination に置きます。directory mapping は相対階層を保持します。既存の `../prisma` directory mapping は `diff -qr` で repo と artifact が一致しており、migrations 問題と同じ file-glob flattening 系の原因です。

### 次の coding task 仕様

推奨:

1. [tauri.conf.json](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/tauri.conf.json:28) の3つの node_modules glob を削除。
2. 次の directory mapping に置換。

```json
"../.desktop-runtime/node_modules": "runtime/node_modules"
```

これで scoped package、`.prisma/client`、`prisma/build`、`.bin` の階層を保持できます。

3. Tauri は symlink を通常ファイルとしてコピーするため、現行の `.bin/prisma` を維持する場合は追加で次を mapping。

```json
"../.desktop-runtime/node_modules/prisma/build/prisma_schema_build_bg.wasm":
  "runtime/node_modules/.bin/prisma_schema_build_bg.wasm"
```

4. [launcher.cjs](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/sidecar/launcher.cjs:54) の Prisma と [launcher.cjs](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/sidecar/launcher.cjs:1078) の Next は、`.bin` shim ではなく canonical path を使う方が安全です。

```text
node_modules/prisma/build/index.js
node_modules/next/dist/bin/next
```

特に Next shim は `require("../server/require-hook")` を使うため、通常ファイル化された `.bin/next` のままでは別の起動失敗になります。

`prepare-desktop-node-runtime.js` は npm install と `.prisma/client` のコピーだけで、flattening の原因ではありません。変更不要です。

### 検証

- migration tree: repo と artifact が一致
- `node --test test/desktop/desktop-node-runtime.test.js`: 7/7 PASS
- launcher/helper `node --check`: PASS
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- `git diff --check`: PASS
- `cargo tauri build`、npm install/build、再パッケージ: 未実行

`node_modules` は現状 source 約799MB、artifact 約550MBです。階層復元で artifact サイズ、署名対象、DMG 生成時間は増加します。修正後の実サイズ・署名検証・fresh packaged bootstrap は未確認です。

作業前後の `git status --short` は同一で、既存の未コミット変更を保持しました。Worker の変更ファイルはありません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/0210-investigate-packaged-node-modules-hierarchy-20260826-186b7e5f-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/0210-investigate-packaged-node-modules-hierarchy-20260826-186b7e5f-summary.md`
