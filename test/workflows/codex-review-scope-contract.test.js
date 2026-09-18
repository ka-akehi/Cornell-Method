/* eslint-disable @typescript-eslint/no-require-imports -- Node contract test. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const excludedExamples = [
  "HANDOFF.md",
  "HANDOFF_2026-08-01.md",
  "summary/task-123.md",
  "codex-queue/tasks/summary/task-123.md",
  "codex-queue/tasks/summaries/task-123.md",
];

const includedExamples = [
  "src/modules/notes/model/summary.ts",
  "doc/implementation/MVP_CONTRACT.md",
  "doc/summary/README.md",
  "handoff/HANDOFF_2026-08-01.md",
];

function isReviewExcludedPath(filePath) {
  const normalized = String(filePath ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "");
  if (!normalized) return false;
  if (
    !normalized.includes("/") &&
    /^HANDOFF(?:_[^/]+)?\.md$/i.test(normalized)
  ) {
    return true;
  }
  return (
    normalized.startsWith("summary/") ||
    /^codex-queue\/(?:.+\/)?summar(?:y|ies)\//i.test(normalized)
  );
}

test("operational record paths have a narrow review exclusion", () => {
  for (const filePath of excludedExamples) {
    assert.equal(isReviewExcludedPath(filePath), true, filePath);
  }
  for (const filePath of includedExamples) {
    assert.equal(isReviewExcludedPath(filePath), false, filePath);
  }
});

test("review instructions define the same excluded path families", () => {
  const scope = read(".github/CODEX_REVIEW_SCOPE.md");
  const skill = read(".agents/skills/cornell-code-review/SKILL.md");
  const summaryInstructions = read("summary/AGENTS.md");

  for (const expected of ["HANDOFF_*.md", "summary/**", "codex-queue/**/summary/**"]) {
    assert.match(scope, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(skill, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(summaryInstructions, /Codex Code Reviewの対象外/);
});

test("GitHub and Issue automation enforce the exclusion", () => {
  const attributes = read(".gitattributes");
  const syncWorkflow = read(".github/workflows/sync-each-codex-review.yml");
  const resolveWorkflow = read(
    ".github/workflows/resolve-excluded-codex-review-threads.yml",
  );
  const closeWorkflow = read(
    ".github/workflows/close-excluded-codex-review-issues.yml",
  );

  assert.match(attributes, /HANDOFF\*\.md linguist-generated/);
  assert.match(attributes, /summary\/\*\* linguist-generated/);

  for (const workflow of [syncWorkflow, resolveWorkflow, closeWorkflow]) {
    assert.match(workflow, /isReviewExcludedPath/);
    assert.match(workflow, /HANDOFF/);
    assert.match(workflow, /summary\//);
    assert.match(workflow, /codex-queue/);
  }

  assert.match(syncWorkflow, /!isReviewExcludedPath\(comment\.path\)/);
  assert.match(resolveWorkflow, /resolveReviewThread/);
  assert.match(closeWorkflow, /state_reason: "not_planned"/);
});
