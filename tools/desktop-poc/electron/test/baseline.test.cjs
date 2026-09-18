const assert = require("node:assert/strict");
const test = require("node:test");

const {
  EXPECTED_BASELINE,
  baselineMismatches,
  fixtureMismatches,
  revisionProvenance,
} = require("../scripts/common.cjs");

const candidate = {
  architecture: "arm64",
  macosVersion: EXPECTED_BASELINE.macos_version,
  nodeVersion: EXPECTED_BASELINE.node_version,
  npmVersion: EXPECTED_BASELINE.npm_version,
  gitHead: "3cb2fd48f534ff758f68bef752776c4d402eda5b",
  gitWorktreeDirty: true,
};

test("candidate revision differences are recorded without creating a baseline mismatch", () => {
  assert.deepEqual(baselineMismatches(EXPECTED_BASELINE, candidate), []);
  assert.deepEqual(revisionProvenance(EXPECTED_BASELINE, candidate), {
    baselineGitHead: EXPECTED_BASELINE.git_head,
    candidateGitHead: candidate.gitHead,
    candidateDirtyWorktree: true,
  });
});

test("manifest baseline git_head remains a fixed provenance check", () => {
  const mismatches = baselineMismatches({
    ...EXPECTED_BASELINE,
    git_head: candidate.gitHead,
  }, candidate);
  assert.match(mismatches.join("\n"), /manifest\.git_head/);
});

test("target environment mismatches remain detectable", () => {
  const mismatches = baselineMismatches({ ...EXPECTED_BASELINE }, {
    ...candidate,
    nodeVersion: "v0.0.0",
  });
  assert.match(mismatches.join("\n"), /environment\.node_version/);
});

test("fixture hash, count, contentHash, and integrity mismatches remain detectable", () => {
  const mismatches = fixtureMismatches(EXPECTED_BASELINE, "0".repeat(64), {
    notebooks: EXPECTED_BASELINE.fixture_count - 1,
    contentHash: "0".repeat(64),
    foreignKeyCheck: "fail",
    sqliteIntegrityCheck: "fail",
  });
  const message = mismatches.join("\n");
  assert.match(message, /fixture_sha256/);
  assert.match(message, /fixture_count/);
  assert.match(message, /fixture_content_hash/);
  assert.match(message, /fixture_integrity/);
});
