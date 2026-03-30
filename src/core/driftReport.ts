import type { StoredIntentPack } from "./types.js";

export interface DriftReport {
  packId: string;
  prLink: string | null;
  hasLinkedPr: boolean;
  scopeCreep: string[];
  intentGap: string[];
  summary: string;
}

/**
 * Normalizes a string for loose matching: lowercase, strip punctuation,
 * collapse whitespace.
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s/.-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Minimum token length for area-to-file matching (filters noise words). */
const MIN_TOKEN_LENGTH = 3;

/**
 * Returns true if any word from `area` appears in any of the `files` strings.
 * Uses token-level matching to reduce false negatives.
 */
function areaMatchesAnyFile(area: string, files: string[]): boolean {
  const areaTokens = normalize(area).split(" ").filter((t) => t.length >= MIN_TOKEN_LENGTH);
  if (areaTokens.length === 0) return false;
  for (const file of files) {
    const normalizedFile = normalize(file);
    if (areaTokens.some((token) => normalizedFile.includes(token))) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if any touched area token appears in the given file path.
 */
function fileMatchesAnyArea(file: string, areas: string[]): boolean {
  const normalizedFile = normalize(file);
  for (const area of areas) {
    const areaTokens = normalize(area).split(" ").filter((t) => t.length >= MIN_TOKEN_LENGTH);
    if (areaTokens.some((token) => normalizedFile.includes(token))) {
      return true;
    }
  }
  return false;
}

/**
 * Computes a drift report by comparing the pack's touchedAreas against
 * the changedFiles stored on the pack (populated via link-pr).
 *
 * - scopeCreep: changed files that don't match any touched area
 * - intentGap: touched areas that have no matching changed file
 *
 * When no PR/changedFiles have been linked, the report reflects that state.
 */
export function computeDriftReport(pack: StoredIntentPack): DriftReport {
  const touchedAreas = pack.touchedAreas ?? [];
  const changedFiles = pack.changedFiles ?? [];

  if (changedFiles.length === 0) {
    return {
      packId: pack.id,
      prLink: pack.prLink ?? null,
      hasLinkedPr: !!pack.prLink,
      scopeCreep: [],
      intentGap: touchedAreas.slice(),
      summary: pack.prLink
        ? "PR linked but no changed files recorded. Link the PR with changedFiles to enable drift analysis."
        : "No PR linked yet. Use POST /api/intent-packs/:id/link-pr to attach a PR.",
    };
  }

  const scopeCreep = changedFiles.filter(
    (file) => !fileMatchesAnyArea(file, touchedAreas)
  );

  const intentGap = touchedAreas.filter(
    (area) => !areaMatchesAnyFile(area, changedFiles)
  );

  let summary: string;
  if (scopeCreep.length === 0 && intentGap.length === 0) {
    summary = "No drift detected. Changed files align with the declared touched areas.";
  } else {
    const parts: string[] = [];
    if (scopeCreep.length > 0) {
      parts.push(
        `${scopeCreep.length} file(s) changed outside declared touched areas (possible scope creep).`
      );
    }
    if (intentGap.length > 0) {
      parts.push(
        `${intentGap.length} declared area(s) have no matching changed files (possible intent gap).`
      );
    }
    summary = parts.join(" ");
  }

  return {
    packId: pack.id,
    prLink: pack.prLink ?? null,
    hasLinkedPr: !!pack.prLink,
    scopeCreep,
    intentGap,
    summary,
  };
}
