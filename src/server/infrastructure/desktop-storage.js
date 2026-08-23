/* eslint-disable @typescript-eslint/no-require-imports -- This boundary is also loaded by the Node.js sidecar. */
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const DESKTOP_APPLICATION_ID = "com.cornellmethod.notebook";
const DESKTOP_DATABASE_INITIALIZATION_MARKER_NAME = ".database-initialized";
const DESKTOP_DATABASE_INITIALIZATION_MARKER_CONTENT = "v1\n";
const DESKTOP_DATABASE_MISSING_AFTER_INITIALIZATION_REASON =
  "database-missing-after-initialization";
const DESKTOP_DATABASE_INITIALIZATION_MARKER_INVALID_REASON =
  "database-initialization-marker-invalid";
const DESKTOP_STORAGE_LAYOUT = Object.freeze({
  root: ".",
  live: "live",
  database: path.join("live", "notebook.sqlite"),
  backups: "backups",
  settings: "settings",
  logs: "logs",
  pendingRestore: "pending-restore",
});
const DESKTOP_DATABASE_STATUS = Object.freeze({
  INITIALIZATION_REQUIRED: "initialization-required",
  READY: "ready",
  MIGRATION_REQUIRED: "migration-required",
  UNUSABLE: "unusable",
});
const DESKTOP_MIGRATION_STATE = Object.freeze({
  COMPLETE: "complete",
  INCOMPLETE: "incomplete",
  MISSING: "missing",
  UNKNOWN: "unknown",
});
const REQUIRED_SQLITE_TABLES = Object.freeze([
  "notebooks",
  "notebook_canvases",
  "tags",
  "notebook_tags",
  "cues",
]);
const REQUIRED_MIGRATION_COLUMNS = Object.freeze([
  "id",
  "checksum",
  "finished_at",
  "migration_name",
  "logs",
  "rolled_back_at",
  "started_at",
  "applied_steps_count",
]);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, "../../..");
const DEFAULT_MIGRATIONS_DIRECTORY = path.join(
  DEFAULT_PROJECT_ROOT,
  "prisma",
  "migrations",
);
const DEFAULT_PRISMA_CONFIG_PATH = path.join(
  DEFAULT_PROJECT_ROOT,
  "prisma.config.ts",
);
const DEFAULT_PRISMA_BINARY = path.join(
  DEFAULT_PROJECT_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

class DesktopStorageError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "DesktopStorageError";
    this.code = options.code ?? "DESKTOP_STORAGE_ERROR";
  }
}

function assertAbsolutePath(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DesktopStorageError(`${label} が空です`, {
      code: "INVALID_PATH",
    });
  }

  if (!path.isAbsolute(value)) {
    throw new DesktopStorageError(`${label} は絶対パスで指定してください`, {
      code: "INVALID_PATH",
    });
  }

  return path.normalize(value);
}

function databasePathToUrl(databasePath) {
  const absolutePath = assertAbsolutePath(databasePath, "SQLite path");
  return `file:${absolutePath}`;
}

function resolveDesktopStoragePaths({
  homeDirectory = os.homedir(),
} = {}) {
  const home = assertAbsolutePath(homeDirectory, "home directory");

  const root = path.join(
    home,
    "Library",
    "Application Support",
    DESKTOP_APPLICATION_ID,
  );
  const liveDirectory = path.join(root, DESKTOP_STORAGE_LAYOUT.live);
  const databasePath = path.join(root, DESKTOP_STORAGE_LAYOUT.database);
  const backupsDirectory = path.join(root, DESKTOP_STORAGE_LAYOUT.backups);
  const settingsDirectory = path.join(root, DESKTOP_STORAGE_LAYOUT.settings);
  const logsDirectory = path.join(root, DESKTOP_STORAGE_LAYOUT.logs);
  const pendingRestoreDirectory = path.join(
    root,
    DESKTOP_STORAGE_LAYOUT.pendingRestore,
  );

  return Object.freeze({
    applicationId: DESKTOP_APPLICATION_ID,
    applicationSupportRoot: root,
    root,
    liveDirectory,
    databasePath,
    backupsDirectory,
    settingsDirectory,
    logsDirectory,
    pendingRestoreDirectory,
    databaseUrl: databasePathToUrl(databasePath),
  });
}

