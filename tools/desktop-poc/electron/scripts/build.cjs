const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  ensureOutputDirectories,
  getContext,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
} = require("./common.cjs");

function run() {
  const context = getContext();
  try {
    validateBaseline(context);
    ensureOutputDirectories(context);
    if (!fs.existsSync(path.join(context.evidenceRoot, "preparation.json"))) {
      throw new Error("preparation.json がありません。先に candidate の prepare を実行してください");
    }
    if (fs.existsSync(context.nextDistDir)) {
      throw new Error(`既存 staging build output を上書きしません: ${context.nextDistDir}`);
    }

    const nextBin = path.join(
      context.stagingRoot,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "next.cmd" : "next",
    );
    const startedAt = process.hrtime.bigint();
    const result = spawnSync(nextBin, ["build", "--webpack"], {
      cwd: context.stagingRoot,
      env: {
        ...process.env,
        DATABASE_URL: `file:${context.cleanDatabasePath}`,
        PRISMA_PROVIDER: "sqlite",
        NODE_ENV: "production",
        CORNELL_FIXTURE_DIST_DIR: "next-dist",
        CORNELL_FIXTURE_TSCONFIG_PATH: "tsconfig.poc.json",
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (result.error || result.status !== 0) {
      const detail = result.error?.message ?? (result.stderr || result.stdout || "unknown Next build failure");
      throw new Error(`staging の production Next build に失敗しました: ${detail.trim().slice(-2000)}`);
    }
    const buildIdPath = path.join(context.nextDistDir, "BUILD_ID");
    if (!fs.existsSync(buildIdPath)) {
      throw new Error(`Next build output の BUILD_ID がありません: ${buildIdPath}`);
    }
    const report = {
      schemaVersion: 1,
      status: "PASS",
      mode: "production-next-webpack",
      cacheState: "cold candidate staging output; root .next untouched",
      durationMs: Math.round(durationMs),
      stagingPath: context.stagingRoot,
      distDir: context.nextDistDir,
      buildIdPresent: true,
      databaseUrl: `file:${context.cleanDatabasePath}`,
      hostBoundary: "runtime will bind only to 127.0.0.1",
      measuredAt: new Date().toISOString(),
    };
    writeJsonOwned(path.join(context.evidenceRoot, "build.json"), report);
    console.log(JSON.stringify({ status: report.status, durationMs: report.durationMs, evidence: path.join(context.evidenceRoot, "build.json") }));
    return report;
  } catch (error) {
    const failurePath = writeFailureSummary(context, "build", error);
    console.error(`${error instanceof Error ? error.message : String(error)}\nsummary: ${failurePath}`);
    if (error?.code === "BASELINE_MISMATCH") {
      return { status: "BLOCKED", failurePath };
    }
    throw error;
  }
}

if (require.main === module) {
  try {
    run();
  } catch {
    process.exitCode = 1;
  }
}

module.exports = { run };

