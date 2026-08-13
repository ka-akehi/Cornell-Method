const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const CANDIDATE_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(CANDIDATE_ROOT, "../../..");
const DEFAULT_BASELINE_PATH =
  "/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/shared/baseline-manifest.json";
const DEFAULT_OUTPUT_ROOT =
  "/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/tauri";
const OBSERVATION_WAIT_MS = 5000;
const FIXED_RUNTIME_HOST = "127.0.0.1";
const FIXED_RUNTIME_PORT = 37821;

const EXPECTED_BASELINE = Object.freeze({
  baseline_id: "mvp-gate0-20260812-dcc057d8",
  git_head: "366c0ebbb324db37d5bc66e6650d5b7b216616dd",
  baseline_scope_sha256: "dcc057d81b612573a5360b6f0b5bd9faea96f6e7586f59c833fc98bed978b72c",
  fixture_count: 10000,
  fixture_seed: "cornell-method-fixture-v1",
  fixture_sha256: "bdb9d9996bf03c5c9885b9e1d13fdcce3cbf2925f559171bd9890fc4da6bc46e",
  fixture_content_hash: "f01c404495412554a404154c7888577f681e536f72a75fb97b35643c2f3a7de6",
  architecture: "Apple Silicon Mac (arm64)",
  macos_version: "26.0.1",
  node_version: "v22.12.0",
  npm_version: "10.9.0",
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readBaseline() {
  const baselinePath = path.resolve(
    process.env.POC_BASELINE_MANIFEST ?? DEFAULT_BASELINE_PATH,
  );
  if (!fs.existsSync(baselinePath)) {
    throw new Error(`baseline manifest がありません: ${baselinePath}`);
  }
  return { baselinePath, baseline: readJson(baselinePath) };
}

function getContext() {
  const { baselinePath, baseline } = readBaseline();
  const outputRoot = path.resolve(
    process.env.POC_OUTPUT_ROOT ?? DEFAULT_OUTPUT_ROOT,
  );
  const sharedRoot = path.dirname(baselinePath);
  const stagingRoot = path.join(outputRoot, "staging");
  const userDataRoot = path.join(outputRoot, "user-data");
  const artifactsRoot = path.join(outputRoot, "artifacts");
  const evidenceRoot = path.join(outputRoot, "evidence");
  const logsRoot = path.join(outputRoot, "logs");
  return {
    baselinePath,
    baseline,
    sharedRoot,
    outputRoot,
    stagingRoot,
    userDataRoot,
    cleanUserDataRoot: path.join(userDataRoot, "clean"),
    populatedUserDataRoot: path.join(userDataRoot, "populated"),
    cleanDatabasePath: path.join(userDataRoot, "clean", "live.sqlite"),
    populatedDatabasePath: path.join(userDataRoot, "populated", "live.sqlite"),
    artifactsRoot,
    evidenceRoot,
    evidenceRunsRoot: path.join(evidenceRoot, "runs"),
    logsRoot,
    tauriTargetRoot: path.join(outputRoot, "tauri-target"),
    fixturePath: path.resolve(baseline.fixture_path),
    nextDistDir: path.join(stagingRoot, "next-dist"),
    runtimeHost: FIXED_RUNTIME_HOST,
    runtimePort: FIXED_RUNTIME_PORT,
    observationWaitMs: OBSERVATION_WAIT_MS,
  };
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function sha256File(filePath) {
  const digest = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => digest.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(digest.digest("hex")));
  });
}

