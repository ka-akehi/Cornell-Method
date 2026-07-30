const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  cleanupE2eDatabase,
  e2eDatabaseUrl,
  prepareE2eDatabase,
  projectRoot,
} = require("./database-fixture");

const nextBin = path.resolve(projectRoot, "node_modules", "next", "dist", "bin", "next");
let child;
let finished = false;
let childExited = false;
let shutdownTimer;

function finish(exitCode) {
  if (finished) return;
  finished = true;
  if (shutdownTimer) clearTimeout(shutdownTimer);

  try {
    cleanupE2eDatabase();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "E2E fixture cleanup failed",
    );
    exitCode = exitCode || 1;
  }

  process.exit(exitCode);
}

function stopChild(signal) {
  if (!child || childExited) {
    finish(signal === "SIGINT" ? 130 : 143);
    return;
  }

  child.kill(signal);
  shutdownTimer = setTimeout(() => {
    if (!childExited) child.kill("SIGKILL");
  }, 10_000);
}

process.on("SIGINT", () => stopChild("SIGINT"));
process.on("SIGTERM", () => stopChild("SIGTERM"));

try {
  prepareE2eDatabase();
  child = spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", "127.0.0.1", "--port", "4173"],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        DATABASE_URL: e2eDatabaseUrl,
        PRISMA_PROVIDER: "sqlite",
      },
      stdio: "inherit",
    },
  );

  child.on("error", (error) => {
    console.error(error instanceof Error ? error.message : error);
    finish(1);
  });

  child.on("close", (code, signal) => {
    childExited = true;
    finish(signal ? 1 : code ?? 1);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  try {
    cleanupE2eDatabase();
  } catch (cleanupError) {
    console.error(
      cleanupError instanceof Error
        ? cleanupError.message
        : "E2E fixture cleanup failed",
    );
  }
  process.exit(1);
}
