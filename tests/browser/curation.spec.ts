/**
 * Browser-flow tests for starring and archiving:
 *   - Star toggle updates the button label and shows ★ indicator in sidebar
 *   - Archive toggle hides the pack from the default list
 *   - Show archived toggle reveals the archived pack
 *
 * Each test starts a real HTTP server with a temp data directory and tears it down after.
 */
import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler } from "../../dist/core/handler.js";
import { saveIntentPack } from "../../dist/core/intentPackStore.js";
import { generateIntentPack } from "../../dist/core/generateIntentPack.js";

const publicDir = join(process.cwd(), "public");

interface TestServer {
  url: string;
  dataDir: string;
  close: () => Promise<void>;
}

async function startTestServer(): Promise<TestServer> {
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-browser-curation-"));
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

// ── Star toggle ───────────────────────────────────────────────

test("star button toggles label and shows ★ indicator in sidebar", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Pack to star in browser" });
    await saveIntentPack(pack, "Pack to star in browser", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // Initial state: button says "☆ Star" (open More menu first)
    await page.click("#moreActionsBtn");
    await expect(page.locator("#starBtn")).toHaveText("☆ Star");

    // Click star — menu closes after action
    await page.click("#starBtn");

    // ★ indicator should appear in the sidebar list item
    await expect(page.locator(".pack-item .star-indicator")).toBeVisible({ timeout: 5_000 });

    // Re-open More menu to verify button label updated
    await page.click("#moreActionsBtn");
    await expect(page.locator("#starBtn")).toHaveText("★ Unstar");
  } finally {
    await srv.close();
  }
});

// ── Archive toggle ────────────────────────────────────────────

test("archiving a pack hides it from the default list", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Pack to archive in browser" });
    await saveIntentPack(pack, "Pack to archive in browser", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // One pack visible initially
    await expect(page.locator(".pack-item")).toHaveCount(1);

    // Archive the pack (open More menu first)
    await page.click("#moreActionsBtn");
    await page.click("#archiveBtn");

    // With "Show archived" off (default), pack disappears from list
    await expect(page.locator(".pack-item")).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator("#detailCard")).not.toBeVisible();
  } finally {
    await srv.close();
  }
});

// ── Show archived toggle ──────────────────────────────────────

test("show archived toggle reveals archived packs", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Pack to reveal with show-archived" });
    await saveIntentPack(pack, "Pack to reveal with show-archived", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // Archive the pack via the UI (open More menu first)
    await page.click("#moreActionsBtn");
    await page.click("#archiveBtn");
    await expect(page.locator(".pack-item")).toHaveCount(0, { timeout: 5_000 });

    // Enable "Show archived"
    await page.click("#showArchivedToggle");

    // Pack reappears with archived badge
    await expect(page.locator(".pack-item")).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator(".archived-indicator")).toBeVisible();
  } finally {
    await srv.close();
  }
});
