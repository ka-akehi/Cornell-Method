const fs = require("node:fs");
const path = require("node:path");
const {
  ensureOutputDirectories,
  getContext,
  validateBaseline,
  writeFailureSummary,
  writeJsonOwned,
} = require("./common.cjs");

function run() {
  const context = getContext();
  ensureOutputDirectories(context);
  try {
    const validation = validateBaseline(context);
    const report = {
      schemaVersion: 1,
      status: "PASS",
      baselinePath: context.baselinePath,
      baselineId: context.baseline.baseline_id,
      baselineScopeSha256: context.baseline.baseline_scope_sha256,
      fixturePath: context.fixturePath,
      expected: validation.expected,
      observed: validation.actual,
      fixtureReadBack: validation.fixtureReadBack,
      measuredAt: new Date().toISOString(),
    };
    const canonicalPath = path.join(context.evidenceRoot, "baseline-validation.json");
    try {
      writeJsonOwned(canonicalPath, report);
    } catch (error) {
      if (!fs.existsSync(canonicalPath)) throw error;
      writeJsonOwned(path.join(context.evidenceRoot, `baseline-validation-retry-${Date.now()}.json`), {
        ...report,
        supersedes: path.basename(canonicalPath),
      });
    }
    console.log(JSON.stringify({ status: report.status, evidence: path.join(context.evidenceRoot, "baseline-validation.json") }));
    return report;
  } catch (error) {
    const failurePath = writeFailureSummary(context, "baseline", error);
    const report = {
      schemaVersion: 1,
      status: "BLOCKED",
      reason: error instanceof Error ? error.message : String(error),
      code: error?.code ?? null,
      measuredAt: new Date().toISOString(),
    };
    try {
      writeJsonOwned(path.join(context.evidenceRoot, "baseline-validation.json"), report);
    } catch {
      // Preserve the original blocker without overwriting prior evidence.
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
