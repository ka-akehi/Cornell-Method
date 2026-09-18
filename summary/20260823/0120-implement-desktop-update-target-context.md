---
summary_type: task-summary
created_at: 2026-08-23 01:20 JST
task_kind: worker-task
task_status: done
---

## Objective

実行時の app version と macOS version を fail-closed に取得し、stable / Apple Silicon の validated target context として `run_update_check` に渡せる境界を追加する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Desktop Alpha update target context |
| 対象ファイル / ディレクトリ | `src-tauri/src/update_target.rs`、`src-tauri/src/update_check.rs`、`src-tauri/src/main.rs`、`test/desktop/desktop-update-target.test.js` |
| 対象外 | startup / manual caller、GitHub network、manifest fetch、update-state schema/write、UI、scheduler、package download |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-22.md` | Desktop Alpha の未接続範囲と Next Read |
| parser | `src-tauri/src/update_manifest.rs` | `SemVer`、`MacOsVersion`、stable / Apple Silicon 定数、canonical `Display` |
| orchestrator | `src-tauri/src/update_check.rs` | 既存の target 引数と selection 境界 |
| selection | `src-tauri/src/update_selection.rs` | `minVersion` / `maxVersionExclusive` を含む既存 selection rule |
| contract tests | `test/desktop/desktop-update-*.test.js` | provider / selection / state の caller 未接続契約 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/src/update_target.rs` | `UpdateTargetContext`、固定 error code、compile-time package version、固定 `/usr/bin/sw_vers -productVersion` runner、UTF-8 / line / control / numeric parser を追加。fake runner で unit test を追加。 | 実行時 target context を単一責務で validated にするため |
| `src-tauri/src/update_check.rs` | `run_update_check` が `&UpdateTargetContext` を受け取り、validated `SemVer` / `MacOsVersion` を canonical string にして既存 selection API へ渡すよう変更。selection rule は変更していない。 | raw caller input を orchestrator の target boundary から外すため |
| `src-tauri/src/main.rs` | `mod update_target;` のみ追加。 | crate module wiring のため。caller は未接続 |
| `test/desktop/desktop-update-target.test.js` | 固定 command、compile-time version source、context wiring、caller 未接続を検査する focused contract test を追加。 | production boundary の静的契約を固定するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | app version は `env!("CARGO_PKG_VERSION")` を `SemVer::parse` し、runtime config / environment variable では差し替えない。 | `src-tauri/src/update_target.rs` |
| F-002 | fact | macOS version は shell / PATH / user input を介さず固定 absolute path と固定 arg で取得し、stderr / raw stdout / command detail を error や state に保持しない。 | `SystemSwVersCommandRunner` と `parse_sw_vers_output` |
| F-003 | fact | stable / `aarch64-apple-darwin` は既存 `update_manifest` 定数をそのまま使い、Intel / beta の入力経路を追加していない。 | `UpdateTargetContext` 初期化 |
| A-001 | assumption | `MacOsVersion::Display` の canonical string（末尾 zero component を正規化）を selection 層へ渡すことが既存比較契約に合う。 | 既存 parser の `Display` と selection API |
| U-001 | unknown | packaged macOS 上で実際の `/usr/bin/sw_vers` を起動する runtime / GUI 検証は未実施。 | task の fake runner test 制約と検証環境 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| Rust unit tests | pass | `CARGO_TARGET_DIR=/tmp/cornell-method-update-target-cargo cargo test --manifest-path src-tauri/Cargo.toml --offline`、66 passed |
| Rust format | pass | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` |
| update Node contracts | pass | `node --test test/desktop/desktop-update-*.test.js`、13 passed |
| ESLint | pass | `npm run lint`、0 errors。既存 warning 8 件 |
| diff whitespace | pass | `git diff --check`。新規対象ファイルも whitespace scan で問題なし |
| external side effects | not run | GitHub、network、state write、UI event、package download は未接続・未実行 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | macOS packaged app の実 `sw_vers` 起動と caller からの context 受け渡し | 次の startup / manual update caller task と Apple Silicon runtime QA |

## Next Read

次の caller task では、まず次の最小ファイルを読む。

- `src-tauri/src/update_target.rs`
- `src-tauri/src/update_check.rs`
- `test/desktop/desktop-update-target.test.js`

