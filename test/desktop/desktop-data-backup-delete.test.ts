/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- filesystem and child-process fixtures intentionally model runtime boundaries.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
export {};

const {
  DESKTOP_DATABASE_STATUS,
  bootstrapDesktopStorage,
  deleteDesktopData,
  ensureDesktopStorageDirectories,
  resolveDesktopStoragePaths,
} = require("../../src/server/infrastructure/desktop-storage.js");

const projectRoot = path.resolve(__dirname, "../..");
const launcherPath = path.join(projectRoot, "src-tauri", "sidecar", "launcher.cjs");
const sqliteBinary = process.env.SQLITE3_BIN ?? "sqlite3";

function hasSqliteCli() {
  try {
    return spawnSync(sqliteBinary, ["-version"], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
}

function temporaryHome() {
  return fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), "cornell-desktop-data-delete-"),
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

function digest(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function createFixture(homeDirectory) {
  const storagePaths = resolveDesktopStoragePaths({ homeDirectory });
  ensureDesktopStorageDirectories(storagePaths);
  for (const [filePath, content] of [
    [storagePaths.databasePath, "live"],
    [`${storagePaths.databasePath}-wal`, "wal"],
    [`${storagePaths.databasePath}-shm`, "shm"],
    [`${storagePaths.databasePath}-journal`, "journal"],
    [path.join(storagePaths.backupsDirectory, "managed.sqlite"), "managed"],
    [path.join(storagePaths.settingsDirectory, ".database-initialized"), "marker"],
    [path.join(storagePaths.settingsDirectory, "update-state.json"), "update"],
    [path.join(storagePaths.settingsDirectory, "window-state.json"), "window"],
    [path.join(storagePaths.settingsDirectory, ".instance.owner"), "owner"],
    [path.join(storagePaths.settingsDirectory, ".instance.lock"), "lock"],
  ]) {
    fs.writeFileSync(filePath, content, { flag: "wx" });
  }

  const pendingExternal = path.join(homeDirectory, "pending-external.sqlite");
  const logExternal = path.join(homeDirectory, "log-external.sqlite");
  fs.writeFileSync(pendingExternal, "pending external", { flag: "wx" });
  fs.writeFileSync(logExternal, "log external", { flag: "wx" });
  fs.writeFileSync(
    path.join(storagePaths.pendingRestoreDirectory, "candidate.sqlite"),
    "pending candidate",
    { flag: "wx" },
  );
  fs.writeFileSync(path.join(storagePaths.logsDirectory, "runtime.log"), "runtime log", {
    flag: "wx",
  });

  const externalExport = path.join(homeDirectory, "external-export.sqlite");
  const webBackup = path.join(homeDirectory, "web-backup.sqlite");
  const appBundle = path.join(homeDirectory, "Cornell Method.app");
  fs.writeFileSync(externalExport, "external export", { flag: "wx" });
  fs.writeFileSync(webBackup, "web backup", { flag: "wx" });
  fs.writeFileSync(appBundle, "app bundle", { flag: "wx" });

  return {
    storagePaths,
    pendingExternal,
    logExternal,
    externalExport,
    webBackup,
    appBundle,
  };
}

function createRecoveryFixture(homeDirectory) {
  const ready = bootstrapDesktopStorage({ homeDirectory, sqliteBinary });
  assert.equal(ready.status, DESKTOP_DATABASE_STATUS.READY);
  const managedPath = path.join(ready.backupsDirectory, "managed-recovery.sqlite");
  fs.copyFileSync(ready.databasePath, managedPath, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(path.join(ready.settingsDirectory, "update-state.json"), "update", { flag: "wx" });
  fs.writeFileSync(path.join(ready.settingsDirectory, ".instance.lock"), "lock", { flag: "wx" });
  const externalExport = path.join(homeDirectory, "external-export.sqlite");
  fs.writeFileSync(externalExport, "external export", { flag: "wx" });
  return { ...ready, storagePaths: ready.paths, managedPath, externalExport };
}

function runSidecar(homeDirectory, request) {
  const result = spawnSync(
    process.execPath,
    [launcherPath, "data-backup-operation", JSON.stringify(request)],
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

function deleteRequest(overrides = {}) {
  return {
    kind: "desktop-data-backup-operation",
    schemaVersion: 1,
    operation: "delete",
    source: null,
    destination: null,
    confirmed: true,
    operationId: "delete-fixture",
    ...overrides,
  };
}

function restoreRequest(backupId, operationId) {
  return {
    kind: "desktop-data-backup-operation",
    schemaVersion: 1,
    operation: "restore",
    source: { kind: "managed-backup", backupId },
    destination: null,
    confirmed: true,
    operationId,
    recoveryOnly: true,
  };
}

function recoveryArtifactPath(storagePaths, operationId, suffix = "") {
  return path.join(
    storagePaths.liveDirectory,
    `.notebook.sqlite.recovery-${operationId}${suffix}.artifact`,
  );
}

function assertNoDeleteStaging(storagePaths) {
  assert.deepEqual(
    fs.readdirSync(storagePaths.applicationSupportRoot).filter((entry) =>
      entry.startsWith(".desktop-delete-"),
    ),
    [],
  );
}

test("complete deletion removes only canonical app data and preserves non-target identity", async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const fixture = createFixture(homeDirectory);
    const { storagePaths } = fixture;
    const preservedPaths = [
      fixture.pendingExternal,
      fixture.logExternal,
      fixture.externalExport,
      fixture.webBackup,
      fixture.appBundle,
      path.join(storagePaths.pendingRestoreDirectory, "candidate.sqlite"),
      path.join(storagePaths.logsDirectory, "runtime.log"),
    ];
    const preservedBefore = new Map(preservedPaths.map((filePath) => [filePath, digest(filePath)]));

    const result = deleteDesktopData({
      storagePaths,
      operationId: "delete-fixture",
    });

    assert.deepEqual(result, {
      operationId: "delete-fixture",
      deletedFileCount: 9,
    });
    for (const filePath of [
      storagePaths.databasePath,
      `${storagePaths.databasePath}-wal`,
      `${storagePaths.databasePath}-shm`,
      `${storagePaths.databasePath}-journal`,
      path.join(storagePaths.backupsDirectory, "managed.sqlite"),
      path.join(storagePaths.settingsDirectory, ".database-initialized"),
      path.join(storagePaths.settingsDirectory, "update-state.json"),
      path.join(storagePaths.settingsDirectory, "window-state.json"),
      path.join(storagePaths.settingsDirectory, ".instance.owner"),
    ]) {
      assert.equal(fs.existsSync(filePath), false, filePath);
    }
    assert.equal(fs.readFileSync(path.join(storagePaths.settingsDirectory, ".instance.lock"), "utf8"), "lock");
    for (const directoryPath of [
      storagePaths.applicationSupportRoot,
      storagePaths.liveDirectory,
      storagePaths.backupsDirectory,
      storagePaths.settingsDirectory,
      storagePaths.pendingRestoreDirectory,
      storagePaths.logsDirectory,
    ]) {
      assert.equal(fs.lstatSync(directoryPath).isDirectory(), true, directoryPath);
    }
    for (const [filePath, before] of preservedBefore) {
      assert.equal(digest(filePath), before, filePath);
    }
    assertNoDeleteStaging(storagePaths);

    const alreadyClean = deleteDesktopData({
      storagePaths,
      operationId: "delete-again",
    });
    assert.deepEqual(alreadyClean, {
      operationId: "delete-again",
      deletedFileCount: 0,
    });
    for (const [filePath, before] of preservedBefore) {
      assert.equal(digest(filePath), before, filePath);
    }
  });
});

test("complete deletion removes recovery sidecar artifacts after recovery-only restore from a missing live database", {
  skip: !hasSqliteCli(),
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const fixture = createRecoveryFixture(homeDirectory);
    const { storagePaths } = fixture;
    fs.unlinkSync(storagePaths.databasePath);
    const orphanWalPath = `${storagePaths.databasePath}-wal`;
    fs.writeFileSync(orphanWalPath, "orphan wal bytes", { flag: "wx" });

    const restoreResponse = runSidecar(
      homeDirectory,
      restoreRequest("managed-recovery.sqlite", "recovery-missing-before-delete"),
    );
    assert.equal(restoreResponse.ok, true);
    assert.equal(
      fs.existsSync(recoveryArtifactPath(storagePaths, "recovery-missing-before-delete", "-wal")),
      true,
    );

    const externalBefore = digest(fixture.externalExport);
    const result = deleteDesktopData({
      storagePaths,
      operationId: "delete-after-missing-recovery",
    });

    assert.equal(result.deletedFileCount, 5);
    assert.equal(fs.existsSync(storagePaths.databasePath), false);
    assert.equal(
      fs.existsSync(recoveryArtifactPath(storagePaths, "recovery-missing-before-delete", "-wal")),
      false,
    );
    assert.equal(fs.existsSync(fixture.managedPath), false);
    assert.equal(fs.existsSync(path.join(storagePaths.settingsDirectory, ".database-initialized")), false);
    assert.equal(fs.existsSync(path.join(storagePaths.settingsDirectory, "update-state.json")), false);
    assert.equal(fs.readFileSync(path.join(storagePaths.settingsDirectory, ".instance.lock"), "utf8"), "lock");
    assert.equal(digest(fixture.externalExport), externalBefore);
    assert.deepEqual(fs.readdirSync(storagePaths.liveDirectory), []);
    assertNoDeleteStaging(storagePaths);
  });
});

