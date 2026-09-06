const fs = require("node:fs");
const crypto = require("node:crypto");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const READY_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const READY_HEALTH_PATH = "/api/desktop/health";
const READY_HEALTH_KIND = "cornell-desktop-health";
const READY_NONCE_BYTES = 32;
const MAX_HEALTH_RESPONSE_BYTES = 8 * 1024;
const LOOPBACK_HOST = "127.0.0.1";
const DESKTOP_DATA_BACKUP_PROTOCOL_VERSION = 1;
const DESKTOP_DATA_BACKUP_KIND = "desktop-data-backup-operation";
const DESKTOP_MANAGED_BACKUP_CATALOG_PROTOCOL_VERSION = 1;
const DESKTOP_MANAGED_BACKUP_CATALOG_KIND = "desktop-managed-backup-catalog";
const DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION = 1;
const DESKTOP_PENDING_RESTORE_STATUS_KIND = "desktop-pending-restore-status";
const DESKTOP_PENDING_RESTORE_RESUME_KIND = "desktop-pending-restore-resume";
const DESKTOP_BACKUP_RECOVERY_PROTOCOL_VERSION = 1;
const DESKTOP_BACKUP_RECOVERY_KIND = "desktop-backup-recovery";
const DESKTOP_BACKUP_RECOVERY_REASONS = new Set([
  "backup_configuration_invalid",
  "backup_database_unavailable",
  "backup_storage_failure",
]);
const DESKTOP_DATABASE_RECOVERY_SCHEMA_VERSION = 1;
const DESKTOP_DATABASE_RECOVERY_STATES = new Set([
  "first-run",
  "restore-available",
  "diagnostic-required",
  "restore-unavailable",
]);
const DESKTOP_DATABASE_RECOVERY_REASON_CODES = new Set([
  "database-missing",
  "database-missing-after-initialization",
  "database-not-a-file",
  "database-read-failed",
  "database-integrity-failed",
  "database-foreign-key-failed",
  "database-schema-invalid",
  "database-migration-required",
  "database-initialization-failed",
  "database-initialization-marker-invalid",
  "storage-unavailable",
]);
const DESKTOP_BOOTSTRAP_FAILURE_CODE = "bootstrap-failed";
const DESKTOP_BOOTSTRAP_FAILURE_CONTEXTS = new Set([
  "storage-options",
  "storage-bootstrap",
  "storage-bootstrap-result",
]);

let runtimeChild = null;
let shutdownPromise = null;

function projectRoot() {
  const configured = process.env.CORNELL_DESKTOP_PROJECT_ROOT?.trim();
  return configured ? path.resolve(configured) : path.resolve(__dirname, "../..");
}

function absoluteDatabaseUrl(value) {
  if (typeof value !== "string" || !value.startsWith("file:")) {
    throw new Error("DATABASE_URL must be an absolute file: URL");
  }
  const databasePath = value.slice("file:".length);
  if (!path.isAbsolute(databasePath) || databasePath.includes("?") || databasePath.includes("#")) {
    throw new Error("DATABASE_URL must contain an absolute SQLite path without a query or fragment");
  }
  return value;
}

function storageOptions(root) {
  const storage = require(path.join(root, "src/server/infrastructure/desktop-storage.js"));
  const homeDirectory = process.env.CORNELL_DESKTOP_HOME?.trim() || os.homedir();
  const applicationId = process.env.CORNELL_DESKTOP_APPLICATION_ID?.trim()
    || storage.DESKTOP_APPLICATION_ID;
  const resolvedPaths = storage.resolveDesktopStoragePaths({ homeDirectory, applicationId });
  const configuredSupportRoot = process.env.CORNELL_DESKTOP_APPLICATION_SUPPORT_ROOT?.trim();
  if (configuredSupportRoot && path.resolve(configuredSupportRoot) !== resolvedPaths.applicationSupportRoot) {
    throw new Error("CORNELL_DESKTOP_APPLICATION_SUPPORT_ROOT does not match the approved Application Support path");
  }
  const nodeExecutable = process.execPath;
  const prismaBinary = path.join(root, "node_modules", "prisma", "build", "index.js");
  return {
    storage,
    homeDirectory,
    storagePaths: resolvedPaths,
    nodeExecutable,
    migrationsDirectory: path.join(root, "prisma", "migrations"),
    prismaSchemaPath: path.join(root, "prisma", "schema.prisma"),
    prismaBinary,
    prismaConfigPath: path.join(root, "prisma.config.ts"),
    prismaProjectRoot: root,
  };
}

function unavailableDatabaseRecoverySnapshot() {
  return {
    schemaVersion: DESKTOP_DATABASE_RECOVERY_SCHEMA_VERSION,
    state: "diagnostic-required",
    reasonCode: "storage-unavailable",
    managedBackupAvailable: false,
    pendingRestoreAvailable: false,
    canStartEmpty: false,
  };
}

function sanitizeDatabaseRecoverySnapshot(snapshot) {
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return unavailableDatabaseRecoverySnapshot();
  }
  const keys = [
    "schemaVersion",
    "state",
    "reasonCode",
    "managedBackupAvailable",
    "pendingRestoreAvailable",
    "canStartEmpty",
  ];
  if (Object.keys(snapshot).length !== keys.length
    || keys.some((key) => !Object.hasOwn(snapshot, key))) {
    return unavailableDatabaseRecoverySnapshot();
  }
  if (snapshot.schemaVersion !== DESKTOP_DATABASE_RECOVERY_SCHEMA_VERSION
    || !DESKTOP_DATABASE_RECOVERY_STATES.has(snapshot.state)
    || !DESKTOP_DATABASE_RECOVERY_REASON_CODES.has(snapshot.reasonCode)
    || typeof snapshot.managedBackupAvailable !== "boolean"
    || typeof snapshot.pendingRestoreAvailable !== "boolean"
    || typeof snapshot.canStartEmpty !== "boolean"
    || (snapshot.state === "first-run" && snapshot.canStartEmpty !== true)
    || (snapshot.state !== "first-run" && snapshot.canStartEmpty !== false)) {
    return unavailableDatabaseRecoverySnapshot();
  }
  if (snapshot.state === "restore-available"
    && !snapshot.managedBackupAvailable
    && !snapshot.pendingRestoreAvailable) {
    return unavailableDatabaseRecoverySnapshot();
  }
  if (snapshot.state === "restore-unavailable"
    && (snapshot.managedBackupAvailable || snapshot.pendingRestoreAvailable)) {
    return unavailableDatabaseRecoverySnapshot();
  }
  return {
    schemaVersion: snapshot.schemaVersion,
    state: snapshot.state,
    reasonCode: snapshot.reasonCode,
    managedBackupAvailable: snapshot.managedBackupAvailable,
    pendingRestoreAvailable: snapshot.pendingRestoreAvailable,
    canStartEmpty: snapshot.canStartEmpty,
  };
}

