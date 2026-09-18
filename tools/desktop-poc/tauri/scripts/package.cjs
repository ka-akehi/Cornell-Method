const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const {
  CANDIDATE_ROOT,
  ensureOutputDirectories,
  getContext,
  sha256FileSync,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
} = require("./common.cjs");

const APP_HASH_FORMAT = "cornell-method-tauri-app-v1";
const APP_SIZE_BASIS = "sum of regular-file bytes; directory entries, symlinks, and special files contribute 0";
const APP_HASH_BASIS = "SHA-256 of sorted canonical entries using POSIX relative paths; regular files include path and bytes, directories include entry names, symlinks include link text without following the target, and special files include type without reading or following them";
const DMG_SIZE_BASIS = "regular-file byte length from lstat";
const DMG_HASH_BASIS = "SHA-256 of regular-file bytes";

function compareEntryNames(left, right) {
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
}

function artifactFiles(root) {
  const result = [];
  let stats;
  try { stats = fs.lstatSync(root); } catch (error) { if (error?.code === "ENOENT") return result; throw error; }
  if (!stats.isDirectory() || stats.isSymbolicLink()) return result;
  const visit = (directory) => {
    const directoryStats = fs.lstatSync(directory);
    if (!directoryStats.isDirectory() || directoryStats.isSymbolicLink()) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort(compareEntryNames)) {
      const filePath = path.join(directory, entry.name);
      const entryStats = fs.lstatSync(filePath);
      if (entryStats.isSymbolicLink()) continue;
      if (entryStats.isDirectory()) {
        if (/\.app$/i.test(entry.name)) result.push(filePath);
        else visit(filePath);
      } else if (entryStats.isFile() && /\.dmg$/i.test(entry.name)) result.push(filePath);
    }
  };
  visit(root);
  return result.sort();
}

function hashField(digest, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  digest.update(length);
  digest.update(bytes);
}

function appBundleMetrics(bundlePath) {
  const rootStats = fs.lstatSync(bundlePath);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) throw new Error(`app bundle が directory ではありません: ${bundlePath}`);
  const digest = crypto.createHash("sha256");
  let sizeBytes = 0;
  hashField(digest, APP_HASH_FORMAT);
  const entry = (kind, relativePath, value = null) => {
    hashField(digest, kind);
    hashField(digest, relativePath);
    if (value != null) hashField(digest, value);
    hashField(digest, "end");
  };
  const visit = (directory, relativeDirectory = "") => {
    entry("directory", relativeDirectory || ".");
    for (const child of fs.readdirSync(directory, { withFileTypes: true }).sort(compareEntryNames)) {
      const filePath = path.join(directory, child.name);
      const stats = fs.lstatSync(filePath);
      const relativePath = relativeDirectory ? `${relativeDirectory}/${child.name}` : child.name;
      if (stats.isSymbolicLink()) entry("symlink", relativePath, fs.readlinkSync(filePath));
      else if (stats.isDirectory()) visit(filePath, relativePath);
      else if (stats.isFile()) {
        const bytes = fs.readFileSync(filePath);
        hashField(digest, "file");
        hashField(digest, relativePath);
        hashField(digest, String(bytes.length));
        digest.update(bytes);
        hashField(digest, "end");
        sizeBytes += bytes.length;
      } else entry(`special:${stats.isFIFO() ? "fifo" : stats.isSocket() ? "socket" : "special"}`, relativePath, "not-followed");
    }
  };
  visit(bundlePath);
  return { sizeBytes, sha256: digest.digest("hex"), sizeBasis: APP_SIZE_BASIS, hashBasis: APP_HASH_BASIS };
}

function appMainBinary(bundlePath) {
  const directory = path.join(bundlePath, "Contents", "MacOS");
  try {
    const stats = fs.lstatSync(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) return null;
  } catch (error) { if (error?.code === "ENOENT") return null; throw error; }
  for (const name of fs.readdirSync(directory).sort()) {
    const candidate = path.join(directory, name);
    const stats = fs.lstatSync(candidate);
    if (!stats.isSymbolicLink() && stats.isFile() && (stats.mode & 0o111) !== 0) return candidate;
  }
  return null;
}