test("complete deletion removes main and sidecar recovery artifacts after replacing a corrupt live database", {
  skip: !hasSqliteCli(),
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const fixture = createRecoveryFixture(homeDirectory);
    const { storagePaths } = fixture;
    fs.writeFileSync(storagePaths.databasePath, "not a readable sqlite database");
    const invalidLiveDigest = digest(storagePaths.databasePath);
    const orphanWalPath = `${storagePaths.databasePath}-wal`;
    fs.writeFileSync(orphanWalPath, "orphan wal bytes", { flag: "wx" });
    const orphanWalDigest = digest(orphanWalPath);

    const restoreResponse = runSidecar(
      homeDirectory,
      restoreRequest("managed-recovery.sqlite", "recovery-corrupt-before-delete"),
    );
    assert.equal(restoreResponse.ok, true);
    const mainArtifact = recoveryArtifactPath(storagePaths, "recovery-corrupt-before-delete");
    const walArtifact = recoveryArtifactPath(storagePaths, "recovery-corrupt-before-delete", "-wal");
    const shmArtifact = recoveryArtifactPath(storagePaths, "recovery-corrupt-before-delete", "-shm");
    assert.equal(digest(mainArtifact), invalidLiveDigest);
    assert.equal(digest(walArtifact), orphanWalDigest);
    assert.equal(fs.existsSync(shmArtifact), true);

    const otherOperationArtifact = recoveryArtifactPath(storagePaths, "previous-recovery-operation");
    fs.copyFileSync(mainArtifact, otherOperationArtifact, fs.constants.COPYFILE_EXCL);
    const externalBefore = digest(fixture.externalExport);

    const result = deleteDesktopData({
      storagePaths,
      operationId: "delete-after-corrupt-recovery",
    });

    assert.equal(result.deletedFileCount, 8);
    for (const filePath of [
      storagePaths.databasePath,
      mainArtifact,
      walArtifact,
      shmArtifact,
      otherOperationArtifact,
      fixture.managedPath,
      path.join(storagePaths.settingsDirectory, ".database-initialized"),
      path.join(storagePaths.settingsDirectory, "update-state.json"),
    ]) {
      assert.equal(fs.existsSync(filePath), false, filePath);
    }
    assert.equal(fs.readFileSync(path.join(storagePaths.settingsDirectory, ".instance.lock"), "utf8"), "lock");
    assert.equal(digest(fixture.externalExport), externalBefore);
    assert.deepEqual(fs.readdirSync(storagePaths.liveDirectory), []);
    assertNoDeleteStaging(storagePaths);
  });
});

