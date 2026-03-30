import type { StoredIntentPack } from "./types.js";

export interface TaskPacketJson {
  schemaVersion: "1";
  id: string;
  goal: string;
  objective: string;
  constraints: string[];
  nonGoals: string[];
  acceptanceCriteria: string[];
  touchedAreas: string[];
  risks: string[];
  openQuestions: string[];
  repositoryContext?: string;
  createdAt: string;
}

/**
 * Returns a machine-readable JSON task packet suitable for passing to a coding agent
 * or storing as structured intent data.
 */
export function toTaskPacketJson(pack: StoredIntentPack): TaskPacketJson {
  const packet: TaskPacketJson = {
    schemaVersion: "1",
    id: pack.id,
    goal: pack.goal ?? pack.objective,
    objective: pack.objective,
    constraints: pack.constraints,
    nonGoals: pack.nonGoals,
    acceptanceCriteria: pack.acceptanceCriteria,
    touchedAreas: pack.touchedAreas,
    risks: pack.risks,
    openQuestions: pack.openQuestions,
    createdAt: pack.createdAt,
  };
  if (pack.repositoryContext) {
    packet.repositoryContext = pack.repositoryContext;
  }
  return packet;
}

function renderChecklist(items: string[]): string {
  return items.map((item) => `- [ ] ${item}`).join("\n");
}

function renderBullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

/**
 * Returns a copy-ready prompt/task string for a coding agent.
 * The format is deterministic and suitable for direct inclusion in a Copilot,
 * Claude, Codex, or similar agent context.
 */
export function toAgentPrompt(pack: StoredIntentPack): string {
  const lines: string[] = [];

  lines.push("You are an AI coding agent. Your task is precisely scoped below.");
  lines.push("Read every section carefully before writing any code.");
  lines.push("");
  lines.push("## Task");
  lines.push(pack.goal ?? pack.objective);
  lines.push("");

  if (pack.repositoryContext) {
    lines.push("## Repository context");
    lines.push(pack.repositoryContext);
    lines.push("");
  }

  lines.push("## Objective");
  lines.push(pack.objective);
  lines.push("");

  lines.push("## Constraints (you MUST follow all of these)");
  lines.push(renderBullets(pack.constraints));
  lines.push("");

  lines.push("## Do NOT do any of the following (non-goals)");
  lines.push(renderBullets(pack.nonGoals));
  lines.push("");

  lines.push("## Acceptance criteria");
  lines.push("Your work is complete only when every item below is satisfied:");
  lines.push(renderChecklist(pack.acceptanceCriteria));
  lines.push("");

  lines.push("## Files and areas expected to be touched");
  lines.push(renderBullets(pack.touchedAreas));
  lines.push("");

  lines.push("## Known risks (take extra care here)");
  lines.push(renderBullets(pack.risks));
  lines.push("");

  if (pack.openQuestions.length > 0) {
    lines.push("## Open questions");
    lines.push("Resolve or explicitly flag each of the following before declaring done:");
    lines.push(renderBullets(pack.openQuestions));
    lines.push("");
  }

  lines.push("---");
  lines.push(
    "Keep your implementation incremental and easy to review. " +
    "Make only the changes required to satisfy the acceptance criteria above. " +
    "Do not expand scope beyond what is listed."
  );

  return lines.join("\n");
}
