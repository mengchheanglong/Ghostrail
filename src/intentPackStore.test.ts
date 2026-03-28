import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateIntentPack } from "./core/generateIntentPack.js";
import { saveIntentPack, listIntentPacks, getIntentPackById, deleteIntentPack, patchIntentPack, duplicateIntentPack } from "./core/intentPackStore.js";

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
    const stored = await saveIntentPack(pack, undefined, undefined, dir);

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

    const stored1 = await saveIntentPack(pack1, undefined, undefined, dir);
    // Small delay so the two timestamps are distinct
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    const stored2 = await saveIntentPack(pack2, undefined, undefined, dir);

    const list = await listIntentPacks(dir);

    assert.equal(list.length, 2, "list should contain both packs");
    assert.equal(list[0]!.id, stored2.id, "newest pack should be first");
    assert.equal(list[1]!.id, stored1.id, "oldest pack should be last");
  });
});

test("fetching a saved pack by id returns the correct pack", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Fetch pack by id test" });
    const stored = await saveIntentPack(pack, undefined, undefined, dir);

    const fetched = await getIntentPackById(stored.id, dir);
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
  await withTempDir(async (dir) => {
    // Write a broken JSON file alongside a valid pack
    await writeFile(join(dir, "bad.json"), "{ not valid json", "utf8");

    const pack = generateIntentPack({ goal: "Valid pack alongside broken file" });
    await saveIntentPack(pack, undefined, undefined, dir);

    const list = await listIntentPacks(dir);
    assert.equal(list.length, 1, "only the valid pack should be returned");
  });
});

test("saving a pack with a goal persists the goal field", async () => {
  await withTempDir(async (dir) => {
    const goalText = "Add real-time notifications without breaking the existing feed";
    const pack = generateIntentPack({ goal: goalText });
    const stored = await saveIntentPack(pack, goalText, undefined, dir);

    assert.equal(stored.goal, goalText, "stored pack should carry the original goal");

    const fetched = await getIntentPackById(stored.id, dir);
    assert.ok(fetched, "should find the pack on disk");
    if (!fetched) throw new Error("pack not found");
    assert.equal(fetched.goal, goalText, "goal should survive the disk round-trip");
  });
});

test("listing packs includes goal for new packs", async () => {
  await withTempDir(async (dir) => {
    const goalText = "Export packs as GitHub issues";
    const pack = generateIntentPack({ goal: goalText });
    await saveIntentPack(pack, goalText, undefined, dir);

    const list = await listIntentPacks(dir);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.goal, goalText, "list should expose the original goal");
  });
});

test("older packs without goal still load safely", async () => {
  await withTempDir(async (dir) => {
    // Simulate an older stored pack that has no goal or repositoryContext field
    const id = "11111111-2222-3333-4444-555555555555";
    const oldPack = {
      id,
      createdAt: new Date().toISOString(),
      objective: "Old objective",
      nonGoals: [],
      constraints: [],
      acceptanceCriteria: [],
      touchedAreas: [],
      risks: [],
      openQuestions: [],
      confidence: "medium",
      reasoningMode: "heuristic",
      // deliberately no `goal` or `repositoryContext` fields
    };
    await writeFile(join(dir, `${id}.json`), JSON.stringify(oldPack, null, 2), "utf8");

    const list = await listIntentPacks(dir);
    assert.equal(list.length, 1, "old pack should still be loaded");
    assert.equal(list[0]!.goal, undefined, "goal should be undefined for old packs");
    assert.equal(list[0]!.repositoryContext, undefined, "repositoryContext should be undefined for old packs");

    const fetched = await getIntentPackById(id, dir);
    assert.ok(fetched, "old pack should be fetchable by id");
    if (!fetched) throw new Error("pack not found");
    assert.equal(fetched.goal, undefined, "goal should be undefined for old pack fetched by id");
    assert.equal(fetched.repositoryContext, undefined, "repositoryContext should be undefined for old pack fetched by id");
  });
});

test("saving a pack with repositoryContext persists the field", async () => {
  await withTempDir(async (dir) => {
    const goalText = "Add webhook support";
    const ctxText = "Node.js backend with Express; no database changes allowed";
    const pack = generateIntentPack({ goal: goalText, repositoryContext: ctxText });
    const stored = await saveIntentPack(pack, goalText, ctxText, dir);

    assert.equal(stored.repositoryContext, ctxText, "stored pack should carry the repositoryContext");

    const fetched = await getIntentPackById(stored.id, dir);
    assert.ok(fetched, "should find the pack on disk");
    if (!fetched) throw new Error("pack not found");
    assert.equal(fetched.repositoryContext, ctxText, "repositoryContext should survive the disk round-trip");
  });
});

test("listing packs includes repositoryContext for new packs", async () => {
  await withTempDir(async (dir) => {
    const ctxText = "React frontend, REST API backend";
    const pack = generateIntentPack({ goal: "Add dark mode" });
    await saveIntentPack(pack, "Add dark mode", ctxText, dir);

    const list = await listIntentPacks(dir);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.repositoryContext, ctxText, "list should expose the repositoryContext");
  });
});

