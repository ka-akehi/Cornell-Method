/* eslint-disable @typescript-eslint/no-require-imports -- This is a plain Node operator script. */
const {
  assertPostgresBaseline,
  assertSourceUnchanged,
  assertTargetEmpty,
  buildInventory,
  connectPostgres,
  fetchTargetRows,
  insertSourceRows,
  loadProjectEnv,
  lockTargetTables,
  parseArguments,
  printJson,
  projectRoot,
  readSourceSnapshot,
  reconcileRows,
  requireTargetConfiguration,
  resolveSourcePath,
} = require("./postgres-migration-common.js");

function printHelp() {
  console.log(`Usage: node scripts/postgres-import.js --source /path/to/source.db [options]

Required for a real import:
  DIRECT_URL                         Postgres direct connection URL only
  --target-project NAME              explicit non-production target label
  --target-environment NAME          e.g. verification, qa, preview
  --allow-target PROJECT:ENV         exact explicit target authorization

Source path:
  --source PATH                      preferred explicit SQLite path
  SOURCE_SQLITE_PATH=PATH            accepted when --source is omitted

Options:
  --dry-run                          source freeze/schema/inventory only; no Postgres connection
  --help                             show this help

The target allowlist may also be supplied as POSTGRES_TARGET_ALLOWLIST.
DATABASE_URL, runtime pooler URLs, and Production labels are rejected.`);
}

function sourceReport(snapshot) {
  return {
    source: snapshot.source,
    sourceInventory: buildInventory(snapshot.rows),
    sourceSchema: snapshot.schema,
  };
}

async function runImport(snapshot, targetConfiguration) {
  const { client, pool } = await connectPostgres(targetConfiguration.directUrl);
  let transactionStarted = false;
  let committed = false;

  try {
    await assertPostgresBaseline(client);
    assertSourceUnchanged(snapshot);

    await client.query("BEGIN");
    transactionStarted = true;
    await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await lockTargetTables(client);
    await assertTargetEmpty(client);

    try {
      await insertSourceRows(client, snapshot.rows);
    } catch {
      throw new Error("target row insert に失敗しました。transaction は rollback されます");
    }

    assertSourceUnchanged(snapshot);
    const targetRows = await fetchTargetRows(client);
    const reconciliation = reconcileRows(snapshot.rows, targetRows);
    if (!reconciliation.pass) {
      throw new Error("commit 前 reconciliation が不一致です。transaction は rollback されます");
    }
    assertSourceUnchanged(snapshot);

    await client.query("COMMIT");
    committed = true;
    return {
      ...sourceReport(snapshot),
      operation: "import",
      reconciliation,
      target: {
        environment: targetConfiguration.target.environment,
        inventory: buildInventory(targetRows),
        project: targetConfiguration.target.project,
      },
      transaction: "committed",
    };
  } catch (error) {
    if (transactionStarted && !committed) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // The original safe error is more useful; the database has not been
        // reported as successfully imported when rollback itself is unavailable.
      }
    }
    if (error instanceof Error && /reconciliation|row insert/.test(error.message)) {
      throw error;
    }
    throw new Error("Postgres import transaction が失敗しました。target は import 完了扱いにしていません");
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const root = projectRoot();
  if (!args.dryRun) {
    loadProjectEnv(root);
  }
  const sourcePath = resolveSourcePath(args.source);
  const snapshot = readSourceSnapshot(sourcePath);

  if (args.dryRun) {
    printJson({
      ...sourceReport(snapshot),
      mode: "dry-run",
      target: "not connected",
    });
    return;
  }

  const targetConfiguration = requireTargetConfiguration(args);
  printJson(await runImport(snapshot, targetConfiguration));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "postgres import failed");
  process.exitCode = 1;
});
