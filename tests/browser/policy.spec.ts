/**
 * Browser-flow tests for the Policy Warning UI (B-POLICY-2):
 *   - ⚠ badge appears in sidebar for packs with policy warnings
 *   - Status cannot be changed to "Approved" when warnings are unacknowledged
 *   - After acknowledging warnings the ⚠ badge disappears and Approved status is allowed
 *
 * Packs with policy warnings are seeded directly via saveIntentPack (policyWarnings param)
 * so these tests do not need a real ghostrail-policy.json on disk.
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
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-browser-policy-"));
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

const SAMPLE_WARNING = 'Protected area "billing" is in the touched areas. Ensure this change is explicitly reviewed.';

// ── Sidebar ⚠ indicator ───────────────────────────────────────

test("⚠ indicator appears in sidebar for a pack with unacknowledged policy warnings", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Billing refactor" });
    await saveIntentPack(pack, "Billing refactor", undefined, srv.dataDir, [SAMPLE_WARNING]);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // The sidebar list item should show the ⚠ policy warning indicator
    await expect(page.locator(".policy-warning-indicator")).toBeVisible();
  } finally {
    await srv.close();
  }
});

// ── Approve gate ──────────────────────────────────────────────

test("selecting Approved with unacknowledged warnings reverts the dropdown and shows an error", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Billing refactor" });
    await saveIntentPack(pack, "Billing refactor", undefined, srv.dataDir, [SAMPLE_WARNING]);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // The policy warnings section should be visible with the acknowledge button
    await expect(page.locator("#policyWarnings")).toBeVisible();
    await expect(page.locator("#acknowledgeWarningsBtn")).toBeVisible();

    // Attempt to change status to Approved
    await page.selectOption("#statusSelect", "approved");

    // The dropdown should revert to draft (or whatever the current status is)
    await expect(page.locator("#statusSelect")).toHaveValue("draft");

    // An error message about acknowledgement should appear
    await expect(page.locator("#exportStatus")).toContainText("Acknowledge policy warnings");
  } finally {
    await srv.close();
  }
});

// ── Acknowledge and approve flow ──────────────────────────────

test("after acknowledging warnings the ⚠ badge disappears and Approved status is allowed", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Billing refactor" });
    await saveIntentPack(pack, "Billing refactor", undefined, srv.dataDir, [SAMPLE_WARNING]);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // Confirm ⚠ badge is shown before acknowledgement
    await expect(page.locator(".policy-warning-indicator")).toBeVisible();

    // Click "Acknowledge Warnings"
    await page.click("#acknowledgeWarningsBtn");

    // The ack button should disappear
    await expect(page.locator("#acknowledgeWarningsBtn")).not.toBeVisible({ timeout: 5_000 });

    // The ⚠ sidebar badge should disappear
    await expect(page.locator(".policy-warning-indicator")).not.toBeVisible({ timeout: 5_000 });

    // Now changing status to Approved should succeed (no revert)
    await page.selectOption("#statusSelect", "approved");

    // Wait briefly for the async PATCH to complete
    await expect(page.locator("#statusSelect")).toHaveValue("approved", { timeout: 10_000 });
  } finally {
    await srv.close();
  }
});
