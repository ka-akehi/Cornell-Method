import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const projectRoot = path.resolve(__dirname, "..");
const {
  cleanupE2eDatabase,
  e2eDatabaseSidecars,
}: {
  cleanupE2eDatabase: () => void;
  e2eDatabaseSidecars: string[];
} = require("../e2e/database-fixture");
const globalTeardown = require("../e2e/global-teardown");
const {
  createE2eServerLifecycle,
  runE2eGlobalSetup,
} = require("../e2e/web-server");

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Playwright awaits server teardown before runner-owned fixture cleanup", () => {
  const config = readSource("playwright.config.js");
  const globalTeardown = readSource("e2e/global-teardown.js");
  const webServer = readSource("e2e/web-server.js");

  assert.match(
    config,
    /globalSetup:\s*require\.resolve\("\.\/e2e\/web-server\.js"\)[\s\S]*globalTeardown:\s*require\.resolve\("\.\/e2e\/global-teardown\.js"\)/,
  );
  assert.match(
    config,
    /globalTeardown:\s*require\.resolve\("\.\/e2e\/global-teardown\.js"\)/,
  );
  assert.doesNotMatch(config, /webServer\s*:/);
  assert.match(webServer, /return async function teardown\(\)/);
  assert.match(webServer, /await lifecycle\.stop\(\)/);
  assert.match(webServer, /child\.once\("close"/);
  assert.match(webServer, /detached:\s*process\.platform !== "win32"/);
  assert.match(globalTeardown, /cleanupE2eDatabase\(\)/);
  assert.match(globalTeardown, /throw error instanceof Error/);
  assert.match(webServer, /cleanupFixture\s*=\s*cleanupE2eDatabase/);
  assert.match(webServer, /await cleanupFixture\(\)/);
  const exitHandlerStart = webServer.indexOf("exitHandler = () =>");
  const exitHandlerEnd = webServer.indexOf(
    'process.once("exit", exitHandler)',
  );
  assert.notEqual(exitHandlerStart, -1);
  assert.notEqual(exitHandlerEnd, -1);
  assert.doesNotMatch(
    webServer.slice(exitHandlerStart, exitHandlerEnd),
    /cleanupE2eDatabase|cleanupFixture/,
  );
  assert.match(webServer, /await lifecycle\.stop\(\);[\s\S]*?await cleanupFixture\(\)/);
});

test("E2E fixture cleanup covers the database and SQLite sidecars idempotently", () => {
  const fixture = readSource("e2e/database-fixture.js");

  assert.match(fixture, /e2eDatabasePath/);
  assert.match(fixture, /-journal/);
  assert.match(fixture, /-shm/);
  assert.match(fixture, /-wal/);
  assert.match(fixture, /error\.code === "ENOENT"/);
  assert.match(fixture, /prepareE2eDatabase\(\)[\s\S]*?cleanupE2eDatabase\(\)/);
});

test("global setup failure paths clean up the fixture in the runner", async () => {
  const scenarios: Array<{
    name: string;
    prepareError?: string;
    serverAvailable?: boolean;
    startError?: string;
    readinessError?: string;
    expectedEvents: string[];
    expectedError: RegExp;
  }> = [
    {
      name: "prepare failure",
      prepareError: "prepare failed",
      expectedEvents: ["fixture-prepared", "fixture-cleanup"],
      expectedError: /prepare failed/,
    },
    {
      name: "existing server detection",
      serverAvailable: true,
      expectedEvents: [
        "fixture-prepared",
        "server-check",
        "fixture-cleanup",
      ],
      expectedError: /127\.0\.0\.1:4173\/notes is already in use/,
    },
    {
      name: "child spawn failure",
      startError: "spawn failed",
      expectedEvents: [
        "fixture-prepared",
        "server-check",
        "lifecycle-created",
        "server-start",
        "server-stop",
        "fixture-cleanup",
      ],
      expectedError: /spawn failed/,
    },
    {
      name: "server readiness failure",
      readinessError: "readiness failed",
      expectedEvents: [
        "fixture-prepared",
        "server-check",
        "lifecycle-created",
        "server-start",
        "server-ready",
        "server-stop",
        "fixture-cleanup",
      ],
      expectedError: /readiness failed/,
    },
  ];

  for (const scenario of scenarios) {
    cleanupE2eDatabase();
    const events: string[] = [];

    try {
      await assert.rejects(
        runE2eGlobalSetup({
          prepareDatabase: () => {
            for (const filePath of e2eDatabaseSidecars) {
              fs.writeFileSync(filePath, "fixture");
            }
            events.push("fixture-prepared");
            if (scenario.prepareError) throw new Error(scenario.prepareError);
          },
          checkServer: async () => {
            events.push("server-check");
            return scenario.serverAvailable ?? false;
          },
          createLifecycle: () => {
            events.push("lifecycle-created");
            return {
              start() {
                events.push("server-start");
                if (scenario.startError) throw new Error(scenario.startError);
              },
              async waitUntilReady() {
                events.push("server-ready");
                if (scenario.readinessError) {
                  throw new Error(scenario.readinessError);
                }
              },
              async stop() {
                events.push("server-stop");
              },
            };
          },
          cleanupFixture: () => {
            events.push("fixture-cleanup");
            cleanupE2eDatabase();
          },
        }),
        scenario.expectedError,
      );
      await globalTeardown();

      assert.deepEqual(events, scenario.expectedEvents, scenario.name);
      assert.equal(
        e2eDatabaseSidecars.some((filePath) => fs.existsSync(filePath)),
        false,
        scenario.name,
      );
    } finally {
      cleanupE2eDatabase();
    }
  }
});

test("lifecycle smoke waits for the server close event before cleanup", async () => {
  const events: string[] = [];
  const fakeChild = new EventEmitter() as EventEmitter & { pid: number };
  fakeChild.pid = 12345;

  const lifecycle = createE2eServerLifecycle({
    spawnProcess: () => {
      events.push("server-started");
      return fakeChild;
    },
    waitForReady: async () => {
      events.push("server-ready");
    },
    sendSignal: (child: EventEmitter & { pid: number }, signal: string) => {
      events.push(`server-signal:${signal}`);
      setImmediate(() => {
        events.push("server-closed");
        child.emit("close", 0, null);
      });
    },
    shutdownTimeout: 100,
  });

  for (const filePath of e2eDatabaseSidecars) {
    fs.writeFileSync(filePath, "fixture");
  }

  try {
    lifecycle.start();
    await lifecycle.waitUntilReady();
    await lifecycle.stop();
    events.push("server-stop-complete");

    await globalTeardown();
    cleanupE2eDatabase();
    events.push("fixture-cleaned");

    assert.deepEqual(events, [
      "server-started",
      "server-ready",
      "server-signal:SIGTERM",
      "server-closed",
      "server-stop-complete",
      "fixture-cleaned",
    ]);
    assert.equal(
      e2eDatabaseSidecars.some((filePath) => fs.existsSync(filePath)),
      false,
    );
  } finally {
    cleanupE2eDatabase();
  }
});
