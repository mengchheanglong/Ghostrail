/**
 * Browser tests for the "Export All as JSON" button:
 *   - Button is not present when the store is empty
 *   - Button appears once packs exist
 *   - Clicking the button triggers a download whose filename and content match the saved packs
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

// Accept downloads so we can inspect the downloaded file content
test.use({ acceptDownloads: true });

const publicDir = join(process.cwd(), "public");

interface TestServer {
  url: string;
  dataDir: string;
  close: () => Promise<void>;
}

async function startTestServer(): Promise<TestServer> {
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-browser-export-json-"));
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

// ── Button visibility ─────────────────────────────────────────

test("export JSON button is not shown when the store is empty", async ({ page }) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);
    await expect(page.locator("#packListState")).toContainText("No saved packs yet", { timeout: 5_000 });
    await expect(page.locator("#exportAllJsonBtn")).not.toBeAttached();
  } finally {
    await srv.close();
  }
});

// ── Button present after packs added ──────────────────────────

test("export JSON button appears once packs exist", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Check export button visibility" }) as IntentPack;
    await saveIntentPack(pack, "Check export button visibility", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });
    await expect(page.locator("#exportAllJsonBtn")).toBeVisible();
  } finally {
    await srv.close();
  }
});

// ── Download content ─────────────────────────────────────────

test("clicking export JSON triggers a JSON download containing saved packs", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Pack to export as JSON" }) as IntentPack;
    await saveIntentPack(pack, "Pack to export as JSON", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#exportAllJsonBtn", { state: "visible" });

    // Start waiting for download before triggering the click
    const downloadPromise = page.waitForEvent("download");
    await page.click("#exportAllJsonBtn");
    const download = await downloadPromise;

    // Filename should match ghostrail-packs-YYYY-MM-DD.json
    expect(download.suggestedFilename()).toMatch(/^ghostrail-packs-\d{4}-\d{2}-\d{2}\.json$/);

    // Read download content and verify it contains the saved pack
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].goal).toBe("Pack to export as JSON");
  } finally {
    await srv.close();
  }
});
