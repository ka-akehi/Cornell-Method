/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ts = require("typescript");
const { test } = require("node:test");

const storage = require("../../src/server/infrastructure/desktop-storage.js");
const launcherPath = path.join(
  __dirname,
  "..",
  "..",
  "src-tauri",
  "sidecar",
  "launcher.cjs",
);
const bridgePath = path.join(
  __dirname,
  "..",
  "..",
  "src",
  "shared",
  "desktop",
  "desktop-settings-bridge.ts",
);
const projectRoot = path.resolve(__dirname, "../..");

function temporaryHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cornell-desktop-startup-recovery-"));
}

function withTemporaryHome(callback) {
  const homeDirectory = temporaryHome();
  try {
    return callback(homeDirectory);
  } finally {
    fs.rmSync(homeDirectory, { recursive: true, force: true });
  }
}

function preparedStorage(homeDirectory) {
  const paths = storage.resolveDesktopStoragePaths({ homeDirectory });
  storage.ensureDesktopStorageDirectories(paths);
  return paths;
}

function writeInitializationMarker(paths) {
  fs.writeFileSync(
    path.join(
      paths.settingsDirectory,
      storage.DESKTOP_DATABASE_INITIALIZATION_MARKER_NAME,
    ),
    storage.DESKTOP_DATABASE_INITIALIZATION_MARKER_CONTENT,
    { flag: "wx" },
  );
}

