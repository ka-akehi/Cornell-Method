/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- filesystem, SQLite, and child-process fixtures intentionally model runtime boundaries.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
export {};

const {
  DESKTOP_DATABASE_STATUS,
  bootstrapDesktopStorage,
  exportDesktopDatabase,
} = require("../../src/server/infrastructure/desktop-storage.js");

const projectRoot = path.resolve(__dirname, "../..");
const launcherPath = path.join(projectRoot, "src-tauri", "sidecar", "launcher.cjs");
const sqliteBinary = process.env.SQLITE3_BIN ?? "sqlite3";

function hasSqliteCli() {
  try {
    execFileSync(sqliteBinary, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const sqliteCliAvailable = hasSqliteCli();

function temporaryHome() {
  return fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), "cornell-desktop-data-export-"),
  );
}

async function withTemporaryHome(callback) {
  const homeDirectory = temporaryHome();
  try {
    return await callback(homeDirectory);
  } finally {
    fs.rmSync(homeDirectory, { recursive: true, force: true });
  }
}

function sqlite(databasePath, sql, options = {}) {
  try {
    return execFileSync(
      sqliteBinary,
      ["-bail", ...(options.readonly ? ["-readonly"] : []), databasePath, sql],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    error.message = `${error.message}\n${error.stderr ?? ""}`;
    throw error;
  }
}

function queryJson(databasePath, sql) {
  const output = execFileSync(
    sqliteBinary,
    ["-readonly", "-bail", "-json", databasePath, sql],
    { encoding: "utf8" },
  );
  return JSON.parse(output.trim() || "[]");
}

function fileDigest(filePath) {
  return require("node:crypto")
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function noExportTemporaryFiles(directoryPath) {
  return fs.readdirSync(directoryPath).filter((entry) => entry.endsWith(".export.tmp"));
}

function createReadyFixture(homeDirectory) {
  const ready = bootstrapDesktopStorage({
    homeDirectory,
    sqliteBinary,
  });
  assert.equal(ready.status, DESKTOP_DATABASE_STATUS.READY);

  const canvasDocument = JSON.stringify({
    schemaVersion: 1,
    page: { width: 1200, height: 800, background: "paper" },
    elements: [
      {
        id: "canvas-text",
        type: "text",
        x: 10,
        y: 20,
        width: 200,
        height: 40,
        rotation: 0,
        style: { fill: "#111111", fontSize: 18 },
        z: 0,
        text: "canonical canvas text",
      },
    ],
  });
  sqlite(
    ready.databasePath,
    `PRAGMA journal_mode=WAL;
     PRAGMA wal_autocheckpoint=0;
     INSERT INTO notebooks
       (id, title, note_date, source_type, source_title, body, body_mode,
        summary, created_at, updated_at)
     VALUES
       ('markdown-note', 'Legacy Markdown', '2026-08-25T00:00:00.000Z',
        'book', 'Source', '# legacy body', 'markdown', 'legacy summary',
        '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z'),
       ('canvas-note', 'Canvas Note', '2026-08-25T00:00:00.000Z',
        'lecture', 'Canvas Source', '', 'canvas', 'canvas summary',
        '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z');
     INSERT INTO notebook_canvases
       (notebook_id, schema_version, document_json, search_text, created_at, updated_at)
     VALUES
       ('canvas-note', 1, '${canvasDocument.replaceAll("'", "''")}',
        'canonical canvas text', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z');
     INSERT INTO tags (id, name, color, created_at)
     VALUES ('tag-one', 'Important', '#f00', '2026-08-25T00:00:00.000Z');
     INSERT INTO notebook_tags (notebook_id, tag_id, "order")
     VALUES ('markdown-note', 'tag-one', 0);
     INSERT INTO cues (id, notebook_id, text, "order", created_at, updated_at)
     VALUES ('cue-one', 'markdown-note', 'cue relation', 0,
       '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z');`,
  );
  return ready;
}

function waitForOutput(child, expected) {
  return new Promise((resolve, reject) => {
    let output = "";
    const onData = (chunk) => {
      output += chunk.toString();
      if (output.includes(expected)) {
        child.stdout.off("data", onData);
        resolve(output);
      }
    };
    child.stdout.on("data", onData);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (!output.includes(expected)) {
        reject(new Error(`SQLite writer exited before ${expected}: ${code}/${signal}`));
      }
    });
  });
}