function bootstrapRecoveryMessage(snapshot) {
  return {
    kind: "bootstrap",
    status: "recovery",
    recoverySnapshot: sanitizeDatabaseRecoverySnapshot(snapshot),
  };
}

function bootstrapFailureMessage(context) {
  return {
    kind: "bootstrap",
    status: "failed",
    code: DESKTOP_BOOTSTRAP_FAILURE_CODE,
    context: DESKTOP_BOOTSTRAP_FAILURE_CONTEXTS.has(context)
      ? context
      : "storage-bootstrap",
  };
}

function reportBootstrapFailure(context) {
  process.stdout.write(`${JSON.stringify(bootstrapFailureMessage(context))}\n`);
  process.exitCode = 1;
  return null;
}

function bootstrap() {
  let root;
  let options;
  try {
    root = projectRoot();
    options = storageOptions(root);
  } catch {
    return reportBootstrapFailure("storage-options");
  }

  let result;
  try {
    result = options.storage.bootstrapDesktopStorage({
      storagePaths: options.storagePaths,
      nodeExecutable: options.nodeExecutable,
      migrationsDirectory: options.migrationsDirectory,
      prismaBinary: options.prismaBinary,
      prismaConfigPath: options.prismaConfigPath,
      prismaProjectRoot: options.prismaProjectRoot,
      environment: process.env,
    });
  } catch {
    return reportBootstrapFailure("storage-bootstrap");
  }

  if (result === null || typeof result !== "object" || Array.isArray(result)
    || typeof result.status !== "string"
    || !Object.values(options.storage.DESKTOP_DATABASE_STATUS).includes(result.status)) {
    return reportBootstrapFailure("storage-bootstrap-result");
  }

  const recoverySnapshot = result.recoverySnapshot === null
    || result.recoverySnapshot === undefined
    ? null
    : sanitizeDatabaseRecoverySnapshot(result.recoverySnapshot);
  if (result.status !== options.storage.DESKTOP_DATABASE_STATUS.READY) {
    process.stdout.write(`${JSON.stringify(bootstrapRecoveryMessage(recoverySnapshot))}\n`);
    return result;
  }

  process.stdout.write(`${JSON.stringify({
    kind: "bootstrap",
    status: "ready",
    applicationSupportRoot: result.applicationSupportRoot,
    liveDirectory: result.liveDirectory,
    databasePath: result.databasePath,
    databaseUrl: result.databaseUrl,
    backupsDirectory: result.backupsDirectory,
    settingsDirectory: result.settingsDirectory,
    logsDirectory: result.logsDirectory,
    pendingRestoreDirectory: result.pendingRestoreDirectory,
    reason: result.reason,
    created: result.created,
    recoverySnapshot,
  })}\n`);

  return result;
}

function storagePathMessage(options, kind = "storage-paths") {
  const paths = options.storagePaths;
  return {
    kind,
    status: "paths",
    applicationSupportRoot: paths.applicationSupportRoot,
    liveDirectory: paths.liveDirectory,
    databasePath: paths.databasePath,
    databaseUrl: paths.databaseUrl,
    backupsDirectory: paths.backupsDirectory,
    settingsDirectory: paths.settingsDirectory,
    logsDirectory: paths.logsDirectory,
    pendingRestoreDirectory: paths.pendingRestoreDirectory,
  };
}

function printStoragePaths() {
  const root = projectRoot();
  const options = storageOptions(root);
  process.stdout.write(`${JSON.stringify(storagePathMessage(options))}\n`);
  return options.storagePaths;
}

function stagedMigrate() {
  const root = projectRoot();
  const options = storageOptions(root);
  try {
    const result = options.storage.runStagedUpdateMigration({
      storagePaths: options.storagePaths,
      sqliteBinary: process.env.SQLITE3_BIN,
      environment: process.env,
    });
    process.stdout.write(`${JSON.stringify({
      kind: "staged-migration",
      status: result.status,
      pendingMigrations: result.pendingMigrations,
    })}\n`);
    return result;
  } catch (error) {
    const code = error && typeof error === "object" && typeof error.code === "string"
      ? error.code
      : "STAGED_MIGRATION_FAILED";
    process.stdout.write(`${JSON.stringify({
      kind: "staged-migration",
      status: "failed",
      code,
    })}\n`);
    process.exitCode = 1;
    return null;
  }
}

function validateDatabase() {
  const root = projectRoot();
  const options = storageOptions(root);
  const result = options.storage.inspectDesktopDatabase({
    storagePaths: options.storagePaths,
    migrationsDirectory: options.migrationsDirectory,
    sqliteBinary: process.env.SQLITE3_BIN,
    integrityCheck: true,
  });
  process.stdout.write(`${JSON.stringify({
    kind: "database-validation",
    status: result.status,
    reason: result.reason,
  })}\n`);
  if (result.status !== options.storage.DESKTOP_DATABASE_STATUS.READY) {
    process.exitCode = 1;
    return null;
  }
  return result;
}

function backupRecoveryResponse(status, errorCode = null, recoverySnapshot = null) {
  return {
    kind: DESKTOP_BACKUP_RECOVERY_KIND,
    schemaVersion: DESKTOP_BACKUP_RECOVERY_PROTOCOL_VERSION,
    status,
    phase: "preflight",
    errorCode,
    recoverySnapshot,
  };
}

function backupRecoveryReasonCode(reason) {
  const directReasons = new Set([
    "database-missing",
    "database-missing-after-initialization",
    "database-not-a-file",
    "database-read-failed",
    "database-integrity-failed",
    "database-foreign-key-failed",
    "database-schema-invalid",
    "database-migration-required",
    "database-initialization-failed",
    "database-initialization-marker-invalid",
    "storage-unavailable",
  ]);
  if (directReasons.has(reason)) return reason;
  return {
    "database-stat-failed": "database-read-failed",
    "database-open-failed": "database-read-failed",
    "integrity-check-failed": "database-integrity-failed",
    "foreign-key-check-failed": "database-foreign-key-failed",
    "schema-read-failed": "database-schema-invalid",
    "migration-table-missing": "database-schema-invalid",
    "migration-table-read-failed": "database-schema-invalid",
    "migration-table-invalid": "database-schema-invalid",
    "migration-state-read-failed": "database-schema-invalid",
    "migration-state-invalid": "database-schema-invalid",
    "migration-history-duplicate": "database-schema-invalid",
    "migration-history-unknown": "database-schema-invalid",
    "migration-history-gap": "database-schema-invalid",
    "migration-checksum-mismatch": "database-schema-invalid",
    "required-table-missing": "database-schema-invalid",
    "migration-source-unavailable": "database-schema-invalid",
    "database-undeterminable": "database-read-failed",
    "migration-incomplete": "database-migration-required",
    "migration-missing": "database-migration-required",
  }[reason] || "database-read-failed";
}

