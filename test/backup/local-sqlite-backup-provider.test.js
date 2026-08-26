/* eslint-disable @typescript-eslint/no-require-imports -- This focused test runs directly with Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  BackupError,
  createBackup,
  listBackups,
  pruneBackups,
  resolveBackupDirectory,
} = require("../../src/server/backup/infrastructure/local-sqlite-backup-provider.js");

function createTempRoot() {
  return fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), "cornell-backup-provider-"),
  );
}

function writeFile(file, contents = "backup") {
  fs.writeFileSync(file, contents);
}

function removeTempRoot(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("list and prune only provider timestamp regular files", () => {
  const root = createTempRoot();
  const dir = path.join(root, "backup");
  const generatedFiles = [
    "2026-01-01T00-00-00.db",
    "2026-01-02T00-00-00.db",
    "2026-01-03T00-00-00.db",
    "2026-01-04T00-00-00.db",
  ];
  const unmanagedFile = path.join(dir, "unmanaged.db");
  const directoryEntry = path.join(dir, "2026-01-05T00-00-00.db");
  const symlinkEntry = path.join(dir, "2026-01-06T00-00-00.db");

  try {
    fs.mkdirSync(dir, { recursive: true });
    generatedFiles.forEach((file) => writeFile(path.join(dir, file)));
    writeFile(unmanagedFile, "unmanaged");
    fs.mkdirSync(directoryEntry);
    fs.symlinkSync(unmanagedFile, symlinkEntry);

    assert.deepEqual(
      listBackups({ projectRoot: root }).map((entry) => entry.file),
      [generatedFiles[3], generatedFiles[2], generatedFiles[1]],
    );

    assert.deepEqual(
      pruneBackups({ projectRoot: root }).map((entry) => entry.file),
      [generatedFiles[0]],
    );
    assert.equal(fs.existsSync(unmanagedFile), true);
    assert.equal(fs.existsSync(directoryEntry), true);
    assert.equal(fs.existsSync(symlinkEntry), true);
  } finally {
    removeTempRoot(root);
  }
});

test("creates a regular file backup and keeps the latest three generations", () => {
  const root = createTempRoot();
  const dir = path.join(root, "backup");
  const oldBackups = [
    "2000-01-01T00-00-00.db",
    "2000-01-02T00-00-00.db",
    "2000-01-03T00-00-00.db",
  ];
  const unmanagedFile = path.join(dir, "unmanaged.db");
  const sourceFile = path.join(root, "dev.db");

  try {
    fs.mkdirSync(dir, { recursive: true });
    oldBackups.forEach((file) => writeFile(path.join(dir, file), "old"));
    writeFile(unmanagedFile, "unmanaged");
    writeFile(sourceFile, "sqlite source");

    const created = createBackup({
      projectRoot: root,
      databaseUrl: "file:./dev.db",
    });
    const listed = listBackups({ projectRoot: root });

    assert.equal(fs.readFileSync(path.join(root, created.path), "utf8"), "sqlite source");
    assert.equal(listed.length, 3);
    assert.equal(listed[0].file, created.file);
    assert.equal(fs.existsSync(path.join(dir, oldBackups[0])), false);
    assert.equal(fs.existsSync(unmanagedFile), true);
  } finally {
    removeTempRoot(root);
  }
});

test("uses the explicit desktop backup directory for list, create, and prune", () => {
  const appBundleRoot = createTempRoot();
  const applicationSupportRoot = createTempRoot();
  const projectBackupDir = path.join(appBundleRoot, "backup");
  const backupsDirectory = path.join(
    applicationSupportRoot,
    "Application Support",
    "com.cornellmethod.notebook",
    "backups",
  );
  const sourceFile = path.join(appBundleRoot, "dev.db");
  const oldBackups = [
    "2000-01-01T00-00-00.db",
    "2000-01-02T00-00-00.db",
    "2000-01-03T00-00-00.db",
  ];

  try {
    fs.mkdirSync(projectBackupDir, { recursive: true });
    fs.mkdirSync(backupsDirectory, { recursive: true });
    oldBackups.forEach((file) => writeFile(path.join(backupsDirectory, file), "old"));
    writeFile(path.join(projectBackupDir, "2000-01-04T00-00-00.db"), "bundle backup");
    writeFile(sourceFile, "desktop sqlite source");

    assert.equal(resolveBackupDirectory({ backupsDirectory }), backupsDirectory);

    const created = createBackup({
      projectRoot: appBundleRoot,
      databaseUrl: "file:./dev.db",
      backupsDirectory,
    });

    assert.equal(
      fs.readFileSync(path.join(backupsDirectory, created.file), "utf8"),
      "desktop sqlite source",
    );
    assert.equal(fs.existsSync(path.join(appBundleRoot, created.path)), false);
    assert.equal(fs.existsSync(path.join(backupsDirectory, oldBackups[0])), false);
    assert.equal(
      listBackups({ projectRoot: appBundleRoot, backupsDirectory }).length,
      3,
    );
    assert.deepEqual(
      listBackups({ projectRoot: appBundleRoot }).map((entry) => entry.file),
      ["2000-01-04T00-00-00.db"],
    );
    assert.deepEqual(pruneBackups({ backupsDirectory }), []);
  } finally {
    removeTempRoot(appBundleRoot);
    removeTempRoot(applicationSupportRoot);
  }
});

test("fails closed for unsafe explicit desktop backup directories", () => {
  const root = createTempRoot();
  const regularFile = path.join(root, "backup-file");
  const symlinkTarget = path.join(root, "real-backups");
  const symlinkDirectory = path.join(root, "backup-link");
  const sourceFile = path.join(root, "source.db");

  try {
    writeFile(regularFile, "not a directory");
    fs.mkdirSync(symlinkTarget);
    fs.symlinkSync(symlinkTarget, symlinkDirectory);
    writeFile(sourceFile, "sqlite source");

    for (const backupsDirectory of [
      "relative/backups",
      regularFile,
      symlinkDirectory,
    ]) {
      assert.throws(
        () => listBackups({ backupsDirectory }),
        (error) =>
          error instanceof BackupError && error.code === "storage_failure",
      );
      assert.throws(
        () => pruneBackups({ backupsDirectory }),
        (error) =>
          error instanceof BackupError && error.code === "storage_failure",
      );
      assert.throws(
        () =>
          createBackup({
            projectRoot: root,
            databaseUrl: "file:./source.db",
            backupsDirectory,
          }),
        (error) =>
          error instanceof BackupError && error.code === "storage_failure",
      );
    }
  } finally {
    removeTempRoot(root);
  }
});

test("classifies invalid backup storage separately from invalid database configuration", () => {
  const root = createTempRoot();
  const sourceFile = path.join(root, "source.db");
  const regularFile = path.join(root, "backup-file");

  try {
    writeFile(sourceFile, "sqlite source");
    writeFile(regularFile, "not a directory");

    assert.throws(
      () =>
        createBackup({
          projectRoot: root,
          databaseUrl: "file:./source.db",
          backupsDirectory: regularFile,
        }),
      (error) =>
        error instanceof BackupError && error.code === "storage_failure",
    );

    assert.throws(
      () =>
        createBackup({
          projectRoot: root,
          databaseUrl: "postgres://invalid",
          backupsDirectory: path.join(root, "backup"),
        }),
      (error) =>
        error instanceof BackupError && error.code === "configuration_invalid",
    );

    assert.throws(
      () =>
        createBackup({
          projectRoot: root,
          databaseUrl: "file:./missing.db",
          backupsDirectory: path.join(root, "backup"),
        }),
      (error) =>
        error instanceof BackupError && error.code === "database_unavailable",
    );
  } finally {
    removeTempRoot(root);
  }
});

test("fails closed for a missing backup directory below a symlink parent", () => {
  const root = createTempRoot();
  const outsideRoot = createTempRoot();
  const linkedParent = path.join(root, "linked-parent");
  const backupsDirectory = path.join(linkedParent, "backups");
  const sourceFile = path.join(root, "source.db");

  try {
    fs.symlinkSync(outsideRoot, linkedParent);
    writeFile(sourceFile, "sqlite source");

    const operations = [
      () => listBackups({ backupsDirectory }),
      () => pruneBackups({ backupsDirectory }),
      () =>
        createBackup({
          projectRoot: root,
          databaseUrl: "file:./source.db",
          backupsDirectory,
        }),
    ];

    operations.forEach((operation) => {
      assert.throws(operation, (error) => error instanceof BackupError);
    });

    assert.equal(fs.existsSync(path.join(outsideRoot, "backups")), false);
    assert.deepEqual(fs.readdirSync(outsideRoot), []);
  } finally {
    removeTempRoot(root);
    removeTempRoot(outsideRoot);
  }
});

test("rejects a source DB whose lexical path is inside backup", () => {
  const root = createTempRoot();
  const dir = path.join(root, "backup");
  const sourceFile = path.join(dir, "primary.db");

  try {
    fs.mkdirSync(dir, { recursive: true });
    writeFile(sourceFile, "sqlite source");

    assert.throws(
      () =>
        createBackup({
          projectRoot: root,
          databaseUrl: "file:./backup/primary.db",
        }),
      (error) =>
        error instanceof BackupError &&
        error.code === "storage_failure" &&
        error.message.includes("outside the backup directory"),
    );
    assert.equal(fs.existsSync(sourceFile), true);
    assert.deepEqual(fs.readdirSync(dir), ["primary.db"]);
  } finally {
    removeTempRoot(root);
  }
});

test("rejects a source DB whose real path resolves inside backup", () => {
  const root = createTempRoot();
  const dir = path.join(root, "backup");
  const realSource = path.join(dir, "primary.db");
  const aliasedSource = path.join(root, "primary.db");

  try {
    fs.mkdirSync(dir, { recursive: true });
    writeFile(realSource, "sqlite source");
    fs.symlinkSync(realSource, aliasedSource);

    assert.throws(
      () =>
        createBackup({
          projectRoot: root,
          databaseUrl: "file:./primary.db",
        }),
      (error) =>
        error instanceof BackupError &&
        error.code === "storage_failure" &&
        error.message.includes("resolves inside the backup directory"),
    );
    assert.equal(fs.existsSync(realSource), true);
    assert.equal(fs.existsSync(aliasedSource), true);
  } finally {
    removeTempRoot(root);
  }
});
