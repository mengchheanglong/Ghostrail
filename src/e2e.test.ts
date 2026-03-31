/**
 * e2e.test.ts — Comprehensive end-to-end pipeline tests
 *
 * Covers the complete Ghostrail lifecycle from soup to nuts:
 *   1.  Pack generation via the real heuristic provider
 *   2.  Persistence to the real file-backed store
 *   3.  Full-field validation of every response (every field, not just a few)
 *   4.  All PATCH operations: notes, tags, goal, repositoryContext, status, starred, archived
 *   5.  Version history chain — one entry per meaningful patch, complete before-snapshot
 *   6.  Diff analysis and full drift detection — all DriftReport fields verified
 *   7.  Task packet and agent prompt generation — all TaskPacketJson fields verified
 *   8.  PR description and GitHub Issue markdown — all sections verified
 *   9.  GitHub issue creation with a realistic full GitHub Issues API response body
 *  10.  Pack duplication — all fields preserved
 *  11.  Pack deletion — pack gone from list
 *  12.  Multi-pack list integrity
 *  13.  Complete soup-to-nuts lifecycle chain (single test, chains all operations)
 *
 * No stubs of internal code are used. The heuristic generation pipeline,
 * file store, diff parser, drift engine, and all formatters run for real.
 *
 * External API calls (GitHub) use a mock fetch that returns the exact same
 * response shape as the real GitHub Issues API (status 201, all standard
 * fields present — our code only reads two of them, but the full shape is
 * provided to reflect what the real API actually returns).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler } from "./core/handler.js";

// ── Validation patterns ───────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);
const VALID_DRIFT_STATUS = new Set(["no-data", "clean", "warning", "drift-detected"]);
const VALID_STATUSES = new Set(["draft", "approved", "in-progress", "done", "blocked", "abandoned"]);

// ── Scenario test data ────────────────────────────────────────
//
// Four rich, multi-sentence, real-world-like goals. Each scenario exercises a
// distinct domain keyword cluster so that the heuristic generator produces
// domain-specific output (touchedAreas, constraints, risks, openQuestions).
// All goals are long enough and contain confidence-boosting keywords so that
// the heuristic scorer returns "high" confidence.

const BILLING_GOAL =
  "Refactor the billing module to support multiple payment providers without breaking " +
  "existing Stripe payment flows or corrupting billing records. " +
  "The implementation must preserve backward compatibility for all existing subscription states.";

const BILLING_CONTEXT =
  "Node.js backend with Stripe integration. Billing module is in src/billing/. " +
  "Payment gateway adapter is in src/payment/. Subscription state machine is in src/subscription/. " +
  "Do not modify the gateway adapter interface.";

const AUTH_GOAL =
  "Add role-based access controls to the admin panel so that administrators can " +
  "manage user permissions without exposing authentication tokens or bypassing " +
  "existing security checks. Authorization must be enforced at the middleware layer.";

const AUTH_CONTEXT =
  "Express.js API with JWT authentication. Auth middleware is in src/auth/. " +
  "Admin routes are in src/admin/. Do not refactor the existing permission model.";

const DB_GOAL =
  "Add a database schema migration to introduce a tenant_id column to the users table " +
  "for multi-tenant data isolation, with a corresponding rollback migration, " +
  "so that the database remains backward compatible throughout the migration window.";

const DB_CONTEXT =
  "PostgreSQL database. Migrations are managed with Knex.js in db/migrations/. " +
  "The schema module is in src/schema/. Existing single-tenant data must not be affected.";

const FEATURE_GOAL =
  "Add real-time WebSocket notifications for work item updates so that team members " +
  "see immediate changes without polling the REST API, preserving existing notification " +
  "preferences and without breaking the current REST API contract.";

const FEATURE_CONTEXT =
  "React frontend with Node.js backend. WebSocket support not yet implemented. " +
  "Existing notification preferences are stored in src/preferences/.";

// ── Realistic git diffs ───────────────────────────────────────
//
// Each diff is crafted to produce a predictable mix of:
//   - matched files  (path tokens overlap with declared touchedAreas)
//   - scope creep    (path tokens do not match any touchedArea)
//   - intent gap     (touchedArea has no matching file — varies by scenario)

// BILLING_GOAL touchedAreas (heuristic) → ["billing", "payment", "subscription"]
// Produces 4 files:  3 matched + 1 scope creep (analytics)
const BILLING_DIFF = `diff --git a/src/billing/invoice.ts b/src/billing/invoice.ts
index abc1234..def5678 100644
--- a/src/billing/invoice.ts
+++ b/src/billing/invoice.ts
@@ -1,4 +1,9 @@
 export class Invoice {
+  readonly provider: string;
+  constructor(provider: string) {
+    this.provider = provider;
+  }
 }
diff --git a/src/payment/gateway.ts b/src/payment/gateway.ts
index 111aaaa..222bbbb 100644
--- a/src/payment/gateway.ts
+++ b/src/payment/gateway.ts
@@ -1,3 +1,5 @@
 export interface PaymentGateway {
+  readonly name: string;
   charge(amount: number): Promise<void>;
 }
diff --git a/src/subscription/plan.ts b/src/subscription/plan.ts
new file mode 100644
--- /dev/null
+++ b/src/subscription/plan.ts
@@ -0,0 +1,5 @@
+export interface Plan {
+  id: string;
+  interval: "monthly" | "annual";
+  priceInCents: number;
+}
diff --git a/src/analytics/revenue.ts b/src/analytics/revenue.ts
new file mode 100644
--- /dev/null
+++ b/src/analytics/revenue.ts
@@ -0,0 +1,3 @@
+export function revenueByMonth(month: string): number {
+  return 0;
+}
`;

// AUTH_GOAL touchedAreas (heuristic) → ["auth", "authentication", "admin", "security"]
// Produces 3 files: 2 matched (auth, admin) + 1 scope creep (lib/cache)
// intentGap: "authentication" and "security" have no matching file → drift-detected
const AUTH_DIFF = `diff --git a/src/auth/rbac.ts b/src/auth/rbac.ts
new file mode 100644
--- /dev/null
+++ b/src/auth/rbac.ts
@@ -0,0 +1,6 @@
+export type Role = "admin" | "editor" | "viewer";
+export function hasRole(userRole: Role, required: Role): boolean {
+  if (required === "viewer") return true;
+  if (required === "editor") return userRole !== "viewer";
+  return userRole === "admin";
+}
diff --git a/src/admin/middleware.ts b/src/admin/middleware.ts
index aaa0000..bbb1111 100644
--- a/src/admin/middleware.ts
+++ b/src/admin/middleware.ts
@@ -1,4 +1,12 @@
 import { Request, Response, NextFunction } from "express";
+import { hasRole } from "../auth/rbac.js";
+export function requireAdmin(
+  req: Request,
+  res: Response,
+  next: NextFunction
+): void {
+  const role = (req as unknown as { user?: { role: string } }).user?.role as "admin" | undefined;
+  if (role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
+  next();
+}
diff --git a/src/lib/cache.ts b/src/lib/cache.ts
index ccc2222..ddd3333 100644
--- a/src/lib/cache.ts
+++ b/src/lib/cache.ts
@@ -1,1 +1,2 @@
+export const CACHE_TTL_SECONDS = 3600;
 export {};
`;

// DB_GOAL touchedAreas (heuristic) → ["database", "schema", "migration"]
// Produces 4 files: 3 matched + 1 scope creep (tests/auth/login.test.ts)
const DB_DIFF = `diff --git a/db/migrations/20240115_add_tenant_id.ts b/db/migrations/20240115_add_tenant_id.ts
new file mode 100644
--- /dev/null
+++ b/db/migrations/20240115_add_tenant_id.ts
@@ -0,0 +1,10 @@
+import type { Knex } from "knex";
+export async function up(knex: Knex): Promise<void> {
+  await knex.schema.table("users", (t) => {
+    t.string("tenant_id").nullable();
+  });
+}
+export async function down(knex: Knex): Promise<void> {
+  await knex.schema.table("users", (t) => { t.dropColumn("tenant_id"); });
+}
diff --git a/src/database/tenant.ts b/src/database/tenant.ts
new file mode 100644
--- /dev/null
+++ b/src/database/tenant.ts
@@ -0,0 +1,5 @@
+export interface TenantFilter {
+  tenant_id: string;
+}
+export function getTenantFilter(tenantId: string): TenantFilter {
+  return { tenant_id: tenantId };
+}
diff --git a/src/schema/user.ts b/src/schema/user.ts
index eeeeeee..fffffff 100644
--- a/src/schema/user.ts
+++ b/src/schema/user.ts
@@ -1,4 +1,5 @@
 export interface User {
   id: string;
   email: string;
+  tenantId?: string;
 }
diff --git a/tests/auth/login.test.ts b/tests/auth/login.test.ts
index ggggggg..hhhhhhh 100644
--- a/tests/auth/login.test.ts
+++ b/tests/auth/login.test.ts
@@ -1,3 +1,4 @@
+// Updated login test setup for multi-tenant environment
 import assert from "node:assert/strict";
 export {};
`;

// ── Test server helpers ───────────────────────────────────────

type FetchFn = typeof fetch;

async function withTestServer(
  fn: (baseUrl: string, dataDir: string) => Promise<void>,
  githubFetchFn?: FetchFn
): Promise<void> {
  const dataDir = await mkdtemp(join(tmpdir(), "ghostrail-e2e-test-"));
  try {
    const handler = createHandler(dataDir, tmpdir(), undefined, undefined, githubFetchFn);
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

// ── Full-field assertion helpers ──────────────────────────────

/**
 * Asserts that every field of a generated-and-stored IntentPack is present
 * and correctly typed. Used as the single comprehensive shape check after
 * POST /api/intent-pack or GET /api/intent-packs/:id.
 */