function inspectBackupStorageDirectory(options) {
  for (const directoryPath of [
    options.storagePaths.applicationSupportRoot,
    options.storagePaths.liveDirectory,
    options.storagePaths.backupsDirectory,
  ]) {
    const stats = fs.lstatSync(directoryPath);
    if (stats.isSymbolicLink() || !stats.isDirectory()) return false;
  }
  fs.readdirSync(options.storagePaths.backupsDirectory);
  fs.accessSync(
    options.storagePaths.backupsDirectory,
    fs.constants.R_OK | fs.constants.W_OK,
  );
  options.storage.listManagedBackupCatalog({
    storagePaths: options.storagePaths,
  });
  return true;
}

function backupRecoverySnapshot(options, inspection) {
  let managedBackupAvailable = false;
  let pendingRestoreAvailable = false;
  try {
    const catalog = options.storage.listManagedBackupCatalog({
      storagePaths: options.storagePaths,
    });
    managedBackupAvailable = catalog.status === "ready" && catalog.backups.length > 0;
  } catch {
    // An unreadable catalog is not a trusted recovery source.
  }
  try {
    const pending = options.storage.inspectPendingRestore({
      storagePaths: options.storagePaths,
      sqliteBinary: process.env.SQLITE3_BIN,
      migrationsDirectory: options.migrationsDirectory,
    });
    pendingRestoreAvailable = pending.status === "available";
  } catch {
    // Pending restore is available only after its existing validation passes.
  }
  const reasonCode = backupRecoveryReasonCode(inspection.reason);
  const state = managedBackupAvailable || pendingRestoreAvailable
    ? "restore-available"
    : reasonCode === "database-missing-after-initialization"
      ? "restore-unavailable"
      : "diagnostic-required";
  return {
    schemaVersion: DESKTOP_DATABASE_RECOVERY_SCHEMA_VERSION,
    state,
    reasonCode,
    managedBackupAvailable,
    pendingRestoreAvailable,
    canStartEmpty: false,
  };
}

function attemptBackupRecovery(rawRequest) {
  let request;
  try {
    request = JSON.parse(rawRequest);
  } catch {
    return backupRecoveryResponse("not-recovered", "invalid-request");
  }
  if (!isRecord(request)
    || !hasExactKeys(request, ["kind", "schemaVersion", "reason"])
    || request.kind !== DESKTOP_BACKUP_RECOVERY_KIND
    || request.schemaVersion !== DESKTOP_BACKUP_RECOVERY_PROTOCOL_VERSION
    || !DESKTOP_BACKUP_RECOVERY_REASONS.has(request.reason)) {
    return backupRecoveryResponse("not-recovered", "invalid-request");
  }

  let options;
  try {
    options = storageOptions(projectRoot());
  } catch {
    return backupRecoveryResponse("not-recovered", "storage-unavailable");
  }

  let inspection;
  try {
    inspection = options.storage.inspectDesktopDatabase({
      storagePaths: options.storagePaths,
      migrationsDirectory: options.migrationsDirectory,
      sqliteBinary: process.env.SQLITE3_BIN,
      integrityCheck: true,
    });
  } catch {
    return backupRecoveryResponse("not-recovered", "database-unavailable");
  }

  let storageIsUsable = false;
  try {
    storageIsUsable = inspectBackupStorageDirectory(options);
  } catch {
    storageIsUsable = false;
  }
  if (request.reason === "backup_storage_failure" && !storageIsUsable) {
    return backupRecoveryResponse("not-recovered", "storage-unavailable");
  }

  if (inspection.status === options.storage.DESKTOP_DATABASE_STATUS.READY) {
    if (!storageIsUsable) {
      return backupRecoveryResponse("not-recovered", "storage-unavailable");
    }
    return backupRecoveryResponse("ready");
  }

  // This command is called from an already running installation. It must not
  // turn an initialization-required state into a new empty database.
  if (request.reason === "backup_storage_failure") {
    return backupRecoveryResponse("not-recovered", "storage-unavailable");
  }
  if (inspection.status === options.storage.DESKTOP_DATABASE_STATUS.INITIALIZATION_REQUIRED) {
    return backupRecoveryResponse("not-recovered", "database-unavailable");
  }

  return backupRecoveryResponse(
    "recovery-required",
    null,
    backupRecoverySnapshot(options, inspection),
  );
}

function operationResponse(
  operation,
  ok,
  status,
  phase,
  errorCode = null,
  result = null,
) {
  return {
    kind: DESKTOP_DATA_BACKUP_KIND,
    schemaVersion: DESKTOP_DATA_BACKUP_PROTOCOL_VERSION,
    ok,
    status,
    operation: operation ?? null,
    phase,
    errorCode,
    result,
  };
}

function operationError(operation, phase, errorCode) {
  return operationResponse(operation, false, "error", phase, errorCode);
}

function operationSuccess(operation, result) {
  return operationResponse(operation, true, "success", "complete", null, result);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return isRecord(value) && Object.keys(value).every((key) => keys.includes(key));
}

function hasExactKeys(value, keys) {
  return hasOnlyKeys(value, keys) && Object.keys(value).length === keys.length;
}

function isSafeIdentifier(value, maxLength = 128) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maxLength
    && value !== "."
    && value !== ".."
    && /^[A-Za-z0-9._-]+$/.test(value);
}

function isManagedBackupCatalogTimestamp(value) {
  if (
    typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isManagedBackupCatalogEntry(value) {
  return isRecord(value)
    && hasExactKeys(value, ["backupId", "fileName", "size", "createdAt", "recoveryOnly"])
    && isSafeIdentifier(value.backupId)
    && value.fileName === value.backupId
    && Number.isSafeInteger(value.size)
    && value.size >= 0
    && isManagedBackupCatalogTimestamp(value.createdAt)
    && typeof value.recoveryOnly === "boolean";
}

function validateManagedBackupCatalogResult(value) {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ["status", "backups"])
    || !["ready", "empty"].includes(value.status)
    || !Array.isArray(value.backups)
  ) {
    throw new Error("invalid managed backup catalog");
  }

  const identifiers = new Set();
  for (const entry of value.backups) {
    if (!isManagedBackupCatalogEntry(entry) || identifiers.has(entry.backupId)) {
      throw new Error("invalid managed backup catalog");
    }
    identifiers.add(entry.backupId);
  }
  if (value.backups.some((entry, index) => {
    if (index === 0) return false;
    const previous = value.backups[index - 1];
    return previous.createdAt < entry.createdAt
      || (previous.createdAt === entry.createdAt && previous.backupId > entry.backupId);
  })) {
    throw new Error("invalid managed backup catalog order");
  }
  if (
    (value.status === "ready" && value.backups.length === 0)
    || (value.status === "empty" && value.backups.length !== 0)
  ) {
    throw new Error("inconsistent managed backup catalog");
  }
  return value;
}

