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
  observeDescendantClosure,
  observeRemainingProcesses,
  signalProcessTree,
  waitForProcessTreeExit,
} = require("./process-tree.cjs");
const {
  portIsListening,
  startTauri,
  tailOutput,
  tauriBinary,
  uniqueRunDirectory,
  waitForExit,
  waitForJson,
} = require("./tauri-runner.cjs");
const { recoverStaleRuntime } = require("./runtime-http.cjs");

function blockedReport(context, reason, runDirectory = null) {
  return {
    schemaVersion: 1,
    status: "BLOCKED",
    reason,
    runDirectory: runDirectory ? path.relative(context.outputRoot, runDirectory) : null,
    singleApplicationInstance: { status: "UNVERIFIED", reason },
    primaryWindow: { status: "UNVERIFIED", reason },
    shutdown: { status: "UNVERIFIED", reason },
    measuredAt: new Date().toISOString(),
  };
}

async function run() {
  const context = getContext();
  ensureOutputDirectories(context);
  let runDirectory = null;
  let first = null;
  let staleRecovery = null;
  try {
    validateBaseline(context);
    const preparation = readJson(path.join(context.evidenceRoot, "preparation.json"));
    const build = readJson(path.join(context.evidenceRoot, "build.json"));
    if (preparation.status !== "PASS") throw new Error("preparation が PASS ではないため lifecycle を起動しません");
    if (build.nextBuild?.status !== "PASS") throw new Error("production Next build が PASS ではないため lifecycle を起動しません");
    runDirectory = uniqueRunDirectory(context, "lifecycle");
    const binary = tauriBinary(context);
    if (!fs.existsSync(binary)) {
      const report = blockedReport(context, `Tauri native binary がありません（cargo tauri 未導入または build 未完了）: ${binary}`, runDirectory);
      writeJsonOwned(path.join(context.evidenceRoot, "lifecycle.json"), report);
      console.log(JSON.stringify({ status: report.status, reason: report.reason }));
      return report;
    }
    staleRecovery = await recoverStaleRuntime(context);
    const paths = {
      state: path.join(runDirectory, "lifecycle-state.json"),
      command: path.join(runDirectory, "lifecycle-command.json"),
      result: path.join(runDirectory, "tauri-main-result.json"),
      tauriUserData: path.join(context.populatedUserDataRoot, "tauri-lifecycle-settings"),
    };
    first = startTauri(context, "lifecycle", paths, "0");
    const readyState = await waitForJson(paths.state, (value) => (
      value.runtime?.readyStatus === "PASS" &&
      value.primaryWindow?.count === 1 &&
      value.primaryWindow?.usableObservationComplete === true
    ), 30_000, first.child);
    const shellBefore = observeDescendantClosure(first.child.pid, { expectedProcessGroupId: first.child.pid });
    const duplicate = startTauri(context, "lifecycle", paths, "0");
    const duplicateExit = await waitForExit(duplicate.child, 20_000);
    fs.writeFileSync(paths.command, `${JSON.stringify({ command: "close" })}\n`, "utf8");
    const firstExit = await waitForExit(first.child, 20_000);
    let shellWait = shellBefore.observationStatus === "PASS" ? await waitForProcessTreeExit(shellBefore, context.observationWaitMs) : { status: "UNVERIFIED", timedOut: true, after: observeRemainingProcesses(shellBefore) };
    if (firstExit.timedOut && shellBefore.observationStatus === "PASS" && shellWait.status !== "PASS") {
      const term = signalProcessTree(shellBefore, "SIGTERM");
      shellWait = { ...await waitForProcessTreeExit(shellBefore, 3000), forcedTerm: term };
    }
    const finalState = fs.existsSync(paths.state) ? readJson(paths.state) : readyState;
    const listenerRemaining = await portIsListening(context);
    const duplicateObserved = finalState.duplicateLaunches === 1 && finalState.lifecycleEvents?.some((event) => event.type === "duplicate-launch-focus");
    const primaryWindowPass = finalState.primaryWindow?.count === 1 && finalState.primaryWindow?.created === true;
    const shellCleanupPass = shellWait.status === "PASS" && !listenerRemaining && !firstExit.timedOut;
    const sidecarCleanupPass = finalState.shutdown?.status === "PASS";
    const shutdownPass = shellCleanupPass && sidecarCleanupPass;
    const status = duplicateObserved && primaryWindowPass && shutdownPass && duplicateExit.code === 0 ? "PASS" : "FAIL";
    const report = {
      schemaVersion: 1,
      status,
      runDirectory: path.relative(context.outputRoot, runDirectory),
      binary,
      singleApplicationInstance: {
        status: duplicateObserved ? "PASS" : "FAIL",
        lock: "Rust create_new lock plus loopback-free Unix socket handoff",
        duplicateLaunchExit: duplicateExit,
        duplicateLaunchStderr: tailOutput(duplicate.stderr()),
        duplicateLaunchesObserved: finalState.duplicateLaunches ?? 0,
        eventObserved: duplicateObserved,
        instanceRecovery: finalState.instanceRecovery ?? null,
      },
      primaryWindow: {
        status: primaryWindowPass ? "PASS" : "FAIL",
        count: finalState.primaryWindow?.count ?? null,
        created: finalState.primaryWindow?.created ?? false,
        existingWindowFocused: duplicateObserved,
        independentSettingsDialogCounted: false,
        osFileDialogCounted: false,
      },
      internalProcessAllowance: {
        status: "PASS",
        allowedRoles: ["Tauri Rust shell", "renderer/WebView", "Node.js sidecar", "framework helpers", "related child processes"],
        oneProcessLimitApplied: false,
      },
      shutdown: {
        status: shutdownPass ? "PASS" : "FAIL",
        primaryWindowCloseRequested: finalState.lifecycleEvents?.some((event) => event.type === "primary-window-close-request") ?? false,
        appOwnedCleanup: finalState.shutdown ?? null,
        observationWaitMs: context.observationWaitMs,
        loopbackListenerRemaining: listenerRemaining,
        sidecarRootPid: finalState.runtime?.rootPid ?? null,
        sidecarProcessTreeBeforeShutdown: finalState.shutdown?.processTreeBeforeShutdown ?? null,
        sidecarProcessTreeAfterShutdown: finalState.shutdown?.processTreeAfterShutdown ?? null,
        shellProcessTreeBeforeShutdown: shellBefore,
        shellProcessTreeAfterShutdown: shellWait.after ?? null,
        shellCleanup: shellWait,
        firstProcessExit: firstExit,
        staleRecovery,
      },
      measuredAt: new Date().toISOString(),
    };
    writeJsonOwned(path.join(context.evidenceRoot, "lifecycle.json"), report);
    console.log(JSON.stringify({ status: report.status, evidence: path.join(context.evidenceRoot, "lifecycle.json") }));
    return report;
  } catch (error) {
    try {
      const recovered = await recoverStaleRuntime(context);
      if (recovered) error.diagnostics = { ...(error.diagnostics ?? {}), staleRecovery: recovered };
    } catch (cleanupError) {
      error.diagnostics = {
        ...(error.diagnostics ?? {}),
        staleRecovery: { status: "UNVERIFIED", reason: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) },
      };
    }
    const failurePath = writeFailureSummary(context, "lifecycle", error);
    const report = blockedReport(context, error instanceof Error ? error.message : String(error), runDirectory);
    try { writeJsonOwned(path.join(context.evidenceRoot, "lifecycle.json"), report); } catch { /* preserve immutable evidence */ }
    console.error(`${report.reason}\nsummary: ${failurePath}`);
    return report;
  }
}

if (require.main === module) run().catch(() => { process.exitCode = 1; });

module.exports = { run };
