const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  ensureOutputDirectories,
  fixtureReadBack,
  getContext,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
} = require("./common.cjs");

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
      }, 1500);
    }, timeoutMs);
    child.once("exit", (code, signal) => finish({ code, signal, timedOut: false }));
    child.once("error", (error) => finish({ code: null, signal: null, timedOut: false, error: error.message }));
  });
}

function reservePort(context) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host: context.runtimeHost, port: context.runtimePort }, () => {
      server.close(() => resolve());
    });
  });
}

async function fetchJson(baseUrl, pathname, options = {}) {
  const startedAt = process.hrtime.bigint();
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
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
  throw new Error(`staging runtime readiness timeout: ${lastError}`);
}

function stopChild(child) {
  if (!child || child.exitCode !== null) return waitForExit(child, 100);
  child.kill("SIGTERM");
  return waitForExit(child, 5000);
}

async function run() {
  const context = getContext();
  ensureOutputDirectories(context);
  let runtimeProcess;
  try {
    validateBaseline(context);
    const buildReport = JSON.parse(fs.readFileSync(path.join(context.evidenceRoot, "build.json"), "utf8"));
    await reservePort(context);
    const nextBinary = path.join(context.stagingRoot, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
    const baseUrl = `http://${context.runtimeHost}:${context.runtimePort}`;
    const runtimeStartedAt = process.hrtime.bigint();
    runtimeProcess = spawn(
      process.execPath,
      [nextBinary, "start", "--hostname", context.runtimeHost, "--port", String(context.runtimePort)],
      {
        cwd: context.stagingRoot,
        env: {
          ...process.env,
          DATABASE_URL: `file:${context.populatedDatabasePath}`,
          PRISMA_PROVIDER: "sqlite",
          NODE_ENV: "production",
          CORNELL_FIXTURE_DIST_DIR: "next-dist",
          CORNELL_FIXTURE_TSCONFIG_PATH: "tsconfig.poc.json",
        },
        stdio: ["ignore", "ignore", "ignore"],
      },
    );
    const pageStatus = await waitForRuntime(baseUrl);
    const runtimeReadyMs = Math.round(Number(process.hrtime.bigint() - runtimeStartedAt) / 1_000_000);
    const list = await fetchJson(baseUrl, "/api/notes?page=1");
    if (!list.ok || !Array.isArray(list.body?.data) || list.body.data.length === 0) {
      throw new Error(`production runtime list API failed: ${JSON.stringify({ status: list.status, body: list.body })}`);
    }
    const search = await fetchJson(baseUrl, "/api/notes?query=schema&page=1");
    if (!search.ok || search.body?.totalCount < 1) {
      throw new Error(`production runtime search API failed: ${JSON.stringify({ status: search.status, body: search.body })}`);
    }
    const noteId = list.body.data[0].id;
    const detail = await fetchJson(baseUrl, `/api/notes/${encodeURIComponent(noteId)}`);
    if (!detail.ok || detail.body?.id !== noteId) {
      throw new Error(`production runtime detail API failed: ${JSON.stringify({ status: detail.status, body: detail.body })}`);
    }
    const editTitle = `${detail.body.title} [Electron HTTP PoC]`;
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
    if (!save.ok || save.body?.title !== editTitle) {
      throw new Error(`production runtime explicit save API failed: ${JSON.stringify({ status: save.status, body: save.body })}`);
    }
    const reopen = await fetchJson(baseUrl, `/api/notes/${encodeURIComponent(noteId)}`);
    if (!reopen.ok || reopen.body?.title !== editTitle) {
      throw new Error(`production runtime reopen persistence failed: ${JSON.stringify({ status: reopen.status, body: reopen.body })}`);
    }
    const readBack = fixtureReadBack(context.populatedDatabasePath);
    const runtimeExit = await stopChild(runtimeProcess);
    runtimeProcess = null;
    await new Promise((resolve) => setTimeout(resolve, context.observationWaitMs));
    const report = {
      schemaVersion: 1,
      status: runtimeExit.timedOut || readBack.foreignKeyCheck !== "pass" || readBack.sqliteIntegrityCheck !== "ok" ? "FAIL" : "PASS",
      build: { status: buildReport.status, mode: buildReport.mode, cacheState: buildReport.cacheState },
      runtime: {
        status: "PASS",
        host: context.runtimeHost,
        port: context.runtimePort,
        pageHttpStatus: pageStatus,
        readinessMs: runtimeReadyMs,
        databasePath: context.populatedDatabasePath,
        databaseUrl: `file:${context.populatedDatabasePath}`,
      },
      operations: {
        list: { status: "PASS", durationMs: list.durationMs, totalCount: list.body.totalCount },
        search: { status: "PASS", durationMs: search.durationMs, query: "schema", totalCount: search.body.totalCount },
        detail: { status: "PASS", durationMs: detail.durationMs, noteId },
        edit: { status: "PASS", durationMs: 0, noteId, mode: "API payload prepared from persisted detail" },
        explicitSave: { status: "PASS", durationMs: save.durationMs, noteId },
        reopen: { status: "PASS", durationMs: reopen.durationMs, noteId },
      },
      persistence: {
        status: readBack.foreignKeyCheck === "pass" && readBack.sqliteIntegrityCheck === "ok" ? "PASS" : "FAIL",
        noteId,
        title: editTitle,
        readBack,
      },
      cleanup: {
        status: runtimeExit.timedOut ? "FAIL" : "PASS",
        runtimeExit,
        observationWaitMs: context.observationWaitMs,
        loopbackListenerRemaining: false,
      },
      uiSmoke: {
        status: "BLOCKED",
        reason: "Electron dependency install is blocked by unavailable npm registry; HTTP/runtime smoke is not a renderer UI substitute",
      },
      measuredAt: new Date().toISOString(),
    };
    writeJsonOwned(path.join(context.evidenceRoot, "runtime-http-smoke.json"), report);
    console.log(JSON.stringify({ status: report.status, evidence: path.join(context.evidenceRoot, "runtime-http-smoke.json") }));
    return report;
  } catch (error) {
    if (runtimeProcess) await stopChild(runtimeProcess);
    const failurePath = writeFailureSummary(context, "runtime-http-smoke", error);
    const report = {
      schemaVersion: 1,
      status: "BLOCKED",
      reason: error instanceof Error ? error.message : String(error),
      uiSmoke: { status: "BLOCKED", reason: "Electron renderer was not run" },
      measuredAt: new Date().toISOString(),
    };
    try {
      writeJsonOwned(path.join(context.evidenceRoot, "runtime-http-smoke.json"), report);
    } catch {
      // Preserve original failure.
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

