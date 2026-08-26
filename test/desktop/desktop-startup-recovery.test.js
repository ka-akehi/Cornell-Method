/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
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