function assertStoredIntentPackShape(
  b: Record<string, unknown>,
  expectedGoal: string,
  expectedContext?: string
): void {
  // Identity / storage fields
  assert.match(b["id"] as string, UUID_RE, "id must be a valid UUID");
  assert.match(b["createdAt"] as string, ISO_DATE_RE, "createdAt must be ISO 8601 UTC");

  // Input-echoed fields
  assert.equal(b["goal"], expectedGoal, "goal must equal the submitted goal");
  if (expectedContext !== undefined) {
    assert.equal(b["repositoryContext"], expectedContext, "repositoryContext must equal the submitted context");
  }

  // Generated scalar fields
  assert.ok(
    typeof b["objective"] === "string" && (b["objective"] as string).length > 0,
    "objective must be a non-empty string"
  );
  assert.equal(b["reasoningMode"], "heuristic", "reasoningMode must be 'heuristic'");
  assert.ok(VALID_CONFIDENCE.has(b["confidence"] as string), `confidence must be low/medium/high, got: ${b["confidence"]}`);

  // Generated array fields: all must be non-empty arrays of non-empty strings
  for (const field of [
    "constraints",
    "nonGoals",
    "acceptanceCriteria",
    "touchedAreas",
    "risks",
    "openQuestions",
  ] as const) {
    const arr = b[field];
    assert.ok(Array.isArray(arr), `${field} must be an array`);
    assert.ok((arr as unknown[]).length > 0, `${field} must not be empty`);
    (arr as unknown[]).forEach((item, i) => {
      assert.ok(
        typeof item === "string" && (item as string).length > 0,
        `${field}[${i}] must be a non-empty string`
      );
    });
  }
}

/**
 * Asserts the structural integrity of a DriftReport response.
 * Checks that:
 *   - every required field is present with the correct type
 *   - matchedFiles + scopeCreep === changedFiles (all files accounted for)
 *   - intentGap items are strings
 *   - status is a valid DriftStatus value
 *   - summary is non-empty
 */
function assertDriftReportShape(
  report: Record<string, unknown>,
  expectedPackId: string
): void {
  assert.equal(report["packId"], expectedPackId, "packId must equal the stored pack id");
  assert.ok(
    report["prLink"] === null || typeof report["prLink"] === "string",
    "prLink must be null or a string"
  );
  assert.ok(typeof report["hasLinkedPr"] === "boolean", "hasLinkedPr must be a boolean");
  assert.ok(Array.isArray(report["changedFiles"]), "changedFiles must be an array");
  assert.ok(Array.isArray(report["matchedFiles"]), "matchedFiles must be an array");
  assert.ok(Array.isArray(report["scopeCreep"]), "scopeCreep must be an array");
  assert.ok(Array.isArray(report["intentGap"]), "intentGap must be an array");
  assert.ok(
    VALID_DRIFT_STATUS.has(report["status"] as string),
    `drift status must be one of the valid values, got: ${report["status"]}`
  );
  assert.ok(
    typeof report["summary"] === "string" && (report["summary"] as string).length > 0,
    "summary must be a non-empty string"
  );
  // Internal consistency: matchedFiles + scopeCreep must equal changedFiles
  const changed = (report["changedFiles"] as string[]).length;
  const matched = (report["matchedFiles"] as string[]).length;
  const creep = (report["scopeCreep"] as string[]).length;
  assert.equal(
    matched + creep,
    changed,
    `matchedFiles(${matched}) + scopeCreep(${creep}) must equal changedFiles(${changed})`
  );
  // intentGap items must all be strings
  (report["intentGap"] as unknown[]).forEach((item, i) => {
    assert.ok(typeof item === "string", `intentGap[${i}] must be a string`);
  });
}

/**
 * Asserts the structural integrity of a TaskPacketJson response.
 */
function assertTaskPacketShape(
  packet: Record<string, unknown>,
  expectedPackId: string,
  expectedGoal: string
): void {
  assert.equal(packet["schemaVersion"], "1", "schemaVersion must be '1'");
  assert.match(packet["id"] as string, UUID_RE, "task packet id must be a valid UUID");
  assert.equal(packet["id"], expectedPackId, "task packet id must match the pack id");
  assert.ok(
    typeof packet["goal"] === "string" && (packet["goal"] as string).length > 0,
    "task packet goal must be a non-empty string"
  );
  assert.equal(packet["goal"], expectedGoal, "task packet goal must match the pack goal");
  assert.ok(
    typeof packet["objective"] === "string" && (packet["objective"] as string).length > 0,
    "task packet objective must be a non-empty string"
  );
  assert.match(packet["createdAt"] as string, ISO_DATE_RE, "task packet createdAt must be ISO 8601");
  for (const field of [
    "constraints",
    "nonGoals",
    "acceptanceCriteria",
    "touchedAreas",
    "risks",
    "openQuestions",
  ] as const) {
    const arr = packet[field];
    assert.ok(Array.isArray(arr), `task packet ${field} must be an array`);
    assert.ok((arr as unknown[]).length > 0, `task packet ${field} must not be empty`);
    (arr as unknown[]).forEach((item, i) => {
      assert.ok(
        typeof item === "string" && (item as string).length > 0,
        `task packet ${field}[${i}] must be a non-empty string`
      );
    });
  }
}

/**
 * Asserts a PR description markdown string contains all required sections.
 */
function assertPrDescriptionShape(
  markdown: string,
  packId: string,
  options: { hasContext?: boolean; notes?: string } = {}
): void {
  assert.ok(markdown.includes("## What this PR does"), "PR description must include '## What this PR does'");
  assert.ok(markdown.includes("## Acceptance criteria"), "PR description must include '## Acceptance criteria'");
  assert.ok(markdown.includes("- [ ]"), "PR description must include checklist items");
  assert.ok(markdown.includes("## Files / areas touched"), "PR description must include '## Files / areas touched'");
  assert.ok(markdown.includes("## Constraints respected"), "PR description must include '## Constraints respected'");
  assert.ok(markdown.includes("## Non-goals (not in scope)"), "PR description must include '## Non-goals (not in scope)'");
  assert.ok(markdown.includes("## Risks considered"), "PR description must include '## Risks considered'");
  assert.ok(markdown.includes(packId), "PR description must include the pack ID in the footer");
  if (options.hasContext) {
    assert.ok(markdown.includes("## Repository context"), "PR description must include '## Repository context'");
  }
  if (options.notes) {
    assert.ok(markdown.includes("## Notes"), "PR description must include '## Notes' section when notes are set");
    assert.ok(markdown.includes(options.notes), "PR description must include the notes text");
  }
}

