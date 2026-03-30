import test from "node:test";
import assert from "node:assert/strict";
import {
  HeuristicProvider,
  StubLlmProvider,
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
