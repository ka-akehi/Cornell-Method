export const DESKTOP_APPLICATION_ID: "com.cornellmethod.notebook";

export const DESKTOP_DATABASE_INITIALIZATION_MARKER_NAME: ".database-initialized";
export const DESKTOP_DATABASE_INITIALIZATION_MARKER_CONTENT: "v1\n";
export const DESKTOP_DATABASE_INITIALIZATION_MARKER_INVALID_REASON:
  "database-initialization-marker-invalid";
export const DESKTOP_DATABASE_MISSING_AFTER_INITIALIZATION_REASON:
  "database-missing-after-initialization";
export const DESKTOP_DATABASE_NOT_A_FILE_REASON: "database-not-a-file";
export const DESKTOP_DATABASE_RECOVERY_SCHEMA_VERSION: 1;
export const DESKTOP_DATABASE_RECOVERY_STATE: {
  readonly FIRST_RUN: "first-run";
  readonly RESTORE_AVAILABLE: "restore-available";
  readonly DIAGNOSTIC_REQUIRED: "diagnostic-required";
  readonly RESTORE_UNAVAILABLE: "restore-unavailable";
};
export const DESKTOP_DATABASE_RECOVERY_REASON_CODES: {
  readonly DATABASE_MISSING: "database-missing";
  readonly DATABASE_MISSING_AFTER_INITIALIZATION:
    "database-missing-after-initialization";
  readonly DATABASE_NOT_A_FILE: "database-not-a-file";
  readonly DATABASE_READ_FAILED: "database-read-failed";
  readonly DATABASE_INTEGRITY_FAILED: "database-integrity-failed";
  readonly DATABASE_FOREIGN_KEY_FAILED: "database-foreign-key-failed";
  readonly DATABASE_SCHEMA_INVALID: "database-schema-invalid";
  readonly DATABASE_MIGRATION_REQUIRED: "database-migration-required";
  readonly DATABASE_INITIALIZATION_FAILED: "database-initialization-failed";
  readonly DATABASE_INITIALIZATION_MARKER_INVALID:
    "database-initialization-marker-invalid";
  readonly STORAGE_UNAVAILABLE: "storage-unavailable";
};
export const DESKTOP_STAGED_MIGRATION_STATUS: {
  readonly NO_PENDING: "no-pending";
  readonly SWITCHED: "switched";
};

export const DESKTOP_STORAGE_LAYOUT: {
  readonly root: ".";
  readonly live: "live";
  readonly database: "live/notebook.sqlite";
  readonly backups: "backups";
  readonly settings: "settings";
  readonly logs: "logs";
  readonly pendingRestore: "pending-restore";
};

export const DESKTOP_DATABASE_STATUS: {
  readonly INITIALIZATION_REQUIRED: "initialization-required";
  readonly READY: "ready";
  readonly MIGRATION_REQUIRED: "migration-required";
  readonly UNUSABLE: "unusable";
};

export const DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION: 1;
export const DESKTOP_PENDING_RESTORE_STATUS: {
  readonly AVAILABLE: "available";
  readonly PROCESSING: "processing";
  readonly CONSUMED: "consumed";
  readonly CLEANUP_REQUIRED: "cleanup-required";
};

export const DESKTOP_MIGRATION_STATE: {
  readonly COMPLETE: "complete";
  readonly INCOMPLETE: "incomplete";
  readonly MISSING: "missing";
  readonly UNKNOWN: "unknown";
};

export class DesktopStorageError extends Error {
  code: string;
}

export type DesktopStoragePaths = {
  applicationId: string;
  applicationSupportRoot: string;
  root: string;
  liveDirectory: string;
  databasePath: string;
  backupsDirectory: string;
  settingsDirectory: string;
  logsDirectory: string;
  pendingRestoreDirectory: string;
  databaseUrl: string;
};

export type DesktopDatabaseRecoveryState =
  | "first-run"
  | "restore-available"
  | "diagnostic-required"
  | "restore-unavailable";

export type DesktopDatabaseRecoveryReasonCode =
  | "database-missing"
  | "database-missing-after-initialization"
  | "database-not-a-file"
  | "database-read-failed"
  | "database-integrity-failed"
  | "database-foreign-key-failed"
  | "database-schema-invalid"
  | "database-migration-required"
  | "database-initialization-failed"
  | "database-initialization-marker-invalid"
  | "storage-unavailable";

export type DesktopDatabaseRecoverySnapshot = {
  schemaVersion: 1;
  state: DesktopDatabaseRecoveryState;
  reasonCode: DesktopDatabaseRecoveryReasonCode;
  managedBackupAvailable: boolean;
  pendingRestoreAvailable: boolean;
  canStartEmpty: boolean;
};

