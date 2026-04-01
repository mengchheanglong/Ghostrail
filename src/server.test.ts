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

// ── Clarify route tests ───────────────────────────────────────

test("POST /api/intent-pack/clarify returns clarifying questions for a vague goal", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-pack/clarify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "Add notifications" }),
      }
    );

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.ok(
      Array.isArray(b["clarifyingQuestions"]),
      "response should have clarifyingQuestions array"
    );
    assert.ok(
      (b["clarifyingQuestions"] as string[]).length > 0,
      "vague goal should yield at least one question"
    );
    assert.ok(
      (b["clarifyingQuestions"] as string[]).every((q) => typeof q === "string"),
      "all questions should be strings"
    );
  });
});

test("POST /api/intent-pack/clarify returns 0 questions for a fully-specified goal", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-pack/clarify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal:
            "Add subscription upgrade flow only for premium accounts " +
            "without breaking existing billing flows. Done when tests pass.",
        }),
      }
    );

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.deepStrictEqual(
      b["clarifyingQuestions"],
      [],
      "fully-specified goal should return empty questions array"
    );
  });
});

test("POST /api/intent-pack/clarify without goal returns 400", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-pack/clarify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    assert.equal(status, 400);
    assert.equal(
      (body as Record<string, string>)["error"],
      "goal is required"
    );
  });
});

test("POST /api/intent-pack with answers enriches context and returns a stored pack", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: "Add notifications",
        answers: [
          "Only for billing events",
          "Must not break existing email notifications",
        ],
      }),
    });

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.ok(typeof b["id"] === "string", "response should have id");
    assert.ok(
      typeof b["objective"] === "string",
      "response should have objective"
    );
    assert.ok(
      typeof b["createdAt"] === "string",
      "response should have createdAt"
    );
  });
});

test("POST /api/intent-pack with empty answers array behaves identically to no answers", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const noAnswers = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Add a dashboard widget" }),
    });
    const withEmpty = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Add a dashboard widget", answers: [] }),
    });
    assert.equal(noAnswers.status, 200);
    assert.equal(withEmpty.status, 200);
    // Both should produce stored packs with identical structure (objective matches goal)
    const a = noAnswers.body as Record<string, unknown>;
    const b = withEmpty.body as Record<string, unknown>;
    assert.equal(a["objective"], b["objective"]);
    void dataDir; // used only for server isolation
  });
});

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

// ── PATCH goal and repositoryContext route tests ──────────────

test("PATCH /api/intent-packs/:id updates goal on an existing pack", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Original goal text" });
    const stored = await saveIntentPack(pack, "Original goal text", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "Updated goal text" })
      }
    );

    assert.equal(status, 200);
    assert.equal((body as Record<string, unknown>)["goal"], "Updated goal text");
  });
});

test("PATCH /api/intent-packs/:id updates repositoryContext on an existing pack", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack for context update" });
    const stored = await saveIntentPack(pack, "Pack for context update", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryContext: "Node.js backend, no DB changes" })
      }
    );

    assert.equal(status, 200);
    assert.equal((body as Record<string, unknown>)["repositoryContext"], "Node.js backend, no DB changes");
  });
});

test("PATCH /api/intent-packs/:id trims goal and repositoryContext before storing", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack for trim test" });
    const stored = await saveIntentPack(pack, "Pack for trim test", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "  Trimmed goal  ", repositoryContext: "  Trimmed context  " })
      }
    );

    assert.equal(status, 200);
    assert.equal((body as Record<string, unknown>)["goal"], "Trimmed goal");
    assert.equal((body as Record<string, unknown>)["repositoryContext"], "Trimmed context");
  });
});

test("PATCH /api/intent-packs/:id with blank repositoryContext removes the field", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack to clear context" });
    const stored = await saveIntentPack(pack, "Pack to clear context", "Some context", dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryContext: "   " })
      }
    );

    assert.equal(status, 200);
    assert.equal((body as Record<string, unknown>)["repositoryContext"], undefined, "repositoryContext should be absent when set to blank");
  });
});

test("PATCH /api/intent-packs/:id rejects empty goal with 400", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack for empty goal test" });
    const stored = await saveIntentPack(pack, "Pack for empty goal test", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "" })
      }
    );

    assert.equal(status, 400);
    assert.equal((body as Record<string, string>)["error"], "goal must not be empty");
  });
});

