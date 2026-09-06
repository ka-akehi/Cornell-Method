/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- filesystem, SQLite, child-process, and Tauri bridge fixtures intentionally model runtime boundaries.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import ts from "typescript";
import { test } from "node:test";
const require = createRequire(import.meta.url);
export {};

const storage = require("../../src/server/infrastructure/desktop-storage.js");

const projectRoot = path.resolve(__dirname, "../..");
const launcherPath = path.join(projectRoot, "src-tauri", "sidecar", "launcher.cjs");
const bridgePath = path.join(
  projectRoot,
  "src",
  "shared",
  "desktop",
  "desktop-settings-bridge.ts",
);
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
    path.join(fs.realpathSync(os.tmpdir()), "cornell-desktop-pending-"),
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
  return execFileSync(sqliteBinary, ["-bail", databasePath, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function digest(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function queryJson(databasePath, sql) {
  const output = execFileSync(sqliteBinary, ["-readonly", "-bail", "-json", databasePath, sql], {
    encoding: "utf8",
  });
  return JSON.parse(output.trim() || "[]");
}

function runSidecar(homeDirectory, command, payload) {
  const args = [launcherPath, command];
  if (payload !== undefined) args.push(JSON.stringify(payload));
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      CORNELL_DESKTOP_HOME: homeDirectory,
      CORNELL_DESKTOP_PROJECT_ROOT: projectRoot,
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim().split("\n").at(-1));
}

function restoreRequest(candidatePath, operationId = "pending-initial") {
  return {
    kind: "desktop-data-backup-operation",
    schemaVersion: 1,
    operation: "restore",
    source: { kind: "external-file", origin: "native-dialog", path: candidatePath },
    destination: null,
    confirmed: true,
    operationId,
  };
}

function createNewerCandidate(ready, homeDirectory) {
  const candidatePath = path.join(homeDirectory, "external-candidate.sqlite");
  fs.copyFileSync(ready.databasePath, candidatePath);
  sqlite(
    candidatePath,
    `INSERT INTO _prisma_migrations
      (id, checksum, migration_name, logs, rolled_back_at, started_at,
       applied_steps_count, finished_at)
     VALUES ('future-id', 'future-checksum', '20990101000000_future', NULL,
       NULL, '2099-01-01T00:00:00.000Z', 1, '2099-01-01T00:00:00.000Z');`,
  );
  return candidatePath;
}

function createPendingCandidate(ready, homeDirectory) {
  const candidatePath = path.join(homeDirectory, "external-compatible-pending.sqlite");
  fs.copyFileSync(ready.databasePath, candidatePath);
  sqlite(
    candidatePath,
    `INSERT INTO notebooks
      (id, title, note_date, source_type, source_title, body, body_mode,
       summary, created_at, updated_at)
     VALUES ('pending-recovery-note', 'Pending recovery', '2026-08-25T00:00:00.000Z',
       'book', 'Source', '# pending', 'markdown', 'summary',
       '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z');`,
  );
  const futureSql = "";
  const futureChecksum = crypto.createHash("sha256").update(futureSql).digest("hex");
  sqlite(
    candidatePath,
    `INSERT INTO _prisma_migrations
      (id, checksum, migration_name, logs, rolled_back_at, started_at,
       applied_steps_count, finished_at)
     VALUES ('future-id', '${futureChecksum}', '20990101000000_future', NULL,
       NULL, '2099-01-01T00:00:00.000Z', 1, '2099-01-01T00:00:00.000Z');`,
  );
  return { candidatePath, futureSql };
}

function loadBridge(invokeImplementation) {
  const source = fs.readFileSync(bridgePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  const injectedRequire = (request) => {
    if (request === "@tauri-apps/api/core") return { invoke: invokeImplementation };
    return require(request);
  };
  new Function("require", "module", "exports", output)(
    injectedRequire,
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports;
}

test("newer-schema restore publishes a self-contained pending artifact and survives restart status reads", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = storage.bootstrapDesktopStorage({ homeDirectory, sqliteBinary });
    const candidatePath = createNewerCandidate(ready, homeDirectory);
    const liveBefore = digest(ready.databasePath);
    const sourceBefore = digest(candidatePath);

    const response = runSidecar(homeDirectory, "data-backup-operation", restoreRequest(candidatePath));
    assert.equal(response.errorCode, "newer-schema-pending-required");
    assert.equal(digest(ready.databasePath), liveBefore);
    assert.equal(digest(candidatePath), sourceBefore);

    const firstStatus = runSidecar(homeDirectory, "pending-restore-status");
    const secondStatus = runSidecar(homeDirectory, "pending-restore-status");
    assert.equal(firstStatus.status, "available");
    assert.deepEqual(secondStatus.pending, firstStatus.pending);
    assert.equal(firstStatus.pending.sourceKind, "external-file");
    assert.doesNotMatch(JSON.stringify(firstStatus), /Application Support|candidate\.sqlite|external-candidate/);
    assert.deepEqual(
      fs.readdirSync(ready.pendingRestoreDirectory),
      [`pending-${firstStatus.pending.pendingId}`],
    );
  });
});

test("pending resume requires confirmation and preserves live bytes on wrong identity or validation failure", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = storage.bootstrapDesktopStorage({ homeDirectory, sqliteBinary });
    const candidatePath = createNewerCandidate(ready, homeDirectory);
    runSidecar(homeDirectory, "data-backup-operation", restoreRequest(candidatePath));
    const status = runSidecar(homeDirectory, "pending-restore-status");
    const liveBefore = digest(ready.databasePath);
    const unconfirmed = runSidecar(homeDirectory, "pending-restore-resume", {
      kind: "desktop-pending-restore-resume",
      schemaVersion: 1,
      pendingId: status.pending.pendingId,
      manifestToken: status.pending.manifestToken,
      confirmed: false,
      operationId: "pending-unconfirmed",
    });
    assert.equal(unconfirmed.errorCode, "confirmation-required");
    const wrongIdentity = runSidecar(homeDirectory, "pending-restore-resume", {
      kind: "desktop-pending-restore-resume",
      schemaVersion: 1,
      pendingId: "f".repeat(64),
      manifestToken: status.pending.manifestToken,
      confirmed: true,
      operationId: "pending-wrong-id",
    });
    assert.equal(wrongIdentity.errorCode, "pending-id-mismatch");
    const newerAgain = runSidecar(homeDirectory, "pending-restore-resume", {
      kind: "desktop-pending-restore-resume",
      schemaVersion: 1,
      pendingId: status.pending.pendingId,
      manifestToken: status.pending.manifestToken,
      confirmed: true,
      operationId: "pending-newer-again",
    });
    assert.equal(newerAgain.errorCode, "newer-schema-pending-required");
    assert.equal(digest(ready.databasePath), liveBefore);
    assert.equal(runSidecar(homeDirectory, "pending-restore-status").status, "available");
  });
});

