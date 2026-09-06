---
summary_type: investigation-summary
created_at: 2026-09-07 05:56 JST
task_status: done
---

## Objective

`npm run test:codex-queue` の 13 PASS / 2 FAIL を再現し、失敗条件、期待値と実値、TS 移行との因果、現行 Worker summary 契約との整合を確定した。

## Verification

- 作業前 `git status --short` を確認。既存の大量の未コミット変更は保持した。
- `npm run test:codex-queue -- --test-name-pattern='worker summary|summary'` を実行し、15件中13 PASS / 2 FAILを再現。
- 全体実行も開始し、同じ対象FAILを確認した（30秒の実行上限で途中終了したため、focused実行を正式な再現結果とした）。
- 作業後も読み取り確認を行い、コード・設定・依存関係・テストassertionは変更していない。

## Findings

### F-001: provenance filter test

- Test: `test/codex-queue/worker-summary.test.ts:347` — `excludes runtime artifacts while retaining tracked and untracked task outputs`
- Assertion: `test/codex-queue/worker-summary.test.ts:365` の `assert.equal(summary.includes(...), true, artifact)`。
- Trigger: fixture Worker は `src/tracked-result.ts` と `doc/untracked-result.md` を作成・更新するが、`worker-record-change.sh` を呼ばない。
- Expected: summary の Changes Made に両ファイルが `task 実行中に作成または更新` として残る。
- Actual: `src/tracked-result.ts` がsummaryに含まれず、`false !== true`。
- Runtime cause: `worker-run.sh:236-242` は recorder が存在すると常に explicit provenance mode を有効化し、`worker-run.sh:250-256` は manifestをsummary writerへ渡す。writer (`write-task-summary.sh:235-239`) は manifest方式では timestamp activity を採用しない。fixtureがmanifest登録をしないため、tracked/untracked成果物は意図的変更として出力されない。
- Contract judgment: 現行契約はruntime側が正しい。`codex-queue/README.md:246-257` は変更ファイルの正本をWorker provenance manifestとし、未登録activityを未帰属として扱う。テストは旧timestamp契約を要求しており、現行契約と不整合。

### F-002: final-message route/model test

- Test: `test/codex-queue/worker-summary.test.ts:402` — `captures the final message for every codex exec route`
- Assertion: `test/codex-queue/worker-summary.test.ts:453`。default-model fixtureで `assert.doesNotMatch(call, /\\t--model\\t/)`。
- Trigger: default-model case（`environment: {}`, `expectedModels: []`）。
- Expected: default routeのcodex exec callに `--model` がない。
- Actual: `CALL\texec\t--skip-git-repo-check\t--model\tgpt-5.6-luna\t-c\tmodel_reasoning_effort="medium"\t--output-last-message\t...`。したがって `/\\t--model\\t/` にmatchし、assertion failure。
- Runtime cause: `worker-run.sh:104,107` は inherit/non-inherit の両routeで `--model "$worker_model"` を渡す。`93d490e5` の「pin all Workers to GPT-5.6 Luna」変更由来で、TS migration diffには含まれない。
- Contract judgment: runtime側が正しい。`codex-queue/README.md:189-190` はモデルをLuna固定と明記し、同README `:261-264` は `--output-last-message` による最終メッセージsummaryを契約化している。テストの「default routeはmodelなし」は旧契約。

## Migration causality

`git show 6fb6ab7:test/codex-queue/worker-summary.test.js` と現行 `.test.ts` を比較した。差分はCommonJS requireからESM import、`__dirname`相当の `fileURLToPath(import.meta.url)`、型注釈、child process/stream型付けであり、2 FAILのtest名・assertion・fixture期待値は同一。TS移行が挙動を変えた具体的差分はない。先行summary `0526...` も worker-summary は4/6 PASSで、2件を既存queue script契約不一致と記録している。

## Follow-up coding task

単一責務のtest-contract修正 taskを後続投入する。

- Purpose: 現行runtime契約に合わせて `test/codex-queue/worker-summary.test.ts` の2 assertion群だけを更新する。
- Scope: F-001のprovenance期待値を「manifest未登録activityはChanges Madeに含めない」契約へ変更し、F-002の全routeでLuna `--model` が付く期待値へ更新。必要なfixture検証は現行READMEの契約に限定する。
- Do not change: `codex-queue/bin/**`、runtime、依存関係、他テスト。
- Done when: focused worker-summary testが全件PASS、`npm run test:codex-queue` が15/15 PASS、`npm run typecheck` と対象ESLintがPASS。

## Next Read

- `test/codex-queue/worker-summary.test.ts:347-465`
- `codex-queue/bin/worker-run.sh:97-108,236-256`
- `codex-queue/bin/write-task-summary.sh:235-239`
- `codex-queue/README.md:189-190,244-265`