/**
 * Asserts a GitHub Issue markdown string contains all required sections.
 */
function assertIssueMarkdownShape(markdown: string): void {
  assert.ok(markdown.includes("## Objective"), "issue markdown must include '## Objective'");
  assert.ok(markdown.includes("## Non-goals"), "issue markdown must include '## Non-goals'");
  assert.ok(markdown.includes("## Constraints"), "issue markdown must include '## Constraints'");
  assert.ok(markdown.includes("## Acceptance criteria"), "issue markdown must include '## Acceptance criteria'");
  assert.ok(markdown.includes("## Touched areas"), "issue markdown must include '## Touched areas'");
  assert.ok(markdown.includes("## Risks"), "issue markdown must include '## Risks'");
  assert.ok(markdown.includes("## Open questions"), "issue markdown must include '## Open questions'");
}

// ── Realistic GitHub Issues API mock ─────────────────────────
//
// Returns the same response shape as GitHub's POST /repos/:owner/:repo/issues
// (status 201). Our handler only reads `html_url` and `number`, but we provide
// the full shape to accurately simulate the real API.
function makeRealisticGithubFetch(issueNumber: number, owner: string, repo: string): FetchFn {
  const issueUrl = `https://github.com/${owner}/${repo}/issues/${issueNumber}`;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
  const now = new Date().toISOString();
  const fullResponse = {
    id: 987654300 + issueNumber,
    node_id: `I_kwDOBRRtXM5HA${issueNumber.toString().padStart(4, "0")}`,
    url: apiUrl,
    repository_url: `https://api.github.com/repos/${owner}/${repo}`,
    labels_url: `${apiUrl}/labels{/name}`,
    comments_url: `${apiUrl}/comments`,
    events_url: `${apiUrl}/events`,
    html_url: issueUrl,
    number: issueNumber,
    state: "open",
    state_reason: null,
    title: "Ghostrail intent pack",
    body: "<!-- generated by Ghostrail -->",
    user: {
      login: "ghostrail-app",
      id: 100200300,
      node_id: "MDQ6VXNlcjEwMDIwMDMwMA==",
      avatar_url: "https://avatars.githubusercontent.com/u/100200300?v=4",
      gravatar_id: "",
      url: "https://api.github.com/users/ghostrail-app",
      html_url: "https://github.com/ghostrail-app",
      type: "User",
      site_admin: false,
    },
    labels: [],
    assignee: null,
    assignees: [],
    milestone: null,
    locked: false,
    active_lock_reason: null,
    comments: 0,
    closed_at: null,
    created_at: now,
    updated_at: now,
    author_association: "OWNER",
    reactions: {
      url: `${apiUrl}/reactions`,
      total_count: 0,
      "+1": 0,
      "-1": 0,
      laugh: 0,
      hooray: 0,
      confused: 0,
      heart: 0,
      rocket: 0,
      eyes: 0,
    },
    timeline_url: `${apiUrl}/timeline`,
    performed_via_github_app: null,
    draft: false,
  };
  return async () =>
    new Response(JSON.stringify(fullResponse), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
}

// ══════════════════════════════════════════════════════════════
// Group 1 — Full field validation for all 4 scenarios
// ══════════════════════════════════════════════════════════════

test("[billing] POST /api/intent-pack returns a StoredIntentPack with every required field", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL, repositoryContext: BILLING_CONTEXT }),
    });
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assertStoredIntentPackShape(b, BILLING_GOAL, BILLING_CONTEXT);
    // Long goal with "must" and "existing" → heuristic scorer returns "high"
    assert.equal(b["confidence"], "high", "billing goal with confidence-boosting keywords must score 'high'");
  });
});

test("[auth] POST /api/intent-pack returns a StoredIntentPack with every required field", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: AUTH_GOAL, repositoryContext: AUTH_CONTEXT }),
    });
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assertStoredIntentPackShape(b, AUTH_GOAL, AUTH_CONTEXT);
    assert.equal(b["confidence"], "high");
  });
});

test("[database] POST /api/intent-pack returns a StoredIntentPack with every required field", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: DB_GOAL, repositoryContext: DB_CONTEXT }),
    });
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assertStoredIntentPackShape(b, DB_GOAL, DB_CONTEXT);
    assert.equal(b["confidence"], "high");
  });
});

test("[feature] POST /api/intent-pack returns a StoredIntentPack with every required field", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: FEATURE_GOAL, repositoryContext: FEATURE_CONTEXT }),
    });
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assertStoredIntentPackShape(b, FEATURE_GOAL, FEATURE_CONTEXT);
  });
});

// ══════════════════════════════════════════════════════════════
// Group 2 — Domain-specific heuristic output validation
// ══════════════════════════════════════════════════════════════

test("[billing] generated pack has billing/payment/subscription in touchedAreas and domain constraints and risks", async () => {
  await withTestServer(async (baseUrl) => {
    const { body } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL, repositoryContext: BILLING_CONTEXT }),
    });
    const b = body as Record<string, unknown>;
    const touchedAreas = b["touchedAreas"] as string[];
    const constraints = b["constraints"] as string[];
    const risks = b["risks"] as string[];
    const openQuestions = b["openQuestions"] as string[];

    assert.ok(touchedAreas.includes("billing"), `touchedAreas must include 'billing', got: ${JSON.stringify(touchedAreas)}`);
    assert.ok(touchedAreas.includes("payment"), `touchedAreas must include 'payment', got: ${JSON.stringify(touchedAreas)}`);
    assert.ok(touchedAreas.includes("subscription"), `touchedAreas must include 'subscription', got: ${JSON.stringify(touchedAreas)}`);

    assert.ok(
      constraints.some((c) => /payment|billing/i.test(c)),
      `constraints must include billing/payment protection language, got: ${JSON.stringify(constraints)}`
    );
    assert.ok(
      risks.some((r) => /financial|billing|monetization/i.test(r)),
      `risks must mention financial drift, got: ${JSON.stringify(risks)}`
    );
    assert.ok(
      openQuestions.some((q) => /billing/i.test(q)),
      `openQuestions must include a billing-related question, got: ${JSON.stringify(openQuestions)}`
    );
  });
});

test("[auth] generated pack has auth/admin in touchedAreas and authorization constraints and risks", async () => {
  await withTestServer(async (baseUrl) => {
    const { body } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: AUTH_GOAL, repositoryContext: AUTH_CONTEXT }),
    });
    const b = body as Record<string, unknown>;
    const touchedAreas = b["touchedAreas"] as string[];
    const constraints = b["constraints"] as string[];
    const risks = b["risks"] as string[];

    assert.ok(
      touchedAreas.some((a) => /auth/i.test(a)),
      `touchedAreas must include an auth-related area, got: ${JSON.stringify(touchedAreas)}`
    );
    assert.ok(
      touchedAreas.includes("admin"),
      `touchedAreas must include 'admin', got: ${JSON.stringify(touchedAreas)}`
    );
    assert.ok(
      constraints.some((c) => /auth|authorization|access/i.test(c)),
      `constraints must include authorization protection, got: ${JSON.stringify(constraints)}`
    );
    assert.ok(
      risks.some((r) => /auth|authorization|regression|restricted|expose/i.test(r)),
      `risks must include an authorization regression risk, got: ${JSON.stringify(risks)}`
    );
  });
});

