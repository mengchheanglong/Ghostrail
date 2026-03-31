import test from "node:test";
import assert from "node:assert/strict";
import {
  HeuristicProvider,
  StubLlmProvider,
  OpenAiProvider,
  createProvider,
} from "./core/llmProvider.js";
import type { LlmProviderConfig } from "./core/llmProvider.js";

const sampleInput = {
  goal: "Add role-based access control to the admin panel",
  repositoryContext: "Node.js API with Express and a PostgreSQL database",
};

// ── HeuristicProvider ─────────────────────────────────────────────────────────

test("HeuristicProvider.generate returns reasoningMode heuristic", async () => {
  const provider = new HeuristicProvider();
  const pack = await provider.generate(sampleInput);
  assert.equal(pack.reasoningMode, "heuristic");
});

test("HeuristicProvider.generate returns a non-empty objective", async () => {
  const provider = new HeuristicProvider();
  const pack = await provider.generate(sampleInput);
  assert.ok(pack.objective.length > 0);
});

test("HeuristicProvider.generate returns acceptanceCriteria array", async () => {
  const provider = new HeuristicProvider();
  const pack = await provider.generate(sampleInput);
  assert.ok(Array.isArray(pack.acceptanceCriteria));
  assert.ok(pack.acceptanceCriteria.length > 0);
});

test("HeuristicProvider.generate returns constraints array", async () => {
  const provider = new HeuristicProvider();
  const pack = await provider.generate(sampleInput);
  assert.ok(Array.isArray(pack.constraints));
  assert.ok(pack.constraints.length > 0);
});

test("HeuristicProvider.generate returns risks array", async () => {
  const provider = new HeuristicProvider();
  const pack = await provider.generate(sampleInput);
  assert.ok(Array.isArray(pack.risks));
  assert.ok(pack.risks.length > 0);
});

// ── StubLlmProvider ───────────────────────────────────────────────────────────

test("StubLlmProvider.generate returns reasoningMode llm", async () => {
  const provider = new StubLlmProvider();
  const pack = await provider.generate(sampleInput);
  assert.equal(pack.reasoningMode, "llm");
});

test("StubLlmProvider.generate returns the goal as objective", async () => {
  const provider = new StubLlmProvider();
  const pack = await provider.generate(sampleInput);
  assert.equal(pack.objective, sampleInput.goal);
});

test("StubLlmProvider.generate returns non-empty acceptanceCriteria", async () => {
  const provider = new StubLlmProvider();
  const pack = await provider.generate(sampleInput);
  assert.ok(Array.isArray(pack.acceptanceCriteria));
  assert.ok(pack.acceptanceCriteria.length > 0);
});

test("StubLlmProvider.generate is deterministic for the same input", async () => {
  const provider = new StubLlmProvider();
  const first = await provider.generate(sampleInput);
  const second = await provider.generate(sampleInput);
  assert.deepEqual(first, second);
});

test("StubLlmProvider.generate reflects the provided goal in objective", async () => {
  const provider = new StubLlmProvider();
  const custom = { goal: "Migrate from MySQL to PostgreSQL", repositoryContext: "" };
  const pack = await provider.generate(custom);
  assert.equal(pack.objective, "Migrate from MySQL to PostgreSQL");
});

test("StubLlmProvider.generate trims whitespace from goal before setting objective", async () => {
  const provider = new StubLlmProvider();
  const pack = await provider.generate({ goal: "  Add dark mode  " });
  assert.equal(pack.objective, "Add dark mode");
});

// ── createProvider factory ────────────────────────────────────────────────────

test("createProvider({ type: heuristic }) returns HeuristicProvider instance", async () => {
  const provider = createProvider({ type: "heuristic" });
  assert.ok(provider instanceof HeuristicProvider);
});

test("createProvider({ type: stub }) returns StubLlmProvider instance", async () => {
  const provider = createProvider({ type: "stub" });
  assert.ok(provider instanceof StubLlmProvider);
});

test("createProvider heuristic produces reasoningMode heuristic", async () => {
  const provider = createProvider({ type: "heuristic" });
  const pack = await provider.generate(sampleInput);
  assert.equal(pack.reasoningMode, "heuristic");
});

test("createProvider stub produces reasoningMode llm", async () => {
  const provider = createProvider({ type: "stub" });
  const pack = await provider.generate(sampleInput);
  assert.equal(pack.reasoningMode, "llm");
});

test("createProvider exhaustiveness: throws for unknown type at runtime", () => {
  const badConfig = { type: "unknown" } as unknown as LlmProviderConfig;
  assert.throws(() => createProvider(badConfig), /Unknown provider type/);
});

// ── OpenAiProvider ────────────────────────────────────────────────────────────

function makeMockFetch(responseBody: Record<string, unknown>, status = 200): typeof fetch {
  return async () =>
    new Response(JSON.stringify(responseBody), {
      status,
      headers: { "content-type": "application/json" },
    });
}

const validOpenAiResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          objective: "Add role-based access control to the admin panel",
          nonGoals: ["Do not change the public API"],
          constraints: ["Must not break existing auth"],
          acceptanceCriteria: ["Admin can assign roles", "Role changes are logged"],
          touchedAreas: ["src/auth", "src/admin"],
          risks: ["Privilege escalation if misconfigured"],
          openQuestions: ["Which roles are needed initially?"],
          confidence: "high",
        }),
      },
    },
  ],
};

