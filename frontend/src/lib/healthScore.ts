import type { IntentPack } from "../types";

export interface HealthDimension {
  name: string;
  score: number;
  suggestions: string[];
}

export interface PackHealthResult {
  score: number;
  level: "poor" | "fair" | "good" | "excellent";
  dimensions: HealthDimension[];
}

function scoreObjectiveSpecificity(pack: IntentPack): HealthDimension {
  const text = (pack.goal || pack.objective || "").trim();
  let score = 40;
  const suggestions: string[] = [];

  if (!text) {
    return { name: "Objective Specificity", score: 0, suggestions: ["Add an original goal to the pack."] };
  }

  if (text.length >= 100) score += 25;
  else if (text.length >= 60) score += 15;
  else if (text.length >= 30) score += 5;
  else suggestions.push("The goal is very short — add more context about what success looks like.");

  const vagueWords = /\b(improve|refactor|optimize|enhance|fix things|make it better|update the (code|system|app))\b/i;
  if (vagueWords.test(text)) {
    score -= 20;
    suggestions.push("The goal uses vague language. Replace with a specific outcome.");
  }

  if (/\bdo\s+not\s+break\b|\bwithout\s+breaking\b|\bmust\s+not\b|\bpreserve\b|\bbackward[\s-]?compat/i.test(text)) score += 15;
  if (/\bbecause\b|\bso\s+that\b|\bin\s+order\s+to\b/i.test(text)) score += 10;

  score = Math.max(0, Math.min(100, score));
  if (score < 80 && suggestions.length === 0) suggestions.push("Add a 'because' or 'so that' clause to explain why this change is needed.");

  return { name: "Objective Specificity", score, suggestions: score >= 80 ? [] : suggestions };
}

function scoreAcceptanceCriteria(pack: IntentPack): HealthDimension {
  const criteria = pack.acceptanceCriteria ?? [];
  let score = 20;
  const suggestions: string[] = [];

  if (criteria.length === 0) return { name: "Acceptance Criteria", score: 0, suggestions: ["Add at least one acceptance criterion."] };

  if (criteria.length >= 4) score += 30;
  else if (criteria.length >= 2) score += 20;
  else score += 10;

  const testablePattern = /\b(returns?|displays?|shows?|hides?|redirects?|saves?|creates?|deletes?|updates?|fails?|throws?|logs?|sends?|receives?|verif|assert|check|confirm|valid|test|pass|succeeds?|works?|allow|prevent|block|enforce|trigger|emit)\b/i;
  const testableCriteria = criteria.filter(c => testablePattern.test(c));

  if (testableCriteria.length >= criteria.length * 0.7) score += 30;
  else if (testableCriteria.length >= criteria.length * 0.4) {
    score += 15;
    suggestions.push("Some criteria are hard to test — phrase them as observable outcomes.");
  } else {
    suggestions.push("Most criteria are not phrased as observable outcomes.");
  }

  const genericPattern = /\b(works?|functions?|is correct|is working|is done|is complete|behaves? correctly|is implemented)\b/i;
  const genericCount = criteria.filter(c => genericPattern.test(c)).length;
  if (genericCount > 0) {
    score -= genericCount * 8;
    suggestions.push("Some criteria are generic. Replace with specific, verifiable conditions.");
  }

  score = Math.max(0, Math.min(100, score));
  return { name: "Acceptance Criteria", score, suggestions: score >= 80 ? [] : suggestions };
}

