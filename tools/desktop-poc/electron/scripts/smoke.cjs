const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  CANDIDATE_ROOT,
  REPOSITORY_ROOT,
  ensureDirectory,
  ensureOutputDirectories,
  fixtureReadBack,
  getContext,
  relativeOutputPath,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
} = require("./common.cjs");
const { assessRuntimeCleanup } = require("./process-tree.cjs");

function electronBinary() {
  const electronPackage = path.dirname(require.resolve("electron/package.json", { paths: [CANDIDATE_ROOT] }));
  const binary = process.platform === "darwin"
    ? path.join(electronPackage, "dist", "Electron.app", "Contents", "MacOS", "Electron")
    : path.join(electronPackage, "dist", process.platform === "win32" ? "electron.exe" : "electron");
  return binary;
}

function uniqueRunDirectory(context, prefix) {
  ensureDirectory(context.evidenceRunsRoot);
  const base = `${prefix}-${Date.now()}-${process.pid}`;
  let candidate = path.join(context.evidenceRunsRoot, base);
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(context.evidenceRunsRoot, `${base}-${suffix}`);
    suffix += 1;
  }
  ensureDirectory(candidate);
  return candidate;
}

function tailOutput(buffer) {
  return String(buffer).split(/\r?\n/).filter(Boolean).slice(-8);
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timeout = setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        finish({ code: child.exitCode, signal: child.signalCode, timedOut: true });
      }, 2000);
    }, timeoutMs);
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      finish({ code, signal, timedOut: false });
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      finish({ code: null, signal: null, timedOut: false, error: error.message });
    });
  });
}

function portIsListening(context) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: context.runtimeHost, port: context.runtimePort });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function readEditedNote(databasePath, noteId) {
  const Database = require(path.join(REPOSITORY_ROOT, "node_modules", "better-sqlite3"));
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    return db.prepare("SELECT id, title FROM notebooks WHERE id = ?").get(noteId) ?? null;
  } finally {
    db.close();
  }
}

