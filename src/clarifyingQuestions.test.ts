import test from "node:test";
import assert from "node:assert/strict";
import { generateClarifyingQuestions } from "./core/clarifyingQuestions.js";

test("returns 3 questions for a vague goal with no signals", () => {
  const qs = generateClarifyingQuestions("Add notifications");
  assert.equal(qs.length, 3);
});

test("returns 0 questions for a goal that covers all three gaps", () => {
  const qs = generateClarifyingQuestions(
    "Add subscription upgrade flow only for premium accounts " +
      "without breaking existing billing flows. Done when the upgrade confirmation tests pass."
  );
  assert.equal(qs.length, 0);
});

test("omits scope question when 'only' is present in goal", () => {
  const qs = generateClarifyingQuestions("Only add the login page");
  assert.ok(
    !qs.some((q) => q.includes("out of scope")),
    "should not ask about scope when 'only' is present"
  );
});

test("omits constraint question when 'do not break' is in goal", () => {
  const qs = generateClarifyingQuestions(
    "Add notifications, do not break existing alert flow"
  );
  assert.ok(
    !qs.some((q) => q.includes("unchanged")),
    "should not ask about constraints when 'do not break' is present"
  );
});

test("omits constraint question when 'preserve' is in goal", () => {
  const qs = generateClarifyingQuestions(
    "Add notifications while preserving the current email alert system"
  );
  assert.ok(
    !qs.some((q) => q.includes("unchanged")),
    "should not ask about constraints when 'preserve' is present"
  );
});

test("omits acceptance question when 'done when' is in goal", () => {
  const qs = generateClarifyingQuestions(
    "Add notifications, done when all tests pass"
  );
  assert.ok(
    !qs.some((q) => q.includes("verify")),
    "should not ask about acceptance when 'done when' is present"
  );
});

test("returns at most 3 questions regardless of input", () => {
  const qs = generateClarifyingQuestions("do stuff");
  assert.ok(qs.length <= 3, "should never return more than 3 questions");
});

test("empty context string is treated the same as absent context", () => {
  const withNull = generateClarifyingQuestions("Add notifications");
  const withEmpty = generateClarifyingQuestions("Add notifications", "");
  assert.deepStrictEqual(withNull, withEmpty);
});

test("omits scope question when 'specifically' is in goal", () => {
  const qs = generateClarifyingQuestions(
    "Add billing notifications specifically for failed payments"
  );
  assert.ok(
    !qs.some((q) => q.includes("out of scope")),
    "should not ask about scope when 'specifically' is present"
  );
});

test("all returned questions are non-empty strings", () => {
  const qs = generateClarifyingQuestions("Add a new feature");
  assert.ok(
    qs.every((q) => typeof q === "string" && q.trim().length > 0),
    "all questions should be non-empty strings"
  );
});
