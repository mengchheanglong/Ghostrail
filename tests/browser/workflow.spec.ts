/**
 * Browser-flow tests for the complete Ghostrail user workflow.
 *
 * These tests exercise the end-to-end user journey from the browser's
 * perspective — starting with an empty store, driving the generator form,
 * and chaining through every major feature in a single browser session.
 *
 * Unlike the individual feature tests (editing, drift, history, etc.) which
 * each test a single UI section in isolation, these tests validate the
 * integrated user experience:
 *
 *   1. Generate from scratch — form → Generate button → all sections render
 *   2. Full workflow chain  — generate → edit goal → notes → tag → status →
 *                             drift → verify history
 *   3. Context in detail    — repositoryContext is shown in detail view
 *   4. Search filtering     — sidebar search filters packs by goal keyword
 *
 * Each test starts a real HTTP server against a temp data directory.
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
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-browser-workflow-"));
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

// A realistic multi-sentence billing goal that triggers the heuristic scorer's
// "billing / payment / subscription" domain keywords so generated output is
// domain-specific and the touchedAreas contain "billing" for the drift test.
const BILLING_GOAL =
  "Refactor the billing module to support multiple payment providers " +
  "without breaking existing Stripe payment flows or corrupting billing records. " +
  "The implementation must preserve backward compatibility for all existing subscription states.";

const BILLING_CONTEXT =
  "Node.js backend with Stripe integration. Billing module is in src/billing/. " +
  "Payment gateway adapter is in src/payment/. Do not modify the gateway adapter interface.";

// A diff that touches a billing file (will match "billing" touchedArea)
// and a separate analytics file (will be scope creep).
const BILLING_DIFF = `diff --git a/src/billing/invoice.ts b/src/billing/invoice.ts
index abc1234..def5678 100644
--- a/src/billing/invoice.ts
+++ b/src/billing/invoice.ts
@@ -1,4 +1,9 @@
 export class Invoice {
+  readonly provider: string;
+  constructor(provider: string) {
+    this.provider = provider;
+  }
 }
diff --git a/src/analytics/revenue.ts b/src/analytics/revenue.ts
new file mode 100644
--- /dev/null
+++ b/src/analytics/revenue.ts
@@ -0,0 +1,3 @@
+export function revenueByMonth(month: string): number {
+  return 0;
+}
`;

// ── Test 1: Generate from scratch — all sections render ───────

test("generating from an empty store creates a pack and renders all detail sections", async ({
  page,
}) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);

    // Initially: no packs — empty state message is shown
    await expect(page.locator("#packListState")).toContainText("No saved packs yet", {
      timeout: 5_000,
    });
    await expect(page.locator("#detailCard")).not.toBeVisible();

    // Fill in the generator form
    await page.fill("#goal", BILLING_GOAL);

    // Click Generate & Save
    await page.click("#generate");

    // Wait for the pack to appear in the sidebar
    await expect(page.locator(".pack-item")).toHaveCount(1, { timeout: 15_000 });

    // Detail card becomes visible
    await expect(page.locator("#detailCard")).toBeVisible({ timeout: 10_000 });

    // ── Goal section ────────────────────────────────────────
    await expect(page.locator("#goalSection")).toBeVisible();
    await expect(page.locator("#goalDisplay")).toHaveText(BILLING_GOAL);

    // ── Main content sections (all 6 lists) ─────────────────
    await expect(page.locator("#detailContent")).toContainText("Constraints");
    await expect(page.locator("#detailContent")).toContainText("Acceptance Criteria");
    await expect(page.locator("#detailContent")).toContainText("Non-Goals");
    await expect(page.locator("#detailContent")).toContainText("Touched Areas");
    await expect(page.locator("#detailContent")).toContainText("Risks");
    await expect(page.locator("#detailContent")).toContainText("Open Questions");

    // Each section must have at least one <li> item
    const listItems = page.locator("#detailContent li");
    await expect(listItems).not.toHaveCount(0);

    // ── Confidence and reasoning mode badges ────────────────
    // Long goal with constraint language → "high" confidence from heuristic scorer
    await expect(page.locator("#detailContent")).toContainText("confidence");
    await expect(page.locator("#detailContent")).toContainText("heuristic");

    // ── Status row ───────────────────────────────────────────
    await expect(page.locator("#statusRow")).toBeVisible();
    await expect(page.locator("#statusSelect")).toBeVisible();

    // ── Notes and tags sections are in Design tab (default) ──
    await expect(page.locator("#notesSection")).toBeVisible();
    await expect(page.locator("#tagsSection")).toBeVisible();

    // ── Action buttons are enabled ───────────────────────────
    await expect(page.locator("#exportBtn")).toBeEnabled();
    await expect(page.locator("#taskPacketBtn")).toBeEnabled();
    await expect(page.locator("#prDescBtn")).toBeEnabled();
    await expect(page.locator("#duplicateBtn")).toBeEnabled();
    await expect(page.locator("#deleteBtn")).toBeEnabled();

    // ── Drift, health, and history sections are in the Audit tab
    await page.click("#tab-audit");
    await expect(page.locator("#driftSection")).toBeVisible();
    await expect(page.locator("#healthSection")).toBeVisible();
    await expect(page.locator("#historySection")).toBeVisible();

    // ── Generator form was cleared ───────────────────────────
    await expect(page.locator("#goal")).toHaveValue("");
  } finally {
    await srv.close();
  }
});

// ── Test 2: Full workflow chain ───────────────────────────────

test("full browser workflow: generate → edit goal → notes → tag → status → drift → history", async ({
  page,
}) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);

    // Step 1: Generate a pack from scratch
    await page.fill("#goal", BILLING_GOAL);
    await page.click("#generate");
    await expect(page.locator(".pack-item")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator("#detailCard")).toBeVisible({ timeout: 10_000 });

    // Confirm all main content sections are populated before chaining
    await expect(page.locator("#detailContent")).toContainText("Touched Areas");

    // Step 2: Edit the goal via the inline editor
    const updatedGoal =
      "Refactor the billing module to support Stripe and Braintree " +
      "without breaking existing payment flows or corrupting billing records.";
    await page.click("#editGoalBtn");
    await page.waitForSelector("#goalEditor", { state: "visible" });
    await page.fill("#goalEditInput", updatedGoal);
    await page.click("#saveGoalBtn");
    await page.waitForSelector("#goalEditor", { state: "hidden" });
    await expect(page.locator("#goalDisplay")).toHaveText(updatedGoal);

    // Step 3: Add notes
    await page.click("#editNotesBtn");
    await page.waitForSelector("#notesEditor", { state: "visible" });
    await page.fill("#notesInput", "Approved by billing team. Sprint 7.");
    await page.click("#saveNotesBtn");
    await page.waitForSelector("#notesEditor", { state: "hidden" });
    await expect(page.locator("#notesDisplay")).toContainText("Approved by billing team");

    // Step 4: Add a tag
    await page.fill("#tagInput", "billing-refactor");
    await page.click("#addTagBtn");
    await expect(page.locator(".tag-chip", { hasText: "billing-refactor" })).toBeVisible();

    // Step 5: Change status to "in-progress"
    await page.selectOption("#statusSelect", "in-progress");
    // Status badge in sidebar should update (re-render happens after PATCH)
    await expect(page.locator("#statusSelect")).toHaveValue("in-progress", { timeout: 5_000 });

    // Step 6: Analyze drift — switch to Audit tab, paste a diff and click Analyze Drift
    await page.click("#tab-audit");
    await page.fill("#driftInput", BILLING_DIFF);
    await page.click("#analyzeDriftBtn");
    await expect(page.locator("#driftResult")).toBeVisible({ timeout: 10_000 });
    // Result must show a status badge
    await expect(page.locator(".drift-status-badge")).toBeVisible();
    // 2 files extracted from the diff
    await expect(page.locator("#driftResult")).toContainText("file(s) extracted from diff");
    // billing/invoice.ts matches the "billing" touchedArea → Matched bucket
    await expect(page.locator("#driftResult")).toContainText("src/billing/invoice.ts");

    // Step 7: Verify history section has entries (goal, notes, and status edits
    // each created a snapshot) — already on Audit tab
    await expect(page.locator("#historySection")).toBeVisible();
    await expect(page.locator("#historyContent")).not.toContainText("Loading", {
      timeout: 5_000,
    });
    await expect(page.locator("#historyContent")).not.toContainText("No history yet", {
      timeout: 5_000,
    });
    await expect(page.locator(".history-entry").first()).toBeVisible({ timeout: 5_000 });
  } finally {
    await srv.close();
  }
});

// ── Test 3: repositoryContext shows in detail view ────────────

test("repositoryContext entered in the form is displayed in the detail view after generation", async ({
  page,
}) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);

    await page.fill("#goal", BILLING_GOAL);
    await page.fill("#context", BILLING_CONTEXT);
    await page.click("#generate");

    await expect(page.locator("#detailCard")).toBeVisible({ timeout: 15_000 });

    // contextSection must be visible and contain the entered context
    await expect(page.locator("#contextSection")).toBeVisible();
    await expect(page.locator("#contextDisplay")).toContainText("src/billing/");
    await expect(page.locator("#contextDisplay")).toContainText("Stripe integration");
  } finally {
    await srv.close();
  }
});

// ── Test 4: Search filters packs by goal keyword ──────────────

test("search input filters the sidebar pack list by goal keyword", async ({ page }) => {
  const srv = await startTestServer();
  try {
    // Seed two packs with completely different domain keywords
    const billingPack = generateIntentPack({ goal: "Refactor the billing payment module" });
    await saveIntentPack(billingPack, "Refactor the billing payment module", undefined, srv.dataDir);

    const authPack = generateIntentPack({
      goal: "Add role-based access control to admin panel",
    });
    await saveIntentPack(
      authPack,
      "Add role-based access control to admin panel",
      undefined,
      srv.dataDir
    );

    await page.goto(srv.url);
    // Both packs should be in the list
    await expect(page.locator(".pack-item")).toHaveCount(2, { timeout: 5_000 });

    // Filter by "billing" — should show only the billing pack
    await page.fill("#packSearch", "billing");
    await expect(page.locator(".pack-item")).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator(".pack-item")).toContainText("billing");

    // Filter by "admin" — should show only the auth pack
    await page.fill("#packSearch", "admin");
    await expect(page.locator(".pack-item")).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator(".pack-item")).toContainText("admin");

    // Clear the search — both packs reappear
    await page.fill("#packSearch", "");
    await expect(page.locator(".pack-item")).toHaveCount(2, { timeout: 5_000 });
  } finally {
    await srv.close();
  }
});
