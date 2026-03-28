declare const process: any;
declare const Buffer: any;

declare module "node:http" {
  export function createServer(handler: any): any;
}

declare module "node:fs/promises" {
  export function readFile(path: string): Promise<any>;
}

declare module "node:path" {
  export function extname(path: string): string;
  export function join(...parts: string[]): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}

declare module "node:test" {
  const test: any;
  export default test;
}

declare module "node:assert/strict" {
  const assert: any;
  export default assert;
}
