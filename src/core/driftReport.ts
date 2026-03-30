import type { StoredIntentPack } from "./types.js";

/**
 * Overall drift status for a pack vs its linked PR.
 *
 * - "no-data"        — no PR linked or no changed files provided yet
 * - "clean"          — all changed files map to a declared touchedArea
 *                      and all touchedAreas have at least one matching file
 * - "warning"        — partial match: either unexpectedFiles or missingTouchedAreas
 *                      but not both (mild drift)
 * - "drift-detected" — both unexpectedFiles and missingTouchedAreas present,
 *                      or scope creep is significant
 */
export type DriftStatus = "no-data" | "clean" | "warning" | "drift-detected";

export interface DriftReport {
  packId: string;
  prLink: string | null;
  hasLinkedPr: boolean;
  /** All file paths that were compared (parsed from diff or stored on pack). */
  changedFiles: string[];
  /** Files that match at least one declared touchedArea. */
  matchedFiles: string[];
  /**
   * Files changed outside declared touchedAreas (possible scope creep).
   * Kept as `scopeCreep` for backward compatibility.
   */
  scopeCreep: string[];
  /**
   * TouchedAreas with no matching changed file (possible intent gap).
   * Kept as `intentGap` for backward compatibility.
   */
  intentGap: string[];
  /** Computed overall drift status. */
  status: DriftStatus;
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
 * the changedFiles stored on the pack (populated via link-pr or analyze-diff).
 *
 * Three result buckets (path-based, not semantic):
 * - matchedFiles: changed files that match at least one touchedArea
 * - scopeCreep: changed files with no matching touchedArea (unexpected)
 * - intentGap: touchedAreas with no matching changed file (missing)
 *
 * The matching is token-based and conservative — it avoids false confidence.
 * See MIN_TOKEN_LENGTH and the matching helpers for details.
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
      changedFiles: [],
      matchedFiles: [],
      scopeCreep: [],
      intentGap: touchedAreas.slice(),
      status: "no-data",
      summary: pack.prLink
        ? "PR linked but no changed files recorded. Link the PR with changedFiles to enable drift analysis."
        : "No PR linked yet. Use POST /api/intent-packs/:id/link-pr to attach a PR.",
    };
  }

  const matchedFiles = changedFiles.filter(
    (file) => fileMatchesAnyArea(file, touchedAreas)
  );

  const scopeCreep = changedFiles.filter(
    (file) => !fileMatchesAnyArea(file, touchedAreas)
  );

  const intentGap = touchedAreas.filter(
    (area) => !areaMatchesAnyFile(area, changedFiles)
  );

  let status: DriftStatus;
  if (scopeCreep.length === 0 && intentGap.length === 0) {
    status = "clean";
  } else if (scopeCreep.length > 0 && intentGap.length > 0) {
    status = "drift-detected";
  } else {
    status = "warning";
  }

  let summary: string;
  if (status === "clean") {
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
    changedFiles,
    matchedFiles,
    scopeCreep,
    intentGap,
    status,
    summary,
  };
}
