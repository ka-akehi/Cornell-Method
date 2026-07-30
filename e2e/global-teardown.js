const { cleanupE2eDatabase } = require("./database-fixture");

// web-server.js is globalSetup and its returned teardown is awaited before this
// hook by Playwright 1.61. Keep fixture cleanup in the runner process so it is
// independent of the server child process and its signal handlers.
async function globalTeardown() {
  try {
    cleanupE2eDatabase();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`E2E fixture cleanup failed: ${message}`);
    throw error instanceof Error ? error : new Error(message);
  }
}

module.exports = globalTeardown;
