import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHandler } from "./core/handler.js";
import { defaultDataDir } from "./core/intentPackStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");
const publicDir = join(rootDir, "public");
const port = Number(process.env.PORT ?? 3000);

const server = createServer(createHandler(defaultDataDir, publicDir));

server.listen(port, () => {
  console.log(`Ghostrail running at http://localhost:${port}`);
});

void __filename;
