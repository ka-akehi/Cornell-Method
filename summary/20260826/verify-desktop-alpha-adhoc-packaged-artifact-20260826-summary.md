---
summary_type: task-summary
created_at: 2026-08-26 JST
task_kind: worker-task
task_status: blocked
---

## Objective

指定した clean `CARGO_TARGET_DIR` から macOS `.app` / `.dmg` を生成し、ad-hoc identity、nested executable、resource seal、Gatekeeper 判定、DMG SHA-256 を検証する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Desktop Alpha packaged artifact / macOS ad-hoc signing QA |
| 対象ファイル / ディレクトリ | `src-tauri/tauri.conf.json`; `/private/tmp/cornell-method-tauri-target-adhoc-20260826` |
| 対象外 | Apple Developer certificate、Developer ID、notarization credential、秘密鍵、パスワード、外部アカウント |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-22.md` | packaged build の既知 blocker と Next Read |
| task summary | `summary/20260826/0504-configure-desktop-alpha-adhoc-signing-20260826-e6048b97-summary.md` | `signingIdentity: "-"` の設定済み状態 |
| config | `src-tauri/tauri.conf.json` | `app` / `dmg` targets、runtime resources、ad-hoc identity |
| test contract | `test/desktop/desktop-node-runtime.test.js` | packaged Node / launcher / Prisma runtime contract |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/Cargo.toml` | build 中に Tauri CLI が既知の2箇所を一時変更したため、元の宣言へ2回復元 | ソース・依存関係・lockfile差分を残さないため |
| `summary/20260826/verify-desktop-alpha-adhoc-packaged-artifact-20260826-summary.md` | 本 summary を追加 | Worker の完了要約 |

`src-tauri/tauri.conf.json` を含む他の tracked 差分は作業前から存在した未コミット変更であり、変更していない。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 指定 build は2回とも `npm ci --omit=dev --no-audit --no-fund` の registry 解決で `ENOTFOUND registry.npmjs.org`（`debug`）となり、beforeBuildCommand で停止した。 | `cargo tauri build` の出力 |
| F-002 | fact | clean target に `.app` / `.dmg` は生成されなかった。 | 対象パスの existence check、`find` |
| F-003 | fact | `codesign --display --verbose=4`、`codesign --verify --deep --strict --verbose=2`、`spctl --assess --type execute --verbose=4`、DMG SHA-256 は対象なしで実行不能だった。 | 各コマンド exit 1。`spctl` は `invalid API object reference` |
| F-004 | fact | `npm run test:desktop:node-runtime` は 11/11 PASS、`git diff --check` は PASS。 | 実行結果 |
| F-005 | fact | 作業前後で source/config/dependency/lockfile の新規差分はなく、既知の Cargo CLI 差分は復元した。 | `git status --short --untracked-files=all`、対象 diff |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `CARGO_TARGET_DIR=... cargo tauri build` | BLOCKED | 2回とも npm registry DNS `ENOTFOUND` |
| `.app` existence | FAIL / absent | expected path に未生成 |
| `.dmg` existence | FAIL / absent | expected path に未生成 |
| ad-hoc identity / `codesign --display` | NOT VERIFIED | artifact absent |
| nested executable / resource seal / `codesign --verify` | NOT VERIFIED | artifact absent |
| Gatekeeper / `spctl` | NOT CLASSIFIED | ad-hoc reject ではなく artifact absent |
| DMG SHA-256 | NOT VERIFIED | artifact absent |
| desktop node-runtime contract | PASS | 11/11 |
| `git diff --check` | PASS | |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | clean packaged `.app` / `.dmg` の生成、署名、resource seal、nested runtime、Gatekeeper、SHA-256 | `registry.npmjs.org` の DNS / npm runtime install blocker 解消後の同一指定 build |

## Next Read

- `summary/20260826/verify-desktop-alpha-adhoc-packaged-artifact-20260826-summary.md`
- `summary/20260825/0601-retry-desktop-alpha-packaged-build-after-registry-recovery-20260825-69268d2a-summary.md`
- `src-tauri/tauri.conf.json`
