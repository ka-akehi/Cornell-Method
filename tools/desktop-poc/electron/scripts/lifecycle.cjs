const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { electronBinary } = require("./smoke.cjs");
const {
  CANDIDATE_ROOT,
  ensureDirectory,
  ensureOutputDirectories,
  getContext,
  relativeOutputPath,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
} = require("./common.cjs");
const { assessRuntimeCleanup } = require("./process-tree.cjs");

function uniqueRunDirectory(context) {
  ensureDirectory(context.evidenceRunsRoot);
  const base = `lifecycle-${Date.now()}-${process.pid}`;
  let target = path.join(context.evidenceRunsRoot, base);
  let suffix = 1;
  while (fs.existsSync(target)) {
    target = path.join(context.evidenceRunsRoot, `${base}-${suffix}`);
    suffix += 1;
  }
  ensureDirectory(target);
  return target;
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let timeout;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    timeout = setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        finish({ code: child.exitCode, signal: child.signalCode, timedOut: true });
      }, 2000);
    }, timeoutMs);
    child.once("exit", (code, signal) => finish({ code, signal, timedOut: false }));
    child.once("error", (error) => finish({ code: null, signal: null, timedOut: false, error: error.message }));
  });
}

function waitForFile(filePath, predicate, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (Date.now() >= deadline) {
        reject(new Error(`lifecycle state timeout: ${filePath}`));
        return;
      }
      if (fs.existsSync(filePath)) {
        try {
          const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
          if (predicate(value)) {
            resolve(value);
            return;
          }
        } catch {
          // The main process may still be writing the JSON file.
        }
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

function portIsListening(context) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: context.runtimeHost, port: context.runtimePort });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}

