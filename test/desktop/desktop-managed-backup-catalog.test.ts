/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- filesystem, child-process, and Tauri bridge fixtures intentionally model runtime boundaries.
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

const {
  listManagedBackupCatalog,
  resolveDesktopStoragePaths,
} = require("../../src/server/infrastructure/desktop-storage.js");
const launcher = require(launcherPath);

function temporaryHome() {
  return fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), "cornell-desktop-managed-catalog-"),
  );
}

function withTemporaryHome(callback) {
  const homeDirectory = temporaryHome();
  try {
    return callback(homeDirectory);
  } finally {
    fs.rmSync(homeDirectory, { recursive: true, force: true });
  }
}

function createManagedBackupDirectory(homeDirectory) {
  const storagePaths = resolveDesktopStoragePaths({ homeDirectory });
  fs.mkdirSync(storagePaths.backupsDirectory, { recursive: true });
  return storagePaths;
}

function writeBackup(storagePaths, backupId, content = backupId) {
  const backupPath = path.join(storagePaths.backupsDirectory, backupId);
  fs.writeFileSync(backupPath, content, { flag: "wx" });
  return backupPath;
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
    if (request === "@tauri-apps/api/core") {
      return { invoke: invokeImplementation };
    }
    return require(request);
  };
  new Function("require", "module", "exports", output)(
    injectedRequire,
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports;
}

function catalogEntry(
  backupId,
  createdAt = "2026-08-25T00:00:00.000Z",
  recoveryOnly = false,
) {
  return {
    backupId,
    fileName: backupId,
    size: backupId.length,
    createdAt,
    recoveryOnly,
  };
}

function catalogResponse(overrides = {}) {
  return {
    kind: "desktop-managed-backup-catalog",
    schemaVersion: 1,
    status: "ready",
    phase: "catalog",
    errorCode: null,
    backups: [catalogEntry("a.sqlite")],
    ...overrides,
  };
}

function sidecarEnvironment(homeDirectory) {
  return {
    ...process.env,
    CORNELL_DESKTOP_HOME: homeDirectory,
    CORNELL_DESKTOP_APPLICATION_ID: "com.cornellmethod.notebook",
    CORNELL_DESKTOP_PROJECT_ROOT: projectRoot,
    CORNELL_DESKTOP_APPLICATION_SUPPORT_ROOT: "",
  };
}