test("[database] generated pack has database/schema/migration in touchedAreas and data-safety constraints and risks", async () => {
  await withTestServer(async (baseUrl) => {
    const { body } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: DB_GOAL, repositoryContext: DB_CONTEXT }),
    });
    const b = body as Record<string, unknown>;
    const touchedAreas = b["touchedAreas"] as string[];
    const constraints = b["constraints"] as string[];
    const risks = b["risks"] as string[];
    const openQuestions = b["openQuestions"] as string[];

    assert.ok(touchedAreas.includes("database"), `touchedAreas must include 'database', got: ${JSON.stringify(touchedAreas)}`);
    assert.ok(touchedAreas.includes("schema"), `touchedAreas must include 'schema', got: ${JSON.stringify(touchedAreas)}`);
    assert.ok(touchedAreas.includes("migration"), `touchedAreas must include 'migration', got: ${JSON.stringify(touchedAreas)}`);

    assert.ok(
      constraints.some((c) => /schema|database|migration/i.test(c)),
      `constraints must include data-safety language, got: ${JSON.stringify(constraints)}`
    );
    assert.ok(
      risks.some((r) => /schema|migration|data model/i.test(r)),
      `risks must include a data model change risk, got: ${JSON.stringify(risks)}`
    );
    assert.ok(
      openQuestions.some((q) => /schema|migration/i.test(q)),
      `openQuestions must include a migration-related question, got: ${JSON.stringify(openQuestions)}`
    );
  });
});

test("[feature] generated pack without domain keywords still produces valid non-empty touchedAreas", async () => {
  await withTestServer(async (baseUrl) => {
    const { body } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: FEATURE_GOAL, repositoryContext: FEATURE_CONTEXT }),
    });
    const b = body as Record<string, unknown>;
    const touchedAreas = b["touchedAreas"] as string[];
    // No protectedAreaHints match → heuristic falls back to first sentence of goal
    assert.ok(touchedAreas.length > 0, "touchedAreas must not be empty even without domain keywords");
    touchedAreas.forEach((area, i) => {
      assert.ok(typeof area === "string" && area.length > 0, `touchedAreas[${i}] must be a non-empty string`);
    });
    // The fallback area must contain part of the original goal text
    assert.ok(
      touchedAreas.some((a) => a.toLowerCase().includes("websocket") || a.toLowerCase().includes("notification")),
      `touchedAreas fallback must reference the goal content, got: ${JSON.stringify(touchedAreas)}`
    );
  });
});

// ══════════════════════════════════════════════════════════════
// Group 3 — List and single-pack round-trip consistency
// ══════════════════════════════════════════════════════════════

test("[billing] created pack appears in GET /api/intent-packs with all fields intact", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL, repositoryContext: BILLING_CONTEXT }),
    });
    const created = createBody as Record<string, unknown>;

    const { status: listStatus, body: listBody } = await fetchJson(`${baseUrl}/api/intent-packs`);
    assert.equal(listStatus, 200);
    const packs = listBody as Record<string, unknown>[];
    assert.equal(packs.length, 1, "list must contain exactly the one created pack");

    const listed = packs[0]!;
    assert.equal(listed["id"], created["id"], "listed pack id must match creation id");
    assert.equal(listed["goal"], BILLING_GOAL);
    assert.equal(listed["repositoryContext"], BILLING_CONTEXT);
    assert.equal(listed["objective"], created["objective"]);
    assert.equal(listed["reasoningMode"], "heuristic");
    assert.equal(listed["confidence"], "high");
    assert.deepEqual(listed["constraints"], created["constraints"]);
    assert.deepEqual(listed["nonGoals"], created["nonGoals"]);
    assert.deepEqual(listed["acceptanceCriteria"], created["acceptanceCriteria"]);
    assert.deepEqual(listed["touchedAreas"], created["touchedAreas"]);
    assert.deepEqual(listed["risks"], created["risks"]);
    assert.deepEqual(listed["openQuestions"], created["openQuestions"]);
  });
});

test("[billing] GET /api/intent-packs/:id returns a pack field-for-field identical to the creation response", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL }),
    });
    const created = createBody as Record<string, unknown>;
    const id = created["id"] as string;

    const { status: getStatus, body: getBody } = await fetchJson(`${baseUrl}/api/intent-packs/${id}`);
    assert.equal(getStatus, 200);
    const fetched = getBody as Record<string, unknown>;

    assert.equal(fetched["id"], created["id"]);
    assert.equal(fetched["goal"], created["goal"]);
    assert.equal(fetched["objective"], created["objective"]);
    assert.equal(fetched["confidence"], created["confidence"]);
    assert.equal(fetched["reasoningMode"], created["reasoningMode"]);
    assert.equal(fetched["createdAt"], created["createdAt"]);
    assert.deepEqual(fetched["constraints"], created["constraints"]);
    assert.deepEqual(fetched["nonGoals"], created["nonGoals"]);
    assert.deepEqual(fetched["acceptanceCriteria"], created["acceptanceCriteria"]);
    assert.deepEqual(fetched["touchedAreas"], created["touchedAreas"]);
    assert.deepEqual(fetched["risks"], created["risks"]);
    assert.deepEqual(fetched["openQuestions"], created["openQuestions"]);
  });
});

// ══════════════════════════════════════════════════════════════
// Group 4 — PATCH all fields, verify each change persists
// ══════════════════════════════════════════════════════════════

test("[billing] PATCH every editable field in sequence and verify all changes survive a final GET", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL }),
    });
    const id = (createBody as Record<string, unknown>)["id"] as string;

    // notes
    const { status: s1, body: b1 } = await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Reviewed by billing team on 2024-01-15. Approved for sprint 7." }),
    });
    assert.equal(s1, 200);
    assert.equal(
      (b1 as Record<string, unknown>)["notes"],
      "Reviewed by billing team on 2024-01-15. Approved for sprint 7."
    );

    // tags (realistic multi-tag set)
    const { status: s2, body: b2 } = await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["billing", "high-priority", "sprint-7", "stripe-migration"] }),
    });
    assert.equal(s2, 200);
    assert.deepEqual(
      (b2 as Record<string, unknown>)["tags"],
      ["billing", "high-priority", "sprint-7", "stripe-migration"]
    );

    // status — walk through two states
    for (const nextStatus of ["in-progress", "done"] as const) {
      const { status: sn, body: bn } = await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      assert.equal(sn, 200);
      assert.equal((bn as Record<string, unknown>)["status"], nextStatus);
    }

    // starred
    const { status: s4, body: b4 } = await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: true }),
    });
    assert.equal(s4, 200);
    assert.equal((b4 as Record<string, unknown>)["starred"], true);

    // archived
    const { status: s5, body: b5 } = await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    assert.equal(s5, 200);
    assert.equal((b5 as Record<string, unknown>)["archived"], true);

    // goal + repositoryContext together
    const newGoal =
      "Refactor the payment gateway abstraction layer to support Stripe, Braintree, and " +
      "PayPal without modifying existing billing rules or corrupting subscription state.";
    const newContext = "Updated context: payment adapters are now in src/payment/adapters/.";
    const { status: s6, body: b6 } = await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: newGoal, repositoryContext: newContext }),
    });
    assert.equal(s6, 200);
    assert.equal((b6 as Record<string, unknown>)["goal"], newGoal);
    assert.equal((b6 as Record<string, unknown>)["repositoryContext"], newContext);

    // Final GET — every patched field must survive
    const { status: finalStatus, body: finalBody } = await fetchJson(`${baseUrl}/api/intent-packs/${id}`);
    assert.equal(finalStatus, 200);
    const final = finalBody as Record<string, unknown>;
    assert.equal(final["notes"], "Reviewed by billing team on 2024-01-15. Approved for sprint 7.");
    assert.deepEqual(final["tags"], ["billing", "high-priority", "sprint-7", "stripe-migration"]);
    assert.equal(final["status"], "done");
    assert.equal(final["starred"], true);
    assert.equal(final["archived"], true);
    assert.equal(final["goal"], newGoal);
    assert.equal(final["repositoryContext"], newContext);
    // Immutable fields must be unchanged
    assert.match(final["id"] as string, UUID_RE);
    assert.equal(final["id"], id);
    assert.equal(final["reasoningMode"], "heuristic");
  });
});

// ══════════════════════════════════════════════════════════════
// Group 5 — Version history chain
// ══════════════════════════════════════════════════════════════

