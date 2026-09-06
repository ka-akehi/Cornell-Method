/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- child-process, filesystem, and Tauri bridge fixtures intentionally model runtime boundaries.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import ts from "typescript";
import { test } from "node:test";
const require = createRequire(import.meta.url);
export {};

const projectRoot = path.resolve(__dirname, "../..");
const launcherPath = path.join(projectRoot, "src-tauri", "sidecar", "launcher.cjs");
const bridgePath = path.join(
  projectRoot,
  "src",
  "shared",
  "desktop",
  "desktop-settings-bridge.ts",
);
const storage = require("../../src/server/infrastructure/desktop-storage.js");

function temporaryHome() {
  return fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "cornell-backup-recovery-"));
}

function sidecarEnvironment(homeDirectory) {
  return {
    ...process.env,
    CORNELL_DESKTOP_HOME: homeDirectory,
    CORNELL_DESKTOP_PROJECT_ROOT: projectRoot,
  };
}

function runRecovery(homeDirectory, request) {
  const result = spawnSync(
    process.execPath,
    [launcherPath, "attempt-backup-recovery", JSON.stringify(request)],
    { cwd: projectRoot, env: sidecarEnvironment(homeDirectory), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function loadBridge(invokeImplementation) {
  const source = fs.readFileSync(bridgePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
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

function request(reason) {
  return { kind: "desktop-backup-recovery", schemaVersion: 1, reason };
}

test("sidecar preflight returns ready for a healthy database and never exposes private values", () => {
  const homeDirectory = temporaryHome();
  try {
    const paths = storage.resolveDesktopStoragePaths({ homeDirectory });
    const bootstrap = storage.bootstrapDesktopStorage({ homeDirectory });
    assert.equal(bootstrap.status, storage.DESKTOP_DATABASE_STATUS.READY);

    const result = runRecovery(homeDirectory, request("backup_database_unavailable"));
    assert.deepEqual(result, {
      kind: "desktop-backup-recovery",
      schemaVersion: 1,
      status: "ready",
      phase: "preflight",
      errorCode: null,
      recoverySnapshot: null,
    });
    assert.doesNotMatch(JSON.stringify(result), /DATABASE_URL|notebook\.sqlite|exception|stack/);
    assert.equal(fs.existsSync(paths.databasePath), true);
  } finally {
    fs.rmSync(homeDirectory, { recursive: true, force: true });
  }
});

test("sidecar preflight routes an initialized missing or corrupt database to recovery-only", () => {
  const homeDirectory = temporaryHome();
  try {
    const paths = storage.resolveDesktopStoragePaths({ homeDirectory });
    storage.ensureDesktopStorageDirectories(paths);
    fs.writeFileSync(
      path.join(paths.settingsDirectory, storage.DESKTOP_DATABASE_INITIALIZATION_MARKER_NAME),
      storage.DESKTOP_DATABASE_INITIALIZATION_MARKER_CONTENT,
      { flag: "wx" },
    );

    const missing = runRecovery(homeDirectory, request("backup_database_unavailable"));
    assert.equal(missing.status, "recovery-required");
    assert.equal(missing.recoverySnapshot.state, "restore-unavailable");
    assert.equal(missing.recoverySnapshot.canStartEmpty, false);
    assert.equal(fs.existsSync(paths.databasePath), false);

    fs.writeFileSync(paths.databasePath, "not sqlite", { flag: "wx" });
    const corrupt = runRecovery(homeDirectory, request("backup_configuration_invalid"));
    assert.equal(corrupt.status, "recovery-required");
    assert.equal(corrupt.recoverySnapshot.canStartEmpty, false);
    assert.equal(fs.readFileSync(paths.databasePath, "utf8"), "not sqlite");
  } finally {
    fs.rmSync(homeDirectory, { recursive: true, force: true });
  }
});

test("storage-only failure stays not-recovered and unknown requests fail closed", () => {
  const homeDirectory = temporaryHome();
  try {
    const paths = storage.resolveDesktopStoragePaths({ homeDirectory });
    storage.bootstrapDesktopStorage({ homeDirectory });
    fs.rmSync(paths.backupsDirectory, { recursive: true, force: true });
    fs.writeFileSync(paths.backupsDirectory, "not a directory", { flag: "wx" });

    const storageFailure = runRecovery(homeDirectory, request("backup_storage_failure"));
    assert.deepEqual(storageFailure, {
      kind: "desktop-backup-recovery",
      schemaVersion: 1,
      status: "not-recovered",
      phase: "preflight",
      errorCode: "storage-unavailable",
      recoverySnapshot: null,
    });
    assert.equal(fs.readFileSync(paths.backupsDirectory, "utf8"), "not a directory");

    const unknown = runRecovery(homeDirectory, {
      kind: "desktop-backup-recovery",
      schemaVersion: 1,
      reason: "unexpected",
    });
    assert.equal(unknown.status, "not-recovered");
    assert.equal(unknown.errorCode, "invalid-request");
    assert.doesNotMatch(JSON.stringify(unknown), /unexpected|DATABASE_URL|notebook\.sqlite/);
  } finally {
    fs.rmSync(homeDirectory, { recursive: true, force: true });
  }
});

test("backup recovery bridge is typed, confirmation-independent, and unsupported on Web", async () => {
  const originalWindow = global.window;
  const calls = [];
  global.window = { __TAURI_INTERNALS__: {} };
  try {
    const bridge = loadBridge((...args) => {
      calls.push(args);
      return Promise.resolve({
        kind: "desktop-backup-recovery",
        schemaVersion: 1,
        status: "recovery-required",
        phase: "preflight",
        errorCode: null,
        recoverySnapshot: {
          schemaVersion: 1,
          state: "restore-available",
          reasonCode: "database-integrity-failed",
          managedBackupAvailable: true,
          pendingRestoreAvailable: false,
          canStartEmpty: false,
        },
      });
    });
    assert.equal(
      (await bridge.requestDesktopBackupRecovery("backup_database_unavailable")).status,
      "recovery-required",
    );
    assert.deepEqual(calls, [[
      "attempt_desktop_backup_recovery",
      { request: request("backup_database_unavailable") },
    ]]);

    const invalid = loadBridge(() => Promise.resolve({
      kind: "desktop-backup-recovery",
      schemaVersion: 1,
      status: "ready",
      phase: "preflight",
      errorCode: null,
      recoverySnapshot: { databasePath: "/private/notebook.sqlite" },
    }));
    const invalidResult = await invalid.requestDesktopBackupRecovery("backup_storage_failure");
    assert.equal(invalidResult.status, "not-recovered");
    assert.equal(invalidResult.errorCode, "invalid-response");
    assert.doesNotMatch(JSON.stringify(invalidResult), /notebook\.sqlite|DATABASE_URL/);
  } finally {
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }

  const unsupported = loadBridge(() => {
    throw new Error("must not invoke Web bridge");
  });
  assert.deepEqual(await unsupported.requestDesktopBackupRecovery("backup_storage_failure"), {
    kind: "unsupported-web",
  });
});

test("Tauri registers the single pre-error recovery command and keeps restore separate", () => {
  const main = fs.readFileSync(path.join(projectRoot, "src-tauri", "src", "main.rs"), "utf8");
  const lifecycle = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "lifecycle.rs"),
    "utf8",
  );
  const runtime = fs.readFileSync(path.join(projectRoot, "src-tauri", "src", "runtime.rs"), "utf8");

  assert.match(main, /attempt_desktop_backup_recovery/);
  assert.match(lifecycle, /state\.quiesce_sidecar_for_data_operation\(\)/);
  assert.match(lifecycle, /mark_recovery_only\(snapshot\)/);
  assert.match(lifecycle, /tauri:\/\/localhost\/index\.html/);
  assert.match(lifecycle, /navigate_to_backup_recovery_runtime/);
  assert.match(lifecycle, /target_url\.set_path\(BACKUP_PATH\)/);
  assert.match(lifecycle, /cornell-desktop-backup-recovery=ready/);
  assert.match(lifecycle, /cornell-desktop-backup-recovery=not-recovered:/);
  const navigationStart = lifecycle.indexOf("fn navigate_to_backup_recovery_runtime");
  const navigationEnd = lifecycle.indexOf("fn navigate_to_recovery_ui", navigationStart);
  assert.ok(navigationStart >= 0 && navigationEnd > navigationStart);
  assert.doesNotMatch(
    lifecycle.slice(navigationStart, navigationEnd),
    /DATABASE_URL|notebook\.sqlite|exception|stack|\/private\//,
  );
  const probeStart = runtime.indexOf("pub(crate) fn run_desktop_backup_recovery_probe");
  const probeEnd = runtime.indexOf("fn resolve_data_backup_location", probeStart);
  assert.ok(probeStart >= 0 && probeEnd > probeStart);
  assert.doesNotMatch(runtime.slice(probeStart, probeEnd), /restoreDesktopDatabase|deleteDesktopData/);
});
