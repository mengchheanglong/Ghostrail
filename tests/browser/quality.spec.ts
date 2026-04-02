/**
 * Browser-flow tests for the Live Goal Quality Score (B-QUALITY):
 *   - Quality bar appears and shows "Vague" for empty/vague input
 *   - Quality bar shows "Clear" for a well-specified goal
 *   - Suggestions appear for vague goals and disappear for clear goals
 */
import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler } from "../../dist/core/handler.js";

const publicDir = join(process.cwd(), "public");

interface TestServer {
  url: string;
  dataDir: string;
  close: () => Promise<void>;
}

async function startTestServer(): Promise<TestServer> {
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-browser-quality-"));
  const handler = createHandler(dataDir, publicDir);
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as { port: number };
  const url = `http://localhost:${addr.port}`;
  const close = (): Promise<void> =>
    new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    ).then(() => rm(dataDir, { recursive: true, force: true }));
  return { url, dataDir, close };
}

// ── Quality bar hidden when goal is empty ─────────────────────

test("quality bar is hidden when the goal textarea is empty", async ({ page }) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);
    await page.waitForSelector("#goal");

    // Bar should not be visible initially
    await expect(page.locator("#qualityBarWrap")).not.toBeVisible();
    await expect(page.locator("#qualitySuggestions")).not.toBeVisible();
  } finally {
    await srv.close();
  }
});

// ── Quality bar shows Vague for short/vague input ─────────────

test("quality bar appears and shows Vague level for a vague goal", async ({ page }) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);
    await page.waitForSelector("#goal");

    await page.fill("#goal", "Improve the dashboard");

    // Bar should become visible
    await expect(page.locator("#qualityBarWrap")).toBeVisible({ timeout: 3_000 });

    // Label should say Needs more detail
    await expect(page.locator("#qualityLabel")).toContainText("Needs more detail");

    // At least one suggestion should appear
    await expect(page.locator("#qualitySuggestions")).toBeVisible();
    await expect(page.locator("#qualitySuggestions")).toContainText("improve");
  } finally {
    await srv.close();
  }
});

// ── Quality bar shows Clear for a well-specified goal ─────────

test("quality bar shows Clear level for a well-specified goal", async ({ page }) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);
    await page.waitForSelector("#goal");

    const clearGoal =
      "Add subscription upgrade flow so that existing users can move from monthly to annual billing, " +
      "but do not break current billing behavior or affect existing subscriptions";

    await page.fill("#goal", clearGoal);

    await expect(page.locator("#qualityBarWrap")).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("#qualityLabel")).toContainText("Looks good");

    // No suggestions for a clear goal
    await expect(page.locator("#qualitySuggestions")).not.toBeVisible();
  } finally {
    await srv.close();
  }
});
