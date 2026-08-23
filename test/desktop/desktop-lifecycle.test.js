/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { test } = require("node:test");

const {
  createReadyNonce,
  pickEphemeralPort,
  READY_HEALTH_KIND,
  READY_HEALTH_PATH,
  waitForHttpReady,
} = require("../../src-tauri/sidecar/launcher.cjs");

const projectRoot = path.resolve(__dirname, "../..");
const launcherPath = path.join(projectRoot, "src-tauri", "sidecar", "launcher.cjs");
const fixturePath = path.join(__dirname, "fixtures", "runtime-child.cjs");

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cornell-desktop-lifecycle-"));
}

function waitForExit(child, timeoutMs = 10_000) {
  if (child.exitCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("lifecycle fixture did not exit"));
    }, timeoutMs);
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
}

function collectOutput(child) {
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function readReadyMessage(child) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const stderr = [];
    const timeout = setTimeout(() => {
      reject(new Error(`ready handshake timed out: ${stderr.join("")}`));
    }, 10_000);
    const onData = (chunk) => {
      buffer += chunk.toString();
      const lineEnd = buffer.search(/\r?\n/);
      if (lineEnd < 0) return;
      const line = buffer.slice(0, lineEnd);
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      try {
        resolve(JSON.parse(line));
      } catch (error) {
        reject(error);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function canBindLoopback() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      server.close(() => resolve(true));
    });
  });
}

function getNotes(port) {
  return getHttp(port, "/notes").then((response) => response.statusCode);
}

function getHttp(port, requestPath) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: requestPath }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.once("end", () => resolve({ statusCode: response.statusCode, body }));
    });
    request.once("error", reject);
  });
}

function listenLoopback(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port }, () => {
      const address = server.address();
      resolve(typeof address === "object" && address !== null ? address.port : null);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function healthBody(nonce, overrides = {}) {
  return JSON.stringify({
    kind: READY_HEALTH_KIND,
    status: "ready",
    nonce,
    ...overrides,
  });
}

async function assertReadinessRejects(port, nonce, message) {
  await assert.rejects(
    waitForHttpReady(port, nonce, {
      timeoutMs: 180,
      retryDelayMs: 10,
      requestTimeoutMs: 50,
    }),
    (error) => error instanceof Error
      && error.message.startsWith("local runtime readiness timeout:"),
    message,
  );
}

async function waitForPortClosed(port) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      await getNotes(port);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`runtime listener ${port} is still reachable`);
}

test("product shell declares the approved identity and no fixed runtime port", () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "src-tauri", "tauri.conf.json"), "utf8"),
  );
  const main = fs.readFileSync(path.join(projectRoot, "src-tauri", "src", "main.rs"), "utf8");
  assert.equal(config.identifier, "com.cornellmethod.notebook");
  assert.deepEqual(config.app.windows, []);
  assert.equal(main.includes("com.cornellmethod.notebook.tauri.poc"), false);
  assert.equal(main.includes("37821"), false);
  assert.match(main, /WebviewUrl::External/);
  assert.match(main, /WebviewWindowBuilder::new/);
});

test("single-instance recovery keeps ownership in a stable advisory lock", () => {
  const main = fs.readFileSync(path.join(projectRoot, "src-tauri", "src", "main.rs"), "utf8");
  const instance = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "instance.rs"),
    "utf8",
  );
  assert.match(instance, /INSTANCE_LOCK_FILE: &str = "\.instance\.lock"/);
  assert.match(instance, /INSTANCE_OWNER_FILE: &str = "\.instance\.owner"/);
  assert.match(instance, /libc::flock\(file\.as_raw_fd\(\), libc::LOCK_EX \| libc::LOCK_NB\)/);
  assert.match(instance, /\.create\(true\)\s*\.read\(true\)\s*\.write\(true\)/);
  assert.match(instance, /atomic_write_instance_owner/);
  assert.match(instance, /temporary_file\s*\.sync_all\(\)/);
  assert.match(instance, /fs::rename\(&temporary_path, path\)/);
  assert.match(instance, /enum InstanceAcquire/);
  assert.match(instance, /AlreadyRunningNotReady/);
  assert.match(main, /start_focus_listener\(socket_path, app\.handle\(\)\.clone\(\)/);
  assert.doesNotMatch(instance, /fn process_is_alive/);
  assert.doesNotMatch(instance, /remove_file\(&paths\.lock_path\)/);
});

