import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateIntentPack } from "./core/generateIntentPack.js";
import { toGitHubIssueMarkdown } from "./core/issueMarkdown.js";
import type { IntentPackInput } from "./core/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");
const publicDir = join(rootDir, "public");
const port = Number(process.env.PORT ?? 3000);

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = createServer(async (req: any, res: any) => {
  try {
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `localhost:${port}`}`);

    if (method === "GET" && url.pathname === "/api/health") {
      return json(res, 200, { ok: true, service: "ghostrail" });
    }

    if (method === "POST" && url.pathname === "/api/intent-pack") {
      const body = await readJson<IntentPackInput>(req);
      if (!body.goal || !body.goal.trim()) {
        return json(res, 400, { error: "goal is required" });
      }

      const pack = generateIntentPack(body);
      return json(res, 200, pack);
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

    if (method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/assets/"))) {
      return serveStatic(url.pathname, res);
    }

    return json(res, 404, { error: "not found" });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : "unknown error"
    });
  }
});

server.listen(port, () => {
  console.log(`Ghostrail running at http://localhost:${port}`);
});

async function serveStatic(pathname: string, res: any): Promise<void> {
  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(publicDir, relativePath);
  const file = await readFile(filePath);
  const type = mimeTypes[extname(filePath)] ?? "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  res.end(file);
}

async function readJson<T>(req: any): Promise<T> {
  const chunks: any[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

function json(res: any, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

void __filename;