function startElectron(context, mode, paths, showWindow = "0") {
  const binary = electronBinary();
  const launchStartNs = process.hrtime.bigint();
  const child = spawn(
    binary,
    [path.join(CANDIDATE_ROOT, "src", "main.cjs"), `--poc-mode=${mode}`],
    {
      cwd: CANDIDATE_ROOT,
      env: {
        ...process.env,
        POC_BASELINE_MANIFEST: context.baselinePath,
        POC_STAGING_DIR: context.stagingRoot,
        POC_DATABASE_PATH: context.populatedDatabasePath,
        POC_RUNTIME_HOST: context.runtimeHost,
        POC_RUNTIME_PORT: String(context.runtimePort),
        POC_NODE_BINARY: process.execPath,
        POC_RESULT_FILE: paths.result,
        POC_LIFECYCLE_STATE_FILE: paths.state,
        POC_LIFECYCLE_COMMAND_FILE: paths.command,
        POC_ELECTRON_USER_DATA: paths.electronUserData,
        POC_LAUNCH_START_NS: launchStartNs.toString(),
        POC_SHOW_WINDOW: showWindow,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => { stdout += chunk; });
  child.stderr?.on("data", (chunk) => { stderr += chunk; });
  return { child, binary, stdout: () => stdout, stderr: () => stderr };
}

async function run() {
  const context = getContext();
  ensureOutputDirectories(context);
  let runDirectory;
  try {
    validateBaseline(context);
    if (!fs.existsSync(path.join(context.evidenceRoot, "preparation.json"))) {
      throw new Error("preparation.json がありません。先に candidate の prepare を実行してください");
    }
    if (!fs.existsSync(path.join(context.evidenceRoot, "build.json"))) {
      throw new Error("build.json がありません。先に candidate の production build を実行してください");
    }
    runDirectory = uniqueRunDirectory(context);
    const paths = {
      state: path.join(runDirectory, "lifecycle-state.json"),
      command: path.join(runDirectory, "lifecycle-command.json"),
      result: path.join(runDirectory, "electron-main-result.json"),
      electronUserData: path.join(context.populatedUserDataRoot, "electron-lifecycle-settings"),
    };
    const first = startElectron(context, "lifecycle", paths);
    const readyState = await waitForFile(paths.state, (value) => value.runtime?.readyStatus === "PASS" && value.primaryWindow?.count === 1);
    const duplicate = startElectron(context, "lifecycle", paths);
    const duplicateExit = await waitForExit(duplicate.child, 20_000);
    fs.writeFileSync(paths.command, `${JSON.stringify({ command: "close" })}\n`, "utf8");
    const firstExit = await waitForExit(first.child, 20_000);
    const finalState = fs.existsSync(paths.state) ? JSON.parse(fs.readFileSync(paths.state, "utf8")) : readyState;
    const portStillListening = await portIsListening(context);
    const runtimeCleanup = assessRuntimeCleanup(finalState.shutdown);
    const runtimePidStillExists = Array.isArray(runtimeCleanup.remainingPids) && runtimeCleanup.rootPid
      ? runtimeCleanup.remainingPids.includes(runtimeCleanup.rootPid)
      : null;
    const duplicateObserved = finalState.duplicateLaunches === 1 && finalState.lifecycleEvents?.some((event) => event.type === "second-instance");
    const primaryWindowPass = finalState.primaryWindow?.count === 1 && finalState.primaryWindow?.created === true;
    const shutdownPass = runtimeCleanup.status === "PASS" && !portStillListening && !firstExit.timedOut;
    const status = duplicateObserved && primaryWindowPass && shutdownPass && duplicateExit.code === 0 ? "PASS" : "FAIL";
    const report = {
      schemaVersion: 1,
      status,
      runDirectory: relativeOutputPath(context, runDirectory),
      binary: first.binary,
      singleApplicationInstance: {
        status: duplicateObserved ? "PASS" : "FAIL",
        lock: "Electron app.requestSingleInstanceLock",
        duplicateLaunchExit: duplicateExit,
        duplicateLaunchesObserved: finalState.duplicateLaunches ?? 0,
        eventObserved: duplicateObserved,
      },
      primaryWindow: {
        status: primaryWindowPass ? "PASS" : "FAIL",
        count: finalState.primaryWindow?.count ?? null,
        created: finalState.primaryWindow?.created ?? false,
        independentSettingsDialogCounted: false,
        osFileDialogCounted: false,
      },
      internalProcessAllowance: {
        status: "PASS",
        allowedRoles: ["Electron main", "renderer/WebView", "Next runtime", "framework helpers", "related child processes"],
        oneProcessLimitApplied: false,
      },
      shutdown: {
        status: shutdownPass ? "PASS" : "FAIL",
        primaryWindowCloseRequested: finalState.lifecycleEvents?.some((event) => event.type === "primary-window-close-request") ?? false,
        appOwnedCleanup: finalState.shutdown ?? null,
        observationWaitMs: context.observationWaitMs,
        loopbackListenerRemaining: portStillListening,
        runtimePidRemaining: runtimePidStillExists,
        runtimeRootPid: runtimeCleanup.rootPid,
        runtimeProcessTree: runtimeCleanup,
        processTreeBeforeShutdown: finalState.shutdown?.processTreeBeforeShutdown ?? null,
        processTreeAfterShutdown: finalState.shutdown?.processTreeAfterShutdown ?? null,
        firstProcessExit: firstExit,
      },
      statePath: paths.state,
      measuredAt: new Date().toISOString(),
    };
    writeJsonOwned(path.join(context.evidenceRoot, "lifecycle.json"), report);
    console.log(JSON.stringify({ status: report.status, evidence: path.join(context.evidenceRoot, "lifecycle.json") }));
    return report;
  } catch (error) {
    const failurePath = writeFailureSummary(context, "lifecycle", error);
    const report = {
      schemaVersion: 1,
      status: "BLOCKED",
      reason: error instanceof Error ? error.message : String(error),
      runDirectory: runDirectory ? relativeOutputPath(context, runDirectory) : null,
      measuredAt: new Date().toISOString(),
    };
    try {
      writeJsonOwned(path.join(context.evidenceRoot, "lifecycle.json"), report);
    } catch {
      // Preserve the original error.
    }
    console.error(`${report.reason}\nsummary: ${failurePath}`);
    if (error?.code === "BASELINE_MISMATCH") return report;
    throw error;
  }
}

if (require.main === module) {
  run().catch(() => { process.exitCode = 1; });
}

module.exports = { run };
