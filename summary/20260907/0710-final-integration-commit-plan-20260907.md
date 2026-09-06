# 現在差分の確定コミット計画

作成日: 2026-09-07（JST）

## 前提と判断

現在の作業ツリーは、直前の7コミット案に加えて、94本の `.test.js` → `.test.ts` 移行、TypeScript test runner、package scripts / lockfile / tsconfig、stale test 契約修正、test isolation、timeout安定化が加わった状態である。

テストは削除済みJSと未追跡TSの対になっており、機能コミットとrenameコミットへ無理に分割すると、renameの片側だけをstageする事故が起きる。したがって、機能UI・desktop sourceのコミットはsource中心に保ち、94本のTSテストと関連する基盤・契約修正は、全体検証可能な単一コミットへ集約する。これは7案の責務を保ちつつ、renameを常に同一コミット内で完結させる安全な再設計である。

## 確定コミット列

### 1. `feat(notes): add freeword search clear action`

対象:

- `src/modules/notes/ui/components/list/filters.tsx`

依存: なし。

staging: ファイル全体。対応テストは後述のコミット4に含める。

検証: `npm run typecheck`、対象UI test（コミット4でTS版）および `git diff --cached --check`。

### 2. `feat(notes): refine detail review metadata layout`

対象:

- `src/modules/notes/ui/components/detail/display.tsx`
- `src/app/styles/note-paper.css`

依存: なし。

staging: ファイル全体。対応CSS/UI testはコミット4に含める。

検証: 対象UI test、`npm run typecheck`、`git diff --cached --check`。

### 3. `refactor(settings): consolidate general and backup presentation`

対象:

- `src/app/_components/settings/settings-modal.tsx` の General / Updates 表示整理、Data and Backup 表示整理のhunk

依存: なし。コミット4のrecovery-only hunkとは同一ファイル上で重ならないようにする。

staging: `git add -p src/app/_components/settings/settings-modal.tsx` で、カテゴリ整理・初期カテゴリ・UpdatesPanel移動/表示だけをstageする。recovery-only filter / guardはコミット4へ残す。

検証: `npm run typecheck`、設定UI test（コミット4でTS版）、`git diff --cached --check`。

### 4. `test: migrate suite to TypeScript and stabilize contracts`

対象責務:

- `package.json`、`package-lock.json`、`tsconfig.json` のTypeScript test runner / `tsx` / scripts / import設定
- `test/` 配下の全94本の `.test.js` 削除と対応する `.test.ts` 追加（auth、backup、canvas、codex-queue、config、desktop、e2e、notes、postgresの全ファイル）
- 既存機能変更に対応するテスト契約: `test/notes/list-filter-*`、`test/notes/detail-review-metadata-border-contract.test.ts`、`test/desktop/desktop-settings-ui.test.ts` ほか該当TS test
- stale契約修正: `test/desktop/desktop-update-state.test.ts`、`test/notes/accent-contrast-contract.test.ts`、`test/notes/canvas-toolbar-responsive-contract.test.ts`、`test/codex-queue/worker-summary.test.ts`
- isolation修正: `test/config/project-env.test.ts`
- 全体負荷時timeout修正: `test/codex-queue/worker-summary.test.ts` のworker完了待ち10秒→30秒hunk

依存: コード上はコミット1〜3と独立。ただしレビュー・検証はこのコミット単体で完結させ、コミット1〜3のsource変更と組み合わせてもよい。

staging上の注意: `git add -A test package.json package-lock.json tsconfig.json` を使い、各JS削除とTS追加を同時にstageする。rename検出はGitに任せる。機能sourceをこのコミットへ混ぜない。対応テストの修正は、TSファイル内に含まれるため、別機能コミットへpartial stagingしない。

検証:

- `npm run typecheck`
- `npm run test:ts`（563 PASS / 0 FAIL / 7 SKIPの再確認。SKIPはdisposable loopback listener環境制約）
- `npm run test:desktop:lifecycle`
- `npm run test:desktop:node-runtime`
- `npm run test:codex-queue`
- `git diff --cached --check`

### 5. `feat(desktop): separate recovery-only backups from user catalog`

対象:

- `src-tauri/sidecar/launcher.cjs`
- `src-tauri/src/runtime.rs`
- `src-tauri/ui/recovery.js`
- `src/server/infrastructure/desktop-storage.d.ts`
- `src/server/infrastructure/desktop-storage.js`
- `src/shared/desktop/desktop-settings-bridge.ts`
- `src/app/_components/settings/settings-modal.tsx` のrecovery-only filter / guard hunk

