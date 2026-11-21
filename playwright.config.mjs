import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.mjs",
  outputDir: "./tmp/playwright-results",
  use: {
    baseURL: "http://127.0.0.1:43892",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    locale: "ru-RU",
    viewport: { width: 393, height: 852 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 43892 --strictPort",
    url: "http://127.0.0.1:43892",
  },
});
