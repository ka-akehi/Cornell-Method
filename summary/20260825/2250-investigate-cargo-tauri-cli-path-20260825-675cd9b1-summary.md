---
summary_type: task-summary
created_at: 2026-08-25 22:50 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-cargo-tauri-cli-path-20260825-675cd9b1.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-cargo-tauri-cli-path-20260825-675cd9b1.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-cargo-tauri-cli-path-20260825-675cd9b1.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-cargo-tauri-cli-path-20260825-675cd9b1.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。直接原因は「`cargo-tauri` 未インストール」です。

- `cargo tauri --version`: `no such command: tauri`
- `cargo-tauri` は `command -v` / `type -a` ともに未検出
- `~/.cargo/bin/cargo-tauri` は存在しない
- `~/.cargo/bin` は PATH に含まれているため、PATH 不一致ではない
- Rust toolchain は `stable-aarch64-apple-darwin`、`rustc/cargo 1.98.0`
- 過去の `cargo-tauri 2.11.4` は別実行環境の記録で、現在へ引き継がれていない

リポジトリの既存 pin は、[Cargo.toml](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/Cargo.toml:10) の `tauri = 2.5.1` / `tauri-build = 2.2.0`、[Cargo.lock](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/Cargo.lock:3304) も同じです。CLI は package/lockfile に含まれていません。CLI の version mismatch は直接原因ではありませんが、最小修正は repo の Tauri runtime に合わせて次の pin を推奨します。

```sh
cargo install tauri-cli --version 2.5.1 --locked
```

検証:

```sh
command -v cargo-tauri
cargo-tauri --version
cargo tauri --version
cargo --list | rg tauri
```

rollback:

```sh
cargo uninstall tauri-cli
```

必要権限は通常ユーザーの Cargo home（`~/.cargo/bin`）への書き込みと crates.io へのネットワーク接続です。sudo は不要です。現在の Worker sandbox では同ディレクトリへの書き込みが制限されるため、インストールは実行していません。

CLI 修正 task と packaged build retry task は分離します。CLI の導入・確認後、host-network で npm registry / crates.io が利用可能なことを確認してから、別 task で `cargo tauri build` を再試行してください。今回、コード・設定・依存関係・lockfile・生成物は変更していません。作業前後の既存未コミット変更も保持されています。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260825/2250-investigate-cargo-tauri-cli-path-20260825-675cd9b1-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260825/2250-investigate-cargo-tauri-cli-path-20260825-675cd9b1-summary.md`