test("successful deletion leaves a clean bootstrap boundary for the next startup", {
  skip: !hasSqliteCli(),
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const fixture = createFixture(homeDirectory);
    const { storagePaths } = fixture;
    deleteDesktopData({ storagePaths, operationId: "bootstrap-boundary" });

    const inspection = bootstrapDesktopStorage({
      storagePaths,
      sqliteBinary,
    });
    assert.equal(inspection.status, DESKTOP_DATABASE_STATUS.READY);
    assert.equal(inspection.requiresInitialization, false);
    assert.equal(fs.readFileSync(path.join(storagePaths.settingsDirectory, ".database-initialized"), "utf8"), "v1\n");
    const output = spawnSync(
      sqliteBinary,
      ["-readonly", "-json", storagePaths.databasePath, "SELECT count(*) AS count FROM notebooks;"],
      { encoding: "utf8" },
    );
    assert.equal(output.status, 0, output.stderr);
    assert.deepEqual(JSON.parse(output.stdout), [{ count: 0 }]);
    assert.equal(fs.existsSync(path.join(storagePaths.pendingRestoreDirectory, "candidate.sqlite")), true);
    assert.equal(fs.existsSync(path.join(storagePaths.logsDirectory, "runtime.log")), true);
    assert.equal(fs.existsSync(fixture.externalExport), true);
  });
});