test("pending manifest mismatch and multiple entries are reported invalid without touching live data", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = storage.bootstrapDesktopStorage({ homeDirectory, sqliteBinary });
    const candidatePath = createNewerCandidate(ready, homeDirectory);
    runSidecar(homeDirectory, "data-backup-operation", restoreRequest(candidatePath));
    const status = runSidecar(homeDirectory, "pending-restore-status");
    const pendingDirectory = path.join(
      ready.pendingRestoreDirectory,
      `pending-${status.pending.pendingId}`,
    );
    const liveBefore = digest(ready.databasePath);
    const secondPendingDirectory = path.join(
      ready.pendingRestoreDirectory,
      `pending-${"e".repeat(64)}`,
    );
    fs.mkdirSync(secondPendingDirectory, { mode: 0o700 });
    const multipleCandidates = runSidecar(homeDirectory, "pending-restore-status");
    assert.equal(multipleCandidates.status, "invalid");
    assert.equal(multipleCandidates.errorCode, "pending-multiple");
    fs.rmdirSync(secondPendingDirectory);
    fs.writeFileSync(path.join(pendingDirectory, "extra.tmp"), "incomplete");
    const multiple = runSidecar(homeDirectory, "pending-restore-status");
    assert.equal(multiple.status, "invalid");
    assert.equal(multiple.errorCode, "pending-manifest-mismatch");
    fs.unlinkSync(path.join(pendingDirectory, "extra.tmp"));
    fs.writeFileSync(
      path.join(pendingDirectory, "manifest.json"),
      JSON.stringify({ malformed: true }),
    );
    const mismatch = runSidecar(homeDirectory, "pending-restore-status");
    assert.equal(mismatch.status, "invalid");
    assert.equal(mismatch.errorCode, "pending-manifest-mismatch");
    assert.equal(digest(ready.databasePath), liveBefore);
  });
});