test("PATCH /api/intent-packs/:id rejects whitespace-only goal with 400", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack for whitespace goal test" });
    const stored = await saveIntentPack(pack, "Pack for whitespace goal test", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "   " })
      }
    );

    assert.equal(status, 400);
    assert.equal((body as Record<string, string>)["error"], "goal must not be empty");
  });
});

test("PATCH /api/intent-packs/:id rejects non-string goal with 400", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack for bad goal type test" });
    const stored = await saveIntentPack(pack, "Pack for bad goal type test", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: 123 })
      }
    );

    assert.equal(status, 400);
    assert.equal((body as Record<string, string>)["error"], "goal must be a string");
  });
});

test("PATCH /api/intent-packs/:id rejects non-string repositoryContext with 400", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack for bad context type test" });
    const stored = await saveIntentPack(pack, "Pack for bad context type test", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryContext: 42 })
      }
    );

    assert.equal(status, 400);
    assert.equal((body as Record<string, string>)["error"], "repositoryContext must be a string");
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

// ── PATCH starred and archived route tests ───────────────────

test("PATCH /api/intent-packs/:id sets starred to true", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack to star via HTTP" });
    const stored = await saveIntentPack(pack, "Pack to star via HTTP", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: true })
      }
    );

    assert.equal(status, 200);
    assert.equal((body as Record<string, unknown>)["starred"], true);
  });
});

test("PATCH /api/intent-packs/:id sets archived to true", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack to archive via HTTP" });
    const stored = await saveIntentPack(pack, "Pack to archive via HTTP", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true })
      }
    );

    assert.equal(status, 200);
    assert.equal((body as Record<string, unknown>)["archived"], true);
  });
});

test("PATCH /api/intent-packs/:id returns 400 for non-boolean starred", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Bad starred type" });
    const stored = await saveIntentPack(pack, "Bad starred type", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: "yes" })
      }
    );

    assert.equal(status, 400);
    assert.equal((body as Record<string, string>)["error"], "starred must be a boolean");
  });
});

test("PATCH /api/intent-packs/:id returns 400 for non-boolean archived", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Bad archived type" });
    const stored = await saveIntentPack(pack, "Bad archived type", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: 1 })
      }
    );

    assert.equal(status, 400);
    assert.equal((body as Record<string, string>)["error"], "archived must be a boolean");
  });
});

// ── Task packet route tests ───────────────────────────────────

test("GET /api/intent-packs/:id/task-packet returns packet and prompt", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Add dark mode" });
    const stored = await saveIntentPack(pack, "Add dark mode", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/task-packet`
    );

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.ok(typeof b["prompt"] === "string" && (b["prompt"] as string).length > 0);
    const packet = b["packet"] as Record<string, unknown>;
    assert.equal(packet["schemaVersion"], "1");
    assert.equal(packet["id"], stored.id);
    assert.ok(typeof packet["goal"] === "string");
  });
});

test("GET /api/intent-packs/:id/task-packet returns 404 for unknown id", async () => {
  await withTestServer(async (baseUrl) => {
    const { status } = await fetchJson(
      `${baseUrl}/api/intent-packs/aaaaaaaa-0000-0000-0000-000000000099/task-packet`
    );
    assert.equal(status, 404);
  });
});

// ── PR description route tests ────────────────────────────────

test("GET /api/intent-packs/:id/pr-description returns markdown", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Add subscription feature" });
    const stored = await saveIntentPack(pack, "Add subscription feature", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/pr-description`
    );

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.ok(typeof b["markdown"] === "string" && (b["markdown"] as string).includes(stored.id));
  });
});

test("GET /api/intent-packs/:id/pr-description returns 404 for unknown id", async () => {
  await withTestServer(async (baseUrl) => {
    const { status } = await fetchJson(
      `${baseUrl}/api/intent-packs/aaaaaaaa-0000-0000-0000-000000000099/pr-description`
    );
    assert.equal(status, 404);
  });
});

// ── History route tests ───────────────────────────────────────

