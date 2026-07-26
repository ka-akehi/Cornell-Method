/* eslint-disable @typescript-eslint/no-require-imports -- This is an operator-only Node CLI. */
const fs = require("node:fs");

const { printJson } = require("./postgres-migration-common.js");
const {
  assertOperatorOnlyContext,
  buildPgDumpArgs,
  cleanupPendingOutput,
  commandAvailable,
  createPendingOutput,
  extensionForFormat,
  loadProjectEnv,
  parseOptionArguments,
  projectRoot,
  redactCommand,
  resolveDirectUrl,
  resolveExportOutput,
  resolveFormat,
  runExternalCommand,
} = require("./postgres-backup-common.js");

function printHelp() {
  console.log(`Usage: node scripts/postgres-export.js --format plain|custom --output /secure/path/postgres-export-YYYY-MM-DDTHH-mm-ssZ.sql [options]

Required:
  DIRECT_URL                         PostgreSQL direct connection URL only
  --format plain|custom              logical export format; no implicit default
  --output PATH                      explicit operator-managed output path
  --allow-unencrypted-staging        acknowledge that this file is not a completed production backup

Options:
  POSTGRES_EXPORT_PATH=PATH          alternative to --output
  POSTGRES_EXPORT_FORMAT=FORMAT      alternative to --format
  --overwrite                        explicitly allow replacing an existing output file
  --dry-run                          validate inputs and command construction without pg_dump or DB access
  --help                             show this help

The command uses DIRECT_URL only. DATABASE_URL, runtime pooler URLs, Vercel request context,
repository paths, backup/, .next/, and Vercel filesystems are not used as backup storage.
The generated staging file is unencrypted; encrypt and copy it to operator-managed off-site storage
before treating a Production backup as complete.`);
}

function parseArguments(argv) {
  return parseOptionArguments(
    argv,
    new Map([
      ["--format", "format"],
      ["--output", "output"],
    ]),
    ["--allow-unencrypted-staging", "--dry-run", "--overwrite"],
  );
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  assertOperatorOnlyContext();
  loadProjectEnv(projectRoot());

  const format = resolveFormat(args.format);
  const directUrl = resolveDirectUrl();
  const outputValue = args.output ?? process.env.POSTGRES_EXPORT_PATH;
  const output = resolveExportOutput(outputValue, { overwrite: args.overwrite === true });
  const expectedExtension = extensionForFormat(format);
  if (!output.endsWith(expectedExtension)) {
    throw new Error(`--format ${format} の output は ${expectedExtension} で終わる明示 path を指定してください`);
  }

  const command = "pg_dump";
  const commandArgs = buildPgDumpArgs({ directUrl, format, output });
  const plan = {
    command: redactCommand(command, commandArgs, directUrl),
    format,
    mode: args.dry_run === true ? "dry-run" : "export",
    output,
    usesDatabaseUrl: false,
    usesDirectUrl: true,
  };

  if (args.dry_run === true) {
    printJson({
      ...plan,
      cliAvailable: commandAvailable(command),
      encryption: {
        encrypted: false,
        productionBackupComplete: false,
        requiredBeforeCompletion: true,
      },
    });
    return;
  }

  if (
    args.allow_unencrypted_staging !== true &&
    process.env.POSTGRES_ALLOW_UNENCRYPTED_STAGING !== "1"
  ) {
    throw new Error(
      "この export は暗号化前の staging file です。実行意図を確認し --allow-unencrypted-staging を明示してください",
    );
  }

  const pending = createPendingOutput(output);
  try {
    runExternalCommand(
      command,
      buildPgDumpArgs({ directUrl, format, output: pending.pendingPath }),
      "pg_dump",
    );

    const stats = fs.statSync(pending.pendingPath);
    if (!stats.isFile() || stats.size === 0) {
      throw new Error("pg_dump が空の export file を生成しました");
    }

    fs.renameSync(pending.pendingPath, output);
    cleanupPendingOutput(pending.pendingDirectory);
    printJson({
      ...plan,
      bytes: stats.size,
      encryption: {
        encrypted: false,
        productionBackupComplete: false,
        requiredBeforeCompletion: true,
      },
      nextStep: "operator-managed encryption and off-site copy are required before Production backup completion",
    });
  } catch (error) {
    cleanupPendingOutput(pending.pendingDirectory);
    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "postgres export failed");
  process.exitCode = 1;
}
