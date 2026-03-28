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

export interface StoredIntentPack extends IntentPack {
  id: string;
  createdAt: string;
  goal?: string;
  repositoryContext?: string;
  notes?: string;
  tags?: string[];
}
