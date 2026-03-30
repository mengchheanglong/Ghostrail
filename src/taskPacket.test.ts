import test from "node:test";
import assert from "node:assert/strict";
import { toTaskPacketJson, toAgentPrompt } from "./core/taskPacket.js";
import type { StoredIntentPack } from "./core/types.js";

function basePack(overrides: Partial<StoredIntentPack> = {}): StoredIntentPack {
  return {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    createdAt: "2024-01-01T00:00:00.000Z",
    goal: "Add a dark mode toggle without breaking the existing theme system.",
    repositoryContext: "React frontend with a CSS variables theme layer.",
    objective: "Add a dark mode toggle without breaking the existing theme system.",
    nonGoals: ["Do not rewrite the theme system."],
    constraints: ["Preserve existing light mode behavior."],
    acceptanceCriteria: ["Dark mode toggles correctly.", "Light mode still works."],
    touchedAreas: ["theme", "settings"],
    risks: ["Theme regression could break all pages."],
    openQuestions: ["Should the preference be persisted to localStorage?"],
    confidence: "high",
    reasoningMode: "heuristic",
    ...overrides,
  };
}

// ── toTaskPacketJson ──────────────────────────────────────────

test("toTaskPacketJson includes all required fields", () => {
  const pack = basePack();
  const packet = toTaskPacketJson(pack);

  assert.equal(packet.schemaVersion, "1");
  assert.equal(packet.id, pack.id);
  assert.equal(packet.goal, pack.goal);
  assert.equal(packet.objective, pack.objective);
  assert.deepEqual(packet.constraints, pack.constraints);
  assert.deepEqual(packet.nonGoals, pack.nonGoals);
  assert.deepEqual(packet.acceptanceCriteria, pack.acceptanceCriteria);
  assert.deepEqual(packet.touchedAreas, pack.touchedAreas);
  assert.deepEqual(packet.risks, pack.risks);
  assert.deepEqual(packet.openQuestions, pack.openQuestions);
  assert.equal(packet.createdAt, pack.createdAt);
  assert.equal(packet.repositoryContext, pack.repositoryContext);
});

test("toTaskPacketJson uses objective as goal when goal is absent", () => {
  const { goal: _goal, ...packWithoutGoal } = basePack();
  const pack = packWithoutGoal as StoredIntentPack;
  const packet = toTaskPacketJson(pack);
  assert.equal(packet.goal, pack.objective);
});

test("toTaskPacketJson omits repositoryContext when not present", () => {
  const { repositoryContext: _rc, ...packWithoutCtx } = basePack();
  const pack = packWithoutCtx as StoredIntentPack;
  const packet = toTaskPacketJson(pack);
  assert.equal(Object.prototype.hasOwnProperty.call(packet, "repositoryContext"), false);
});

// ── toAgentPrompt ─────────────────────────────────────────────

test("toAgentPrompt is a non-empty string", () => {
  const pack = basePack();
  const prompt = toAgentPrompt(pack);
  assert.ok(typeof prompt === "string" && prompt.length > 0);
});

test("toAgentPrompt includes the task/goal", () => {
  const pack = basePack();
  const prompt = toAgentPrompt(pack);
  assert.ok(prompt.includes(pack.goal!));
});

test("toAgentPrompt includes the objective", () => {
  const pack = basePack();
  const prompt = toAgentPrompt(pack);
  assert.ok(prompt.includes(pack.objective));
});

test("toAgentPrompt includes all constraints", () => {
  const pack = basePack();
  const prompt = toAgentPrompt(pack);
  for (const c of pack.constraints) {
    assert.ok(prompt.includes(c), `Missing constraint: ${c}`);
  }
});

test("toAgentPrompt includes acceptance criteria as checklist items", () => {
  const pack = basePack();
  const prompt = toAgentPrompt(pack);
  for (const a of pack.acceptanceCriteria) {
    assert.ok(prompt.includes(`- [ ] ${a}`), `Missing checklist item: ${a}`);
  }
});

test("toAgentPrompt includes touched areas", () => {
  const pack = basePack();
  const prompt = toAgentPrompt(pack);
  for (const t of pack.touchedAreas) {
    assert.ok(prompt.includes(t), `Missing touched area: ${t}`);
  }
});

test("toAgentPrompt includes open questions", () => {
  const pack = basePack();
  const prompt = toAgentPrompt(pack);
  for (const q of pack.openQuestions) {
    assert.ok(prompt.includes(q), `Missing open question: ${q}`);
  }
});

test("toAgentPrompt includes repositoryContext when present", () => {
  const pack = basePack();
  const prompt = toAgentPrompt(pack);
  assert.ok(prompt.includes(pack.repositoryContext!));
});

test("toAgentPrompt omits repository context section when absent", () => {
  const { repositoryContext: _rc, ...packWithoutCtx } = basePack();
  const pack = packWithoutCtx as StoredIntentPack;
  const prompt = toAgentPrompt(pack);
  assert.ok(!prompt.includes("## Repository context"));
});

test("toAgentPrompt omits open questions section when list is empty", () => {
  const pack = basePack({ openQuestions: [] });
  const prompt = toAgentPrompt(pack);
  assert.ok(!prompt.includes("## Open questions"));
});

test("toAgentPrompt uses objective as task when goal is absent", () => {
  const { goal: _goal, ...packWithoutGoal } = basePack();
  const pack = packWithoutGoal as StoredIntentPack;
  const prompt = toAgentPrompt(pack);
  assert.ok(prompt.includes(pack.objective));
});

test("toAgentPrompt output is deterministic for the same input", () => {
  const pack = basePack();
  assert.equal(toAgentPrompt(pack), toAgentPrompt(pack));
});
