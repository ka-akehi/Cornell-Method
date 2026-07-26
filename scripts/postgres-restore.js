/* eslint-disable @typescript-eslint/no-require-imports -- This is an operator-only Node CLI. */
const {
  assertRestoreTargetBlank,
  connectPostgres,
  loadProjectEnv,
  printJson,
  projectRoot,
  readSourceSnapshot,
  reconcileTargetSnapshot,
  requireTargetConfiguration,
  resolveDirectUrl,
  resolveSourcePath,
} = require("./postgres-migration-common.js");
const {
  assertOperatorOnlyContext,
  buildRestoreArgs,
  commandAvailable,
  parseOptionArguments,
  redactCommand,
  resolveExistingExport,
  resolveFormat,
  runExternalCommand,
} = require("./postgres-backup-common.js");

function printHelp() {
  console.log(`Usage: node scripts/postgres-restore.js --format plain|custom --input /secure/path/postgres-export-YYYY-MM-DDTHH-mm-ssZ.sql [options]

Required for a real restore:
  DIRECT_URL                         isolated target direct connection URL only
  --target-project NAME              explicit isolated target project label
  --target-environment NAME          non-Production environment label
  --allow-target PROJECT:ENV         exact POSTGRES_TARGET_ALLOWLIST authorization
  --confirm-isolated-target          explicit operator assertion for isolated target
  --confirm-empty-target             explicit operator assertion before target preflight
  --source PATH                      frozen SQLite source for mandatory T2 reconcile

Input:
  --input PATH                       preferred explicit export path
  POSTGRES_EXPORT_PATH=PATH          alternative to --input
  --format plain|custom              dump format; must match the export workflow
  POSTGRES_EXPORT_FORMAT=FORMAT      alternative to --format

Options:
  --dry-run                          validate target labels and command construction without DB or restore
  --help                             show this help

Restore is single-transaction and never uses --clean, --create, DATABASE_URL, runtime pooler,
Vercel request context, repository paths, backup/, .next/, or Production target labels.
After restore, the frozen source is reconciled for counts, IDs/FKs, scalar fields, Canvas JSON,
geometry, and searchText. A separate isolated-app CRUD smoke is still required.`);
}

function parseArguments(argv) {
  return parseOptionArguments(
    argv,
    new Map([
      ["--format", "format"],
      ["--input", "input"],
      ["--source", "source"],
      ["--allow-target", "allowTarget"],
      ["--target-environment", "targetEnvironment"],
      ["--target-project", "targetProject"],
    ]),
    [
      "--confirm-empty-target",
      "--confirm-isolated-target",
      "--dry-run",
    ],
  );
}

async function assertBlankTarget(targetConfiguration) {
  const { client, pool } = await connectPostgres(targetConfiguration.directUrl);
  try {
    await assertRestoreTargetBlank(client);
  } finally {
    client.release();
    await pool.end();
  }
}

async function runRestore({ args, directUrl, format, input, snapshot, targetConfiguration }) {
  const restoreCommand = format === "plain" ? "psql" : "pg_restore";
  if (!commandAvailable(restoreCommand)) {
    throw new Error(`${restoreCommand} が見つかりません。PostgreSQL client tools を operator 環境へ用意してください`);
  }
  await assertBlankTarget(targetConfiguration);

  runExternalCommand(
    restoreCommand,
    buildRestoreArgs({ directUrl, format, input }),
    restoreCommand,
  );

  const reconciliationReport = await reconcileTargetSnapshot(snapshot, targetConfiguration);
  return {
    ...reconciliationReport,
    format,
    input,
    operation: "restore",
    restore: {
      command: restoreCommand,
      existingSchemaPreflight: "blank passed",
      transaction: "single-transaction",
      productionTargetAllowed: false,
      targetConfirmations: {
        isolated: args.confirm_isolated_target === true,
        empty: args.confirm_empty_target === true,
      },
    },
    recoveryVerified: reconciliationReport.reconciliation.pass,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  assertOperatorOnlyContext();
  loadProjectEnv(projectRoot());

  const format = resolveFormat(args.format);
  const directUrl = resolveDirectUrl();
  const input = resolveExistingExport(args.input ?? process.env.POSTGRES_EXPORT_PATH);
  if (!input.endsWith(format === "plain" ? ".sql" : ".dump")) {
    throw new Error(`--format ${format} の input は対応する export 拡張子を指定してください`);
  }

  const targetConfiguration = requireTargetConfiguration(args);
  const restoreCommand = format === "plain" ? "psql" : "pg_restore";
  const commandArgs = buildRestoreArgs({ directUrl, format, input });

  if (args.dry_run === true) {
    const hasSource = args.source ?? process.env.SOURCE_SQLITE_PATH;
    printJson({
      command: redactCommand(restoreCommand, commandArgs, directUrl),
      format,
      input,
      mode: "dry-run",
      productionTargetAllowed: false,
      reconcile: hasSource ? "would run with explicit source" : "requires --source for real restore",
      target: {
        environment: targetConfiguration.target.environment,
        project: targetConfiguration.target.project,
      },
      targetPreflight: "required: blank isolated database; destructive restore flags disabled",
      usesDatabaseUrl: false,
      usesDirectUrl: true,
      cliAvailable: commandAvailable(restoreCommand),
    });
    return;
  }

  if (args.confirm_isolated_target !== true || args.confirm_empty_target !== true) {
    throw new Error(
      "restore には --confirm-isolated-target と --confirm-empty-target の両方が必要です",
    );
  }

  const sourcePath = resolveSourcePath(args.source);
  const snapshot = readSourceSnapshot(sourcePath);
  const result = await runRestore({
    args,
    directUrl,
    format,
    input,
    snapshot,
    targetConfiguration,
  });
  printJson(result);
  if (!result.recoveryVerified) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "postgres restore failed");
  process.exitCode = 1;
});
