const fs = require("node:fs");
const path = require("node:path");
const {
  actualToolchain,
  getContext,
  ensureOutputDirectories,
  revisionProvenance,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
} = require("./common.cjs");

function run() {
  const context = getContext();
  try {
    const validation = validateBaseline(context);
    ensureOutputDirectories(context);
    const report = {
      schemaVersion: 1,
      status: "PASS",
      baselinePath: context.baselinePath,
      baselineId: context.baseline.baseline_id,
      fixturePath: context.fixturePath,
      expected: validation.expected,
      observed: validation.actual,
      fixtureReadBack: validation.fixtureReadBack,
      revisionProvenance: validation.revisionProvenance,
      measuredAt: new Date().toISOString(),
    };
    const canonicalPath = path.join(context.evidenceRoot, "baseline-validation.json");
    try {
      writeJsonOwned(canonicalPath, report);
    } catch (error) {
      if (!fs.existsSync(canonicalPath)) throw error;
      const retryPath = path.join(context.evidenceRoot, `baseline-validation-retry-${Date.now()}.json`);
      writeJsonOwned(retryPath, { ...report, supersedes: path.basename(canonicalPath) });
    }
    console.log(JSON.stringify({ status: report.status, evidence: path.join(context.evidenceRoot, "baseline-validation.json") }));
    return report;
  } catch (error) {
    ensureOutputDirectories(context);
    const failurePath = writeFailureSummary(context, "baseline", error);
    const actual = error.validation?.actual ?? actualToolchain();
    const report = {
      schemaVersion: 1,
      status: "BLOCKED",
      reason: error instanceof Error ? error.message : String(error),
      baselinePath: context.baselinePath,
      baselineId: context.baseline.baseline_id,
      fixturePath: context.fixturePath,
      revisionProvenance: error.validation?.revisionProvenance
        ?? revisionProvenance(context.baseline, actual),
      measuredAt: new Date().toISOString(),
    };
    try {
      writeJsonOwned(path.join(context.evidenceRoot, "baseline-validation.json"), report);
    } catch {
      // Keep the original blocker.
    }
    console.error(`${report.reason}\nsummary: ${failurePath}`);
    return report;
  }
}

if (require.main === module) {
  try {
    run();
  } catch {
    process.exitCode = 1;
  }
}

module.exports = { run };
