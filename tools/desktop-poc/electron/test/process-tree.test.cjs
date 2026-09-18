const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assessRuntimeCleanup,
  buildDescendantClosure,
  canUseProcessGroupSignal,
  observeDescendantClosure,
  observeRemainingProcesses,
  parseProcessTable,
  signalProcessTree,
  validateDedicatedProcessGroup,
  waitForProcessTreeExit,
} = require("../scripts/process-tree.cjs");

const records = [
  { pid: 100, ppid: 1, pgid: 100, rssKb: 10, state: "S", commandName: "node", commandLine: "node next start" },
  { pid: 101, ppid: 100, pgid: 100, rssKb: 20, state: "S", commandName: "node", commandLine: "node helper.js" },
  { pid: 102, ppid: 101, pgid: 100, rssKb: 30, state: "S", commandName: "node", commandLine: "node child.js" },
  { pid: 200, ppid: 1, pgid: 200, rssKb: 40, state: "S", commandName: "node", commandLine: "node unrelated.js" },
  { pid: 201, ppid: 1, pgid: 100, rssKb: 50, state: "S", commandName: "node", commandLine: "node unrelated-same-group.js" },
];
const runtimeRecords = records.filter((record) => record.pid < 200);

test("process table parsing keeps PID, parent, group, and identity fields", () => {
  const parsed = parseProcessTable(`
    100     1   100  10 S node node next start
    101   100   100  20 S node node helper.js
  `);
  assert.deepEqual(parsed, [records[0], records[1]]);
});

test("descendant closure follows parent-child edges and excludes unrelated processes", () => {
  const closure = buildDescendantClosure(records, 100);
  assert.equal(closure.rootObserved, true);
  assert.deepEqual(closure.pids, [100, 101, 102]);
  assert.equal(closure.processes[2].relation, "runtime-descendant");
  assert.equal(closure.processes[2].depth, 2);
});

test("explicit tree signals are ordered from descendants to root and tolerate ESRCH", () => {
  const closure = buildDescendantClosure(records, 100);
  const calls = [];
  const result = signalProcessTree(closure, "SIGTERM", {
    sendSignal(pid, signal) {
      calls.push([pid, signal]);
      if (pid === 102) throw Object.assign(new Error("already gone"), { code: "ESRCH" });
    },
  });
  assert.deepEqual(calls, [[102, "SIGTERM"], [101, "SIGTERM"], [100, "SIGTERM"]]);
  assert.equal(result.status, "PASS");
  assert.deepEqual(result.alreadyExitedPids, [102]);
  assert.deepEqual(result.sentPids, [101, 100]);
});

test("dedicated process group validation uses only the validated negative group ID", () => {
  const calls = [];
  const result = validateDedicatedProcessGroup(100, {
    platform: "darwin",
    sendSignal(pid, signal) {
      calls.push([pid, signal]);
    },
  });
  assert.equal(result.status, "PASS");
  assert.deepEqual(calls, [[-100, 0]]);
});

test("group scope is rejected when a same-group process is outside the runtime closure", () => {
  const observation = observeDescendantClosure(100, {
    expectedProcessGroupId: 100,
    readProcessTableImpl: () => records,
  });
  assert.equal(observation.processGroupMatches, true);
  assert.equal(observation.processGroupScoped, false);
  assert.deepEqual(observation.processGroupMembersOutsideClosure.map((record) => record.pid), [201]);
});

test("group signal eligibility passes only for a fully scoped closure", () => {
  const observation = observeDescendantClosure(100, {
    expectedProcessGroupId: 100,
    readProcessTableImpl: () => runtimeRecords,
  });
  assert.equal(observation.processGroupScoped, true);
  assert.equal(canUseProcessGroupSignal({ validated: true, id: 100 }, observation), true);
});

test("group scope is rejected when a runtime descendant leaves the expected group", () => {
  const observation = observeDescendantClosure(100, {
    expectedProcessGroupId: 100,
    readProcessTableImpl: () => runtimeRecords.map((record) => record.pid === 102
      ? { ...record, pgid: 300 }
      : record),
  });
  assert.equal(observation.processGroupMatches, true);
  assert.equal(observation.processGroupScoped, false);
  assert.deepEqual(observation.processTreeMembersOutsideExpectedGroup.map((record) => record.pid), [102]);
  assert.deepEqual(observation.processGroupMembersOutsideClosure, []);
});

test("a false group scope selects explicit PID tree targets including separated descendants", () => {
  const observation = observeDescendantClosure(100, {
    expectedProcessGroupId: 100,
    readProcessTableImpl: () => runtimeRecords.map((record) => record.pid === 102
      ? { ...record, pgid: 300 }
      : record),
  });
  assert.equal(canUseProcessGroupSignal({ validated: true, id: 100 }, observation), false);
  const calls = [];
  const result = signalProcessTree(observation, "SIGTERM", {
    sendSignal(pid, signal) {
      calls.push([pid, signal]);
    },
  });
  assert.equal(observation.processGroupScoped, false);
  assert.deepEqual(result.targetPids, [102, 101, 100]);
  assert.deepEqual(calls, [[102, "SIGTERM"], [101, "SIGTERM"], [100, "SIGTERM"]]);
});

test("shutdown polling records that every observed tree PID is gone", async () => {
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
});

test("shutdown polling includes a descendant observed after the initial snapshot", () => {
  const before = observeDescendantClosure(100, { readProcessTableImpl: () => records });
  const afterRecords = [
    ...records,
    { pid: 103, ppid: 100, pgid: 100, rssKb: 15, state: "S", commandName: "node", commandLine: "node late-child.js" },
  ];
  const after = observeRemainingProcesses(before, { readProcessTableImpl: () => afterRecords });
  assert.equal(after.status, "PASS");
  assert.equal(after.remainingPids.includes(103), true);
  assert.equal(after.processTree.find((record) => record.pid === 103).newSinceShutdown, true);
});

test("cleanup assessment fails when any observed descendant remains", () => {
  assert.equal(assessRuntimeCleanup({ status: "PASS", runtimeRootPid: 100 }).status, "FAIL");
  const base = {
    runtimeRootPid: 100,
    processTreeBeforeShutdown: { observationStatus: "PASS", pids: [100, 101, 102] },
    processTreeAfterShutdown: { observationStatus: "PASS", remainingPids: [102] },
  };
  assert.equal(assessRuntimeCleanup({ ...base, status: "PASS" }).status, "FAIL");
  assert.equal(assessRuntimeCleanup({
    ...base,
    status: "PASS",
    processTreeAfterShutdown: { observationStatus: "PASS", remainingPids: [] },
  }).status, "PASS");
});