function managedBackupCatalogResponse(status, backups = [], errorCode = null) {
  return {
    kind: DESKTOP_MANAGED_BACKUP_CATALOG_KIND,
    schemaVersion: DESKTOP_MANAGED_BACKUP_CATALOG_PROTOCOL_VERSION,
    status,
    phase: "catalog",
    errorCode,
    backups,
  };
}

function managedBackupCatalogErrorCode(error) {
  if (error && typeof error === "object" && typeof error.code === "string") {
    if (error.code === "MANAGED_BACKUP_CATALOG_STORAGE_UNAVAILABLE") {
      return "storage-unavailable";
    }
    if (error.code === "MANAGED_BACKUP_CATALOG_INVALID") {
      return "invalid-catalog";
    }
  }
  return "invalid-catalog";
}

function managedBackupCatalog() {
  const root = projectRoot();
  let options;
  try {
    options = storageOptions(root);
  } catch {
    return managedBackupCatalogResponse("error", [], "storage-unavailable");
  }

  try {
    const result = validateManagedBackupCatalogResult(
      options.storage.listManagedBackupCatalog({
        storagePaths: options.storagePaths,
      }),
    );
    return managedBackupCatalogResponse(result.status, result.backups);
  } catch (error) {
    return managedBackupCatalogResponse(
      "error",
      [],
      managedBackupCatalogErrorCode(error),
    );
  }
}

function pathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === ""
    || (relative !== ".."
      && !relative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relative));
}

function validateExternalFilePath(value, applicationSupportRoot, requiresExistingFile) {
  if (typeof value !== "string" || value.length === 0) {
    return "invalid-path";
  }
  if (value.length > 4_096 || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) {
    return "invalid-path";
  }
  if (!path.isAbsolute(value)) {
    return "relative-path";
  }
  if (path.normalize(value) !== value || pathWithin(applicationSupportRoot, value)) {
    return pathWithin(applicationSupportRoot, value) ? "managed-path" : "unsafe-path";
  }

  const parsed = path.parse(value);
  const components = value.slice(parsed.root.length).split(path.sep);
  if (components.length === 0 || components.some((component) => component === "" || component === "." || component === "..")) {
    return "unsafe-path";
  }

  let current = parsed.root;
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    current = path.join(current, component);
    const isLeaf = index === components.length - 1;
    let metadata;
    try {
      metadata = fs.lstatSync(current);
    } catch (error) {
      if (error && error.code === "ENOENT" && isLeaf && !requiresExistingFile) {
        return null;
      }
      if (error && error.code === "ENOENT") {
        return "path-not-found";
      }
      return "path-unavailable";
    }
    if (metadata.isSymbolicLink()) {
      return "symlink-path";
    }
    if (!isLeaf && !metadata.isDirectory()) {
      return "path-unavailable";
    }
    if (isLeaf && metadata.isFile() && !requiresExistingFile) {
      return "destination-exists";
    }
    if (isLeaf && !metadata.isFile()) {
      return "path-not-file";
    }
  }
  return null;
}

function validateExternalLocation(value, applicationSupportRoot, requiresExistingFile) {
  if (!hasExactKeys(value, ["kind", "origin", "path"]) || value.kind !== "external-file" || value.origin !== "native-dialog") {
    return "invalid-request";
  }
  return validateExternalFilePath(value.path, applicationSupportRoot, requiresExistingFile);
}

function validateDesktopDataBackupOperationRequest(value, applicationSupportRoot) {
  if (!hasOnlyKeys(value, [
    "kind",
    "schemaVersion",
    "operation",
    "source",
    "destination",
    "confirmed",
    "operationId",
    "recoveryOnly",
  ])
    || !["kind", "schemaVersion", "operation", "source", "destination"].every(
      (key) => Object.hasOwn(value, key),
    )
    || value.kind !== DESKTOP_DATA_BACKUP_KIND
    || value.schemaVersion !== DESKTOP_DATA_BACKUP_PROTOCOL_VERSION
    || !["export", "restore", "delete"].includes(value.operation)
    || !(value.source === null || isRecord(value.source))
    || !(value.destination === null || isRecord(value.destination))
    || (value.confirmed !== undefined && typeof value.confirmed !== "boolean")
    || (value.operationId !== undefined && !isSafeIdentifier(value.operationId, 128))
    || (value.recoveryOnly !== undefined && typeof value.recoveryOnly !== "boolean")) {
    return { ok: false, errorCode: "invalid-request", operation: null };
  }

  const operation = value.operation;
  if (operation === "export") {
    if (value.source !== null || value.destination === null || value.recoveryOnly !== undefined) {
      return { ok: false, errorCode: "invalid-request", operation };
    }
    const errorCode = validateExternalLocation(value.destination, applicationSupportRoot, false);
    return errorCode
      ? { ok: false, errorCode, operation }
      : { ok: true, operation };
  }

  if (operation === "restore") {
    if (value.source === null || value.destination !== null) {
      return { ok: false, errorCode: "invalid-request", operation };
    }
    if (value.source.kind === "managed-backup") {
      if (!hasExactKeys(value.source, ["kind", "backupId"])) {
        return { ok: false, errorCode: "invalid-request", operation };
      }
      if (!isSafeIdentifier(value.source.backupId)) {
        return { ok: false, errorCode: "managed-source-invalid", operation };
      }
      return value.confirmed === true
        ? { ok: true, operation }
        : { ok: false, errorCode: "confirmation-required", operation };
    }
    if (value.source.kind === "external-file") {
      if (!hasExactKeys(value.source, ["kind", "origin", "path"])) {
        return { ok: false, errorCode: "invalid-request", operation };
      }
      const errorCode = validateExternalLocation(value.source, applicationSupportRoot, true);
      if (errorCode) return { ok: false, errorCode, operation };
      return value.confirmed === true
        ? { ok: true, operation }
        : { ok: false, errorCode: "confirmation-required", operation };
    }
    return { ok: false, errorCode: "invalid-request", operation };
  }

  if (value.source !== null || value.destination !== null || value.recoveryOnly !== undefined) {
    return { ok: false, errorCode: "invalid-request", operation };
  }
  return value.confirmed === true
    ? { ok: true, operation }
    : { ok: false, errorCode: "confirmation-required", operation };
}

