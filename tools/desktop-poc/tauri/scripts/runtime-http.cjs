const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  ensureOutputDirectories,
  fixtureReadBack,
  getContext,
  readJson,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
} = require("./common.cjs");
const { validateDedicatedProcessGroup, observeDescendantClosure } = require("./process-tree.cjs");
const { stopOwnedProcess } = require("./tauri-runner.cjs");

function reservePort(context) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => reject(new Error(`固定 loopback port ${context.runtimePort} は使用中です。別 port へ fallback しません: ${error.message}`)));
    server.listen({ host: context.runtimeHost, port: context.runtimePort }, () => server.close(() => resolve()));
  });
}

async function fetchJson(baseUrl, pathname, options = {}) {
  const startedAt = process.hrtime.bigint();
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return {
    ok: response.ok,
    status: response.status,
    body,
    durationMs: Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000),
  };
}

async function waitForRuntime(baseUrl) {
  const deadline = Date.now() + 20_000;
  let lastError = "not attempted";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/notes`);
      response.body?.cancel();
      if (response.ok) return response.status;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`staging production runtime readiness timeout: ${lastError}`);
}

function startRuntime(context) {
  const nextBinary = path.join(context.stagingRoot, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
  if (!fs.existsSync(nextBinary)) throw new Error(`staging Next binary がありません: ${nextBinary}`);
  const child = spawn(process.execPath, [nextBinary, "start", "--hostname", context.runtimeHost, "--port", String(context.runtimePort)], {
    cwd: context.stagingRoot,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      DATABASE_URL: `file:${context.populatedDatabasePath}`,
      PRISMA_PROVIDER: "sqlite",
      NODE_ENV: "production",
      CORNELL_FIXTURE_DIST_DIR: "next-dist",
      CORNELL_FIXTURE_TSCONFIG_PATH: "tsconfig.poc.json",
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (!Number.isInteger(child.pid) || child.pid <= 0) throw new Error(`sidecar root PID が正の整数ではありません: ${child.pid}`);
  return child;
}

function blockedReport(context, reason) {
  return {
    schemaVersion: 1,
    status: "BLOCKED",
    reason,
    runtime: { status: "UNVERIFIED", host: context.runtimeHost, port: context.runtimePort },
    operations: { status: "UNVERIFIED" },
    persistence: { status: "UNVERIFIED" },
    cleanup: { status: "UNVERIFIED" },
    uiSmoke: { status: "BLOCKED", reason: "runtime HTTP is not a renderer/WebView UI substitute" },
    measuredAt: new Date().toISOString(),
  };
}

async function run() {
  const context = getContext();
  ensureOutputDirectories(context);
  let runtimeProcess = null;
  let runtimeState = null;
  try {
    validateBaseline(context);
    const preparationPath = path.join(context.evidenceRoot, "preparation.json");
    const buildPath = path.join(context.evidenceRoot, "build.json");
    if (!fs.existsSync(preparationPath)) throw new Error("preparation.json がありません。先に candidate の prepare を実行してください");
    if (!fs.existsSync(buildPath)) throw new Error("build.json がありません。先に candidate の build を実行してください");
    const preparation = readJson(preparationPath);
    const build = readJson(buildPath);
    if (preparation.status !== "PASS") throw new Error("preparation が PASS ではないため production runtime を起動しません");
    if (build.nextBuild?.status !== "PASS") throw new Error("production Next build が PASS ではないため runtime HTTP smoke を起動しません");
    await reservePort(context);
    const baseUrl = `http://${context.runtimeHost}:${context.runtimePort}`;
    const runtimeStartedAt = process.hrtime.bigint();
    runtimeProcess = startRuntime(context);
    const processGroup = process.platform === "win32" ? { status: "UNVERIFIED", validated: false, id: null, reason: "Windows では process group signal を使用しません" } : validateDedicatedProcessGroup(runtimeProcess.pid);
    const pageStatus = await waitForRuntime(baseUrl);
    const runtimeReadyMs = Math.round(Number(process.hrtime.bigint() - runtimeStartedAt) / 1_000_000);
    const processTreeAtReady = observeDescendantClosure(runtimeProcess.pid, { expectedProcessGroupId: processGroup.id });
    runtimeState = {
      runtime: {
        rootPid: runtimeProcess.pid,
        pid: runtimeProcess.pid,
        processGroup,
        processTreeAtReady,
      },
    };
    const list = await fetchJson(baseUrl, "/api/notes?page=1");
    if (!list.ok || !Array.isArray(list.body?.data) || list.body.data.length === 0) throw new Error(`production runtime list API failed: HTTP ${list.status}`);
    const search = await fetchJson(baseUrl, "/api/notes?query=schema&page=1");
    if (!search.ok || search.body?.totalCount < 1) throw new Error(`production runtime search API failed: HTTP ${search.status}`);
    const noteId = list.body.data[0].id;
    const detail = await fetchJson(baseUrl, `/api/notes/${encodeURIComponent(noteId)}`);
    if (!detail.ok || detail.body?.id !== noteId) throw new Error(`production runtime detail API failed: HTTP ${detail.status}`);
    const editTitle = `${detail.body.title} [Tauri HTTP PoC]`;
    const payload = {
      title: editTitle,
      noteDate: detail.body.noteDate,
      sourceType: detail.body.sourceType,
      sourceTitle: detail.body.sourceTitle ?? "",
      bodyMode: detail.body.bodyMode,
      body: detail.body.body ?? "",
      summary: detail.body.summary ?? "",
      nextReviewDate: detail.body.nextReviewDate ?? null,
      cues: (detail.body.cues ?? []).map((cue) => ({ text: cue.text, order: cue.order })),
      tags: (detail.body.tags ?? []).map((tag) => ({ name: tag.name, color: tag.color ?? null })),
      ...(detail.body.bodyMode === "canvas" ? { canvas: detail.body.canvas } : {}),
    };
    const save = await fetchJson(baseUrl, `/api/notes/${encodeURIComponent(noteId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!save.ok || save.body?.title !== editTitle) throw new Error(`production runtime explicit save API failed: HTTP ${save.status}`);
    const reopen = await fetchJson(baseUrl, `/api/notes/${encodeURIComponent(noteId)}`);
    if (!reopen.ok || reopen.body?.title !== editTitle) throw new Error(`production runtime reopen persistence failed: HTTP ${reopen.status}`);
    const readBack = fixtureReadBack(context.populatedDatabasePath, context);
    const cleanup = await stopOwnedProcess(runtimeProcess, runtimeState);
    runtimeProcess = null;
    await new Promise((resolve) => setTimeout(resolve, context.observationWaitMs));
    const listenerRemaining = await portIsListening(context);
    const persistencePass = readBack.foreignKeyCheck === "pass" && readBack.sqliteIntegrityCheck === "ok";
    const cleanupPass = cleanup.status === "PASS" && !listenerRemaining && !cleanup.exit.timedOut;
    const report = {
      schemaVersion: 1,
      status: persistencePass && cleanupPass ? "PASS" : "FAIL",
      build: { status: build.status, nextBuild: build.nextBuild, mode: build.nextBuild.mode ?? "UNVERIFIED", cacheState: build.nextBuild.cacheState ?? "UNVERIFIED" },
      runtime: {
        status: "PASS",
        host: context.runtimeHost,
        port: context.runtimePort,
        pageHttpStatus: pageStatus,
        readinessMs: runtimeReadyMs,
        databasePath: context.populatedDatabasePath,
        databaseUrl: `file:${context.populatedDatabasePath}`,
        sidecarRootPid: runtimeProcess?.pid ?? runtimeState.runtime.rootPid,
      },
      operations: {
        list: { status: "PASS", durationMs: list.durationMs, totalCount: list.body.totalCount },
        search: { status: "PASS", durationMs: search.durationMs, totalCount: search.body.totalCount, queryRecorded: false },
        detail: { status: "PASS", durationMs: detail.durationMs, noteId },
        edit: { status: "PASS", durationMs: 0, noteId, payloadPreparedFromPersistedDetail: true },
        explicitSave: { status: "PASS", durationMs: save.durationMs, noteId },
        reopen: { status: "PASS", durationMs: reopen.durationMs, noteId },
      },
      persistence: {
        status: persistencePass ? "PASS" : "FAIL",
        noteId,
        readBack: {
          ...readBack,
          noteBodyRecorded: false,
          queryRecorded: false,
        },
        editedTitleReadBack: true,
      },
      cleanup: {
        status: cleanupPass ? "PASS" : "FAIL",
        observationWaitMs: context.observationWaitMs,
        loopbackListenerRemaining: listenerRemaining,
        processTreeBeforeShutdown: cleanup.processTreeBeforeShutdown,
        processTreeAfterShutdown: cleanup.processTreeAfterShutdown,
        rootPid: cleanup.rootPid,
        signalSelection: cleanup.signalSelection,
        sigterm: cleanup.sigterm,
        sigkill: cleanup.sigkill,
        exit: cleanup.exit,
      },
      uiSmoke: {
        status: "BLOCKED",
        reason: "Tauri native WebView GUI automation is not available in the GUI-independent runtime-http command",
      },
      measuredAt: new Date().toISOString(),
    };
    writeJsonOwned(path.join(context.evidenceRoot, "runtime-http-smoke.json"), report);
    console.log(JSON.stringify({ status: report.status, evidence: path.join(context.evidenceRoot, "runtime-http-smoke.json") }));
    return report;
  } catch (error) {
    if (runtimeProcess) {
      try { await stopOwnedProcess(runtimeProcess, runtimeState); } catch { /* preserve original blocker */ }
    }
    const failurePath = writeFailureSummary(context, "runtime-http-smoke", error);
    const report = blockedReport(context, error instanceof Error ? error.message : String(error));
    try { writeJsonOwned(path.join(context.evidenceRoot, "runtime-http-smoke.json"), report); } catch { /* preserve immutable evidence */ }
    console.error(`${report.reason}\nsummary: ${failurePath}`);
    return report;
  }
}

if (require.main === module) run().catch(() => { process.exitCode = 1; });

module.exports = { fetchJson, run, waitForRuntime };
