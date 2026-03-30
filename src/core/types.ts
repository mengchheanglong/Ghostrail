export interface IntentPackInput {
  goal: string;
  repositoryContext?: string;
}

export interface IntentPack {
  objective: string;
  nonGoals: string[];
  constraints: string[];
  acceptanceCriteria: string[];
  touchedAreas: string[];
  risks: string[];
  openQuestions: string[];
  confidence: "low" | "medium" | "high";
  reasoningMode: "heuristic" | "llm";
}

export type PackStatus = "draft" | "approved" | "in-progress" | "done" | "blocked" | "abandoned";

export const VALID_STATUSES: PackStatus[] = [
  "draft",
  "approved",
  "in-progress",
  "done",
  "blocked",
  "abandoned",
];

export interface StoredIntentPack extends IntentPack {
  id: string;
  createdAt: string;
  goal?: string;
  repositoryContext?: string;
  notes?: string;
  tags?: string[];
  starred?: boolean;
  archived?: boolean;
  status?: PackStatus;
  prLink?: string;
  changedFiles?: string[];
  policyWarnings?: string[];
}
