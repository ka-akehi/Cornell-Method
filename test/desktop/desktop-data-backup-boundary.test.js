/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ts = require("typescript");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const launcherPath = path.join(projectRoot, "src-tauri", "sidecar", "launcher.cjs");
const bridgePath = path.join(
  projectRoot,
  "src",
  "shared",
  "desktop",
  "desktop-settings-bridge.ts",
);

const launcher = require(launcherPath);

function temporaryDirectory() {
  return fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), "cornell-desktop-data-backup-"),
  );
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

function selectedDialogResponse(dialog, selectionId = "a".repeat(64)) {
  return {
    kind: "desktop-file-dialog",
    schemaVersion: 1,
    dialog,
    ok: true,
    status: "selected",
    phase: "dialog",
    selection: {
      kind: "external-file",
      selectionId,
      fileName: "notebook.sqlite",
    },
    errorCode: null,
  };
}

function cancelledDialogResponse(dialog) {
  return {
    kind: "desktop-file-dialog",
    schemaVersion: 1,
    dialog,
    ok: false,
    status: "cancelled",
    phase: "dialog",
    selection: null,
    errorCode: null,
  };
}

function operationRequest(overrides = {}) {
  return {
    schemaVersion: 1,
    operation: "export",
    source: null,
    destination: {
      kind: "external-selection",
      selectionId: "a".repeat(64),
    },
    ...overrides,
  };
}

function sidecarOperationRequest(overrides = {}) {
  return {
    kind: "desktop-data-backup-operation",
    ...operationRequest(overrides),
  };
}

test("sidecar rejects malformed JSON with a typed request error", () => {
  const result = spawnSync(process.execPath, [launcherPath, "data-backup-operation", "{"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    kind: "desktop-data-backup-operation",
    schemaVersion: 1,
    ok: false,
    status: "error",
    operation: null,
    phase: "request",
    errorCode: "malformed-json",
    result: null,
  });
});

