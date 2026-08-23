/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const bridgePath = path.join(
  projectRoot,
  "src",
  "shared",
  "desktop",
  "desktop-settings-bridge.ts",
);

function readBridgeSource() {
  return fs.readFileSync(bridgePath, "utf8");
}

function loadBridge(invokeImplementation) {
  const source = readBridgeSource();
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

function response() {
  return {
    outcome: "no-update",
    state: {
      snapshotVersion: 1,
      status: "no-update",
      lastCheckAt: 100,
      checkStartedAt: null,
      pendingUpdate: null,
      failure: null,
    },
  };
}

function availableResponse(artifact, pendingUpdate = {}) {
  return {
    outcome: "available",
    state: {
      snapshotVersion: 1,
      status: "available",
      lastCheckAt: 100,
      checkStartedAt: 50,
      pendingUpdate: {
        version: "1.2.3",
        channel: "stable",
        architecture: "aarch64",
        artifact,
        verificationState: "not-verified",
        discoveredAt: 100,
        ...pendingUpdate,
      },
      failure: null,
    },
  };
}

test("manual update bridge returns unsupported-web without invoking Tauri", async () => {
  const originalWindow = global.window;
  delete global.window;
  let calls = 0;
  const bridge = loadBridge(() => {
    calls += 1;
    return Promise.resolve(response());
  });

  try {
    assert.deepEqual(await bridge.requestManualUpdateCheck(), {
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
});

test("manual update bridge coalesces duplicate calls and clears after settlement", async () => {
  const originalWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };
  let calls = 0;
  let resolveFirst;
  const firstRequest = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const seenArguments = [];
  const bridge = loadBridge((...args) => {
    calls += 1;
    seenArguments.push(args);
    return calls === 1 ? firstRequest : Promise.resolve(response());
  });

  try {
    const first = bridge.requestManualUpdateCheck();
    const duplicate = bridge.requestManualUpdateCheck();
    assert.strictEqual(duplicate, first);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
    assert.deepEqual(seenArguments, [["manual_update_check"]]);

    resolveFirst(response());
    assert.deepEqual(await first, {
      kind: "no-update",
      response: response(),
    });
    await new Promise((resolve) => setImmediate(resolve));

    const afterSettlement = bridge.requestManualUpdateCheck();
    assert.notStrictEqual(afterSettlement, first);
    assert.deepEqual(await afterSettlement, {
      kind: "no-update",
      response: response(),
    });
    assert.equal(calls, 2);
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("manual update bridge normalizes unknown invoke rejection without exposing it", async () => {
  const originalWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };
  const bridge = loadBridge(() =>
    Promise.reject({
      message: "secret provider response",
      source: "https://private.example.test",
      responseBody: "private body",
    }),
  );

  try {
    assert.deepEqual(await bridge.requestManualUpdateCheck(), {
      kind: "command-error",
      code: "command-unavailable",
    });
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("manual update bridge accepts opaque artifact identifiers", async () => {
  const originalWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };
  const artifactIds = [
    "release/path",
    String.raw`release\\path`,
    "release://channel",
    "release candidate",
  ];

  try {
    for (const artifact of artifactIds) {
      const bridge = loadBridge(() =>
        Promise.resolve(availableResponse(artifact)),
      );

      assert.deepEqual(await bridge.requestManualUpdateCheck(), {
        kind: "available",
        response: availableResponse(artifact),
      });
    }
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("manual update bridge rejects invalid artifact snapshots and unknown fields", async () => {
  const originalWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };
  const invalidResponses = [
    availableResponse(""),
    availableResponse("artifact\u0000id"),
    availableResponse("a".repeat(257)),
    availableResponse("valid-artifact", { unexpected: true }),
    availableResponse("valid/path", { version: "1/2" }),
  ];

  try {
    for (const invalidResponse of invalidResponses) {
      const bridge = loadBridge(() => Promise.resolve(invalidResponse));

      assert.deepEqual(await bridge.requestManualUpdateCheck(), {
        kind: "command-error",
        code: "command-unavailable",
      });
    }
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("manual update bridge keeps the command and sanitized response contract local", () => {
  const source = readBridgeSource();

  assert.match(source, /@tauri-apps\/api\/core/);
  assert.match(source, /const MANUAL_UPDATE_CHECK_COMMAND = "manual_update_check"/);
  assert.match(source, /requestManualUpdateCheck\(\): Promise<DesktopManualUpdateCheckResult>/);
  assert.match(source, /invoke<unknown>\(MANUAL_UPDATE_CHECK_COMMAND\)/);
  assert.match(source, /unsupported-web/);
  assert.match(source, /manualUpdateCheckInFlight/);
  assert.match(source, /command-unavailable/);
  assert.doesNotMatch(source, /window\.\.__TAURI__\.core|fetch\(|GITHUB_RELEASES_MANIFEST_URL/);
});
