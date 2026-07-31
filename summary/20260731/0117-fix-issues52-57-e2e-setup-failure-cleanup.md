---
summary_type: task-summary
created_at: 2026-07-31 01:17 JST
task_kind: coding
task_status: done
---

## Objective

E2E の global setup が prepare、既存 server 検出、child spawn、readiness のいずれかで失敗しても、runner 側で作成済みの SQLite fixture と sidecar を cleanup する。通常終了時の server close 完了後に globalTeardown が cleanup する順序は維持する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Playwright E2E fixture lifecycle |
| 対象ファイル / ディレクトリ | `e2e/web-server.js`, `test/e2e-cleanup-contract.test.js` |
| 対象外 | アプリコード、E2E シナリオ、依存関係、commit / push / PR |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-30.md` | 既存 E2E lifecycle と未コミット作業ツリーの境界 |
| previous summary | `summary/20260730/2305-fix-issue52-e2e-cleanup-20260730.md` | globalTeardown 所有の通常 cleanup 契約 |
| E2E source | `e2e/web-server.js`, `e2e/database-fixture.js`, `e2e/global-teardown.js`, `playwright.config.js` | setup、server lifecycle、fixture cleanup、runner hook の現状 |
| contract test | `test/e2e-cleanup-contract.test.js` | 既存の close-before-cleanup 契約と idempotence 観点 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `e2e/web-server.js` | global setup を `runE2eGlobalSetup` に分離し、setup の全例外経路で server stop を試行した後、runner-owned fixture cleanup を実行して元の setup failure を再送出。cleanup failure は原因を失わない `AggregateError` として報告。 | Playwright の globalTeardown に到達しない setup failure でも fixture を残さないため。child process の exit signal handler には cleanup を追加していない。 |
| `test/e2e-cleanup-contract.test.js` | prepare failure、既存 server、child spawn failure、readiness failure の4経路を dependency injection で lifecycle smoke 化。setup cleanup 後の globalTeardown 再実行、signal handler の責務分離、通常の close-before-cleanup 契約を確認。 | Issue #52 / #57 の failure と通常終了の責務・順序を再発防止可能な形で確認するため。 |
| `summary/20260731/0117-fix-issues52-57-e2e-setup-failure-cleanup.md` | 完了要約を記録。 | 次回の再開時に raw log を再読しないため。 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | global setup failure 時は、該当する場合に server stop 完了を待ってから runner の fixture cleanup を行う。prepare failure / existing server では server を作らず cleanup する。 | `e2e/web-server.js`, `test/e2e-cleanup-contract.test.js` |
| F-002 | fact | 通常終了では returned teardown が server close を待ち、configured `globalTeardown` がその後に DB と SQLite sidecar を削除する。 | `playwright.config.js`, `e2e/web-server.js`, `e2e/global-teardown.js`, lifecycle smoke |
| F-003 | fact | `cleanupE2eDatabase()` は DB 本体と `-journal` / `-shm` / `-wal` を ENOENT 無視で削除するため、setup cleanup と globalTeardown の二重実行が安全。 | `e2e/database-fixture.js`, contract test |
| U-001 | unknown | この sandbox では `npm run test:e2e` の localhost bind が `listen EPERM` で失敗するため、Chromium 3 flow の runtime PASS は未確認。ただし failure cleanup 後に4 fixture path はすべて不在だった。 | `npm run test:e2e` と終了後の path check |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `node --test test/e2e-cleanup-contract.test.js` | PASS | 4 tests |
| `npx playwright test --list` | PASS | 3 E2E tests を列挙 |
| `npm run lint` | PASS | ESLint |
| `git diff --check` | PASS | whitespace error なし |
| `npm run test:e2e` | BLOCKED | `listen EPERM: operation not permitted 127.0.0.1:4173`; 終了後 `e2e.db` と全 sidecar は不在 |
| `node --check`（対象 JS） | PASS | 構文エラーなし |
| `git status --short`（作業前後） | 確認済み | 既存の未コミット変更を戻していない |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | localhost bind が許可された環境での Chromium E2E 3 flow の実行結果 | CI または権限付き実行環境で `npm run test:e2e` を実行し、終了後 fixture 不在を確認 |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `summary/20260731/0117-fix-issues52-57-e2e-setup-failure-cleanup.md`
- `e2e/web-server.js`
- `e2e/global-teardown.js`
- `e2e/database-fixture.js`
- `test/e2e-cleanup-contract.test.js`
