import test from "node:test";
import assert from "node:assert/strict";
import { toPrDescription } from "./core/prDescription.js";
import type { StoredIntentPack } from "./core/types.js";

function basePack(overrides: Partial<StoredIntentPack> = {}): StoredIntentPack {
  return {
    id: "aaaaaaaa-0000-0000-0000-000000000002",
    createdAt: "2024-01-01T00:00:00.000Z",
    goal: "Add dark mode without breaking the light theme.",
    repositoryContext: "React frontend with CSS variables theming.",
    objective: "Add dark mode without breaking the light theme.",
    nonGoals: ["Do not rewrite the theme system."],
    constraints: ["Preserve light mode behavior."],
    acceptanceCriteria: ["Dark mode toggles correctly.", "Light mode still works."],
    touchedAreas: ["theme", "settings"],
    risks: ["Theme regression."],
    openQuestions: ["Persist preference to localStorage?"],
    confidence: "high",
    reasoningMode: "heuristic",
    ...overrides,
  };
}

test("toPrDescription returns a non-empty string", () => {
  assert.ok(typeof toPrDescription(basePack()) === "string");
  assert.ok(toPrDescription(basePack()).length > 0);
});

test("toPrDescription includes the goal as a heading", () => {
  const pack = basePack();
  const md = toPrDescription(pack);
  assert.ok(md.includes(pack.goal!));
});

test("toPrDescription includes acceptance criteria as checklist", () => {
  const pack = basePack();
  const md = toPrDescription(pack);
  for (const a of pack.acceptanceCriteria) {
    assert.ok(md.includes(`- [ ] ${a}`), `Missing criterion: ${a}`);
  }
});

test("toPrDescription includes touched areas", () => {
  const pack = basePack();
  const md = toPrDescription(pack);
  for (const t of pack.touchedAreas) {
    assert.ok(md.includes(t), `Missing touched area: ${t}`);
  }
});

test("toPrDescription includes constraints", () => {
  const pack = basePack();
  const md = toPrDescription(pack);
  for (const c of pack.constraints) {
    assert.ok(md.includes(c), `Missing constraint: ${c}`);
  }
});

test("toPrDescription includes non-goals", () => {
  const pack = basePack();
  const md = toPrDescription(pack);
  for (const n of pack.nonGoals) {
    assert.ok(md.includes(n), `Missing non-goal: ${n}`);
  }
});

test("toPrDescription includes risks", () => {
  const pack = basePack();
  const md = toPrDescription(pack);
  for (const r of pack.risks) {
    assert.ok(md.includes(r), `Missing risk: ${r}`);
  }
});

test("toPrDescription includes repositoryContext when present", () => {
  const pack = basePack();
  const md = toPrDescription(pack);
  assert.ok(md.includes(pack.repositoryContext!));
});

test("toPrDescription omits repositoryContext when absent", () => {
  const { repositoryContext: _rc, ...rest } = basePack();
  const pack = rest as StoredIntentPack;
  const md = toPrDescription(pack);
  assert.ok(!md.includes("## Repository context"));
});

test("toPrDescription includes notes when present", () => {
  const pack = basePack({ notes: "Spike needed for localStorage." });
  const md = toPrDescription(pack);
  assert.ok(md.includes("Spike needed for localStorage."));
});

test("toPrDescription omits notes section when absent", () => {
  const pack = basePack();
  const md = toPrDescription(pack);
  assert.ok(!md.includes("## Notes"));
});

test("toPrDescription includes pack id in footer", () => {
  const pack = basePack();
  const md = toPrDescription(pack);
  assert.ok(md.includes(pack.id));
});

test("toPrDescription output is deterministic", () => {
  const pack = basePack();
  assert.equal(toPrDescription(pack), toPrDescription(pack));
});
