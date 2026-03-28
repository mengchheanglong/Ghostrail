import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateIntentPack } from "./core/generateIntentPack.js";
import { saveIntentPack, listIntentPacks, getIntentPackById } from "./core/intentPackStore.js";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "ghostrail-test-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("saving a generated pack persists id and createdAt", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Add file persistence for intent packs" });
    const stored = await saveIntentPack(pack, dir);

    assert.ok(stored.id, "stored pack should have an id");
    assert.ok(stored.createdAt, "stored pack should have a createdAt timestamp");
    assert.equal(stored.objective, pack.objective);
    assert.equal(stored.reasoningMode, "heuristic");
    assert.deepEqual(stored.constraints, pack.constraints);
  });
});

test("listing saved packs returns all packs newest first", async () => {
  await withTempDir(async (dir) => {
    const pack1 = generateIntentPack({ goal: "First pack goal" });
    const pack2 = generateIntentPack({ goal: "Second pack goal" });

    const stored1 = await saveIntentPack(pack1, dir);
    // Small delay so the two timestamps are distinct
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    const stored2 = await saveIntentPack(pack2, dir);

    const list = await listIntentPacks(dir);

    assert.equal(list.length, 2, "list should contain both packs");
    assert.equal(list[0]!.id, stored2.id, "newest pack should be first");
    assert.equal(list[1]!.id, stored1.id, "oldest pack should be last");
  });
});

test("fetching a saved pack by id returns the correct pack", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Fetch pack by id test" });
    const stored = await saveIntentPack(pack, dir);

    const fetched = await getIntentPackById(stored.id, dir);

    assert.ok(fetched, "should find the pack");
    if (!fetched) throw new Error("pack not found");
    assert.equal(fetched.id, stored.id);
    assert.equal(fetched.createdAt, stored.createdAt);
    assert.equal(fetched.objective, stored.objective);
  });
});

test("invalid id returns null (not found behavior)", async () => {
  await withTempDir(async (dir) => {
    const result = await getIntentPackById("does-not-exist", dir);
    assert.equal(result, null);
  });
});

test("non-existent valid-format uuid returns null", async () => {
  await withTempDir(async (dir) => {
    const result = await getIntentPackById("00000000-0000-0000-0000-000000000000", dir);
    assert.equal(result, null);
  });
});

test("listIntentPacks skips malformed JSON files without crashing", async () => {
  const { writeFile } = await import("node:fs/promises");
  await withTempDir(async (dir) => {
    // Write a broken JSON file alongside a valid pack
    await writeFile(join(dir, "bad.json"), "{ not valid json", "utf8");

    const pack = generateIntentPack({ goal: "Valid pack alongside broken file" });
    await saveIntentPack(pack, dir);

    const list = await listIntentPacks(dir);
    assert.equal(list.length, 1, "only the valid pack should be returned");
  });
});
