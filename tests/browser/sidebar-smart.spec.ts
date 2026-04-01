/**
 * Browser tests for sidebar smart folder filter pills:
 *   - Filter pills appear when packs are present
 *   - "Starred" filter shows only starred packs; "All" restores full list
 *   - "Active" (in-progress) filter shows only active packs
 *   - "Ready" filter shows only approved packs
 */
import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler } from "../../dist/core/handler.js";
import { saveIntentPack } from "../../dist/core/intentPackStore.js";
import { generateIntentPack } from "../../dist/core/generateIntentPack.js";
import type { IntentPack } from "../../dist/core/types.js";

const publicDir = join(process.cwd(), "public");

interface TestServer {
  url: string;
  dataDir: string;
  close: () => Promise<void>;
}

async function startTestServer(): Promise<TestServer> {
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-browser-sidebar-smart-"));
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

// ── Filter pills visibility ───────────────────────────────────

test("filter pills appear once packs exist and only show filters with matching packs", async ({ page }) => {
  const srv = await startTestServer();
  try {
    // Empty store — filter pills should not be in the DOM
    await page.goto(srv.url);
    await expect(page.locator("#sidebarFilters")).not.toBeAttached({ timeout: 5_000 });

    // Add a plain draft pack — only "All" pill should appear (no starred/flagged/ready/active packs)
    const pack = generateIntentPack({ goal: "Plain draft pack" });
    await saveIntentPack(pack as IntentPack, "Plain draft pack", undefined, srv.dataDir);
    await page.reload();
    await page.waitForSelector("#detailCard", { state: "visible" });

    await expect(page.locator("#sidebarFilters")).toBeVisible();
    await expect(page.locator("#sidebarFilter-all")).toBeVisible();
    // Non-matching filters should not be rendered
    await expect(page.locator("#sidebarFilter-starred")).not.toBeAttached();
    await expect(page.locator("#sidebarFilter-ready")).not.toBeAttached();
    await expect(page.locator("#sidebarFilter-in-progress")).not.toBeAttached();
  } finally {
    await srv.close();
  }
});

// ── Starred filter ────────────────────────────────────────────

test("starred filter shows only starred packs; All restores the full list", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const starPack = { ...generateIntentPack({ goal: "A starred pack" }), starred: true } as IntentPack;
    const plainPack = generateIntentPack({ goal: "A plain pack" }) as IntentPack;
    await saveIntentPack(starPack, "A starred pack", undefined, srv.dataDir);
    await saveIntentPack(plainPack, "A plain pack", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });
    await expect(page.locator(".pack-item")).toHaveCount(2);

    // Starred filter pill should be visible
    await expect(page.locator("#sidebarFilter-starred")).toBeVisible();

    // Click Starred filter → only 1 pack
    await page.click("#sidebarFilter-starred");
    await expect(page.locator(".pack-item")).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator(".pack-item")).toContainText("A starred pack");

    // Click All → both packs restored
    await page.click("#sidebarFilter-all");
    await expect(page.locator(".pack-item")).toHaveCount(2, { timeout: 5_000 });
  } finally {
    await srv.close();
  }
});

// ── In-progress filter ────────────────────────────────────────

test("active filter shows only in-progress packs", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const activePack = {
      ...generateIntentPack({ goal: "An in-progress pack" }),
      status: "in-progress",
    } as IntentPack;
    const draftPack = generateIntentPack({ goal: "A draft pack" }) as IntentPack;
    await saveIntentPack(activePack, "An in-progress pack", undefined, srv.dataDir);
    await saveIntentPack(draftPack, "A draft pack", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });
    await expect(page.locator(".pack-item")).toHaveCount(2);

    // Active filter pill should be visible
    await expect(page.locator("#sidebarFilter-in-progress")).toBeVisible();

    await page.click("#sidebarFilter-in-progress");
    await expect(page.locator(".pack-item")).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator(".pack-item")).toContainText("An in-progress pack");
  } finally {
    await srv.close();
  }
});

// ── Ready filter ──────────────────────────────────────────────

test("ready filter shows only approved packs", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const readyPack = {
      ...generateIntentPack({ goal: "An approved pack" }),
      status: "approved",
    } as IntentPack;
    const draftPack = generateIntentPack({ goal: "A draft pack" }) as IntentPack;
    await saveIntentPack(readyPack, "An approved pack", undefined, srv.dataDir);
    await saveIntentPack(draftPack, "A draft pack", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });
    await expect(page.locator(".pack-item")).toHaveCount(2);

    // Ready filter pill should be visible
    await expect(page.locator("#sidebarFilter-ready")).toBeVisible();

    await page.click("#sidebarFilter-ready");
    await expect(page.locator(".pack-item")).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator(".pack-item")).toContainText("An approved pack");
  } finally {
    await srv.close();
  }
});
