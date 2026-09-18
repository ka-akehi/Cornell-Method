/* eslint-disable @typescript-eslint/no-require-imports -- This is a local operator CLI. */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const FIXTURE_GENERATOR = path.join(PROJECT_ROOT, "scripts", "generate-sqlite-fixture.js");
const NEXT_BIN = path.join(
  PROJECT_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next",
);
const DEFAULT_COUNT = 10_000;
const DEFAULT_SEED = "cornell-method-fixture-v1";
const DEFAULT_PORT = 3001;
const TEMPORARY_DIRECTORY_PREFIX = "cornell-method-dev-fixture-";
const FIXTURE_DIST_DIR_PREFIX = ".next-fixture-";
const FIXTURE_TSCONFIG_DIR_PREFIX = ".next-fixture-tsconfig-";
const SQLITE_SIDECARS = ["-journal", "-wal", "-shm"];
const SIGNAL_EXIT_CODES = {
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143,
};

let temporaryDirectory;
let fixturePath;
let fixtureDistDirectory;
let fixtureDistDir;
let fixtureTsconfigDirectory;
let fixtureTsconfigPath;
let serverProcess;
let receivedSignal;
let cleanupCompleted = false;

function printHelp() {
  console.log(`Usage: npm run dev:fixture -- [options]

Options:
  --count N       number of notebooks to create (default: ${DEFAULT_COUNT})
  --seed VALUE    deterministic content seed (default: ${DEFAULT_SEED})
  --port N        Next.js development server port (default: ${DEFAULT_PORT})
  --help          show this help

The command creates a new SQLite fixture in the operating system temporary
directory, starts Next.js against that fixture, and removes only the generated
temporary files when the server exits. It does not edit .env or any live DB.`);
}

function parseInteger(value, option, minimum, maximum) {
  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < minimum ||
    Number(value) > maximum
  ) {
    throw new Error(`${option} は${minimum}〜${maximum}の整数で指定してください`);
  }

  return Number(value);
}

function parseArguments(argv) {
  const result = {
    count: DEFAULT_COUNT,
    seed: DEFAULT_SEED,
    port: DEFAULT_PORT,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const equalsIndex = argument.indexOf("=");
    const option = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);
    let value = equalsIndex === -1 ? undefined : argument.slice(equalsIndex + 1);

    if (option === "--help" || option === "-h") {
      result.help = true;
      continue;
    }

    if (!["--count", "--seed", "--port"].includes(option)) {
      throw new Error(`未対応のオプションです: ${option}`);
    }

    if (value === undefined) {
      index += 1;
      value = argv[index];
    }

    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`${option} の値が必要です`);
    }

    if (option === "--count") {
      result.count = parseInteger(value, option, 1, Number.MAX_SAFE_INTEGER);
    } else if (option === "--port") {
      result.port = parseInteger(value, option, 1, 65_535);
    } else {
      result.seed = value;
    }
  }

  return result;
}

function createTemporaryFixturePath() {
  temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), TEMPORARY_DIRECTORY_PREFIX),
  );
  fixturePath = path.join(temporaryDirectory, "fixture.sqlite");
  fixtureDistDirectory = fs.mkdtempSync(
    path.join(PROJECT_ROOT, FIXTURE_DIST_DIR_PREFIX),
  );
  fixtureDistDir = path.relative(PROJECT_ROOT, fixtureDistDirectory);

  fixtureTsconfigDirectory = fs.mkdtempSync(
    path.join(PROJECT_ROOT, FIXTURE_TSCONFIG_DIR_PREFIX),
  );
  const fixtureTsconfigFilePath = path.join(
    fixtureTsconfigDirectory,
    "tsconfig.json",
  );
  const fixtureDistDirForTsconfig = fixtureDistDir.split(path.sep).join("/");
  fs.writeFileSync(
    fixtureTsconfigFilePath,
    `${JSON.stringify(
      {
        extends: "../tsconfig.json",
        compilerOptions: {
          paths: {
            "@/*": ["../src/*"],
          },
        },
        include: [
          "../next-env.d.ts",
          "../**/*.mts",
          "../**/*.ts",
          "../**/*.tsx",
          "../.next/types/**/*.ts",
          "../.next/dev/types/**/*.ts",
          `../${fixtureDistDirForTsconfig}/types/**/*.ts`,
          `../${fixtureDistDirForTsconfig}/dev/types/**/*.ts`,
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  fixtureTsconfigPath = path.relative(PROJECT_ROOT, fixtureTsconfigFilePath);
}

function removeIfPresent(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (!(error && typeof error === "object" && error.code === "ENOENT")) {
      throw error;
    }
  }
}

function removeOwnedProjectDirectory(directoryPath, prefix, label) {
  if (!directoryPath) {
    return;
  }

  const resolvedDirectory = path.resolve(directoryPath);
  const projectRoot = path.resolve(PROJECT_ROOT);
  const directoryName = path.basename(resolvedDirectory);
  if (
    path.dirname(resolvedDirectory) !== projectRoot ||
    !directoryName.startsWith(prefix)
  ) {
    throw new Error(`安全確認に失敗したため${label}を削除しません: ${directoryPath}`);
  }

  fs.rmSync(resolvedDirectory, { force: true, recursive: true });
}

function cleanupTemporaryFixture() {
  if (cleanupCompleted || !temporaryDirectory) {
    return true;
  }

  cleanupCompleted = true;
  const resolvedTemporaryDirectory = path.resolve(temporaryDirectory);
  const temporaryRoot = path.resolve(os.tmpdir());
  const directoryName = path.basename(resolvedTemporaryDirectory);
  if (
    path.dirname(resolvedTemporaryDirectory) !== temporaryRoot ||
    !directoryName.startsWith(TEMPORARY_DIRECTORY_PREFIX)
  ) {
    console.error(`安全確認に失敗したため一時fixtureを削除しません: ${temporaryDirectory}`);
    return false;
  }

  const cleanupTargets = [fixturePath, ...SQLITE_SIDECARS.map((suffix) => `${fixturePath}${suffix}`)];
  try {
    for (const target of cleanupTargets) {
      removeIfPresent(target);
    }
    fs.rmdirSync(resolvedTemporaryDirectory);

    removeOwnedProjectDirectory(
      fixtureDistDirectory,
      FIXTURE_DIST_DIR_PREFIX,
      "fixture用distDir",
    );
    removeOwnedProjectDirectory(
      fixtureTsconfigDirectory,
      FIXTURE_TSCONFIG_DIR_PREFIX,
      "fixture用tsconfig",
    );

    return true;
  } catch (error) {
    console.error(
      `一時fixtureの後始末に失敗しました。既存ファイルは削除していません: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return false;
  }
}