test("sidecar keeps unknown command fail-closed without changing existing protocol commands", () => {
  const result = spawnSync(process.execPath, [launcherPath, "unknown-command"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /unknown sidecar command/);
});

test("sidecar accepts only native-dialog external destinations and rejects unsafe paths", () => {
  const directory = temporaryDirectory();
  const managedRoot = path.join(directory, "managed");
  const externalRoot = path.join(directory, "external");
  const outsideRoot = path.join(directory, "outside");
  fs.mkdirSync(managedRoot);
  fs.mkdirSync(externalRoot);
  fs.mkdirSync(outsideRoot);
  fs.writeFileSync(path.join(outsideRoot, "source.sqlite"), "fixture");
  fs.symlinkSync(outsideRoot, path.join(externalRoot, "link"));

  try {
    const valid = launcher.validateDesktopDataBackupOperationRequest(
      sidecarOperationRequest({
        destination: {
          kind: "external-file",
          origin: "native-dialog",
          path: path.join(externalRoot, "export.sqlite"),
        },
      }),
      managedRoot,
    );
    assert.deepEqual(valid, { ok: true, operation: "export" });

    const existingDestination = path.join(externalRoot, "existing.sqlite");
    fs.writeFileSync(existingDestination, "preserve", { flag: "wx" });
    assert.deepEqual(
      launcher.validateDesktopDataBackupOperationRequest(
        sidecarOperationRequest({
          destination: {
            kind: "external-file",
            origin: "native-dialog",
            path: existingDestination,
          },
        }),
        managedRoot,
      ),
      { ok: false, errorCode: "destination-exists", operation: "export" },
    );

    assert.deepEqual(
      launcher.validateDesktopDataBackupOperationRequest(
        sidecarOperationRequest({
          destination: {
            kind: "external-file",
            origin: "renderer",
            path: path.join(externalRoot, "export.sqlite"),
          },
        }),
        managedRoot,
      ),
      { ok: false, errorCode: "invalid-request", operation: "export" },
    );

    assert.deepEqual(
      launcher.validateDesktopDataBackupOperationRequest(
        sidecarOperationRequest({
          destination: {
            kind: "external-file",
            origin: "native-dialog",
            path: path.join(managedRoot, "export.sqlite"),
          },
        }),
        managedRoot,
      ),
      { ok: false, errorCode: "managed-path", operation: "export" },
    );

    assert.deepEqual(
      launcher.validateDesktopDataBackupOperationRequest(
        sidecarOperationRequest({
          destination: {
            kind: "external-file",
            origin: "native-dialog",
            path: path.join(externalRoot, "link", "export.sqlite"),
          },
        }),
        managedRoot,
      ),
      { ok: false, errorCode: "symlink-path", operation: "export" },
    );

    assert.deepEqual(
      launcher.validateDesktopDataBackupOperationRequest(
        sidecarOperationRequest({
          destination: {
            kind: "external-file",
            origin: "native-dialog",
            path: "relative/export.sqlite",
          },
        }),
        managedRoot,
      ),
      { ok: false, errorCode: "relative-path", operation: "export" },
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("export fails closed when the live database is unavailable", () => {
  const directory = temporaryDirectory();
  const destination = path.join(directory, "export.sqlite");
  try {
    const result = spawnSync(
      process.execPath,
      [
        launcherPath,
        "data-backup-operation",
        JSON.stringify(
          sidecarOperationRequest({
            destination: {
              kind: "external-file",
              origin: "native-dialog",
              path: destination,
            },
          }),
        ),
      ],
      {
        cwd: projectRoot,
        encoding: "utf8",
        env: { ...process.env, CORNELL_DESKTOP_HOME: directory },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      kind: "desktop-data-backup-operation",
      schemaVersion: 1,
      ok: false,
      status: "error",
      operation: "export",
      phase: "operation",
      errorCode: "backup-failed",
      result: null,
    });
    assert.equal(fs.existsSync(destination), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("bridge returns a typed dialog cancel and never accepts a returned absolute path", async () => {
  const originalWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };
  const calls = [];
  const bridge = loadBridge((...args) => {
    calls.push(args);
    if (args[0] === "choose_data_backup_save_destination_command") {
      return Promise.resolve(cancelledDialogResponse("save-destination"));
    }
    return Promise.resolve({
      ...selectedDialogResponse("open-external-source"),
      selection: {
        ...selectedDialogResponse("open-external-source").selection,
        path: "/Users/private/Library/Application Support/notebook.sqlite",
      },
    });
  });

  try {
    assert.deepEqual(
      await bridge.requestDataBackupSaveDestination(),
      cancelledDialogResponse("save-destination"),
    );
    assert.deepEqual(
      await bridge.requestDataBackupExternalSource(),
      {
        kind: "desktop-file-dialog",
        schemaVersion: 1,
        dialog: "open-external-source",
        ok: false,
        status: "error",
        phase: "dialog",
        selection: null,
        errorCode: "command-unavailable",
      },
    );
    assert.deepEqual(calls, [
      ["choose_data_backup_save_destination_command"],
      ["choose_data_backup_external_source_command"],
    ]);
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("bridge sends only opaque selections and normalizes the typed sidecar error", async () => {
  const originalWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };
  const calls = [];
  const response = {
    kind: "desktop-data-backup-operation",
    schemaVersion: 1,
    ok: false,
    status: "error",
    operation: "export",
    phase: "operation",
    errorCode: "operation-not-implemented",
    result: null,
  };
  const bridge = loadBridge((...args) => {
    calls.push(args);
    return Promise.resolve(response);
  });

  try {
    const request = operationRequest();
    assert.deepEqual(await bridge.requestDataBackupOperation(request), response);
    assert.deepEqual(calls, [["run_desktop_data_backup_operation", { request }]]);

    const invalid = await bridge.requestDataBackupOperation({
      ...request,
      destination: {
        kind: "external-selection",
        selectionId: "a".repeat(64),
        path: "/Users/private/notebook.sqlite",
      },
    });
    assert.deepEqual(invalid, {
      kind: "desktop-data-backup-operation",
      schemaVersion: 1,
      ok: false,
      status: "error",
      operation: null,
      phase: "request",
      errorCode: "invalid-request",
      result: null,
    });
    assert.equal(calls.length, 1);
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("bridge rejects a sidecar response with a mismatched operation identity", async () => {
  const originalWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };
  const bridge = loadBridge(() => Promise.resolve({
    kind: "desktop-data-backup-operation",
    schemaVersion: 1,
    ok: false,
    status: "error",
    operation: "restore",
    phase: "operation",
    errorCode: "operation-not-implemented",
    result: null,
  }));

  try {
    assert.deepEqual(
      await bridge.requestDataBackupOperation(operationRequest()),
      {
        kind: "desktop-data-backup-operation",
        schemaVersion: 1,
        ok: false,
        status: "error",
        operation: "export",
        phase: "request",
        errorCode: "command-unavailable",
        result: null,
      },
    );
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("Tauri and bridge source keep the boundary command and selection path private", () => {
  const main = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "main.rs"),
    "utf8",
  );
  const runtime = fs.readFileSync(
    path.join(projectRoot, "src-tauri", "src", "runtime.rs"),
    "utf8",
  );
  const bridge = fs.readFileSync(bridgePath, "utf8");
  const launcherSource = fs.readFileSync(launcherPath, "utf8");

  assert.match(main, /choose_data_backup_save_destination_command/);
  assert.match(main, /choose_data_backup_external_source_command/);
  assert.match(main, /run_desktop_data_backup_operation/);
  assert.match(main, /DesktopFileSelectionStore::default\(\)/);
  assert.match(runtime, /DESKTOP_DIALOG_BINARY: &str = "[/]usr[/]bin[/]osascript"/);
  assert.match(runtime, /symlink_metadata/);
  assert.match(runtime, /origin: "native-dialog"/);
  assert.match(launcherSource, /command === "paths"/);
  assert.match(launcherSource, /command === "bootstrap"/);
  assert.match(launcherSource, /command === "staged-migrate"/);
  assert.match(launcherSource, /command === "validate-database"/);
  assert.match(launcherSource, /command === "data-backup-operation"/);
  assert.match(bridge, /selectionId/);
  const locationTypeStart = bridge.indexOf("export type DesktopDataBackupLocation");
  const operationTypeStart = bridge.indexOf(
    "export type DesktopDataBackupOperationRequest",
    locationTypeStart,
  );
  assert.notEqual(locationTypeStart, -1);
  assert.notEqual(operationTypeStart, -1);
  assert.doesNotMatch(
    bridge.slice(locationTypeStart, operationTypeStart),
    /path/i,
  );
});
