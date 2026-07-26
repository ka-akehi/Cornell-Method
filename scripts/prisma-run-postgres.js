/* eslint-disable @typescript-eslint/no-require-imports -- This helper runs Prisma from npm scripts. */
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const prismaBin = path.resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);
const args = process.argv.slice(2);

if (args.length === 0) {
  throw new Error("Prisma コマンドを指定してください");
}

const result = spawnSync(
  prismaBin,
  [...args, "--config", "prisma.config.ts"],
  {
    env: {
      ...process.env,
      PRISMA_PROVIDER: "postgresql",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
