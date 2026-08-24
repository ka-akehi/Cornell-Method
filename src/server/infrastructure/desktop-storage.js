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
const DESKTOP_DATABASE_NOT_A_FILE_REASON = "database-not-a-file";
const DESKTOP_UPDATE_STATE_FILE_NAME = "update-state.json";
const DESKTOP_STAGED_MIGRATION_DIRECTORY_NAME = "database-migrations";
const DESKTOP_STAGED_MIGRATION_APP_RUNTIME_PATH = Object.freeze([
  "Contents",
  "Resources",
  "runtime",
]);
const DESKTOP_STAGED_MIGRATION_STATUS = Object.freeze({
  NO_PENDING: "no-pending",
  SWITCHED: "switched",
});
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
const SQLITE_INTERNAL_TABLE_NAMES = Object.freeze([
  "_prisma_migrations",
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
const DEFAULT_NODE_EXECUTABLE = process.execPath;

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
  applicationId = DESKTOP_APPLICATION_ID,
} = {}) {
  const home = assertAbsolutePath(homeDirectory, "home directory");
  if (
    typeof applicationId !== "string"
    || applicationId.trim() === ""
    || applicationId !== path.basename(applicationId)
    || applicationId.includes("\\")
    || applicationId === "."
    || applicationId === ".."
  ) {
    throw new DesktopStorageError("application identifier が不正です", {
      code: "INVALID_APPLICATION_ID",
    });
  }

  const root = path.join(
    home,
    "Library",
    "Application Support",
    applicationId,
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
    applicationId,
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
    ["applicationSupportRoot", "Application Support root"],
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
        stats = fs.lstatSync(migrationPath);
      } catch (error) {
        if (error && typeof error === "object" && error.code === "ENOENT") {
          return null;
        }

        throw new DesktopStorageError(
          `SQLite migration SQL を検査できません: ${name}`,
          { code: "MIGRATIONS_UNAVAILABLE", cause: error },
        );
      }

      if (stats.isSymbolicLink()) {
        throw new DesktopStorageError(
          `SQLite migration SQL が symlink です: ${name}`,
          { code: "MIGRATIONS_UNAVAILABLE" },
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
  integrityCheck = true,
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
    stats = fs.lstatSync(paths.databasePath);
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
    return unusableResult(paths, DESKTOP_DATABASE_NOT_A_FILE_REASON);
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
    if (integrityCheck) {
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

    if (integrityCheck) {
      let foreignKeyRows;
      try {
        foreignKeyRows = reader.all("PRAGMA foreign_key_check");
      } catch (error) {
        return unusableResult(paths, "foreign-key-check-failed", error);
      }

      if (foreignKeyRows.length > 0) {
        return unusableResult(paths, "foreign-key-check-failed");
      }
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
  nodeExecutable = DEFAULT_NODE_EXECUTABLE,
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
  const absoluteNodeExecutable = assertAbsolutePath(
    nodeExecutable,
    "Node executable",
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
    absoluteNodeExecutable,
    [prismaBinary, "migrate", "deploy", "--config", absoluteConfigPath],
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

function stagedMigrationError(message, code, cause) {
  return new DesktopStorageError(message, { code, cause });
}

function requireExistingDirectory(directoryPath, label, code = "STAGED_MIGRATION_PATH") {
  let stats;
  try {
    stats = fs.lstatSync(directoryPath);
  } catch (error) {
    throw stagedMigrationError(
      `${label} を検査できません`,
      code,
      error,
    );
  }

  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw stagedMigrationError(`${label} が directory ではありません`, code);
  }
  return stats;
}

function requireExistingRegularFile(
  filePath,
  label,
  code = "STAGED_MIGRATION_PATH",
  { executable = false } = {},
) {
  let stats;
  try {
    stats = fs.lstatSync(filePath);
  } catch (error) {
    throw stagedMigrationError(
      `${label} を検査できません`,
      code,
      error,
    );
  }

  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw stagedMigrationError(`${label} が regular file ではありません`, code);
  }
  if (executable && process.platform !== "win32" && (stats.mode & 0o111) === 0) {
    throw stagedMigrationError(`${label} が executable ではありません`, code);
  }
  return stats;
}

function requireDirectoryTree(root, components, label) {
  let current = root;
  requireExistingDirectory(current, label);
  for (const component of components) {
    if (
      typeof component !== "string"
      || component === ""
      || component === "."
      || component === ".."
      || component.includes("/")
      || component.includes("\\")
    ) {
      throw stagedMigrationError(`${label} の path component が不正です`, "STAGED_MIGRATION_PATH");
    }
    current = path.join(current, component);
    requireExistingDirectory(current, label);
  }
  return current;
}

function requireSafeStagingRoot(stagingDirectory) {
  if (!path.isAbsolute(stagingDirectory) || stagingDirectory.includes("\0")) {
    throw stagedMigrationError("update staging path が不正です", "STAGED_MIGRATION_PATH");
  }
  requireExistingDirectory(stagingDirectory, "update staging directory");
  const parent = path.dirname(stagingDirectory);
  requireExistingDirectory(parent, "update staging parent directory");
  return stagingDirectory;
}

function requireCanonicalStagedStorageDirectories(storagePaths) {
  const root = path.resolve(storagePaths.applicationSupportRoot);
  const expectedPaths = new Map([
    ["root", root],
    ["liveDirectory", path.join(root, DESKTOP_STORAGE_LAYOUT.live)],
    ["backupsDirectory", path.join(root, DESKTOP_STORAGE_LAYOUT.backups)],
    ["settingsDirectory", path.join(root, DESKTOP_STORAGE_LAYOUT.settings)],
    ["logsDirectory", path.join(root, DESKTOP_STORAGE_LAYOUT.logs)],
    [
      "pendingRestoreDirectory",
      path.join(root, DESKTOP_STORAGE_LAYOUT.pendingRestore),
    ],
    ["databasePath", path.join(root, DESKTOP_STORAGE_LAYOUT.database)],
  ]);
  for (const [key, expectedPath] of expectedPaths) {
    if (path.resolve(storagePaths[key]) !== expectedPath) {
      throw stagedMigrationError(
        `Application Support path の ${key} が canonical ではありません`,
        "STAGED_MIGRATION_PATH",
      );
    }
  }
  requireExistingDirectory(root, "Application Support root");
  requireExistingDirectory(storagePaths.liveDirectory, "live directory");
  requireExistingDirectory(storagePaths.backupsDirectory, "managed backup directory");
  requireExistingDirectory(storagePaths.settingsDirectory, "settings directory");
  return root;
}

function rejectSqliteSidecars(databasePath, code) {
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    const sidecarPath = `${databasePath}${suffix}`;
    try {
      fs.lstatSync(sidecarPath);
    } catch (error) {
      if (hasErrorCode(error, "ENOENT")) continue;
      throw stagedMigrationError(
        `SQLite sidecar を検査できません: ${suffix}`,
        code,
        error,
      );
    }
    throw stagedMigrationError(
      `SQLite sidecar が残っています: ${suffix}`,
      code,
    );
  }
}

function validateStagedCandidateIdentifier(value, label) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 256
    || value.includes("/")
    || value.includes("\\")
    || value.includes("://")
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw stagedMigrationError(`${label} が不正です`, "STAGED_MIGRATION_STATE_INVALID");
  }
  return value;
}

function validateStagedDigest(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw stagedMigrationError(
      "verified update digest が不正です",
      "STAGED_MIGRATION_STATE_INVALID",
    );
  }
  return value;
}

