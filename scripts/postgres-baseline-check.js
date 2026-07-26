/* eslint-disable @typescript-eslint/no-require-imports -- This is a plain Node operator script. */
const fs = require("node:fs");
const path = require("node:path");

const {
  BASELINE_MIGRATION_NAME,
  PHASE_2_TABLES,
  SOURCE_TABLES,
  printJson,
  projectRoot,
} = require("./postgres-migration-common.js");

function assertIncludes(text, value, message) {
  if (!text.includes(value)) {
    throw new Error(message);
  }
}

function main() {
  const root = projectRoot();
  const schemaPath = path.join(root, "prisma", "schema.postgres.prisma");
  const migrationPath = path.join(
    root,
    "prisma",
    "migrations-postgres",
    BASELINE_MIGRATION_NAME,
    "migration.sql",
  );
  const lockPath = path.join(root, "prisma", "migrations-postgres", "migration_lock.toml");
  const schema = fs.readFileSync(schemaPath, "utf8");
  const migration = fs.readFileSync(migrationPath, "utf8");
  const lock = fs.readFileSync(lockPath, "utf8");

  assertIncludes(schema, 'provider = "postgresql"', "Postgres schema provider がありません");
  assertIncludes(lock, 'provider = "postgresql"', "Postgres migration lock がありません");
  for (const table of SOURCE_TABLES) {
    assertIncludes(migration, `CREATE TABLE "${table}"`, `baseline table がありません: ${table}`);
  }
  for (const index of [
    'CREATE INDEX "notebooks_note_date_idx"',
    'CREATE INDEX "notebooks_next_review_date_idx"',
    'CREATE UNIQUE INDEX "tags_name_key"',
    'CREATE INDEX "cues_notebook_id_order_idx"',
  ]) {
    assertIncludes(migration, index, `baseline index がありません: ${index}`);
  }

  if (/\bPRAGMA\b|\bDATETIME\b|"overview"/i.test(migration)) {
    throw new Error("Postgres baseline に SQLite 専用 SQL または旧 overview column があります");
  }
  for (const table of PHASE_2_TABLES) {
    if (migration.includes(`"${table}"`)) {
      throw new Error(`Phase 2 table が baseline に混入しています: ${table}`);
    }
  }

  printJson({
    baselineMigration: BASELINE_MIGRATION_NAME,
    migrationPath: path.relative(root, migrationPath),
    schemaPath: path.relative(root, schemaPath),
    tables: SOURCE_TABLES,
    verified: true,
  });
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "baseline check failed");
  process.exitCode = 1;
}
