// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- this focused contract test uses VM-loaded modules and SQLite.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadModule(relativePath, dependencies = {}) {
  const output = ts.transpileModule(readSource(relativePath), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const moduleObject = { exports: {} };

  vm.runInNewContext(output, {
    module: moduleObject,
    exports: moduleObject.exports,
    require: (request) => {
      if (Object.prototype.hasOwnProperty.call(dependencies, request)) {
        return dependencies[request];
      }
      throw new Error(`Unexpected dependency: ${request}`);
    },
  });

  return moduleObject.exports;
}

test("NotebookTag stores request order and tag links are replaced with that order", async () => {
  const { createTagLinks, replaceTagRelations } = loadModule(
    "src/server/notes/infrastructure/relations.repository.ts",
  );
  const tagIds = new Map();
  const relationRows = [];
  const calls = [];
  let nextTagId = 1;
  const tx = {
    tag: {
      upsert: async ({ where, create }) => {
        if (!tagIds.has(where.name)) {
          tagIds.set(where.name, `tag-${nextTagId++}`);
        }
        return { id: tagIds.get(where.name), name: create.name };
      },
    },
    notebookTag: {
      create: async ({ data }) => {
        relationRows.push(data);
      },
      deleteMany: async (input) => {
        calls.push(input);
        relationRows.length = 0;
      },
    },
  };

  await createTagLinks(tx, "note-1", [
    { name: "z", color: null },
    { name: "a", color: null },
  ]);

  assert.deepEqual(normalize(relationRows), [
    { notebookId: "note-1", tagId: "tag-1", order: 0 },
    { notebookId: "note-1", tagId: "tag-2", order: 1 },
  ]);

  await replaceTagRelations(tx, "note-1", [
    { name: "a", color: null },
    { name: "z", color: null },
  ]);

  assert.deepEqual(normalize(calls), [{ where: { notebookId: "note-1" } }]);
  assert.deepEqual(normalize(relationRows), [
    { notebookId: "note-1", tagId: "tag-2", order: 0 },
    { notebookId: "note-1", tagId: "tag-1", order: 1 },
  ]);
});

test("note relations request ascending order while tag candidates remain name ascending", async () => {
  const findManyCalls = [];
  const findFirstCalls = [];
  const { findNotes, findNoteDetail } = loadModule(
    "src/server/notes/infrastructure/read.repository.ts",
    {
      "@/server/infrastructure/prisma": {
        prisma: {
          notebook: {
            findMany: async (input) => {
              findManyCalls.push(input);
              return [];
            },
            findFirst: async (input) => {
              findFirstCalls.push(input);
              return null;
            },
          },
        },
      },
      "./read.query": {
        PAGE_SIZE: 50,
        buildNotesWhere: () => ({}),
      },
    },
  );
  const tagCalls = [];
  const { findTagOptions } = loadModule(
    "src/server/notes/infrastructure/tag.repository.ts",
    {
      "@/server/infrastructure/prisma": {
        prisma: {
          tag: {
            findMany: async (input) => {
              tagCalls.push(input);
              return [];
            },
          },
        },
      },
    },
  );

  await findNotes({ page: 1 });
  await findNoteDetail("note-1");
  await findTagOptions();

  assert.deepEqual(normalize(findManyCalls[0].include.tags.orderBy), { order: "asc" });
  assert.deepEqual(normalize(findFirstCalls[0].include.tags.orderBy), { order: "asc" });
  assert.deepEqual(normalize(tagCalls[0].orderBy), { name: "asc" });
});

test("the presenter preserves the relation order instead of sorting tag names", () => {
  const { formatTags } = loadModule("src/server/notes/presenters/notes.helpers.ts");

  assert.deepEqual(
    normalize(formatTags([
      { tag: { id: "tag-z", name: "z", color: null } },
      { tag: { id: "tag-a", name: "a", color: null } },
    ])),
    [
      { id: "tag-z", name: "z", color: null },
      { id: "tag-a", name: "a", color: null },
    ],
  );
});

test("the SQLite migration backfills existing tags deterministically and indexes notebook order", () => {
  const migration = readSource(
    "prisma/migrations/20260809090000_add_notebook_tag_order/migration.sql",
  );
  const db = new Database(":memory:");

  try {
    db.exec(`
      CREATE TABLE "notebooks" ("id" TEXT NOT NULL PRIMARY KEY);
      CREATE TABLE "tags" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL);
      CREATE TABLE "notebook_tags" (
        "notebook_id" TEXT NOT NULL,
        "tag_id" TEXT NOT NULL,
        PRIMARY KEY ("notebook_id", "tag_id")
      );
      INSERT INTO "notebooks" VALUES ('note-1'), ('note-2');
      INSERT INTO "tags" VALUES ('tag-z', 'z'), ('tag-a', 'a'), ('tag-m', 'm');
      INSERT INTO "notebook_tags" VALUES
        ('note-1', 'tag-z'), ('note-1', 'tag-a'), ('note-1', 'tag-m'),
        ('note-2', 'tag-z');
    `);
    db.exec(migration);

    const rows = db.prepare(`
      SELECT "notebook_id", "tag_id", "order"
      FROM "notebook_tags"
      ORDER BY "notebook_id", "order"
    `).all();

    assert.deepEqual(rows, [
      { notebook_id: "note-1", tag_id: "tag-a", order: 0 },
      { notebook_id: "note-1", tag_id: "tag-m", order: 1 },
      { notebook_id: "note-1", tag_id: "tag-z", order: 2 },
      { notebook_id: "note-2", tag_id: "tag-z", order: 0 },
    ]);

    const index = db.prepare(`PRAGMA index_list("notebook_tags")`).all()
      .find((entry) => entry.name === "notebook_tags_notebook_id_order_idx");
    assert.ok(index);
  } finally {
    db.close();
  }
});

test("SQLite and Postgres schemas and migrations expose the same NotebookTag order contract", () => {
  for (const schemaPath of ["prisma/schema.prisma", "prisma/schema.postgres.prisma"]) {
    const schema = readSource(schemaPath);
    assert.match(schema, /order\s+Int\s+@default\(0\)\s+@map\("order"\)/);
    assert.match(schema, /@@index\(\[notebookId, order\]\)/);
  }

  const postgresMigration = readSource(
    "prisma/migrations-postgres/20260809090000_add_notebook_tag_order/migration.sql",
  );
  assert.match(postgresMigration, /ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0/);
  assert.match(postgresMigration, /UPDATE "notebook_tags"[\s\S]*FROM "ordered_tags"/);
  assert.match(
    postgresMigration,
    /CREATE INDEX "notebook_tags_notebook_id_order_idx"[\s\S]*\("notebook_id", "order"\)/,
  );
});

test("note list and detail UI consume the API tag array without adding a name sort", () => {
  const listCard = readSource("src/modules/notes/ui/components/list/card.tsx");
  const detailDisplay = readSource("src/modules/notes/ui/components/detail/display.tsx");

  assert.match(listCard, /note\.tags\.map\(\(tag\) =>/);
  assert.match(detailDisplay, /tags\.map\(\(tag\) =>/);
  assert.doesNotMatch(listCard, /tags\.sort\(|tag\.name\.localeCompare/);
  assert.doesNotMatch(detailDisplay, /tags\.sort\(|tag\.name\.localeCompare/);
});
