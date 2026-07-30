const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const e2eDatabasePath = path.resolve(projectRoot, "prisma", "e2e.db");
// Prisma CLI accepts the project-root-relative file URL used by the repository
// contract. Keep the absolute path above only for exact fixture cleanup.
const e2eDatabaseUrl = "file:./prisma/e2e.db";
const e2eDatabaseSidecars = [
  e2eDatabasePath,
  `${e2eDatabasePath}-journal`,
  `${e2eDatabasePath}-shm`,
  `${e2eDatabasePath}-wal`,
];

function removeFixtureFile(filePath) {
  try {
    const stat = fs.lstatSync(filePath);

    if (!stat.isFile()) {
      throw new Error(`E2E fixture path is not a regular file: ${filePath}`);
    }

    fs.unlinkSync(filePath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

function cleanupE2eDatabase() {
  for (const filePath of e2eDatabaseSidecars) {
    removeFixtureFile(filePath);
  }
}

function prepareE2eDatabase() {
  cleanupE2eDatabase();

  const prismaBin = path.resolve(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma",
  );
  const result = spawnSync(
    prismaBin,
    ["migrate", "deploy", "--config", "prisma.config.ts"],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        DATABASE_URL: e2eDatabaseUrl,
        PRISMA_PROVIDER: "sqlite",
      },
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error(`E2E Prisma migration failed with exit code ${result.status}`);
  }
}

module.exports = {
  cleanupE2eDatabase,
  e2eDatabaseUrl,
  prepareE2eDatabase,
  projectRoot,
};
