# Current diff inventory for develop

## Objective

local HEAD `34fa64e` から作業中の worktree 差分を再棚卸しし、`origin/main` `79dfd13` を起点に作り直す `develop` へ何を載せるか、何を載せないかを Manager が判断できる状態にする。旧 branch の実装差分をそのまま再適用せず、merged 済みの UI、Postgres migration、docs、test を保全し、main 側の後続変更を削除しない移行境界を固定する。

## Scope

| 項目 | 内容 |
|---|---|
| 現在地 | branch `agent/fix-date-editor-scroll-20260727`、local HEAD `34fa64e`、`origin/main` `79dfd13` |
| 比較境界 | `git diff HEAD` は現在の tracked worktree 差分、`git diff origin/main` は main と worktree の不一致確認に使用。main にだけ存在するファイルを未コミット削除とは扱わない。 |
| 対象 | tracked 19 ファイル、untracked の handoff 1 件、既存 summary 65 件、ignored local / generated state、UI、Postgres migration、docs / handoff、contract tests、main-only E2E / dependency files |
| 分類 | `already-in-main`、`unique-candidate`、`conflict-needs-resolution`、`exclude-from-commit` |
| 対象外 | コード・設定・依存関係・DB・生成物の変更、branch / index / stash / worktree の変更、commit / push / merge / PR / Issue 操作。Worker progress metadata の更新だけは指定運用として実行した。 |

## Inputs Read

