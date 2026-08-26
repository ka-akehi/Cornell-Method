---
summary_type: task-summary
created_at: 2026-08-26 01:21 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-packaged-app-codesign-mismatch-20260826-973a71b4.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-packaged-app-codesign-mismatch-20260826-973a71b4.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-packaged-app-codesign-mismatch-20260826-973a71b4.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-packaged-app-codesign-mismatch-20260826-973a71b4.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査結果は以下です。

### 直接原因

- `.app` と主実行ファイルは `adhoc,linker-signed` ですが、`Sealed Resources=none`、`TeamIdentifier=not set`、`_CodeSignature/CodeResources` なし。
- `codesign --verify --deep --strict` の直接エラーは、特定 resource の改変ではなく、bundle の resource seal 不在です。
- nested code では次も確認しました。

  - `Contents/Resources/runtime/node`: `invalid signature`
  - `Contents/Resources/runtime/node_modules/fsevents.node`: `code object is not signed at all`
  - `libvips`、`sharp`、`next-swc`: 個別検証 PASS

`.desktop-runtime/node`、`.nodenv/.../node`、app 内の `runtime/node` は同一バイト列で、bundle 化前から同じ署名エラーでした。したがって、署名後に resource が書き換えられた実装不整合とは判断しません。

### 設定・lifecycle

[`tauri.conf.json`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/tauri.conf.json:18) に `bundle.macOS.signingIdentity` はなく、現在の `APPLE_SIGNING_IDENTITY` / certificate 環境変数も unset です。Tauri 公式仕様では、署名 identity は設定または `APPLE_SIGNING_IDENTITY` で指定し、証明書なしの ad-hoc は `signingIdentity: "-"` とします。[Tauri macOS Code Signing](https://v2.tauri.app/distribute/sign/macos/)

[`prepare-desktop-node-runtime.js`](/Users/kazuya/Desktop/自己学習/Cornell-Method/scripts/prepare-desktop-node-runtime.js:148) は Node を byte copy するだけです。Rust runtime と [`launcher.cjs`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/sidecar/launcher.cjs:27) も bundle resource を変更せず、読み取り・spawn のみです。[runtime.rs](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/runtime.rs:814)

### Acceptance 判定

- local alpha の機能確認に限れば、署名 failure 単独は non-blocking と判断します。Developer ID / notarization は現行 Alpha の blocker ではありません。[DESKTOP_ALPHA_TAURI_FOUNDATION.md](/Users/kazuya/Desktop/自己学習/Cornell-Method/doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md:219)
- ただし、この artifact は「署名済み・配布可能」とは扱えません。`codesign --verify` を必須条件にする場合、または DMG をダウンロード後に起動する配布 QA では blocking です。
- 現在の packaged acceptance 全体は、既存 QA 要約どおり `PACKAGED BLOCKED` のままです。主因は `runtime/prisma/migrations` 欠落による bootstrap failure で、今回の署名問題とは別です。[QA summary](/Users/kazuya/Desktop/自己学習/Cornell-Method/summary/20260826/0111-qa-packaged-desktop-alpha-contract-retry-20260826-85b9e380-summary.md)

### 推奨する次の実装 task

「Apple Silicon local alpha 用 ad-hoc bundle signing の確立」。

- 対象: `tauri.conf.json`、packaging/signing lifecycle、Node・native Mach-O の nested signing、検証スクリプト/docs
- 完了条件: `CodeResources` 生成、`codesign --verify --deep --strict` PASS、Node / `fsevents` / native modules の検証 PASS
- 除外: Developer ID、certificate 導入、notarization、今回の migration 欠落修正
- 検証: clean packaged build、`codesign --display`、nested code 個別検証、local sidecar smoke、ad-hoc artifact としての Gatekeeper 制約を記録

変更ファイルはありません。作業前後の `git status --short` は同一で、既存の未コミット変更は保持しました。

検証結果:

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- `git diff --check`: PASS
- build、install、署名、証明書操作は未実行

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/0120-investigate-packaged-app-codesign-mismatch-20260826-973a71b4-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/0120-investigate-packaged-app-codesign-mismatch-20260826-973a71b4-summary.md`