function canonicalStagedPackagePath(digest) {
  return path.join("packages", `${digest}.app.tar.gz`);
}

function canonicalStagedExtractedAppPath(digest) {
  return path.join(
    "extract",
    digest,
    "Cornell Method Notebook.app",
  );
}

function readApplyPreparationCandidate(storagePaths) {
  requireExistingDirectory(
    storagePaths.settingsDirectory,
    "update state settings directory",
  );
  const statePath = path.join(storagePaths.settingsDirectory, DESKTOP_UPDATE_STATE_FILE_NAME);
  requireExistingRegularFile(statePath, "update state", "STAGED_MIGRATION_STATE_INVALID");

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch (error) {
    throw stagedMigrationError(
      "update state を読み取れません",
      "STAGED_MIGRATION_STATE_INVALID",
      error,
    );
  }

  if (
    parsed === null
    || typeof parsed !== "object"
    || Array.isArray(parsed)
    || parsed.schemaVersion !== 2
    || parsed.status !== "checking"
    || parsed.phase !== "apply-preparation"
  ) {
    throw stagedMigrationError(
      "update state は ApplyPreparation ではありません",
      "STAGED_MIGRATION_NOT_PENDING",
    );
  }

  const pending = parsed.pendingUpdate;
  if (
    pending === null
    || typeof pending !== "object"
    || Array.isArray(pending)
    || pending.verificationState !== "verified"
  ) {
    throw stagedMigrationError(
      "ApplyPreparation に verified candidate がありません",
      "STAGED_MIGRATION_STATE_INVALID",
    );
  }

  const digest = validateStagedDigest(pending.sha256);
  validateStagedCandidateIdentifier(pending.version, "update version");
  validateStagedCandidateIdentifier(pending.channel, "update channel");
  validateStagedCandidateIdentifier(pending.architecture, "update architecture");
  validateStagedCandidateIdentifier(pending.artifact, "update artifact");
  if (!Number.isSafeInteger(pending.sizeBytes) || pending.sizeBytes <= 0) {
    throw stagedMigrationError(
      "verified update size が不正です",
      "STAGED_MIGRATION_STATE_INVALID",
    );
  }

  const expectedPackagePath = canonicalStagedPackagePath(digest);
  const expectedExtractedAppPath = canonicalStagedExtractedAppPath(digest);
  if (pending.packagePath !== expectedPackagePath || pending.extractedAppPath !== expectedExtractedAppPath) {
    throw stagedMigrationError(
      "verified update staging path が canonical ではありません",
      "STAGED_MIGRATION_STATE_INVALID",
    );
  }

  const stagingDirectory = requireSafeStagingRoot(
    path.join(storagePaths.applicationSupportRoot, "staging"),
  );
  const packagePath = path.join(stagingDirectory, expectedPackagePath);
  const extractedAppPath = path.join(stagingDirectory, expectedExtractedAppPath);
  const packageStats = requireExistingRegularFile(
    packagePath,
    "verified update package",
    "STAGED_MIGRATION_STAGING_INVALID",
  );
  if (packageStats.size !== pending.sizeBytes) {
    throw stagedMigrationError(
      "verified update package size が state と一致しません",
      "STAGED_MIGRATION_STAGING_INVALID",
    );
  }
  requireDirectoryTree(
    stagingDirectory,
    ["extract", digest, "Cornell Method Notebook.app"],
    "verified extracted app",
  );

  return Object.freeze({
    digest,
    version: pending.version,
    channel: pending.channel,
    architecture: pending.architecture,
    artifact: pending.artifact,
    packagePath,
    extractedAppPath,
    stagingDirectory,
  });
}