function makeBlockedReport(context, reason, runDirectory = null) {
  return {
    schemaVersion: 1,
    status: "BLOCKED",
    reason,
    runDirectory: runDirectory ? path.relative(context.outputRoot, runDirectory) : null,
    coldStart: { status: "UNVERIFIED", reason },
    operations: { status: "UNVERIFIED", reason },
    memory: { status: "UNVERIFIED", reason },
    cleanup: { status: "UNVERIFIED", reason },
    measuredAt: new Date().toISOString(),
  };
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
    runDirectory = uniqueRunDirectory(context, "smoke");
    const binary = electronBinary();
    if (!fs.existsSync(binary)) {
      const report = makeBlockedReport(context, `Electron binary がありません（candidate install 未完了）: ${binary}`, runDirectory);
      writeJsonOwned(path.join(context.evidenceRoot, "smoke.json"), report);
      console.log(JSON.stringify({ status: report.status, reason: report.reason }));
      return report;
    }
    const mainResultPath = path.join(runDirectory, "electron-main-result.json");
    const electronUserData = path.join(context.populatedUserDataRoot, "electron-settings");
    const launchStartNs = process.hrtime.bigint();
    const child = spawn(
      binary,
      [path.join(CANDIDATE_ROOT, "src", "main.cjs"), "--poc-mode=smoke"],
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
          POC_RESULT_FILE: mainResultPath,
          POC_ELECTRON_USER_DATA: electronUserData,
          POC_LAUNCH_START_NS: launchStartNs.toString(),
          POC_SHOW_WINDOW: "0",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    const exit = await waitForExit(child, 75_000);
    const mainResult = fs.existsSync(mainResultPath) ? JSON.parse(fs.readFileSync(mainResultPath, "utf8")) : null;
    const portStillListening = await portIsListening(context);
    const runtimeCleanup = assessRuntimeCleanup(mainResult?.shutdown);
    const runtimePidStillExists = Array.isArray(runtimeCleanup.remainingPids) && runtimeCleanup.rootPid
      ? runtimeCleanup.remainingPids.includes(runtimeCleanup.rootPid)
      : null;
    let persistence = {
      status: "UNVERIFIED",
      databasePath: context.populatedDatabasePath,
      readBack: null,
      editedNote: null,
    };
    if (mainResult?.uiSmoke?.editedNoteId) {
      const readBack = fixtureReadBack(context.populatedDatabasePath);
      const editedNote = readEditedNote(context.populatedDatabasePath, mainResult.uiSmoke.editedNoteId);
      persistence = {
        status: readBack.foreignKeyCheck === "pass" && readBack.sqliteIntegrityCheck === "ok" && editedNote?.title === mainResult.uiSmoke.editedTitle
          ? "PASS"
          : "FAIL",
        databasePath: context.populatedDatabasePath,
        readBack: {
          ...readBack,
          fixtureContentHashAfterSmoke: readBack.contentHash,
        },
        editedNote: editedNote ? { id: editedNote.id, title: editedNote.title } : null,
      };
    }
    const cleanupStatus = runtimeCleanup.status === "PASS" && !portStillListening && !exit.timedOut ? "PASS" : "FAIL";
    const status = mainResult?.status === "PASS" && persistence.status === "PASS" && cleanupStatus === "PASS"
      ? "PASS"
      : mainResult?.status === "BLOCKED" ? "BLOCKED" : "FAIL";
    const report = {
      schemaVersion: 1,
      status,
      runDirectory: relativeOutputPath(context, runDirectory),
      candidateBinary: binary,
      launch: {
        exit,
        stdoutTail: tailOutput(stdout),
        stderrTail: tailOutput(stderr),
      },
      mainResultPath,
      coldStart: mainResult?.coldStart ?? { status: "UNVERIFIED", reason: "main result unavailable" },
      operations: mainResult?.operations ?? { status: "UNVERIFIED", reason: "main result unavailable" },
      memory: mainResult?.memory ?? { status: "UNVERIFIED", reason: "main result unavailable" },
      primaryWindow: mainResult?.primaryWindow ?? { count: 0, created: false },
      uiSmoke: mainResult?.uiSmoke ?? { status: "UNVERIFIED" },
      runtime: mainResult?.runtime ?? { readyStatus: "UNVERIFIED" },
      shutdown: mainResult?.shutdown ?? { status: "UNVERIFIED" },
      persistence,
      cleanup: {
        status: cleanupStatus,
        observationWaitMs: context.observationWaitMs,
        loopbackListenerRemaining: portStillListening,
        runtimePidRemaining: runtimePidStillExists,
        runtimeRootPid: runtimeCleanup.rootPid,
        runtimeProcessTree: runtimeCleanup,
        processTreeBeforeShutdown: mainResult?.shutdown?.processTreeBeforeShutdown ?? null,
        processTreeAfterShutdown: mainResult?.shutdown?.processTreeAfterShutdown ?? null,
        appProcessExit: exit,
      },
      errors: mainResult?.errors ?? [],
      measuredAt: new Date().toISOString(),
    };
    writeJsonOwned(path.join(context.evidenceRoot, "smoke.json"), report);
    console.log(JSON.stringify({ status: report.status, evidence: path.join(context.evidenceRoot, "smoke.json") }));
    return report;
  } catch (error) {
    const failurePath = writeFailureSummary(context, "smoke", error);
    const report = makeBlockedReport(context, error instanceof Error ? error.message : String(error), runDirectory);
    try {
      writeJsonOwned(path.join(context.evidenceRoot, "smoke.json"), report);
    } catch {
      // Preserve the original failure in the command result.
    }
    console.error(`${error instanceof Error ? error.message : String(error)}\nsummary: ${failurePath}`);
    if (error?.code === "BASELINE_MISMATCH") return report;
    throw error;
  }
}

if (require.main === module) {
  run().catch(() => { process.exitCode = 1; });
}

module.exports = { run, electronBinary };
