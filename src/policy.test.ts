import test from "node:test";
import assert from "node:assert/strict";
import { applyPolicy, loadPolicy, resetPolicyCache } from "./core/policy.js";
import type { GhostrailPolicy } from "./core/policy.js";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── applyPolicy (pure function) ───────────────────────────────

test("applyPolicy returns no warnings for empty policy", () => {
  const policy: GhostrailPolicy = {};
  assert.deepEqual(applyPolicy(["billing"], policy), []);
});

test("applyPolicy returns warning when touchedArea matches a protectedArea", () => {
  const policy: GhostrailPolicy = { protectedAreas: ["billing"] };
  const warnings = applyPolicy(["billing", "dashboard"], policy);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0]!.includes("billing"));
});

test("applyPolicy matching is case-insensitive", () => {
  const policy: GhostrailPolicy = { protectedAreas: ["Billing"] };
  const warnings = applyPolicy(["billing"], policy);
  assert.equal(warnings.length, 1);
});

test("applyPolicy returns no warnings when touchedAreas don't match protectedAreas", () => {
  const policy: GhostrailPolicy = { protectedAreas: ["billing"] };
  const warnings = applyPolicy(["dashboard", "analytics"], policy);
  assert.deepEqual(warnings, []);
});

test("applyPolicy evaluates custom rules", () => {
  const policy: GhostrailPolicy = {
    rules: [
      { ifTouchedAreaIncludes: "auth", warn: "Authorization regression risk. Require security review." },
    ],
  };
  const warnings = applyPolicy(["auth", "settings"], policy);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0]!.includes("Authorization regression risk"));
});

test("applyPolicy deduplicates warnings", () => {
  const policy: GhostrailPolicy = {
    protectedAreas: ["auth"],
    rules: [
      { ifTouchedAreaIncludes: "auth", warn: "Auth needs review." },
    ],
  };
  // Both protected area and rule should fire, but dedup collapses exact duplicates
  const warnings = applyPolicy(["auth"], policy);
  assert.ok(warnings.length >= 1);
  const unique = new Set(warnings);
  assert.equal(unique.size, warnings.length, "Warnings must be unique");
});

test("applyPolicy returns empty array when no touched areas provided", () => {
  const policy: GhostrailPolicy = { protectedAreas: ["billing"] };
  assert.deepEqual(applyPolicy([], policy), []);
});

// ── loadPolicy ────────────────────────────────────────────────

test("loadPolicy returns null when policy file does not exist", async () => {
  resetPolicyCache();
  const policy = await loadPolicy("/tmp/ghostrail-nonexistent-policy-file.json");
  assert.equal(policy, null);
});

test("loadPolicy reads and parses a valid policy file", async () => {
  resetPolicyCache();
  const dir = await mkdtemp(join(tmpdir(), "ghostrail-policy-test-"));
  try {
    const policyPath = join(dir, "ghostrail-policy.json");
    const content: GhostrailPolicy = {
      protectedAreas: ["billing", "auth"],
      rules: [{ ifTouchedAreaIncludes: "schema", warn: "Schema changes need migration plan." }],
    };
    await writeFile(policyPath, JSON.stringify(content), "utf8");
    const loaded = await loadPolicy(policyPath);
    assert.ok(loaded !== null);
    assert.deepEqual(loaded!.protectedAreas, ["billing", "auth"]);
    assert.equal(loaded!.rules!.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadPolicy throws on malformed JSON", async () => {
  resetPolicyCache();
  const dir = await mkdtemp(join(tmpdir(), "ghostrail-policy-test-"));
  try {
    const policyPath = join(dir, "ghostrail-policy.json");
    await writeFile(policyPath, "{ invalid json", "utf8");
    await assert.rejects(async () => {
      await loadPolicy(policyPath);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