function resolveStagedMigrationSource(candidate) {
  const runtimeDirectory = requireDirectoryTree(
    candidate.extractedAppPath,
    DESKTOP_STAGED_MIGRATION_APP_RUNTIME_PATH,
    "verified app runtime",
  );
  const migrationsDirectory = requireDirectoryTree(
    runtimeDirectory,
    ["prisma", "migrations"],
    "verified app migration source",
  );
  requireExistingRegularFile(
    path.join(migrationsDirectory, "migration_lock.toml"),
    "verified app migration lock",
    "STAGED_MIGRATION_SOURCE_INVALID",
  );
  requireExistingRegularFile(
    path.join(runtimeDirectory, "prisma.config.ts"),
    "verified app Prisma config",
    "STAGED_MIGRATION_SOURCE_INVALID",
  );
  const configDirectory = requireDirectoryTree(
    runtimeDirectory,
    ["config"],
    "verified app project environment directory",
  );
  requireExistingRegularFile(
    path.join(configDirectory, "project-env.js"),
    "verified app project environment helper",
    "STAGED_MIGRATION_SOURCE_INVALID",
  );
  requireExistingRegularFile(
    path.join(runtimeDirectory, "prisma", "schema.prisma"),
    "verified app Prisma schema",
    "STAGED_MIGRATION_SOURCE_INVALID",
  );

  let migrationEntries;
  try {
    migrationEntries = fs.readdirSync(migrationsDirectory, { withFileTypes: true });
  } catch (error) {
    throw stagedMigrationError(
      "verified app migration source を読み取れません",
      "STAGED_MIGRATION_SOURCE_INVALID",
      error,
    );
  }
  for (const entry of migrationEntries) {
    if (entry.isSymbolicLink()) {
      throw stagedMigrationError(
        "verified app migration source に symlink があります",
        "STAGED_MIGRATION_SOURCE_INVALID",
      );
    }
    if (!entry.isDirectory()) continue;
    requireExistingRegularFile(
      path.join(migrationsDirectory, entry.name, "migration.sql"),
      "verified app migration SQL",
      "STAGED_MIGRATION_SOURCE_INVALID",
    );
  }

  let manifest;
  try {
    manifest = readMigrationManifest(migrationsDirectory);
  } catch (error) {
    throw stagedMigrationError(
      "verified app migration manifest が不正です",
      "STAGED_MIGRATION_SOURCE_INVALID",
      error,
    );
  }

  const nodeExecutable = path.join(runtimeDirectory, "node");
  const prismaBuildDirectory = requireDirectoryTree(
    runtimeDirectory,
    ["node_modules", "prisma", "build"],
    "verified app Prisma runtime directory",
  );
  const prismaBinary = path.join(prismaBuildDirectory, "index.js");
  requireExistingRegularFile(
    nodeExecutable,
    "verified app Node executable",
    "STAGED_MIGRATION_SOURCE_INVALID",
    { executable: true },
  );
  requireExistingRegularFile(
    prismaBinary,
    "verified app Prisma executable",
    "STAGED_MIGRATION_SOURCE_INVALID",
  );

  return Object.freeze({
    runtimeDirectory,
    migrationsDirectory,
    manifest,
    nodeExecutable,
    prismaBinary,
    prismaConfigPath: path.join(runtimeDirectory, "prisma.config.ts"),
    prismaProjectRoot: runtimeDirectory,
  });
}

