import test from "node:test";
import assert from "node:assert/strict";
import { generateIntentPack } from "./core/generateIntentPack.js";
import { toGitHubIssueMarkdown } from "./core/issueMarkdown.js";
import type { IntentPack } from "./core/types.js";

const basePack: IntentPack = {
  objective: "Do a thing",
  nonGoals: ["Not this"],
  constraints: ["Keep it safe"],
  acceptanceCriteria: ["Tests pass"],
  touchedAreas: ["auth"],
  risks: ["Breaking stuff"],
  openQuestions: ["Timeline?"],
  confidence: "medium",
  reasoningMode: "heuristic",
};

test("generateIntentPack extracts billing-related guardrails", () => {
  const pack = generateIntentPack({
    goal: "Add subscription upgrade flow but do not break current billing behavior.",
    repositoryContext: "Node backend with admin dashboard and payment logic."
  });

  assert.equal(pack.reasoningMode, "heuristic");
  assert.ok(pack.constraints.some((item) => item.toLowerCase().includes("billing")));
  assert.ok(pack.nonGoals.some((item) => item.toLowerCase().includes("billing")));
  assert.ok(pack.risks.some((item) => item.toLowerCase().includes("financial")));
  assert.ok(pack.openQuestions.some((item) => item.toLowerCase().includes("billing")));
});

test("toGitHubIssueMarkdown renders key sections", () => {
  const pack = generateIntentPack({
    goal: "Add role checks for admin actions without breaking current auth behavior."
  });

  const markdown = toGitHubIssueMarkdown(pack);

  assert.match(markdown, /## Objective/);
  assert.match(markdown, /## Non-goals/);
  assert.match(markdown, /## Constraints/);
  assert.match(markdown, /## Acceptance criteria/);
  assert.match(markdown, /## Risks/);
});

test("toGitHubIssueMarkdown includes tags when present", () => {
  const markdown = toGitHubIssueMarkdown({ ...basePack, tags: ["backend", "auth"] });
  assert.match(markdown, /\*\*Tags:\*\* backend, auth/);
});

test("toGitHubIssueMarkdown includes notes when present", () => {
  const markdown = toGitHubIssueMarkdown({ ...basePack, notes: "Important context here." });
  assert.match(markdown, /## Notes/);
  assert.match(markdown, /Important context here\./);
});

test("toGitHubIssueMarkdown omits tags when absent or empty", () => {
  const withoutTags = toGitHubIssueMarkdown(basePack);
  assert.doesNotMatch(withoutTags, /\*\*Tags:\*\*/);

  const withEmptyTags = toGitHubIssueMarkdown({ ...basePack, tags: [] });
  assert.doesNotMatch(withEmptyTags, /\*\*Tags:\*\*/);
});

test("toGitHubIssueMarkdown omits notes when absent or blank", () => {
  const withoutNotes = toGitHubIssueMarkdown(basePack);
  assert.doesNotMatch(withoutNotes, /## Notes/);

  const withBlankNotes = toGitHubIssueMarkdown({ ...basePack, notes: "   " });
  assert.doesNotMatch(withBlankNotes, /## Notes/);
});

test("toGitHubIssueMarkdown exports safely for older packs without notes or tags", () => {
  // Plain IntentPack without notes or tags — must not throw or produce extra sections
  const markdown = toGitHubIssueMarkdown(basePack);
  assert.match(markdown, /## Objective/);
  assert.match(markdown, /## Review note/);
  assert.doesNotMatch(markdown, /## Notes/);
  assert.doesNotMatch(markdown, /\*\*Tags:\*\*/);
});

test("toGitHubIssueMarkdown includes repositoryContext when present", () => {
  const markdown = toGitHubIssueMarkdown({ ...basePack, repositoryContext: "Node backend with auth module." });
  assert.match(markdown, /## Repository context/);
  assert.match(markdown, /Node backend with auth module\./);
});

test("toGitHubIssueMarkdown omits repositoryContext when absent", () => {
  const markdown = toGitHubIssueMarkdown(basePack);
  assert.doesNotMatch(markdown, /## Repository context/);
});

test("toGitHubIssueMarkdown omits repositoryContext when blank or whitespace-only", () => {
  const markdown = toGitHubIssueMarkdown({ ...basePack, repositoryContext: "   " });
  assert.doesNotMatch(markdown, /## Repository context/);
});

test("toGitHubIssueMarkdown exports older pack (no repositoryContext) with notes and tags intact", () => {
  const markdown = toGitHubIssueMarkdown({ ...basePack, notes: "A note.", tags: ["api"] });
  assert.doesNotMatch(markdown, /## Repository context/);
  assert.match(markdown, /## Notes/);
  assert.match(markdown, /\*\*Tags:\*\* api/);
});