function sha256FileSync(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function runCommand(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function commandVersion(command, args = ["--version"]) {
  try {
    return runCommand(command, args).trim();
  } catch {
    return null;
  }
}

function actualToolchain() {
  const macosVersion = process.platform === "darwin"
    ? commandVersion("sw_vers", ["-productVersion"])
    : null;
  return {
    architecture: os.arch(),
    platform: process.platform,
    macosVersion,
    nodeVersion: process.version,
    npmVersion: commandVersion("npm", ["--version"]),
    gitHead: commandVersion("git", ["rev-parse", "HEAD"]),
    rustcVersion: commandVersion("rustc", ["--version"]),
    cargoVersion: commandVersion("cargo", ["--version"]),
    cargoTauriVersion: commandVersion("cargo", ["tauri", "--version"]),
  };
}

function inspectorModulePath(context = null) {
  const staged = context
    ? path.join(context.stagingRoot, "node_modules", "better-sqlite3")
    : null;
  if (staged && fs.existsSync(staged)) return staged;
  const root = path.join(REPOSITORY_ROOT, "node_modules", "better-sqlite3");
  if (fs.existsSync(root)) return root;
  return null;
}

function calculateContentHash(databasePath, context = null) {
  const modulePath = inspectorModulePath(context);
  if (!modulePath) {
    const error = new Error("better-sqlite3 inspector is unavailable; candidate staging or read-only shared verifier is missing");
    error.code = "DEPENDENCY_BLOCKED";
    throw error;
  }
  const Database = require(modulePath);
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  const digest = crypto.createHash("sha256");
  const updateDigestFromQuery = (label, sql) => {
    for (const row of db.prepare(sql).iterate()) {
      digest.update(label);
      digest.update("\t");
      digest.update(JSON.stringify(row));
      digest.update("\n");
    }
  };
  try {
    updateDigestFromQuery(
      "notebooks",
      `SELECT id, title, note_date, source_type, source_title, body, body_mode, summary,
        next_review_date, reviewed_at, created_at, updated_at, deleted_at
       FROM notebooks ORDER BY id`,
    );
    updateDigestFromQuery(
      "notebook_canvases",
      `SELECT notebook_id, schema_version, document_json, search_text, created_at, updated_at
       FROM notebook_canvases ORDER BY notebook_id`,
    );
    updateDigestFromQuery(
      "cues",
      `SELECT id, notebook_id, text, "order", created_at, updated_at FROM cues ORDER BY id`,
    );
    updateDigestFromQuery(
      "tags",
      `SELECT id, name, color, created_at FROM tags ORDER BY id`,
    );
    updateDigestFromQuery(
      "notebook_tags",
      `SELECT notebook_id, tag_id, "order" FROM notebook_tags ORDER BY notebook_id, "order", tag_id`,
    );
    return digest.digest("hex");
  } finally {
    db.close();
  }
}

function fixtureReadBack(databasePath, context = null) {
  const modulePath = inspectorModulePath(context);
  if (!modulePath) {
    const error = new Error("better-sqlite3 inspector is unavailable");
    error.code = "DEPENDENCY_BLOCKED";
    throw error;
  }
  const Database = require(modulePath);
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const count = (table) => Number(
      db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,
    );
    const foreignKeyCheck = db.pragma("foreign_key_check");
    const integrity = db.pragma("integrity_check");
    const hasMigrationTable = Boolean(db.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'`,
    ).get());
    return {
      notebooks: count("notebooks"),
      canvases: count("notebook_canvases"),
      cues: count("cues"),
      tags: count("tags"),
      notebookTags: count("notebook_tags"),
      foreignKeyCheck: foreignKeyCheck.length === 0 ? "pass" : "fail",
      sqliteIntegrityCheck: integrity.length === 1 && integrity[0].integrity_check === "ok"
        ? "ok"
        : "fail",
      migrationRows: hasMigrationTable
        ? db.prepare(
          `SELECT migration_name, finished_at, rolled_back_at
           FROM _prisma_migrations ORDER BY started_at, migration_name`,
        ).all()
        : [],
      contentHash: calculateContentHash(databasePath, context),
    };
  } finally {
    db.close();
  }
}

