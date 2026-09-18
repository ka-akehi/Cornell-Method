// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- browser/Tauri bridge fakes intentionally model only the tested surface.
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

function verifyResponse(outcome = "verified") {
  return {
    outcome,
    state: availableResponse("verified-artifact", {
      verificationState: "verified",
    }).state,
  };
}

function verifyFailureResponse() {
  return {
    outcome: "failed",
    state: {
      snapshotVersion: 1,
      status: "failed",
      lastCheckAt: 100,
      checkStartedAt: null,
      pendingUpdate: null,
      failure: {
        code: "update-signature-proof",
        retryAt: 200,
      },
    },
  };
}

function createExternalWindow({
  protocol = "http:",
  hostname = "127.0.0.1",
  port = "43127",
  pathname = "/notes",
  search = "",
} = {}) {
  const listeners = new Map();
  const timers = new Map();
  let nextTimerId = 1;
  let currentHash = "";
  let hashAssignments = 0;
  let historyReplacements = 0;
  const historyReplacementUrls = [];
  let timerCreations = 0;
  let hashChangeHandler = null;

  const location = {
    protocol,
    hostname,
    port,
    pathname,
    search,
    get hash() {
      return currentHash;
    },
    set hash(value) {
      hashAssignments += 1;
      currentHash = value.startsWith("#") ? value : `#${value}`;
      hashChangeHandler?.(currentHash);
    },
  };

  const externalWindow = {
    location,
    history: {
      replaceState(_state, _title, nextUrl) {
        historyReplacements += 1;
        historyReplacementUrls.push(nextUrl);
        currentHash = nextUrl.includes("#")
          ? nextUrl.slice(nextUrl.indexOf("#"))
          : "";
      },
    },
    addEventListener(type, handler) {
      const handlers = listeners.get(type) ?? new Set();
      handlers.add(handler);
      listeners.set(type, handlers);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) ?? []) {
        handler(event);
      }
      return true;
    },
    setTimeout(handler) {
      timerCreations += 1;
      const id = nextTimerId;
      nextTimerId += 1;
      timers.set(id, handler);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };

  return {
    window: externalWindow,
    setHashChangeHandler(handler) {
      hashChangeHandler = handler;
    },
    runNextTimer() {
      const [id, handler] = timers.entries().next().value ?? [];
      assert.notEqual(id, undefined);
      handler();
    },
    get hashAssignments() {
      return hashAssignments;
    },
    get historyReplacements() {
      return historyReplacements;
    },
    get historyReplacementUrls() {
      return historyReplacementUrls;
    },
    get timerCreations() {
      return timerCreations;
    },
    get activeTimerCount() {
      return timers.size;
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
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

test("read-only update state bridge invokes only the snapshot command", async () => {
  const originalWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };
  const calls = [];
  const bridge = loadBridge((...args) => {
    calls.push(args);
    return Promise.resolve(response().state);
  });

  try {
    assert.deepEqual(await bridge.readUpdateStateSnapshot(), {
      kind: "snapshot",
      snapshot: response().state,
    });
    assert.deepEqual(calls, [["read_update_state"]]);
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("read-only update state bridge normalizes malformed or unavailable state to state-error", async () => {
  const originalWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };

  try {
    for (const implementation of [
      () => Promise.resolve({ ...response().state, unexpected: "private" }),
      () => Promise.reject({ message: "private state path" }),
    ]) {
      const bridge = loadBridge(implementation);
      assert.deepEqual(await bridge.readUpdateStateSnapshot(), {
        kind: "state-error",
        code: "update-state",
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

test("verify bridge invokes the native verification command without changing its response contract", async () => {
  const originalWindow = global.window;
  global.window = { __TAURI_INTERNALS__: {} };
  const calls = [];
  const bridge = loadBridge((...args) => {
    calls.push(args);
    return Promise.resolve(verifyResponse());
  });

  try {
    assert.deepEqual(await bridge.verifyPendingUpdate(), {
      kind: "verified",
      response: verifyResponse(),
    });
    assert.deepEqual(calls, [["verify_pending_update"]]);
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("manual update bridge returns unsupported-web for non-loopback browsers without bridge setup", async () => {
  const originalWindow = global.window;
  const pages = [
    {
      protocol: "https:",
      hostname: "example.test",
      port: "",
    },
    {
      protocol: "http:",
      hostname: "localhost",
      port: "3000",
    },
    {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "43127",
      pathname: "/api/updates",
      search: "?query=1",
    },
    {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "43127",
      pathname: "/settings",
    },
    {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "43127",
      pathname: "/notes/note-1/extra",
    },
    {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "43127",
      pathname: "/notes/",
    },
    {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "0",
    },
  ];

  try {
    for (const page of pages) {
      const external = createExternalWindow(page);
      global.window = external.window;
      let invokeCalls = 0;
      const bridge = loadBridge(() => {
        invokeCalls += 1;
        return Promise.resolve(response());
      });

      assert.deepEqual(await bridge.requestManualUpdateCheck(), {
        kind: "unsupported-web",
      });
      assert.equal(invokeCalls, 0);
      assert.equal(external.hashAssignments, 0);
      assert.equal(external.historyReplacements, 0);
      assert.equal(
        external.listenerCount("cornell:desktop-manual-update-check-result"),
        0,
      );
      assert.equal(external.timerCreations, 0);
      assert.equal(external.activeTimerCount, 0);
    }
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("external loopback bridge sends one fixed fragment and receives a sanitized result event", async () => {
  const originalWindow = global.window;
  const external = createExternalWindow();
  global.window = external.window;
  let invokeCalls = 0;
  const bridge = loadBridge(() => {
    invokeCalls += 1;
    return Promise.resolve(response());
  });

  external.setHashChangeHandler(() => {
    external.window.dispatchEvent({
      type: "cornell:desktop-manual-update-check-result",
      detail: response(),
    });
  });

  try {
    assert.deepEqual(await bridge.requestManualUpdateCheck(), {
      kind: "no-update",
      response: response(),
    });
    assert.equal(invokeCalls, 0);
    assert.equal(external.hashAssignments, 1);
    assert.equal(
      external.window.location.hash,
      "",
    );
    assert.equal(external.historyReplacements, 1);
    assert.equal(external.timerCreations, 1);
    assert.equal(external.activeTimerCount, 0);
    assert.equal(
      external.listenerCount("cornell:desktop-manual-update-check-result"),
      0,
    );
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("external loopback bridge reads a sanitized update state snapshot without invoking Tauri", async () => {
  const originalWindow = global.window;
  const external = createExternalWindow();
  global.window = external.window;
  let invokeCalls = 0;
  const bridge = loadBridge(() => {
    invokeCalls += 1;
    return Promise.resolve(response());
  });

  external.setHashChangeHandler(() => {
    external.window.dispatchEvent({
      type: "cornell:desktop-read-update-state-result",
      detail: response().state,
    });
  });

  try {
    assert.deepEqual(await bridge.readUpdateStateSnapshot(), {
      kind: "snapshot",
      snapshot: response().state,
    });
    assert.equal(invokeCalls, 0);
    assert.equal(external.hashAssignments, 1);
    assert.equal(external.window.location.hash, "");
    assert.deepEqual(external.historyReplacementUrls, ["/notes"]);
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("external loopback update state read reports timeout as state-error", async () => {
  const originalWindow = global.window;
  const external = createExternalWindow();
  global.window = external.window;
  const bridge = loadBridge(() => Promise.resolve(response()));

  try {
    const pending = bridge.readUpdateStateSnapshot();
    external.runNextTimer();
    assert.deepEqual(await pending, {
      kind: "state-error",
      code: "update-state",
    });
    assert.equal(external.window.location.hash, "");
    assert.equal(
      external.listenerCount("cornell:desktop-read-update-state-result"),
      0,
    );
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("external loopback verify bridge returns success and sanitized failure events", async () => {
  const originalWindow = global.window;
  const external = createExternalWindow();
  global.window = external.window;
  const bridge = loadBridge(() => Promise.resolve(verifyResponse()));
  let detail = verifyResponse();

  external.setHashChangeHandler(() => {
    external.window.dispatchEvent({
      type: "cornell:desktop-verify-pending-update-result",
      detail,
    });
  });

  try {
    assert.deepEqual(await bridge.verifyPendingUpdate(), {
      kind: "verified",
      response: verifyResponse(),
    });
    assert.equal(external.hashAssignments, 1);
    assert.equal(external.window.location.hash, "");
    assert.deepEqual(external.historyReplacementUrls, ["/notes"]);
    assert.equal(
      external.listenerCount("cornell:desktop-verify-pending-update-result"),
      0,
    );

    detail = verifyFailureResponse();
    assert.deepEqual(await bridge.verifyPendingUpdate(), {
      kind: "failed",
      response: verifyFailureResponse(),
    });
    assert.equal(external.hashAssignments, 2);
    assert.equal(external.activeTimerCount, 0);
    assert.equal(
      external.listenerCount("cornell:desktop-verify-pending-update-result"),
      0,
    );
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("external loopback verify bridge times out and cleans its listener, timer, and fragment", async () => {
  const originalWindow = global.window;
  const external = createExternalWindow();
  global.window = external.window;
  const bridge = loadBridge(() => Promise.resolve(verifyResponse()));

  try {
    const pending = bridge.verifyPendingUpdate();
    external.runNextTimer();
    assert.deepEqual(await pending, {
      kind: "command-error",
      code: "command-unavailable",
    });
    assert.equal(external.window.location.hash, "");
    assert.equal(external.activeTimerCount, 0);
    assert.equal(
      external.listenerCount("cornell:desktop-verify-pending-update-result"),
      0,
    );

    const malformed = bridge.verifyPendingUpdate();
    external.window.dispatchEvent({
      type: "cornell:desktop-verify-pending-update-result",
      detail: {
        kind: "command-error",
        code: "private-error",
        path: "/Users/private/update.zip",
      },
    });
    assert.deepEqual(await malformed, {
      kind: "command-error",
      code: "command-unavailable",
    });
    assert.equal(external.window.location.hash, "");
    assert.equal(external.activeTimerCount, 0);
    assert.equal(
      external.listenerCount("cornell:desktop-verify-pending-update-result"),
      0,
    );
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("external loopback verify bridge coalesces duplicate dispatches and only settles once", async () => {
  const originalWindow = global.window;
  const external = createExternalWindow();
  global.window = external.window;
  const bridge = loadBridge(() => Promise.resolve(verifyResponse()));

  try {
    const first = bridge.verifyPendingUpdate();
    const duplicate = bridge.verifyPendingUpdate();
    assert.strictEqual(duplicate, first);
    assert.equal(external.hashAssignments, 1);
    assert.equal(
      external.listenerCount("cornell:desktop-verify-pending-update-result"),
      1,
    );

    const event = {
      type: "cornell:desktop-verify-pending-update-result",
      detail: verifyResponse(),
    };
    external.window.dispatchEvent(event);
    external.window.dispatchEvent(event);
    assert.deepEqual(await first, {
      kind: "verified",
      response: verifyResponse(),
    });
    assert.equal(external.activeTimerCount, 0);
    assert.equal(
      external.listenerCount("cornell:desktop-verify-pending-update-result"),
      0,
    );
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("external loopback verify bridge rejects non-loopback and non-canonical pages", async () => {
  const originalWindow = global.window;
  const pages = [
    {
      protocol: "https:",
      hostname: "127.0.0.1",
      port: "43127",
      pathname: "/notes",
    },
    {
      protocol: "http:",
      hostname: "localhost",
      port: "43127",
      pathname: "/notes",
    },
    {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "43127",
      pathname: "/settings",
    },
    {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "43127",
      pathname: "/notes/note-1/extra",
    },
  ];

  try {
    for (const page of pages) {
      const external = createExternalWindow(page);
      global.window = external.window;
      const bridge = loadBridge(() => Promise.resolve(verifyResponse()));

      assert.deepEqual(await bridge.verifyPendingUpdate(), {
        kind: "unsupported-web",
      });
      assert.equal(external.hashAssignments, 0);
      assert.equal(external.historyReplacements, 0);
      assert.equal(external.activeTimerCount, 0);
      assert.equal(
        external.listenerCount("cornell:desktop-verify-pending-update-result"),
        0,
      );
    }
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("external loopback bridge accepts every canonical route and preserves its path and query", async () => {
  const originalWindow = global.window;
  const pages = [
    { pathname: "/notes", search: "?query=canvas&page=2" },
    { pathname: "/notes/new", search: "?mode=edit" },
    { pathname: "/notes/note-1", search: "?mode=view" },
    { pathname: "/backup", search: "?source=settings" },
  ];

  try {
    for (const page of pages) {
      const external = createExternalWindow(page);
      global.window = external.window;
      const bridge = loadBridge(() => Promise.resolve(response()));
      external.setHashChangeHandler(() => {
        external.window.dispatchEvent({
          type: "cornell:desktop-manual-update-check-result",
          detail: response(),
        });
      });

      assert.deepEqual(await bridge.requestManualUpdateCheck(), {
        kind: "no-update",
        response: response(),
      });
      assert.equal(external.hashAssignments, 1);
      assert.deepEqual(external.historyReplacementUrls, [
        `${page.pathname}${page.search}`,
      ]);
      assert.equal(external.window.location.hash, "");
    }
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("external loopback bridge coalesces duplicate requests and removes its listener", async () => {
  const originalWindow = global.window;
  const external = createExternalWindow();
  global.window = external.window;
  const bridge = loadBridge(() => Promise.resolve(response()));

  try {
    const first = bridge.requestManualUpdateCheck();
    const duplicate = bridge.requestManualUpdateCheck();
    assert.strictEqual(duplicate, first);
    assert.equal(external.hashAssignments, 1);
    assert.equal(
      external.listenerCount("cornell:desktop-manual-update-check-result"),
      1,
    );

    external.window.dispatchEvent({
      type: "cornell:desktop-manual-update-check-result",
      detail: response(),
    });
    assert.deepEqual(await first, {
      kind: "no-update",
      response: response(),
    });
    assert.equal(
      external.listenerCount("cornell:desktop-manual-update-check-result"),
      0,
    );
  } finally {
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});

test("external loopback bridge normalizes malformed events and timeout to command-unavailable", async () => {
  const originalWindow = global.window;
  const external = createExternalWindow();
  global.window = external.window;
  const bridge = loadBridge(() => Promise.resolve(response()));

  try {
    const malformed = bridge.requestManualUpdateCheck();
    external.window.dispatchEvent({
      type: "cornell:desktop-manual-update-check-result",
      detail: {
        kind: "command-error",
        code: "secret-provider-error",
        message: "private response body",
        source: "https://private.example.test",
      },
    });
    assert.deepEqual(await malformed, {
      kind: "command-error",
      code: "command-unavailable",
    });
    assert.equal(external.window.location.hash, "");

    for (const [detail, expected] of [
      [
        { kind: "command-error", code: "provider-internal" },
        { kind: "command-error", code: "provider-internal" },
      ],
      [
        { kind: "state-error", code: "update-state" },
        { kind: "state-error", code: "update-state" },
      ],
    ]) {
      const fixedError = bridge.requestManualUpdateCheck();
      external.window.dispatchEvent({
        type: "cornell:desktop-manual-update-check-result",
        detail,
      });
      assert.deepEqual(await fixedError, expected);
    }

    const timedOut = bridge.requestManualUpdateCheck();
    external.runNextTimer();
    assert.deepEqual(await timedOut, {
      kind: "command-error",
      code: "command-unavailable",
    });
    assert.equal(external.window.location.hash, "");
    assert.equal(
      external.listenerCount("cornell:desktop-manual-update-check-result"),
      0,
    );
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
  assert.match(source, /cornell-desktop-manual-update-check/);
  assert.match(source, /cornell:desktop-manual-update-check-result/);
  assert.match(source, /requestManualUpdateCheck\(\): Promise<DesktopManualUpdateCheckResult>/);
  assert.match(source, /invoke<unknown>\(MANUAL_UPDATE_CHECK_COMMAND\)/);
  assert.match(source, /window\.location\.hash = DESKTOP_MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT/);
  assert.match(source, /window\.location\.protocol === "http:"/);
  assert.match(source, /window\.location\.hostname === "127\.0\.0\.1"/);
  assert.match(source, /isCanonicalManualUpdateCheckPath\(window\.location\.pathname\)/);
  assert.match(source, /window\.location\.pathname/);
  assert.match(source, /window\.location\.search/);
  assert.match(source, /isValidDynamicPort/);
  assert.match(source, /window\.addEventListener\(/);
  assert.match(source, /MANUAL_UPDATE_CHECK_TIMEOUT_MS/);
  assert.match(source, /history\.replaceState/);
  assert.match(source, /normalizeExternalResult/);
  assert.match(source, /unsupported-web/);
  assert.match(source, /manualUpdateCheckInFlight/);
  assert.match(source, /read_update_state/);
  assert.match(source, /readUpdateStateSnapshot\(\)/);
  assert.match(source, /DESKTOP_UPDATE_STATE_REQUEST_FRAGMENT/);
  assert.match(source, /DESKTOP_UPDATE_STATE_RESULT_EVENT/);
  assert.match(source, /updateStateReadInFlight/);
  assert.match(source, /VERIFY_PENDING_UPDATE_COMMAND = "verify_pending_update"/);
  assert.match(source, /DESKTOP_VERIFY_PENDING_UPDATE_REQUEST_FRAGMENT/);
  assert.match(source, /DESKTOP_VERIFY_PENDING_UPDATE_RESULT_EVENT/);
  assert.match(source, /requestVerifyPendingUpdate\(\)/);
  assert.match(source, /verifyPendingUpdateInFlight/);
  assert.match(source, /VERIFY_PENDING_UPDATE_TIMEOUT_MS/);
  assert.match(source, /normalizeVerifyPendingUpdateExternalResult/);
  assert.match(source, /kind: "state-error"/);
  assert.match(source, /command-unavailable/);
  assert.doesNotMatch(source, /window\.\.__TAURI__\.core|fetch\(|GITHUB_RELEASES_MANIFEST_URL/);
});
// @ts-nocheck -- browser/Tauri bridge fakes intentionally model only the tested surface.
