/**
 * llmProvider.ts — LLM provider abstraction layer.
 *
 * Implementations:
 *   - HeuristicProvider — wraps the existing rule-based generateIntentPack()
 *   - StubLlmProvider   — deterministic credential-free stub for integration tests
 *   - OpenAiProvider    — real OpenAI chat completions call; requires OPENAI_API_KEY
 *
 * Wire a real provider via createProvider() and inject into createHandler().
 * The server auto-selects OpenAiProvider when OPENAI_API_KEY is set.
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
 * Add new real-model provider types here when they become available.
 */
export type LlmProviderConfig =
  | { type: "heuristic" }
  | { type: "stub" }
  | { type: "openai"; apiKey: string; model?: string };

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

// ── OpenAI provider ───────────────────────────────────────────────────────────

const OPENAI_SYSTEM_PROMPT = `You are Ghostrail, an AI assistant that helps software teams write precise intent packs before starting coding work.

An intent pack captures:
- What is the objective? (one crisp sentence)
- What are the non-goals? (what we are explicitly NOT doing)
- What are the constraints? (things that must not change or must be preserved)
- What are the acceptance criteria? (testable conditions that confirm the work is done)
- What areas of the codebase will likely be touched? (file paths, modules, or systems)
- What are the risks? (what could go wrong)
- What open questions remain?

Respond with a single JSON object and nothing else. No markdown fences. No explanation before or after.

Required JSON schema:
{
  "objective": "string",
  "nonGoals": ["string"],
  "constraints": ["string"],
  "acceptanceCriteria": ["string"],
  "touchedAreas": ["string"],
  "risks": ["string"],
  "openQuestions": ["string"],
  "confidence": "low" | "medium" | "high"
}`;

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function ensureString(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`OpenAI response missing or invalid field: ${field}`);
}

function ensureStringArray(value: unknown, field: string): string[] {
  if (Array.isArray(value) && (value as unknown[]).every((v) => typeof v === "string")) {
    return value as string[];
  }
  throw new Error(`OpenAI response missing or invalid field: ${field}`);
}

function ensureConfidence(value: unknown): "low" | "medium" | "high" {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

/**
 * Calls the OpenAI chat completions API and parses the response into an IntentPack.
 *
 * - apiKey: OpenAI API key (set OPENAI_API_KEY in your environment)
 * - model: defaults to "gpt-4o"
 * - fetchFn: injectable for testing; defaults to globalThis.fetch
 */
export class OpenAiProvider implements LlmProvider {
  private apiKey: string;
  private model: string;
  private fetchFn: typeof fetch;

  constructor(apiKey: string, model = "gpt-4o", fetchFn: typeof fetch = globalThis.fetch) {
    this.apiKey = apiKey;
    this.model = model;
    this.fetchFn = fetchFn;
  }

  async generate(input: IntentPackInput): Promise<IntentPack> {
    const userMessage = input.repositoryContext?.trim()
      ? `Goal: ${input.goal.trim()}\n\nRepository context: ${input.repositoryContext.trim()}`
      : `Goal: ${input.goal.trim()}`;

    const response = await this.fetchFn("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: OPENAI_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json() as OpenAiChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI response missing content");
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new Error(`OpenAI returned non-JSON content: ${content.slice(0, 200)}`);
    }

    return {
      objective: ensureString(parsed["objective"], "objective"),
      nonGoals: ensureStringArray(parsed["nonGoals"], "nonGoals"),
      constraints: ensureStringArray(parsed["constraints"], "constraints"),
      acceptanceCriteria: ensureStringArray(parsed["acceptanceCriteria"], "acceptanceCriteria"),
      touchedAreas: ensureStringArray(parsed["touchedAreas"], "touchedAreas"),
      risks: ensureStringArray(parsed["risks"], "risks"),
      openQuestions: ensureStringArray(parsed["openQuestions"], "openQuestions"),
      confidence: ensureConfidence(parsed["confidence"]),
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
    case "openai":
      return new OpenAiProvider(config.apiKey, config.model);
    default: {
      // Exhaustiveness check — compile-time guard for when new provider types are added
      const _exhaustive: never = config;
      throw new Error(`Unknown provider type: ${(_exhaustive as LlmProviderConfig).type}`);
    }
  }
}
