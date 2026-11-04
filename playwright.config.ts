import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  use: {
    baseURL: process.env.CRM_UI_BASE_URL || "http://127.0.0.1:3000",
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.CRM_UI_CHROME_PATH ? { executablePath: process.env.CRM_UI_CHROME_PATH } : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  }
});
