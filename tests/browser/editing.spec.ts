/**
 * Browser-flow tests for saved-pack inline editing.
 *
 * Each test:
 *  - starts a real HTTP server against a temp data directory
 *  - seeds one pack directly via the store (no LLM call)
 *  - opens the page in a headless browser
 *  - drives the inline editor for the flow under test
 *  - asserts the updated value is displayed
 *  - tears down the server and temp dir
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
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-browser-test-"));
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

// ── Edit goal ──────────────────────────────────────────────────

test("edit goal saves and updates the display", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Initial goal for browser test" });
    await saveIntentPack(pack, "Initial goal for browser test", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    await page.click("#editGoalBtn");
    await page.waitForSelector("#goalEditor", { state: "visible" });
    await page.fill("#goalEditInput", "Updated goal from browser test");
    await page.click("#saveGoalBtn");

    await page.waitForSelector("#goalEditor", { state: "hidden" });
    await expect(page.locator("#goalDisplay")).toHaveText("Updated goal from browser test");
  } finally {
    await srv.close();
  }
});

// ── Edit repositoryContext ─────────────────────────────────────

test("edit repositoryContext saves and updates the display", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({
      goal: "Test pack for context edit",
      repositoryContext: "Original context",
    });
    await saveIntentPack(pack, "Test pack for context edit", "Original context", srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    await page.click("#editContextBtn");
    await page.waitForSelector("#contextEditor", { state: "visible" });
    await page.fill("#contextEditInput", "Updated context from browser test");
    await page.click("#saveContextBtn");

    await page.waitForSelector("#contextEditor", { state: "hidden" });
    await expect(page.locator("#contextDisplay")).toHaveText("Updated context from browser test");
  } finally {
    await srv.close();
  }
});

// ── Edit notes ────────────────────────────────────────────────

test("edit notes saves and updates the display", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Test pack for notes edit" });
    await saveIntentPack(pack, "Test pack for notes edit", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    await page.click("#editNotesBtn");
    await page.waitForSelector("#notesEditor", { state: "visible" });
    await page.fill("#notesInput", "A note added from browser test");
    await page.click("#saveNotesBtn");

    await page.waitForSelector("#notesEditor", { state: "hidden" });
    await expect(page.locator("#notesDisplay")).toHaveText("A note added from browser test");
  } finally {
    await srv.close();
  }
});

// ── Tags add and remove ───────────────────────────────────────

test("adding a tag shows a chip; removing it hides the chip", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Test pack for tag operations" });
    await saveIntentPack(pack, "Test pack for tag operations", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // Add a tag
    await page.fill("#tagInput", "browser-test-tag");
    await page.click("#addTagBtn");
    await expect(page.locator(".tag-chip", { hasText: "browser-test-tag" })).toBeVisible();

    // Remove the tag
    await page.click("[aria-label='Remove tag browser-test-tag']");
    await expect(page.locator(".tag-chip", { hasText: "browser-test-tag" })).not.toBeVisible();
  } finally {
    await srv.close();
  }
});
