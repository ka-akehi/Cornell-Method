/* eslint-disable @typescript-eslint/no-require-imports -- This focused test runs directly with Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Playwright owns E2E fixture cleanup outside the web server process", () => {
  const config = readSource("playwright.config.js");
  const globalTeardown = readSource("e2e/global-teardown.js");
  const webServer = readSource("e2e/web-server.js");

  assert.match(
    config,
    /globalTeardown:\s*require\.resolve\("\.\/e2e\/global-teardown\.js"\)/,
  );
  assert.match(globalTeardown, /cleanupE2eDatabase\(\)/);
  assert.match(globalTeardown, /throw error instanceof Error/);
  assert.doesNotMatch(webServer, /cleanupE2eDatabase/);
  assert.match(webServer, /process\.on\("SIGINT", \(\) => stopChild\("SIGINT"\)\)/);
  assert.match(webServer, /process\.on\("SIGTERM", \(\) => stopChild\("SIGTERM"\)\)/);
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