function quoteSqlIdentifier(identifier) {
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

function readSqliteDataSnapshot(databasePath, sqliteBinary) {
  let reader;
  try {
    reader = createSqliteReader(databasePath, sqliteBinary);
  } catch (error) {
    throw stagedMigrationError(
      "SQLite read-back を開始できません",
      "STAGED_MIGRATION_REOPEN_FAILED",
      error,
    );
  }

  try {
    const tableRows = reader.all(
      `SELECT "name" FROM "sqlite_master"
       WHERE "type" = 'table'
       ORDER BY "name"`,
    );
    const tableNames = tableRows
      .map((row) => row.name)
      .filter((table) => (
        !table.startsWith("sqlite_")
        && !SQLITE_INTERNAL_TABLE_NAMES.includes(table)
      ));
    const tables = Object.create(null);
    for (const table of tableNames) {
      const columns = reader
        .all(`PRAGMA table_info(${quoteSqlIdentifier(table)})`)
        .map((row) => row.name);
      if (columns.length === 0) {
        throw stagedMigrationError(
          "SQLite table の columns を読み取れません",
          "STAGED_MIGRATION_READ_BACK_FAILED",
        );
      }
      const selectedColumns = columns.map(quoteSqlIdentifier).join(", ");
      const rows = reader.all(
        `SELECT ${selectedColumns} FROM ${quoteSqlIdentifier(table)}`,
      );
      if (table === "notebooks") {
        for (const row of rows) {
          if (typeof row.body !== "string") {
            throw stagedMigrationError(
              "legacy Markdown body の read-back が不正です",
              "STAGED_MIGRATION_READ_BACK_FAILED",
            );
          }
        }
      }
      if (table === "notebook_canvases") {
        for (const row of rows) {
          if (typeof row.document_json !== "string") {
            throw stagedMigrationError(
              "CanvasDocumentV1 の read-back が不正です",
              "STAGED_MIGRATION_READ_BACK_FAILED",
            );
          }
          let document;
          try {
            document = JSON.parse(row.document_json);
          } catch (error) {
            throw stagedMigrationError(
              "CanvasDocumentV1 が JSON ではありません",
              "STAGED_MIGRATION_READ_BACK_FAILED",
              error,
            );
          }
          if (
            document === null
            || typeof document !== "object"
            || document.schemaVersion !== 1
            || document.page === null
            || typeof document.page !== "object"
            || !Array.isArray(document.elements)
          ) {
            throw stagedMigrationError(
              "CanvasDocumentV1 の schema が不正です",
              "STAGED_MIGRATION_READ_BACK_FAILED",
            );
          }
        }
      }
      const normalizedRows = rows
        .map((row) => JSON.stringify(row))
        .sort((left, right) => left.localeCompare(right));
      tables[table] = { columns, rows: normalizedRows };
    }
    return tables;
  } catch (error) {
    if (error instanceof DesktopStorageError) throw error;
    throw stagedMigrationError(
      "SQLite data read-back に失敗しました",
      "STAGED_MIGRATION_READ_BACK_FAILED",
      error,
    );
  } finally {
    reader.close();
  }
}

function compareSqliteDataSnapshots(before, after) {
  for (const table of Object.keys(before)) {
    const beforeTable = before[table];
    if (beforeTable === null) continue;
    const afterTable = after[table];
    if (afterTable === undefined || afterTable === null) {
      throw stagedMigrationError(
        "SQLite existing application table が migration 後にありません",
        "STAGED_MIGRATION_READ_BACK_FAILED",
      );
    }
    const afterColumns = new Set(afterTable.columns);
    const missingColumns = beforeTable.columns.filter((column) => !afterColumns.has(column));
    if (missingColumns.length > 0) {
      const missingColumnLabels = missingColumns
        .map((column) => `${table}.${column}`)
        .join(", ");
      throw stagedMigrationError(
        `SQLite existing application table の既存 columns が migration 後にありません: ${missingColumnLabels}`,
        "STAGED_MIGRATION_READ_BACK_FAILED",
      );
    }
    const preservedColumns = beforeTable.columns;
    const beforeRows = beforeTable.rows.map((row) => {
      const parsed = JSON.parse(row);
      return JSON.stringify(Object.fromEntries(preservedColumns.map((column) => [column, parsed[column]])));
    }).sort((left, right) => left.localeCompare(right));
    const afterRows = afterTable.rows.map((row) => {
      const parsed = JSON.parse(row);
      return JSON.stringify(Object.fromEntries(preservedColumns.map((column) => [column, parsed[column]])));
    }).sort((left, right) => left.localeCompare(right));
    if (JSON.stringify(beforeRows) !== JSON.stringify(afterRows)) {
      throw stagedMigrationError(
        "SQLite existing application data の read-back が一致しません",
        "STAGED_MIGRATION_READ_BACK_FAILED",
      );
    }
  }
}

function validateMigrationSourceDatabase(
  databasePath,
  sqliteBinary,
  failureCode = "STAGED_MIGRATION_LIVE_DATABASE_INVALID",
  subject = "live",
) {
  let reader;
  try {
    reader = createSqliteReader(databasePath, sqliteBinary);
    const integrityRows = reader.all("PRAGMA integrity_check");
    if (integrityRows.length !== 1 || integrityRows[0].integrity_check !== "ok") {
      throw stagedMigrationError(
        `${subject} SQLite integrity check に失敗しました`,
        failureCode,
      );
    }
    const foreignKeyRows = reader.all("PRAGMA foreign_key_check");
    if (foreignKeyRows.length > 0) {
      throw stagedMigrationError(
        `${subject} SQLite foreign key check に失敗しました`,
        failureCode,
      );
    }
  } catch (error) {
    if (error instanceof DesktopStorageError) throw error;
    throw stagedMigrationError(
      `${subject} SQLite validation に失敗しました`,
      failureCode,
      error,
    );
  } finally {
    if (reader) reader.close();
  }
}

function syncDirectory(directoryPath) {
  let descriptor;
  try {
    descriptor = fs.openSync(directoryPath, "r");
    fs.fsyncSync(descriptor);
  } catch (error) {
    throw stagedMigrationError(
      "staged migration directory を同期できません",
      "STAGED_MIGRATION_STORAGE_FAILED",
      error,
    );
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Preserve the original storage result.
      }
    }
  }
}

