const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  CANDIDATE_ROOT,
  ensureOutputDirectories,
  getContext,
  sha256FileSync,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
} = require("./common.cjs");

const APP_HASH_FORMAT = "cornell-method-electron-app-v1";
const APP_SIZE_BASIS =
  "sum of regular-file bytes; directory entries, symlinks, and special files contribute 0";
const APP_HASH_BASIS =
  "SHA-256 of sorted canonical entries using POSIX relative paths; regular files include path and bytes, directories include entry names, symlinks include link text without following the target, and special files include type without reading or following them";
const DMG_SIZE_BASIS = "regular-file byte length from lstat";
const DMG_HASH_BASIS = "SHA-256 of regular-file bytes";
const EXPECTED_ARCHITECTURE = "Apple Silicon arm64";

function compareEntryNames(left, right) {
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  return 0;
}

function artifactFiles(root) {
  const files = [];
  let rootStats;
  try {
    rootStats = fs.lstatSync(root);
  } catch (error) {
    if (error?.code === "ENOENT") return files;
    throw error;
  }
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) return files;

  const visit = (directory) => {
    const directoryStats = fs.lstatSync(directory);
    if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) return;

    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort(compareEntryNames);
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      const entryStats = fs.lstatSync(filePath);
      if (entryStats.isSymbolicLink()) continue;
      if (entryStats.isDirectory()) {
        if (/\.app$/i.test(entry.name)) files.push(filePath);
        else visit(filePath);
      } else if (entryStats.isFile() && /\.dmg$/i.test(entry.name)) {
        files.push(filePath);
      }
    }
  };
  visit(root);
  return files.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function hashField(digest, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  digest.update(length);
  digest.update(bytes);
}

function beginHashEntry(digest, kind, relativePath) {
  hashField(digest, kind);
  hashField(digest, relativePath);
}

function endHashEntry(digest) {
  hashField(digest, "end");
}

function specialFileKind(stats) {
  if (stats.isFIFO()) return "fifo";
  if (stats.isSocket()) return "socket";
  if (stats.isCharacterDevice()) return "character-device";
  if (stats.isBlockDevice()) return "block-device";
  return "special";
}

function appBundleMetrics(bundlePath) {
  const bundleStats = fs.lstatSync(bundlePath);
  if (bundleStats.isSymbolicLink() || !bundleStats.isDirectory()) {
    throw new Error(`app bundle が directory ではありません: ${bundlePath}`);
  }

  const digest = crypto.createHash("sha256");
  let sizeBytes = 0;
  hashField(digest, APP_HASH_FORMAT);

  const visit = (directory, relativeDirectory) => {
    const directoryStats = fs.lstatSync(directory);
    if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
      throw new Error(`bundle 内の directory が symlink または directory ではありません: ${directory}`);
    }

    const relativePath = relativeDirectory || ".";
    beginHashEntry(digest, "directory", relativePath);
    endHashEntry(digest);

    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort(compareEntryNames);
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      const entryStats = fs.lstatSync(filePath);
      const childPath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;

      if (entryStats.isSymbolicLink()) {
        // Hash the link text only. Never follow a link, including one pointing outside the bundle.
        beginHashEntry(digest, "symlink", childPath);
        hashField(digest, fs.readlinkSync(filePath));
        endHashEntry(digest);
      } else if (entryStats.isDirectory()) {
        visit(filePath, childPath);
      } else if (entryStats.isFile()) {
        const descriptor = fs.openSync(filePath, "r");
        try {
          const fileSize = fs.fstatSync(descriptor).size;
          beginHashEntry(digest, "file", childPath);
          hashField(digest, String(fileSize));
          const buffer = Buffer.allocUnsafe(1024 * 1024);
          let bytesRead = 0;
          while (true) {
            const count = fs.readSync(descriptor, buffer, 0, buffer.length, bytesRead);
            if (count === 0) break;
            digest.update(buffer.subarray(0, count));
            bytesRead += count;
          }
          if (bytesRead !== fileSize) {
            throw new Error(`bundle 内の file が計測中に変更されました: ${filePath}`);
          }
          sizeBytes += bytesRead;
          endHashEntry(digest);
        } finally {
          fs.closeSync(descriptor);
        }
      } else {
        // Special files are represented by type and name only; never open or follow them.
        beginHashEntry(digest, `special:${specialFileKind(entryStats)}`, childPath);
        hashField(digest, "not-followed");
        endHashEntry(digest);
      }
    }
  };

  visit(bundlePath, "");
  return {
    sizeBytes,
    sha256: digest.digest("hex"),
    sizeBasis: APP_SIZE_BASIS,
    hashBasis: APP_HASH_BASIS,
  };
}

