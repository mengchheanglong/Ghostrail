import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHandler } from "./core/handler.js";
import { defaultDataDir } from "./core/intentPackStore.js";
import { createProvider } from "./core/llmProvider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");
const publicDir = join(rootDir, "public");
const port = Number(process.env.PORT ?? 3000);

const openaiApiKey = process.env.OPENAI_API_KEY;
const provider = openaiApiKey
  ? createProvider({ type: "openai", apiKey: openaiApiKey })
  : undefined; // defaults to HeuristicProvider inside createHandler

if (openaiApiKey) {
  console.log("Ghostrail: using OpenAI provider (gpt-4o)");
} else {
  console.log("Ghostrail: using heuristic provider (set OPENAI_API_KEY to enable OpenAI)");
}

const server = createServer(createHandler(defaultDataDir, publicDir, undefined, provider));

server.listen(port, () => {
  console.log(`Ghostrail running at http://localhost:${port}`);
});

void __filename;
