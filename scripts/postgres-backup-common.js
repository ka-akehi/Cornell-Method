/* eslint-disable @typescript-eslint/no-require-imports -- These helpers are operator-only Node CLI code. */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  loadProjectEnv,
  projectRoot,
  resolveDirectUrl,
} = require("./postgres-migration-common.js");

const EXPORT_FILE_PATTERN =
  /^postgres-export-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(?:\.(\d{3}))?Z?\.(sql|dump)$/;
const FORBIDDEN_OPERATOR_PATHS = [
  { label: "Vercel /var/task filesystem", path: "/var/task" },
  { label: "Vercel /var/runtime filesystem", path: "/var/runtime" },
  { label: "Vercel /opt filesystem", path: "/opt" },
];

function isPathInsideOrEqual(candidatePath, directoryPath) {
  const relativePath = path.relative(directoryPath, candidatePath);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

function assertKnownPathAllowed(candidatePath) {
  const root = projectRoot();
  const repositoryBackupPath = path.join(root, "backup");
  const nextPath = path.join(root, ".next");
  const vercelPath = path.join(root, ".vercel");

  if (isPathInsideOrEqual(candidatePath, repositoryBackupPath)) {
    throw new Error("Postgres export path は Local SQLite backup/ の外側を指定してください");
  }
  if (isPathInsideOrEqual(candidatePath, nextPath)) {
    throw new Error("Postgres export path に .next/ は指定できません");
  }
  if (isPathInsideOrEqual(candidatePath, vercelPath)) {
    throw new Error("Postgres export path に .vercel/ は指定できません");
  }
  if (isPathInsideOrEqual(candidatePath, root)) {
    throw new Error("Postgres export path は repository root の外側を指定してください");
  }

  for (const forbidden of FORBIDDEN_OPERATOR_PATHS) {
    if (isPathInsideOrEqual(candidatePath, forbidden.path)) {
      throw new Error(`${forbidden.label} は Postgres export storage に使用できません`);
    }
  }

  if (candidatePath.split(path.sep).includes(".vercel")) {
    throw new Error("Vercel filesystem path は Postgres export storage に使用できません");
  }
}

function assertOperatorOnlyContext() {
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) {
    throw new Error("Postgres backup CLI は Vercel request / filesystem 上では実行できません");
  }
}

