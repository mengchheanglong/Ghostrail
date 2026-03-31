import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  timeout: 30_000,
  workers: 1,
  use: {
    headless: true,
    launchOptions: process.env.CHROME_PATH ? {
      executablePath: process.env.CHROME_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    } : {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  },
  reporter: [["list"]],
});
