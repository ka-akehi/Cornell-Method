---
summary_type: task-summary
created_at: 2026-08-26 01:21 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-packaged-prisma-migrations-omission-20260826-829e32f6.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-packaged-prisma-migrations-omission-20260826-829e32f6.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-packaged-prisma-migrations-omission-20260826-829e32f6.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-packaged-prisma-migrations-omission-20260826-829e32f6.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。コード・設定・依存関係・テスト・fixture・生成物は変更していません。

### 直接原因

Tauri の resource mapping が原因です。

- [`tauri.conf.json:36`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/tauri.conf.json:36) は `../prisma/**/*` を `runtime/prisma/` にマッピング。
- 生成済み stage と `.app` の両方に `runtime/prisma/migrations/` が存在せず、migration SQL が `runtime/prisma/migration.sql` に平坦化されています。
- `migration.sql` の hash は Postgres migration のファイルと一致し、nested path が潰れて衝突したことも確認できます。
- [`prepare-desktop-node-runtime.js:119`](/Users/kazuya/Desktop/自己学習/Cornell-Method/scripts/prepare-desktop-node-runtime.js:119) は Node と生成済み Prisma client だけをコピーしており、repo の `prisma/` を削除・加工していません。直接原因ではありません。

runtime 側の期待 path は正しく一致しています。

- Rust は release 時に `Contents/Resources/runtime` を root にする（[`runtime.rs:814`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/runtime.rs:814)）。
- launcher は `root/prisma/migrations` を渡す（[`launcher.cjs:43`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/sidecar/launcher.cjs:43)）。
- bootstrap は初回 DB で `readMigrationManifest()` を実行し、directory 不在時に `MIGRATIONS_UNAVAILABLE`／「SQLite migrations directory を読み取れません」となる（[`desktop-storage.js:292`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src/server/infrastructure/desktop-storage.js:292)）。

### 切り出す実装 task

目的: Prisma resource の directory 階層を保持し、次を artifact に含める。

```text
Contents/Resources/runtime/prisma/migrations/
  migration_lock.toml
  20260621073258_init/migration.sql
  20260718011243_remove_notebook_overview/migration.sql
  20260718140000_add_notebook_canvas/migration.sql
  20260809090000_add_notebook_tag_order/migration.sql
```

対象:

- [`src-tauri/tauri.conf.json:36`](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/tauri.conf.json:36)
- resource mapping の static contract を確認する既存 [`test/desktop/desktop-node-runtime.test.js`](/Users/kazuya/Desktop/自己学習/Cornell-Method/test/desktop/desktop-node-runtime.test.js)

推奨修正は、`/**/*` の file glob mapping を Prisma directory mapping に置き換え、`../prisma/migrations/<name>/migration.sql` の相対階層を保持することです。`prepare-desktop-node-runtime.js`、`launcher.cjs`、`runtime.rs`、migration SQL は変更不要です。

完了条件:

- packaged stage と `.app` の双方に `runtime/prisma/migrations/` が存在する。
- repo の SQLite migration 名・SQL・lock が同じ相対 path で存在する。
- fresh Application Support で packaged `bootstrap` が `status=ready` になる。
- 既存の `paths`、catalog、pending-status smoke が回帰しない。

### 検証結果

- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- `git diff --check`: PASS
- `cargo tauri build`、`npm install`、`npm run build`、migration 操作、再パッケージは未実行
- 作業前後の `git status --short` は同一。既存の未コミット変更は保持しました。
- 変更ファイル: なし

残る確認事項は、修正後に実際の `.app` を再生成して packaged bootstrap を通すことです。なお、同じ glob 形式は `.next/server` 等にも使われているため、今回の migration 修正後に packaged `serve` の resource tree も別途確認が必要です。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260826/0121-investigate-packaged-prisma-migrations-omission-20260826-829e32f6-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260826/0121-investigate-packaged-prisma-migrations-omission-20260826-829e32f6-summary.md`
