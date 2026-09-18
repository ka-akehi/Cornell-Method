// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- the test intentionally evaluates transpiled browser/CJS boundaries.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { test } from "node:test";

const projectRoot = path.resolve(__dirname, "../..");
const bridgePath = path.join(
  projectRoot,
  "src",
  "shared",
  "desktop",
  "desktop-settings-bridge.ts",
);

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

function withNativeWindow(callback) {
  const originalWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      if (originalWindow === undefined) {
        delete global.window;
      } else {
        global.window = originalWindow;
      }
    });
}

function dialogResponse(overrides = {}) {
  return {
    kind: "desktop-diagnostic-dialog",
    schemaVersion: 1,
    dialog: "diagnostic-export",
    operation: "select-destination",
    status: "selected",
    phase: "dialog",
    ok: true,
    selection: {
      kind: "diagnostic-export",
      selectionId: "a".repeat(64),
      fileName: "diagnostics.zip",
    },
    errorCode: null,
    ...overrides,
  };
}

function exportResponse(overrides = {}) {
  return {
    kind: "desktop-diagnostic-export",
    schemaVersion: 1,
    dialog: "diagnostic-export",
    operation: "export",
    status: "success",
    phase: "publish",
    ok: true,
    selection: {
      kind: "diagnostic-export",
      selectionId: "a".repeat(64),
      fileName: "diagnostics.zip",
    },
    errorCode: null,
    result: {
      fileName: "diagnostics.zip",
      size: 42,
    },
    ...overrides,
  };
}

test("diagnostic bridge is unsupported on web and never uses the external loopback", async () => {
  const originalWindow = global.window;
  delete global.window;
  let calls = 0;
  const bridge = loadBridge(() => {
    calls += 1;
    return Promise.resolve();
  });

  try {
    assert.deepEqual(await bridge.requestDiagnosticExportDestination(), {
      kind: "unsupported-web",
    });
    assert.deepEqual(await bridge.requestDesktopDiagnostics("a".repeat(64)), {
      kind: "unsupported-web",
    });
    assert.equal(calls, 0);
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }

  const loopbackWindow = {
    location: {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "43127",
      pathname: "/notes",
      search: "",
    },
    addEventListener() {
      throw new Error("diagnostic bridge must not register a loopback listener");
    },
  };
  global.window = loopbackWindow;
  try {
    const bridge = loadBridge(() => {
      throw new Error("diagnostic bridge must not invoke without Tauri");
    });
    assert.deepEqual(await bridge.requestDiagnosticExportDestination(), {
      kind: "unsupported-web",
    });
    assert.deepEqual(await bridge.requestDesktopDiagnostics("a".repeat(64)), {
      kind: "unsupported-web",
    });
  } finally {
    delete global.window;
  }
});

test("diagnostic bridge uses dedicated native commands and selection-id-only export requests", async () => {
  await withNativeWindow(async () => {
    const calls = [];
    const bridge = loadBridge((...args) => {
      calls.push(args);
      return Promise.resolve(
        args[0] === "export_desktop_diagnostics"
          ? exportResponse()
          : dialogResponse(),
      );
    });
    const selectionId = "a".repeat(64);

    assert.deepEqual(
      await bridge.requestDiagnosticExportDestination(),
      dialogResponse(),
    );
    assert.deepEqual(
      await bridge.requestDesktopDiagnostics(selectionId),
      exportResponse(),
    );
    assert.deepEqual(calls, [
      ["choose_diagnostic_export_destination_command"],
      [
        "export_desktop_diagnostics",
        {
          request: {
            schemaVersion: 1,
            operation: "export",
            selectionId,
          },
        },
      ],
    ]);
    assert.deepEqual(Object.keys(calls[1][1].request), [
      "schemaVersion",
      "operation",
      "selectionId",
    ]);
  });
});

test("diagnostic dialog preserves the cancel contract and typed errors", async () => {
  await withNativeWindow(async () => {
    const responses = [
      dialogResponse({
        status: "cancelled",
        ok: false,
        selection: null,
        errorCode: null,
      }),
      dialogResponse({
        status: "error",
        ok: false,
        selection: null,
        errorCode: "managed-path",
      }),
    ];
    const bridge = loadBridge(() => Promise.resolve(responses.shift()));

    assert.deepEqual(await bridge.requestDiagnosticExportDestination(), {
      kind: "desktop-diagnostic-dialog",
      schemaVersion: 1,
      dialog: "diagnostic-export",
      operation: "select-destination",
      status: "cancelled",
      phase: "dialog",
      ok: false,
      selection: null,
      errorCode: null,
    });
    assert.deepEqual(await bridge.requestDiagnosticExportDestination(), {
      kind: "desktop-diagnostic-dialog",
      schemaVersion: 1,
      dialog: "diagnostic-export",
      operation: "select-destination",
      status: "error",
      phase: "dialog",
      ok: false,
      selection: null,
      errorCode: "managed-path",
    });
  });
});

