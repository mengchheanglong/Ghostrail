export interface IntentPack {
  id: string;
  schemaVersion: number;
  goal?: string;
  objective: string;
  constraints: string[];
  nonGoals: string[];
  acceptanceCriteria: string[];
  touchedAreas: string[];
  risks: string[];
  openQuestions: string[];
  repositoryContext?: string;
  createdAt: string;
  reasoningMode: "heuristic" | "llm" | "stub";
  confidence: "high" | "medium" | "low";
  notes?: string;
  tags?: string[];
  status?: string;
  policyWarnings?: string[];
  starred?: boolean;
  archived?: boolean;
  githubIssueUrl?: string;
}