function randomStagedName(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(12).toString("hex")}`;
}

function assertSameFilesystem(leftStats, rightStats, label) {
  if (typeof leftStats.dev !== "number" || typeof rightStats.dev !== "number" || leftStats.dev !== rightStats.dev) {
    throw stagedMigrationError(`${label} が同一 filesystem ではありません`, "STAGED_MIGRATION_STORAGE_FAILED");
  }
}

function copyRegularFileAtomically(
  sourcePath,
  destinationDirectory,
  destinationName,
  failureCode = "STAGED_MIGRATION_COPY_FAILED",
) {
  const sourceStats = requireExistingRegularFile(
    sourcePath,
    "SQLite source",
    failureCode,
  );
  const destinationStats = requireExistingDirectory(
    destinationDirectory,
    "SQLite destination directory",
    failureCode,
  );
  assertSameFilesystem(sourceStats, destinationStats, "SQLite source and destination");
  try {
    fs.accessSync(destinationDirectory, fs.constants.W_OK);
  } catch (error) {
    throw stagedMigrationError(
      "SQLite destination directory に書き込めません",
      failureCode,
      error,
    );
  }

  const destinationPath = path.join(destinationDirectory, destinationName);
  let destinationExists = false;
  try {
    fs.lstatSync(destinationPath);
    destinationExists = true;
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) {
      throw stagedMigrationError(
        "SQLite destination を検査できません",
        failureCode,
        error,
      );
    }
  }
  if (destinationExists) {
    throw stagedMigrationError(
      "SQLite destination は既に存在します",
      failureCode,
    );
  }

  let temporaryPath;
  let renamed = false;
  try {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidatePath = path.join(
        destinationDirectory,
        `.${destinationName}.${crypto.randomBytes(12).toString("hex")}.tmp`,
      );
      try {
        const descriptor = fs.openSync(candidatePath, "wx", 0o600);
        fs.closeSync(descriptor);
        temporaryPath = candidatePath;
        break;
      } catch (error) {
        if (!hasErrorCode(error, "EEXIST")) throw error;
      }
    }
    if (!temporaryPath) {
      throw new Error("temporary SQLite destination could not be allocated");
    }
    fs.copyFileSync(sourcePath, temporaryPath);
    const copiedDescriptor = fs.openSync(temporaryPath, "r+");
    try {
      fs.fsyncSync(copiedDescriptor);
    } finally {
      fs.closeSync(copiedDescriptor);
    }
    const sourceAfterCopy = requireExistingRegularFile(
      sourcePath,
      "SQLite source after copy",
      failureCode,
    );
    if (!sameFileIdentity(sourceStats, sourceAfterCopy) || sourceStats.size !== sourceAfterCopy.size) {
      throw stagedMigrationError(
        "SQLite source が copy 中に変更されました",
        failureCode,
      );
    }
    fs.renameSync(temporaryPath, destinationPath);
    renamed = true;
    syncDirectory(destinationDirectory);
    return destinationPath;
  } catch (error) {
    if (error instanceof DesktopStorageError) throw error;
    throw stagedMigrationError(
      "SQLite atomic copy に失敗しました",
      failureCode,
      error,
    );
  } finally {
    if (!renamed && temporaryPath) {
      try {
        fs.unlinkSync(temporaryPath);
      } catch {
        // Preserve the original copy failure.
      }
    }
  }
}

function findCandidateSafetyBackups(storagePaths, candidate) {
  let entries;
  try {
    entries = fs.readdirSync(storagePaths.backupsDirectory, { withFileTypes: true });
  } catch (error) {
    throw stagedMigrationError(
      "candidate safety backup を探索できません",
      "STAGED_MIGRATION_BACKUP_FAILED",
      error,
    );
  }

  const prefix = `notebook-${candidate.digest}-`;
  const matches = [];
  for (const entry of entries) {
    if (!entry.name.startsWith(prefix) || !entry.name.endsWith(".sqlite.bak")) {
      continue;
    }
    const backupPath = path.join(storagePaths.backupsDirectory, entry.name);
    let stats;
    try {
      stats = fs.lstatSync(backupPath);
    } catch (error) {
      throw stagedMigrationError(
        "candidate safety backup を検査できません",
        "STAGED_MIGRATION_BACKUP_FAILED",
        error,
      );
    }
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw stagedMigrationError(
        "candidate safety backup が regular file ではありません",
        "STAGED_MIGRATION_BACKUP_FAILED",
      );
    }
    matches.push({ path: backupPath, stats });
  }
  return matches;
}

function readRegularFileBytes(filePath, label, failureCode) {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    throw stagedMigrationError(`${label} を読み取れません`, failureCode, error);
  }
}

function createSafetyBackup(storagePaths, candidate, now) {
  const liveStats = requireExistingRegularFile(
    storagePaths.databasePath,
    "live SQLite database",
    "STAGED_MIGRATION_LIVE_DATABASE_INVALID",
  );
  const backupDirectoryStats = requireExistingDirectory(
    storagePaths.backupsDirectory,
    "managed backup directory",
    "STAGED_MIGRATION_BACKUP_FAILED",
  );
  assertSameFilesystem(liveStats, backupDirectoryStats, "live SQLite and managed backup");
  const existingBackups = findCandidateSafetyBackups(storagePaths, candidate);
  if (existingBackups.length > 1) {
    // Keep recovery fail-closed: an ambiguous candidate backup must not be pruned here.
    throw stagedMigrationError(
      "同一候補の safety backup が複数あり、再利用できません",
      "STAGED_MIGRATION_BACKUP_FAILED",
    );
  }
  if (existingBackups.length === 1) {
    const existingBackup = existingBackups[0];
    assertSameFilesystem(existingBackup.stats, liveStats, "candidate safety backup and live SQLite");
    if (existingBackup.stats.size !== liveStats.size) {
      throw stagedMigrationError(
        "既存の candidate safety backup が live SQLite と一致しません",
        "STAGED_MIGRATION_BACKUP_FAILED",
      );
    }
    const liveBytes = readRegularFileBytes(
      storagePaths.databasePath,
      "live SQLite database",
      "STAGED_MIGRATION_BACKUP_FAILED",
    );
    const backupBytes = readRegularFileBytes(
      existingBackup.path,
      "candidate safety backup",
      "STAGED_MIGRATION_BACKUP_FAILED",
    );
    if (!liveBytes.equals(backupBytes)) {
      throw stagedMigrationError(
        "既存の candidate safety backup が live SQLite と一致しません",
        "STAGED_MIGRATION_BACKUP_FAILED",
      );
    }
    const liveAfterRead = requireExistingRegularFile(
      storagePaths.databasePath,
      "live SQLite database after safety backup reuse",
      "STAGED_MIGRATION_BACKUP_FAILED",
    );
    const backupAfterRead = requireExistingRegularFile(
      existingBackup.path,
      "candidate safety backup after reuse",
      "STAGED_MIGRATION_BACKUP_FAILED",
    );
    if (
      !sameFileIdentity(liveStats, liveAfterRead)
      || liveStats.size !== liveAfterRead.size
      || !sameFileIdentity(existingBackup.stats, backupAfterRead)
      || existingBackup.stats.size !== backupAfterRead.size
    ) {
      throw stagedMigrationError(
        "safety backup 再利用中に SQLite file identity が変わりました",
        "STAGED_MIGRATION_BACKUP_FAILED",
      );
    }
    return existingBackup.path;
  }
  const backupName = `notebook-${candidate.digest}-${now}-${crypto.randomBytes(12).toString("hex")}.sqlite.bak`;
  return copyRegularFileAtomically(
    storagePaths.databasePath,
    storagePaths.backupsDirectory,
    backupName,
    "STAGED_MIGRATION_BACKUP_FAILED",
  );
}

function createStagedDatabaseCopy(candidate) {
  const migrationDirectory = path.join(
    candidate.stagingDirectory,
    DESKTOP_STAGED_MIGRATION_DIRECTORY_NAME,
  );
  try {
    requireExistingDirectory(candidate.stagingDirectory, "update staging directory");
    if (fs.existsSync(migrationDirectory)) {
      requireExistingDirectory(migrationDirectory, "database migration staging directory");
    } else {
      fs.mkdirSync(migrationDirectory, { mode: 0o700 });
    }
    requireExistingDirectory(migrationDirectory, "database migration staging directory");
    fs.accessSync(migrationDirectory, fs.constants.W_OK);
    const runDirectory = path.join(migrationDirectory, randomStagedName("run"));
    fs.mkdirSync(runDirectory, { mode: 0o700 });
    requireExistingDirectory(runDirectory, "database migration run directory");
    const stagedPath = copyRegularFileAtomically(
      path.join(candidate.stagingDirectory, "..", "live", "notebook.sqlite"),
      runDirectory,
      "notebook.sqlite",
    );
    return { runDirectory, stagedPath };
  } catch (error) {
    if (error instanceof DesktopStorageError) throw error;
    throw stagedMigrationError(
      "DB staging copy を作成できません",
      "STAGED_MIGRATION_COPY_FAILED",
      error,
    );
  }
}

function runStagedPrismaMigration(source, stagedDatabasePath, environment = process.env) {
  const result = spawnSync(
    source.nodeExecutable,
    [
      source.prismaBinary,
      "migrate",
      "deploy",
      "--config",
      source.prismaConfigPath,
    ],
    {
      cwd: source.prismaProjectRoot,
      env: {
        ...environment,
        DATABASE_URL: databasePathToUrl(stagedDatabasePath),
        PRISMA_PROVIDER: "sqlite",
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.error || result.status !== 0) {
    throw stagedMigrationError(
      "staged SQLite migration に失敗しました",
      "STAGED_MIGRATION_RUNNER_FAILED",
      result.error,
    );
  }
}

function switchStagedDatabase(storagePaths, stagedDatabasePath, liveBefore, backupPath) {
  const liveStats = requireExistingRegularFile(
    storagePaths.databasePath,
    "live SQLite database before switch",
    "STAGED_MIGRATION_SWITCH_FAILED",
  );
  if (!sameFileIdentity(liveStats, liveBefore) || liveStats.size !== liveBefore.size) {
    throw stagedMigrationError(
      "live SQLite file identity が switch 前に変わりました",
      "STAGED_MIGRATION_SWITCH_FAILED",
    );
  }
  const backupStats = requireExistingRegularFile(
    backupPath,
    "migration safety backup",
    "STAGED_MIGRATION_SWITCH_FAILED",
  );
  const stagedStats = requireExistingRegularFile(
    stagedDatabasePath,
    "staged SQLite database",
    "STAGED_MIGRATION_SWITCH_FAILED",
  );
  assertSameFilesystem(stagedStats, liveStats, "staged SQLite and live SQLite");
  assertSameFilesystem(backupStats, liveStats, "migration safety backup and live SQLite");
  try {
    fs.accessSync(storagePaths.liveDirectory, fs.constants.W_OK);
    syncDirectory(storagePaths.liveDirectory);
    fs.renameSync(stagedDatabasePath, storagePaths.databasePath);
  } catch (error) {
    throw stagedMigrationError(
      "staged SQLite atomic switch に失敗しました",
      "STAGED_MIGRATION_SWITCH_FAILED",
      error,
    );
  }
}

function runStagedUpdateMigration({
  storagePaths,
  sqliteBinary,
  environment = process.env,
  now = Math.floor(Date.now() / 1000),
} = {}) {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw stagedMigrationError(
      "staged migration timestamp が不正です",
      "STAGED_MIGRATION_STATE_INVALID",
    );
  }
  const paths = validateStoragePaths(storagePaths ?? resolveDesktopStoragePaths());
  requireCanonicalStagedStorageDirectories(paths);
  rejectSqliteSidecars(paths.databasePath, "STAGED_MIGRATION_LIVE_DATABASE_INVALID");
  const candidate = readApplyPreparationCandidate(paths);
  const source = resolveStagedMigrationSource(candidate);
  const inspection = inspectDesktopDatabase({
    storagePaths: paths,
    migrationsDirectory: source.migrationsDirectory,
    sqliteBinary,
    integrityCheck: true,
  });

  if (inspection.status === DESKTOP_DATABASE_STATUS.READY) {
    return Object.freeze({
      status: DESKTOP_STAGED_MIGRATION_STATUS.NO_PENDING,
      pendingMigrations: [],
    });
  }
  if (
    inspection.status !== DESKTOP_DATABASE_STATUS.MIGRATION_REQUIRED
    || inspection.migrationState !== DESKTOP_MIGRATION_STATE.MISSING
    || !Array.isArray(inspection.pendingMigrations)
    || inspection.pendingMigrations.length === 0
  ) {
    throw stagedMigrationError(
      "live SQLite schema は staged app と互換性がありません",
      "STAGED_MIGRATION_LIVE_DATABASE_INVALID",
    );
  }

  validateMigrationSourceDatabase(paths.databasePath, sqliteBinary);
  const beforeSnapshot = readSqliteDataSnapshot(paths.databasePath, sqliteBinary);
  const liveBefore = requireExistingRegularFile(
    paths.databasePath,
    "live SQLite database before migration",
    "STAGED_MIGRATION_LIVE_DATABASE_INVALID",
  );
  const backupPath = createSafetyBackup(paths, candidate, now);
  const staged = createStagedDatabaseCopy(candidate);
  runStagedPrismaMigration(source, staged.stagedPath, environment);
  rejectSqliteSidecars(staged.stagedPath, "STAGED_MIGRATION_REOPEN_FAILED");
  validateMigrationSourceDatabase(
    staged.stagedPath,
    sqliteBinary,
    "STAGED_MIGRATION_REOPEN_FAILED",
    "staged",
  );

  const stagedPaths = {
    ...paths,
    databasePath: staged.stagedPath,
    databaseUrl: databasePathToUrl(staged.stagedPath),
  };
  const migratedInspection = inspectDesktopDatabase({
    storagePaths: stagedPaths,
    migrationsDirectory: source.migrationsDirectory,
    sqliteBinary,
    integrityCheck: true,
  });
  if (
    migratedInspection.status !== DESKTOP_DATABASE_STATUS.READY
    || migratedInspection.migrationState !== DESKTOP_MIGRATION_STATE.COMPLETE
  ) {
    throw stagedMigrationError(
      "staged SQLite migration 後の schema validation に失敗しました",
      "STAGED_MIGRATION_REOPEN_FAILED",
    );
  }
  const afterSnapshot = readSqliteDataSnapshot(staged.stagedPath, sqliteBinary);
  compareSqliteDataSnapshots(beforeSnapshot, afterSnapshot);
  switchStagedDatabase(paths, staged.stagedPath, liveBefore, backupPath);

  return Object.freeze({
    status: DESKTOP_STAGED_MIGRATION_STATUS.SWITCHED,
    pendingMigrations: inspection.pendingMigrations,
  });
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
  nodeExecutable = DEFAULT_NODE_EXECUTABLE,
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
    integrityCheck: false,
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
      integrityCheck: false,
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
      nodeExecutable,
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
    integrityCheck: true,
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
  DESKTOP_DATABASE_NOT_A_FILE_REASON,
  DESKTOP_DATABASE_STATUS,
  DESKTOP_MIGRATION_STATE,
  DESKTOP_STAGED_MIGRATION_STATUS,
  DESKTOP_STORAGE_LAYOUT,
  DesktopStorageError,
  bootstrapDesktopStorage,
  createDesktopSidecarDatabaseEnvironment,
  databasePathToUrl,
  ensureDesktopStorageDirectories,
  inspectDesktopDatabase,
  readMigrationManifest,
  resolveDesktopStoragePaths,
  runStagedUpdateMigration,
};