function sidecarEnvironment(homeDirectory) {
  return {
    ...process.env,
    CORNELL_DESKTOP_HOME: homeDirectory,
    CORNELL_DESKTOP_PROJECT_ROOT: projectRoot,
  };
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

test("startup bootstrap returns a first-run snapshot while preserving initial migration", () => {
  withTemporaryHome((homeDirectory) => {
    const result = storage.bootstrapDesktopStorage({ homeDirectory });

    assert.equal(result.status, storage.DESKTOP_DATABASE_STATUS.READY);
    assert.deepEqual(result.recoverySnapshot, {
      schemaVersion: storage.DESKTOP_DATABASE_RECOVERY_SCHEMA_VERSION,
      state: "first-run",
      reasonCode: "database-missing",
      managedBackupAvailable: false,
      pendingRestoreAvailable: false,
      canStartEmpty: true,
    });
  });
});

test("startup bootstrap classifies an existing database loss as restore-unavailable without creating a database", () => {
  withTemporaryHome((homeDirectory) => {
    const paths = preparedStorage(homeDirectory);
    writeInitializationMarker(paths);

    const result = storage.bootstrapDesktopStorage({ homeDirectory });

    assert.equal(result.status, storage.DESKTOP_DATABASE_STATUS.UNUSABLE);
    assert.deepEqual(result.recoverySnapshot, {
      schemaVersion: storage.DESKTOP_DATABASE_RECOVERY_SCHEMA_VERSION,
      state: "restore-unavailable",
      reasonCode: "database-missing-after-initialization",
      managedBackupAvailable: false,
      pendingRestoreAvailable: false,
      canStartEmpty: false,
    });
    assert.equal(fs.existsSync(paths.databasePath), false);
  });
});

test("startup bootstrap classifies an unreadable database as restore-available when a managed backup exists", () => {
  withTemporaryHome((homeDirectory) => {
    const paths = preparedStorage(homeDirectory);
    writeInitializationMarker(paths);
    const corruptContent = Buffer.from("not a sqlite database", "utf8");
    fs.writeFileSync(paths.databasePath, corruptContent, { flag: "wx" });
    fs.writeFileSync(
      path.join(paths.backupsDirectory, "available.sqlite"),
      "managed backup bytes",
      { flag: "wx" },
    );

    const result = storage.bootstrapDesktopStorage({ homeDirectory });

    assert.equal(result.status, storage.DESKTOP_DATABASE_STATUS.UNUSABLE);
    assert.equal(result.recoverySnapshot.state, "restore-available");
    assert.ok([
      "database-read-failed",
      "database-integrity-failed",
    ].includes(result.recoverySnapshot.reasonCode));
    assert.equal(result.recoverySnapshot.managedBackupAvailable, true);
    assert.equal(result.recoverySnapshot.pendingRestoreAvailable, false);
    assert.equal(result.recoverySnapshot.canStartEmpty, false);
    assert.deepEqual(fs.readFileSync(paths.databasePath), corruptContent);
  });
});

test("bootstrap recovery response contains only the typed sanitized snapshot", () => {
  withTemporaryHome((homeDirectory) => {
    const paths = preparedStorage(homeDirectory);
    writeInitializationMarker(paths);
    fs.writeFileSync(paths.databasePath, "not a sqlite database", { flag: "wx" });

    const result = spawnSync(
      process.execPath,
      [launcherPath, "bootstrap"],
      {
        cwd: projectRoot,
        env: sidecarEnvironment(homeDirectory),
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, result.stderr);
    const message = JSON.parse(result.stdout);
    assert.equal(message.kind, "bootstrap");
    assert.equal(message.status, "recovery");
    assert.deepEqual(Object.keys(message), ["kind", "status", "recoverySnapshot"]);
    assert.deepEqual(Object.keys(message.recoverySnapshot).sort(), [
      "canStartEmpty",
      "managedBackupAvailable",
      "pendingRestoreAvailable",
      "reasonCode",
      "schemaVersion",
      "state",
    ]);
    assert.doesNotMatch(result.stdout, /applicationSupportRoot|databasePath|databaseUrl|DATABASE_URL|stack|not a sqlite database/);
  });
});

test("recovery snapshot sanitizer rejects path and raw-error fields", () => {
  const sanitized = require(launcherPath).sanitizeDatabaseRecoverySnapshot({
    schemaVersion: 1,
    state: "diagnostic-required",
    reasonCode: "database-read-failed",
    managedBackupAvailable: false,
    pendingRestoreAvailable: false,
    canStartEmpty: false,
    databasePath: "/private/user-data/notebook.sqlite",
    error: "raw exception",
  });

  assert.deepEqual(sanitized, {
    schemaVersion: 1,
    state: "diagnostic-required",
    reasonCode: "storage-unavailable",
    managedBackupAvailable: false,
    pendingRestoreAvailable: false,
    canStartEmpty: false,
  });
});

test("recovery snapshot bridge keeps status typed and rejects private fields", async () => {
  const originalWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };
  const calls = [];
  try {
    const bridge = loadBridge((...args) => {
      calls.push(args);
      return Promise.resolve({
        kind: "desktop-database-recovery-snapshot",
        schemaVersion: 1,
        status: "recovery",
        snapshot: {
          schemaVersion: 1,
          state: "restore-available",
          reasonCode: "database-integrity-failed",
          managedBackupAvailable: true,
          pendingRestoreAvailable: false,
          canStartEmpty: false,
        },
      });
    });
    assert.deepEqual(await bridge.requestDesktopDatabaseRecoverySnapshot(), {
      kind: "desktop-database-recovery-snapshot",
      schemaVersion: 1,
      status: "recovery",
      snapshot: {
        schemaVersion: 1,
        state: "restore-available",
        reasonCode: "database-integrity-failed",
        managedBackupAvailable: true,
        pendingRestoreAvailable: false,
        canStartEmpty: false,
      },
    });
    assert.deepEqual(calls, [["read_desktop_database_recovery_snapshot"]]);

    const invalidBridge = loadBridge(() => Promise.resolve({
      kind: "desktop-database-recovery-snapshot",
      schemaVersion: 1,
      status: "recovery",
      snapshot: {
        schemaVersion: 1,
        state: "restore-available",
        reasonCode: "database-read-failed",
        managedBackupAvailable: true,
        pendingRestoreAvailable: false,
        canStartEmpty: false,
        databasePath: "/private/user-data/notebook.sqlite",
        error: "raw exception",
      },
    }));
    const sanitized = await invalidBridge.requestDesktopDatabaseRecoverySnapshot();
    assert.deepEqual(sanitized, {
      kind: "desktop-database-recovery-snapshot",
      schemaVersion: 1,
      status: "recovery",
      snapshot: {
        schemaVersion: 1,
        state: "diagnostic-required",
        reasonCode: "storage-unavailable",
        managedBackupAvailable: false,
        pendingRestoreAvailable: false,
        canStartEmpty: false,
      },
    });
    assert.doesNotMatch(JSON.stringify(sanitized), /notebook\.sqlite|raw exception|DATABASE_URL/);
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("Tauri recovery orchestration does not start the normal sidecar or /notes runtime", () => {
  const main = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "main.rs"),
    "utf8",
  );
  const runtime = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "runtime.rs"),
    "utf8",
  );
  const lifecycle = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "lifecycle.rs"),
    "utf8",
  );

  assert.match(main, /read_desktop_database_recovery_snapshot/);
  assert.match(main, /BootstrapOutcome::Recovery/);
  assert.match(main, /WebviewUrl::App\("index\.html"\.into\(\)/);
  const recoveryBranchStart = main.indexOf("if recovery_only {");
  const normalSidecarStart = main.indexOf("start_sidecar", recoveryBranchStart);
  assert.ok(recoveryBranchStart >= 0 && normalSidecarStart > recoveryBranchStart);
  assert.doesNotMatch(
    main.slice(recoveryBranchStart, normalSidecarStart),
    /start_sidecar|WebviewUrl::External|\/notes/,
  );
  assert.match(runtime, /DesktopDatabaseRecoverySnapshot/);
  assert.match(runtime, /validate_database_recovery_snapshot/);
  assert.match(lifecycle, /sidecar: Arc<Mutex<Option<SidecarHandle>>>/);
  assert.match(lifecycle, /fn new\(sidecar: Option<SidecarHandle>/);
});

