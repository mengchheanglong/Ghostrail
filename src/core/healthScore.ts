/**
 * healthScore.ts — heuristic pack health scorer.
 *
 * Pure function — no I/O, no side effects.
 * Scores a StoredIntentPack across four quality dimensions and returns
 * a 0–100 score plus per-dimension suggestions.
 */

import type { StoredIntentPack } from "./types.js";

export interface HealthDimension {
  /** Dimension name for display */
  name: string;
  /** 0–100 score for this dimension */
  score: number;
  /** Specific actionable suggestions to improve this dimension. Empty when score >= 80. */
  suggestions: string[];
}

export interface PackHealthResult {
  /** Overall 0–100 score (weighted average of all dimensions) */
  score: number;
  /** "poor" | "fair" | "good" | "excellent" */
  level: "poor" | "fair" | "good" | "excellent";
  /** Per-dimension breakdown */
  dimensions: HealthDimension[];
}

// ── Dimension scorers ────────────────────────────────────────────────────────

/**
 * Dimension 1: Objective specificity
 * Is the goal/objective concrete enough to act on?
 */
function scoreObjectiveSpecificity(pack: StoredIntentPack): HealthDimension {
  const text = (pack.goal || pack.objective || "").trim();
  let score = 40;
  const suggestions: string[] = [];

  if (!text) {
    return { name: "Objective Specificity", score: 0, suggestions: ["Add an original goal to the pack."] };
  }

  // Length bonus
  if (text.length >= 100) score += 25;
  else if (text.length >= 60) score += 15;
  else if (text.length >= 30) score += 5;
  else suggestions.push("The goal is very short — add more context about what success looks like.");

  // Vagueness penalty
  const vagueWords = /\b(improve|refactor|optimize|enhance|fix things|make it better|update the (code|system|app))\b/i;
  if (vagueWords.test(text)) {
    score -= 20;
    suggestions.push("The goal uses vague language (improve/refactor/optimize). Replace with a specific outcome.");
  }

  // Constraint/specificity bonus
  if (/\bdo\s+not\s+break\b|\bwithout\s+breaking\b|\bmust\s+not\b|\bpreserve\b|\bbackward[\s-]?compat/i.test(text)) {
    score += 15;
  }
  if (/\bbecause\b|\bso\s+that\b|\bin\s+order\s+to\b/i.test(text)) {
    score += 10;
  }

  score = Math.max(0, Math.min(100, score));
  if (score < 80 && suggestions.length === 0) {
    suggestions.push("Add a 'because' or 'so that' clause to explain why this change is needed.");
  }

  return { name: "Objective Specificity", score, suggestions: score >= 80 ? [] : suggestions };
}

/**
 * Dimension 2: Acceptance criteria testability
 * Are the criteria concrete and independently verifiable?
 */
function scoreAcceptanceCriteria(pack: StoredIntentPack): HealthDimension {
  const criteria = pack.acceptanceCriteria ?? [];
  let score = 20;
  const suggestions: string[] = [];

  if (criteria.length === 0) {
    return {
      name: "Acceptance Criteria",
      score: 0,
      suggestions: ["Add at least one acceptance criterion."]
    };
  }

  // Coverage bonus
  if (criteria.length >= 4) score += 30;
  else if (criteria.length >= 2) score += 20;
  else score += 10;

  // Testability: look for measurable/verifiable language
  const testablePattern = /\b(returns?|displays?|shows?|hides?|redirects?|saves?|creates?|deletes?|updates?|fails?|throws?|logs?|sends?|receives?|verif|assert|check|confirm|valid|test|pass|succeeds?|works?|allow|prevent|block|enforce|trigger|emit)\b/i;
  const testableCriteria = criteria.filter(c => testablePattern.test(c));

  if (testableCriteria.length >= criteria.length * 0.7) {
    score += 30;
  } else if (testableCriteria.length >= criteria.length * 0.4) {
    score += 15;
    suggestions.push("Some criteria are hard to test — phrase them as observable outcomes (e.g. 'Returns X when Y').");
  } else {
    suggestions.push("Most criteria are not phrased as observable outcomes. Start each with a verb (Returns, Shows, Prevents…).");
  }

  // Detect overly generic criteria
  const genericPattern = /\b(works?|functions?|is correct|is working|is done|is complete|behaves? correctly|is implemented)\b/i;
  const genericCount = criteria.filter(c => genericPattern.test(c)).length;
  if (genericCount > 0) {
    score -= genericCount * 8;
    suggestions.push("Some criteria are generic ('works correctly'). Replace with specific, verifiable conditions.");
  }

  score = Math.max(0, Math.min(100, score));
  return { name: "Acceptance Criteria", score, suggestions: score >= 80 ? [] : suggestions };
}

/**
 * Dimension 3: Constraint completeness
 * Does the pack declare what must NOT change?
 */
