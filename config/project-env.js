/* eslint-disable @typescript-eslint/no-require-imports -- This loader is shared by Prisma config and plain Node scripts. */
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const DEFAULT_DATABASE_URL = "file:./dev.db";
const DEFAULT_POSTGRES_CLI_URL =
  "postgresql://prisma:prisma@localhost:5432/prisma?schema=public";
const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const PRISMA_DIRECT_CONNECTION_COMMANDS = new Set([
  "db",
  "migrate",
  "studio",
]);

function isHostedDeploymentEnvironment(environment = process.env) {
  const vercelEnvironment = environment.VERCEL_ENV;

  if (
    vercelEnvironment === "preview" ||
    vercelEnvironment === "production"
  ) {
    return true;
  }

  return environment.VERCEL === "1" && vercelEnvironment !== "development";
}

function isPostgresDatabaseUrl(databaseUrl) {
  if (typeof databaseUrl !== "string") {
    return false;
  }

  try {
    return POSTGRES_PROTOCOLS.has(new URL(databaseUrl).protocol);
  } catch {
    return false;
  }
}

function resolveDatabaseProvider(databaseUrl) {
  const validatedUrl = validateDatabaseUrl(databaseUrl);

  return isPostgresDatabaseUrl(validatedUrl) ? "postgresql" : "sqlite";
}

function validateSqliteDatabaseUrl(databaseUrl, variableName) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") {
    throw new Error(`${variableName} が空です`);
  }

  if (!databaseUrl.startsWith("file:")) {
    throw new Error(
      `${variableName} は file: 形式の SQLite パスを指定してください`,
    );
  }

  const sqlitePath = databaseUrl.slice("file:".length);

  if (sqlitePath.includes("?") || sqlitePath.includes("#")) {
    throw new Error(
      `${variableName} の SQLite file: URL に query または fragment は指定できません`,
    );
  }

  if (sqlitePath.startsWith("//") && !sqlitePath.startsWith("///")) {
    throw new Error(
      `${variableName} の SQLite file: URL に authority は指定できません`,
    );
  }

  if (!sqlitePath || sqlitePath.trim() === "") {
    throw new Error(`${variableName} の SQLite ファイルパスが空です`);
  }

  if (sqlitePath === ":memory:") {
    throw new Error(`${variableName} の SQLite インメモリパスは使用できません`);
  }

  return databaseUrl;
}

function validatePostgresDatabaseUrl(databaseUrl, variableName) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") {
    throw new Error(`${variableName} が空です`);
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error(
      `${variableName} は PostgreSQL URL（postgresql:// または postgres://）を指定してください`,
    );
  }

  if (
    !POSTGRES_PROTOCOLS.has(parsedUrl.protocol) ||
    !parsedUrl.hostname ||
    !parsedUrl.pathname ||
    parsedUrl.pathname === "/" ||
    parsedUrl.hash
  ) {
    throw new Error(
      `${variableName} は PostgreSQL URL（postgresql:// または postgres://）を指定してください`,
    );
  }

  return databaseUrl;
}

function validateDatabaseUrl(databaseUrl, variableName = "DATABASE_URL") {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") {
    throw new Error(`${variableName} が空です`);
  }

  if (databaseUrl.startsWith("file:")) {
    return validateSqliteDatabaseUrl(databaseUrl, variableName);
  }

  if (isPostgresDatabaseUrl(databaseUrl)) {
    return validatePostgresDatabaseUrl(databaseUrl, variableName);
  }

  throw new Error(
    `${variableName} は file: 形式の SQLite パスまたは PostgreSQL URL を指定してください`,
  );
}

function loadProjectEnv(projectRoot = process.cwd()) {
  const envPath = path.resolve(projectRoot, ".env");
  const hasShellDatabaseUrl = process.env.DATABASE_URL !== undefined;

  if (!fs.existsSync(envPath)) {
    return;
  }

  const result = dotenv.config({
    path: envPath,
    override: false,
    quiet: true,
  });

  if (result.error && !hasShellDatabaseUrl) {
    const reason =
      result.error instanceof Error ? result.error.message : String(result.error);

    throw new Error(
      `Failed to load project environment file at ${envPath}: ${reason}`,
      { cause: result.error },
    );
  }
}

function resolveDatabaseUrl(projectRoot = process.cwd()) {
  loadProjectEnv(projectRoot);
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl === undefined) {
    if (isHostedDeploymentEnvironment()) {
      throw new Error(
        "DATABASE_URL は Vercel Preview/Production で必須です。SQLite fallback は使用できません",
      );
    }

    return DEFAULT_DATABASE_URL;
  }

  const validatedUrl = validateDatabaseUrl(databaseUrl);

  if (isHostedDeploymentEnvironment() && !isPostgresDatabaseUrl(validatedUrl)) {
    throw new Error(
      "DATABASE_URL は Vercel Preview/Production では PostgreSQL URL を指定してください",
    );
  }

  return validatedUrl;
}

function commandRequiresDirectUrl(command = process.argv.slice(2)) {
  return command.some((argument) =>
    PRISMA_DIRECT_CONNECTION_COMMANDS.has(argument),
  );
}

function resolvePrismaCliDatabaseUrl({
  projectRoot = process.cwd(),
  provider = "sqlite",
  command = process.argv.slice(2),
} = {}) {
  loadProjectEnv(projectRoot);

  if (provider === "postgresql") {
    const directUrl = process.env.DIRECT_URL;

    if (directUrl !== undefined) {
      return validatePostgresDatabaseUrl(directUrl, "DIRECT_URL");
    }

    if (commandRequiresDirectUrl(command)) {
      throw new Error(
        "DIRECT_URL は PostgreSQL の Prisma CLI / migration コマンドで必須です",
      );
    }

    // `prisma generate` and `prisma validate` do not connect to the database.
    // Keep those commands usable in a build without making DATABASE_URL or
    // DIRECT_URL part of generated client output.
    return DEFAULT_POSTGRES_CLI_URL;
  }

  if (provider !== "sqlite") {
    throw new Error("未対応の Prisma provider です");
  }

  // The SQLite client is still generated for shared application types and
  // the local adapter import. Generation is offline and does not select the
  // runtime database, so use the safe local schema URL for this command only.
  if (command.includes("generate")) {
    return DEFAULT_DATABASE_URL;
  }

  if (isHostedDeploymentEnvironment()) {
    throw new Error(
      "Vercel Preview/Production では SQLite の Prisma CLI config を使用できません",
    );
  }

  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

  if (isPostgresDatabaseUrl(databaseUrl)) {
    throw new Error(
      "SQLite の Prisma CLI config に PostgreSQL の DATABASE_URL は指定できません",
    );
  }

  return validateSqliteDatabaseUrl(databaseUrl, "DATABASE_URL");
}

module.exports = {
  DEFAULT_DATABASE_URL,
  DEFAULT_POSTGRES_CLI_URL,
  commandRequiresDirectUrl,
  isHostedDeploymentEnvironment,
  isPostgresDatabaseUrl,
  loadProjectEnv,
  resolveDatabaseProvider,
  resolvePrismaCliDatabaseUrl,
  resolveDatabaseUrl,
  validateDatabaseUrl,
};