test("GET /api/intent-packs/:id/history returns empty array initially", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "New pack with no history" });
    const stored = await saveIntentPack(pack, "New pack with no history", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/history`
    );

    assert.equal(status, 200);
    assert.deepEqual(body, []);
  });
});

test("GET /api/intent-packs/:id/history returns snapshot after a PATCH", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Pack to edit" });
    const stored = await saveIntentPack(pack, "Pack to edit", undefined, dataDir);

    // Patch the goal
    await fetchJson(`${baseUrl}/api/intent-packs/${stored.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Updated goal" }),
    });

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/history`
    );

    assert.equal(status, 200);
    const history = body as { patchedAt: string; before: unknown }[];
    assert.equal(history.length, 1);
    assert.ok(typeof history[0]!.patchedAt === "string");
  });
});

// ── Link-PR route tests ───────────────────────────────────────

test("POST /api/intent-packs/:id/link-pr stores prUrl on the pack", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Implement payments" });
    const stored = await saveIntentPack(pack, "Implement payments", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/link-pr`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prUrl: "https://github.com/org/repo/pull/42",
          changedFiles: ["src/billing.ts", "src/payment.ts"],
        }),
      }
    );

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.equal(b["prLink"], "https://github.com/org/repo/pull/42");
    assert.deepEqual(b["changedFiles"], ["src/billing.ts", "src/payment.ts"]);
  });
});

test("POST /api/intent-packs/:id/link-pr returns 400 when prUrl is missing", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Link test" });
    const stored = await saveIntentPack(pack, "Link test", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/link-pr`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    assert.equal(status, 400);
    assert.ok(typeof (body as Record<string, unknown>)["error"] === "string");
  });
});

test("POST /api/intent-packs/:id/link-pr returns 404 for unknown id", async () => {
  await withTestServer(async (baseUrl) => {
    const { status } = await fetchJson(
      `${baseUrl}/api/intent-packs/aaaaaaaa-0000-0000-0000-000000000099/link-pr`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prUrl: "https://github.com/org/repo/pull/1" }),
      }
    );
    assert.equal(status, 404);
  });
});

// ── Drift report route tests ──────────────────────────────────

test("GET /api/intent-packs/:id/drift-report returns report with no PR initially", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Add feature" });
    const stored = await saveIntentPack(pack, "Add feature", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/drift-report`
    );

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.equal(b["packId"], stored.id);
    assert.equal(b["hasLinkedPr"], false);
    assert.ok(typeof b["summary"] === "string");
  });
});

test("GET /api/intent-packs/:id/drift-report returns 404 for unknown id", async () => {
  await withTestServer(async (baseUrl) => {
    const { status } = await fetchJson(
      `${baseUrl}/api/intent-packs/aaaaaaaa-0000-0000-0000-000000000099/drift-report`
    );
    assert.equal(status, 404);
  });
});

// ── Status PATCH tests ────────────────────────────────────────

test("PATCH /api/intent-packs/:id sets status to approved", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Status test" });
    const stored = await saveIntentPack(pack, "Status test", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      }
    );

    assert.equal(status, 200);
    assert.equal((body as Record<string, unknown>)["status"], "approved");
  });
});

test("PATCH /api/intent-packs/:id returns 400 for invalid status value", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Bad status test" });
    const stored = await saveIntentPack(pack, "Bad status test", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      }
    );

    assert.equal(status, 400);
    assert.ok(
      typeof (body as Record<string, unknown>)["error"] === "string" &&
      ((body as Record<string, unknown>)["error"] as string).includes("status must be one of")
    );
  });
});

// ── analyze-diff route tests ──────────────────────────────────

const SAMPLE_DIFF = `diff --git a/src/billing/invoice.ts b/src/billing/invoice.ts
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

test("POST /api/intent-packs/:id/analyze-diff parses diff and returns report", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Add billing feature" });
    const stored = await saveIntentPack(pack, "Add billing feature", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/analyze-diff`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diffText: SAMPLE_DIFF }),
      }
    );

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.ok(Array.isArray(b["changedFiles"]), "changedFiles should be an array");
    const changedFiles = b["changedFiles"] as string[];
    assert.ok(changedFiles.includes("src/billing/invoice.ts"), "should include billing file");
    assert.ok(changedFiles.includes("src/dashboard/analytics.ts"), "should include dashboard file");

    const report = b["report"] as Record<string, unknown>;
    assert.equal(report["packId"], stored.id);
    assert.ok(typeof report["status"] === "string");
    assert.ok(Array.isArray(report["matchedFiles"]));
    assert.ok(Array.isArray(report["scopeCreep"]));
    assert.ok(Array.isArray(report["intentGap"]));
  });
});

