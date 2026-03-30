import test from "node:test";
import assert from "node:assert/strict";
import { parseGitDiff } from "./core/diffParser.js";

// ── Empty / trivial inputs ────────────────────────────────────

test("parseGitDiff returns empty array for empty string", () => {
  assert.deepEqual(parseGitDiff(""), []);
});

test("parseGitDiff returns empty array for whitespace-only input", () => {
  assert.deepEqual(parseGitDiff("   \n  \t  "), []);
});

test("parseGitDiff returns empty array for non-diff text", () => {
  assert.deepEqual(parseGitDiff("hello world\nno diff here"), []);
});

// ── Modified file ─────────────────────────────────────────────

test("parseGitDiff extracts path from a modified file diff", () => {
  const diff = `diff --git a/src/billing.ts b/src/billing.ts
index abc123..def456 100644
--- a/src/billing.ts
+++ b/src/billing.ts
@@ -1,5 +1,6 @@
 export function charge() {}
+export function refund() {}
`;
  const files = parseGitDiff(diff);
  assert.deepEqual(files, ["src/billing.ts"]);
});

// ── New file ──────────────────────────────────────────────────

test("parseGitDiff extracts path from a new file diff", () => {
  const diff = `diff --git a/src/newfeature.ts b/src/newfeature.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/newfeature.ts
@@ -0,0 +1,3 @@
+export function doSomething() {}
`;
  const files = parseGitDiff(diff);
  assert.deepEqual(files, ["src/newfeature.ts"]);
});

// ── Deleted file ──────────────────────────────────────────────

test("parseGitDiff extracts path from a deleted file diff", () => {
  const diff = `diff --git a/src/legacy.ts b/src/legacy.ts
deleted file mode 100644
index abc1234..0000000
--- a/src/legacy.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function old() {}
`;
  const files = parseGitDiff(diff);
  assert.deepEqual(files, ["src/legacy.ts"]);
});

// ── Renamed file ──────────────────────────────────────────────

test("parseGitDiff captures both old and new paths for a rename", () => {
  const diff = `diff --git a/src/auth/login.ts b/src/auth/signin.ts
similarity index 95%
rename from src/auth/login.ts
rename to src/auth/signin.ts
index abc..def 100644
`;
  const files = parseGitDiff(diff);
  assert.ok(files.includes("src/auth/login.ts"), "should include old (rename from) path");
  assert.ok(files.includes("src/auth/signin.ts"), "should include new (rename to) path");
});

// ── Multiple files ────────────────────────────────────────────

test("parseGitDiff extracts multiple files from a multi-file diff", () => {
  const diff = `diff --git a/src/billing.ts b/src/billing.ts
index abc..def 100644
--- a/src/billing.ts
+++ b/src/billing.ts
@@ -1 +1 @@
-old
+new
diff --git a/src/auth/middleware.ts b/src/auth/middleware.ts
index aaa..bbb 100644
--- a/src/auth/middleware.ts
+++ b/src/auth/middleware.ts
@@ -1 +1 @@
-old
+new
diff --git a/src/payment/processor.ts b/src/payment/processor.ts
new file mode 100644
--- /dev/null
+++ b/src/payment/processor.ts
@@ -0,0 +1 @@
+export function process() {}
`;
  const files = parseGitDiff(diff);
  assert.deepEqual(files, [
    "src/auth/middleware.ts",
    "src/billing.ts",
    "src/payment/processor.ts",
  ]);
});

// ── Deduplication ─────────────────────────────────────────────

test("parseGitDiff deduplicates paths that appear from both --- and +++ lines", () => {
  const diff = `diff --git a/src/billing.ts b/src/billing.ts
--- a/src/billing.ts
+++ b/src/billing.ts
@@ -1 +1 @@
 unchanged
`;
  // src/billing.ts appears twice (from --- and from +++), but should appear once
  const files = parseGitDiff(diff);
  assert.equal(files.filter((f) => f === "src/billing.ts").length, 1);
});