function exportOperationErrorCode(error) {
  const code = error && typeof error === "object" && typeof error.code === "string"
    ? error.code
    : "";
  return {
    EXPORT_INVALID_PATH: "invalid-path",
    EXPORT_RELATIVE_PATH: "relative-path",
    EXPORT_UNSAFE_PATH: "unsafe-path",
    EXPORT_MANAGED_PATH: "managed-path",
    EXPORT_SYMLINK_PATH: "symlink-path",
    EXPORT_PATH_UNAVAILABLE: "path-unavailable",
    EXPORT_PATH_NOT_FILE: "path-not-file",
    EXPORT_PATH_NOT_FOUND: "path-not-found",
    EXPORT_DESTINATION_EXISTS: "destination-exists",
    EXPORT_DESTINATION_UNAVAILABLE: "destination-unavailable",
    EXPORT_SOURCE_INVALID: "invalid-live-database",
    EXPORT_SOURCE_CHANGED: "source-changed",
    EXPORT_BACKUP_FAILED: "backup-failed",
    EXPORT_TEMP_CREATE_FAILED: "backup-failed",
    EXPORT_INTEGRITY_CHECK_FAILED: "integrity-check-failed",
    EXPORT_FOREIGN_KEY_CHECK_FAILED: "foreign-key-check-failed",
    EXPORT_SCHEMA_INVALID: "schema-read-back-failed",
    EXPORT_READ_BACK_FAILED: "read-back-failed",
    EXPORT_PUBLISH_RACE: "publish-race",
    EXPORT_PUBLISH_FAILED: "publish-failed",
    EXPORT_CLEANUP_FAILED: "cleanup-failed",
  }[code] || "backup-failed";
}

function restoreOperationErrorCode(error) {
  const code = error && typeof error === "object" && typeof error.code === "string"
    ? error.code
    : "";
  return {
    RESTORE_SOURCE_INVALID: "source-invalid",
    RESTORE_SOURCE_NOT_FOUND: "path-not-found",
    RESTORE_MANAGED_SOURCE_INVALID: "managed-source-invalid",
    RESTORE_INVALID_PATH: "invalid-path",
    RESTORE_RELATIVE_PATH: "relative-path",
    RESTORE_UNSAFE_PATH: "unsafe-path",
    RESTORE_MANAGED_PATH: "managed-path",
    RESTORE_SYMLINK_PATH: "symlink-path",
    RESTORE_PATH_UNAVAILABLE: "path-unavailable",
    RESTORE_PATH_NOT_FILE: "path-not-file",
    RESTORE_SOURCE_CHANGED: "source-changed",
    RESTORE_STAGING_FAILED: "staging-failed",
    RESTORE_INTEGRITY_CHECK_FAILED: "integrity-check-failed",
    RESTORE_FOREIGN_KEY_CHECK_FAILED: "foreign-key-check-failed",
    RESTORE_SCHEMA_INVALID: "schema-read-back-failed",
    RESTORE_SCHEMA_MISMATCH: "schema-mismatch",
    RESTORE_NEWER_SCHEMA_PENDING_REQUIRED: "newer-schema-pending-required",
    RESTORE_REQUIRED_DATA_INVALID: "required-data-invalid",
    RESTORE_MARKDOWN_INVALID: "markdown-invalid",
    RESTORE_CANVAS_INVALID: "canvas-invalid",
    RESTORE_SEARCH_TEXT_MISMATCH: "search-text-mismatch",
    RESTORE_READ_BACK_FAILED: "read-back-failed",
    RESTORE_MIGRATION_FAILED: "migration-failed",
    RESTORE_LIVE_DATABASE_INVALID: "invalid-live-database",
    RESTORE_BACKUP_FAILED: "backup-failed",
    RESTORE_SWITCH_FAILED: "switch-failed",
    RESTORE_REOPEN_FAILED: "reopen-failed",
    RESTORE_ROLLBACK_FAILED: "rollback-failed",
    RESTORE_CLEANUP_FAILED: "cleanup-failed",
    RESTORE_PENDING_CONFLICT: "pending-conflict",
    RESTORE_PENDING_PUBLISH_FAILED: "pending-publish-failed",
    RESTORE_PENDING_PUBLISH_RACE: "pending-publish-race",
  }[code] || "restore-failed";
}

function restoreOperationPhase(error) {
  const code = error && typeof error === "object" && typeof error.code === "string"
    ? error.code
    : "";
  if (
    code === "RESTORE_NEWER_SCHEMA_PENDING_REQUIRED"
    || code.startsWith("RESTORE_SOURCE")
    || code.startsWith("RESTORE_SCHEMA")
    || code.startsWith("RESTORE_REQUIRED")
    || code.startsWith("RESTORE_MARKDOWN")
    || code.startsWith("RESTORE_CANVAS")
    || code.startsWith("RESTORE_SEARCH")
    || code.startsWith("RESTORE_INTEGRITY")
    || code.startsWith("RESTORE_FOREIGN")
    || code.startsWith("RESTORE_STAGING")
    || code === "RESTORE_MIGRATION_FAILED"
  ) {
    return "validation";
  }
  return "operation";
}

function deleteOperationErrorCode(error) {
  const code = error && typeof error === "object" && typeof error.code === "string"
    ? error.code
    : "";
  return {
    DELETE_INVALID_OPERATION_ID: "invalid-request",
    DELETE_INVALID_PATH: "invalid-path",
    DELETE_LAYOUT_INVALID: "layout-invalid",
    DELETE_SYMLINK_PATH: "symlink-path",
    DELETE_PERMISSION_FAILED: "permission-failed",
    DELETE_UNSAFE_NAME: "unsafe-name",
    DELETE_UNEXPECTED_DIRECTORY: "unexpected-directory",
    DELETE_SPECIAL_FILE: "special-file",
    DELETE_PRECHECK_FAILED: "preflight-failed",
    DELETE_STAGING_CONFLICT: "staging-conflict",
    DELETE_STAGING_FAILED: "staging-failed",
    DELETE_SOURCE_CHANGED: "source-changed",
    DELETE_PARTIAL: "partial-delete",
    DELETE_CLEANUP_REQUIRED: "cleanup-required",
    DELETE_ROLLBACK_FAILED: "rollback-failed",
    DELETE_OPERATION_FAILED: "delete-failed",
  }[code] || "delete-failed";
}

function deleteOperationPhase(error) {
  const code = error && typeof error === "object" && typeof error.code === "string"
    ? error.code
    : "";
  if (
    code === "DELETE_INVALID_OPERATION_ID"
    || code === "DELETE_INVALID_PATH"
    || code === "DELETE_LAYOUT_INVALID"
    || code === "DELETE_SYMLINK_PATH"
    || code === "DELETE_PERMISSION_FAILED"
    || code === "DELETE_UNSAFE_NAME"
    || code === "DELETE_UNEXPECTED_DIRECTORY"
    || code === "DELETE_SPECIAL_FILE"
    || code === "DELETE_PRECHECK_FAILED"
    || code === "DELETE_STAGING_CONFLICT"
  ) {
    return "validation";
  }
  return "operation";
}

