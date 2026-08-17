const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  CANDIDATE_ROOT,
  REPOSITORY_ROOT,
  actualToolchain,
  ensureDirectory,
  ensureOutputDirectories,
  fixtureReadBack,
  getContext,
  revisionProvenance,
  sha256FileSync,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
} = require("./common.cjs");

const COPY_EXCLUDED_NAMES = new Set([
  ".git",
  ".next",
  ".next-dev",
  ".next-fixture-iadpvK",
  "node_modules",
  ".env",
  "dev.db",
  ".DS_Store",
  "tsconfig.tsbuildinfo",
]);
const COPY_ROOT_FILES = [
  "eslint.config.mjs",
  "next-env.d.ts",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "postcss.config.mjs",
  "prisma.config.ts",
  "tsconfig.json",
];

function fileContentEqual(sourcePath, destinationPath) {
  if (!fs.existsSync(destinationPath)) return false;
  const sourceStat = fs.statSync(sourcePath);
  const destinationStat = fs.statSync(destinationPath);
  return sourceStat.isFile() && destinationStat.isFile() && sha256FileSync(sourcePath) === sha256FileSync(destinationPath);
}

function copyFilePreserving(sourcePath, destinationPath) {
  ensureDirectory(path.dirname(destinationPath));
  if (fs.existsSync(destinationPath)) {
    if (fileContentEqual(sourcePath, destinationPath)) return;
    throw new Error(`staging の既存ファイルを上書きしません: ${destinationPath}`);
  }
  fs.copyFileSync(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
}

function copyTreePreserving(sourceRoot, destinationRoot) {
  if (!fs.existsSync(sourceRoot)) return;
  ensureDirectory(destinationRoot);
  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    if (COPY_EXCLUDED_NAMES.has(entry.name) || entry.name.startsWith(".next")) continue;
    const sourcePath = path.join(sourceRoot, entry.name);
    const destinationPath = path.join(destinationRoot, entry.name);
    if (entry.isDirectory()) copyTreePreserving(sourcePath, destinationPath);
    else if (entry.isFile()) copyFilePreserving(sourcePath, destinationPath);
  }
}

function prepareStaging(context) {
  ensureDirectory(context.stagingRoot);
  for (const directoryName of ["src", "prisma", "config", "public"]) {
    copyTreePreserving(path.join(REPOSITORY_ROOT, directoryName), path.join(context.stagingRoot, directoryName));
  }
  for (const fileName of COPY_ROOT_FILES) {
    copyFilePreserving(path.join(REPOSITORY_ROOT, fileName), path.join(context.stagingRoot, fileName));
  }
  const tsconfigPath = path.join(context.stagingRoot, "tsconfig.poc.json");
  writeJsonOwned(tsconfigPath, {
    extends: "./tsconfig.json",
    compilerOptions: { paths: { "@/*": ["./src/*"] } },
    include: [
      "./next-env.d.ts",
      "./**/*.mts",
      "./**/*.ts",
      "./**/*.tsx",
      "./next-dist/types/**/*.ts",
      "./next-dist/dev/types/**/*.ts",
    ],
  });
  const stagingManifest = {
    schemaVersion: 1,
    source: "repository runtime input copied into disposable candidate staging",
    excluded: [".git", "node_modules", ".env", "live DB", "root Next output", "root dev DB"],
    nodeModules: {
      mode: "candidate-private-npm-ci",
      changed: true,
      rootNodeModulesUsedByRuntime: false,
      installCommand: "npm ci --include=dev --no-audit --no-fund",
      puppeteerBrowserDownload: "skipped for candidate staging; browser is not a runtime dependency",
      prismaClientGeneration: "sqlite @prisma/client and postgresql src/generated/prisma-postgres are generated in candidate staging",
    },
    buildOutput: "next-dist",
    databaseUrlMode: "absolute file URL supplied by candidate user-data",
    repositoryRoot: REPOSITORY_ROOT,
    candidateRoot: CANDIDATE_ROOT,
    createdAt: new Date().toISOString(),
  };
  writeJsonOwned(path.join(context.stagingRoot, "staging-manifest.json"), stagingManifest);
  return stagingManifest;
}

