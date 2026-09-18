const { defineConfig, devices } = require("@playwright/test");

const baseURL = "http://localhost:4173";

module.exports = defineConfig({
  testDir: "./e2e",
  // The server is owned by globalSetup so its returned teardown completes
  // before the runner invokes globalTeardown. Playwright 1.61 tears down the
  // webServer plugin before user globalTeardown, so the plugin is intentionally
  // not used for this fixture lifecycle.
  globalSetup: require.resolve("./e2e/web-server.js"),
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
});
