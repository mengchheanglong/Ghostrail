import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  timeout: 30_000,
  workers: 1,
  use: {
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROME_PATH ?? "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  },
  reporter: [["list"]],
});
