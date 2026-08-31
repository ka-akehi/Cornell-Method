---
summary_type: task-summary
created_at: 2026-08-31 JST
task_kind: inventory
task_status: done
---

# Note UI 差分のコミット境界

## Changes Made

コード、設定、依存関係、Git index は変更していない。開始時と終了時の `git status --short` を確認し、候補Cに含まれる全差分を、コミット候補または保留へ分類した。

## Commit Candidates

### C1. detail delete confirmation / navigation

- whole-file不可。`src/modules/notes/ui/components/detail/actions.tsx` は削除確認 dialog の追加部分（`NoteDetailDeleteConfirmation`、footer の削除 trigger/portal wiring）だけを partial stage。
- `src/modules/notes/ui/components/detail/modes.tsx` は `deleteConfirmationOpen`、`deletingRef`、`openDeleteConfirmation`、`cancelDeleteConfirmation`、`deleteNote` の削除関連 hunk と footer props wiring だけを partial stage。
- `test/notes/detail-delete-confirmation-contract.test.js` は whole-file stage可。
- 依存順: source hunk → focused test。
- focused test: `node --test test/notes/detail-delete-confirmation-contract.test.js`。
- 推奨メッセージ: `fix: add explicit note deletion confirmation`。
- 既存 summary: `summary/20260829/1335-detail-delete-confirmation-20260829-summary.md`, `summary/20260830/0052-separate-detail-delete-and-navigation-error-handling-20260830-a522b1ab-summary.md`。

### C2. detail review confirmation and feedback

- `src/modules/notes/ui/components/detail/actions.tsx` の review confirmation hint/button の変更 hunk（おおむね review action 部分）を partial stage。削除 dialog hunk はC1へ分離。
- `src/modules/notes/ui/components/detail/read-view.tsx` は whole-file stage可。summary unlock hint と accessible description の変更のみ。
- `src/modules/notes/ui/components/detail/display.tsx` は review metadata border/readability hunk をC5へ分離し、review-specific change があれば同一責務で stageする。現差分は表示 token 化が中心のため、実際にはC5に寄せる。
- `test/notes/detail-review-confirmation-contract.test.js` は whole-file stage可。
- `test/notes/detail-review-metadata-border-contract.test.js` はC5の focused testとして stage。
- 依存順: actions/read-view source → review tests。
- focused test: `node --test test/notes/detail-review-confirmation-contract.test.js test/notes/detail-review-metadata-border-contract.test.js`。
- 推奨メッセージ: `fix: clarify note review confirmation state`。
- 既存 summary: `summary/20260829/0800-review-disabled-controls-20260829-summary.md`, `summary/20260829/0823-clarify-review-disabled-actions-20260829-675b1ae6-summary.md`。

### C3. editor metadata, tags, and paper layout

- `src/modules/notes/ui/components/editor/cues.tsx`, `editor.tsx`, `metadata.tsx`, `tags.tsx` は whole-file stage可。ただし `editor.tsx`/`metadata.tsx` の `shell` 削除は layout 責務として含める。
- `test/notes/editor-metadata-contract.test.js`, `editor-paper-layout-contract.test.js`, `editor-title-section-spacing-contract.test.js`, `editor-tags-layout-contract.test.js` は whole-file stage可。
- 依存順: editor source → editor focused tests。
- focused test: 上記4テストを `node --test` で実行。
- 推奨メッセージ: `fix: align note editor metadata and tag layout`。
- タグ候補 disabled state の変更と editor form unified layout は同一 editor UI 責務として扱える。theme token のみを必要とするタグ候補 hunk があればB完了後。

### C4. Canvas light/dark surface synchronization