test("unconfirmed delete is rejected before any filesystem mutation", async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const fixture = createFixture(homeDirectory);
    const { storagePaths } = fixture;
    const watchedPaths = [
      storagePaths.databasePath,
      `${storagePaths.databasePath}-wal`,
      path.join(storagePaths.backupsDirectory, "managed.sqlite"),
      path.join(storagePaths.settingsDirectory, ".database-initialized"),
      fixture.externalExport,
    ];
    const before = new Map(watchedPaths.map((filePath) => [filePath, digest(filePath)]));

    const response = runSidecar(homeDirectory, deleteRequest({ confirmed: false }));
    assert.deepEqual(response, {
      kind: "desktop-data-backup-operation",
      schemaVersion: 1,
      ok: false,
      status: "error",
      operation: "delete",
      phase: "validation",
      errorCode: "confirmation-required",
      result: null,
    });
    for (const [filePath, expectedDigest] of before) {
      assert.equal(digest(filePath), expectedDigest, filePath);
    }
    assertNoDeleteStaging(storagePaths);
  });
});

test("unsafe canonical entries fail closed without touching the live database", async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const fixture = createFixture(homeDirectory);
    const { storagePaths } = fixture;
    const outside = path.join(homeDirectory, "outside.sqlite");
    fs.writeFileSync(outside, "must survive", { flag: "wx" });
    fs.symlinkSync(outside, path.join(storagePaths.backupsDirectory, "unsafe-link"));
    const liveBefore = digest(storagePaths.databasePath);
    const outsideBefore = digest(outside);

    assert.throws(
      () => deleteDesktopData({ storagePaths, operationId: "unsafe-entry" }),
      (error) => error.code === "DELETE_SYMLINK_PATH",
    );
    assert.equal(digest(storagePaths.databasePath), liveBefore);
    assert.equal(digest(outside), outsideBefore);
    assert.equal(fs.existsSync(path.join(storagePaths.backupsDirectory, "unsafe-link")), true);
    assertNoDeleteStaging(storagePaths);
  });
});