test("POST /api/intent-packs/:id/analyze-diff stores changedFiles so drift-report is populated", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Add billing feature" });
    const stored = await saveIntentPack(pack, "Add billing feature", undefined, dataDir);

    await fetchJson(`${baseUrl}/api/intent-packs/${stored.id}/analyze-diff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diffText: SAMPLE_DIFF }),
    });

    // After analyze-diff, GET drift-report should show data
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/drift-report`
    );
    assert.equal(status, 200);
    const report = body as Record<string, unknown>;
    assert.ok(Array.isArray(report["changedFiles"]));
    assert.ok((report["changedFiles"] as string[]).length > 0, "changedFiles should be non-empty");
    assert.ok(report["status"] !== "no-data", "status should not be no-data after analysis");
  });
});

test("POST /api/intent-packs/:id/analyze-diff accepts optional prUrl", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Link PR with diff" });
    const stored = await saveIntentPack(pack, "Link PR with diff", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/analyze-diff`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diffText: SAMPLE_DIFF,
          prUrl: "https://github.com/org/repo/pull/5",
        }),
      }
    );

    assert.equal(status, 200);
    const report = (body as Record<string, unknown>)["report"] as Record<string, unknown>;
    assert.equal(report["prLink"], "https://github.com/org/repo/pull/5");
    assert.equal(report["hasLinkedPr"], true);
  });
});

test("POST /api/intent-packs/:id/analyze-diff returns 400 when diffText is missing", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Missing diff" });
    const stored = await saveIntentPack(pack, "Missing diff", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/analyze-diff`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    assert.equal(status, 400);
    assert.ok(typeof (body as Record<string, unknown>)["error"] === "string");
  });
});

test("POST /api/intent-packs/:id/analyze-diff returns 404 for unknown id", async () => {
  await withTestServer(async (baseUrl) => {
    const { status } = await fetchJson(
      `${baseUrl}/api/intent-packs/aaaaaaaa-0000-0000-0000-000000000099/analyze-diff`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diffText: SAMPLE_DIFF }),
      }
    );
    assert.equal(status, 404);
  });
});

test("POST /api/intent-packs/:id/analyze-diff handles empty diff gracefully", async () => {
  await withTestServer(async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Empty diff" });
    const stored = await saveIntentPack(pack, "Empty diff", undefined, dataDir);

    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/analyze-diff`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diffText: "   " }),
      }
    );

    // Empty diff text is a valid (though uninteresting) request — 400 because it's whitespace-only
    assert.equal(status, 400);
  });
});

// ── LLM provider injection ────────────────────────────────────────────────────

import { StubLlmProvider } from "./core/llmProvider.js";

async function withStubProviderServer(
  fn: (baseUrl: string, dataDir: string) => Promise<void>
): Promise<void> {
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-stub-provider-test-"));
  try {
    const handler = createHandler(dataDir, tmpdir(), undefined, new StubLlmProvider());
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

test("POST /api/intent-pack with stub provider returns reasoningMode llm", async () => {
  await withStubProviderServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-pack`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "Add dark mode to the settings page" }),
      }
    );
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.equal(b["reasoningMode"], "llm");
  });
});

test("POST /api/intent-pack with stub provider still stores the pack", async () => {
  await withStubProviderServer(async (baseUrl, dataDir) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-pack`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "Enable two-factor authentication" }),
      }
    );
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.ok(typeof b["id"] === "string" && b["id"].length > 0);
    // Verify the pack was persisted
    const { status: getStatus, body: getBody } = await fetchJson(
      `${baseUrl}/api/intent-packs/${b["id"]}`
    );
    assert.equal(getStatus, 200);
    assert.equal((getBody as Record<string, unknown>)["reasoningMode"], "llm");
  });
});

test("POST /api/intent-pack/export-issue with stub provider returns reasoningMode llm in pack", async () => {
  await withStubProviderServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-pack/export-issue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "Migrate session storage to Redis" }),
      }
    );
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.equal((b["pack"] as Record<string, unknown>)["reasoningMode"], "llm");
    assert.ok(typeof b["markdown"] === "string");
  });
});

test("POST /api/intent-pack default (no provider) uses heuristic", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-pack`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "Add caching to the user profile endpoint" }),
      }
    );
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.equal(b["reasoningMode"], "heuristic");
  });
});

// ── create-github-issue route tests ──────────────────────────

async function withTestServerGithub(
  mockGithubFetch: typeof fetch,
  fn: (baseUrl: string, dataDir: string) => Promise<void>
): Promise<void> {
  const dataDir = await (await import("node:fs/promises")).mkdtemp(
    join(tmpdir(), "ghostrail-gh-test-")
  );
  try {
    const handler = createHandler(dataDir, tmpdir(), undefined, undefined, mockGithubFetch);
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
    await (await import("node:fs/promises")).rm(dataDir, { recursive: true, force: true });
  }
}