function ensureDirectory(directoryPath) {
  try {
    fs.mkdirSync(directoryPath, { recursive: true });
  } catch (error) {
    throw new DesktopStorageError(
      `Desktop user data directory を作成できません: ${directoryPath}`,
      { code: "DIRECTORY_CREATE_FAILED", cause: error },
    );
  }
}

function validateStoragePaths(storagePaths) {
  if (!storagePaths || typeof storagePaths !== "object") {
    throw new DesktopStorageError("Desktop storage paths が必要です", {
      code: "INVALID_STORAGE_PATHS",
    });
  }

  for (const [key, label] of [
    ["root", "Desktop user data root"],
    ["liveDirectory", "live directory"],
    ["databasePath", "SQLite path"],
    ["backupsDirectory", "backups directory"],
    ["settingsDirectory", "settings directory"],
    ["logsDirectory", "logs directory"],
    ["pendingRestoreDirectory", "pending-restore directory"],
  ]) {
    assertAbsolutePath(storagePaths[key], label);
  }

  return storagePaths;
}

function ensureDesktopStorageDirectories(storagePaths) {
  const paths = validateStoragePaths(
    storagePaths ?? resolveDesktopStoragePaths(),
  );

  for (const directoryPath of [
    paths.root,
    paths.liveDirectory,
    paths.backupsDirectory,
    paths.settingsDirectory,
    paths.logsDirectory,
    paths.pendingRestoreDirectory,
  ]) {
    ensureDirectory(directoryPath);
  }

  return paths;
}

function createDesktopSidecarDatabaseEnvironment(storagePaths) {
  const paths = validateStoragePaths(
    storagePaths ?? resolveDesktopStoragePaths(),
  );

  return Object.freeze({
    DATABASE_URL: databasePathToUrl(paths.databasePath),
    PRISMA_PROVIDER: "sqlite",
  });
}

function readMigrationManifest(
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY,
) {
  const directory = assertAbsolutePath(
    migrationsDirectory,
    "SQLite migrations directory",
  );
  let entries;

  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    throw new DesktopStorageError(
      "SQLite migrations directory を読み取れません",
      { code: "MIGRATIONS_UNAVAILABLE", cause: error },
    );
  }

  const manifest = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const name = entry.name;
      const migrationPath = path.join(directory, name, "migration.sql");

      let stats;
      try {
        stats = fs.statSync(migrationPath);
      } catch (error) {
        if (error && typeof error === "object" && error.code === "ENOENT") {
          return null;
        }

        throw new DesktopStorageError(
          `SQLite migration SQL を検査できません: ${name}`,
          { code: "MIGRATIONS_UNAVAILABLE", cause: error },
        );
      }

      if (!stats.isFile()) {
        return null;
      }

      let sql;
      try {
        sql = fs.readFileSync(migrationPath);
      } catch (error) {
        throw new DesktopStorageError(
          `SQLite migration SQL を読み取れません: ${name}`,
          { code: "MIGRATIONS_UNAVAILABLE", cause: error },
        );
      }

      return {
        name,
        path: migrationPath,
        checksum: crypto.createHash("sha256").update(sql).digest("hex"),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));

  if (manifest.length === 0) {
    throw new DesktopStorageError(
      "SQLite migration SQL が見つかりません",
      { code: "MIGRATIONS_UNAVAILABLE" },
    );
  }

  return manifest;
}

function isBetterSqlite3NativeLoadError(error, phase) {
  if (error?.code === "ERR_DLOPEN_FAILED") {
    return true;
  }

  if (phase === "require") {
    return error?.code === "MODULE_NOT_FOUND";
  }

  if (phase !== "constructor") {
    return false;
  }

  const errorText = [error?.message, error?.stack]
    .filter((value) => typeof value === "string")
    .join("\n");

  return /Could not locate the bindings file|better[_-]sqlite3\.node|Cannot find module ['"](?:bindings|better-sqlite3)['"]/i.test(
    errorText,
  );
}

