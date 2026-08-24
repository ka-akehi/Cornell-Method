export const DESKTOP_APPLICATION_ID: "com.cornellmethod.notebook";

export const DESKTOP_DATABASE_INITIALIZATION_MARKER_NAME: ".database-initialized";
export const DESKTOP_DATABASE_INITIALIZATION_MARKER_CONTENT: "v1\n";
export const DESKTOP_DATABASE_INITIALIZATION_MARKER_INVALID_REASON:
  "database-initialization-marker-invalid";
export const DESKTOP_DATABASE_MISSING_AFTER_INITIALIZATION_REASON:
  "database-missing-after-initialization";
export const DESKTOP_DATABASE_NOT_A_FILE_REASON: "database-not-a-file";
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