function makeGithubMockFetch(issueNumber: number, issueUrl: string): typeof fetch {
  return async () =>
    new Response(
      JSON.stringify({ html_url: issueUrl, number: issueNumber }),
      { status: 201, headers: { "content-type": "application/json" } }
    );
}

test("POST /api/intent-packs/:id/create-github-issue returns 400 when owner is missing", async () => {
  const mockFetch = makeGithubMockFetch(1, "https://github.com/o/r/issues/1");
  await withTestServerGithub(mockFetch, async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Add caching" });
    const stored = await saveIntentPack(pack, "Add caching", undefined, dataDir);
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/create-github-issue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: "myrepo" }),
      }
    );
    assert.equal(status, 400);
    assert.match((body as Record<string, string>)["error"], /owner/);
  });
});

test("POST /api/intent-packs/:id/create-github-issue returns 400 when repo is missing", async () => {
  const mockFetch = makeGithubMockFetch(1, "https://github.com/o/r/issues/1");
  await withTestServerGithub(mockFetch, async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Add caching" });
    const stored = await saveIntentPack(pack, "Add caching", undefined, dataDir);
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/create-github-issue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: "myorg" }),
      }
    );
    assert.equal(status, 400);
    assert.match((body as Record<string, string>)["error"], /repo/);
  });
});

test("POST /api/intent-packs/:id/create-github-issue returns 400 when token is not available", async () => {
  const mockFetch = makeGithubMockFetch(1, "https://github.com/o/r/issues/1");
  await withTestServerGithub(mockFetch, async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Add caching" });
    const stored = await saveIntentPack(pack, "Add caching", undefined, dataDir);
    // Ensure GITHUB_TOKEN is not set in the env for this request
    const savedToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    try {
      const { status, body } = await fetchJson(
        `${baseUrl}/api/intent-packs/${stored.id}/create-github-issue`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner: "myorg", repo: "myrepo" }),
        }
      );
      assert.equal(status, 400);
      assert.match((body as Record<string, string>)["error"], /token/i);
    } finally {
      if (savedToken !== undefined) process.env.GITHUB_TOKEN = savedToken;
    }
  });
});

test("POST /api/intent-packs/:id/create-github-issue returns 404 for unknown pack", async () => {
  const mockFetch = makeGithubMockFetch(1, "https://github.com/o/r/issues/1");
  await withTestServerGithub(mockFetch, async (baseUrl) => {
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/00000000-0000-0000-0000-000000000000/create-github-issue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: "o", repo: "r", token: "gh-token" }),
      }
    );
    assert.equal(status, 404);
    assert.equal((body as Record<string, string>)["error"], "not found");
  });
});

test("POST /api/intent-packs/:id/create-github-issue returns issueUrl and saves it on pack", async () => {
  const issueUrl = "https://github.com/myorg/myrepo/issues/99";
  const mockFetch = makeGithubMockFetch(99, issueUrl);
  await withTestServerGithub(mockFetch, async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Add role-based access control" });
    const stored = await saveIntentPack(pack, "Add role-based access control", undefined, dataDir);
    const { status, body } = await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/create-github-issue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: "myorg", repo: "myrepo", token: "gh-token" }),
      }
    );
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.equal(b["issueUrl"], issueUrl);
    assert.equal(b["issueNumber"], 99);
    const savedPack = b["pack"] as Record<string, unknown>;
    assert.equal(savedPack["githubIssueUrl"], issueUrl);
  });
});

test("POST /api/intent-packs/:id/create-github-issue persists githubIssueUrl to disk", async () => {
  const issueUrl = "https://github.com/acme/widget/issues/7";
  const mockFetch = makeGithubMockFetch(7, issueUrl);
  await withTestServerGithub(mockFetch, async (baseUrl, dataDir) => {
    const pack = generateIntentPack({ goal: "Migrate to PostgreSQL" });
    const stored = await saveIntentPack(pack, "Migrate to PostgreSQL", undefined, dataDir);
    await fetchJson(
      `${baseUrl}/api/intent-packs/${stored.id}/create-github-issue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: "acme", repo: "widget", token: "gh-token" }),
      }
    );
    // Re-fetch the pack to confirm persistence
    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs/${stored.id}`);
    assert.equal(status, 200);
    assert.equal((body as Record<string, unknown>)["githubIssueUrl"], issueUrl);
  });
});
