import test from "node:test";
import assert from "node:assert/strict";
import { computeDriftReport } from "./core/driftReport.js";
import type { StoredIntentPack } from "./core/types.js";

function basePack(overrides: Partial<StoredIntentPack> = {}): StoredIntentPack {
  return {
    id: "aaaaaaaa-0000-0000-0000-000000000003",
    createdAt: "2024-01-01T00:00:00.000Z",
    goal: "Add payment feature.",
    objective: "Add payment feature.",
    nonGoals: [],
    constraints: [],
    acceptanceCriteria: [],
    touchedAreas: ["billing", "payment", "auth"],
    risks: [],
    openQuestions: [],
    confidence: "medium",
    reasoningMode: "heuristic",
    ...overrides,
  };
}

test("computeDriftReport with no PR linked returns no-pr summary", () => {
  const pack = basePack();
  const report = computeDriftReport(pack);
  assert.equal(report.packId, pack.id);
  assert.equal(report.prLink, null);
  assert.equal(report.hasLinkedPr, false);
  assert.deepEqual(report.scopeCreep, []);
  assert.ok(report.summary.includes("No PR linked"));
});

test("computeDriftReport with PR link but no changedFiles returns pr-linked-no-files summary", () => {
  const pack = basePack({ prLink: "https://github.com/org/repo/pull/1" });
  const report = computeDriftReport(pack);
  assert.equal(report.prLink, "https://github.com/org/repo/pull/1");
  assert.equal(report.hasLinkedPr, true);
  assert.deepEqual(report.scopeCreep, []);
  assert.ok(report.summary.includes("no changed files"));
});

test("computeDriftReport detects no drift when files match touchedAreas", () => {
  const pack = basePack({
    prLink: "https://github.com/org/repo/pull/1",
    changedFiles: ["src/billing/invoice.ts", "src/payment/processor.ts", "src/auth/middleware.ts"],
  });
  const report = computeDriftReport(pack);
  assert.deepEqual(report.scopeCreep, []);
  assert.deepEqual(report.intentGap, []);
  assert.ok(report.summary.includes("No drift detected"));
});

test("computeDriftReport detects scope creep for files outside touchedAreas", () => {
  const pack = basePack({
    touchedAreas: ["billing"],
    prLink: "https://github.com/org/repo/pull/1",
    changedFiles: ["src/billing/invoice.ts", "src/dashboard/analytics.ts"],
  });
  const report = computeDriftReport(pack);
  assert.ok(report.scopeCreep.includes("src/dashboard/analytics.ts"));
  assert.ok(report.summary.includes("scope creep"));
});

test("computeDriftReport detects intent gap for touchedAreas with no matching files", () => {
  const pack = basePack({
    touchedAreas: ["billing", "auth"],
    prLink: "https://github.com/org/repo/pull/1",
    changedFiles: ["src/billing/invoice.ts"],
  });
  const report = computeDriftReport(pack);
  assert.ok(report.intentGap.includes("auth"));
  assert.ok(report.summary.includes("intent gap"));
});

test("computeDriftReport with both scope creep and intent gap describes both", () => {
  const pack = basePack({
    touchedAreas: ["billing"],
    prLink: "https://github.com/org/repo/pull/1",
    changedFiles: ["src/notifications/email.ts"],
  });
  const report = computeDriftReport(pack);
  assert.ok(report.scopeCreep.length > 0);
  assert.ok(report.intentGap.length > 0);
});

test("computeDriftReport returns correct packId", () => {
  const pack = basePack();
  const report = computeDriftReport(pack);
  assert.equal(report.packId, pack.id);
});

test("computeDriftReport intentGap equals all touchedAreas when no files match", () => {
  const pack = basePack({
    touchedAreas: ["billing", "auth"],
    prLink: "https://github.com/org/repo/pull/2",
    changedFiles: [],
  });
  const report = computeDriftReport(pack);
  assert.deepEqual(report.intentGap, ["billing", "auth"]);
});

// ── New fields: matchedFiles, changedFiles, status ────────────

