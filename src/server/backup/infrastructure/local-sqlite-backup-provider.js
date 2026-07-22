/* eslint-disable @typescript-eslint/no-require-imports -- Backup filesystem provider is shared by Next API and the plain Node CLI. */
const fs = require("fs");
const path = require("path");

const DEFAULT_DATABASE_URL = "file:./dev.db";
const BACKUP_DIR_NAME = "backup";
const MAX_BACKUPS = 3;

class BackupError extends Error {
  constructor(message) {
    super(message);
    this.name = "BackupError";
  }
}

function databaseUrlToPath(databaseUrl, projectRoot) {
  const url = databaseUrl || DEFAULT_DATABASE_URL;

  if (!url.startsWith("file:")) {
    throw new BackupError("DATABASE_URL は file: 形式の SQLite パスを指定してください");
  }

  let sqlitePath;
  if (url.startsWith("file://")) {
    sqlitePath = decodeURIComponent(new URL(url).pathname);
  } else {
    sqlitePath = decodeURIComponent(url.slice("file:".length).split("?")[0]);
  }

  if (!sqlitePath) {
    throw new BackupError("DATABASE_URL の SQLite ファイルパスが空です");
  }

  return path.isAbsolute(sqlitePath)
    ? path.normalize(sqlitePath)
    : path.resolve(projectRoot, sqlitePath);
}

function backupDir(projectRoot) {
  return path.join(projectRoot, BACKUP_DIR_NAME);
}

function relativeBackupPath(file) {
  return path.join(BACKUP_DIR_NAME, file);
}

function timestampFromFileName(file) {
  const match = file.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(?:\.(\d{3})Z?)?\.db$/,
  );

  if (!match) {
    return null;
  }

  return `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5] ?? "000"}Z`;
}

function backupEntry(projectRoot, file) {
  const fullPath = path.join(backupDir(projectRoot), file);
  const stats = fs.statSync(fullPath);
  const createdAt = timestampFromFileName(file) || stats.mtime.toISOString();

  return {
    file,
    createdAt,
    path: relativeBackupPath(file),
    sortTime: new Date(createdAt).getTime() || stats.mtime.getTime(),
  };
}

function allBackupEntries(projectRoot) {
  const dir = backupDir(projectRoot);
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".db"))
    .map((file) => backupEntry(projectRoot, file))
    .sort((a, b) => b.sortTime - a.sortTime || b.file.localeCompare(a.file));
}

function toPublicBackupEntry(entry) {
  return {
    file: entry.file,
    createdAt: entry.createdAt,
    path: entry.path,
  };
}

function resolveDatabasePath(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  return databaseUrlToPath(options.databaseUrl || process.env.DATABASE_URL, projectRoot);
}

function listBackups(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();

  return allBackupEntries(projectRoot)
    .slice(0, MAX_BACKUPS)
    .map(toPublicBackupEntry);
}

function pruneBackups(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const entries = allBackupEntries(projectRoot);
  const staleEntries = entries.slice(MAX_BACKUPS);

  staleEntries.forEach((entry) => {
    fs.unlinkSync(path.join(backupDir(projectRoot), entry.file));
  });

  return staleEntries.map(toPublicBackupEntry);
}

function copyBackupFile(dbPath, dir) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  let collision = 0;

  while (true) {
    const collisionPart =
      collision === 0 ? "" : `.${String(collision).padStart(3, "0")}Z`;
    const file = `${timestamp}${collisionPart}.db`;
    const dest = path.join(dir, file);

    try {
      fs.copyFileSync(dbPath, dest, fs.constants.COPYFILE_EXCL);
      return file;
    } catch (error) {
      if (!error || typeof error !== "object" || error.code !== "EEXIST") {
        throw error;
      }
      collision += 1;
    }
  }
}

function createBackup(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const dbPath = resolveDatabasePath({
    projectRoot,
    databaseUrl: options.databaseUrl,
  });

  if (!fs.existsSync(dbPath)) {
    throw new BackupError(`SQLite DB file not found: ${dbPath}`);
  }

  const dbStats = fs.statSync(dbPath);
  if (!dbStats.isFile()) {
    throw new BackupError(`SQLite DB path is not a file: ${dbPath}`);
  }

  const dir = backupDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });

  const file = copyBackupFile(dbPath, dir);
  pruneBackups({ projectRoot });

  return {
    file,
    path: relativeBackupPath(file),
  };
}

module.exports = {
  BackupError,
  createBackup,
  listBackups,
  pruneBackups,
  resolveDatabasePath,
};
