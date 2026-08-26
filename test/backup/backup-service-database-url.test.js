/* eslint-disable @typescript-eslint/no-require-imports -- This focused test runs directly with Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { createBackupEntry } = require(
  "../../src/server/backup/application/backup.service.js",
);
const {
  BackupError,
  resolveDatabasePath,
} = require("../../src/server/backup/infrastructure/local-sqlite-backup-provider.js");
const { resolveDatabaseUrl } = require("../../config/project-env.js");

function createTempRoot() {
  return fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), "cornell-backup-service-"),
  );
}

function withEnvironment(values, callback) {
  const previousValues = new Map();

  for (const [key, value] of Object.entries(values)) {
    previousValues.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function createSource(root, relativePath, contents) {
  const sourcePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, contents);
  return sourcePath;
}

function assertBackupUsesCanonicalSource({
  root,
  sourcePath,
  databaseUrl,
  envFile,
  backupsDirectory,
}) {
  if (envFile !== undefined) {
    fs.writeFileSync(path.join(root, ".env"), envFile);
  }

  const backup = createBackupEntry({
    projectRoot: root,
    backupsDirectory,
    databaseUrl,
  });

  const canonicalDatabasePath = resolveDatabasePath({
    projectRoot: root,
    databaseUrl: resolveDatabaseUrl(root),
  });

  assert.equal(canonicalDatabasePath, sourcePath);

  assert.equal(
    fs.readFileSync(path.join(backupsDirectory, backup.file), "utf8"),
    fs.readFileSync(sourcePath, "utf8"),
  );
}

test("service resolves the default database URL and passes its source to the provider", () => {
  const root = createTempRoot();

  try {
    const sourcePath = createSource(root, "dev.db", "default source");
    const backupsDirectory = path.join(root, "backup");

    withEnvironment({ DATABASE_URL: undefined }, () => {
      assertBackupUsesCanonicalSource({
        root,
        sourcePath,
        backupsDirectory,
      });
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("service uses the project .env relative SQLite URL for the backup source", () => {
  const root = createTempRoot();

  try {
    const sourcePath = createSource(root, "custom/relative.db", "relative source");
    createSource(root, "dev.db", "wrong default source");

    withEnvironment({ DATABASE_URL: undefined }, () => {
      assertBackupUsesCanonicalSource({
        root,
        sourcePath,
        backupsDirectory: path.join(root, "backup"),
        envFile: 'DATABASE_URL="file:./custom/relative.db"\n',
      });
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("service uses the project .env absolute SQLite URL for the backup source", () => {
  const root = createTempRoot();

  try {
    const sourcePath = createSource(root, "custom/absolute.db", "absolute source");
    createSource(root, "dev.db", "wrong default source");

    withEnvironment({ DATABASE_URL: undefined }, () => {
      assertBackupUsesCanonicalSource({
        root,
        sourcePath,
        backupsDirectory: path.join(root, "backup"),
        envFile: `DATABASE_URL="file:${sourcePath}"\n`,
      });
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("service uses the desktop sidecar absolute DATABASE_URL with its managed backup directory", () => {
  const root = createTempRoot();
  const desktopRoot = createTempRoot();

  try {
    const sourcePath = createSource(desktopRoot, "live/notebook.sqlite", "desktop source");
    createSource(root, "dev.db", "wrong app-bundle source");
    const backupsDirectory = path.join(desktopRoot, "backups");

    withEnvironment(
      {
        DATABASE_URL: `file:${sourcePath}`,
        CORNELL_DESKTOP_BACKUPS_DIRECTORY: backupsDirectory,
      },
      () => {
        assertBackupUsesCanonicalSource({
          root,
          sourcePath,
          backupsDirectory,
        });
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(desktopRoot, { recursive: true, force: true });
  }
});

test("service classifies an invalid project .env database URL as configuration invalid", () => {
  const root = createTempRoot();

  try {
    fs.writeFileSync(path.join(root, ".env"), "DATABASE_URL=postgres://invalid\n");

    withEnvironment({ DATABASE_URL: undefined }, () => {
      assert.throws(
        () =>
          createBackupEntry({
            projectRoot: root,
            backupsDirectory: path.join(root, "backup"),
          }),
        (error) =>
          error instanceof BackupError &&
          error.code === "configuration_invalid" &&
          !/postgres|DATABASE_URL/.test(error.message),
      );
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
