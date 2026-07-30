/* eslint-disable @typescript-eslint/no-require-imports -- These operator tools run as plain Node scripts. */
const crypto = require("node:crypto");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const util = require("node:util");

const BASELINE_MIGRATION_NAME = "20260726000000_postgres_baseline";
const SOURCE_TABLES = [
  "notebooks",
  "notebook_canvases",
  "tags",
  "notebook_tags",
  "cues",
];
const SOURCE_TABLE_ORDER = [
  "notebooks",
  "tags",
  "notebook_canvases",
  "cues",
  "notebook_tags",
];
const SOURCE_COLUMNS = {
  notebooks: [
    "id",
    "title",
    "note_date",
    "source_type",
    "source_title",
    "body",
    "body_mode",
    "summary",
    "next_review_date",
    "reviewed_at",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
  notebook_canvases: [
    "notebook_id",
    "schema_version",
    "document_json",
    "search_text",
    "created_at",
    "updated_at",
  ],
  tags: ["id", "name", "color", "created_at"],
  notebook_tags: ["notebook_id", "tag_id"],
  cues: ["id", "notebook_id", "text", "order", "created_at", "updated_at"],
};
const REQUIRED_NON_NULL_COLUMNS = {
  notebooks: [
    "id",
    "title",
    "note_date",
    "source_title",
    "body",
    "body_mode",
    "summary",
    "created_at",
    "updated_at",
  ],
  notebook_canvases: [
    "notebook_id",
    "schema_version",
    "document_json",
    "search_text",
    "created_at",
    "updated_at",
  ],
  tags: ["id", "name", "created_at"],
  notebook_tags: ["notebook_id", "tag_id"],
  cues: ["id", "notebook_id", "text", "order", "created_at", "updated_at"],
};
const DATE_COLUMNS = {
  notebooks: [
    "note_date",
    "next_review_date",
    "reviewed_at",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
  notebook_canvases: ["created_at", "updated_at"],
  tags: ["created_at"],
  notebook_tags: [],
  cues: ["created_at", "updated_at"],
};
const TABLE_PRIMARY_KEY = {
  notebooks: (row) => row.id,
  notebook_canvases: (row) => row.notebook_id,
  tags: (row) => row.id,
  notebook_tags: (row) => `${row.notebook_id}\u0000${row.tag_id}`,
  cues: (row) => row.id,
};
const PHASE_2_TABLES = [
  "notebook_draft_states",
  "notebook_review_progresses",
  "note_cards",
  "cue_cards",
  "note_cue_links",
  "soft_delete_buffers",
  "backup_logs",
];
const MAX_REPORTED_IDS = 100;
const CANVAS_MIN_PAGE_DIMENSION = 320;
const CANVAS_MAX_PAGE_DIMENSION = 4000;
const BETTER_SQLITE3_BINDING_LOAD_ERROR_PATTERN =
  /Could not locate the bindings file|better[_-]sqlite3\.node|Cannot find module ['"](?:bindings|better-sqlite3)['"]/i;

function isBetterSqlite3NativeLoadError(error, phase) {
  if (error?.code === "ERR_DLOPEN_FAILED") {
    return true;
  }

  if (phase === "require") {
    return error?.code === "MODULE_NOT_FOUND";
  }

  if (phase !== "constructor") {
    return false;
  }

  const errorText = [error?.message, error?.stack]
    .filter((value) => typeof value === "string")
    .join("\n");
  return BETTER_SQLITE3_BINDING_LOAD_ERROR_PATTERN.test(errorText);
}

function loadProjectEnv(projectRoot) {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return;

  try {
    const envModule = require("../config/project-env.js");
    envModule.loadProjectEnv(projectRoot);
  } catch {
    throw new Error("project environment file を読み込めません");
  }
}

function hashText(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hashFile(filePath) {
  return hashText(fs.readFileSync(filePath));
}

function parseArguments(argv) {
  const result = {
    allowTarget: undefined,
    dryRun: false,
    help: false,
    source: undefined,
    targetEnvironment: undefined,
    targetProject: undefined,
  };

  const valueOptions = new Map([
    ["--allow-target", "allowTarget"],
    ["--source", "source"],
    ["--target-environment", "targetEnvironment"],
    ["--target-project", "targetProject"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--dry-run") {
      result.dryRun = true;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      result.help = true;
      continue;
    }

    const equalsIndex = argument.indexOf("=");
    const option = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : argument.slice(equalsIndex + 1);
    const property = valueOptions.get(option);

    if (property === undefined) {
      throw new Error(`未対応のオプションです: ${option}`);
    }

    const value = inlineValue === undefined ? argv[++index] : inlineValue;
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`${option} の値が必要です`);
    }

    result[property] = value;
  }

  return result;
}

function resolveSourcePath(argumentSource) {
  const configuredPath = argumentSource ?? process.env.SOURCE_SQLITE_PATH;

  if (configuredPath === undefined || configuredPath.trim() === "") {
    throw new Error(
      "source SQLite path が必要です。--source または SOURCE_SQLITE_PATH を明示してください",
    );
  }

  if (configuredPath.startsWith("file:")) {
    throw new Error("source は file: URL ではなく SQLite ファイルパスを指定してください");
  }

  let realPath;
  try {
    realPath = fs.realpathSync(configuredPath);
  } catch {
    throw new Error("指定された source SQLite ファイルを解決できません");
  }

  let stats;
  try {
    stats = fs.statSync(realPath);
  } catch {
    throw new Error("指定された source SQLite ファイルを検査できません");
  }

  if (!stats.isFile() || stats.size === 0) {
    throw new Error("source は空でない SQLite ファイルである必要があります");
  }

  for (const suffix of ["-wal", "-shm"]) {
    if (fs.existsSync(`${realPath}${suffix}`)) {
      throw new Error(
        "source SQLite に WAL/SHM sidecar が残っています。書き込みを停止して freeze してから再実行してください",
      );
    }
  }

  return realPath;
}

function createSqliteReader(sourcePath) {
  let BetterSqlite3;
  let shouldUseSqliteCliFallback = false;
  try {
    // better-sqlite3 is the normal operator dependency and opens read-only.
    BetterSqlite3 = require("better-sqlite3");
  } catch (error) {
    if (!isBetterSqlite3NativeLoadError(error, "require")) {
      throw error;
    }
    shouldUseSqliteCliFallback = true;
  }

  if (!shouldUseSqliteCliFallback) {
    let database;
    try {
      database = new BetterSqlite3(sourcePath, {
        fileMustExist: true,
        readonly: true,
      });
    } catch (error) {
      if (!isBetterSqlite3NativeLoadError(error, "constructor")) {
        throw error;
      }
      shouldUseSqliteCliFallback = true;
    }

    if (!shouldUseSqliteCliFallback) {
      database.pragma("query_only = ON");

      return {
        all(sql) {
          return database.prepare(sql).all();
        },
        close() {
          database.close();
        },
      };
    }
  }

  const sqliteBinary = process.env.SQLITE3_BIN ?? "sqlite3";
  try {
    execFileSync(sqliteBinary, ["-version"], { stdio: "ignore" });
  } catch {
    throw new Error(
      "source SQLite reader がありません。better-sqlite3 または sqlite3 CLI を用意してください",
    );
  }

  return {
    all(sql) {
      try {
        const output = execFileSync(
          sqliteBinary,
          [
            "-readonly",
            "-bail",
            "-json",
            "-cmd",
            "PRAGMA query_only=ON;",
            "--",
            sourcePath,
            sql,
          ],
          {
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        const trimmed = output.trim();
        return trimmed === "" ? [] : JSON.parse(trimmed);
      } catch {
        throw new Error("source SQLite の read-only query に失敗しました");
      }
    },
    close() {},
  };
}

function readRequiredColumns(reader, table) {
  const columns = reader
    .all(`PRAGMA table_info("${table}")`)
    .map((column) => column.name);
  const missing = SOURCE_COLUMNS[table].filter((column) => !columns.includes(column));

  if (missing.length > 0) {
    throw new Error(`source schema の ${table} に必要な column がありません`);
  }

  return columns;
}

function readMigrationState(reader) {
  const rows = reader.all(
    `SELECT "migration_name", "applied_steps_count", "finished_at", "rolled_back_at"
     FROM "_prisma_migrations" ORDER BY "started_at", "migration_name"`,
  );

  const migrations = rows.map((row) => ({
    appliedStepsCount: row.applied_steps_count,
    finished: row.finished_at !== null,
    name: row.migration_name,
    rolledBack: row.rolled_back_at !== null,
  }));

  if (
    migrations.length === 0 ||
    migrations.some((migration) => !migration.finished || migration.rolledBack)
  ) {
    throw new Error("source SQLite の Prisma migration state が完了状態ではありません");
  }

  return migrations;
}

function parseCanvasDocument(documentJson, notebookId) {
  let document;
  try {
    document = JSON.parse(documentJson);
  } catch {
    throw new Error("Canvas document_json が JSON として解釈できません");
  }

  if (
    document === null ||
    typeof document !== "object" ||
    document.schemaVersion !== 1 ||
    document.page === null ||
    typeof document.page !== "object" ||
    document.page.background !== "paper" ||
    !Number.isInteger(document.page.width) ||
    !Number.isInteger(document.page.height) ||
    document.page.width < CANVAS_MIN_PAGE_DIMENSION ||
    document.page.width > CANVAS_MAX_PAGE_DIMENSION ||
    document.page.height < CANVAS_MIN_PAGE_DIMENSION ||
    document.page.height > CANVAS_MAX_PAGE_DIMENSION ||
    !Array.isArray(document.elements)
  ) {
    throw new Error(`Canvas document の契約が不正です (${notebookId})`);
  }

  const elementIds = new Set();
  for (const [index, element] of document.elements.entries()) {
    if (
      element === null ||
      typeof element !== "object" ||
      typeof element.id !== "string" ||
      element.id.length === 0 ||
      elementIds.has(element.id)
    ) {
      throw new Error(`Canvas element id が不正です (${notebookId}:${index})`);
    }
    elementIds.add(element.id);
  }

  return document;
}

function readSourceSnapshot(sourcePath) {
  const initialHash = hashFile(sourcePath);
  const reader = createSqliteReader(sourcePath);

  let snapshot;
  try {
    const tableRows = reader.all(
      `SELECT "name" FROM "sqlite_master"
       WHERE "type" = 'table' AND "name" NOT LIKE 'sqlite_%'
       ORDER BY "name"`,
    );
    const tableNames = tableRows.map((row) => row.name);
    const requiredTables = [...SOURCE_TABLES, "_prisma_migrations"];

    if (requiredTables.some((table) => !tableNames.includes(table))) {
      throw new Error("source SQLite が現行 MVP schema ではありません");
    }
    if (PHASE_2_TABLES.some((table) => tableNames.includes(table))) {
      throw new Error("source SQLite に Phase 2 table が含まれています");
    }

    const columns = {};
    for (const table of SOURCE_TABLES) {
      columns[table] = readRequiredColumns(reader, table);
    }

    const migrations = readMigrationState(reader);
    const integrityRows = reader.all("PRAGMA integrity_check");
    const integrity = integrityRows.length > 0 ? Object.values(integrityRows[0])[0] : "";
    if (integrity !== "ok") {
      throw new Error("source SQLite integrity_check が成功しませんでした");
    }

    const foreignKeyViolations = reader.all("PRAGMA foreign_key_check").length;
    const rows = {
      notebooks: reader.all(
        `SELECT "id", "title", "note_date", "source_type", "source_title", "body",
          "body_mode", "summary", "next_review_date", "reviewed_at", "created_at",
          "updated_at", "deleted_at" FROM "notebooks" ORDER BY "id"`,
      ),
      notebook_canvases: reader.all(
        `SELECT "notebook_id", "schema_version", "document_json", "search_text",
          "created_at", "updated_at" FROM "notebook_canvases" ORDER BY "notebook_id"`,
      ),
      tags: reader.all(
        `SELECT "id", "name", "color", "created_at" FROM "tags" ORDER BY "id"`,
      ),
      notebook_tags: reader.all(
        `SELECT "notebook_id", "tag_id" FROM "notebook_tags"
         ORDER BY "notebook_id", "tag_id"`,
      ),
      cues: reader.all(
        `SELECT "id", "notebook_id", "text", "order", "created_at", "updated_at"
         FROM "cues" ORDER BY "id"`,
      ),
    };

    validateRows(rows, foreignKeyViolations);
    for (const canvas of rows.notebook_canvases) {
      parseCanvasDocument(canvas.document_json, canvas.notebook_id);
    }

    snapshot = {
      source: {
        bytes: fs.statSync(sourcePath).size,
        path: sourcePath,
        sha256: initialHash,
      },
      schema: {
        columns,
        migrations,
        tables: tableNames,
      },
      rows,
    };
  } finally {
    reader.close();
  }

  assertSourceUnchanged(snapshot);
  return snapshot;
}

function validateRows(rows, foreignKeyViolations = 0) {
  if (foreignKeyViolations !== 0) {
    throw new Error("source SQLite に foreign key orphan があります");
  }

  for (const table of SOURCE_TABLES) {
    const tableRows = rows[table];
    const duplicateKeys = findDuplicateKeys(tableRows, TABLE_PRIMARY_KEY[table]);
    if (duplicateKeys.length > 0) {
      throw new Error(`source ${table} に duplicate primary key があります`);
    }

    for (const column of REQUIRED_NON_NULL_COLUMNS[table]) {
      if (tableRows.some((row) => row[column] === null || row[column] === undefined)) {
        throw new Error(`source ${table} の必須 column に null があります`);
      }
    }
  }

  const notebookIds = new Set(rows.notebooks.map((row) => row.id));
  const tagIds = new Set(rows.tags.map((row) => row.id));
  if (
    rows.notebook_canvases.some((row) => !notebookIds.has(row.notebook_id)) ||
    rows.cues.some((row) => !notebookIds.has(row.notebook_id)) ||
    rows.notebook_tags.some(
      (row) => !notebookIds.has(row.notebook_id) || !tagIds.has(row.tag_id),
    )
  ) {
    throw new Error("source row の parent ID が存在しません");
  }
}

function findDuplicateKeys(rows, keyFunction) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFunction(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
}

function normalizeDate(value, fieldName = "date") {
  if (value === null || value === undefined) return null;

  const raw = value instanceof Date ? value.toISOString() : String(value);
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const parsed = new Date(hasTimezone ? raw : `${raw}Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} が有効な日時ではありません`);
  }
  return parsed.toISOString();
}

function normalizedValue(table, field, value) {
  return DATE_COLUMNS[table].includes(field)
    ? normalizeDate(value, `${table}.${field}`)
    : value;
}

function incrementCount(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function sortedCountMap(values) {
  const counts = {};
  for (const value of values) incrementCount(counts, String(value));
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function summarizeCanvas(canvas) {
  const document = parseCanvasDocument(canvas.document_json, canvas.notebook_id);
  const elementTypeCounts = sortedCountMap(document.elements.map((element) => element.type));

  return {
    documentSha256: hashText(canvas.document_json),
    elementCount: document.elements.length,
    elementHashes: document.elements.map((element) => hashText(JSON.stringify(element))),
    elementTypeCounts,
    notebookId: canvas.notebook_id,
    page: {
      height: document.page.height,
      width: document.page.width,
    },
    parsedDocumentSha256: hashText(JSON.stringify(document)),
    schemaVersion: canvas.schema_version,
    searchTextSha256: hashText(canvas.search_text),
  };
}

function buildInventory(rows) {
  const notebooks = rows.notebooks;
  const noteDates = notebooks
    .map((row) => normalizeDate(row.note_date, "notebooks.note_date"))
    .sort();
  const canvasDetails = rows.notebook_canvases.map(summarizeCanvas).sort((a, b) =>
    a.notebookId.localeCompare(b.notebookId),
  );

  return {
    bodyModes: sortedCountMap(notebooks.map((row) => row.body_mode)),
    canvas: {
      details: canvasDetails,
      elementCounts: sortedCountMap(canvasDetails.map((canvas) => canvas.elementCount)),
      pages: sortedCountMap(
        canvasDetails.map((canvas) => `${canvas.page.width}x${canvas.page.height}`),
      ),
      schemaVersions: sortedCountMap(
        canvasDetails.map((canvas) => canvas.schemaVersion),
      ),
      validJsonCount: canvasDetails.length,
    },
    counts: Object.fromEntries(
      SOURCE_TABLES.map((table) => [table, rows[table].length]),
    ),
    dateRange: {
      from: noteDates[0] ?? null,
      to: noteDates.at(-1) ?? null,
    },
  };
}

function assertSourceUnchanged(snapshot) {
  if (hashFile(snapshot.source.path) !== snapshot.source.sha256) {
    throw new Error("source SQLite の SHA-256 が snapshot 後に変化しました。import を中止しました");
  }
}

function resolveTargetLabel(args) {
  const project = args.targetProject ?? process.env.POSTGRES_TARGET_PROJECT;
  const environment = args.targetEnvironment ?? process.env.POSTGRES_TARGET_ENVIRONMENT;
  const allowTarget = args.allowTarget ?? process.env.POSTGRES_TARGET_ALLOWLIST;

  if (!project || !environment || !allowTarget) {
    throw new Error(
      "target project、target environment、POSTGRES_TARGET_ALLOWLIST（または --allow-target）を明示してください",
    );
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(project)) {
    throw new Error("target project label が不正です");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(environment)) {
    throw new Error("target environment label が不正です");
  }
  if (/^(prod|production)$/i.test(environment)) {
    throw new Error("Production target はこの one-off workflow では許可していません");
  }

  const label = `${project}:${environment}`;
  if (allowTarget !== label) {
    throw new Error("target label が明示的な許可値と一致しません");
  }

  return { environment, label, project };
}

function resolveDirectUrl() {
  const directUrl = process.env.DIRECT_URL;
  if (directUrl === undefined || directUrl.trim() === "") {
    throw new Error("DIRECT_URL が必要です。DATABASE_URL は import target に使用しません");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(directUrl);
  } catch {
    throw new Error("DIRECT_URL を検証できません");
  }

  if (
    !["postgres:", "postgresql:"].includes(parsedUrl.protocol) ||
    !parsedUrl.hostname ||
    !parsedUrl.pathname ||
    parsedUrl.pathname === "/" ||
    parsedUrl.hash
  ) {
    throw new Error("DIRECT_URL は PostgreSQL URL を指定してください");
  }

  const validatedUrl = directUrl;

  if (
    process.env.DATABASE_URL !== undefined &&
    process.env.DATABASE_URL === validatedUrl
  ) {
    throw new Error("DIRECT_URL と DATABASE_URL は import では同一値にできません");
  }
  if (parsedUrl.port === "6543" || parsedUrl.searchParams.get("pgbouncer") === "true") {
    throw new Error("DIRECT_URL に runtime transaction pooler URL は指定できません");
  }

  return validatedUrl;
}

function requireTargetConfiguration(args) {
  const target = resolveTargetLabel(args);
  const directUrl = resolveDirectUrl();
  return { directUrl, target };
}

async function connectPostgres(directUrl) {
  let Pool;
  try {
    ({ Pool } = require("pg"));
  } catch {
    throw new Error("pg package がありません。依存関係を install してから target 操作を実行してください");
  }

  const pool = new Pool({
    application_name: "cornell-postgres-migration",
    connectionString: directUrl,
    max: 1,
  });
  let client;
  try {
    client = await pool.connect();
  } catch {
    await pool.end();
    throw new Error("Postgres target に接続できませんでした");
  }

  return { client, pool };
}

async function assertPostgresBaseline(client) {
  const tableResult = await client.query(
    `SELECT "table_name" FROM "information_schema"."tables"
     WHERE "table_schema" = 'public' AND "table_name" = ANY($1::text[])
     ORDER BY "table_name"`,
    [SOURCE_TABLES],
  );
  const presentTables = tableResult.rows.map((row) => row.table_name);
  if (SOURCE_TABLES.some((table) => !presentTables.includes(table))) {
    throw new Error("Postgres target に current MVP baseline の全 table がありません");
  }

  const phase2Result = await client.query(
    `SELECT "table_name" FROM "information_schema"."tables"
     WHERE "table_schema" = 'public' AND "table_name" = ANY($1::text[])`,
    [PHASE_2_TABLES],
  );
  if (phase2Result.rows.length > 0) {
    throw new Error("Postgres target に Phase 2 table が含まれています");
  }

  const migrationResult = await client.query(
    `SELECT "migration_name", "finished_at", "rolled_back_at", "applied_steps_count"
     FROM "_prisma_migrations" WHERE "migration_name" = $1`,
    [BASELINE_MIGRATION_NAME],
  );
  const migration = migrationResult.rows[0];
  if (
    migration === undefined ||
    migration.finished_at === null ||
    migration.rolled_back_at !== null ||
    migration.applied_steps_count < 1
  ) {
    throw new Error("Postgres target に完了済みの MVP baseline migration がありません");
  }
}

async function fetchTargetRows(client) {
  const queries = {
    notebooks: `SELECT "id", "title", "note_date", "source_type", "source_title", "body",
      "body_mode", "summary", "next_review_date", "reviewed_at", "created_at",
      "updated_at", "deleted_at" FROM "notebooks" ORDER BY "id"`,
    notebook_canvases: `SELECT "notebook_id", "schema_version", "document_json", "search_text",
      "created_at", "updated_at" FROM "notebook_canvases" ORDER BY "notebook_id"`,
    tags: `SELECT "id", "name", "color", "created_at" FROM "tags" ORDER BY "id"`,
    notebook_tags: `SELECT "notebook_id", "tag_id" FROM "notebook_tags"
      ORDER BY "notebook_id", "tag_id"`,
    cues: `SELECT "id", "notebook_id", "text", "order", "created_at", "updated_at"
      FROM "cues" ORDER BY "id"`,
  };
  const rows = {};

  for (const table of SOURCE_TABLE_ORDER) {
    try {
      rows[table] = (await client.query(queries[table])).rows;
    } catch {
      throw new Error(`Postgres target の ${table} を読み取れませんでした`);
    }
  }

  return rows;
}

function totalRows(rows) {
  return SOURCE_TABLES.reduce((total, table) => total + rows[table].length, 0);
}

async function assertTargetEmpty(client) {
  const rows = await fetchTargetRows(client);
  if (totalRows(rows) !== 0) {
    throw new Error("Postgres target が空ではありません。既存行の無条件上書きは行いません");
  }
  return rows;
}

async function assertRestoreTargetBlank(client) {
  const applicationTables = [
    ...SOURCE_TABLES,
    ...PHASE_2_TABLES,
    "_prisma_migrations",
  ];
  const result = await client.query(
    `SELECT "table_name" FROM "information_schema"."tables"
     WHERE "table_schema" = 'public' AND "table_name" = ANY($1::text[])
     ORDER BY "table_name"`,
    [applicationTables],
  );

  if (result.rows.length > 0) {
    throw new Error(
      "restore target に既存の application schema があります。空の isolated database を指定してください",
    );
  }
}

async function lockTargetTables(client) {
  await client.query(
    `LOCK TABLE "notebooks", "tags", "notebook_canvases", "cues", "notebook_tags"
     IN SHARE ROW EXCLUSIVE MODE`,
  );
}

function insertDate(row, field, table) {
  return normalizeDate(row[field], `${table}.${field}`);
}

async function insertSourceRows(client, rows) {
  const statements = {
    notebooks: `INSERT INTO "notebooks"
      ("id", "title", "note_date", "source_type", "source_title", "body", "body_mode",
       "summary", "next_review_date", "reviewed_at", "created_at", "updated_at", "deleted_at")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    tags: `INSERT INTO "tags" ("id", "name", "color", "created_at")
      VALUES ($1, $2, $3, $4)`,
    notebook_canvases: `INSERT INTO "notebook_canvases"
      ("notebook_id", "schema_version", "document_json", "search_text", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, $6)`,
    cues: `INSERT INTO "cues"
      ("id", "notebook_id", "text", "order", "created_at", "updated_at")
      VALUES ($1, $2, $3, $4, $5, $6)`,
    notebook_tags: `INSERT INTO "notebook_tags" ("notebook_id", "tag_id") VALUES ($1, $2)`,
  };

  for (const row of rows.notebooks) {
    await client.query(statements.notebooks, [
      row.id,
      row.title,
      insertDate(row, "note_date", "notebooks"),
      row.source_type,
      row.source_title,
      row.body,
      row.body_mode,
      row.summary,
      insertDate(row, "next_review_date", "notebooks"),
      insertDate(row, "reviewed_at", "notebooks"),
      insertDate(row, "created_at", "notebooks"),
      insertDate(row, "updated_at", "notebooks"),
      insertDate(row, "deleted_at", "notebooks"),
    ]);
  }

  for (const row of rows.tags) {
    await client.query(statements.tags, [
      row.id,
      row.name,
      row.color,
      insertDate(row, "created_at", "tags"),
    ]);
  }

  for (const row of rows.notebook_canvases) {
    // document_json and search_text are inserted byte-for-byte. Parsing above is
    // validation/metadata only; no renderer, fit, clip, or text extraction runs.
    await client.query(statements.notebook_canvases, [
      row.notebook_id,
      row.schema_version,
      row.document_json,
      row.search_text,
      insertDate(row, "created_at", "notebook_canvases"),
      insertDate(row, "updated_at", "notebook_canvases"),
    ]);
  }

  for (const row of rows.cues) {
    await client.query(statements.cues, [
      row.id,
      row.notebook_id,
      row.text,
      row.order,
      insertDate(row, "created_at", "cues"),
      insertDate(row, "updated_at", "cues"),
    ]);
  }

  for (const row of rows.notebook_tags) {
    await client.query(statements.notebook_tags, [row.notebook_id, row.tag_id]);
  }
}

function reportedIds(values) {
  const ids = values.slice(0, MAX_REPORTED_IDS);
  return {
    ids,
    truncated: values.length > MAX_REPORTED_IDS,
  };
}

function compareIdSets(sourceRows, targetRows, table, keyFunction, mismatches) {
  const sourceIds = sourceRows[table].map(keyFunction).sort();
  const targetIds = targetRows[table].map(keyFunction).sort();
  const sourceSet = new Set(sourceIds);
  const targetSet = new Set(targetIds);
  const missing = sourceIds.filter((id) => !targetSet.has(id));
  const extra = targetIds.filter((id) => !sourceSet.has(id));

  if (missing.length > 0 || extra.length > 0) {
    mismatches.push({
      field: "id_set",
      extra: reportedIds(extra),
      missing: reportedIds(missing),
      table,
    });
  }

  return {
    extraCount: extra.length,
    missingCount: missing.length,
    sourceCount: sourceIds.length,
    targetCount: targetIds.length,
  };
}

function compareScalarRows(sourceRows, targetRows, table, fields, mismatches) {
  const targetById = new Map(targetRows[table].map((row) => [TABLE_PRIMARY_KEY[table](row), row]));

  for (const sourceRow of sourceRows[table]) {
    const key = TABLE_PRIMARY_KEY[table](sourceRow);
    const targetRow = targetById.get(key);
    if (targetRow === undefined) continue;

    for (const field of fields) {
      const sourceValue = normalizedValue(table, field, sourceRow[field]);
      const targetValue = normalizedValue(table, field, targetRow[field]);
      if (!util.isDeepStrictEqual(sourceValue, targetValue)) {
        mismatches.push({ field, id: key, table });
      }
    }
  }
}

function compareCanvasRows(sourceRows, targetRows, mismatches) {
  const targetById = new Map(
    targetRows.notebook_canvases.map((row) => [row.notebook_id, row]),
  );

  for (const sourceRow of sourceRows.notebook_canvases) {
    const targetRow = targetById.get(sourceRow.notebook_id);
    if (targetRow === undefined) continue;
    const id = sourceRow.notebook_id;
    const sourceDocument = parseCanvasDocument(sourceRow.document_json, id);
    let targetDocument;
    try {
      targetDocument = parseCanvasDocument(targetRow.document_json, id);
    } catch {
      mismatches.push({ field: "document_json_parse", id, table: "notebook_canvases" });
      continue;
    }

    const scalarFields = ["schema_version", "created_at", "updated_at"];
    for (const field of scalarFields) {
      const sourceValue = normalizedValue("notebook_canvases", field, sourceRow[field]);
      const targetValue = normalizedValue("notebook_canvases", field, targetRow[field]);
      if (!util.isDeepStrictEqual(sourceValue, targetValue)) {
        mismatches.push({ field, id, table: "notebook_canvases" });
      }
    }

    if (hashText(sourceRow.document_json) !== hashText(targetRow.document_json)) {
      mismatches.push({ field: "document_json_hash", id, table: "notebook_canvases" });
    }
    if (!util.isDeepStrictEqual(sourceDocument, targetDocument)) {
      mismatches.push({ field: "document_json_deep_equal", id, table: "notebook_canvases" });
    }
    if (sourceRow.search_text !== targetRow.search_text) {
      mismatches.push({ field: "search_text", id, table: "notebook_canvases" });
    }

    for (const field of ["width", "height", "background"]) {
      if (!util.isDeepStrictEqual(sourceDocument.page[field], targetDocument.page[field])) {
        mismatches.push({ field: `page.${field}`, id, table: "notebook_canvases" });
      }
    }

    const sourceElements = new Map(sourceDocument.elements.map((element) => [element.id, element]));
    const targetElements = new Map(targetDocument.elements.map((element) => [element.id, element]));
    const elementIds = new Set([...sourceElements.keys(), ...targetElements.keys()]);
    for (const elementId of elementIds) {
      const sourceElement = sourceElements.get(elementId);
      const targetElement = targetElements.get(elementId);
      if (sourceElement === undefined || targetElement === undefined) {
        mismatches.push({ field: "elements.id_set", id, table: "notebook_canvases" });
        continue;
      }
      for (const field of [
        "id",
        "type",
        "x",
        "y",
        "width",
        "height",
        "rotation",
        "points",
        "z",
        "style",
        "text",
        "textStyle",
      ]) {
        if (!util.isDeepStrictEqual(sourceElement[field], targetElement[field])) {
          mismatches.push({
            field: `elements.${field}`,
            id,
            table: "notebook_canvases",
          });
        }
      }
    }
  }
}

function findNulls(rows) {
  const result = [];
  for (const table of SOURCE_TABLES) {
    for (const field of REQUIRED_NON_NULL_COLUMNS[table]) {
      const nullRows = rows[table].filter(
        (row) => row[field] === null || row[field] === undefined,
      );
      if (nullRows.length > 0) {
        result.push({
          count: nullRows.length,
          field,
          ids: reportedIds(nullRows.map(TABLE_PRIMARY_KEY[table])),
          table,
        });
      }
    }
  }
  return result;
}

function findOrphans(rows) {
  const notebookIds = new Set(rows.notebooks.map((row) => row.id));
  const tagIds = new Set(rows.tags.map((row) => row.id));
  const result = [];
  const checks = [
    ["notebook_canvases", rows.notebook_canvases, (row) => !notebookIds.has(row.notebook_id)],
    ["cues", rows.cues, (row) => !notebookIds.has(row.notebook_id)],
    [
      "notebook_tags",
      rows.notebook_tags,
      (row) => !notebookIds.has(row.notebook_id) || !tagIds.has(row.tag_id),
    ],
  ];
  for (const [table, tableRows, predicate] of checks) {
    const orphanRows = tableRows.filter(predicate);
    if (orphanRows.length > 0) {
      result.push({
        count: orphanRows.length,
        ids: reportedIds(orphanRows.map(TABLE_PRIMARY_KEY[table])),
        table,
      });
    }
  }
  return result;
}

function compareParentIdSets(sourceRows, targetRows, mismatches) {
  const relations = [
    ["notebook_canvases", "notebook_id"],
    ["cues", "notebook_id"],
    ["notebook_tags", "notebook_id"],
    ["notebook_tags", "tag_id"],
  ];
  const result = [];

  for (const [table, field] of relations) {
    const sourceIds = [...new Set(sourceRows[table].map((row) => row[field]))].sort();
    const targetIds = [...new Set(targetRows[table].map((row) => row[field]))].sort();
    const sourceSet = new Set(sourceIds);
    const targetSet = new Set(targetIds);
    const missing = sourceIds.filter((id) => !targetSet.has(id));
    const extra = targetIds.filter((id) => !sourceSet.has(id));
    result.push({
      extraCount: extra.length,
      field,
      missingCount: missing.length,
      sourceCount: sourceIds.length,
      targetCount: targetIds.length,
      table,
    });
    if (missing.length > 0 || extra.length > 0) {
      mismatches.push({
        extra: reportedIds(extra),
        field: "parent_id_set",
        missing: reportedIds(missing),
        table,
      });
    }
  }

  return result;
}

function findDuplicates(rows) {
  const result = [];
  for (const table of SOURCE_TABLES) {
    const duplicateKeys = findDuplicateKeys(rows[table], TABLE_PRIMARY_KEY[table]);
    if (duplicateKeys.length > 0) {
      result.push({ table, keys: reportedIds(duplicateKeys) });
    }
  }
  return result;
}

function reconcileRows(sourceRows, targetRows) {
  const mismatches = [];
  const idSets = {};
  for (const table of SOURCE_TABLES) {
    idSets[table] = compareIdSets(
      sourceRows,
      targetRows,
      table,
      TABLE_PRIMARY_KEY[table],
      mismatches,
    );
  }

  compareScalarRows(
    sourceRows,
    targetRows,
    "notebooks",
    [
      "id",
      "title",
      "note_date",
      "source_type",
      "source_title",
      "body",
      "body_mode",
      "summary",
      "next_review_date",
      "reviewed_at",
      "created_at",
      "updated_at",
      "deleted_at",
    ],
    mismatches,
  );
  compareScalarRows(sourceRows, targetRows, "tags", ["id", "name", "color", "created_at"], mismatches);
  compareScalarRows(sourceRows, targetRows, "cues", ["id", "notebook_id", "text", "order", "created_at", "updated_at"], mismatches);
  compareScalarRows(sourceRows, targetRows, "notebook_tags", ["notebook_id", "tag_id"], mismatches);
  compareCanvasRows(sourceRows, targetRows, mismatches);

  const sourceOrphans = findOrphans(sourceRows);
  const targetOrphans = findOrphans(targetRows);
  const sourceDuplicates = findDuplicates(sourceRows);
  const targetDuplicates = findDuplicates(targetRows);
  const sourceNulls = findNulls(sourceRows);
  const targetNulls = findNulls(targetRows);
  const parentIdSets = compareParentIdSets(sourceRows, targetRows, mismatches);

  if (sourceOrphans.length > 0 || targetOrphans.length > 0) {
    mismatches.push({ field: "foreign_key_orphan", table: "cross_table" });
  }
  if (sourceDuplicates.length > 0 || targetDuplicates.length > 0) {
    mismatches.push({ field: "duplicate_key", table: "cross_table" });
  }
  if (sourceNulls.length > 0 || targetNulls.length > 0) {
    mismatches.push({ field: "unexpected_null", table: "cross_table" });
  }

  const details = {
    counts: {
      source: buildInventory(sourceRows).counts,
      target: buildInventory(targetRows).counts,
    },
    duplicates: { source: sourceDuplicates, target: targetDuplicates },
    foreignKeyOrphans: { source: sourceOrphans, target: targetOrphans },
    idSets,
    mismatches,
    parentIdSets,
    unexpectedNulls: { source: sourceNulls, target: targetNulls },
  };

  return {
    details,
    pass: mismatches.length === 0,
  };
}

async function reconcileTargetSnapshot(snapshot, targetConfiguration) {
  const { client, pool } = await connectPostgres(targetConfiguration.directUrl);

  try {
    await assertPostgresBaseline(client);
    await client.query("SET TIME ZONE 'UTC'");
    const targetRows = await fetchTargetRows(client);
    assertSourceUnchanged(snapshot);
    const reconciliation = reconcileRows(snapshot.rows, targetRows);

    return {
      reconciliation,
      source: snapshot.source,
      sourceInventory: buildInventory(snapshot.rows),
      target: {
        environment: targetConfiguration.target.environment,
        inventory: buildInventory(targetRows),
        project: targetConfiguration.target.project,
      },
    };
  } finally {
    client.release();
    await pool.end();
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function projectRoot() {
  return path.resolve(__dirname, "..");
}

module.exports = {
  BASELINE_MIGRATION_NAME,
  PHASE_2_TABLES,
  SOURCE_COLUMNS,
  SOURCE_TABLES,
  SOURCE_TABLE_ORDER,
  assertPostgresBaseline,
  assertRestoreTargetBlank,
  assertSourceUnchanged,
  assertTargetEmpty,
  buildInventory,
  connectPostgres,
  hashFile,
  hashText,
  insertSourceRows,
  loadProjectEnv,
  lockTargetTables,
  parseArguments,
  parseCanvasDocument,
  printJson,
  projectRoot,
  readSourceSnapshot,
  reconcileRows,
  reconcileTargetSnapshot,
  requireTargetConfiguration,
  resolveDirectUrl,
  resolveSourcePath,
  fetchTargetRows,
};
