---
summary_type: task-summary
created_at: 2026-08-31 JST
task_kind: inventory
task_status: done
---

# 全未コミット変更の棚卸し

## Changes Made

コード、Git index、設定、依存関係、生成物は変更していない。開始時と終了時の `git status --short` を照合し、現存する全項目を次の分類に割り当てた。直近 HEAD は `9d07603`、その親は `6fe6a2b`、`f1de152` であり、これら3コミットに含まれるバックアップ関連変更は対象から除外した。

### A. コミット候補: Desktop runtime / bridge / recovery（追加検証後）

目的は Tauri の capability、sidecar、single-instance、startup recovery、diagnostics、same-origin、typed desktop bridge を一つの実行基盤責務としてまとめること。対象は次のとおり。

`src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`, `src-tauri/sidecar/launcher.cjs`, `src-tauri/src/diagnostics.rs`, `src-tauri/src/instance.rs`, `src-tauri/src/lifecycle.rs`, `src-tauri/src/main.rs`, `src-tauri/src/runtime.rs`, `src-tauri/permissions/app-commands.toml`, `src/shared/desktop/desktop-api-bridge.ts`, `src/modules/backup/remote/index.ts`, `src/modules/notes/remote/transport.ts`, `src/proxy.ts`, `test/desktop/desktop-lifecycle.test.js`, `test/desktop/desktop-startup-recovery.test.js`, `test/desktop/desktop-api-bridge-contract.test.js`, `test/desktop/desktop-devtools-contract.test.js`, `test/desktop/desktop-tauri-capability.test.js`, `test/desktop/tauri-icon-contract.test.js`。

`runtime.rs`, `diagnostics.rs`, `main.rs` は複数 Worker の変更が混在するため whole-file staging 不可。直近 summary が指定する symbol／hunk（file-dialog failure metadata、AppleScript cancel/error、diagnostic record/export、backup dialog command、bridge/204、instance fallback 等）だけ partial stage する。その他の起動・更新・diagnostic 変更を含める場合は同じ cohesive runtime commit として先に source review が必要。permission file と bridge、transport、proxy は whole-file staging 可だが、契約テストと同一 commit にする。

先行依存: A の source が揃ってからテストを stage。最小検証: `npm run lint`、対象 desktop Node tests、`cargo fmt --check`、可能なら `cargo test`、`git diff --cached --check`。cargo test と packaged GUI/loopback/DB read-back は既知の環境制約で未確認。推奨メッセージ: `feat: consolidate desktop runtime and native API boundaries`（file-dialog 部分だけなら既存候補 `fix: harden native backup file dialogs and remove duplicate settings link`）。

### B. コミット候補: Theme / settings shell / visual system（追加検証後）

目的は theme preference と dark-mode の UI 実装。`src/app/_components/theme/theme-provider.tsx`, `src/app/_components/theme/theme.ts`, `src/app/layout.tsx`, `src/app/_components/settings/settings-modal.module.css`, `src/app/_components/settings/settings-modal.tsx`, `src/app/styles/app-shell.css`, `src/app/styles/canvas-spike.css`, `src/app/styles/desktop-close-dialog.css`, `src/app/styles/foundation.css`, `src/app/styles/note-canvas-surface.css`, `src/app/styles/note-canvas-toolbar-controls.css`, `src/app/styles/note-canvas-toolbar-layout.css`, `src/app/styles/note-paper.css`。関連する `test/desktop/desktop-settings-ui.test.js` は backup link、theme、category、confirmation の hunk が混在するため partial stage。

CSS と新規 theme files は whole-file staging 可。settings modal、layout、settings test は partial stage 必須（重複 backup link、general category、delete copy、theme が同居）。先行依存なし。最小検証: focused settings/theme tests、`npx tsc --noEmit`、targeted ESLint、`git diff --cached --check`。全体 lint は既知の既存エラーあり。推奨メッセージ: `feat: add persistent theme preferences`。

### C. コミット候補: Note editor/detail UI polish（追加検証後）

目的は detail review/delete/navigation、editor cue/metadata/tags、Canvas viewer/runtime、Markdown dark readability とレイアウト調整。`src/app/_components/app-chrome.tsx`, `src/modules/notes/ui/components/canvas/viewer.tsx`, `src/modules/notes/ui/components/detail/actions.tsx`, `display.tsx`, `modes.tsx`, `read-view.tsx`, `src/modules/notes/ui/components/editor/cues.tsx`, `editor.tsx`, `metadata.tsx`, `tags.tsx`, `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts`, `src/shared/markdown/markdown-field.tsx`, `test/notes/app-chrome-contract.test.js`, `app-chrome-responsive-contract.test.js`, `canvas-scroll-contract.test.js`, `detail-review-confirmation-contract.test.js`, `detail-review-metadata-border-contract.test.js`, `detail-delete-confirmation-contract.test.js`, `editor-metadata-contract.test.js`, `editor-paper-layout-contract.test.js`, `editor-title-section-spacing-contract.test.js`, `editor-tags-layout-contract.test.js`, `markdown-preview-contract.test.js`。

