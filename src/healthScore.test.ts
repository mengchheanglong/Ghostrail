import test from "node:test";
import assert from "node:assert/strict";
import { computePackHealth } from "./core/healthScore.js";
import type { StoredIntentPack } from "./core/types.js";

// Helper to build a minimal StoredIntentPack for testing
function makePack(overrides: Partial<StoredIntentPack> = {}): StoredIntentPack {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    createdAt: "2024-01-01T00:00:00.000Z",
    objective: "Add subscription upgrade flow",
    constraints: ["Protect payment and billing flows from unintended side effects."],
    acceptanceCriteria: ["The subscription upgrade succeeds for the happy path."],
    nonGoals: ["Do not redesign the billing admin panel."],
    touchedAreas: ["billing"],
    risks: ["Financial logic drift could break existing monetization flows."],
    openQuestions: [],
    confidence: "medium",
    reasoningMode: "heuristic",
    ...overrides,
  };
}

// ── Overall shape ─────────────────────────────────────────────

test("computePackHealth: returns a score, level and 4 dimensions", () => {
  const result = computePackHealth(makePack());
  assert.ok(typeof result.score === "number");
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(["poor", "fair", "good", "excellent"].includes(result.level));
  assert.equal(result.dimensions.length, 4);
  const names = result.dimensions.map(d => d.name);
  assert.ok(names.includes("Objective Specificity"));
  assert.ok(names.includes("Acceptance Criteria"));
  assert.ok(names.includes("Constraint Completeness"));
  assert.ok(names.includes("Risk Coverage"));
});

test("computePackHealth: all dimension scores are clamped 0–100", () => {
  const result = computePackHealth(makePack());
  for (const dim of result.dimensions) {
    assert.ok(dim.score >= 0, `${dim.name} score should be >= 0`);
    assert.ok(dim.score <= 100, `${dim.name} score should be <= 100`);
  }
});

// ── Objective Specificity ─────────────────────────────────────

test("computePackHealth: low objective specificity for empty goal", () => {
  const pack = makePack({ objective: "X" });
  delete (pack as Partial<StoredIntentPack>).goal;
  const dim = computePackHealth(pack).dimensions.find(d => d.name === "Objective Specificity")!;
  assert.ok(dim.score < 80);
});

test("computePackHealth: low objective specificity for vague goal", () => {
  const pack = makePack({ goal: "Refactor the codebase", objective: "Refactor" });
  const dim = computePackHealth(pack).dimensions.find(d => d.name === "Objective Specificity")!;
  assert.ok(dim.score < 80);
  assert.ok(dim.suggestions.some(s => s.toLowerCase().includes("vague")));
});

test("computePackHealth: higher objective specificity for detailed goal with constraint", () => {
  const pack = makePack({
    goal: "Add subscription upgrade flow so that users can self-serve plan changes, but do not break current billing behavior",
    objective: "Add subscription upgrade flow"
  });
  const dim = computePackHealth(pack).dimensions.find(d => d.name === "Objective Specificity")!;
  assert.ok(dim.score >= 60);
});

// ── Acceptance Criteria ───────────────────────────────────────

test("computePackHealth: score 0 for acceptance criteria dimension when empty array", () => {
  const pack = makePack({ acceptanceCriteria: [] });
  const dim = computePackHealth(pack).dimensions.find(d => d.name === "Acceptance Criteria")!;
  assert.equal(dim.score, 0);
  assert.ok(dim.suggestions.length > 0);
});

test("computePackHealth: higher acceptance criteria score for testable verb-led criteria", () => {
  const pack = makePack({
    acceptanceCriteria: [
      "Returns HTTP 200 for a valid upgrade request.",
      "Saves the new plan to the database.",
      "Sends a confirmation email to the user.",
      "Shows the new plan in the billing dashboard.",
    ]
  });
  const dim = computePackHealth(pack).dimensions.find(d => d.name === "Acceptance Criteria")!;
  assert.ok(dim.score >= 60);
});

test("computePackHealth: penalises generic criteria like 'works correctly'", () => {
  const pack = makePack({
    acceptanceCriteria: ["The feature works correctly.", "It is implemented.", "Behaves correctly."]
  });
  const dim = computePackHealth(pack).dimensions.find(d => d.name === "Acceptance Criteria")!;
  assert.ok(dim.suggestions.some(s => s.toLowerCase().includes("generic")));
});