test("OpenAiProvider.generate returns reasoningMode llm", async () => {
  const provider = new OpenAiProvider("test-key", "gpt-4o", makeMockFetch(validOpenAiResponse));
  const pack = await provider.generate(sampleInput);
  assert.equal(pack.reasoningMode, "llm");
});

test("OpenAiProvider.generate returns parsed objective from model response", async () => {
  const provider = new OpenAiProvider("test-key", "gpt-4o", makeMockFetch(validOpenAiResponse));
  const pack = await provider.generate(sampleInput);
  assert.equal(pack.objective, "Add role-based access control to the admin panel");
});

test("OpenAiProvider.generate returns correct acceptanceCriteria array", async () => {
  const provider = new OpenAiProvider("test-key", "gpt-4o", makeMockFetch(validOpenAiResponse));
  const pack = await provider.generate(sampleInput);
  assert.deepEqual(pack.acceptanceCriteria, ["Admin can assign roles", "Role changes are logged"]);
});

test("OpenAiProvider.generate returns correct touchedAreas", async () => {
  const provider = new OpenAiProvider("test-key", "gpt-4o", makeMockFetch(validOpenAiResponse));
  const pack = await provider.generate(sampleInput);
  assert.deepEqual(pack.touchedAreas, ["src/auth", "src/admin"]);
});

test("OpenAiProvider.generate returns high confidence", async () => {
  const provider = new OpenAiProvider("test-key", "gpt-4o", makeMockFetch(validOpenAiResponse));
  const pack = await provider.generate(sampleInput);
  assert.equal(pack.confidence, "high");
});

test("OpenAiProvider.generate defaults confidence to medium when model omits it", async () => {
  const bodyWithoutConfidence = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            objective: "Test",
            nonGoals: ["x"],
            constraints: ["y"],
            acceptanceCriteria: ["z"],
            touchedAreas: ["a"],
            risks: ["b"],
            openQuestions: ["c"],
          }),
        },
      },
    ],
  };
  const provider = new OpenAiProvider("test-key", "gpt-4o", makeMockFetch(bodyWithoutConfidence));
  const pack = await provider.generate({ goal: "Test" });
  assert.equal(pack.confidence, "medium");
});

test("OpenAiProvider.generate throws on non-OK HTTP response", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response("Unauthorized", { status: 401 });
  const provider = new OpenAiProvider("bad-key", "gpt-4o", mockFetch);
  await assert.rejects(() => provider.generate(sampleInput), /OpenAI API error \(401\)/);
});

test("OpenAiProvider.generate throws when response content is missing", async () => {
  const emptyChoices = { choices: [{ message: {} }] };
  const provider = new OpenAiProvider("test-key", "gpt-4o", makeMockFetch(emptyChoices));
  await assert.rejects(() => provider.generate(sampleInput), /OpenAI response missing content/);
});

test("OpenAiProvider.generate throws when content is not valid JSON", async () => {
  const badJson = { choices: [{ message: { content: "not json at all" } }] };
  const provider = new OpenAiProvider("test-key", "gpt-4o", makeMockFetch(badJson));
  await assert.rejects(() => provider.generate(sampleInput), /OpenAI returned non-JSON content/);
});

test("OpenAiProvider.generate throws when objective field is missing", async () => {
  const missingObjective = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            nonGoals: ["x"], constraints: ["y"], acceptanceCriteria: ["z"],
            touchedAreas: ["a"], risks: ["b"], openQuestions: ["c"],
          }),
        },
      },
    ],
  };
  const provider = new OpenAiProvider("test-key", "gpt-4o", makeMockFetch(missingObjective));
  await assert.rejects(() => provider.generate(sampleInput), /objective/);
});

test("OpenAiProvider.generate includes repositoryContext in request when provided", async () => {
  let capturedBody: Record<string, unknown> = {};
  const captureFetch: typeof fetch = async (_url, init) => {
    const parsed = JSON.parse(init?.body as string) as { messages: Array<{ role: string; content: string }> };
    capturedBody = parsed as unknown as Record<string, unknown>;
    return new Response(JSON.stringify(validOpenAiResponse), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const provider = new OpenAiProvider("test-key", "gpt-4o", captureFetch);
  await provider.generate({ goal: "Add RBAC", repositoryContext: "Express + Postgres" });
  const messages = capturedBody["messages"] as Array<{ role: string; content: string }>;
  const userMsg = messages.find((m) => m.role === "user")?.content ?? "";
  assert.ok(userMsg.includes("Express + Postgres"), "repositoryContext should be in user message");
});

test("createProvider({ type: openai, apiKey }) returns OpenAiProvider instance", () => {
  const provider = createProvider({ type: "openai", apiKey: "test-key" });
  assert.ok(provider instanceof OpenAiProvider);
});

test("createProvider openai produces reasoningMode llm via mock fetch", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify(validOpenAiResponse), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  // Access private fetchFn via constructor injection for test
  const provider = new OpenAiProvider("test-key", "gpt-4o", mockFetch);
  const pack = await provider.generate(sampleInput);
  assert.equal(pack.reasoningMode, "llm");
});
