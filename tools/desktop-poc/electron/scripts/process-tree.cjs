const { execFileSync } = require("node:child_process");

const PROCESS_TABLE_ARGS = ["-axo", "pid=,ppid=,pgid=,rss=,state=,comm=,command="];
const EXPLICIT_PID_SIGNAL_METHOD = "explicit-pid-from-validated-descendant-closure";
const PROCESS_GROUP_SIGNAL_METHOD = "validated-dedicated-process-group";

function isPositivePid(value) {
  return Number.isInteger(value) && value > 0;
}

function parseProcessTable(output) {
  const records = [];
  for (const line of String(output).split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)(?:\s+(.*))?$/);
    if (!match) continue;
    records.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      pgid: Number(match[3]),
      rssKb: Number(match[4]),
      state: match[5],
      commandName: match[6],
      commandLine: match[7] ?? match[6],
    });
  }
  return records;
}

function readProcessTable(execFileSyncImpl = execFileSync) {
  return parseProcessTable(execFileSyncImpl("ps", PROCESS_TABLE_ARGS, {
    encoding: "utf8",
    timeout: 1000,
    killSignal: "SIGKILL",
  }));
}

function toProcessEvidence(record, extra = {}) {
  return {
    pid: record.pid,
    parentPid: record.ppid,
    processGroupId: record.pgid,
    rssKb: record.rssKb,
    state: record.state,
    commandName: record.commandName,
    commandLine: record.commandLine,
    ...extra,
  };
}

function buildDescendantClosure(records, rootPid) {
  if (!isPositivePid(rootPid)) {
    throw new TypeError(`root PID must be a positive integer: ${rootPid}`);
  }
  const byPid = new Map();
  const childrenByParent = new Map();
  for (const record of records) {
    if (!isPositivePid(record.pid) || !isPositivePid(record.ppid)) continue;
    if (!byPid.has(record.pid)) byPid.set(record.pid, record);
    const children = childrenByParent.get(record.ppid) ?? [];
    children.push(record);
    childrenByParent.set(record.ppid, children);
  }
  const processes = [];
  const queue = [{ pid: rootPid, depth: 0 }];
  const seen = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current.pid)) continue;
    seen.add(current.pid);
    const record = byPid.get(current.pid);
    if (!record) continue;
    processes.push(toProcessEvidence(record, {
      depth: current.depth,
      relation: current.depth === 0 ? "runtime-root" : "runtime-descendant",
    }));
    for (const child of childrenByParent.get(current.pid) ?? []) {
      queue.push({ pid: child.pid, depth: current.depth + 1 });
    }
  }
  const root = processes.find((record) => record.pid === rootPid) ?? null;
  return {
    rootPid,
    rootObserved: Boolean(root),
    rootParentPid: root?.parentPid ?? null,
    rootProcessGroupId: root?.processGroupId ?? null,
    pids: processes.map((record) => record.pid),
    processes,
  };
}