function scoreConstraintCompleteness(pack: StoredIntentPack): HealthDimension {
  const constraints = pack.constraints ?? [];
  const nonGoals = pack.nonGoals ?? [];
  let score = 20;
  const suggestions: string[] = [];

  if (constraints.length === 0 && nonGoals.length === 0) {
    return {
      name: "Constraint Completeness",
      score: 0,
      suggestions: ["Add at least one constraint to define what must not change."]
    };
  }

  // Count total guard statements
  const total = constraints.length + nonGoals.length;
  if (total >= 5) score += 40;
  else if (total >= 3) score += 25;
  else score += 10;

  // Look for preservation language in constraints
  const preservationPattern = /\b(preserve|maintain|keep|do\s+not\s+(break|change|alter|modify|remove|delete)|without\s+breaking|backward[\s-]?compat|existing|current behavior)\b/i;
  const hasPreservation = constraints.some(c => preservationPattern.test(c));
  if (hasPreservation) {
    score += 20;
  } else if (constraints.length > 0) {
    suggestions.push("Add a constraint that explicitly preserves existing behavior (e.g. 'Do not break existing X').");
  }

  // Non-goals quality: do they clearly say what is OUT of scope?
  const outOfScopePattern = /\b(do\s+not|don't|not\s+in\s+scope|out\s+of\s+scope|excluded|not\s+required|not\s+needed|skip|avoid)\b/i;
  const hasExplicitNonGoals = nonGoals.some(ng => outOfScopePattern.test(ng));
  if (!hasExplicitNonGoals && nonGoals.length > 0) {
    suggestions.push("Non-goals should explicitly say what is excluded (e.g. 'Do not redesign the admin UI').");
  } else if (hasExplicitNonGoals) {
    score += 10;
  }

  if (nonGoals.length === 0) {
    suggestions.push("Add non-goals to clarify what is explicitly out of scope for this pack.");
  }

  score = Math.max(0, Math.min(100, score));
  return { name: "Constraint Completeness", score, suggestions: score >= 80 ? [] : suggestions };
}

/**
 * Dimension 4: Risk coverage
 * Does the pack surface the real risks?
 */
function scoreRiskCoverage(pack: StoredIntentPack): HealthDimension {
  const risks = pack.risks ?? [];
  const touchedAreas = pack.touchedAreas ?? [];
  let score = 20;
  const suggestions: string[] = [];

  if (risks.length === 0) {
    return {
      name: "Risk Coverage",
      score: 0,
      suggestions: ["Add at least one risk to surface what could go wrong."]
    };
  }

  // Count bonus
  if (risks.length >= 4) score += 30;
  else if (risks.length >= 2) score += 20;
  else score += 10;

  // Check for specificity in risk descriptions
  const specificRiskPattern = /\b(regression|break|fail|corrupt|expose|leak|unauthori[sz]ed|overflow|conflict|race|inconsistent|missing|stale|deadlock|timeout|loop|cascade|drift)\b/i;
  const specificRisks = risks.filter(r => specificRiskPattern.test(r));
  if (specificRisks.length >= risks.length * 0.5) {
    score += 25;
  } else {
    suggestions.push("Risks should name specific failure modes (regression, data corruption, auth bypass…).");
  }

  // If touchedAreas includes sensitive areas, check risks mention them
  const sensitiveAreas = ["billing", "payment", "auth", "authentication", "admin", "database", "schema", "security"];
  const touchedSensitive = touchedAreas.filter(a =>
    sensitiveAreas.some(s => a.toLowerCase().includes(s))
  );
  if (touchedSensitive.length > 0) {
    const riskText = risks.join(" ").toLowerCase();
    const covered = touchedSensitive.filter(a =>
      sensitiveAreas.some(s => a.toLowerCase().includes(s) && riskText.includes(s))
    );
    if (covered.length < touchedSensitive.length) {
      score -= 10;
      suggestions.push(`Pack touches sensitive areas (${touchedSensitive.join(", ")}) — add explicit risks for each.`);
    } else {
      score += 10;
    }
  }

  // Generic risk penalty
  const genericRiskPattern = /\b(something might go wrong|unexpected behavior|could cause issues|may break|might break)\b/i;
  const genericRisks = risks.filter(r => genericRiskPattern.test(r));
  if (genericRisks.length > 0) {
    score -= genericRisks.length * 8;
    suggestions.push("Replace generic risks ('might break') with specific failure modes.");
  }

  score = Math.max(0, Math.min(100, score));
  return { name: "Risk Coverage", score, suggestions: score >= 80 ? [] : suggestions };
}

// ── Weights ───────────────────────────────────────────────────────────────────

const DIMENSION_WEIGHTS = {
  "Objective Specificity": 0.30,
  "Acceptance Criteria":   0.30,
  "Constraint Completeness": 0.20,
  "Risk Coverage":          0.20,
};

// ── Main scorer ───────────────────────────────────────────────────────────────

/**
 * Compute a heuristic health score for a StoredIntentPack.
 * Pure function — no I/O, no side effects.
 */
export function computePackHealth(pack: StoredIntentPack): PackHealthResult {
  const dims: HealthDimension[] = [
    scoreObjectiveSpecificity(pack),
    scoreAcceptanceCriteria(pack),
    scoreConstraintCompleteness(pack),
    scoreRiskCoverage(pack),
  ];

  // Weighted average
  let weightedSum = 0;
  let totalWeight = 0;
  for (const dim of dims) {
    const w = DIMENSION_WEIGHTS[dim.name as keyof typeof DIMENSION_WEIGHTS] ?? 0.25;
    weightedSum += dim.score * w;
    totalWeight += w;
  }
  const score = Math.round(totalWeight > 0 ? weightedSum / totalWeight : 0);

  const level: PackHealthResult["level"] =
    score >= 80 ? "excellent" :
    score >= 60 ? "good" :
    score >= 35 ? "fair" :
    "poor";

  return { score, level, dimensions: dims };
}