async function startUncommittedWriter(databasePath) {
  const child = spawn(sqliteBinary, [databasePath], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const ready = waitForOutput(child, "EXPORT_WRITER_READY");
  child.stdin.write(
    `PRAGMA journal_mode=WAL;
     PRAGMA wal_autocheckpoint=0;
     BEGIN;
     INSERT INTO notebooks
       (id, title, note_date, body, body_mode, summary, created_at, updated_at)
     VALUES ('uncommitted-note', 'Uncommitted', '2026-08-25T00:00:00.000Z',
       'must not be exported', 'markdown', '', '2026-08-25T00:00:00.000Z',
       '2026-08-25T00:00:00.000Z');
     SELECT 'EXPORT_WRITER_READY';
`,
  );
  await ready;
  return child;
}

function stopUncommittedWriter(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  child.stdin.write("ROLLBACK;\n.quit\n");
  return new Promise((resolve) => child.once("exit", resolve));
}

test("exports a validated SQLite snapshot without changing live data or managed backups", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = createReadyFixture(homeDirectory);
    const destinationDirectory = path.join(homeDirectory, "external");
    fs.mkdirSync(destinationDirectory);
    const destinationPath = path.join(destinationDirectory, "notebook-export.sqlite");
    const sourceBefore = fs.statSync(ready.databasePath);
    const sourceDigestBefore = fileDigest(ready.databasePath);
    const writer = await startUncommittedWriter(ready.databasePath);

    try {
      assert.equal(fs.existsSync(`${ready.databasePath}-wal`), true);
      const result = await exportDesktopDatabase({
        storagePaths: ready,
        destinationPath,
        sqliteBinary,
      });

      assert.deepEqual(result, {
        fileName: "notebook-export.sqlite",
        size: fs.statSync(destinationPath).size,
      });
      assert.ok(result.size > 0);
      assert.equal(queryJson(destinationPath, "PRAGMA integrity_check")[0].integrity_check, "ok");
      assert.deepEqual(queryJson(destinationPath, "PRAGMA foreign_key_check"), []);
      assert.deepEqual(
        queryJson(
          destinationPath,
          `SELECT id, body, body_mode FROM notebooks ORDER BY id`,
        ),
        [
          { id: "canvas-note", body: "", body_mode: "canvas" },
          { id: "markdown-note", body: "# legacy body", body_mode: "markdown" },
        ],
      );
      assert.deepEqual(
        queryJson(
          destinationPath,
          `SELECT notebook_id, search_text, document_json FROM notebook_canvases`,
        ),
        [{
          notebook_id: "canvas-note",
          search_text: "canonical canvas text",
          document_json: JSON.stringify({
            schemaVersion: 1,
            page: { width: 1200, height: 800, background: "paper" },
            elements: [{
              id: "canvas-text",
              type: "text",
              x: 10,
              y: 20,
              width: 200,
              height: 40,
              rotation: 0,
              style: { fill: "#111111", fontSize: 18 },
              z: 0,
              text: "canonical canvas text",
            }],
          }),
        }],
      );
      assert.deepEqual(
        queryJson(destinationPath, "SELECT * FROM notebook_tags"),
        [{ notebook_id: "markdown-note", tag_id: "tag-one", order: 0 }],
      );
      assert.deepEqual(
        queryJson(destinationPath, "SELECT id, notebook_id, text FROM cues"),
        [{ id: "cue-one", notebook_id: "markdown-note", text: "cue relation" }],
      );
      assert.deepEqual(fs.statSync(ready.databasePath).ino, sourceBefore.ino);
      assert.deepEqual(fs.statSync(ready.databasePath).size, sourceBefore.size);
      assert.equal(fileDigest(ready.databasePath), sourceDigestBefore);
      assert.deepEqual(
        queryJson(ready.databasePath, "SELECT id FROM notebooks WHERE id = 'uncommitted-note'"),
        [],
      );
      assert.deepEqual(noExportTemporaryFiles(destinationDirectory), []);
      assert.deepEqual(
        fs.readdirSync(ready.backupsDirectory),
        [],
      );
    } finally {
      await stopUncommittedWriter(writer);
    }
  });
});

