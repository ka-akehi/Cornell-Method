/* eslint-disable @typescript-eslint/no-require-imports -- Backup service is consumed by both Next API and the plain Node CLI. */
const { resolveDatabaseUrl } = require("../../../../config/project-env.js");
const {
  BackupError,
  createBackup,
  listBackups,
} = require("../infrastructure/local-sqlite-backup-provider");

function resolvedBackupOptions(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  let databaseUrl;

  if (options.databaseUrl !== undefined) {
    databaseUrl = options.databaseUrl;
  } else {
    try {
      databaseUrl = resolveDatabaseUrl(projectRoot);
    } catch {
      throw new BackupError(
        "configuration_invalid",
        "database configuration is invalid",
      );
    }
  }

  return {
    projectRoot,
    databaseUrl,
    backupsDirectory: options.backupsDirectory,
  };
}

function listBackupEntries(options = {}) {
  return listBackups(resolvedBackupOptions(options));
}

function createBackupEntry(options = {}) {
  return createBackup(resolvedBackupOptions(options));
}

module.exports = {
  createBackupEntry,
  listBackupEntries,
};
