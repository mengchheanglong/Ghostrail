/**
 * Browser-flow tests for saved-pack action buttons:
 *   - Re-run from saved pack (prefill form, generate new pack)
 *   - Inline delete confirmation (cancel path + confirm path)
 *   - Duplicate pack (new pack created, original preserved)
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
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-browser-actions-"));
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

// ── Re-run from saved pack ────────────────────────────────────

test("re-run prefills the generator form with the saved goal and context", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({
      goal: "Rerun goal for browser test",
      repositoryContext: "Rerun context for browser test",
    });
    await saveIntentPack(
      pack,
      "Rerun goal for browser test",
      "Rerun context for browser test",
      srv.dataDir
    );

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // Open the More menu to access Re-run
    await page.click("#moreActionsBtn");
    await page.click("#rerunBtn");

    await expect(page.locator("#goal")).toHaveValue("Rerun goal for browser test");
    await expect(page.locator("#context")).toHaveValue("Rerun context for browser test");
    await expect(page.locator("#draftHint")).toBeVisible();
  } finally {
    await srv.close();
  }
});

test("re-run then generate creates a new saved pack", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Pack for rerun-generate test" });
    await saveIntentPack(pack, "Pack for rerun-generate test", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // Verify there is currently 1 pack in the list
    await expect(page.locator(".pack-item")).toHaveCount(1);

    // Re-run prefills the form
    await page.click("#moreActionsBtn");
    await page.click("#rerunBtn");
    await expect(page.locator("#goal")).toHaveValue("Pack for rerun-generate test");

    // Generate a new pack from the prefilled form
    await page.click("#generate");

    // Wait for the list to refresh with 2 packs
    await expect(page.locator(".pack-item")).toHaveCount(2, { timeout: 10_000 });
  } finally {
    await srv.close();
  }
});

// ── Inline delete confirmation ────────────────────────────────

test("delete: first click shows confirm state; cancel resets it", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Pack for delete-cancel test" });
    await saveIntentPack(pack, "Pack for delete-cancel test", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // First click — should ask for confirmation (open More menu first)
    await page.click("#moreActionsBtn");
    await page.click("#deleteBtn");
    await expect(page.locator("#deleteBtn")).toHaveText("⚠ Confirm delete?");
    await expect(page.locator("#cancelDeleteBtn")).toBeVisible();

    // Cancel — should reset
    await page.click("#cancelDeleteBtn");
    await expect(page.locator("#deleteBtn")).toHaveText("🗑 Delete");
    await expect(page.locator("#cancelDeleteBtn")).not.toBeVisible();

    // Pack should still be in the list
    await expect(page.locator(".pack-item")).toHaveCount(1);
  } finally {
    await srv.close();
  }
});

test("delete: confirming removes the pack from the list", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Pack for delete-confirm test" });
    await saveIntentPack(pack, "Pack for delete-confirm test", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // First click — enter confirmation state (open More menu first)
    await page.click("#moreActionsBtn");
    await page.click("#deleteBtn");
    await expect(page.locator("#deleteBtn")).toHaveText("⚠ Confirm delete?");

    // Second click — confirm delete
    await page.click("#deleteBtn");

    // Detail card should be hidden and the empty-state message should be shown
    await expect(page.locator("#detailCard")).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#packListState")).toBeVisible();
    // The pack list <ul> should be hidden (renderPackList hides it when empty)
    await expect(page.locator("#packList")).not.toBeVisible();
  } finally {
    await srv.close();
  }
});

// ── Duplicate pack ────────────────────────────────────────────

test("duplicate creates a new pack and selects it, leaving the original intact", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Pack for duplicate test" });
    await saveIntentPack(pack, "Pack for duplicate test", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // Get the original pack ID from the selected sidebar item
    const originalItemId = await page.locator(".pack-item.selected").getAttribute("data-id");

    // Open More menu and click Duplicate
    await page.click("#moreActionsBtn");
    await page.click("#duplicateBtn");

    // Two packs should now be in the list
    await expect(page.locator(".pack-item")).toHaveCount(2, { timeout: 10_000 });

    // The newly selected item should have a different id than the original
    const newItemId = await page.locator(".pack-item.selected").getAttribute("data-id");
    expect(newItemId).not.toEqual(originalItemId);

    // Detail card is visible for the duplicate
    await expect(page.locator("#detailCard")).toBeVisible();
  } finally {
    await srv.close();
  }
});
