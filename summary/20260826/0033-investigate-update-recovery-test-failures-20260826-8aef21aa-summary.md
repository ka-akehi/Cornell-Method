---
summary_type: task-summary
created_at: 2026-08-26 00:33 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-update-recovery-test-failures-20260826-8aef21aa.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-update-recovery-test-failures-20260826-8aef21aa.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-update-recovery-test-failures-20260826-8aef21aa.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-update-recovery-test-failures-20260826-8aef21aa.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。コード・設定・テスト・fixture の変更はありません。作業前後の `git status --short` は同一で、既存の未コミット変更を保持しています。

### 結論

- 3行修正との因果関係はありません。`current.clone()` は所有権だけ、`OpenOptions` 修正は `write/create_new/mode(0o600)` の動作を維持しており、失敗箇所の検証コード・fixture は変更されていません。
- Rust の compile は成功しており、compile blocker ではありません。
- ただし、update recovery の runtime correctness には別途修正すべき問題が2件あります。

### テスト結果

通常実行：

```text
9 tests: 3 passed, 6 failed
```

失敗テスト：

- `safe_internal_symlink_survives_validation_copy_and_cleanup`
- `restore_temporary_cleanup_uses_exact_backup_paths_and_preserves_database_files`
- `missing_candidate_artifacts_are_idempotent_after_parent_validation`
- `retry_discards_partial_switch_temp_and_rebuilds_from_candidate_source`
- `symlink_cycles_and_hop_overflow_fail_closed`
- `failed_bundle_marker_cleanup_is_scoped_to_the_candidate_marker`

共通原因は、macOS の `TMPDIR=/var/folders/...` の祖先 `/var -> /private/var` を、[`validate_no_symlink_components`](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/update_recovery.rs:2093>) が拒否することです。fixture が bundle 内検証へ到達する前に失敗しています。

`TMPDIR=/private/tmp` で再実行すると `7 passed, 2 failed` になりました。

残る2件：

1. `retry_discards_partial_switch_temp_and_rebuilds_from_candidate_source`

   `BUNDLE_SWITCH_PREFIX` の一時名 `.Cornell Method Notebook.switch-....app` は現行コードが生成する正しい運用名ですが、[`validate_complete_switch_temp`](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/update_recovery.rs:860>) が canonical 名 `Cornell Method Notebook.app` を要求する `require_candidate_bundle_at` に渡して拒否しています。これは fixture だけでなく、switch-temp 検証経路の実装不整合です。

2. `symlink_cycles_and_hop_overflow_fail_closed`

   `MAX_SYMLINK_HOPS` 本は通過し、`MAX_SYMLINK_HOPS + 1` 本は拒否する期待値は仕様と一致します。契約でも hop 超過は fail-closed です。[`update_archive.rs`](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/update_archive.rs:1100>) は同じ境界で拒否しますが、recovery 側は最終リンク先が通常ファイルの場合に上限判定を通過します。recovery 側の off-by-one です。

### 判定・次 task

- macOS `TMPDIR` 問題：本番コードの回帰ではなく、no-symlink の一時 root を使う fixture portability issue。
- switch-temp 名称：別途 runtime correctness 修正が必要。
- hop 上限：別途 recovery 実装修正が必要。
- package build は compile の観点では継続可能ですが、update recovery の correctness sign-off 前に上記2件を修正すべきです。

確認結果：

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — PASS
- `git diff --check` — PASS
- `cargo tauri build`、`npm install`、`npm run build` — 指示どおり未実行


## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/0033-investigate-update-recovery-test-failures-20260826-8aef21aa-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/0033-investigate-update-recovery-test-failures-20260826-8aef21aa-summary.md`
