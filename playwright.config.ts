import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "firefox-desktop",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    // The browser server uses loopback HTTP. Mark it local at runtime so
    // WebKit can store the checkout cookie; deployed staging/production use
    // HTTPS and retain Secure cookies.
    env: { ...process.env, APP_ENV: "local" },
  },
});
