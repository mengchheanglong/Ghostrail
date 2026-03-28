import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { IntentPack, StoredIntentPack } from "./types.js";

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
  dataDir?: string
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
  patch: { notes?: string; tags?: string[]; goal?: string; repositoryContext?: string },
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
