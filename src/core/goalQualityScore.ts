/**
 * goalQualityScore.ts — pure heuristic scorer for goal input quality.
 *
 * Runs client-side (replicated in index.html) and server-side (for tests).
 * Returns a score 0–100 and a list of specific improvement suggestions.
 */

export interface GoalQualityResult {
  /** 0–100. Higher is better. */
  score: number;
  /** "vague" | "partial" | "clear" */
  level: "vague" | "partial" | "clear";
  /** Specific, actionable improvement suggestions. Empty when level is "clear". */
  suggestions: string[];
}

// Signals that indicate vagueness
const VAGUE_SIGNALS: { pattern: RegExp; suggestion: string }[] = [
  { pattern: /\b(improve|improvements?)\b/i, suggestion: 'Replace "improve" with a specific outcome (e.g. "reduce load time by 50%").' },
  { pattern: /\b(refactor|clean\s+up|tidy\s+up)\b/i, suggestion: 'Replace "refactor" with the behavior change the refactor enables.' },
  { pattern: /\bfix\s+(things?|stuff|it|this|that|issues?|bugs?|problems?)\b/i, suggestion: 'Specify exactly what is broken and what the correct behavior should be.' },
  { pattern: /\b(optimize|optimization)\b/i, suggestion: 'Specify what metric to optimize and by how much.' },
  { pattern: /\b(enhance|enhancement)\b/i, suggestion: 'Replace "enhance" with the concrete capability being added.' },
  { pattern: /\b(update|updates?)\s+(the\s+)?(code|system|app|site)\b/i, suggestion: 'Describe what the update changes, not that it changes something.' },
  { pattern: /\bmake\s+(?:\w+\s+){0,3}(?:better|faster|nicer|cleaner)\b/i, suggestion: '"Better" is not measurable — specify the target quality or metric.' },
];

// Signals that indicate scope creep risk
const SCOPE_CREEP_SIGNALS: { pattern: RegExp; suggestion: string }[] = [
  { pattern: /\band\s+also\b/i, suggestion: 'Consider splitting compound goals — "and also" often signals two separate requests.' },
  { pattern: /\bas\s+well\s+as\b/i, suggestion: 'Consider splitting compound goals — "as well as" often signals two separate requests.' },
  { pattern: /\bwhile\s+(we('re|re)|you('re|re)|I('m|m))\s+at\s+it\b/i, suggestion: 'Track "while we\'re at it" additions separately to keep the scope bounded.' },
  { pattern: /\balso\b.*\balso\b/i, suggestion: 'Multiple "also" clauses suggest the scope may be wider than intended.' },
];

// Signals that indicate constraints or acceptance criteria are present (positive)
const CONSTRAINT_SIGNALS: RegExp[] = [
  /\bdo\s+not\s+break\b/i,
  /\bwithout\s+breaking\b/i,
  /\bmust\s+not\b/i,
  /\bshould\s+not\b/i,
  /\bbackward[\s-]?compat/i,
  /\bexisting\b/i,
  /\bcurrent\b/i,
  /\bpreserve\b/i,
  /\bkeep\b/i,
];

// Positive specificity signals
const SPECIFICITY_SIGNALS: RegExp[] = [
  /\bbecause\b/i,
  /\bso\s+that\b/i,
  /\bin\s+order\s+to\b/i,
  /\bwhen\b/i,
  /\bif\b/i,
  /\bonly\b/i,
  /\bexcept\b/i,
  /\bbut\s+not\b/i,
];

/**
 * Score a goal string on a 0–100 quality scale.
 * Pure function — no side effects.
 */
export function scoreGoalQuality(goal: string): GoalQualityResult {
  const text = goal.trim();

  if (!text) {
    return { score: 0, level: "vague", suggestions: ["Describe what you want to build or change."] };
  }

  let score = 30; // baseline for non-empty input
  const suggestions: string[] = [];

  // ── Vagueness penalty ─────────────────────────────────────────
  const vagueMatches: string[] = [];
  for (const { pattern, suggestion } of VAGUE_SIGNALS) {
    if (pattern.test(text)) {
      vagueMatches.push(suggestion);
    }
  }
  score -= vagueMatches.length * 12;
  suggestions.push(...vagueMatches);

  // ── Scope creep penalty ───────────────────────────────────────
  const scopeMatches: string[] = [];
  for (const { pattern, suggestion } of SCOPE_CREEP_SIGNALS) {
    if (pattern.test(text)) {
      scopeMatches.push(suggestion);
    }
  }
  score -= scopeMatches.length * 8;
  suggestions.push(...scopeMatches);

  // ── Constraint bonus ──────────────────────────────────────────
  const constraintCount = CONSTRAINT_SIGNALS.filter(p => p.test(text)).length;
  score += Math.min(constraintCount, 3) * 8;

  // ── Specificity bonus ─────────────────────────────────────────
  const specificityCount = SPECIFICITY_SIGNALS.filter(p => p.test(text)).length;
  score += Math.min(specificityCount, 3) * 6;

  // ── Length bonus (longer = more context) ─────────────────────
  if (text.length >= 80) score += 10;
  else if (text.length >= 40) score += 5;

  // ── Length penalty (too short = probably vague) ──────────────
  if (text.length < 20) {
    score -= 10;
    if (!suggestions.some(s => s.toLowerCase().includes("describe"))) {
      suggestions.push("Add more detail — short goals are usually too vague to act on safely.");
    }
  }

  // ── Clamp to 0–100 ────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  // ── Level ─────────────────────────────────────────────────────
  const level: GoalQualityResult["level"] =
    score >= 65 ? "clear" :
    score >= 35 ? "partial" :
    "vague";

  // No suggestions when clear
  return { score, level, suggestions: level === "clear" ? [] : suggestions };
}