test("malformed recovery artifact names fail closed without expanding the live deletion boundary", async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const fixture = createFixture(homeDirectory);
    const { storagePaths } = fixture;
    const malformedArtifact = path.join(
      storagePaths.liveDirectory,
      ".notebook.sqlite.recovery-.artifact",
    );
    fs.writeFileSync(malformedArtifact, "malformed artifact", { flag: "wx" });
    const watchedPaths = [
      storagePaths.databasePath,
      `${storagePaths.databasePath}-wal`,
      `${storagePaths.databasePath}-shm`,
      `${storagePaths.databasePath}-journal`,
      path.join(storagePaths.backupsDirectory, "managed.sqlite"),
      path.join(storagePaths.settingsDirectory, ".database-initialized"),
      path.join(storagePaths.settingsDirectory, "update-state.json"),
      path.join(storagePaths.settingsDirectory, "window-state.json"),
      path.join(storagePaths.settingsDirectory, ".instance.owner"),
      path.join(storagePaths.settingsDirectory, ".instance.lock"),
      fixture.externalExport,
    ];
    const before = new Map(watchedPaths.map((filePath) => [filePath, digest(filePath)]));

    assert.throws(
      () => deleteDesktopData({ storagePaths, operationId: "malformed-recovery-artifact" }),
      (error) => error.code === "DELETE_UNSAFE_NAME",
    );
    for (const [filePath, expectedDigest] of before) {
      assert.equal(digest(filePath), expectedDigest, filePath);
    }
    assert.equal(fs.existsSync(malformedArtifact), true);
    assertNoDeleteStaging(storagePaths);
  });
});

test("recovery artifacts fail closed when replaced by symlinks or directories", async () => {
  for (const scenario of [
    { name: "symlink", errorCode: "DELETE_SYMLINK_PATH" },
    { name: "directory", errorCode: "DELETE_UNEXPECTED_DIRECTORY" },
  ]) {
    await withTemporaryHome(async (homeDirectory) => {
      const fixture = createFixture(homeDirectory);
      const { storagePaths } = fixture;
      const artifactPath = recoveryArtifactPath(storagePaths, "boundary-recovery");
      let outsidePath;
      if (scenario.name === "symlink") {
        outsidePath = path.join(homeDirectory, "outside-recovery-artifact.sqlite");
        fs.writeFileSync(outsidePath, "must survive", { flag: "wx" });
        fs.symlinkSync(outsidePath, artifactPath);
      } else {
        fs.mkdirSync(artifactPath);
      }
      const watchedPaths = [
        storagePaths.databasePath,
        `${storagePaths.databasePath}-wal`,
        `${storagePaths.databasePath}-shm`,
        `${storagePaths.databasePath}-journal`,
        path.join(storagePaths.backupsDirectory, "managed.sqlite"),
        path.join(storagePaths.settingsDirectory, ".database-initialized"),
        path.join(storagePaths.settingsDirectory, "update-state.json"),
        path.join(storagePaths.settingsDirectory, "window-state.json"),
        path.join(storagePaths.settingsDirectory, ".instance.owner"),
        path.join(storagePaths.settingsDirectory, ".instance.lock"),
        fixture.externalExport,
      ];
      const before = new Map(watchedPaths.map((filePath) => [filePath, digest(filePath)]));
      const outsideBefore = outsidePath === undefined ? null : digest(outsidePath);

      assert.throws(
        () => deleteDesktopData({ storagePaths, operationId: `boundary-${scenario.name}` }),
        (error) => error.code === scenario.errorCode,
      );
      for (const [filePath, expectedDigest] of before) {
        assert.equal(digest(filePath), expectedDigest, filePath);
      }
      if (outsidePath !== undefined) assert.equal(digest(outsidePath), outsideBefore);
      assert.equal(fs.existsSync(artifactPath), true);
      assertNoDeleteStaging(storagePaths);
    });
  }
});

const mkfifoAvailable = process.platform !== "win32"
  && spawnSync("mkfifo", ["--help"], { stdio: "ignore" }).error === undefined;

