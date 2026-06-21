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

export function resolveDatabasePath(options?: {
  projectRoot?: string;
  databaseUrl?: string;
}): string;

export function listBackups(options?: { projectRoot?: string }): BackupEntry[];

export function pruneBackups(options?: { projectRoot?: string }): BackupEntry[];

export function createBackup(options?: {
  projectRoot?: string;
  databaseUrl?: string;
}): CreatedBackup;