- `src/modules/notes/ui/components/canvas/viewer.tsx` と `src/modules/notes/ui/hooks/use-note-canvas-runtime.ts` は whole-file stage可。Canvas document geometry/persistence の変更ではなく、surface token と theme change 時の redraw のみ。
- `test/notes/canvas-scroll-contract.test.js` は whole-file stage可。
- 依存順: B（theme provider/token 定義）→ Canvas source → focused test。theme/settings の実装自体はこの候補に含めない。
- focused test: `node --test test/notes/canvas-scroll-contract.test.js`。必要に応じて TypeScript check。
- 推奨メッセージ: `fix: synchronize canvas surfaces with app theme`。
- Canvas runtime の実ブラウザ visual QA は未確認。保存形式・要素 geometry は差分上変更なし。

### C5. Markdown and detail readability

- `src/shared/markdown/markdown-field.tsx` は whole-file stage可。
- `src/modules/notes/ui/components/detail/display.tsx` は whole-file stagingせず、Cue/metadata/tag の semantic token hunk だけを partial stage。review-specific border test もここに含める。
- `test/notes/markdown-preview-contract.test.js` と `test/notes/detail-review-metadata-border-contract.test.js` は whole-file stage可。
- `src/app/styles/foundation.css` の token/theme 全体はB（theme/settings）に属し、この候補には含めない。したがってC5はBの token 定義が先行していることが必要。
- focused test: `node --test test/notes/markdown-preview-contract.test.js test/notes/detail-review-metadata-border-contract.test.js`。
- 推奨メッセージ: `fix: improve dark-mode note readability`。
- 既存 summary: `summary/20260829/markdown-detail-dark-readability-20260829-summary.md`。

### C6. app chrome mobile settings entrypoint

- `src/app/_components/app-chrome.tsx` は whole-file不可。mobile header の settings button removal と sidebar entrypoint addition の両 hunkだけを partial stage。
- `test/notes/app-chrome-contract.test.js` と `test/notes/app-chrome-responsive-contract.test.js` は、settings/theme/general-category 等の混在がない確認後に該当 hunk のみ partial stage。whole-file stageしない。
- 依存順: app-chrome hunk → app-chrome focused tests。`settings-modal.tsx`/CSS は含めない。
- focused test: `node --test test/notes/app-chrome-contract.test.js test/notes/app-chrome-responsive-contract.test.js`。
- 推奨メッセージ: `fix: move mobile settings entry into sidebar`。
- 既存 summary: `summary/20260829/1644-move-mobile-settings-button-into-sidebar-20260829-d747965a-summary.md`。

## Hold / Excluded

- `src/app/styles/foundation.css`、theme provider、settings modal、settings UI tests の theme/settings 差分は候補Cから除外し、Bの別責務とする。
- `src/modules/notes/ui/components/detail/actions.tsx` と `modes.tsx` の provenance不明・他責務 hunk は、上記C1/C2に明確に対応付けられない限り保留。whole-file commitしない。
- `src/app/_components/app-chrome.tsx` と app-chrome tests に settings/theme/general-category の混在 hunk が残る場合は保留し、C6へ無理に含めない。
- `Notebook.app`、summary、queue temporary files、desktop runtime/auth/backup/transport/proxy、icon binary/source は候補C対象外。
- Canvas/Markdown の dark token 依存はB先行。Bが未確定ならC4/C5は保留。

## Verification

- `git status --short`: 開始時・終了時とも index 変更なし。未コミット変更は保持した。
- `git diff --stat` と `git diff --unified=0` で対象21ファイルの hunk 境界を確認した。
- focused tests、lint、build、typecheck はこの棚卸しでは再実行していない。各関連 Worker summary に記録された既存の focused PASS を採用し、実ブラウザ/Tauri visual QA は未確認として維持する。
- `worker-record-change.sh` で本 summary を provenance に記録する。

## Next Read

- `summary/20260831/inventory-all-remaining-changes-for-commit-20260831.md`
- `summary/20260829/1335-detail-delete-confirmation-20260829-summary.md`
- `summary/20260830/0052-separate-detail-delete-and-navigation-error-handling-20260830-a522b1ab-summary.md`
- `summary/20260829/markdown-detail-dark-readability-20260829-summary.md`
- `src/modules/notes/ui/components/detail/actions.tsx`
- `src/modules/notes/ui/components/detail/modes.tsx`
