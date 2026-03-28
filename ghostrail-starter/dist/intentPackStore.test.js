import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateIntentPack } from "./core/generateIntentPack.js";
import { saveIntentPack, listIntentPacks, getIntentPackById, deleteIntentPack } from "./core/intentPackStore.js";
async function withTempDir(fn) {
    const dir = await mkdtemp(join(tmpdir(), "ghostrail-test-"));
    try {
        await fn(dir);
    }
    finally {
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
        await new Promise((resolve) => setTimeout(resolve, 5));
        const stored2 = await saveIntentPack(pack2, undefined, undefined, dir);
        const list = await listIntentPacks(dir);
        assert.equal(list.length, 2, "list should contain both packs");
        assert.equal(list[0].id, stored2.id, "newest pack should be first");
        assert.equal(list[1].id, stored1.id, "oldest pack should be last");
    });
});
test("fetching a saved pack by id returns the correct pack", async () => {
    await withTempDir(async (dir) => {
        const pack = generateIntentPack({ goal: "Fetch pack by id test" });
        const stored = await saveIntentPack(pack, undefined, undefined, dir);
        const fetched = await getIntentPackById(stored.id, dir);
        if (!fetched)
            throw new Error("pack not found");
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
        if (!fetched)
            throw new Error("pack not found");
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
        assert.equal(list[0].goal, goalText, "list should expose the original goal");
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
        assert.equal(list[0].goal, undefined, "goal should be undefined for old packs");
        assert.equal(list[0].repositoryContext, undefined, "repositoryContext should be undefined for old packs");
        const fetched = await getIntentPackById(id, dir);
        assert.ok(fetched, "old pack should be fetchable by id");
        if (!fetched)
            throw new Error("pack not found");
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
        if (!fetched)
            throw new Error("pack not found");
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
        assert.equal(list[0].repositoryContext, ctxText, "list should expose the repositoryContext");
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
        await new Promise((resolve) => setTimeout(resolve, 5));
        const stored2 = await saveIntentPack(pack2, "Delete this", undefined, dir);
        await deleteIntentPack(stored2.id, dir);
        const list = await listIntentPacks(dir);
        assert.equal(list.length, 1, "only one pack should remain");
        assert.equal(list[0].id, stored1.id, "the remaining pack should be the one not deleted");
    });
});