function generateFixture(args) {
  const result = spawnSync(
    process.execPath,
    [
      FIXTURE_GENERATOR,
      "--count",
      String(args.count),
      "--output",
      fixturePath,
      "--seed",
      args.seed,
    ],
    {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.signal) {
    throw new Error(`fixture生成がシグナルで終了しました: ${result.signal}`);
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error(`fixture生成に失敗しました (exit=${result.status ?? 1})`);
  }
}

function startNextDevServer(args) {
  const childEnvironment = {
    ...process.env,
    DATABASE_URL: `file:${fixturePath}`,
    PRISMA_PROVIDER: "sqlite",
    CORNELL_FIXTURE_DIST_DIR: fixtureDistDir,
    CORNELL_FIXTURE_TSCONFIG_PATH: fixtureTsconfigPath,
  };

  console.log(`fixture: ${fixturePath}`);
  console.log(`distDir: ${fixtureDistDir}`);
  console.log(`tsconfig: ${fixtureTsconfigPath}`);
  console.log(`url: http://127.0.0.1:${args.port}/notes`);

  serverProcess = spawn(
    NEXT_BIN,
    ["dev", "--hostname", "127.0.0.1", "--port", String(args.port)],
    {
      cwd: PROJECT_ROOT,
      env: childEnvironment,
      stdio: "inherit",
    },
  );

  return new Promise((resolve) => {
    let spawnError;
    serverProcess.once("error", (error) => {
      spawnError = error;
    });
    serverProcess.once("close", (code, signal) => {
      const result = { code, signal, error: spawnError };
      serverProcess = undefined;
      resolve(result);
    });
  });
}

function signalExitCode(signal) {
  return SIGNAL_EXIT_CODES[signal] ?? 1;
}

function handleSignal(signal) {
  if (receivedSignal) {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill("SIGKILL");
    }
    return;
  }

  receivedSignal = signal;
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill(signal);
  }
}

process.on("SIGINT", () => handleSignal("SIGINT"));
process.on("SIGTERM", () => handleSignal("SIGTERM"));
process.on("SIGHUP", () => handleSignal("SIGHUP"));
process.once("exit", cleanupTemporaryFixture);

async function run(args) {
  createTemporaryFixturePath();
  try {
    generateFixture(args);
    if (receivedSignal) {
      return signalExitCode(receivedSignal);
    }

    const result = await startNextDevServer(args);
    if (result.error) {
      throw result.error;
    }
    if (result.signal) {
      return signalExitCode(result.signal);
    }
    if (receivedSignal) {
      return signalExitCode(receivedSignal);
    }
    return result.code ?? 1;
  } finally {
    if (!cleanupTemporaryFixture()) {
      process.exitCode = 1;
    }
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const exitCode = await run(args);
  process.exitCode = exitCode;
}

main().catch((error) => {
  cleanupTemporaryFixture();
  console.error(error instanceof Error ? error.message : "fixture専用開発サーバーの起動に失敗しました");
  process.exitCode = 1;
});