test("rejects an existing destination even when a direct caller passes legacy replace permission", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = createReadyFixture(homeDirectory);
    const externalDirectory = path.join(homeDirectory, "external");
    fs.mkdirSync(externalDirectory);
    const existingPath = path.join(externalDirectory, "existing.sqlite");
    const existingContent = Buffer.from("keep this file", "utf8");
    fs.writeFileSync(existingPath, existingContent, { flag: "wx" });
    const sourceBefore = fs.statSync(ready.databasePath);
    const sourceDigestBefore = fileDigest(ready.databasePath);

    await assert.rejects(
      () => exportDesktopDatabase({
        storagePaths: ready,
        destinationPath: existingPath,
        sqliteBinary,
      }),
      (error) => error.code === "EXPORT_DESTINATION_EXISTS",
    );
    assert.deepEqual(fs.readFileSync(existingPath), existingContent);
    assert.deepEqual(noExportTemporaryFiles(externalDirectory), []);

    const existingStatsBefore = fs.statSync(existingPath);
    await assert.rejects(
      () => exportDesktopDatabase({
        storagePaths: ready,
        destinationPath: existingPath,
        allowReplaceExisting: true,
        sqliteBinary,
      }),
      (error) => error.code === "EXPORT_DESTINATION_EXISTS",
    );
    assert.equal(fs.statSync(existingPath).ino, existingStatsBefore.ino);
    assert.deepEqual(fs.readFileSync(existingPath), existingContent);
    assert.equal(fs.statSync(ready.databasePath).ino, sourceBefore.ino);
    assert.equal(fileDigest(ready.databasePath), sourceDigestBefore);
    assert.deepEqual(noExportTemporaryFiles(externalDirectory), []);

    await assert.rejects(
      () => exportDesktopDatabase({
        storagePaths: ready,
        destinationPath: path.join(ready.backupsDirectory, "managed.sqlite"),
        allowReplaceExisting: true,
        sqliteBinary,
      }),
      (error) => error.code === "EXPORT_MANAGED_PATH",
    );

    const symlinkTarget = path.join(externalDirectory, "target.sqlite");
    fs.writeFileSync(symlinkTarget, "target", { flag: "wx" });
    const symlinkPath = path.join(externalDirectory, "symlink.sqlite");
    fs.symlinkSync(symlinkTarget, symlinkPath);
    await assert.rejects(
      () => exportDesktopDatabase({
        storagePaths: ready,
        destinationPath: symlinkPath,
        allowReplaceExisting: true,
        sqliteBinary,
      }),
      (error) => error.code === "EXPORT_SYMLINK_PATH",
    );
    assert.deepEqual(fs.readFileSync(symlinkTarget), Buffer.from("target"));

    const directoryPath = path.join(externalDirectory, "directory.sqlite");
    fs.mkdirSync(directoryPath);
    await assert.rejects(
      () => exportDesktopDatabase({
        storagePaths: ready,
        destinationPath: directoryPath,
        allowReplaceExisting: true,
        sqliteBinary,
      }),
      (error) => error.code === "EXPORT_PATH_NOT_FILE",
    );
    assert.equal(fs.statSync(directoryPath).isDirectory(), true);

    await assert.rejects(
      () => exportDesktopDatabase({
        storagePaths: ready,
        destinationPath: path.join(externalDirectory, "missing", "nested.sqlite"),
        allowReplaceExisting: true,
        sqliteBinary,
      }),
      (error) => error.code === "EXPORT_PATH_NOT_FOUND",
    );
  });
});

