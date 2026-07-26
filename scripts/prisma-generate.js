/* eslint-disable @typescript-eslint/no-require-imports -- This helper runs Prisma from npm scripts. */
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  resolveDatabaseUrl,
} = require("../config/project-env.js");

const prismaBin = path.resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

function runGenerate(provider) {
  const result = spawnSync(
    prismaBin,
    ["generate", "--config", "prisma.config.ts"],
    {
      env: {
        ...process.env,
        PRISMA_PROVIDER: provider,
      },
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Resolve the runtime URL first so hosted builds fail closed. Both generated
// clients are needed: the application keeps the existing @prisma/client type
// contract while the Postgres client is emitted to its separate output path.
resolveDatabaseUrl(process.cwd());
runGenerate("sqlite");
runGenerate("postgresql");