test("compatible update can explicitly resume and consume only the claimed pending artifact", {
  skip: !sqliteCliAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const ready = storage.bootstrapDesktopStorage({ homeDirectory, sqliteBinary });
    const candidatePath = path.join(homeDirectory, "external-candidate.sqlite");
    fs.copyFileSync(ready.databasePath, candidatePath);
    const futureSql = "";
    const futureChecksum = crypto.createHash("sha256").update(futureSql).digest("hex");
    const futureMigration = `
      INSERT INTO _prisma_migrations
        (id, checksum, migration_name, logs, rolled_back_at, started_at,
         applied_steps_count, finished_at)
      VALUES ('future-id', '${futureChecksum}', '20990101000000_future', NULL,
        NULL, '2099-01-01T00:00:00.000Z', 1, '2099-01-01T00:00:00.000Z');`;
    sqlite(candidatePath, futureMigration);
    const initial = storage.restoreDesktopDatabase({
      storagePaths: ready,
      source: { kind: "external-file", origin: "native-dialog", path: candidatePath },
      sqliteBinary,
      operationId: "pending-compatible-initial",
    });
    await assert.rejects(initial, (error) => error.code === "RESTORE_NEWER_SCHEMA_PENDING_REQUIRED");

    const updatedMigrationsDirectory = path.join(homeDirectory, "updated-migrations");
    fs.cpSync(path.join(projectRoot, "prisma", "migrations"), updatedMigrationsDirectory, { recursive: true });
    fs.mkdirSync(path.join(updatedMigrationsDirectory, "20990101000000_future"));
    fs.writeFileSync(
      path.join(updatedMigrationsDirectory, "20990101000000_future", "migration.sql"),
      futureSql,
    );
    sqlite(ready.databasePath, futureMigration);
    const status = storage.inspectPendingRestore({
      storagePaths: ready,
      sqliteBinary,
      migrationsDirectory: updatedMigrationsDirectory,
    });
    assert.equal(status.status, "available");
    const result = await storage.resumePendingRestore({
      storagePaths: ready,
      pendingId: status.pending.pendingId,
      manifestToken: status.pending.manifestToken,
      confirmed: true,
      sqliteBinary,
      migrationsDirectory: updatedMigrationsDirectory,
      operationId: "pending-compatible-resume",
    });
    assert.equal(result.pendingId, status.pending.pendingId);
    assert.equal(storage.inspectPendingRestore({
      storagePaths: ready,
      sqliteBinary,
      migrationsDirectory: updatedMigrationsDirectory,
    }).status, "none");
    assert.equal(fs.existsSync(path.join(ready.backupsDirectory, "restore-pending-compatible-resume.sqlite.bak")), true);
  });
});

