import { includesAny, normalizeWhitespace, splitSentences, unique } from "./text.js";
const protectedAreaHints = [
    "billing",
    "payment",
    "auth",
    "authentication",
    "admin",
    "subscription",
    "database",
    "schema",
    "migration",
    "security"
];
export function generateIntentPack(input) {
    const goal = normalizeWhitespace(input.goal);
    const repositoryContext = normalizeWhitespace(input.repositoryContext ?? "");
    const combined = `${goal} ${repositoryContext}`.trim().toLowerCase();
    const constraints = inferConstraints(goal, repositoryContext);
    const nonGoals = inferNonGoals(goal, repositoryContext);
    const acceptanceCriteria = inferAcceptanceCriteria(goal, repositoryContext);
    const touchedAreas = inferTouchedAreas(goal, repositoryContext);
    const risks = inferRisks(goal, repositoryContext);
    const openQuestions = inferOpenQuestions(goal, repositoryContext);
    return {
        objective: goal,
        nonGoals,
        constraints,
        acceptanceCriteria,
        touchedAreas,
        risks,
        openQuestions,
        confidence: scoreConfidence(combined),
        reasoningMode: "heuristic"
    };
}
function inferConstraints(goal, repositoryContext) {
    const text = `${goal} ${repositoryContext}`.toLowerCase();
    const constraints = [];
    if (text.includes("do not break") || text.includes("without breaking")) {
        constraints.push("Preserve existing behavior in the areas explicitly marked as sensitive.");
    }
    if (includesAny(text, ["existing", "current", "backward compatible", "compatibility"])) {
        constraints.push("Keep the change backward compatible unless an intentional breaking change is declared.");
    }
    if (includesAny(text, ["subscription", "payment", "billing"])) {
        constraints.push("Protect payment and billing flows from unintended side effects.");
    }
    if (includesAny(text, ["auth", "authentication", "login", "permission", "admin"])) {
        constraints.push("Preserve authorization boundaries and existing access control behavior.");
    }
    if (includesAny(text, ["database", "schema", "migration"])) {
        constraints.push("Avoid destructive schema changes without an explicit migration and rollback plan.");
    }
    if (constraints.length === 0) {
        constraints.push("Keep the first implementation incremental and easy to review.");
    }
    return unique(constraints);
}
function inferNonGoals(goal, repositoryContext) {
    const text = `${goal} ${repositoryContext}`.toLowerCase();
    const nonGoals = [
        "Do not perform unrelated refactors.",
        "Do not change product scope beyond the stated objective."
    ];
    if (includesAny(text, ["admin"])) {
        nonGoals.push("Do not redesign the admin experience unless it is required for the feature to work.");
    }
    if (includesAny(text, ["billing", "payment", "subscription"])) {
        nonGoals.push("Do not alter existing billing rules outside the requested feature.");
    }
    if (includesAny(text, ["analytics", "dashboard"])) {
        nonGoals.push("Do not rewrite analytics pipelines unless the request explicitly asks for it.");
    }
    return unique(nonGoals);
}
function inferAcceptanceCriteria(goal, repositoryContext) {
    const text = `${goal} ${repositoryContext}`.toLowerCase();
    const criteria = [
        "The requested behavior works for the core happy path.",
        "Existing sensitive flows continue to work after the change.",
        "The change is narrow enough to review quickly."
    ];
    if (includesAny(text, ["subscription", "upgrade", "downgrade"])) {
        criteria.push("Subscription state transitions behave correctly for upgrade and downgrade paths.");
    }
    if (includesAny(text, ["payment", "billing"])) {
        criteria.push("Payment-related behavior is covered by tests or explicit validation steps.");
    }
    if (includesAny(text, ["admin"])) {
        criteria.push("Admin flows required by the feature continue to function correctly.");
    }
    return unique(criteria);
}
function inferTouchedAreas(goal, repositoryContext) {
    const text = `${goal} ${repositoryContext}`.toLowerCase();
    const touched = [];
    for (const hint of protectedAreaHints) {
        if (text.includes(hint)) {
            touched.push(hint);
        }
    }
    if (touched.length === 0) {
        const firstSentence = splitSentences(goal)[0];
        if (firstSentence) {
            touched.push(firstSentence);
        }
    }
    return unique(touched);
}
function inferRisks(goal, repositoryContext) {
    const text = `${goal} ${repositoryContext}`.toLowerCase();
    const risks = [
        "The request may hide assumptions that should be clarified before implementation."
    ];
    if (includesAny(text, ["billing", "payment", "subscription"])) {
        risks.push("Financial logic drift could break existing monetization flows.");
    }
    if (includesAny(text, ["auth", "permission", "admin"])) {
        risks.push("Authorization regressions could expose restricted actions.");
    }
    if (includesAny(text, ["database", "schema", "migration"])) {
        risks.push("Data model changes could create migration or rollback problems.");
    }
    if (includesAny(text, ["analytics", "report"])) {
        risks.push("Silent analytics regressions may not be visible without explicit checks.");
    }
    return unique(risks);
}
function inferOpenQuestions(goal, repositoryContext) {
    const text = `${goal} ${repositoryContext}`.toLowerCase();
    const questions = [];
    if (includesAny(text, ["billing", "payment", "subscription"])) {
        questions.push("What exact billing behaviors are protected and must remain unchanged?");
    }
    if (includesAny(text, ["admin"])) {
        questions.push("Which admin actions are in scope versus out of scope?");
    }
    if (includesAny(text, ["database", "schema", "migration"])) {
        questions.push("Does the change require a schema migration or can it remain read-compatible?");
    }
    if (questions.length === 0) {
        questions.push("What part of the request would cause the most damage if implemented incorrectly?");
    }
    return unique(questions);
}
function scoreConfidence(text) {
    if (text.length > 140 && includesAny(text, ["because", "must", "should", "existing", "do not break"])) {
        return "high";
    }
    if (text.length > 60) {
        return "medium";
    }
    return "low";
}
