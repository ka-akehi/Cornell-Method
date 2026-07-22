/* eslint-disable @typescript-eslint/no-require-imports -- This loader is shared by Prisma config and plain Node scripts. */
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const DEFAULT_DATABASE_URL = "file:./dev.db";

function validateDatabaseUrl(databaseUrl) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") {
    throw new Error("DATABASE_URL が空です");
  }

  if (!databaseUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL は file: 形式の SQLite パスを指定してください");
  }

  const sqlitePath = databaseUrl.slice("file:".length);

  if (sqlitePath.includes("?") || sqlitePath.includes("#")) {
    throw new Error(
      "DATABASE_URL の SQLite file: URL に query または fragment は指定できません",
    );
  }

  if (sqlitePath.startsWith("//") && !sqlitePath.startsWith("///")) {
    throw new Error(
      "DATABASE_URL の SQLite file: URL に authority は指定できません",
    );
  }

  if (!sqlitePath || sqlitePath.trim() === "") {
    throw new Error("DATABASE_URL の SQLite ファイルパスが空です");
  }

  if (sqlitePath === ":memory:") {
    throw new Error("DATABASE_URL の SQLite インメモリパスは使用できません");
  }

  return databaseUrl;
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
  return validateDatabaseUrl(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
}

module.exports = {
  DEFAULT_DATABASE_URL,
  loadProjectEnv,
  resolveDatabaseUrl,
};