function observeDescendantClosure(rootPid, {
  readProcessTableImpl = readProcessTable,
  expectedProcessGroupId = null,
} = {}) {
  const observedAt = new Date().toISOString();
  if (!isPositivePid(rootPid)) {
    return {
      status: "UNVERIFIED",
      observationStatus: "UNVERIFIED",
      rootPid,
      rootObserved: false,
      processTree: [],
      pids: null,
      expectedProcessGroupId,
      error: `root PID must be a positive integer: ${rootPid}`,
      observedAt,
    };
  }
  try {
    const table = readProcessTableImpl();
    const closure = buildDescendantClosure(table, rootPid);
    const closurePids = new Set(closure.pids);
    const groupMembers = expectedProcessGroupId == null
      ? null
      : table
        .filter((record) => record.pgid === expectedProcessGroupId)
        .map((record) => toProcessEvidence(record));
    const groupMembersOutsideClosure = groupMembers == null
      ? null
      : groupMembers.filter((record) => !closurePids.has(record.pid));
    const processTreeMembersOutsideExpectedGroup = expectedProcessGroupId == null
      ? null
      : closure.processes.filter((record) => record.processGroupId !== expectedProcessGroupId);
    const processGroupScopeReasons = [];
    if (expectedProcessGroupId != null) {
      if (!closure.rootObserved) {
        processGroupScopeReasons.push("runtime root が観測できません");
      } else if (closure.rootProcessGroupId !== expectedProcessGroupId) {
        processGroupScopeReasons.push("runtime root の process group ID が expected group ID と一致しません");
      }
      if (processTreeMembersOutsideExpectedGroup.length > 0) {
        processGroupScopeReasons.push(
          `runtime descendant closure に expected group 外の process があります: ${processTreeMembersOutsideExpectedGroup.map((record) => record.pid).join(", ")}`,
        );
      }
      if (groupMembersOutsideClosure.length > 0) {
        processGroupScopeReasons.push(
          `expected group に runtime descendant closure 外の process があります: ${groupMembersOutsideClosure.map((record) => record.pid).join(", ")}`,
        );
      }
    }
    const processGroupScoped = expectedProcessGroupId == null
      ? null
      : !closure.rootObserved
        ? null
        : closure.rootProcessGroupId === expectedProcessGroupId &&
          processTreeMembersOutsideExpectedGroup.length === 0 &&
          groupMembersOutsideClosure.length === 0;
    return {
      status: closure.rootObserved ? "PASS" : "UNVERIFIED",
      observationStatus: closure.rootObserved ? "PASS" : "UNVERIFIED",
      rootPid: closure.rootPid,
      rootObserved: closure.rootObserved,
      rootParentPid: closure.rootParentPid,
      rootProcessGroupId: closure.rootProcessGroupId,
      expectedProcessGroupId,
      processGroupMatches: expectedProcessGroupId == null || !closure.rootObserved
        ? null
        : closure.rootProcessGroupId === expectedProcessGroupId,
      processGroupScoped,
      processGroupScopeReason: processGroupScopeReasons.length > 0
        ? processGroupScopeReasons.join("; ")
        : null,
      processGroupMembers: groupMembers,
      processGroupMembersOutsideClosure: groupMembersOutsideClosure,
      processTreeMembersOutsideExpectedGroup,
      processTree: closure.processes,
      pids: closure.pids,
      processTableCount: table.length,
      observedAt,
    };
  } catch (error) {
    return {
      status: "UNVERIFIED",
      observationStatus: "UNVERIFIED",
      rootPid,
      rootObserved: false,
      processTree: [],
      pids: null,
      expectedProcessGroupId,
      error: error instanceof Error ? error.message : String(error),
      observedAt,
    };
  }
}

function canUseProcessGroupSignal(processGroup, observation) {
  return Boolean(
    processGroup?.validated === true &&
    isPositivePid(processGroup.id) &&
    observation?.observationStatus === "PASS" &&
    observation.rootObserved === true &&
    Array.isArray(observation.pids) &&
    observation.pids.length > 0 &&
    Array.isArray(observation.processTree) &&
    observation.processTree.length > 0 &&
    observation.expectedProcessGroupId === processGroup.id &&
    observation.processGroupMatches === true &&
    observation.processGroupScoped === true
  );
}

function sameProcessIdentity(before, after) {
  if (!before || !after || before.pid !== after.pid) return false;
  const afterProcessGroupId = after.processGroupId ?? after.pgid;
  if (before.processGroupId !== afterProcessGroupId) return false;
  if (before.commandName && after.commandName && before.commandName !== after.commandName) return false;
  return true;
}

