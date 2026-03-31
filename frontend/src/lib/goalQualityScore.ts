export interface GoalQualityResult {
  score: number;
  level: "vague" | "partial" | "clear";
  suggestions: string[];
}

const VAGUE_SIGNALS = [
  { pattern: /\b(improve|improvements?)\b/i, suggestion: 'Replace "improve" with a specific outcome.' },
  { pattern: /\b(refactor|clean\s+up|tidy\s+up)\b/i, suggestion: 'Replace "refactor" with the behavior change it enables.' },
  { pattern: /\bfix\s+(things?|stuff|it|this|that|issues?|bugs?|problems?)\b/i, suggestion: 'Specify exactly what is broken.' },
  { pattern: /\b(optimize|optimization)\b/i, suggestion: 'Specify what metric to optimize and by how much.' },
  { pattern: /\b(enhance|enhancement)\b/i, suggestion: 'Replace "enhance" with the concrete capability being added.' },
  { pattern: /\b(update|updates?)\s+(the\s+)?(code|system|app|site)\b/i, suggestion: 'Describe what the update changes.' },
  { pattern: /\bmake\s+(?:\w+\s+){0,3}(?:better|faster|nicer|cleaner)\b/i, suggestion: '"Better" is not measurable.' },
];

const SCOPE_CREEP_SIGNALS = [
  { pattern: /\band\s+also\b/i, suggestion: 'Consider splitting compound goals.' },
  { pattern: /\bas\s+well\s+as\b/i, suggestion: 'Consider splitting compound goals.' },
  { pattern: /\bwhile\s+(we('re|re)|you('re|re)|I('m|m))\s+at\s+it\b/i, suggestion: 'Track additions separately.' },
  { pattern: /\balso\b.*\balso\b/i, suggestion: 'Multiple "also" clauses suggest scope creep.' },
];

const CONSTRAINT_SIGNALS = [/\bdo\s+not\s+break\b/i, /\bwithout\s+breaking\b/i, /\bmust\s+not\b/i, /\bshould\s+not\b/i, /\bbackward[\s-]?compat/i, /\bexisting\b/i, /\bcurrent\b/i, /\bpreserve\b/i, /\bkeep\b/i];
const SPECIFICITY_SIGNALS = [/\bbecause\b/i, /\bso\s+that\b/i, /\bin\s+order\s+to\b/i, /\bwhen\b/i, /\bif\b/i, /\bonly\b/i, /\bexcept\b/i, /\bbut\s+not\b/i];

export function scoreGoalQuality(goal: string): GoalQualityResult {
  const text = goal.trim();
  if (!text) return { score: 0, level: "vague", suggestions: ["Describe what you want to build or change."] };
  let score = 30;
  const suggestions: string[] = [];
  
  const vagueMatches = VAGUE_SIGNALS.filter(s => s.pattern.test(text)).map(s => s.suggestion);
  score -= vagueMatches.length * 12;
  suggestions.push(...vagueMatches);
  
  const scopeMatches = SCOPE_CREEP_SIGNALS.filter(s => s.pattern.test(text)).map(s => s.suggestion);
  score -= scopeMatches.length * 8;
  suggestions.push(...scopeMatches);
  
  score += Math.min(CONSTRAINT_SIGNALS.filter(p => p.test(text)).length, 3) * 8;
  score += Math.min(SPECIFICITY_SIGNALS.filter(p => p.test(text)).length, 3) * 6;
  if (text.length >= 80) score += 10;
  else if (text.length >= 40) score += 5;
  if (text.length < 20) {
    score -= 10;
    if (!suggestions.some(s => s.toLowerCase().includes("describe"))) suggestions.push("Add more detail.");
  }
  
  score = Math.max(0, Math.min(100, score));
  const level = score >= 65 ? "clear" : score >= 35 ? "partial" : "vague";
  return { score, level, suggestions: level === "clear" ? [] : suggestions };
}
