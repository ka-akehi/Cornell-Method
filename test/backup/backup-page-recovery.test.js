/* eslint-disable @typescript-eslint/no-require-imports -- This focused test loads the client helper with Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const pagePath = path.join(
  projectRoot,
  "src",
  "modules",
  "backup",
  "ui",
  "components",
  "backup-page.tsx",
);

function loadRecoveryHelper() {
  const source = fs.readFileSync(pagePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} };

  class TestBackupRemoteError extends Error {
    constructor(message, options) {
      super(message);
      this.name = "BackupRemoteError";
      this.status = options.status;
      this.body = options.body ?? null;
    }
  }

  const injectedRequire = (request) => {
    if (request === "next/link") return () => null;
    if (request === "react") {
      return {
        createElement: () => null,
        useCallback: (callback) => callback,
        useEffect: () => undefined,
        useRef: () => ({ current: null }),
        useState: () => [null, () => undefined],
      };
    }
    if (request === "@/modules/backup/remote") {
      return {
        BackupRemoteError: TestBackupRemoteError,
        createBackup: () => Promise.resolve(),
        fetchBackups: () => Promise.resolve([]),
      };
    }
    if (request === "@/shared/desktop/desktop-settings-bridge") {
      return {
        requestDesktopBackupRecovery: () =>
          Promise.resolve({ kind: "unsupported-web" }),
      };
    }
    return require(request);
  };

  new Function("require", "module", "exports", output)(
    injectedRequire,
    compiledModule,
    compiledModule.exports,
  );
  return {
    consumeNavigation: compiledModule.exports.consumeBackupRecoveryNavigation,
    helper: compiledModule.exports.runBackupOperationWithRecovery,
    TestBackupRemoteError,
  };
}

function apiError(TestBackupRemoteError, code) {
  return new TestBackupRemoteError("安定した API エラー", {
    status: 500,
    body: { code, message: "安定した API エラー" },
  });
}

function readyRecovery() {
  return {
    kind: "desktop-backup-recovery",
    schemaVersion: 1,
    status: "ready",
    phase: "preflight",
    errorCode: null,
    recoverySnapshot: null,
  };
}

function requiredRecovery() {
  return {
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
  };
}

function notRecoveredRecovery() {
  return {
    kind: "desktop-backup-recovery",
    schemaVersion: 1,
    status: "not-recovered",
    phase: "preflight",
    errorCode: "storage-unavailable",
    recoverySnapshot: null,
  };
}

test("backup recovery navigation signals are route-scoped and consumed once", () => {
  const { consumeNavigation } = loadRecoveryHelper();
  const originalWindow = global.window;
  let currentHash = "#cornell-desktop-backup-recovery=ready";
  let replacements = 0;
  global.window = {
    location: {
      pathname: "/backup",
      search: "?view=latest",
      get hash() {
        return currentHash;
      },
    },
    history: {
      replaceState(_state, _title, url) {
        replacements += 1;
        currentHash = url.includes("#") ? url.slice(url.indexOf("#")) : "";
      },
    },
  };

  try {
    assert.deepEqual(consumeNavigation(), { status: "ready", reason: null });
    assert.equal(replacements, 1);
    assert.equal(consumeNavigation(), null);
  } finally {
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});

test("known API codes map to one preflight and a single ready GET retry", async () => {
  const { helper, TestBackupRemoteError } = loadRecoveryHelper();
  let executions = 0;
  let recoveries = 0;
  let reason;
  const result = await helper(
    "list",
    async () => {
      executions += 1;
      if (executions === 1) throw apiError(TestBackupRemoteError, "backup_database_unavailable");
      return ["backup"];
    },
    {
      isCurrent: () => true,
      requestRecovery: async (nextReason) => {
        recoveries += 1;
        reason = nextReason;
        return readyRecovery();
      },
    },
  );

  assert.deepEqual(result, { kind: "success", value: ["backup"] });
  assert.equal(executions, 2);
  assert.equal(recoveries, 1);
  assert.equal(reason, "backup_database_unavailable");
});

test("a failed GET retry returns the original error without another preflight", async () => {
  const { helper, TestBackupRemoteError } = loadRecoveryHelper();
  const original = apiError(TestBackupRemoteError, "backup_storage_failure");
  let executions = 0;
  let recoveries = 0;
  const result = await helper(
    "list",
    async () => {
      executions += 1;
      throw executions === 1 ? original : new Error("retry failed");
    },
    {
      isCurrent: () => true,
      requestRecovery: async () => {
        recoveries += 1;
        return readyRecovery();
      },
    },
  );

  assert.equal(result.kind, "error");
  assert.equal(result.error, original);
  assert.equal(executions, 2);
  assert.equal(recoveries, 1);
});

test("POST ready does not resend, recovery-required suppresses the API error, and unknown errors skip preflight", async () => {
  const { helper, TestBackupRemoteError } = loadRecoveryHelper();
  let executions = 0;
  let recoveries = 0;
  const readyResult = await helper(
    "create",
    async () => {
      executions += 1;
      throw apiError(TestBackupRemoteError, "backup_configuration_invalid");
    },
    {
      isCurrent: () => true,
      requestRecovery: async () => {
        recoveries += 1;
        return readyRecovery();
      },
    },
  );
  assert.deepEqual(readyResult, { kind: "ready-no-retry" });
  assert.equal(executions, 1);
  assert.equal(recoveries, 1);

  const requiredResult = await helper(
    "list",
    async () => {
      throw apiError(TestBackupRemoteError, "backup_database_unavailable");
    },
    {
      isCurrent: () => true,
      requestRecovery: async () => requiredRecovery(),
    },
  );
  assert.deepEqual(requiredResult, { kind: "recovery-required" });

  const unknownResult = await helper(
    "list",
    async () => {
      throw new Error("network failure");
    },
    {
      isCurrent: () => true,
      requestRecovery: async () => {
        throw new Error("must not run");
      },
    },
  );
  assert.equal(unknownResult.kind, "error");
  assert.match(unknownResult.error.message, /network failure/);

  const original = apiError(TestBackupRemoteError, "backup_storage_failure");
  const notRecoveredResult = await helper(
    "list",
    async () => {
      throw original;
    },
    {
      isCurrent: () => true,
      requestRecovery: async () => notRecoveredRecovery(),
    },
  );
  assert.equal(notRecoveredResult.kind, "error");
  assert.equal(notRecoveredResult.error, original);
});