function observeRemainingProcesses(beforeObservation, {
  readProcessTableImpl = readProcessTable,
} = {}) {
  const observedAt = new Date().toISOString();
  const beforeProcesses = beforeObservation?.processTree;
  if (!beforeObservation?.rootObserved || !Array.isArray(beforeProcesses) || beforeProcesses.length === 0) {
    return {
      status: "UNVERIFIED",
      observationStatus: "UNVERIFIED",
      rootPid: beforeObservation?.rootPid ?? null,
      rootObserved: false,
      processTree: [],
      remainingPids: null,
      observedAt,
      reason: "shutdown 前の runtime descendant closure が観測できていません",
    };
  }
  try {
    const table = readProcessTableImpl();
    const currentByPid = new Map(table.map((record) => [record.pid, record]));
    const beforeByPid = new Map(beforeProcesses.map((record) => [record.pid, record]));
    const remaining = [];
    const identityMismatches = [];
    for (const before of beforeProcesses) {
      const current = currentByPid.get(before.pid);
      if (!current) continue;
      if (sameProcessIdentity(before, current)) {
        remaining.push(toProcessEvidence(current, {
          depth: before.depth,
          relation: before.relation,
          shutdownBeforeParentPid: before.parentPid,
        }));
      } else {
        identityMismatches.push({
          pid: before.pid,
          before: {
            commandName: before.commandName,
            processGroupId: before.processGroupId,
          },
          after: {
            commandName: current.commandName,
            processGroupId: current.pgid,
          },
        });
      }
    }
    const currentClosure = buildDescendantClosure(table, beforeObservation.rootPid);
    for (const current of currentClosure.processes) {
      if (beforeByPid.has(current.pid) || remaining.some((record) => record.pid === current.pid)) continue;
      remaining.push({ ...current, newSinceShutdown: true });
    }
    return {
      status: identityMismatches.length > 0 ? "UNVERIFIED" : "PASS",
      observationStatus: identityMismatches.length > 0 ? "UNVERIFIED" : "PASS",
      rootPid: beforeObservation.rootPid,
      rootObserved: Boolean(remaining.some((record) => record.pid === beforeObservation.rootPid)),
      processTree: remaining,
      remainingPids: remaining.map((record) => record.pid),
      identityMismatches,
      processTableCount: table.length,
      observedAt,
    };
  } catch (error) {
    return {
      status: "UNVERIFIED",
      observationStatus: "UNVERIFIED",
      rootPid: beforeObservation.rootPid,
      rootObserved: false,
      processTree: [],
      remainingPids: null,
      observedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function waitForProcessTreeExit(beforeObservation, timeoutMs, {
  readProcessTableImpl = readProcessTable,
  intervalMs = 100,
} = {}) {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  return new Promise((resolve) => {
    const poll = () => {
      const after = observeRemainingProcesses(beforeObservation, { readProcessTableImpl });
      if (after.status === "PASS" && after.remainingPids.length === 0) {
        resolve({
          status: "PASS",
          timedOut: false,
          timeoutMs,
          elapsedMs: Date.now() - startedAt,
          after,
        });
        return;
      }
      if (Date.now() >= deadline) {
        resolve({
          status: after.status === "UNVERIFIED" ? "UNVERIFIED" : "TIMEOUT",
          timedOut: true,
          observationTimedOut: after.status === "UNVERIFIED",
          timeoutMs,
          elapsedMs: Date.now() - startedAt,
          after,
        });
        return;
      }
      setTimeout(poll, Math.max(0, intervalMs));
    };
    poll();
  });
}

function signalProcessTree(observation, signal, { sendSignal = process.kill } = {}) {
  const records = observation?.processTree ?? observation?.processes ?? [];
  const unique = new Map();
  for (const record of records) {
    if (isPositivePid(record.pid) && !unique.has(record.pid)) unique.set(record.pid, record);
  }
  const targets = [...unique.values()].sort((left, right) => {
    if ((right.depth ?? 0) !== (left.depth ?? 0)) return (right.depth ?? 0) - (left.depth ?? 0);
    return right.pid - left.pid;
  });
  const result = {
    status: "PASS",
    requested: targets.length > 0,
    method: EXPLICIT_PID_SIGNAL_METHOD,
    signal,
    targetPids: targets.map((record) => record.pid),
    sentPids: [],
    delivered: false,
    alreadyExitedPids: [],
    failedPids: [],
    errors: [],
  };
  if (targets.length === 0) {
    result.status = "UNVERIFIED";
    result.reason = "観測済みの runtime process PID がありません。広範囲な kill は行いません";
    return result;
  }
  for (const record of targets) {
    try {
      sendSignal(record.pid, signal);
      result.sentPids.push(record.pid);
      result.delivered = true;
    } catch (error) {
      if (error?.code === "ESRCH") {
        result.alreadyExitedPids.push(record.pid);
        continue;
      }
      result.failedPids.push(record.pid);
      result.errors.push({ pid: record.pid, code: error?.code ?? null, message: error instanceof Error ? error.message : String(error) });
    }
  }
  if (result.failedPids.length > 0) result.status = "FAIL";
  return result;
}

function validateDedicatedProcessGroup(groupId, {
  sendSignal = process.kill,
  platform = process.platform,
  rootPid = groupId,
} = {}) {
  const result = {
    status: "UNVERIFIED",
    rootPid,
    groupId,
    method: PROCESS_GROUP_SIGNAL_METHOD,
    validationMethod: "detached child group leader plus process.kill(-groupId, 0)",
    validated: false,
  };
  if (platform === "win32") {
    result.reason = "Windows では負の process group signal を使用しません";
    return result;
  }
  if (!isPositivePid(rootPid) || !isPositivePid(groupId)) {
    result.reason = `runtime root PID / process group ID must be positive integers: root=${rootPid}, group=${groupId}`;
    return result;
  }
  if (rootPid !== groupId) {
    result.reason = "detached runtime の root PID と process group ID が一致しません";
    return result;
  }
  try {
    sendSignal(-groupId, 0);
    result.status = "PASS";
    result.validated = true;
  } catch (error) {
    result.error = { code: error?.code ?? null, message: error instanceof Error ? error.message : String(error) };
    result.reason = "dedicated process group を検証できません";
  }
  return result;
}

function signalProcessGroup(groupId, signal, {
  sendSignal = process.kill,
  observedPids = [],
} = {}) {
  const result = {
    status: "PASS",
    requested: true,
    method: PROCESS_GROUP_SIGNAL_METHOD,
    signal,
    groupId,
    target: `-${groupId}`,
    observedTargetPids: observedPids,
    delivered: false,
    alreadyExited: false,
    error: null,
  };
  try {
    sendSignal(-groupId, signal);
    result.delivered = true;
  } catch (error) {
    if (error?.code === "ESRCH") {
      result.alreadyExited = true;
      return result;
    }
    result.status = "FAIL";
    result.error = { code: error?.code ?? null, message: error instanceof Error ? error.message : String(error) };
  }
  return result;
}

function assessRuntimeCleanup(shutdownEvidence) {
  const evidence = shutdownEvidence?.processTreeBeforeShutdown
    ? shutdownEvidence
    : shutdownEvidence?.runtime;
  const before = evidence?.processTreeBeforeShutdown;
  const after = evidence?.processTreeAfterShutdown;
  const beforePids = Array.isArray(before?.pids) ? before.pids : null;
  const remainingPids = Array.isArray(after?.remainingPids) ? after.remainingPids : null;
  const status = evidence?.status === "PASS" &&
    isPositivePid(evidence?.runtimeRootPid) &&
    before?.observationStatus === "PASS" &&
    after?.observationStatus === "PASS" &&
    Array.isArray(remainingPids) &&
    remainingPids.length === 0
    ? "PASS"
    : "FAIL";
  return {
    status,
    rootPid: evidence?.runtimeRootPid ?? null,
    observedBeforePids: beforePids,
    remainingPids,
    beforeObservationStatus: before?.observationStatus ?? "UNVERIFIED",
    afterObservationStatus: after?.observationStatus ?? "UNVERIFIED",
    reason: status === "PASS" ? null : "runtime root と shutdown 前に観測した descendant closure 全体の終了を確認できません",
  };
}

module.exports = {
  EXPLICIT_PID_SIGNAL_METHOD,
  PROCESS_GROUP_SIGNAL_METHOD,
  assessRuntimeCleanup,
  buildDescendantClosure,
  canUseProcessGroupSignal,
  isPositivePid,
  observeDescendantClosure,
  observeRemainingProcesses,
  parseProcessTable,
  readProcessTable,
  sameProcessIdentity,
  signalProcessGroup,
  signalProcessTree,
  toProcessEvidence,
  validateDedicatedProcessGroup,
  waitForProcessTreeExit,
};
