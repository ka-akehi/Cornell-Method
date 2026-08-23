/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { test } = require("node:test");

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
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: "/notes" }, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.once("error", reject);
  });
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
    assert.match(ready.url, new RegExp(`^http://127\\.0\\.0\\.1:${ready.port}/notes$`));
    assert.equal(await getNotes(ready.port), 200);

    child.kill("SIGTERM");
    const exit = await waitForExit(child);
    assert.equal(exit.code, 0);
    await waitForPortClosed(ready.port);
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
    fs.rmSync(directory, { recursive: true, force: true });
  }
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
