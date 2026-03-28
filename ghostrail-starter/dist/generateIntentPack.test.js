import test from "node:test";
import assert from "node:assert/strict";
import { generateIntentPack } from "./core/generateIntentPack.js";
import { toGitHubIssueMarkdown } from "./core/issueMarkdown.js";
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