test("recovery-only pending resume applies the missing and corrupt-live boundary and keeps no fake safety backup", {
  skip: !sqliteCliAvailable,
}, async () => {
  for (const liveState of ["missing", "corrupt"]) {
    await withTemporaryHome(async (homeDirectory) => {
      const ready = storage.bootstrapDesktopStorage({ homeDirectory, sqliteBinary });
      const { candidatePath, futureSql } = createPendingCandidate(ready, homeDirectory);
      await assert.rejects(
        storage.restoreDesktopDatabase({
          storagePaths: ready,
          source: { kind: "external-file", origin: "native-dialog", path: candidatePath },
          sqliteBinary,
          operationId: `pending-recovery-initial-${liveState}`,
        }),
        (error) => error.code === "RESTORE_NEWER_SCHEMA_PENDING_REQUIRED",
      );

      const updatedMigrationsDirectory = path.join(homeDirectory, "updated-migrations");
      fs.cpSync(path.join(projectRoot, "prisma", "migrations"), updatedMigrationsDirectory, { recursive: true });
      fs.mkdirSync(path.join(updatedMigrationsDirectory, "20990101000000_future"));
      fs.writeFileSync(
        path.join(updatedMigrationsDirectory, "20990101000000_future", "migration.sql"),
        futureSql,
      );

      let preservedDigest = null;
      if (liveState === "missing") {
        fs.unlinkSync(ready.databasePath);
      } else {
        fs.writeFileSync(ready.databasePath, "corrupt pending live database");
        preservedDigest = digest(ready.databasePath);
      }

      const status = storage.inspectPendingRestore({
        storagePaths: ready,
        sqliteBinary,
        migrationsDirectory: updatedMigrationsDirectory,
      });
      assert.equal(status.status, "available");
      const result = await storage.resumePendingRestore({
        storagePaths: ready,
        pendingId: status.pending.pendingId,
        manifestToken: status.pending.manifestToken,
        confirmed: true,
        sqliteBinary,
        migrationsDirectory: updatedMigrationsDirectory,
        operationId: `pending-recovery-${liveState}`,
        recoveryOnly: true,
      });

      assert.equal(result.safetyBackupId, null);
      assert.equal(queryJson(ready.databasePath, "SELECT COUNT(*) AS count FROM notebooks")[0].count, 1);
      assert.equal(storage.inspectPendingRestore({
        storagePaths: ready,
        sqliteBinary,
        migrationsDirectory: updatedMigrationsDirectory,
      }).status, "none");
      assert.equal(fs.existsSync(path.join(ready.backupsDirectory, `restore-pending-recovery-${liveState}.sqlite.bak`)), false);
      assert.equal(fs.existsSync(path.join(ready.applicationSupportRoot, "restore-staging")), false);
      if (preservedDigest !== null) {
        assert.equal(
          digest(path.join(ready.liveDirectory, `.notebook.sqlite.recovery-pending-recovery-${liveState}.artifact`)),
          preservedDigest,
        );
      }
    });
  }
});

test("pending status and confirm bridge expose only typed opaque metadata", async () => {
  const calls = [];
  const bridge = loadBridge((command, args) => {
    calls.push([command, args]);
    if (command === "read_desktop_pending_restore_status") {
      return Promise.resolve({
        kind: "desktop-pending-restore-status",
        schemaVersion: 1,
        status: "available",
        phase: "status",
        operationId: null,
        errorCode: null,
        pending: {
          pendingId: "a".repeat(64),
          manifestToken: "b".repeat(64),
          sourceKind: "external-file",
          createdAt: "2026-08-25T00:00:00.000Z",
          candidateDigest: "c".repeat(64),
          candidateSize: 123,
          candidateSchemaIdentity: "d".repeat(64),
        },
      });
    }
    return Promise.resolve({
      kind: "desktop-pending-restore-resume",
      schemaVersion: 1,
      ok: true,
      status: "success",
      phase: "complete",
      operationId: "resume-operation",
      pendingId: "a".repeat(64),
      errorCode: null,
      result: { safetyBackupId: null, size: 123 },
    });
  });
  const previousWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };
  try {
    const status = await bridge.requestPendingRestoreStatus();
    assert.equal(status.kind, "desktop-pending-restore-status");
    assert.equal(status.status, "available");
    const resume = await bridge.confirmPendingRestore("a".repeat(64), "b".repeat(64));
    assert.equal(resume.kind, "desktop-pending-restore-resume");
    assert.equal(resume.status, "success");
    assert.equal(resume.result.safetyBackupId, null);
    assert.deepEqual(calls, [
      ["read_desktop_pending_restore_status", undefined],
      [
        "resume_desktop_pending_restore",
        {
          request: {
            schemaVersion: 1,
            pendingId: "a".repeat(64),
            manifestToken: "b".repeat(64),
            confirmed: true,
          },
        },
      ],
    ]);
  } finally {
    global.window = previousWindow;
  }
});

test("pending lifecycle uses quiesce/restart and does not auto-apply at startup", () => {
  const lifecycle = fs.readFileSync(path.join(projectRoot, "src-tauri", "src", "lifecycle.rs"), "utf8");
  const main = fs.readFileSync(path.join(projectRoot, "src-tauri", "src", "main.rs"), "utf8");
  assert.match(lifecycle, /run_pending_restore_operation_with_operation_id/);
  assert.match(lifecycle, /quiesce_sidecar_for_data_operation/);
  assert.match(lifecycle, /restart_sidecar_for_data_operation/);
  assert.match(main, /read_desktop_pending_restore_status/);
  assert.match(main, /resume_desktop_pending_restore/);
  assert.doesNotMatch(main, /resumePendingRestore\(/);
});
