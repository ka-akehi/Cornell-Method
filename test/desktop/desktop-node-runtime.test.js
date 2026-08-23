/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const {
  UNSUPPORTED_TARGET_MESSAGE,
  desktopRuntimeDirectory,
  desktopNodeRuntimePath,
  prepareDesktopNodeRuntime,
  productionRuntimePackage,
  validateBuildTarget,
} = require("../../scripts/prepare-desktop-node-runtime.js");

const projectRoot = path.resolve(__dirname, "../..");
const helperPath = path.join(
  projectRoot,
  "scripts",
  "prepare-desktop-node-runtime.js",
);

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cornell-desktop-node-runtime-"));
}

test("desktop build maps the generated Node runtime into runtime/node", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  );
  const config = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "src-tauri", "tauri.conf.json"), "utf8"),
  );
  const gitignore = fs.readFileSync(path.join(projectRoot, ".gitignore"), "utf8");

  assert.equal(
    packageJson.scripts["desktop:prepare-node-runtime"],
    "node scripts/prepare-desktop-node-runtime.js",
  );
  assert.match(
    config.build.beforeBuildCommand,
    /npm run build && npm run desktop:prepare-node-runtime/,
  );
  assert.equal(
    config.bundle.resources["../.desktop-runtime/node"],
    "runtime/node",
  );
  assert.equal(
    config.bundle.resources["../.desktop-runtime/package.json"],
    "runtime/package.json",
  );
  assert.equal(
    config.bundle.resources["../.desktop-runtime/node_modules/**/*"],
    "runtime/node_modules/",
  );
  assert.equal(
    config.bundle.resources["../.desktop-runtime/node_modules/.bin/**/*"],
    "runtime/node_modules/.bin/",
  );
  assert.equal(
    config.bundle.resources["../.desktop-runtime/node_modules/.prisma/**/*"],
    "runtime/node_modules/.prisma/",
  );
  assert.equal(config.bundle.resources["../.desktop-runtime/"], undefined);
  assert.equal(config.bundle.resources["../node_modules/**/*"], undefined);
  assert.equal(config.bundle.resources["../package.json"], undefined);
  assert.equal(config.bundle.resources["../.next/**/*"], undefined);
  assert.equal(
    config.bundle.resources["../.next/BUILD_ID"],
    "runtime/.next/BUILD_ID",
  );
  assert.equal(
    config.bundle.resources["../.next/*.json"],
    "runtime/.next/",
  );
  assert.equal(
    config.bundle.resources["../.next/server/**/*"],
    "runtime/.next/server/",
  );
  assert.equal(
    config.bundle.resources["../.next/static/**/*"],
    "runtime/.next/static/",
  );
  assert.match(gitignore, /^\/.desktop-runtime\/\*$/m);
  assert.match(gitignore, /^!\/.desktop-runtime\/\.gitkeep$/m);
  assert.equal(
    fs.existsSync(path.join(projectRoot, ".desktop-runtime", ".gitkeep")),
    true,
  );
});

test("desktop runtime package contains production dependencies only", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  );
  const runtimePackage = productionRuntimePackage(projectRoot);

  assert.equal(runtimePackage.private, true);
  assert.equal(runtimePackage.dependencies.next, packageJson.dependencies.next);
  assert.equal(
    runtimePackage.dependencies["@prisma/client"],
    packageJson.dependencies["@prisma/client"],
  );
  assert.equal(
    runtimePackage.dependencies["better-sqlite3"],
    packageJson.dependencies["better-sqlite3"],
  );
  assert.equal(runtimePackage.dependencies.prisma, packageJson.dependencies.prisma);
  assert.equal(packageJson.dependencies.playwright, undefined);
  assert.equal(packageJson.devDependencies.playwright, "1.61.0");
  for (const dependencyName of Object.keys(packageJson.devDependencies)) {
    assert.equal(runtimePackage.dependencies[dependencyName], undefined, dependencyName);
  }
  assert.equal(
    desktopRuntimeDirectory(projectRoot),
    path.join(projectRoot, ".desktop-runtime"),
  );
});

test("build helper rejects every target other than Apple Silicon macOS", () => {
  for (const target of [
    ["linux", "arm64"],
    ["darwin", "x64"],
    ["win32", "arm64"],
  ]) {
    assert.throws(
      () => validateBuildTarget(...target),
      (error) => error instanceof Error && error.message === UNSUPPORTED_TARGET_MESSAGE,
    );
  }
});