function pendingRestoreStatusErrorCode(errorCode) {
  return {
    "pending-unavailable": "pending-unavailable",
    "pending-invalid": "pending-invalid",
    "pending-multiple": "pending-multiple",
    "pending-extra-entry": "pending-extra-entry",
    "pending-manifest-mismatch": "pending-manifest-mismatch",
    "pending-cleanup-required": "pending-cleanup-required",
  }[errorCode] || "pending-invalid";
}

function pendingRestoreResponse({
  ok,
  status,
  phase,
  operationId = null,
  pendingId = null,
  errorCode = null,
  result = null,
}) {
  return {
    kind: DESKTOP_PENDING_RESTORE_RESUME_KIND,
    schemaVersion: DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION,
    ok,
    status,
    phase,
    operationId,
    pendingId,
    errorCode,
    result,
  };
}

function isPendingRestoreToken(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function validatePendingRestoreResumeRequest(value) {
  if (!hasOnlyKeys(value, [
    "kind",
    "schemaVersion",
    "pendingId",
    "manifestToken",
    "confirmed",
    "operationId",
    "recoveryOnly",
  ])
    || !["kind", "schemaVersion", "pendingId", "manifestToken", "confirmed", "operationId"]
      .every((key) => Object.hasOwn(value, key))
    || value.kind !== DESKTOP_PENDING_RESTORE_RESUME_KIND
    || value.schemaVersion !== DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION
    || !isPendingRestoreToken(value.pendingId)
    || !isPendingRestoreToken(value.manifestToken)
    || !isSafeIdentifier(value.operationId, 128)
    || (value.recoveryOnly !== undefined && typeof value.recoveryOnly !== "boolean")) {
    return { ok: false, errorCode: "invalid-request" };
  }
  if (value.confirmed !== true) return { ok: false, errorCode: "confirmation-required" };
  return { ok: true };
}

function pendingRestoreResumeErrorCode(error) {
  const code = error && typeof error === "object" && typeof error.code === "string"
    ? error.code
    : "";
  return {
    RESTORE_PENDING_CONFIRMATION_REQUIRED: "confirmation-required",
    RESTORE_PENDING_NOT_FOUND: "pending-not-found",
    RESTORE_PENDING_INVALID: "pending-invalid",
    RESTORE_PENDING_ID_MISMATCH: "pending-id-mismatch",
    RESTORE_PENDING_MANIFEST_MISMATCH: "pending-manifest-mismatch",
    RESTORE_PENDING_RACE: "pending-race",
    RESTORE_PENDING_CLEANUP_REQUIRED: "pending-cleanup-required",
    RESTORE_PENDING_CONFLICT: "pending-conflict",
    RESTORE_PENDING_PUBLISH_FAILED: "pending-publish-failed",
    RESTORE_PENDING_PUBLISH_RACE: "pending-publish-race",
  }[code] || restoreOperationErrorCode(error);
}

function pendingRestoreResumePhase(error) {
  const code = error && typeof error === "object" && typeof error.code === "string"
    ? error.code
    : "";
  if (code.startsWith("RESTORE_PENDING_")
    || code.startsWith("RESTORE_SOURCE")
    || code.startsWith("RESTORE_SCHEMA")
    || code.startsWith("RESTORE_REQUIRED")
    || code.startsWith("RESTORE_MARKDOWN")
    || code.startsWith("RESTORE_CANVAS")
    || code.startsWith("RESTORE_SEARCH")
    || code.startsWith("RESTORE_INTEGRITY")
    || code.startsWith("RESTORE_FOREIGN")
    || code.startsWith("RESTORE_STAGING")
    || code === "RESTORE_MIGRATION_FAILED"
    || code === "RESTORE_NEWER_SCHEMA_PENDING_REQUIRED") {
    return "validation";
  }
  return "operation";
}

function pendingRestoreStatus() {
  const root = projectRoot();
  let options;
  try {
    options = storageOptions(root);
  } catch {
    return {
      kind: DESKTOP_PENDING_RESTORE_STATUS_KIND,
      schemaVersion: DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION,
      status: "invalid",
      phase: "status",
      operationId: null,
      errorCode: "pending-unavailable",
      pending: null,
    };
  }
  try {
    const result = options.storage.inspectPendingRestore({
      storagePaths: options.storagePaths,
      sqliteBinary: process.env.SQLITE3_BIN,
      migrationsDirectory: options.migrationsDirectory,
    });
    return {
      kind: DESKTOP_PENDING_RESTORE_STATUS_KIND,
      schemaVersion: DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION,
      status: result.status,
      phase: "status",
      operationId: null,
      errorCode: result.status === "invalid"
        ? pendingRestoreStatusErrorCode(result.errorCode)
        : null,
      pending: result.pending,
    };
  } catch {
    return {
      kind: DESKTOP_PENDING_RESTORE_STATUS_KIND,
      schemaVersion: DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION,
      status: "invalid",
      phase: "status",
      operationId: null,
      errorCode: "pending-invalid",
      pending: null,
    };
  }
}

async function pendingRestoreResume(rawRequest) {
  let request;
  try {
    request = JSON.parse(rawRequest);
  } catch {
    return pendingRestoreResponse({
      ok: false,
      status: "error",
      phase: "request",
      errorCode: "malformed-json",
    });
  }
  const validation = validatePendingRestoreResumeRequest(request);
  if (!validation.ok) {
    return pendingRestoreResponse({
      ok: false,
      status: "error",
      phase: "validation",
      operationId: isSafeIdentifier(request?.operationId, 128) ? request.operationId : null,
      pendingId: isPendingRestoreToken(request?.pendingId) ? request.pendingId : null,
      errorCode: validation.errorCode,
    });
  }
  const root = projectRoot();
  let options;
  try {
    options = storageOptions(root);
  } catch {
    return pendingRestoreResponse({
      ok: false,
      status: "error",
      phase: "request",
      operationId: request.operationId,
      pendingId: request.pendingId,
      errorCode: "storage-unavailable",
    });
  }
  try {
    const result = await options.storage.resumePendingRestore({
      storagePaths: options.storagePaths,
      pendingId: request.pendingId,
      manifestToken: request.manifestToken,
      confirmed: true,
      sqliteBinary: process.env.SQLITE3_BIN,
      migrationsDirectory: options.migrationsDirectory,
      nodeExecutable: options.nodeExecutable,
      prismaBinary: options.prismaBinary,
      prismaConfigPath: options.prismaConfigPath,
      prismaProjectRoot: options.prismaProjectRoot,
      prismaSchemaPath: options.prismaSchemaPath,
      environment: process.env,
      operationId: request.operationId,
      recoveryOnly: request.recoveryOnly === true,
    });
    return pendingRestoreResponse({
      ok: true,
      status: "success",
      phase: "complete",
      operationId: result.operationId,
      pendingId: request.pendingId,
      result: {
        safetyBackupId: result.safetyBackupId,
        size: result.size,
      },
    });
  } catch (error) {
    return pendingRestoreResponse({
      ok: false,
      status: "error",
      phase: pendingRestoreResumePhase(error),
      operationId: request.operationId,
      pendingId: request.pendingId,
      errorCode: pendingRestoreResumeErrorCode(error),
    });
  }
}

async function dataBackupOperation(rawRequest) {
  if (typeof rawRequest !== "string" || rawRequest.length === 0) {
    const response = operationError(null, "request", "malformed-json");
    process.stdout.write(`${JSON.stringify(response)}\n`);
    return response;
  }

  let request;
  try {
    request = JSON.parse(rawRequest);
  } catch {
    const response = operationError(null, "request", "malformed-json");
    process.stdout.write(`${JSON.stringify(response)}\n`);
    return response;
  }

  const root = projectRoot();
  let options;
  try {
    options = storageOptions(root);
  } catch {
    const response = operationError(null, "request", "storage-unavailable");
    process.stdout.write(`${JSON.stringify(response)}\n`);
    return response;
  }
  const validation = validateDesktopDataBackupOperationRequest(
    request,
    options.storagePaths.applicationSupportRoot,
  );
  if (!validation.ok) {
    const response = operationError(validation.operation, "validation", validation.errorCode);
    process.stdout.write(`${JSON.stringify(response)}\n`);
    return response;
  }

  if (validation.operation === "delete") {
    try {
      await options.storage.deleteDesktopData({
        storagePaths: options.storagePaths,
        operationId: request.operationId,
      });
      const response = operationSuccess(validation.operation, null);
      process.stdout.write(`${JSON.stringify(response)}\n`);
      return response;
    } catch (error) {
      const response = operationError(
        validation.operation,
        deleteOperationPhase(error),
        deleteOperationErrorCode(error),
      );
      process.stdout.write(`${JSON.stringify(response)}\n`);
      return response;
    }
  }

  if (validation.operation === "restore") {
    try {
      await options.storage.restoreDesktopDatabase({
        storagePaths: options.storagePaths,
        source: request.source,
        sqliteBinary: process.env.SQLITE3_BIN,
        migrationsDirectory: options.migrationsDirectory,
        nodeExecutable: options.nodeExecutable,
        prismaBinary: options.prismaBinary,
        prismaConfigPath: options.prismaConfigPath,
        prismaProjectRoot: options.prismaProjectRoot,
        prismaSchemaPath: options.prismaSchemaPath,
        environment: process.env,
        operationId: request.operationId,
        recoveryOnly: request.recoveryOnly === true,
      });
      const response = operationSuccess(validation.operation, null);
      process.stdout.write(`${JSON.stringify(response)}\n`);
      return response;
    } catch (error) {
      const response = operationError(
        validation.operation,
        restoreOperationPhase(error),
        restoreOperationErrorCode(error),
      );
      process.stdout.write(`${JSON.stringify(response)}\n`);
      return response;
    }
  }

  let exportResult;
  try {
    exportResult = await options.storage.exportDesktopDatabase({
      storagePaths: options.storagePaths,
      destinationPath: request.destination.path,
      sqliteBinary: process.env.SQLITE3_BIN,
    });
  } catch (error) {
    const response = operationError(
      validation.operation,
      "operation",
      exportOperationErrorCode(error),
    );
    process.stdout.write(`${JSON.stringify(response)}\n`);
    return response;
  }

  const response = operationSuccess(validation.operation, exportResult);
  process.stdout.write(`${JSON.stringify(response)}\n`);
  return response;
}

function pickEphemeralPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host: LOOPBACK_HOST, port: 0 }, () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : null;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        if (!Number.isInteger(port) || port <= 0) {
          reject(new Error("OS did not provide an ephemeral loopback port"));
          return;
        }
        resolve(port);
      });
    });
  });
}

