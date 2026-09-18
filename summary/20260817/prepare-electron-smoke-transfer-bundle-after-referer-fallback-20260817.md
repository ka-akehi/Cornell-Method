## Objective

Referer fallback と bounded request hook diagnostics を含む Electron smoke 用2ファイルを、ホスト側 VM transfer bundle へ同期し、checksum を更新・検証する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Electron smoke transfer bundle |
| 対象ファイル / ディレクトリ | `/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/electron-smoke-fix-sync-current-vm-20260817-racefix/tools/desktop-poc/electron/src/main.cjs`、`test/smoke.test.cjs`、root `SHA256SUMS` |
| 対象外 | リポジトリ source の変更、`shared-transfer-current-vm`、UTM / VM 操作、Git 操作、古い bundle の削除 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| source | `tools/desktop-poc/electron/src/main.cjs` | 指定 expected SHA-256 と一致する最新 source |
| source | `tools/desktop-poc/electron/test/smoke.test.cjs` | 指定 expected SHA-256 と一致する最新 smoke test |
| destination | `/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/electron-smoke-fix-sync-current-vm-20260817-racefix` | 既存 bundle と旧 checksum の状態 |
| procedure | `summary/task-summary-template.md` | 完了要約の記載項目 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/electron-smoke-fix-sync-current-vm-20260817-racefix/tools/desktop-poc/electron/src/main.cjs` | source の最新ファイルをコピー | transfer bundle を更新するため |
| `/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/electron-smoke-fix-sync-current-vm-20260817-racefix/tools/desktop-poc/electron/test/smoke.test.cjs` | source の最新ファイルをコピー | transfer bundle を更新するため |
| `/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/electron-smoke-fix-sync-current-vm-20260817-racefix/SHA256SUMS` | 上記2ファイルだけの checksum を再生成 | destination の整合性を検証するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-1 | fact | source `main.cjs` は `a591b8babd7d3be6470cacf9adc73feee348f5ce8828acb4fa97cd5efabb7957`。 | source で `shasum -a 256` を実行 |
| F-2 | fact | source `smoke.test.cjs` は `30753a838eb6f74a3d0bb576dc492ef5f8eeb02d040e593d897923e30bb44f5f`。 | source で `shasum -a 256` を実行 |
| F-3 | fact | destination の checksum 検証は2ファイルとも `OK`。 | destination root で `shasum -a 256 -c SHA256SUMS` を実行 |
| F-4 | fact | source と destination の両ファイルの SHA-256 が一致。 | source / destination で個別 `shasum -a 256` を実行 |
| F-5 | assumption | 既存 destination bundle は維持し、指定された2ファイルと root checksum だけを更新した。 | 作業制約と実行コマンド |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| destination checksum | PASS | `tools/desktop-poc/electron/src/main.cjs: OK`、`tools/desktop-poc/electron/test/smoke.test.cjs: OK` |
| source expected hash | PASS | 2ファイルとも指定 expected SHA-256 と一致 |
| source / destination hash | PASS | 両ファイルで source と destination の SHA-256 が一致 |
| checksum 対象数 | PASS | `/private/tmp/.../electron-smoke-fix-sync-current-vm-20260817-racefix/SHA256SUMS` は2行 |
| VM / UTM 操作 | NOT RUN | タスク制約により実行していない |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| - | なし | - |

## Next Read

次回は transfer bundle の root checksum と、ホスト側 VM での次工程の手順だけを確認する。

- `/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/electron-smoke-fix-sync-current-vm-20260817-racefix/SHA256SUMS`

