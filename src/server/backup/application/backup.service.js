/* eslint-disable @typescript-eslint/no-require-imports -- Backup service is consumed by both Next API and the plain Node CLI. */
const {
  createBackup,
  listBackups,
} = require("../infrastructure/local-sqlite-backup-provider");

function listBackupEntries(options = {}) {
  return listBackups(options);
}

function createBackupEntry(options = {}) {
  return createBackup(options);
}

module.exports = {
  createBackupEntry,
  listBackupEntries,
};