test("special-file recovery artifacts fail closed before any app data is staged", {
  skip: !mkfifoAvailable,
}, async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const fixture = createFixture(homeDirectory);
    const { storagePaths } = fixture;
    const artifactPath = recoveryArtifactPath(storagePaths, "special-recovery");
    const fifo = spawnSync("mkfifo", [artifactPath], { encoding: "utf8" });
    assert.equal(fifo.status, 0, fifo.stderr);
    const watchedPaths = [
      storagePaths.databasePath,
      `${storagePaths.databasePath}-wal`,
      `${storagePaths.databasePath}-shm`,
      `${storagePaths.databasePath}-journal`,
      path.join(storagePaths.backupsDirectory, "managed.sqlite"),
      path.join(storagePaths.settingsDirectory, ".database-initialized"),
      path.join(storagePaths.settingsDirectory, "update-state.json"),
      path.join(storagePaths.settingsDirectory, "window-state.json"),
      path.join(storagePaths.settingsDirectory, ".instance.owner"),
      path.join(storagePaths.settingsDirectory, ".instance.lock"),
      fixture.externalExport,
    ];
    const before = new Map(watchedPaths.map((filePath) => [filePath, digest(filePath)]));

    assert.throws(
      () => deleteDesktopData({ storagePaths, operationId: "special-recovery-artifact" }),
      (error) => error.code === "DELETE_SPECIAL_FILE",
    );
    for (const [filePath, expectedDigest] of before) {
      assert.equal(digest(filePath), expectedDigest, filePath);
    }
    assert.equal(fs.statSync(artifactPath).isFIFO(), true);
    assertNoDeleteStaging(storagePaths);
  });
});

test("rename-stage failure rolls back exact records and leaves no staging artifact", async () => {
  await withTemporaryHome(async (homeDirectory) => {
    const fixture = createFixture(homeDirectory);
    const { storagePaths } = fixture;
    const recoveryArtifact = recoveryArtifactPath(storagePaths, "rename-recovery");
    fs.writeFileSync(recoveryArtifact, "recovery artifact", { flag: "wx" });
    const watchedPaths = [
      storagePaths.databasePath,
      `${storagePaths.databasePath}-wal`,
      `${storagePaths.databasePath}-shm`,
      `${storagePaths.databasePath}-journal`,
      recoveryArtifact,
      path.join(storagePaths.backupsDirectory, "managed.sqlite"),
      path.join(storagePaths.settingsDirectory, ".database-initialized"),
    ];
    const before = new Map(watchedPaths.map((filePath) => [filePath, digest(filePath)]));
    const originalRenameSync = fs.renameSync;
    let injected = false;
    fs.renameSync = (sourcePath, destinationPath) => {
      if (!injected && sourcePath === recoveryArtifact) {
        injected = true;
        const error = new Error("injected staging failure");
        error.code = "EACCES";
        throw error;
      }
      return originalRenameSync(sourcePath, destinationPath);
    };

    try {
      assert.throws(
        () => deleteDesktopData({ storagePaths, operationId: "rename-failure" }),
        (error) => error.code === "DELETE_OPERATION_FAILED" || error.code === "DELETE_STAGING_FAILED",
      );
    } finally {
      fs.renameSync = originalRenameSync;
    }
    assert.equal(injected, true);
    for (const [filePath, expectedDigest] of before) {
      assert.equal(digest(filePath), expectedDigest, filePath);
    }
    assertNoDeleteStaging(storagePaths);
  });
});

test("delete lifecycle keeps confirmation, update-writer, quiesce, and next-startup boundaries", () => {
  const lifecycle = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "lifecycle.rs"),
    "utf8",
  );
  const runtime = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "runtime.rs"),
    "utf8",
  );
  const bridge = fs.readFileSync(
    path.join(projectRoot, "src", "shared", "desktop", "desktop-settings-bridge.ts"),
    "utf8",
  );
  const deleteBranch = lifecycle.slice(
    lifecycle.indexOf("if data_operation_is_delete"),
    lifecycle.indexOf("if !data_operation_is_restore"),
  );

  assert.match(deleteBranch, /delete_request_has_confirmation_boundary/);
  assert.match(deleteBranch, /try_acquire_operation/);
  assert.match(deleteBranch, /quiesce_sidecar_for_data_operation/);
  assert.match(deleteBranch, /run_data_backup_operation_with_operation_id/);
  assert.match(deleteBranch, /Keep the sidecar stopped after a successful delete/);
  assert.match(deleteBranch, /state\.allow_application_exit\(\)/);
  assert.match(deleteBranch, /response\.is_validation_phase\(\)/);
  assert.match(runtime, /DesktopDataBackupOperation::Delete[\s\S]*confirmation-required/);
  assert.match(bridge, /\["export", "restore", "delete"\]\.includes\(value\.operation as string\)/);
  assert.match(bridge, /value\.confirmed === true/);
});