test("deleteIntentPack removes the pack from disk", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Pack to be deleted" });
    const stored = await saveIntentPack(pack, "Pack to be deleted", undefined, dir);

    const deleted = await deleteIntentPack(stored.id, dir);
    assert.equal(deleted, true, "deleteIntentPack should return true on success");

    const fetched = await getIntentPackById(stored.id, dir);
    assert.equal(fetched, null, "pack should no longer be retrievable after deletion");
  });
});

test("deleteIntentPack returns false for a non-existent valid uuid", async () => {
  await withTempDir(async (dir) => {
    const result = await deleteIntentPack("00000000-0000-0000-0000-000000000000", dir);
    assert.equal(result, false);
  });
});

test("deleteIntentPack returns false for an invalid id format", async () => {
  await withTempDir(async (dir) => {
    const result = await deleteIntentPack("not-a-uuid", dir);
    assert.equal(result, false);
  });
});

test("listIntentPacks no longer includes a deleted pack", async () => {
  await withTempDir(async (dir) => {
    const pack1 = generateIntentPack({ goal: "Keep this" });
    const pack2 = generateIntentPack({ goal: "Delete this" });

    const stored1 = await saveIntentPack(pack1, "Keep this", undefined, dir);
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    const stored2 = await saveIntentPack(pack2, "Delete this", undefined, dir);

    await deleteIntentPack(stored2.id, dir);

    const list = await listIntentPacks(dir);
    assert.equal(list.length, 1, "only one pack should remain");
    assert.equal(list[0]!.id, stored1.id, "the remaining pack should be the one not deleted");
  });
});

// ── Notes and tags persistence ────────────────────────────────

test("saving a pack with notes persists the notes field", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Pack with notes" });
    const stored = await saveIntentPack(pack, "Pack with notes", undefined, dir);

    const patched = await patchIntentPack(stored.id, { notes: "This pack needs review before use." }, dir);
    assert.ok(patched, "patchIntentPack should return the updated pack");
    assert.equal(patched!.notes, "This pack needs review before use.", "notes should be saved");

    const fetched = await getIntentPackById(stored.id, dir);
    assert.ok(fetched, "pack should still be retrievable");
    assert.equal(fetched!.notes, "This pack needs review before use.", "notes should survive disk round-trip");
  });
});

test("saving a pack with tags persists the tags field", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Pack with tags" });
    const stored = await saveIntentPack(pack, "Pack with tags", undefined, dir);

    const patched = await patchIntentPack(stored.id, { tags: ["billing", "urgent"] }, dir);
    assert.ok(patched, "patchIntentPack should return the updated pack");
    assert.deepEqual(patched!.tags, ["billing", "urgent"], "tags should be saved");

    const fetched = await getIntentPackById(stored.id, dir);
    assert.ok(fetched, "pack should still be retrievable");
    assert.deepEqual(fetched!.tags, ["billing", "urgent"], "tags should survive disk round-trip");
  });
});

test("patchIntentPack can update both notes and tags in one call", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Patch both" });
    const stored = await saveIntentPack(pack, "Patch both", undefined, dir);

    const patched = await patchIntentPack(stored.id, { notes: "See tracking doc.", tags: ["auth", "infra"] }, dir);
    assert.ok(patched, "should return updated pack");
    assert.equal(patched!.notes, "See tracking doc.");
    assert.deepEqual(patched!.tags, ["auth", "infra"]);
  });
});

test("patchIntentPack returns null for a non-existent valid-format uuid", async () => {
  await withTempDir(async (dir) => {
    const result = await patchIntentPack("00000000-0000-0000-0000-000000000000", { notes: "hi" }, dir);
    assert.equal(result, null);
  });
});

test("patchIntentPack returns null for an invalid id format", async () => {
  await withTempDir(async (dir) => {
    const result = await patchIntentPack("not-a-uuid", { notes: "hi" }, dir);
    assert.equal(result, null);
  });
});

test("older packs without notes or tags still load safely", async () => {
  await withTempDir(async (dir) => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const oldPack = {
      id,
      createdAt: new Date().toISOString(),
      objective: "Old objective without notes or tags",
      nonGoals: [],
      constraints: [],
      acceptanceCriteria: [],
      touchedAreas: [],
      risks: [],
      openQuestions: [],
      confidence: "medium",
      reasoningMode: "heuristic",
      // deliberately no notes or tags
    };
    await writeFile(join(dir, `${id}.json`), JSON.stringify(oldPack, null, 2), "utf8");

    const list = await listIntentPacks(dir);
    assert.equal(list.length, 1, "old pack should load");
    assert.equal(list[0]!.notes, undefined, "notes should be undefined for old packs");
    assert.equal(list[0]!.tags, undefined, "tags should be undefined for old packs");

    const fetched = await getIntentPackById(id, dir);
    assert.ok(fetched);
    assert.equal(fetched!.notes, undefined);
    assert.equal(fetched!.tags, undefined);
  });
});

