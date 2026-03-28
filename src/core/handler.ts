import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { generateIntentPack } from "./generateIntentPack.js";
import { toGitHubIssueMarkdown } from "./issueMarkdown.js";
import {
  saveIntentPack,
  listIntentPacks,
  getIntentPackById,
  deleteIntentPack,
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
