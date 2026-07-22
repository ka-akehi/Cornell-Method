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
  const url = databaseUrl ?? DEFAULT_DATABASE_URL;

  if (typeof url !== "string" || url.trim() === "") {
    throw new BackupError("DATABASE_URL が空です");
  }

  if (!url.startsWith("file:")) {
    throw new BackupError("DATABASE_URL は file: 形式の SQLite パスを指定してください");
  }

  const sqlitePath = url.slice("file:".length);

  if (sqlitePath.includes("?") || sqlitePath.includes("#")) {
    throw new BackupError(
      "DATABASE_URL の SQLite file: URL に query または fragment は指定できません",
    );
  }

  if (sqlitePath.startsWith("//") && !sqlitePath.startsWith("///")) {
    throw new BackupError(
      "DATABASE_URL の SQLite file: URL に authority は指定できません",
    );
  }

  if (!sqlitePath || sqlitePath.trim() === "") {
    throw new BackupError("DATABASE_URL の SQLite ファイルパスが空です");
  }

  if (sqlitePath === ":memory:") {
    throw new BackupError(
      "DATABASE_URL の SQLite インメモリパスは使用できません",
    );
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
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(?:\.\d{3}Z?)?\.db$/,
  );

  if (!match) {
    return null;
  }

  return `${match[1]}T${match[2]}:${match[3]}:${match[4]}.000Z`;
}

function isPathInsideOrEqual(candidatePath, directoryPath) {
  const relativePath = path.relative(directoryPath, candidatePath);

  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

function realPathIfExists(file) {
  try {
    return fs.realpathSync(file);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function assertSourceOutsideBackupDirectory(dbPath, dir) {
  const lexicalDbPath = path.resolve(dbPath);
  const lexicalBackupDir = path.resolve(dir);

  if (isPathInsideOrEqual(lexicalDbPath, lexicalBackupDir)) {
    throw new BackupError(
      `SQLite DB source must be outside the backup directory: ${dbPath}`,
    );
  }

  const canonicalDbPath = realPathIfExists(lexicalDbPath);
  const canonicalBackupDir = realPathIfExists(lexicalBackupDir);

  if (
    canonicalDbPath &&
    canonicalBackupDir &&
    isPathInsideOrEqual(canonicalDbPath, canonicalBackupDir)
  ) {
    throw new BackupError(
      `SQLite DB source resolves inside the backup directory: ${dbPath}`,
    );
  }
}

function backupEntry(projectRoot, file) {
  const fullPath = path.join(backupDir(projectRoot), file);
  let stats;

  try {
    stats = fs.lstatSync(fullPath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }

  if (timestampFromFileName(file) === null || !stats.isFile()) {
    return null;
  }

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
    .map((file) => backupEntry(projectRoot, file))
    .filter(Boolean)
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
  return databaseUrlToPath(options.databaseUrl ?? process.env.DATABASE_URL, projectRoot);
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

function createBackup(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const dbPath = resolveDatabasePath({
    projectRoot,
    databaseUrl: options.databaseUrl,
  });
  const dir = backupDir(projectRoot);

  assertSourceOutsideBackupDirectory(dbPath, dir);

  if (!fs.existsSync(dbPath)) {
    throw new BackupError(`SQLite DB file not found: ${dbPath}`);
  }

  const dbStats = fs.statSync(dbPath);
  if (!dbStats.isFile()) {
    throw new BackupError(`SQLite DB path is not a file: ${dbPath}`);
  }

  fs.mkdirSync(dir, { recursive: true });

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const file = `${timestamp}.db`;
  const dest = path.join(dir, file);

  let destinationStats;
  try {
    destinationStats = fs.lstatSync(dest);
  } catch (error) {
    if (!(error && typeof error === "object" && error.code === "ENOENT")) {
      throw error;
    }
  }

  if (destinationStats && !destinationStats.isFile()) {
    throw new BackupError(`Backup destination is not a regular file: ${dest}`);
  }

  fs.copyFileSync(dbPath, dest);
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
