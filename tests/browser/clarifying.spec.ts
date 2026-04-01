/**
 * Browser-flow tests for the pre-generation clarifying questions flow.
 *
 * The clarifying questions UI is only shown for "vague" quality goals
 * (quality score < 35). Tests use a reliably vague goal ("improve the UI")
 * to trigger the flow, and a fully-specified goal for the bypass path.
 *
 * Tests:
 *   1. Vague goal → Generate shows clarifying questions
 *   2. Answering questions → Generate creates a pack
 *   3. Skip questions → creates a pack without answering
 *   4. Edit goal → returns to input stage (questions hidden)
 *   5. Non-vague goal bypasses questions entirely
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
  close: () => Promise<void>;
}

async function startTestServer(): Promise<TestServer> {
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-browser-clarifying-"));
  const handler = createHandler(dataDir, publicDir);
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as { port: number };
  const url = `http://localhost:${addr.port}`;
  const close = (): Promise<void> =>
    new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    ).then(() => rm(dataDir, { recursive: true, force: true }));
  return { url, close };
}

// A reliably vague goal: "improve" triggers vague signal, short length triggers length penalty
// → score = 30 − 12 (improve) − 10 (length < 20) = 8 → "vague"
const VAGUE_GOAL = "improve the UI";

// A fully-specified goal that scores "partial" (not "vague") → bypasses questions
const SPECIFIC_GOAL =
  "Add subscription upgrade flow without breaking existing billing flows. " +
  "The implementation must preserve backward compatibility for all subscription states.";

// ── Clarifying questions appear for vague goal ────────────────

test("vague goal: clicking Generate shows clarifying questions instead of generating immediately", async ({
  page,
}) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);

    await page.fill("#goal", VAGUE_GOAL);
    await page.click("#generate");

    // Questions section should appear
    await expect(page.locator("#clarifyingQuestions")).toBeVisible({
      timeout: 5_000,
    });

    // At least one answer textarea should be present
    await expect(page.locator("#clarifyingAnswer-0")).toBeVisible();

    // Skip and back buttons should be visible
    await expect(page.locator("#skipClarifyingBtn")).toBeVisible();
    await expect(page.locator("#backToInputBtn")).toBeVisible();

    // No pack should have been created yet
    await expect(page.locator(".pack-item")).toHaveCount(0);
  } finally {
    await srv.close();
  }
});

// ── Generate with answers creates a pack ─────────────────────

test("answering questions and clicking Generate creates a pack", async ({
  page,
}) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);

    await page.fill("#goal", VAGUE_GOAL);
    await page.click("#generate");

    // Wait for questions to appear
    await expect(page.locator("#clarifyingQuestions")).toBeVisible({
      timeout: 5_000,
    });

    // Fill in the first answer
    await page.fill("#clarifyingAnswer-0", "Only the header navigation component");

    // Click Generate
    await page.click("#generate");

    // Pack should be created
    await expect(page.locator(".pack-item")).toHaveCount(1, {
      timeout: 15_000,
    });

    // Questions section should be gone after successful generation
    await expect(page.locator("#clarifyingQuestions")).not.toBeVisible();
  } finally {
    await srv.close();
  }
});

// ── Skip questions ────────────────────────────────────────────

test("clicking Skip questions creates a pack without filling answers", async ({
  page,
}) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);

    await page.fill("#goal", VAGUE_GOAL);
    await page.click("#generate");

    // Wait for questions
    await expect(page.locator("#clarifyingQuestions")).toBeVisible({
      timeout: 5_000,
    });

    // Skip — do not fill any answers
    await page.click("#skipClarifyingBtn");

    // Pack should be created
    await expect(page.locator(".pack-item")).toHaveCount(1, {
      timeout: 15_000,
    });
  } finally {
    await srv.close();
  }
});

// ── Edit goal button returns to input ─────────────────────────

test("clicking Edit goal hides questions and returns to input stage", async ({
  page,
}) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);

    await page.fill("#goal", VAGUE_GOAL);
    await page.click("#generate");

    // Wait for questions
    await expect(page.locator("#clarifyingQuestions")).toBeVisible({
      timeout: 5_000,
    });

    // Go back to edit the goal
    await page.click("#backToInputBtn");

    // Questions should be hidden
    await expect(page.locator("#clarifyingQuestions")).not.toBeVisible();

    // Goal textarea should be editable and retain its value
    await expect(page.locator("#goal")).toHaveValue(VAGUE_GOAL);

    // Skip/Back buttons should be hidden
    await expect(page.locator("#skipClarifyingBtn")).not.toBeVisible();
    await expect(page.locator("#backToInputBtn")).not.toBeVisible();

    // Still no packs created
    await expect(page.locator(".pack-item")).toHaveCount(0);
  } finally {
    await srv.close();
  }
});

// ── Non-vague goal bypasses questions ─────────────────────────

test("specific goal bypasses clarifying questions and generates directly", async ({
  page,
}) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);

    await page.fill("#goal", SPECIFIC_GOAL);
    await page.click("#generate");

    // Questions should never appear
    // Pack should be created directly
    await expect(page.locator(".pack-item")).toHaveCount(1, {
      timeout: 15_000,
    });

    // Clarifying questions section should not be present
    await expect(page.locator("#clarifyingQuestions")).not.toBeVisible();
  } finally {
    await srv.close();
  }
});
