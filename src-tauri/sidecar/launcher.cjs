const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const READY_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const LOOPBACK_HOST = "127.0.0.1";

let runtimeChild = null;
let shutdownPromise = null;

function projectRoot() {
  const configured = process.env.CORNELL_DESKTOP_PROJECT_ROOT?.trim();
  return configured ? path.resolve(configured) : path.resolve(__dirname, "../..");
}

function absoluteDatabaseUrl(value) {
  if (typeof value !== "string" || !value.startsWith("file:")) {
    throw new Error("DATABASE_URL must be an absolute file: URL");
  }
  const databasePath = value.slice("file:".length);
  if (!path.isAbsolute(databasePath) || databasePath.includes("?") || databasePath.includes("#")) {
    throw new Error("DATABASE_URL must contain an absolute SQLite path without a query or fragment");
  }
  return value;
}

function storageOptions(root) {
  const storage = require(path.join(root, "src/server/infrastructure/desktop-storage.js"));
  const homeDirectory = process.env.CORNELL_DESKTOP_HOME?.trim() || os.homedir();
  const prismaBinary = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
  return {
    storage,
    homeDirectory,
    migrationsDirectory: path.join(root, "prisma", "migrations"),
    prismaBinary,
    prismaConfigPath: path.join(root, "prisma.config.ts"),
    prismaProjectRoot: root,
  };
}

function bootstrap() {
  const root = projectRoot();
  const options = storageOptions(root);
  const result = options.storage.bootstrapDesktopStorage({
    homeDirectory: options.homeDirectory,
    migrationsDirectory: options.migrationsDirectory,
    prismaBinary: options.prismaBinary,
    prismaConfigPath: options.prismaConfigPath,
    prismaProjectRoot: options.prismaProjectRoot,
    environment: process.env,
  });

  process.stdout.write(`${JSON.stringify({
    kind: "bootstrap",
    status: result.status,
    applicationSupportRoot: result.applicationSupportRoot,
    liveDirectory: result.liveDirectory,
    databasePath: result.databasePath,
    databaseUrl: result.databaseUrl,
    backupsDirectory: result.backupsDirectory,
    settingsDirectory: result.settingsDirectory,
    logsDirectory: result.logsDirectory,
    pendingRestoreDirectory: result.pendingRestoreDirectory,
    reason: result.reason,
    created: result.created,
  })}\n`);

  if (result.status !== options.storage.DESKTOP_DATABASE_STATUS.READY) {
    const error = new Error(`desktop database is not ready: ${result.status} (${result.reason})`);
    error.code = result.status;
    throw error;
  }

  return result;
}

function pickEphemeralPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host: LOOPBACK_HOST, port: 0 }, () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : null;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        if (!Number.isInteger(port) || port <= 0) {
          reject(new Error("OS did not provide an ephemeral loopback port"));
          return;
        }
        resolve(port);
      });
    });
  });
}

function waitForHttpReady(port) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError = "not attempted";

  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() >= deadline) {
        reject(new Error(`local runtime readiness timeout: ${lastError}`));
        return;
      }

      const request = http.get({ host: LOOPBACK_HOST, port, path: "/notes" }, (response) => {
        response.resume();
        if (response.statusCode >= 200 && response.statusCode < 400) {
          resolve();
          return;
        }
        lastError = `HTTP ${response.statusCode}`;
        setTimeout(attempt, 100);
      });
      request.setTimeout(1_000, () => request.destroy(new Error("readiness request timeout")));
      request.once("error", (error) => {
        lastError = error instanceof Error ? error.message : String(error);
        setTimeout(attempt, 100);
      });
    };
    attempt();
  });
}

function runtimeEntry(root) {
  const configured = process.env.CORNELL_DESKTOP_RUNTIME_ENTRY?.trim();
  if (configured) return path.resolve(configured);
  return path.join(root, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
}

function spawnRuntime(root, port) {
  const entry = runtimeEntry(root);
  if (!fs.existsSync(entry)) {
    throw new Error(`Next.js runtime entry is missing: ${entry}`);
  }

  const nodeBinary = process.env.CORNELL_DESKTOP_NODE_BINARY?.trim() || process.execPath;
  const child = spawn(nodeBinary, [
    entry,
    "start",
    "--hostname",
    LOOPBACK_HOST,
    "--port",
    String(port),
  ], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: LOOPBACK_HOST,
      PORT: String(port),
    },
    stdio: ["ignore", "ignore", "ignore"],
  });

  if (!Number.isInteger(child.pid) || child.pid <= 0) {
    throw new Error(`runtime child PID is invalid: ${child.pid}`);
  }
  return child;
}

function waitForChildExit(child, timeoutMs) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.removeListener("exit", finish);
      resolve();
    };
    const timeout = setTimeout(finish, timeoutMs);
    child.once("exit", finish);
  });
}

async function stopRuntime(signal = "SIGTERM") {
  const child = runtimeChild;
  runtimeChild = null;
  if (!child) return;

  if (child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
    await waitForChildExit(child, SHUTDOWN_TIMEOUT_MS);
  }
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await waitForChildExit(child, SHUTDOWN_TIMEOUT_MS);
  }
}

async function serve() {
  absoluteDatabaseUrl(process.env.DATABASE_URL);
  const root = projectRoot();
  const port = await pickEphemeralPort();
  const child = spawnRuntime(root, port);
  runtimeChild = child;

  try {
    await waitForHttpReady(port);
  } catch (error) {
    await stopRuntime("SIGTERM");
    throw error;
  }

  process.stdout.write(`${JSON.stringify({
    kind: "ready",
    status: "ready",
    host: LOOPBACK_HOST,
    port,
    url: `http://${LOOPBACK_HOST}:${port}/notes`,
    runtimePid: child.pid,
  })}\n`);

  await new Promise((resolve) => {
    child.once("exit", resolve);
  });
  runtimeChild = null;
}

async function shutdown(code = 0) {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = stopRuntime("SIGTERM").finally(() => {
    process.exitCode = code;
  });
  return shutdownPromise;
}

async function main() {
  const command = process.argv[2] || "serve";
  if (command === "bootstrap") {
    bootstrap();
    return;
  }
  if (command === "serve") {
    await serve();
    return;
  }
  throw new Error(`unknown sidecar command: ${command}`);
}

process.once("SIGTERM", () => { void shutdown(0); });
process.once("SIGINT", () => { void shutdown(0); });

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  absoluteDatabaseUrl,
  bootstrap,
  pickEphemeralPort,
  serve,
  stopRuntime,
  waitForHttpReady,
};
