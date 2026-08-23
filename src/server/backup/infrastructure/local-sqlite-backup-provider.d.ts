export class BackupError extends Error {}

export type BackupEntry = {
  file: string;
  createdAt: string;
  path: string;
};

export type CreatedBackup = {
  file: string;
  path: string;
};

export type BackupDirectoryOptions = {
  projectRoot?: string;
  backupsDirectory?: string;
};

export function resolveDatabasePath(options?: {
  projectRoot?: string;
  databaseUrl?: string;
}): string;

export function resolveBackupDirectory(
  options?: BackupDirectoryOptions,
): string;

export function listBackups(options?: BackupDirectoryOptions): BackupEntry[];

export function pruneBackups(options?: BackupDirectoryOptions): BackupEntry[];

export function createBackup(options?: {
  projectRoot?: string;
  databaseUrl?: string;
  backupsDirectory?: string;
}): CreatedBackup;
