/**
 * Browser-flow tests for the Version History section (B-HISTORY-UI):
 *   - History section is visible when a pack is selected
 *   - History section shows "No history yet" for a pack with no history
 *   - History entries appear after the pack has been edited
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
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-browser-history-"));
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

// ── History section is visible ────────────────────────────────

test("history section is visible when a pack is selected", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Add billing invoice support" });
    await saveIntentPack(pack, "Add billing invoice support", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // History section is in the Audit tab
    await page.click("#tab-audit");

    await expect(page.locator("#historySection")).toBeVisible();
    await expect(page.locator("#historyContent")).toBeVisible();
  } finally {
    await srv.close();
  }
});

// ── No history message ────────────────────────────────────────

test("history section shows no-history message for a freshly created pack", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Add user search" });
    await saveIntentPack(pack, "Add user search", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // History section is in the Audit tab
    await page.click("#tab-audit");

    // Wait for history to load
    await expect(page.locator("#historyContent")).not.toContainText("Loading", { timeout: 5_000 });
    await expect(page.locator("#historyContent")).toContainText("No history yet");
  } finally {
    await srv.close();
  }
});

// ── History entries appear after editing ──────────────────────

test("history section shows snapshot entries after a pack is edited", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Original goal text" });
    await saveIntentPack(pack, "Original goal text", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // Edit the notes (notes edits create a history snapshot)
    await page.click("#editNotesBtn");
    await page.fill("#notesInput", "First note for history tracking");
    await page.click("#saveNotesBtn");

    // Wait for save to complete and history to reload
    await expect(page.locator("#notesDisplay")).toContainText("First note", { timeout: 10_000 });

    // Switch to Audit tab to verify history section
    await page.click("#tab-audit");

    // History section should now show an entry
    await expect(page.locator("#historyContent")).not.toContainText("Loading", { timeout: 5_000 });
    await expect(page.locator("#historyContent")).not.toContainText("No history yet", { timeout: 5_000 });
    await expect(page.locator(".history-entry")).toBeVisible({ timeout: 5_000 });
  } finally {
    await srv.close();
  }
});