test("managed backup catalog returns allowlisted metadata without reading or changing source bytes", () => {
  withTemporaryHome((homeDirectory) => {
    const storagePaths = createManagedBackupDirectory(homeDirectory);
    const firstPath = writeBackup(storagePaths, "first.sqlite", "SQLite bytes stay private");
    const secondPath = writeBackup(storagePaths, "second.sqlite", "another private backup");
    const before = [firstPath, secondPath].map((filePath) => ({
      identity: fs.statSync(filePath).ino,
      digest: require("node:crypto").createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"),
      size: fs.statSync(filePath).size,
    }));

    const result = listManagedBackupCatalog({ storagePaths });

    assert.equal(result.status, "ready");
    assert.deepEqual(
      [...result.backups]
        .map(({ backupId, fileName, size, recoveryOnly }) => ({
          backupId,
          fileName,
          size,
          recoveryOnly,
        }))
        .sort((left, right) => left.backupId < right.backupId ? -1 : 1),
      [
        {
          backupId: "second.sqlite",
          fileName: "second.sqlite",
          size: "another private backup".length,
          recoveryOnly: false,
        },
        {
          backupId: "first.sqlite",
          fileName: "first.sqlite",
          size: "SQLite bytes stay private".length,
          recoveryOnly: false,
        },
      ].sort((left, right) => left.backupId < right.backupId ? -1 : 1),
    );
    assert.equal(
      result.backups.every((entry, index, entries) => index === 0
        || entries[index - 1].createdAt > entry.createdAt
        || (entries[index - 1].createdAt === entry.createdAt
          && entries[index - 1].backupId < entry.backupId)),
      true,
    );
    for (const entry of result.backups) {
      assert.match(entry.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      assert.equal(Object.hasOwn(entry, "path"), false);
      assert.equal(Object.hasOwn(entry, "contents"), false);
    }
    assert.doesNotMatch(JSON.stringify(result), /SQLite bytes stay private|another private backup/);

    const after = [firstPath, secondPath].map((filePath) => ({
      identity: fs.statSync(filePath).ino,
      digest: require("node:crypto").createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"),
      size: fs.statSync(filePath).size,
    }));
    assert.deepEqual(after, before);
  });
});

test("managed backup catalog classifies only safe restore-safety names as recovery-only", () => {
  withTemporaryHome((homeDirectory) => {
    const storagePaths = createManagedBackupDirectory(homeDirectory);
    for (const backupId of [
      "user-a.sqlite",
      "restore-operation-123.sqlite.bak",
      "restore-.sqlite.bak",
      "restore-..sqlite.bak",
      "restore-operation.sqlite.bak.tmp",
    ]) {
      writeBackup(storagePaths, backupId);
    }

    const result = listManagedBackupCatalog({ storagePaths });
    const recoveryFlags = new Map(
      result.backups.map((entry) => [entry.backupId, entry.recoveryOnly]),
    );

    assert.equal(recoveryFlags.get("restore-operation-123.sqlite.bak"), true);
    assert.equal(recoveryFlags.get("user-a.sqlite"), false);
    assert.equal(recoveryFlags.get("restore-.sqlite.bak"), false);
    assert.equal(recoveryFlags.get("restore-..sqlite.bak"), false);
    assert.equal(recoveryFlags.get("restore-operation.sqlite.bak.tmp"), false);
  });
});

test("managed backup catalog returns a typed empty result for an empty backups directory", () => {
  withTemporaryHome((homeDirectory) => {
    const storagePaths = createManagedBackupDirectory(homeDirectory);
    assert.deepEqual(listManagedBackupCatalog({ storagePaths }), {
      status: "empty",
      backups: [],
    });
  });
});

test("managed backup catalog fails closed for symlinks, directories, and unsafe identifiers", () => {
  for (const setup of [
    (storagePaths) => fs.symlinkSync("/tmp", path.join(storagePaths.backupsDirectory, "linked.sqlite")),
    (storagePaths) => fs.mkdirSync(path.join(storagePaths.backupsDirectory, "nested.sqlite")),
    (storagePaths) => fs.writeFileSync(path.join(storagePaths.backupsDirectory, "unsafe name.sqlite"), "not published"),
  ]) {
    withTemporaryHome((homeDirectory) => {
      const storagePaths = createManagedBackupDirectory(homeDirectory);
      writeBackup(storagePaths, "safe.sqlite");
      setup(storagePaths);

      assert.throws(
        () => listManagedBackupCatalog({ storagePaths }),
        (error) => error?.code === "MANAGED_BACKUP_CATALOG_INVALID",
      );
    });
  }
});

test("managed backup catalog fails closed for a special file when mkfifo is available", {
  skip: process.platform === "win32",
}, () => {
  withTemporaryHome((homeDirectory) => {
    const storagePaths = createManagedBackupDirectory(homeDirectory);
    const fifoPath = path.join(storagePaths.backupsDirectory, "special.sqlite");
    const result = spawnSync("mkfifo", [fifoPath], { encoding: "utf8" });
    if (result.status !== 0) return;

    assert.throws(
      () => listManagedBackupCatalog({ storagePaths }),
      (error) => error?.code === "MANAGED_BACKUP_CATALOG_INVALID",
    );
  });
});

test("managed backup catalog rejects a non-canonical backups path", () => {
  withTemporaryHome((homeDirectory) => {
    const storagePaths = createManagedBackupDirectory(homeDirectory);
    const outsideDirectory = path.join(homeDirectory, "outside");
    fs.mkdirSync(outsideDirectory);

    assert.throws(
      () => listManagedBackupCatalog({
        storagePaths: { ...storagePaths, backupsDirectory: outsideDirectory },
      }),
      (error) => error?.code === "MANAGED_BACKUP_CATALOG_STORAGE_UNAVAILABLE",
    );
  });
});

test("sidecar managed-backup-catalog exposes empty metadata without bootstrapping or exposing a path", () => {
  withTemporaryHome((homeDirectory) => {
    const storagePaths = createManagedBackupDirectory(homeDirectory);
    const beforeEntries = fs.readdirSync(storagePaths.backupsDirectory);
    const result = spawnSync(
      process.execPath,
      [launcherPath, "managed-backup-catalog"],
      { cwd: projectRoot, env: sidecarEnvironment(homeDirectory), encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      kind: "desktop-managed-backup-catalog",
      schemaVersion: 1,
      status: "empty",
      phase: "catalog",
      errorCode: null,
      backups: [],
    });
    assert.deepEqual(fs.readdirSync(storagePaths.backupsDirectory), beforeEntries);
    assert.equal(fs.existsSync(storagePaths.databasePath), false);
  });
});

test("sidecar managed-backup-catalog returns invalid-catalog for unsafe entries", () => {
  withTemporaryHome((homeDirectory) => {
    const storagePaths = createManagedBackupDirectory(homeDirectory);
    fs.mkdirSync(path.join(storagePaths.backupsDirectory, "directory.sqlite"));
    const result = spawnSync(
      process.execPath,
      [launcherPath, "managed-backup-catalog"],
      { cwd: projectRoot, env: sidecarEnvironment(homeDirectory), encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      kind: "desktop-managed-backup-catalog",
      schemaVersion: 1,
      status: "error",
      phase: "catalog",
      errorCode: "invalid-catalog",
      backups: [],
    });
  });
});

test("sidecar managed-backup-catalog preserves recovery-only metadata without exposing paths", () => {
  withTemporaryHome((homeDirectory) => {
    const storagePaths = createManagedBackupDirectory(homeDirectory);
    writeBackup(storagePaths, "user.sqlite", "user backup");
    writeBackup(storagePaths, "restore-sidecar.sqlite.bak", "recovery backup");
    const result = spawnSync(
      process.execPath,
      [launcherPath, "managed-backup-catalog"],
      { cwd: projectRoot, env: sidecarEnvironment(homeDirectory), encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr);
    const message = JSON.parse(result.stdout);
    assert.equal(message.status, "ready");
    assert.deepEqual(
      message.backups.map(({ backupId, recoveryOnly }) => ({ backupId, recoveryOnly })),
      [
        { backupId: "restore-sidecar.sqlite.bak", recoveryOnly: true },
        { backupId: "user.sqlite", recoveryOnly: false },
      ],
    );
    for (const entry of message.backups) {
      assert.equal(Object.hasOwn(entry, "path"), false);
      assert.equal(Object.hasOwn(entry, "contents"), false);
    }
  });
});

test("a returned backupId is accepted by the managed restore request boundary", () => {
  withTemporaryHome((homeDirectory) => {
    const storagePaths = createManagedBackupDirectory(homeDirectory);
    writeBackup(storagePaths, "accepted.sqlite");
    const entry = listManagedBackupCatalog({ storagePaths }).backups[0];
    const validation = launcher.validateDesktopDataBackupOperationRequest(
      {
        kind: "desktop-data-backup-operation",
        schemaVersion: 1,
        operation: "restore",
        source: { kind: "managed-backup", backupId: entry.backupId },
        destination: null,
        confirmed: true,
      },
      storagePaths.applicationSupportRoot,
    );

    assert.deepEqual(validation, { ok: true, operation: "restore" });
  });
});

test("typed managed backup catalog bridge validates metadata and never accepts a renderer path", async () => {
  const originalWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };
  const calls = [];
  const response = catalogResponse({
    backups: [catalogEntry("a.sqlite"), catalogEntry("b.sqlite")],
  });
  const bridge = loadBridge((...args) => {
    calls.push(args);
    return Promise.resolve(response);
  });

  try {
    assert.deepEqual(await bridge.requestManagedBackupCatalog(), response);
    assert.deepEqual(calls, [["read_desktop_managed_backup_catalog"]]);

    const recoveryResponse = catalogResponse({
      backups: [
        catalogEntry("restore-bridge.sqlite.bak", "2026-08-25T00:00:01.000Z", true),
        catalogEntry("user.sqlite", "2026-08-25T00:00:00.000Z"),
      ],
    });
    const recoveryBridge = loadBridge(() => Promise.resolve(recoveryResponse));
    assert.deepEqual(await recoveryBridge.requestManagedBackupCatalog(), recoveryResponse);

    const missingMetadataBridge = loadBridge(() => Promise.resolve(catalogResponse({
      backups: [{
        ...catalogEntry("a.sqlite"),
        recoveryOnly: undefined,
      }],
    })));
    assert.deepEqual(await missingMetadataBridge.requestManagedBackupCatalog(), {
      ...catalogResponse({ status: "error", errorCode: "invalid-catalog", backups: [] }),
    });

    const malformedBridge = loadBridge(() => Promise.resolve(catalogResponse({
      backups: [{ ...catalogEntry("a.sqlite"), fileName: "/Users/private/notebook.sqlite" }],
    })));
    assert.deepEqual(await malformedBridge.requestManagedBackupCatalog(), {
      ...catalogResponse({ status: "error", errorCode: "invalid-catalog", backups: [] }),
    });

    const storageErrorBridge = loadBridge(() => Promise.resolve(catalogResponse({
      status: "error",
      errorCode: "storage-unavailable",
      backups: [],
    })));
    assert.deepEqual(await storageErrorBridge.requestManagedBackupCatalog(), {
      ...catalogResponse({ status: "error", errorCode: "storage-unavailable", backups: [] }),
    });

    const unavailableBridge = loadBridge(() => Promise.reject(new Error("invoke unavailable")));
    assert.deepEqual(await unavailableBridge.requestManagedBackupCatalog(), {
      ...catalogResponse({ status: "error", errorCode: "command-unavailable", backups: [] }),
    });
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("managed backup catalog bridge returns unsupported-web without invoking filesystem-capable commands", async () => {
  const originalWindow = global.window;
  let calls = 0;
  global.window = {};
  const bridge = loadBridge(() => {
    calls += 1;
    return Promise.resolve(catalogResponse());
  });

  try {
    assert.deepEqual(await bridge.requestManagedBackupCatalog(), { kind: "unsupported-web" });
    assert.equal(calls, 0);
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("managed backup catalog bridge and Tauri boundary keep paths and operation envelopes separate", () => {
  const bridge = fs.readFileSync(bridgePath, "utf8");
  const runtime = fs.readFileSync(path.join(projectRoot, "src-tauri", "src", "runtime.rs"), "utf8");
  const main = fs.readFileSync(path.join(projectRoot, "src-tauri", "src", "main.rs"), "utf8");
  const launcherSource = fs.readFileSync(launcherPath, "utf8");
  const functionStart = bridge.indexOf("export function requestManagedBackupCatalog");
  const functionEnd = bridge.indexOf("export function requestPendingRestoreStatus", functionStart);

  assert.notEqual(functionStart, -1);
  assert.notEqual(functionEnd, -1);
  assert.match(bridge, /MANAGED_BACKUP_CATALOG_COMMAND = "read_desktop_managed_backup_catalog"/);
  assert.match(bridge, /kind: "desktop-managed-backup-catalog"/);
  assert.doesNotMatch(bridge.slice(functionStart, functionEnd), /fetch\(|fs\.|path\.join|invoke<unknown>\([^)]*request/);
  assert.match(runtime, /DESKTOP_MANAGED_BACKUP_CATALOG_COMMAND: &str = "managed-backup-catalog"/);
  assert.match(runtime, /DesktopManagedBackupCatalogResponse/);
  assert.match(runtime, /recovery_only: bool/);
  assert.match(main, /read_desktop_managed_backup_catalog/);
  assert.match(launcherSource, /command === "managed-backup-catalog"/);
  assert.match(launcherSource, /desktop-managed-backup-catalog/);
  assert.match(launcherSource, /recoveryOnly/);
});