function resolveOperatorPath(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} を明示してください`);
  }
  if (value.startsWith("file:")) {
    throw new Error(`${label} は file: URL ではなく filesystem path を指定してください`);
  }

  const resolvedPath = path.resolve(process.cwd(), value);
  assertKnownPathAllowed(resolvedPath);
  return resolvedPath;
}

function assertExistingRegularFile(filePath, label) {
  let stats;
  try {
    stats = fs.lstatSync(filePath);
  } catch {
    throw new Error(`${label} が存在しません`);
  }
  if (!stats.isFile()) {
    throw new Error(`${label} は regular file である必要があります`);
  }
  return stats;
}

function assertDirectory(directoryPath, label) {
  let stats;
  try {
    stats = fs.lstatSync(directoryPath);
  } catch {
    throw new Error(`${label} が存在しません。operator が先に作成してください`);
  }
  if (!stats.isDirectory() && !stats.isSymbolicLink()) {
    throw new Error(`${label} は directory である必要があります`);
  }

  let canonicalPath;
  try {
    canonicalPath = fs.realpathSync(directoryPath);
  } catch {
    throw new Error(`${label} を解決できません`);
  }
  assertKnownPathAllowed(canonicalPath);
  const canonicalStats = fs.statSync(canonicalPath);
  if (!canonicalStats.isDirectory()) {
    throw new Error(`${label} は directory である必要があります`);
  }
  return canonicalStats;
}

function assertExistingParent(outputPath, label) {
  const parentPath = path.dirname(outputPath);
  assertDirectory(parentPath, `${label} の親 directory`);

  let canonicalParent;
  try {
    canonicalParent = fs.realpathSync(parentPath);
  } catch {
    throw new Error(`${label} の親 directory を解決できません`);
  }
  assertKnownPathAllowed(canonicalParent);
}

function resolveExportOutput(value, { overwrite = false } = {}) {
  const outputPath = resolveOperatorPath(value, "Postgres export output path");
  assertExistingParent(outputPath, "Postgres export output path");

  try {
    const stats = fs.lstatSync(outputPath);
    if (!stats.isFile()) {
      throw new Error("Postgres export output path は regular file である必要があります");
    }
    if (stats.isSymbolicLink()) {
      throw new Error("Postgres export output path に symlink は指定できません");
    }
    if (!overwrite) {
      throw new Error("Postgres export output が既に存在します。上書きには --overwrite が必要です");
    }
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return outputPath;
    }
    throw error;
  }

  return outputPath;
}

function resolveExistingExport(value) {
  const inputPath = resolveOperatorPath(value, "Postgres export input path");
  assertExistingParent(inputPath, "Postgres export input path");
  assertExistingRegularFile(inputPath, "Postgres export input");
  return inputPath;
}

function resolveRetentionDirectory(value) {
  const directoryPath = resolveOperatorPath(value, "Postgres export retention directory");
  assertDirectory(directoryPath, "Postgres export retention directory");
  return fs.realpathSync(directoryPath);
}

function parseOptionArguments(argv, valueOptions, booleanOptions) {
  const result = {};
  const booleanSet = new Set(booleanOptions);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const equalsIndex = argument.indexOf("=");
    const option = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : argument.slice(equalsIndex + 1);

    if (option === "--help" || option === "-h") {
      result.help = true;
      continue;
    }
    if (booleanSet.has(option)) {
      if (inlineValue !== undefined) {
        throw new Error(`${option} は値を受け取りません`);
      }
      result[option.slice(2).replaceAll("-", "_")] = true;
      continue;
    }

    const property = valueOptions.get(option);
    if (property === undefined) {
      throw new Error(`未対応のオプションです: ${option}`);
    }
    const value = inlineValue === undefined ? argv[++index] : inlineValue;
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`${option} の値が必要です`);
    }
    result[property] = value;
  }

  return result;
}

function resolveFormat(value) {
  const format = value ?? process.env.POSTGRES_EXPORT_FORMAT;
  if (!format || !["plain", "custom"].includes(format)) {
    throw new Error("Postgres export format は plain または custom を --format / POSTGRES_EXPORT_FORMAT で明示してください");
  }
  return format;
}

function extensionForFormat(format) {
  return format === "plain" ? ".sql" : ".dump";
}

function buildPgDumpArgs({ directUrl, format, output }) {
  return [
    `--format=${format}`,
    "--no-owner",
    "--no-privileges",
    "--file",
    output,
    "--dbname",
    directUrl,
  ];
}

function buildRestoreArgs({ directUrl, format, input }) {
  if (format === "plain") {
    return [
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--single-transaction",
      "--dbname",
      directUrl,
      "--file",
      input,
    ];
  }

  return [
    "--exit-on-error",
    "--single-transaction",
    "--no-owner",
    "--no-privileges",
    "--dbname",
    directUrl,
    input,
  ];
}

function redactCommand(command, args, secret) {
  return [command, ...args.map((argument) => (argument === secret ? "<DIRECT_URL>" : argument))];
}

function commandAvailable(command) {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
  });
  return !result.error && result.status === 0;
}

function runExternalCommand(command, args, label) {
  const operatorEnvironment = { ...process.env };
  delete operatorEnvironment.DATABASE_URL;
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: operatorEnvironment,
    stdio: ["ignore", "ignore", "pipe"],
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error(`${label} が見つかりません。PostgreSQL client tools を operator 環境へ用意してください`);
    }
    throw new Error(`${label} の起動に失敗しました`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} が失敗しました（exit code ${result.status ?? "unknown"}）。詳細は secret を含まない operator 側ログで確認してください`);
  }
}

function createPendingOutput(outputPath) {
  const pendingDirectory = fs.mkdtempSync(
    path.join(path.dirname(outputPath), ".postgres-export-pending-"),
  );
  const pendingPath = path.join(
    pendingDirectory,
    `snapshot${path.extname(outputPath) || ".dump"}`,
  );

  return { pendingDirectory, pendingPath };
}

function cleanupPendingOutput(pendingDirectory) {
  try {
    fs.rmSync(pendingDirectory, { force: true, recursive: true });
  } catch {
    // Preserve the original export failure; the pending directory is not a retention generation.
  }
}

function parseExportFilename(file) {
  const match = file.match(EXPORT_FILE_PATTERN);
  if (!match) return null;

  const [, date, hour, minute, second, milliseconds = "000", extension] = match;
  const timestamp = new Date(`${date}T${hour}:${minute}:${second}.${milliseconds}Z`);
  if (Number.isNaN(timestamp.getTime())) return null;

  const expectedParts = [
    timestamp.getUTCFullYear(),
    String(timestamp.getUTCMonth() + 1).padStart(2, "0"),
    String(timestamp.getUTCDate()).padStart(2, "0"),
    String(timestamp.getUTCHours()).padStart(2, "0"),
    String(timestamp.getUTCMinutes()).padStart(2, "0"),
    String(timestamp.getUTCSeconds()).padStart(2, "0"),
  ];
  if (
    `${expectedParts[0]}-${expectedParts[1]}-${expectedParts[2]}` !== date ||
    expectedParts[3] !== hour ||
    expectedParts[4] !== minute ||
    expectedParts[5] !== second
  ) {
    return null;
  }

  return {
    dateKey: date,
    extension,
    format: extension === "sql" ? "plain" : "custom",
    timestamp,
    timestampMs: timestamp.getTime(),
    weekKey: isoWeekKey(timestamp),
  };
}

