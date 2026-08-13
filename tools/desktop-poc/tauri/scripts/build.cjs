const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  ensureOutputDirectories,
  getContext,
  readJson,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
} = require("./common.cjs");

function tail(value, count = 18) {
  return String(value).split(/\r?\n/).filter(Boolean).slice(-count);
}

function runNextBuild(context) {
  const nextBin = path.join(context.stagingRoot, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
  if (!fs.existsSync(nextBin)) {
    return { status: "BLOCKED", reason: `candidate staging Next binary がありません: ${nextBin}` };
  }
  if (fs.existsSync(context.nextDistDir)) {
    return { status: "UNVERIFIED", reason: `existing staging build output を上書きしません: ${context.nextDistDir}` };
  }
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
  const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? (result.stderr || result.stdout || "unknown Next build failure");
    return {
      status: "BLOCKED",
      reason: `staging の production Next build に失敗しました: ${detail.trim().slice(-2000)}`,
      durationMs,
      stdoutTail: tail(result.stdout),
      stderrTail: tail(result.stderr),
    };
  }
  const buildIdPath = path.join(context.nextDistDir, "BUILD_ID");
  if (!fs.existsSync(buildIdPath)) return { status: "UNVERIFIED", reason: `Next build output の BUILD_ID がありません: ${buildIdPath}`, durationMs };
  return {
    status: "PASS",
    mode: "production-next-webpack",
    cacheState: "cold candidate staging output; root .next untouched",
    durationMs,
    stagingPath: context.stagingRoot,
    distDir: context.nextDistDir,
    buildIdPresent: true,
    databaseUrl: `file:${context.cleanDatabasePath}`,
    hostBoundary: "runtime will bind only to 127.0.0.1",
  };
}

function runTauriCheck(context) {
  const cargoManifest = path.join(__dirname, "..", "src-tauri", "Cargo.toml");
  const cargoLock = path.join(__dirname, "..", "src-tauri", "Cargo.lock");
  if (!fs.existsSync(cargoLock)) {
    return {
      status: "BLOCKED",
      reason: "src-tauri/Cargo.lock がありません。Cargo dependency resolution 未確認のため lockfile を捏造せず停止しました",
      cargoManifest,
      cargoLock: null,
      command: "cargo check --locked --release",
    };
  }
  const result = spawnSync("cargo", ["check", "--locked", "--release", "--manifest-path", cargoManifest], {
    cwd: path.dirname(cargoManifest),
    env: { ...process.env, CARGO_TARGET_DIR: context.tauriTargetRoot },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? (result.stderr || result.stdout || "unknown Cargo check failure");
    return { status: "BLOCKED", reason: `Tauri Rust cargo check に失敗しました: ${detail.trim().slice(-2200)}`, cargoManifest, cargoLock, stdoutTail: tail(result.stdout), stderrTail: tail(result.stderr) };
  }
  return { status: "PASS", command: "cargo check --locked --release", cargoManifest, cargoLock, targetDirectory: context.tauriTargetRoot };
}

function run() {
  const context = getContext();
  ensureOutputDirectories(context);
  try {
    validateBaseline(context);
    const preparationPath = path.join(context.evidenceRoot, "preparation.json");
    if (!fs.existsSync(preparationPath)) throw new Error("preparation.json がありません。先に candidate の prepare を実行してください");
    const preparation = readJson(preparationPath);
    if (preparation.status !== "PASS") {
      const report = { schemaVersion: 1, status: "BLOCKED", reason: "preparation が PASS ではないため build を実行しません", nextBuild: { status: "UNVERIFIED" }, tauriCompilation: { status: "UNVERIFIED" }, measuredAt: new Date().toISOString() };
      writeJsonOwned(path.join(context.evidenceRoot, "build.json"), report);
      console.error(JSON.stringify({ status: report.status, reason: report.reason }));
      return report;
    }
    const nextBuild = runNextBuild(context);
    const tauriCompilation = nextBuild.status === "PASS" ? runTauriCheck(context) : { status: "UNVERIFIED", reason: "Next production build が PASS ではないため Tauri compilation を実行しません" };
    const status = nextBuild.status === "PASS" && tauriCompilation.status === "PASS" ? "PASS" : [nextBuild.status, tauriCompilation.status].includes("FAIL") ? "FAIL" : "BLOCKED";
    const report = {
      schemaVersion: 1,
      status,
      mode: "production-next-webpack plus Tauri Rust cargo check",
      nextBuild,
      tauriCompilation,
      nodeRuntime: "host Node used only for unpackaged sidecar; distributable embedding not claimed",
      cacheState: nextBuild.cacheState ?? "UNVERIFIED",
      measuredAt: new Date().toISOString(),
    };
    writeJsonOwned(path.join(context.evidenceRoot, "build.json"), report);
    console.log(JSON.stringify({ status: report.status, nextBuild: nextBuild.status, tauriCompilation: tauriCompilation.status, evidence: path.join(context.evidenceRoot, "build.json") }));
    return report;
  } catch (error) {
    const failurePath = writeFailureSummary(context, "build", error);
    const report = { schemaVersion: 1, status: error?.code?.includes("BASELINE") ? "BLOCKED" : "FAIL", reason: error instanceof Error ? error.message : String(error), measuredAt: new Date().toISOString() };
    try { writeJsonOwned(path.join(context.evidenceRoot, "build.json"), report); } catch { /* preserve immutable evidence */ }
    console.error(`${report.reason}\nsummary: ${failurePath}`);
    return report;
  }
}

if (require.main === module) {
  try { run(); } catch { process.exitCode = 1; }
}

module.exports = { run, runNextBuild, runTauriCheck };