function createReadyNonce() {
  return crypto.randomBytes(READY_NONCE_BYTES).toString("hex");
}

function readyHealthResponseMatches(statusCode, body, expectedNonce) {
  if (statusCode !== 200) return false;

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }

  return parsed !== null
    && typeof parsed === "object"
    && parsed.kind === READY_HEALTH_KIND
    && parsed.status === "ready"
    && parsed.nonce === expectedNonce;
}

function waitForHttpReady(port, readyNonce, options = {}) {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("local runtime readiness port is invalid");
  }
  if (typeof readyNonce !== "string" || readyNonce.length === 0) {
    throw new Error("local runtime readiness nonce is missing");
  }

  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs >= 0
    ? options.timeoutMs
    : READY_TIMEOUT_MS;
  const retryDelayMs = Number.isFinite(options.retryDelayMs) && options.retryDelayMs >= 0
    ? options.retryDelayMs
    : 100;
  const requestTimeoutMs = Number.isFinite(options.requestTimeoutMs) && options.requestTimeoutMs > 0
    ? options.requestTimeoutMs
    : 1_000;
  const child = options.child ?? null;
  const deadline = Date.now() + timeoutMs;
  let lastError = "not attempted";

  return new Promise((resolve, reject) => {
    let settled = false;
    let retryTimer = null;
    let activeRequest = null;

    const childHasExited = () => child !== null
      && (typeof child.exitCode === "number" || typeof child.signalCode === "string");

    const cleanup = () => {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (activeRequest !== null) {
        activeRequest.destroy();
        activeRequest = null;
      }
      if (child !== null) {
        child.removeListener("exit", onChildExit);
        child.removeListener("error", onChildError);
      }
    };

    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const failForChildExit = () => {
      finish(new Error("local runtime child exited before readiness"));
    };

    const onChildExit = () => {
      failForChildExit();
    };

    const onChildError = () => {
      finish(new Error("local runtime child failed before readiness"));
    };

    const scheduleRetry = (reason) => {
      if (settled) return;
      lastError = reason;
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        finish(new Error(`local runtime readiness timeout: ${lastError}`));
        return;
      }
      retryTimer = setTimeout(attempt, Math.min(retryDelayMs, remainingMs));
    };

    function attempt() {
      retryTimer = null;
      if (settled) return;
      if (childHasExited()) {
        failForChildExit();
        return;
      }
      if (Date.now() >= deadline) {
        finish(new Error(`local runtime readiness timeout: ${lastError}`));
        return;
      }

      let requestHandled = false;
      const request = http.get({
        host: LOOPBACK_HOST,
        port,
        path: READY_HEALTH_PATH,
        headers: { accept: "application/json" },
      }, (response) => {
        let responseHandled = false;
        let body = "";
        response.setEncoding("utf8");

        const retryFromResponse = (reason) => {
          if (responseHandled) return;
          responseHandled = true;
          requestHandled = true;
          activeRequest = null;
          scheduleRetry(reason);
        };

        response.on("data", (chunk) => {
          if (responseHandled) return;
          if (Buffer.byteLength(body) + Buffer.byteLength(chunk) > MAX_HEALTH_RESPONSE_BYTES) {
            response.destroy();
            retryFromResponse("health response was too large");
            return;
          }
          body += chunk;
        });
        response.once("end", () => {
          if (responseHandled) return;
          responseHandled = true;
          requestHandled = true;
          activeRequest = null;
          if (readyHealthResponseMatches(response.statusCode, body, readyNonce)) {
            finish();
            return;
          }
          const status = Number.isInteger(response.statusCode)
            ? `HTTP ${response.statusCode}`
            : "invalid health response";
          scheduleRetry(response.statusCode === 200
            ? "health response nonce mismatch"
            : status);
        });
        response.once("error", (error) => {
          retryFromResponse(error instanceof Error ? error.message : String(error));
        });
      });
      activeRequest = request;
      request.setTimeout(requestTimeoutMs, () => {
        request.destroy(new Error("readiness request timeout"));
      });
      request.once("error", (error) => {
        if (requestHandled) return;
        requestHandled = true;
        activeRequest = null;
        scheduleRetry(error instanceof Error ? error.message : String(error));
      });
    }

    if (child !== null) {
      child.once("exit", onChildExit);
      child.once("error", onChildError);
    }
    attempt();
  });
}