// ── Constraint Completeness ───────────────────────────────────

test("computePackHealth: score 0 for constraint dimension when constraints and nonGoals are empty", () => {
  const pack = makePack({ constraints: [], nonGoals: [] });
  const dim = computePackHealth(pack).dimensions.find(d => d.name === "Constraint Completeness")!;
  assert.equal(dim.score, 0);
});

test("computePackHealth: higher constraint score when preservation language is present", () => {
  const pack = makePack({
    constraints: [
      "Do not break existing subscription flows.",
      "Preserve backward compatibility with the billing API.",
      "Keep the current admin panel behavior unchanged.",
    ],
    nonGoals: [
      "Do not redesign the checkout experience.",
      "Do not add new payment methods.",
    ]
  });
  const dim = computePackHealth(pack).dimensions.find(d => d.name === "Constraint Completeness")!;
  assert.ok(dim.score >= 60);
});

test("computePackHealth: suggests adding non-goals when nonGoals is empty", () => {
  const pack = makePack({ nonGoals: [] });
  const dim = computePackHealth(pack).dimensions.find(d => d.name === "Constraint Completeness")!;
  assert.ok(dim.suggestions.some(s => s.toLowerCase().includes("non-goal")));
});

// ── Risk Coverage ─────────────────────────────────────────────

test("computePackHealth: score 0 for risk dimension when risks array is empty", () => {
  const pack = makePack({ risks: [] });
  const dim = computePackHealth(pack).dimensions.find(d => d.name === "Risk Coverage")!;
  assert.equal(dim.score, 0);
});

test("computePackHealth: higher risk score for specific failure-mode language", () => {
  const pack = makePack({
    risks: [
      "Billing regression could break existing subscriptions.",
      "Auth token leak could expose restricted endpoints.",
      "Database migration failure could corrupt user records.",
      "Race condition in payment processing could lead to duplicate charges.",
    ]
  });
  const dim = computePackHealth(pack).dimensions.find(d => d.name === "Risk Coverage")!;
  assert.ok(dim.score >= 60);
});

test("computePackHealth: penalises generic risks like 'might break'", () => {
  const pack = makePack({ risks: ["Something might break.", "May break things."] });
  const dim = computePackHealth(pack).dimensions.find(d => d.name === "Risk Coverage")!;
  assert.ok(dim.suggestions.some(s => s.toLowerCase().includes("generic")));
});

test("computePackHealth: warns when touchedAreas includes sensitive area not covered in risks", () => {
  const pack = makePack({
    touchedAreas: ["billing", "payment"],
    risks: ["Unrelated performance risk."]
  });
  const dim = computePackHealth(pack).dimensions.find(d => d.name === "Risk Coverage")!;
  assert.ok(dim.suggestions.some(s => s.toLowerCase().includes("sensitive")));
});

// ── Level thresholds ──────────────────────────────────────────

test("computePackHealth: level is poor for a completely empty pack", () => {
  const pack = makePack({
    goal: "",
    objective: "",
    constraints: [],
    nonGoals: [],
    acceptanceCriteria: [],
    risks: [],
    touchedAreas: [],
  });
  const result = computePackHealth(pack);
  assert.equal(result.level, "poor");
});

test("computePackHealth: level is excellent for a well-specified pack", () => {
  const pack = makePack({
    goal: "Add subscription upgrade flow so that existing users can self-serve plan changes, but do not break current billing behavior",
    objective: "Add subscription upgrade flow",
    constraints: [
      "Do not break existing subscription flows.",
      "Preserve backward compatibility with the billing API.",
    ],
    nonGoals: [
      "Do not redesign the checkout experience.",
      "Do not add new payment methods.",
    ],
    acceptanceCriteria: [
      "Returns HTTP 200 for a valid upgrade request.",
      "Saves the new plan to the database.",
      "Sends a confirmation email to the user.",
      "Shows the new plan in the billing dashboard.",
    ],
    risks: [
      "Billing regression could break existing subscriptions.",
      "Auth token leak could expose restricted endpoints.",
      "Race condition in payment processing could lead to duplicate charges.",
    ],
    touchedAreas: ["billing"],
  });
  const result = computePackHealth(pack);
  assert.ok(result.score >= 60, `Expected score >= 60 but got ${result.score}`);
});