function isoWeekKey(date) {
  const thursday = new Date(date.getTime());
  const day = thursday.getUTCDay() || 7;
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function listRetentionEntries(directoryPath) {
  return fs
    .readdirSync(directoryPath)
    .map((file) => {
      const parsed = parseExportFilename(file);
      if (!parsed) return null;

      const fullPath = path.join(directoryPath, file);
      let stats;
      try {
        stats = fs.lstatSync(fullPath);
      } catch {
        throw new Error(`retention 対象を検査できません: ${file}`);
      }
      if (!stats.isFile() || stats.isSymbolicLink()) {
        throw new Error(`retention 対象は symlink ではない regular file が必要です: ${file}`);
      }

      return {
        ...parsed,
        file,
        path: fullPath,
        size: stats.size,
        dev: stats.dev,
        ino: stats.ino,
        mtimeMs: stats.mtimeMs,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.timestampMs - left.timestampMs || left.file.localeCompare(right.file));
}

function planRetention(directoryPath, { daily = 7, weekly = 4 } = {}) {
  if (!Number.isInteger(daily) || daily < 1 || !Number.isInteger(weekly) || weekly < 1) {
    throw new Error("retention の daily / weekly は 1 以上の整数が必要です");
  }

  const entries = listRetentionEntries(directoryPath);
  const directoryStats = fs.statSync(directoryPath);
  const kept = new Map();
  const dailyDates = [];
  for (const entry of entries) {
    if (!dailyDates.includes(entry.dateKey)) dailyDates.push(entry.dateKey);
  }
  for (const dateKey of dailyDates.slice(0, daily)) {
    const entry = entries.find((candidate) => candidate.dateKey === dateKey);
    if (entry) kept.set(entry.file, { ...entry, reason: "daily" });
  }

  const weeklyWeeks = [];
  for (const entry of entries) {
    if (kept.has(entry.file) || weeklyWeeks.includes(entry.weekKey)) continue;
    weeklyWeeks.push(entry.weekKey);
    kept.set(entry.file, { ...entry, reason: "weekly" });
    if (weeklyWeeks.length >= weekly) break;
  }

  const deleteEntries = entries.filter((entry) => !kept.has(entry.file));
  return {
    directoryDev: directoryStats.dev,
    directoryIno: directoryStats.ino,
    policy: { daily, weekly },
    directory: directoryPath,
    entries,
    kept: [...kept.values()],
    delete: deleteEntries,
  };
}

function assertRetentionPlanUnchanged(plan) {
  let directoryStats;
  try {
    directoryStats = fs.lstatSync(plan.directory);
  } catch {
    throw new Error("retention directory が plan 後に消えました。prune を中止しました");
  }
  if (
    !directoryStats.isDirectory() ||
    directoryStats.isSymbolicLink() ||
    directoryStats.dev !== plan.directoryDev ||
    directoryStats.ino !== plan.directoryIno
  ) {
    throw new Error("retention directory が plan 後に変化しました。prune を中止しました");
  }

  for (const entry of plan.delete) {
    let stats;
    try {
      stats = fs.lstatSync(entry.path);
    } catch {
      throw new Error(`retention 対象が plan 後に消えました: ${entry.file}`);
    }
    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.dev !== entry.dev ||
      stats.ino !== entry.ino ||
      stats.size !== entry.size ||
      stats.mtimeMs !== entry.mtimeMs
    ) {
      throw new Error(`retention 対象が plan 後に変化しました。prune を中止しました: ${entry.file}`);
    }
  }
}

function applyRetentionPlan(plan) {
  assertRetentionPlanUnchanged(plan);
  for (const entry of plan.delete) {
    fs.unlinkSync(entry.path);
  }
}

module.exports = {
  applyRetentionPlan,
  assertDirectory,
  assertExistingParent,
  assertExistingRegularFile,
  assertOperatorOnlyContext,
  buildPgDumpArgs,
  buildRestoreArgs,
  cleanupPendingOutput,
  commandAvailable,
  createPendingOutput,
  extensionForFormat,
  isoWeekKey,
  listRetentionEntries,
  loadProjectEnv,
  parseExportFilename,
  parseOptionArguments,
  planRetention,
  projectRoot,
  redactCommand,
  resolveDirectUrl,
  resolveExistingExport,
  resolveExportOutput,
  resolveFormat,
  resolveOperatorPath,
  resolveRetentionDirectory,
  runExternalCommand,
};