function runtimeEntry(root) {
  const configured = process.env.CORNELL_DESKTOP_RUNTIME_ENTRY?.trim();
  const debugOverride = process.env.CORNELL_DESKTOP_ALLOW_RUNTIME_OVERRIDE === "1";
  if (configured && (process.env.NODE_ENV !== "production" || debugOverride)) {
    return path.resolve(configured);
  }
  return path.join(root, "node_modules", "next", "dist", "bin", "next");
}

function spawnRuntime(root, port, readyNonce) {
  const entry = runtimeEntry(root);
  if (!fs.existsSync(entry)) {
    throw new Error(`Next.js runtime entry is missing: ${entry}`);
  }

  const nodeBinary = process.env.CORNELL_DESKTOP_NODE_BINARY?.trim() || process.execPath;
  const child = spawn(nodeBinary, [
    entry,
    "start",
    "--hostname",
    LOOPBACK_HOST,
    "--port",
    String(port),
  ], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: LOOPBACK_HOST,
      PORT: String(port),
      CORNELL_DESKTOP_READY_NONCE: readyNonce,
    },
    stdio: ["ignore", "ignore", "ignore"],
  });

  if (!Number.isInteger(child.pid) || child.pid <= 0) {
    throw new Error(`runtime child PID is invalid: ${child.pid}`);
  }
  return child;
}

function waitForChildExit(child, timeoutMs = null) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeout = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeout !== null) clearTimeout(timeout);
      child.removeListener("exit", finish);
      resolve();
    };
    if (timeoutMs !== null) timeout = setTimeout(finish, timeoutMs);
    child.once("exit", finish);
  });
}

async function stopRuntime(signal = "SIGTERM") {
  const child = runtimeChild;
  runtimeChild = null;
  if (!child) return;

  if (child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
    await waitForChildExit(child, SHUTDOWN_TIMEOUT_MS);
  }
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await waitForChildExit(child, SHUTDOWN_TIMEOUT_MS);
  }
}

async function serve() {
  absoluteDatabaseUrl(process.env.DATABASE_URL);
  const root = projectRoot();
  const readyNonce = createReadyNonce();
  const port = await pickEphemeralPort();
  const child = spawnRuntime(root, port, readyNonce);
  runtimeChild = child;
  const childExit = waitForChildExit(child);

  try {
    await waitForHttpReady(port, readyNonce, { child });
  } catch (error) {
    await stopRuntime("SIGTERM");
    throw error;
  }

  process.stdout.write(`${JSON.stringify({
    kind: "ready",
    status: "ready",
    host: LOOPBACK_HOST,
    port,
    url: `http://${LOOPBACK_HOST}:${port}/notes`,
    readyNonce,
    runtimePid: child.pid,
  })}\n`);

  await childExit;
  runtimeChild = null;
}

async function shutdown(code = 0) {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = stopRuntime("SIGTERM").finally(() => {
    process.exitCode = code;
  });
  return shutdownPromise;
}

async function main() {
  const command = process.argv[2] || "serve";
  if (command === "paths") {
    printStoragePaths();
    return;
  }
  if (command === "bootstrap") {
    bootstrap();
    return;
  }
  if (command === "staged-migrate") {
    stagedMigrate();
    return;
  }
  if (command === "validate-database") {
    validateDatabase();
    return;
  }
  if (command === "attempt-backup-recovery") {
    process.stdout.write(`${JSON.stringify(attemptBackupRecovery(process.argv[3]))}\n`);
    return;
  }
  if (command === "data-backup-operation") {
    await dataBackupOperation(process.argv[3]);
    return;
  }
  if (command === "managed-backup-catalog") {
    process.stdout.write(`${JSON.stringify(managedBackupCatalog())}\n`);
    return;
  }
  if (command === "pending-restore-status") {
    process.stdout.write(`${JSON.stringify(pendingRestoreStatus())}\n`);
    return;
  }
  if (command === "pending-restore-resume") {
    const response = await pendingRestoreResume(process.argv[3]);
    process.stdout.write(`${JSON.stringify(response)}\n`);
    return;
  }
  if (command === "serve") {
    await serve();
    return;
  }
  throw new Error(`unknown sidecar command: ${command}`);
}

process.once("SIGTERM", () => { void shutdown(0); });
process.once("SIGINT", () => { void shutdown(0); });

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  absoluteDatabaseUrl,
  bootstrap,
  attemptBackupRecovery,
  backupRecoverySnapshot,
  createReadyNonce,
  pickEphemeralPort,
  readyHealthResponseMatches,
  READY_HEALTH_KIND,
  READY_HEALTH_PATH,
  serve,
  stagedMigrate,
  validateDatabase,
  dataBackupOperation,
  managedBackupCatalog,
  pendingRestoreResume,
  pendingRestoreStatus,
  validatePendingRestoreResumeRequest,
  validateDesktopDataBackupOperationRequest,
  stopRuntime,
  printStoragePaths,
  sanitizeDatabaseRecoverySnapshot,
  unavailableDatabaseRecoverySnapshot,
  bootstrapFailureMessage,
  waitForHttpReady,
};
