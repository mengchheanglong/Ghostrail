import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// Default policy path resolves to <project-root>/ghostrail-policy.json
// When running from dist/core/, that's: dist/core/ -> dist/ -> <root>/
// So two levels up from __dirname.
const defaultPolicyPath = join(__dirname, "..", "..", "ghostrail-policy.json");

export interface PolicyRule {
  /** If any of these keywords appear in touchedAreas, the warning fires. */
  ifTouchedAreaIncludes: string;
  /** Warning message to surface on the pack. */
  warn: string;
}

export interface GhostrailPolicy {
  /**
   * List of area keywords considered protected.
   * When a pack's touchedAreas contains any of these (case-insensitive),
   * a warning is automatically added to the pack.
   */
  protectedAreas?: string[];
  /**
   * Additional custom rules evaluated against touchedAreas.
   */
  rules?: PolicyRule[];
}

let _cachedPolicy: GhostrailPolicy | null | undefined = undefined;

/**
 * Loads the policy from disk (or the specified path).
 * Returns null if no policy file exists.
 * Throws on malformed JSON so misconfiguration is visible immediately.
 */
export async function loadPolicy(policyPath?: string): Promise<GhostrailPolicy | null> {
  const filePath = policyPath ?? defaultPolicyPath;
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("ghostrail-policy.json must be a JSON object");
    }
    return parsed as GhostrailPolicy;
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && (err as Record<string, unknown>)["code"] === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Returns a cached policy, loading from disk on first call.
 * Pass `policyPath` to override the default location (useful in tests).
 */
export async function getPolicy(policyPath?: string): Promise<GhostrailPolicy | null> {
  if (_cachedPolicy !== undefined) return _cachedPolicy;
  _cachedPolicy = await loadPolicy(policyPath);
  return _cachedPolicy;
}

/** Reset the policy cache (useful in tests). */
export function resetPolicyCache(): void {
  _cachedPolicy = undefined;
}

/**
 * Returns true if area and candidate have a token-level match.
 * Splits both on word boundaries and checks for common tokens (length >= 3).
 * This avoids false positives from substring-only matching (e.g. 'billing' in 'rebilling').
 */
function areasMatch(area: string, candidate: string): boolean {
  const aTokens = area.toLowerCase().split(/\W+/).filter((t) => t.length >= 3);
  const cTokens = candidate.toLowerCase().split(/\W+/).filter((t) => t.length >= 3);
  return aTokens.some((t) => cTokens.includes(t));
}

/**
 * Pure function that evaluates a policy against a set of touchedAreas.
 * Returns an array of warning strings (empty if no warnings apply).
 */
export function applyPolicy(
  touchedAreas: string[],
  policy: GhostrailPolicy
): string[] {
  const warnings: string[] = [];

  const protectedAreas = policy.protectedAreas ?? [];
  for (const area of protectedAreas) {
    if (touchedAreas.some((ta) => areasMatch(area, ta))) {
      warnings.push(
        `Protected area "${area}" is in the touched areas. Ensure this change is explicitly reviewed.`
      );
    }
  }

  const rules = policy.rules ?? [];
  for (const rule of rules) {
    if (touchedAreas.some((ta) => areasMatch(rule.ifTouchedAreaIncludes, ta))) {
      warnings.push(rule.warn);
    }
  }

  // Deduplicate
  return [...new Set(warnings)];
}
