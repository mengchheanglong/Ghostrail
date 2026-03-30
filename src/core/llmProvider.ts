/**
 * llmProvider.ts — LLM provider abstraction layer.
 *
 * Defines the provider interface and the two credential-free implementations:
 *   - HeuristicProvider  — wraps the existing rule-based generateIntentPack()
 *   - StubLlmProvider    — returns a deterministic pack with reasoningMode "llm",
 *                          used to test the integration boundary without credentials
 *
 * Future real-model providers (OpenAI, Anthropic, etc.) will implement the same
 * LlmProvider interface and be added to createProvider() when credentials are available.
 */

import type { IntentPack, IntentPackInput } from "./types.js";
import { generateIntentPack } from "./generateIntentPack.js";

// ── Interface ─────────────────────────────────────────────────────────────────

/**
 * A provider that can generate an IntentPack from an IntentPackInput.
 * Implementations may be pure-heuristic (no I/O) or LLM-backed (async network call).
 */
export interface LlmProvider {
  generate(input: IntentPackInput): Promise<IntentPack>;
}

// ── Provider config ───────────────────────────────────────────────────────────

/**
 * Configuration union for createProvider().
 * Extend this union when adding new real-model providers.
 */
export type LlmProviderConfig =
  | { type: "heuristic" }
  | { type: "stub" };
// Future:
//   | { type: "openai"; apiKey: string; model?: string }
//   | { type: "anthropic"; apiKey: string; model?: string }

// ── Heuristic provider ────────────────────────────────────────────────────────

/**
 * Wraps the existing rule-based generateIntentPack().
 * No network I/O. Always returns reasoningMode: "heuristic".
 */
export class HeuristicProvider implements LlmProvider {
  async generate(input: IntentPackInput): Promise<IntentPack> {
    return generateIntentPack(input);
  }
}

// ── Stub LLM provider ─────────────────────────────────────────────────────────

/**
 * Returns a deterministic, credential-free IntentPack that signals it came from
 * an "llm" reasoningMode. Used to test the integration boundary without needing
 * a real model API key.
 *
 * The stub output is based on the input goal so tests can assert on goal-specific content.
 */
export class StubLlmProvider implements LlmProvider {
  async generate(input: IntentPackInput): Promise<IntentPack> {
    const goal = input.goal.trim();
    return {
      objective: goal,
      nonGoals: ["Do not perform unrelated refactors (stub)."],
      constraints: ["Keep the change backward compatible (stub)."],
      acceptanceCriteria: [
        "The requested behavior works for the core happy path (stub).",
        "Existing sensitive flows continue to work after the change (stub).",
      ],
      touchedAreas: ["stub-area"],
      risks: ["Stub risk: verify this with a real model when credentials are available."],
      openQuestions: ["What part of the request would cause the most damage if implemented incorrectly (stub)?"],
      confidence: "low",
      reasoningMode: "llm",
    };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns an LlmProvider for the given config.
 * Use this at server startup so the handler stays decoupled from specific providers.
 */
export function createProvider(config: LlmProviderConfig): LlmProvider {
  switch (config.type) {
    case "heuristic":
      return new HeuristicProvider();
    case "stub":
      return new StubLlmProvider();
    default: {
      // Exhaustiveness check — compile-time guard for when new provider types are added
      const _exhaustive: never = config;
      throw new Error(`Unknown provider type: ${(_exhaustive as LlmProviderConfig).type}`);
    }
  }
}