test("preserves a destination created during publish and cleans the snapshot temp", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = createReadyFixture(homeDirectory);
    const externalDirectory = path.join(homeDirectory, "external");
    fs.mkdirSync(externalDirectory);
    const destinationPath = path.join(externalDirectory, "raced.sqlite");
    const sourceBefore = fs.statSync(ready.databasePath);
    const sourceDigestBefore = fileDigest(ready.databasePath);
    const originalLink = fs.linkSync;
    let raceWinnerStats;
    fs.linkSync = (temporaryPath, racedDestination) => {
      fs.writeFileSync(racedDestination, "race winner", { flag: "wx" });
      raceWinnerStats = fs.statSync(racedDestination);
      const error = new Error("destination was created concurrently");
      error.code = "EEXIST";
      throw error;
    };

    try {
      await assert.rejects(
        () => exportDesktopDatabase({
          storagePaths: ready,
          destinationPath,
          sqliteBinary,
        }),
        (error) => error.code === "EXPORT_PUBLISH_RACE",
      );
    } finally {
      fs.linkSync = originalLink;
    }
    assert.ok(raceWinnerStats);
    assert.equal(fs.statSync(destinationPath).ino, raceWinnerStats.ino);
    assert.deepEqual(fs.readFileSync(destinationPath), Buffer.from("race winner"));
    assert.equal(fs.statSync(ready.databasePath).ino, sourceBefore.ino);
    assert.equal(fileDigest(ready.databasePath), sourceDigestBefore);
    assert.deepEqual(noExportTemporaryFiles(externalDirectory), []);
  });
});

test("publishes external exports with a no-replace hard link", () => {
  const storageSource = fs.readFileSync(
    path.join(projectRoot, "src/server/infrastructure/desktop-storage.js"),
    "utf8",
  );
  assert.equal(storageSource.includes("fs.renameSync(temporaryPath, destination.destinationPath)"), false);
  assert.equal(storageSource.includes("allowReplaceExisting"), false);
  assert.match(storageSource, /fs\.linkSync\(temporaryPath, destination\.destinationPath\)/);
});

test("preserves a race winner created after no-replace publish", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = createReadyFixture(homeDirectory);
    const externalDirectory = path.join(homeDirectory, "external");
    fs.mkdirSync(externalDirectory);
    const destinationPath = path.join(externalDirectory, "race-after-publish.sqlite");
    const sourceBefore = fs.statSync(ready.databasePath);
    const sourceDigestBefore = fileDigest(ready.databasePath);
    const originalLink = fs.linkSync;
    let raceWinnerStats;
    fs.linkSync = (temporaryPath, racedDestination) => {
      originalLink(temporaryPath, racedDestination);
      fs.unlinkSync(racedDestination);
      fs.writeFileSync(racedDestination, "race winner", { flag: "wx" });
      raceWinnerStats = fs.statSync(racedDestination);
    };

    try {
      await assert.rejects(
        () => exportDesktopDatabase({
          storagePaths: ready,
          destinationPath,
          sqliteBinary,
        }),
        (error) => error.code === "EXPORT_PUBLISH_RACE",
      );
    } finally {
      fs.linkSync = originalLink;
    }
    assert.ok(raceWinnerStats);
    assert.equal(fs.statSync(destinationPath).ino, raceWinnerStats.ino);
    assert.deepEqual(fs.readFileSync(destinationPath), Buffer.from("race winner"));
    assert.equal(fs.statSync(ready.databasePath).ino, sourceBefore.ino);
    assert.equal(fileDigest(ready.databasePath), sourceDigestBefore);
    assert.deepEqual(noExportTemporaryFiles(externalDirectory), []);
  });
});

test("rejects an invalid live database without changing its bytes or creating an export", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = createReadyFixture(homeDirectory);
    const externalDirectory = path.join(homeDirectory, "external");
    fs.mkdirSync(externalDirectory);
    const destinationPath = path.join(externalDirectory, "invalid-source.sqlite");
    const invalidSource = Buffer.from("not a sqlite database", "utf8");
    fs.writeFileSync(ready.databasePath, invalidSource);

    await assert.rejects(
      () => exportDesktopDatabase({
        storagePaths: ready,
        destinationPath,
        sqliteBinary,
      }),
      (error) => error.code === "EXPORT_SOURCE_INVALID",
    );
    assert.deepEqual(fs.readFileSync(ready.databasePath), invalidSource);
    assert.equal(fs.existsSync(destinationPath), false);
    assert.deepEqual(noExportTemporaryFiles(externalDirectory), []);
  });
});