function scoreConstraintCompleteness(pack: IntentPack): HealthDimension {
  const constraints = pack.constraints ?? [];
  const nonGoals = pack.nonGoals ?? [];
  let score = 20;
  const suggestions: string[] = [];

  if (constraints.length === 0 && nonGoals.length === 0) return { name: "Constraint Completeness", score: 0, suggestions: ["Add at least one constraint to define what must not change."] };

  const total = constraints.length + nonGoals.length;
  if (total >= 5) score += 40;
  else if (total >= 3) score += 25;
  else score += 10;

  const preservationPattern = /\b(preserve|maintain|keep|do\s+not\s+(break|change|alter|modify|remove|delete)|without\s+breaking|backward[\s-]?compat|existing|current behavior)\b/i;
  const hasPreservation = constraints.some(c => preservationPattern.test(c));
  if (hasPreservation) score += 20;
  else if (constraints.length > 0) suggestions.push("Add a constraint that explicitly preserves existing behavior.");

  const outOfScopePattern = /\b(do\s+not|don't|not\s+in\s+scope|out\s+of\s+scope|excluded|not\s+required|not\s+needed|skip|avoid)\b/i;
  const hasExplicitNonGoals = nonGoals.some(ng => outOfScopePattern.test(ng));
  if (!hasExplicitNonGoals && nonGoals.length > 0) suggestions.push("Non-goals should explicitly say what is excluded.");
  else if (hasExplicitNonGoals) score += 10;

  if (nonGoals.length === 0) suggestions.push("Add non-goals to clarify what is explicitly out of scope.");

  score = Math.max(0, Math.min(100, score));
  return { name: "Constraint Completeness", score, suggestions: score >= 80 ? [] : suggestions };
}

function scoreRiskCoverage(pack: IntentPack): HealthDimension {
  const risks = pack.risks ?? [];
  const touchedAreas = pack.touchedAreas ?? [];
  let score = 20;
  const suggestions: string[] = [];

  if (risks.length === 0) return { name: "Risk Coverage", score: 0, suggestions: ["Add at least one risk to surface what could go wrong."] };

  if (risks.length >= 4) score += 30;
  else if (risks.length >= 2) score += 20;
  else score += 10;

  const specificRiskPattern = /\b(regression|break|fail|corrupt|expose|leak|unauthori[sz]ed|overflow|conflict|race|inconsistent|missing|stale|deadlock|timeout|loop|cascade|drift)\b/i;
  const specificRisks = risks.filter(r => specificRiskPattern.test(r));
  if (specificRisks.length >= risks.length * 0.5) score += 25;
  else suggestions.push("Risks should name specific failure modes.");

  const sensitiveAreas = ["billing", "payment", "auth", "authentication", "admin", "database", "schema", "security"];
  const touchedSensitive = touchedAreas.filter(a => sensitiveAreas.some(s => a.toLowerCase().includes(s)));
  if (touchedSensitive.length > 0) {
    const riskText = risks.join(" ").toLowerCase();
    const covered = touchedSensitive.filter(a => sensitiveAreas.some(s => a.toLowerCase().includes(s) && riskText.includes(s)));
    if (covered.length < touchedSensitive.length) {
      score -= 10;
      suggestions.push(`Pack touches sensitive areas (${touchedSensitive.join(", ")}) — add explicit risks for each.`);
    } else score += 10;
  }

  const genericRiskPattern = /\b(something might go wrong|unexpected behavior|could cause issues|may break|might break)\b/i;
  const genericRisks = risks.filter(r => genericRiskPattern.test(r));
  if (genericRisks.length > 0) {
    score -= genericRisks.length * 8;
    suggestions.push("Replace generic risks with specific failure modes.");
  }

  score = Math.max(0, Math.min(100, score));
  return { name: "Risk Coverage", score, suggestions: score >= 80 ? [] : suggestions };
}

const DIMENSION_WEIGHTS = {
  "Objective Specificity": 0.30,
  "Acceptance Criteria":   0.30,
  "Constraint Completeness": 0.20,
  "Risk Coverage":          0.20,
};

export function computePackHealth(pack: IntentPack): PackHealthResult {
  const dims: HealthDimension[] = [
    scoreObjectiveSpecificity(pack),
    scoreAcceptanceCriteria(pack),
    scoreConstraintCompleteness(pack),
    scoreRiskCoverage(pack),
  ];

  let weightedSum = 0;
  let totalWeight = 0;
  for (const dim of dims) {
    const w = DIMENSION_WEIGHTS[dim.name as keyof typeof DIMENSION_WEIGHTS] ?? 0.25;
    weightedSum += dim.score * w;
    totalWeight += w;
  }
  const score = Math.round(totalWeight > 0 ? weightedSum / totalWeight : 0);
  const level = score >= 80 ? "excellent" : score >= 60 ? "good" : score >= 35 ? "fair" : "poor";

  return { score, level, dimensions: dims };
}