test("[billing] history accumulates exactly one entry per meaningful patch and each entry has a complete before-snapshot", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL }),
    });
    const originalPack = createBody as Record<string, unknown>;
    const id = originalPack["id"] as string;

    // 0 history entries before any patches
    const { status: h0, body: empty } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/history`);
    assert.equal(h0, 200);
    assert.deepEqual(empty, [], "history must be empty before any patches");

    // Patch 1: notes (meaningful → history entry)
    await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Initial review note." }),
    });

    // Patch 2: tags (meaningful → history entry)
    await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["billing", "sprint-8"] }),
    });

    // Patch 3: goal (meaningful → history entry)
    await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Updated billing goal for sprint 8: " + BILLING_GOAL }),
    });

    // Patch 4: starred (NOT meaningful — no history entry expected)
    await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: true }),
    });

    // Patch 5: archived (NOT meaningful — no history entry expected)
    await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    // Patch 6: status (meaningful → history entry)
    await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });

    const { status: histStatus, body: histBody } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/history`);
    assert.equal(histStatus, 200);
    const history = histBody as Array<{ patchedAt: string; before: Record<string, unknown> }>;

    // notes + tags + goal + status = 4 entries; starred and archived do not create entries
    assert.equal(history.length, 4, "must have exactly 4 history entries (one per meaningful patch)");

    for (const [i, entry] of history.entries()) {
      // patchedAt must be a valid ISO date
      assert.ok(typeof entry.patchedAt === "string", `history[${i}].patchedAt must be a string`);
      assert.match(entry.patchedAt, ISO_DATE_RE, `history[${i}].patchedAt must be ISO 8601`);

      // before-snapshot must be a complete StoredIntentPack
      const before = entry.before;
      assert.ok(typeof before === "object" && before !== null, `history[${i}].before must be an object`);
      assert.match(before["id"] as string, UUID_RE, `history[${i}].before.id must be a UUID`);
      assert.ok(typeof before["objective"] === "string", `history[${i}].before.objective must be a string`);
      assert.ok(Array.isArray(before["constraints"]), `history[${i}].before.constraints must be an array`);
      assert.ok(Array.isArray(before["touchedAreas"]), `history[${i}].before.touchedAreas must be an array`);
      assert.ok(Array.isArray(before["risks"]), `history[${i}].before.risks must be an array`);
      assert.ok(Array.isArray(before["openQuestions"]), `history[${i}].before.openQuestions must be an array`);
    }

    // First entry's before-snapshot must reflect the original creation goal
    assert.equal(
      history[0]!.before["goal"],
      BILLING_GOAL,
      "first before-snapshot must contain the original creation goal"
    );
  });
});

// ══════════════════════════════════════════════════════════════
// Group 6 — Diff analysis and drift detection (all DriftReport fields)
// ══════════════════════════════════════════════════════════════

test("[billing] analyze-diff returns a complete DriftReport with all fields and correct file classification", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL }),
    });
    const pack = createBody as Record<string, unknown>;
    const id = pack["id"] as string;

    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/analyze-diff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diffText: BILLING_DIFF,
        prUrl: "https://github.com/acme-corp/platform/pull/42",
      }),
    });
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;

    // changedFiles: BILLING_DIFF has 4 files
    const changedFiles = b["changedFiles"] as string[];
    assert.equal(changedFiles.length, 4, "BILLING_DIFF must parse to 4 changed files");
    assert.ok(changedFiles.includes("src/billing/invoice.ts"), "changedFiles must include src/billing/invoice.ts");
    assert.ok(changedFiles.includes("src/payment/gateway.ts"), "changedFiles must include src/payment/gateway.ts");
    assert.ok(changedFiles.includes("src/subscription/plan.ts"), "changedFiles must include src/subscription/plan.ts");
    assert.ok(changedFiles.includes("src/analytics/revenue.ts"), "changedFiles must include src/analytics/revenue.ts");

    // Full DriftReport shape
    const report = b["report"] as Record<string, unknown>;
    assertDriftReportShape(report, id);

    // prLink must reflect the prUrl we provided
    assert.equal(report["prLink"], "https://github.com/acme-corp/platform/pull/42");
    assert.equal(report["hasLinkedPr"], true);

    // billing/payment/subscription files match touchedAreas → matchedFiles
    const matchedFiles = report["matchedFiles"] as string[];
    assert.ok(
      matchedFiles.some((f) => f.includes("billing") || f.includes("payment") || f.includes("subscription")),
      "at least one billing/payment/subscription file must be in matchedFiles"
    );
    assert.equal(matchedFiles.length, 3, "3 files must match (billing, payment, subscription)");

    // analytics/revenue.ts has no touchedArea match → scope creep
    const scopeCreep = report["scopeCreep"] as string[];
    assert.ok(
      scopeCreep.includes("src/analytics/revenue.ts"),
      "src/analytics/revenue.ts must be in scopeCreep"
    );
    assert.equal(scopeCreep.length, 1, "exactly 1 file must be scope creep");

    // intentGap: all touchedAreas are covered by at least one file → empty
    const intentGap = report["intentGap"] as string[];
    assert.equal(intentGap.length, 0, "no touchedAreas should be in intentGap since all areas have matching files");

    // scope creep with no intent gap → "warning" (not "drift-detected")
    assert.equal(report["status"], "warning", "1 scope-creep file with no intent gap must produce 'warning' status");
    assert.ok((report["summary"] as string).length > 20, "summary must be a non-trivial description");
  });
});

test("[auth] analyze-diff correctly classifies auth/admin files as matched and cache as scope creep", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: AUTH_GOAL }),
    });
    const id = (createBody as Record<string, unknown>)["id"] as string;

    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/analyze-diff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diffText: AUTH_DIFF }),
    });
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;

    const changedFiles = b["changedFiles"] as string[];
    assert.equal(changedFiles.length, 3, "AUTH_DIFF must parse to 3 changed files");
    assert.ok(changedFiles.includes("src/auth/rbac.ts"));
    assert.ok(changedFiles.includes("src/admin/middleware.ts"));
    assert.ok(changedFiles.includes("src/lib/cache.ts"));

    const report = b["report"] as Record<string, unknown>;
    assertDriftReportShape(report, id);

    // src/lib/cache.ts has no auth/admin/security match → scope creep
    const scopeCreep = report["scopeCreep"] as string[];
    assert.ok(scopeCreep.includes("src/lib/cache.ts"), "src/lib/cache.ts must be scope creep");

    // "authentication" and "security" areas have no files matching them → intent gap
    const intentGap = report["intentGap"] as string[];
    assert.ok(
      intentGap.some((a) => /authentication/i.test(a)),
      `intentGap must include 'authentication' area, got: ${JSON.stringify(intentGap)}`
    );
    assert.ok(
      intentGap.some((a) => /security/i.test(a)),
      `intentGap must include 'security' area, got: ${JSON.stringify(intentGap)}`
    );

    // Both scope creep and intent gap → "drift-detected"
    assert.equal(report["status"], "drift-detected", "scope creep + intent gap must produce 'drift-detected'");
  });
});

test("[database] analyze-diff correctly classifies migration/db/schema files as matched and auth test as scope creep", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: DB_GOAL }),
    });
    const id = (createBody as Record<string, unknown>)["id"] as string;

    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/analyze-diff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diffText: DB_DIFF }),
    });
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;

    const changedFiles = b["changedFiles"] as string[];
    assert.equal(changedFiles.length, 4, "DB_DIFF must parse to 4 changed files");
    assert.ok(changedFiles.includes("db/migrations/20240115_add_tenant_id.ts"));
    assert.ok(changedFiles.includes("src/database/tenant.ts"));
    assert.ok(changedFiles.includes("src/schema/user.ts"));
    assert.ok(changedFiles.includes("tests/auth/login.test.ts"));

    const report = b["report"] as Record<string, unknown>;
    assertDriftReportShape(report, id);

    // tests/auth/login.test.ts does not match database/schema/migration → scope creep
    const scopeCreep = report["scopeCreep"] as string[];
    assert.ok(
      scopeCreep.includes("tests/auth/login.test.ts"),
      "tests/auth/login.test.ts must be scope creep for the database migration scenario"
    );

    // All 3 database touchedAreas are covered by matching files → no intent gap
    const intentGap = report["intentGap"] as string[];
    assert.equal(intentGap.length, 0, "all database/schema/migration areas must have matching files");
  });
});

