# `.test.js` → `.test.ts` 棚卸しと Worker 分割案

作成日: 2026-09-07

## 調査結果

`rg --files test | rg '\\.test\\.js$'` で残存 93 本を確認した。代表の
`test/notes/date-only-contract.test.ts` は移行済みで、今回の対象は残り 93 本。
`.cjs` fixture、実行対象の `.js` source、`scripts/*.js` はテスト名ではないため
対象外。最終状態では `test/**/*.test.js` を 0 本にする。

境界の目安は、通常の Node/TS import、source-text/AST (`readFileSync` と
`typescript`/`vm`)、CJS/JS 対象、child process/CLI、SQLite/一時ディレクトリ、
環境変数である。集計上 `__dirname` 82、`readFileSync` 87、`child_process` 18、
SQLite 関連 24、`.cjs` を文字列で扱うもの 13（重複あり）。CommonJS のテストを
TS化しても、対象モジュールの挙動・拡張子・fixture は変更しない。

## 変更中ファイルの扱い

作業開始時点で以下のテストに未コミット変更がある。これらは rename/変換時に
現行作業ツリーの内容をそのまま入力にし、既存差分を戻さず、移行に必要な型注釈
以外の機能変更を混ぜない。

- `test/desktop/desktop-data-backup-boundary.test.js`
- `test/desktop/desktop-data-backup-export.test.js`
- `test/desktop/desktop-data-backup-restore.test.js`
- `test/desktop/desktop-managed-backup-catalog.test.js`
- `test/desktop/desktop-recovery-ui.test.js`
- `test/desktop/desktop-settings-ui.test.js`
- `test/desktop/desktop-startup-recovery.test.js`
- `test/notes/detail-review-metadata-border-contract.test.js`
- `test/notes/list-filter-layout-contract.test.js`
- `test/notes/list-filter-live-search-contract.test.js`

`date-only-contract.test.js` の削除と `.ts` 新規は既存の先行移行として扱い、
後続taskの対象に戻さない。

## 後続 Worker task 案

各行のファイル集合は相互排他的で、全 93 本を網羅する。`test/**` の rename と
同一テストの変換は同じ task に閉じ込める。UI 系は `codex-queue/tasks-ui`、
API/データ境界は `codex-queue/tasks-api`、その他は `codex-queue/tasks`。

