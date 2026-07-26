/* eslint-disable @typescript-eslint/no-require-imports -- Focused Node contract tests for operator CLIs. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { test } = require("node:test");

const {
  applyRetentionPlan,
  buildPgDumpArgs,
  buildRestoreArgs,
  parseExportFilename,
  planRetention,
  projectRoot,
  redactCommand,
  resolveOperatorPath,
} = require("../../scripts/postgres-backup-common.js");

const exportScript = path.join(projectRoot(), "scripts", "postgres-export.js");
const restoreScript = path.join(projectRoot(), "scripts", "postgres-restore.js");

function withTemporaryDirectory(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-postgres-backup-"));
  try {
    return callback(directory);
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

test("Postgres CLI commands use a redacted DIRECT_URL and no destructive restore flags", () => {
  const directUrl = "postgresql://operator@redacted.invalid/notebook";
  const dumpArgs = buildPgDumpArgs({
    directUrl,
    format: "custom",
    output: "/secure/postgres-export.dump",
  });
  const restoreArgs = buildRestoreArgs({
    directUrl,
    format: "custom",
    input: "/secure/postgres-export.dump",
  });
  const redacted = redactCommand("pg_dump", dumpArgs, directUrl).join(" ");

  assert.doesNotMatch(redacted, /redacted\.invalid/);
  assert.match(redacted, /<DIRECT_URL>/);
  assert.equal(restoreArgs.includes("--clean"), false);
  assert.equal(restoreArgs.includes("--create"), false);
  assert.ok(restoreArgs.includes("--single-transaction"));
});

test("export dry-run requires explicit output and never prints the direct URL", () => {
  withTemporaryDirectory((directory) => {
    const directUrl = "postgresql://operator@redacted.invalid/notebook";
    const outputPath = path.join(directory, "postgres-export-2026-07-26T12-00-00Z.dump");
    const output = execFileSync(
      process.execPath,
      [exportScript, "--dry-run", "--format", "custom", "--output", outputPath],
      {
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: "postgresql://runtime.invalid/notebook", DIRECT_URL: directUrl },
      },
    );
    const report = JSON.parse(output);

    assert.equal(report.mode, "dry-run");
    assert.equal(report.usesDirectUrl, true);
    assert.equal(report.usesDatabaseUrl, false);
    assert.equal(report.encryption.productionBackupComplete, false);
    assert.doesNotMatch(output, /redacted\.invalid/);
    assert.equal(fs.existsSync(outputPath), false);

    const missingOutput = spawnSync(
      process.execPath,
      [exportScript, "--dry-run", "--format", "custom"],
      {
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: "postgresql://runtime.invalid/notebook", DIRECT_URL: directUrl },
      },
    );
    assert.notEqual(missingOutput.status, 0);
    assert.match(missingOutput.stderr, /output path/);
    assert.doesNotMatch(missingOutput.stderr, /redacted\.invalid/);
  });
});

test("restore dry-run requires an explicit isolated target allowlist and redacts secrets", () => {
  withTemporaryDirectory((directory) => {
    const inputPath = path.join(directory, "postgres-export-2026-07-26T12-00-00Z.dump");
    fs.writeFileSync(inputPath, "operator fixture");
    const directUrl = "postgresql://direct@redacted.invalid/notebook";
    const output = execFileSync(
      process.execPath,
      [
        restoreScript,
        "--dry-run",
        "--format",
        "custom",
        "--input",
        inputPath,
        "--target-project",
        "verification-project",
        "--target-environment",
        "verification",
        "--allow-target",
        "verification-project:verification",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: "postgresql://runtime.invalid/notebook", DIRECT_URL: directUrl },
      },
    );
    const report = JSON.parse(output);

    assert.equal(report.mode, "dry-run");
    assert.equal(report.target.project, "verification-project");
    assert.equal(report.productionTargetAllowed, false);
    assert.equal(report.usesDirectUrl, true);
    assert.doesNotMatch(output, /redacted\.invalid/);
    assert.doesNotMatch(output, /--clean|--create/);
  });
});

test("retention plan keeps daily and weekly slots and only prunes matching export files", () => {
  withTemporaryDirectory((directory) => {
    const files = [
      "postgres-export-2026-07-26T12-00-00Z.dump",
      "postgres-export-2026-07-26T06-00-00Z.dump",
      "postgres-export-2026-07-25T12-00-00Z.dump",
      "postgres-export-2026-07-24T12-00-00Z.dump",
      "postgres-export-2026-07-18T12-00-00Z.dump",
      "postgres-export-2026-07-17T12-00-00Z.dump",
      "postgres-export-2026-07-10T12-00-00Z.dump",
      "postgres-export-2026-07-03T12-00-00Z.dump",
      "unrelated.txt",
    ];
    for (const file of files) fs.writeFileSync(path.join(directory, file), file);

    const parsed = parseExportFilename(files[0]);
    assert.equal(parsed.format, "custom");
    assert.equal(parsed.dateKey, "2026-07-26");

    const plan = planRetention(directory, { daily: 2, weekly: 2 });
    assert.equal(plan.kept.filter((entry) => entry.reason === "daily").length, 2);
    assert.equal(plan.kept.filter((entry) => entry.reason === "weekly").length, 2);
    assert.ok(plan.delete.some((entry) => entry.file === "postgres-export-2026-07-10T12-00-00Z.dump"));
    assert.equal(plan.entries.length, files.length - 1);

    applyRetentionPlan(plan);
    assert.equal(fs.existsSync(path.join(directory, "unrelated.txt")), true);
    assert.equal(fs.existsSync(path.join(directory, "postgres-export-2026-07-26T12-00-00Z.dump")), true);
    assert.equal(fs.existsSync(path.join(directory, "postgres-export-2026-07-25T12-00-00Z.dump")), true);
  });
});

test("operator paths reject repository and Local backup locations", () => {
  assert.throws(
    () => resolveOperatorPath(path.join(projectRoot(), "backup", "postgres-export.dump"), "output"),
    /Local SQLite backup/,
  );
  assert.throws(
    () => resolveOperatorPath(projectRoot(), "output"),
    /repository root/,
  );
});
