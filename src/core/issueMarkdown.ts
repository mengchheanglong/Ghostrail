import type { IntentPack } from "./types.js";

function renderList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function toGitHubIssueMarkdown(
  pack: IntentPack & { notes?: string; tags?: string[] }
): string {
  const tagsLine =
    pack.tags && pack.tags.length > 0
      ? `\n**Tags:** ${pack.tags.join(", ")}\n`
      : "";

  const notesSection =
    pack.notes && pack.notes.trim()
      ? `\n## Notes\n${pack.notes.trim()}\n`
      : "";

  return `# Ghostrail Task Packet

## Objective
${pack.objective}
${tagsLine}
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
${notesSection}
## Review note
Keep the implementation incremental and easy to review. Prefer minimal surface-area changes over broad refactors.
`;
}