test("[billing] GET /api/intent-packs/:id/drift-report after analyze-diff has all DriftReport fields and non-'no-data' status", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL }),
    });
    const id = (createBody as Record<string, unknown>)["id"] as string;

    // Populate changedFiles via analyze-diff
    await fetchJson(`${baseUrl}/api/intent-packs/${id}/analyze-diff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diffText: BILLING_DIFF, prUrl: "https://github.com/acme/repo/pull/7" }),
    });

    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/drift-report`);
    assert.equal(status, 200);
    const report = body as Record<string, unknown>;
    assertDriftReportShape(report, id);

    // Data was populated by analyze-diff → status must not be 'no-data'
    assert.notEqual(report["status"], "no-data", "drift status must not be 'no-data' after analyze-diff");
    assert.equal((report["changedFiles"] as string[]).length, 4, "changedFiles must be persisted from analyze-diff");
    assert.equal(report["hasLinkedPr"], true, "hasLinkedPr must be true after analyze-diff with a prUrl");
    assert.equal(report["prLink"], "https://github.com/acme/repo/pull/7");
  });
});

// ══════════════════════════════════════════════════════════════
// Group 7 — Task packet: all TaskPacketJson fields and agent prompt
// ══════════════════════════════════════════════════════════════

test("[billing] GET /api/intent-packs/:id/task-packet returns complete TaskPacketJson and a well-structured agent prompt", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL, repositoryContext: BILLING_CONTEXT }),
    });
    const pack = createBody as Record<string, unknown>;
    const id = pack["id"] as string;

    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/task-packet`);
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;

    // Task packet — full field validation
    const packet = b["packet"] as Record<string, unknown>;
    assertTaskPacketShape(packet, id, BILLING_GOAL);
    assert.equal(packet["repositoryContext"], BILLING_CONTEXT, "task packet must include repositoryContext");

    // Arrays must match the stored pack exactly
    assert.deepEqual(packet["constraints"], pack["constraints"]);
    assert.deepEqual(packet["nonGoals"], pack["nonGoals"]);
    assert.deepEqual(packet["acceptanceCriteria"], pack["acceptanceCriteria"]);
    assert.deepEqual(packet["touchedAreas"], pack["touchedAreas"]);
    assert.deepEqual(packet["risks"], pack["risks"]);
    assert.deepEqual(packet["openQuestions"], pack["openQuestions"]);

    // Agent prompt — structural sections
    const prompt = b["prompt"] as string;
    assert.ok(typeof prompt === "string" && prompt.length > 100, "agent prompt must be a substantial string");
    assert.ok(prompt.includes("## Task"), "prompt must contain ## Task section");
    assert.ok(prompt.includes("## Objective"), "prompt must contain ## Objective section");
    assert.ok(prompt.includes("## Constraints (you MUST follow all of these)"), "prompt must contain Constraints section");
    assert.ok(prompt.includes("## Do NOT do any of the following (non-goals)"), "prompt must contain Non-goals section");
    assert.ok(prompt.includes("## Acceptance criteria"), "prompt must contain Acceptance criteria section");
    assert.ok(prompt.includes("- [ ]"), "prompt must contain checklist items for acceptance criteria");
    assert.ok(prompt.includes("## Files and areas expected to be touched"), "prompt must contain touched-areas section");
    assert.ok(prompt.includes("## Known risks (take extra care here)"), "prompt must contain risks section");
    assert.ok(prompt.includes("## Open questions"), "prompt must contain open-questions section");
    assert.ok(prompt.includes("## Repository context"), "prompt must contain repository-context section");
    assert.ok(prompt.includes(BILLING_CONTEXT), "prompt must embed the full repository context text");
    assert.ok(prompt.includes(BILLING_GOAL), "prompt must embed the full goal text");
    assert.ok(
      prompt.includes("Keep your implementation incremental"),
      "prompt must include the incremental implementation instruction"
    );

    // Each acceptance criterion must appear as a checklist item
    const criteria = pack["acceptanceCriteria"] as string[];
    for (const item of criteria) {
      assert.ok(prompt.includes(`- [ ] ${item}`), `prompt must include '- [ ] ${item}'`);
    }
  });
});

test("[auth] GET /api/intent-packs/:id/task-packet without repositoryContext omits that field from the packet", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: AUTH_GOAL }),
    });
    const id = (createBody as Record<string, unknown>)["id"] as string;

    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/task-packet`);
    assert.equal(status, 200);
    const packet = (body as Record<string, unknown>)["packet"] as Record<string, unknown>;
    assertTaskPacketShape(packet, id, AUTH_GOAL);
    assert.equal(packet["repositoryContext"], undefined, "repositoryContext must be absent when not provided");

    const prompt = (body as Record<string, unknown>)["prompt"] as string;
    assert.ok(!prompt.includes("## Repository context"), "prompt must not include Repository context section when absent");
  });
});

// ══════════════════════════════════════════════════════════════
// Group 8 — PR description and export-issue markdown
// ══════════════════════════════════════════════════════════════

test("[billing] GET /api/intent-packs/:id/pr-description returns markdown with all required sections and all pack content", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL, repositoryContext: BILLING_CONTEXT }),
    });
    const pack = createBody as Record<string, unknown>;
    const id = pack["id"] as string;

    // Add notes so we can verify the Notes section appears
    const noteText = "Approved by billing team on 2024-01-15.";
    await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: noteText }),
    });

    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/pr-description`);
    assert.equal(status, 200);
    const markdown = (body as Record<string, unknown>)["markdown"] as string;
    assertPrDescriptionShape(markdown, id, { hasContext: true, notes: noteText });

    // Goal must appear as the title line
    assert.ok(markdown.includes(BILLING_GOAL), "PR description must include the pack's goal text");

    // Every acceptance criterion must appear as a checklist item
    for (const item of pack["acceptanceCriteria"] as string[]) {
      assert.ok(markdown.includes(`- [ ] ${item}`), `PR description must include checklist item: "${item}"`);
    }

    // Every touched area must appear under the Files / areas touched section
    for (const area of pack["touchedAreas"] as string[]) {
      assert.ok(markdown.includes(area), `PR description must include touched area: "${area}"`);
    }

    // Repository context must be embedded
    assert.ok(markdown.includes(BILLING_CONTEXT), "PR description must include the full repository context");

    // Footer must reference the pack id
    assert.ok(markdown.includes(id), "PR description footer must contain the pack id");
  });
});

test("[database] GET /api/intent-packs/:id/pr-description includes all required sections for the DB scenario", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: DB_GOAL, repositoryContext: DB_CONTEXT }),
    });
    const id = (createBody as Record<string, unknown>)["id"] as string;

    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/pr-description`);
    assert.equal(status, 200);
    const markdown = (body as Record<string, unknown>)["markdown"] as string;
    assertPrDescriptionShape(markdown, id, { hasContext: true });
    assert.ok(markdown.includes(DB_GOAL), "PR description must include the DB goal text");
    assert.ok(markdown.includes(DB_CONTEXT), "PR description must include the DB context");
  });
});

