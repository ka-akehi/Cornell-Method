const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  assessRuntimeCleanup,
  buildDescendantClosure,
  canUseProcessGroupSignal,
  observeDescendantClosure,
  parseProcessTable,
  signalProcessTree,
  validateDedicatedProcessGroup,
  waitForProcessTreeExit,
} = require("../scripts/process-tree.cjs");
const { tauriInstanceSocketPath, waitForExit, waitForJson } = require("../scripts/tauri-runner.cjs");

const records = [
  { pid: 100, ppid: 1, pgid: 100, rssKb: 10, state: "S", commandName: "node", commandLine: "node next start" },
  { pid: 101, ppid: 100, pgid: 100, rssKb: 20, state: "S", commandName: "node", commandLine: "node helper.js" },
  { pid: 102, ppid: 101, pgid: 100, rssKb: 30, state: "S", commandName: "node", commandLine: "node child.js" },
  { pid: 200, ppid: 1, pgid: 200, rssKb: 40, state: "S", commandName: "node", commandLine: "node unrelated.js" },
  { pid: 201, ppid: 1, pgid: 100, rssKb: 50, state: "S", commandLine: "node unrelated-same-group.js", commandName: "node" },
];

test("process table parsing preserves PID, parent, group, RSS, and command identity", () => {
  assert.deepEqual(parseProcessTable("\n 100 1 100 10 S node node next start\n101 100 100 20 S node node helper.js\n"), [records[0], records[1]]);
});

test("descendant closure follows parent-child edges and excludes unrelated processes", () => {
  const closure = buildDescendantClosure(records, 100);
  assert.equal(closure.rootObserved, true);
  assert.deepEqual(closure.pids, [100, 101, 102]);
  assert.equal(closure.processes[2].relation, "sidecar-descendant");
});

test("explicit PID tree signal is descendant-first and tolerates ESRCH", () => {
  const calls = [];
  const result = signalProcessTree(buildDescendantClosure(records, 100), "SIGTERM", {
    sendSignal(pid, signal) {
      calls.push([pid, signal]);
      if (pid === 102) throw Object.assign(new Error("already gone"), { code: "ESRCH" });
    },
  });
  assert.deepEqual(calls, [[102, "SIGTERM"], [101, "SIGTERM"], [100, "SIGTERM"]]);
  assert.equal(result.status, "UNVERIFIED");
  assert.deepEqual(result.alreadyExitedPids, [102]);
});

test("dedicated group validation uses only a validated negative group ID", () => {
  const calls = [];
  const result = validateDedicatedProcessGroup(100, { platform: "darwin", sendSignal(pid, signal) { calls.push([pid, signal]); } });
  assert.equal(result.validated, true);
  assert.deepEqual(calls, [[-100, 0]]);
});

test("group scope is rejected when an unrelated same-group process exists", () => {
  const observation = observeDescendantClosure(100, { expectedProcessGroupId: 100, readProcessTableImpl: () => records });
  assert.equal(observation.processGroupScoped, false);
  assert.deepEqual(observation.processGroupMembersOutsideClosure.map((record) => record.pid), [201]);
  assert.equal(canUseProcessGroupSignal({ validated: true, id: 100 }, observation), false);
});

test("group scope is rejected when a descendant leaves the expected group", () => {
  const observation = observeDescendantClosure(100, {
    expectedProcessGroupId: 100,
    readProcessTableImpl: () => records.map((record) => record.pid === 102 ? { ...record, pgid: 300 } : record).filter((record) => record.pid !== 201),
  });
  assert.equal(observation.processGroupScoped, false);
  assert.deepEqual(observation.processTreeMembersOutsideExpectedGroup.map((record) => record.pid), [102]);
});

test("cleanup waits for every observed descendant and records late children", async () => {
  const before = observeDescendantClosure(100, { readProcessTableImpl: () => records });
  let reads = 0;
  const waited = await waitForProcessTreeExit(before, 100, {
    intervalMs: 0,
    readProcessTableImpl: () => {
      reads += 1;
      return reads === 1 ? records : [];
    },
  });
  assert.equal(waited.status, "PASS");
  assert.deepEqual(waited.after.remainingPids, []);
  const late = observeDescendantClosure(100, { readProcessTableImpl: () => records });
  const lateAfter = require("../scripts/process-tree.cjs").observeRemainingProcesses(late, {
    readProcessTableImpl: () => [...records, { pid: 103, ppid: 100, pgid: 100, rssKb: 15, state: "S", commandName: "node", commandLine: "node late-child.js" }],
  });
  assert.equal(lateAfter.remainingPids.includes(103), true);
});

test("cleanup assessment never passes without an empty observed after-tree", () => {
  assert.equal(assessRuntimeCleanup({ status: "PASS", runtimeRootPid: 100 }).status, "FAIL");
  const base = { status: "PASS", runtimeRootPid: 100, processTreeBeforeShutdown: { observationStatus: "PASS", pids: [100, 101] }, processTreeAfterShutdown: { observationStatus: "PASS", remainingPids: [101] } };
  assert.equal(assessRuntimeCleanup(base).status, "FAIL");
  assert.equal(assessRuntimeCleanup({ ...base, processTreeAfterShutdown: { observationStatus: "PASS", remainingPids: [] } }).status, "PASS");
});

test("waitForExit reports an already exited child without a timeout", async () => {
  const child = spawn(process.execPath, ["-e", "process.exit(143)"], { stdio: "ignore" });
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  const result = await waitForExit(child, 50);
  assert.equal(result.code, 143);
  assert.equal(result.signal, null);
  assert.equal(result.timedOut, false);
});

test("waitForJson reports a child exit before readiness state", async () => {
  const child = spawn(process.execPath, ["-e", "process.exit(7)"], { stdio: "ignore" });
  await assert.rejects(
    waitForJson(path.join(os.tmpdir(), `missing-tauri-state-${process.pid}.json`), () => true, 500, child),
    /Tauri process exited before state/,
  );
});

test("Tauri instance socket stays below macOS SUN_LEN and remains run-specific", () => {
  const context = { outputRoot: `/private/tmp/${"long-output-root-".repeat(20)}` };
  const smoke = tauriInstanceSocketPath(context, "smoke");
  assert.ok(smoke.length < 104);
  assert.equal(smoke, tauriInstanceSocketPath(context, "smoke"));
  assert.notEqual(smoke, tauriInstanceSocketPath(context, "lifecycle"));
});
