/* eslint-disable @typescript-eslint/no-require-imports -- This is an operator-only Node CLI. */
const { printJson, projectRoot } = require("./postgres-migration-common.js");
const {
  applyRetentionPlan,
  assertOperatorOnlyContext,
  loadProjectEnv,
  parseOptionArguments,
  planRetention,
  resolveRetentionDirectory,
} = require("./postgres-backup-common.js");

function printHelp() {
  console.log(`Usage: node scripts/postgres-retention.js --directory /secure/postgres-exports [options]

Required:
  --directory PATH                   explicit operator-managed export directory
  POSTGRES_EXPORT_DIR=PATH           alternative to --directory

Defaults:
  daily=7                           newest file for each of 7 newest UTC dates
  weekly=4                          newest remaining file for each of 4 newest ISO weeks

Options:
  --daily COUNT                      override daily retention count
  --weekly COUNT                     override weekly retention count
  --dry-run                          show every deletion candidate; this is the default
  --apply --confirm-prune             re-check the plan and delete only unchanged candidates
  --help                             show this help

Only files named postgres-export-YYYY-MM-DDTHH-mm-ssZ.sql or .dump are considered.
The command never scans or deletes repository files, backup/, .next/, SQLite files, or Vercel storage.`);
}

function parseArguments(argv) {
  return parseOptionArguments(
    argv,
    new Map([
      ["--daily", "daily"],
      ["--directory", "directory"],
      ["--weekly", "weekly"],
    ]),
    ["--apply", "--confirm-prune", "--dry-run"],
  );
}

function positiveInteger(value, label, fallback) {
  const resolved = value ?? fallback;
  if (!/^\d+$/.test(String(resolved)) || Number(resolved) < 1) {
    throw new Error(`${label} は 1 以上の整数で指定してください`);
  }
  return Number(resolved);
}

function publicEntry(entry, reason) {
  return {
    date: entry.dateKey,
    file: entry.file,
    format: entry.format,
    path: entry.path,
    reason,
    week: entry.weekKey,
  };
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  assertOperatorOnlyContext();
  loadProjectEnv(projectRoot());

  const directory = resolveRetentionDirectory(
    args.directory ?? process.env.POSTGRES_EXPORT_DIR,
  );
  const daily = positiveInteger(args.daily, "daily retention", process.env.POSTGRES_RETENTION_DAILY ?? 7);
  const weekly = positiveInteger(args.weekly, "weekly retention", process.env.POSTGRES_RETENTION_WEEKLY ?? 4);
  const apply = args.apply === true;
  if (apply && args.dry_run === true) {
    throw new Error("--apply と --dry-run は同時に指定できません");
  }
  if (args.confirm_prune === true && !apply) {
    throw new Error("--confirm-prune は --apply と組み合わせてください");
  }
  if (apply && args.confirm_prune !== true) {
    throw new Error("削除には --apply --confirm-prune の両方が必要です");
  }

  const plan = planRetention(directory, { daily, weekly });
  if (!apply) {
    printJson({
      daily,
      directory,
      delete: plan.delete.map((entry) => publicEntry(entry, "prune")),
      kept: plan.kept.map((entry) => publicEntry(entry, entry.reason)),
      mode: "dry-run",
      policy: "daily 7 generations + weekly 4 generations by filename UTC date",
      weekly,
    });
    return;
  }

  applyRetentionPlan(plan);
  printJson({
    daily,
    directory,
    deleted: plan.delete.map((entry) => publicEntry(entry, "deleted")),
    kept: plan.kept.map((entry) => publicEntry(entry, entry.reason)),
    mode: "apply",
    policy: "daily 7 generations + weekly 4 generations by filename UTC date",
    weekly,
  });
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "postgres retention failed");
  process.exitCode = 1;
}