test("computeDriftReport includes changedFiles in result", () => {
  const pack = basePack({
    prLink: "https://github.com/org/repo/pull/1",
    changedFiles: ["src/billing/invoice.ts", "src/payment/processor.ts"],
  });
  const report = computeDriftReport(pack);
  assert.deepEqual(report.changedFiles, ["src/billing/invoice.ts", "src/payment/processor.ts"]);
});

test("computeDriftReport returns empty changedFiles when none stored", () => {
  const pack = basePack();
  const report = computeDriftReport(pack);
  assert.deepEqual(report.changedFiles, []);
});

test("computeDriftReport populates matchedFiles for files matching touchedAreas", () => {
  const pack = basePack({
    touchedAreas: ["billing", "auth"],
    prLink: "https://github.com/org/repo/pull/1",
    changedFiles: ["src/billing/invoice.ts", "src/auth/middleware.ts", "src/dashboard/widget.ts"],
  });
  const report = computeDriftReport(pack);
  assert.ok(report.matchedFiles.includes("src/billing/invoice.ts"), "billing file should be matched");
  assert.ok(report.matchedFiles.includes("src/auth/middleware.ts"), "auth file should be matched");
  assert.ok(!report.matchedFiles.includes("src/dashboard/widget.ts"), "dashboard file should NOT be matched");
});

test("computeDriftReport matchedFiles is empty when no files match touchedAreas", () => {
  const pack = basePack({
    touchedAreas: ["billing"],
    prLink: "https://github.com/org/repo/pull/1",
    changedFiles: ["src/notifications/email.ts"],
  });
  const report = computeDriftReport(pack);
  assert.deepEqual(report.matchedFiles, []);
});

test("computeDriftReport status is clean when all files match and all areas covered", () => {
  const pack = basePack({
    touchedAreas: ["billing", "payment"],
    prLink: "https://github.com/org/repo/pull/1",
    changedFiles: ["src/billing/invoice.ts", "src/payment/processor.ts"],
  });
  const report = computeDriftReport(pack);
  assert.equal(report.status, "clean");
});

test("computeDriftReport status is no-data when no changedFiles", () => {
  const pack = basePack();
  const report = computeDriftReport(pack);
  assert.equal(report.status, "no-data");
});

test("computeDriftReport status is no-data even when PR is linked but no changedFiles", () => {
  const pack = basePack({ prLink: "https://github.com/org/repo/pull/1" });
  const report = computeDriftReport(pack);
  assert.equal(report.status, "no-data");
});

test("computeDriftReport status is warning when only scopeCreep present (no intentGap)", () => {
  const pack = basePack({
    touchedAreas: ["billing", "payment", "auth"],
    prLink: "https://github.com/org/repo/pull/1",
    // All touchedAreas covered, but one extra file
    changedFiles: [
      "src/billing/invoice.ts",
      "src/payment/processor.ts",
      "src/auth/middleware.ts",
      "src/dashboard/widget.ts", // unexpected
    ],
  });
  const report = computeDriftReport(pack);
  assert.equal(report.status, "warning");
  assert.ok(report.scopeCreep.includes("src/dashboard/widget.ts"));
  assert.deepEqual(report.intentGap, []);
});

test("computeDriftReport status is warning when only intentGap present (no scopeCreep)", () => {
  const pack = basePack({
    touchedAreas: ["billing", "auth"],
    prLink: "https://github.com/org/repo/pull/1",
    changedFiles: ["src/billing/invoice.ts"], // auth missing
  });
  const report = computeDriftReport(pack);
  assert.equal(report.status, "warning");
  assert.deepEqual(report.scopeCreep, []);
  assert.ok(report.intentGap.includes("auth"));
});

test("computeDriftReport status is drift-detected when both scopeCreep and intentGap present", () => {
  const pack = basePack({
    touchedAreas: ["billing"],
    prLink: "https://github.com/org/repo/pull/1",
    changedFiles: ["src/notifications/email.ts"], // billing missing, dashboard unexpected
  });
  const report = computeDriftReport(pack);
  assert.equal(report.status, "drift-detected");
  assert.ok(report.scopeCreep.length > 0);
  assert.ok(report.intentGap.length > 0);
});
