import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { generateIntentPack } from "./generateIntentPack.js";
import { toGitHubIssueMarkdown } from "./issueMarkdown.js";
import {
  saveIntentPack,
  listIntentPacks,
  getIntentPackById,
  deleteIntentPack,
  patchIntentPack,
  duplicateIntentPack,
} from "./intentPackStore.js";
import type { IntentPackInput } from "./types.js";

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function json(res: any, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

async function readJson<T>(req: any): Promise<T> {
  const chunks: any[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

async function serveStatic(pathname: string, publicDir: string, res: any): Promise<void> {
  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(publicDir, relativePath);
  const file = await readFile(filePath);
  const type = mimeTypes[extname(filePath)] ?? "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  res.end(file);
}

export function createHandler(dataDir: string, publicDir: string) {
  return async (req: any, res: any): Promise<void> => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(
        req.url ?? "/",
        `http://${req.headers.host ?? "localhost"}`
      );

      if (method === "GET" && url.pathname === "/api/health") {
        return json(res, 200, { ok: true, service: "ghostrail" });
      }

      if (method === "POST" && url.pathname === "/api/intent-pack") {
        const body = await readJson<IntentPackInput>(req);
        if (!body.goal || !body.goal.trim()) {
          return json(res, 400, { error: "goal is required" });
        }

        const pack = generateIntentPack(body);
        const goalText = body.goal.trim();
        const ctxText = body.repositoryContext?.trim() || undefined;
        const stored = await saveIntentPack(pack, goalText, ctxText, dataDir);
        return json(res, 200, stored);
      }

      if (method === "POST" && url.pathname === "/api/intent-pack/export-issue") {
        const body = await readJson<IntentPackInput>(req);
        if (!body.goal || !body.goal.trim()) {
          return json(res, 400, { error: "goal is required" });
        }

        const pack = generateIntentPack(body);
        const markdown = toGitHubIssueMarkdown(pack);
        return json(res, 200, { markdown, pack });
      }

      if (method === "GET" && url.pathname === "/api/intent-packs") {
        const packs = await listIntentPacks(dataDir);
        return json(res, 200, packs);
      }

      if (method === "DELETE" && url.pathname.startsWith("/api/intent-packs/")) {
        const id = url.pathname.slice("/api/intent-packs/".length);
        const deleted = await deleteIntentPack(id, dataDir);
        if (!deleted) return json(res, 404, { error: "not found" });
        return json(res, 200, { ok: true });
      }

      if (method === "PATCH" && url.pathname.startsWith("/api/intent-packs/")) {
        const id = url.pathname.slice("/api/intent-packs/".length);
        const body = await readJson<{ notes?: unknown; tags?: unknown; goal?: unknown; repositoryContext?: unknown; starred?: unknown; archived?: unknown }>(req);
        const patch: { notes?: string; tags?: string[]; goal?: string; repositoryContext?: string; starred?: boolean; archived?: boolean } = {};
        if (body.notes !== undefined) {
          if (typeof body.notes !== "string") {
            return json(res, 400, { error: "notes must be a string" });
          }
          patch.notes = body.notes;
        }
        if (body.tags !== undefined) {
          if (
            !Array.isArray(body.tags) ||
            !(body.tags as unknown[]).every((t) => typeof t === "string")
          ) {
            return json(res, 400, { error: "tags must be an array of strings" });
          }
          const seen = new Set<string>();
          patch.tags = [];
          for (const tag of body.tags as string[]) {
            const normalized = tag.trim();
            if (!normalized) continue;
            const lower = normalized.toLowerCase();
            if (seen.has(lower)) continue;
            seen.add(lower);
            patch.tags.push(normalized);
          }
        }
        if (body.goal !== undefined) {
          if (typeof body.goal !== "string") {
            return json(res, 400, { error: "goal must be a string" });
          }
          const trimmedGoal = body.goal.trim();
          if (!trimmedGoal) {
            return json(res, 400, { error: "goal must not be empty" });
          }
          patch.goal = trimmedGoal;
        }
        if (body.repositoryContext !== undefined) {
          if (typeof body.repositoryContext !== "string") {
            return json(res, 400, { error: "repositoryContext must be a string" });
          }
          patch.repositoryContext = body.repositoryContext.trim();
        }
        if (body.starred !== undefined) {
          if (typeof body.starred !== "boolean") {
            return json(res, 400, { error: "starred must be a boolean" });
          }
          patch.starred = body.starred;
        }
        if (body.archived !== undefined) {
          if (typeof body.archived !== "boolean") {
            return json(res, 400, { error: "archived must be a boolean" });
          }
          patch.archived = body.archived;
        }
        const updated = await patchIntentPack(id, patch, dataDir);
        if (!updated) return json(res, 404, { error: "not found" });
        return json(res, 200, updated);
      }

      if (method === "POST" && url.pathname.startsWith("/api/intent-packs/")) {
        const rest = url.pathname.slice("/api/intent-packs/".length);
        if (rest.endsWith("/duplicate")) {
          const id = rest.slice(0, -"/duplicate".length);
          const duplicate = await duplicateIntentPack(id, dataDir);
          if (!duplicate) return json(res, 404, { error: "not found" });
          return json(res, 200, duplicate);
        }
        return json(res, 404, { error: "not found" });
      }

      if (method === "GET" && url.pathname.startsWith("/api/intent-packs/")) {
        const rest = url.pathname.slice("/api/intent-packs/".length);
        const exportIssueSuffix = "/export-issue";

        if (rest.endsWith(exportIssueSuffix)) {
          const id = rest.slice(0, -exportIssueSuffix.length);
          const pack = await getIntentPackById(id, dataDir);
          if (!pack) return json(res, 404, { error: "not found" });
          const markdown = toGitHubIssueMarkdown(pack);
          return json(res, 200, { markdown });
        }

        const pack = await getIntentPackById(rest, dataDir);
        if (!pack) return json(res, 404, { error: "not found" });
        return json(res, 200, pack);
      }

      if (method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/assets/"))) {
        return serveStatic(url.pathname, publicDir, res);
      }

      return json(res, 404, { error: "not found" });
    } catch (error) {
      json(res, 500, {
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  };
}
