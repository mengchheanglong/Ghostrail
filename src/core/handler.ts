import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { generateIntentPack } from "./generateIntentPack.js";
import { toGitHubIssueMarkdown } from "./issueMarkdown.js";
import { toTaskPacketJson, toAgentPrompt } from "./taskPacket.js";
import { toPrDescription } from "./prDescription.js";
import { computeDriftReport } from "./driftReport.js";
import { parseGitDiff } from "./diffParser.js";
import { loadPolicy, applyPolicy } from "./policy.js";
import {
  saveIntentPack,
  listIntentPacks,
  getIntentPackById,
  deleteIntentPack,
  patchIntentPack,
  duplicateIntentPack,
  linkPrToIntentPack,
  listPackHistory,
} from "./intentPackStore.js";
import type { IntentPackInput, PackStatus } from "./types.js";
import { VALID_STATUSES } from "./types.js";

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

export function createHandler(dataDir: string, publicDir: string, policyPath?: string) {
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

        // Apply repo policy warnings (non-blocking)
        let policyWarnings: string[] | undefined;
        try {
          const policy = await loadPolicy(policyPath);
          if (policy) {
            const warnings = applyPolicy(pack.touchedAreas, policy);
            if (warnings.length > 0) policyWarnings = warnings;
          }
        } catch {
          // Policy errors are non-fatal
        }

        const stored = await saveIntentPack(pack, goalText, ctxText, dataDir, policyWarnings);
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
        const body = await readJson<{ notes?: unknown; tags?: unknown; goal?: unknown; repositoryContext?: unknown; starred?: unknown; archived?: unknown; status?: unknown }>(req);
        const patch: { notes?: string; tags?: string[]; goal?: string; repositoryContext?: string; starred?: boolean; archived?: boolean; status?: PackStatus } = {};
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
        if (body.status !== undefined) {
          if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as PackStatus)) {
            return json(res, 400, { error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
          }
          patch.status = body.status as PackStatus;
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
        if (rest.endsWith("/link-pr")) {
          const id = rest.slice(0, -"/link-pr".length);
          const body = await readJson<{ prUrl?: unknown; changedFiles?: unknown }>(req);
          if (!body.prUrl || typeof body.prUrl !== "string" || !body.prUrl.trim()) {
            return json(res, 400, { error: "prUrl is required and must be a non-empty string" });
          }
          if (body.changedFiles !== undefined) {
            if (
              !Array.isArray(body.changedFiles) ||
              !(body.changedFiles as unknown[]).every((f) => typeof f === "string")
            ) {
              return json(res, 400, { error: "changedFiles must be an array of strings" });
            }
          }
          const linked = await linkPrToIntentPack(
            id,
            body.prUrl.trim(),
            body.changedFiles as string[] | undefined,
            dataDir
          );
          if (!linked) return json(res, 404, { error: "not found" });
          return json(res, 200, linked);
        }

        if (rest.endsWith("/analyze-diff")) {
          const id = rest.slice(0, -"/analyze-diff".length);
          const body = await readJson<{ diffText?: unknown; prUrl?: unknown }>(req);
          if (!body.diffText || typeof body.diffText !== "string" || !body.diffText.trim()) {
            return json(res, 400, { error: "diffText is required and must be a non-empty string" });
          }
          const changedFiles = parseGitDiff(body.diffText);
          const prUrl = typeof body.prUrl === "string" && body.prUrl.trim()
            ? body.prUrl.trim()
            : undefined;
          const pack = await getIntentPackById(id, dataDir);
          if (!pack) return json(res, 404, { error: "not found" });
          // Store the parsed files (and optionally the PR link) on the pack
          const updated = await linkPrToIntentPack(
            id,
            prUrl ?? pack.prLink ?? "diff-analyzed",
            changedFiles,
            dataDir
          );
          if (!updated) return json(res, 404, { error: "not found" });
          const report = computeDriftReport(updated);
          return json(res, 200, { report, changedFiles });
        }

        return json(res, 404, { error: "not found" });
      }

      if (method === "GET" && url.pathname.startsWith("/api/intent-packs/")) {
        const rest = url.pathname.slice("/api/intent-packs/".length);

        if (rest.endsWith("/export-issue")) {
          const id = rest.slice(0, -"/export-issue".length);
          const pack = await getIntentPackById(id, dataDir);
          if (!pack) return json(res, 404, { error: "not found" });
          const markdown = toGitHubIssueMarkdown(pack);
          return json(res, 200, { markdown });
        }

        if (rest.endsWith("/task-packet")) {
          const id = rest.slice(0, -"/task-packet".length);
          const pack = await getIntentPackById(id, dataDir);
          if (!pack) return json(res, 404, { error: "not found" });
          const packet = toTaskPacketJson(pack);
          const prompt = toAgentPrompt(pack);
          return json(res, 200, { packet, prompt });
        }

        if (rest.endsWith("/pr-description")) {
          const id = rest.slice(0, -"/pr-description".length);
          const pack = await getIntentPackById(id, dataDir);
          if (!pack) return json(res, 404, { error: "not found" });
          const markdown = toPrDescription(pack);
          return json(res, 200, { markdown });
        }

        if (rest.endsWith("/history")) {
          const id = rest.slice(0, -"/history".length);
          const history = await listPackHistory(id, dataDir);
          if (history === null) return json(res, 404, { error: "not found" });
          return json(res, 200, history);
        }

        if (rest.endsWith("/drift-report")) {
          const id = rest.slice(0, -"/drift-report".length);
          const pack = await getIntentPackById(id, dataDir);
          if (!pack) return json(res, 404, { error: "not found" });
          const report = computeDriftReport(pack);
          return json(res, 200, report);
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