test("diagnostic bridge strips error selection/result and normalizes invoke rejection", async () => {
  await withNativeWindow(async () => {
    const selectionId = "a".repeat(64);
    const bridge = loadBridge(() =>
      Promise.resolve({
        ...exportResponse(),
        status: "error",
        phase: "archive",
        ok: false,
        errorCode: "archive-write-failed",
        selection: {
          kind: "diagnostic-export",
          selectionId,
          fileName: "diagnostics.zip",
        },
        result: null,
      }),
    );

    assert.deepEqual(await bridge.requestDesktopDiagnostics(selectionId), {
      kind: "desktop-diagnostic-export",
      schemaVersion: 1,
      dialog: "diagnostic-export",
      operation: "export",
      status: "error",
      phase: "archive",
      ok: false,
      selection: null,
      errorCode: "archive-write-failed",
      result: null,
    });

    const rejectedBridge = loadBridge(() =>
      Promise.reject({
        message: "private exception",
        path: "/Users/private/diagnostics.zip",
      }),
    );
    assert.deepEqual(await rejectedBridge.requestDiagnosticExportDestination(), {
      kind: "desktop-diagnostic-dialog",
      schemaVersion: 1,
      dialog: "diagnostic-export",
      operation: "select-destination",
      status: "error",
      phase: "dialog",
      ok: false,
      selection: null,
      errorCode: "command-unavailable",
    });
  });
});

test("diagnostic export preserves typed backend errors without exposing raw payload", async () => {
  await withNativeWindow(async () => {
    const selectionId = "a".repeat(64);
    const responses = [
      exportResponse({
        status: "error",
        phase: "request",
        ok: false,
        selection: {
          kind: "diagnostic-export",
          selectionId,
          fileName: "diagnostics.zip",
        },
        errorCode: "diagnostics-unavailable",
        result: null,
      }),
      exportResponse({
        status: "error",
        phase: "archive",
        ok: false,
        selection: {
          kind: "diagnostic-export",
          selectionId,
          fileName: "diagnostics.zip",
        },
        errorCode: "log-lock-failed",
        result: null,
      }),
    ];
    const bridge = loadBridge(() => Promise.resolve(responses.shift()));

    for (const errorCode of ["diagnostics-unavailable", "log-lock-failed"]) {
      assert.deepEqual(await bridge.requestDesktopDiagnostics(selectionId), {
        kind: "desktop-diagnostic-export",
        schemaVersion: 1,
        dialog: "diagnostic-export",
        operation: "export",
        status: "error",
        phase: errorCode === "diagnostics-unavailable" ? "request" : "archive",
        ok: false,
        selection: null,
        errorCode,
        result: null,
      });
    }
  });
});

test("diagnostic bridge rejects unknown fields, paths, unknown errors, and selection mismatches", async () => {
  await withNativeWindow(async () => {
    const selectionId = "a".repeat(64);
    const responses = [
      { ...dialogResponse(), privatePath: "/Users/private/diagnostics.zip" },
      dialogResponse({
        selection: {
          kind: "diagnostic-export",
          selectionId,
          fileName: "/Users/private/diagnostics.zip",
        },
      }),
      exportResponse({
        selection: {
          kind: "diagnostic-export",
          selectionId: "b".repeat(64),
          fileName: "diagnostics.zip",
        },
      }),
      exportResponse({
        status: "error",
        phase: "validation",
        ok: false,
        selection: null,
        errorCode: "future-private-error",
        result: null,
      }),
    ];
    const bridge = loadBridge(() => Promise.resolve(responses.shift()));

    const unavailableDialog = {
      kind: "desktop-diagnostic-dialog",
      schemaVersion: 1,
      dialog: "diagnostic-export",
      operation: "select-destination",
      status: "error",
      phase: "dialog",
      ok: false,
      selection: null,
      errorCode: "command-unavailable",
    };
    const unavailableExport = {
      kind: "desktop-diagnostic-export",
      schemaVersion: 1,
      dialog: "diagnostic-export",
      operation: "export",
      status: "error",
      phase: "request",
      ok: false,
      selection: null,
      errorCode: "command-unavailable",
      result: null,
    };

    assert.deepEqual(await bridge.requestDiagnosticExportDestination(), unavailableDialog);
    assert.deepEqual(await bridge.requestDiagnosticExportDestination(), unavailableDialog);
    assert.deepEqual(await bridge.requestDesktopDiagnostics(selectionId), unavailableExport);
    assert.deepEqual(await bridge.requestDesktopDiagnostics(selectionId), unavailableExport);
  });
});

test("diagnostic bridge rejects invalid selection ids before invoking native export", async () => {
  await withNativeWindow(async () => {
    let calls = 0;
    const bridge = loadBridge(() => {
      calls += 1;
      return Promise.resolve(exportResponse());
    });

    assert.deepEqual(
      await bridge.requestDesktopDiagnostics("/Users/private/selection"),
      {
        kind: "desktop-diagnostic-export",
        schemaVersion: 1,
        dialog: "diagnostic-export",
        operation: "export",
        status: "error",
        phase: "request",
        ok: false,
        selection: null,
        errorCode: "invalid-request",
        result: null,
      },
    );
    assert.equal(calls, 0);
  });
});
// @ts-nocheck -- the test intentionally evaluates transpiled browser/CJS boundaries.
