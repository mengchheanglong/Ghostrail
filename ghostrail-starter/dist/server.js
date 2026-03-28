import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateIntentPack } from "./core/generateIntentPack.js";
import { toGitHubIssueMarkdown } from "./core/issueMarkdown.js";
import { saveIntentPack, listIntentPacks, getIntentPackById } from "./core/intentPackStore.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");
const publicDir = join(rootDir, "public");
const port = Number(process.env.PORT ?? 3000);
const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
};
const server = createServer(async (req, res) => {
    try {
        const method = req.method ?? "GET";
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `localhost:${port}`}`);
        if (method === "GET" && url.pathname === "/api/health") {
            return json(res, 200, { ok: true, service: "ghostrail" });
        }
        if (method === "POST" && url.pathname === "/api/intent-pack") {
            const body = await readJson(req);
            if (!body.goal || !body.goal.trim()) {
                return json(res, 400, { error: "goal is required" });
            }
            const pack = generateIntentPack(body);
            const stored = await saveIntentPack(pack);
            return json(res, 200, stored);
        }
        if (method === "POST" && url.pathname === "/api/intent-pack/export-issue") {
            const body = await readJson(req);
            if (!body.goal || !body.goal.trim()) {
                return json(res, 400, { error: "goal is required" });
            }
            const pack = generateIntentPack(body);
            const markdown = toGitHubIssueMarkdown(pack);
            return json(res, 200, { markdown, pack });
        }
        if (method === "GET" && url.pathname === "/api/intent-packs") {
            const packs = await listIntentPacks();
            return json(res, 200, packs);
        }
        if (method === "GET" && url.pathname.startsWith("/api/intent-packs/")) {
            const rest = url.pathname.slice("/api/intent-packs/".length);
            const exportIssueSuffix = "/export-issue";
            if (rest.endsWith(exportIssueSuffix)) {
                const id = rest.slice(0, -exportIssueSuffix.length);
                const pack = await getIntentPackById(id);
                if (!pack)
                    return json(res, 404, { error: "not found" });
                const markdown = toGitHubIssueMarkdown(pack);
                return json(res, 200, { markdown });
            }
            const pack = await getIntentPackById(rest);
            if (!pack)
                return json(res, 404, { error: "not found" });
            return json(res, 200, pack);
        }
        if (method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/assets/"))) {
            return serveStatic(url.pathname, res);
        }
        return json(res, 404, { error: "not found" });
    }
    catch (error) {
        return json(res, 500, {
            error: error instanceof Error ? error.message : "unknown error"
        });
    }
});
server.listen(port, () => {
    console.log(`Ghostrail running at http://localhost:${port}`);
});
async function serveStatic(pathname, res) {
    const relativePath = pathname === "/" ? "/index.html" : pathname;
    const filePath = join(publicDir, relativePath);
    const file = await readFile(filePath);
    const type = mimeTypes[extname(filePath)] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(file);
}
async function readJson(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    return raw ? JSON.parse(raw) : {};
}
function json(res, status, body) {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body, null, 2));
}
void __filename;