test("[billing] GET /api/intent-packs/:id/export-issue returns GitHub Issue markdown with all required sections and pack content", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL, repositoryContext: BILLING_CONTEXT }),
    });
    const pack = createBody as Record<string, unknown>;
    const id = pack["id"] as string;

    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/export-issue`);
    assert.equal(status, 200);
    const markdown = (body as Record<string, unknown>)["markdown"] as string;
    assertIssueMarkdownShape(markdown);

    // Generated objective must be embedded
    assert.ok(markdown.includes(pack["objective"] as string), "issue markdown must include the pack objective");

    // All constraints must appear in the markdown
    for (const constraint of pack["constraints"] as string[]) {
      assert.ok(markdown.includes(constraint), `issue markdown must include constraint: "${constraint}"`);
    }

    // All risks must appear
    for (const risk of pack["risks"] as string[]) {
      assert.ok(markdown.includes(risk), `issue markdown must include risk: "${risk}"`);
    }

    // Repository context section must be present
    assert.ok(markdown.includes("## Repository context"), "issue markdown must include Repository context section");
    assert.ok(markdown.includes(BILLING_CONTEXT), "issue markdown must include the full repository context");
  });
});

test("[auth] POST /api/intent-pack/export-issue returns markdown with all sections and the correct pack shape", async () => {
  await withTestServer(async (baseUrl) => {
    const { status, body } = await fetchJson(`${baseUrl}/api/intent-pack/export-issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: AUTH_GOAL, repositoryContext: AUTH_CONTEXT }),
    });
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;

    const markdown = b["markdown"] as string;
    assertIssueMarkdownShape(markdown);
    // Note: the export-issue route calls generateIntentPack() which returns an IntentPack
    // without repositoryContext — the input context is used for inference only, not surfaced
    // in the non-persistent export-issue markdown. The persisted route (POST /api/intent-pack)
    // stores and surfaces repositoryContext correctly (tested in the billing group above).

    // Pack is returned in the response but not persisted to the store
    const pack = b["pack"] as Record<string, unknown>;
    assert.equal(pack["reasoningMode"], "heuristic");
    assert.ok(Array.isArray(pack["constraints"]) && (pack["constraints"] as string[]).length > 0);
    assert.ok(Array.isArray(pack["touchedAreas"]) && (pack["touchedAreas"] as string[]).length > 0);
    assert.ok(Array.isArray(pack["risks"]) && (pack["risks"] as string[]).length > 0);
    assert.ok(Array.isArray(pack["openQuestions"]) && (pack["openQuestions"] as string[]).length > 0);
    // The repositoryContext influences content generation — verify that auth-domain output appears
    assert.ok(
      (pack["touchedAreas"] as string[]).some((a) => /auth|admin/i.test(a)),
      "auth/admin domain must appear in touchedAreas even for export-issue"
    );
  });
});

// ══════════════════════════════════════════════════════════════
// Group 9 — GitHub issue creation with realistic API response
// ══════════════════════════════════════════════════════════════

test("[billing] POST /api/intent-packs/:id/create-github-issue with realistic GitHub API response returns all expected fields", async () => {
  const githubFetch = makeRealisticGithubFetch(99, "acme-corp", "platform");
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL, repositoryContext: BILLING_CONTEXT }),
    });
    const pack = createBody as Record<string, unknown>;
    const id = pack["id"] as string;

    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/create-github-issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: "acme-corp", repo: "platform", token: "ghp_test_token_for_e2e" }),
    });
    assert.equal(status, 200);
    const b = body as Record<string, unknown>;

    // Response must include issueUrl, issueNumber, and the updated pack
    const expectedUrl = "https://github.com/acme-corp/platform/issues/99";
    assert.equal(b["issueUrl"], expectedUrl, "issueUrl must match the URL from the GitHub API response");
    assert.equal(b["issueNumber"], 99, "issueNumber must match the number from the GitHub API response");

    // The returned pack must have githubIssueUrl set
    const returnedPack = b["pack"] as Record<string, unknown>;
    assert.equal(returnedPack["githubIssueUrl"], expectedUrl, "pack.githubIssueUrl must be set on the returned pack");
    assert.equal(returnedPack["id"], id, "returned pack must have the correct id");
  }, githubFetch);
});

test("[billing] POST /api/intent-packs/:id/create-github-issue persists githubIssueUrl so subsequent GET shows it", async () => {
  const githubFetch = makeRealisticGithubFetch(42, "ghostrail-org", "api");
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL }),
    });
    const id = (createBody as Record<string, unknown>)["id"] as string;

    await fetchJson(`${baseUrl}/api/intent-packs/${id}/create-github-issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: "ghostrail-org", repo: "api", token: "ghp_test_token_for_e2e" }),
    });

    const { status: getStatus, body: getBody } = await fetchJson(`${baseUrl}/api/intent-packs/${id}`);
    assert.equal(getStatus, 200);
    const persisted = getBody as Record<string, unknown>;
    assert.equal(
      persisted["githubIssueUrl"],
      "https://github.com/ghostrail-org/api/issues/42",
      "githubIssueUrl must be persisted and returned on subsequent GET"
    );
  }, githubFetch);
});

// ══════════════════════════════════════════════════════════════
// Group 10 — Duplication: every field of a fully-populated pack preserved
// ══════════════════════════════════════════════════════════════

test("[billing] POST /api/intent-packs/:id/duplicate preserves every field of a fully-populated pack", async () => {
  await withTestServer(async (baseUrl) => {
    const { body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL, repositoryContext: BILLING_CONTEXT }),
    });
    const original = createBody as Record<string, unknown>;
    const id = original["id"] as string;

    // Fully populate optional fields before duplicating
    await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: "Full population test note.",
        tags: ["billing", "sprint-7", "pre-duplicate"],
        status: "approved",
        starred: true,
      }),
    });

    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/duplicate`, {
      method: "POST",
    });
    assert.equal(status, 200);
    const dup = body as Record<string, unknown>;

    // New identity — must differ from original
    assert.match(dup["id"] as string, UUID_RE, "duplicate must have a valid UUID id");
    assert.notEqual(dup["id"], id, "duplicate id must differ from original");
    assert.match(dup["createdAt"] as string, ISO_DATE_RE);

    // All content fields must be preserved exactly
    assert.equal(dup["goal"], BILLING_GOAL);
    assert.equal(dup["repositoryContext"], BILLING_CONTEXT);
    assert.equal(dup["objective"], original["objective"]);
    assert.equal(dup["reasoningMode"], "heuristic");
    assert.deepEqual(dup["constraints"], original["constraints"]);
    assert.deepEqual(dup["nonGoals"], original["nonGoals"]);
    assert.deepEqual(dup["acceptanceCriteria"], original["acceptanceCriteria"]);
    assert.deepEqual(dup["touchedAreas"], original["touchedAreas"]);
    assert.deepEqual(dup["risks"], original["risks"]);
    assert.deepEqual(dup["openQuestions"], original["openQuestions"]);
    // Optional metadata from PATCH must be preserved
    assert.equal(dup["notes"], "Full population test note.");
    assert.deepEqual(dup["tags"], ["billing", "sprint-7", "pre-duplicate"]);
    assert.equal(dup["status"], "approved");
    assert.equal(dup["starred"], true);

    // Original must be unchanged
    const { status: origStatus, body: origBody } = await fetchJson(`${baseUrl}/api/intent-packs/${id}`);
    assert.equal(origStatus, 200);
    assert.equal((origBody as Record<string, unknown>)["id"], id, "original id must be unchanged after duplication");
  });
});

// ══════════════════════════════════════════════════════════════
// Group 11 — Multi-pack list integrity
// ══════════════════════════════════════════════════════════════