// ── Goal and repositoryContext patching ───────────────────────

test("patchIntentPack updates goal", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Original goal" });
    const stored = await saveIntentPack(pack, "Original goal", undefined, dir);

    const patched = await patchIntentPack(stored.id, { goal: "Updated goal" }, dir);
    assert.ok(patched, "patchIntentPack should return the updated pack");
    assert.equal(patched!.goal, "Updated goal", "goal should be updated");

    const fetched = await getIntentPackById(stored.id, dir);
    assert.equal(fetched!.goal, "Updated goal", "updated goal should survive disk round-trip");
  });
});

test("patchIntentPack updates repositoryContext", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Pack for context patch" });
    const stored = await saveIntentPack(pack, "Pack for context patch", undefined, dir);

    const patched = await patchIntentPack(stored.id, { repositoryContext: "React frontend" }, dir);
    assert.ok(patched, "patchIntentPack should return the updated pack");
    assert.equal(patched!.repositoryContext, "React frontend", "repositoryContext should be updated");

    const fetched = await getIntentPackById(stored.id, dir);
    assert.equal(fetched!.repositoryContext, "React frontend", "updated repositoryContext should survive disk round-trip");
  });
});

test("patchIntentPack with empty repositoryContext removes the field", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Pack with context to clear" });
    const stored = await saveIntentPack(pack, "Pack with context to clear", "Some context", dir);

    const patched = await patchIntentPack(stored.id, { repositoryContext: "" }, dir);
    assert.ok(patched, "patchIntentPack should return the updated pack");
    assert.equal(patched!.repositoryContext, undefined, "repositoryContext should be removed when set to empty string");

    const fetched = await getIntentPackById(stored.id, dir);
    assert.equal(fetched!.repositoryContext, undefined, "removed repositoryContext should not reappear after reload");
  });
});

test("patchIntentPack can update goal without touching notes or tags", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Pack with notes and goal" });
    const stored = await saveIntentPack(pack, "Pack with notes and goal", undefined, dir);
    await patchIntentPack(stored.id, { notes: "Keep this note", tags: ["keep-me"] }, dir);

    const patched = await patchIntentPack(stored.id, { goal: "New goal only" }, dir);
    assert.ok(patched);
    assert.equal(patched!.goal, "New goal only");
    assert.equal(patched!.notes, "Keep this note", "notes should be untouched");
    assert.deepEqual(patched!.tags, ["keep-me"], "tags should be untouched");
  });
});

// ── Duplicate pack ────────────────────────────────────────────

test("duplicateIntentPack creates a new pack with a new id and createdAt", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Original to duplicate" });
    const stored = await saveIntentPack(pack, "Original to duplicate", "Some context", dir);
    await patchIntentPack(stored.id, { notes: "My note", tags: ["dup-test"] }, dir);

    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    const duplicate = await duplicateIntentPack(stored.id, dir);

    assert.ok(duplicate, "should return a duplicate pack");
    assert.notEqual(duplicate!.id, stored.id, "duplicate should have a different id");
    assert.notEqual(duplicate!.createdAt, stored.createdAt, "duplicate should have a later createdAt");
    assert.equal(duplicate!.goal, stored.goal, "goal should be preserved");
    assert.equal(duplicate!.repositoryContext, stored.repositoryContext, "repositoryContext should be preserved");
    assert.equal(duplicate!.objective, stored.objective, "objective should be preserved");
    assert.equal(duplicate!.notes, "My note", "notes should be preserved in duplicate");
    assert.deepEqual(duplicate!.tags, ["dup-test"], "tags should be preserved in duplicate");
  });
});

test("duplicateIntentPack does not modify the original", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Keep original intact" });
    const stored = await saveIntentPack(pack, "Keep original intact", undefined, dir);

    await duplicateIntentPack(stored.id, dir);

    const original = await getIntentPackById(stored.id, dir);
    assert.ok(original, "original should still exist");
    assert.equal(original!.id, stored.id, "original id should be unchanged");
  });
});

test("duplicateIntentPack returns null for a non-existent valid-format uuid", async () => {
  await withTempDir(async (dir) => {
    const result = await duplicateIntentPack("00000000-0000-0000-0000-000000000000", dir);
    assert.equal(result, null);
  });
});

test("duplicateIntentPack returns null for an invalid id format", async () => {
  await withTempDir(async (dir) => {
    const result = await duplicateIntentPack("not-a-uuid", dir);
    assert.equal(result, null);
  });
});

test("listIntentPacks includes the duplicate and the original after duplication", async () => {
  await withTempDir(async (dir) => {
    const pack = generateIntentPack({ goal: "Both should appear in list" });
    const stored = await saveIntentPack(pack, "Both should appear in list", undefined, dir);
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    await duplicateIntentPack(stored.id, dir);

    const list = await listIntentPacks(dir);
    assert.equal(list.length, 2, "both original and duplicate should appear");
  });
});