function fileArchitectureInspection(targetPath) {
  const commandLine = `file ${JSON.stringify(targetPath)}`;
  try {
    const output = execFileSync("file", [targetPath], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    return { value: /\b(?:arm64|aarch64)\b/i.test(output) ? "arm64" : "UNVERIFIED", command: output, commandLine, output, targetPath };
  } catch (error) {
    return { value: "UNVERIFIED", command: error instanceof Error ? error.message : String(error), commandLine, output: "", targetPath };
  }
}

function architectureForArtifact(filePath) {
  const stats = fs.lstatSync(filePath);
  const isApp = stats.isDirectory() && /\.app$/i.test(filePath);
  const isDmg = stats.isFile() && /\.dmg$/i.test(filePath);
  if (isApp) {
    const binary = appMainBinary(filePath);
    if (!binary) return { value: "UNVERIFIED", command: "not run", commandLine: null, output: "", targetPath: null, basis: "UNVERIFIED: no executable regular file under Contents/MacOS; symlinks were not followed" };
    const inspection = fileArchitectureInspection(binary);
    return { ...inspection, basis: inspection.value === "arm64" ? "file output for Contents/MacOS executable identified arm64" : "UNVERIFIED: file output did not identify arm64" };
  }
  if (isDmg) {
    const inspection = fileArchitectureInspection(filePath);
    return { ...inspection, value: "UNVERIFIED", basis: "UNVERIFIED: a DMG container does not establish the architecture of the app contained inside" };
  }
  return { value: "UNVERIFIED", command: "not run", commandLine: null, output: "", targetPath: filePath, basis: "UNVERIFIED: unsupported artifact type" };
}

function buildUpdateManifest(artifacts) {
  const template = JSON.parse(fs.readFileSync(path.join(CANDIDATE_ROOT, "resources", "update-manifest.template.json"), "utf8"));
  return {
    ...template,
    generatedAt: new Date().toISOString(),
    status: artifacts.length > 0 ? "UNVERIFIED" : "BLOCKED",
    artifacts: artifacts.map((artifact) => ({
      name: path.basename(artifact.path),
      type: artifact.type,
      architecture: artifact.architecture,
      sizeBytes: artifact.sizeBytes,
      sha256: artifact.sha256,
      apply: "explicit-restart",
    })),
  };
}

function blockedPackage(context, reason, durationMs = 0) {
  return {
    schemaVersion: 1,
    status: "BLOCKED",
    reason,
    durationMs,
    output: context.artifactsRoot,
    developerIdRequired: false,
    notarizationRequired: false,
    signing: "not performed for PoC",
    publicDistribution: "not performed for PoC",
    runtimePackaging: { status: "UNVERIFIED", nodeRuntimeIncluded: false },
    measuredAt: new Date().toISOString(),
  };
}

async function run() {
  const context = getContext();
  ensureOutputDirectories(context);
  try {
    validateBaseline(context);
    const tauriCli = (() => {
      try { return execFileSync("cargo", ["tauri", "--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); } catch { return null; }
    })();
    if (!tauriCli) {
      const report = blockedPackage(context, "cargo tauri / Tauri CLI が未導入です。native packaging を実行せず、偽の .app/DMG を生成しません");
      writeJsonOwned(path.join(context.evidenceRoot, "package.json"), report);
      writeJsonOwned(path.join(context.evidenceRoot, "update-manifest.json"), buildUpdateManifest([]));
      console.error(JSON.stringify({ status: report.status, reason: report.reason }));
      return report;
    }
    const startedAt = process.hrtime.bigint();
    const result = spawnSync("cargo", ["tauri", "build", "--target", "aarch64-apple-darwin"], {
      cwd: path.join(CANDIDATE_ROOT, "src-tauri"),
      env: { ...process.env, CARGO_TARGET_DIR: context.tauriTargetRoot },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
    if (result.error || result.status !== 0) {
      const detail = result.error?.message ?? (result.stderr || result.stdout || "unknown cargo tauri build failure");
      const report = blockedPackage(context, `cargo tauri build に失敗しました: ${detail.trim().slice(-2200)}`, durationMs);
      report.tauriCli = tauriCli;
      writeJsonOwned(path.join(context.evidenceRoot, "package.json"), report);
      writeJsonOwned(path.join(context.evidenceRoot, "update-manifest.json"), buildUpdateManifest([]));
      console.error(JSON.stringify({ status: report.status, reason: report.reason }));
      return report;
    }
    const artifacts = artifactFiles(context.tauriTargetRoot).map((artifactPath) => {
      const stats = fs.lstatSync(artifactPath);
      const isApp = stats.isDirectory() && /\.app$/i.test(artifactPath);
      const architecture = architectureForArtifact(artifactPath);
      const metrics = isApp ? appBundleMetrics(artifactPath) : { sizeBytes: stats.size, sha256: sha256FileSync(artifactPath), sizeBasis: DMG_SIZE_BASIS, hashBasis: DMG_HASH_BASIS };
      return {
        path: artifactPath,
        relativePath: path.relative(context.outputRoot, artifactPath).split(path.sep).join("/"),
        name: path.basename(artifactPath),
        type: isApp ? ".app" : "DMG",
        architecture: architecture.value,
        architectureInspection: architecture.command,
        architectureEvidence: { target: "Apple Silicon arm64", inspectedPath: architecture.targetPath, command: architecture.commandLine, output: architecture.output, basis: architecture.basis },
        sizeBytes: metrics.sizeBytes,
        sizeBasis: metrics.sizeBasis,
        sha256: metrics.sha256,
        hashBasis: metrics.hashBasis,
      };
    });
    const hasApp = artifacts.some((artifact) => artifact.type === ".app");
    const hasDmg = artifacts.some((artifact) => artifact.type === "DMG");
    const appArchitectureVerified = artifacts.filter((artifact) => artifact.type === ".app").every((artifact) => artifact.architecture === "arm64");
    const report = {
      schemaVersion: 1,
      status: hasApp && hasDmg && appArchitectureVerified ? "PASS" : hasApp && hasDmg ? "UNVERIFIED" : "BLOCKED",
      durationMs,
      output: context.outputRoot,
      artifacts,
      target: "Apple Silicon arm64",
      developerIdRequired: false,
      notarizationRequired: false,
      signing: "not performed for PoC",
      publicDistribution: "not performed for PoC",
      tauriCli,
      runtimePackaging: {
        nextDistIncluded: fs.existsSync(context.nextDistDir),
        nodeRuntimeIncluded: false,
        status: "UNVERIFIED: packaged shell does not claim a fully bundled Node sidecar",
      },
      measuredAt: new Date().toISOString(),
    };
    writeJsonOwned(path.join(context.evidenceRoot, "package.json"), report);
    writeJsonOwned(path.join(context.evidenceRoot, "update-manifest.json"), buildUpdateManifest(artifacts));
    console.log(JSON.stringify({ status: report.status, artifactCount: artifacts.length, evidence: path.join(context.evidenceRoot, "package.json") }));
    return report;
  } catch (error) {
    const failurePath = writeFailureSummary(context, "package", error);
    const report = blockedPackage(context, error instanceof Error ? error.message : String(error));
    try { writeJsonOwned(path.join(context.evidenceRoot, "package.json"), report); } catch { /* preserve immutable evidence */ }
    console.error(`${report.reason}\nsummary: ${failurePath}`);
    return report;
  }
}

if (require.main === module) run().catch(() => { process.exitCode = 1; });

module.exports = { appBundleMetrics, architectureForArtifact, artifactFiles, buildUpdateManifest, run };
