function renderList(items) {
    return items.map((item) => `- ${item}`).join("\n");
}
export function toGitHubIssueMarkdown(pack) {
    return `# Ghostrail Task Packet

## Objective
${pack.objective}

## Non-goals
${renderList(pack.nonGoals)}

## Constraints
${renderList(pack.constraints)}

## Acceptance criteria
${renderList(pack.acceptanceCriteria)}

## Touched areas
${renderList(pack.touchedAreas)}

## Risks
${renderList(pack.risks)}

## Open questions
${renderList(pack.openQuestions)}

## Review note
Keep the implementation incremental and easy to review. Prefer minimal surface-area changes over broad refactors.
`;
}
