---
summary_type: task-summary
created_at: 2026-09-07 03:25 JST
task_kind: worker-task
task_status: done
---

## Objective

`plan-current-integration-commit-boundaries-20260907-ea13fabb.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/plan-current-integration-commit-boundaries-20260907-ea13fabb.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/plan-current-integration-commit-boundaries-20260907-ea13fabb.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | Worker が記録した変更ファイルなし | provenance manifest に記録なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/plan-current-integration-commit-boundaries-20260907-ea13fabb.task.md` |
| F-002 | fact | Worker provenance manifest に変更ファイルは記録されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。実際の `git add` / `git commit` は行っていません。作業前後の `git status --short` は同一です。

推奨コミット順は次のとおりです。

1. `feat(notes): add freeword search clear action`

対象:

- `src/modules/notes/ui/components/list/filters.tsx`
- `test/notes/list-filter-layout-contract.test.js`
- `test/notes/list-filter-live-search-contract.test.js`

依存: なし。  
staging: full-file staging で安全。  
検証:

```sh
node --test test/notes/list-filter-layout-contract.test.js test/notes/list-filter-live-search-contract.test.js
```

2. `feat(notes): refine detail review metadata layout`

対象:

- `src/modules/notes/ui/components/detail/display.tsx`
- `src/app/styles/note-paper.css`
- `test/notes/detail-review-metadata-border-contract.test.js`

依存: なし。  
staging: full-file staging で安全。  
検証:

```sh
node --test test/notes/detail-review-metadata-border-contract.test.js
```

3. `refactor(settings): consolidate general and backup presentation`

対象:

- `src/app/_components/settings/settings-modal.tsx`
- `test/desktop/desktop-settings-ui.test.js`

内容:

- General / Updates 表示整理
- Data and Backup 表示整理

注意: `settings-modal.tsx` には recovery-only バックアップ非表示処理も含まれるため、recovery-only を別コミットにする場合は partial staging が必要です。UI 整理だけを先に切り出すなら、`settingsCategories`、初期カテゴリ、`UpdatesPanel` の移動・表示に関する hunk のみを stage します。

4. `feat(desktop): separate recovery-only backups from user catalog`

対象:

- `src-tauri/sidecar/launcher.cjs`
- `src-tauri/src/runtime.rs`
- `src-tauri/ui/recovery.js`
- `src/server/infrastructure/desktop-storage.d.ts`
- `src/server/infrastructure/desktop-storage.js`
- `src/shared/desktop/desktop-settings-bridge.ts`
- `src/app/_components/settings/settings-modal.tsx` の recovery-only filter / guard hunk
- `test/desktop/desktop-data-backup-restore.test.js`
- `test/desktop/desktop-managed-backup-catalog.test.js`
- `test/desktop/desktop-recovery-ui.test.js`
- `test/desktop/desktop-settings-ui.test.js`
- `test/desktop/desktop-startup-recovery.test.js`

依存: 3 の後がレビューしやすい。  
staging: `settings-modal.tsx` は partial staging。その他は原則 full-file staging。  
検証:

```sh
node --test test/desktop/desktop-data-backup-restore.test.js \
  test/desktop/desktop-managed-backup-catalog.test.js \
  test/desktop/desktop-recovery-ui.test.js \
  test/desktop/desktop-settings-ui.test.js \
  test/desktop/desktop-startup-recovery.test.js
```

5. `fix(desktop): make external export create-only and race-safe`

対象:

- `src-tauri/sidecar/launcher.cjs` の export validation / request boundary hunk
- `src-tauri/src/runtime.rs` の existing destination rejection hunk
- `src/server/infrastructure/desktop-storage.js` の export publish hunk
- `test/desktop/desktop-data-backup-boundary.test.js`
- `test/desktop/desktop-data-backup-export.test.js`

依存: managed restore と型境界が同じファイルにあるため、4 の後を推奨。  
staging: `runtime.rs` と `desktop-storage.js` は recovery catalog hunk と export hunk が混在するため partial staging。`desktop-data-backup-export.test.js` も export と restore のテスト hunk が混在するため partial staging。`desktop-data-backup-boundary.test.js` は export 境界 hunk を選別。  
検証:

```sh
node --test test/desktop/desktop-data-backup-boundary.test.js \
  test/desktop/desktop-data-backup-export.test.js
```

6. `docs: synchronize current desktop contracts and handoff`

対象:

- `AGENTS.md`
- `doc/implementation/IMPLEMENTATION_STATUS.md`
- `doc/implementation/MVP_CONTRACT.md`
- `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md`
- `doc/requirements/MVP_SYSTEM_SPEC.md`
- `doc/requirements/PRODUCT_SPEC.md`
- `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`
- `doc/technical/TARGET_ARCHITECTURE.md`
- `doc/testing/TEST_SCENARIOS.md`
- `HANDOFF_2026-08-31.md` 削除
- `HANDOFF_2026-09-07.md` 追加

依存: 4・5 の実装内容を前提とするため最後。  
staging: full-file staging で安全。旧 handoff の削除、新 handoff の追加、`AGENTS.md` の最新参照更新は同じコミットに含める。  
検証:

```sh
git diff --check
rg -n "Export Replace|HANDOFF_2026-08-31" AGENTS.md doc HANDOFF_2026-09-07.md
```

7. `build: point Notebook.app to fresh normal artifact`

対象:

- `Notebook.app`

依存: 5 の実装と最新 artifact build の後。  
staging: symlink 1件の full-file staging。  
検証:

```sh
test -L Notebook.app
readlink Notebook.app
```

文書を実装と同じコミットに含める案も可能ですが、今回は実装・回帰テストと canonical docs / handoff を分離する案を推奨します。実装レビューと文書同期レビューを分けられ、handoff 更新や artifact pointer がコード差分に混ざりません。

除外対象:

- `summary/20260906/`
- `summary/20260907/`

`summary/` は証拠としてのみ扱い、全コミット候補から除外します。provenance にない変更は確認できませんでした。 `git diff --check` は PASS でした。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260907/0325-plan-current-integration-commit-boundaries-20260907-ea13fabb-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| changed-files provenance | 完了 | explicit worker provenance manifest |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260907/0325-plan-current-integration-commit-boundaries-20260907-ea13fabb-summary.md`