function validateBaseline(context) {
  const actual = actualToolchain();
  const mismatches = [];
  for (const [key, value] of Object.entries(EXPECTED_BASELINE)) {
    if (context.baseline[key] !== value) {
      mismatches.push(`manifest.${key}: expected=${value}, actual=${context.baseline[key]}`);
    }
  }
  const actualValues = {
    git_head: actual.gitHead,
    architecture: actual.architecture === "arm64" ? "Apple Silicon Mac (arm64)" : actual.architecture,
    macos_version: actual.macosVersion,
    node_version: actual.nodeVersion,
    npm_version: actual.npmVersion,
  };
  for (const [key, value] of Object.entries(actualValues)) {
    if (value !== EXPECTED_BASELINE[key]) {
      mismatches.push(`environment.${key}: expected=${EXPECTED_BASELINE[key]}, actual=${value}`);
    }
  }
  let fixtureReadBackValue = null;
  if (!fs.existsSync(context.fixturePath)) {
    mismatches.push(`fixture がありません: ${context.fixturePath}`);
  } else {
    const fixtureHash = sha256FileSync(context.fixturePath);
    if (fixtureHash !== EXPECTED_BASELINE.fixture_sha256) {
      mismatches.push(`fixture_sha256: expected=${EXPECTED_BASELINE.fixture_sha256}, actual=${fixtureHash}`);
    }
    try {
      fixtureReadBackValue = fixtureReadBack(context.fixturePath);
      if (fixtureReadBackValue.notebooks !== EXPECTED_BASELINE.fixture_count) {
        mismatches.push(`fixture_count: expected=${EXPECTED_BASELINE.fixture_count}, actual=${fixtureReadBackValue.notebooks}`);
      }
      if (fixtureReadBackValue.contentHash !== EXPECTED_BASELINE.fixture_content_hash) {
        mismatches.push(`fixture_content_hash: expected=${EXPECTED_BASELINE.fixture_content_hash}, actual=${fixtureReadBackValue.contentHash}`);
      }
      if (fixtureReadBackValue.foreignKeyCheck !== "pass" || fixtureReadBackValue.sqliteIntegrityCheck !== "ok") {
        mismatches.push(`fixture_integrity: fk=${fixtureReadBackValue.foreignKeyCheck}, sqlite=${fixtureReadBackValue.sqliteIntegrityCheck}`);
      }
    } catch (error) {
      mismatches.push(`fixture_read_back: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (mismatches.length > 0) {
    const error = new Error(`BLOCKED: shared baseline の固定値が一致しません\n${mismatches.join("\n")}`);
    error.code = mismatches.some((item) => item.startsWith("environment."))
      ? "BASELINE_MISMATCH"
      : "BASELINE_VALIDATION_FAILED";
    error.mismatches = mismatches;
    throw error;
  }
  return {
    expected: EXPECTED_BASELINE,
    actual,
    fixtureSha256: EXPECTED_BASELINE.fixture_sha256,
    fixtureReadBack: fixtureReadBackValue,
  };
}

function assertOwnedPath(targetPath, allowedRoot) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(allowedRoot);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`candidate output 外の path を操作しません: ${resolvedTarget}`);
  }
}

function ensureOutputDirectories(context) {
  for (const directoryPath of [
    context.outputRoot,
    context.stagingRoot,
    context.userDataRoot,
    context.cleanUserDataRoot,
    context.populatedUserDataRoot,
    context.artifactsRoot,
    context.evidenceRoot,
    context.evidenceRunsRoot,
    context.logsRoot,
    context.tauriTargetRoot,
  ]) {
    assertOwnedPath(directoryPath, context.outputRoot);
    ensureDirectory(directoryPath);
  }
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeJsonOwned(filePath, value) {
  const content = canonicalJson(value);
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf8");
    if (existing !== content) {
      throw new Error(`既存の candidate evidence/artifact を上書きしません: ${filePath}`);
    }
    return false;
  }
  const context = getContext();
  assertOwnedPath(filePath, context.outputRoot);
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

function writeFailureSummary(context, name, error) {
  const filePath = path.join(context.logsRoot, `${name}-failure-summary.json`);
  const summary = {
    status: error?.code?.includes("BASELINE") || error?.code === "DEPENDENCY_BLOCKED" ? "BLOCKED" : "FAIL",
    reason: error instanceof Error ? error.message : String(error),
    code: error?.code ?? null,
    at: new Date().toISOString(),
  };
  try {
    writeJsonOwned(filePath, summary);
  } catch {
    // A secondary write failure must not obscure the original blocker.
  }
  return filePath;
}

function relativeOutputPath(context, targetPath) {
  return path.relative(context.outputRoot, targetPath).split(path.sep).join("/");
}

module.exports = {
  CANDIDATE_ROOT,
  DEFAULT_BASELINE_PATH,
  DEFAULT_OUTPUT_ROOT,
  EXPECTED_BASELINE,
  FIXED_RUNTIME_HOST,
  FIXED_RUNTIME_PORT,
  OBSERVATION_WAIT_MS,
  REPOSITORY_ROOT,
  actualToolchain,
  calculateContentHash,
  canonicalJson,
  commandVersion,
  ensureDirectory,
  ensureOutputDirectories,
  fixtureReadBack,
  getContext,
  inspectorModulePath,
  readJson,
  relativeOutputPath,
  runCommand,
  sha256File,
  sha256FileSync,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
  assertOwnedPath,
};
