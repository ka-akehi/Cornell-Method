/* eslint-disable @typescript-eslint/no-require-imports -- This is a plain Node operator script. */
const {
  loadProjectEnv,
  parseArguments,
  printJson,
  projectRoot,
  readSourceSnapshot,
  reconcileTargetSnapshot,
  requireTargetConfiguration,
  resolveSourcePath,
} = require("./postgres-migration-common.js");

function printHelp() {
  console.log(`Usage: node scripts/postgres-reconcile.js --source /path/to/source.db [options]

Required:
  DIRECT_URL                         Postgres direct connection URL only
  --target-project NAME              explicit non-production target label
  --target-environment NAME          e.g. verification, qa, preview
  --allow-target PROJECT:ENV         exact explicit target authorization

Source path:
  --source PATH                      preferred explicit SQLite path
  SOURCE_SQLITE_PATH=PATH            accepted when --source is omitted

The target allowlist may also be supplied as POSTGRES_TARGET_ALLOWLIST.
The command is read-only; it never overwrites target rows.`);
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const root = projectRoot();
  loadProjectEnv(root);
  const sourcePath = resolveSourcePath(args.source);
  const snapshot = readSourceSnapshot(sourcePath);
  const targetConfiguration = requireTargetConfiguration(args);
  const report = await reconcileTargetSnapshot(snapshot, targetConfiguration);
  printJson({ operation: "reconcile", ...report });
  if (!report.reconciliation.pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "postgres reconcile failed");
  process.exitCode = 1;
});
