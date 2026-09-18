import type {
  BackupEntry,
  CreatedBackup,
} from "../infrastructure/local-sqlite-backup-provider";

export function listBackupEntries(options?: {
  projectRoot?: string;
  databaseUrl?: string;
  backupsDirectory?: string;
}): BackupEntry[];

export function createBackupEntry(options?: {
  projectRoot?: string;
  databaseUrl?: string;
  backupsDirectory?: string;
}): CreatedBackup;