function createBetterSqliteReader(databasePath) {
  let Database;

  try {
    Database = require("better-sqlite3");
  } catch (error) {
    if (isBetterSqlite3NativeLoadError(error, "require")) {
      return null;
    }

    throw error;
  }

  let database;
  try {
    database = new Database(databasePath, {
      fileMustExist: true,
      readonly: true,
    });
  } catch (error) {
    if (isBetterSqlite3NativeLoadError(error, "constructor")) {
      return null;
    }

    throw error;
  }

  database.pragma("query_only = ON");

  return {
    all(sql) {
      return database.prepare(sql).all();
    },
    close() {
      database.close();
    },
  };
}

function createSqliteCliReader(databasePath, sqliteBinary = "sqlite3") {
  try {
    execFileSync(sqliteBinary, ["-version"], { stdio: "ignore" });
  } catch (error) {
    throw new DesktopStorageError(
      "SQLite reader がありません。better-sqlite3 または sqlite3 CLI を用意してください",
      { code: "SQLITE_READER_UNAVAILABLE", cause: error },
    );
  }

  return {
    all(sql) {
      try {
        const output = execFileSync(
          sqliteBinary,
          [
            "-readonly",
            "-bail",
            "-json",
            "-cmd",
            "PRAGMA query_only=ON;",
            "--",
            databasePath,
            sql,
          ],
          {
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        const trimmed = output.trim();
        return trimmed === "" ? [] : JSON.parse(trimmed);
      } catch (error) {
        throw new DesktopStorageError("SQLite の read-only query に失敗しました", {
          code: "SQLITE_READ_FAILED",
          cause: error,
        });
      }
    },
    close() {},
  };
}

function createSqliteReader(databasePath, sqliteBinary) {
  try {
    const betterSqliteReader = createBetterSqliteReader(databasePath);
    if (betterSqliteReader !== null) {
      return betterSqliteReader;
    }
  } catch (error) {
    if (!isBetterSqlite3NativeLoadError(error, "constructor")) {
      throw error;
    }
  }

  return createSqliteCliReader(
    databasePath,
    sqliteBinary ?? process.env.SQLITE3_BIN ?? "sqlite3",
  );
}

function hasErrorCode(error, code) {
  return Boolean(error && typeof error === "object" && error.code === code);
}

function databaseInitializationMarkerPath(paths) {
  return path.join(
    paths.settingsDirectory,
    DESKTOP_DATABASE_INITIALIZATION_MARKER_NAME,
  );
}

function databaseInitializationMarkerError(message, code, cause) {
  return new DesktopStorageError(message, { code, cause });
}

function readDatabaseInitializationMarker(paths) {
  const markerPath = databaseInitializationMarkerPath(paths);
  let stats;

  try {
    stats = fs.lstatSync(markerPath);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return { exists: false };
    }

    throw databaseInitializationMarkerError(
      "SQLite 初期化 marker を読み取れません",
      "DATABASE_INITIALIZATION_MARKER_READ_FAILED",
      error,
    );
  }

  if (!stats.isFile()) {
    throw databaseInitializationMarkerError(
      "SQLite 初期化 marker が regular file ではありません",
      "DATABASE_INITIALIZATION_MARKER_INVALID",
    );
  }

  let content;
  try {
    content = fs.readFileSync(markerPath);
  } catch (error) {
    throw databaseInitializationMarkerError(
      "SQLite 初期化 marker の内容を読み取れません",
      "DATABASE_INITIALIZATION_MARKER_READ_FAILED",
      error,
    );
  }

  if (
    !content.equals(
      Buffer.from(DESKTOP_DATABASE_INITIALIZATION_MARKER_CONTENT, "utf8"),
    )
  ) {
    throw databaseInitializationMarkerError(
      "SQLite 初期化 marker の内容が不正です",
      "DATABASE_INITIALIZATION_MARKER_INVALID",
    );
  }

  return { exists: true };
}

function writeDatabaseInitializationMarker(paths) {
  const markerPath = databaseInitializationMarkerPath(paths);
  let descriptor;

  try {
    descriptor = fs.openSync(markerPath, "wx", 0o600);
  } catch (error) {
    if (hasErrorCode(error, "EEXIST")) {
      const existing = readDatabaseInitializationMarker(paths);
      if (existing.exists) {
        return;
      }
    }

    throw databaseInitializationMarkerError(
      "SQLite 初期化 marker を作成できません",
      "DATABASE_INITIALIZATION_MARKER_WRITE_FAILED",
      error,
    );
  }

  try {
    const content = Buffer.from(
      DESKTOP_DATABASE_INITIALIZATION_MARKER_CONTENT,
      "utf8",
    );
    let offset = 0;
    while (offset < content.length) {
      offset += fs.writeSync(
        descriptor,
        content,
        offset,
        content.length - offset,
      );
    }
    fs.fsyncSync(descriptor);
  } catch (error) {
    throw databaseInitializationMarkerError(
      "SQLite 初期化 marker に書き込めません",
      "DATABASE_INITIALIZATION_MARKER_WRITE_FAILED",
      error,
    );
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch (error) {
      throw databaseInitializationMarkerError(
        "SQLite 初期化 marker を閉じられません",
        "DATABASE_INITIALIZATION_MARKER_WRITE_FAILED",
        error,
      );
    }
    descriptor = undefined;
  }

  readDatabaseInitializationMarker(paths);
}

function ensureDatabaseInitializationMarker(paths) {
  const marker = readDatabaseInitializationMarker(paths);
  if (marker.exists) {
    return;
  }

  writeDatabaseInitializationMarker(paths);
}

function unusableResult(paths, reason) {
  return {
    ...paths,
    status: DESKTOP_DATABASE_STATUS.UNUSABLE,
    migrationState: DESKTOP_MIGRATION_STATE.UNKNOWN,
    available: false,
    requiresInitialization: false,
    requiresMigration: false,
    reason,
  };
}

function migrationRequiredResult(paths, migrationState, pendingMigrations, reason) {
  return {
    ...paths,
    status: DESKTOP_DATABASE_STATUS.MIGRATION_REQUIRED,
    migrationState,
    available: false,
    requiresInitialization: false,
    requiresMigration: true,
    pendingMigrations,
    reason,
  };
}

function initializationRequiredResult(paths) {
  return {
    ...paths,
    status: DESKTOP_DATABASE_STATUS.INITIALIZATION_REQUIRED,
    migrationState: DESKTOP_MIGRATION_STATE.MISSING,
    available: false,
    requiresInitialization: true,
    requiresMigration: false,
    pendingMigrations: [],
    reason: "database-missing",
  };
}

function databaseMissingAfterInitializationResult(paths) {
  return unusableResult(
    paths,
    DESKTOP_DATABASE_MISSING_AFTER_INITIALIZATION_REASON,
  );
}

function inspectDesktopDatabase({
  storagePaths,
  homeDirectory,
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY,
  sqliteBinary,
} = {}) {
  const paths = validateStoragePaths(
    storagePaths ?? resolveDesktopStoragePaths({ homeDirectory }),
  );
  let initializationMarker;

  try {
    initializationMarker = readDatabaseInitializationMarker(paths);
  } catch {
    return unusableResult(
      paths,
      DESKTOP_DATABASE_INITIALIZATION_MARKER_INVALID_REASON,
    );
  }

  let stats;

  try {
    stats = fs.statSync(paths.databasePath);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      if (initializationMarker.exists) {
        return databaseMissingAfterInitializationResult(paths);
      }

      return initializationRequiredResult(paths);
    }

    return unusableResult(paths, "database-stat-failed", error);
  }

  if (!stats.isFile() || stats.size === 0) {
    return unusableResult(paths, "database-not-a-file");
  }

  let manifest;
  try {
    manifest = readMigrationManifest(migrationsDirectory);
  } catch (error) {
    return unusableResult(paths, "migration-source-unavailable", error);
  }

  let reader;
  try {
    reader = createSqliteReader(paths.databasePath, sqliteBinary);
  } catch (error) {
    return unusableResult(paths, "database-open-failed", error);
  }

  try {
    let integrityRows;
    try {
      integrityRows = reader.all("PRAGMA integrity_check");
    } catch (error) {
      return unusableResult(paths, "integrity-check-failed", error);
    }

    if (
      integrityRows.length !== 1 ||
      integrityRows[0].integrity_check !== "ok"
    ) {
      return unusableResult(paths, "integrity-check-failed");
    }

    let tableRows;
    try {
      tableRows = reader.all(
        `SELECT "name" FROM "sqlite_master"
         WHERE "type" = 'table' AND "name" NOT LIKE 'sqlite_%'
         ORDER BY "name"`,
      );
    } catch (error) {
      return unusableResult(paths, "schema-read-failed", error);
    }

    const tableNames = new Set(tableRows.map((row) => row.name));
    if (!tableNames.has("_prisma_migrations")) {
      return unusableResult(paths, "migration-table-missing");
    }

    let migrationColumns;
    try {
      migrationColumns = reader
        .all(`PRAGMA table_info("_prisma_migrations")`)
        .map((column) => column.name);
    } catch (error) {
      return unusableResult(paths, "migration-table-read-failed", error);
    }

    if (
      REQUIRED_MIGRATION_COLUMNS.some(
        (column) => !migrationColumns.includes(column),
      )
    ) {
      return unusableResult(paths, "migration-table-invalid");
    }

    let rows;
    try {
      rows = reader.all(
        `SELECT "migration_name", "checksum", "applied_steps_count",
                "finished_at", "rolled_back_at", "started_at"
         FROM "_prisma_migrations"
         ORDER BY "started_at", "migration_name"`,
      );
    } catch (error) {
      return unusableResult(paths, "migration-state-read-failed", error);
    }

    const expectedNames = manifest.map((migration) => migration.name);
    const expectedByName = new Map(
      manifest.map((migration) => [migration.name, migration]),
    );
    const actualNames = rows.map((row) => row.migration_name);

    if (
      rows.some(
        (row) =>
          typeof row.migration_name !== "string" ||
          typeof row.checksum !== "string" ||
          !Number.isInteger(row.applied_steps_count) ||
          row.applied_steps_count < 0 ||
          typeof row.started_at !== "string" &&
            typeof row.started_at !== "number",
      )
    ) {
      return unusableResult(paths, "migration-state-invalid");
    }

    if (new Set(actualNames).size !== actualNames.length) {
      return unusableResult(paths, "migration-history-duplicate");
    }

    if (actualNames.some((name) => !expectedByName.has(name))) {
      return unusableResult(paths, "migration-history-unknown");
    }

    if (
      actualNames.some((name, index) => expectedNames[index] !== name)
    ) {
      return unusableResult(paths, "migration-history-gap");
    }

    for (const row of rows) {
      const expectedMigration = expectedByName.get(row.migration_name);
      if (row.checksum !== expectedMigration.checksum) {
        return unusableResult(paths, "migration-checksum-mismatch");
      }
    }

    const incompleteRow = rows.find(
      (row) => row.finished_at === null || row.rolled_back_at !== null,
    );
    if (incompleteRow) {
      return migrationRequiredResult(
        paths,
        DESKTOP_MIGRATION_STATE.INCOMPLETE,
        expectedNames.slice(rows.length),
        "migration-incomplete",
      );
    }

    if (rows.length < expectedNames.length) {
      return migrationRequiredResult(
        paths,
        DESKTOP_MIGRATION_STATE.MISSING,
        expectedNames.slice(rows.length),
        "migration-missing",
      );
    }

    const missingTables = REQUIRED_SQLITE_TABLES.filter(
      (table) => !tableNames.has(table),
    );
    if (missingTables.length > 0) {
      return unusableResult(paths, "required-table-missing");
    }

    let foreignKeyRows;
    try {
      foreignKeyRows = reader.all("PRAGMA foreign_key_check");
    } catch (error) {
      return unusableResult(paths, "foreign-key-check-failed", error);
    }

    if (foreignKeyRows.length > 0) {
      return unusableResult(paths, "foreign-key-check-failed");
    }

    return {
      ...paths,
      status: DESKTOP_DATABASE_STATUS.READY,
      migrationState: DESKTOP_MIGRATION_STATE.COMPLETE,
      available: true,
      requiresInitialization: false,
      requiresMigration: false,
      pendingMigrations: [],
      appliedMigrations: expectedNames,
      reason: "migration-complete",
    };
  } catch (error) {
    return unusableResult(paths, "database-undeterminable", error);
  } finally {
    reader.close();
  }
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function closeClaimedDatabaseFile(claim) {
  if (!claim || claim.descriptor === undefined) {
    return;
  }

  const descriptor = claim.descriptor;
  claim.descriptor = undefined;

  try {
    fs.closeSync(descriptor);
  } catch {
    // Preserve the migration result and recovery state.
  }
}

function getClaimedEmptyDatabaseStats(claim) {
  if (!claim || claim.descriptor === undefined) {
    return null;
  }

  let descriptorStats;
  let pathStats;
  try {
    descriptorStats = fs.fstatSync(claim.descriptor);
    pathStats = fs.lstatSync(claim.databasePath);
  } catch {
    return null;
  }

  if (
    !descriptorStats.isFile() ||
    !pathStats.isFile() ||
    !sameFileIdentity(descriptorStats, claim.stats) ||
    !sameFileIdentity(pathStats, claim.stats) ||
    descriptorStats.size !== 0 ||
    pathStats.size !== 0
  ) {
    return null;
  }

  return { descriptorStats, pathStats };
}

function cleanupClaimedDatabaseFile(claim) {
  if (getClaimedEmptyDatabaseStats(claim) === null) {
    return false;
  }

  try {
    fs.unlinkSync(claim.databasePath);
    return true;
  } catch {
    // Leave the file for recovery when it cannot be removed safely.
    return false;
  }
}

function claimNewDatabaseFile(databasePath) {
  let descriptor;

  try {
    descriptor = fs.openSync(databasePath, "wx");
    return {
      databasePath,
      descriptor,
      stats: fs.fstatSync(descriptor),
    };
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Preserve the original claim error.
      }
    }

    if (hasErrorCode(error, "EEXIST")) {
      return false;
    }

    throw new DesktopStorageError("SQLite DB の初期 file を作成できません", {
      code: "DATABASE_CREATE_FAILED",
      cause: error,
    });
  }
}

