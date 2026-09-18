---
summary_type: task-summary
created_at: 2026-09-07 06:10 JST
task_kind: worker-task
task_status: done
---

## Objective

`verify-complete-typescript-test-migration-20260907-c0bc880d.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/verify-complete-typescript-test-migration-20260907-c0bc880d.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/verify-complete-typescript-test-migration-20260907-c0bc880d.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | Worker が記録した変更ファイルなし | provenance manifest に記録なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/verify-complete-typescript-test-migration-20260907-c0bc880d.task.md` |
| F-002 | fact | Worker provenance manifest に変更ファイルは記録されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

検証完了。変更は行っていません。

- `.test.js`: 0本
- `.test.ts`: 94本
- `npm run typecheck`: PASS
- `npm run test:ts`: 560 PASS / 3 FAIL / 7 SKIP
- `test:desktop:lifecycle`: 10 PASS / 0 FAIL / 7 SKIP
- `test:desktop:node-runtime`: 12 PASS / 0 FAIL / 0 SKIP
- `test:codex-queue`: 15 PASS / 0 FAIL / 0 SKIP
- ESLint: PASS
- `git diff --check`: PASS
- 旧 `.test.js` 参照: なし

`test:ts` のFAIL原因は、Worker runner完了待ち1件と、実環境のPostgreSQL環境変数を前提にした設定テスト2件です。TS移行自体に起因する失敗とは確認できませんでした。

作業前後とも、既存の未コミット変更は保持されています。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260907/0610-verify-complete-typescript-test-migration-20260907-c0bc880d-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| changed-files provenance | 完了 | explicit worker provenance manifest |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Follow-up Investigation: PostgreSQL-config FAILs (2026-09-07)

### Reproduction

Focused execution:

```text
node --import tsx/esm --test test/config/project-env.test.ts
34 pass / 2 fail
```

The two failures are:

| Test | Trigger | Expected | Actual |
|---|---|---|---|
| `requires DIRECT_URL for PostgreSQL migration commands` | `DATABASE_URL` is set to a runtime PostgreSQL URL, `DIRECT_URL` is set to `undefined`, hosted env is enabled, then `resolvePrismaCliDatabaseUrl({ provider: "postgresql", command: ["migrate", "deploy"] })` is called | throw an error mentioning `DIRECT_URL` and not the secret | no exception; `DIRECT_URL` is repopulated from the project `.env` |
| `uses a non-secret placeholder for PostgreSQL generation` | `DATABASE_URL` and `DIRECT_URL` are set to `undefined`, hosted env is enabled, then PostgreSQL `generate` resolution is called | `postgresql://prisma:prisma@localhost:5432/prisma?schema=public` | the project `.env` `DATABASE_URL` value is returned |

Secrets were not copied into this summary. Read-only inspection confirmed the project `.env` contains both `DATABASE_URL` and `DIRECT_URL`.

### Isolation / causality

- `withEnvironment()` correctly snapshots the selected keys and restores them in `finally`, but it only controls keys passed by the test. It does not prevent `loadProjectEnv()` from loading missing keys from `.env`.
- `loadProjectEnv()` uses `dotenv.config({ override: false })`; therefore a test that deletes `DATABASE_URL` or `DIRECT_URL` can receive the project `.env` value when resolution calls `loadProjectEnv()`.
- The failures reproduce in the focused file and also with `--test-concurrency=1`, so Node test concurrency is not required for these two failures. The parent/project environment dependency is sufficient.
- The full suite is additionally subject to shared-process `process.env` mutation across test files. A full-suite run during this investigation reached the unrelated worker-runner failures (`routes task risk...`, `pins Luna...`, `uses explicit Worker provenance...`) rather than completing with the historical 2 config failures; this does not invalidate the deterministic focused reproduction.
- No PostgreSQL connection or write was made. The tests only resolve/validate strings.

### Recommended follow-up coding task

