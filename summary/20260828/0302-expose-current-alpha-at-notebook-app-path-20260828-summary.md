---
summary_type: task-summary
created_at: 2026-08-28 03:02 JST
task_kind: worker-task
task_status: done
---

## Objective

検証済み current fresh packaged alpha を、リポジトリ直下の `Notebook.app` から参照できる recoverable な symlink として配置する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | packaged app artifact の alias 配置と identity 検証 |
| 対象ファイル / ディレクトリ | 指定 source `.app`、既存 alias、`Notebook.app`、本 summary |
| 対象外 | source code、設定、依存関係、lockfile、generated artifact、app bundle 本体、app 起動・インストール・置換、DMG 再作成 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-22.md` | current packaged alpha の BUILD_ID、実行ファイル hash、検証境界 |
| source artifact | `/private/tmp/cornell-method-tauri-target-current-source-after-backup-origin-fix-20260828/release/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app` | bundle、main executable、BUILD_ID、SHA-256 |
| existing alias | `/private/tmp/cornell-method-tauri-target-current-source-after-backup-origin-fix-20260828/Cornell-Method-Notebook.app` | source artifact への解決先と identity |
| worker tooling | `codex-queue/bin/worker-record-change.sh` | changed-files provenance の記録方法 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `Notebook.app` | source artifact を指す absolute symlink を新規作成 | 巨大な `.app` の複製を避け、従来の space-free path から current artifact を参照するため |
| `summary/20260828/0302-expose-current-alpha-at-notebook-app-path-20260828-summary.md` | 完了 summary を作成 | 配置内容、検証結果、Next Read を記録するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | source bundle と `Contents/MacOS/cornell-method-notebook` は存在する。 | `test -d` / `test -f` |
| F-002 | fact | existing alias は source artifact に解決し、同じ BUILD_ID と main executable hash を持つ。 | `realpath`、BUILD_ID、SHA-256 の比較 |
| F-003 | fact | destination は作成前に未存在であり、既存対象の上書き・削除は行っていない。 | `[ -e ]` / `[ -L ]` による事前確認 |
| F-004 | fact | `Notebook.app` は source artifact へ解決する symlink である。 | `readlink` / `realpath` |
| F-005 | fact | alias 経由の BUILD_ID は `JrSkDiiD_Hp4755lZJsra`、main executable SHA-256 は `7210a160a24b729ac6e2986bbd72793f841106154a3b131a1afad1a97a1518bb` で source と一致する。 | destination 経由の read/hash 比較 |
| F-006 | fact | source bundle へ書き込む操作、app の起動・インストール・置換、network・ユーザーデータ・credentials・SQLite へのアクセスは行っていない。 | 実行コマンドの範囲 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 既存の未コミット変更を確認し、そのまま保持した。 |
| destination の事前存在確認 | PASS | `/Users/kazuya/Desktop/自己学習/Cornell-Method/Notebook.app` は未存在だった。 |
| symlink 配置 | PASS | bundle の複製なし。mode は `lrwxr-xr-x`。 |
| 解決先 | PASS | source artifact の絶対パスと一致。 |
| bundle / main executable | PASS | destination 経由で両方存在。 |
| BUILD_ID | PASS | source / destination とも `JrSkDiiD_Hp4755lZJsra`。 |
| main executable identity | PASS | source / destination とも SHA-256 `7210a160a24b729ac6e2986bbd72793f841106154a3b131a1afad1a97a1518bb`、size `15181648` bytes。 |
| changed-files provenance | PASS | `worker-record-change.sh` に `Notebook.app` を記録。既存 manifest の記録は保持した。 |
| 作業後 `git status --short` | PASS | 作業前からの未コミット変更を保持し、今回の追加は `Notebook.app` と本 summary のみ。 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | symlink の解決先が `/private/tmp` 配下のため、source artifact が一時領域から消えた後の利用可否は確認していない。 | source artifact の保持期間または恒久配置 |
| U-002 | app の起動動作自体は、作業制約に従い実行していない。 | 別途明示された runtime QA |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260828/0302-expose-current-alpha-at-notebook-app-path-20260828-summary.md`
