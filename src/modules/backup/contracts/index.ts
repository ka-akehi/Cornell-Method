export type BackupEntryDto = {
  file: string;
  createdAt: string;
  path: string;
};

export type ListBackupsResponseDto = {
  backups: BackupEntryDto[];
};

export type CreateBackupResponseDto = {
  ok: true;
  backup: {
    file: string;
    path: string;
  };
};
