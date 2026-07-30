/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");
const {
  readSourceSnapshot,
  reconcileRows,
} = require("../../scripts/postgres-migration-common.js");

const projectRoot = path.resolve(__dirname, "../..");
const baselinePath = path.join(
  projectRoot,
  "prisma",
  "migrations-postgres",
  "20260726000000_postgres_baseline",
  "migration.sql",
);
const importScript = path.join(projectRoot, "scripts", "postgres-import.js");

function hasSqliteCli() {
  try {
    execFileSync("sqlite3", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function createFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-postgres-migration-"));
  const databasePath = path.join(directory, "fixture.db");
  const migration = sqlString("20260621073258_init");
  const document = JSON.stringify({
    schemaVersion: 1,
    page: { width: 1200, height: 800, background: "paper" },
    elements: [
      {
        id: "element-1",
        type: "text",
        x: 1,
        y: 2,
        width: 100,
        height: 40,
        rotation: 0,
        style: {},
        z: 0,
        text: "PRIVATE_CANVAS_TEXT",
      },
    ],
  });
  const sql = `
CREATE TABLE "_prisma_migrations" (
  "id" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "finished_at" DATETIME,
  "migration_name" TEXT NOT NULL,
  "logs" TEXT,
  "rolled_back_at" DATETIME,
  "started_at" DATETIME NOT NULL,
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE "notebooks" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "note_date" DATETIME NOT NULL,
  "source_type" TEXT,
  "source_title" TEXT NOT NULL DEFAULT '',
  "body" TEXT NOT NULL DEFAULT '',
  "body_mode" TEXT NOT NULL DEFAULT 'markdown',
  "summary" TEXT NOT NULL DEFAULT '',
  "next_review_date" DATETIME,
  "reviewed_at" DATETIME,
  "created_at" DATETIME NOT NULL,
  "updated_at" DATETIME NOT NULL,
  "deleted_at" DATETIME
);
CREATE TABLE "tags" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "created_at" DATETIME NOT NULL
);
CREATE TABLE "notebook_canvases" (
  "notebook_id" TEXT NOT NULL PRIMARY KEY,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "document_json" TEXT NOT NULL,
  "search_text" TEXT NOT NULL DEFAULT '',
  "created_at" DATETIME NOT NULL,
  "updated_at" DATETIME NOT NULL
);
CREATE TABLE "cues" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "notebook_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" DATETIME NOT NULL,
  "updated_at" DATETIME NOT NULL
);
CREATE TABLE "notebook_tags" (
  "notebook_id" TEXT NOT NULL,
  "tag_id" TEXT NOT NULL,
  PRIMARY KEY ("notebook_id", "tag_id")
);
INSERT INTO "_prisma_migrations" VALUES
  ('migration-id', 'checksum', '2026-07-26T00:00:00.000Z', ${migration}, NULL, NULL,
   '2026-07-26T00:00:00.000Z', 1);
INSERT INTO "notebooks" VALUES
  ('notebook-1', 'PRIVATE_TITLE', '2026-07-25T00:00:00.000Z', NULL, 'source',
   'PRIVATE_BODY', 'canvas', 'PRIVATE_SUMMARY', NULL, NULL,
   '2026-07-25T00:00:00.000Z', '2026-07-25T00:00:00.000Z', NULL);
INSERT INTO "tags" VALUES ('tag-1', 'PRIVATE_TAG', '#123456', '2026-07-25T00:00:00.000Z');
INSERT INTO "notebook_canvases" VALUES
  ('notebook-1', 1, ${sqlString(document)}, 'PRIVATE_SEARCH_TEXT',
   '2026-07-25T00:00:00.000Z', '2026-07-25T00:00:00.000Z');
INSERT INTO "cues" VALUES
  ('cue-1', 'notebook-1', 'PRIVATE_CUE', 3,
   '2026-07-25T00:00:00.000Z', '2026-07-25T00:00:00.000Z');
INSERT INTO "notebook_tags" VALUES ('notebook-1', 'tag-1');
`;

  execFileSync("sqlite3", [databasePath, sql], { stdio: "ignore" });
  return { databasePath, directory };
}

test("Postgres baseline is separate from SQLite and excludes Phase 2 tables", () => {
  const migration = fs.readFileSync(baselinePath, "utf8");

  assert.doesNotMatch(migration, /\bPRAGMA\b|\bDATETIME\b|"overview"/i);
  for (const table of ["notebooks", "notebook_canvases", "tags", "notebook_tags", "cues"]) {
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`));
  }
  for (const table of [
    "notebook_draft_states",
    "notebook_review_progresses",
    "soft_delete_buffers",
    "backup_logs",
    "note_cards",
    "cue_cards",
  ]) {
    assert.doesNotMatch(migration, new RegExp(`"${table}"`));
  }
  assert.match(migration, /"document_json" TEXT NOT NULL/);
  assert.match(migration, /"search_text" TEXT NOT NULL DEFAULT ''/);
});

test("source dry-run requires an explicit path and emits metadata without note contents", {
  skip: !hasSqliteCli(),
}, () => {
  const fixture = createFixture();
  try {
    const output = execFileSync(
      process.execPath,
      [importScript, "--source", fixture.databasePath, "--dry-run"],
      {
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: "postgresql://runtime.invalid/db" },
      },
    );
    const report = JSON.parse(output);

    assert.equal(report.mode, "dry-run");
    assert.equal(report.target, "not connected");
    assert.deepEqual(report.sourceInventory.counts, {
      cues: 1,
      notebook_canvases: 1,
      notebook_tags: 1,
      notebooks: 1,
      tags: 1,
    });
    assert.equal(report.sourceInventory.canvas.details[0].page.width, 1200);
    assert.doesNotMatch(output, /PRIVATE_(?:TITLE|BODY|SUMMARY|TAG|CUE|CANVAS_TEXT|SEARCH_TEXT)/);
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("better-sqlite3 native load failure falls back to the sqlite3 CLI", {
  skip: !hasSqliteCli(),
}, () => {
  const fixture = createFixture();
  const originalLoad = Module._load;
  const nativeLoadError = new Error("native module load failed");
  nativeLoadError.code = "ERR_DLOPEN_FAILED";

  Module._load = function load(request, parent, isMain) {
    if (request === "better-sqlite3") {
      throw nativeLoadError;
    }
    return Reflect.apply(originalLoad, this, [request, parent, isMain]);
  };

  try {
    const snapshot = readSourceSnapshot(fixture.databasePath);

    assert.equal(snapshot.rows.notebooks.length, 1);
    assert.equal(snapshot.rows.notebook_canvases.length, 1);
  } finally {
    Module._load = originalLoad;
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("SQLite open failure does not fall back after better-sqlite3 loads", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-postgres-reader-"));
  const databasePath = path.join(directory, "invalid.db");
  fs.writeFileSync(databasePath, "not a SQLite database");

  const originalLoad = Module._load;
  class FakeBetterSqlite3 {
    constructor() {
      const openError = new Error("database open failed");
      openError.code = "MODULE_NOT_FOUND";
      throw openError;
    }
  }

  Module._load = function load(request, parent, isMain) {
    if (request === "better-sqlite3") {
      return FakeBetterSqlite3;
    }
    return Reflect.apply(originalLoad, this, [request, parent, isMain]);
  };

  try {
    assert.throws(
      () => readSourceSnapshot(databasePath),
      new Error("source SQLite を read-only で開けません"),
    );
  } finally {
    Module._load = originalLoad;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("source path is mandatory even when DATABASE_URL is present", () => {
  const result = require("node:child_process").spawnSync(
    process.execPath,
    [importScript, "--dry-run"],
    {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "postgresql://runtime.invalid/db" },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source SQLite path/);
});

test("reconciliation compares Canvas JSON, geometry, and searchText without printing values", {
  skip: !hasSqliteCli(),
}, () => {
  const fixture = createFixture();
  try {
    const snapshot = readSourceSnapshot(fixture.databasePath);
    const targetRows = JSON.parse(JSON.stringify(snapshot.rows));
    const equal = reconcileRows(snapshot.rows, targetRows);
    assert.equal(equal.pass, true);

    targetRows.notebook_canvases[0].document_json = targetRows.notebook_canvases[0].document_json.replace(
      "PRIVATE_CANVAS_TEXT",
      "OTHER_CANVAS_TEXT",
    );
    targetRows.notebook_canvases[0].search_text = "OTHER_SEARCH_TEXT";
    const changed = reconcileRows(snapshot.rows, targetRows);
    const fields = changed.details.mismatches.map((mismatch) => mismatch.field);

    assert.equal(changed.pass, false);
    assert.ok(fields.includes("document_json_hash"));
    assert.ok(fields.includes("document_json_deep_equal"));
    assert.ok(fields.includes("search_text"));
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});
