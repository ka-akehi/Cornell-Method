const { defineConfig, devices } = require("@playwright/test");

const e2eDatabaseUrl = "file:./prisma/e2e.db";
const baseURL = "http://127.0.0.1:4173";

module.exports = defineConfig({
  testDir: "./e2e",
  globalTeardown: require.resolve("./e2e/global-teardown.js"),
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node e2e/web-server.js",
    url: `${baseURL}/notes`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: e2eDatabaseUrl,
      PRISMA_PROVIDER: "sqlite",
    },
  },
});
