import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { IntentPack, StoredIntentPack, PackStatus } from "./types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// Resolves to <project-root>/data/intent-packs when running from dist/core/
export const defaultDataDir = join(__dirname, "..", "..", "data", "intent-packs");

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function saveIntentPack(
  pack: IntentPack,
  goal?: string,
  repositoryContext?: string,
  dataDir?: string,
  policyWarnings?: string[]
): Promise<StoredIntentPack> {
  const dir = dataDir ?? defaultDataDir;
  await ensureDir(dir);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const stored: StoredIntentPack = {
    id,
    createdAt,
    ...(goal !== undefined ? { goal } : {}),
    ...(repositoryContext !== undefined ? { repositoryContext } : {}),
    ...(policyWarnings && policyWarnings.length > 0 ? { policyWarnings } : {}),
    ...pack,
  };
  await writeFile(join(dir, `${id}.json`), JSON.stringify(stored, null, 2), "utf8");
  return stored;
}

export async function listIntentPacks(dataDir = defaultDataDir): Promise<StoredIntentPack[]> {
  await ensureDir(dataDir);
  const files = await readdir(dataDir);
  const packs: StoredIntentPack[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = await readFile(join(dataDir, file), "utf8");
      const parsed = JSON.parse(content) as StoredIntentPack;
      if (typeof parsed.id !== "string" || typeof parsed.createdAt !== "string") {
        console.error(`Skipping intent pack file with missing id or createdAt: ${file}`);
        continue;
      }
      packs.push(parsed);
    } catch (err) {
      console.error(`Skipping malformed intent pack file: ${file}`, err);
    }
  }
  packs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return packs;
}

export async function getIntentPackById(
  id: string,
  dataDir = defaultDataDir
): Promise<StoredIntentPack | null> {
  if (!uuidPattern.test(id)) return null;
  try {
    const content = await readFile(join(dataDir, `${id}.json`), "utf8");
    return JSON.parse(content) as StoredIntentPack;
  } catch {
    return null;
  }
}

export async function deleteIntentPack(
  id: string,
  dataDir = defaultDataDir
): Promise<boolean> {
  if (!uuidPattern.test(id)) return false;
  try {
    await rm(join(dataDir, `${id}.json`));
    return true;
  } catch {
    return false;
  }
}

export async function patchIntentPack(
  id: string,
  patch: { notes?: string; tags?: string[]; goal?: string; repositoryContext?: string; starred?: boolean; archived?: boolean; status?: PackStatus },
  dataDir = defaultDataDir
): Promise<StoredIntentPack | null> {
  if (!uuidPattern.test(id)) return null;
  const filePath = join(dataDir, `${id}.json`);
  let stored: StoredIntentPack;
  try {
    const content = await readFile(filePath, "utf8");
    stored = JSON.parse(content) as StoredIntentPack;
  } catch {
    return null;
  }

  // Snapshot the current state before applying changes (version history)
  const meaningfulFields: (keyof StoredIntentPack)[] = [
    "goal", "repositoryContext", "notes", "tags", "status",
  ];
  const hasMeaningfulChange = meaningfulFields.some(
    (f) => f in patch && (patch as Record<string, unknown>)[f] !== undefined
  );
  if (hasMeaningfulChange) {
    await appendHistorySnapshot(id, stored, dataDir);
  }

  if (patch.notes !== undefined) {
    stored.notes = patch.notes;
  }
  if (patch.tags !== undefined) {
    stored.tags = patch.tags;
  }
  if (patch.goal !== undefined) {
    stored.goal = patch.goal;
  }
  if (patch.repositoryContext !== undefined) {
    if (patch.repositoryContext === "") {
      delete stored.repositoryContext;
    } else {
      stored.repositoryContext = patch.repositoryContext;
    }
  }
  if (patch.starred !== undefined) {
    if (patch.starred) {
      stored.starred = true;
    } else {
      delete stored.starred;
    }
  }
  if (patch.archived !== undefined) {
    if (patch.archived) {
      stored.archived = true;
    } else {
      delete stored.archived;
    }
  }
  if (patch.status !== undefined) {
    stored.status = patch.status;
  }
  await writeFile(filePath, JSON.stringify(stored, null, 2), "utf8");
  return stored;
}

export async function duplicateIntentPack(
  id: string,
  dataDir = defaultDataDir
): Promise<StoredIntentPack | null> {
  const dir = dataDir;
  const original = await getIntentPackById(id, dir);
  if (!original) return null;
  const newId = crypto.randomUUID();
  const newCreatedAt = new Date().toISOString();
  const duplicate: StoredIntentPack = { ...original, id: newId, createdAt: newCreatedAt };
  await ensureDir(dir);
  await writeFile(join(dir, `${newId}.json`), JSON.stringify(duplicate, null, 2), "utf8");
  return duplicate;
}

// ── History snapshots ─────────────────────────────────────────

export interface HistoryEntry {
  patchedAt: string;
  before: StoredIntentPack;
}

async function appendHistorySnapshot(
  id: string,
  snapshot: StoredIntentPack,
  dataDir: string
): Promise<void> {
  const historyPath = join(dataDir, `${id}.history.json`);
  let history: HistoryEntry[] = [];
  try {
    const raw = await readFile(historyPath, "utf8");
    history = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(history)) history = [];
  } catch {
    // No history yet — start fresh
  }
  history.push({ patchedAt: new Date().toISOString(), before: snapshot });
  await writeFile(historyPath, JSON.stringify(history, null, 2), "utf8");
}

/**
 * Returns the history entries for a pack, oldest first.
 * Returns null if the pack id is invalid.
 * Returns [] if there is no history yet.
 */
export async function listPackHistory(
  id: string,
  dataDir = defaultDataDir
): Promise<HistoryEntry[] | null> {
  if (!uuidPattern.test(id)) return null;
  const historyPath = join(dataDir, `${id}.history.json`);
  try {
    const raw = await readFile(historyPath, "utf8");
    const history = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

// ── GitHub issue URL ──────────────────────────────────────────

/**
 * Saves the GitHub issue URL returned after creating an issue from this pack.
 * Returns the updated pack or null if not found.
 */
export async function saveGitHubIssueUrl(
  id: string,
  issueUrl: string,
  dataDir = defaultDataDir
): Promise<StoredIntentPack | null> {
  if (!uuidPattern.test(id)) return null;
  const filePath = join(dataDir, `${id}.json`);
  let stored: StoredIntentPack;
  try {
    const content = await readFile(filePath, "utf8");
    stored = JSON.parse(content) as StoredIntentPack;
  } catch {
    return null;
  }
  stored.githubIssueUrl = issueUrl;
  await writeFile(filePath, JSON.stringify(stored, null, 2), "utf8");
  return stored;
}

/**
 * Attaches a PR URL and optional changed-files list to a pack.
 * Returns the updated pack or null if not found.
 */
export async function linkPrToIntentPack(
  id: string,
  prUrl: string,
  changedFiles: string[] | undefined,
  dataDir = defaultDataDir
): Promise<StoredIntentPack | null> {
  if (!uuidPattern.test(id)) return null;
  const filePath = join(dataDir, `${id}.json`);
  let stored: StoredIntentPack;
  try {
    const content = await readFile(filePath, "utf8");
    stored = JSON.parse(content) as StoredIntentPack;
  } catch {
    return null;
  }
  stored.prLink = prUrl;
  if (changedFiles !== undefined) {
    stored.changedFiles = changedFiles;
  }
  await writeFile(filePath, JSON.stringify(stored, null, 2), "utf8");
  return stored;
}
