/* eslint-disable @typescript-eslint/no-require-imports -- This build helper is intentionally CommonJS. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DESKTOP_NODE_RUNTIME_DIRECTORY = ".desktop-runtime";
const DESKTOP_NODE_RUNTIME_FILE = "node";
const UNSUPPORTED_TARGET_MESSAGE =
  "Desktop Node runtime supports only Apple Silicon macOS (darwin arm64)";

function validateBuildTarget(platform = process.platform, arch = process.arch) {
  if (platform !== "darwin" || arch !== "arm64") {
    throw new Error(UNSUPPORTED_TARGET_MESSAGE);
  }
}

function desktopNodeRuntimePath(projectRoot) {
  return path.resolve(
    projectRoot,
    DESKTOP_NODE_RUNTIME_DIRECTORY,
    DESKTOP_NODE_RUNTIME_FILE,
  );
}

function sourceExecutableStats(sourcePath) {
  let stats;
  try {
    stats = fs.statSync(sourcePath);
  } catch (error) {
    throw new Error(
      `Build Node executable is unavailable: ${sourcePath} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  if (!stats.isFile()) {
    throw new Error(`Build Node executable is not a regular file: ${sourcePath}`);
  }
  if ((stats.mode & 0o111) === 0) {
    throw new Error(`Build Node executable is not executable: ${sourcePath}`);
  }
  return stats;
}

function copyNodeExecutable(sourcePath, destinationPath) {
  const source = path.resolve(sourcePath);
  const destination = path.resolve(destinationPath);
  const sourceStats = sourceExecutableStats(source);
  const destinationDirectory = path.dirname(destination);
  fs.mkdirSync(destinationDirectory, { recursive: true });

  const temporaryDirectory = fs.mkdtempSync(
    path.join(destinationDirectory, ".node-copy-"),
  );
  const temporaryPath = path.join(temporaryDirectory, DESKTOP_NODE_RUNTIME_FILE);

  try {
    fs.copyFileSync(source, temporaryPath, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(temporaryPath, sourceStats.mode & 0o7777);
    fs.renameSync(temporaryPath, destination);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }

  return destination;
}

function prepareDesktopNodeRuntime({
  arch = process.arch,
  platform = process.platform,
  projectRoot = path.resolve(__dirname, ".."),
  sourcePath = process.execPath,
} = {}) {
  validateBuildTarget(platform, arch);
  return copyNodeExecutable(
    sourcePath,
    desktopNodeRuntimePath(projectRoot),
  );
}

if (require.main === module) {
  try {
    const destination = prepareDesktopNodeRuntime();
    process.stdout.write(`Prepared desktop Node runtime: ${destination}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  DESKTOP_NODE_RUNTIME_DIRECTORY,
  DESKTOP_NODE_RUNTIME_FILE,
  UNSUPPORTED_TARGET_MESSAGE,
  copyNodeExecutable,
  desktopNodeRuntimePath,
  prepareDesktopNodeRuntime,
  validateBuildTarget,
};
