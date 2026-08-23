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

function relativeBackupPath(file) {
  return path.join(BACKUP_DIR_NAME, file);
}

function hasErrorCode(error, code) {
  return error && typeof error === "object" && error.code === code;
}

function validateBackupDirectory(directoryPath) {
  if (typeof directoryPath !== "string" || directoryPath.trim() === "") {
    throw new BackupError("backup directory が空です");
  }

  if (!path.isAbsolute(directoryPath)) {
    throw new BackupError("backup directory は絶対パスで指定してください");
  }

  const absolutePath = path.normalize(directoryPath);
  const rootPath = path.parse(absolutePath).root;
  const components = path
    .relative(rootPath, absolutePath)
    .split(path.sep)
    .filter(Boolean);
  let currentPath = rootPath;

  for (const component of components) {
    currentPath = path.join(currentPath, component);

    let stats;
    try {
      stats = fs.lstatSync(currentPath);
    } catch (error) {
      if (hasErrorCode(error, "ENOENT")) {
        return absolutePath;
      }

      if (hasErrorCode(error, "ENOTDIR")) {
        throw new BackupError(
          `backup directory の親 path はディレクトリである必要があります: ${directoryPath}`,
        );
      }

      throw error;
    }

    if (stats.isSymbolicLink()) {
      throw new BackupError(
        `backup directory に symlink は指定できません: ${directoryPath}`,
      );
    }

    if (!stats.isDirectory()) {
      throw new BackupError(
        `backup directory はディレクトリである必要があります: ${directoryPath}`,
      );
    }
  }

  return absolutePath;
}

function resolveBackupDirectory(options = {}) {
  const candidate =
    options.backupsDirectory !== undefined
      ? options.backupsDirectory
      : path.join(
          path.resolve(options.projectRoot || process.cwd()),
          BACKUP_DIR_NAME,
        );

  return validateBackupDirectory(candidate);
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

function backupEntry(dir, file) {
  const fullPath = path.join(dir, file);
  let stats;

  try {
    stats = fs.lstatSync(fullPath);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return null;
    }

    throw error;
  }

  const parsedFileName = parseBackupFileName(file);
  if (parsedFileName === null || !stats.isFile()) {
    return null;
  }

  try {
    // lstatSync above excludes symlinks; statSync preserves the provider's
    // error behavior if the regular file disappears or becomes unreadable.
    stats = fs.statSync(fullPath);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return null;
    }

    throw error;
  }

  const createdAt = parsedFileName.createdAt || stats.mtime.toISOString();
  const parsedSortTime = new Date(createdAt).getTime();

  return {
    file,
    createdAt,
    path: relativeBackupPath(file),
    sortTime: Number.isNaN(parsedSortTime) ? stats.mtime.getTime() : parsedSortTime,
    hasMilliseconds: parsedFileName.hasMilliseconds,
    suffix: parsedFileName.suffix,
    timestamp: parsedFileName.timestamp,
  };
}

function allBackupEntries(dir) {
  const validatedDir = validateBackupDirectory(dir);
  let dirStats;

  try {
    dirStats = fs.lstatSync(validatedDir);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return [];
    }

    throw error;
  }

  if (dirStats.isSymbolicLink()) {
    throw new BackupError(`backup directory に symlink は指定できません: ${dir}`);
  }

  if (!dirStats.isDirectory()) {
    throw new BackupError(
      `backup directory はディレクトリである必要があります: ${validatedDir}`,
    );
  }

  return fs
    .readdirSync(validatedDir)
    .filter((file) => file.endsWith(".db"))
    .map((file) => backupEntry(validatedDir, file))
    .filter(Boolean)
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
  return databaseUrlToPath(options.databaseUrl ?? process.env.DATABASE_URL, projectRoot);
}

function listBackups(options = {}) {
  const dir = resolveBackupDirectory(options);

  return allBackupEntries(dir)
    .slice(0, MAX_BACKUPS)
    .map(toPublicBackupEntry);
}

function pruneBackups(options = {}) {
  const dir = resolveBackupDirectory(options);
  const entries = allBackupEntries(dir);
  const staleEntries = entries.slice(MAX_BACKUPS);

  staleEntries.forEach((entry) => {
    try {
      fs.unlinkSync(path.join(dir, entry.file));
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

function nextBackupSuffix(dir, timestamp) {
  return (
    allBackupEntries(dir)
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
  let dir = resolveBackupDirectory(options);
  const dbPath = resolveDatabasePath({
    projectRoot,
    databaseUrl: options.databaseUrl,
  });

  assertSourceOutsideBackupDirectory(dbPath, dir);

  if (!fs.existsSync(dbPath)) {
    throw new BackupError(`SQLite DB file not found: ${dbPath}`);
  }

  const dbStats = fs.statSync(dbPath);
  if (!dbStats.isFile()) {
    throw new BackupError(`SQLite DB path is not a file: ${dbPath}`);
  }

  fs.mkdirSync(dir, { recursive: true });
  dir = resolveBackupDirectory({ backupsDirectory: dir });

  const timestamp = timestampForFileName();
  const file = copyBackupExclusively(
    dbPath,
    dir,
    timestamp,
    nextBackupSuffix(dir, timestamp),
  );
  pruneBackups({ backupsDirectory: dir });

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
  resolveBackupDirectory,
  resolveDatabasePath,
};
