const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const candidateRoot = path.resolve(__dirname, "..");

const {
  appBundleMetrics,
  architectureForArtifact,
  artifactFiles,
  buildUpdateManifest,
} = require("../scripts/package.cjs");

function withTempDirectory(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-method-electron-package-"));
  try {
    return callback(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("artifactFiles collects app directories and dmg files without following symlinks", () => {
  withTempDirectory((output) => {
    const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-method-electron-package-external-"));
    try {
      const app = path.join(output, "Cornell.app");
      const plainDirectory = path.join(output, "plain-directory");
      const externalApp = path.join(externalRoot, "External.app");
      fs.mkdirSync(path.join(app, "Contents", "Resources"), { recursive: true });
      fs.writeFileSync(path.join(app, "Contents", "Resources", "inside.dmg"), "not an artifact");
      fs.mkdirSync(path.join(plainDirectory, "nested.app"), { recursive: true });
      fs.writeFileSync(path.join(plainDirectory, "nested.dmg"), "dmg");
      fs.mkdirSync(externalApp);
      fs.writeFileSync(path.join(output, "ignored.app"), "an app-looking regular file");
      fs.symlinkSync(externalApp, path.join(output, "linked.app"));
      fs.symlinkSync(plainDirectory, path.join(output, "linked-directory"));
      fs.symlinkSync(path.join(plainDirectory, "nested.dmg"), path.join(output, "linked.dmg"));

      const relativeArtifacts = artifactFiles(output)
        .map((filePath) => path.relative(output, filePath).split(path.sep).join("/"));

      assert.deepEqual(relativeArtifacts, [
        "Cornell.app",
        "plain-directory/nested.app",
        "plain-directory/nested.dmg",
      ]);
    } finally {
      fs.rmSync(externalRoot, { recursive: true, force: true });
    }
  });
});

test("app bundle metrics are deterministic and do not follow symlinks", () => {
  withTempDirectory((directory) => {
    const app = path.join(directory, "Cornell.app");
    const resources = path.join(app, "Contents", "Resources");
    const external = path.join(directory, "outside.txt");
    fs.mkdirSync(path.join(app, "Contents", "MacOS"), { recursive: true });
    fs.mkdirSync(resources, { recursive: true });
    fs.writeFileSync(path.join(app, "Contents", "MacOS", "Cornell"), "main binary");
    fs.writeFileSync(path.join(resources, "z.txt"), "z");
    fs.writeFileSync(path.join(resources, "a.txt"), "a longer resource");
    fs.writeFileSync(external, "outside content");
    fs.symlinkSync(external, path.join(resources, "external-link"));

    const first = appBundleMetrics(app);
    const second = appBundleMetrics(app);
    assert.deepEqual(second, first);
    assert.equal(first.sizeBytes, Buffer.byteLength("main binary") + Buffer.byteLength("z") + Buffer.byteLength("a longer resource"));
    assert.match(first.hashBasis, /symlinks include link text without following the target/);

    fs.writeFileSync(external, "changed outside content");
    assert.equal(appBundleMetrics(app).sha256, first.sha256);
  });
});

test("architecture evidence uses an app main binary and leaves unknown results unverified", () => {
  withTempDirectory((directory) => {
    const app = path.join(directory, "Cornell.app");
    const binary = path.join(app, "Contents", "MacOS", "Cornell");
    const dmg = path.join(directory, "Cornell.dmg");
    fs.mkdirSync(path.dirname(binary), { recursive: true });
    fs.writeFileSync(binary, "not a Mach-O binary");
    fs.chmodSync(binary, 0o755);
    fs.writeFileSync(dmg, "disk image placeholder");

    const appArchitecture = architectureForArtifact(app);
    assert.equal(appArchitecture.value, "UNVERIFIED");
    assert.equal(appArchitecture.targetPath, binary);
    assert.match(appArchitecture.commandLine, /Contents\/MacOS\/Cornell/);
    assert.match(appArchitecture.basis, /UNVERIFIED/);

    const dmgArchitecture = architectureForArtifact(dmg);
    assert.equal(dmgArchitecture.value, "UNVERIFIED");
    assert.equal(dmgArchitecture.targetPath, dmg);
    assert.match(dmgArchitecture.commandLine, /Cornell\.dmg/);
    assert.match(dmgArchitecture.basis, /DMG container/);
  });
});

test("update manifest preserves artifact metadata and explicit restart", () => {
  const manifest = buildUpdateManifest({}, [{
    path: "/tmp/Cornell.app",
    type: ".app",
    architecture: "UNVERIFIED",
    sizeBytes: 123,
    sha256: "a".repeat(64),
  }]);

  assert.deepEqual(manifest.artifacts, [{
    name: "Cornell.app",
    type: ".app",
    architecture: "UNVERIFIED",
    sizeBytes: 123,
    sha256: "a".repeat(64),
    apply: "explicit-restart",
  }]);
});

test("packaged main process includes the process-tree shutdown helper", () => {
  const builderConfig = fs.readFileSync(path.join(candidateRoot, "electron-builder.yml"), "utf8");
  assert.match(builderConfig, /scripts\/process-tree\.cjs/);
});