test("sidecar publishes the export envelope while restore requires confirmation", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome((homeDirectory) => {
    const ready = createReadyFixture(homeDirectory);
    const externalDirectory = path.join(homeDirectory, "external");
    fs.mkdirSync(externalDirectory);
    const destinationPath = path.join(externalDirectory, "sidecar-export.sqlite");
    const environment = {
      ...process.env,
      CORNELL_DESKTOP_HOME: homeDirectory,
      CORNELL_DESKTOP_PROJECT_ROOT: projectRoot,
    };
    const request = {
      kind: "desktop-data-backup-operation",
      schemaVersion: 1,
      operation: "export",
      source: null,
      destination: {
        kind: "external-file",
        origin: "native-dialog",
        path: destinationPath,
      },
    };
    const result = spawnSync(
      process.execPath,
      [launcherPath, "data-backup-operation", JSON.stringify(request)],
      { cwd: projectRoot, env: environment, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const response = JSON.parse(result.stdout);
    assert.deepEqual(response, {
      kind: "desktop-data-backup-operation",
      schemaVersion: 1,
      ok: true,
      status: "success",
      operation: "export",
      phase: "complete",
      errorCode: null,
      result: {
        fileName: "sidecar-export.sqlite",
        size: fs.statSync(destinationPath).size,
      },
    });
    assert.equal(response.result.fileName.includes(path.sep), false);
    assert.equal(Object.hasOwn(response.result, "path"), false);
    assert.equal(queryJson(destinationPath, "PRAGMA integrity_check")[0].integrity_check, "ok");
    assert.equal(fs.existsSync(ready.databasePath), true);

    const destinationBefore = fs.statSync(destinationPath);
    const destinationDigestBefore = fileDigest(destinationPath);
    const existingDestination = spawnSync(
      process.execPath,
      [
        launcherPath,
        "data-backup-operation",
        JSON.stringify(request),
      ],
      { cwd: projectRoot, env: environment, encoding: "utf8" },
    );
    assert.equal(existingDestination.status, 0, existingDestination.stderr);
    assert.deepEqual(JSON.parse(existingDestination.stdout), {
      kind: "desktop-data-backup-operation",
      schemaVersion: 1,
      ok: false,
      status: "error",
      operation: "export",
      phase: "validation",
      errorCode: "destination-exists",
      result: null,
    });
    assert.equal(fs.statSync(destinationPath).ino, destinationBefore.ino);
    assert.equal(fileDigest(destinationPath), destinationDigestBefore);

    for (const replaceExisting of [true, false]) {
      const invalidReplace = spawnSync(
        process.execPath,
        [
          launcherPath,
          "data-backup-operation",
          JSON.stringify({
            ...request,
            destination: {
              ...request.destination,
              replaceExisting,
            },
          }),
        ],
        { cwd: projectRoot, env: environment, encoding: "utf8" },
      );
      assert.equal(invalidReplace.status, 0, invalidReplace.stderr);
      assert.deepEqual(JSON.parse(invalidReplace.stdout), {
        kind: "desktop-data-backup-operation",
        schemaVersion: 1,
        ok: false,
        status: "error",
        operation: "export",
        phase: "validation",
        errorCode: "invalid-request",
        result: null,
      });
      assert.equal(fs.statSync(destinationPath).ino, destinationBefore.ino);
      assert.equal(fileDigest(destinationPath), destinationDigestBefore);
    }
    assert.deepEqual(noExportTemporaryFiles(externalDirectory), []);

    const unconfirmedRestore = spawnSync(
      process.execPath,
      [
        launcherPath,
        "data-backup-operation",
        JSON.stringify({
          kind: "desktop-data-backup-operation",
          schemaVersion: 1,
          operation: "restore",
          source: { kind: "managed-backup", backupId: "fixture" },
          destination: null,
        }),
      ],
      { cwd: projectRoot, env: environment, encoding: "utf8" },
    );
    assert.equal(unconfirmedRestore.status, 0, unconfirmedRestore.stderr);
    assert.deepEqual(JSON.parse(unconfirmedRestore.stdout), {
      kind: "desktop-data-backup-operation",
      schemaVersion: 1,
      ok: false,
      status: "error",
      operation: "restore",
      phase: "validation",
      errorCode: "confirmation-required",
      result: null,
    });
  });
});
