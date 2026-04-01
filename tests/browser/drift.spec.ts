/**
 * Browser-flow tests for the Drift Analysis section in the detail view:
 *   - Drift section is visible when a pack is selected
 *   - Pasting a diff and clicking Analyze Drift shows a result
 *   - Empty textarea shows a "No diff" prompt instead of calling the server
 *   - A diff with matched and unexpected files renders the correct buckets
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
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-browser-drift-"));
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

// A minimal diff touching only billing files (matches the "billing" touchedArea).
const BILLING_DIFF = `diff --git a/src/billing/invoice.ts b/src/billing/invoice.ts
index abc..def 100644
--- a/src/billing/invoice.ts
+++ b/src/billing/invoice.ts
@@ -1 +1,2 @@
 export class Invoice {}
+export class Invoice2 {}
`;

// A diff with a billing file (matched) plus a dashboard file (scope creep).
const MIXED_DIFF = `diff --git a/src/billing/invoice.ts b/src/billing/invoice.ts
index abc..def 100644
--- a/src/billing/invoice.ts
+++ b/src/billing/invoice.ts
@@ -1 +1,2 @@
 export class Invoice {}
+export class Invoice2 {}
diff --git a/src/dashboard/analytics.ts b/src/dashboard/analytics.ts
new file mode 100644
--- /dev/null
+++ b/src/dashboard/analytics.ts
@@ -0,0 +1 @@
+export function track() {}
`;

// ── Drift section visibility ──────────────────────────────────

test("drift section is visible when a pack is selected", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Add billing invoice support" });
    await saveIntentPack(pack, "Add billing invoice support", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // Drift section is in the Audit tab
    await page.click("#tab-audit");

    await expect(page.locator("#driftSection")).toBeVisible();
    await expect(page.locator("#analyzeDriftBtn")).toBeVisible();
    await expect(page.locator("#driftInput")).toBeVisible();
  } finally {
    await srv.close();
  }
});

// ── Empty diff shows prompt ───────────────────────────────────

test("clicking Analyze Drift with empty textarea shows a no-diff prompt", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Add billing invoice support" });
    await saveIntentPack(pack, "Add billing invoice support", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // Drift section is in the Audit tab
    await page.click("#tab-audit");

    // Do not paste anything — click the button with an empty textarea
    await page.click("#analyzeDriftBtn");

    await expect(page.locator("#driftResult")).toBeVisible();
    await expect(page.locator("#driftResult")).toContainText("Paste a git diff");
  } finally {
    await srv.close();
  }
});

// ── Clean-path diff produces a result ────────────────────────

test("pasting a matching diff and clicking Analyze Drift renders a result", async ({ page }) => {
  const srv = await startTestServer();
  try {
    const pack = generateIntentPack({ goal: "Add billing invoice support" });
    await saveIntentPack(pack, "Add billing invoice support", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // Drift section is in the Audit tab
    await page.click("#tab-audit");

    await page.fill("#driftInput", BILLING_DIFF);
    await page.click("#analyzeDriftBtn");

    // Result container becomes visible
    await expect(page.locator("#driftResult")).toBeVisible({ timeout: 10_000 });

    // Should show a status badge (any valid status is acceptable for this test)
    await expect(page.locator(".drift-status-badge")).toBeVisible();

    // The result should mention the extracted file count
    await expect(page.locator("#driftResult")).toContainText("file(s) extracted from diff");
  } finally {
    await srv.close();
  }
});

// ── Mixed diff shows scope-creep bucket ──────────────────────

test("diff with unexpected files renders scope-creep bucket in result", async ({ page }) => {
  const srv = await startTestServer();
  try {
    // "billing" goal → touchedAreas: ["billing"]; dashboard file will be scope creep
    const pack = generateIntentPack({ goal: "Add billing invoice support" });
    await saveIntentPack(pack, "Add billing invoice support", undefined, srv.dataDir);

    await page.goto(srv.url);
    await page.waitForSelector("#detailCard", { state: "visible" });

    // Drift section is in the Audit tab
    await page.click("#tab-audit");

    await page.fill("#driftInput", MIXED_DIFF);
    await page.click("#analyzeDriftBtn");

    await expect(page.locator("#driftResult")).toBeVisible({ timeout: 10_000 });

    // Scope-creep bucket lists the unexpected dashboard file
    await expect(page.locator("#driftResult")).toContainText("Unexpected");
    await expect(page.locator("#driftResult")).toContainText("src/dashboard/analytics.ts");
  } finally {
    await srv.close();
  }
});
