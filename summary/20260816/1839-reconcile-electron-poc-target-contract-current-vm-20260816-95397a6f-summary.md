---
summary_type: task-summary
created_at: 2026-08-16 18:39 JST
task_kind: worker-task
task_status: done
---

## Objective

`reconcile-electron-poc-target-contract-current-vm-20260816-95397a6f.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/reconcile-electron-poc-target-contract-current-vm-20260816-95397a6f.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/reconcile-electron-poc-target-contract-current-vm-20260816-95397a6f.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/reconcile-electron-poc-target-contract-current-vm-20260816-95397a6f.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

棚卸しを完了しました。コード・設定・依存関係・生成物・summary は変更していません。

### 調査結果

古い target 値の tracked 参照は、8 ファイル・15 行でした。

| 区分 | 参照箇所 | 意味 |
|---|---|---|
| Electron | [README.md](/Users/kazuya/Desktop/自己学習/Cornell-Method/tools/desktop-poc/electron/README.md:12) | 比較対象 target の表示 |
| Electron | [package.json](/Users/kazuya/Desktop/自己学習/Cornell-Method/tools/desktop-poc/electron/package.json:27) | Node/npm engines |
| Electron | [common.cjs](/Users/kazuya/Desktop/自己学習/Cornell-Method/tools/desktop-poc/electron/scripts/common.cjs:212) | 実行時 validation の期待値 |
| Tauri | [README.md](/Users/kazuya/Desktop/自己学習/Cornell-Method/tools/desktop-poc/tauri/README.md:13) | Electron と同じ比較 target の表示 |
| Tauri | [package.json](/Users/kazuya/Desktop/自己学習/Cornell-Method/tools/desktop-poc/tauri/package.json:20) | Node/npm engines |
| Tauri | [package-lock.json](/Users/kazuya/Desktop/自己学習/Cornell-Method/tools/desktop-poc/tauri/package-lock.json:11) | root package の engines |
| Tauri | [common.cjs](/Users/kazuya/Desktop/自己学習/Cornell-Method/tools/desktop-poc/tauri/scripts/common.cjs:26) | 実行時 validation の期待値 |
| Tauri | [evidence.cjs](/Users/kazuya/Desktop/自己学習/Cornell-Method/tools/desktop-poc/tauri/scripts/evidence.cjs:381) | evidence 内の Node runtime 説明文 |

`evidence.cjs` の target metadata は、Electron では [baseline/toolchain 出力](/Users/kazuya/Desktop/自己学習/Cornell-Method/tools/desktop-poc/electron/scripts/evidence.cjs:119)、Tauri では [baseline 出力](/Users/kazuya/Desktop/自己学習/Cornell-Method/tools/desktop-poc/tauri/scripts/evidence.cjs:329) として shared manifest から引き継がれます。両方の evidence schema は `baseline` / `toolchain` を汎用 object として定義しており、target 値自体は固定していません。

root `package.json`、root lockfile、`doc/**` には古いバージョン値の直接参照はありません。製品仕様・MVP 契約・比較条件は「同じ Apple Silicon Mac / 現行 macOS」「同じ baseline / fixture」を定めており、`26.6.1` を製品の最低対応 macOS として固定する記述ではありません。

### 変更境界

shared manifest のキーは次のとおりです。

- 変更対象: `macos_version`、`node_version`、`npm_version`
- 変更不要: `architecture`（現行値 `Apple Silicon Mac (arm64)` と一致）
- 変更禁止: `baseline_id`、`baseline_scope_sha256`、`git_head`、`fixture_path`、`fixture_count`、`fixture_seed`、`fixture_sha256`、`fixture_content_hash`

つまり、fixture の 10,000 件、seed、SHA-256、contentHash、baseline ID は維持したまま target metadata だけ更新できます。`fixtureContentHashAfterSmoke` は操作後の populated DB の測定値であり、baseline の `fixture_content_hash` とは別物です。

### 後続 implementation task 案

目的: 現在の UTM VM target を Electron/Tauri 共通の正式 target metadata として採用する。ただし shell 選定や fixture 変更は行わない。

対象ファイル:

- `tools/desktop-poc/electron/README.md`
- `tools/desktop-poc/electron/package.json`
- `tools/desktop-poc/electron/scripts/common.cjs`
- `tools/desktop-poc/tauri/README.md`
- `tools/desktop-poc/tauri/package.json`
- `tools/desktop-poc/tauri/package-lock.json`
- `tools/desktop-poc/tauri/scripts/common.cjs`
- `tools/desktop-poc/tauri/scripts/evidence.cjs`
- disposable な shared `baseline-manifest.json` の target metadata 4項目のみ

値は以下に統一します。

- macOS: `26.6.1`
- Node: manifest/common は `v26.7.0`、package engines は `26.7.0`
- npm: `11.19.0`

完了条件:

- tracked file から古い target 値が消える。
- shared fixture の bytes、件数、SHA-256、contentHash、baseline ID が不変。
- Electron/Tauri の validation が同じ target metadata と fixture を使用する。
- Tauri evidence の Node runtime 表示が stale にならない。
- `candidateDecision: not-selected` を維持し、Electron を選定済みと記録しない。
- 現行 MVP の route/API/DB/Canvas 契約、Phase 2 境界、最低対応 macOS の未決状態を変更しない。

推奨検証:

```sh
npm run syntax
npm test
POC_BASELINE_MANIFEST=/path/to/baseline-manifest.json npm run poc:validate
```

Electron/Tauri の両 candidate directory で実行し、target VM 上では `sw_vers`、`uname -m`、`node --version`、`npm --version`、`git rev-parse HEAD` も確認します。`git_head` が固定 baseline と一致しない場合は、baseline を変更せず BLOCKED とします。

### 検証結果

- 作業前後の `git status --short`: `?? summary/20260816/` のみで不変
- `git diff --check`: PASS
- `git diff --name-only`: 空
- VM 操作、fixture 再生成、Node/npm のインストール、実行時 validation: 未実施（今回の調査 task の制約どおり）

なお、target VM 内の shared manifest/fixture の配置、candidate checkout の HEAD、`package.json` の実在内容は、前回 task の接続制限により未確認です。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260816/1839-reconcile-electron-poc-target-contract-current-vm-20260816-95397a6f-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260816/1839-reconcile-electron-poc-target-contract-current-vm-20260816-95397a6f-summary.md`