function installStagingDependencies(context) {
  const nextBinary = path.join(context.stagingRoot, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
  const prismaBinary = path.join(context.stagingRoot, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
  if (fs.existsSync(nextBinary) && fs.existsSync(prismaBinary) && fs.existsSync(path.join(context.stagingRoot, "node_modules", "better-sqlite3"))) {
    return { status: "PASS", mode: "existing-verified", rootNodeModulesUsedByRuntime: false };
  }
  const startedAt = process.hrtime.bigint();
  const result = spawnSync("npm", ["ci", "--include=dev", "--no-audit", "--no-fund"], {
    cwd: context.stagingRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PUPPETEER_SKIP_DOWNLOAD: "true",
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? (result.stderr || result.stdout || "unknown npm ci failure");
    const error = new Error(`candidate staging の npm ci に失敗しました。root node_modules へ fallback しません: ${detail.trim().slice(-1600)}`);
    error.code = "DEPENDENCY_BLOCKED";
    throw error;
  }
  if (!fs.existsSync(nextBinary) || !fs.existsSync(prismaBinary) || !fs.existsSync(path.join(context.stagingRoot, "node_modules", "better-sqlite3"))) {
    const error = new Error("candidate staging npm ci 後に Next/Prisma/better-sqlite3 がありません");
    error.code = "DEPENDENCY_BLOCKED";
    throw error;
  }
  return {
    status: "PASS",
    mode: "npm-ci",
    durationMs,
    rootNodeModulesUsedByRuntime: false,
    puppeteerBrowserDownload: "skipped",
    stdoutTail: String(result.stdout).split(/\r?\n/).filter(Boolean).slice(-8),
    stderrTail: String(result.stderr).split(/\r?\n/).filter(Boolean).slice(-8),
  };
}

function runPrismaGenerate(context, provider) {
  const prismaBin = path.join(context.stagingRoot, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
  if (!fs.existsSync(prismaBin)) {
    const error = new Error(`candidate staging Prisma binary がありません: ${prismaBin}`);
    error.code = "DEPENDENCY_BLOCKED";
    throw error;
  }
  const args = ["generate", "--config", "prisma.config.ts"];
  const startedAt = process.hrtime.bigint();
  const generationEnv = {
    ...process.env,
    DATABASE_URL: `file:${context.cleanDatabasePath}`,
    NODE_ENV: "production",
    PRISMA_PROVIDER: provider,
  };
  delete generationEnv.DIRECT_URL;
  const result = spawnSync(prismaBin, args, {
    cwd: context.stagingRoot,
    env: generationEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? (result.stderr || result.stdout || "unknown Prisma generate failure");
    const error = new Error(`candidate staging の Prisma ${provider} client generate に失敗しました: ${detail.trim().slice(-1600)}`);
    error.code = "DEPENDENCY_BLOCKED";
    throw error;
  }
  return {
    status: "PASS",
    provider,
    command: [prismaBin, ...args],
    durationMs,
    stdoutTail: String(result.stdout).split(/\r?\n/).filter(Boolean).slice(-8),
    stderrTail: String(result.stderr).split(/\r?\n/).filter(Boolean).slice(-8),
  };
}

function generateStagingPrismaClients(context) {
  const clients = ["sqlite", "postgresql"].map((provider) => runPrismaGenerate(context, provider));
  return {
    status: "PASS",
    mode: "candidate-staging-prisma-generate",
    rootNodeModulesUsedByRuntime: false,
    clients,
  };
}

function runPrisma(context, args, databasePath) {
  const prismaBin = path.join(context.stagingRoot, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
  const result = spawnSync(prismaBin, args, {
    cwd: context.stagingRoot,
    env: {
      ...process.env,
      DATABASE_URL: `file:${databasePath}`,
      PRISMA_PROVIDER: "sqlite",
      NODE_ENV: "production",
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? (result.stderr || result.stdout || "unknown Prisma failure");
    throw new Error(`${args.join(" ")} に失敗しました: ${detail.trim().slice(-1600)}`);
  }
  return {
    command: [prismaBin, ...args],
    stdoutTail: String(result.stdout).split(/\r?\n/).filter(Boolean).slice(-8),
    stderrTail: String(result.stderr).split(/\r?\n/).filter(Boolean).slice(-8),
  };
}

function migrateCleanDatabase(context) {
  if (fs.existsSync(context.cleanDatabasePath)) {
    const readBack = fixtureReadBack(context.cleanDatabasePath, context);
    if (readBack.notebooks !== 0 || readBack.canvases !== 0) throw new Error(`既存 clean DB は空ではないため上書きしません: ${context.cleanDatabasePath}`);
    return { mode: "existing-verified", readBack };
  }
  const migration = runPrisma(context, ["migrate", "deploy", "--config", "prisma.config.ts"], context.cleanDatabasePath);
  const readBack = fixtureReadBack(context.cleanDatabasePath, context);
  if (readBack.notebooks !== 0 || readBack.canvases !== 0) throw new Error(`migration 後の clean DB が空ではありません: ${context.cleanDatabasePath}`);
  return { mode: "migrated", migration, readBack };
}

function copyPopulatedDatabase(context) {
  if (!fs.existsSync(context.fixturePath)) throw new Error(`shared fixture がありません: ${context.fixturePath}`);
  const expectedHash = context.baseline.fixture_sha256;
  const sourceHash = sha256FileSync(context.fixturePath);
  if (sourceHash !== expectedHash) throw new Error(`shared fixture SHA-256 が baseline と不一致です: ${sourceHash}`);
  if (fs.existsSync(context.populatedDatabasePath)) {
    const existingHash = sha256FileSync(context.populatedDatabasePath);
    if (existingHash !== expectedHash) throw new Error(`populated/live.sqlite は既に変更済みのため上書きしません: ${context.populatedDatabasePath}`);
    return { mode: "existing-verified", sha256: existingHash, readBack: fixtureReadBack(context.populatedDatabasePath, context) };
  }
  ensureDirectory(path.dirname(context.populatedDatabasePath));
  fs.copyFileSync(context.fixturePath, context.populatedDatabasePath, fs.constants.COPYFILE_EXCL);
  const copiedHash = sha256FileSync(context.populatedDatabasePath);
  if (copiedHash !== expectedHash) throw new Error(`populated fixture copy の SHA-256 が不一致です: ${copiedHash}`);
  return { mode: "copied", sha256: copiedHash, readBack: fixtureReadBack(context.populatedDatabasePath, context) };
}

function run() {
  const context = getContext();
  ensureOutputDirectories(context);
  try {
    const baseline = validateBaseline(context);
    const staging = prepareStaging(context);
    const install = installStagingDependencies(context);
    const prismaGenerate = generateStagingPrismaClients(context);
    const clean = migrateCleanDatabase(context);
    const populated = copyPopulatedDatabase(context);
    const report = {
      schemaVersion: 1,
      status: "PASS",
      baseline: {
        baselineId: context.baseline.baseline_id,
        baselineScopeSha256: context.baseline.baseline_scope_sha256,
        gitHead: context.baseline.git_head,
        fixtureCount: context.baseline.fixture_count,
        fixtureSeed: context.baseline.fixture_seed,
        fixtureSha256: context.baseline.fixture_sha256,
        fixtureContentHash: context.baseline.fixture_content_hash,
        validation: baseline.fixtureReadBack,
      },
      revisionProvenance: baseline.revisionProvenance,
      candidateDependencies: {
        nodeRuntime: "host Node is used by unpackaged sidecar PoC",
        rootNodeModulesUsedByRuntime: false,
        stagingInstall: install,
        prismaGenerate,
      },
      staging: {
        path: context.stagingRoot,
        buildOutput: context.nextDistDir,
        manifest: staging,
      },
      userData: {
        clean: {
          path: context.cleanUserDataRoot,
          databasePath: context.cleanDatabasePath,
          databaseUrl: `file:${context.cleanDatabasePath}`,
          migration: clean,
        },
        populated: {
          path: context.populatedUserDataRoot,
          databasePath: context.populatedDatabasePath,
          databaseUrl: `file:${context.populatedDatabasePath}`,
          fixtureCopy: populated,
        },
        bundleDatabaseBoundary: "live SQLite is outside app bundle and candidate staging source",
      },
      measuredAt: new Date().toISOString(),
    };
    writeJsonOwned(path.join(context.evidenceRoot, "preparation.json"), report);
    console.log(JSON.stringify({ status: report.status, evidence: path.join(context.evidenceRoot, "preparation.json") }));
    return report;
  } catch (error) {
    const failurePath = writeFailureSummary(context, "prepare", error);
    const actual = error.validation?.actual ?? actualToolchain();
    const report = {
      schemaVersion: 1,
      status: error?.code?.includes("BASELINE") || error?.code === "DEPENDENCY_BLOCKED" ? "BLOCKED" : "FAIL",
      reason: error instanceof Error ? error.message : String(error),
      code: error?.code ?? null,
      baselineId: context.baseline.baseline_id,
      baselineScopeSha256: context.baseline.baseline_scope_sha256,
      revisionProvenance: error.validation?.revisionProvenance
        ?? revisionProvenance(context.baseline, actual),
      stagingPath: context.stagingRoot,
      rootNodeModulesUsedByRuntime: false,
      measuredAt: new Date().toISOString(),
    };
    try {
      writeJsonOwned(path.join(context.evidenceRoot, "preparation.json"), report);
    } catch {
      // Preserve a prior immutable evidence file.
    }
    console.error(`${report.reason}\nsummary: ${failurePath}`);
    return report;
  }
}

if (require.main === module) {
  try {
    run();
  } catch {
    process.exitCode = 1;
  }
}

module.exports = {
  copyPopulatedDatabase,
  generateStagingPrismaClients,
  installStagingDependencies,
  migrateCleanDatabase,
  prepareStaging,
  runPrismaGenerate,
  run,
};