各ファイルは原則 whole-file stage 可。ただし `app-chrome.tsx`、`settings-modal.tsx`、`desktop-settings-ui.test.js` に別責務が混在するため、そこだけ partial stage。先行依存なし。最小検証: notes focused tests、typecheck、targeted lint、`git diff --cached --check`。推奨メッセージ: `fix: refine note editor and detail interactions`。

### D. コミット候補: Basic auth boundary（追加検証後）

`src/server/auth/basic-auth.js`, `test/auth/basic-auth.test.js`, `src/proxy.ts` の auth 関連 hunk。認証境界だけを whole-file stage できるか確認し、`src/proxy.ts` の same-origin hunk と混在する場合は partial stage。最小検証: `node --test test/auth/basic-auth.test.js` と対象 lint。推奨メッセージ: `fix: tighten local basic-auth handling`。意図・現行契約の再確認なしには stage しない。

### E. 文書コミット候補

`HANDOFF_2026-08-28.md` の追加と `HANDOFF_2026-08-22.md` の削除は、最新引き継ぎの差し替えとして whole-file stage 可。`AGENTS.md` は最新 handoff 参照更新だけを確認し、同じ文書責務として stage。コード成果とは独立させ、`docs: refresh current project handoff` とする。handoff 内の未解決 runtime / same-origin / packaged QA 境界を変更しないことを確認する。

## Verification

- `git status --short`: 全 tracked/untracked 項目を確認。開始時・終了時とも index に変更なし。
- `git log -3 --oneline`: `9d07603`, `6fe6a2b`, `f1de152` を確認。重複対象から除外。
- 指定期間の summary と handoff の Changes Made / Verification / Remaining Work / Next Read を参照。特に 2026-08-31 backup boundary summary の partial-stage 指示を採用。
- 実装テスト、lint、build、cargo test はこの棚卸しでは再実行していない。既存 summary 上、focused checks は複数 PASS、全体 lint は既知エラー、cargo test と packaged runtime は環境制約または未確認。

## Remaining Work

### 保留・コミットしないもの

- `Notebook.app`: packaged artifact / symlink。通常のソース成果コミットに含めない。
- `codex-queue/tasks-common/queued/enable-diagnostic-webinspector-build-20260828-19817f15.task.md`: 運用キュー。別途 queue lifecycle で処理する。
- `codex-queue/tasks/queued/inventory-all-remaining-completed-changes-for-commit-20260831-e193a8c8.task.md.tmp`: queue の一時ファイル。task 完了処理で消えるべき運用残骸であり、手動コミットしない。
- `summary/20260826`〜`summary/20260831` の全 summary: 運用記録。ソース成果コミットに含めない。
- `src-tauri/icons/icon.png`: 生成／packaged icon の binary。`src-tauri/icons/icon.svg` と icon 関連テストを採用する明確な product change として別判断するまで保留。
- `src-tauri/icons/icon.svg`: 新規 icon source。PNG と同時に採用するなら独立した icon commit、そうでなければ保留。

未完了・由来不明として、A〜D の混在 hunk は whole-file commit しない。特に `runtime.rs` 605 行、`settings-modal.tsx` 312 行、`detail/actions.tsx` 235 行、foundation CSS 190 行の差分は、summary provenance が複数責務を示すため、symbol 単位の diff review と focused verification 後にのみ stage する。same-origin の実ユーザー runtime、packaged GUI、native dialog、DB/backup read-back は handoff 上 UNKNOWN/BLOCKED であり、これらを解消済みとするコミット理由にはしない。

## Next Read

1. `HANDOFF_2026-08-28.md`
2. `summary/20260831/0927-inventory-backup-file-dialog-commit-boundary-20260831-55604672-summary.md`
3. `summary/20260829/0440-add-theme-preference-settings-20260829-4c07ff8b-summary.md`
4. `summary/20260830/0052-separate-detail-delete-and-navigation-error-handling-20260830-a522b1ab-summary.md`
5. A〜D を stage する前に対象ファイルの `git diff` を再確認し、partial-stage boundary と focused tests を固定する。
