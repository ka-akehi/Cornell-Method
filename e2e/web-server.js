const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  cleanupE2eDatabase,
  e2eDatabaseUrl,
  prepareE2eDatabase,
  projectRoot,
} = require("./database-fixture");

const nextBin = path.resolve(projectRoot, "node_modules", "next", "dist", "bin", "next");
const serverUrl = "http://127.0.0.1:4173/notes";
const startupTimeoutMs = 120_000;
const shutdownTimeoutMs = 10_000;

function requestStatus(url, timeoutMs = 1_000) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Timed out requesting ${url}`));
    });
    request.once("error", reject);
  });
}

function isReadyStatus(statusCode) {
  return statusCode >= 200 && statusCode <= 403;
}

async function isServerAvailable(url = serverUrl) {
  try {
    return isReadyStatus(await requestStatus(url));
  } catch {
    return false;
  }
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function waitForServer({
  child,
  url = serverUrl,
  timeoutMs = startupTimeoutMs,
  isExited = () => false,
  getError = () => undefined,
}) {
  if (!child) throw new Error("E2E web server child is missing");

  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    if (isExited()) {
      const childError = getError();
      throw new Error(
        `E2E web server exited before becoming ready${
          childError ? `: ${childError.message}` : "."
        }`,
      );
    }

    try {
      if (isReadyStatus(await requestStatus(url))) return;
    } catch (error) {
      lastError = error;
    }

    await wait(Math.min(250, Math.max(1, deadline - Date.now())));
  }

  const reason = lastError instanceof Error ? `: ${lastError.message}` : ".";
  throw new Error(`Timed out waiting for E2E web server at ${url}${reason}`);
}

function signalChildProcess(child, signal) {
  if (process.platform === "win32") {
    child.kill(signal);
    return;
  }

  try {
    // The child is detached so the Next.js descendants are in the same
    // process group and are stopped before fixture cleanup begins.
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ESRCH") return;
    throw error;
  }
}

function waitForClose({ closePromise, isExited, timeoutMs }) {
  if (isExited()) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(false);
    }, timeoutMs);

    closePromise.then(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(true);
    });
  });
}

function createE2eServerLifecycle({
  spawnProcess = spawn,
  waitForReady = waitForServer,
  sendSignal = signalChildProcess,
  url = serverUrl,
  startupTimeout = startupTimeoutMs,
  shutdownTimeout = shutdownTimeoutMs,
} = {}) {
  let child;
  let childExited = true;
  let childError;
  let closePromise = Promise.resolve();
  let stopPromise;
  let exitHandler;

  function removeExitHandler() {
    if (!exitHandler) return;
    process.removeListener("exit", exitHandler);
    exitHandler = undefined;
  }

  function start() {
    if (child && !childExited) {
      throw new Error("E2E web server is already running");
    }

    child = spawnProcess(
      process.execPath,
      [nextBin, "dev", "--hostname", "127.0.0.1", "--port", "4173"],
      {
        cwd: projectRoot,
        detached: process.platform !== "win32",
        env: {
          ...process.env,
          DATABASE_URL: e2eDatabaseUrl,
          PRISMA_PROVIDER: "sqlite",
        },
        stdio: "inherit",
      },
    );
    childExited = false;
    childError = undefined;

    closePromise = new Promise((resolve) => {
      child.once("error", (error) => {
        childError = error;
        console.error(error instanceof Error ? error.message : error);
      });
      child.once("close", (code, signal) => {
        childExited = true;
        resolve({ code, signal });
        removeExitHandler();
      });
    });

    // An exit handler can only issue a synchronous signal. It is a last-resort
    // orphan prevention path; fixture deletion remains runner-owned.
    exitHandler = () => {
      if (childExited) return;
      try {
        sendSignal(child, "SIGKILL");
      } catch {
        // The process is already exiting; there is no asynchronous recovery.
      }
    };
    process.once("exit", exitHandler);

    return child;
  }

  async function waitUntilReady() {
    if (!child || childExited) {
      throw new Error("E2E web server has not been started");
    }

    await waitForReady({
      child,
      url,
      timeoutMs: startupTimeout,
      isExited: () => childExited,
      getError: () => childError,
    });
  }

  async function stop(signal = "SIGTERM") {
    if (stopPromise) return stopPromise;
    if (!child || childExited) {
      removeExitHandler();
      return;
    }

    const processToStop = child;
    stopPromise = (async () => {
      let gracefulError;
      try {
        sendSignal(processToStop, signal);
      } catch (error) {
        gracefulError = error;
      }

      let stopped = await waitForClose({
        closePromise,
        isExited: () => childExited,
        timeoutMs: shutdownTimeout,
      });

      if (!stopped) {
        try {
          sendSignal(processToStop, "SIGKILL");
        } catch (error) {
          if (!(error && typeof error === "object" && error.code === "ESRCH")) {
            gracefulError = gracefulError ?? error;
          }
        }
        stopped = await waitForClose({
          closePromise,
          isExited: () => childExited,
          timeoutMs: shutdownTimeout,
        });
      }

      removeExitHandler();

      if (!stopped) {
        throw new Error(
          `E2E web server did not stop within ${shutdownTimeout}ms`,
        );
      }
      if (gracefulError) throw gracefulError;
    })();

    try {
      await stopPromise;
    } finally {
      stopPromise = undefined;
    }
  }

  return {
    start,
    stop,
    waitUntilReady,
  };
}

function normalizeError(error) {
  return error instanceof Error ? error : new Error(String(error));
}

async function failGlobalSetup(error, lifecycle, cleanupFixture) {
  const setupError = normalizeError(error);
  let stopError;

  if (lifecycle) {
    try {
      await lifecycle.stop();
    } catch (error) {
      stopError = normalizeError(error);
      console.error(`E2E web server cleanup failed: ${stopError.message}`);
    }
  }

  try {
    await cleanupFixture();
  } catch (error) {
    const cleanupError = normalizeError(error);
    console.error(
      `E2E fixture cleanup failed after global setup error: ${cleanupError.message}`,
    );
    const failures = [setupError];
    if (stopError) failures.push(stopError);
    failures.push(cleanupError);
    throw new AggregateError(
      failures,
      `E2E global setup failed and fixture cleanup failed: ${setupError.message}`,
    );
  }

  throw setupError;
}

async function runE2eGlobalSetup({
  prepareDatabase = prepareE2eDatabase,
  checkServer = isServerAvailable,
  createLifecycle = () => createE2eServerLifecycle(),
  cleanupFixture = cleanupE2eDatabase,
} = {}) {
  let lifecycle;

  try {
    await prepareDatabase();

    if (await checkServer(serverUrl)) {
      throw new Error(`${serverUrl} is already in use`);
    }

    lifecycle = createLifecycle();
    lifecycle.start();
    await lifecycle.waitUntilReady();
  } catch (error) {
    await failGlobalSetup(error, lifecycle, cleanupFixture);
  }

  // Playwright runs this returned teardown before the configured
  // globalTeardown. The runner therefore observes the server close event
  // before e2e/global-teardown.js removes the SQLite fixture.
  return async function teardown() {
    await lifecycle.stop();
  };
}

async function globalSetup() {
  return runE2eGlobalSetup();
}

module.exports = globalSetup;
module.exports.createE2eServerLifecycle = createE2eServerLifecycle;
module.exports.isServerAvailable = isServerAvailable;
module.exports.waitForServer = waitForServer;
module.exports.runE2eGlobalSetup = runE2eGlobalSetup;
