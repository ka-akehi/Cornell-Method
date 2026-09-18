// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- the test loads the CommonJS runtime helper and OS-specific fixtures.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import assert from "node:assert/strict";
import os from "node:os";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const {
  PRISMA_SCHEMA_ENGINE_FILE,
  PRISMA_DEV_PACKAGE_FILE,
  PATHE_PACKAGE_FILE,
  SQLITE_PRODUCTION_ADDON_PATH,
  SQLITE_TEST_EXTENSION_PATH,
  UNSUPPORTED_TARGET_MESSAGE,
  copyPrismaSchemaEngine,
  desktopRuntimeDirectory,
  desktopNodeRuntimePath,
  prismaSchemaEnginePath,
  prepareDesktopRuntime,
  prepareDesktopNodeRuntime,
  productionRuntimePackage,
  inspectProductionRuntime,
  installProductionRuntime,
  removeNonTargetRuntimeFiles,
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

function writeRuntimeFixture(
  directory,
  {
    includeRequiredFiles = true,
    includeRequiredProductionDependencies = true,
  } = {},
) {
  const nodeModules = path.join(directory, "node_modules");
  if (includeRequiredFiles) {
    for (const relativePath of [
      path.join("node_modules", "@prisma", "engines", PRISMA_SCHEMA_ENGINE_FILE),
      SQLITE_PRODUCTION_ADDON_PATH,
    ]) {
      const filePath = path.join(directory, relativePath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, "native fixture\n");
    }
  }
  if (includeRequiredProductionDependencies) {
    for (const relativePath of [PRISMA_DEV_PACKAGE_FILE, PATHE_PACKAGE_FILE]) {
      const filePath = path.join(directory, relativePath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, "{}\n");
    }
  }
  return nodeModules;
}

function writeMinimalRuntimeProject(projectRoot) {
  fs.writeFileSync(
    path.join(projectRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "desktop-runtime-fixture",
        version: "0.0.0",
        dependencies: {},
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(projectRoot, "package-lock.json"),
    `${JSON.stringify(
      {
        name: "desktop-runtime-fixture",
        version: "0.0.0",
        lockfileVersion: 3,
        requires: true,
        packages: {
          "": {
            name: "desktop-runtime-fixture",
            version: "0.0.0",
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const generatedClient = path.join(
    projectRoot,
    "node_modules",
    ".prisma",
    "client",
  );
  fs.mkdirSync(generatedClient, { recursive: true });
  fs.writeFileSync(path.join(generatedClient, "client.js"), "module.exports = {};\n");
}

function writeSuccessfulNpmRunner(
  projectRoot,
  { captureArgs = false, capturePackage = false } = {},
) {
  const npmRunner = path.join(projectRoot, "fake-npm.cjs");
  fs.writeFileSync(
    npmRunner,
    [
      captureArgs
        ? `const fs = require("node:fs");\nfs.writeFileSync("install-args.json", JSON.stringify(process.argv.slice(2)));\n`
        : "",
      capturePackage
        ? `const fs = require("node:fs");\nconst path = require("node:path");\nfs.writeFileSync(path.join(process.cwd(), "install-input.json"), fs.readFileSync("package.json"));\n`
        : "",
      "process.exit(0);\n",
    ].join(""),
    "utf8",
  );
  return npmRunner;
}

function relativeFiles(directory) {
  const files = [];

  function visit(currentDirectory, relativeDirectory) {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const relativePath = path.join(relativeDirectory, entry.name);
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath.split(path.sep).join("/"));
      }
    }
  }

  visit(directory, "");
  return files.sort();
}

function nextStaticAssetReferences(html) {
  return [...html.matchAll(/(?:href|src)="(\/_next\/static\/[^\"]+)"/g)].map(
    ([, reference]) => reference,
  );
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
    config.bundle.resources["../.desktop-runtime/node_modules"],
    "runtime/node_modules",
  );
  assert.equal(config.bundle.resources["../.desktop-runtime/node_modules/**/*"], undefined);
  assert.equal(config.bundle.resources["../.desktop-runtime/node_modules/.bin/**/*"], undefined);
  assert.equal(config.bundle.resources["../.desktop-runtime/node_modules/.prisma/**/*"], undefined);
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
    config.bundle.resources["../.next/server"],
    "runtime/.next/server",
  );
  assert.equal(config.bundle.resources["../.next/server/**/*"], undefined);
  assert.equal(
    config.bundle.resources["../.next/static"],
    "runtime/.next/static",
  );
  assert.equal(config.bundle.resources["../.next/static/**/*"], undefined);
  assert.equal(config.bundle.macOS.signingIdentity, "-");
  assert.equal(config.bundle.resources["../prisma"], "runtime/prisma");
  assert.equal(config.bundle.resources["../prisma/**/*"], undefined);
  assert.match(gitignore, /^\/.desktop-runtime\/\*$/m);
  assert.match(gitignore, /^!\/.desktop-runtime\/\.gitkeep$/m);
  assert.equal(
    fs.existsSync(path.join(projectRoot, ".desktop-runtime", ".gitkeep")),
    true,
  );
});

test("packaged Next static assets preserve generated HTML asset paths", (t) => {
  const config = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "src-tauri", "tauri.conf.json"), "utf8"),
  );
  const sourceStaticDirectory = path.join(projectRoot, ".next", "static");
  const notesHtmlPath = path.join(
    projectRoot,
    ".next",
    "server",
    "app",
    "notes.html",
  );
  const buildIdPath = path.join(projectRoot, ".next", "BUILD_ID");

  if (
    !fs.existsSync(sourceStaticDirectory) ||
    !fs.existsSync(notesHtmlPath) ||
    !fs.existsSync(buildIdPath)
  ) {
    t.skip("run npm run build before checking generated Next asset paths");
    return;
  }

  const staticResourceSource = "../.next/static";
  const staticResourceDestination = config.bundle.resources[staticResourceSource];
  assert.equal(staticResourceDestination, "runtime/.next/static");

  const sourceStaticFiles = relativeFiles(sourceStaticDirectory);
  const buildId = fs.readFileSync(buildIdPath, "utf8").trim();
  assert.notEqual(buildId, "");
  assert.ok(sourceStaticFiles.some((file) => file.startsWith("chunks/")));
  assert.ok(sourceStaticFiles.some((file) => file.startsWith("css/")));
  assert.ok(sourceStaticFiles.includes(`${buildId}/_buildManifest.js`));

  const packageDirectory = temporaryDirectory();
  try {
    const packagedStaticDirectory = path.join(
      packageDirectory,
      staticResourceDestination,
    );
    fs.cpSync(sourceStaticDirectory, packagedStaticDirectory, { recursive: true });

    assert.deepEqual(relativeFiles(packagedStaticDirectory), sourceStaticFiles);
    assert.equal(
      fs.existsSync(path.join(packagedStaticDirectory, `${buildId}/_buildManifest.js`)),
      true,
    );

    const assetReferences = nextStaticAssetReferences(
      fs.readFileSync(notesHtmlPath, "utf8"),
    );
    assert.ok(assetReferences.some((reference) => reference.includes("/css/")));
    assert.ok(assetReferences.some((reference) => reference.includes("/chunks/")));

    for (const reference of assetReferences) {
      const relativeStaticPath = reference.slice("/_next/static/".length);
      assert.equal(
        fs.existsSync(path.join(packagedStaticDirectory, relativeStaticPath)),
        true,
        reference,
      );
    }
  } finally {
    fs.rmSync(packageDirectory, { recursive: true, force: true });
  }
});

test("packaged launcher uses canonical Prisma and Next entries", () => {
  const launcher = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "sidecar", "launcher.cjs"),
    "utf8",
  );

  assert.match(
    launcher,
    /path\.join\(root, "node_modules", "prisma", "build", "index\.js"\)/,
  );
  assert.match(
    launcher,
    /path\.join\(root, "node_modules", "next", "dist", "bin", "next"\)/,
  );
  assert.doesNotMatch(launcher, /path\.join\(root, "node_modules", "\.bin"/);

  const runtimeEntryStart = launcher.indexOf("function runtimeEntry");
  const spawnRuntimeStart = launcher.indexOf("function spawnRuntime", runtimeEntryStart);
  assert.notEqual(runtimeEntryStart, -1);
  assert.notEqual(spawnRuntimeStart, -1);
  const runtimeEntry = launcher.slice(runtimeEntryStart, spawnRuntimeStart);
  assert.match(runtimeEntry, /CORNELL_DESKTOP_RUNTIME_ENTRY/);
  assert.match(
    runtimeEntry,
    /configured && \(process\.env\.NODE_ENV !== "production" \|\| debugOverride\)/,
  );
  assert.match(runtimeEntry, /CORNELL_DESKTOP_ALLOW_RUNTIME_OVERRIDE/);
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

test("production-only runtime manifest is the npm ci install input", () => {
  const directory = temporaryDirectory();
  const previousNpmExecPath = process.env.npm_execpath;
  try {
    writeMinimalRuntimeProject(directory);
    const projectPackagePath = path.join(directory, "package.json");
    const projectPackage = JSON.parse(fs.readFileSync(projectPackagePath, "utf8"));
    projectPackage.devDependencies = { playwright: "1.61.0" };
    projectPackage.dependencies = { next: "15.0.0" };
    fs.writeFileSync(projectPackagePath, `${JSON.stringify(projectPackage, null, 2)}\n`);
    process.env.npm_execpath = writeSuccessfulNpmRunner(directory, {
      capturePackage: true,
    });

    const runtimeDirectory = path.join(directory, ".desktop-runtime");
    fs.mkdirSync(runtimeDirectory, { recursive: true });
    installProductionRuntime(directory, runtimeDirectory);

    const installInput = JSON.parse(
      fs.readFileSync(path.join(runtimeDirectory, "install-input.json"), "utf8"),
    );
    const runtimePackage = JSON.parse(
      fs.readFileSync(path.join(runtimeDirectory, "package.json"), "utf8"),
    );
    assert.deepEqual(installInput, productionRuntimePackage(directory));
    assert.deepEqual(runtimePackage, installInput);
    assert.equal(installInput.devDependencies, undefined);
    assert.deepEqual(installInput.dependencies, { next: "15.0.0" });
  } finally {
    if (previousNpmExecPath === undefined) {
      delete process.env.npm_execpath;
    } else {
      process.env.npm_execpath = previousNpmExecPath;
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("production runtime install explicitly enables package install scripts", () => {
  const directory = temporaryDirectory();
  const previousNpmExecPath = process.env.npm_execpath;
  const previousIgnoreScripts = process.env.npm_config_ignore_scripts;
  try {
    writeMinimalRuntimeProject(directory);
    process.env.npm_execpath = writeSuccessfulNpmRunner(directory, {
      captureArgs: true,
    });
    process.env.npm_config_ignore_scripts = "true";

    const runtimeDirectory = path.join(directory, ".desktop-runtime");
    fs.mkdirSync(runtimeDirectory, { recursive: true });
    installProductionRuntime(directory, runtimeDirectory);

    const installArgs = JSON.parse(
      fs.readFileSync(path.join(runtimeDirectory, "install-args.json"), "utf8"),
    );
    assert.deepEqual(installArgs, [
      "ci",
      "--omit=dev",
      "--no-audit",
      "--no-fund",
      "--ignore-scripts=false",
    ]);
  } finally {
    if (previousNpmExecPath === undefined) {
      delete process.env.npm_execpath;
    } else {
      process.env.npm_execpath = previousNpmExecPath;
    }
    if (previousIgnoreScripts === undefined) {
      delete process.env.npm_config_ignore_scripts;
    } else {
      process.env.npm_config_ignore_scripts = previousIgnoreScripts;
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("production runtime pruning keeps required arm64 files and removes known non-target files", () => {
  const directory = temporaryDirectory();
  try {
    const nodeModules = writeRuntimeFixture(directory);
    const x64Prebuild = path.join(nodeModules, "bare-path", "prebuilds", "darwin-x64", "bare-path.bare");
    const iosPrebuild = path.join(nodeModules, "bare-path", "prebuilds", "ios-arm64-simulator", "bare-path.bare");
    const testExtension = path.join(directory, SQLITE_TEST_EXTENSION_PATH);
    const x64PrismaEngine = path.join(nodeModules, "@prisma", "engines", "schema-engine-darwin");
    for (const filePath of [x64Prebuild, iosPrebuild, testExtension, x64PrismaEngine]) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, "non-target fixture\n");
    }

    removeNonTargetRuntimeFiles(directory);
    assert.equal(inspectProductionRuntime(directory), true);
    assert.equal(fs.existsSync(x64Prebuild), false);
    assert.equal(fs.existsSync(iosPrebuild), false);
    assert.equal(fs.existsSync(testExtension), false);
    assert.equal(fs.existsSync(x64PrismaEngine), false);
    assert.equal(fs.existsSync(path.join(directory, SQLITE_PRODUCTION_ADDON_PATH)), true);
    assert.equal(
      fs.existsSync(path.join(directory, "node_modules", "@prisma", "engines", PRISMA_SCHEMA_ENGINE_FILE)),
      true,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("production runtime inspection fails closed for forbidden files and missing required files", () => {
  const cases = [
    {
      name: "x64 prebuild",
      files: [path.join("node_modules", "bare-fs", "prebuilds", "darwin-x64", "bare-fs.bare")],
    },
    {
      name: "iOS simulator prebuild",
      files: [path.join("node_modules", "bare-fs", "prebuilds", "ios-x64-simulator", "bare-fs.bare")],
    },
    { name: "test extension", files: [SQLITE_TEST_EXTENSION_PATH] },
    {
      name: "x64 Prisma engine",
      files: [path.join("node_modules", "@prisma", "engines", "schema-engine-darwin")],
    },
    {
      name: "missing arm64 Prisma engine",
      files: [],
      includeRequiredFiles: false,
    },
    {
      name: "missing production SQLite addon",
      files: [path.join("node_modules", "@prisma", "engines", PRISMA_SCHEMA_ENGINE_FILE)],
      includeRequiredFiles: false,
    },
    {
      name: "missing pathe production dependency",
      files: [],
      includeRequiredProductionDependencies: false,
    },
  ];

  for (const fixture of cases) {
    const directory = temporaryDirectory();
    try {
      writeRuntimeFixture(directory, {
        includeRequiredFiles: fixture.includeRequiredFiles !== false,
        includeRequiredProductionDependencies:
          fixture.includeRequiredProductionDependencies !== false,
      });
      for (const relativePath of fixture.files) {
        const filePath = path.join(directory, relativePath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, "invalid fixture\n");
      }
      assert.throws(
        () => inspectProductionRuntime(directory),
        (error) =>
          error instanceof Error &&
          error.message.startsWith("Desktop production runtime inspection failed:") &&
          (fixture.name === "missing arm64 Prisma engine" ||
            fixture.name === "missing pathe production dependency" ||
            error.message.includes(
              fixture.name === "test extension"
                ? "test_extension.node"
                : fixture.name === "x64 Prisma engine"
                  ? "schema-engine-darwin"
                  : fixture.name.includes("prebuild")
                    ? "prebuilds"
                    : "required production native file",
            )) &&
          (fixture.name !== "missing pathe production dependency" ||
            error.message.includes(PATHE_PACKAGE_FILE)),
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("production runtime copies the darwin-arm64 Prisma schema engine", (t) => {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    t.skip("the packaged Prisma engine is Apple Silicon macOS only");
    return;
  }

  const source = prismaSchemaEnginePath(projectRoot);
  assert.equal(path.basename(source), PRISMA_SCHEMA_ENGINE_FILE);
  assert.equal(fs.existsSync(source), true);
  const sourceStats = fs.statSync(source);
  assert.equal(sourceStats.isFile(), true);
  assert.notEqual(sourceStats.mode & 0o111, 0);

  const directory = temporaryDirectory();
  try {
    const runtimeDirectory = path.join(directory, ".desktop-runtime");
    const destination = copyPrismaSchemaEngine(projectRoot, runtimeDirectory);
    const destinationStats = fs.statSync(destination);

    assert.equal(
      destination,
      path.join(
        runtimeDirectory,
        "node_modules",
        "@prisma",
        "engines",
        PRISMA_SCHEMA_ENGINE_FILE,
      ),
    );
    assert.equal(destinationStats.isFile(), true);
    assert.equal(destinationStats.mode & 0o777, 0o755);
    assert.equal(
      fs.readFileSync(destination).equals(fs.readFileSync(source)),
      true,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("Prisma schema engine source must exist as an executable regular file", () => {
  for (const sourceType of ["missing", "directory", "non-executable"]) {
    const directory = temporaryDirectory();
    try {
      const source = prismaSchemaEnginePath(directory);
      if (sourceType === "directory") {
        fs.mkdirSync(source, { recursive: true });
      } else if (sourceType === "non-executable") {
        fs.mkdirSync(path.dirname(source), { recursive: true });
        fs.writeFileSync(source, "not-an-engine\n", { mode: 0o644 });
        fs.chmodSync(source, 0o644);
      }

      assert.throws(
        () => copyPrismaSchemaEngine(directory, path.join(directory, "runtime")),
        (error) =>
          error instanceof Error &&
          error.message.includes("Prisma schema engine") &&
          error.message.includes(source),
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("runtime preparation fails closed when the root Prisma schema engine is missing", () => {
  const directory = temporaryDirectory();
  const previousNpmExecPath = process.env.npm_execpath;
  try {
    writeMinimalRuntimeProject(directory);
    process.env.npm_execpath = writeSuccessfulNpmRunner(directory);

    assert.throws(
      () =>
        prepareDesktopRuntime({
          arch: "arm64",
          platform: "darwin",
          projectRoot: directory,
          sourcePath: process.execPath,
        }),
      (error) =>
        error instanceof Error &&
        error.message.startsWith("Prisma schema engine is unavailable:") &&
        error.message.includes(prismaSchemaEnginePath(directory)),
    );

    assert.equal(
      fs.existsSync(
        path.join(
          directory,
          ".desktop-runtime",
          "node_modules",
          "@prisma",
          "engines",
          PRISMA_SCHEMA_ENGINE_FILE,
        ),
      ),
      false,
    );
  } finally {
    if (previousNpmExecPath === undefined) {
      delete process.env.npm_execpath;
    } else {
      process.env.npm_execpath = previousNpmExecPath;
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
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
// @ts-nocheck -- the test loads the CommonJS runtime helper and OS-specific fixtures.
