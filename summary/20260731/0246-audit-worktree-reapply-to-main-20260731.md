# Worktree 差分棚卸し Summary

## Objective

古い local branch `agent/fix-date-editor-scroll-20260727` の未コミット差分を失わず、最新 `origin/main` (`79dfd13`) から再作成する `develop` へ安全に移すため、tracked / untracked の各変更を分類し、再適用候補・載せ直さない変更・判断事項・検証順序を固定する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | 現在の tracked / untracked worktree、local HEAD と `origin/main` の関係、UI、Postgres migration、E2E / tests、handoff / summary |
| 比較基準 | local HEAD `34fa64e`、`origin/main` `79dfd13`、merge-base `2c433e6` |
| 対象外 | コード・設定・依存関係・生成物の変更、branch / index / stash / worktree の変更、commit / push / PR / Issue 操作、runtime E2E |

## Inputs Read

| 種別 | パス / コマンド | 確認内容 |
|---|---|---|
| repository rules | `AGENTS.md`、`summary/README.md`、`summary/task-summary-template.md` | handoff 更新、summary、PR 対象外ルール |
| current contracts | `doc/implementation/MVP_CONTRACT.md`、`doc/technical/TARGET_ARCHITECTURE.md`、`doc/implementation/IMPLEMENTATION_STATUS.md`、`doc/testing/TEST_SCENARIOS.md` | MVP / Phase 2 境界、UI / tests の現行契約 |
| handoff | `HANDOFF_2026-07-30.md` | 未コミット UI / migration / E2E の由来と未確認範囲 |
| manager summary | `summary/20260731/manager-next-work-organization-20260731.md` | worktree 整理を先行する判断 |
| related summaries | `summary/20260727/`、`summary/20260729/`、`summary/20260730/`、`summary/20260731/` | UI、E2E、migration、handoff の目的と過去検証 |
| Git state | `git status --short`、`git status --short --ignored`、`git diff HEAD`、`git diff origin/main`、`git show origin/main:<path>`、hash 比較、branch graph | ファイル単位・hunk 単位の包含関係 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260731/0246-audit-worktree-reapply-to-main-20260731.md` | 本棚卸し結果を追加 | 後続作業を raw diff / raw log なしで再開するため |

アプリコード、設定、依存関係、DB、生成物、branch、index、stash、worktree、queue task state は変更していない。Worker progress metadata のみ指定コマンドで更新した。

## Findings

### Branch / comparison boundary

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 現在 branch は `agent/fix-date-editor-scroll-20260727`、HEAD は `34fa64e`、`origin/main` は `79dfd13`。 | `git branch --show-current`、`git rev-parse` |
| F-002 | fact | merge-base は `2c433e6` で、HEAD と `origin/main` は互いに ancestor ではない。古い branch の commit を単純 fast-forward / rebase 前提で扱えない。 | `git merge-base`、`git merge-base --is-ancestor` |
| F-003 | fact | `79dfd13` は single-parent の GitHub merge commit で、message に PR #41、#46、#51、#50、#47、#49 の統合内容が列挙されている。個別 commit provenance は path log では原則 `79dfd13` に集約される。 | `git show --pretty=raw origin/main` |
| F-004 | fact | `git diff origin/main` が E2E / workflow / handoff を削除差分として示すのは、古い index / HEAD を基準に worktree を比較するため。現在の worktree に存在しない main-only file を「未コミット削除」と判定してはいけない。 | `git diff --name-status HEAD..origin/main`、物理 file 存在確認 |

### Tracked changes: all 19 files

#### `origin/main` と worktree が同一（17 files、載せ直さない）

| 目的 | 対象ファイル | main 側の根拠 / behavior |
|---|---|---|
| E2E ignore / lint policy | `.gitignore`、`eslint.config.mjs` | worktree blob と `origin/main` blob が同一。`79dfd13` の PR #49 統合に E2E 設定・cleanup が含まれる。 |
| 最新 handoff 切替 | `AGENTS.md`、`HANDOFF_2026-07-26.md`（削除） | worktree state と main が同一。未追跡 `HANDOFF_2026-07-30.md` も main blob と同一で、`79dfd13` の PR #51 統合済み。 |
| Postgres native reader fallback | `scripts/postgres-migration-common.js`、`test/postgres/data-migration-contract.test.js` | worktree blob と main が同一。require / constructor の native load failure のみ SQLite CLI fallback し、open / query failure は fallback しない契約を PR #50 が統合済み。 |
| note paper / Cornell layout | `src/app/styles/app-shell.css`、`src/app/styles/note-paper.css`、`src/modules/notes/ui/components/editor/cues.tsx`、`src/modules/notes/ui/components/editor/metadata.tsx` | compact spacing、section divider、30% Cornell divider、single-column / mobile 非表示、metadata handoff、Cue 直接枠が main と同一。PR #47 に統合済み。 |
| Markdown input / preview UI | `src/modules/notes/ui/components/editor/body.tsx`、`src/modules/notes/ui/components/editor/summary.tsx`、`src/shared/markdown/markdown-field.tsx`、`test/notes/markdown-preview-contract.test.js` | input / preview toggle、初期 input、ARIA、Body / Summary opt-in が main と同一。PR #47 に統合済み。 |
| tag validation / layout | `src/modules/notes/ui/components/editor/editor.tsx`、`src/modules/notes/ui/components/editor/tags.tsx` | 30文字超過の明示エラー、成功時だけ input clear、stale API error clear、long chip truncate + full title が main と同一。PR #47 に統合済み。 |
| UI regression contract | `test/notes/note-paper-spacing-contract.test.js` | compact spacing、divider、Cue / Summary border、responsive contract が main と同一。PR #47 に統合済み。 |

上記17ファイルは `git diff --quiet origin/main -- <path>` がすべて成功した。旧 branch から file 全体または commit を再適用すると重複 commit になり、main の follow-up を巻き込む危険がある。

#### main と異なる tracked file（2 files、hunk 単位で分類）

| ファイル | worktree hunk | 分類 | 根拠 / 注意 |
|---|---|---|---|
| `doc/testing/TEST_SCENARIOS.md` | 「再実行可能な Playwright E2E」section 追加 | main 反映済み | section 全体は main に存在する。 |
| `doc/testing/TEST_SCENARIOS.md` | coverage 説明へ「作成後の `GET /api/notes/:id` による Cue 本文・順序の復元」を追加 | **判断が必要な docs-only 候補** | main の `e2e/mvp-note-flow.spec.js` は2件の Cue を作り、GET response の `text` / `order` を照合しているが、main の説明文だけはこの句を欠く。実装復旧ではなく、正確な coverage 文書化を行うかの判断事項。 |
| `test/notes/editor-metadata-contract.test.js` | tag 成功時 clear、長さ、chip、stale error の tests | main 反映済み | worktree の追加 tests はすべて main に存在する。 |
| `test/notes/editor-metadata-contract.test.js` | file 全体の worktree state | **載せ直さない** | main はさらに date input の `showPicker()` / focus fallback と native label activation の regression test を持つ。worktree file を上書きすると main の Issue #62 follow-up test を削除する。 |

### Local HEAD commits

| commit | 目的 | 判定 |
|---|---|---|
| `fb6d25c` | editor column scroll、JST date-only | `origin/main` の PR #41 統合済み。対象 source / tests は、main follow-up がある metadata test を除き worktree と main が同一。 |
| `3da0a3e` | source clearing、scroll boundary handoff | `origin/main` の PR #41 統合済み。 |
| `34fa64e` | new note page spacing | `origin/main` の PR #41 / #47 統合後 tree に同等または後続改善が存在。cherry-pick / patch 再適用は不要。 |

### Untracked / ignored

| 対象 | 分類 | 内容 |
|---|---|---|
| `HANDOFF_2026-07-30.md` | main 反映済み | worktree blob `6a512bc...` と main blob が一致。local では未追跡だが main では tracked。コピー・再commit不要。 |
| `summary/20260727/` の未追跡7件 | summary / 運用記録、commit / PR 対象外 | 実装の復旧元にせず、判断根拠と履歴として current worktree に保持する。 |
| `summary/20260729/` の未追跡10件 | summary / 運用記録、commit / PR 対象外 | 同上。 |
| `summary/20260730/` の未追跡37件 | summary / 運用記録、commit / PR 対象外 | 同上。 |
| `summary/20260731/` の既存未追跡9件 + 本 summary | summary / 運用記録、commit / PR 対象外 | 同上。 |
| `.next/` | ignored generated output、commit 対象外 | 過去 build / dev output。main への移行入力にしない。 |
| `.env`、`.DS_Store` | ignored local / secret metadata、commit 対象外 | 内容を表示・移行・commit しない。 |
| E2E source / config (`e2e/*.js`、`playwright.config.js`、`test/e2e-cleanup-contract.test.js`) | **現在の worktree には存在しない。main-only** | 旧 handoff は当時の未追跡成果物として記録するが、今回の物理 file 確認では absent。`origin/main` には PR #49 / follow-up 済みの最新版があるため、削除差分として扱わない。 |
| `node_modules/` | 空 | directory は存在するが直下 entry がない。現状では npm lint / build / Playwright を実行できる依存関係がない。 |

## Develop へ載せる commit 候補

### 必須候補

なし。現在の tracked 実装・設定・test・handoff 変更は、すべて `origin/main` に同等内容が存在する。

### 判断後の任意候補

| 候補 | 対象ファイル | 目的 | 依存関係 | 最低限の検証 |
|---|---|---|---|---|
| `docs: document Cue roundtrip E2E coverage` | `doc/testing/TEST_SCENARIOS.md` の1句だけ | main の実 E2E behavior と coverage 文書を一致させる | `origin/main` の PR #49 / Issue #59 follow-up にある `e2e/mvp-note-flow.spec.js` | `git diff --check`、main の spec で Cue `text` / `order` assertion を目視照合。doc-only のため build は必須ではない。 |

この任意候補を採用する場合も、worktree の `TEST_SCENARIOS.md` 全体をコピーせず、最新 main の1文だけを編集する。

## 載せ直さない目的別変更群

| 旧 worktree の目的 | main の統合根拠 | 再適用リスク |
|---|---|---|
| editor scroll / JST date / source clear / new-note spacing | `79dfd13` message の PR #41 | duplicate change、後続 CSS / date label fix との競合 |
| layout、Markdown toggle、tag states | `79dfd13` message の PR #47、blob 一致 | file 全体適用で Issue #48 / #62 follow-up を巻き戻す |
| SQLite CLI fallback | `79dfd13` message の PR #50、blob 一致 | duplicate implementation / tests |
| handoff 更新 | `79dfd13` message の PR #51、blob 一致 | duplicate docs、古い scope を再混入 |
| repeatable Playwright E2E / lint / cleanup | `79dfd13` message の PR #49 | current worktree に source がなく、main-only files を削除扱いする危険 |

## Safe migration order

1. **現在の worktree をそのまま保全する。** branch switch、stash、reset、clean、checkout で触らない。移行完了・検証・発注者確認まで削除しない。
2. `git status --short`、`git rev-parse HEAD`、`git rev-parse origin/main`、本 summary を checkpoint とする。必要なら repository 外へ `git diff --binary HEAD` と未追跡 handoff / summary の別 backup を作るが、patch を main へ一括適用しない。
3. local `develop` は削除済み remote を指す旧 `2c433e6` なので、まず `archive/develop-pre-main-20260731` などへ**名前を変えて pointer を保存**する。削除や force-move はしない。
4. current worktree と別 directory に `origin/main` (`79dfd13`) から新しい `develop` worktree を作る。これにより現在の dirty worktree を一切切り替えずに作業できる。
5. 新 worktree で `git status --short` が clean、`git diff --quiet origin/main` が成功することを確認する。旧 branch の3 commit、`git diff HEAD`、`git diff origin/main` を一括 cherry-pick / apply しない。
6. 発注者が任意 docs 追補を採用した場合だけ、最新 main の `doc/testing/TEST_SCENARIOS.md` へ1句を追加し、docs-only commit とする。summary は stage / commit / PR 対象から除外する。
7. 依存関係を復旧して baseline を検証する。成功後も旧 dirty worktree は発注者確認まで保持する。
8. commit / push / PR は別 task とし、必要なら GitHub Issue の `Closes #...` を PR 本文へ記載する。今回の棚卸しでは実行しない。

### Dependency restoration before verification

新しい `develop` worktree では `origin/main` の `package-lock.json` を正として次を行う。

1. `npm ci`
2. `npm run prisma:generate`
3. Playwright Chromium が未導入なら `npx playwright install chromium`
4. Postgres fallback test / operator smoke 前に `command -v sqlite3` を確認する。今回の環境では `/usr/bin/sqlite3` が見つかった。

現在の空 `node_modules` を再利用せず、古い worktree の `package.json` / `package-lock.json` を新 develop へコピーしない。main には `@playwright/test` と `playwright` の `1.61.0` pin、`test:e2e` script がすでにある。

### Verification order after dependency restoration

| 順序 | コマンド / 確認 | 目的 |
|---|---|---|
| 1 | `git diff --check` | whitespace / patch integrity |
| 2 | `npm run lint` | repository lint |
| 3 | `npx tsc --noEmit --pretty false` | TypeScript |
| 4 | `node --test test/notes/*.test.js test/postgres/*.test.js test/e2e-cleanup-contract.test.js` | UI / migration / E2E cleanup contracts |
| 5 | `npm run build` | Prisma generate を含む production build |
| 6 | `npm run test:e2e` | isolated `prisma/e2e.db` による主要 MVP flow |
| 7 | Browser runtime QA | note paper spacing、Cornell divider、tag、date picker / label、Cue / Summary、scroll handoff。静的 test を視覚 PASS に読み替えない。 |
| 8 | isolated Postgres operator smoke（別 task） | 実 native load failure、SQLite CLI fallback、read-only source import。hosted migration / Production 変更とは分離する。 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前後の `git status --short` | 確認済み | 既存 tracked 19 files、未追跡 handoff / summary を保持。作業後は本 summary 1件だけが追加された |
| branch / SHA / merge-base | 確認済み | HEAD `34fa64e`、main `79dfd13`、merge-base `2c433e6` |
| tracked file hash / diff classification | 17 files exact main、2 files mixed | `git diff --quiet origin/main -- <path>` と三方向 diff で確認 |
| `git show origin/main:<path>` | 確認済み | main E2E Cue assertion、date input / label follow-up、package scripts を確認 |
| E2E file physical existence | current worktree では absent | main-only files。`git diff origin/main` の削除表示を未コミット削除と扱わない |
| `git diff --check` | PASS | whitespace error なし |
| `sh tools/check-summary.sh summary/20260731/0246-audit-worktree-reapply-to-main-20260731.md` | PASS | 必須 section を確認 |
| `node_modules` | 空 | `find node_modules -mindepth 1 -maxdepth 1` に出力なし |
| npm lint / typecheck / build / E2E | 未実施 | 制約により依存関係を再インストールせず、空 `node_modules` のため実行しない |
| Postgres contract / operator smoke | 未実施 | read-only 棚卸し task の範囲外。`sqlite3` binary の存在だけ確認 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | Cue roundtrip coverage の1句を docs-only commit として追加するか | 発注者判断 |
| U-002 | 最新 main から作る新 develop の clean environment 検証結果 | dependency restoration 後の lint / typecheck / tests / build / E2E |
| U-003 | UI follow-up の実ブラウザ挙動 | Browser runtime QA |
| U-004 | native binding load failure から SQLite CLI fallback する実 operator 環境 | isolated source DB / import smoke |

## Next Read

- `summary/20260731/0246-audit-worktree-reapply-to-main-20260731.md`
- `doc/testing/TEST_SCENARIOS.md`
- `origin/main:e2e/mvp-note-flow.spec.js`
- `origin/main:src/modules/notes/ui/components/editor/inputs.tsx`
- branch 移行直前の `git status --short` と `git worktree list --porcelain`
