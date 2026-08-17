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
  "/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/electron";
const OBSERVATION_WAIT_MS = 5000;

const EXPECTED_BASELINE = Object.freeze({
  baseline_id: "mvp-gate0-20260812-dcc057d8",
  git_head: "366c0ebbb324db37d5bc66e6650d5b7b216616dd",
  baseline_scope_sha256: "dcc057d81b612573a5360b6f0b5bd9faea96f6e7586f59c833fc98bed978b72c",
  fixture_count: 10000,
  fixture_seed: "cornell-method-fixture-v1",
  fixture_sha256: "bdb9d9996bf03c5c9885b9e1d13fdcce3cbf2925f559171bd9890fc4da6bc46e",
  fixture_content_hash: "f01c404495412554a404154c7888577f681e536f72a75fb97b35643c2f3a7de6",
  architecture: "Apple Silicon Mac (arm64)",
  macos_version: "26.6.1",
  node_version: "v26.7.0",
  npm_version: "11.19.0",
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
    fixturePath: path.resolve(baseline.fixture_path),
    nextDistDir: path.join(stagingRoot, "next-dist"),
    runtimePort: Number(process.env.POC_RUNTIME_PORT ?? 37821),
    runtimeHost: "127.0.0.1",
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
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
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
  const gitHead = commandVersion("git", ["-C", REPOSITORY_ROOT, "rev-parse", "HEAD"]);
  const gitStatus = commandVersion(
    "git",
    ["-C", REPOSITORY_ROOT, "status", "--porcelain=v1", "--untracked-files=all"],
  );
  return {
    architecture: os.arch(),
    platform: process.platform,
    macosVersion,
    nodeVersion: process.version,
    npmVersion: commandVersion("npm", ["--version"]),
    gitHead,
    gitWorktreeDirty: gitStatus === null ? null : gitStatus.length > 0,
  };
}

function revisionProvenance(baseline, actual) {
  return {
    baselineGitHead: baseline?.git_head ?? null,
    candidateGitHead: actual?.gitHead ?? null,
    candidateDirtyWorktree: actual?.gitWorktreeDirty ?? null,
  };
}

function baselineMismatches(baseline, actual) {
  const mismatches = [];
  for (const [key, value] of Object.entries(EXPECTED_BASELINE)) {
    if (baseline[key] !== value) {
      mismatches.push(`manifest.${key}: expected=${value}, actual=${baseline[key]}`);
    }
  }
  const actualValues = {
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
  return mismatches;
}

function fixtureMismatches(expected, fixtureHash, readBack) {
  const mismatches = [];
  if (fixtureHash !== expected.fixture_sha256) {
    mismatches.push(`fixture_sha256: expected=${expected.fixture_sha256}, actual=${fixtureHash}`);
  }
  if (readBack.notebooks !== expected.fixture_count) {
    mismatches.push(`fixture_count: expected=${expected.fixture_count}, actual=${readBack.notebooks}`);
  }
  if (readBack.contentHash !== expected.fixture_content_hash) {
    mismatches.push(`fixture_content_hash: expected=${expected.fixture_content_hash}, actual=${readBack.contentHash}`);
  }
  if (readBack.foreignKeyCheck !== "pass" || readBack.sqliteIntegrityCheck !== "ok") {
    mismatches.push(`fixture_integrity: fk=${readBack.foreignKeyCheck}, sqlite=${readBack.sqliteIntegrityCheck}`);
  }
  return mismatches;
}

function calculateContentHash(databasePath) {
  const Database = require(path.join(
    REPOSITORY_ROOT,
    "node_modules",
    "better-sqlite3",
  ));
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

function fixtureReadBack(databasePath) {
  const Database = require(path.join(
    REPOSITORY_ROOT,
    "node_modules",
    "better-sqlite3",
  ));
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
      contentHash: calculateContentHash(databasePath),
    };
  } finally {
    db.close();
  }
}

function validateBaseline(context) {
  const { baseline } = context;
  const actual = actualToolchain();
  const expected = EXPECTED_BASELINE;
  const mismatches = baselineMismatches(baseline, actual);
  let fixtureReadBackValue = null;
  if (!fs.existsSync(context.fixturePath)) {
    mismatches.push(`fixture がありません: ${context.fixturePath}`);
  } else {
    const fixtureHash = sha256FileSync(context.fixturePath);
    fixtureReadBackValue = fixtureReadBack(context.fixturePath);
    mismatches.push(...fixtureMismatches(expected, fixtureHash, fixtureReadBackValue));
  }
  if (mismatches.length > 0) {
    const error = new Error(`BLOCKED: shared baseline の固定値が一致しません\n${mismatches.join("\n")}`);
    error.code = "BASELINE_MISMATCH";
    error.mismatches = mismatches;
    error.validation = {
      expected,
      actual,
      fixtureReadBack: fixtureReadBackValue,
      revisionProvenance: revisionProvenance(baseline, actual),
    };
    throw error;
  }
  return {
    expected,
    actual,
    fixtureSha256: expected.fixture_sha256,
    fixtureReadBack: fixtureReadBackValue,
    revisionProvenance: revisionProvenance(baseline, actual),
  };
}

function assertOwnedPath(targetPath, allowedRoot) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(allowedRoot);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`candidate 外の path を操作しません: ${resolvedTarget}`);
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
      throw new Error(`既存の candidate artifact を上書きしません: ${filePath}`);
    }
    return false;
  }
  assertOwnedPath(filePath, getContext().outputRoot);
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

function writeFailureSummary(context, name, error) {
  const filePath = path.join(context.logsRoot, `${name}-failure-summary.json`);
  const summary = {
    status: error?.code === "BASELINE_MISMATCH" ? "BLOCKED" : "FAIL",
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
  REPOSITORY_ROOT,
  DEFAULT_BASELINE_PATH,
  DEFAULT_OUTPUT_ROOT,
  EXPECTED_BASELINE,
  OBSERVATION_WAIT_MS,
  actualToolchain,
  baselineMismatches,
  calculateContentHash,
  canonicalJson,
  commandVersion,
  ensureDirectory,
  ensureOutputDirectories,
  fixtureMismatches,
  getContext,
  fixtureReadBack,
  readJson,
  relativeOutputPath,
  revisionProvenance,
  runCommand,
  sha256File,
  sha256FileSync,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
  assertOwnedPath,
};