| ID / queue | 対象 | 主な変換・完了条件 | 検証 / 依存 |
|---|---|---|---|
| T1 / tasks-api | `test/auth/basic-auth.test.js`; `test/config/{project-env,security-headers-contract}.test.js`; `test/backup/*.test.js` (7) | Node builtin と TS対象を typed import に置換。環境変数、fixture、caught error を明示型で保持。9本が `.test.ts` で strict typecheck 可能。 | `npx tsc --noEmit`; focused `node --import tsx/esm --test`。共有基盤なし。 |
| T2 / tasks-ui | `test/notes/{accent-contrast-contract,app-chrome-contract,app-chrome-responsive-contract,canvas-initial-tool-contract,canvas-scroll-contract,canvas-toolbar-responsive-contract,canvas-toolbar-visibility-contract,cue-display-contract,cue-heading-contract,date-picker-contract,detail-actions-layout-contract,detail-delete-confirmation-contract,detail-mode-url-contract,detail-paper-layout-contract,detail-review-close-contract,detail-review-confirmation-contract,detail-review-feedback-contract,detail-review-metadata-border-contract,detail-summary-checkbox-contract}.test.js` (19) | source-text/AST は `readFileSync`、`typescript`、`vm`、`__dirname` を保持。変更中の metadata-border を含む。alias import、fixture object、caught error に型を付ける。 | `npx tsc --noEmit`; T2 focused `tsx` test。先行 T1 不要。 |
| T3 / tasks-ui | `test/notes/{detail-title-section-spacing-contract,editor-error-focus-contract,editor-metadata-contract,editor-paper-layout-contract,editor-tags-layout-contract,editor-title-section-spacing-contract,list-filter-layout-contract,list-filter-live-search-contract,list-header-contract,list-visual-contract,markdown-list-enter,markdown-preview-contract,markdown-task-list,note-date-immutability-contract,note-editor-enter-submit-contract,note-editor-save-concurrency-contract,note-paper-spacing-contract,tag-order-contract,tag-schema-contract}.test.js` (19) | T2 と同じ source contract 型。`.js` dynamic load は `pathToFileURL`/typed declaration 等を必要箇所だけ採用。変更中の list 3本を保持。 | `npx tsc --noEmit`; T3 focused `tsx` test。T2 とは並列可。 |
| T4 / tasks | `test/canvas/fabric-metadata.test.js`; `test/e2e-cleanup-contract.test.js`; `test/postgres/{data-migration-contract,operator-backup-contract}.test.js` (4) | `jiti`/CJS、child process、callback、CLI script、環境依存を境界として維持。`execFile`/`spawn` callback と拒否時 error を typed 化。 | `npx tsc --noEmit`; 4本の focused `tsx` test。T2/T3 と並列可。 |
| T5 / tasks | `test/codex-queue/{risk-assessment,worker-policy,worker-summary}.test.js` (3) | queue script の child process/CLI、`__dirname`、callback/stdout を typed 化。script と fixture の `.js`/`.cjs` は変更しない。 | `npm run test:codex-queue` は scripts 更新後、移行中は `node --import tsx/esm --test test/codex-queue/*.test.ts`; T5完了後 T8。 |
| T6 / tasks-api | `test/desktop/{desktop-api-bridge-contract,desktop-backup-recovery,desktop-close-bridge,desktop-data-backup-boundary,desktop-data-backup-delete,desktop-data-backup-export,desktop-data-backup-pending,desktop-data-backup-restore,desktop-devtools-contract,desktop-diagnostic-bridge,desktop-diagnostics,desktop-instance,desktop-lifecycle,desktop-managed-backup-catalog,desktop-node-runtime,desktop-recovery-ui,desktop-settings-bridge,desktop-settings-shell,desktop-settings-ui,desktop-startup-recovery,desktop-storage,desktop-tauri-capability,tauri-icon-contract}.test.js` (23) | desktop bridge/static contract と child process/SQLite/temp path を分離して型付け。JS/CJS runtime や `.cjs` は対象外。変更中の7本を保持。 | `npx tsc --noEmit`; desktop 23本 focused `tsx` test。T8前は package scriptを変更しない。 |
| T7 / tasks-api | `test/desktop/desktop-update-{apply,archive,bundle,check,download,manifest,migration,provider,recovery,selection,signature,startup-check,state,target,verification}.test.js` (15) | update source contract、SQLite、crypto、child process、dynamic path を保持。caught error/fixture object と callback の型を補う。 | `npx tsc --noEmit`; update glob focused `tsx` test。T6 と並列可。 |
| T8 / tasks | T1–T7 の全 rename 後、`package.json` の `test:desktop:lifecycle`、`test:desktop:node-runtime`、`test:codex-queue` を `.test.ts` と `tsx` runnerへ更新 | scripts のみ更新し、`test:ts` は既存の `node --import tsx/esm --test "test/**/*.test.ts"` を維持。現行文書の生きた `.test.js` 参照を `.test.ts` に同期（対象は `doc/implementation/IMPLEMENTATION_STATUS.md`, `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md`, `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`, `doc/testing/TEST_SCENARIOS.md`）。過去 summary/done/failed task は変更しない。 | T1–T7 完了後。`rg --files test | rg '\\.test\\.js$'` が空、`npm run typecheck`, `npm run test:ts`, 各専用 script、`npm run lint`。 |

## 共通の実装判断

- `require` は原則 `node:` builtin の named/default import または `import ... from`
  に置換する。対象が CJS/`.js` の場合は拡張子を維持し、既存 declaration、
  `createRequire`、または最小の局所型を使う。対象 source の module 形式を変更しない。
- `__dirname` は TS ESM で `fileURLToPath(import.meta.url)` と `dirname` に移行し、
  project root/fixture の解決結果を変えない。dynamic load は URL 化または
  `createRequire` を使い、単なる文字列中の `.js`/`.cjs` は変更しない。
- `readFileSync` で読む source-text、AST、`vm` 実行文字列はテスト対象そのものなので、
  `.js` の拡張子・文言・行契約を変えない。型エラー解消のため assertion を緩めない。
- `spawn`/`execFile` の callback と `caught error` は `unknown` から narrowing し、
  `fixture object` は interface/type を局所定義する。SQLite は既存の disposable
  temp path、DB URL、cleanup 順序を維持する。

## 全体検証の依存関係

T1–T7 は相互に異なるテストファイルを持つため並列実行できる。T8 は全 rename 後に
のみ開始する。T8 の script/docs 同期後、`rg` で `.test.js` 残存と現行文書の参照を
確認し、`npm run typecheck` → `npm run test:ts` → 専用 script → `npm run lint` の順で
検証する。Node version 固定、依存追加、fixture `.cjs` の rename は行わない。

## 作業前後の確認

実施した read-only 確認は `git status --short`、テスト一覧、pattern 集計、
`package.json`/`tsconfig.json`/現行文書の参照検索。完了時も `git status --short` を
再実行し、既存の変更を復元・整理しない。

### Next Read

1. この summary
2. `HANDOFF_2026-09-07.md`
3. T1–T8 のうち着手する task に記載した対象ファイル
