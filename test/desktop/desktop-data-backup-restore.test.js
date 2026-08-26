/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { test } = require("node:test");

const {
  DESKTOP_DATABASE_STATUS,
  bootstrapDesktopStorage,
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
    path.join(fs.realpathSync(os.tmpdir()), "cornell-desktop-data-restore-"),
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

function sqlite(databasePath, sql) {
  return execFileSync(
    sqliteBinary,
    ["-bail", databasePath, sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

function queryJson(databasePath, sql) {
  const output = execFileSync(
    sqliteBinary,
    ["-readonly", "-bail", "-json", databasePath, sql],
    { encoding: "utf8" },
  );
  return JSON.parse(output.trim() || "[]");
}

function digest(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function createReadyFixture(homeDirectory) {
  const ready = bootstrapDesktopStorage({ homeDirectory, sqliteBinary });
  assert.equal(ready.status, DESKTOP_DATABASE_STATUS.READY);
  const canvasDocument = JSON.stringify({
    schemaVersion: 1,
    page: { width: 1200, height: 800, background: "paper" },
    elements: [
      {
        id: "restore-text",
        type: "text",
        x: 10,
        y: 20,
        width: 200,
        height: 40,
        rotation: 0,
        style: { fill: "#111111", fontSize: 18 },
        z: 0,
        text: "restore canvas text",
      },
    ],
  });
  sqlite(
    ready.databasePath,
    `INSERT INTO notebooks
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
        'restore canvas text', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z');
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

function request(operation, source, extra = {}) {
  return {
    kind: "desktop-data-backup-operation",
    schemaVersion: 1,
    operation,
    source,
    destination: null,
    confirmed: true,
    operationId: extra.operationId ?? `test-${operation}`,
    ...extra,
  };
}

function runSidecar(homeDirectory, payload) {
  const result = spawnSync(
    process.execPath,
    [launcherPath, "data-backup-operation", JSON.stringify(payload)],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        CORNELL_DESKTOP_HOME: homeDirectory,
        CORNELL_DESKTOP_PROJECT_ROOT: projectRoot,
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
}

function createExternalCandidate(ready, homeDirectory, name = "candidate.sqlite") {
  const externalDirectory = path.join(homeDirectory, "external");
  fs.mkdirSync(externalDirectory, { recursive: true });
  const candidatePath = path.join(externalDirectory, name);
  fs.copyFileSync(ready.databasePath, candidatePath);
  return candidatePath;
}

function assertStagingClean(ready) {
  const stagingRoot = path.join(ready.applicationSupportRoot, "restore-staging");
  assert.equal(fs.existsSync(stagingRoot), false);
}

test("restores a valid external SQLite file and preserves Markdown, Canvas, relations, and source bytes", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = createReadyFixture(homeDirectory);
    const candidatePath = createExternalCandidate(ready, homeDirectory);
    const sourceBefore = digest(candidatePath);
    sqlite(
      candidatePath,
      "UPDATE notebooks SET title = 'Restored title' WHERE id = 'markdown-note';",
    );
    const updatedSourceDigest = digest(candidatePath);
    const liveBefore = digest(ready.databasePath);

    const response = runSidecar(
      homeDirectory,
      request(
        "restore",
        { kind: "external-file", origin: "native-dialog", path: candidatePath },
        { operationId: "external-valid" },
      ),
    );

    assert.deepEqual(response, {
      kind: "desktop-data-backup-operation",
      schemaVersion: 1,
      ok: true,
      status: "success",
      operation: "restore",
      phase: "complete",
      errorCode: null,
      result: null,
    });
    assert.equal(digest(candidatePath), updatedSourceDigest);
    assert.notEqual(digest(ready.databasePath), liveBefore);
    assert.deepEqual(
      queryJson(ready.databasePath, "SELECT id, title, body, body_mode FROM notebooks ORDER BY id"),
      [
        { id: "canvas-note", title: "Canvas Note", body: "", body_mode: "canvas" },
        { id: "markdown-note", title: "Restored title", body: "# legacy body", body_mode: "markdown" },
      ],
    );
    assert.deepEqual(
      queryJson(ready.databasePath, "SELECT notebook_id, tag_id, \"order\" FROM notebook_tags"),
      [{ notebook_id: "markdown-note", tag_id: "tag-one", order: 0 }],
    );
    assert.deepEqual(
      queryJson(ready.databasePath, "SELECT notebook_id, search_text FROM notebook_canvases"),
      [{ notebook_id: "canvas-note", search_text: "restore canvas text" }],
    );
    assert.equal(fs.existsSync(path.join(ready.backupsDirectory, "restore-external-valid.sqlite.bak")), true);
    assertStagingClean(ready);
    assert.equal(sourceBefore === updatedSourceDigest, false);
  });
});

test("restores a valid managed backup through the same pipeline without changing the managed source", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = createReadyFixture(homeDirectory);
    const candidatePath = createExternalCandidate(ready, homeDirectory, "managed-source.sqlite");
    sqlite(candidatePath, "UPDATE notebooks SET title = 'Managed restore' WHERE id = 'markdown-note';");
    const managedPath = path.join(ready.backupsDirectory, "managed-source.sqlite");
    fs.copyFileSync(candidatePath, managedPath);
    const managedBefore = digest(managedPath);

    const response = runSidecar(
      homeDirectory,
      request("restore", { kind: "managed-backup", backupId: "managed-source.sqlite" }, {
        operationId: "managed-valid",
      }),
    );

    assert.equal(response.ok, true);
    assert.equal(digest(managedPath), managedBefore);
    assert.equal(queryJson(ready.databasePath, "SELECT title FROM notebooks WHERE id = 'markdown-note'")[0].title, "Managed restore");
    assertStagingClean(ready);
  });
});

test("requires explicit confirmation and rejects unsafe restore sources without changing live data", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = createReadyFixture(homeDirectory);
    const candidatePath = createExternalCandidate(ready, homeDirectory);
    const liveBefore = digest(ready.databasePath);
    const unconfirmed = runSidecar(homeDirectory, {
      ...request("restore", { kind: "external-file", origin: "native-dialog", path: candidatePath }),
      confirmed: false,
      operationId: "unconfirmed",
    });
    assert.equal(unconfirmed.errorCode, "confirmation-required");
    assert.equal(unconfirmed.phase, "validation");

    const relative = runSidecar(homeDirectory, {
      ...request("restore", { kind: "external-file", origin: "native-dialog", path: "candidate.sqlite" }),
      operationId: "relative",
    });
    assert.equal(relative.errorCode, "relative-path");

    const managedPath = path.join(ready.backupsDirectory, "inside.sqlite");
    const managed = runSidecar(homeDirectory, {
      ...request("restore", { kind: "external-file", origin: "native-dialog", path: managedPath }),
      operationId: "managed-path",
    });
    assert.equal(managed.errorCode, "managed-path");

    const symlinkPath = path.join(homeDirectory, "external", "source-link.sqlite");
    fs.symlinkSync(candidatePath, symlinkPath);
    const symlink = runSidecar(homeDirectory, {
      ...request("restore", { kind: "external-file", origin: "native-dialog", path: symlinkPath }),
      operationId: "symlink",
    });
    assert.equal(symlink.errorCode, "symlink-path");

    const missing = runSidecar(homeDirectory, {
      ...request("restore", { kind: "external-file", origin: "native-dialog", path: path.join(homeDirectory, "external", "missing.sqlite") }),
      operationId: "missing",
    });
    assert.equal(missing.errorCode, "path-not-found");
    assert.equal(digest(ready.databasePath), liveBefore);
    assert.equal(fs.readdirSync(ready.backupsDirectory).length, 0);
    assertStagingClean(ready);
  });
});

test("rejects corrupt, foreign-key-invalid, invalid Canvas, and searchText-mismatched candidates fail closed", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = createReadyFixture(homeDirectory);
    const liveBefore = digest(ready.databasePath);
    const cases = [
      ["corrupt", (candidate) => fs.writeFileSync(candidate, "not sqlite"), "source-invalid"],
      [
        "foreign-key",
        (candidate) => sqlite(candidate, "PRAGMA foreign_keys=OFF; INSERT INTO notebook_tags (notebook_id, tag_id, \"order\") VALUES ('missing', 'missing', 0);"),
        "foreign-key-check-failed",
      ],
      [
        "canvas",
        (candidate) => sqlite(candidate, "UPDATE notebook_canvases SET document_json = '{\"schemaVersion\":1,\"page\":{\"width\":1,\"height\":1,\"background\":\"paper\"},\"elements\":[]}' WHERE notebook_id = 'canvas-note';"),
        "canvas-invalid",
      ],
      [
        "search",
        (candidate) => sqlite(candidate, "UPDATE notebook_canvases SET search_text = 'wrong' WHERE notebook_id = 'canvas-note';"),
        "search-text-mismatch",
      ],
    ];
    for (const [name, mutate, expectedErrorCode] of cases) {
      const candidate = createExternalCandidate(ready, homeDirectory, `${name}.sqlite`);
      mutate(candidate);
      const response = runSidecar(homeDirectory, request(
        "restore",
        { kind: "external-file", origin: "native-dialog", path: candidate },
        { operationId: `invalid-${name}` },
      ));
      assert.equal(response.errorCode, expectedErrorCode, name);
      assert.equal(digest(ready.databasePath), liveBefore, name);
      assertStagingClean(ready);
    }
    assert.equal(fs.readdirSync(ready.backupsDirectory).length, 0);
  });
});

test("publishes newer-schema candidates into pending state without changing any source", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = createReadyFixture(homeDirectory);
    const candidate = createExternalCandidate(ready, homeDirectory, "newer.sqlite");
    sqlite(
      candidate,
      `INSERT INTO _prisma_migrations
       (id, checksum, migration_name, logs, rolled_back_at, started_at, applied_steps_count, finished_at)
       VALUES ('future-id', 'future-checksum', '20990101000000_future', NULL, NULL,
         '2099-01-01T00:00:00.000Z', 1, '2099-01-01T00:00:00.000Z');`,
    );
    const liveBefore = digest(ready.databasePath);
    const sourceBefore = digest(candidate);
    const response = runSidecar(homeDirectory, request(
      "restore",
      { kind: "external-file", origin: "native-dialog", path: candidate },
      { operationId: "newer" },
    ));
    assert.equal(response.errorCode, "newer-schema-pending-required");
    assert.equal(response.phase, "validation");
    assert.equal(digest(ready.databasePath), liveBefore);
    assert.equal(digest(candidate), sourceBefore);
    assert.equal(fs.readdirSync(ready.pendingRestoreDirectory).length, 1);
    assert.deepEqual(fs.readdirSync(ready.backupsDirectory), []);
    assertStagingClean(ready);
  });
});

test("migrates an old-schema candidate only in staging and preserves existing application rows", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = createReadyFixture(homeDirectory);
    const candidate = createExternalCandidate(ready, homeDirectory, "old.sqlite");
    sqlite(
      candidate,
      `PRAGMA foreign_keys=OFF;
       CREATE TABLE old_notebook_tags (
         notebook_id TEXT NOT NULL,
         tag_id TEXT NOT NULL,
         PRIMARY KEY(notebook_id, tag_id),
         FOREIGN KEY(notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE ON UPDATE CASCADE,
         FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE ON UPDATE CASCADE
       );
       INSERT INTO old_notebook_tags SELECT notebook_id, tag_id FROM notebook_tags;
       DROP TABLE notebook_tags;
       ALTER TABLE old_notebook_tags RENAME TO notebook_tags;
       PRAGMA foreign_keys=ON;
       DELETE FROM _prisma_migrations
        WHERE migration_name = '20260809090000_add_notebook_tag_order';`,
    );
    const candidateBefore = digest(candidate);
    const response = runSidecar(homeDirectory, request(
      "restore",
      { kind: "external-file", origin: "native-dialog", path: candidate },
      { operationId: "old-schema" },
    ));
    assert.equal(response.ok, true);
    assert.equal(digest(candidate), candidateBefore);
    assert.deepEqual(
      queryJson(ready.databasePath, "SELECT notebook_id, tag_id, \"order\" FROM notebook_tags"),
      [{ notebook_id: "markdown-note", tag_id: "tag-one", order: 0 }],
    );
    assertStagingClean(ready);
  });
});
