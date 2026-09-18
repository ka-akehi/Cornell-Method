const fs = require("node:fs");
const path = require("node:path");
const {
  ensureOutputDirectories,
  getContext,
  readJson,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
} = require("./common.cjs");
const {
  buildDescendantClosure,
  observeDescendantClosure,
  observeRemainingProcesses,
  readProcessTable,
  signalProcessTree,
  waitForProcessTreeExit,
} = require("./process-tree.cjs");
const {
  portIsListening,
  startTauri,
  stopOwnedProcess,
  tailOutput,
  tauriBinary,
  uniqueRunDirectory,
  waitForExit,
  waitForJson,
} = require("./tauri-runner.cjs");
const { recoverStaleRuntime } = require("./runtime-http.cjs");

function roleForProcess(record, rootPid, runtimePid, rendererPid) {
  if (record.pid === rootPid) return "tauri-main-shell";
  if (record.pid === runtimePid) return "node-sidecar-next-runtime";
  if (record.pid === rendererPid) return "renderer-webview";
  return record.commandLine.includes("WebKit") || record.commandLine.includes("webkit")
    ? "framework-helper-webview"
    : "related-child-process";
}

function memorySnapshot(rootPid, runtimePid, rendererPid) {
  try {
    const closure = buildDescendantClosure(readProcessTable(), rootPid);
    if (!closure.rootObserved) throw new Error(`Tauri main PID ${rootPid} が process table にありません`);
    const processes = closure.processes.map((record) => ({
      role: roleForProcess(record, rootPid, runtimePid, rendererPid),
      pid: record.pid,
      parentPid: record.parentPid,
      processGroupId: record.processGroupId,
      rssKb: record.rssKb,
      footprintBytes: null,
      footprintStatus: "not-collected",
      commandName: record.commandName,
    }));
    return {
      status: "PASS",
      aggregation: "descendant closure rooted at Tauri main PID; RSS from ps",
      scope: ["Tauri Rust shell", "renderer/WebView", "Node.js sidecar", "framework helpers", "related child processes"],
      processes,
      totalRssKb: processes.reduce((sum, record) => sum + record.rssKb, 0),
    };
  } catch (error) {
    return {
      status: "UNVERIFIED",
      scope: ["Tauri Rust shell", "renderer/WebView", "Node.js sidecar", "framework helpers", "related child processes"],
      processes: [],
      totalRssKb: null,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function blockedReport(context, reason, runDirectory) {
  return {
    schemaVersion: 1,
    status: "BLOCKED",
    reason,
    runDirectory: runDirectory ? path.relative(context.outputRoot, runDirectory) : null,
    nativeShell: { status: "BLOCKED", reason },
    coldStart: { status: "UNVERIFIED", reason },
    operations: { status: "UNVERIFIED", reason },
    memory: { status: "UNVERIFIED", reason },
    cleanup: { status: "UNVERIFIED", reason },
    persistence: { status: "UNVERIFIED", reason },
    uiSmoke: { status: "BLOCKED", reason },
    measuredAt: new Date().toISOString(),
  };
}

async function run() {
  const context = getContext();
  ensureOutputDirectories(context);
  let runDirectory = null;
  let launcher = null;
  let readyState = null;
  let staleRecovery = null;
  try {
    validateBaseline(context);
    const preparation = readJson(path.join(context.evidenceRoot, "preparation.json"));
    const build = readJson(path.join(context.evidenceRoot, "build.json"));
    if (preparation.status !== "PASS") throw new Error("preparation が PASS ではないため Tauri shell smoke を起動しません");
    if (build.nextBuild?.status !== "PASS") throw new Error("production Next build が PASS ではないため Tauri shell smoke を起動しません");
    runDirectory = uniqueRunDirectory(context, "smoke");
    const binary = tauriBinary(context);
    if (!fs.existsSync(binary)) {
      const report = blockedReport(context, `Tauri native binary がありません（cargo check/build 未完了）: ${binary}`, runDirectory);
      writeJsonOwned(path.join(context.evidenceRoot, "smoke.json"), report);
      console.log(JSON.stringify({ status: report.status, reason: report.reason }));
      return report;
    }
    staleRecovery = await recoverStaleRuntime(context);
    const paths = {
      state: path.join(runDirectory, "tauri-state.json"),
      command: path.join(runDirectory, "tauri-command.json"),
      result: path.join(runDirectory, "tauri-main-result.json"),
      tauriUserData: path.join(context.populatedUserDataRoot, "tauri-settings"),
    };
    const launchStartedAt = process.hrtime.bigint();
    launcher = startTauri(context, "smoke", paths, "0");
    readyState = await waitForJson(paths.state, (value) => (
      value.runtime?.readyStatus === "PASS" &&
      value.primaryWindow?.count === 1 &&
      value.primaryWindow?.usableObservationComplete === true
    ), 30_000, launcher.child);
    const readyMs = Math.round(Number(process.hrtime.bigint() - launchStartedAt) / 1_000_000);
    const shellBefore = observeDescendantClosure(launcher.child.pid, { expectedProcessGroupId: launcher.child.pid });
    const memory = memorySnapshot(launcher.child.pid, readyState.runtime?.rootPid, readyState.renderer?.pid);
    fs.writeFileSync(paths.command, `${JSON.stringify({ command: "close" })}\n`, "utf8");
    const exit = await waitForExit(launcher.child, 20_000);
    let shellWait = shellBefore.observationStatus === "PASS" ? await waitForProcessTreeExit(shellBefore, context.observationWaitMs) : { status: "UNVERIFIED", timedOut: true, after: observeRemainingProcesses(shellBefore) };
    if (exit.timedOut && shellBefore.observationStatus === "PASS" && shellWait.status !== "PASS") {
      const term = signalProcessTree(shellBefore, "SIGTERM");
      shellWait = await waitForProcessTreeExit(shellBefore, 3000);
      if (shellWait.status !== "PASS") {
        const killObservation = observeDescendantClosure(launcher.child.pid, { expectedProcessGroupId: launcher.child.pid });
        const kill = killObservation.observationStatus === "PASS" ? signalProcessTree(killObservation, "SIGKILL") : { status: "UNVERIFIED", reason: "shell descendant closure を再観測できず SIGKILL を送信しません" };
        shellWait = { ...await waitForProcessTreeExit(shellBefore, 2000), forcedTerm: term, forcedKill: kill };
      }
    }
    const finalState = fs.existsSync(paths.state) ? readJson(paths.state) : readyState;
    const listenerRemaining = await portIsListening(context);
    const shellCleanupPass = shellWait.status === "PASS" && !listenerRemaining && !exit.timedOut;
    const uiSmoke = finalState.uiSmoke ?? { status: "BLOCKED", reason: "Tauri GUI automation was not run" };
    const status = shellCleanupPass && uiSmoke.status === "PASS" ? "PASS" : uiSmoke.status === "BLOCKED" ? "BLOCKED" : "FAIL";
    const primaryWindow = readyState.primaryWindow ?? {
      count: 0,
      created: false,
      usableStatus: "UNVERIFIED",
      usableObservationComplete: false,
    };
    const primaryWindowUsableMs = readyState.coldStart?.processLaunchToPrimaryWindowUsableMs ?? null;
    const primaryWindowUsableStatus = primaryWindow.usableStatus === "PASS" && primaryWindowUsableMs != null
      ? "PASS"
      : primaryWindow.usableStatus === "BLOCKED" ? "BLOCKED" : "UNVERIFIED";
    const report = {
      schemaVersion: 1,
      status,
      runDirectory: path.relative(context.outputRoot, runDirectory),
      candidateBinary: binary,
      nativeShell: { status: "PASS", binary, mode: "Tauri Rust shell" },
      launch: { exit, stdoutTail: tailOutput(launcher.stdout()), stderrTail: tailOutput(launcher.stderr()) },
      coldStart: {
        status: primaryWindowUsableStatus,
        processLaunchToRuntimeReadyMs: readyState.coldStart?.processLaunchToRuntimeReadyMs ?? null,
        processLaunchToPrimaryWindowUsableMs: primaryWindowUsableMs,
        launcherSpawnToPrimaryWindowObservationMs: readyMs,
      },
      operations: readyState.operations ?? { status: "UNVERIFIED", reason: "Tauri GUI operation automation was not run" },
      memory,
      primaryWindow,
      instanceRecovery: readyState.instanceRecovery ?? null,
      renderer: readyState.renderer ?? { pid: null },
      runtime: readyState.runtime ?? { readyStatus: "UNVERIFIED" },
      uiSmoke,
      shutdown: readyState.shutdown ?? { status: "UNVERIFIED" },
      cleanup: {
        status: shellCleanupPass ? "PASS" : "FAIL",
        observationWaitMs: context.observationWaitMs,
        loopbackListenerRemaining: listenerRemaining,
        shellProcessTreeBeforeShutdown: shellBefore,
        shellProcessTreeAfterShutdown: shellWait.after ?? null,
        appProcessExit: exit,
        shellCleanup: shellWait,
        staleRecovery,
      },
      persistence: {
        status: "UNVERIFIED",
        reason: "renderer UI smoke was not executed; production runtime persistence is recorded by runtime-http-smoke.json",
      },
      measuredAt: new Date().toISOString(),
    };
    writeJsonOwned(path.join(context.evidenceRoot, "smoke.json"), report);
    console.log(JSON.stringify({ status: report.status, evidence: path.join(context.evidenceRoot, "smoke.json") }));
    return report;
  } catch (error) {
    let cleanup = null;
    if (launcher && launcher.child.exitCode === null && launcher.child.signalCode === null) {
      try {
        cleanup = await stopOwnedProcess(launcher.child, readyState);
      } catch (cleanupError) {
        cleanup = {
          status: "UNVERIFIED",
          reason: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        };
      }
    }
    try {
      const recovered = await recoverStaleRuntime(context);
      if (recovered) cleanup = { ...(cleanup ?? {}), staleRecovery: recovered };
    } catch (cleanupError) {
      cleanup = { ...(cleanup ?? {}), staleRecovery: { status: "UNVERIFIED", reason: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) } };
    }
    const failure = error instanceof Error ? error : new Error(String(error));
    failure.diagnostics = {
      binary: launcher?.binary ?? null,
      pid: launcher?.child?.pid ?? null,
      childExit: launcher?.child ? {
        code: launcher.child.exitCode,
        signal: launcher.child.signalCode,
      } : null,
      stdoutTail: launcher ? tailOutput(launcher.stdout(), 200) : [],
      stderrTail: launcher ? tailOutput(launcher.stderr(), 200) : [],
      cleanup,
    };
    const failurePath = writeFailureSummary(context, "smoke", failure);
    const report = blockedReport(context, failure.message, runDirectory);
    try { writeJsonOwned(path.join(context.evidenceRoot, "smoke.json"), report); } catch { /* preserve immutable evidence */ }
    console.error(`${report.reason}\nsummary: ${failurePath}`);
    return report;
  }
}

if (require.main === module) run().catch(() => { process.exitCode = 1; });

module.exports = { memorySnapshot, run };