依存: コミット3のsettings表示整理後。コミット4のTS test移行後がレビューしやすい。

staging: sourceファイルは、export create-only hunkを除いてstageする。`settings-modal.tsx` はコミット3で残したrecovery-only hunkだけをstageする。`runtime.rs` / `desktop-storage.js` / `launcher.cjs` はexport hunkをコミット6へ残すため `git add -p` を使う。

検証: コミット4のTS suiteに加え、managed catalog / recovery / startup recovery / settingsの対象TS test。

### 6. `fix(desktop): make external export create-only and race-safe`

対象:

- `src-tauri/sidecar/launcher.cjs` のexport validation / request boundary hunk
- `src-tauri/src/runtime.rs` のexisting destination rejection hunk
- `src/server/infrastructure/desktop-storage.js` のexport publish hunk

依存: コミット5。recovery catalogの型・保存境界を先に確定する。

staging: コミット5で残した3 sourceファイルのexport hunkのみをpartial stageする。exportの対応テストはすでにコミット4のTS suiteに含め、テストrenameとexport契約を分離しない。

検証: `test/desktop/desktop-data-backup-boundary.test.ts`、`test/desktop/desktop-data-backup-export.test.ts`、`npm run typecheck`、必要なら `npm run test:ts`。

### 7. `docs: synchronize current desktop contracts and handoff`

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
- `HANDOFF_2026-08-31.md` の削除
- `HANDOFF_2026-09-07.md` の追加

依存: コミット4〜6。TS拡張子、現行export契約、stability evidenceを反映するため最後。

staging: 上記をファイル単位でstage。古いhandoff削除と新handoff追加を同一コミットにする。

検証: `git diff --cached --check`、`rg -n "\.test\.js|Export Replace|HANDOFF_2026-08-31" AGENTS.md doc HANDOFF_2026-09-07.md`。期待結果は現行文書に残すべき参照のみが存在すること。

### 8. `build: point Notebook.app to fresh normal artifact`

対象:

- `Notebook.app` symlink

依存: コミット6のcreate-only実装と最新normal artifact build後。文書同期とは独立だが、最後に置く。

staging: symlink 1件のみをfull-file staging。

検証: `test -L Notebook.app`、`readlink Notebook.app`、必要ならsymlink先の存在確認。

## 除外対象

次は全コミットから除外する。

- `summary/20260906/` 全体
- `summary/20260907/` 全体（この計画summary自身も含む）
- `codex-queue` のruntime artifact、state、ログ、未帰属activity

summaryは検証証跡として読むだけで、成果物としてstageしない。`git add -A` を使う場合は、summaryとqueue runtime artifactが混入していないことを必ずindex確認する。

## renameとpartial stagingの再現手順

1. 作業開始時に `git status --short` と `git diff --stat` を保存し、indexを空にする操作は行わない。
2. コミット1〜3はsourceだけをstageし、`settings-modal.tsx` は `git add -p` でhunkを選ぶ。
3. コミット4では `git add -A test package.json package-lock.json tsconfig.json` とし、94本すべてでJS削除とTS追加を同時にstageする。これにより機能変更済みテストも内容を失わない。
4. コミット5・6は、同一sourceファイルにあるrecovery/export hunkをそれぞれ `git add -p` で分ける。stage後に `git diff --cached --stat` と `git diff --cached --check` を実行する。
5. 各commit前に `git diff --cached --name-status` を確認し、summary、queue runtime artifact、未帰属activityがないことを確認する。

TS移行と機能テスト修正を同一コミットにまとめた理由は、現時点で旧JSは削除済み、TSが未追跡であり、旧JS側のhunkを安全に再構成するよりも、現行TSをrenameの完全な着地点としてレビューする方が再現可能だからである。

## 最終確認

全8コミット後に次を実行する。

```sh
git diff --cached --check
git status --short
git log --oneline -8
```

各commit直後にも `git status --short` を確認する。最終的に、summaryを除く意図した差分がcleanになり、summaryとqueue runtime artifactだけが未追跡として残る状態を期待する。既存のユーザー変更を戻したり、remote操作、push、indexの破壊的なリセットは行わない。

## 検証証跡

- TS test移行後: `.test.ts` 94本、`.test.js` 0本
- `npm run typecheck`: PASS
- `npm run test:ts`: 563 PASS / 0 FAIL / 7 SKIP
- `npm run test:codex-queue`: 15/15 PASS
- project-env isolation focused test: PASS
- worker-summary timeout stabilization focused test: PASS
- 既存のexport create-only / recovery-only境界のfocused tests: PASS
