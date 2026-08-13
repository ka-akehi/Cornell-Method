const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const candidateRoot = path.resolve(__dirname, "..");
const sourceFiles = [
  "src/main.cjs",
  "src/preload.cjs",
  "scripts/common.cjs",
  "scripts/process-tree.cjs",
  "scripts/poc.cjs",
  "scripts/validate.cjs",
  "scripts/prepare.cjs",
  "scripts/build.cjs",
  "scripts/smoke.cjs",
  "scripts/runtime-http.cjs",
  "scripts/lifecycle.cjs",
  "scripts/package.cjs",
  "scripts/evidence.cjs",
];

test("candidate source files exist", () => {
  for (const relativePath of sourceFiles) {
    assert.equal(fs.existsSync(path.join(candidateRoot, relativePath)), true, relativePath);
  }
});

test("candidate package pins exact desktop dependency versions", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(candidateRoot, "package.json"), "utf8"));
  assert.match(packageJson.dependencies.electron, /^\d+\.\d+\.\d+$/);
  assert.match(packageJson.devDependencies["electron-builder"], /^\d+\.\d+\.\d+$/);
  assert.equal(packageJson.private, true);
});

test("update metadata keeps product update outside the PoC implementation", () => {
  const template = JSON.parse(fs.readFileSync(path.join(candidateRoot, "resources", "update-manifest.template.json"), "utf8"));
  assert.equal(template.apply.mode, "explicit-restart");
  assert.equal(template.apply.backgroundDownload, "future-boundary-only");
  assert.equal(template.distribution.developerId, false);
  assert.equal(template.distribution.notarized, false);
});