test("GET /api/intent-packs returns all created packs sorted newest-first with every field present", async () => {
  await withTestServer(async (baseUrl) => {
    // Create 3 packs with a small delay to ensure distinct timestamps
    const goals = [
      { goal: BILLING_GOAL, repositoryContext: BILLING_CONTEXT },
      { goal: AUTH_GOAL, repositoryContext: AUTH_CONTEXT },
      { goal: DB_GOAL, repositoryContext: DB_CONTEXT },
    ];
    const created: Record<string, unknown>[] = [];
    for (const input of goals) {
      const { body } = await fetchJson(`${baseUrl}/api/intent-pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      created.push(body as Record<string, unknown>);
    }

    const { status, body } = await fetchJson(`${baseUrl}/api/intent-packs`);
    assert.equal(status, 200);
    const packs = body as Record<string, unknown>[];
    assert.equal(packs.length, 3, "list must contain all 3 created packs");

    // Each pack in the list must have complete field coverage
    for (const [i, pack] of packs.entries()) {
      assert.match(pack["id"] as string, UUID_RE, `packs[${i}].id must be a UUID`);
      assert.match(pack["createdAt"] as string, ISO_DATE_RE, `packs[${i}].createdAt must be ISO 8601`);
      assert.ok(typeof pack["goal"] === "string" && (pack["goal"] as string).length > 0, `packs[${i}].goal must be non-empty`);
      assert.equal(pack["reasoningMode"], "heuristic", `packs[${i}].reasoningMode must be heuristic`);
      assert.ok(VALID_CONFIDENCE.has(pack["confidence"] as string), `packs[${i}].confidence must be valid`);
      assert.ok(Array.isArray(pack["constraints"]) && (pack["constraints"] as string[]).length > 0, `packs[${i}].constraints must be non-empty`);
      assert.ok(Array.isArray(pack["touchedAreas"]) && (pack["touchedAreas"] as string[]).length > 0, `packs[${i}].touchedAreas must be non-empty`);
      assert.ok(Array.isArray(pack["risks"]) && (pack["risks"] as string[]).length > 0, `packs[${i}].risks must be non-empty`);
    }

    // packs must be sorted newest-first (createdAt descending)
    for (let i = 0; i < packs.length - 1; i++) {
      const a = packs[i]!["createdAt"] as string;
      const b = packs[i + 1]!["createdAt"] as string;
      assert.ok(a >= b, `packs must be sorted newest-first: packs[${i}].createdAt (${a}) must be >= packs[${i + 1}].createdAt (${b})`);
    }

    // Each pack's id must appear in the original creation responses
    const createdIds = new Set(created.map((c) => c["id"]));
    for (const pack of packs) {
      assert.ok(createdIds.has(pack["id"]), `listed pack id ${pack["id"]} must match a creation response`);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// Group 12 — Complete soup-to-nuts lifecycle (single chained test)
// ══════════════════════════════════════════════════════════════

test("[billing] complete soup-to-nuts lifecycle: generate → list → get → patch → history → analyze-diff → drift-report → task-packet → pr-description → export-issue → create-github-issue → duplicate → delete", async () => {
  const githubFetch = makeRealisticGithubFetch(77, "acme-billing", "platform");

  await withTestServer(async (baseUrl) => {
    // ── Step 1: Generate a pack ──────────────────────────────
    const { status: createStatus, body: createBody } = await fetchJson(`${baseUrl}/api/intent-pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: BILLING_GOAL, repositoryContext: BILLING_CONTEXT }),
    });
    assert.equal(createStatus, 200);
    const pack = createBody as Record<string, unknown>;
    assertStoredIntentPackShape(pack, BILLING_GOAL, BILLING_CONTEXT);
    const id = pack["id"] as string;

    // ── Step 2: Appears in list ──────────────────────────────
    const { status: listStatus, body: listBody } = await fetchJson(`${baseUrl}/api/intent-packs`);
    assert.equal(listStatus, 200);
    const listPacks = listBody as Record<string, unknown>[];
    assert.equal(listPacks.length, 1);
    assert.equal(listPacks[0]!["id"], id);

    // ── Step 3: Round-trip GET ───────────────────────────────
    const { status: getStatus, body: getBody } = await fetchJson(`${baseUrl}/api/intent-packs/${id}`);
    assert.equal(getStatus, 200);
    assert.deepEqual((getBody as Record<string, unknown>)["touchedAreas"], pack["touchedAreas"]);

    // ── Step 4: PATCH notes, tags, status ────────────────────
    await fetchJson(`${baseUrl}/api/intent-packs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: "Lifecycle test note: billing refactor approved.",
        tags: ["billing", "lifecycle-test"],
        status: "in-progress",
      }),
    });

    // ── Step 5: History has 1 entry (notes+tags+status in one patch) ──
    const { body: histBody } = await fetchJson(`${baseUrl}/api/intent-packs/${id}/history`);
    const history = histBody as Array<{ patchedAt: string; before: Record<string, unknown> }>;
    assert.equal(history.length, 1, "one patch with notes+tags+status must create exactly one history entry");
    assert.match(history[0]!.patchedAt, ISO_DATE_RE);
    assert.equal(history[0]!.before["goal"], BILLING_GOAL);

    // ── Step 6: analyze-diff ─────────────────────────────────
    const { status: diffStatus, body: diffBody } = await fetchJson(
      `${baseUrl}/api/intent-packs/${id}/analyze-diff`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diffText: BILLING_DIFF,
          prUrl: "https://github.com/acme-billing/platform/pull/77",
        }),
      }
    );
    assert.equal(diffStatus, 200);
    const changedFiles = (diffBody as Record<string, unknown>)["changedFiles"] as string[];
    assert.equal(changedFiles.length, 4);

    // ── Step 7: drift-report ─────────────────────────────────
    const { status: driftStatus, body: driftBody } = await fetchJson(
      `${baseUrl}/api/intent-packs/${id}/drift-report`
    );
    assert.equal(driftStatus, 200);
    assertDriftReportShape(driftBody as Record<string, unknown>, id);
    assert.notEqual((driftBody as Record<string, unknown>)["status"], "no-data");

    // ── Step 8: task-packet ──────────────────────────────────
    const { status: tpStatus, body: tpBody } = await fetchJson(
      `${baseUrl}/api/intent-packs/${id}/task-packet`
    );
    assert.equal(tpStatus, 200);
    assertTaskPacketShape(
      (tpBody as Record<string, unknown>)["packet"] as Record<string, unknown>,
      id,
      BILLING_GOAL
    );
    assert.ok(typeof (tpBody as Record<string, unknown>)["prompt"] === "string");

    // ── Step 9: pr-description ───────────────────────────────
    const { status: prStatus, body: prBody } = await fetchJson(
      `${baseUrl}/api/intent-packs/${id}/pr-description`
    );
    assert.equal(prStatus, 200);
    assertPrDescriptionShape(
      (prBody as Record<string, unknown>)["markdown"] as string,
      id,
      { hasContext: true, notes: "Lifecycle test note: billing refactor approved." }
    );

    // ── Step 10: export-issue ────────────────────────────────
    const { status: issStatus, body: issBody } = await fetchJson(
      `${baseUrl}/api/intent-packs/${id}/export-issue`
    );
    assert.equal(issStatus, 200);
    assertIssueMarkdownShape((issBody as Record<string, unknown>)["markdown"] as string);

    // ── Step 11: create-github-issue ─────────────────────────
    const { status: ghStatus, body: ghBody } = await fetchJson(
      `${baseUrl}/api/intent-packs/${id}/create-github-issue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: "acme-billing", repo: "platform", token: "ghp_lifecycle_test_token" }),
      }
    );
    assert.equal(ghStatus, 200);
    const ghB = ghBody as Record<string, unknown>;
    assert.equal(ghB["issueUrl"], "https://github.com/acme-billing/platform/issues/77");
    assert.equal(ghB["issueNumber"], 77);
    assert.equal((ghB["pack"] as Record<string, unknown>)["githubIssueUrl"], "https://github.com/acme-billing/platform/issues/77");

    // ── Step 12: duplicate ────────────────────────────────────
    const { status: dupStatus, body: dupBody } = await fetchJson(
      `${baseUrl}/api/intent-packs/${id}/duplicate`,
      { method: "POST" }
    );
    assert.equal(dupStatus, 200);
    const dup = dupBody as Record<string, unknown>;
    assert.notEqual(dup["id"], id, "duplicate must have a new id");
    assert.equal(dup["goal"], BILLING_GOAL, "duplicate must preserve the goal");
    assert.equal(dup["notes"], "Lifecycle test note: billing refactor approved.", "duplicate must preserve notes");

    // List now has 2 packs (original + duplicate)
    const { body: list2Body } = await fetchJson(`${baseUrl}/api/intent-packs`);
    assert.equal((list2Body as Record<string, unknown>[]).length, 2, "list must contain original and duplicate");

    // ── Step 13: delete original ─────────────────────────────
    const { status: delStatus } = await fetchJson(`${baseUrl}/api/intent-packs/${id}`, { method: "DELETE" });
    assert.equal(delStatus, 200);

    // List now has only the duplicate
    const { body: list3Body } = await fetchJson(`${baseUrl}/api/intent-packs`);
    const remaining = list3Body as Record<string, unknown>[];
    assert.equal(remaining.length, 1, "list must contain only the duplicate after deletion");
    assert.equal(remaining[0]!["id"], dup["id"], "remaining pack must be the duplicate");

    // GET original → 404
    const { status: goneStatus } = await fetchJson(`${baseUrl}/api/intent-packs/${id}`);
    assert.equal(goneStatus, 404, "deleted pack must return 404 on GET");
  }, githubFetch);
});
