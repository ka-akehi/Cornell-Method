/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");

const {
  DESKTOP_APPLICATION_ID,
  DESKTOP_DATABASE_INITIALIZATION_MARKER_CONTENT,
  DESKTOP_DATABASE_INITIALIZATION_MARKER_INVALID_REASON,
  DESKTOP_DATABASE_INITIALIZATION_MARKER_NAME,
  DESKTOP_DATABASE_MISSING_AFTER_INITIALIZATION_REASON,
  DESKTOP_DATABASE_STATUS,
  DESKTOP_MIGRATION_STATE,
  DESKTOP_STORAGE_LAYOUT,
  bootstrapDesktopStorage,
  createDesktopSidecarDatabaseEnvironment,
  inspectDesktopDatabase,
  readMigrationManifest,
  resolveDesktopStoragePaths,
} = require("../../src/server/infrastructure/desktop-storage.js");

const projectRoot = path.resolve(__dirname, "../..");
const sqliteBinary = process.env.SQLITE3_BIN ?? "sqlite3";
const sqliteCliAvailable = hasSqliteCli();

function hasSqliteCli() {
  try {
    execFileSync(sqliteBinary, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getUsableBetterSqlite3() {
  let Database;
  try {
    Database = require("better-sqlite3");
  } catch {
    return null;
  }

  try {
    const database = new Database(":memory:");
    database.close();
  } catch {
    return null;
  }

  return Database;
}

function createLoggingSqliteBinary(homeDirectory, logPath) {
  const binaryPath = path.join(homeDirectory, "logging-sqlite.js");
  fs.writeFileSync(
    binaryPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(args) + "\\n");
const result = spawnSync(
  ${JSON.stringify(sqliteBinary)},
  args,
  { encoding: "utf8" },
);
if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}
process.exit(result.error ? 1 : result.status ?? 1);
`,
    { mode: 0o755 },
  );
  fs.chmodSync(binaryPath, 0o755);
  return binaryPath;
}

function readLoggedSql(logPath) {
  if (!fs.existsSync(logPath)) {
    return [];
  }

  return fs
    .readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line).at(-1))
    .filter((sql) => typeof sql === "string" && sql !== "-version");
}

function captureSqliteQueries(homeDirectory, callback) {
  const Database = getUsableBetterSqlite3();
  if (Database === null) {
    const logPath = path.join(homeDirectory, "sqlite-query.log");
    const loggingSqliteBinary = createLoggingSqliteBinary(
      homeDirectory,
      logPath,
    );
    return {
      result: callback(loggingSqliteBinary),
      queries: readLoggedSql(logPath),
    };
  }

  const originalPrepare = Database.prototype.prepare;
  const queries = [];
  Database.prototype.prepare = function prepareWithTrace(sql) {
    queries.push(sql);
    return originalPrepare.call(this, sql);
  };

  try {
    return { result: callback(sqliteBinary), queries };
  } finally {
    Database.prototype.prepare = originalPrepare;
  }
}

function isFullIntegrityCheck(sql) {
  return /^\s*PRAGMA\s+(?:integrity_check|foreign_key_check)\b/i.test(sql);
}

function createTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cornell-desktop-storage-"));
}

function withTempHome(callback) {
  const homeDirectory = createTempHome();

  try {
    return callback(homeDirectory);
  } finally {
    fs.rmSync(homeDirectory, { recursive: true, force: true });
  }
}

function sqlite(databasePath, sql) {
  execFileSync(sqliteBinary, [databasePath, sql], { stdio: "ignore" });
}

function fileDigest(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function initializationMarkerPath(homeDirectory) {
  const paths = resolveDesktopStoragePaths({ homeDirectory });
  return path.join(
    paths.settingsDirectory,
    DESKTOP_DATABASE_INITIALIZATION_MARKER_NAME,
  );
}

function createFakePrismaBinary(homeDirectory) {
  const binaryPath = path.join(homeDirectory, "fake-prisma.js");
  fs.writeFileSync(
    binaryPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const mode = process.env.FAKE_PRISMA_MODE;
fs.appendFileSync(process.env.FAKE_PRISMA_LOG, String(mode) + "\\n");

if (mode === "fail") {
  process.exit(17);
}

if (mode === "write-and-fail") {
  fs.writeFileSync(
    process.env.DATABASE_URL.slice("file:".length),
    "migration wrote data",
  );
  process.exit(19);
}

const result = spawnSync(
  process.env.FAKE_REAL_PRISMA_BINARY,
  process.argv.slice(2),
  { env: process.env, stdio: "ignore" },
);
process.exit(result.error ? 1 : result.status ?? 1);
`,
    { mode: 0o755 },
  );
  fs.chmodSync(binaryPath, 0o755);
  return binaryPath;
}

function bootstrapReadyDatabase(homeDirectory) {
  const result = bootstrapDesktopStorage({
    homeDirectory,
    sqliteBinary,
  });
  assert.equal(result.status, DESKTOP_DATABASE_STATUS.READY);
  assert.equal(result.created, true);
  return result;
}

test("resolves the approved Application Support layout without creating it", () => {
  withTempHome((homeDirectory) => {
    const paths = resolveDesktopStoragePaths({ homeDirectory });
    const inspection = inspectDesktopDatabase({
      homeDirectory,
      sqliteBinary,
    });

    assert.equal(paths.applicationId, DESKTOP_APPLICATION_ID);
    assert.equal(
      paths.root,
      path.join(
        homeDirectory,
        "Library",
        "Application Support",
        DESKTOP_APPLICATION_ID,
      ),
    );
    assert.equal(paths.liveDirectory, path.join(paths.root, "live"));
    assert.equal(
      paths.databasePath,
      path.join(paths.root, DESKTOP_STORAGE_LAYOUT.database),
    );
    assert.equal(paths.backupsDirectory, path.join(paths.root, "backups"));
    assert.equal(paths.settingsDirectory, path.join(paths.root, "settings"));
    assert.equal(paths.logsDirectory, path.join(paths.root, "logs"));
    assert.equal(
      paths.pendingRestoreDirectory,
      path.join(paths.root, "pending-restore"),
    );
    assert.equal(fs.existsSync(paths.root), false);
    assert.equal(
      inspection.status,
      DESKTOP_DATABASE_STATUS.INITIALIZATION_REQUIRED,
    );
  });
});

test("initializes the live SQLite database from the current migrations", () => {
  withTempHome((homeDirectory) => {
    const result = bootstrapReadyDatabase(homeDirectory);
    const migrationNames = readMigrationManifest(
      path.join(projectRoot, "prisma", "migrations"),
    ).map((migration) => migration.name);

    assert.equal(fs.existsSync(result.databasePath), true);
    const markerPath = initializationMarkerPath(homeDirectory);
    assert.equal(fs.statSync(markerPath).isFile(), true);
    assert.deepEqual(
      fs.readFileSync(markerPath, "utf8"),
      DESKTOP_DATABASE_INITIALIZATION_MARKER_CONTENT,
    );
    assert.deepEqual(result.appliedMigrations, migrationNames);
    assert.equal(result.migrationState, DESKTOP_MIGRATION_STATE.COMPLETE);
    for (const directoryPath of [
      result.liveDirectory,
      result.backupsDirectory,
      result.settingsDirectory,
      result.logsDirectory,
      result.pendingRestoreDirectory,
    ]) {
      assert.equal(fs.statSync(directoryPath).isDirectory(), true);
    }
  });
});

test("retries initial migration after a claimed empty database migration fails", () => {
  withTempHome((homeDirectory) => {
    const paths = resolveDesktopStoragePaths({ homeDirectory });
    const fakePrismaBinary = createFakePrismaBinary(homeDirectory);
    const migrationLog = path.join(homeDirectory, "migration.log");
    const migrationOptions = {
      homeDirectory,
      sqliteBinary,
      prismaBinary: fakePrismaBinary,
      prismaConfigPath: path.join(projectRoot, "prisma.config.ts"),
      prismaProjectRoot: projectRoot,
      environment: {
        ...process.env,
        FAKE_PRISMA_LOG: migrationLog,
        FAKE_REAL_PRISMA_BINARY: path.join(
          projectRoot,
          "node_modules",
          ".bin",
          "prisma",
        ),
      },
    };

    assert.throws(
      () =>
        bootstrapDesktopStorage({
          ...migrationOptions,
          environment: {
            ...migrationOptions.environment,
            FAKE_PRISMA_MODE: "fail",
          },
        }),
      (error) => error.code === "INITIAL_MIGRATION_FAILED",
    );
    assert.equal(fs.existsSync(paths.databasePath), false);
    assert.equal(fs.existsSync(initializationMarkerPath(homeDirectory)), false);
    assert.equal(
      inspectDesktopDatabase({ homeDirectory, sqliteBinary }).status,
      DESKTOP_DATABASE_STATUS.INITIALIZATION_REQUIRED,
    );

    const retry = bootstrapDesktopStorage({
      ...migrationOptions,
      environment: {
        ...migrationOptions.environment,
        FAKE_PRISMA_MODE: "success",
      },
    });

    assert.equal(retry.status, DESKTOP_DATABASE_STATUS.READY);
    assert.equal(retry.created, true);
    assert.deepEqual(fs.readFileSync(migrationLog, "utf8").trim().split("\n"), [
      "fail",
      "success",
    ]);
  });
});

test("keeps a migration-written database for recovery after process failure", () => {
  withTempHome((homeDirectory) => {
    const paths = resolveDesktopStoragePaths({ homeDirectory });
    const fakePrismaBinary = createFakePrismaBinary(homeDirectory);
    const migrationOptions = {
      homeDirectory,
      sqliteBinary,
      prismaBinary: fakePrismaBinary,
      prismaConfigPath: path.join(projectRoot, "prisma.config.ts"),
      prismaProjectRoot: projectRoot,
      environment: {
        ...process.env,
        FAKE_PRISMA_LOG: path.join(homeDirectory, "migration.log"),
        FAKE_PRISMA_MODE: "write-and-fail",
      },
    };

    assert.throws(
      () => bootstrapDesktopStorage(migrationOptions),
      (error) => error.code === "INITIAL_MIGRATION_FAILED",
    );

    const failedContent = Buffer.from("migration wrote data", "utf8");
    assert.deepEqual(fs.readFileSync(paths.databasePath), failedContent);
    assert.equal(fs.existsSync(initializationMarkerPath(homeDirectory)), false);

    const result = bootstrapDesktopStorage(migrationOptions);
    assert.equal(result.status, DESKTOP_DATABASE_STATUS.UNUSABLE);
    assert.equal(result.created, false);
    assert.deepEqual(fs.readFileSync(paths.databasePath), failedContent);
  });
});

test("passes only the absolute SQLite URL at the sidecar database boundary", () => {
  withTempHome((homeDirectory) => {
    const paths = resolveDesktopStoragePaths({ homeDirectory });
    const environment = createDesktopSidecarDatabaseEnvironment(paths);

    assert.equal(environment.DATABASE_URL, `file:${paths.databasePath}`);
    assert.equal(path.isAbsolute(environment.DATABASE_URL.slice("file:".length)), true);
    assert.equal(environment.PRISMA_PROVIDER, "sqlite");
    assert.deepEqual(Object.keys(environment).sort(), [
      "DATABASE_URL",
      "PRISMA_PROVIDER",
    ]);
  });
});

test("does not change an existing ready database on bootstrap rerun", {
  skip: !sqliteCliAvailable,
}, () => {
  withTempHome((homeDirectory) => {
    const first = bootstrapReadyDatabase(homeDirectory);
    sqlite(
      first.databasePath,
      `INSERT INTO notebooks
        (id, title, note_date, source_title, body, body_mode, summary, created_at, updated_at)
       VALUES ('preserved-note', 'Preserved title', '2026-08-17', '', '', 'markdown', '',
               '2026-08-17T00:00:00.000Z', '2026-08-17T00:00:00.000Z');`,
    );
    const beforeDigest = fileDigest(first.databasePath);

    const second = bootstrapDesktopStorage({
      homeDirectory,
      sqliteBinary,
    });

    assert.equal(second.status, DESKTOP_DATABASE_STATUS.READY);
    assert.equal(second.created, false);
    assert.equal(fileDigest(second.databasePath), beforeDigest);
    assert.equal(
      Number(
        execFileSync(
          sqliteBinary,
          [
            second.databasePath,
            "SELECT COUNT(*) FROM notebooks WHERE id = 'preserved-note';",
          ],
          { encoding: "utf8" },
        ).trim(),
      ),
      1,
    );
  });
});

test("skips detailed integrity checks during lightweight bootstrap inspection", {
  skip: !sqliteCliAvailable,
}, () => {
  withTempHome((homeDirectory) => {
    const ready = bootstrapReadyDatabase(homeDirectory);
    sqlite(
      ready.databasePath,
      `PRAGMA foreign_keys = OFF;
       INSERT INTO notebook_tags (notebook_id, tag_id, "order")
       VALUES ('missing-notebook', 'missing-tag', 0);`,
    );

    const lightweightBootstrapRun = captureSqliteQueries(
      homeDirectory,
      (inspectionSqliteBinary) =>
        bootstrapDesktopStorage({
          homeDirectory,
          sqliteBinary: inspectionSqliteBinary,
        }),
    );
    const lightweightBootstrap = lightweightBootstrapRun.result;
    const lightweightInspection = inspectDesktopDatabase({
      homeDirectory,
      sqliteBinary,
      integrityCheck: false,
    });
    const detailedInspectionRun = captureSqliteQueries(
      homeDirectory,
      (inspectionSqliteBinary) =>
        inspectDesktopDatabase({
          homeDirectory,
          sqliteBinary: inspectionSqliteBinary,
          integrityCheck: true,
        }),
    );
    const detailedInspection = detailedInspectionRun.result;
    const defaultInspection = inspectDesktopDatabase({
      homeDirectory,
      sqliteBinary,
    });

    assert.equal(lightweightBootstrap.status, DESKTOP_DATABASE_STATUS.READY);
    assert.equal(lightweightBootstrap.created, false);
    assert.equal(lightweightInspection.status, DESKTOP_DATABASE_STATUS.READY);
    assert.equal(
      detailedInspection.status,
      DESKTOP_DATABASE_STATUS.UNUSABLE,
    );
    assert.equal(detailedInspection.reason, "foreign-key-check-failed");
    assert.equal(defaultInspection.status, DESKTOP_DATABASE_STATUS.UNUSABLE);
    assert.equal(defaultInspection.reason, "foreign-key-check-failed");

    assert.deepEqual(
      lightweightBootstrapRun.queries.filter(isFullIntegrityCheck),
      [],
    );
    assert.deepEqual(
      detailedInspectionRun.queries.filter(isFullIntegrityCheck),
      ["PRAGMA integrity_check", "PRAGMA foreign_key_check"],
    );
  });
});

test("creates the marker for a pre-marker ready database without changing it", {
  skip: !sqliteCliAvailable,
}, () => {
  withTempHome((homeDirectory) => {
    const first = bootstrapReadyDatabase(homeDirectory);
    const markerPath = initializationMarkerPath(homeDirectory);
    fs.unlinkSync(markerPath);
    const beforeDigest = fileDigest(first.databasePath);

    const result = bootstrapDesktopStorage({
      homeDirectory,
      sqliteBinary,
    });

    assert.equal(result.status, DESKTOP_DATABASE_STATUS.READY);
    assert.equal(result.created, false);
    assert.equal(fileDigest(result.databasePath), beforeDigest);
    assert.deepEqual(
      fs.readFileSync(markerPath, "utf8"),
      DESKTOP_DATABASE_INITIALIZATION_MARKER_CONTENT,
    );
  });
});

test("stops recovery when the marker remains after the live database disappears", () => {
  withTempHome((homeDirectory) => {
    const ready = bootstrapReadyDatabase(homeDirectory);
    const paths = resolveDesktopStoragePaths({ homeDirectory });
    const markerPath = initializationMarkerPath(homeDirectory);
    const backupPath = path.join(paths.backupsDirectory, "notebook.sqlite.bak");
    const settingsPath = path.join(paths.settingsDirectory, "user-settings.json");
    const backupContent = Buffer.from("backup preserved", "utf8");
    const settingsContent = Buffer.from("settings preserved", "utf8");
    const fakePrismaBinary = createFakePrismaBinary(homeDirectory);
    const migrationLog = path.join(homeDirectory, "migration.log");

    fs.writeFileSync(backupPath, backupContent, { flag: "wx" });
    fs.writeFileSync(settingsPath, settingsContent, { flag: "wx" });
    fs.unlinkSync(ready.databasePath);

    const result = bootstrapDesktopStorage({
      homeDirectory,
      sqliteBinary,
      prismaBinary: fakePrismaBinary,
      environment: {
        ...process.env,
        FAKE_PRISMA_LOG: migrationLog,
        FAKE_PRISMA_MODE: "success",
      },
    });

    assert.equal(result.status, DESKTOP_DATABASE_STATUS.UNUSABLE);
    assert.equal(
      result.reason,
      DESKTOP_DATABASE_MISSING_AFTER_INITIALIZATION_REASON,
    );
    assert.equal(result.created, false);
    assert.equal(fs.existsSync(paths.databasePath), false);
    assert.deepEqual(
      fs.readFileSync(markerPath, "utf8"),
      DESKTOP_DATABASE_INITIALIZATION_MARKER_CONTENT,
    );
    assert.deepEqual(fs.readFileSync(backupPath), backupContent);
    assert.deepEqual(fs.readFileSync(settingsPath), settingsContent);
    assert.equal(fs.existsSync(migrationLog), false);
  });
});

test("fails closed for an invalid initialization marker without changing the database", {
  skip: !sqliteCliAvailable,
}, () => {
  withTempHome((homeDirectory) => {
    const ready = bootstrapReadyDatabase(homeDirectory);
    const markerPath = initializationMarkerPath(homeDirectory);
    fs.unlinkSync(markerPath);
    fs.writeFileSync(markerPath, "invalid marker", { flag: "wx" });
    const beforeDigest = fileDigest(ready.databasePath);

    const result = bootstrapDesktopStorage({
      homeDirectory,
      sqliteBinary,
    });

    assert.equal(result.status, DESKTOP_DATABASE_STATUS.UNUSABLE);
    assert.equal(
      result.reason,
      DESKTOP_DATABASE_INITIALIZATION_MARKER_INVALID_REASON,
    );
    assert.equal(fileDigest(result.databasePath), beforeDigest);
    assert.equal(fs.readFileSync(markerPath, "utf8"), "invalid marker");
  });
});

test("fails closed when the initialization marker is not a regular file", {
  skip: !sqliteCliAvailable,
}, () => {
  withTempHome((homeDirectory) => {
    const ready = bootstrapReadyDatabase(homeDirectory);
    const markerPath = initializationMarkerPath(homeDirectory);
    fs.unlinkSync(markerPath);
    fs.mkdirSync(markerPath);
    const beforeDigest = fileDigest(ready.databasePath);

    const result = bootstrapDesktopStorage({
      homeDirectory,
      sqliteBinary,
    });

    assert.equal(result.status, DESKTOP_DATABASE_STATUS.UNUSABLE);
    assert.equal(
      result.reason,
      DESKTOP_DATABASE_INITIALIZATION_MARKER_INVALID_REASON,
    );
    assert.equal(fileDigest(result.databasePath), beforeDigest);
    assert.equal(fs.statSync(markerPath).isDirectory(), true);
  });
});

test("distinguishes a database with a missing migration and does not apply it", {
  skip: !sqliteCliAvailable,
}, () => {
  withTempHome((homeDirectory) => {
    const ready = bootstrapReadyDatabase(homeDirectory);
    const migrations = readMigrationManifest(
      path.join(projectRoot, "prisma", "migrations"),
    );
    const lastMigration = migrations.at(-1).name;
    sqlite(
      ready.databasePath,
      `DELETE FROM _prisma_migrations WHERE migration_name = '${lastMigration}';`,
    );
    const beforeDigest = fileDigest(ready.databasePath);

    const result = bootstrapDesktopStorage({
      homeDirectory,
      sqliteBinary,
    });

    assert.equal(result.status, DESKTOP_DATABASE_STATUS.MIGRATION_REQUIRED);
    assert.equal(result.migrationState, DESKTOP_MIGRATION_STATE.MISSING);
    assert.deepEqual(result.pendingMigrations, [lastMigration]);
    assert.equal(result.created, false);
    assert.equal(fileDigest(result.databasePath), beforeDigest);
  });
});

test("distinguishes an unfinished migration and does not repair it", {
  skip: !sqliteCliAvailable,
}, () => {
  withTempHome((homeDirectory) => {
    const ready = bootstrapReadyDatabase(homeDirectory);
    const migrations = readMigrationManifest(
      path.join(projectRoot, "prisma", "migrations"),
    );
    const lastMigration = migrations.at(-1).name;
    sqlite(
      ready.databasePath,
      `UPDATE _prisma_migrations
       SET finished_at = NULL
       WHERE migration_name = '${lastMigration}';`,
    );
    const beforeDigest = fileDigest(ready.databasePath);

    const result = inspectDesktopDatabase({
      homeDirectory,
      sqliteBinary,
    });

    assert.equal(result.status, DESKTOP_DATABASE_STATUS.MIGRATION_REQUIRED);
    assert.equal(result.migrationState, DESKTOP_MIGRATION_STATE.INCOMPLETE);
    assert.equal(result.reason, "migration-incomplete");
    assert.equal(fileDigest(result.databasePath), beforeDigest);
  });
});

test("classifies a corrupt existing file as unusable and never overwrites it", () => {
  withTempHome((homeDirectory) => {
    const paths = resolveDesktopStoragePaths({ homeDirectory });
    fs.mkdirSync(paths.liveDirectory, { recursive: true });
    const content = Buffer.from("not a sqlite database", "utf8");
    fs.writeFileSync(paths.databasePath, content, { flag: "wx" });

    const result = bootstrapDesktopStorage({
      homeDirectory,
      sqliteBinary,
    });

    assert.equal(result.status, DESKTOP_DATABASE_STATUS.UNUSABLE);
    assert.equal(result.available, false);
    assert.equal(result.requiresInitialization, false);
    assert.deepEqual(fs.readFileSync(paths.databasePath), content);
  });
});