export type DesktopDatabaseInspection = DesktopStoragePaths & {
  status: string;
  migrationState: string;
  available: boolean;
  requiresInitialization: boolean;
  requiresMigration: boolean;
  pendingMigrations?: string[];
  appliedMigrations?: string[];
  reason: string;
  created?: boolean;
  recoverySnapshot?: DesktopDatabaseRecoverySnapshot | null;
  paths?: DesktopStoragePaths;
};

export function resolveDesktopStoragePaths(options?: {
  homeDirectory?: string;
  applicationId?: string;
}): DesktopStoragePaths;

export function ensureDesktopStorageDirectories(
  storagePaths?: DesktopStoragePaths,
): DesktopStoragePaths;

export function databasePathToUrl(databasePath: string): string;

export type DesktopDeleteResult = {
  operationId: string;
  deletedFileCount: number;
};

export function deleteDesktopData(options?: {
  storagePaths?: DesktopStoragePaths;
  operationId?: string;
}): DesktopDeleteResult;

export function createDesktopSidecarDatabaseEnvironment(
  storagePaths?: DesktopStoragePaths,
): {
  DATABASE_URL: string;
  PRISMA_PROVIDER: "sqlite";
};

export function readMigrationManifest(
  migrationsDirectory?: string,
): Array<{ name: string; path: string; checksum: string }>;

export function inspectDesktopDatabase(options?: {
  storagePaths?: DesktopStoragePaths;
  homeDirectory?: string;
  migrationsDirectory?: string;
  sqliteBinary?: string;
  integrityCheck?: boolean;
}): DesktopDatabaseInspection;

export type StagedUpdateMigrationResult = {
  status: "no-pending" | "switched";
  pendingMigrations: string[];
};

export function runStagedUpdateMigration(options: {
  storagePaths: DesktopStoragePaths;
  sqliteBinary?: string;
  environment?: NodeJS.ProcessEnv;
  now?: number;
}): StagedUpdateMigrationResult;

export type DesktopRestoreSource =
  | { kind: "managed-backup"; backupId: string }
  | { kind: "external-file"; origin: "native-dialog"; path: string };

export type DesktopRestoreResult = {
  operationId: string;
  safetyBackupId: string | null;
  size: number;
};

export type DesktopManagedBackupCatalogEntry = {
  backupId: string;
  fileName: string;
  size: number;
  createdAt: string;
};

export type DesktopManagedBackupCatalog = {
  status: "ready" | "empty";
  backups: DesktopManagedBackupCatalogEntry[];
};

export function listManagedBackupCatalog(options?: {
  storagePaths?: DesktopStoragePaths;
}): DesktopManagedBackupCatalog;

export type DesktopPendingRestoreSummary = {
  pendingId: string;
  manifestToken: string;
  sourceKind: "managed-backup" | "external-file";
  createdAt: string;
  candidateDigest: string;
  candidateSize: number;
  candidateSchemaIdentity: string;
};

export type DesktopPendingRestoreStatusResult = {
  status: "none" | "available" | "invalid";
  errorCode: string | null;
  pending: DesktopPendingRestoreSummary | null;
};

export function restoreDesktopDatabase(options: {
  storagePaths: DesktopStoragePaths;
  source: DesktopRestoreSource;
  sqliteBinary?: string;
  migrationsDirectory?: string;
  nodeExecutable?: string;
  prismaBinary?: string;
  prismaConfigPath?: string;
  prismaProjectRoot?: string;
  prismaSchemaPath?: string;
  environment?: NodeJS.ProcessEnv;
  operationId?: string;
  /** Internal Tauri recovery-only capability; ordinary UI requests must omit it. */
  recoveryOnly?: boolean;
}): Promise<DesktopRestoreResult>;

export function inspectPendingRestore(options?: {
  storagePaths?: DesktopStoragePaths;
  sqliteBinary?: string;
  migrationsDirectory?: string;
}): DesktopPendingRestoreStatusResult;

export function resumePendingRestore(options: {
  storagePaths: DesktopStoragePaths;
  pendingId: string;
  manifestToken: string;
  confirmed: true;
  sqliteBinary?: string;
  migrationsDirectory?: string;
  nodeExecutable?: string;
  prismaBinary?: string;
  prismaConfigPath?: string;
  prismaProjectRoot?: string;
  prismaSchemaPath?: string;
  environment?: NodeJS.ProcessEnv;
  operationId?: string;
  /** Internal Tauri recovery-only capability; ordinary UI requests must omit it. */
  recoveryOnly?: boolean;
}): Promise<DesktopRestoreResult & { pendingId: string }>;

export function bootstrapDesktopStorage(options?: {
  homeDirectory?: string;
  storagePaths?: DesktopStoragePaths;
  migrationsDirectory?: string;
  sqliteBinary?: string;
  nodeExecutable?: string;
  prismaBinary?: string;
  prismaConfigPath?: string;
  prismaProjectRoot?: string;
  environment?: NodeJS.ProcessEnv;
}): DesktopDatabaseInspection;