function appMainBinary(bundlePath) {
  const directory = path.join(bundlePath, "Contents", "MacOS");
  let directoryStats;
  try {
    directoryStats = fs.lstatSync(directory);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) return null;

  const entries = fs
    .readdirSync(directory, { withFileTypes: true })
    .sort(compareEntryNames);
  for (const entry of entries) {
    const candidatePath = path.join(directory, entry.name);
    const candidateStats = fs.lstatSync(candidatePath);
    if (candidateStats.isSymbolicLink() || !candidateStats.isFile()) continue;
    if ((candidateStats.mode & 0o111) !== 0) return candidatePath;
  }
  return null;
}

function fileArchitectureInspection(targetPath) {
  const commandLine = `file ${JSON.stringify(targetPath)}`;
  try {
    const output = execFileSync("file", [targetPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const description = output.includes(": ")
      ? output.slice(output.indexOf(": ") + 2)
      : output;
    return {
      value: /\b(?:arm64|aarch64)\b/i.test(description) ? "arm64" : "UNVERIFIED",
      command: output,
      commandLine,
      output,
      targetPath,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      value: "UNVERIFIED",
      command: reason,
      commandLine,
      output: "",
      targetPath,
    };
  }
}

function architectureForArtifact(filePath) {
  const artifactStats = fs.lstatSync(filePath);
  const isApp = artifactStats.isDirectory() && /\.app$/i.test(filePath);
  const isDmg = artifactStats.isFile() && /\.dmg$/i.test(filePath);

  if (isApp) {
    const binaryPath = appMainBinary(filePath);
    if (!binaryPath) {
      return {
        value: "UNVERIFIED",
        command: "not run",
        commandLine: null,
        output: "",
        targetPath: null,
        basis: "UNVERIFIED: no regular executable main binary was found under Contents/MacOS; symlinks were not followed",
      };
    }
    const inspection = fileArchitectureInspection(binaryPath);
    return {
      ...inspection,
      basis: inspection.value === "arm64"
        ? "file output for the regular executable under Contents/MacOS identified arm64"
        : "UNVERIFIED: file output for the regular executable under Contents/MacOS did not identify arm64",
    };
  }

  if (isDmg) {
    const inspection = fileArchitectureInspection(filePath);
    return {
      ...inspection,
      value: "UNVERIFIED",
      basis: inspection.output
        ? "UNVERIFIED: file output for a DMG container was recorded, but it does not establish the architecture of the app contained inside"
        : "UNVERIFIED: file inspection of the DMG container did not produce usable output",
    };
  }

  return {
    value: "UNVERIFIED",
    command: "not run",
    commandLine: null,
    output: "",
    targetPath: filePath,
    basis: "UNVERIFIED: unsupported artifact type",
  };
}

function buildUpdateManifest(context, artifacts) {
  const template = JSON.parse(fs.readFileSync(path.join(CANDIDATE_ROOT, "resources", "update-manifest.template.json"), "utf8"));
  return {
    ...template,
    generatedAt: new Date().toISOString(),
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

async function run() {
  const context = getContext();
  ensureOutputDirectories(context);
  try {
    validateBaseline(context);
    if (!fs.existsSync(path.join(context.evidenceRoot, "preparation.json"))) {
      throw new Error("preparation.json がありません。先に candidate の prepare を実行してください");
    }
    if (!fs.existsSync(path.join(context.evidenceRoot, "build.json"))) {
      throw new Error("build.json がありません。先に candidate の production build を実行してください");
    }
    const builder = require("electron-builder");
    const targetOutput = context.artifactsRoot;
    if (fs.readdirSync(targetOutput).length > 0) {
      throw new Error(`既存 artifact output を上書きしません: ${targetOutput}`);
    }
    const startedAt = process.hrtime.bigint();
    const extraResources = [];
    if (fs.existsSync(context.nextDistDir)) {
      extraResources.push({
        from: context.nextDistDir,
        to: "runtime/next-dist",
        filter: ["**/*"],
      });
    }
    let buildError = null;
    try {
      await builder.build({
        projectDir: CANDIDATE_ROOT,
        config: {
          appId: "com.cornellmethod.notebook.electron.poc",
          productName: "Cornell Method Notebook Electron PoC",
          asar: true,
          directories: { output: targetOutput },
          files: ["src/main.cjs", "src/preload.cjs", "package.json"],
          extraResources,
          mac: {
            category: "public.app-category.productivity",
            hardenedRuntime: false,
            gatekeeperAssess: false,
            identity: null,
            target: [
              { target: "dir", arch: ["arm64"] },
              { target: "dmg", arch: ["arm64"] },
            ],
          },
          artifactName: "Cornell-Method-Electron-PoC-${version}-${arch}.${ext}",
          publish: null,
        },
      });
    } catch (error) {
      buildError = error;
    }
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (buildError) {
      const report = {
        schemaVersion: 1,
        status: "BLOCKED",
        reason: buildError instanceof Error ? buildError.message : String(buildError),
        durationMs: Math.round(durationMs),
        output: targetOutput,
        developerIdRequired: false,
        notarizationRequired: false,
        measuredAt: new Date().toISOString(),
      };
      writeJsonOwned(path.join(context.evidenceRoot, "package.json"), report);
      const updateManifest = buildUpdateManifest(context, []);
      writeJsonOwned(path.join(context.evidenceRoot, "update-manifest.json"), updateManifest);
      console.error(JSON.stringify({ status: report.status, reason: report.reason }));
      return report;
    }
    const paths = artifactFiles(targetOutput);
    const artifacts = paths.map((artifactPath) => {
      const artifactStats = fs.lstatSync(artifactPath);
      const isApp = artifactStats.isDirectory() && artifactPath.toLowerCase().endsWith(".app");
      const architecture = architectureForArtifact(artifactPath);
      const metrics = isApp
        ? appBundleMetrics(artifactPath)
        : {
          sizeBytes: artifactStats.size,
          sha256: sha256FileSync(artifactPath),
          sizeBasis: DMG_SIZE_BASIS,
          hashBasis: DMG_HASH_BASIS,
        };
      return {
        path: artifactPath,
        relativePath: path.relative(context.outputRoot, artifactPath).split(path.sep).join("/"),
        name: path.basename(artifactPath),
        type: isApp ? ".app" : "DMG",
        architecture: architecture.value,
        architectureInspection: architecture.command,
        architectureEvidence: {
          target: EXPECTED_ARCHITECTURE,
          inspectedPath: architecture.targetPath,
          command: architecture.commandLine,
          output: architecture.output,
          basis: architecture.basis,
        },
        sizeBytes: metrics.sizeBytes,
        sizeBasis: metrics.sizeBasis,
        sha256: metrics.sha256,
        hashBasis: metrics.hashBasis,
      };
    });
    const hasApp = artifacts.some((artifact) => artifact.type === ".app");
    const hasDmg = artifacts.some((artifact) => artifact.type === "DMG");
    const report = {
      schemaVersion: 1,
      status: hasApp && hasDmg ? "PASS" : "UNVERIFIED",
      durationMs: Math.round(durationMs),
      output: targetOutput,
      artifacts,
      target: "Apple Silicon arm64",
      developerIdRequired: false,
      notarizationRequired: false,
      signing: "not performed for PoC",
      publicDistribution: "not performed for PoC",
      runtimePackaging: {
        nextDistIncluded: extraResources.length > 0,
        nodeRuntimeIncluded: false,
        status: "UNVERIFIED: packaged shell does not claim a distributable Node sidecar",
      },
      measuredAt: new Date().toISOString(),
    };
    writeJsonOwned(path.join(context.evidenceRoot, "package.json"), report);
    const updateManifest = buildUpdateManifest(context, artifacts);
    writeJsonOwned(path.join(context.evidenceRoot, "update-manifest.json"), updateManifest);
    console.log(JSON.stringify({ status: report.status, artifactCount: artifacts.length, evidence: path.join(context.evidenceRoot, "package.json") }));
    return report;
  } catch (error) {
    const failurePath = writeFailureSummary(context, "package", error);
    const report = {
      schemaVersion: 1,
      status: "BLOCKED",
      reason: error instanceof Error ? error.message : String(error),
      output: context.artifactsRoot,
      developerIdRequired: false,
      notarizationRequired: false,
      measuredAt: new Date().toISOString(),
    };
    try {
      writeJsonOwned(path.join(context.evidenceRoot, "package.json"), report);
      writeJsonOwned(path.join(context.evidenceRoot, "update-manifest.json"), buildUpdateManifest(context, []));
    } catch {
      // Preserve the original error.
    }
    console.error(`${report.reason}\nsummary: ${failurePath}`);
    if (error?.code === "BASELINE_MISMATCH") return report;
    throw error;
  }
}

if (require.main === module) {
  run().catch(() => { process.exitCode = 1; });
}

module.exports = {
  run,
  artifactFiles,
  appBundleMetrics,
  appMainBinary,
  architectureForArtifact,
  buildUpdateManifest,
};
