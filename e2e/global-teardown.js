const { cleanupE2eDatabase } = require("./database-fixture");

// Keep cleanup in the Playwright runner process. The webServer process can be
// force-killed without running its signal handlers.
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
