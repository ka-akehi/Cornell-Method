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

function hasErrorCode(error, code) {
  return error && typeof error === "object" && error.code === code;
}

function parseBackupFileName(file) {
  const match = file.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(?:\.(\d{3})Z?(?:-(\d+))?)?\.db$/,
  );

  if (!match) {
    return null;
  }

  const milliseconds = match[5] || "000";
  const timestamp = `${match[1]}T${match[2]}-${match[3]}-${match[4]}.${milliseconds}`;

  return {
    createdAt: `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${milliseconds}Z`,
    hasMilliseconds: match[5] !== undefined,
    suffix: match[6] ? Number(match[6]) : 0,
    timestamp,
  };
}

function backupEntry(projectRoot, file) {
  const fullPath = path.join(backupDir(projectRoot), file);
  const stats = fs.statSync(fullPath);
  const parsedFileName = parseBackupFileName(file);
  const createdAt = parsedFileName?.createdAt || stats.mtime.toISOString();
  const parsedSortTime = new Date(createdAt).getTime();

  return {
    file,
    createdAt,
    path: relativeBackupPath(file),
    sortTime: Number.isNaN(parsedSortTime) ? stats.mtime.getTime() : parsedSortTime,
    hasMilliseconds: parsedFileName?.hasMilliseconds ?? false,
    suffix: parsedFileName?.suffix ?? 0,
    timestamp: parsedFileName?.timestamp ?? null,
  };
}

function allBackupEntries(projectRoot) {
  const dir = backupDir(projectRoot);
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = [];

  fs.readdirSync(dir)
    .filter((file) => file.endsWith(".db"))
    .forEach((file) => {
      try {
        entries.push(backupEntry(projectRoot, file));
      } catch (error) {
        if (!hasErrorCode(error, "ENOENT")) {
          throw error;
        }
      }
    });

  return entries
    .sort(
      (a, b) =>
        b.sortTime - a.sortTime ||
        Number(b.hasMilliseconds) - Number(a.hasMilliseconds) ||
        b.suffix - a.suffix ||
        b.file.localeCompare(a.file),
    );
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
    try {
      fs.unlinkSync(path.join(backupDir(projectRoot), entry.file));
    } catch (error) {
      if (!hasErrorCode(error, "ENOENT")) {
        throw error;
      }
    }
  });

  return staleEntries.map(toPublicBackupEntry);
}

function timestampForFileName() {
  const isoTimestamp = new Date().toISOString();

  return `${isoTimestamp.slice(0, 19).replace(/:/g, "-")}.${isoTimestamp.slice(20, 23)}`;
}

function backupFileName(timestamp, suffix) {
  const suffixPart = suffix === 0 ? "" : `-${suffix}`;
  return `${timestamp}${suffixPart}.db`;
}

function nextBackupSuffix(projectRoot, timestamp) {
  return (
    allBackupEntries(projectRoot)
      .filter((entry) => entry.timestamp === timestamp)
      .reduce((maxSuffix, entry) => Math.max(maxSuffix, entry.suffix), -1) + 1
  );
}

function cleanupPendingCopyBestEffort(pendingDir) {
  try {
    fs.rmSync(pendingDir, { force: true, recursive: true });
  } catch {
    // The original copy or publish error is more useful than a best-effort cleanup error.
  }
}

function cleanupPublishedPendingCopyBestEffort(pendingPath, pendingDir) {
  try {
    fs.unlinkSync(pendingPath);
  } catch {
    // The final hard link is already the committed backup. Cleanup is best effort.
  }

  try {
    fs.rmdirSync(pendingDir);
  } catch {
    // A leftover pending directory is not a timestamped backup generation.
  }
}

function createPendingCopy(dbPath, dir) {
  const pendingDir = fs.mkdtempSync(path.join(dir, ".backup-pending-"));
  const pendingPath = path.join(pendingDir, "snapshot.db");

  try {
    fs.copyFileSync(dbPath, pendingPath, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    cleanupPendingCopyBestEffort(pendingDir);
    throw error;
  }

  return { pendingDir, pendingPath };
}

function copyBackupExclusively(dbPath, dir, timestamp, initialSuffix) {
  const pending = createPendingCopy(dbPath, dir);
  let suffix = initialSuffix;

  while (true) {
    const file = backupFileName(timestamp, suffix);
    const dest = path.join(dir, file);

    try {
      fs.linkSync(pending.pendingPath, dest);
    } catch (error) {
      if (hasErrorCode(error, "EEXIST")) {
        suffix += 1;
        continue;
      }

      cleanupPendingCopyBestEffort(pending.pendingDir);
      throw error;
    }

    cleanupPublishedPendingCopyBestEffort(pending.pendingPath, pending.pendingDir);
    return file;
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

  const timestamp = timestampForFileName();
  const file = copyBackupExclusively(
    dbPath,
    dir,
    timestamp,
    nextBackupSuffix(projectRoot, timestamp),
  );
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
