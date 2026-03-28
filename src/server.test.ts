import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler } from "./core/handler.js";
import { saveIntentPack } from "./core/intentPackStore.js";
import { generateIntentPack } from "./core/generateIntentPack.js";
// Spin up a real HTTP server against a temp data directory
async function withTestServer(
  fn: (baseUrl: string, dataDir: string) => Promise<void>
): Promise<void> {
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-server-test-"));
  try {
    const handler = createHandler(dataDir, tmpdir()); // publicDir unused in API tests
    const server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://localhost:${addr.port}`;
    try {
      await fn(baseUrl, dataDir);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err?: Error) => (err ? reject(err) : resolve()))
      );
    }
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}

async function fetchJson(
  url: string,
  options?: RequestInit
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, options);
  const body = await res.json();
  return { status: res.status, body };
}

// ── Export-issue route tests ──────────────────────────────────

test("POST /api/intent-pack/export-issue with a valid goal returns markdown and pack", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-pack/export-issue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "Add role checks without breaking auth" })
      }
    );

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.ok(typeof b["markdown"] === "string", "response should have a markdown string");
    assert.match(b["markdown"] as string, /## Objective/);
    assert.ok(b["pack"] !== null && typeof b["pack"] === "object", "response should include the pack");
  });
});

test("POST /api/intent-pack/export-issue without a goal returns 400", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-pack/export-issue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }
    );

    assert.equal(status, 400);
    assert.equal((body as Record<string, string>)["error"], "goal is required");
  });
});

test("POST /api/intent-pack/export-issue with a whitespace-only goal returns 400", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-pack/export-issue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "   " })
      }
    );

    assert.equal(status, 400);
    assert.equal((body as Record<string, string>)["error"], "goal is required");
  });
});

test("GET /api/intent-packs/:id/export-issue returns markdown for an existing pack", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Test export flow" });
    const stored = await saveIntentPack(pack, "Test export flow", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/export-issue`
    );

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.ok(typeof b["markdown"] === "string", "response should have a markdown string");
    assert.match(b["markdown"] as string, /## Objective/);
  });
});

test("GET /api/intent-packs/:id/export-issue returns 404 for a valid-format uuid that does not exist", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/00000000-0000-0000-0000-000000000000/export-issue`
    );

    assert.equal(status, 404);
    assert.equal((body as Record<string, string>)["error"], "not found");
  });
});

test("GET /api/intent-packs/:id/export-issue returns 404 for an invalid id format", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/not-a-valid-uuid/export-issue`
    );

    assert.equal(status, 404);
    assert.equal((body as Record<string, string>)["error"], "not found");
  });
});

// ── Delete route tests ────────────────────────────────────────

test("DELETE /api/intent-packs/:id deletes an existing pack", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack to delete via HTTP" });
    const stored = await saveIntentPack(pack, "Pack to delete via HTTP", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      { method: "DELETE" }
    );

    assert.equal(status, 200);
    assert.equal((body as Record<string, unknown>)["ok"], true);
  });
});

test("DELETE /api/intent-packs/:id returns 404 for a valid-format uuid that does not exist", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/00000000-0000-0000-0000-000000000000`,
      { method: "DELETE" }
    );

    assert.equal(status, 404);
    assert.equal((body as Record<string, string>)["error"], "not found");
  });
});

test("DELETE /api/intent-packs/:id returns 404 for an invalid id format", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/not-a-valid-uuid`,
      { method: "DELETE" }
    );

    assert.equal(status, 404);
    assert.equal((body as Record<string, string>)["error"], "not found");
  });
});

test("list no longer includes a pack after it is deleted via HTTP", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack to remove from list" });
    const stored = await saveIntentPack(pack, "Pack to remove from list", undefined, dataDir);

    // Confirm present
    const before = await fetchJson(`${baseUrl}/api/intent-packs`);
    assert.equal((before.body as unknown[]).length, 1);

    // Delete
    await fetchJson(`${baseUrl}/api/intent-packs/${stored.id}`, { method: "DELETE" });

    // Confirm absent
    const after = await fetchJson(`${baseUrl}/api/intent-packs`);
    assert.equal((after.body as unknown[]).length, 0, "list should be empty after deletion");
  });
});