function applyInitialMigrations({
  databasePath,
  claimedFile,
  prismaBinary = DEFAULT_PRISMA_BINARY,
  prismaConfigPath = DEFAULT_PRISMA_CONFIG_PATH,
  prismaProjectRoot = DEFAULT_PROJECT_ROOT,
  environment = process.env,
} = {}) {
  const absoluteDatabasePath = assertAbsolutePath(databasePath, "SQLite path");

  if (
    !claimedFile ||
    claimedFile.databasePath !== absoluteDatabasePath ||
    getClaimedEmptyDatabaseStats(claimedFile) === null
  ) {
    throw new DesktopStorageError(
      "既存 SQLite DB へ初回 migration を適用しません",
      { code: "DATABASE_ALREADY_EXISTS" },
    );
  }

  const absoluteConfigPath = assertAbsolutePath(
    prismaConfigPath,
    "Prisma config path",
  );
  const absoluteProjectRoot = assertAbsolutePath(
    prismaProjectRoot,
    "Prisma project root",
  );
  const commandEnvironment = {
    ...environment,
    DATABASE_URL: databasePathToUrl(absoluteDatabasePath),
    PRISMA_PROVIDER: "sqlite",
  };
  const result = spawnSync(
    prismaBinary,
    ["migrate", "deploy", "--config", absoluteConfigPath],
    {
      cwd: absoluteProjectRoot,
      env: commandEnvironment,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (result.error || result.status !== 0) {
    throw new DesktopStorageError(
      "初回 SQLite migration に失敗しました",
      {
        code: "INITIAL_MIGRATION_FAILED",
        cause: result.error,
      },
    );
  }
}

function finalizeReadyDatabase(paths, inspection, created) {
  try {
    ensureDatabaseInitializationMarker(paths);
  } catch {
    return {
      ...unusableResult(
        paths,
        DESKTOP_DATABASE_INITIALIZATION_MARKER_INVALID_REASON,
      ),
      created,
      paths,
    };
  }

  return { ...inspection, created, paths };
}

function bootstrapDesktopStorage({
  homeDirectory,
  storagePaths,
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY,
  sqliteBinary,
  prismaBinary = DEFAULT_PRISMA_BINARY,
  prismaConfigPath = DEFAULT_PRISMA_CONFIG_PATH,
  prismaProjectRoot = DEFAULT_PROJECT_ROOT,
  environment = process.env,
} = {}) {
  const paths = ensureDesktopStorageDirectories(
    storagePaths ?? resolveDesktopStoragePaths({ homeDirectory }),
  );
  const current = inspectDesktopDatabase({
    storagePaths: paths,
    migrationsDirectory,
    sqliteBinary,
  });

  if (current.status !== DESKTOP_DATABASE_STATUS.INITIALIZATION_REQUIRED) {
    if (current.status === DESKTOP_DATABASE_STATUS.READY) {
      return finalizeReadyDatabase(paths, current, false);
    }

    return { ...current, created: false, paths };
  }

  readMigrationManifest(migrationsDirectory);
  const claim = claimNewDatabaseFile(paths.databasePath);
  if (claim === false) {
    const raced = inspectDesktopDatabase({
      storagePaths: paths,
      migrationsDirectory,
      sqliteBinary,
    });

    if (raced.status === DESKTOP_DATABASE_STATUS.READY) {
      return finalizeReadyDatabase(paths, raced, false);
    }

    return { ...raced, created: false, paths };
  }

  try {
    applyInitialMigrations({
      databasePath: paths.databasePath,
      claimedFile: claim,
      prismaBinary,
      prismaConfigPath,
      prismaProjectRoot,
      environment,
    });
  } catch (error) {
    cleanupClaimedDatabaseFile(claim);
    throw error;
  } finally {
    closeClaimedDatabaseFile(claim);
  }

  const initialized = inspectDesktopDatabase({
    storagePaths: paths,
    migrationsDirectory,
    sqliteBinary,
  });

  if (initialized.status === DESKTOP_DATABASE_STATUS.READY) {
    return finalizeReadyDatabase(paths, initialized, true);
  }

  return { ...initialized, created: true, paths };
}

module.exports = {
  DESKTOP_APPLICATION_ID,
  DESKTOP_DATABASE_INITIALIZATION_MARKER_CONTENT,
  DESKTOP_DATABASE_INITIALIZATION_MARKER_INVALID_REASON,
  DESKTOP_DATABASE_INITIALIZATION_MARKER_NAME,
  DESKTOP_DATABASE_MISSING_AFTER_INITIALIZATION_REASON,
  DESKTOP_DATABASE_STATUS,
  DESKTOP_MIGRATION_STATE,
  DESKTOP_STORAGE_LAYOUT,
  DesktopStorageError,
  bootstrapDesktopStorage,
  createDesktopSidecarDatabaseEnvironment,
  databasePathToUrl,
  ensureDesktopStorageDirectories,
  inspectDesktopDatabase,
  readMigrationManifest,
  resolveDesktopStoragePaths,
};
