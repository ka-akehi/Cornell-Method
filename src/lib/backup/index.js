/* eslint-disable @typescript-eslint/no-require-imports -- Compatibility CommonJS re-export for existing backup imports. */
const application = require("../../server/backup/application");
const infrastructure = require("../../server/backup/infrastructure");

module.exports = {
  ...infrastructure,
  createBackup: application.createBackupEntry,
  listBackups: application.listBackupEntries,
};
