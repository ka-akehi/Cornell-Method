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
} = require("../../src/server/backup/infrastructure/local-sqlite-backup-provider.js");

function createTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cornell-backup-provider-"));
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
        error.message.includes("resolves inside the backup directory"),
    );
    assert.equal(fs.existsSync(realSource), true);
    assert.equal(fs.existsSync(aliasedSource), true);
  } finally {
    removeTempRoot(root);
  }
});