test("recovery-only restore transitions gate restart without fictional rollback", () => {
  const lifecycle = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "lifecycle.rs"),
    "utf8",
  );
  const runtime = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "runtime.rs"),
    "utf8",
  );
  const restoreStart = lifecycle.indexOf(
    "let recovery_only = database_recovery_is_only(app);",
  );
  const pendingStart = lifecycle.indexOf(
    "let recovery_only = database_recovery_is_only(app);",
    restoreStart + 1,
  );
  assert.ok(restoreStart >= 0 && pendingStart > restoreStart);
  const restoreBlock = lifecycle.slice(restoreStart, pendingStart);
  const pendingBlock = lifecycle.slice(pendingStart);
  const restoreRecoveryStart = restoreBlock.indexOf("if recovery_only {");
  const restoreNormalStart = restoreBlock.indexOf("\n    let restarted", restoreRecoveryStart);
  const pendingRecoveryStart = pendingBlock.indexOf("if recovery_only {");
  const pendingNormalStart = pendingBlock.indexOf("\n    let restarted", pendingRecoveryStart);
  assert.ok(restoreRecoveryStart >= 0 && restoreNormalStart > restoreRecoveryStart);
  assert.ok(pendingRecoveryStart >= 0 && pendingNormalStart > pendingRecoveryStart);
  const restoreRecoveryBlock = restoreBlock.slice(restoreRecoveryStart, restoreNormalStart);
  const pendingRecoveryBlock = pendingBlock.slice(pendingRecoveryStart, pendingNormalStart);

  assert.match(restoreBlock, /if !recovery_only && state\.quiesce_sidecar_for_data_operation\(\)/);
  assert.match(restoreBlock, /run_data_backup_operation_with_restore_mode/);
  assert.match(restoreBlock, /DesktopRestoreMode::RecoveryOnly/);
  assert.match(
    restoreBlock,
    /if recovery_only \{[\s\S]*?if !response\.is_success\(\) \{[\s\S]*?return response;[\s\S]*?restart_sidecar_for_data_operation[\s\S]*?mark_database_recovery_ready/s,
  );
  assert.match(pendingBlock, /if !recovery_only && state\.quiesce_sidecar_for_data_operation\(\)/);
  assert.match(pendingBlock, /run_pending_restore_operation_with_restore_mode/);
  assert.match(pendingBlock, /DesktopRestoreMode::RecoveryOnly/);
  assert.match(
    pendingBlock,
    /if recovery_only \{[\s\S]*?if !\(response\.ok && response\.status == "success"\) \{[\s\S]*?return response;[\s\S]*?restart_sidecar_for_data_operation[\s\S]*?mark_database_recovery_ready/s,
  );
  assert.doesNotMatch(restoreRecoveryBlock, /rollback_backup_id|rollback_request|run_data_backup_operation_with_operation_id/);
  assert.doesNotMatch(pendingRecoveryBlock, /rollback_backup_id|rollback_request|run_data_backup_operation_with_operation_id/);
  assert.match(restoreBlock, /"sidecar-unavailable"/);
  assert.match(pendingBlock, /"rollback-failed"/);
  assert.match(runtime, /recovery_only: Arc<AtomicBool>/);
  assert.match(runtime, /pub\(crate\) enum DesktopRestoreMode/);
  assert.match(runtime, /safety_backup_id: Option<String>/);
  const uiRequestStart = runtime.indexOf("struct DesktopDataBackupOperationRequest");
  const sidecarRequestStart = runtime.indexOf("struct DesktopDataBackupSidecarRequest");
  assert.ok(uiRequestStart >= 0 && sidecarRequestStart > uiRequestStart);
  assert.doesNotMatch(runtime.slice(uiRequestStart, sidecarRequestStart), /recovery_only/);
  assert.match(runtime, /pub\(crate\) fn mark_ready\(&self\)/);
});