test("copied build Node keeps executable permissions and launches with an empty PATH", (t) => {
  if (process.platform === "win32") {
    t.skip("the packaged target is macOS only");
    return;
  }

  const directory = temporaryDirectory();
  try {
    const destination = prepareDesktopNodeRuntime({
      arch: "arm64",
      platform: "darwin",
      projectRoot: directory,
      sourcePath: process.execPath,
    });
    const sourceStats = fs.statSync(process.execPath);
    const destinationStats = fs.statSync(destination);

    assert.equal(destination, desktopNodeRuntimePath(directory));
    assert.equal(destinationStats.isFile(), true);
    assert.equal(
      destinationStats.mode & 0o111,
      sourceStats.mode & 0o111,
    );
    assert.deepEqual(fs.readdirSync(path.dirname(destination)), ["node"]);

    const result = spawnSync(
      destination,
      ["-e", "process.stdout.write('desktop-node-runtime-ok')"],
      { encoding: "utf8", env: { PATH: "" } },
    );
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "desktop-node-runtime-ok");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("runtime keeps the debug override separate from release packaged-node selection", () => {
  const runtime = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "runtime.rs"),
    "utf8",
  );
  const nodeBinaryStart = runtime.indexOf("fn node_binary");
  const launcherStart = runtime.indexOf("fn launcher_path", nodeBinaryStart);
  assert.notEqual(nodeBinaryStart, -1);
  assert.notEqual(launcherStart, -1);

  const nodeBinary = runtime.slice(nodeBinaryStart, launcherStart);
  const debugBranchStart = nodeBinary.indexOf("#[cfg(debug_assertions)]");
  const releaseBranchStart = nodeBinary.indexOf(
    "#[cfg(not(debug_assertions))]",
  );
  const overrideReference = nodeBinary.indexOf(
    'env::var_os("CORNELL_DESKTOP_NODE_BINARY")',
  );
  assert.notEqual(debugBranchStart, -1);
  assert.notEqual(releaseBranchStart, -1);
  assert.ok(
    debugBranchStart < overrideReference &&
      overrideReference < releaseBranchStart,
    "the Node binary environment override must be debug-only",
  );

  const debugBranch = nodeBinary.slice(debugBranchStart, releaseBranchStart);
  const releaseBranch = nodeBinary.slice(releaseBranchStart);
  assert.match(debugBranch, /Ok\(PathBuf::from\(PACKAGED_NODE_BINARY_NAME\)\)/);
  assert.match(releaseBranch, /packaged_node_binary\(_root\)/);
  assert.doesNotMatch(releaseBranch, /CORNELL_DESKTOP_NODE_BINARY/);

  assert.match(runtime, /root\.join\(PACKAGED_NODE_BINARY_NAME\)/);
  assert.match(runtime, /metadata\.is_file\(\)/);
  assert.match(runtime, /permissions\(\)\.mode\(\) & 0o111/);
  assert.equal((runtime.match(/Command::new\(&node\)/g) ?? []).length, 2);
  assert.doesNotMatch(runtime, /unwrap_or_else\(\|_\| "node"/);

  const launcherPathStart = runtime.indexOf("fn launcher_path");
  const bootstrapStart = runtime.indexOf("fn parse_bootstrap_message", launcherPathStart);
  assert.notEqual(launcherPathStart, -1);
  assert.notEqual(bootstrapStart, -1);

  const launcherPath = runtime.slice(launcherPathStart, bootstrapStart);
  const launcherDebugBranchStart = launcherPath.indexOf(
    "#[cfg(debug_assertions)]",
  );
  const launcherReleaseBranchStart = launcherPath.indexOf(
    "#[cfg(not(debug_assertions))]",
  );
  const launcherOverrideReference = launcherPath.indexOf(
    'env::var_os("CORNELL_DESKTOP_LAUNCHER")',
  );
  assert.notEqual(launcherDebugBranchStart, -1);
  assert.notEqual(launcherReleaseBranchStart, -1);
  assert.ok(
    launcherDebugBranchStart < launcherOverrideReference &&
      launcherOverrideReference < launcherReleaseBranchStart,
    "the launcher environment override must be debug-only",
  );

  const launcherDebugBranch = launcherPath.slice(
    launcherDebugBranchStart,
    launcherReleaseBranchStart,
  );
  const launcherReleaseBranch = launcherPath.slice(launcherReleaseBranchStart);
  assert.match(
    launcherDebugBranch,
    /root\.join\("src-tauri"\)\.join\("sidecar"\)\.join\("launcher\.cjs"\)/,
  );
  assert.match(
    launcherReleaseBranch,
    /root\.join\("sidecar"\)\.join\("launcher\.cjs"\)/,
  );
  assert.doesNotMatch(launcherReleaseBranch, /CORNELL_DESKTOP_LAUNCHER/);
  assert.doesNotMatch(launcherReleaseBranch, /src-tauri/);
  assert.match(launcherPath, /path\.is_file\(\)/);
});

test("desktop readiness is nonce-bound and does not probe /notes", () => {
  const launcher = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "sidecar", "launcher.cjs"),
    "utf8",
  );
  const runtime = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "runtime.rs"),
    "utf8",
  );
  const healthRoute = fs.readFileSync(
    path.join(projectRoot, "src", "app", "api", "desktop", "health", "route.ts"),
    "utf8",
  );

  assert.match(launcher, /randomBytes\(READY_NONCE_BYTES\)/);
  assert.match(launcher, /CORNELL_DESKTOP_READY_NONCE: readyNonce/);
  assert.match(launcher, /path: READY_HEALTH_PATH/);
  assert.doesNotMatch(launcher, /path:\s*["']\/notes["']/);
  assert.match(runtime, /SIDECAR_HEALTH_PATH/);
  assert.match(runtime, /ready_nonce: String/);
  assert.match(healthRoute, /process\.env\.CORNELL_DESKTOP_READY_NONCE/);
  assert.match(healthRoute, /nonce/);
});

test("helper itself fails with the fixed message on the current unsupported target", () => {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return;
  }

  const result = spawnSync(process.execPath, [helperPath], {
    encoding: "utf8",
    env: { PATH: "" },
  });
  assert.notEqual(result.status, 0);
  assert.equal(result.stderr.trim(), UNSUPPORTED_TARGET_MESSAGE);
  assert.equal(
    fs.existsSync(path.join(projectRoot, ".desktop-runtime", "node")),
    false,
  );
});
