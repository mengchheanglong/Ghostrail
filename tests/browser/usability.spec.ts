/// <reference types="node" />

import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler } from "../../dist/core/handler.js";

const publicDir = join(process.cwd(), "public");
const DRAFT_GOAL_KEY = "ghostrail.generator.draft.goal";
const DRAFT_CONTEXT_KEY = "ghostrail.generator.draft.context";

interface TestServer {
  url: string;
  close: () => Promise<void>;
}

async function startTestServer(): Promise<TestServer> {
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-browser-usability-"));
  const handler = createHandler(dataDir, publicDir);
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as { port: number };
  const url = `http://localhost:${addr.port}`;
  const close = (): Promise<void> =>
    new Promise<void>((resolve, reject) =>
      server.close((err: Error | undefined) => (err ? reject(err) : resolve()))
    ).then(() => rm(dataDir, { recursive: true, force: true }));
  return { url, close };
}

test("goal example chips prefill the goal input", async ({ page }) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);

    await expect(page.locator("#goalExamples")).toBeVisible();
    await page.click("#goalExample-0");

    await expect(page.locator("#goal")).toHaveValue(
      "Add subscription upgrade flow without breaking existing billing behavior or admin permissions."
    );
    await expect(page.locator("#qualityBarWrap")).toBeVisible();
  } finally {
    await srv.close();
  }
});

test("Ctrl+Enter submits generation from the goal input", async ({ page }) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);

    const specificGoal =
      "Add subscription upgrade flow without breaking existing billing behavior. " +
      "Preserve backward compatibility for existing plans and admin permissions.";

    await page.fill("#goal", specificGoal);
    await page.press("#goal", "Control+Enter");

    await expect(page.locator(".pack-item")).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator("#detailCard")).toBeVisible();
  } finally {
    await srv.close();
  }
});

test("goal and context drafts are restored after page reload", async ({ page }) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);

    const draftGoal = "Add risk review checklist to deployment flow without changing current deploy approvals.";
    const draftContext = "Service runs on Node 22 with CI checks in .github/workflows/deploy.yml.";

    await page.fill("#goal", draftGoal);
    await page.fill("#context", draftContext);

    await page.reload();

    await expect(page.locator("#draftRestoredHint")).toBeVisible();
    await expect(page.locator("#goal")).toHaveValue(draftGoal);
    await expect(page.locator("#context")).toHaveValue(draftContext);
  } finally {
    await srv.close();
  }
});

test("draft storage is cleared after successful generation", async ({ page }) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);

    const specificGoal =
      "Add subscription upgrade flow without breaking existing billing behavior. " +
      "Preserve backward compatibility for existing plans and admin permissions.";

    await page.fill("#goal", specificGoal);
    await page.fill("#context", "Billing module in src/billing with Stripe adapter in src/payment.");
    await page.click("#generate");

    await expect(page.locator(".pack-item")).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator("#goal")).toHaveValue("");
    await expect(page.locator("#context")).toHaveValue("");

    const draftStorage = await page.evaluate(
      ({ goalKey, contextKey }) => ({
        goal: localStorage.getItem(goalKey),
        context: localStorage.getItem(contextKey),
      }),
      { goalKey: DRAFT_GOAL_KEY, contextKey: DRAFT_CONTEXT_KEY }
    );

    expect(draftStorage.goal).toBeNull();
    expect(draftStorage.context).toBeNull();
  } finally {
    await srv.close();
  }
});

test("clear draft button clears input values and stored draft", async ({ page }) => {
  const srv = await startTestServer();
  try {
    await page.goto(srv.url);

    await page.fill("#goal", "Draft goal for later");
    await page.fill("#context", "Draft context for later");

    await expect(page.locator("#clearDraftBtn")).toBeVisible();
    await page.click("#clearDraftBtn");

    await expect(page.locator("#goal")).toHaveValue("");
    await expect(page.locator("#context")).toHaveValue("");
    await expect(page.locator("#clearDraftBtn")).not.toBeVisible();

    await expect
      .poll(async () => {
        return page.evaluate(
          ({ goalKey, contextKey }) => ({
            goal: localStorage.getItem(goalKey),
            context: localStorage.getItem(contextKey),
          }),
          { goalKey: DRAFT_GOAL_KEY, contextKey: DRAFT_CONTEXT_KEY }
        );
      })
      .toEqual({ goal: null, context: null });
  } finally {
    await srv.close();
  }
});
