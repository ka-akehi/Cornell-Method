/* eslint-disable @typescript-eslint/no-require-imports -- Backup service is consumed by both Next API and the plain Node CLI. */
const {
  createBackup,
  listBackups,
} = require("../infrastructure/local-sqlite-backup-provider");

function listBackupEntries(options = {}) {
  return listBackups({
    projectRoot: options.projectRoot,
    backupsDirectory: options.backupsDirectory,
  });
}

function createBackupEntry(options = {}) {
  return createBackup({
    projectRoot: options.projectRoot,
    databaseUrl: options.databaseUrl,
    backupsDirectory: options.backupsDirectory,
  });
}

module.exports = {
  createBackupEntry,
  listBackupEntries,
};
