/**
 * clarifyingQuestions.ts
 *
 * Pure heuristic generator for pre-generation clarifying questions.
 *
 * Given a goal (and optional repository context), returns 0–3 short questions
 * that, when answered, improve the precision of the generated intent pack.
 *
 * Targets three common gaps:
 *   1. Scope gap       — what is explicitly out of scope?
 *   2. Constraint gap  — which existing behaviors must be preserved?
 *   3. Acceptance gap  — how will completion be verified?
 */

/**
 * Analyse a goal string and return 0–3 clarifying questions.
 * Returns an empty array when the goal already addresses all three gaps.
 */
export function generateClarifyingQuestions(
  goal: string,
  context?: string
): string[] {
  const text = `${goal.trim()} ${context?.trim() ?? ""}`.toLowerCase();
  const questions: string[] = [];

  // Q1 — Scope: ask unless the goal already names explicit boundaries or exclusions
  const hasScopeSignal =
    /\bonly\b|\bspecifically\b|\bjust\b|\blimited to\b|\bwithout (changing|affecting|touching)\b/.test(
      text
    );
  if (!hasScopeSignal) {
    questions.push(
      "What is explicitly out of scope for this change? " +
        "(e.g. areas, flows, or behaviors that must not be touched)"
    );
  }

  // Q2 — Constraints: ask unless "do not break / preserv- / backward compat" is already present
  const hasConstraintSignal =
    /do not break|without breaking|preserv|backward compat|must not|should not|must remain|keep.*unchanged/.test(
      text
    );
  if (!hasConstraintSignal) {
    questions.push(
      "Which existing behaviors must remain unchanged after this is implemented?"
    );
  }

  // Q3 — Acceptance: ask unless a verifiable success condition is already stated
  const hasAcceptanceSignal =
    /should work|must work|tests? (pass|cover)|verified|confirm|success when|done when|complete when/.test(
      text
    );
  if (!hasAcceptanceSignal) {
    questions.push(
      "How will you verify this change is complete and correct? " +
        "(e.g. a specific test, a manual step, or an observable outcome)"
    );
  }

  return questions.slice(0, 3);
}
