const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { appBundleMetrics, architectureForArtifact, artifactFiles, buildUpdateManifest } = require("../scripts/package.cjs");

function withTempDirectory(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-method-tauri-package-"));
  try { return callback(directory); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

test("artifact discovery does not follow symlinks and only returns app directories/DMGs", () => {
  withTempDirectory((directory) => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-method-tauri-outside-"));
    try {
      fs.mkdirSync(path.join(directory, "A.app", "Contents"), { recursive: true });
      fs.writeFileSync(path.join(directory, "A.dmg"), "dmg");
      fs.mkdirSync(path.join(directory, "nested", "B.app"), { recursive: true });
      fs.writeFileSync(path.join(directory, "nested", "B.dmg"), "dmg");
      fs.mkdirSync(path.join(outside, "Outside.app"));
      fs.symlinkSync(path.join(outside, "Outside.app"), path.join(directory, "linked.app"));
      fs.symlinkSync(path.join(directory, "A.dmg"), path.join(directory, "linked.dmg"));
      assert.deepEqual(artifactFiles(directory).map((file) => path.relative(directory, file).split(path.sep).join("/")), ["A.app", "A.dmg", "nested/B.app", "nested/B.dmg"]);
    } finally { fs.rmSync(outside, { recursive: true, force: true }); }
  });
});

test("app bundle metrics are deterministic and hash symlink text without following it", () => {
  withTempDirectory((directory) => {
    const app = path.join(directory, "Cornell.app");
    const outside = path.join(directory, "outside.txt");
    fs.mkdirSync(path.join(app, "Contents", "MacOS"), { recursive: true });
    fs.writeFileSync(path.join(app, "Contents", "MacOS", "Cornell"), "main");
    fs.writeFileSync(outside, "outside");
    fs.symlinkSync(outside, path.join(app, "Contents", "external-link"));
    const first = appBundleMetrics(app);
    fs.writeFileSync(outside, "changed outside");
    assert.deepEqual(appBundleMetrics(app), first);
    assert.match(first.hashBasis, /symlinks include link text without following/);
  });
});

test("unknown architecture remains UNVERIFIED", () => {
  withTempDirectory((directory) => {
    const app = path.join(directory, "Cornell.app");
    const binary = path.join(app, "Contents", "MacOS", "Cornell");
    fs.mkdirSync(path.dirname(binary), { recursive: true });
    fs.writeFileSync(binary, "not Mach-O");
    fs.chmodSync(binary, 0o755);
    assert.equal(architectureForArtifact(app).value, "UNVERIFIED");
    const dmg = path.join(directory, "Cornell.dmg");
    fs.writeFileSync(dmg, "placeholder");
    assert.equal(architectureForArtifact(dmg).value, "UNVERIFIED");
  });
});

test("update manifest keeps explicit restart and does not invent artifacts", () => {
  const manifest = buildUpdateManifest([]);
  assert.equal(manifest.status, "BLOCKED");
  assert.equal(manifest.apply.mode, "explicit-restart");
  assert.deepEqual(manifest.artifacts, []);
});
