import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { IntentPack, StoredIntentPack } from "./types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// Resolves to <project-root>/data/intent-packs when running from dist/core/
const defaultDataDir = join(__dirname, "..", "..", "data", "intent-packs");

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function saveIntentPack(
  pack: IntentPack,
  dataDir = defaultDataDir
): Promise<StoredIntentPack> {
  await ensureDir(dataDir);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const stored: StoredIntentPack = { id, createdAt, ...pack };
  await writeFile(join(dataDir, `${id}.json`), JSON.stringify(stored, null, 2), "utf8");
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
      packs.push(JSON.parse(content) as StoredIntentPack);
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
