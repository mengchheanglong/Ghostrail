import test from "node:test";
import assert from "node:assert/strict";
import { scoreGoalQuality } from "./core/goalQualityScore.js";

// ── Empty input ─────────────────────────────────────────────

test("scoreGoalQuality: returns score 0 and level vague for empty string", () => {
  const result = scoreGoalQuality("");
  assert.equal(result.score, 0);
  assert.equal(result.level, "vague");
  assert.ok(result.suggestions.length > 0, "should suggest adding a description");
});

test("scoreGoalQuality: returns score 0 and level vague for whitespace-only string", () => {
  const result = scoreGoalQuality("   ");
  assert.equal(result.score, 0);
  assert.equal(result.level, "vague");
});

// ── Vague signals ────────────────────────────────────────────

test("scoreGoalQuality: penalises 'improve' in the goal", () => {
  const result = scoreGoalQuality("Improve the dashboard");
  assert.equal(result.level, "vague");
  assert.ok(
    result.suggestions.some(s => s.toLowerCase().includes("improve")),
    "should suggest replacing 'improve'"
  );
});

test("scoreGoalQuality: penalises 'refactor' in the goal", () => {
  const result = scoreGoalQuality("Refactor the auth module");
  assert.equal(result.level, "vague");
  assert.ok(result.suggestions.some(s => s.toLowerCase().includes("refactor")));
});

test("scoreGoalQuality: penalises vague 'fix things'", () => {
  const result = scoreGoalQuality("Fix things in the admin panel");
  assert.equal(result.level, "vague");
  assert.ok(result.suggestions.some(s => s.toLowerCase().includes("broken")));
});

test("scoreGoalQuality: penalises 'optimize'", () => {
  const result = scoreGoalQuality("Optimize the app");
  assert.ok(result.suggestions.some(s => s.toLowerCase().includes("metric")));
});

test("scoreGoalQuality: penalises 'make it better'", () => {
  const result = scoreGoalQuality("Make the UI better");
  assert.ok(result.suggestions.some(s => s.toLowerCase().includes("better")));
});

// ── Scope creep signals ──────────────────────────────────────

test("scoreGoalQuality: penalises 'and also'", () => {
  const result = scoreGoalQuality("Add subscription upgrade flow and also update the admin panel");
  assert.ok(result.suggestions.some(s => s.toLowerCase().includes("and also")));
});

test("scoreGoalQuality: penalises 'as well as'", () => {
  const result = scoreGoalQuality("Add user profiles as well as update billing logic");
  assert.ok(result.suggestions.some(s => s.toLowerCase().includes("as well as")));
});

// ── Constraint bonus ─────────────────────────────────────────

test("scoreGoalQuality: gives a bonus for 'do not break' constraint phrase", () => {
  const simple = scoreGoalQuality("Add billing upgrade flow");
  const withConstraint = scoreGoalQuality("Add billing upgrade flow but do not break existing subscriptions");
  assert.ok(withConstraint.score > simple.score, "constrained goal should score higher");
});

test("scoreGoalQuality: gives a bonus for 'preserve existing' phrase", () => {
  const withConstraint = scoreGoalQuality("Add user search feature and preserve existing admin behavior");
  const withoutConstraint = scoreGoalQuality("Add user search feature");
  assert.ok(withConstraint.score >= withoutConstraint.score);
});

// ── Specificity bonus ────────────────────────────────────────

test("scoreGoalQuality: gives a bonus for 'because' clause", () => {
  const withReason = scoreGoalQuality("Migrate logging to structured JSON because the current format breaks log aggregation");
  const withoutReason = scoreGoalQuality("Migrate logging to structured JSON");
  assert.ok(withReason.score > withoutReason.score);
});

test("scoreGoalQuality: gives a bonus for 'so that' clause", () => {
  const withPurpose = scoreGoalQuality("Add rate limiting to the API so that abuse is prevented");
  const withoutPurpose = scoreGoalQuality("Add rate limiting to the API");
  assert.ok(withPurpose.score > withoutPurpose.score);
});

// ── Length bonus/penalty ─────────────────────────────────────

test("scoreGoalQuality: gives a length bonus for goals over 80 characters", () => {
  const short = scoreGoalQuality("Add search feature");
  const long  = scoreGoalQuality("Add full-text search to the user list view so that admins can find accounts quickly without pagination");
  assert.ok(long.score > short.score);
});

test("scoreGoalQuality: penalises very short goals (under 20 chars)", () => {
  const short = scoreGoalQuality("Fix bug");
  assert.equal(short.level, "vague");
});

// ── Levels ───────────────────────────────────────────────────

test("scoreGoalQuality: returns level partial for moderate goals", () => {
  const result = scoreGoalQuality("Add a user search endpoint to the admin panel");
  assert.ok(["partial", "clear"].includes(result.level));
});

test("scoreGoalQuality: returns level clear for a well-specified goal", () => {
  const result = scoreGoalQuality(
    "Add subscription upgrade flow so that existing users can move from monthly to annual billing, " +
    "but do not break current billing behavior or affect existing subscriptions"
  );
  assert.equal(result.level, "clear");
});

test("scoreGoalQuality: returns no suggestions when level is clear", () => {
  const result = scoreGoalQuality(
    "Add subscription upgrade flow so that existing users can move from monthly to annual billing, " +
    "but do not break current billing behavior or affect existing subscriptions"
  );
  assert.equal(result.suggestions.length, 0);
});

// ── Score clamping ───────────────────────────────────────────

test("scoreGoalQuality: never returns a score below 0", () => {
  // Multiple vague signals stacked
  const result = scoreGoalQuality("improve refactor fix things enhance and also as well as make it better");
  assert.ok(result.score >= 0);
});

test("scoreGoalQuality: never returns a score above 100", () => {
  // Maximally constrained, specific, long goal
  const result = scoreGoalQuality(
    "Add a subscription upgrade path because the current flow is broken and existing users " +
    "cannot upgrade, preserve current billing behavior, keep backward compat, do not break payment flows, " +
    "so that users can self-serve upgrades when needed, only if the user is on a monthly plan"
  );
  assert.ok(result.score <= 100);
});
