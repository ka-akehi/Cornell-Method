/* eslint-disable @typescript-eslint/no-require-imports -- This build helper is intentionally CommonJS. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const DESKTOP_NODE_RUNTIME_DIRECTORY = ".desktop-runtime";
const DESKTOP_NODE_RUNTIME_FILE = "node";
const DESKTOP_RUNTIME_PACKAGE_FILE = "package.json";
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

function desktopRuntimeDirectory(projectRoot) {
  return path.resolve(projectRoot, DESKTOP_NODE_RUNTIME_DIRECTORY);
}

function readJsonFile(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Desktop runtime ${label} is unavailable: ${filePath} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

function productionRuntimePackage(projectRoot = path.resolve(__dirname, "..")) {
  const packagePath = path.join(projectRoot, "package.json");
  const projectPackage = readJsonFile(packagePath, "project package");
  const dependencies = { ...(projectPackage.dependencies ?? {}) };

  return {
    name: `${projectPackage.name ?? "cornell-method"}-desktop-runtime`,
    version: projectPackage.version ?? "0.0.0",
    private: true,
    dependencies,
  };
}

function removeGeneratedRuntimeFiles(runtimeDirectory) {
  for (const entry of [
    DESKTOP_NODE_RUNTIME_FILE,
    DESKTOP_RUNTIME_PACKAGE_FILE,
    "package-lock.json",
    "node_modules",
  ]) {
    fs.rmSync(path.join(runtimeDirectory, entry), {
      recursive: true,
      force: true,
    });
  }
}

function npmCommand() {
  const npmExecutable = process.env.npm_execpath?.trim();
  if (npmExecutable) {
    return {
      command: process.execPath,
      prefixArguments: [npmExecutable],
    };
  }

  return { command: "npm", prefixArguments: [] };
}

function installProductionRuntime(projectRoot, runtimeDirectory) {
  const projectPackagePath = path.join(projectRoot, "package.json");
  const projectLockPath = path.join(projectRoot, "package-lock.json");
  const runtimePackagePath = path.join(runtimeDirectory, DESKTOP_RUNTIME_PACKAGE_FILE);
  const runtimeLockPath = path.join(runtimeDirectory, "package-lock.json");

  if (!fs.existsSync(projectLockPath)) {
    throw new Error(`Desktop runtime package lock is unavailable: ${projectLockPath}`);
  }

  fs.copyFileSync(projectPackagePath, runtimePackagePath);
  fs.copyFileSync(projectLockPath, runtimeLockPath);

  const npm = npmCommand();
  const result = spawnSync(
    npm.command,
    [...npm.prefixArguments, "ci", "--omit=dev", "--no-audit", "--no-fund"],
    {
      cwd: runtimeDirectory,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw new Error(`Desktop production runtime install failed: ${result.error.message}`);
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Desktop production runtime install failed with status ${result.status ?? "unknown"}`);
  }

  fs.writeFileSync(
    runtimePackagePath,
    `${JSON.stringify(productionRuntimePackage(projectRoot), null, 2)}\n`,
    "utf8",
  );
}

function copyGeneratedSqliteClient(projectRoot, runtimeDirectory) {
  const source = path.join(projectRoot, "node_modules", ".prisma", "client");
  const destination = path.join(runtimeDirectory, "node_modules", ".prisma", "client");
  if (!fs.existsSync(source)) {
    throw new Error(`Generated SQLite Prisma client is unavailable: ${source}`);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
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

function prepareDesktopRuntime({
  arch = process.arch,
  platform = process.platform,
  projectRoot = path.resolve(__dirname, ".."),
  sourcePath = process.execPath,
} = {}) {
  validateBuildTarget(platform, arch);
  const runtimeDirectory = desktopRuntimeDirectory(projectRoot);
  fs.mkdirSync(runtimeDirectory, { recursive: true });
  removeGeneratedRuntimeFiles(runtimeDirectory);
  fs.mkdirSync(runtimeDirectory, { recursive: true });

  installProductionRuntime(projectRoot, runtimeDirectory);
  copyGeneratedSqliteClient(projectRoot, runtimeDirectory);
  copyNodeExecutable(sourcePath, desktopNodeRuntimePath(projectRoot));

  return runtimeDirectory;
}

if (require.main === module) {
  try {
    const destination = prepareDesktopRuntime();
    process.stdout.write(`Prepared desktop runtime: ${destination}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  DESKTOP_NODE_RUNTIME_DIRECTORY,
  DESKTOP_NODE_RUNTIME_FILE,
  DESKTOP_RUNTIME_PACKAGE_FILE,
  UNSUPPORTED_TARGET_MESSAGE,
  copyNodeExecutable,
  copyGeneratedSqliteClient,
  desktopRuntimeDirectory,
  desktopNodeRuntimePath,
  installProductionRuntime,
  prepareDesktopRuntime,
  prepareDesktopNodeRuntime,
  productionRuntimePackage,
  removeGeneratedRuntimeFiles,
  validateBuildTarget,
};