| 種別 | パス / コマンド | 確認内容 |
|---|---|---|
| repository rules | `AGENTS.md`、`summary/README.md`、`summary/task-summary-template.md` | 最新 handoff、summary の扱い、PR からの summary 除外、作業前後 status の規則 |
| current handoff | `HANDOFF_2026-07-30.md` | 旧 worktree の UI / E2E / Postgres の由来、MVP / Phase 2 境界、未確認事項 |
| current contracts | `doc/implementation/MVP_CONTRACT.md`、`doc/technical/TARGET_ARCHITECTURE.md`、`doc/implementation/IMPLEMENTATION_STATUS.md`、`doc/testing/TEST_SCENARIOS.md` | 明示保存、Canvas / Markdown、Postgres reader、E2E、runtime QA の判定境界 |
| prior inventory | `summary/20260731/0246-audit-worktree-reapply-to-main-20260731.md` | 先行棚卸しの分類、merge-base、safe migration、検証順序。今回の実 diff で再確認した。 |
| manager record | `summary/20260731/manager-next-work-organization-20260731.md` | 現在の未コミット変更を先に整理する判断と未確定事項 |
| incomplete auto summary | `summary/20260731/0248-audit-current-diff-for-develop-20260731-6f9631f4-summary.md` | task が done になった事実、分類結果がないこと、消失した progress path の Next Read |
| review guidance | `.agents/skills/cornell-code-review/SKILL.md`、`.agents/skills/cornell-code-review/references/review-checklist.md` | current contract、main 比較、依存方向、静的検証と runtime 検証の分離 |
| Git state | `git status --short`、`git status --short --ignored`、`git rev-parse`、`git branch -vv`、`git worktree list --porcelain`、`git diff HEAD`、`git diff origin/main`、`git show origin/main:<path>` | 現在の変更境界、main-only ファイル、blob 一致、branch / worktree の安全境界 |
| existing records | `summary/20260727/` 7 件、`summary/20260729/` 10 件、`summary/20260730/` 37 件、`summary/20260731/` 11 件 | untracked summary は運用履歴であり、旧 worktree の実装を再適用する入力ではないこと |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260731/current-diff-develop-inventory.md` | 現在の tracked / untracked 差分、main 比較、分類、commit 候補、安全な移行・検証順序を記録 | 後続 Manager が raw log と消失した progress file に依存せず、develop 移行 task を作成できるようにする |

アプリコード、設定、依存関係、Prisma schema / migration、DB、生成物、既存 handoff / summary、branch、index、stash、worktree、queue の task state は変更していない。`codex-queue/bin/worker-progress.sh` は Worker 状態 metadata の更新にのみ使用した。

## Findings

### 1. Comparison boundary

- 現在 branch は `agent/fix-date-editor-scroll-20260727`。local `develop` は `2c433e6` を指し、`origin/develop` は gone。現在の worktree は `git worktree list --porcelain` 上、この一つだけだった。
- `HEAD=34fa64e`、`origin/main=79dfd13`、merge-base=`2c433e6`。`HEAD` と `origin/main` は互いに ancestor ではないため、古い branch の commit / diff を fast-forward や全量 cherry-pick で移す前提は安全ではない。
- `origin/main` `79dfd13` は `Merge develop into main (#64)` で、PR #41（editor scroll / JST date / source clearing / page spacing）、PR #47（note editor polish）、PR #49（repeatable Playwright E2E）、PR #50（SQLite CLI fallback）、PR #51（handoff）とその follow-up を含む。旧 branch の同じ目的の再適用は重複または main 側の後続変更の巻き戻しになる。
- 棚卸し時の `git diff --stat HEAD` は tracked 19 ファイル、`734 insertions(+), 300 deletions(-)`。untracked は `HANDOFF_2026-07-30.md` 1 件と summary 65 件の計 66 件だった。今回の本 report 作成後は untracked report が 1 件増える。

### 2. Tracked changes: file / hunk classification

`git diff HEAD` に出た全 19 tracked ファイルを以下に含める。17 ファイルは worktree blob と `origin/main` blob が一致し、2 ファイルだけ hunk 単位の扱いが必要だった。

| 現在の status / 対象 | 差分の目的・hunk | worktree と `origin/main` | 分類 | develop への扱い |
|---|---|---|---|---|
| `M .gitignore` | Playwright report、test result、隔離 `prisma/e2e.db*` を ignore | 完全一致 | `already-in-main` | 再適用しない。main のものをそのまま使う。 |
| `M AGENTS.md` | 最新 handoff の参照を `HANDOFF_2026-07-30.md` へ更新 | 完全一致 | `already-in-main` | 再適用しない。 |
| `D HANDOFF_2026-07-26.md` | 旧 handoff の削除 | 完全一致。削除状態も main にある | `already-in-main` | 旧ファイルを復元しない。main の削除を保持する。 |
| `M eslint.config.mjs` | E2E JavaScript / `playwright.config.js` の `require` lint 例外 | 完全一致 | `already-in-main` | 再適用しない。 |
| `M scripts/postgres-migration-common.js` | `ERR_DLOPEN_FAILED` / native binding load を判定し、必要時だけ read-only `sqlite3` CLI fallback へ進む | 完全一致 | `already-in-main` | Postgres 用の旧差分 commit を作らない。 |
| `M src/app/styles/app-shell.css` | app-main の外側 padding を compact 化 | 完全一致 | `already-in-main` | UI polish の再適用不要。 |
| `M src/app/styles/note-paper.css` | 用紙 / section / metadata / footer の余白、section の境界線、Cornell 30% divider、responsive / mobile 境界を整理 | 完全一致 | `already-in-main` | CSS 全体を旧 branch からコピーしない。 |
| `M src/modules/notes/ui/components/editor/body.tsx` | legacy Markdown 本文 editor の input / preview toggle を有効化 | 完全一致 | `already-in-main` | 再適用しない。Canvas 本文を Markdown preview に混ぜる変更ではない。 |
| `M src/modules/notes/ui/components/editor/cues.tsx` | Cue textarea を直接の角丸入力枠にし、mobile の重複縦枠を除去 | 完全一致 | `already-in-main` | 再適用しない。 |
| `M src/modules/notes/ui/components/editor/editor.tsx` | tags field error の stale state を tag 編集時に除去、Cornell section の semantic class を追加 | 完全一致 | `already-in-main` | 再適用しない。 |
| `M src/modules/notes/ui/components/editor/metadata.tsx` | metadata section class を追加し、create 画面の spacing handoff に接続 | 完全一致 | `already-in-main` | 再適用しない。 |
| `M src/modules/notes/ui/components/editor/summary.tsx` | Summary の input / preview toggle、直接入力枠、入力面の spacing を反映 | 完全一致 | `already-in-main` | 再適用しない。 |
| `M src/modules/notes/ui/components/editor/tags.tsx` | 30 文字上限、黙った切り捨ての除去、成功時だけ input clear、長い chip の truncate、編集時の local error clear | 完全一致 | `already-in-main` | tag 修正の commit を作らない。 |
| `M src/shared/markdown/markdown-field.tsx` | Markdown の input / preview 切替、ARIA tabpanel、初期 input 表示を追加 | 完全一致 | `already-in-main` | 再適用しない。既存 sanitize / checkbox 表示専用境界も main にある。 |
| `M test/notes/markdown-preview-contract.test.js` | Markdown toggle と Body / Summary opt-in の contract test | 完全一致 | `already-in-main` | 再適用しない。 |
| `M test/notes/note-paper-spacing-contract.test.js` | compact spacing、divider、border continuity、Cue / Summary 直接枠、responsive の contract test | 完全一致 | `already-in-main` | 再適用しない。 |
| `M test/postgres/data-migration-contract.test.js` | require / constructor native failure fallback と、open / query failure を fallback しない契約 test | 完全一致 | `already-in-main` | Postgres test の再適用不要。実 native operator smoke は別 task。 |
| `M doc/testing/TEST_SCENARIOS.md`（Playwright section） | 再実行可能 E2E の前提、隔離 DB、coverage boundary、失敗 artifacts を追加した大部分 | 対応する section は main に存在 | `already-in-main` | section 全体をコピーしない。 |
| `M doc/testing/TEST_SCENARIOS.md:19` | E2E が `GET /api/notes/:id` の Cue 本文・順序復元を検証する旨を 1 文追加 | main にこの 1 文だけがない | `unique-candidate` | 採用する場合だけ、新 develop の main 版へ 1 文を docs-only commit として追加する。 |
| `M test/notes/editor-metadata-contract.test.js`（tag hunk） | tag success / max length / long chip / stale API error の contract test を追加・更新 | tag hunk は main に存在 | `already-in-main` | 旧 test file を全量適用しない。 |
| `test/notes/editor-metadata-contract.test.js` の main 側 date hunk | `showPicker()` / focus fallback と native label activation を検証する main 側 test が、現在 worktree の file にはない。`git diff origin/main` では 23 行の test 削除に見える | main 側の後続 test を保持すべき | `conflict-needs-resolution` | `origin/main` の test file を正とし、date regression test を削除しない。tag test は main 版に既に含まれる。 |

#### Tracked classification summary

- `already-in-main`: 17 whole-file entries、`doc/testing` の Playwright section、`test/notes/editor-metadata-contract.test.js` の tag hunk。
- `unique-candidate`: `doc/testing/TEST_SCENARIOS.md` の Cue roundtrip coverage 1 文だけ。
- `conflict-needs-resolution`: current editor metadata test と main 側の date picker / label activation test の不一致。
- `exclude-from-commit`: 現在の tracked implementation を「旧 HEAD からの新機能」として別 commit に再梱包する行為。main に同一 blob があるため product commit にしない。

### 3. Main-only files and misleading deletion output

`git diff origin/main --` には、現在の old worktree から見ると次の main-only path が `D` と表示される。しかし `git status --short` の current tracked change ではなく、main 側にだけ存在する基準ファイルである。

| main 側の path | current worktree | 分類 | 安全な扱い |
|---|---|---|---|
| `.github/workflows/sync-each-codex-review.yml` | 物理的に absent | `exclude-from-commit`（main baseline） | new develop を `origin/main` から作れば自動的に残る。旧 worktree から削除 patch を作らない。 |
| `e2e/database-fixture.js`、`e2e/global-teardown.js`、`e2e/mvp-note-flow.spec.js`、`e2e/web-server.js` | 物理的に absent | `exclude-from-commit`（main baseline） | handoff / old summary から復元せず、main の最新版を使用する。 |
| `playwright.config.js`、`test/e2e-cleanup-contract.test.js` | 物理的に absent | `exclude-from-commit`（main baseline） | 新 develop の baseline を削除しない。 |
| `HANDOFF_2026-07-30.md` | 物理的には untracked で存在 | `already-in-main` | worktree blob `6a512bc...` と `origin/main:HANDOFF_2026-07-30.md` の blob が一致。コピー / 再 commit 不要。 |
| `package.json`、`package-lock.json` | current status には出ない main-only 更新 | `exclude-from-commit`（main baseline） | main の `test:e2e`、`@playwright/test` / `playwright` `1.61.0` pin、scripts / lock を保持。old worktree の package をコピーしない。 |
| `src/modules/notes/ui/components/editor/inputs.tsx` | current status には出ない main-only 更新 | `exclude-from-commit`（main baseline） | main の date input `showPicker()` / focus fallback を保持する。旧版で上書きしない。 |
| `test/notes/editor-metadata-contract.test.js` | current file は main 側 date test を欠く | `conflict-needs-resolution` | main 版の native date label activation test と tag test を合わせて保持する。 |

`HANDOFF_2026-07-30.md` が `git diff origin/main` で削除表示になるのは、untracked file が通常の diff に入らないためであり、実ファイルの削除を意味しない。新 worktree で `git status --short` が clean なら、main 側の E2E / workflow / package / inputs files が揃っていることを個別に確認する。

### 4. Untracked handoff / summary / ignored state

| 対象 | 件数 / 内容 | 分類 | develop への扱い |
|---|---|---|---|
| `HANDOFF_2026-07-30.md` | 1 件。main blob と一致 | `already-in-main` | product commit へ追加しない。main baseline の file を使う。 |
| `summary/20260727/` | 7 件 | `exclude-from-commit` | UI / date / scroll の運用記録として旧 worktree に保持する。実装復旧用 patch や PR file にしない。 |
| `summary/20260729/` | 10 件 | `exclude-from-commit` | Canvas scroll、Postgres retry、E2E、Markdown / paper spacing の履歴。新 develop の product commit へコピーしない。 |
| `summary/20260730/` | 37 件 | `exclude-from-commit` | UI、E2E cleanup、Postgres smoke、handoff / Manager records。必要なら別の archive として保全する。 |
| `summary/20260731/`（既存 11 件） | `0048`、`0052`、`0053` issue58 / issue59、`0106`、`0117`、`0120`、`0246`、`0248`、`manager-fix-open-issues`、`manager-next-work-organization` | `exclude-from-commit` | 既存完了記録として保持するが、UI / migration / E2E の再適用入力にしない。今回の report は別の新規 summary として追加される。 |
| ignored `.next/`、`.env`、`.env.example`、`.DS_Store` | local / generated state。`.next` は build output、`node_modules` は存在するが直下 entry なし | `exclude-from-commit` | 移行入力・stage・commit に含めない。秘密値の内容を表示しない。 |

前 task の自動 summary `summary/20260731/0248-audit-current-diff-for-develop-20260731-6f9631f4-summary.md` は存在し、`done` と completion の記録はあるが、差分分類結果はない。そこに記載された Next Read の `codex-queue/.state/progress/tasks--audit-current-diff-for-develop-20260731-6f9631f4.task.md.progress` は今回の確認時点で absent だった。progress を復元・推測せず、本 report を後続作業の起点にする。

### 5. Commit candidates for new develop

#### Candidate D1: optional docs-only correction

| 項目 | 内容 |
|---|---|
| commit candidate | `docs: document Cue roundtrip E2E coverage` |
| 対象 | `doc/testing/TEST_SCENARIOS.md:19` の `GET /api/notes/:id` による Cue `text` / `order` 復元の 1 文のみ |
| 目的 | main の `e2e/mvp-note-flow.spec.js` が実際に行う assertion と、docs の coverage 説明を一致させる |
| 依存 | new develop の `origin/main` に既にある `e2e/mvp-note-flow.spec.js`、Playwright config / package scripts。旧 worktree の E2E file は依存にしない。 |
| 適用順 | new develop を main から作成し clean baseline を確認した後、発注者が採用を決めた場合に 1 文だけ編集。 |
| 最低限の検証 | `git diff --check`、main の E2E spec で Cue `text` / `order` assertion を目視照合。docs-only なので旧 dirty worktree で lint / build を再実行する理由はない。 |
| scope | Issue / PR close reference なし。summary は stage / commit / PR から除外。 |

#### No candidate for already merged implementation

次の目的単位は current worktree に実装・test が残っているように見えるが、`origin/main` に同じ内容があるため commit candidate にしない。

| 目的 | 対象 | 判定 |
|---|---|---|
| note editor scroll / JST date / source clear / page spacing | editor UI、`note-paper.css`、old HEAD commits `fb6d25c` / `3da0a3e` / `34fa64e` | `already-in-main`。cherry-pick / patch apply 不要。 |
| Markdown input / preview と Cue / Summary border | MarkdownField、Body / Summary / Cue、note-paper contract tests | `already-in-main`。 |
| tag validation / long chip / stale error | `tags.tsx`、`editor.tsx`、editor metadata tests | `already-in-main`。main の date test を含む file を正とする。 |
| Postgres native fallback | `scripts/postgres-migration-common.js`、`test/postgres/data-migration-contract.test.js` | `already-in-main`。実 native load failure の operator smoke は別 task。 |
| repeatable Playwright E2E / lint / cleanup | main-only `e2e/**`、workflow、Playwright config、package 更新 | `already-in-main`（current worktree にはない main baseline）。旧 summary から戻さない。 |
| handoff / summary | `AGENTS.md`、`HANDOFF_2026-07-30.md`、既存 summary | `already-in-main` または `exclude-from-commit`。product implementation commit にしない。 |

### 6. Safe migration procedure

この手順は future Manager / branch migration task 用であり、今回の Worker は実行していない。

1. 現在の dirty worktree を frozen input として保持する。`git status --short`、`git rev-parse HEAD`、`git rev-parse origin/main`、本 report を checkpoint にする。`git reset`、`git checkout`、`git clean`、一括 `git apply`、旧 worktree の branch switch は行わない。
2. 必要なら発注者の承認後に、現在の local `develop` `2c433e6` を `archive/develop-pre-main-20260731` など別 ref へ名前保存する。先に `git worktree list --porcelain` で `develop` が別 worktree に checkout されていないことを確認する。古い pointer を force-move / delete しない。
3. 現在の dirty worktree とは別 path に `origin/main` `79dfd13` から新 worktree を作り、そこだけで new `develop` を作成する。概念上は `git worktree add -b develop <new-worktree-path> origin/main`。current worktree の untracked summary / handoff をこの作業で消さない。
4. 新 worktree で `git status --short` が clean、HEAD が想定した `origin/main`、main-only の `.github/workflows`、`e2e/**`、`playwright.config.js`、`test/e2e-cleanup-contract.test.js`、`package.json`、`inputs.tsx` が存在することを確認する。`git diff origin/main` の D 表示だけを根拠にそれらを削除しない。
5. old HEAD `34fa64e` の 3 commit、`git diff HEAD`、untracked summary、old handoff を new develop へ全量 cherry-pick / patch apply しない。17 tracked implementation file は main 済みで、全量適用は重複 commit と main 側 date / E2E follow-up の巻き戻しを招く。
6. D1 docs candidate を採用する場合だけ、main 版 `doc/testing/TEST_SCENARIOS.md` の該当 1 文を編集し、docs-only commit にする。`test/notes/editor-metadata-contract.test.js` は main 版をそのまま保持し、date picker / label regression test を落とさない。
7. summary / handoff の保全が必要なら、旧 dirty worktree を発注者確認まで残すか、別の archive として管理する。Worker summary は product PR の stage / commit から除外する。summary を code patch の代替や Issue close reference の代替にしない。
8. 新 develop の依存関係復旧と検証を通した後、commit / push / PR は別 task とする。hosted migration、Postgres import、Production DB、backup / restore はこの branch 移行と混ぜない。

### 7. Dependency restoration and verification order

現在の old worktree の `node_modules` は空であり、この Worker は制約により再インストール・Prisma generate・lint / test / build を実行していない。new develop では `origin/main` の `package-lock.json` を正として次の順序で実行する。

| 順序 | コマンド / 操作 | 目的・注意 |
|---:|---|---|
| 1 | `npm ci` | new worktree に依存関係を復旧する。old worktree の空 `node_modules` や package files をコピーしない。 |
| 2 | `npm run prisma:generate` | Prisma Client / generated artifact を new worktree で生成する。通常 DB へ migrate はしない。 |
| 3 | `git diff --check` | optional docs candidate を含む patch の whitespace を確認する。 |
| 4 | `npm run lint` | main の source、E2E JavaScript、config を ESLint で確認する。 |
| 5 | `npx tsc --noEmit --pretty false` | TypeScript の型検証。package script ではないため直接実行する。 |
| 6 | `node --test test/notes/*.test.js test/postgres/*.test.js test/e2e-cleanup-contract.test.js` | UI / Markdown / note-paper / Postgres / E2E cleanup の contract test。main baseline にある file を対象にする。 |
| 7 | `npm run build` | `prisma:generate` を内部でも行い、Next.js webpack production build を確認する。 |
| 8 | Chromium がない場合だけ `npx playwright install chromium` | dependency 復旧後、E2E の browser binary を用意する。既存 binary の有無を先に確認する。 |
| 9 | `npm run test:e2e` | isolated `prisma/e2e.db` を使う main の主要 MVP flow。`dev.db`、backup、別 server を対象にしない。 |

Postgres の実 native binding load failure / `sqlite3` CLI fallback を含む operator smoke、hosted migration、reconcile / import、Browser visual QA はこの順序の後の別 task とする。静的 contract test の PASS を実 native / browser runtime PASS に読み替えない。

### 8. Current contract / runtime boundary

- 現行 MVP は明示保存、Canvas / legacy Markdown、Cue / Summary、手動 backup、detail 内 review が正本であり、autosave、soft-delete Undo、専用 review task、PDF export、NoteCard / D&D は Phase 2。今回の差分分類で Phase 2 を新 develop へ混ぜる根拠はない。
- Postgres fallback の synthetic contract test は main にあるが、実 native load failure から CLI fallback へ到達する operator smoke は未確認。これを branch migration 完了の条件に過剰に含めない。
- UI の CSS / Markdown / tag contract test は main に統合済みでも、Browser backend の visual / pointer / wheel / mobile runtime QA の未確認範囲は handoff / contract の記載どおり残る。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | tracked 19 件と untracked handoff / summary を確認。既存変更を戻していない。 |
| HEAD / main | PASS | local HEAD `34fa64e`、`origin/main` `79dfd13`、merge-base `2c433e6`。 |
| branch / worktree | PASS | current branch、local develop `2c433e6`、current worktree 1 件を確認。branch / worktree は変更していない。 |
| `git diff --stat HEAD` / tracked file list | PASS | 19 tracked files、734 additions、300 deletions。全 file を分類表へ記載した。 |
| worktree と `origin/main` の file / hunk 比較 | PASS | 17 whole-file entries は exact same、`doc/testing` は 1 文だけ unique candidate、editor metadata test は main date hunk conflict と確認。 |
| untracked handoff blob | PASS | `HANDOFF_2026-07-30.md` の worktree blob と `origin/main` blob が一致。 |
| previous progress path | PASS（absent を確認） | `codex-queue/.state/progress/tasks--audit-current-diff-for-develop-20260731-6f9631f4.task.md.progress` は存在しない。推測で復元していない。 |
| main-only physical file check | PASS | current worktree に absent の E2E / workflow / Playwright files と main baseline の差を確認。main の削除とは扱っていない。 |
| `git diff --check` | PASS | 棚卸し対象の whitespace / patch integrity を確認。 |
| `npm ci`、Prisma generate、lint、typecheck、contract test、build、Playwright E2E | 未実施（制約どおり） | node_modules 再インストール・生成処理・検証環境の変更が禁止されているため。new develop で表の順序どおり実施する。 |
| `sh tools/check-summary.sh summary/20260731/current-diff-develop-inventory.md` | PASS | 必須見出し、summary path、conflict marker を確認する。 |
| 作業後 `git status --short` | PASS | 既存の 19 tracked / 既存 untracked を保持し、本 report の `??` だけが追加されたことを確認する。 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | D1 の docs-only 1 文を new develop に採用するか | 発注者 / Manager の scope 判断 |
| U-002 | `origin/main` ref が remote 上でも最新であるか | branch migration task の開始時に `git fetch` 可能な環境で ref を再確認。今回の比較は手元の `79dfd13` に対して実施した。 |
| U-003 | new `develop` worktree の clean baseline と main-only files の存在 | `git worktree add` 後の status / path existence check |
| U-004 | npm dependency、Prisma Client、lint / typecheck / contract tests / build / E2E の fresh environment 結果 | new develop での dependency restoration 後の検証 |
| U-005 | 実 native load failure を含む Postgres source reader operator smoke | isolated SQLite snapshot、`sqlite3` CLI、read-only import / reconcile の別 task |
| U-006 | Browser visual / pointer / wheel / mobile runtime QA の残余 | Browser backend または許可済み Manager fallback 環境での別 task |
| U-007 | 既存 summary 65 件をどの archive / branch に保持するか | product commit と運用記録の保存先を分ける Manager 判断 |

## Next Read

次の Manager / Worker はこの report を最初に読み、raw log と消失した progress file を起点にしない。

- `summary/20260731/current-diff-develop-inventory.md`
- `HANDOFF_2026-07-30.md`（new develop では `origin/main` の tracked blob を使用）
- branch 移行直前の `git status --short`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git worktree list --porcelain`
- D1 を採用する場合のみ `doc/testing/TEST_SCENARIOS.md` と `origin/main:e2e/mvp-note-flow.spec.js`
- 依存復旧時のみ `package.json`、`package-lock.json`、`scripts/prisma-generate.js`