test("sidecar ready handshake uses a dynamic loopback port and cleans its owned child", async (t) => {
  if (!(await canBindLoopback())) {
    t.skip("this runner does not permit disposable loopback listeners");
    return;
  }
  const directory = temporaryDirectory();
  const databasePath = path.join(directory, "live", "notebook.sqlite");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const child = spawn(process.execPath, [launcherPath, "serve"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      CORNELL_DESKTOP_PROJECT_ROOT: projectRoot,
      CORNELL_DESKTOP_RUNTIME_ENTRY: fixturePath,
      DATABASE_URL: `file:${databasePath}`,
      PRISMA_PROVIDER: "sqlite",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const ready = await readReadyMessage(child);
    assert.equal(ready.kind, "ready");
    assert.equal(ready.host, "127.0.0.1");
    assert.equal(ready.status, "ready");
    assert.ok(Number.isInteger(ready.port) && ready.port > 0);
    assert.match(ready.readyNonce, /^[a-f0-9]{64}$/);
    assert.match(ready.url, new RegExp(`^http://127\\.0\\.0\\.1:${ready.port}/notes$`));
    assert.equal(await getNotes(ready.port), 200);
    const health = await getHttp(ready.port, READY_HEALTH_PATH);
    assert.equal(health.statusCode, 200);
    assert.deepEqual(JSON.parse(health.body), {
      kind: READY_HEALTH_KIND,
      status: "ready",
      nonce: ready.readyNonce,
    });

    child.kill("SIGTERM");
    const exit = await waitForExit(child);
    assert.equal(exit.code, 0);
    await waitForPortClosed(ready.port);
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("child exit immediately after readiness lets the launcher exit and cleans up", async (t) => {
  if (!(await canBindLoopback())) {
    t.skip("this runner does not permit disposable loopback listeners");
    return;
  }
  const directory = temporaryDirectory();
  const databasePath = path.join(directory, "live", "notebook.sqlite");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const child = spawn(process.execPath, [launcherPath, "serve"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      CORNELL_DESKTOP_PROJECT_ROOT: projectRoot,
      CORNELL_DESKTOP_RUNTIME_ENTRY: fixturePath,
      CORNELL_DESKTOP_RUNTIME_EXIT_AFTER_HEALTH: "1",
      DATABASE_URL: `file:${databasePath}`,
      PRISMA_PROVIDER: "sqlite",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const outputPromise = collectOutput(child);

  try {
    const exit = await waitForExit(child, 3_000);
    const result = await outputPromise;
    assert.equal(exit.code, 0);
    assert.equal(result.code, 0);
    assert.equal(result.signal, null);
    assert.equal(result.stderr, "");

    const lines = result.stdout.trim().split(/\r?\n/);
    assert.equal(lines.length, 1);
    const ready = JSON.parse(lines[0]);
    assert.equal(ready.kind, "ready");
    assert.equal(ready.status, "ready");
    assert.ok(Number.isInteger(ready.port) && ready.port > 0);
    await waitForPortClosed(ready.port);
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("nonce mismatch exits with a fixed error and does not publish ready", async (t) => {
  if (!(await canBindLoopback())) {
    t.skip("this runner does not permit disposable loopback listeners");
    return;
  }
  const directory = temporaryDirectory();
  const databasePath = path.join(directory, "live", "notebook.sqlite");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const child = spawn(process.execPath, [launcherPath, "serve"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      CORNELL_DESKTOP_PROJECT_ROOT: projectRoot,
      CORNELL_DESKTOP_RUNTIME_ENTRY: fixturePath,
      CORNELL_DESKTOP_RUNTIME_HEALTH_NONCE: "wrong-nonce",
      CORNELL_DESKTOP_RUNTIME_EXIT_AFTER_HEALTH: "1",
      DATABASE_URL: `file:${databasePath}`,
      PRISMA_PROVIDER: "sqlite",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const result = await collectOutput(child);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.trim(), "local runtime child exited before readiness");
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("port handoff rejects a third-party service that only answers /notes", async (t) => {
  if (!(await canBindLoopback())) {
    t.skip("this runner does not permit disposable loopback listeners");
    return;
  }
  const port = await pickEphemeralPort();
  const server = http.createServer((request, response) => {
    if (request.url === "/notes") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<main>unrelated service</main>");
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await listenLoopback(server, port);
  try {
    await assertReadinessRejects(
      port,
      createReadyNonce(),
      "port reuse must not accept the unrelated /notes service",
    );
  } finally {
    await closeServer(server);
  }
});

test("third-party health responses do not satisfy readiness", async (t) => {
  if (!(await canBindLoopback())) {
    t.skip("this runner does not permit disposable loopback listeners");
    return;
  }
  const port = await pickEphemeralPort();
  const server = http.createServer((request, response) => {
    if (request.url === READY_HEALTH_PATH) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ kind: "other-service", status: "ready", nonce: "other" }));
      return;
    }
    response.writeHead(200);
    response.end("unrelated service");
  });
  await listenLoopback(server, port);
  try {
    await assertReadinessRejects(
      port,
      createReadyNonce(),
      "third-party health response must not satisfy readiness",
    );
  } finally {
    await closeServer(server);
  }
});

test("health nonce mismatch and abnormal responses do not satisfy readiness", async (t) => {
  if (!(await canBindLoopback())) {
    t.skip("this runner does not permit disposable loopback listeners");
    return;
  }
  const nonce = createReadyNonce();
  const port = await pickEphemeralPort();
  const server = http.createServer((request, response) => {
    if (request.url === READY_HEALTH_PATH) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(healthBody("wrong-nonce"));
      return;
    }
    response.writeHead(200);
    response.end("unrelated service");
  });
  await listenLoopback(server, port);
  try {
    await assertReadinessRejects(
      port,
      nonce,
      "abnormal health responses must not satisfy readiness",
    );
  } finally {
    await closeServer(server);
  }
});

test("the matching health nonce satisfies readiness", async (t) => {
  if (!(await canBindLoopback())) {
    t.skip("this runner does not permit disposable loopback listeners");
    return;
  }
  const nonce = createReadyNonce();
  const port = await pickEphemeralPort();
  const server = http.createServer((request, response) => {
    if (request.url === READY_HEALTH_PATH) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(healthBody(nonce));
      return;
    }
    response.writeHead(200);
    response.end("unrelated /notes response");
  });
  await listenLoopback(server, port);
  try {
    await waitForHttpReady(port, nonce, {
      timeoutMs: 500,
      retryDelayMs: 10,
      requestTimeoutMs: 50,
    });
  } finally {
    await closeServer(server);
  }
});

test("child exit and timeout fail readiness without resolving", async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  const port = 65534;
  const readiness = waitForHttpReady(port, createReadyNonce(), {
    child,
    timeoutMs: 500,
    retryDelayMs: 10,
    requestTimeoutMs: 50,
  });
  child.emit("exit", 1, null);
  await assert.rejects(readiness, /local runtime child exited before readiness/);

  await assert.rejects(
    waitForHttpReady(65533, createReadyNonce(), {
      timeoutMs: 50,
      retryDelayMs: 10,
      requestTimeoutMs: 20,
    }),
    /local runtime readiness timeout:/,
  );
});

test("desktop close bridge keeps save failure on the dirty side", () => {
  const bridge = fs.readFileSync(
    path.join(projectRoot, "src", "shared", "desktop", "desktop-close-bridge.ts"),
    "utf8",
  );
  const editor = fs.readFileSync(
    path.join(projectRoot, "src", "modules", "notes", "ui", "components", "editor", "editor.tsx"),
    "utf8",
  );
  const editorDirtyController = fs.readFileSync(
    path.join(
      projectRoot,
      "src",
      "modules",
      "notes",
      "ui",
      "hooks",
      "use-note-editor-dirty-controller.ts",
    ),
    "utf8",
  );
  const closeCoordinator = fs.readFileSync(
    path.join(
      projectRoot,
      "src",
      "app",
      "_components",
      "desktop-close-coordinator.tsx",
    ),
    "utf8",
  );
  assert.match(bridge, /cornell-desktop-close=/);
  assert.match(closeCoordinator, /保存して終了/);
  assert.match(closeCoordinator, /保存せず終了/);
  assert.match(closeCoordinator, /戻る/);
  assert.match(editor, /return false;/);
  assert.match(editor, /useNoteEditorDirtyController/);
  assert.match(editorDirtyController, /registerDesktopDirtyController/);
  assert.doesNotMatch(editor, /registerDesktopDirtyController/);
});

test("save failure cancels the pending close before restoring focus", () => {
  const closeCoordinator = fs.readFileSync(
    path.join(
      projectRoot,
      "src",
      "app",
      "_components",
      "desktop-close-coordinator.tsx",
    ),
    "utf8",
  );
  const cancelAfterSaveFailureStart = closeCoordinator.indexOf(
    "const cancelAfterSaveFailure =",
  );
  const saveStart = closeCoordinator.indexOf(
    "async function saveAndCloseDesktop()",
  );
  const discardStart = closeCoordinator.indexOf(
    "async function discardAndCloseDesktop()",
  );
  const renderStart = closeCoordinator.indexOf("\n  return (", discardStart);

  assert.ok(
    cancelAfterSaveFailureStart >= 0 &&
      saveStart > cancelAfterSaveFailureStart &&
      discardStart > saveStart &&
      renderStart > discardStart,
  );

  const saveFailureCancel = closeCoordinator.slice(
    cancelAfterSaveFailureStart,
    saveStart,
  );
  assert.match(
    saveFailureCancel,
    /if \(await sendDesktopCloseDecision\("cancel"\)\) \{[\s\S]*restoreDesktopCloseFocus\(\)[\s\S]*\} else \{[\s\S]*終了処理へ応答できませんでした。編集内容を保持しています。/,
  );

  const saveFlow = closeCoordinator.slice(saveStart, discardStart);
  assert.match(
    saveFlow,
    /catch \{[\s\S]*await cancelAfterSaveFailure\(\)[\s\S]*return;/,
  );
  assert.match(
    saveFlow,
    /if \(!saved\) \{[\s\S]*await cancelAfterSaveFailure\(\)[\s\S]*return;/,
  );
  assert.match(
    saveFlow,
    /sendDesktopCloseDecision\("save"\)[\s\S]*completeDesktopClose\(\)/,
  );

  const discardFlow = closeCoordinator.slice(discardStart, renderStart);
  assert.match(
    discardFlow,
    /sendDesktopCloseDecision\("discard"\)[\s\S]*completeDesktopClose\(\)/,
  );
  assert.doesNotMatch(discardFlow, /restoreDesktopCloseFocus\(\)/);
});

test("application-level exit requests are prevented and share one close bridge", () => {
  const main = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "main.rs"),
    "utf8",
  );
  const lifecycle = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "lifecycle.rs"),
    "utf8",
  );

  assert.match(main, /tauri::RunEvent::ExitRequested\s*\{\s*api, \.\.,?\s*\}/);
  assert.match(main, /api\.prevent_exit\(\)/);
  assert.match(
    main,
    /WindowEvent::CloseRequested[\s\S]*api\.prevent_close\(\)[\s\S]*request_close\(/,
  );
  assert.match(
    main,
    /request_close\(window, app\.clone\(\), state\);/,
  );
  assert.match(main, /\.build\(tauri::generate_context!\(\)\)[\s\S]*\.run\(/);
  assert.match(lifecycle, /exit_allowed: AtomicBool/);
  assert.match(lifecycle, /if pending\.is_some\(\) \{[\s\S]*a close request is already pending/);
  assert.match(lifecycle, /state\.allow_application_exit\(\);[\s\S]*app\.exit\(0\)/);
  assert.match(lifecycle, /if self\.exit_allowed\.load\(Ordering::Acquire\)/);
  assert.match(main, /if state\.application_exit_is_allowed\(\) \{\s*return;/);
});

test("close request cleanup is scoped to the request generation", () => {
  const lifecycle = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "lifecycle.rs"),
    "utf8",
  );

  assert.match(lifecycle, /AtomicU64/);
  assert.match(lifecycle, /type CloseRequestGeneration = u64/);
  assert.match(
    lifecycle,
    /struct PendingCloseRequest\s*\{[\s\S]*generation: CloseRequestGeneration[\s\S]*sender:/,
  );
  assert.match(
    lifecycle,
    /let generation = self\.next_generation\.fetch_add\(1, Ordering::Relaxed\)/,
  );
  assert.match(
    lifecycle,
    /fn clear\(&self, generation: CloseRequestGeneration\)[\s\S]*pending\.as_ref\(\)\.map\(\|request\| request\.generation\) == Some\(generation\)/,
  );

  const requestCloseStart = lifecycle.indexOf("pub(crate) fn request_close");
  const navigationStart = lifecycle.indexOf("fn handle_close_navigation");
  assert.ok(requestCloseStart >= 0 && navigationStart > requestCloseStart);
  const requestClose = lifecycle.slice(requestCloseStart, navigationStart);
  assert.match(requestClose, /let \(generation, receiver\) = match state\.close\.begin\(\)/);
  assert.match(requestClose, /state\.close\.clear\(generation\)/);
});

test("close bridge readiness is generation-scoped and waits before dispatch", () => {
  const bridge = fs.readFileSync(
    path.join(
      projectRoot,
      "src",
      "shared",
      "desktop",
      "desktop-close-bridge.ts",
    ),
    "utf8",
  );
  const coordinator = fs.readFileSync(
    path.join(
      projectRoot,
      "src",
      "app",
      "_components",
      "desktop-close-coordinator.tsx",
    ),
    "utf8",
  );
  const lifecycle = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "lifecycle.rs"),
    "utf8",
  );

  assert.match(bridge, /cornell-desktop-close-bridge-ready=/);
  assert.match(bridge, /cornell-desktop-close-bridge-not-ready=/);
  assert.match(bridge, /window\.location\.hostname === "127\.0\.0\.1"/);
  assert.match(coordinator, /sendDesktopCloseBridgeReady\(bridgeGeneration\)/);
  assert.match(
    coordinator,
    /window\.removeEventListener\([\s\S]*sendDesktopCloseBridgeNotReady\(bridgeGeneration\)/,
  );
  assert.match(lifecycle, /bridge_generation: Mutex<Option<String>>/);
  assert.match(lifecycle, /fn bridge_ready\(&self, generation: &str\)/);
  assert.match(lifecycle, /fn bridge_not_ready\(&self, generation: &str\)/);
  assert.match(lifecycle, /CLOSE_BRIDGE_READY_FRAGMENT_PREFIX/);
  assert.match(lifecycle, /claim_close_event_dispatch/);
  assert.match(lifecycle, /CLOSE_RESPONSE_TIMEOUT: Duration = Duration::from_secs\(120\)/);
});