Create one narrowly scoped test-isolation task: make config tests able to distinguish an intentionally absent shell variable from `.env` loading (for example, an injectable environment/project-env loader or a test-only isolated project root), and update only the affected tests/helpers. Preserve production config behavior, avoid global test-runner changes, and verify focused plus full `test:ts` runs. Do not alter PostgreSQL production defaults or connect to an external database.

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260907/0610-verify-complete-typescript-test-migration-20260907-c0bc880d-summary.md`

## Follow-up Investigation (Worker runner completion wait)

### Reproduction

| 実行 | 結果 | 根拠 |
|---|---|---|
| `npm run test:codex-queue` | 15 PASS / 0 FAIL / 0 SKIP、約30.3秒 | `/private/tmp/codex-queue-solo.log` |
| `npm run test:ts` | 560 PASS / 3 FAIL / 7 SKIP、終了コード1 | `/private/tmp/test-ts-investigation.log` |

全体suiteで失敗した正確なテストは次の3件である。

| test | 期待値 | 実値 / trigger |
|---|---|---|
| `bounds an unusually long Worker Report and marks the truncation` | 子runnerが10,000ms以内に完了マーカー（`[Fixture-worker] Done:` または `Failed:`）を出力し、summary検証へ進む | `worker runner timed out`。18,343.896msでSIGKILL。出力は `Running`、`Routing`、raw stdout/stderr marker、`Changed files recorded by worker: none` までで完了マーカーなし |
| `truncates a Japanese Worker Report on UTF-8 character boundaries in every locale` | 同上 | `worker runner timed out`。10,287.380msでSIGKILL。`Running`、`Routing`、raw marker、`Changed files recorded...` までで完了マーカーなし |
| `keeps the existing failure summary behavior and removes temporary files` | 失敗taskのrunnerが10,000ms以内に`Failed:`を出力し、temporary filesを検証 | `worker runner timed out`。10,854.227msでSIGKILL。`Running`、`Routing` までで完了マーカーなし |

待機条件は `test/codex-queue/worker-summary.test.ts` の `runWorker()` にある固定10,000ms timeout。`close`時に `timedOut` なら失敗し、完了判定はstdout/stderr中の `/\\] (?:Done|Failed): /` の受信である。`worker-policy.test.ts` の同種helperも10,000msだが、今回の全体FAIL該当は `worker-summary.test.ts` の3件だった。

### Causality conclusion

- **Node test concurrency / resource contention: confirmed trigger.** 単独suiteは全15件PASSだが、全94 fileの並列実行時だけ3件が10秒境界を超えた。失敗は完了マーカー受信前のSIGKILLで、アサーション内容やsummaryの期待値不一致ではない。
- **Timeout: immediate failure mechanism.** 実測は約10.29秒、10.85秒、18.34秒で、固定10秒を超過した。特に長文report系はsummary生成完了待ちが並列負荷の影響を受ける。
- **Shared queue state: not causal.** 各fixtureは固有の `mkdtemp` 配下に `codex-queue/tasks`、`state`、runtime tempを作り、出力にも固有rootが現れる。単独suiteでは同じ共有構造で15/15 PASS。外部DBも使用していない。
- **TypeScript migration: not causal.** 対象TS suite単独がPASSし、失敗箇所はTS移行で変わっていないrunner wait helperの時間境界である。
- **Parent environment: contributing context only.** 親環境のPostgreSQL値に起因する別FAIL 2件はあるが、worker timeoutの失敗出力にはそれらの環境変数・DB処理は現れない。

### Recommended single follow-up coding task

`test/codex-queue` のrunner test helperだけを、完了マーカー待ちのtimeoutを十分な値（例: 30,000ms）へ局所拡張し、timeout errorに elapsed/last output を含める。その後 `npm run test:codex-queue` と `npm run test:ts` を再検証する。全体のglobal concurrencyを1へ下げると実行時間を不必要に増やし、共有queue state対策としても根拠がないため、現時点では推奨しない。suite分離も回避策であり、最小の正しい修正ではない。