test("parseGitDiff deduplicates when rename-from and --- produce the same path", () => {
  const diff = `diff --git a/src/old.ts b/src/new.ts
rename from src/old.ts
rename to src/new.ts
--- a/src/old.ts
+++ b/src/new.ts
`;
  const files = parseGitDiff(diff);
  const oldCount = files.filter((f) => f === "src/old.ts").length;
  const newCount = files.filter((f) => f === "src/new.ts").length;
  assert.equal(oldCount, 1, "old path should appear exactly once");
  assert.equal(newCount, 1, "new path should appear exactly once");
});

// ── Binary file ───────────────────────────────────────────────

test("parseGitDiff extracts paths from binary file diff", () => {
  const diff = `diff --git a/assets/logo.png b/assets/logo.png
index abc..def 100644
Binary files a/assets/logo.png and b/assets/logo.png differ
`;
  const files = parseGitDiff(diff);
  assert.ok(files.includes("assets/logo.png"), "should include binary file path");
});

// ── Sorting ───────────────────────────────────────────────────

test("parseGitDiff returns paths in sorted order", () => {
  const diff = `diff --git a/src/z.ts b/src/z.ts
--- a/src/z.ts
+++ b/src/z.ts
@@ -1 +1 @@
 z
diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1 @@
 a
diff --git a/src/m.ts b/src/m.ts
--- a/src/m.ts
+++ b/src/m.ts
@@ -1 +1 @@
 m
`;
  const files = parseGitDiff(diff);
  assert.deepEqual(files, ["src/a.ts", "src/m.ts", "src/z.ts"]);
});

// ── Realistic full diff ───────────────────────────────────────

test("parseGitDiff handles a realistic multi-hunk diff correctly", () => {
  const diff = `diff --git a/src/billing/invoice.ts b/src/billing/invoice.ts
index 1111111..2222222 100644
--- a/src/billing/invoice.ts
+++ b/src/billing/invoice.ts
@@ -10,7 +10,8 @@ export class Invoice {
   private id: string;
 
   constructor(id: string) {
-    this.id = id;
+    if (!id) throw new Error("id required");
+    this.id = id;
   }
 }
diff --git a/src/billing/receipt.ts b/src/billing/receipt.ts
new file mode 100644
index 0000000..aaaaaaa
--- /dev/null
+++ b/src/billing/receipt.ts
@@ -0,0 +1,5 @@
+export class Receipt {}
diff --git a/tests/billing.test.ts b/tests/billing.test.ts
index 3333333..4444444 100644
--- a/tests/billing.test.ts
+++ b/tests/billing.test.ts
@@ -1,3 +1,4 @@
 import { Invoice } from "../src/billing/invoice.js";
+import { Receipt } from "../src/billing/receipt.js";
`;
  const files = parseGitDiff(diff);
  assert.deepEqual(files, [
    "src/billing/invoice.ts",
    "src/billing/receipt.ts",
    "tests/billing.test.ts",
  ]);
});

// ── Deeply nested paths ───────────────────────────────────────

test("parseGitDiff handles deeply nested file paths", () => {
  const diff = `diff --git a/packages/core/src/utils/string/format.ts b/packages/core/src/utils/string/format.ts
--- a/packages/core/src/utils/string/format.ts
+++ b/packages/core/src/utils/string/format.ts
@@ -1 +1 @@
 export {};
`;
  const files = parseGitDiff(diff);
  assert.deepEqual(files, ["packages/core/src/utils/string/format.ts"]);
});

// ── Edge: Only diff --git header, no hunk headers ─────────────

test("parseGitDiff handles new binary files where both sides are non-null", () => {
  const diff = `Binary files a/data/seed.db and b/data/seed.db differ`;
  const files = parseGitDiff(diff);
  assert.deepEqual(files, ["data/seed.db"]);
});

// ── Output is deterministic ───────────────────────────────────

test("parseGitDiff output is deterministic for the same input", () => {
  const diff = `diff --git a/src/api.ts b/src/api.ts
--- a/src/api.ts
+++ b/src/api.ts
@@ -1 +1 @@
 export {};
`;
  assert.deepEqual(parseGitDiff(diff), parseGitDiff(diff));
});
