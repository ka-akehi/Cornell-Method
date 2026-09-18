import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const assessor = path.join(projectRoot, "codex-queue", "bin", "assess-task-risk.sh");
const enqueue = path.join(projectRoot, "codex-queue", "bin", "enqueue-worker-task.sh");

type RiskInput = {
  impact: number;
  reversibility: number;
  verification: number;
  flags: string;
  extra?: string;
};

type EnqueueHarness = {
  queueRoot: string;
  result: SpawnSyncReturns<string>;
  root: string;
};

function taskBody({ impact, reversibility, verification, flags, extra = "" }: RiskInput): string {
  return [
    "# Worker Task",
    "",
    `CODEX_RISK_IMPACT: ${impact}`,
    `CODEX_RISK_REVERSIBILITY: ${reversibility}`,
    `CODEX_RISK_VERIFICATION: ${verification}`,
    `CODEX_RISK_FLAGS: ${flags}`,
    extra,
    "",
    "## 目的",
    "fixture",
    "",
  ].join("\n");
}

function assess(body: string): SpawnSyncReturns<string> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-risk-assess-"));
  const task = path.join(root, "task.md");
  fs.writeFileSync(task, body);
  const result = spawnSync("sh", [assessor, task], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  fs.rmSync(root, { recursive: true, force: true });
  return result;
}

function createUuidStub(root: string): string {
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const uuidgen = path.join(bin, "uuidgen");
  fs.writeFileSync(uuidgen, "#!/bin/sh\nprintf '%s\\n' '12345678-1234-1234-1234-123456789abc'\n");
  fs.chmodSync(uuidgen, 0o755);
  return bin;
}

function enqueueTask(body: string): EnqueueHarness {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-risk-enqueue-"));
  const queueRoot = path.join(root, "tasks");
  const stubBin = createUuidStub(root);
  const result = spawnSync("sh", [enqueue, "risk-fixture"], {
    cwd: projectRoot,
    input: body,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${stubBin}${path.delimiter}${process.env.PATH || ""}`,
      CODEX_QUEUE_ROOT: queueRoot,
    },
  });
  return { queueRoot, result, root };
}

test("maps structured task scores to base risk", () => {
  const cases: Array<[RiskInput, string]> = [
    [{ impact: 0, reversibility: 0, verification: 1, flags: "none" }, "low"],
    [{ impact: 1, reversibility: 1, verification: 1, flags: "none" }, "normal"],
    [{ impact: 2, reversibility: 2, verification: 2, flags: "none" }, "high"],
    [{ impact: 3, reversibility: 3, verification: 2, flags: "none" }, "critical"],
  ];

  for (const [input, expected] of cases) {
    const result = assess(taskBody(input));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim().split("\n")[0], expected);
  }
});

test("hard escalation raises persisted/security/concurrency to high", () => {
  for (const flag of ["persisted-state", "security", "concurrency"]) {
    const result = assess(
      taskBody({ impact: 0, reversibility: 0, verification: 1, flags: flag }),
    );
    assert.equal(result.status, 0, result.stderr);
    const [risk, reason] = result.stdout.trim().split("\n");
    assert.equal(risk, "high");
    assert.match(reason, new RegExp(`floor=high:.*${flag}`));
  }
});

test("hard escalation raises destructive safety boundaries to critical", () => {
  for (const flag of ["destructive", "migration-restore", "crypto-trust", "data-loss"]) {
    const result = assess(
      taskBody({ impact: 0, reversibility: 0, verification: 1, flags: flag }),
    );
    assert.equal(result.status, 0, result.stderr);
    const [risk, reason] = result.stdout.trim().split("\n");
    assert.equal(risk, "critical");
    assert.match(reason, new RegExp(`floor=critical:.*${flag}`));
  }
});

test("enqueue derives risk, ignores manual risk, and removes assessment inputs", () => {
  const harness = enqueueTask(
    taskBody({
      impact: 1,
      reversibility: 1,
      verification: 1,
      flags: "migration-restore",
      extra: "CODEX_TASK_RISK: low\nCODEX_TASK_KIND: coding",
    }),
  );

  try {
    assert.equal(harness.result.status, 0, harness.result.stderr);
    const queued = fs.readdirSync(path.join(harness.queueRoot, "queued"));
    assert.equal(queued.length, 1);
    const content = fs.readFileSync(
      path.join(harness.queueRoot, "queued", queued[0]),
      "utf8",
    );

    assert.match(content, /^CODEX_TASK_RISK: critical$/m);
    assert.match(content, /^CODEX_TASK_RISK_REASON: .*floor=critical:migration-restore$/m);
    assert.match(content, /^CODEX_TASK_KIND: coding$/m);
    assert.doesNotMatch(content, /^CODEX_TASK_RISK: low$/m);
    assert.doesNotMatch(content, /^CODEX_RISK_(?:IMPACT|REVERSIBILITY|VERIFICATION|FLAGS):/m);
  } finally {
    fs.rmSync(harness.root, { recursive: true, force: true });
  }
});

test("enqueue fails closed when structured assessment is missing or invalid", () => {
  for (const body of [
    "# Worker Task\n\nCODEX_TASK_RISK: normal\n",
    taskBody({ impact: 4, reversibility: 0, verification: 0, flags: "none" }),
    taskBody({ impact: 0, reversibility: 0, verification: 0, flags: "unknown" }),
  ]) {
    const harness = enqueueTask(body);
    try {
      assert.notEqual(harness.result.status, 0);
      const queued = fs.readdirSync(path.join(harness.queueRoot, "queued"));
      assert.equal(queued.length, 0);
    } finally {
      fs.rmSync(harness.root, { recursive: true, force: true });
    }
  }
});
