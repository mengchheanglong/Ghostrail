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

// ── PATCH notes and tags route tests ─────────────────────────

test("PATCH /api/intent-packs/:id updates notes on an existing pack", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack for notes patch" });
    const stored = await saveIntentPack(pack, "Pack for notes patch", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Reviewed and approved." })
      }
    );

    assert.equal(status, 200);
    assert.equal((body as Record<string, unknown>)["notes"], "Reviewed and approved.");
  });
});

test("PATCH /api/intent-packs/:id updates tags on an existing pack", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack for tags patch" });
    const stored = await saveIntentPack(pack, "Pack for tags patch", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: ["billing", "urgent"] })
      }
    );

    assert.equal(status, 200);
    assert.deepEqual((body as Record<string, unknown>)["tags"], ["billing", "urgent"]);
  });
});

test("PATCH /api/intent-packs/:id normalizes tags (trim, dedup, filter empty)", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Tag normalization test" });
    const stored = await saveIntentPack(pack, "Tag normalization test", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: ["  billing  ", "", "BILLING", "urgent"] })
      }
    );

    assert.equal(status, 200);
    const tags = (body as Record<string, unknown>)["tags"] as string[];
    assert.equal(tags.length, 2, "should have 2 unique tags after dedup");
    assert.equal(tags[0], "billing", "first tag should be trimmed");
    assert.equal(tags[1], "urgent");
  });
});

test("PATCH /api/intent-packs/:id returns 400 for non-string notes", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Bad notes type" });
    const stored = await saveIntentPack(pack, "Bad notes type", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: 42 })
      }
    );

    assert.equal(status, 400);
    assert.equal((body as Record<string, string>)["error"], "notes must be a string");
  });
});

test("PATCH /api/intent-packs/:id returns 400 for non-array tags", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Bad tags type" });
    const stored = await saveIntentPack(pack, "Bad tags type", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: "not-an-array" })
      }
    );

    assert.equal(status, 400);
    assert.equal((body as Record<string, string>)["error"], "tags must be an array of strings");
  });
});

test("PATCH /api/intent-packs/:id returns 404 for a non-existent valid-format uuid", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/00000000-0000-0000-0000-000000000000`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "hi" })
      }
    );

    assert.equal(status, 404);
    assert.equal((body as Record<string, string>)["error"], "not found");
  });
});

// ── Duplicate route tests ────────────────────────────────────

test("POST /api/intent-packs/:id/duplicate creates a new pack with preserved content", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack to duplicate via HTTP" });
    const stored = await saveIntentPack(pack, "Pack to duplicate via HTTP", "Some context", dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/duplicate`,
      { method: "POST" }
    );

    assert.equal(status, 200);
    const dup = body as Record<string, unknown>;
    assert.ok(typeof dup["id"] === "string", "duplicate should have an id");
    assert.notEqual(dup["id"], stored.id, "duplicate id must differ from original");
    assert.equal(dup["goal"], stored.goal, "goal should be preserved");
    assert.equal(dup["repositoryContext"], stored.repositoryContext, "repositoryContext should be preserved");
    assert.equal(dup["objective"], stored.objective, "objective should be preserved");
  });
});

test("POST /api/intent-packs/:id/duplicate also copies notes and tags", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack with notes and tags to duplicate" });
    const stored = await saveIntentPack(pack, "Pack with notes and tags to duplicate", undefined, dataDir);

    await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Keep this note", tags: ["copy-me"] })
      }
    );

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/duplicate`,
      { method: "POST" }
    );

    assert.equal(status, 200);
    const dup = body as Record<string, unknown>;
    assert.equal(dup["notes"], "Keep this note", "notes should be preserved in duplicate");
    assert.deepEqual(dup["tags"], ["copy-me"], "tags should be preserved in duplicate");
  });
});

test("POST /api/intent-packs/:id/duplicate returns 404 for a non-existent valid-format uuid", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/00000000-0000-0000-0000-000000000000/duplicate`,
      { method: "POST" }
    );

    assert.equal(status, 404);
    assert.equal((body as Record<string, string>)["error"], "not found");
  });
});

test("POST /api/intent-packs/:id/duplicate leaves the original unchanged", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Original must not change" });
    const stored = await saveIntentPack(pack, "Original must not change", undefined, dataDir);

    await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/duplicate`,
      { method: "POST" }
    );

    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs/${stored.id}`);
    assert.equal(status, 200);
    assert.equal((body as Record<string, unknown>)["id"], stored.id, "original id unchanged");
  });
});
